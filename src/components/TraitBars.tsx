import type { TraitScores } from '../types';
import { TRAIT_IDS } from '../types';
import { TRAITS } from '../data/traits';
import { PERCENTILES } from '../data/norms';
import { percentile } from '../lib/scoring';
import { traitColor } from './common';

/** Horizontal 1–5 bars for each trait, optionally with an earlier score for comparison. */
export function TraitBars({
  scores,
  baseline,
  percentiles = true,
}: {
  scores: TraitScores;
  baseline?: TraitScores;
  /** Show the rough percentile under each name (the results screen does; Progress doesn't). */
  percentiles?: boolean;
}) {
  return (
    <div>
      {TRAIT_IDS.map((t) => {
        const pct = ((scores[t] - 1) / 4) * 100;
        const basePct = baseline ? ((baseline[t] - 1) / 4) * 100 : null;
        const pctile = percentile(PERCENTILES[t], scores[t]);
        return (
          <div key={t} className="bar-row" title={`${TRAITS[t].name}: ${scores[t].toFixed(2)} of 5`}>
            <div>
              <div style={{ fontWeight: 600 }}>{TRAITS[t].name}</div>
              {percentiles && <small>~{ordinal(pctile)} percentile</small>}
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${pct}%`, background: traitColor(t) }} />
              {basePct != null && (
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: -2,
                    bottom: -2,
                    left: `calc(${basePct}% - 1px)`,
                    width: 2,
                    background: 'var(--text)',
                    opacity: 0.6,
                  }}
                />
              )}
            </div>
            <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{scores[t].toFixed(1)}</div>
          </div>
        );
      })}
    </div>
  );
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
