"use client";

import { useState } from "react";
import { saveSituation } from "../actions";
import { CONCERNS, CRITERIA_KEYS, REGIONS, SITES, STAGES } from "@/lib/constants";
import { Chevron } from "@/components/ui";

type Initial = { site: string; stage: string; concerns: string[]; region: string; criteria: string[] } | null;

function Chip({ on, onClick, disabled, children }: { on: boolean; onClick: () => void; disabled?: boolean; children: string }) {
  return (
    <button type="button" className="chip" aria-pressed={on} onClick={onClick} disabled={disabled}>
      {on && "✓ "}
      {children}
    </button>
  );
}

function Single({ label, options, value, onChange }: { label: string; options: readonly string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="field">
      <div className="label">{label}</div>
      <div className="chips" role="group" aria-label={label}>
        {options.map((o) => (
          <Chip key={o} on={value === o} onClick={() => onChange(o)}>
            {o}
          </Chip>
        ))}
      </div>
    </div>
  );
}

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export default function SituationForm({ initial, error }: { initial: Initial; error: boolean }) {
  const [site, setSite] = useState(initial?.site ?? "");
  const [stage, setStage] = useState(initial?.stage ?? "");
  const [concerns, setConcerns] = useState<string[]>(initial?.concerns ?? []);
  const [region, setRegion] = useState(initial?.region ?? "");
  const [criteria, setCriteria] = useState<string[]>(initial?.criteria ?? []);

  const ready = site && stage && region && concerns.length > 0 && criteria.length === 2;

  return (
    <form action={saveSituation} style={{ display: "contents" }}>
      <main className="content">
        <div className="hero-card">
          <div className="kicker">1분이면 충분해요</div>
          <h2>어떤 치료를 앞두고 계신가요?</h2>
          <p>내 상황과 기준에 맞춰 공개 기록을 정리해 드려요.</p>
        </div>

        <Single label="부위" options={SITES} value={site} onChange={setSite} />
        <Single label="병기" options={STAGES} value={stage} onChange={setStage} />

        <div className="field">
          <div className="label">
            가장 큰 고민 <span style={{ fontWeight: 400, color: "var(--muted)" }}>여러 개 선택</span>
          </div>
          <div className="chips" role="group" aria-label="가장 큰 고민">
            {CONCERNS.map((c) => (
              <Chip key={c} on={concerns.includes(c)} onClick={() => setConcerns(toggle(concerns, c))}>
                {c}
              </Chip>
            ))}
          </div>
        </div>

        <Single label="지역" options={REGIONS} value={region} onChange={setRegion} />

        <div className="field panel">
          <div className="label">
            가장 중요한 기준 2개
            <span style={{ color: "var(--teal)", fontWeight: 800 }}>{criteria.length}/2</span>
          </div>
          <div className="chips" role="group" aria-label="가장 중요한 기준 2개">
            {CRITERIA_KEYS.map((c) => (
              <Chip
                key={c}
                on={criteria.includes(c)}
                disabled={!criteria.includes(c) && criteria.length >= 2}
                onClick={() => setCriteria(toggle(criteria, c))}
              >
                {c}
              </Chip>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--sub)", marginTop: 10 }}>먼저 고른 기준부터 순서대로 정리해요.</div>
        </div>

        {error && <div className="error">항목을 모두 골라 주세요.</div>}

        <input type="hidden" name="site" value={site} />
        <input type="hidden" name="stage" value={stage} />
        <input type="hidden" name="region" value={region} />
        {concerns.map((c) => (
          <input key={c} type="hidden" name="concerns" value={c} />
        ))}
        {criteria.map((c) => (
          <input key={c} type="hidden" name="criteria" value={c} />
        ))}
      </main>

      <div className="cta-bar">
        <button className="btn" type="submit" disabled={!ready}>
          내 기준으로 정리하기 <Chevron />
        </button>
      </div>
    </form>
  );
}
