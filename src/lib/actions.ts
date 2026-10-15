// Action records: what the user planned to do, and what actually happened each day.
// Kept separate from check-ins (self-ratings), questionnaire scores and app use, so
// "opened the app", "logged a day" and "did the planned action" never blur together.
import type { ActionOutcome, Commitment, PlanRevision, WeekPlan } from '../types';
import { addDays, daysBetween } from './dates';

export const OUTCOME_LABEL: Record<ActionOutcome, string> = {
  done: 'Done',
  partly: 'Tried part of it',
  skipped: 'Had the chance, skipped it',
  'no-chance': 'No chance came up',
};

/** Set (or clear, with `undefined`) one day's outcome, keeping `completions` in step. */
export function setOutcome(c: Commitment, date: string, outcome: ActionOutcome | undefined): Commitment {
  const log = { ...(c.log ?? {}) };
  if (outcome) log[date] = outcome;
  else delete log[date];
  const completions = c.completions.filter((d) => d !== date);
  if (outcome === 'done') completions.push(date);
  return { ...c, log, completions: completions.sort() };
}

/** The outcome for a day: a logged one, or 'done' for a legacy practice day. */
export function outcomeOn(c: Commitment, date: string): ActionOutcome | undefined {
  return c.log?.[date] ?? (c.completions.includes(date) ? 'done' : undefined);
}

/** Completion dates that predate outcome logging (no log entry). */
export function legacyDays(c: Commitment): string[] {
  return c.completions.filter((d) => !c.log?.[d]);
}

/**
 * Change the plan's wording, keeping the old wording so a later review can tell
 * the original plan from a revised one.
 */
export function revisePlan(c: Commitment, ifThen: string, date: string, coachDrafted = false): Commitment {
  if (c.ifThen === ifThen) return coachDrafted && !c.coachDrafted ? { ...c, coachDrafted } : c;
  const revisions: PlanRevision[] = [...(c.revisions ?? []), { ifThen: c.ifThen, replaced: date }];
  return { ...c, ifThen, revisions, coachDrafted };
}

export interface ActionSummary {
  done: number;
  partly: number;
  skipped: number;
  noChance: number;
  /** Done days recorded before outcome logging existed (included in `done`). */
  legacy: number;
  /** Days of the week so far (1..7). */
  daysSoFar: number;
  /** Days so far with at least one action entry. */
  daysLogged: number;
}

/** Tally a week's action records, up to and including `date`. */
export function summarizeWeek(week: WeekPlan, date: string): ActionSummary {
  const daysSoFar = Math.min(7, Math.max(0, daysBetween(week.startDate, date) + 1));
  const days = Array.from({ length: daysSoFar }, (_, i) => addDays(week.startDate, i));
  const out: ActionSummary = { done: 0, partly: 0, skipped: 0, noChance: 0, legacy: 0, daysSoFar, daysLogged: 0 };
  const logged = new Set<string>();
  for (const c of week.commitments) {
    for (const d of days) {
      const o = outcomeOn(c, d);
      if (!o) continue;
      logged.add(d);
      if (o === 'done') {
        out.done++;
        if (!c.log?.[d]) out.legacy++;
      } else if (o === 'partly') out.partly++;
      else if (o === 'skipped') out.skipped++;
      else out.noChance++;
    }
  }
  out.daysLogged = logged.size;
  return out;
}

/** Every outcome logged on a day, across all weeks' commitments. */
export function outcomesOn(weeks: WeekPlan[], date: string): ActionOutcome[] {
  return weeks.flatMap((w) => w.commitments.map((c) => outcomeOn(c, date)).filter((o): o is ActionOutcome => !!o));
}
