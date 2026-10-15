import type { AppState, Challenge, ChallengeLevel, Commitment, TraitId, WeekPlan } from '../types';
import { addDays, daysBetween, weekIndexFor } from './dates';
import { goalStage } from './path';

/** Re-take the questionnaire this often (in weeks) to track trait change. */
export const REASSESS_EVERY_WEEKS = 4;
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
 * In Hudson et al. (2019), completing more challenges predicted self-reported
 * growth in extraversion, conscientiousness and emotional stability (not
 * agreeableness; for openness the link was slightly negative). For the same
 * number completed, accepting more went with relative declines (except
 * openness), and harder challenges did not predict more growth on average.
 * In PEACH data, easier plans went with more goal-consistent days (Olaru et
 * al., 2026). So we start easy, never step up to Stretch automatically (it
 * stays available to pick), only step up from Easy after a strong week the
 * user did not dislike, and step down after a weak week.
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
  const avgLevel = clampLevel(Math.round(levels.reduce((a, b) => a + b, 0) / levels.length));
  const rate = completionRate({ ...prev, commitments: forTrait });
  const ratings = forTrait.map((c) => c.enjoyment).filter((e): e is number => e != null);
  const disliked = ratings.length > 0 && ratings.reduce((a, b) => a + b, 0) / ratings.length <= 2;
  if (rate < 0.5) return clampLevel(avgLevel - 1);
  if (rate >= 0.8 && !disliked && avgLevel === 1) return 2;
  return avgLevel;
}

/**
 * How many challenges to suggest per goal next week. After a weak week, or
 * once the program is over (maintenance), suggest one.
 */
export function recommendCount(prev: WeekPlan | undefined, maintenance = false): number {
  if (maintenance) return 1;
  if (!prev) return SUGGESTED_PER_GOAL;
  const rate = completionRate(prev);
  return rate < 0.5 ? 1 : SUGGESTED_PER_GOAL;
}

/** Completed repetitions per goal trait in a week (uncapped: extra practice counts). */
export function completionsByTrait(week: WeekPlan | undefined, library: Challenge[]): Partial<Record<TraitId, number>> {
  const out: Partial<Record<TraitId, number>> = {};
  for (const c of week?.commitments ?? []) {
    const t = library.find((x) => x.id === c.challengeId)?.trait;
    if (t) out[t] = (out[t] ?? 0) + c.completions.length;
  }
  return out;
}

/** Total completed repetitions in a week, uncapped. */
export function totalCompletions(week: WeekPlan): number {
  return week.commitments.reduce((s, c) => s + c.completions.length, 0);
}

/**
 * Suggested challenges for a trait, best first: the recommended level, then
 * neighbouring levels. Within a level, challenges completed last week come
 * first (repeating a behaviour is thought to help it become a habit),
 * especially ones the user enjoyed. In one analysis of PEACH data (Olaru et
 * al., 2026), people who carried out more of their if-then plans and found
 * them more pleasant reported more change in their own ratings, though not in
 * observer ratings. Ones rated unenjoyable sink so the user can swap them out.
 */
export function suggestChallenges(
  trait: TraitId,
  level: ChallengeLevel,
  library: Challenge[],
  prev?: WeekPlan,
  /** Challenges matched to the user's main barrier; they come first within their level. */
  fits: string[] = [],
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
    .map((c) => ({ c, rank: Math.abs(c.level - level) * 10 + bonus(c.id) - (fits.includes(c.id) ? 5 : 0) }))
    .sort((a, b) => a.rank - b.rank)
    .map((x) => x.c);
}

/** After the program ends, re-measure less often (PEACH re-tested 3 months after its program). */
export const MAINTENANCE_REASSESS_WEEKS = 12;

export function isReassessmentDue(state: AppState, date: string): boolean {
  const last = state.assessments[state.assessments.length - 1];
  if (!last || !state.startDate) return false;
  const weeks = isProgramComplete(state, last.date) ? MAINTENANCE_REASSESS_WEEKS : REASSESS_EVERY_WEEKS;
  return daysBetween(last.date, date) >= weeks * 7;
}

/** The program is over once every current goal has reached the maintenance step of its own path. */
export function isProgramComplete(state: AppState, date: string): boolean {
  if (!state.startDate || !state.goals.length) return false;
  return state.goals.every((g) => goalStage(g, state.programWeeks, date) === 'maintain');
}

function clampLevel(n: number): ChallengeLevel {
  return Math.min(3, Math.max(1, n)) as ChallengeLevel;
}
