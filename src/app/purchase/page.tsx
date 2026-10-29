import { requireUser } from "@/lib/session";
import { PACKAGES, getDoctor, logEvent, requireProfile } from "@/lib/queries";
import { purchase } from "../actions";
import { Header, TicketIcon } from "@/components/ui";

export default async function PurchasePage({ searchParams }: { searchParams: Promise<{ doctor?: string }> }) {
  const user = await requireUser();
  const profile = await requireProfile(user);
  const { doctor } = await searchParams;
  const target = doctor ? await getDoctor(user.id, Number(doctor), profile) : null;
  await logEvent(user.id, "paywall", target?.id ?? null);

  return (
    <form action={purchase} style={{ display: "contents" }}>
      <Header back="/results" title="열람권 구매" />
      <main className="content">
        <div className="ticket empty">
          <TicketIcon />
          <div>
            <div className="k">{user.purchased ? "열람권" : "무료 열람권"}</div>
            <div className="v">{user.view_credits}회 남았어요</div>
          </div>
        </div>

        <div className="hero-card" style={{ marginTop: 16 }}>
          <div className="kicker">열람권을 모두 사용했어요</div>
          <h2>{target ? `${target.name} 교수의 리포트를 열려면` : "더 많은 의료진을 보려면"}</h2>
          <p>열람권 1회로 의료진 1명의 다섯 축 공개 기록을 볼 수 있어요. 한 번 연 리포트는 계속 볼 수 있어요.</p>
        </div>

        <fieldset style={{ border: 0, padding: 0, margin: "8px 0 0" }}>
          <legend className="section-title">열람권 선택</legend>
          {Object.entries(PACKAGES).map(([key, p], i) => (
            <label className="pkg" key={key}>
              <input type="radio" name="package" value={key} defaultChecked={i === 0} />
              <span className="n">
                {p.label}
                <small>의료진 {p.credits}명 열람</small>
              </span>
              <span className="price">₩{p.amount.toLocaleString("ko-KR")}</span>
            </label>
          ))}
        </fieldset>
        <input type="hidden" name="doctorId" value={target?.id ?? ""} />

        <p className="fine">
          프로토타입 데모 결제입니다. 실제 결제는 이뤄지지 않으며 가격은 예시입니다.
          <br />
          구매는 정렬 결과에 영향을 주지 않습니다.
        </p>
      </main>
      <div className="cta-bar">
        <button className="btn" type="submit">
          {target ? "구매하고 바로 열람하기" : "구매하기"} (데모)
        </button>
      </div>
    </form>
  );
}
