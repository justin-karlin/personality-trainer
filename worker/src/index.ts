// Cloudflare Worker for the app's AI features. It holds the Anthropic API key so the app never sees it.
//   POST /coach  { goal, situation, challenge?, plan? }  → { plans, needsSupport }
//   POST /review { goal, plans, reflection?, … }         → { summary, changes, needsSupport, tier, escalations }
//   GET  /admin/spend  (Authorization: Bearer ADMIN_TOKEN) → today's spend by route and tier
// It never logs what people send. Each request logs only its route, the breaker's mode,
// which model answered, why smaller ones were skipped, token counts and what it cost.
//
// Without accounts, spending is bounded by: per-minute and per-day limits per client
// network, IPv6 /48 and ASN (network.ts), a 16 KB body limit (body.ts), and a daily spend
// breaker that first caps every request at the cheapest model and then rests the AI until
// tomorrow (spend.ts). Each request reserves its worst case before calling a model, so
// requests in flight can't overshoot the budget. The counters live in one Durable Object
// (limits.ts); while it's unreachable, each worker instance falls back to its own memory
// (isolate.ts), the expensive models stay off, and each instance spends at most a small
// allowance.
import Anthropic from '@anthropic-ai/sdk';
import { BodyTooLarge, readBody } from './body';
import { OUTPUT_SCHEMA, RequestError, SYSTEM, parseRequest, suggestPlans, userMessage } from './coach';
import { IsolateState } from './isolate';
import { limitsClient, type BeginResult, type KeyCap, type LimitsNamespace, type RecordItem, type Route } from './limits';
import { Escalate, LADDER, MAX_OUTPUT_TOKENS, TIERS, escalationsOf, isTier, responseCost, routePlan, worstCaseCost, type Attempt, type Tier } from './models';
import { DEFAULT_NETWORK_SALT, networkHash, networkKey, prefix48 } from './network';
import { REVIEW_SCHEMA, REVIEW_SYSTEM, parseReviewRequest, reviewMessage, reviewWeek } from './review';
import {
  CHEAP_TIER,
  ISOLATE_SHARE,
  RESTING,
  capsFor,
  decideMode,
  estimateInputTokens,
  limitPlan,
  spendConfig,
  utcDay,
  type KeyKind,
  type Mode,
  type SpendConfig,
} from './spend';

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
  /** Dollars per client network per UTC day (default a tenth of DAILY_BUDGET_USD). */
  NETWORK_DAILY_USD?: string;
  /** Crisis-tier calls in cheap mode per client network per UTC day (default 3). */
  NETWORK_DAILY_CRISIS?: string;
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
        pending: dollars(report.pending),
        mode: decideMode(report.spent + report.pending, cfg.budget),
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
  /** This instance's memory (tests pass a fresh one). */
  isolate?: IsolateState;
  /** Request ids (tests pass a fixed one). */
  id?: () => string;
}

const sharedIsolate = new IsolateState();

/** The SDK's automatic retries per call (it retries timeouts, dropped connections, 429 and 5xx). */
const MAX_RETRIES = 1;

function anthropic(env: Env): Anthropic {
  const workspace = env.ANTHROPIC_WORKSPACE_ID?.trim();
  return new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    maxRetries: MAX_RETRIES,
    timeout: 30_000,
    defaultHeaders: workspace ? { 'anthropic-workspace-id': workspace } : undefined,
  });
}

/** The caller's keys with their caps: its network, plus its IPv6 /48 and ASN when known. All salted daily hashes. */
async function clientKeys(request: Request, env: Env, cfg: SpendConfig, day: string): Promise<KeyCap[]> {
  const ip = request.headers.get('CF-Connecting-IP');
  const salt = env.NETWORK_SALT || DEFAULT_NETWORK_SALT;
  const keys: { kind: KeyKind; key: string }[] = [{ kind: 'network', key: networkKey(ip) }];
  const p48 = prefix48(ip);
  if (p48) keys.push({ kind: 'prefix48', key: p48 });
  const asn = (request as { cf?: { asn?: unknown } }).cf?.asn;
  if (typeof asn === 'number' && asn > 0) keys.push({ kind: 'asn', key: `asn:${asn}` });
  return Promise.all(
    // The network's hash is unprefixed (it's also the per-minute limiter's key); others name their kind.
    keys.map(async ({ kind, key }) => ({ hash: await networkHash(kind === 'network' ? key : `${kind}|${key}`, salt, day), ...capsFor(kind, cfg) })),
  );
}

const TOO_LARGE: Record<Route, string> = {
  coach: 'That’s more text than the AI can take. Shorten the situation (under 400 characters) and try again.',
  review: 'That’s more text than the AI can take. Shorten your reflection (each answer under 600 characters) and try again.',
};
export const DEEPER_UNAVAILABLE = 'A more thorough review isn’t available right now. Try again tomorrow.';
const DAILY_LIMIT = 'Daily limit reached for now. Try again tomorrow.';
const BUSY = 'The AI is busy right now. Try again in a few minutes, or carry on without it.';

const tierOf = (model: string) => (Object.keys(TIERS) as Tier[]).find((t) => TIERS[t].model === model);

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
  const isolate = deps.isolate ?? sharedIsolate;

  // One caller = one IPv4 address or IPv6 /64, stored and keyed only as a salted daily hash.
  const day = utcDay(now);
  const cfg = spendConfig(env);
  const keys = await clientKeys(request, env, cfg, day);
  const network = keys[0].hash;
  if (env.LIMITER) {
    const { success } = await env.LIMITER.limit({ key: network });
    if (!success) return json({ error: 'Too many requests. Try again in a minute.' }, 429, headers);
  }

  // Size, then shape, before anything is counted or sent to a model.
  let coachReq: ReturnType<typeof parseRequest> | undefined;
  let reviewReq: ReturnType<typeof parseReviewRequest> | undefined;
  try {
    const text = await readBody(request);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return json({ error: 'Send JSON.' }, 400, headers);
    }
    if (route === 'review') reviewReq = parseReviewRequest(body);
    else coachReq = parseRequest(body);
  } catch (e) {
    if (e instanceof BodyTooLarge) return json({ error: TOO_LARGE[route] }, 413, headers);
    if (e instanceof RequestError) return json({ error: e.message }, 400, headers);
    throw e;
  }

  const capsSig = JSON.stringify(keys.map(({ hash: _h, ...caps }) => caps));
  if (isolate.isOverCap(day, network, capsSig)) return json({ error: DAILY_LIMIT }, 429, headers);
  // The off switch, and a day this instance already knows is spent: answered here, so they
  // hold while the counters are unreachable and a flood on a closed day never reaches them.
  if (!(cfg.budget > 0) || isolate.isSpentOut(day, cfg.budget)) {
    log({ route, rejected: 'closed', local: true });
    return json({ error: RESTING, resting: true }, 503, headers);
  }

  // The route's ladder, and what it could cost at worst in each mode.
  const plan = reviewReq ? reviewPlan(env, reviewReq.depth) : coachPlan(env);
  const prompt = reviewReq
    ? REVIEW_SYSTEM + reviewMessage(reviewReq) + JSON.stringify(REVIEW_SCHEMA)
    : SYSTEM + userMessage(coachReq!) + JSON.stringify(OUTPUT_SCHEMA);
  const inputTokens = estimateInputTokens(prompt);
  const estimates = {
    normal: worstCaseCost([...plan.tiers, ...plan.spare], inputTokens, MAX_OUTPUT_TOKENS),
    cheap: worstCaseCost([CHEAP_TIER], inputTokens, MAX_OUTPUT_TOKENS),
  };

  // One round trip to the counters: decide the mode on spend plus requests in flight,
  // count this request against its keys' caps, and reserve its worst case. If the counters
  // can't be reached, this instance's memory stands in: cheap mode (or closed, if it last
  // saw today closed), local per-key counts, a small dollar allowance, and no crisis-tier calls.
  const limits = limitsClient(env.LIMITS);
  if (!env.LIMITS && !isolate.warnedNoBinding) {
    isolate.warnedNoBinding = true;
    log({ alert: 'limits-binding-missing', effect: 'cheap mode, local caps, no crisis tier' });
  }
  const id = deps.id?.() ?? crypto.randomUUID();
  let gate: BeginResult | undefined;
  try {
    gate = await limits.begin({ day, id, route, budget: cfg.budget, keys, estimates });
    isolate.seen(day, gate.mode, gate.spent, cfg.budget);
  } catch (e) {
    log({ route, breaker: 'unavailable', step: 'begin', error: (e as Error).message });
  }
  const mode: Mode = gate?.mode ?? isolate.modeWhenDown(day);

  // Every Anthropic call's cost, added to the day's totals after the request.
  const calls: { tier: Tier; cost: number; out: number; stop: string | null }[] = [];
  const onResponse = (tier: Tier, response: Anthropic.Beta.BetaMessage) =>
    calls.push({ tier, cost: responseCost(tier, response.usage), out: response.usage?.output_tokens ?? 0, stop: response.stop_reason ?? null });
  const spentHere = () => calls.reduce((t, c) => t + c.cost, 0);
  const attempts: Attempt<unknown>[] = [];
  const done = (extra: Record<string, unknown>) =>
    log({
      route,
      mode,
      ...extra,
      calls: calls.length,
      cost: dollars(spentHere()),
      outputTokens: calls.map((c) => c.out),
      cutoffs: calls.filter((c) => c.stop === 'max_tokens').length,
    });
  const settle = () => {
    // Turned away by the counters: nothing was counted or reserved.
    if (gate && !gate.allowed) return;
    // Sent with the id even when begin seemed to fail: it may have reached the counters
    // and reserved before timing out here, and this settles that reservation.
    const item: RecordItem = {
      day,
      route,
      id,
      calls: calls.map(({ tier, cost }) => ({ tier, cost })),
      // No model answered (all unavailable): the request doesn't use up the network's allowance.
      refund: calls.length === 0,
    };
    const send = async () => {
      const items = [...isolate.takeQueued(), item];
      // Retried once, except a lone item with no gate and no calls (likely turned away here
      // while the counters are slow or down): one try, so a flood doesn't add to their load.
      const tries = gate || items.some((x) => x.calls.length) ? 2 : 1;
      for (let i = 2 - tries; i < 2; i++) {
        try {
          await limits.record(items);
          return;
        } catch (e) {
          if (i === 1) {
            // Only calls are worth keeping: an empty item only settles a reservation, which expires anyway.
            const keep = items.filter((x) => x.calls.length);
            const dropped = isolate.queue(keep);
            log({ route, breaker: 'unavailable', step: 'record', queued: keep.length - dropped, dropped, error: (e as Error).message });
          }
        }
      }
    };
    // After the response when deployed, so recording adds no latency. If it never lands,
    // the reservation expires and counts in full.
    if (ctx) ctx.waitUntil(send());
    else return send();
  };

  try {
    if (gate) {
      if (!gate.allowed && gate.rejected === 'network') {
        isolate.noteOverCap(day, network, capsSig);
        log({ route, rejected: 'network-cap' });
        return json({ error: DAILY_LIMIT }, 429, headers);
      }
    } else if (mode !== 'closed') {
      const local = isolate.admitWhenDown(day, keys, estimates.cheap, cfg.budget * ISOLATE_SHARE);
      if (local === 'network') {
        log({ route, rejected: 'network-cap', local: true });
        return json({ error: DAILY_LIMIT }, 429, headers);
      }
      if (local === 'spent') {
        log({ route, rejected: 'instance-allowance', local: true });
        return json({ error: BUSY }, 503, headers);
      }
    }
    if (mode === 'closed') {
      log({ route, rejected: 'closed', mode });
      return json({ error: RESTING, resting: true }, 503, headers);
    }

    // In cheap mode a "deeper" review would just be Haiku again under another name.
    if (reviewReq?.depth === 'deeper' && mode === 'cheap') {
      done({ depth: 'deeper', rejected: 'deeper-in-cheap-mode' });
      return json({ error: DEEPER_UNAVAILABLE }, 503, headers);
    }
    const sdk = (deps.client ?? anthropic)(env);
    // A call that timed out or lost its connection may still have been answered and billed
    // (and so may the SDK's retry), so it counts as its tier's worst case once per attempt.
    const client = {
      beta: {
        messages: {
          create: async (args: { model: string }, opts?: unknown) => {
            try {
              return await (sdk.beta.messages.create as (a: unknown, o?: unknown) => Promise<unknown>)(args, opts);
            } catch (e) {
              const tier = tierOf(args.model);
              if (e instanceof Anthropic.APIConnectionError && tier) {
                calls.push({ tier, cost: (1 + MAX_RETRIES) * worstCaseCost([tier], inputTokens, MAX_OUTPUT_TOKENS), out: 0, stop: 'no-response' });
              }
              throw e;
            }
          },
        },
      },
    } as unknown as Anthropic;
    const limited = limitPlan(plan, mode);
    if (reviewReq) {
      const crisisTier = limited.crisisTier;
      const crisisEstimate = crisisTier ? worstCaseCost([crisisTier], inputTokens, MAX_OUTPUT_TOKENS) : 0;
      const result = await reviewWeek(
        client,
        reviewReq,
        {
          ...limited,
          attempts,
          // Only reached in cheap mode, for a possible crisis: one more round trip that
          // atomically checks and reserves budget + reserve and the network's caps.
          // If the counters can't confirm it, Haiku's reply stands (it still flags support).
          allowCrisis: async () => {
            if (!gate) {
              log({ route, crisis: 'refused', why: 'counters-unavailable' });
              return false;
            }
            try {
              const r = await limits.crisis({ day, id, spentSoFar: spentHere(), estimate: crisisEstimate, budget: cfg.budget, reserve: cfg.reserve });
              if (!r.allowed) log({ route, crisis: 'refused', why: r.reason });
              return r.allowed;
            } catch (e) {
              log({ route, crisis: 'refused', why: 'counters-unavailable', error: (e as Error).message });
              return false;
            }
          },
        },
        onResponse,
      );
      done({ depth: reviewReq.depth, tier: result.tier, escalations: result.escalations });
      return json(result, 200, headers);
    }
    const { tier, escalations, ...reply } = await suggestPlans(client, coachReq!, { ...limited, attempts }, onResponse);
    done({ tier, escalations });
    return json(reply, 200, headers);
  } catch (e) {
    const failed = { tier: attempts[attempts.length - 1]?.tier, escalations: escalationsOf(attempts) };
    if (e instanceof Escalate) {
      done({ failed: e.reason, ...failed });
      const busy = e.reason === 'error';
      return json({ error: busy ? BUSY : 'The AI couldn’t answer this one. Try again, or carry on without it.' }, busy ? 503 : 502, headers);
    }
    done({ failed: e instanceof Anthropic.APIError ? `api-${e.status ?? 'error'}` : 'other', ...failed });
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'The coach is busy. Try again shortly.' }, 503, headers);
    return json({ error: 'The coach couldn’t answer just now. Try again, or write your plan yourself.' }, 502, headers);
  } finally {
    await settle();
  }
}

export default {
  fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    const response = handle(request, env, ctx);
    // Keep the whole request running if the client disconnects mid-call, so what it spent
    // is recorded and its reservation settled, rather than left to expire at its worst case.
    ctx?.waitUntil(response.catch(() => undefined));
    return response;
  },
};
