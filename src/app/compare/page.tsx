import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { logEvent, questionsFor, requireProfile, viewedDoctors } from "@/lib/queries";
import { sendFeedback } from "../actions";
import { Header } from "@/components/ui";
import ShareButtons from "./ShareButtons";

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ thanks?: string }> }) {
  const user = await requireUser();
  const profile = await requireProfile(user);
  const docs = await viewedDoctors(user.id, profile);
  if (docs.length === 0) redirect("/results");
  const questions = await questionsFor(profile);
  const { thanks } = await searchParams;
  await logEvent(user.id, "compare");

  const rows: [string, (d: (typeof docs)[number]) => React.ReactNode][] = [
    ["연구", (d) => `${d.research_n}건`],
    ["자격", (d) => d.cert_short],
    ["임상시험", (d) => `${d.trials_n}건`],
    ["병원", (d) => `${d.hospital_grade}등급`],
    [
      "조건",
      (d) => (
        <>
          {d.clinic_days}
          <br />
          {d.distance_km}km
        </>
      ),
    ],
  ];
  const [top, rest] = [questions.slice(0, 3), questions.slice(3)];

  const shareText = [
    `[프리즈모] ${profile.site}암 ${profile.stage} · 의료진 공개 기록 비교`,
    ...docs.map(
      (d) =>
        `- ${d.name} 교수(${d.hospital}): 연구 ${d.research_n}건 · ${d.cert_short} · 임상시험 ${d.trials_n}건 · 병원 ${d.hospital_grade}등급 · ${d.clinic_days} · ${d.distance_km}km`,
    ),
    "",
    "첫 진료 때 물어볼 질문",
    ...questions.map((q) => `· ${q}`),
  ].join("\n");

  return (
    <>
      <Header back="/results" title="비교 & 진료 준비" />
      <main className="content">
        <table className="cmp">
          <thead>
            <tr>
              <th aria-label="항목" />
              {docs.map((d) => (
                <th key={d.id}>
                  <Link href={`/doctors/${d.id}`}>{d.name}</Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, fn]) => (
              <tr key={label}>
                <td>{label}</td>
                {docs.map((d) => (
                  <td key={d.id}>{fn(d)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {docs.length === 1 && (
          <p className="fine no-print">
            한 명을 더 열람하면 나란히 비교할 수 있어요.{" "}
            <Link href="/results" style={{ color: "var(--blue)", fontWeight: 700 }}>
              목록으로
            </Link>
          </p>
        )}

        <section className="questions" aria-labelledby="q-title">
          <div className="qh">
            <span className="q">?</span>
            <b id="q-title">첫 진료 때 물어볼 질문</b>
            <span className="badge-paid">유료</span>
          </div>
          <ul>
            {top.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
          {rest.length > 0 && (
            <details>
              <summary>질문 {rest.length}개 더 보기</summary>
              <ul>
                {rest.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </details>
          )}
        </section>

        <p className="fine" style={{ marginTop: 16 }}>
          가족과 함께 보거나 진료실에 가져가세요.
        </p>
        <ShareButtons text={shareText} />

        <form action={sendFeedback} className="no-print" style={{ marginTop: 32 }}>
          <div className="section-title" style={{ marginTop: 0 }}>
            써 보신 뒤 느낀 점을 알려 주세요
          </div>
          {thanks ? (
            <p className="fine" style={{ textAlign: "left" }}>
              소중한 의견 고마워요. 더 나은 서비스로 보답할게요.
            </p>
          ) : (
            <>
              <textarea className="input" name="body" placeholder="불편했던 점, 더 보고 싶은 기록 등" style={{ width: "100%", marginTop: 8 }} required />
              <button className="btn-sm btn-navy" style={{ marginTop: 8 }} type="submit">
                보내기
              </button>
            </>
          )}
        </form>
      </main>
    </>
  );
}
