import Link from "next/link";
import type { ReactNode } from "react";

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="pz-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5fb8ff" />
          <stop offset="1" stopColor="#1f6ff2" />
        </linearGradient>
        <linearGradient id="pz-b" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1f6ff2" />
          <stop offset="1" stopColor="#1cc6c0" />
        </linearGradient>
      </defs>
      <circle cx="4" cy="12" r="1.4" fill="#7fb6ff" />
      <circle cx="7" cy="16" r="1.8" fill="#1cc6c0" />
      <circle cx="4.5" cy="19" r="1.2" fill="#a59cf5" />
      <path d="M11 4h9.5a8 8 0 0 1 0 16H17v7a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" fill="url(#pz-a)" />
      <path d="M11 4l17 8-17 8z" fill="url(#pz-b)" opacity=".85" />
    </svg>
  );
}

export function Brand() {
  return (
    <span className="brand">
      <Logo size={24} />
      PRIZMO
    </span>
  );
}

export function Chevron({ dir = "right" }: { dir?: "left" | "right" }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ transform: dir === "left" ? "rotate(180deg)" : undefined }}>
      <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Header({
  title,
  eyebrow,
  back,
  right,
  icon,
}: {
  title: string;
  eyebrow?: string;
  back?: string;
  right?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <header className="header">
      {back && (
        <Link href={back} className="back" aria-label="뒤로">
          <Chevron dir="left" />
        </Link>
      )}
      {icon}
      <div className="titles">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
      </div>
      {right && <div className="right">{right}</div>}
    </header>
  );
}

export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <div className="note">
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style={{ flex: "none", marginTop: 1 }}>
        <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 11v6M12 7.5v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span>{children}</span>
    </div>
  );
}

/** 공개 기록 기준일 — 리포트·비교표 상단에 크게 표시 */
export function RecordsAsOf({ date }: { date: string }) {
  return (
    <div className="asof" role="note" aria-label={`기록 기준일 ${date}`}>
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" style={{ flex: "none", color: "var(--navy)" }}>
        <rect x="3.5" y="5" width="17" height="15" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <div>
        <div className="k">기록 기준일</div>
        <div className="v">{date}</div>
      </div>
      <span className="s">이 날짜까지 공개된 기록을 정리했어요</span>
    </div>
  );
}

export function TicketIcon() {
  return (
    <span className="icon" aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 24 24">
        <rect x="5" y="5" width="14" height="14" rx="2.5" fill="none" stroke="#fff" strokeWidth="2.2" />
        <rect x="9" y="9" width="6" height="6" rx="1" fill="#fff" />
      </svg>
    </span>
  );
}
