// The app's optional AI features run on a small server (worker/) that holds the Claude
// API key. They only appear when the build sets VITE_COACH_URL.
import type { AppState, WeekPlan, WeeklyReflection } from '../types';
import { challengeById } from '../data/challenges';
import { barrierById } from '../data/barriers';
import { summarizeWeek } from './actions';

export const COACH_URL: string | undefined = import.meta.env.VITE_COACH_URL;

/** What the weekly review is sent: the goal's problem and barrier, each plan's record, and the reflection. */
export function buildReviewRequest(
  state: AppState,
  week: WeekPlan,
  reflection: Partial<WeeklyReflection>,
  date: string,
  depth: 'standard' | 'deeper' = 'standard',
) {
  const plans = week.commitments.flatMap((c) => {
    const ch = challengeById(c.challengeId);
    if (!ch) return [];
    const s = summarizeWeek({ ...week, commitments: [c] }, date);
    return [
      {
        id: c.challengeId,
        title: ch.title,
        instructions: ch.instructions,
        ifThen: c.ifThen,
        target: c.target,
        done: s.done,
        partly: s.partly,
        skipped: s.skipped,
        noChance: s.noChance,
        noEntry: s.daysSoFar - s.daysLogged,
        trait: ch.trait,
        enjoyment: c.enjoyment,
      },
    ];
  });
  // One goal per review: the one most of this week's plans belong to.
  const goal = plans.filter((p) => p.trait === 'A').length > plans.length / 2 ? 'A' : 'C';
  const focus = state.goals.find((g) => g.trait === goal)?.focus;
  return {
    goal,
    problem: focus?.problem,
    better: focus?.better,
    barrier: focus?.barrier === 'other' ? focus.barrierNote : barrierById(focus?.barrier)?.label,
    daysSoFar: summarizeWeek(week, date).daysSoFar,
    plans: plans.filter((p) => p.trait === goal).map(({ trait: _t, ...p }) => p),
    reflection: {
      wentWell: reflection.wentWell?.trim() || undefined,
      obstacles: reflection.obstacles?.trim() || undefined,
      nextTime: reflection.nextTime?.trim() || undefined,
      downsides: reflection.downsides?.trim() || undefined,
    },
    depth,
  };
}

export interface ReviewChange {
  planId: string;
  kind: 'reword' | 'target' | 'drop';
  ifThen: string;
  target: number;
  why: string;
}

export interface WeekReviewReply {
  summary: string;
  changes: ReviewChange[];
  needsSupport: boolean;
}

export async function requestReview(body: ReturnType<typeof buildReviewRequest>): Promise<WeekReviewReply> {
  const res = await fetch(`${COACH_URL}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error ?? 'The reviewer couldn’t answer just now.');
  return json as WeekReviewReply;
}
