import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { AXES, axisSummary, records, requireProfile, requireViewed, trials } from "@/lib/queries";
import { Header, InfoNote } from "@/components/ui";

const VALID = ["credential", "trials", "hospital", "condition"] as const;

export default async function AxisPage({ params }: { params: Promise<{ id: string; axis: string }> }) {
  const { id, axis } = await params;
  if (!(VALID as readonly string[]).includes(axis)) notFound();
  const user = await requireUser();
  const profile = await requireProfile(user);
  const d = await requireViewed(user, Number(id), profile);

  const label = AXES.find((a) => a.key === axis)!.label;
  const summary = axisSummary(d, profile.site)[axis as (typeof VALID)[number]];

  return (
    <>
      <Header back={`/doctors/${d.id}`} eyebrow={`${d.name} 교수 · ${label} 공개 기록`} title={summary.title} />
      <main className="content records-bg">
        {axis === "trials" ? (
          <TrialList doctorId={d.id} />
        ) : (
          (await records(d.id, axis)).map((r) => (
            <article className="record" key={r.id}>
              <div className="tags">
                <span className="tag gray">{r.source}</span>
              </div>
              <h3>{r.title}</h3>
              <p>{r.detail}</p>
            </article>
          ))
        )}
        <div style={{ marginTop: 16 }}>
          <InfoNote>공개 기록 기준이며 진료 능력을 평가하지 않습니다. 예시 데이터입니다.</InfoNote>
        </div>
      </main>
    </>
  );
}

async function TrialList({ doctorId }: { doctorId: number }) {
  const items = await trials(doctorId);
  if (items.length === 0) return <p className="fine">공개된 임상시험 참여 기록이 없어요.</p>;
  return items.map((t) => (
    <article className="record" key={t.id}>
      <div className="tags">
        <span className="tag">{t.phase}</span>
        <span className="tag gray">{t.role}</span>
        <span className="tag gray">{t.status}</span>
      </div>
      <h3>{t.title_ko}</h3>
      <p>
        {t.source} · {t.year}년 등록
      </p>
    </article>
  ));
}
