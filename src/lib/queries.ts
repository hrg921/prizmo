import "server-only";
import { redirect } from "next/navigation";
import { all, one, run } from "./db";
import type { User } from "./session";

/* ---------------- 도메인 상수 ---------------- */

import { AXES, CONCERNS, CRITERIA_KEYS, PACKAGES, REGIONS, SITES, STAGES, type Axis } from "./constants";
export { AXES, CONCERNS, CRITERIA_KEYS, PACKAGES, REGIONS, SITES, STAGES, type Axis };

/**
 * 환자가 고른 기준 → 정렬 키. 점수를 합산하지 않고,
 * 고른 순서대로 ORDER BY 키를 이어 붙여 정렬만 합니다(가중치/순위 없음).
 */
export const CRITERIA: Record<(typeof CRITERIA_KEYS)[number], { axis: Axis; orderBy: string }> = {
  "연구 경력": { axis: "research", orderBy: "research_n DESC" },
  "자격·경력": { axis: "credential", orderBy: "(cert_short = '세부전문의') DESC, career_years DESC" },
  "최신 치료": { axis: "trials", orderBy: "trials_n DESC" },
  "병원 평가": { axis: "hospital", orderBy: "hospital_grade ASC, multidisciplinary DESC" },
  거리: { axis: "condition", orderBy: "distance_km ASC" },
};

/* ---------------- 타입 ---------------- */

export type Profile = {
  user_id: number;
  site: string;
  stage: string;
  concerns: string[];
  region: string;
  criteria: string[];
};

export type DoctorRow = {
  id: number;
  name: string;
  initial: string;
  hospital: string;
  department: string;
  region: string;
  certification: string;
  cert_short: string;
  career_years: number;
  hospital_grade: number;
  multidisciplinary: boolean;
  clinic_days: string;
  distance_km: number;
  research_n: number;
  trials_n: number;
  viewed: boolean;
};

/* ---------------- 프로필 ---------------- */

export async function getProfile(userId: number) {
  return one<Profile>(
    "SELECT user_id, site, stage, concerns, region, criteria FROM profiles WHERE user_id = $1",
    [userId],
  );
}

export async function requireProfile(user: User): Promise<Profile> {
  const p = await getProfile(user.id);
  if (!p) redirect("/situation");
  return p;
}

/* ---------------- 의료진 ---------------- */

/** $1 = 사용자 id, $2 = 부위. where/orderBy 에서는 $3부터 씁니다. */
function doctorSql(where: string, orderBy = "d.id") {
  return `
    SELECT d.id, d.name, d.initial, d.hospital, d.department, d.region,
           d.certification, d.cert_short, d.career_years, d.hospital_grade,
           d.multidisciplinary, d.clinic_days, d.distance_km,
           (SELECT count(*) FROM publications p
             WHERE p.doctor_id = d.id AND p.cancer_site = $2
               AND p.year >= extract(year FROM current_date)::int - 5)::int AS research_n,
           (SELECT count(*) FROM trials t
             WHERE t.doctor_id = d.id AND t.role = '책임연구자')::int AS trials_n,
           EXISTS (SELECT 1 FROM views v WHERE v.user_id = $1 AND v.doctor_id = d.id) AS viewed
      FROM doctors d
     WHERE ${where}
     ORDER BY ${orderBy}`;
}

/** 내 기준 정렬 목록: 지역·부위로 거른 뒤, 고른 기준 순서대로 정렬 */
export async function listDoctors(userId: number, p: Profile) {
  const keys = p.criteria
    .filter((c): c is keyof typeof CRITERIA => c in CRITERIA)
    .map((c) => CRITERIA[c].orderBy);
  const orderBy = [...keys, "d.id"].join(", ");
  return all<DoctorRow>(doctorSql("d.region = $3 AND $2 = ANY(d.sites)", orderBy), [userId, p.site, p.region]);
}

export async function getDoctor(userId: number, doctorId: number, p: Profile) {
  return one<DoctorRow>(doctorSql("d.id = $3"), [userId, p.site, doctorId]);
}

/** 열람한 의료진만 (열람 순서대로) */
export async function viewedDoctors(userId: number, p: Profile) {
  return all<DoctorRow>(
    doctorSql(
      "d.id IN (SELECT doctor_id FROM views WHERE user_id = $1)",
      "(SELECT viewed_at FROM views v2 WHERE v2.user_id = $1 AND v2.doctor_id = d.id)",
    ),
    [userId, p.site],
  );
}

export async function requireViewed(user: User, doctorId: number, p: Profile) {
  if (!Number.isInteger(doctorId)) redirect("/results");
  const d = await getDoctor(user.id, doctorId, p);
  if (!d || !d.viewed) redirect("/results");
  return d;
}

/* ---------------- 공개 기록 ---------------- */

export type Publication = {
  id: number;
  year: number;
  venue: string;
  title_ko: string;
  summary_ko: string;
  title_en: string;
  tags: string[];
  url: string;
};

export async function publications(doctorId: number, site: string, tag: string | null) {
  return all<Publication>(
    `SELECT id, year, venue, title_ko, summary_ko, title_en, tags, url
       FROM publications
      WHERE doctor_id = $1 AND cancer_site = $2
        AND year >= extract(year FROM current_date)::int - 5
        AND ($3::text = '' OR $3::text = ANY(tags))
      ORDER BY year DESC, id`,
    [doctorId, site, tag ?? ""],
  );
}

export type Trial = { id: number; phase: string; title_ko: string; role: string; source: string; status: string; year: number };

export async function trials(doctorId: number) {
  return all<Trial>(
    `SELECT id, phase, title_ko, role, source, status, year FROM trials
      WHERE doctor_id = $1 ORDER BY role = '책임연구자' DESC, year DESC`,
    [doctorId],
  );
}

export type RecordRow = { id: number; source: string; title: string; detail: string };

export async function records(doctorId: number, axis: string) {
  return all<RecordRow>(
    "SELECT id, source, title, detail FROM records WHERE doctor_id = $1 AND axis = $2 ORDER BY id",
    [doctorId, axis],
  );
}

/* ---------------- 진료 준비 질문 ---------------- */

export async function questionsFor(p: Profile) {
  // 고민(선택 순서) → 병기 → 부위 → 공통 순서
  const rows = await all<{ question: string }>(
    `SELECT question
       FROM question_templates
      WHERE (trigger_kind = 'concern' AND trigger_value = ANY($1::text[]))
         OR (trigger_kind = 'stage'   AND trigger_value = $2)
         OR (trigger_kind = 'site'    AND trigger_value = $3)
         OR  trigger_kind = 'always'
      ORDER BY sort / 10, coalesce(array_position($1::text[], trigger_value), 0), sort, id`,
    [p.concerns, p.stage, p.site],
  );
  return rows.map((x) => x.question);
}

/* ---------------- 이벤트 ---------------- */

export async function logEvent(userId: number | null, name: string, doctorId: number | null = null) {
  try {
    await run("INSERT INTO events (user_id, name, doctor_id) VALUES ($1, $2, $3)", [userId, name, doctorId]);
  } catch {
    // 분석 로그 실패는 사용자 흐름을 막지 않습니다.
  }
}

/* ---------------- 표시용 헬퍼 ---------------- */

export const siteLabel = (site: string) => `${site}암`;

export function axisSummary(d: DoctorRow, site: string) {
  return {
    research: { title: `${siteLabel(site)} 관련 논문·발표 ${d.research_n}건`, sub: "최근 5년 공개 기록" },
    credential: { title: `${d.certification} · 경력 ${d.career_years}년`, sub: "학회·병원 공개 기록" },
    trials: { title: `대장암 임상시험 책임연구자 ${d.trials_n}건`, sub: "국가 임상시험 공개 기록" },
    hospital: {
      title: `심평원 대장암 평가 ${d.hospital_grade}등급${d.multidisciplinary ? " · 다학제" : ""}`,
      sub: "병원 단위 공개 정보",
    },
    condition: { title: `${d.clinic_days} 진료 · ${d.distance_km}km`, sub: "병원 안내·선택 지역 기준" },
  } satisfies Record<Axis, { title: string; sub: string }>;
}

export const maskName = (name: string) => (name.length <= 1 ? name : name[0] + "○".repeat(Math.max(2, name.length - 1)));
export const formatPhone = (p: string) =>
  p.length === 11 ? `${p.slice(0, 3)}-${p.slice(3, 7)}-${p.slice(7)}` : `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}`;
