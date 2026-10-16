// The worker's limits end to end: size cap, per-network caps, the spend breaker's modes,
// reservations for requests in flight, the crisis reserve, failing closed when the
// counters are down, cost recording, logs and the admin report. Claude and the Durable
// Object are fakes (the SQLite-backed tests run the real store on node:sqlite).
import { afterEach, describe, expect, it, vi } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { fakeLimits, message, scriptedClient, sqliteStore, storeNamespace } from './fakes';
import worker, { DEEPER_UNAVAILABLE, handle, type Deps, type Env } from './index';
import { IsolateState } from './isolate';
import { costOf, responseCost, TIERS, worstCaseCost, type Tier } from './models';
import { handleLimits, UNSETTLED, type LimitsNamespace, type LimitsStore } from './limits';
import { MAX_BODY_BYTES } from './body';
import { RESERVATION_TTL_MS, RESTING } from './spend';

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

type RunOpts = { env?: Partial<Env>; limits?: ReturnType<typeof fakeLimits>; replies?: unknown[]; ctx?: { waitUntil(p: Promise<unknown>): void }; isolate?: IsolateState };

/** Run one request against fakes; returns the response, what Claude was asked and what the counters saw. */
async function run(req: Request, { env = {}, limits = fakeLimits(), replies = [message(plans)] as unknown[], ctx, isolate = new IsolateState() }: RunOpts = {}) {
  const claude = scriptedClient(...replies);
  const res = await handle(req, { ...base, LIMITS: limits.ns, ...env }, ctx, { client: () => claude.client, now: () => NOW, isolate });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = (await res.json().catch(() => null)) as any;
  return { res, body, models: claude.models(), requests: claude.requests, seen: limits.seen };
}

/** A client that answers by model, after a short delay so concurrent requests overlap. */
function modelClient(answers: Partial<Record<Tier, () => unknown>>, delayMs = 5) {
  const models: string[] = [];
  const create = async (args: { model: string }) => {
    models.push(args.model);
    await new Promise((r) => setTimeout(r, delayMs));
    const tier = (Object.keys(TIERS) as Tier[]).find((t) => TIERS[t].model === args.model)!;
    const answer = answers[tier]?.();
    if (answer instanceof Error) throw answer;
    return answer;
  };
  return { client: { beta: { messages: { create } } } as unknown as Anthropic, models };
}

afterEach(() => vi.restoreAllMocks());
const hasSqlite = !!(await sqliteStore());

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

  it('says what to shorten', async () => {
    const big = await run(post('/review', { ...week, reflection: { obstacles: 'x'.repeat(17_000) } }));
    expect(big.res.status).toBe(413);
    expect(big.body.error).toMatch(/Shorten your reflection \(each answer under 600 characters\)/);
    expect((await run(post('/coach', { ...coachBody, situation: 'x'.repeat(17_000) }))).body.error).toMatch(/Shorten the situation/);
  });
});

describe('per-network caps', () => {
  it('answers 429 once the network has used its requests for the day', async () => {
    const out = await run(post('/coach', coachBody), { limits: fakeLimits({ allowed: false }) });
    expect(out.res.status).toBe(429);
    expect(out.body).toEqual({ error: 'Daily limit reached for now. Try again tomorrow.' });
    expect(out.models).toEqual([]);
  });

  it('counts a salted hash of the network, with the configured caps', async () => {
    const out = await run(post('/coach', coachBody, { 'CF-Connecting-IP': '2001:db8:abcd:12::1' }), { env: { NETWORK_DAILY_CAP: '5', NETWORK_SALT: 's' } });
    const begin = out.seen.begins[0] as { day: string; keys: { hash: string; requests: number | null; usd: number | null; crises: number | null }[] };
    expect(begin.day).toBe('2026-10-15');
    expect(begin.keys[0]).toMatchObject({ requests: 5, usd: 0.2, crises: 3 });
    expect(begin.keys[0].hash).toMatch(/^[0-9a-f]{32}$/);
    // Another address in the same /64 is the same network; the raw address is never sent.
    const same = await run(post('/coach', coachBody, { 'CF-Connecting-IP': '2001:db8:abcd:12:ffff::9' }), { env: { NETWORK_SALT: 's' } });
    expect((same.seen.begins[0] as typeof begin).keys[0].hash).toBe(begin.keys[0].hash);
    expect(JSON.stringify(out.seen)).not.toContain('2001');
  });

  it('also counts the IPv6 /48 and the ASN, with larger caps', async () => {
    const req = post('/coach', coachBody, { 'CF-Connecting-IP': '2001:db8:abcd:12::1' });
    Object.defineProperty(req, 'cf', { value: { asn: 6939 } });
    const out = await run(req, { env: { NETWORK_SALT: 's' } });
    const keys = (out.seen.begins[0] as { keys: { hash: string; requests: number | null; usd: number | null }[] }).keys;
    expect(keys).toHaveLength(3);
    expect(keys[1]).toMatchObject({ requests: 200, usd: 0.5 }); // the /48
    expect(keys[2]).toMatchObject({ requests: null, usd: 1 }); // the ASN: dollars only
    // A different /64 in the same /48 shares the /48's key.
    const other = await run(post('/coach', coachBody, { 'CF-Connecting-IP': '2001:db8:abcd:ff::1' }), { env: { NETWORK_SALT: 's' } });
    const otherKeys = (other.seen.begins[0] as typeof out.seen.begins[0] & { keys: { hash: string }[] }).keys;
    expect(otherKeys[0].hash).not.toBe(keys[0].hash);
    expect(otherKeys[1].hash).toBe(keys[1].hash);
    expect(JSON.stringify(out.seen)).not.toMatch(/2001|6939/);
  });

  it('keys the per-minute limiter on the same network hash', async () => {
    const keys: string[] = [];
    const LIMITER = { limit: async ({ key }: { key: string }) => (keys.push(key), { success: true }) };
    const a = await run(post('/coach', coachBody, { 'CF-Connecting-IP': '2001:db8:abcd:12::1' }), { env: { LIMITER } });
    await run(post('/coach', coachBody, { 'CF-Connecting-IP': '2001:db8:abcd:12::2' }), { env: { LIMITER } });
    expect(keys[0]).toBe(keys[1]);
    expect(keys[0]).toBe((a.seen.begins[0] as { keys: { hash: string }[] }).keys[0].hash);
  });

  it('turns a network known to be over its cap away without another round trip', async () => {
    const isolate = new IsolateState();
    const limits = fakeLimits({ allowed: false });
    expect((await run(post('/coach', coachBody), { limits, isolate })).res.status).toBe(429);
    const calls = limits.seen.calls;
    expect((await run(post('/coach', coachBody), { limits, isolate })).res.status).toBe(429);
    expect(limits.seen.calls).toBe(calls);
    // A raised cap is asked about again.
    await run(post('/coach', coachBody), { limits, isolate, env: { NETWORK_DAILY_CAP: '80' } });
    expect(limits.seen.calls).toBe(calls + 1);
  });

  it("refunds a request no model answered, so the network's allowance isn't used up", async () => {
    const down = new Anthropic.InternalServerError(529, undefined, 'Overloaded', new Headers());
    const out = await run(post('/coach', coachBody), { replies: [down] });
    expect(out.res.status).toBe(503);
    expect(out.seen.records).toEqual([expect.objectContaining({ calls: [], refund: true })]);
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
    expect(out.seen.records).toEqual([]);
    // A larger budget reopens it.
    expect((await run(post('/coach', coachBody), { env: { DAILY_BUDGET_USD: '5' }, limits: fakeLimits({ spent: 2 }) })).res.status).toBe(200);
  });

  it('reserves the worst case of the ladder for the mode it runs in', async () => {
    const out = await run(post('/review', week), { replies: [message(review())] });
    const { estimates } = out.seen.begins[0] as { estimates: { normal: number; cheap: number } };
    // Haiku + Sonnet + Opus writing 2000 tokens each, plus fallback attempts: well above one Haiku call.
    expect(estimates.normal).toBeGreaterThan(costOf('opus', { input_tokens: 2000, output_tokens: 2000 }) * 2);
    expect(estimates.cheap).toBeLessThan(0.002);
  });

  it('caps every ladder at Haiku in cheap mode', async () => {
    const cheap = fakeLimits({ spent: 1 });
    const coach = await run(post('/coach', coachBody), { env: { COACH_MODEL: 'opus' }, limits: cheap });
    expect(coach.models).toEqual(['claude-haiku-5-5']);
    // An invalid reply no longer escalates; the app says the AI couldn't answer.
    const invalid = await run(post('/review', week), { limits: cheap, replies: [message('not json')] });
    expect(invalid.res.status).toBe(502);
    expect(invalid.models).toEqual(['claude-haiku-5-5']);
  });

  it('says a "deeper" review is unavailable in cheap mode, without calling Claude or using up the allowance', async () => {
    const out = await run(post('/review', { ...week, depth: 'deeper' }), { limits: fakeLimits({ spent: 1 }), replies: [message(review())] });
    expect(out.res.status).toBe(503);
    expect(out.body).toEqual({ error: DEEPER_UNAVAILABLE });
    expect(out.models).toEqual([]);
    expect(out.seen.records).toEqual([expect.objectContaining({ calls: [], refund: true })]);
  });

  it('still sends a possible crisis to the top tier in cheap mode', async () => {
    const support = message(review({ needsSupport: true }));
    const out = await run(post('/review', week), { limits: fakeLimits({ spent: 1.5 }), replies: [support, support] });
    expect(out.res.status).toBe(200);
    expect(out.models).toEqual(['claude-haiku-5-5', 'claude-opus-5-5']);
    expect(out.body).toMatchObject({ tier: 'opus', needsSupport: true, escalations: [{ tier: 'haiku', reason: 'support' }] });
    expect(out.seen.crises).toHaveLength(1);
  });

  it('in cheap mode also sends a week Haiku flagged or refused to the top tier', async () => {
    const flagged = await run(post('/review', week), { limits: fakeLimits({ spent: 1.2 }), replies: [message(review({ escalate: true })), message(review())] });
    expect(flagged.models).toEqual(['claude-haiku-5-5', 'claude-opus-5-5']);
    expect(flagged.body).toMatchObject({ tier: 'opus', escalations: [{ tier: 'haiku', reason: 'model-asked' }] });
    const refused = await run(post('/review', week), { limits: fakeLimits({ spent: 1.2 }), replies: [message({}, { stop: 'refusal' }), message(review({ needsSupport: true }))] });
    expect(refused.res.status).toBe(200);
    expect(refused.models).toEqual(['claude-haiku-5-5', 'claude-opus-5-5']);
    expect(refused.body).toMatchObject({ tier: 'opus', needsSupport: true, escalations: [{ tier: 'haiku', reason: 'refusal' }] });
  });

  it("keeps Haiku's support reply when the crisis call is rate-limited or rejected", async () => {
    const support = message(review({ needsSupport: true }));
    for (const err of [
      new Anthropic.RateLimitError(429, undefined, 'Rate limited', new Headers()),
      new Anthropic.BadRequestError(400, undefined, 'Bad request', new Headers()),
    ]) {
      const out = await run(post('/review', week), { limits: fakeLimits({ spent: 1.2 }), replies: [support, err] });
      expect(out.res.status).toBe(200);
      expect(out.body).toMatchObject({ tier: 'haiku', needsSupport: true, escalations: [{ tier: 'haiku', reason: 'support' }, { tier: 'opus', reason: 'error' }] });
    }
  });

  it('lets crisis replies under way draw on the reserve, and stops when it is used up', async () => {
    // Spent $1.50 at the start. The Haiku call itself costs $0.80 ($2.30: over budget, inside the $0.50 reserve with room for Opus's worst case).
    const within = message(review({ needsSupport: true }), { input: 0, output: 1_600_000 });
    const ok = await run(post('/review', week), { limits: fakeLimits({ spent: 1.5 }), replies: [within, message(review({ needsSupport: true }))] });
    expect(ok.models).toEqual(['claude-haiku-5-5', 'claude-opus-5-5']);
    expect(ok.seen.crises).toHaveLength(1); // one extra round trip, only for the crisis
    expect(ok.seen.crises[0]).toMatchObject({ spentSoFar: 0.8, budget: 2, reserve: 0.5 });
    // A $1.10 Haiku call ($2.60) uses up the reserve: Haiku's reply stands, still flagging support.
    const over = message(review({ needsSupport: true }), { input: 0, output: 2_200_000 });
    const stopped = await run(post('/review', week), { limits: fakeLimits({ spent: 1.5 }), replies: [over, message(review({ needsSupport: true }))] });
    expect(stopped.models).toEqual(['claude-haiku-5-5']);
    expect(stopped.body).toMatchObject({ tier: 'haiku', needsSupport: true });
    // The network's crisis allowance is used up: the same.
    const capped = await run(post('/review', week), { limits: fakeLimits({ spent: 1.5, crisis: { allowed: false, reason: 'network' } }), replies: [message(review({ needsSupport: true }))] });
    expect(capped.models).toEqual(['claude-haiku-5-5']);
    expect(capped.body).toMatchObject({ tier: 'haiku', needsSupport: true });
  });

  it.skipIf(!hasSqlite)('holds the budget against hundreds of concurrent escalating requests', async () => {
    const store = (await sqliteStore())!;
    const env: Env = { ...base, LIMITS: storeNamespace(store) };
    const usage = { input: 2500, output: 2000 };
    const claude = modelClient({ haiku: () => message(review({ escalate: true }), usage), sonnet: () => message(review({ escalate: true }), usage), opus: () => message(review(), usage) });
    const deps: Deps = { client: () => claude.client, now: () => NOW, isolate: new IsolateState() };
    // 300 at once, from 30 IPv4 addresses (10 each: inside the per-minute and the daily request caps).
    const statuses = await Promise.all(
      Array.from({ length: 300 }, (_, i) => handle(post('/review', week, { 'CF-Connecting-IP': `198.51.100.${i % 30}` }), env, undefined, deps).then((r) => r.status)),
    );
    expect(statuses.filter((s) => s === 200).length).toBeGreaterThan(0);
    const report = store.report('2026-10-15');
    expect(report.pending).toBe(0);
    // Without reservations this burst recorded $28; now spend stays within budget + reserve.
    expect(report.spent).toBeLessThanOrEqual(2.5);
    expect(claude.models.filter((m) => m === 'claude-opus-5-5').length).toBeLessThan(60);
  });

  it.skipIf(!hasSqlite)('holds the crisis reserve against hundreds of concurrent crisis reviews in cheap mode', async () => {
    const store = (await sqliteStore())!;
    store.record([{ day: '2026-10-15', route: 'review', id: '5eed0001', calls: [{ tier: 'opus', cost: 1.5 }] }]);
    const env: Env = { ...base, LIMITS: storeNamespace(store) };
    const usage = { input: 5000, output: 2000 };
    const claude = modelClient({ haiku: () => message(review({ needsSupport: true }), usage), opus: () => message(review({ needsSupport: true }), usage) });
    const deps: Deps = { client: () => claude.client, now: () => NOW, isolate: new IsolateState() };
    const statuses = await Promise.all(
      Array.from({ length: 300 }, (_, i) => handle(post('/review', week, { 'CF-Connecting-IP': `2001:db8:${i}::1` }), env, undefined, deps).then((r) => r.status)),
    );
    expect(statuses.every((s) => s === 200 || s === 503)).toBe(true);
    expect(store.report('2026-10-15').spent).toBeLessThanOrEqual(2.5);
    expect(claude.models.filter((m) => m === 'claude-opus-5-5').length).toBeLessThan(20);
  });
});

describe('when the counters are down', () => {
  it('runs in cheap mode with no crisis tier, and caps each network in memory', async () => {
    const isolate = new IsolateState();
    const limits = fakeLimits({ fail: true });
    const down = await run(post('/coach', coachBody), { env: { COACH_MODEL: 'opus' }, limits, isolate });
    expect(down.res.status).toBe(200);
    expect(down.models).toEqual(['claude-haiku-5-5']);
    // A possible crisis keeps Haiku's reply (it flags support): the reserve can't be checked.
    const support = message(review({ needsSupport: true }));
    const crisis = await run(post('/review', week), { limits, isolate, replies: [support, support] });
    expect(crisis.res.status).toBe(200);
    expect(crisis.models).toEqual(['claude-haiku-5-5']);
    expect(crisis.body).toMatchObject({ tier: 'haiku', needsSupport: true });
    // The daily cap still holds, per worker instance.
    const env = { NETWORK_DAILY_CAP: '2' };
    const capped = await run(post('/coach', coachBody), { limits, isolate, env });
    expect(capped.res.status).toBe(429);
    const other = await run(post('/coach', coachBody, { 'CF-Connecting-IP': '192.0.2.1' }), { limits, isolate, env });
    expect(other.res.status).toBe(200);
  });

  it('refuses the crisis tier when only the crisis check fails', async () => {
    const support = message(review({ needsSupport: true }));
    const out = await run(post('/review', week), { limits: fakeLimits({ spent: 1.5, failPaths: ['/crisis'] }), replies: [support, support] });
    expect(out.models).toEqual(['claude-haiku-5-5']);
    expect(out.body).toMatchObject({ tier: 'haiku', needsSupport: true });
  });

  it('stays closed if this instance last saw the day closed', async () => {
    const isolate = new IsolateState();
    expect((await run(post('/coach', coachBody), { limits: fakeLimits({ spent: 3 }), isolate })).res.status).toBe(503);
    const out = await run(post('/coach', coachBody), { limits: fakeLimits({ fail: true }), isolate });
    expect(out.res.status).toBe(503);
    expect(out.body).toEqual({ error: RESTING, resting: true });
    expect(out.models).toEqual([]);
  });

  it('runs without the binding, logging one alert', async () => {
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((s: string) => void lines.push(s));
    const claude = scriptedClient(message(plans));
    const isolate = new IsolateState();
    await handle(post('/coach', coachBody), { ...base, COACH_MODEL: 'sonnet' }, undefined, { client: () => claude.client, isolate });
    await handle(post('/coach', coachBody), { ...base, COACH_MODEL: 'sonnet' }, undefined, { client: () => claude.client, isolate });
    expect(claude.models()).toEqual(['claude-haiku-5-5', 'claude-haiku-5-5']);
    expect(lines.filter((l) => l.includes('limits-binding-missing'))).toHaveLength(1);
  });

  it('retries a failed record, then keeps it for the next one', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const isolate = new IsolateState();
    const failing = fakeLimits({ failPaths: ['/record'] });
    await run(post('/coach', coachBody), { limits: failing, isolate });
    expect(failing.seen.records).toEqual([]);
    const working = fakeLimits();
    await run(post('/coach', coachBody), { limits: working, isolate });
    expect(working.seen.records).toHaveLength(2);
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
        id: expect.any(String),
        refund: false,
        calls: [
          { tier: 'haiku', cost: costOf('haiku', { input_tokens: 500, output_tokens: 10 }) },
          { tier: 'sonnet', cost: costOf('sonnet', { input_tokens: 1200, output_tokens: 400 }) },
        ],
      },
    ]);
  });

  it('prices every attempt of a server-side fallback by the model that ran it', async () => {
    // Opus 5.5 declined part-way (billed), then Opus 5 answered at its own, higher price.
    const iterations = [
      { type: 'message', model: null, input_tokens: 3000, output_tokens: 900, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      { type: 'fallback_message', model: 'claude-opus-5', input_tokens: 3000, output_tokens: 700, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    ];
    const reply = message(review(), { input: 3000, output: 700, iterations });
    const expected = (3000 * 4 + 900 * 20 + 3000 * 5 + 700 * 25) / 1e6;
    expect(responseCost('opus', reply.usage)).toBeCloseTo(expected, 12);
    expect(responseCost('opus', reply.usage)).toBeGreaterThan(costOf('opus', reply.usage) * 1.9);
    // An unknown model is priced at the highest rate.
    expect(responseCost('opus', { input_tokens: 0, output_tokens: 0, iterations: [{ type: 'fallback_message', model: 'claude-new-9', input_tokens: 0, output_tokens: 1_000_000 }] })).toBe(50);
    const out = await run(post('/review', week), { env: { REVIEW_MODEL: 'opus' }, replies: [reply] });
    expect((out.seen.records[0] as { calls: { cost: number }[] }).calls[0].cost).toBeCloseTo(expected, 12);
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

  it('asks for at most 2000 output tokens, on both routes', async () => {
    const out = await run(post('/coach', coachBody));
    expect(out.requests[0].max_tokens).toBe(2000);
    const rev = await run(post('/review', week), { replies: [message(review())] });
    expect(rev.requests[0].max_tokens).toBe(2000);
  });

  it('logs route, mode, tier, escalations, tokens and cost, never content', async () => {
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((s: string) => void lines.push(s));
    await run(post('/coach', coachBody), { limits: fakeLimits({ spent: 1.2 }) });
    await run(post('/review', week), { replies: [message(review({ escalate: true })), message(review())] });
    await run(post('/coach', coachBody), { replies: [message({}, { stop: 'refusal' }), message(plans, { output: 2000, stop: 'max_tokens' }), message(plans)] });
    await run(post('/review', week), { replies: [message('not json'), message('not json'), message('not json')] });
    const [coach, rev, coachEsc, failed] = lines.map((l) => JSON.parse(l));
    expect(coach).toMatchObject({ route: 'coach', mode: 'cheap', tier: 'haiku', escalations: [], calls: 1, outputTokens: [300], cutoffs: 0 });
    expect(coach.cost).toBe(Math.round(costOf('haiku', { input_tokens: 1000, output_tokens: 300 }) * 1e6) / 1e6);
    expect(rev).toMatchObject({ route: 'review', mode: 'normal', tier: 'sonnet', escalations: [{ tier: 'haiku', reason: 'model-asked' }], calls: 2 });
    expect(coachEsc).toMatchObject({ route: 'coach', tier: 'opus', escalations: [{ tier: 'haiku', reason: 'refusal' }, { tier: 'sonnet', reason: 'invalid' }], cutoffs: 1 });
    expect(failed).toMatchObject({
      route: 'review',
      failed: 'invalid',
      tier: 'opus',
      escalations: [{ tier: 'haiku', reason: 'invalid' }, { tier: 'sonnet', reason: 'invalid' }, { tier: 'opus', reason: 'invalid' }],
      calls: 3,
    });
    const all = lines.join('\n');
    expect(all).not.toMatch(/secret meeting|private and heavy|203\.0\.113/);
  });

  it("still answers 503 when Anthropic's own rate limit is hit, and counts nothing it wasn't charged", async () => {
    const limited = new Anthropic.RateLimitError(429, undefined, 'Rate limited', new Headers());
    const out = await run(post('/coach', coachBody), { replies: [limited] });
    expect(out.res.status).toBe(503);
    expect(out.seen.records).toEqual([expect.objectContaining({ calls: [] })]);
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

  it.skipIf(!hasSqlite)("reports the day's spend by route and tier, with the breaker's mode", async () => {
    const store = (await sqliteStore())!;
    const env: Env = { ...base, LIMITS: storeNamespace(store), ADMIN_TOKEN: 't' };
    const claude = scriptedClient(message(plans, { input: 0, output: 2_000_000 })); // $1.00 on Haiku
    const deps = { client: () => claude.client, now: () => NOW, isolate: new IsolateState() };
    expect((await handle(post('/coach', coachBody), env, undefined, deps)).status).toBe(200);
    const res = await handle(get('t'), env, undefined, deps);
    expect(res.status).toBe(200);
    const report = await res.json();
    expect(report).toMatchObject({
      day: '2026-10-15',
      spent: 1,
      pending: 0,
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


/** A namespace on `store` whose calls can land and then fail, as a timeout on the worker would look. */
function flaky(store: LimitsStore, fail: (path: string, n: number) => 'before' | 'after' | undefined): LimitsNamespace {
  const n: Record<string, number> = {};
  return {
    idFromName: (name) => name,
    get: () => ({
      async fetch(url, init) {
        const path = new URL(url).pathname;
        n[path] = (n[path] ?? 0) + 1;
        const how = fail(path, n[path]);
        if (how === 'before') throw new Error(`Limits ${path} timed out.`);
        const res = await handleLimits(store, new Request(url, init));
        if (how === 'after') throw new Error(`Limits ${path} timed out.`);
        return res;
      },
    }),
  };
}

describe('second review: accounting', () => {
  it.skipIf(!hasSqlite)("holds a network's dollar cap against concurrent requests", async () => {
    const store = (await sqliteStore())!;
    const env: Env = { ...base, LIMITS: storeNamespace(store) };
    const usage = { input: 2500, output: 2000 };
    // Each review's Haiku reply flags support, which sends it to Opus at 2000 tokens.
    const claude = modelClient({ haiku: () => message(review({ needsSupport: true }), usage), opus: () => message(review({ needsSupport: true }), usage) });
    const deps: Deps = { client: () => claude.client, now: () => NOW, isolate: new IsolateState() };
    const statuses = await Promise.all(Array.from({ length: 10 }, () => handle(post('/review', week), env, undefined, deps).then((r) => r.status)));
    expect(statuses.every((st) => st === 200)).toBe(true);
    // Before: all 10 went to Opus, $0.51 against the $0.20 cap. Now the first takes the
    // network's dollars until it settles; the rest run on Haiku (support flag kept).
    expect(claude.models.filter((m) => m === 'claude-opus-5-5')).toHaveLength(1);
    expect(store.report('2026-10-15').spent).toBeLessThan(0.2);
  });

  it.skipIf(!hasSqlite)('settles a reservation whose begin reached the counters but timed out here', async () => {
    const clock = { now: NOW.getTime() };
    const store = (await sqliteStore(() => clock.now))!;
    const env: Env = { ...base, LIMITS: flaky(store, (path) => (path === '/begin' ? 'after' : undefined)) };
    const claude = scriptedClient(message(review()));
    const res = await handle(post('/review', week), env, undefined, { client: () => claude.client, now: () => NOW, isolate: new IsolateState() });
    expect(res.status).toBe(200);
    clock.now += RESERVATION_TTL_MS + 1;
    const report = store.report('2026-10-15');
    // Only the Haiku call: no worst-case 'unsettled' charge on top of it.
    expect(report.spent).toBeCloseTo(costOf('haiku', { input_tokens: 1000, output_tokens: 300 }), 9);
    expect(report.rows.map((r) => r.tier)).not.toContain(UNSETTLED);
  });

  it.skipIf(!hasSqlite)('counts a record that landed but timed out once, though it was sent again', async () => {
    const store = (await sqliteStore())!;
    const env: Env = { ...base, LIMITS: flaky(store, (path, n) => (path === '/begin' ? 'before' : path === '/record' && n === 1 ? 'after' : undefined)) };
    const claude = scriptedClient(message(plans));
    await handle(post('/coach', coachBody), env, undefined, { client: () => claude.client, now: () => NOW, isolate: new IsolateState() });
    expect(store.spent('2026-10-15')).toBeCloseTo(costOf('haiku', { input_tokens: 1000, output_tokens: 300 }), 9);
  });

  it.skipIf(!hasSqlite)('retries a record that failed once, and keeps nothing queued once it lands', async () => {
    const store = (await sqliteStore())!;
    const env: Env = { ...base, LIMITS: flaky(store, (path, n) => (path === '/record' && n === 1 ? 'before' : undefined)) };
    const isolate = new IsolateState();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await handle(post('/coach', coachBody), env, undefined, { client: () => scriptedClient(message(plans)).client, now: () => NOW, isolate });
    expect(store.spent('2026-10-15')).toBeCloseTo(costOf('haiku', { input_tokens: 1000, output_tokens: 300 }), 9);
    expect(isolate.takeQueued()).toEqual([]);
  });

  it('counts a call that timed out at its worst case, for each attempt, and refunds nothing', async () => {
    const timeout = new Anthropic.APIConnectionTimeoutError();
    const support = message(review({ needsSupport: true }));
    const out = await run(post('/review', week), { replies: [support, timeout] });
    expect(out.res.status).toBe(200);
    const calls = (out.seen.records[0] as { calls: { tier: Tier; cost: number }[]; refund: boolean }).calls;
    expect(calls.map((c) => c.tier)).toEqual(['haiku', 'opus']);
    expect(calls[1].cost).toBeGreaterThan(2 * worstCaseCost(['opus'], 0, 2000));
    const coach = await run(post('/coach', coachBody), { replies: [timeout] });
    expect(coach.res.status).toBe(503);
    expect(coach.seen.records[0]).toMatchObject({ refund: false, calls: [{ tier: 'haiku' }, { tier: 'sonnet' }, { tier: 'opus' }] });
  });

  it('keeps running when the client disconnects, so the request is recorded', async () => {
    const waits: Promise<unknown>[] = [];
    const ctx = { waitUntil: (p: Promise<unknown>) => void waits.push(p), passThroughOnException() {}, props: {} } as unknown as ExecutionContext;
    const res = worker.fetch(new Request('https://coach.example/nope'), base, ctx);
    expect(waits).toHaveLength(1); // registered at once, before any model call
    expect((await res).status).toBe(404);
  });
});

describe('second review: safety', () => {
  it('in cheap mode sends a reply that flags support but fails the checks to the top tier, and keeps it if refused', async () => {
    const bad = message(review({ needsSupport: true, summary: 'That sounds frightening.', changes: [{ planId: 'p1', kind: 'adjust', ifThen: '', target: 9, why: 'x' }] }));
    const sent = await run(post('/review', week), { limits: fakeLimits({ spent: 1.2 }), replies: [bad, message(review({ needsSupport: true }))] });
    expect(sent.res.status).toBe(200);
    expect(sent.models).toEqual(['claude-haiku-5-5', 'claude-opus-5-5']);
    expect(sent.body).toMatchObject({ tier: 'opus', needsSupport: true });
    const refused = await run(post('/review', week), { limits: fakeLimits({ spent: 1.2, crisis: { allowed: false, reason: 'network' } }), replies: [bad] });
    expect(refused.res.status).toBe(200);
    expect(refused.body).toMatchObject({ tier: 'haiku', needsSupport: true, changes: [], summary: 'That sounds frightening.' });
  });
});

describe('second review: abuse', () => {
  it('turns the AI off with DAILY_BUDGET_USD = "0" even when the counters are unreachable or missing', async () => {
    for (const limits of [fakeLimits({ fail: true }), undefined]) {
      const out = await run(post('/coach', coachBody), { env: { DAILY_BUDGET_USD: '0', LIMITS: limits?.ns }, limits: limits ?? fakeLimits() });
      expect(out.res.status).toBe(503);
      expect(out.body).toEqual({ error: RESTING, resting: true });
      expect(out.models).toEqual([]);
    }
  });

  it('while the counters are down, bounds each instance in dollars and caps an IPv6 /48 too', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const isolate = new IsolateState();
    const limits = fakeLimits({ fail: true });
    const statuses: number[] = [];
    for (let i = 0; i < 300; i++) statuses.push((await run(post('/review', week, { 'CF-Connecting-IP': `2001:db8:1:${i.toString(16)}::1` }), { limits, isolate, replies: [message(review())] })).res.status);
    const ok = statuses.filter((st) => st === 200).length;
    // A tenth of the $2 budget at Haiku's worst case (about $0.0016 a review).
    expect(ok).toBeGreaterThan(50);
    expect(ok).toBeLessThan(130);
    expect(statuses.slice(ok)).toEqual(Array(300 - ok).fill(503));
    // A request turned away here costs the unreachable counters one record try, not two.
    const spentOut = fakeLimits({ fail: true });
    const rejected = await run(post('/review', week), { limits: spentOut, isolate: new IsolateState(), env: { DAILY_BUDGET_USD: '0.001' } });
    expect(rejected.res.status).toBe(503);
    expect(spentOut.seen.calls).toBe(2); // begin, then one record
    // The /48's request cap (5× a network's) holds locally as well.
    const fresh = new IsolateState();
    const env = { NETWORK_DAILY_CAP: '2' };
    const capped: number[] = [];
    for (let i = 0; i < 11; i++) capped.push((await run(post('/coach', coachBody, { 'CF-Connecting-IP': `2001:db8:2:${i}::1` }), { limits, isolate: fresh, env })).res.status);
    expect(capped).toEqual([...Array(10).fill(200), 429]);
  });

  it('answers a day this instance knows is spent without asking the counters, until the budget is raised', async () => {
    const isolate = new IsolateState();
    expect((await run(post('/coach', coachBody), { limits: fakeLimits({ spent: 3 }), isolate })).res.status).toBe(503);
    const again = fakeLimits();
    const out = await run(post('/coach', coachBody), { limits: again, isolate });
    expect(out.res.status).toBe(503);
    expect(again.seen.calls).toBe(0);
    expect((await run(post('/coach', coachBody), { limits: again, isolate, env: { DAILY_BUDGET_USD: '5' } })).res.status).toBe(200);
  });

  it.skipIf(!hasSqlite)('keeps the shared counters with a budget of $1000 or more', async () => {
    const store = (await sqliteStore())!;
    const env: Env = { ...base, LIMITS: storeNamespace(store), DAILY_BUDGET_USD: '1000', CRISIS_RESERVE_USD: '1000' };
    expect((await handle(post('/coach', coachBody), env, undefined, { client: () => scriptedClient(message(plans)).client, now: () => NOW, isolate: new IsolateState() })).status).toBe(200);
    expect(store.report('2026-10-15').requests).toBe(1);
  });
});
