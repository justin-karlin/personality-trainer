// How the questionnaire shapes a person's start. Scores are turned into a rough band
// (compared with other people, from the same percentile table the results screen uses),
// and the band nudges four things: which goal is flagged as having the most room to grow,
// the first week's challenge level, the first targets, and the starting guess the
// suggestion model uses before the person has a record of their own. Once they log
// weeks, their own record takes over (see program.recommendLevel and personalize).
//
// The person still chooses. Nothing here picks a goal for them: there is no "ideal"
// level of a trait, and pushing people toward one is a concern raised about these
// programs (Haehner et al., 2026). The flag only says where their score is lowest.
import type { AppState, ChallengeLevel, TraitId } from '../types';
import { PERCENTILES } from '../data/norms';
import { growthScore, percentile } from './scoring';

export type Band = 'low' | 'mid' | 'high';

/** The latest questionnaire score for a trait (1..5, higher = more of the goal), if any. */
export function latestScore(state: AppState, trait: TraitId): number | undefined {
  const last = state.assessments[state.assessments.length - 1];
  const s = last?.scores[trait];
  return s == null ? undefined : growthScore(trait, s);
}

/** Rough percentile compared with other people (1..99). */
export function traitPercentile(state: AppState, trait: TraitId): number | undefined {
  const last = state.assessments[state.assessments.length - 1];
  const s = last?.scores[trait];
  if (s == null) return undefined;
  const p = percentile(PERCENTILES[trait], s);
  return trait === 'N' ? 100 - p : p;
}

/** Lower than most (30th percentile or below), about average, or higher than most (70th or above). */
export function traitBand(state: AppState, trait: TraitId): Band | undefined {
  const p = traitPercentile(state, trait);
  if (p == null) return undefined;
  return p <= 30 ? 'low' : p >= 70 ? 'high' : 'mid';
}

export const BAND_WORDS: Record<Band, string> = {
  low: 'Your score: lower than most',
  mid: 'Your score: about average',
  high: 'Your score: higher than most',
};

/**
 * The offered goal with the most room to grow: the lowest percentile, if it is at or
 * below average and clearly lower (15+ points) than every other offered goal.
 */
export function roomToGrow(state: AppState, traits: TraitId[]): TraitId | undefined {
  const scored = traits
    .map((t) => ({ t, p: traitPercentile(state, t) }))
    .filter((x): x is { t: TraitId; p: number } => x.p != null)
    .sort((a, b) => a.p - b.p);
  if (scored.length < 2) return undefined;
  const [first, second] = scored;
  return first.p <= 50 && second.p - first.p >= 15 ? first.t : undefined;
}

/** First-week level: people who already score high start one step up; everyone else starts easy. */
export function startLevel(band: Band | undefined): ChallengeLevel {
  return band === 'high' ? 2 : 1;
}

/** First target for a challenge with no record yet: one day lighter for a low score. */
export function startTarget(perWeek: number, band: Band | undefined): number {
  return band === 'low' ? Math.max(1, perWeek - 1) : perWeek;
}

/** Shift to the suggestion model's starting guess of success, before the person's own record. */
export function priorShift(band: Band | undefined): number {
  return band === 'low' ? -0.08 : band === 'high' ? 0.08 : 0;
}
