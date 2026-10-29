import { requireUser } from "@/lib/session";
import { formatPhone, maskName } from "@/lib/queries";
import { deleteAccount, logout, toggleMarketing, withdrawHealth } from "../actions";
import { Header } from "@/components/ui";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const user = await requireUser();
  const { done } = await searchParams;

  return (
    <>
      <Header back="/results" title="설정" />
      <main className="content">
        <div className="verified" style={{ marginBottom: 8 }}>
          ✓ {maskName(user.name)} · {formatPhone(user.phone)} 인증 완료
        </div>
        {done === "health" && <p className="fine">민감정보 동의를 철회하고 저장된 상황 정보를 삭제했어요.</p>}

        <div className="setting">
          <span>
            민감정보(건강 상태) 처리 동의
            <small>{user.agree_health ? "동의함 · 철회하면 내 상황 정보가 즉시 삭제돼요" : "철회함"}</small>
          </span>
          {user.agree_health && (
            <form action={withdrawHealth}>
              <button className="btn-sm btn-ghost" type="submit">
                철회
              </button>
            </form>
          )}
        </div>
        <div className="setting">
          <span>
            마케팅 정보 수신
            <small>{user.agree_marketing ? "동의함" : "동의 안 함"}</small>
          </span>
          <form action={toggleMarketing}>
            <button className="btn-sm btn-ghost" type="submit">
              {user.agree_marketing ? "끄기" : "켜기"}
            </button>
          </form>
        </div>
        <div className="setting">
          <span>
            열람권
            <small>{user.view_credits}회 남음</small>
          </span>
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 24 }}>
          <form action={logout}>
            <button className="link-btn" type="submit">
              로그아웃
            </button>
          </form>
          <form action={deleteAccount}>
            <button className="link-btn" type="submit">
              탈퇴하고 내 데이터 삭제
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
