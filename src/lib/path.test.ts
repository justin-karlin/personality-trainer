import { describe, expect, it } from 'vitest';
import type { AppState } from '../types';
import { emptyState } from './storage';
import { STAGES, currentStage, maxGoals, stageForWeek } from './path';

const goal = { trait: 'C' as const, why: 'w', vision: 'v', createdAt: '2026-03-02' };
const base: AppState = { ...emptyState(), startDate: '2026-03-02', goals: [goal] };

describe('stepwise path', () => {
  it('moves through the stages over a 12-week program', () => {
    expect([0, 2, 3, 7, 8, 11, 12, 30].map((w) => stageForWeek(w, 12))).toEqual([
      'small', 'small', 'habit', 'habit', 'consolidate', 'consolidate', 'maintain', 'maintain',
    ]);
  });
  it('scales to shorter programs without skipping a step', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((w) => stageForWeek(w, 6))).toEqual([
      'small', 'small', 'habit', 'habit', 'consolidate', 'consolidate', 'maintain',
    ]);
    expect([0, 1, 2, 3, 4].map((w) => stageForWeek(w, 4))).toEqual(['small', 'habit', 'habit', 'consolidate', 'maintain']);
  });
  it('shows every in-program step for each length Settings allows', () => {
    for (let weeks = 4; weeks <= 24; weeks += 2) {
      const seen = new Set(Array.from({ length: weeks }, (_, w) => stageForWeek(w, weeks)));
      expect([...seen], `${weeks} weeks`).toEqual(['small', 'habit', 'consolidate']);
      expect(stageForWeek(weeks, weeks)).toBe('maintain');
    }
  });
  it('starts at "choose and commit" until a goal exists', () => {
    expect(currentStage(emptyState(), '2026-03-02')).toBe('commit');
    expect(currentStage(base, '2026-03-02')).toBe('small');
  });
  it('restarts the path when the trait is switched', () => {
    const switched = { ...base, goals: [{ ...goal, trait: 'E' as const, createdAt: '2026-04-20' }] };
    expect(currentStage(base, '2026-04-27')).toBe('consolidate');
    expect(currentStage(switched, '2026-04-27')).toBe('small');
    expect(maxGoals(switched, '2026-04-27')).toBe(1);
  });
  it('follows the oldest goal when there are two', () => {
    const two = { ...base, goals: [{ ...goal, trait: 'E' as const, createdAt: '2026-04-27' }, goal] };
    expect(currentStage(two, '2026-04-27')).toBe('consolidate');
  });
  it('allows one trait at first and a second from consolidation', () => {
    expect(maxGoals(emptyState(), '2026-03-02')).toBe(1);
    expect(maxGoals(base, '2026-03-10')).toBe(1);
    expect(maxGoals(base, '2026-05-01')).toBe(2);
    expect(maxGoals({ ...base, goals: [goal, { ...goal, trait: 'E' }] }, '2026-03-10')).toBe(2);
  });
  it('cites only existing references', async () => {
    const { REFERENCES } = await import('../data/references');
    for (const s of STAGES) for (const r of s.refs) expect(REFERENCES[r], r).toBeDefined();
  });
});
