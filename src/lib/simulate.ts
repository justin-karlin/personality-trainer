// Simulated people, for checking suggestion policies before real users exist.
//
// Each simulated person has a hidden chance of doing each challenge when the moment comes
// up, which depends on their general follow-through, the challenge's level, and how well
// that particular challenge suits them. Each week a policy suggests challenges; the person
// plans the top two, then lives the week: some days the moment doesn't come up, some days
// nothing gets logged, and on the rest they do it, try part of it, or skip it.
//
// The hidden numbers are assumptions, not measurements. They're for comparing policies on
// equal terms, not for predicting real results.
import type { AppState, Challenge, ChallengeLevel, Commitment, WeekPlan } from '../types';
import { recommendLevel, suggestChallenges } from './program';
import { DEFAULT_PARAMS, rankChallenges, rng, type ModelParams } from './personalize';
import { setOutcome } from './actions';
import { addDays } from './dates';
import { emptyState } from './storage';

export interface SimPerson {
  /** Hidden chance of doing each challenge on a day the moment comes up. */
  p: Record<string, number>;
  /** Hidden enjoyment of each challenge, 1..5. */
  enjoy: Record<string, number>;
  /** Chance the moment comes up on a given day. */
  opportunity: number;
  /** Chance a day goes unlogged. */
  missing: number;
}

const LEVEL_EFFECT: Record<ChallengeLevel, number> = { 1: 0, 2: -0.6, 3: -1.2 };
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

function gauss(u: () => number): number {
  return Math.sqrt(-2 * Math.log(Math.max(u(), 1e-12))) * Math.cos(2 * Math.PI * u());
}

/** A random person, reproducible from a seed. */
export function makePerson(library: Challenge[], seed: number, techniqueCorrelation = 0.6): SimPerson {
  const u = rng(seed);
  const base = 0.6 + 0.8 * gauss(u); // general follow-through
  const p: Record<string, number> = {};
  const enjoy: Record<string, number> = {};
  // How well each technique suits them, shared by its challenges, plus each challenge's own fit.
  const techniqueFit = new Map<string, number>();
  for (const c of library) if (!techniqueFit.has(c.technique)) techniqueFit.set(c.technique, gauss(u));
  for (const c of library) {
    const fit = techniqueCorrelation * techniqueFit.get(c.technique)! + Math.sqrt(1 - techniqueCorrelation ** 2) * gauss(u);
    p[c.id] = sigmoid(base + LEVEL_EFFECT[c.level] + 1.0 * fit);
    enjoy[c.id] = Math.min(5, Math.max(1, Math.round(3 + 1.2 * fit + 0.6 * gauss(u))));
  }
  return { p, enjoy, opportunity: 0.7 + 0.25 * u(), missing: 0.05 + 0.2 * u() };
}

export type Policy = 'rules' | 'thompson';

export interface SimResult {
  /** Days a planned challenge was done, across all weeks. */
  doneDays: number;
  /** Planned days (sum of targets), across all weeks. */
  targetDays: number;
  /** Share of weekly targets met (capped per plan). */
  targetsMet: number;
}

/** Simulate one person following a policy for some weeks. */
export function simulate(
  person: SimPerson,
  library: Challenge[],
  policy: Policy,
  weeks: number,
  seed: number,
  params: ModelParams = DEFAULT_PARAMS,
): SimResult {
  const u = rng(seed);
  const start = '2026-01-05';
  let state: AppState = { ...emptyState(), startDate: start, goals: [{ trait: 'C', why: 'sim', vision: 'sim', createdAt: start }] };
  let doneDays = 0, targetDays = 0, met = 0, plans = 0;

  for (let w = 0; w < weeks; w++) {
    const prev: WeekPlan | undefined = state.weeks[state.weeks.length - 1];
    const level = recommendLevel(prev, 'C', library);
    const picks =
      policy === 'rules'
        ? suggestChallenges('C', level, library, prev).slice(0, 2).map((c) => ({ c, target: c.perWeek }))
        : rankChallenges(state, { trait: 'C', library, level, seed: w * 7919 + seed }, params).slice(0, 2).map((s) => ({ c: s.challenge, target: s.target }));

    const weekStart = addDays(start, w * 7);
    const commitments: Commitment[] = picks.map(({ c, target }) => {
      let commit: Commitment = { challengeId: c.id, ifThen: 'sim', confidence: 7, target, completions: [], log: {} };
      for (let d = 0; d < 7; d++) {
        const date = addDays(weekStart, d);
        if (u() < person.missing) continue; // nothing logged
        if (u() > person.opportunity) {
          commit = setOutcome(commit, date, 'no-chance');
          continue;
        }
        const r = u();
        const pDone = person.p[c.id];
        commit = setOutcome(commit, date, r < pDone ? 'done' : r < pDone + (1 - pDone) * 0.25 ? 'partly' : 'skipped');
      }
      commit.enjoyment = person.enjoy[c.id];
      return commit;
    });

    for (const c of commitments) {
      doneDays += c.completions.length;
      targetDays += c.target;
      met += Math.min(1, c.completions.length / c.target);
      plans++;
    }
    state = { ...state, weeks: [...state.weeks, { weekIndex: w, startDate: weekStart, commitments }] };
  }
  return { doneDays, targetDays, targetsMet: plans ? met / plans : 0 };
}

/** Average results over many simulated people. */
export function comparePolicies(library: Challenge[], people: number, weeks: number, seed = 1, params: ModelParams = DEFAULT_PARAMS) {
  const totals = { rules: { doneDays: 0, targetsMet: 0 }, thompson: { doneDays: 0, targetsMet: 0 } };
  for (let i = 0; i < people; i++) {
    const person = makePerson(library, seed * 100003 + i);
    for (const policy of ['rules', 'thompson'] as const) {
      const r = simulate(person, library, policy, weeks, seed * 31 + i, params);
      totals[policy].doneDays += r.doneDays / people;
      totals[policy].targetsMet += r.targetsMet / people;
    }
  }
  return totals;
}
