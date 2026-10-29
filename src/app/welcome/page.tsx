import Link from "next/link";
import { requireUser } from "@/lib/session";
import { Chevron } from "@/components/ui";

export default async function WelcomePage() {
  const user = await requireUser();
  return (
    <>
      <main className="center-stack">
        <div className="check-badge">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1>가입이 끝났어요</h1>
        <p>
          무료 열람권 <span className="accent">{user.view_credits}회</span>를 드렸어요.
          <br />내 상황을 알려 주시면 기준에 맞춰 정리해 드릴게요.
        </p>
      </main>
      <div className="cta-bar">
        <Link href="/situation" className="btn">
          내 상황 알려주기 <Chevron />
        </Link>
      </div>
    </>
  );
}
