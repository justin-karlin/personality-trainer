import { describe, expect, it } from 'vitest';
import { emptyState } from './storage';
import { priorShift, roomToGrow, startLevel, startTarget, traitBand } from './start';
import { recommendLevel } from './program';
import { priorFor, suggestTarget } from './personalize';
import { CHALLENGES } from '../data/challenges';
import type { AppState, TraitScores } from '../types';

const withScores = (scores: Partial<TraitScores>): AppState => ({
  ...emptyState(),
  assessments: [{ id: 'a', date: '2026-10-01', answers: {}, scores: { O: 3, C: 3, E: 3, A: 3, N: 3, ...scores } as TraitScores }],
});

describe('starting from the questionnaire', () => {
  it('bands scores against other people', () => {
    expect(traitBand(withScores({ C: 1.8 }), 'C')).toBe('low');
    expect(traitBand(withScores({ C: 4.8 }), 'C')).toBe('high');
    expect(traitBand(emptyState(), 'C')).toBeUndefined();
  });

  it('flags the goal with clearly the most room to grow, and only then', () => {
    expect(roomToGrow(withScores({ C: 1.8, A: 4.2 }), ['C', 'A'])).toBe('C');
    expect(roomToGrow(withScores({ C: 4.2, A: 1.8 }), ['C', 'A'])).toBe('A');
    // Similar percentiles (58th and 54th): no flag.
    expect(roomToGrow(withScores({ C: 3.5, A: 4 }), ['C', 'A'])).toBeUndefined();
    expect(roomToGrow(emptyState(), ['C', 'A'])).toBeUndefined();
  });

  it('starts high scorers one level up and low scorers a day lighter', () => {
    expect(startLevel('high')).toBe(2);
    expect(startLevel('low')).toBe(1);
    expect(startLevel(undefined)).toBe(1);
    expect(recommendLevel(undefined, 'C', CHALLENGES, 'high')).toBe(2);
    expect(startTarget(4, 'low')).toBe(3);
    expect(startTarget(1, 'low')).toBe(1);
    expect(startTarget(4, 'mid')).toBe(4);
    const ch = CHALLENGES.find((c) => c.trait === 'C' && c.perWeek >= 2)!;
    expect(suggestTarget(ch, undefined, 'low')).toBe(ch.perWeek - 1);
  });

  it('nudges the starting guess, which the person’s own record then outweighs', () => {
    const ch = CHALLENGES.find((c) => c.trait === 'C')!;
    const mean = (b: { alpha: number; beta: number }) => b.alpha / (b.alpha + b.beta);
    const low = mean(priorFor(ch, { fitsBarrier: false, band: 'low' }));
    const high = mean(priorFor(ch, { fitsBarrier: false, band: 'high' }));
    expect(high - low).toBeCloseTo(priorShift('high') - priorShift('low'), 5);
  });
});
