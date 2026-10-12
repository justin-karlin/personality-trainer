import type { AppState, EvidenceLevel, Goal } from '../types';
import { daysBetween } from './dates';

// The stepwise path. Steps 1–3 target things that predicted change in the
// studies (commitment to a chosen goal, completing small concrete actions,
// enjoyable repeated practice); step 5 follows the long-term follow-ups. One
// trait at a time matches PEACH and Hudson (2021), but no study compared it with
// several at once. The consolidation step and the ORDER are this app's own,
// untested design, and the Science page says so.

export type StageId = 'commit' | 'small' | 'habit' | 'consolidate' | 'maintain';

export interface Stage {
  id: StageId;
  title: string;
  focus: string;
  why: string;
  evidence: EvidenceLevel;
  refs: string[];
}

export const STAGES: Stage[] = [
  {
    id: 'commit',
    title: 'Choose and commit',
    focus: 'Pick one trait you want to change for your own reasons, and decide you will stick with it.',
    why: 'In a large app study, commitment to the goal was the one predictor linked to change on every measure, including ratings by partners, family and friends, though the link was small. For emotional stability, practice only went with self-rated growth in people who had chosen that goal themselves.',
    evidence: 'emerging',
    refs: ['olaru2026', 'hudson2021'],
  },
  {
    id: 'small',
    title: 'Small, sure steps',
    focus: 'A couple of easy challenges, each with a concrete if-then plan. Finish them before adding more.',
    why: 'In one study, completing challenges predicted self-rated growth in three of five traits, while signing up for more than you finished predicted lagging behind peers. In another, coaching people who wanted to be more outgoing to write concrete if-then plans roughly doubled their self-rated gains.',
    evidence: 'moderate',
    refs: ['hudson2019', 'hudson2015'],
  },
  {
    id: 'habit',
    title: 'Build habits',
    focus: 'Repeat the challenges that worked and that you enjoy, in the same situations, until they feel automatic.',
    why: 'People who completed more plans and enjoyed them reported more change. In a neuroticism app trial, habit practice started slower, but self-rated gains kept growing until the follow-up about two months later, while quick calming tools faded. Comparing therapy studies, programs longer than about two months showed little extra change (a tentative finding).',
    evidence: 'emerging',
    refs: ['olaru2026', 'wright2026', 'roberts2017'],
  },
  {
    id: 'consolidate',
    title: 'Consolidate and check',
    focus: 'Keep your best habits going, retake the questionnaire and re-check your goal. If it feels settled, you can add a second trait.',
    why: 'In one study, gains mostly stayed in the trait being practised, so a new trait needs its own practice. This step and adding traits one at a time are this app\'s choices: none of the studies we draw on tested an order.',
    evidence: 'emerging',
    refs: ['hudson2019'],
  },
  {
    id: 'maintain',
    title: 'Maintain',
    focus: 'Keep one favourite challenge per goal and retake the questionnaire about every 3 months.',
    why: 'In a coaching app\'s one-year follow-up, gains in extraversion and conscientiousness held and neuroticism kept falling, among the 1 in 10 participants who answered again.',
    evidence: 'emerging',
    refs: ['stieger2024'],
  },
];

/**
 * First program week (0-based) of each stage. A 12-week program runs weeks 1–3,
 * 4–8 and 9–12; shorter programs shrink each stage so none is skipped.
 */
export function stageStarts(programWeeks: number): Record<Exclude<StageId, 'commit'>, number> {
  const habit = Math.min(3, Math.max(1, Math.round(programWeeks / 4)));
  const consolidate = Math.min(8, Math.max(habit + 1, Math.round((programWeeks * 2) / 3)));
  return { small: 0, habit, consolidate, maintain: programWeeks };
}

export function stageForWeek(weekIndex: number, programWeeks: number): StageId {
  const s = stageStarts(programWeeks);
  if (weekIndex >= s.maintain) return 'maintain';
  if (weekIndex >= s.consolidate) return 'consolidate';
  if (weekIndex >= s.habit) return 'habit';
  return 'small';
}

/** Whole weeks since a goal was set (0-based). */
export function goalWeek(goal: Goal, date: string): number {
  return Math.max(0, Math.floor(daysBetween(goal.createdAt, date) / 7));
}

/** Each goal follows its own path from the day it was set, so a new or switched trait starts at step 2. */
export function goalStage(goal: Goal, programWeeks: number, date: string): StageId {
  return stageForWeek(goalWeek(goal, date), programWeeks);
}

/** The goal held longest; the path card and the unlock rule follow it. */
export function primaryGoal(state: AppState): Goal | undefined {
  return state.goals.reduce<Goal | undefined>((a, g) => (!a || g.createdAt < a.createdAt ? g : a), undefined);
}

export function currentStage(state: AppState, date: string): StageId {
  const primary = primaryGoal(state);
  if (!primary || !state.startDate) return 'commit';
  return goalStage(primary, state.programWeeks, date);
}

/** One trait at a time: a second goal unlocks once the first reaches consolidation. */
export function maxGoals(state: AppState, date: string): number {
  if (state.goals.length >= 2) return 2; // never take away goals someone already has
  const stage = currentStage(state, date);
  return stage === 'consolidate' || stage === 'maintain' ? 2 : 1;
}

/** Commitment of 3.5 or below on the 1–5 check is "lukewarm". */
export const LOW_COMMITMENT = 3.5;
