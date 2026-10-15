import { describe, expect, it } from 'vitest';
import { sqliteStore, storeNamespace } from './fakes';
import { handleLimits, limitsClient, type LimitsNamespace } from './limits';

const store = await sqliteStore();
const net = (n: number) => n.toString(16).padStart(32, '0');

describe.skipIf(!store)('limits store (SQLite)', () => {
  const s = store!;

  it('counts requests per network up to the cap, then stops counting', () => {
    const day = '2026-10-15';
    expect(s.begin(day, net(1), 2)).toEqual({ spent: 0, count: 1, allowed: true });
    expect(s.begin(day, net(1), 2)).toEqual({ spent: 0, count: 2, allowed: true });
    expect(s.begin(day, net(1), 2)).toEqual({ spent: 0, count: 2, allowed: false });
    expect(s.begin(day, net(2), 2).allowed).toBe(true); // another network has its own count
  });

  it('adds up spend by route and tier', () => {
    const day = '2026-10-15';
    s.record(day, 'review', [{ tier: 'haiku', cost: 0.001 }, { tier: 'opus', cost: 0.04 }]);
    s.record(day, 'coach', [{ tier: 'haiku', cost: 0.002 }]);
    s.record(day, 'review', [{ tier: 'haiku', cost: 0.001 }]);
    expect(s.spent(day)).toBeCloseTo(0.044, 9);
    expect(s.begin(day, net(3), 40).spent).toBeCloseTo(0.044, 9);
    const r = s.report(day);
    expect(r.byRoute.review).toEqual({ cost: expect.closeTo(0.042, 9), calls: 3 });
    expect(r.byTier.haiku).toEqual({ cost: expect.closeTo(0.004, 9), calls: 3 });
    expect(r.rows).toHaveLength(3);
    expect(r.networks).toBe(3);
    expect(r.requests).toBe(4);
    expect(JSON.stringify(r)).not.toContain(net(1)); // no hashes leave the object
  });

  it('deletes network counts from before today and spend from before yesterday', () => {
    s.begin('2026-10-16', net(1), 40);
    s.record('2026-10-16', 'coach', [{ tier: 'haiku', cost: 0.01 }]);
    s.begin('2026-10-17', net(1), 40); // the first request of a new day cleans up
    expect(s.report('2026-10-15')).toMatchObject({ rows: [], networks: 0, spent: 0 });
    expect(s.report('2026-10-16')).toMatchObject({ networks: 0, spent: 0.01 });
    expect(s.report('2026-10-17').networks).toBe(1);
  });

  it('refuses malformed calls', async () => {
    const call = async (path: string, body: unknown) => (await handleLimits(s, new Request(`https://limits${path}`, { method: 'POST', body: JSON.stringify(body) }))).status;
    expect(await call('/begin', { day: 'today', network: net(1), cap: 1 })).toBe(400);
    expect(await call('/begin', { day: '2026-10-17', network: '203.0.113.7', cap: 1 })).toBe(400);
    expect(await call('/record', { day: '2026-10-17', route: 'coach', calls: [{ tier: 'gpt', cost: 1 }] })).toBe(400);
    expect(await call('/record', { day: '2026-10-17', route: 'coach', calls: [{ tier: 'haiku', cost: -1 }] })).toBe(400);
    expect(await call('/record', { day: '2026-10-17', route: 'admin', calls: [] })).toBe(400);
    expect(await call('/nope', { day: '2026-10-17' })).toBe(404);
  });

  it('is reachable through the client', async () => {
    const client = limitsClient(storeNamespace(s));
    expect((await client.begin('2026-10-18', net(9), 40)).allowed).toBe(true);
    await client.record('2026-10-18', 'coach', [{ tier: 'sonnet', cost: 0.02 }]);
    expect(await client.spent('2026-10-18')).toBeCloseTo(0.02, 9);
    expect((await client.report('2026-10-18')).byTier.sonnet.calls).toBe(1);
  });
});

describe('limits client', () => {
  it('fails, rather than hanging or guessing, when the object is missing, erroring or slow', async () => {
    await expect(limitsClient(undefined).spent('2026-10-15')).rejects.toThrow(/binding/);
    const erroring: LimitsNamespace = { idFromName: (n) => n, get: () => ({ fetch: async () => new Response('', { status: 500 }) }) };
    await expect(limitsClient(erroring).spent('2026-10-15')).rejects.toThrow(/500/);
    const hanging: LimitsNamespace = { idFromName: (n) => n, get: () => ({ fetch: () => new Promise<Response>(() => {}) }) };
    await expect(limitsClient(hanging, 10).spent('2026-10-15')).rejects.toThrow(/timed out/);
  });
});
