"use client";

import { useState, useTransition } from "react";
import { requestCode, signup, verifyCode } from "../actions";
import { Chevron } from "@/components/ui";

const TERMS = [
  {
    key: "terms",
    required: true,
    label: "서비스 이용약관",
    body: "프리즈모는 의료진의 공개 기록을 정리해 보여 주는 정보 서비스이며, 진료·진단·추천을 제공하지 않습니다.",
  },
  {
    key: "privacy",
    required: true,
    label: "개인정보 수집 및 이용 동의",
    body: "수집 항목: 이름, 휴대폰 번호 · 목적: 본인 확인, 열람권 관리 · 보관: 탈퇴 시까지",
  },
  {
    key: "health",
    required: true,
    label: "민감정보(건강 상태) 처리 동의",
    body: "수집 항목: 암 부위, 병기, 치료 고민 · 목적: 내 기준에 맞춘 공개 기록 정리 · 동의를 철회하면 즉시 삭제됩니다.",
  },
  {
    key: "marketing",
    required: false,
    label: "마케팅 정보 수신 동의",
    body: "새 기능, 이벤트 소식을 문자로 받아요. 동의하지 않아도 서비스를 이용할 수 있어요.",
  },
] as const;

const fmtPhone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}`;
};
const mask = (n: string) => (n.length <= 1 ? n : n[0] + "○".repeat(Math.max(2, n.length - 1)));

export default function SignupForm({ serverError }: { serverError?: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | undefined>(serverError);
  const [agree, setAgree] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const allChecked = TERMS.every((t) => agree[t.key]);
  const requiredOk = TERMS.filter((t) => t.required).every((t) => agree[t.key]);

  const send = () =>
    start(async () => {
      setError(undefined);
      const r = await requestCode(name, phone);
      if (!r.ok) return setError(r.error);
      setDemoCode(r.demoCode);
      setCode("");
    });

  const verify = () =>
    start(async () => {
      setError(undefined);
      const r = await verifyCode(phone, code);
      if (!r.ok) return setError(r.error);
      setVerified(true);
    });

  return (
    <form action={signup} style={{ display: "contents" }}>
      <main className="content">
        <div className="field" style={{ marginTop: 4 }}>
          <div className="label">본인인증</div>
          {verified ? (
            <div className="verified">
              ✓ {mask(name.trim())} · {fmtPhone(phone)} 인증 완료
              <input type="hidden" name="phone" value={phone} />
            </div>
          ) : (
            <>
              <div className="input-row">
                <input
                  className="input"
                  placeholder="이름"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-label="이름"
                />
              </div>
              <div className="input-row">
                <input
                  className="input"
                  placeholder="휴대폰 번호"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={fmtPhone(phone)}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  aria-label="휴대폰 번호"
                />
                <button type="button" className="btn-sm btn-navy" onClick={send} disabled={pending}>
                  {demoCode ? "재전송" : "인증번호 받기"}
                </button>
              </div>
              {demoCode && (
                <>
                  <div className="input-row">
                    <input
                      className="input"
                      placeholder="인증번호 6자리"
                      inputMode="numeric"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      aria-label="인증번호"
                    />
                    <button type="button" className="btn-sm btn-navy" onClick={verify} disabled={pending || code.length !== 6}>
                      확인
                    </button>
                  </div>
                  <div className="demo-code">
                    데모 환경이라 문자 대신 여기에 보여 드려요 · 인증번호 <b>{demoCode}</b> (3분 유효)
                  </div>
                </>
              )}
            </>
          )}
          {error && <div className="error">{error}</div>}
        </div>

        <div className="consent">
          <div className="row">
            <label>
              <input
                type="checkbox"
                className="check"
                checked={allChecked}
                onChange={(e) => setAgree(Object.fromEntries(TERMS.map((t) => [t.key, e.target.checked])))}
              />
              전체 동의
            </label>
          </div>
          {TERMS.map((t) => (
            <div key={t.key}>
              <div className="row">
                <label>
                  <input
                    type="checkbox"
                    className="check"
                    name={t.key}
                    checked={!!agree[t.key]}
                    onChange={(e) => setAgree((a) => ({ ...a, [t.key]: e.target.checked }))}
                  />
                  <span>
                    <span className={t.required ? "req" : "opt"}>[{t.required ? "필수" : "선택"}]</span> {t.label}
                  </span>
                </label>
                <button
                  type="button"
                  className="more"
                  aria-expanded={open === t.key}
                  aria-label={`${t.label} 내용 보기`}
                  onClick={() => setOpen(open === t.key ? null : t.key)}
                  style={{ transform: open === t.key ? "rotate(90deg)" : undefined }}
                >
                  <Chevron />
                </button>
              </div>
              {open === t.key && <div className="terms">{t.body}</div>}
            </div>
          ))}
        </div>

        <div className="note" style={{ marginTop: 16 }}>
          건강 상태는 민감정보라서 별도로 동의를 받습니다. 동의는 설정에서 언제든 철회할 수 있어요.
        </div>
      </main>

      <div className="cta-bar">
        <button className="btn" type="submit" disabled={!verified || !requiredOk}>
          동의하고 시작하기 <Chevron />
        </button>
      </div>
    </form>
  );
}
