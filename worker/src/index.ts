// Cloudflare Worker for the app's AI features. It holds the Anthropic API key so the app never sees it.
//   POST /coach  { goal, situation, challenge?, plan? }  → { plans, needsSupport }
//   POST /review { goal, plans, reflection?, … }         → { summary, changes, needsSupport, tier, escalations }
//   GET  /admin/spend  (Authorization: Bearer ADMIN_TOKEN) → today's spend by route and tier
// It never logs what people send. Each request logs only its route, the breaker's mode,
// which model answered, why smaller ones were skipped, and what it cost.
//
// Without accounts, spending is bounded by: a per-minute and a per-day limit per client
// network (network.ts), a 16 KB body limit (body.ts), and a daily spend breaker that
// first caps every request at the cheapest model and then rests the AI until tomorrow
// (spend.ts). The counters live in one Durable Object (limits.ts).
import Anthropic from '@anthropic-ai/sdk';
import { BodyTooLarge, readBody } from './body';
import { RequestError, parseRequest, suggestPlans } from './coach';
import { limitsClient, type BeginResult, type Call, type LimitsNamespace, type Route } from './limits';
import { Escalate, LADDER, costOf, isTier, routePlan, type Tier } from './models';
import { DEFAULT_NETWORK_SALT, networkHash, networkKey } from './network';
import { parseReviewRequest, reviewWeek } from './review';
import { RESTING, crisisAllowed, decideMode, limitPlan, spendConfig, utcDay, type Mode } from './spend';

// Wrangler needs the Durable Object class exported from the main module.
export { Limits } from './limits';

export interface Env {
  ANTHROPIC_API_KEY: string;
  /** Needed only if the API key isn't tied to a workspace (the API then asks which workspace to use). */
  ANTHROPIC_WORKSPACE_ID?: string;
  /** Comma-separated origins allowed to call the coach. */
  ALLOWED_ORIGINS: string;
  /** Cloudflare rate-limiting binding (see wrangler.toml); optional in local dev. */
  LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
  /** The spend and per-network counters (Durable Object). Without it, requests run in cheap mode. */
  LIMITS?: LimitsNamespace;
  /** Dollars per UTC day (default 2). Cheap mode from half of it; closed at all of it. "0" turns the AI off. */
  DAILY_BUDGET_USD?: string;
  /** Extra dollars per day that crisis replies already under way may use beyond the budget (default 0.5). */
  CRISIS_RESERVE_USD?: string;
  /** AI requests per client network per UTC day (default 40). */
  NETWORK_DAILY_CAP?: string;
  /** Secret salt for hashing network keys; see the README. */
  NETWORK_SALT?: string;
  /** Secret token for GET /admin/spend. Unset, the endpoint doesn't exist. */
  ADMIN_TOKEN?: string;
  /** First model to try for "Help me write this plan": haiku, sonnet or opus (default haiku). */
  COACH_MODEL?: string;
  /** Largest model the coach may escalate to (default opus). */
  COACH_MAX_MODEL?: string;
  /** First model to try for weekly reviews (default haiku). */
  REVIEW_MODEL?: string;
  /** Largest model a weekly review may escalate to (default opus). */
  REVIEW_MAX_MODEL?: string;
}

function tierVar(v: string | undefined, fallback: Tier): Tier {
  return isTier(v) ? v : fallback;
}

/** The review's models; a "deeper" review starts one tier up. */
export function reviewPlan(env: Env, depth: 'standard' | 'deeper') {
  const max = tierVar(env.REVIEW_MAX_MODEL, 'opus');
  let start = tierVar(env.REVIEW_MODEL, 'haiku');
  if (depth === 'deeper') start = LADDER[Math.min(LADDER.indexOf(start) + 1, LADDER.indexOf(max))] ?? start;
  return routePlan(start, max);
}

export function coachPlan(env: Env) {
  return routePlan(tierVar(env.COACH_MODEL, 'haiku'), tierVar(env.COACH_MAX_MODEL, 'opus'));
}

function cors(origin: string | null, env: Env): Record<string, string> {
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
  if (!origin || !allowed.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

const log = (o: Record<string, unknown>) => console.log(JSON.stringify(o));

/** Dollars, rounded for logs and the admin report. */
const dollars = (n: number) => Math.round(n * 1e6) / 1e6;

/** Compare secrets in constant time (by hashing both, so lengths don't leak either). */
async function sameSecret(a: string, b: string): Promise<boolean> {
  const hash = async (v: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));
  const [x, y] = await Promise.all([hash(a), hash(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/** GET /admin/spend: today's (or ?day=YYYY-MM-DD, yesterday at most) totals. Numbers only. */
async function adminSpend(request: Request, env: Env, now: Date): Promise<Response> {
  const token = env.ADMIN_TOKEN?.trim();
  if (!token) return json({ error: 'Not found.' }, 404, {});
  if (request.method !== 'GET') return json({ error: 'Use GET.' }, 405, {});
  const given = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!(await sameSecret(given, token))) return json({ error: 'Unauthorized.' }, 401, {});
  const day = new URL(request.url).searchParams.get('day') ?? utcDay(now);
  const cfg = spendConfig(env);
  try {
    const report = await limitsClient(env.LIMITS).report(day);
    return json(
      {
        ...report,
        spent: dollars(report.spent),
        rows: report.rows.map((r) => ({ ...r, cost: dollars(r.cost) })),
        budget: cfg.budget,
        crisisReserve: cfg.reserve,
        networkCap: cfg.networkCap,
        mode: decideMode(report.spent, cfg.budget),
      },
      200,
      {},
    );
  } catch (e) {
    return json({ error: `Spend counters unavailable: ${(e as Error).message}` }, 503, {});
  }
}

export interface Deps {
  /** The Anthropic client (tests pass a fake). */
  client?: (env: Env) => Anthropic;
  now?: () => Date;
}

function anthropic(env: Env): Anthropic {
  const workspace = env.ANTHROPIC_WORKSPACE_ID?.trim();
  return new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    maxRetries: 1,
    timeout: 30_000,
    defaultHeaders: workspace ? { 'anthropic-workspace-id': workspace } : undefined,
  });
}

export async function handle(
  request: Request,
  env: Env,
  ctx?: { waitUntil(promise: Promise<unknown>): void },
  deps: Deps = {},
): Promise<Response> {
  const now = deps.now?.() ?? new Date();
  const url = new URL(request.url);
  if (url.pathname === '/admin/spend') return adminSpend(request, env, now);

  const origin = request.headers.get('Origin');
  const headers = cors(origin, env);
  if (url.pathname !== '/coach' && url.pathname !== '/review') return json({ error: 'Not found.' }, 404, headers);
  if (request.method === 'OPTIONS') return new Response(null, { status: headers['Access-Control-Allow-Origin'] ? 204 : 403, headers });
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405, headers);
  if (!headers['Access-Control-Allow-Origin']) return json({ error: 'Origin not allowed.' }, 403, headers);
  const route: Route = url.pathname === '/review' ? 'review' : 'coach';

  // One caller = one IPv4 address or IPv6 /64, stored and keyed only as a salted daily hash.
  const day = utcDay(now);
  const network = await networkHash(networkKey(request.headers.get('CF-Connecting-IP')), env.NETWORK_SALT || DEFAULT_NETWORK_SALT, day);
  if (env.LIMITER) {
    const { success } = await env.LIMITER.limit({ key: network });
    if (!success) return json({ error: 'Too many requests. Try again in a minute.' }, 429, headers);
  }

  // Size, then shape, before anything is counted or sent to a model.
  let parsed: ReturnType<typeof parseRequest> | ReturnType<typeof parseReviewRequest>;
  try {
    const text = await readBody(request);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return json({ error: 'Send JSON.' }, 400, headers);
    }
    parsed = route === 'review' ? parseReviewRequest(body) : parseRequest(body);
  } catch (e) {
    if (e instanceof BodyTooLarge) return json({ error: 'That request is too large.' }, 413, headers);
    if (e instanceof RequestError) return json({ error: e.message }, 400, headers);
    throw e;
  }

  // One round trip to the counters: count this request against the network's daily cap
  // and read today's spend. If the counters can't be reached, run in cheap mode: the
  // expensive tiers fail closed, but the app keeps working.
  const cfg = spendConfig(env);
  const limits = limitsClient(env.LIMITS);
  let gate: BeginResult | undefined;
  try {
    gate = await limits.begin(day, network, cfg.networkCap);
  } catch (e) {
    log({ route, breaker: 'unavailable', step: 'begin', error: (e as Error).message });
  }
  if (gate && !gate.allowed) {
    log({ route, rejected: 'network-cap' });
    return json({ error: 'Daily limit reached for now. Try again tomorrow.' }, 429, headers);
  }
  const mode: Mode = gate ? decideMode(gate.spent, cfg.budget) : 'cheap';
  if (mode === 'closed') {
    log({ route, rejected: 'closed', mode });
    return json({ error: RESTING, resting: true }, 503, headers);
  }

  // Every Anthropic response's cost, added to the day's totals after the request.
  const calls: Call[] = [];
  const onResponse = (tier: Tier, response: Anthropic.Beta.BetaMessage) =>
    calls.push({ tier, cost: response.usage ? costOf(tier, response.usage) : 0 });
  const spentHere = () => calls.reduce((t, c) => t + c.cost, 0);
  const done = (extra: Record<string, unknown>) =>
    log({ route, mode, ...extra, calls: calls.length, cost: dollars(spentHere()) });

  try {
    const client = (deps.client ?? anthropic)(env);
    if (route === 'review') {
      const req = parsed as ReturnType<typeof parseReviewRequest>;
      const plan = limitPlan(reviewPlan(env, req.depth), mode);
      const result = await reviewWeek(
        client,
        req,
        {
          ...plan,
          // Only reached in cheap mode. A second round trip, but only for a possible crisis.
          allowCrisis: async () => {
            try {
              return crisisAllowed((await limits.spent(day)) + spentHere(), cfg.budget, cfg.reserve);
            } catch {
              return true; // as in cheap mode: a failed lookup doesn't block a crisis reply
            }
          },
        },
        onResponse,
      );
      done({ depth: req.depth, tier: result.tier, escalations: result.escalations });
      return json(result, 200, headers);
    }
    const { tier, ...reply } = await suggestPlans(client, parsed as ReturnType<typeof parseRequest>, limitPlan(coachPlan(env), mode), onResponse);
    done({ tier });
    return json(reply, 200, headers);
  } catch (e) {
    if (e instanceof Escalate) {
      done({ failed: e.reason });
      const busy = e.reason === 'error';
      return json(
        { error: busy ? 'The AI is busy right now. Try again in a few minutes, or carry on without it.' : 'The AI couldn’t answer this one. Try again, or carry on without it.' },
        busy ? 503 : 502,
        headers,
      );
    }
    done({ failed: e instanceof Anthropic.APIError ? `api-${e.status ?? 'error'}` : 'other' });
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'The coach is busy. Try again shortly.' }, 503, headers);
    return json({ error: 'The coach couldn’t answer just now. Try again, or write your plan yourself.' }, 502, headers);
  } finally {
    if (calls.length) {
      const recorded = limits.record(day, route, calls).catch((e: Error) => log({ route, breaker: 'unavailable', step: 'record', error: e.message }));
      // After the response when deployed, so recording adds no latency.
      if (ctx) ctx.waitUntil(recorded);
      else await recorded;
    }
  }
}

export default {
  fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    return handle(request, env, ctx);
  },
};
