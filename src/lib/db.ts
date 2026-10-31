import "server-only";
import path from "node:path";
import fs from "node:fs";
import type { Sql, TransactionSql } from "postgres";
import { SCHEMA_SQL, SEED_VERSION, seed } from "./seed";

/**
 * Postgres 접근 계층.
 *
 * - DATABASE_URL(또는 Vercel·Neon 연동이 넣어 주는 POSTGRES_URL)이 있으면 postgres.js로 접속합니다.
 *   → Vercel 배포 / 로컬에서 실제 Postgres를 쓸 때
 * - 없으면 PGlite(WASM으로 돌아가는 임베디드 Postgres)를 ./data/pglite 에 띄웁니다.
 *   → 설치 없이 `npm run dev` 만으로 로컬 개발
 */

export type Q = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  exec(text: string): Promise<void>;
};
type Driver = Q & { tx<T>(fn: (q: Q) => Promise<T>): Promise<T> };

const DATABASE_URL = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

async function postgresDriver(url: string): Promise<Driver> {
  const { default: postgres } = await import("postgres");
  // prepare:false — Neon/Supabase 등의 커넥션 풀러(PgBouncer, transaction 모드)와 호환
  const sql = postgres(url, { max: 5, prepare: false, idle_timeout: 20, connect_timeout: 10, onnotice: () => {} });
  const wrap = (s: Sql | TransactionSql): Q => ({
    query: async <T,>(text: string, params: unknown[] = []) =>
      (await (s as Sql).unsafe(text, params as never[])) as unknown as T[],
    exec: async (text: string) => {
      await (s as Sql).unsafe(text);
    },
  });
  return {
    ...wrap(sql),
    tx: <T,>(fn: (q: Q) => Promise<T>) => sql.begin((t) => fn(wrap(t))) as Promise<T>,
  };
}

async function pgliteDriver(): Promise<Driver> {
  if (process.env.VERCEL) {
    throw new Error(
      "DATABASE_URL이 없습니다. Vercel 프로젝트의 Storage 탭에서 Neon(Postgres)을 연결한 뒤 다시 배포하세요.",
    );
  }
  // 번들에 넣지 않고 런타임에만 불러옵니다 → Vercel 함수에는 PGlite(약 27MB)가 포함되지 않습니다.
  const { PGlite } = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ "@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), "data", "pglite");
  fs.mkdirSync(dir, { recursive: true });
  const db = await PGlite.create(dir);
  type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
  const wrap = (s: typeof db | Tx): Q => ({
    query: async <T,>(text: string, params: unknown[] = []) => (await s.query<T>(text, params)).rows,
    exec: async (text: string) => {
      await s.exec(text);
    },
  });
  return { ...wrap(db), tx: <T,>(fn: (q: Q) => Promise<T>) => db.transaction((t) => fn(wrap(t))) };
}

async function init(): Promise<Driver> {
  const d = DATABASE_URL ? await postgresDriver(DATABASE_URL) : await pgliteDriver();
  // 서버리스 콜드 스타트가 동시에 일어나도 스키마 생성·시드가 한 번만 되도록 advisory lock
  await d.tx(async (q) => {
    await q.query("SELECT pg_advisory_xact_lock(724001)");
    await q.exec(SCHEMA_SQL);
    // 예시 데이터 버전이 올라가면 새 행만 추가합니다. 기존 행·사용자 데이터는 건드리지 않습니다.
    const [meta] = await q.query<{ value: string }>("SELECT value FROM app_meta WHERE key = 'seed_version'");
    if (Number(meta?.value ?? 0) < SEED_VERSION) {
      await seed(q);
      await q.query(
        `INSERT INTO app_meta (key, value) VALUES ('seed_version', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [String(SEED_VERSION)],
      );
    }
  });
  return d;
}

const g = globalThis as unknown as { __prizmoDb?: Promise<Driver> };

function db(): Promise<Driver> {
  if (!g.__prizmoDb) {
    g.__prizmoDb = init().catch((e) => {
      g.__prizmoDb = undefined;
      throw e;
    });
  }
  return g.__prizmoDb;
}

export async function all<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> {
  return (await db()).query<T>(text, params);
}

export async function one<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T | null> {
  return (await all<T>(text, params))[0] ?? null;
}

export async function run(text: string, params?: unknown[]): Promise<void> {
  await all(text, params);
}

/** 트랜잭션. 콜백에서 예외가 나면 롤백됩니다. */
export async function tx<T>(fn: (q: Q) => Promise<T>): Promise<T> {
  return (await db()).tx(fn);
}
