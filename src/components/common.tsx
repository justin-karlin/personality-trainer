import type { KeyboardEvent } from 'react';
import type { EvidenceLevel, TraitId } from '../types';
import { TRAITS } from '../data/traits';
import { REFERENCES } from '../data/references';

export function traitColor(t: TraitId): string {
  return `var(--t-${t})`;
}

export function TraitTag({ trait, goal = false }: { trait: TraitId; goal?: boolean }) {
  return (
    <span className="pill">
      <span className="trait-dot" style={{ background: traitColor(trait) }} />
      {goal ? TRAITS[trait].goalName : TRAITS[trait].name}
    </span>
  );
}

const EVIDENCE_LABEL: Record<EvidenceLevel, string> = {
  strong: 'Strong evidence',
  moderate: 'Moderate evidence',
  emerging: 'Emerging evidence',
};

export function EvidencePill({ level }: { level: EvidenceLevel }) {
  return <span className={`pill ${level}`}>{EVIDENCE_LABEL[level]}</span>;
}

export function RefList({ ids }: { ids: string[] }) {
  const refs = ids.map((id) => REFERENCES[id]).filter(Boolean);
  if (!refs.length) return null;
  return (
    <div className="refs">
      {refs.map((r, i) => (
        <span key={r.id}>
          {i > 0 && '; '}
          <a href={r.url} target="_blank" rel="noreferrer">
            {r.short}
          </a>
        </span>
      ))}
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
    </div>
  );
}

export function Scale({
  value,
  onChange,
  min = 1,
  max = 7,
  label,
  labelledBy,
  ends,
}: {
  value?: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  /** Accessible name, unless `labelledBy` points at a visible question. */
  label: string;
  labelledBy?: string;
  /** Meanings of the lowest and highest options, announced with those numbers. */
  ends?: [string, string];
}) {
  const opts = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  // A radio group: one tab stop; arrow keys move and select, wrapping at the ends (WAI-ARIA pattern).
  const focusable = value ?? min;
  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, v: number) {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    let next: number | null = e.key === 'Home' ? min : e.key === 'End' ? max : step ? v + step : null;
    if (next == null) return;
    if (next > max) next = min;
    if (next < min) next = max;
    e.preventDefault();
    onChange(next);
    const group = e.currentTarget.parentElement;
    group?.querySelectorAll<HTMLButtonElement>('button')[next - min]?.focus();
  }
  return (
    <div
      className="scale"
      role="radiogroup"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      style={{ gridTemplateColumns: `repeat(${opts.length}, minmax(0, 1fr))` }}
    >
      {opts.map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          aria-label={ends && v === min ? `${v}, ${ends[0]}` : ends && v === max ? `${v}, ${ends[1]}` : undefined}
          tabIndex={v === focusable ? 0 : -1}
          className={value === v ? 'selected' : ''}
          onClick={() => onChange(v)}
          onKeyDown={(e) => onKeyDown(e, v)}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

/** Switch between the two Learn pages. */
export function LearnTabs({ current }: { current: 'science' | 'library' }) {
  return (
    <nav className="segmented" aria-label="Learn">
      <a href="#/science" aria-current={current === 'science' ? 'page' : undefined}>
        Science
      </a>
      <a href="#/library" aria-current={current === 'library' ? 'page' : undefined}>
        Toolkit
      </a>
    </nav>
  );
}
