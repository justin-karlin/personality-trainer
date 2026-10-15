// Which Claude model runs each feature, and how a request moves up to a bigger one.
// Kept free of Worker globals so the escalation rules can be unit-tested.
import type Anthropic from '@anthropic-ai/sdk';

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
export type EscalationReason = 'refusal' | 'invalid' | 'model-asked' | 'support' | 'error';

export class Escalate extends Error {
  constructor(public reason: EscalationReason, message: string) {
    super(message);
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
 * itself flagged as beyond it). The last tier's answer is accepted even if it asked to
 * escalate, since there's nowhere further to go; a last-tier refusal or invalid reply
 * is an error.
 */
export async function withEscalation<T>(
  tiers: Tier[],
  call: (tier: Tier, isLast: boolean) => Promise<T>,
): Promise<{ result: T; tier: Tier; attempts: Attempt<T>[] }> {
  const attempts: Attempt<T>[] = [];
  for (const [i, tier] of tiers.entries()) {
    const isLast = i === tiers.length - 1;
    try {
      const result = await call(tier, isLast);
      attempts.push({ tier, result });
      return { result, tier, attempts };
    } catch (e) {
      if (!(e instanceof Escalate)) throw e;
      attempts.push({ tier, reason: e.reason, detail: e.message });
      if (isLast) throw e;
    }
  }
  throw new Error('No model tiers configured.');
}

/** Read the text of a response, turning refusals and cut-offs into escalations. */
export function responseText(response: Anthropic.Beta.BetaMessage): string {
  if (response.stop_reason === 'refusal') throw new Escalate('refusal', 'The request was declined.');
  if (response.stop_reason === 'max_tokens') throw new Escalate('invalid', 'The reply was cut off.');
  return response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
}
