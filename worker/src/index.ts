// Cloudflare Worker: POST /coach { goal: "C" | "A", situation } → { plans, needsSupport }.
// Holds the Anthropic API key so the app never sees it. Logs nothing about requests.
import Anthropic from '@anthropic-ai/sdk';
import { RequestError, parseRequest, suggestPlans } from './coach';

export interface Env {
  ANTHROPIC_API_KEY: string;
  /** Comma-separated origins allowed to call the coach. */
  ALLOWED_ORIGINS: string;
  /** Cloudflare rate-limiting binding (see wrangler.toml); optional in local dev. */
  LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
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
    if (url.pathname !== '/coach') return json({ error: 'Not found.' }, 404, headers);
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
      const req = parseRequest(body);
      const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 30_000 });
      return json(await suggestPlans(client, req), 200, headers);
    } catch (e) {
      if (e instanceof RequestError) return json({ error: e.message }, 400, headers);
      if (e instanceof Anthropic.RateLimitError) return json({ error: 'The coach is busy. Try again shortly.' }, 503, headers);
      return json({ error: 'The coach couldn’t answer just now. Try again, or write your plan yourself.' }, 502, headers);
    }
  },
};
