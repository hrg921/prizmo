import { Header } from "@/components/ui";
import SignupForm from "./SignupForm";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <>
      <Header back="/" eyebrow="휴대폰 본인인증" title="회원가입" />
      <SignupForm
        serverError={
          error === "consent" ? "필수 항목에 동의해 주세요." : error === "verify" ? "본인인증을 먼저 완료해 주세요." : undefined
        }
      />
    </>
  );
}
