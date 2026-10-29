import { notFound } from "next/navigation";
import { all } from "@/lib/db";
import { Header } from "@/components/ui";

type Funnel = { step: number; label: string; users: number };

/**
 * 프로토타입 퍼널·선호 분석 (Postgres 집계 쿼리).
 * 개발 모드에서는 바로 열리고, 운영 모드에서는 ?token=ADMIN_TOKEN 이 필요합니다.
 */
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const expected = process.env.ADMIN_TOKEN;
  if (process.env.NODE_ENV === "production" ? !expected || token !== expected : expected && token !== expected) {
    notFound();
  }

  const [funnel, criteria, pairs, regions, feedback] = await Promise.all([
    all<Funnel>(`
      WITH per_user AS (
        SELECT user_id,
               bool_or(name = 'signup')    AS signup,
               bool_or(name = 'situation') AS situation,
               bool_or(name = 'results')   AS results,
               count(*) FILTER (WHERE name = 'unlock') AS unlocks,
               bool_or(name = 'research')  AS research,
               bool_or(name = 'compare')   AS compare,
               bool_or(name = 'paywall')   AS paywall,
               bool_or(name = 'purchase')  AS purchase
          FROM events WHERE user_id IS NOT NULL GROUP BY user_id
      )
      SELECT step, label, users::int FROM (VALUES
        (1, '가입과 본인인증',  (SELECT count(*) FILTER (WHERE signup)       FROM per_user)),
        (3, '상황 입력',        (SELECT count(*) FILTER (WHERE situation)    FROM per_user)),
        (4, '기준 정렬 목록',   (SELECT count(*) FILTER (WHERE results)      FROM per_user)),
        (5, '첫 번째 열람',     (SELECT count(*) FILTER (WHERE unlocks >= 1) FROM per_user)),
        (6, '연구 공개 기록',   (SELECT count(*) FILTER (WHERE research)     FROM per_user)),
        (7, '두 번째 열람',     (SELECT count(*) FILTER (WHERE unlocks >= 2) FROM per_user)),
        (8, '비교와 진료 준비', (SELECT count(*) FILTER (WHERE compare)      FROM per_user)),
        (9, '열람권 소진 · 구매 안내', (SELECT count(*) FILTER (WHERE paywall) FROM per_user)),
        (10, '구매(데모)',      (SELECT count(*) FILTER (WHERE purchase)     FROM per_user))
      ) AS t(step, label, users)
      ORDER BY step`),
    all<{ criterion: string; n: number; first: number }>(`
      SELECT c AS criterion, count(*)::int AS n, (count(*) FILTER (WHERE pos = 1))::int AS first
        FROM profiles, unnest(criteria) WITH ORDINALITY AS u(c, pos)
       GROUP BY c ORDER BY n DESC, c`),
    all<{ pair: string; n: number }>(`
      SELECT array_to_string(ARRAY(SELECT x FROM unnest(criteria) AS x ORDER BY x), ' + ') AS pair,
             count(*)::int AS n
        FROM profiles GROUP BY 1 ORDER BY n DESC LIMIT 5`),
    all<{ region: string; site: string; n: number }>(`
      SELECT region, site, count(*)::int AS n FROM profiles GROUP BY region, site ORDER BY n DESC`),
    all<{ body: string; at: string }>(`
      SELECT body, to_char(created_at AT TIME ZONE 'Asia/Seoul', 'MM-DD HH24:MI') AS at
        FROM feedback ORDER BY created_at DESC LIMIT 20`),
  ]);

  const top = Math.max(1, ...funnel.map((f) => Number(f.users)));

  return (
    <>
      <Header back="/" eyebrow="Postgres 집계" title="프로토타입 지표" />
      <main className="content">
        <div className="section-title" style={{ marginTop: 0 }}>
          9단계 퍼널 (사용자 수)
        </div>
        <table className="stat-table">
          <tbody>
            {funnel.map((f) => (
              <tr key={f.step}>
                <td style={{ width: "46%" }}>{f.label}</td>
                <td>
                  <div className="bar" style={{ width: `${(Number(f.users) / top) * 100}%` }} />
                </td>
                <td className="num" style={{ width: 40 }}>
                  {String(f.users)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="section-title">가장 많이 고른 기준</div>
        <table className="stat-table">
          <thead>
            <tr>
              <th>기준</th>
              <th style={{ textAlign: "right" }}>선택</th>
              <th style={{ textAlign: "right" }}>1순위</th>
            </tr>
          </thead>
          <tbody>
            {criteria.map((c) => (
              <tr key={c.criterion}>
                <td>{c.criterion}</td>
                <td className="num">{c.n}</td>
                <td className="num">{c.first}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="section-title">기준 조합</div>
        <table className="stat-table">
          <tbody>
            {pairs.map((p) => (
              <tr key={p.pair}>
                <td>{p.pair}</td>
                <td className="num">{p.n}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="section-title">지역 × 부위</div>
        <table className="stat-table">
          <tbody>
            {regions.map((r) => (
              <tr key={r.region + r.site}>
                <td>
                  {r.region} · {r.site}
                </td>
                <td className="num">{r.n}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="section-title">피드백</div>
        {feedback.length === 0 && <p className="fine" style={{ textAlign: "left" }}>아직 없어요.</p>}
        {feedback.map((f, i) => (
          <div key={i} className="setting" style={{ display: "block" }}>
            {f.body}
            <small>{f.at}</small>
          </div>
        ))}
      </main>
    </>
  );
}
