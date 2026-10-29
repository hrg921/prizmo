import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { one } from "./db";

const COOKIE = "pz_session";
function secret() {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.VERCEL) {
    throw new Error("SESSION_SECRET 환경변수가 없습니다. Vercel 프로젝트 설정에서 추가한 뒤 다시 배포하세요.");
  }
  return "prizmo-local-dev-secret"; // 로컬 개발 전용
}

function sign(v: string) {
  return crypto.createHmac("sha256", secret()).update(v).digest("base64url");
}

export async function setSession(userId: number) {
  const v = String(userId);
  (await cookies()).set(COOKIE, `${v}.${sign(v)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

async function sessionUserId(): Promise<number | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [v, sig] = raw.split(".");
  if (!v || !sig) return null;
  const expected = sign(v);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  const id = Number(v);
  return Number.isInteger(id) ? id : null;
}

export type User = {
  id: number;
  name: string;
  phone: string;
  agree_health: boolean;
  agree_marketing: boolean;
  view_credits: number;
  purchased: boolean;
};

export async function getCurrentUser(): Promise<User | null> {
  const id = await sessionUserId();
  if (id == null) return null;
  return one<User>(
    `SELECT id, name, phone, agree_health, agree_marketing, view_credits,
            EXISTS (SELECT 1 FROM purchases p WHERE p.user_id = u.id) AS purchased
       FROM users u WHERE id = $1`,
    [id],
  );
}

export async function requireUser(): Promise<User> {
  const u = await getCurrentUser();
  if (!u) redirect("/signup");
  return u;
}
