import type { AppState, Challenge, ChallengeLevel, Commitment, TraitId, WeekPlan } from '../types';
import { addDays, daysBetween, weekIndexFor } from './dates';

/** Re-take the questionnaire this often (in weeks) to track trait change. */
export const REASSESS_EVERY_WEEKS = 4;
/** Focusing on one or two traits at a time keeps the weekly load achievable. */
export const MAX_GOALS = 2;
/** Challenges per goal we suggest committing to each week. */
export const SUGGESTED_PER_GOAL = 2;

export function currentWeekIndex(state: AppState, date: string): number | null {
  if (!state.startDate) return null;
  return Math.max(0, weekIndexFor(state.startDate, date));
}

export function weekStart(state: AppState, weekIndex: number): string {
  return addDays(state.startDate!, weekIndex * 7);
}

export function findWeek(state: AppState, weekIndex: number): WeekPlan | undefined {
  return state.weeks.find((w) => w.weekIndex === weekIndex);
}

/** Most recent week before `weekIndex` that had a plan. */
export function previousPlannedWeek(state: AppState, weekIndex: number): WeekPlan | undefined {
  return [...state.weeks]
    .filter((w) => w.weekIndex < weekIndex)
    .sort((a, b) => b.weekIndex - a.weekIndex)[0];
}

/** Share of the week's targets that were met, 0..1 (capped per commitment). */
export function completionRate(week: WeekPlan): number {
  const target = week.commitments.reduce((s, c) => s + c.target, 0);
  if (!target) return 0;
  const done = week.commitments.reduce((s, c) => s + Math.min(c.completions.length, c.target), 0);
  return done / target;
}

export function isCommitmentDone(c: Commitment): boolean {
  return c.completions.length >= c.target;
}

/**
 * Pick next week's difficulty from last week's follow-through.
 *
 * Hudson et al. (2019) found that completing challenges predicted trait growth
 * while accepting challenges and then failing them did not help (and could
 * hurt). So we start easy, step up only after a strong week, and step down
 * after a weak one.
 */
export function recommendLevel(
  prev: WeekPlan | undefined,
  trait: TraitId,
  library: Challenge[],
): ChallengeLevel {
  if (!prev) return 1;
  const forTrait = prev.commitments.filter((c) => library.find((x) => x.id === c.challengeId)?.trait === trait);
  if (!forTrait.length) return 1;
  const levels = forTrait.map((c) => library.find((x) => x.id === c.challengeId)!.level);
  const avgLevel = Math.round(levels.reduce((a, b) => a + b, 0) / levels.length);
  const rate = completionRate({ ...prev, commitments: forTrait });
  let next = avgLevel;
  if (rate >= 0.8) next = avgLevel + 1;
  else if (rate < 0.5) next = avgLevel - 1;
  return clampLevel(next);
}

/** How many challenges to suggest for a goal next week, given follow-through. */
export function recommendCount(prev: WeekPlan | undefined): number {
  if (!prev) return SUGGESTED_PER_GOAL;
  const rate = completionRate(prev);
  return rate < 0.5 ? 1 : SUGGESTED_PER_GOAL;
}

/**
 * Suggested challenges for a trait, best first: the recommended level, then
 * neighbouring levels. Within a level, challenges completed last week come
 * first (repetition builds habits), especially ones the user enjoyed, since
 * enjoyment predicted change in the PEACH studies. Ones rated unenjoyable
 * sink so the user can swap them out.
 */
export function suggestChallenges(
  trait: TraitId,
  level: ChallengeLevel,
  library: Challenge[],
  prev?: WeekPlan,
): Challenge[] {
  const history = new Map(prev?.commitments.map((c) => [c.challengeId, c]) ?? []);
  const bonus = (id: string): number => {
    const c = history.get(id);
    if (!c) return 0;
    if (c.enjoyment != null && c.enjoyment <= 2) return 3;
    let b = isCommitmentDone(c) ? -1 : 0;
    if (c.enjoyment != null && c.enjoyment >= 4) b -= 2;
    return b;
  };
  return library
    .filter((c) => c.trait === trait)
    .map((c) => ({ c, rank: Math.abs(c.level - level) * 10 + bonus(c.id) }))
    .sort((a, b) => a.rank - b.rank)
    .map((x) => x.c);
}

export function isReassessmentDue(state: AppState, date: string): boolean {
  const last = state.assessments[state.assessments.length - 1];
  if (!last || !state.startDate) return false;
  return daysBetween(last.date, date) >= REASSESS_EVERY_WEEKS * 7;
}

export function isProgramComplete(state: AppState, date: string): boolean {
  const idx = currentWeekIndex(state, date);
  return idx != null && idx >= state.programWeeks;
}

function clampLevel(n: number): ChallengeLevel {
  return Math.min(3, Math.max(1, n)) as ChallengeLevel;
}
