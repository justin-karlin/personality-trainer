// Which Claude model runs each feature, and how a request moves up to a bigger one.
// Kept free of Worker globals so the escalation rules can be unit-tested.
import Anthropic from '@anthropic-ai/sdk';

/** Smallest to largest. Prices are per million tokens (input / output). */
export const TIERS = {
  haiku: { model: 'claude-haiku-5-5', input: 0.1, output: 0.5 },
  sonnet: { model: 'claude-sonnet-5-5', input: 2, output: 10 },
  opus: { model: 'claude-opus-5-5', input: 4, output: 20 },
} as const;
export type Tier = keyof typeof TIERS;
export const LADDER: Tier[] = ['haiku', 'sonnet', 'opus'];

export function isTier(v: unknown): v is Tier {
  return typeof v === 'string' && (LADDER as string[]).includes(v);
}

/** The tiers to try, from `start` up to `max` (inclusive). */
export function ladderFrom(start: Tier, max: Tier): Tier[] {
  const a = LADDER.indexOf(start);
  const b = Math.max(a, LADDER.indexOf(max));
  return LADDER.slice(a, b + 1);
}

/**
 * A route's plan: the ladder to climb, plus spare tiers below the start (nearest first)
 * that are tried only if every tier on the ladder was unavailable. Each model has its own
 * capacity, so one being overloaded or down rarely takes the others with it.
 */
export function routePlan(start: Tier, max: Tier): { tiers: Tier[]; spare: Tier[] } {
  return { tiers: ladderFrom(start, max), spare: LADDER.slice(0, LADDER.indexOf(start)).reverse() };
}

/**
 * Overloaded (529), server errors, timeouts and dropped connections: worth trying another
 * model. Our own rate or spend limit (429) is not: moving to a bigger model would let
 * anyone who floods the cheap model turn that into spending on the expensive one.
 */
export function isUnavailable(e: unknown): boolean {
  if (e instanceof Anthropic.APIConnectionError) return true; // includes timeouts
  if (e instanceof Anthropic.APIError) return (e.status ?? 0) >= 500;
  return false;
}

/**
 * Model-specific request fields. Sonnet and Opus get Anthropic's server-side refusal
 * fallback; Haiku has none (adding it is rejected or does nothing), so a Haiku refusal
 * is handled by escalating to the next tier instead.
 */
export function modelFields(tier: Tier): { model: string; betas?: string[]; fallbacks?: 'default' } {
  const model = TIERS[tier].model;
  return tier === 'haiku' ? { model } : { model, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' };
}

/** Per-million-token prices (input / output). */
export interface Price {
  input: number;
  output: number;
}

/**
 * Every model that may serve a request: our tiers, plus the models Anthropic's
 * server-side fallback can hand a declined Sonnet or Opus request to. Fallback attempts
 * are billed at the fallback model's own price, which can be above the tier's.
 */
export const MODEL_PRICES: Record<string, Price> = {
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-opus-5': { input: 5, output: 25 },
  'claude-opus-4-8': { input: 5, output: 25 },
  'claude-opus-4-7': { input: 5, output: 25 },
  'claude-opus-4-6': { input: 5, output: 25 },
  'claude-haiku-4-5': { input: 1, output: 5 },
};
/** A model we don't know is priced at the highest current rate, so spend is never under-counted. */
export const UNKNOWN_PRICE: Price = { input: 10, output: 50 };
/** The most a tier's server-side fallback attempt can cost per token (Haiku has no fallback). */
export const FALLBACK_PRICE: Partial<Record<Tier, Price>> = {
  sonnet: MODEL_PRICES['claude-sonnet-5'],
  opus: MODEL_PRICES['claude-opus-5'],
};

export function priceOf(model: string | null | undefined): Price {
  if (!model) return UNKNOWN_PRICE;
  // Exact id, or a dated snapshot of one (claude-opus-5-20261001).
  const key = Object.keys(MODEL_PRICES).find((k) => model === k || model.startsWith(`${k}-2`));
  return key ? MODEL_PRICES[key] : UNKNOWN_PRICE;
}

interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

function tokensCost(p: Price, u: TokenUsage): number {
  const cacheWrite = (u.cache_creation_input_tokens ?? 0) * p.input * 1.25;
  const cacheRead = (u.cache_read_input_tokens ?? 0) * p.input * 0.1;
  return ((u.input_tokens ?? 0) * p.input + (u.output_tokens ?? 0) * p.output + cacheWrite + cacheRead) / 1_000_000;
}

/** Dollar cost of one response's tokens at a tier's price. */
export function costOf(tier: Tier, usage: TokenUsage): number {
  return tokensCost(TIERS[tier], usage);
}

/**
 * What one response actually cost. With server-side fallback, top-level `usage` covers
 * only the attempt that produced the reply; `usage.iterations` lists every attempt
 * (including one that declined part-way, which is billed), each priced by the model
 * that ran it. Without iterations, the top-level usage at the tier's price.
 */
export function responseCost(
  tier: Tier,
  usage: (TokenUsage & { iterations?: ReadonlyArray<Partial<TokenUsage> & { type?: string; model?: string | null }> | null }) | null | undefined,
): number {
  if (!usage) return 0;
  const its = usage.iterations;
  if (!its?.length) return costOf(tier, usage);
  return its.reduce((total, it) => {
    // A plain `message` entry with no model is the requested model's own attempt.
    const price = it.model ? priceOf(it.model) : it.type === 'message' ? TIERS[tier] : UNKNOWN_PRICE;
    return total + tokensCost(price, { input_tokens: 0, output_tokens: 0, ...it } as TokenUsage);
  }, 0);
}

/**
 * The most a request can cost before it runs, for reserving budget: every tier on its
 * ladder writing `maxTokens`, plus a full fallback attempt on tiers that have one.
 */
export function worstCaseCost(tiers: Tier[], inputTokens: number, maxTokens: number): number {
  const u = { input_tokens: inputTokens, output_tokens: maxTokens };
  return tiers.reduce((t, tier) => t + costOf(tier, u) + (FALLBACK_PRICE[tier] ? tokensCost(FALLBACK_PRICE[tier]!, u) : 0), 0);
}

/**
 * Most tokens one call may write (thinking included, since Haiku 5.5 and Opus 5.5 think
 * by default). Bounds the cost of a runaway reply; a cut-off escalates as 'invalid'.
 */
export const MAX_OUTPUT_TOKENS = 2000;

/** Why a request moved up a tier. */
export type EscalationReason = 'refusal' | 'invalid' | 'model-asked' | 'support' | 'missed' | 'error';

export class Escalate extends Error {
  /** Skip the tiers in between and go straight to the last one (e.g. a possible crisis). */
  toTop: boolean;
  constructor(public reason: EscalationReason, message: string, opts: { toTop?: boolean } = {}) {
    super(message);
    this.toTop = !!opts.toTop;
  }
}

export interface Attempt<T> {
  tier: Tier;
  result?: T;
  reason?: EscalationReason;
  detail?: string;
}

/**
 * Run `call` on each tier in turn until one gives an acceptable answer. `call` throws
 * `Escalate` to move up (a refusal, a reply that fails validation, or one the model
 * itself flagged as beyond it); an unavailable model (overloaded, rate-limited, down,
 * timed out) also moves on. The last tier's answer is accepted even if it asked to
 * escalate, since there's nowhere further to go. If the ladder ends because models
 * were unavailable, the `spare` tiers are tried in order before giving up.
 */
export async function withEscalation<T>(
  tiers: Tier[],
  call: (tier: Tier, isLast: boolean) => Promise<T>,
  spare: Tier[] = [],
  /** Filled as the ladder runs, so a caller can see the attempts even when it throws. */
  attempts: Attempt<T>[] = [],
): Promise<{ result: T; tier: Tier; attempts: Attempt<T>[] }> {
  const attempt = async (tier: Tier, isLast: boolean): Promise<T | Escalate> => {
    try {
      const result = await call(tier, isLast);
      attempts.push({ tier, result });
      return result;
    } catch (e) {
      const esc = asEscalation(e);
      if (!esc) {
        // A bug (e.g. a malformed request) or our own rate limit: not something another
        // model should fix. Still recorded, for the request's log line.
        attempts.push({ tier, reason: 'error', detail: (e as Error)?.message });
        throw e;
      }
      attempts.push({ tier, reason: esc.reason, detail: esc.message });
      return esc;
    }
  };
  let failure: Escalate | undefined;
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    const out = await attempt(tier, i === tiers.length - 1);
    if (!(out instanceof Escalate)) return { result: out, tier, attempts };
    failure = out;
    if (out.toTop) i = Math.max(i, tiers.length - 2); // the loop's i++ lands on the last tier
  }
  if (failure?.reason === 'error') {
    for (const tier of spare) {
      const out = await attempt(tier, true);
      if (!(out instanceof Escalate)) return { result: out, tier, attempts };
      failure = out;
    }
  }
  throw failure ?? new Error('No model tiers configured.');
}

/** An Escalate, or an unavailable model as an 'error' escalation; null for anything else. */
export function asEscalation(e: unknown): Escalate | null {
  return e instanceof Escalate ? e : isUnavailable(e) ? new Escalate('error', (e as Error).message) : null;
}

/** The escalations in a run's attempts, for logs and replies. */
export function escalationsOf(attempts: Attempt<unknown>[]): { tier: Tier; reason: string }[] {
  return attempts.filter((a) => a.reason).map((a) => ({ tier: a.tier, reason: a.reason! as string }));
}

/** Read the text of a response, turning refusals and cut-offs into escalations. */
export function responseText(response: Anthropic.Beta.BetaMessage): string {
  if (response.stop_reason === 'refusal') throw new Escalate('refusal', 'The request was declined.');
  if (response.stop_reason === 'max_tokens') throw new Escalate('invalid', 'The reply was cut off.');
  return response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
}
