import Link from "next/link";
import { requireUser } from "@/lib/session";
import { logEvent, publications, requireProfile, requireViewed, siteLabel } from "@/lib/queries";
import { Header } from "@/components/ui";

export default async function ResearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tag?: string }>;
}) {
  const { id } = await params;
  const { tag: rawTag } = await searchParams;
  const user = await requireUser();
  const profile = await requireProfile(user);
  const d = await requireViewed(user, Number(id), profile);

  // 탭 = 전체 + 내가 고른 고민
  const tag = rawTag && profile.concerns.includes(rawTag) ? rawTag : null;
  const items = await publications(d.id, profile.site, tag);
  await logEvent(user.id, "research", d.id);

  const tabs = [null, ...profile.concerns];
  return (
    <>
      <Header back={`/doctors/${d.id}`} eyebrow={`${d.name} 교수 · 연구 공개 기록`} title={`${siteLabel(profile.site)} 관련 ${d.research_n}건`} />
      <main className="content records-bg">
        <nav className="tabs chips" aria-label="고민별 보기">
          {tabs.map((t) => (
            <Link
              key={t ?? "all"}
              href={t ? `/doctors/${d.id}/research?tag=${encodeURIComponent(t)}` : `/doctors/${d.id}/research`}
              className="chip"
              aria-pressed={t === tag}
              scroll={false}
            >
              {t ?? "전체"}
            </Link>
          ))}
        </nav>
        <div className="filter-caption">
          {tag ? (
            <>
              <b>{tag}</b> 관련 공개 자료 {items.length}건
            </>
          ) : (
            <>최근 5년 공개 자료 {items.length}건</>
          )}
        </div>

        {items.map((p) => (
          <article className="record" key={p.id}>
            <div className="tags">
              <span className="tag">{p.year}</span>
              <span className="tag gray">{p.venue}</span>
            </div>
            <h3>{p.title_ko}</h3>
            <p>{p.summary_ko}</p>
            <a className="src" href={p.url} target="_blank" rel="noopener noreferrer" title={p.title_en}>
              원문 보기 ↗
            </a>
          </article>
        ))}
        {items.length === 0 && <p className="fine">이 고민과 관련된 공개 자료가 아직 없어요.</p>}

        <p className="fine">※ 예시 데이터이며, 실제 서비스는 공개된 학술 기록을 바탕으로 정리합니다. 원문 보기는 PubMed 검색으로 연결됩니다.</p>
      </main>
    </>
  );
}
