import { describe, expect, it } from 'vitest';
import type { AppState, Challenge, Commitment, WeekPlan } from '../types';
import { emptyState } from './storage';
import {
  completionRate,
  completionsByTrait,
  totalCompletions,
  currentWeekIndex,
  isProgramComplete,
  isReassessmentDue,
  previousPlannedWeek,
  recommendCount,
  recommendLevel,
  suggestChallenges,
} from './program';

const lib: Challenge[] = [
  { id: 'c1', trait: 'C', technique: 't', level: 1, title: '', instructions: '', perWeek: 3, minutes: 5, ifThenExample: '' },
  { id: 'c2', trait: 'C', technique: 't', level: 2, title: '', instructions: '', perWeek: 3, minutes: 5, ifThenExample: '' },
  { id: 'c3', trait: 'C', technique: 't', level: 3, title: '', instructions: '', perWeek: 3, minutes: 5, ifThenExample: '' },
  { id: 'c1b', trait: 'C', technique: 't', level: 1, title: '', instructions: '', perWeek: 3, minutes: 5, ifThenExample: '' },
  { id: 'e1', trait: 'E', technique: 't', level: 1, title: '', instructions: '', perWeek: 2, minutes: 5, ifThenExample: '' },
];

function commit(challengeId: string, target: number, done: number): Commitment {
  return {
    challengeId,
    ifThen: 'x',
    confidence: 8,
    target,
    completions: Array.from({ length: done }, (_, i) => `2026-01-0${i + 1}`),
  };
}

function week(weekIndex: number, commitments: Commitment[]): WeekPlan {
  return { weekIndex, startDate: '2026-01-01', commitments };
}

describe('completionRate', () => {
  it('caps each commitment at its target', () => {
    expect(completionRate(week(0, [commit('c1', 2, 5), commit('c2', 2, 0)]))).toBe(0.5);
  });
  it('is 0 for an empty week', () => {
    expect(completionRate(week(0, []))).toBe(0);
  });
});

describe('recommendLevel', () => {
  it('starts easy with no history', () => {
    expect(recommendLevel(undefined, 'C', lib)).toBe(1);
  });
  it('steps up after a strong week', () => {
    expect(recommendLevel(week(0, [commit('c1', 3, 3)]), 'C', lib)).toBe(2);
  });
  it('holds after a middling week', () => {
    expect(recommendLevel(week(0, [commit('c2', 3, 2)]), 'C', lib)).toBe(2);
  });
  it('steps down after a weak week', () => {
    expect(recommendLevel(week(0, [commit('c2', 3, 1)]), 'C', lib)).toBe(1);
  });
  it('keeps an opted-in Stretch level but never steps up to it automatically', () => {
    expect(recommendLevel(week(0, [commit('c3', 3, 3)]), 'C', lib)).toBe(3);
    expect(recommendLevel(week(0, [commit('c2', 3, 3)]), 'C', lib)).toBe(2);
  });
  it('does not step up after a strong week the user disliked', () => {
    expect(recommendLevel(week(0, [{ ...commit('c1', 3, 3), enjoyment: 1 }]), 'C', lib)).toBe(1);
    expect(recommendLevel(week(0, [{ ...commit('c1', 3, 3), enjoyment: 4 }]), 'C', lib)).toBe(2);
  });
  it('only considers challenges for the given trait', () => {
    expect(recommendLevel(week(0, [commit('c2', 3, 3)]), 'E', lib)).toBe(1);
  });
});

describe('recommendCount', () => {
  it('suggests fewer challenges after a weak week', () => {
    expect(recommendCount(week(0, [commit('c1', 4, 1)]))).toBe(1);
    expect(recommendCount(week(0, [commit('c1', 4, 4)]))).toBe(2);
  });
  it('suggests one challenge per goal in maintenance', () => {
    expect(recommendCount(week(0, [commit('c1', 4, 4)]), true)).toBe(1);
  });
});

describe('practice counts', () => {
  it('counts every completion, including extra repetitions, per trait', () => {
    const w = week(0, [commit('c1', 2, 4), commit('c2', 3, 1), commit('e1', 2, 2)]);
    expect(completionsByTrait(w, lib)).toEqual({ C: 5, E: 2 });
    expect(totalCompletions(w)).toBe(7);
    expect(completionsByTrait(undefined, lib)).toEqual({});
  });
});

describe('suggestChallenges', () => {
  it('orders by closeness to the level and keeps completed ones first', () => {
    const prev = week(0, [commit('c1b', 1, 1)]);
    const ids = suggestChallenges('C', 1, lib, prev).map((c) => c.id);
    expect(ids).toEqual(['c1b', 'c1', 'c2', 'c3']);
  });
  it('favours enjoyed challenges and demotes disliked ones', () => {
    const liked = { ...commit('c1b', 3, 1), enjoyment: 5 };
    expect(suggestChallenges('C', 1, lib, week(0, [liked]))[0].id).toBe('c1b');
    const disliked = { ...commit('c1', 1, 1), enjoyment: 1 };
    const ids = suggestChallenges('C', 1, lib, week(0, [disliked])).map((c) => c.id);
    expect(ids.indexOf('c1')).toBeGreaterThan(ids.indexOf('c1b'));
  });
});

describe('weeks and reassessment', () => {
  const base: AppState = { ...emptyState(), startDate: '2026-01-01' };

  it('computes the program week', () => {
    expect(currentWeekIndex(base, '2026-01-07')).toBe(0);
    expect(currentWeekIndex(base, '2026-01-08')).toBe(1);
    expect(currentWeekIndex(emptyState(), '2026-01-08')).toBeNull();
  });

  it('finds the most recent earlier planned week', () => {
    const s = { ...base, weeks: [week(0, []), week(2, []), week(3, [])] };
    expect(previousPlannedWeek(s, 3)?.weekIndex).toBe(2);
    expect(previousPlannedWeek(s, 0)).toBeUndefined();
  });

  it('asks for a retake after four weeks', () => {
    const s: AppState = {
      ...base,
      assessments: [{ id: 'a', date: '2026-01-01', answers: {}, scores: { N: 3, E: 3, O: 3, A: 3, C: 3 } }],
    };
    expect(isReassessmentDue(s, '2026-01-28')).toBe(false);
    expect(isReassessmentDue(s, '2026-01-29')).toBe(true);
  });

  it('re-measures every 12 weeks once the program is over', () => {
    const s: AppState = {
      ...base,
      programWeeks: 12,
      goals: [{ trait: 'C', why: 'w', vision: 'v', createdAt: '2026-01-01' }],
      assessments: [{ id: 'a', date: '2026-03-26', answers: {}, scores: { N: 3, E: 3, O: 3, A: 3, C: 3 } }],
    };
    expect(isReassessmentDue(s, '2026-04-30')).toBe(false);
    expect(isReassessmentDue(s, '2026-06-18')).toBe(true);
  });

  it('ends the program only when every goal has finished its own path', () => {
    const c = { trait: 'C' as const, why: 'w', vision: 'v', createdAt: '2026-01-01' };
    const s: AppState = { ...base, programWeeks: 12, goals: [c] };
    expect(isProgramComplete(s, '2026-03-25')).toBe(false); // week 12 of 12
    expect(isProgramComplete(s, '2026-03-26')).toBe(true);
    // A second trait added in week 10 keeps the program going until its own path ends.
    const both: AppState = { ...s, goals: [c, { ...c, trait: 'E', createdAt: '2026-03-12' }] };
    expect(isProgramComplete(both, '2026-03-26')).toBe(false);
    expect(isProgramComplete(both, '2026-06-04')).toBe(true);
  });
});
