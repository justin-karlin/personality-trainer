import { describe, expect, it } from 'vitest';
import type { Commitment, WeekPlan } from '../types';
import { legacyDays, outcomeOn, revisePlan, setOutcome, summarizeWeek } from './actions';

const base: Commitment = { challengeId: 'c1', ifThen: 'If A, then B.', confidence: 8, target: 3, completions: [], log: {} };

describe('action records', () => {
  it('keeps completions in step with the log', () => {
    let c = setOutcome(base, '2026-10-12', 'done');
    expect(c.completions).toEqual(['2026-10-12']);
    c = setOutcome(c, '2026-10-12', 'skipped');
    expect(c.completions).toEqual([]);
    expect(outcomeOn(c, '2026-10-12')).toBe('skipped');
    c = setOutcome(c, '2026-10-12', undefined);
    expect(outcomeOn(c, '2026-10-12')).toBeUndefined();
  });

  it('keeps legacy practice days as they were', () => {
    const legacy: Commitment = { challengeId: 'c1', ifThen: 'x', confidence: 7, target: 3, completions: ['2026-10-12', '2026-10-13'] };
    expect(legacyDays(legacy)).toEqual(['2026-10-12', '2026-10-13']);
    expect(outcomeOn(legacy, '2026-10-12')).toBe('done');
    const logged = setOutcome(legacy, '2026-10-14', 'no-chance');
    expect(legacyDays(logged)).toEqual(['2026-10-12', '2026-10-13']);
    expect(logged.completions).toEqual(legacy.completions);
  });

  it('separates done, tried, skipped, no chance and missing days', () => {
    let c = setOutcome(base, '2026-10-12', 'done');
    c = setOutcome(c, '2026-10-13', 'partly');
    c = setOutcome(c, '2026-10-14', 'skipped');
    c = setOutcome(c, '2026-10-15', 'no-chance');
    const week: WeekPlan = { weekIndex: 0, startDate: '2026-10-12', commitments: [c] };
    expect(summarizeWeek(week, '2026-10-17')).toEqual({
      done: 1,
      partly: 1,
      skipped: 1,
      noChance: 1,
      legacy: 0,
      daysSoFar: 6,
      daysLogged: 4,
    });
  });

  it('keeps earlier wordings when the plan changes', () => {
    const c = revisePlan(base, 'If C, then D.', '2026-10-14', true);
    expect(c.ifThen).toBe('If C, then D.');
    expect(c.revisions).toEqual([{ ifThen: 'If A, then B.', replaced: '2026-10-14' }]);
    expect(c.coachDrafted).toBe(true);
    expect(revisePlan(c, 'If C, then D.', '2026-10-15')).toBe(c);
  });
});
