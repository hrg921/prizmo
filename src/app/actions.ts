"use server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { one, run, tx } from "@/lib/db";
import { clearSession, requireUser, setSession, getCurrentUser } from "@/lib/session";
import { logEvent } from "@/lib/queries";
import { CONCERNS, CRITERIA_KEYS, PACKAGES, REGIONS, SITES, STAGES } from "@/lib/constants";

/* ------------------------------------------------------------------ */
/* STEP 01 · 휴대폰 본인인증 (데모: SMS 대신 화면에 인증번호 표시)          */
/* ------------------------------------------------------------------ */

const normPhone = (p: string) => p.replace(/\D/g, "");
const PHONE_RE = /^01[016789]\d{7,8}$/;

export async function requestCode(name: string, phoneRaw: string) {
  const phone = normPhone(phoneRaw);
  const n = name.trim();
  if (n.length < 2 || n.length > 20) return { ok: false as const, error: "이름을 정확히 입력해 주세요." };
  if (!PHONE_RE.test(phone)) return { ok: false as const, error: "휴대폰 번호를 확인해 주세요." };
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await run(
    `INSERT INTO verifications (phone, name, code, expires_at, verified)
     VALUES ($1, $2, $3, now() + interval '3 minutes', false)
     ON CONFLICT (phone) DO UPDATE
       SET name = EXCLUDED.name, code = EXCLUDED.code, expires_at = EXCLUDED.expires_at, verified = false`,
    [phone, n, code],
  );
  // 실제 서비스에서는 본인인증 기관(PASS 등)으로 대체합니다.
  return { ok: true as const, demoCode: code };
}

export async function verifyCode(phoneRaw: string, code: string) {
  const phone = normPhone(phoneRaw);
  const v = await one<{ ok: boolean }>(
    `SELECT code = $2 AND expires_at > now() AS ok FROM verifications WHERE phone = $1`,
    [phone, code.trim()],
  );
  if (!v?.ok) return { ok: false as const, error: "인증번호가 맞지 않거나 만료됐어요." };
  await run("UPDATE verifications SET verified = true WHERE phone = $1", [phone]);
  return { ok: true as const };
}

export async function signup(formData: FormData) {
  const phone = normPhone(String(formData.get("phone") ?? ""));
  const agree = (k: string) => formData.get(k) === "on";
  if (!agree("terms") || !agree("privacy") || !agree("health")) redirect("/signup?error=consent");

  const v = await one<{ name: string }>(
    "SELECT name FROM verifications WHERE phone = $1 AND verified",
    [phone],
  );
  if (!v) redirect("/signup?error=verify");

  // 같은 번호로 다시 가입하면 기존 계정으로 로그인합니다. (xmax = 0 이면 새로 INSERT된 행)
  const { userId, isNew } = await tx(async (q) => {
    const [r] = await q.query<{ id: number; is_new: boolean }>(
      `INSERT INTO users (name, phone, verified_at, agree_terms, agree_privacy, agree_health, agree_marketing)
       VALUES ($1, $2, now(), true, true, true, $3)
       ON CONFLICT (phone) DO UPDATE
         SET name = EXCLUDED.name, verified_at = now(), agree_terms = true, agree_privacy = true,
             agree_health = true, agree_marketing = EXCLUDED.agree_marketing
       RETURNING id, (xmax = 0) AS is_new`,
      [v.name, phone, agree("marketing")],
    );
    await q.query("DELETE FROM verifications WHERE phone = $1", [phone]);
    return { userId: r.id, isNew: r.is_new };
  });

  await setSession(userId);
  if (isNew) {
    await logEvent(userId, "signup");
    redirect("/welcome");
  }
  redirect("/");
}

/* ------------------------------------------------------------------ */
/* STEP 03 · 상황 입력                                                  */
/* ------------------------------------------------------------------ */

export async function saveSituation(formData: FormData) {
  const user = await requireUser();
  if (!user.agree_health) redirect("/situation");

  const pick = <T extends readonly string[]>(k: string, allowed: T) => {
    const v = String(formData.get(k) ?? "");
    return (allowed as readonly string[]).includes(v) ? v : null;
  };
  const many = (k: string, allowed: readonly string[]) =>
    [...new Set(formData.getAll(k).map(String))].filter((v) => allowed.includes(v));

  const site = pick("site", SITES);
  const stage = pick("stage", STAGES);
  const region = pick("region", REGIONS);
  const concerns = many("concerns", CONCERNS);
  const criteria = many("criteria", CRITERIA_KEYS);
  if (!site || !stage || !region || concerns.length < 1 || criteria.length !== 2) {
    redirect("/situation?error=1");
  }

  await run(
    `INSERT INTO profiles (user_id, site, stage, concerns, region, criteria, updated_at)
     VALUES ($1, $2, $3, $4::text[], $5, $6::text[], now())
     ON CONFLICT (user_id) DO UPDATE
       SET site = EXCLUDED.site, stage = EXCLUDED.stage, concerns = EXCLUDED.concerns,
           region = EXCLUDED.region, criteria = EXCLUDED.criteria, updated_at = now()`,
    [user.id, site, stage, concerns, region, criteria],
  );
  await logEvent(user.id, "situation");
  redirect("/results");
}

/* ------------------------------------------------------------------ */
/* STEP 04·07·09 · 열람권 사용                                          */
/* ------------------------------------------------------------------ */

/** 열람권 1회를 써서 의료진 리포트를 엽니다. 이미 연 의료진은 차감하지 않습니다. */
export async function unlockDoctor(formData: FormData) {
  const user = await requireUser();
  const doctorId = Number(formData.get("doctorId"));
  if (!Number.isInteger(doctorId)) redirect("/results");

  // 동시에 두 번 눌러도 한 번만 차감되도록: 사용자 행을 잠그고(FOR UPDATE) 조건부로 차감합니다.
  const result = await tx(async (q) => {
    const exists = await q.query("SELECT 1 FROM doctors WHERE id = $1", [doctorId]);
    if (!exists.length) return "missing" as const;
    const [u] = await q.query<{ view_credits: number }>(
      "SELECT view_credits FROM users WHERE id = $1 FOR UPDATE",
      [user.id],
    );
    const seen = await q.query("SELECT 1 FROM views WHERE user_id = $1 AND doctor_id = $2", [user.id, doctorId]);
    if (seen.length) return "already" as const;
    if (!u || u.view_credits < 1) return "no_credit" as const;
    await q.query("UPDATE users SET view_credits = view_credits - 1 WHERE id = $1", [user.id]);
    await q.query("INSERT INTO views (user_id, doctor_id) VALUES ($1, $2)", [user.id, doctorId]);
    return "unlocked" as const;
  });

  if (result === "missing") redirect("/results");
  if (result === "no_credit") redirect(`/purchase?doctor=${doctorId}`);
  if (result === "unlocked") await logEvent(user.id, "unlock", doctorId);
  redirect(`/doctors/${doctorId}`);
}

/* ------------------------------------------------------------------ */
/* 열람권 구매 (데모 결제)                                               */
/* ------------------------------------------------------------------ */

export async function purchase(formData: FormData) {
  const user = await requireUser();
  const key = String(formData.get("package")) as keyof typeof PACKAGES;
  const pkg = PACKAGES[key];
  if (!pkg) redirect("/purchase");
  const doctorId = Number(formData.get("doctorId"));

  await tx(async (q) => {
    await q.query("UPDATE users SET view_credits = view_credits + $2 WHERE id = $1", [user.id, pkg.credits]);
    await q.query("INSERT INTO purchases (user_id, package, credits, amount) VALUES ($1, $2, $3, $4)", [
      user.id, key, pkg.credits, pkg.amount,
    ]);
  });
  await logEvent(user.id, "purchase");

  if (Number.isInteger(doctorId) && doctorId > 0) {
    const fd = new FormData();
    fd.set("doctorId", String(doctorId));
    await unlockDoctor(fd); // 구매 직전에 열려던 의료진을 바로 엽니다.
  }
  redirect("/results");
}

/* ------------------------------------------------------------------ */
/* 설정 · 동의 철회 · 피드백                                             */
/* ------------------------------------------------------------------ */

export async function agreeHealth() {
  const user = await requireUser();
  await run("UPDATE users SET agree_health = true WHERE id = $1", [user.id]);
  redirect("/situation");
}

export async function withdrawHealth() {
  const user = await requireUser();
  // 민감정보(건강 상태) 동의를 철회하면 저장된 상황 정보를 함께 삭제합니다.
  await tx(async (q) => {
    await q.query("UPDATE users SET agree_health = false WHERE id = $1", [user.id]);
    await q.query("DELETE FROM profiles WHERE user_id = $1", [user.id]);
  });
  redirect("/settings?done=health");
}

export async function toggleMarketing() {
  const user = await requireUser();
  await run("UPDATE users SET agree_marketing = NOT agree_marketing WHERE id = $1", [user.id]);
  redirect("/settings");
}

export async function logout() {
  await clearSession();
  redirect("/");
}

export async function deleteAccount() {
  const user = await requireUser();
  // 상황·열람·구매·피드백은 FK ON DELETE CASCADE로 함께 지워지고, 이벤트 로그는 익명화(SET NULL)됩니다.
  await run("DELETE FROM users WHERE id = $1", [user.id]);
  await clearSession();
  redirect("/");
}

export async function sendFeedback(formData: FormData) {
  const user = await getCurrentUser();
  const body = String(formData.get("body") ?? "").trim().slice(0, 2000);
  if (body) await run("INSERT INTO feedback (user_id, body) VALUES ($1, $2)", [user?.id ?? null, body]);
  redirect("/compare?thanks=1");
}
