import { describe, expect, it } from 'vitest';
import type { AppState, Challenge, Commitment } from '../types';
import { emptyState } from './storage';
import { betaSample, challengeRecords, levelFit, priorFor, rankChallenges, rng, suggestTarget } from './personalize';
import { comparePolicies } from './simulate';
import { CHALLENGES } from '../data/challenges';

const ch = (id: string, level: 1 | 2 | 3, technique = 't', perWeek = 3): Challenge => ({
  id, trait: 'C', technique, level, title: id, instructions: '', perWeek, minutes: 5, ifThenExample: '',
});
const lib = [ch('easy', 1), ch('easy2', 1, 'u'), ch('mid', 2), ch('hard', 3)];

function stateWith(...commitments: Commitment[]): AppState {
  return { ...emptyState(), startDate: '2026-01-05', weeks: commitments.map((c, i) => ({ weekIndex: i, startDate: '2026-01-05', commitments: [c] })) };
}
const commit = (challengeId: string, log: Commitment['log'], extra: Partial<Commitment> = {}): Commitment => ({
  challengeId, ifThen: 'x', confidence: 7, target: 3,
  completions: Object.entries(log ?? {}).filter(([, o]) => o === 'done').map(([d]) => d),
  log, ...extra,
});

describe('records', () => {
  it('counts done and skipped days, halves partial ones, ignores no-chance and missing days', () => {
    const s = stateWith(commit('easy', { a: 'done', b: 'done', c: 'partly', d: 'skipped', e: 'no-chance' }, { enjoyment: 4 }));
    const r = challengeRecords(s).get('easy')!;
    expect(r).toMatchObject({ success: 2.5, failure: 1.5, doneDays: 2, loggedDays: 4, weeks: 1, enjoyment: 4 });
  });
  it('treats legacy practice days as successes without inventing failures', () => {
    const legacy: Commitment = { challengeId: 'easy', ifThen: 'x', confidence: 7, target: 3, completions: ['a', 'b'] };
    expect(challengeRecords(stateWith(legacy)).get('easy')).toMatchObject({ success: 2, failure: 0 });
  });
});

describe('beliefs', () => {
  it('start easier challenges higher, and nudge barrier-matched ones up', () => {
    const mean = (b: { alpha: number; beta: number }) => b.alpha / (b.alpha + b.beta);
    expect(mean(priorFor(ch('a', 1), { fitsBarrier: false }))).toBeGreaterThan(mean(priorFor(ch('b', 3), { fitsBarrier: false })));
    expect(mean(priorFor(ch('a', 2), { fitsBarrier: true }))).toBeGreaterThan(mean(priorFor(ch('a', 2), { fitsBarrier: false })));
  });
  it('never pushes Stretch above the recommended level', () => {
    expect(levelFit(3, 1)).toBeLessThan(levelFit(1, 1));
    expect(levelFit(3, 3)).toBe(1);
  });
  it('samples Beta draws with the right average', () => {
    const u = rng(42);
    const draws = Array.from({ length: 4000 }, () => betaSample(3, 7, u));
    expect(draws.reduce((a, b) => a + b, 0) / draws.length).toBeCloseTo(0.3, 1);
    expect(Math.min(...draws)).toBeGreaterThan(0);
    expect(Math.max(...draws)).toBeLessThan(1);
  });
});

describe('ranking', () => {
  it('is stable within a week and explains itself from the person’s own record', () => {
    const s = stateWith(commit('mid', { a: 'done', b: 'done', c: 'done', d: 'done', e: 'skipped' }, { enjoyment: 5 }));
    const opts = { trait: 'C' as const, library: lib, level: 2 as const, seed: 3 };
    const first = rankChallenges(s, opts).map((x) => x.challenge.id);
    expect(rankChallenges(s, opts).map((x) => x.challenge.id)).toEqual(first);
    const mid = rankChallenges(s, opts).find((x) => x.challenge.id === 'mid')!;
    expect(mid.why).toBe('Done 4 of 5 times · you enjoyed it');
    expect(rankChallenges(s, opts).find((x) => x.challenge.id === 'easy')!.why).toMatch(/^New to you\. Similar challenges went well on about/);
  });

  it('learns: a challenge someone keeps skipping sinks, one they keep doing rises', () => {
    const skips = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`s${i}`, 'skipped' as const]));
    const dones = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`d${i}`, 'done' as const]));
    const s = stateWith(commit('easy', skips), commit('easy2', dones));
    let easy2First = 0;
    for (let seed = 0; seed < 50; seed++) {
      const order = rankChallenges(s, { trait: 'C', library: lib, level: 1, seed }).map((x) => x.challenge.id);
      if (order.indexOf('easy2') < order.indexOf('easy')) easy2First++;
    }
    expect(easy2First).toBeGreaterThan(45);
  });

  it('keeps the challenge that has worked best on top, but not one they dislike', () => {
    const good = commit('mid', { a: 'done', b: 'done', c: 'done', d: 'skipped' });
    for (let seed = 0; seed < 20; seed++) {
      expect(rankChallenges(stateWith(good), { trait: 'C', library: lib, level: 1, seed })[0].challenge.id).toBe('mid');
    }
    const disliked = { ...good, enjoyment: 1 };
    const tops = new Set(Array.from({ length: 20 }, (_, seed) => rankChallenges(stateWith(disliked), { trait: 'C', library: lib, level: 1, seed })[0].challenge.id));
    expect(tops.has('mid')).toBe(false);
  });

  it('suggests about one more day than they have been managing', () => {
    expect(suggestTarget(ch('x', 1, 't', 5), { success: 4, failure: 6, weeks: 2, doneDays: 4, loggedDays: 10 })).toBe(3);
    expect(suggestTarget(ch('x', 1, 't', 3), undefined)).toBe(3);
    expect(suggestTarget(ch('x', 1, 't', 3), { success: 14, failure: 0, weeks: 2, doneDays: 14, loggedDays: 14 })).toBe(3);
  });
});

describe('simulation', () => {
  // Simulated people (assumed, not measured) following each policy for 12 weeks.
  it('Thompson sampling gets more practice done than the fixed rules', () => {
    const r = comparePolicies(CHALLENGES, 200, 12, 1);
    expect(r.thompson.doneDays).toBeGreaterThan(r.rules.doneDays * 1.03);
    expect(r.thompson.targetsMet).toBeGreaterThan(r.rules.targetsMet);
  });
});
