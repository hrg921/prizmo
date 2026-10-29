import Link from "next/link";
import { requireUser } from "@/lib/session";
import { listDoctors, logEvent, requireProfile } from "@/lib/queries";
import { unlockDoctor } from "../actions";
import { Header, TicketIcon } from "@/components/ui";

export default async function ResultsPage() {
  const user = await requireUser();
  const profile = await requireProfile(user);
  const doctors = await listDoctors(user.id, profile);
  await logEvent(user.id, "results");

  return (
    <>
      <Header
        back="/situation"
        title="내 기준 정렬 결과"
        right={
          <Link href="/settings" aria-label="설정">
            설정
          </Link>
        }
      />
      <main className="content">
        <div className="criteria-line">
          <span>내가 고른 기준</span>
          <b>{profile.criteria.join(" · ")}</b>
        </div>

        <div className={`ticket${user.view_credits === 0 ? " empty" : ""}`}>
          <TicketIcon />
          <div>
            <div className="k">{user.purchased ? "열람권" : "무료 열람권"}</div>
            <div className="v">{user.view_credits}회 남았어요</div>
          </div>
        </div>

        <div className="list-head">
          <h2>의료진 {doctors.length}명</h2>
          <span>선택한 기준 순서로 정리했어요</span>
        </div>

        {doctors.length === 0 && (
          <p className="fine" style={{ textAlign: "left" }}>
            선택한 지역에 공개 기록이 정리된 의료진이 아직 없어요. 지역을 바꿔 보세요.
          </p>
        )}

        {doctors.map((d) => (
          <div className="doc-row" key={d.id}>
            <div className="avatar">{d.initial}</div>
            <div className="who">
              <div className="name">{d.name} 교수</div>
              <div className="meta">
                {d.hospital}
                <br />
                {d.department}
              </div>
            </div>
            {d.viewed ? (
              <Link href={`/doctors/${d.id}`} className="btn-sm btn-ghost">
                열람함
              </Link>
            ) : user.view_credits > 0 ? (
              <form action={unlockDoctor}>
                <input type="hidden" name="doctorId" value={d.id} />
                <button className="btn-sm btn-navy" type="submit">
                  열람
                </button>
              </form>
            ) : (
              <Link href={`/purchase?doctor=${d.id}`} className="btn-sm btn-blue">
                열람권 구매
              </Link>
            )}
          </div>
        ))}

        <div className="sponsor" role="complementary" aria-label="광고">
          <b>[스폰서]</b> 광고 영역 · 정렬과 무관
        </div>
        <p className="fine">의료진의 공개 기록을 정리한 결과이며, 추천이나 순위가 아닙니다.</p>
      </main>
    </>
  );
}
