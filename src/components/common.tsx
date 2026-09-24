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
}: {
  value?: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
}) {
  const opts = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div className="scale" role="radiogroup" aria-label={label}>
      {opts.map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          className={value === v ? 'selected' : ''}
          onClick={() => onChange(v)}
        >
          {v}
        </button>
      ))}
    </div>
  );
}
