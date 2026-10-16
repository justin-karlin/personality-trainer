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

const EVIDENCE_WORD: Record<EvidenceLevel, string> = { strong: 'strong', moderate: 'moderate', emerging: 'emerging' };

export function EvidencePill({ level, technique = false }: { level: EvidenceLevel; technique?: boolean }) {
  const word = EVIDENCE_WORD[level];
  // On a technique, say so: the rating is for the general technique, not the exercise or this app.
  return technique ? (
    <span className={`pill ${level}`} title="Rates research on the general technique, not this exact exercise or this app.">
      Technique: {word} evidence
    </span>
  ) : (
    <span className={`pill ${level}`}>{word[0].toUpperCase() + word.slice(1)} evidence</span>
  );
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

/**
 * A row of agree/disagree answers. Wide screens show each label on its button; phones show
 * one row of numbers with the two end labels underneath, so a question stays short.
 */
export function Likert({
  labels,
  value,
  onChange,
  label,
}: {
  labels: readonly string[];
  value?: number;
  onChange: (v: number) => void;
  /** Accessible name of the question. */
  label: string;
}) {
  return (
    <>
      <div className="likert" role="radiogroup" aria-label={label}>
        {labels.map((text, idx) => {
          const v = idx + 1;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={value === v}
              aria-label={`${v}, ${text}`}
              className={value === v ? 'selected' : ''}
              onClick={() => onChange(v)}
            >
              <span className="lk-num">{v}</span>
              <span className="lk-text">{text}</span>
            </button>
          );
        })}
      </div>
      <div className="likert-ends" aria-hidden="true">
        <span>{labels[0]}</span>
        <span>{labels[labels.length - 1]}</span>
      </div>
    </>
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

/** Support resources, shown when an AI reply suggests someone may be at risk. Never depends on the AI working. */
export function SupportCard({ lead }: { lead: string }) {
  return (
    <div className="card tip care" style={{ margin: 0 }}>
      <p style={{ margin: 0 }}>
        {lead} If you're in crisis, call or text <strong>988</strong> (US). If someone is hurting or frightening you, the
        National Domestic Violence Hotline is <strong>1-800-799-7233</strong> (US). Elsewhere, find a helpline at{' '}
        <a href="https://findahelpline.com" target="_blank" rel="noreferrer">
          findahelpline.com
        </a>
        .
      </p>
    </div>
  );
}

/**
 * A short pointer to support, for AI error and busy states, so it never disappears when the
 * AI does. It carries the same lines as SupportCard: an error can hide a reply that would
 * have flagged support (the spend breaker caps the AI at its smallest model, which may decline).
 */
export function SupportLine() {
  return (
    <p className="muted" style={{ margin: 0 }}>
      Having a hard time? Call or text 988 (US). If someone is hurting or frightening you, call 1-800-799-7233 (US).
      Elsewhere, find a helpline at{' '}
      <a href="https://findahelpline.com" target="_blank" rel="noreferrer">
        findahelpline.com
      </a>
      .
    </p>
  );
}
