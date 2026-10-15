// The daily spend breaker: how much AI the worker may use, given what today has cost so
// far. Pure functions only; the Durable Object (limits.ts) just stores the numbers, so the
// rules themselves are unit-tested here without a Workers runtime.
import { routePlan, type Tier } from './models';

/**
 * - normal: each route's usual ladder.
 * - cheap: from half the budget, every ladder stops at Haiku, except that a review whose
 *   reply suggests a possible crisis may still go to the route's top tier.
 * - closed: from the full budget, new AI requests are turned away until tomorrow (UTC).
 */
export type Mode = 'normal' | 'cheap' | 'closed';

/** Share of the daily budget at which every ladder is capped at the cheapest model. */
export const CHEAP_FROM = 0.5;
export const CHEAP_TIER: Tier = 'haiku';

export const RESTING = 'The AI is resting until tomorrow. Planning works without it.';

export interface SpendConfig {
  /** Dollars per UTC day before new AI requests are turned away. */
  budget: number;
  /** Extra dollars that crisis replies already under way may use beyond the budget. */
  reserve: number;
  /** AI requests per client network per UTC day. */
  networkCap: number;
}

function numberVar(v: string | undefined, fallback: number): number {
  if (v == null || v.trim() === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Read the limits from wrangler.toml vars; a typo falls back to the default rather than to no limit. */
export function spendConfig(env: { DAILY_BUDGET_USD?: string; CRISIS_RESERVE_USD?: string; NETWORK_DAILY_CAP?: string }): SpendConfig {
  return {
    budget: numberVar(env.DAILY_BUDGET_USD, 2),
    reserve: numberVar(env.CRISIS_RESERVE_USD, 0.5),
    networkCap: Math.floor(numberVar(env.NETWORK_DAILY_CAP, 40)),
  };
}

export function decideMode(spentToday: number, budget: number): Mode {
  // A budget of 0 is the off switch. An unreadable total is treated like a failed lookup:
  // cheap, not open.
  if (!(budget > 0)) return 'closed';
  if (!Number.isFinite(spentToday)) return 'cheap';
  if (spentToday >= budget) return 'closed';
  if (spentToday >= budget * CHEAP_FROM) return 'cheap';
  return 'normal';
}

/**
 * Whether a crisis reply may still go to the top tier. Crisis can only be known after a
 * call, so it's checked mid-request: such replies may use the budget plus the reserve,
 * and stop once the reserve is used up (the person still gets the smaller model's reply
 * and the app's static support links).
 */
export function crisisAllowed(spentToday: number, budget: number, reserve: number): boolean {
  return spentToday < Math.max(0, budget) + Math.max(0, reserve);
}

export interface LimitedPlan {
  tiers: Tier[];
  spare: Tier[];
  /** A tier above the ladder, used only for a reply that suggests a possible crisis. */
  crisisTier?: Tier;
}

/** The route's plan under the breaker's mode. */
export function limitPlan(plan: { tiers: Tier[]; spare: Tier[] }, mode: Mode): LimitedPlan {
  if (mode === 'normal') return plan;
  // No spare tiers either: Haiku being down is no reason to spend more.
  return { ...routePlan(CHEAP_TIER, CHEAP_TIER), crisisTier: plan.tiers[plan.tiers.length - 1] };
}

/** The breaker's day: a UTC date such as 2026-10-15. */
export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** The UTC date `n` days before `day`. */
export function daysBefore(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return utcDay(d);
}
