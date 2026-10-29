import Link from "next/link";
import { requireUser } from "@/lib/session";
import { AXES, CRITERIA, axisSummary, logEvent, requireProfile, requireViewed } from "@/lib/queries";
import { Chevron, Header, InfoNote } from "@/components/ui";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const profile = await requireProfile(user);
  const d = await requireViewed(user, Number(id), profile);
  await logEvent(user.id, "report", d.id);

  const summary = axisSummary(d, profile.site);
  const focus = CRITERIA[profile.criteria[0] as keyof typeof CRITERIA]?.axis;

  return (
    <>
      <Header back="/results" title="의료진 리포트" />
      <main className="content">
        <div className="report-head">
          <div>
            <div className="org">
              {d.hospital} · {d.department}
            </div>
            <div className="doc-name">{d.name} 교수</div>
          </div>
          <span className="pill">공개 기록</span>
        </div>

        {AXES.map(({ key, label }) => (
          <Link
            key={key}
            href={key === "research" ? `/doctors/${d.id}/research` : `/doctors/${d.id}/records/${key}`}
            className={`axis-card${key === focus ? " focus" : ""}`}
          >
            <span className="axis">{label}</span>
            <span className="body">
              <div className="t">{summary[key].title}</div>
              <div className="s">{summary[key].sub}</div>
            </span>
            <span className="chev">
              <Chevron />
            </span>
          </Link>
        ))}

        <InfoNote>공개 기록 기준이며 진료 능력을 평가하지 않습니다.</InfoNote>
      </main>
      <div className="cta-bar">
        <Link href="/compare" className="btn">
          비교하기 <Chevron />
        </Link>
      </div>
    </>
  );
}
