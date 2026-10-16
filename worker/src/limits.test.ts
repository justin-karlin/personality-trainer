import { describe, expect, it } from 'vitest';
import { sqliteStore, storeNamespace } from './fakes';
import { UNSETTLED, handleLimits, limitsClient, type BeginInput, type KeyCap, type LimitsNamespace, type LimitsStore } from './limits';
import { RESERVATION_TTL_MS } from './spend';

const net = (n: number) => n.toString(16).padStart(32, '0');
const key = (n: number, caps: Partial<KeyCap> = {}): KeyCap => ({ hash: net(n), requests: 40, usd: 1, crises: 3, ...caps });
let ids = 0;
const begin = (s: LimitsStore, o: Partial<BeginInput> = {}) =>
  s.begin({ day: '2026-10-15', id: `id-${String(++ids).padStart(6, '0')}`, route: 'review', budget: 2, keys: [key(1)], estimates: { normal: 0.2, cheap: 0.002 }, ...o });

/** A fresh store with a clock the test controls. */
async function fresh() {
  const clock = { now: 1_000_000 };
  const store = await sqliteStore(() => clock.now);
  return { store: store!, clock };
}
const hasSqlite = !!(await sqliteStore());

describe.skipIf(!hasSqlite)('limits store (SQLite)', () => {
  it('counts requests per network up to the cap, then stops counting', async () => {
    const { store: s } = await fresh();
    const k = [key(1, { requests: 2 })];
    expect(begin(s, { keys: k })).toMatchObject({ mode: 'normal', count: 1, allowed: true });
    expect(begin(s, { keys: k })).toMatchObject({ count: 2, allowed: true });
    expect(begin(s, { keys: k })).toMatchObject({ count: 2, allowed: false, rejected: 'network' });
    expect(begin(s, { keys: [key(2, { requests: 2 })] }).allowed).toBe(true); // another network has its own count
  });

  it('reserves the worst case of requests in flight, so concurrent requests cannot overshoot', async () => {
    const { store: s } = await fresh();
    // $0.40 a request at worst. The mode is decided on spend plus reservations, so the
    // 3rd request sees $0.80 reserved (normal) and the 4th $1.20 (cheap).
    const modes = Array.from({ length: 4 }, (_, i) => begin(s, { keys: [key(10 + i)], estimates: { normal: 0.4, cheap: 0.01 } }).mode);
    expect(modes).toEqual(['normal', 'normal', 'normal', 'cheap']);
    // Hundreds more in flight at once: none of them can push past the budget, because each
    // is decided on what's already reserved.
    const results = Array.from({ length: 300 }, (_, i) => begin(s, { keys: [key(100 + i)], estimates: { normal: 0.4, cheap: 0.01 } }));
    const admitted = results.filter((r) => r.allowed);
    expect(results.at(-1)).toMatchObject({ allowed: false, rejected: 'closed' });
    expect(s.pending('2026-10-15')).toBeLessThan(2 + 0.4);
    expect(admitted.length).toBeLessThan(100);
  });

  it('swaps a reservation for the actual cost when the request is recorded, once', async () => {
    const { store: s } = await fresh();
    const r = begin(s, { id: 'aaaaaaaa-1', estimates: { normal: 0.5, cheap: 0.01 } });
    expect(r.allowed).toBe(true);
    expect(s.pending('2026-10-15')).toBeCloseTo(0.5, 9);
    const item = { day: '2026-10-15', route: 'review' as const, id: 'aaaaaaaa-1', calls: [{ tier: 'haiku' as const, cost: 0.001 }, { tier: 'opus' as const, cost: 0.04 }] };
    s.record([item]);
    expect(s.pending('2026-10-15')).toBe(0);
    expect(s.spent('2026-10-15')).toBeCloseTo(0.041, 9);
    s.record([item]); // a retried record is ignored
    expect(s.spent('2026-10-15')).toBeCloseTo(0.041, 9);
  });

  it('counts a reservation that is never settled in full when it expires', async () => {
    const { store: s, clock } = await fresh();
    begin(s, { id: 'bbbbbbbb-1', estimates: { normal: 0.3, cheap: 0.01 } });
    clock.now += RESERVATION_TTL_MS + 1;
    expect(begin(s, { keys: [key(2)] }).spent).toBeCloseTo(0.3, 9);
    expect(s.report('2026-10-15').rows).toContainEqual({ route: 'review', tier: UNSETTLED, cost: 0.3, calls: 1 });
    // The late record of that request is then skipped, so it isn't counted twice.
    s.record([{ day: '2026-10-15', route: 'review', id: 'bbbbbbbb-1', calls: [{ tier: 'opus', cost: 0.05 }] }]);
    expect(s.spent('2026-10-15')).toBeCloseTo(0.3, 9);
  });

  it("doesn't count requests turned away as closed, so raising the budget reopens the day for everyone", async () => {
    const { store: s } = await fresh();
    s.record([{ day: '2026-10-15', route: 'coach', id: '5eed0001', calls: [{ tier: 'opus', cost: 4 }] }]);
    const k = [key(5, { requests: 3 })];
    for (let i = 0; i < 3; i++) expect(begin(s, { keys: k })).toMatchObject({ allowed: false, rejected: 'closed' });
    expect(begin(s, { keys: k, budget: 10 })).toMatchObject({ allowed: true, count: 1 });
  });

  it('caps dollars per key, and refunds requests no model answered', async () => {
    const { store: s } = await fresh();
    const k = [key(7, { usd: 0.05 })];
    begin(s, { keys: k, id: 'cccccccc-1' });
    s.record([{ day: '2026-10-15', route: 'review', id: 'cccccccc-1', calls: [{ tier: 'opus', cost: 0.06 }] }]);
    expect(begin(s, { keys: k })).toMatchObject({ allowed: false, rejected: 'network' });
    // A coarser key (an IPv6 /48 or an ASN) over its cap turns away a fresh network inside it.
    const group = key(8, { usd: 0.05, requests: null });
    begin(s, { keys: [key(9), group], id: 'cccccccc-2' });
    s.record([{ day: '2026-10-15', route: 'review', id: 'cccccccc-2', calls: [{ tier: 'opus', cost: 0.06 }] }]);
    expect(begin(s, { keys: [key(10), group] })).toMatchObject({ allowed: false, rejected: 'network' });
    // Refund: the network's count goes back down.
    const r = begin(s, { keys: [key(11, { requests: 1 })], id: 'cccccccc-3' });
    expect(r.count).toBe(1);
    s.record([{ day: '2026-10-15', route: 'coach', id: 'cccccccc-3', calls: [], refund: true }]);
    expect(begin(s, { keys: [key(11, { requests: 1 })] }).allowed).toBe(true);
  });

  it('checks and reserves crisis calls atomically against budget + reserve and the per-network crisis cap', async () => {
    const { store: s } = await fresh();
    s.record([{ day: '2026-10-15', route: 'review', id: '5eed0002', calls: [{ tier: 'opus', cost: 1.5 }] }]); // cheap mode
    const crisis = (id: string) => s.crisis({ day: '2026-10-15', id, spentSoFar: 0.001, estimate: 0.2, budget: 2, reserve: 0.5 });
    // Five concurrent crisis reviews from five networks: the reserve fits only some of them.
    const ids = Array.from({ length: 5 }, (_, i) => `dddddddd-${i}`);
    ids.forEach((id, i) => expect(begin(s, { id, keys: [key(20 + i)] }).mode).toBe('cheap'));
    const answers = ids.map((id) => crisis(id));
    expect(answers.filter((a) => a.allowed)).toHaveLength(4); // 1.5 + 5×0.002 reserved, each crisis adds 0.201: 4 fit under 2.5
    expect(answers.at(-1)).toEqual({ allowed: false, reason: 'reserve' });
    expect(s.pending('2026-10-15') + s.spent('2026-10-15')).toBeLessThanOrEqual(2.5);
    // Per network: at most `crises` a day.
    const { store: t } = await fresh();
    const k = [key(30, { crises: 2 })];
    const tries = ['eeeeeeee-1', 'eeeeeeee-2', 'eeeeeeee-3'].map((id) => (begin(t, { id, keys: k }), t.crisis({ day: '2026-10-15', id, spentSoFar: 0, estimate: 0.01, budget: 2, reserve: 0.5 })));
    expect(tries.map((x) => x.allowed)).toEqual([true, true, false]);
    expect(tries[2].reason).toBe('network');
    expect(t.crisis({ day: '2026-10-15', id: 'ffffffff-9', spentSoFar: 0, estimate: 0.01, budget: 2, reserve: 0.5 })).toEqual({ allowed: false, reason: 'unknown-request' });
  });

  it('counts requests in flight toward each key\'s dollar cap: cheap mode while they fill it, no crisis call', async () => {
    const { store: s } = await fresh();
    // $0.20 cap, $0.15 worst case a request: concurrent requests get the full ladder only
    // while the network's dollars plus its reservations are under the cap.
    const k = [key(40, { usd: 0.2, requests: 100 })];
    const est = { normal: 0.15, cheap: 0.002 };
    const results = Array.from({ length: 10 }, (_, i) => begin(s, { keys: k, estimates: est, id: `0000aa00-${i}` }));
    expect(results.every((r) => r.allowed)).toBe(true);
    expect(results.map((r) => r.mode)).toEqual(['normal', 'normal', ...Array(8).fill('cheap')]);
    // At most one request's worst case past the cap (plus Haiku-only reservations).
    expect(s.pending('2026-10-15')).toBeLessThanOrEqual(0.2 + 0.15 + 8 * 0.002 + 1e-9);
    // A crisis call is refused while the key's dollars are taken, though the reserve has room.
    expect(s.crisis({ day: '2026-10-15', id: '0000aa00-9', spentSoFar: 0, estimate: 0.1, budget: 2, reserve: 0.5 })).toEqual({ allowed: false, reason: 'network' });
    // A coarser key (an IPv6 /48) works the same way across its networks.
    const group = key(41, { usd: 0.2, requests: null });
    const modes = [42, 43, 44].map((n) => begin(s, { keys: [key(n), group], estimates: est }).mode);
    expect(modes).toEqual(['normal', 'normal', 'cheap']);
    // Once they settle, the full ladder is back.
    s.record(results.map((r, i) => ({ day: '2026-10-15', route: 'review' as const, id: `0000aa00-${i}`, calls: [{ tier: 'haiku' as const, cost: 0.001 }] })));
    expect(begin(s, { keys: k, estimates: est }).mode).toBe('normal');
  });

  it("counts an expired reservation toward its keys' dollar caps", async () => {
    const { store: s, clock } = await fresh();
    const k = [key(45, { usd: 0.25 })];
    begin(s, { keys: k, estimates: { normal: 0.3, cheap: 0.01 } });
    clock.now += RESERVATION_TTL_MS + 1;
    expect(begin(s, { keys: k })).toMatchObject({ allowed: false, rejected: 'network' });
  });

  it('counts each request id once, whether or not its begin reached the store', async () => {
    const { store: s } = await fresh();
    // Begin never reached the store: the calls count once, however often the record is sent.
    const item = { day: '2026-10-15', route: 'coach' as const, id: '0000bb00-1', calls: [{ tier: 'haiku' as const, cost: 0.01 }] };
    s.record([item]);
    s.record([item]);
    expect(s.spent('2026-10-15')).toBeCloseTo(0.01, 9);
  });

  it('reports requests and networks once each, not once per key', async () => {
    const { store: s } = await fresh();
    begin(s, { keys: [key(50), key(51, { requests: null }), key(52, { requests: null })] }); // an IPv6 network, its /48, its ASN
    begin(s, { keys: [key(53), key(52, { requests: null })] }); // an IPv4 network in the same ASN
    expect(s.report('2026-10-15')).toMatchObject({ networks: 2, requests: 2 });
  });

  it('accepts any budget and reserve, however large', async () => {
    const { store: s } = await fresh();
    const call = async (path: string, body: unknown) => (await handleLimits(s, new Request(`https://limits${path}`, { method: 'POST', body: JSON.stringify(body) }))).status;
    expect(await call('/begin', { day: '2026-10-15', id: '0000cc00-1', route: 'coach', budget: 5000, keys: [key(60)], estimates: { normal: 0.1, cheap: 0.001 } })).toBe(200);
    expect(await call('/crisis', { day: '2026-10-15', id: '0000cc00-1', spentSoFar: 0, estimate: 0.1, budget: 5000, reserve: 2000 })).toBe(200);
  });

  it('adds up spend by route and tier', async () => {
    const { store: s } = await fresh();
    const day = '2026-10-15';
    s.record([
      { day, route: 'review', id: '5eed0003', calls: [{ tier: 'haiku', cost: 0.001 }, { tier: 'opus', cost: 0.04 }] },
      { day, route: 'coach', id: '5eed0004', calls: [{ tier: 'haiku', cost: 0.002 }] },
      { day, route: 'review', id: '5eed0005', calls: [{ tier: 'haiku', cost: 0.001 }] },
    ]);
    expect(s.spent(day)).toBeCloseTo(0.044, 9);
    expect(begin(s, { keys: [key(3)] }).spent).toBeCloseTo(0.044, 9);
    const r = s.report(day);
    expect(r.byRoute.review).toEqual({ cost: expect.closeTo(0.042, 9), calls: 3 });
    expect(r.byTier.haiku).toEqual({ cost: expect.closeTo(0.004, 9), calls: 3 });
    expect(r.rows).toHaveLength(3);
    expect(r.networks).toBe(1);
    expect(r.requests).toBe(1);
    expect(r.pending).toBeCloseTo(0.2, 9);
    expect(JSON.stringify(r)).not.toContain(net(3)); // no hashes leave the object
  });

  it('deletes key counts from before today and spend from before yesterday', async () => {
    const { store: s } = await fresh();
    begin(s, { day: '2026-10-16', id: 'abcdef00-1' });
    s.record([{ day: '2026-10-16', route: 'coach', id: 'abcdef00-1', calls: [{ tier: 'haiku', cost: 0.01 }] }]);
    s.record([{ day: '2026-10-15', route: 'coach', id: '5eed0006', calls: [{ tier: 'haiku', cost: 0.01 }] }]);
    begin(s, { day: '2026-10-17' }); // the first request of a new day cleans up
    expect(s.report('2026-10-15')).toMatchObject({ rows: [], networks: 0, spent: 0 });
    expect(s.report('2026-10-16')).toMatchObject({ networks: 0, spent: 0.01 });
    expect(s.report('2026-10-17').networks).toBe(1);
  });

  it('refuses malformed calls', async () => {
    const { store: s } = await fresh();
    const call = async (path: string, body: unknown) => (await handleLimits(s, new Request(`https://limits${path}`, { method: 'POST', body: JSON.stringify(body) }))).status;
    const ok = { day: '2026-10-17', id: 'abcdef01-1', route: 'coach', budget: 2, keys: [key(1)], estimates: { normal: 0.1, cheap: 0.001 } };
    expect(await call('/begin', ok)).toBe(200);
    expect(await call('/begin', { ...ok, day: 'today' })).toBe(400);
    expect(await call('/begin', { ...ok, keys: [{ ...key(1), hash: '203.0.113.7' }] })).toBe(400);
    expect(await call('/begin', { ...ok, estimates: { normal: -1, cheap: 0 } })).toBe(400);
    expect(await call('/record', { items: [{ day: '2026-10-17', route: 'coach', calls: [{ tier: 'gpt', cost: 1 }] }] })).toBe(400);
    expect(await call('/record', { items: [{ day: '2026-10-17', route: 'coach', calls: [{ tier: 'haiku', cost: -1 }] }] })).toBe(400);
    expect(await call('/record', { items: [{ day: '2026-10-17', route: 'admin', calls: [] }] })).toBe(400);
    expect(await call('/crisis', { day: '2026-10-17', id: 'abcdef01-1', spentSoFar: 0, estimate: 'lots', budget: 2, reserve: 0.5 })).toBe(400);
    expect(await call('/nope', { day: '2026-10-17' })).toBe(404);
  });

  it('is reachable through the client', async () => {
    const { store: s } = await fresh();
    const client = limitsClient(storeNamespace(s));
    expect((await client.begin({ day: '2026-10-18', id: 'abcdef02-1', route: 'coach', budget: 2, keys: [key(9)], estimates: { normal: 0.1, cheap: 0.001 } })).allowed).toBe(true);
    await client.record([{ day: '2026-10-18', route: 'coach', id: 'abcdef02-1', calls: [{ tier: 'sonnet', cost: 0.02 }] }]);
    expect(await client.state('2026-10-18')).toEqual({ spent: expect.closeTo(0.02, 9), pending: 0 });
    expect((await client.report('2026-10-18')).byTier.sonnet.calls).toBe(1);
  });
});

describe('limits client', () => {
  it('fails, rather than hanging or guessing, when the object is missing, erroring or slow', async () => {
    await expect(limitsClient(undefined).state('2026-10-15')).rejects.toThrow(/binding/);
    const erroring: LimitsNamespace = { idFromName: (n) => n, get: () => ({ fetch: async () => new Response('', { status: 500 }) }) };
    await expect(limitsClient(erroring).state('2026-10-15')).rejects.toThrow(/500/);
    const hanging: LimitsNamespace = { idFromName: (n) => n, get: () => ({ fetch: () => new Promise<Response>(() => {}) }) };
    await expect(limitsClient(hanging, 10).state('2026-10-15')).rejects.toThrow(/timed out/);
  });
});
