import { describe, expect, it } from 'vitest';
import type { AssessmentItem } from '../types';
import { growthScore, isComplete, percentile, scoreAssessment, scorePhq4, suggestsSupport } from './scoring';
import { IPIP50 } from '../data/assessment';
import { PERCENTILES } from '../data/norms';

const items: AssessmentItem[] = [
  { id: 'e1', text: 'Am the life of the party.', trait: 'E', key: 1 },
  { id: 'e2', text: "Don't talk a lot.", trait: 'E', key: -1 },
  { id: 'n1', text: 'Get stressed out easily.', trait: 'N', key: 1 },
  { id: 'n2', text: 'Am relaxed most of the time.', trait: 'N', key: -1 },
];

describe('scoreAssessment', () => {
  it('reverse-keys negatively keyed items', () => {
    const s = scoreAssessment(items, { e1: 5, e2: 1, n1: 2, n2: 4 });
    expect(s.E).toBe(5);
    expect(s.N).toBe(2);
  });
  it('returns NaN for traits with no answered items', () => {
    expect(scoreAssessment(items, { e1: 3 }).C).toBeNaN();
  });
  it('detects completeness', () => {
    expect(isComplete(items, { e1: 1, e2: 1, n1: 1 })).toBe(false);
    expect(isComplete(items, { e1: 1, e2: 1, n1: 1, n2: 1 })).toBe(true);
  });
});

describe('growthScore', () => {
  it('flips neuroticism so higher always means growth', () => {
    expect(growthScore('N', 4)).toBe(2);
    expect(growthScore('C', 4)).toBe(4);
  });
});

describe('percentile', () => {
  it('looks up the scale sum and clamps to 1–99', () => {
    const table = Array.from({ length: 41 }, (_, i) => Math.round((i / 40) * 100));
    expect(percentile(table, 3)).toBe(50);
    expect(percentile(table, 1)).toBe(1);
    expect(percentile(table, 5)).toBe(99);
  });
  it('has a monotonic 41-entry table for every trait', () => {
    for (const t of Object.values(PERCENTILES)) {
      expect(t).toHaveLength(41);
      t.forEach((v, i) => i && expect(v).toBeGreaterThanOrEqual(t[i - 1]));
    }
  });
});

describe('IPIP-50 item set', () => {
  it('has 10 items per trait with the published key balance', () => {
    const count = (trait: string, key: number) => IPIP50.filter((i) => i.trait === trait && i.key === key).length;
    expect(IPIP50).toHaveLength(50);
    expect([count('E', 1), count('E', -1)]).toEqual([5, 5]);
    expect([count('A', 1), count('A', -1)]).toEqual([6, 4]);
    expect([count('C', 1), count('C', -1)]).toEqual([6, 4]);
    // Emotional Stability has 2 positive / 8 negative items, so N is 8 / 2.
    expect([count('N', 1), count('N', -1)]).toEqual([8, 2]);
    expect([count('O', 1), count('O', -1)]).toEqual([7, 3]);
  });
});

describe('PHQ-4', () => {
  it('splits into anxiety and depression subscales', () => {
    expect(scorePhq4([1, 2, 0, 1])).toEqual({ anxiety: 3, depression: 1 });
  });
  it('suggests support at a subscale score of 3 or more', () => {
    expect(suggestsSupport({ anxiety: 2, depression: 2 })).toBe(false);
    expect(suggestsSupport({ anxiety: 3, depression: 0 })).toBe(true);
    expect(suggestsSupport({ anxiety: 0, depression: 4 })).toBe(true);
    expect(suggestsSupport(undefined)).toBe(false);
  });
});
