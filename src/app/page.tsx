import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getProfile } from "@/lib/queries";
import { Brand, Chevron } from "@/components/ui";

const PRINCIPLES = [
  ["연구", "PubMed · 학회지", "관련 논문·발표"],
  ["자격", "대한대장항문학회", "세부전문의 명단"],
  ["신치료", "ClinicalTrials.gov · CRIS", "임상시험 책임연구"],
  ["병원", "건강보험심사평가원", "대장암 적정성 평가"],
  ["진료 조건", "병원 홈페이지", "외래 진료 시간표"],
];

export default async function Home() {
  const user = await getCurrentUser();
  if (user) {
    const profile = await getProfile(user.id);
    redirect(profile ? "/results" : "/situation");
  }

  return (
    <>
      <main className="content landing" style={{ paddingTop: 36 }}>
        <Brand />
        <h1>
          대장암 진단 직후,
          <br />
          공개 기록으로
          <br />
          집도의를 비교합니다.
        </h1>
        <p className="lead">
          평가하지 않습니다. 공개 기록만 보여 줍니다.
          <br />
          점수와 순위 없이, 내가 고른 기준대로 정리해요.
        </p>
        <div className="principles">
          {PRINCIPLES.map(([ax, src, rec]) => (
            <div key={ax}>
              <span className="ax">{ax}</span>
              <span>
                <div className="src">{src}</div>
                <div className="rec">{rec}</div>
              </span>
            </div>
          ))}
        </div>
        <p className="fine">광고는 정렬에 반영하지 않습니다.</p>
      </main>
      <div className="cta-bar">
        <Link href="/signup" className="btn">
          무료로 시작하기 <Chevron />
        </Link>
      </div>
    </>
  );
}
