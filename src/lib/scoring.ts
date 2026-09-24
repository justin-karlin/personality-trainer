import type { AssessmentItem, TraitId, TraitScores } from '../types';
import { TRAIT_IDS } from '../types';
import { PHQ4_CUTOFF } from '../data/assessment';

export const LIKERT_LABELS = [
  'Very inaccurate',
  'Moderately inaccurate',
  'Neither',
  'Moderately accurate',
  'Very accurate',
];

/** Mean item score per trait on a 1–5 scale, applying reverse keying. */
export function scoreAssessment(items: AssessmentItem[], answers: Record<string, number>): TraitScores {
  const sums: Record<TraitId, number> = { N: 0, E: 0, O: 0, A: 0, C: 0 };
  const counts: Record<TraitId, number> = { N: 0, E: 0, O: 0, A: 0, C: 0 };
  for (const item of items) {
    const raw = answers[item.id];
    if (raw == null) continue;
    sums[item.trait] += item.key === 1 ? raw : 6 - raw;
    counts[item.trait] += 1;
  }
  const scores = {} as TraitScores;
  for (const t of TRAIT_IDS) {
    scores[t] = counts[t] ? round2(sums[t] / counts[t]) : NaN;
  }
  return scores;
}

export function isComplete(items: AssessmentItem[], answers: Record<string, number>): boolean {
  return items.every((i) => answers[i.id] != null);
}

/**
 * Score expressed in the goal direction (higher = more growth), so that
 * neuroticism is flipped into emotional stability.
 */
export function growthScore(trait: TraitId, score: number): number {
  return trait === 'N' ? 6 - score : score;
}

/**
 * Approximate percentile (1–99) for a 1–5 mean score, using a table indexed by
 * the 10-item scale sum (10..50).
 */
export function percentile(table: number[], score: number): number {
  const idx = Math.round(score * 10) - 10;
  const p = table[Math.min(table.length - 1, Math.max(0, idx))];
  return Math.min(99, Math.max(1, p));
}

export type Wellbeing = { anxiety: number; depression: number };

/** PHQ-4: items 0–1 are the GAD-2 (anxiety), items 2–3 the PHQ-2 (depression); each answer 0..3. */
export function scorePhq4(answers: number[]): Wellbeing {
  return { anxiety: answers[0] + answers[1], depression: answers[2] + answers[3] };
}

/** A subscale of 3+ is the published cut-off for recommending a professional evaluation. */
export function suggestsSupport(w?: Wellbeing): boolean {
  return !!w && (w.anxiety >= PHQ4_CUTOFF || w.depression >= PHQ4_CUTOFF);
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
