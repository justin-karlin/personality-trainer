// The worker's limits end to end: size cap, per-network cap, the spend breaker's modes,
// the crisis reserve, failing closed when the counters are down, cost recording, logs
// and the admin report. Claude and the Durable Object are fakes.
import { afterEach, describe, expect, it, vi } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { fakeLimits, message, scriptedClient, sqliteStore, storeNamespace } from './fakes';
import { handle, type Env } from './index';
import { costOf } from './models';
import { MAX_BODY_BYTES } from './body';
import { RESTING } from './spend';

const ORIGIN = 'https://justin-karlin.github.io';
const NOW = new Date('2026-10-15T12:00:00Z');
const base: Env = { ANTHROPIC_API_KEY: 'k', ALLOWED_ORIGINS: ORIGIN };

const coachBody = { goal: 'C', situation: 'my secret meeting with Alex at 9' };
const plans = {
  plans: [
    { ifThen: 'If the 9am meeting with Alex ends, then I will write the three action items in my notes app.', why: 'Captures commitments.' },
    { ifThen: 'If I sit down at my desk after lunch, then I will start the report for five minutes.', why: 'Starting small.' },
  ],
  needsSupport: false,
};
const week = {
  goal: 'C',
  daysSoFar: 3,
  plans: [{ id: 'p1', title: 'Plan tomorrow', instructions: 'Each evening, choose one task.', ifThen: 'If it is 9pm, then I will write my top task.', target: 5, done: 1, partly: 0, skipped: 1, noChance: 1, noEntry: 0 }],
  reflection: { obstacles: 'Something private and heavy happened this week.' },
};
const review = (o: Record<string, unknown> = {}) => ({ summary: 'You wrote it down once.', changes: [], needsSupport: false, escalate: false, ...o });

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`https://coach.example${path}`, {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'CF-Connecting-IP': '203.0.113.7', ...headers },
  });
}

/** Run one request against fakes; returns the response, what Claude was asked and what the counters saw. */
async function run(req: Request, { env = {}, limits = fakeLimits(), replies = [message(plans)] as unknown[], ctx }: { env?: Partial<Env>; limits?: ReturnType<typeof fakeLimits>; replies?: unknown[]; ctx?: { waitUntil(p: Promise<unknown>): void } } = {}) {
  const claude = scriptedClient(...replies);
  const res = await handle(req, { ...base, LIMITS: limits.ns, ...env }, ctx, { client: () => claude.client, now: () => NOW });
  return { res, body: await res.json().catch(() => null), models: claude.models(), requests: claude.requests, seen: limits.seen };
}

afterEach(() => vi.restoreAllMocks());
const store = await sqliteStore();

describe('request size', () => {
  it('refuses bodies over 16 KB with 413 before parsing, counting or calling Claude', async () => {
    const limits = fakeLimits();
    const big = await run(post('/coach', JSON.stringify({ ...coachBody, pad: 'x'.repeat(MAX_BODY_BYTES) })), { limits });
    expect(big.res.status).toBe(413);
    expect(big.res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(big.models).toEqual([]);
    expect(limits.seen.begins).toEqual([]);
    // Just under the limit is fine.
    const padded = JSON.stringify(coachBody) + ' '.repeat(MAX_BODY_BYTES - JSON.stringify(coachBody).length);
    expect((await run(post('/coach', padded))).res.status).toBe(200);
  });
});

describe('per-network daily cap', () => {
  it('answers 429 once the network has used its requests for the day', async () => {
    const out = await run(post('/coach', coachBody), { limits: fakeLimits({ allowed: false }) });
    expect(out.res.status).toBe(429);
    expect(out.body).toEqual({ error: 'Daily limit reached for now. Try again tomorrow.' });
    expect(out.models).toEqual([]);
  });

  it('counts a salted hash of the network, with the configured cap', async () => {
    const out = await run(post('/coach', coachBody, { 'CF-Connecting-IP': '2001:db8:abcd:12::1' }), { env: { NETWORK_DAILY_CAP: '5', NETWORK_SALT: 's' } });
    const begin = out.seen.begins[0];
    expect(begin).toMatchObject({ day: '2026-10-15', cap: 5 });
    expect(begin.network).toMatch(/^[0-9a-f]{32}$/);
    // Another address in the same /64 is the same network; the raw address is never sent.
    const same = await run(post('/coach', coachBody, { 'CF-Connecting-IP': '2001:db8:abcd:12:ffff::9' }), { env: { NETWORK_SALT: 's' } });
    expect(same.seen.begins[0].network).toBe(begin.network);
    expect(JSON.stringify(out.seen)).not.toContain('2001');
  });

  it('keys the per-minute limiter on the same network hash', async () => {
    const keys: string[] = [];
    const LIMITER = { limit: async ({ key }: { key: string }) => (keys.push(key), { success: true }) };
    const a = await run(post('/coach', coachBody, { 'CF-Connecting-IP': '2001:db8:abcd:12::1' }), { env: { LIMITER } });
    await run(post('/coach', coachBody, { 'CF-Connecting-IP': '2001:db8:abcd:12::2' }), { env: { LIMITER } });
    expect(keys[0]).toBe(keys[1]);
    expect(keys[0]).toBe(a.seen.begins[0].network);
  });
});

describe('spend breaker', () => {
  it('runs the usual ladder below half the budget', async () => {
    const out = await run(post('/coach', coachBody), { env: { COACH_MODEL: 'sonnet' }, limits: fakeLimits({ spent: 0.99 }) });
    expect(out.res.status).toBe(200);
    expect(out.models).toEqual(['claude-sonnet-5-5']);
  });

  it('closes at the budget: 503 with resting, and no call to Claude', async () => {
    const out = await run(post('/review', week), { limits: fakeLimits({ spent: 2 }) });
    expect(out.res.status).toBe(503);
    expect(out.body).toEqual({ error: RESTING, resting: true });
    expect(out.res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(out.models).toEqual([]);
    // A larger budget reopens it.
    expect((await run(post('/coach', coachBody), { env: { DAILY_BUDGET_USD: '5' }, limits: fakeLimits({ spent: 2 }) })).res.status).toBe(200);
  });

  it('caps every ladder at Haiku in cheap mode', async () => {
    const cheap = fakeLimits({ spent: 1 });
    const coach = await run(post('/coach', coachBody), { env: { COACH_MODEL: 'opus' }, limits: cheap });
    expect(coach.models).toEqual(['claude-haiku-5-5']);
    // An invalid reply no longer escalates; the app says the AI couldn't answer.
    const invalid = await run(post('/review', week), { limits: cheap, replies: [message('not json')] });
    expect(invalid.res.status).toBe(502);
    expect(invalid.models).toEqual(['claude-haiku-5-5']);
    // A "deeper" review is capped too.
    const deeper = await run(post('/review', { ...week, depth: 'deeper' }), { limits: cheap, replies: [message(review())] });
    expect(deeper.models).toEqual(['claude-haiku-5-5']);
  });

  it('still sends a possible crisis to the top tier in cheap mode', async () => {
    const support = message(review({ needsSupport: true }));
    const out = await run(post('/review', week), { limits: fakeLimits({ spent: 1.5 }), replies: [support, support] });
    expect(out.res.status).toBe(200);
    expect(out.models).toEqual(['claude-haiku-5-5', 'claude-opus-5-5']);
    expect(out.body).toMatchObject({ tier: 'opus', needsSupport: true, escalations: [{ tier: 'haiku', reason: 'support' }] });
  });

  it('lets crisis replies under way draw on the reserve, and stops when it is used up', async () => {
    // Spent $1.50 at the start. The Haiku call itself costs $0.80 ($2.30: over budget, inside the $0.50 reserve).
    const within = message(review({ needsSupport: true }), { input: 0, output: 1_600_000 });
    const ok = await run(post('/review', week), { limits: fakeLimits({ spent: 1.5 }), replies: [within, message(review({ needsSupport: true }))] });
    expect(ok.models).toEqual(['claude-haiku-5-5', 'claude-opus-5-5']);
    expect(ok.seen.states).toBe(1); // one extra lookup, only for the crisis
    // A $1.10 Haiku call ($2.60) uses up the reserve: Haiku's reply stands, still flagging support.
    const over = message(review({ needsSupport: true }), { input: 0, output: 2_200_000 });
    const stopped = await run(post('/review', week), { limits: fakeLimits({ spent: 1.5 }), replies: [over, message(review({ needsSupport: true }))] });
    expect(stopped.models).toEqual(['claude-haiku-5-5']);
    expect(stopped.body).toMatchObject({ tier: 'haiku', needsSupport: true });
  });

  it('fails closed to cheap mode when the counters are unreachable or missing', async () => {
    const down = await run(post('/coach', coachBody), { env: { COACH_MODEL: 'opus' }, limits: fakeLimits({ fail: true }) });
    expect(down.res.status).toBe(200);
    expect(down.models).toEqual(['claude-haiku-5-5']);
    const claude = scriptedClient(message(plans));
    await handle(post('/coach', coachBody), { ...base, COACH_MODEL: 'sonnet' }, undefined, { client: () => claude.client });
    expect(claude.models()).toEqual(['claude-haiku-5-5']);
    // A possible crisis still reaches the top tier, as in cheap mode.
    const support = message(review({ needsSupport: true }));
    const crisis = await run(post('/review', week), { limits: fakeLimits({ fail: true }), replies: [support, support] });
    expect(crisis.models).toEqual(['claude-haiku-5-5', 'claude-opus-5-5']);
  });
});

describe('cost and logs', () => {
  it('records the actual cost of every call, including ones that escalated', async () => {
    const refused = message({}, { stop: 'refusal', input: 500, output: 10 });
    const out = await run(post('/coach', coachBody), { replies: [refused, message(plans, { input: 1200, output: 400 })] });
    expect(out.models).toEqual(['claude-haiku-5-5', 'claude-sonnet-5-5']);
    expect(out.seen.records).toEqual([
      {
        day: '2026-10-15',
        route: 'coach',
        calls: [
          { tier: 'haiku', cost: costOf('haiku', { input_tokens: 500, output_tokens: 10 }) },
          { tier: 'sonnet', cost: costOf('sonnet', { input_tokens: 1200, output_tokens: 400 }) },
        ],
      },
    ]);
  });

  it('records failed requests too, after the response when deployed', async () => {
    const waits: Promise<unknown>[] = [];
    const out = await run(post('/review', week), {
      env: { REVIEW_MODEL: 'opus' },
      replies: [message('not json')],
      ctx: { waitUntil: (p) => waits.push(p) },
    });
    expect(out.res.status).toBe(502);
    expect(waits).toHaveLength(1);
    await waits[0];
    expect(out.seen.records[0]).toMatchObject({ route: 'review', calls: [{ tier: 'opus' }] });
  });

  it('asks for at most 2000 output tokens', async () => {
    const out = await run(post('/coach', coachBody));
    expect(out.requests[0].max_tokens).toBe(2000);
  });

  it('logs route, mode, tier, escalations and cost, never content', async () => {
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((s: string) => void lines.push(s));
    await run(post('/coach', coachBody), { limits: fakeLimits({ spent: 1.2 }) });
    await run(post('/review', week), { replies: [message(review({ escalate: true })), message(review())] });
    const [coach, rev] = lines.map((l) => JSON.parse(l));
    expect(coach).toMatchObject({ route: 'coach', mode: 'cheap', tier: 'haiku', calls: 1 });
    expect(coach.cost).toBe(Math.round(costOf('haiku', { input_tokens: 1000, output_tokens: 300 }) * 1e6) / 1e6);
    expect(rev).toMatchObject({ route: 'review', mode: 'normal', tier: 'sonnet', escalations: [{ tier: 'haiku', reason: 'model-asked' }], calls: 2 });
    const all = lines.join('\n');
    expect(all).not.toMatch(/secret meeting|private and heavy|203\.0\.113/);
  });

  it("still answers 503 when Anthropic's own rate limit is hit, and counts nothing it wasn't charged", async () => {
    const limited = new Anthropic.RateLimitError(429, undefined, 'Rate limited', new Headers());
    const out = await run(post('/coach', coachBody), { replies: [limited] });
    expect(out.res.status).toBe(503);
    expect(out.seen.records).toEqual([]);
  });
});

describe('admin spend report', () => {
  const get = (token?: string, day?: string) =>
    new Request(`https://coach.example/admin/spend${day ? `?day=${day}` : ''}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

  it("doesn't exist without ADMIN_TOKEN, and needs the token when it does", async () => {
    expect((await handle(get('anything'), base)).status).toBe(404);
    const env = { ...base, ADMIN_TOKEN: 'correct horse', LIMITS: fakeLimits().ns };
    expect((await handle(get(), env)).status).toBe(401);
    expect((await handle(get('wrong'), env)).status).toBe(401);
    expect((await handle(new Request('https://coach.example/admin/spend', { method: 'POST', headers: { Authorization: 'Bearer correct horse' } }), env)).status).toBe(405);
  });

  it.skipIf(!store)("reports the day's spend by route and tier, with the breaker's mode", async () => {
    const ns = storeNamespace(store!);
    const env: Env = { ...base, LIMITS: ns, ADMIN_TOKEN: 't' };
    const claude = scriptedClient(message(plans, { input: 0, output: 2_000_000 })); // $1.00 on Haiku
    const deps = { client: () => claude.client, now: () => NOW };
    expect((await handle(post('/coach', coachBody), env, undefined, deps)).status).toBe(200);
    const res = await handle(get('t'), env, undefined, deps);
    expect(res.status).toBe(200);
    const report = await res.json();
    expect(report).toMatchObject({
      day: '2026-10-15',
      spent: 1,
      budget: 2,
      mode: 'cheap',
      byRoute: { coach: { cost: 1, calls: 1 } },
      byTier: { haiku: { cost: 1, calls: 1 } },
      networks: 1,
      requests: 1,
    });
    expect(JSON.stringify(report)).not.toMatch(/203\.0\.113|secret meeting/);
  });
});
