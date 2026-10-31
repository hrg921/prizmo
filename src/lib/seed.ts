import type { Q } from "./db";

/**
 * Postgres 스키마. 모든 의료진·기록 데이터는 데모용 가명/예시 데이터입니다.
 * 콜드 스타트마다 실행돼도 안전하도록 IF NOT EXISTS로 작성합니다.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id               SERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  phone            TEXT NOT NULL UNIQUE,
  verified_at      TIMESTAMPTZ NOT NULL,
  agree_terms      BOOLEAN NOT NULL,
  agree_privacy    BOOLEAN NOT NULL,
  agree_health     BOOLEAN NOT NULL,
  agree_marketing  BOOLEAN NOT NULL DEFAULT false,
  view_credits     INTEGER NOT NULL DEFAULT 2 CHECK (view_credits >= 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 휴대폰 본인인증(데모: SMS 대신 화면에 인증번호 표시)
CREATE TABLE IF NOT EXISTS verifications (
  phone       TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  code        TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  verified    BOOLEAN NOT NULL DEFAULT false
);

-- 내 상황(민감정보: 건강 상태) — 민감정보 동의가 있을 때만 저장
CREATE TABLE IF NOT EXISTS profiles (
  user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  site        TEXT NOT NULL,          -- 결장 | 직장
  stage       TEXT NOT NULL,          -- 1기 | 2기 | 3기 | 모름
  concerns    TEXT[] NOT NULL,        -- 항문 보존 | 로봇 수술 | 항암 병행
  region      TEXT NOT NULL,          -- 서울 | 경기 | 기타
  criteria    TEXT[] NOT NULL,        -- 정확히 2개, 선택 순서 = 정렬 우선순위
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS doctors (
  id                 INTEGER PRIMARY KEY,
  name               TEXT NOT NULL,
  initial            TEXT NOT NULL,
  hospital           TEXT NOT NULL,
  department         TEXT NOT NULL,
  region             TEXT NOT NULL,
  sites              TEXT[] NOT NULL,
  certification      TEXT NOT NULL,
  cert_short         TEXT NOT NULL,
  career_years       INTEGER NOT NULL,
  hospital_grade     INTEGER NOT NULL,   -- 심평원 대장암 적정성 평가 등급(1이 가장 높음)
  multidisciplinary  BOOLEAN NOT NULL,
  clinic_days        TEXT NOT NULL,
  distance_km        DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS publications (
  id           INTEGER PRIMARY KEY,
  doctor_id    INTEGER NOT NULL REFERENCES doctors(id),
  year         INTEGER NOT NULL,
  venue        TEXT NOT NULL,
  cancer_site  TEXT NOT NULL,         -- 직장 | 결장
  title_ko     TEXT NOT NULL,
  summary_ko   TEXT NOT NULL,
  title_en     TEXT NOT NULL,
  tags         TEXT[] NOT NULL,
  url          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS publications_doctor_site_year ON publications (doctor_id, cancer_site, year);

CREATE TABLE IF NOT EXISTS trials (
  id         INTEGER PRIMARY KEY,
  doctor_id  INTEGER NOT NULL REFERENCES doctors(id),
  phase      TEXT NOT NULL,
  title_ko   TEXT NOT NULL,
  role       TEXT NOT NULL,           -- 책임연구자 | 공동연구자
  source     TEXT NOT NULL,
  status     TEXT NOT NULL,
  year       INTEGER NOT NULL
);

-- 자격 / 병원 / 조건 축의 출처별 공개 기록
CREATE TABLE IF NOT EXISTS records (
  id         INTEGER PRIMARY KEY,
  doctor_id  INTEGER NOT NULL REFERENCES doctors(id),
  axis       TEXT NOT NULL,           -- credential | hospital | condition
  source     TEXT NOT NULL,
  title      TEXT NOT NULL,
  detail     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS question_templates (
  id             INTEGER PRIMARY KEY,
  trigger_kind   TEXT NOT NULL,       -- concern | stage | site | always
  trigger_value  TEXT,
  question       TEXT NOT NULL,
  sort           INTEGER NOT NULL
);

-- 열람(언락) 기록: 열람권 1회 = 의료진 1명
CREATE TABLE IF NOT EXISTS views (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id  INTEGER NOT NULL REFERENCES doctors(id),
  viewed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, doctor_id)
);

CREATE TABLE IF NOT EXISTS purchases (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package     TEXT NOT NULL,
  credits     INTEGER NOT NULL,
  amount      INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 프로토타입 퍼널 분석용 이벤트 로그 (탈퇴하면 익명화)
CREATE TABLE IF NOT EXISTS events (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  doctor_id   INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_name_user ON events (name, user_id);

-- 예시 데이터 버전 등 앱 메타 정보
CREATE TABLE IF NOT EXISTS app_meta (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

/* ------------------------------------------------------------------ */
/* 예시 데이터                                                          */
/* ------------------------------------------------------------------ */

type Doc = {
  id: number;
  name: string;
  hospital: string;
  region: string;
  cert: [string, string];
  career: number;
  grade: number;
  multi: boolean;
  days: string;
  km: number;
  rectal: number[]; // 최근 5년 직장암 논문 템플릿 인덱스
  colon: number[]; // 최근 5년 결장암 논문 템플릿 인덱스
  old: number; // 5년보다 오래된 직장암 논문 수(필터 동작 확인용)
  trials: { tpl: number; role: "책임연구자" | "공동연구자" }[];
  sites?: string[]; // 진료 부위 (기본: 직장·결장)
};

const range = (n: number, skip: number[] = []) =>
  Array.from({ length: 24 }, (_, i) => i).filter((i) => !skip.includes(i)).slice(0, n);

const DOCTORS: Doc[] = [
  {
    id: 1, name: "김○○", hospital: "○○대병원", region: "서울",
    cert: ["대장항문 세부전문의", "세부전문의"], career: 18, grade: 1, multi: true,
    days: "화·목 오전", km: 12, rectal: range(24), colon: [0, 1, 2, 3, 6, 8], old: 3,
    trials: [{ tpl: 0, role: "책임연구자" }, { tpl: 2, role: "책임연구자" }, { tpl: 3, role: "책임연구자" }, { tpl: 1, role: "공동연구자" }],
  },
  {
    id: 2, name: "이○○", hospital: "△△병원", region: "서울",
    cert: ["대장항문 세부전문의", "세부전문의"], career: 14, grade: 1, multi: true,
    days: "월·수 오후", km: 5, rectal: range(19, [7, 12, 14, 16, 22]), colon: [0, 1, 2, 3, 4, 5, 6, 7, 9], old: 2,
    trials: [{ tpl: 1, role: "책임연구자" }, { tpl: 0, role: "공동연구자" }],
  },
  {
    id: 3, name: "박○○", hospital: "□□대병원", region: "서울",
    cert: ["대장항문 세부전문의", "세부전문의"], career: 9, grade: 2, multi: true,
    days: "화·금 오전", km: 8, rectal: [0, 1, 4, 5, 8, 10, 13, 18, 19, 20, 23], colon: [1, 3, 7, 8], old: 0,
    trials: [{ tpl: 4, role: "책임연구자" }, { tpl: 2, role: "책임연구자" }],
  },
  {
    id: 4, name: "최○○", hospital: "◇◇대병원", region: "경기",
    cert: ["대장항문 세부전문의", "세부전문의"], career: 16, grade: 1, multi: true,
    days: "월·목 오전", km: 9, rectal: range(14, [1, 4, 8]), colon: [0, 2, 3, 4, 5, 6, 8, 9], old: 4,
    trials: [{ tpl: 0, role: "책임연구자" }, { tpl: 5, role: "책임연구자" }],
  },
  {
    id: 5, name: "정○○", hospital: "☆☆병원", region: "경기",
    cert: ["외과 전문의", "외과 전문의"], career: 11, grade: 2, multi: false,
    days: "수·금 오전", km: 4, rectal: [1, 4, 8, 13, 19, 20, 23], colon: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 1, 7].slice(0, 10), old: 1,
    trials: [],
  },
  {
    id: 6, name: "강○○", hospital: "▽▽대병원(부산)", region: "기타",
    cert: ["대장항문 세부전문의", "세부전문의"], career: 21, grade: 1, multi: true,
    days: "화·목 오후", km: 15, rectal: range(16, [2, 9]), colon: [0, 2, 4, 5, 9], old: 5,
    trials: [{ tpl: 2, role: "책임연구자" }, { tpl: 3, role: "공동연구자" }],
  },
  {
    id: 7, name: "윤○○", hospital: "◎◎병원(대구)", region: "기타",
    cert: ["대장항문 세부전문의", "세부전문의"], career: 12, grade: 1, multi: true,
    days: "월·금 오전", km: 7, rectal: [0, 2, 3, 6, 10, 11, 15, 17, 21], colon: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], old: 2,
    trials: [{ tpl: 5, role: "책임연구자" }],
  },

  /* ---- v2 추가 (기존 1~7번은 배포 DB와 같아야 하므로 순서·값을 바꾸지 않습니다) ---- */

  // 서울
  {
    id: 8, name: "조○○", hospital: "○○대병원", region: "서울",
    cert: ["대장항문 세부전문의", "세부전문의"], career: 7, grade: 1, multi: true,
    days: "월·목 오후", km: 12, rectal: range(8, [0, 1, 2]), colon: [0, 3, 7], old: 0,
    trials: [{ tpl: 3, role: "책임연구자" }],
  },
  {
    id: 9, name: "장○○", hospital: "■■대병원", region: "서울",
    cert: ["대장항문 세부전문의", "세부전문의"], career: 22, grade: 1, multi: true,
    days: "수·금 오전", km: 18, rectal: range(17, [3]), colon: [2, 5, 8, 9], old: 6,
    trials: [{ tpl: 1, role: "책임연구자" }, { tpl: 0, role: "공동연구자" }],
  },
  {
    id: 10, name: "임○○", hospital: "△△병원", region: "서울",
    cert: ["대장항문 세부전문의", "세부전문의"], career: 10, grade: 1, multi: true,
    days: "화·목 오후", km: 5, rectal: range(13, [5, 10]), colon: [1, 4], old: 1,
    trials: [],
  },
  {
    id: 11, name: "한○○", hospital: "▲▲병원", region: "서울",
    cert: ["외과 전문의", "외과 전문의"], career: 13, grade: 2, multi: false,
    days: "월·화·금 오전", km: 3, rectal: [10, 11, 16, 17, 21], colon: [0, 4, 5, 9], old: 1,
    trials: [],
  },
  {
    id: 12, name: "오○○", hospital: "□□대병원", region: "서울",
    cert: ["대장항문 세부전문의", "세부전문의"], career: 15, grade: 2, multi: true,
    days: "수 오전·금 오후", km: 8, rectal: range(15, [0, 2, 6]), colon: [1, 2, 3], old: 2,
    trials: [{ tpl: 0, role: "책임연구자" }, { tpl: 2, role: "책임연구자" }],
  },
  {
    id: 13, name: "서○○", hospital: "■■대병원", region: "서울",
    cert: ["대장항문 세부전문의", "세부전문의"], career: 6, grade: 1, multi: true,
    days: "화 오전·목 오후", km: 18, rectal: [1, 4, 8, 13, 19, 23], colon: [1, 7], old: 0,
    trials: [{ tpl: 1, role: "공동연구자" }],
  },
  {
    // 결장암만 진료 → 직장암을 고르면 목록에 나오지 않음
    id: 14, name: "신○○", hospital: "◆◆의료원", region: "서울",
    cert: ["대장항문 세부전문의", "세부전문의"], career: 19, grade: 3, multi: false,
    days: "월·수·금 오전", km: 22, rectal: [], colon: [0, 2, 3, 4, 5, 6, 8, 9, 1, 7], old: 0,
    trials: [{ tpl: 4, role: "책임연구자" }, { tpl: 5, role: "책임연구자" }], sites: ["결장"],
  },
  // 경기
  {
    id: 15, name: "권○○", hospital: "◇◇대병원", region: "경기",
    cert: ["대장항문 세부전문의", "세부전문의"], career: 8, grade: 1, multi: true,
    days: "화·금 오후", km: 11, rectal: [0, 3, 5, 9, 12, 20, 23], colon: [0, 6], old: 0,
    trials: [{ tpl: 3, role: "책임연구자" }],
  },
  {
    id: 16, name: "황○○", hospital: "◁◁병원", region: "경기",
    cert: ["대장항문 세부전문의", "세부전문의"], career: 17, grade: 2, multi: true,
    days: "월·수 오전", km: 6, rectal: range(12, [4, 8, 13, 19]), colon: [1, 2, 3, 4], old: 3,
    trials: [{ tpl: 2, role: "공동연구자" }],
  },
  {
    id: 17, name: "안○○", hospital: "☆☆병원", region: "경기",
    cert: ["외과 전문의", "외과 전문의"], career: 9, grade: 2, multi: false,
    days: "목·토 오전", km: 4, rectal: [10, 11, 17, 18], colon: [0, 5, 8], old: 0,
    trials: [],
  },
  {
    id: 18, name: "송○○", hospital: "▷▷대병원", region: "경기",
    cert: ["대장항문 세부전문의", "세부전문의"], career: 20, grade: 1, multi: true,
    days: "화·목 오전", km: 25, rectal: range(20, [6, 14]), colon: [0, 2, 3, 6, 9], old: 5,
    trials: [{ tpl: 0, role: "책임연구자" }, { tpl: 1, role: "책임연구자" }, { tpl: 4, role: "공동연구자" }],
  },
  // 기타 지역
  {
    id: 19, name: "류○○", hospital: "▽▽대병원(부산)", region: "기타",
    cert: ["대장항문 세부전문의", "세부전문의"], career: 11, grade: 1, multi: true,
    days: "월·목 오전", km: 15, rectal: range(10, [0, 1]), colon: [3, 6], old: 0,
    trials: [{ tpl: 1, role: "책임연구자" }],
  },
  {
    id: 20, name: "전○○", hospital: "♤♤병원(광주)", region: "기타",
    cert: ["대장항문 세부전문의", "세부전문의"], career: 14, grade: 1, multi: true,
    days: "수·금 오후", km: 9, rectal: [0, 2, 3, 6, 7, 14, 15, 22], colon: [0, 1, 3], old: 2,
    trials: [{ tpl: 3, role: "책임연구자" }, { tpl: 2, role: "공동연구자" }],
  },
  {
    id: 21, name: "홍○○", hospital: "◎◎병원(대구)", region: "기타",
    cert: ["외과 전문의", "외과 전문의"], career: 7, grade: 2, multi: true,
    days: "화·금 오전", km: 7, rectal: [1, 4, 13, 19], colon: [1, 7], old: 0,
    trials: [],
  },
  {
    id: 22, name: "고○○", hospital: "♧♧대병원(대전)", region: "기타",
    cert: ["대장항문 세부전문의", "세부전문의"], career: 16, grade: 1, multi: true,
    days: "월·수 오전", km: 12, rectal: range(12, [0]), colon: [0, 2, 3, 4, 5, 6, 9], old: 3,
    trials: [{ tpl: 4, role: "책임연구자" }, { tpl: 5, role: "책임연구자" }],
  },
];

/**
 * 예시 데이터 버전. 올리면 다음 배포 때 새 행만 추가됩니다(ON CONFLICT DO NOTHING).
 * v1: 의료진 7명 · v2: 22명
 */
export const SEED_VERSION = 2;

// [한국어 제목, 영문 제목(원문 검색용), 한국어 요약, 태그]
type Tpl = [string, string, string, string[]];

const RECTAL: Tpl[] = [
  ["직장암 항문 보존 수술 후 배변 기능 비교", "Bowel function after sphincter-preserving surgery for rectal cancer", "수술 방식에 따른 회복과 배변 기능 차이를 분석", ["항문 보존"]],
  ["로봇 직장암 수술의 단기 결과", "Short-term outcomes of robotic rectal cancer surgery", "로봇 수술 후 합병증과 입원 기간을 분석", ["로봇 수술"]],
  ["진행성 직장암의 수술 전 치료", "Neoadjuvant therapy for locally advanced rectal cancer", "항암·방사선 치료 후 수술 결과를 관찰", ["항암 병행"]],
  ["저위 직장암 괄약근 간 절제술의 장기 결과", "Long-term outcomes of intersphincteric resection for low rectal cancer", "괄약근 간 절제 후 재발률과 배변 기능을 추적", ["항문 보존"]],
  ["로봇 vs 복강경 직장간막 전절제술 비교", "Robotic vs laparoscopic total mesorectal excision outcomes", "두 수술 방식의 절제면 상태와 회복 속도를 비교", ["로봇 수술"]],
  ["저위전방절제 증후군의 경과와 관리", "Low anterior resection syndrome after rectal cancer surgery", "수술 후 배변 불편이 시간에 따라 어떻게 변하는지 관찰", ["항문 보존"]],
  ["총체적 선행 치료(TNT) 후 수술 결과", "Surgical outcomes after total neoadjuvant therapy for rectal cancer", "수술 전 항암·방사선을 모두 마친 뒤의 수술 결과를 분석", ["항암 병행"]],
  ["완전관해 환자의 경과 관찰 전략", "Watch-and-wait after clinical complete response in rectal cancer", "수술 전 치료로 종양이 사라진 환자의 경과를 추적", ["항암 병행", "항문 보존"]],
  ["로봇 수술 후 배뇨·성기능 보존", "Urogenital function after robotic rectal cancer surgery", "로봇 수술 후 배뇨·성기능 변화를 분석", ["로봇 수술"]],
  ["임시 장루 복원 시기와 합병증", "Timing of diverting ileostomy closure after rectal cancer surgery", "임시 장루를 닫는 시기에 따른 합병증 차이를 비교", ["항문 보존"]],
  ["직장암 수술 후 문합부 누출 위험 요인", "Risk factors for anastomotic leakage after rectal cancer surgery", "장을 이은 부위가 새는 합병증의 위험 요인을 분석", []],
  ["고령 직장암 환자의 수술 안전성", "Safety of rectal cancer surgery in elderly patients", "70세 이상 환자의 수술 후 합병증과 회복을 분석", []],
  ["경항문 직장간막 전절제술의 초기 경험", "Early experience with transanal total mesorectal excision", "항문을 통한 절제술의 초기 수술 결과를 정리", ["항문 보존"]],
  ["로봇 직장암 수술의 학습 곡선", "Learning curve of robotic rectal cancer surgery", "집도 경험이 쌓이며 수술 시간과 합병증이 어떻게 변하는지 분석", ["로봇 수술"]],
  ["수술 전 단기 방사선 vs 장기 항암방사선 치료", "Short-course radiotherapy vs long-course chemoradiotherapy for rectal cancer", "두 가지 수술 전 방사선 치료 방식의 결과를 비교", ["항암 병행"]],
  ["직장암 수술 후 보조 항암 치료의 효과", "Adjuvant chemotherapy after rectal cancer surgery", "수술 후 항암 치료 여부에 따른 재발률을 비교", ["항암 병행"]],
  ["측방 림프절 전이 직장암의 수술 결과", "Lateral lymph node dissection in rectal cancer", "골반 옆 림프절까지 절제한 환자의 결과를 분석", []],
  ["직장암 수술 후 국소 재발 양상", "Patterns of local recurrence after rectal cancer surgery", "수술 후 재발이 어디서 어떻게 생기는지 분석", []],
  ["회복 촉진 프로그램(ERAS) 적용 결과", "Enhanced recovery after surgery in rectal cancer", "빠른 회복 프로그램 적용 후 입원 기간 변화를 분석", []],
  ["로봇 수술의 비용과 입원 기간", "Cost and length of stay in robotic rectal surgery", "로봇 수술의 비용과 입원 기간을 복강경과 비교", ["로봇 수술"]],
  ["항문 보존 수술 후 삶의 질", "Quality of life after sphincter-preserving rectal surgery", "수술 후 일상생활과 삶의 질 변화를 설문으로 분석", ["항문 보존"]],
  ["MRI 기반 수술 전 병기 판정의 정확도", "Accuracy of MRI staging before rectal cancer surgery", "수술 전 MRI 판정과 실제 병기를 비교", []],
  ["다학제 진료가 치료 결과에 미치는 영향", "Multidisciplinary team management and rectal cancer outcomes", "여러 진료과가 함께 정한 치료의 결과를 분석", ["항암 병행"]],
  ["로봇 괄약근 간 절제술의 기능적 결과", "Functional outcomes of robotic intersphincteric resection", "로봇으로 시행한 항문 보존 수술의 배변 기능을 추적", ["로봇 수술", "항문 보존"]],
];

const COLON: Tpl[] = [
  ["복강경 결장암 수술의 장기 생존율", "Long-term survival after laparoscopic colon cancer surgery", "복강경 수술 환자의 5년 생존율을 분석", []],
  ["로봇 우측 결장 절제술의 단기 결과", "Short-term outcomes of robotic right hemicolectomy", "로봇 수술 후 합병증과 회복 기간을 분석", ["로봇 수술"]],
  ["완전 결장간막 절제술의 효과", "Complete mesocolic excision for colon cancer", "넓은 범위 절제가 재발률에 미치는 영향을 분석", []],
  ["3기 결장암 보조 항암 치료 기간 비교", "Duration of adjuvant chemotherapy in stage III colon cancer", "3개월과 6개월 항암 치료의 결과를 비교", ["항암 병행"]],
  ["폐색성 결장암의 응급 수술 vs 스텐트", "Emergency surgery vs stent as bridge to surgery in obstructive colon cancer", "장이 막힌 환자의 치료 방식별 결과를 비교", []],
  ["고령 결장암 환자의 수술 후 회복", "Recovery after colon cancer surgery in elderly patients", "고령 환자의 수술 후 기능 회복을 추적", []],
  ["진행성 결장암의 수술 전 항암 치료", "Neoadjuvant chemotherapy for locally advanced colon cancer", "수술 전 항암 치료 후 절제 결과를 관찰", ["항암 병행"]],
  ["로봇 vs 복강경 결장 절제술 비교", "Robotic vs laparoscopic colectomy", "두 수술 방식의 회복 속도와 합병증을 비교", ["로봇 수술"]],
  ["결장암 수술 후 회복 촉진 프로그램", "Enhanced recovery after colon cancer surgery", "빠른 회복 프로그램 적용 후 입원 기간을 분석", []],
  ["좌측·우측 결장암의 예후 차이", "Prognosis of left- vs right-sided colon cancer", "종양 위치에 따른 생존율 차이를 분석", []],
];

const VENUES = ["대한대장항문학회지", "대한외과학회 학술대회", "국제 대장암 학술지", "대한종양외과학회 학술대회", "대한대장항문학회 추계학술대회"];

const TRIALS: [string, string, string][] = [
  ["3상", "직장암 수술 전 총체적 선행 치료 비교 임상시험", "ClinicalTrials.gov"],
  ["3상", "로봇 vs 복강경 직장암 수술 무작위 비교 연구", "ClinicalTrials.gov"],
  ["2상", "저위 직장암 항문 보존 수술 후 배변 재활 프로그램 연구", "임상연구정보서비스(CRIS)"],
  ["2상", "완전관해 직장암 환자의 경과 관찰 전략 연구", "임상연구정보서비스(CRIS)"],
  ["3상", "3기 결장암 보조 항암 치료 기간 비교 연구", "ClinicalTrials.gov"],
  ["2상", "진행성 결장암 수술 전 항암 치료 연구", "임상연구정보서비스(CRIS)"],
];

const QUESTIONS: [string, string | null, string, number][] = [
  ["concern", "항문 보존", "제 종양 위치에서 항문 보존이 가능한가요?", 10],
  ["concern", "로봇 수술", "로봇 수술과 복강경은 어떤 차이가 있나요?", 11],
  ["concern", "항암 병행", "항암 치료는 수술 전과 후 중 언제 하게 되나요?", 12],
  ["stage", "1기", "수술 범위를 줄이거나 내시경으로 치료할 수 있는 경우인가요?", 20],
  ["stage", "2기", "수술 전 항암 치료가 필요한가요?", 20],
  ["stage", "3기", "수술 전 항암 치료가 필요한가요?", 20],
  ["stage", "모름", "정확한 병기를 확인하려면 어떤 검사가 더 필요한가요?", 20],
  ["site", "직장", "임시 장루가 필요할 수 있나요? 얼마나 유지하나요?", 30],
  ["site", "결장", "수술 후 회복과 퇴원까지 얼마나 걸리나요?", 30],
  ["always", null, "수술 후 추적 검사는 어떤 주기로 받게 되나요?", 40],
  ["always", null, "다른 병원 의견(2차 소견)을 받아봐도 될까요?", 41],
];

const pubmed = (q: string) => `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(q)}`;

/** 행 배열을 jsonb_to_recordset 한 번으로 넣습니다(원격 DB 왕복 최소화).
 *  $1::text::jsonb — postgres.js가 jsonb 파라미터 문자열을 다시 JSON 인코딩하지 않도록 text로 받습니다. */
async function insertRows(q: Q, table: string, columns: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const names = columns.split(",").map((c) => c.trim().split(/\s+/)[0]).join(", ");
  await q.query(
    `INSERT INTO ${table} (${names}) SELECT ${names} FROM jsonb_to_recordset($1::text::jsonb) AS x(${columns})
     ON CONFLICT (id) DO NOTHING`,
    [JSON.stringify(rows)],
  );
}

export async function seed(q: Q) {
  const doctors: Record<string, unknown>[] = [];
  const pubs: Record<string, unknown>[] = [];
  const trials: Record<string, unknown>[] = [];
  const recs: Record<string, unknown>[] = [];

  for (const d of DOCTORS) {
    doctors.push({
      id: d.id, name: d.name, initial: d.name.slice(0, 1), hospital: d.hospital, department: "대장항문외과",
      region: d.region, sites: d.sites ?? ["직장", "결장"], certification: d.cert[0], cert_short: d.cert[1],
      career_years: d.career, hospital_grade: d.grade, multidisciplinary: d.multi, clinic_days: d.days, distance_km: d.km,
    });

    const addPub = (t: Tpl, site: string, year: number, k: number) =>
      pubs.push({
        id: pubs.length + 1, doctor_id: d.id, year, venue: VENUES[k % VENUES.length], cancer_site: site,
        title_ko: t[0], summary_ko: t[2], title_en: t[1], tags: t[3], url: pubmed(t[1]),
      });

    // 최근 5년(2021~2025) 기록. 앞 세 건은 2024·2023·2022로 고정.
    for (const [k, idx] of d.rectal.entries()) {
      addPub(RECTAL[idx], "직장", k < 3 ? 2024 - k : 2025 - ((idx * 7 + d.id + k) % 5), k + d.id);
    }
    for (const [k, idx] of d.colon.entries()) {
      addPub(COLON[idx % COLON.length], "결장", 2025 - ((idx * 3 + d.id + k) % 5), k + d.id + 2);
    }
    // 5년보다 오래된 기록 (최근 5년 필터 동작 확인용)
    for (let k = 0; k < d.old; k++) {
      addPub(RECTAL[(k * 5 + d.id) % RECTAL.length], "직장", 2016 + (k % 4), k);
    }

    for (const t of d.trials) {
      const [phase, title, source] = TRIALS[t.tpl];
      trials.push({
        id: trials.length + 1, doctor_id: d.id, phase, title_ko: title, role: t.role, source,
        status: (t.tpl + d.id) % 3 === 0 ? "모집 중" : "완료", year: 2019 + ((t.tpl + d.id) % 6),
      });
    }

    const r: [string, string, string, string][] = [
      ["credential", "대한대장항문학회", d.cert[1] === "세부전문의" ? "세부전문의 명단 등재" : "학회 정회원 명단 등재", "학회 공개 명단 (PDF)"],
      ["credential", "병원 홈페이지", `의료진 소개 · 진료 경력 ${d.career}년`, `외과 전문의 취득 ${2026 - d.career}년`],
      ["hospital", "건강보험심사평가원", `대장암 적정성 평가 ${d.grade}등급`, "최근 공개 차수 · 병원 단위 평가"],
      ["hospital", "병원 홈페이지", d.multi ? "대장암 다학제 진료 운영" : "다학제 진료 안내 없음", d.multi ? "외과·종양내과·방사선종양학과 협진" : "공개 안내 기준"],
      ["condition", "병원 홈페이지", "외래 진료 시간표", d.days],
      ["condition", "선택 지역 기준", `약 ${d.km}km`, `${d.region} 지역 중심에서 병원까지 예상 거리`],
    ];
    for (const [axis, source, title, detail] of r) {
      recs.push({ id: recs.length + 1, doctor_id: d.id, axis, source, title, detail });
    }
  }

  await insertRows(q, "doctors",
    "id int, name text, initial text, hospital text, department text, region text, sites text[], certification text, cert_short text, career_years int, hospital_grade int, multidisciplinary boolean, clinic_days text, distance_km double precision",
    doctors);
  await insertRows(q, "publications",
    "id int, doctor_id int, year int, venue text, cancer_site text, title_ko text, summary_ko text, title_en text, tags text[], url text",
    pubs);
  await insertRows(q, "trials",
    "id int, doctor_id int, phase text, title_ko text, role text, source text, status text, year int", trials);
  await insertRows(q, "records", "id int, doctor_id int, axis text, source text, title text, detail text", recs);
  await insertRows(q, "question_templates", "id int, trigger_kind text, trigger_value text, question text, sort int",
    QUESTIONS.map(([kind, value, question, sort], i) => ({ id: i + 1, trigger_kind: kind, trigger_value: value, question, sort })));
}
