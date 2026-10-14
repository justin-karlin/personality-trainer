import { describe, expect, it } from 'vitest';
import { analyticsAllowedOn, milestones } from './analytics';
import { emptyState } from './storage';

describe('analytics', () => {
  it('only counts on the published site', () => {
    expect(analyticsAllowedOn('justin-karlin.github.io')).toBe(true);
    expect(analyticsAllowedOn('localhost')).toBe(false);
    expect(analyticsAllowedOn('someone-else.github.io')).toBe(false);
  });

  it('names milestones without sending any values', () => {
    const a = emptyState();
    const b = { ...a, acceptedDisclaimer: true, checkins: { '2026-10-01': { date: '2026-10-01', states: {}, mood: 3 } } } as typeof a;
    const names = milestones(a, b);
    expect(names).toEqual(['started', 'check-in']);
    for (const n of names) expect(n).toMatch(/^[a-z0-9-]+$/);
    expect(milestones(b, b)).toEqual([]);
  });
});
