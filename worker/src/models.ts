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

/** Dollar cost of one response, from its usage. */
export function costOf(tier: Tier, usage: { input_tokens: number; output_tokens: number }): number {
  const p = TIERS[tier];
  return (usage.input_tokens * p.input + usage.output_tokens * p.output) / 1_000_000;
}

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
): Promise<{ result: T; tier: Tier; attempts: Attempt<T>[] }> {
  const attempts: Attempt<T>[] = [];
  const attempt = async (tier: Tier, isLast: boolean): Promise<T | Escalate> => {
    try {
      const result = await call(tier, isLast);
      attempts.push({ tier, result });
      return result;
    } catch (e) {
      const esc = e instanceof Escalate ? e : isUnavailable(e) ? new Escalate('error', (e as Error).message) : null;
      if (!esc) throw e; // a bug (e.g. a malformed request), not something another model can fix
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

/** Read the text of a response, turning refusals and cut-offs into escalations. */
export function responseText(response: Anthropic.Beta.BetaMessage): string {
  if (response.stop_reason === 'refusal') throw new Escalate('refusal', 'The request was declined.');
  if (response.stop_reason === 'max_tokens') throw new Escalate('invalid', 'The reply was cut off.');
  return response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
}
