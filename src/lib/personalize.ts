// Personalised challenge suggestions: a small Bayesian model per person, ranked by
// Thompson sampling. Everything runs on the device from the person's own log.
//
// For each challenge we keep a Beta belief about "on a day when the moment came up, did
// they do it?". The starting belief (the prior) comes from the app's existing rules:
// easier challenges are expected to succeed more often, and challenges matched to the
// person's main barrier a little more. Each logged day then updates it: "done" counts as a
// success, "skipped" as a failure, "tried part of it" as half of each. "No chance came up"
// and days with nothing logged say nothing about the challenge, so they're ignored.
//
// Thompson sampling draws one plausible success rate from each belief and ranks by the
// draws. Challenges that have gone well rise; untried ones still get a fair chance to
// surface, and the ranking shifts as evidence comes in. Draws are seeded by week, so the
// list stays put while someone is planning and only reshuffles from one week to the next.
//
// The prior numbers below are the app's own starting guesses, not research estimates; they
// are meant to be replaced by values estimated from data (see docs/RESEARCH.md).
import type { AppState, Challenge, ChallengeLevel, TraitId } from '../types';

export interface ModelParams {
  /** Starting guess for the share of opportunities on which a challenge gets done, by level. */
  priorMean: Record<ChallengeLevel, number>;
  /** How many logged days the starting guess is worth. In simulation, 8 beat 4 (less noisy ranking) while still letting a person's own log dominate within a few weeks. */
  priorStrength: number;
  /** Extra expected success for challenges matched to the person's main barrier. */
  barrierBonus: number;
  /** Weight given to the person's record with other challenges of the same technique. */
  techniqueWeight: number;
  /**
   * Keep the challenge that has worked best for them (at least this many logged days, done on
   * at least `keepBestRate` of them, and not disliked) in the top slot. 0 turns this off.
   */
  keepBestMinDays: number;
  keepBestRate: number;
}

export const DEFAULT_PARAMS: ModelParams = {
  priorMean: { 1: 0.7, 2: 0.55, 3: 0.4 },
  priorStrength: 8,
  barrierBonus: 0.08,
  techniqueWeight: 0.5,
  keepBestMinDays: 3,
  keepBestRate: 0.6,
};

export interface ChallengeRecord {
  /** Days done (including legacy practice days), with "tried part" counted as half. */
  success: number;
  /** Days skipped, with "tried part" counted as half. */
  failure: number;
  /** Weeks it was planned. */
  weeks: number;
  /** Days actually done, for explanations (whole days only). */
  doneDays: number;
  /** Days with a done/partly/skipped entry, for explanations. */
  loggedDays: number;
  /** Mean weekly enjoyment (1..5), if rated. */
  enjoyment?: number;
}

/** Each challenge's record so far, from every planned week. */
export function challengeRecords(state: AppState): Map<string, ChallengeRecord> {
  const out = new Map<string, ChallengeRecord & { enjoySum: number; enjoyN: number }>();
  for (const w of state.weeks) {
    for (const c of w.commitments) {
      const r = out.get(c.challengeId) ?? { success: 0, failure: 0, weeks: 0, doneDays: 0, loggedDays: 0, enjoySum: 0, enjoyN: 0 };
      r.weeks++;
      const outcomes = Object.values(c.log ?? {});
      // Completions without a log entry are legacy practice days: successes, with no record of failures.
      const done = c.completions.length;
      const partly = outcomes.filter((o) => o === 'partly').length;
      const skipped = outcomes.filter((o) => o === 'skipped').length;
      r.success += done + partly / 2;
      r.failure += skipped + partly / 2;
      r.doneDays += done;
      r.loggedDays += done + partly + skipped;
      if (c.enjoyment != null) {
        r.enjoySum += c.enjoyment;
        r.enjoyN++;
      }
      out.set(c.challengeId, r);
    }
  }
  return new Map(
    [...out].map(([id, { enjoySum, enjoyN, ...r }]) => [id, { ...r, enjoyment: enjoyN ? enjoySum / enjoyN : undefined }]),
  );
}

export interface Belief {
  alpha: number;
  beta: number;
}

/** The starting belief for a challenge, before this person's record with it. */
export function priorFor(
  ch: Challenge,
  opts: { fitsBarrier: boolean; technique?: { success: number; failure: number } },
  params: ModelParams = DEFAULT_PARAMS,
): Belief {
  let mean = params.priorMean[ch.level] + (opts.fitsBarrier ? params.barrierBonus : 0);
  mean = Math.min(0.95, Math.max(0.05, mean));
  let alpha = mean * params.priorStrength;
  let beta = (1 - mean) * params.priorStrength;
  // Partial pooling: how they've done with other challenges of the same technique.
  if (opts.technique) {
    alpha += params.techniqueWeight * opts.technique.success;
    beta += params.techniqueWeight * opts.technique.failure;
  }
  return { alpha, beta };
}

export const posteriorMean = (b: Belief) => b.alpha / (b.alpha + b.beta);

/** How well a challenge's level suits where the person is now (the rule-based level). */
export function levelFit(level: ChallengeLevel, recommended: ChallengeLevel): number {
  const gap = Math.abs(level - recommended);
  // Stretch is never pushed: it stays available, but ranks lower unless it's the recommended level.
  const stretchPenalty = level === 3 && recommended !== 3 ? 0.85 : 1;
  return (gap === 0 ? 1 : gap === 1 ? 0.8 : 0.6) * stretchPenalty;
}

/** Enjoyment nudges the ranking: in PEACH data, enjoyed practice went with slightly more change. */
export function enjoymentFactor(enjoyment: number | undefined): number {
  if (enjoyment == null) return 1;
  return enjoyment <= 2 ? 0.6 : 1 + 0.05 * (enjoyment - 3);
}

export interface Suggestion {
  challenge: Challenge;
  /** The sampled score used for ranking (for tests and debugging). */
  score: number;
  /** The expected share of opportunities on which it gets done. */
  expected: number;
  /** A plain-language reason, from the person's own record. */
  why: string;
  /** A realistic days-per-week target. */
  target: number;
}

export interface RankOptions {
  trait: TraitId;
  library: Challenge[];
  /** The level the rule-based planner recommends this week. */
  level: ChallengeLevel;
  /** Challenges matched to the person's main barrier. */
  fits?: string[];
  /** Seeds the draws; use the week index so the ranking is stable within a week. */
  seed: number;
}

/** Rank a trait's challenges for this person by Thompson sampling. */
export function rankChallenges(state: AppState, opts: RankOptions, params: ModelParams = DEFAULT_PARAMS): Suggestion[] {
  const records = challengeRecords(state);
  const fits = new Set(opts.fits ?? []);
  const pool = opts.library.filter((c) => c.trait === opts.trait);

  // The person's record per technique, for partial pooling.
  const byTechnique = new Map<string, { success: number; failure: number }>();
  for (const c of pool) {
    const r = records.get(c.id);
    if (!r) continue;
    const t = byTechnique.get(c.technique) ?? { success: 0, failure: 0 };
    t.success += r.success;
    t.failure += r.failure;
    byTechnique.set(c.technique, t);
  }

  const ranked = pool
    .map((ch) => {
      const own = records.get(ch.id);
      const tech = byTechnique.get(ch.technique);
      // Pool only the *other* challenges of this technique.
      const others = tech && own ? { success: tech.success - own.success, failure: tech.failure - own.failure } : tech;
      const prior = priorFor(ch, { fitsBarrier: fits.has(ch.id), technique: others }, params);
      const belief = { alpha: prior.alpha + (own?.success ?? 0), beta: prior.beta + (own?.failure ?? 0) };
      const draw = betaSample(belief.alpha, belief.beta, rng(hash(`${opts.seed}:${ch.id}`)));
      const score = draw * levelFit(ch.level, opts.level) * enjoymentFactor(own?.enjoyment);
      return {
        challenge: ch,
        score,
        expected: posteriorMean(belief),
        why: explain(own, others, fits.has(ch.id)),
        target: suggestTarget(ch, own),
        proven: !!own && params.keepBestMinDays > 0 && own.loggedDays >= params.keepBestMinDays &&
          own.doneDays / own.loggedDays >= params.keepBestRate && (own.enjoyment ?? 3) > 2,
      };
    })
    .sort((a, b) => b.score - a.score);

  // Repeating what works is part of building a habit: keep the best-proven challenge on top,
  // and let Thompson sampling order the rest.
  const proven = ranked.filter((s) => s.proven).sort((a, b) => b.expected - a.expected)[0];
  const ordered = proven ? [proven, ...ranked.filter((s) => s !== proven)] : ranked;
  return ordered.map(({ proven: _p, ...s }) => s);
}

function explain(own: ChallengeRecord | undefined, technique: { success: number; failure: number } | undefined, fitsBarrier: boolean): string {
  if (own && own.loggedDays > 0) {
    const liked = own.enjoyment != null && own.enjoyment >= 4 ? ' and you enjoyed it' : own.enjoyment != null && own.enjoyment <= 2 ? ', though you didn’t enjoy it' : '';
    return `You did it on ${own.doneDays} of ${own.loggedDays} days you logged it${liked}.`;
  }
  if (own && own.doneDays > 0) return `You practised it on ${own.doneDays} day${own.doneDays === 1 ? '' : 's'} before.`;
  if (technique && technique.success + technique.failure >= 2) {
    const share = Math.round((technique.success / (technique.success + technique.failure)) * 100);
    return `New to you. Similar challenges went well on about ${share}% of your logged days.`;
  }
  if (fitsBarrier) return 'New to you, and it fits what usually gets in your way.';
  return 'New to you.';
}

/**
 * A realistic target: about one more day than they've been managing, and never more than
 * the challenge's usual frequency. Without a record, the challenge's usual frequency.
 */
export function suggestTarget(ch: Challenge, own: ChallengeRecord | undefined): number {
  if (!own || own.weeks === 0 || own.loggedDays === 0) return ch.perWeek;
  const perWeek = own.doneDays / own.weeks;
  return Math.max(1, Math.min(ch.perWeek, Math.round(perWeek) + 1, 7));
}

// ── Seeded randomness ──────────────────────────────────────────────────────

/** A small string hash (FNV-1a), for seeding. */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a fast seeded generator of uniform numbers in [0, 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(u: () => number): number {
  // Box–Muller; avoid log(0).
  const a = Math.max(u(), 1e-12);
  return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * u());
}

/** Gamma(shape, 1) by Marsaglia–Tsang, with the usual boost for shape < 1. */
function gamma(shape: number, u: () => number): number {
  if (shape < 1) return gamma(shape + 1, u) * Math.pow(Math.max(u(), 1e-12), 1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number, v: number;
    do {
      x = normal(u);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const w = u();
    if (w < 1 - 0.0331 * x ** 4 || Math.log(w) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/** A draw from Beta(alpha, beta). */
export function betaSample(alpha: number, beta: number, u: () => number): number {
  const x = gamma(alpha, u);
  const y = gamma(beta, u);
  return x / (x + y);
}
