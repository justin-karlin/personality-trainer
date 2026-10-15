// Cloudflare Worker for the app's AI features. It holds the Anthropic API key so the app never sees it.
//   POST /coach  { goal, situation, challenge?, plan? }  → { plans, needsSupport }
//   POST /review { goal, plans, reflection?, … }         → { summary, changes, needsSupport, tier, escalations }
// It never logs what people send. For /review it logs only which model answered and why
// smaller ones were skipped, so you can see how often escalation happens.
import Anthropic from '@anthropic-ai/sdk';
import { RequestError, parseRequest, suggestPlans } from './coach';
import { Escalate, LADDER, isTier, ladderFrom, type Tier } from './models';
import { parseReviewRequest, reviewWeek } from './review';

export interface Env {
  ANTHROPIC_API_KEY: string;
  /** Comma-separated origins allowed to call the coach. */
  ALLOWED_ORIGINS: string;
  /** Cloudflare rate-limiting binding (see wrangler.toml); optional in local dev. */
  LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
  /** Model for "Help me write this plan": haiku, sonnet or opus (default opus). */
  COACH_MODEL?: string;
  /** First model to try for weekly reviews (default sonnet). */
  REVIEW_MODEL?: string;
  /** Largest model a weekly review may escalate to (default opus). */
  REVIEW_MAX_MODEL?: string;
}

function tierVar(v: string | undefined, fallback: Tier): Tier {
  return isTier(v) ? v : fallback;
}

/** The review's model ladder; a "deeper" review starts one tier up. */
export function reviewTiers(env: Env, depth: 'standard' | 'deeper'): Tier[] {
  const max = tierVar(env.REVIEW_MAX_MODEL, 'opus');
  let start = tierVar(env.REVIEW_MODEL, 'sonnet');
  if (depth === 'deeper') start = LADDER[Math.min(LADDER.indexOf(start) + 1, LADDER.indexOf(max))] ?? start;
  return ladderFrom(start, max);
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const headers = cors(origin, env);
    const url = new URL(request.url);
    if (url.pathname !== '/coach' && url.pathname !== '/review') return json({ error: 'Not found.' }, 404, headers);
    if (request.method === 'OPTIONS') return new Response(null, { status: headers['Access-Control-Allow-Origin'] ? 204 : 403, headers });
    if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405, headers);
    if (!headers['Access-Control-Allow-Origin']) return json({ error: 'Origin not allowed.' }, 403, headers);

    if (env.LIMITER) {
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      const { success } = await env.LIMITER.limit({ key: ip });
      if (!success) return json({ error: 'Too many requests. Try again in a minute.' }, 429, headers);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Send JSON.' }, 400, headers);
    }
    try {
      const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 30_000 });
      if (url.pathname === '/review') {
        const req = parseReviewRequest(body);
        const result = await reviewWeek(client, req, { tiers: reviewTiers(env, req.depth) });
        console.log(JSON.stringify({ route: 'review', depth: req.depth, tier: result.tier, escalations: result.escalations }));
        return json(result, 200, headers);
      }
      const req = parseRequest(body);
      return json(await suggestPlans(client, req, tierVar(env.COACH_MODEL, 'opus')), 200, headers);
    } catch (e) {
      if (e instanceof RequestError) return json({ error: e.message }, 400, headers);
      if (e instanceof Escalate) {
        console.log(JSON.stringify({ route: url.pathname.slice(1), failed: e.reason }));
        return json({ error: 'The reviewer couldn’t answer this week. Try again, or plan it yourself.' }, 502, headers);
      }
      if (e instanceof Anthropic.RateLimitError) return json({ error: 'The coach is busy. Try again shortly.' }, 503, headers);
      return json({ error: 'The coach couldn’t answer just now. Try again, or write your plan yourself.' }, 502, headers);
    }
  },
};
