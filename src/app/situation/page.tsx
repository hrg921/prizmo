import { requireUser } from "@/lib/session";
import { getProfile } from "@/lib/queries";
import { agreeHealth } from "../actions";
import { Header, Logo } from "@/components/ui";
import SituationForm from "./SituationForm";

export default async function SituationPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  const { error } = await searchParams;

  return (
    <>
      <Header
        title="내 상황 알려주기"
        back={profile ? "/results" : undefined}
        icon={profile ? undefined : <Logo />}
      />
      {user.agree_health ? (
        <SituationForm initial={profile} error={!!error} />
      ) : (
        <main className="content">
          <div className="hero-card">
            <div className="kicker">민감정보 동의가 필요해요</div>
            <h2>건강 상태를 저장하려면 동의가 필요해요</h2>
            <p>암 부위·병기·치료 고민은 내 기준에 맞춘 정리에만 쓰이고, 동의를 철회하면 즉시 삭제됩니다.</p>
          </div>
          <form action={agreeHealth} style={{ marginTop: 16 }}>
            <button className="btn" type="submit">
              민감정보 처리에 동의하기
            </button>
          </form>
        </main>
      )}
    </>
  );
}
