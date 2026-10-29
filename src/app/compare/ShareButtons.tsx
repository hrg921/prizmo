"use client";

import { useState } from "react";

export default function ShareButtons({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "프리즈모 비교 & 진료 준비", text });
        return;
      }
    } catch {
      return; // 사용자가 공유 시트를 닫은 경우
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 클립보드 권한이 없는 환경 */
    }
  };

  return (
    <div className="share-row no-print">
      <button type="button" className="btn-outline" onClick={share}>
        {copied ? "복사했어요 ✓" : "가족에게 공유"}
        <span className="badge-paid">유료</span>
      </button>
      <button type="button" className="btn-outline" onClick={() => window.print()}>
        PDF 저장
        <span className="badge-paid">유료</span>
      </button>
    </div>
  );
}
