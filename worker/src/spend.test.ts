import { describe, expect, it } from 'vitest';
import { routePlan } from './models';
import { crisisAllowed, daysBefore, decideMode, limitPlan, spendConfig, utcDay } from './spend';

describe('spend breaker', () => {
  it('runs normally below half the budget, cheaply from half, and closes at the budget', () => {
    expect(decideMode(0, 2)).toBe('normal');
    expect(decideMode(0.999, 2)).toBe('normal');
    expect(decideMode(1, 2)).toBe('cheap');
    expect(decideMode(1.999, 2)).toBe('cheap');
    expect(decideMode(2, 2)).toBe('closed');
    expect(decideMode(7, 2)).toBe('closed');
  });

  it('treats a zero budget as off and an unreadable total as cheap, never open', () => {
    expect(decideMode(0, 0)).toBe('closed');
    expect(decideMode(Number.NaN, 2)).toBe('cheap');
  });

  it('lets crisis replies use the reserve beyond the budget until it is used up', () => {
    expect(crisisAllowed(1.5, 2, 0.5)).toBe(true);
    expect(crisisAllowed(2.2, 2, 0.5)).toBe(true); // over budget, inside the reserve
    expect(crisisAllowed(2.5, 2, 0.5)).toBe(false); // reserve used up
    expect(crisisAllowed(2, 2, 0)).toBe(false); // no reserve: stops at the budget
  });

  it('caps every ladder at Haiku in cheap mode, keeping the top tier for a possible crisis', () => {
    const plan = routePlan('haiku', 'opus');
    expect(limitPlan(plan, 'normal')).toBe(plan);
    expect(limitPlan(plan, 'cheap')).toEqual({ tiers: ['haiku'], spare: [], crisisTier: 'opus' });
    // A "deeper" review (starting on Sonnet) is capped too; the crisis tier is the route's own top.
    expect(limitPlan(routePlan('sonnet', 'opus'), 'cheap')).toEqual({ tiers: ['haiku'], spare: [], crisisTier: 'opus' });
    expect(limitPlan(routePlan('haiku', 'sonnet'), 'cheap').crisisTier).toBe('sonnet');
  });

  it('reads its settings with defaults, and a typo falls back to the default', () => {
    expect(spendConfig({})).toEqual({ budget: 2, reserve: 0.5, networkCap: 40 });
    expect(spendConfig({ DAILY_BUDGET_USD: '5', CRISIS_RESERVE_USD: '1', NETWORK_DAILY_CAP: '100' })).toEqual({ budget: 5, reserve: 1, networkCap: 100 });
    expect(spendConfig({ DAILY_BUDGET_USD: '0' }).budget).toBe(0);
    expect(spendConfig({ DAILY_BUDGET_USD: 'two', CRISIS_RESERVE_USD: '-1', NETWORK_DAILY_CAP: '' })).toEqual({ budget: 2, reserve: 0.5, networkCap: 40 });
  });

  it('keys days by UTC date', () => {
    expect(utcDay(new Date('2026-10-15T23:59:59-07:00'))).toBe('2026-10-16');
    expect(daysBefore('2026-03-01', 1)).toBe('2026-02-28');
    expect(daysBefore('2026-01-01', 2)).toBe('2025-12-30');
  });
});
