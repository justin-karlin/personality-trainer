// The day's counters: AI spend by route and tier, and AI requests per client network.
// One global SQLite-backed Durable Object holds them, so every worker instance sees the
// same totals. It stores numbers and salted hashes only, never content or addresses, and
// deletes old days as it goes. The rules that use these numbers live in spend.ts.
//
// The object speaks plain JSON over fetch (not RPC) so this file needs no Workers-only
// imports and tests can drive the store and the client with fakes.
import { isTier, type Tier } from './models';
import { daysBefore } from './spend';

/** The subset of Durable Object SQL storage the store uses (node:sqlite fits it in tests). */
export interface Sql {
  exec(query: string, ...bindings: (string | number | null)[]): { toArray(): Record<string, unknown>[] };
}

export type Route = 'coach' | 'review';
export interface Call {
  tier: Tier;
  /** Dollars, from costOf(tier, usage). */
  cost: number;
}
export interface BeginResult {
  /** Dollars spent so far today. */
  spent: number;
  /** This network's AI requests today, including this one if allowed. */
  count: number;
  /** False when the network has reached its daily cap (the request isn't counted). */
  allowed: boolean;
}
export interface SpendRow {
  route: string;
  tier: string;
  cost: number;
  calls: number;
}
export interface SpendReport {
  day: string;
  spent: number;
  rows: SpendRow[];
  byRoute: Record<string, { cost: number; calls: number }>;
  byTier: Record<string, { cost: number; calls: number }>;
  /** Distinct networks and AI requests let through today (no addresses or hashes). */
  networks: number;
  requests: number;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class LimitsStore {
  private cleanedFor = '';

  constructor(private sql: Sql) {
    sql.exec(`CREATE TABLE IF NOT EXISTS spend (
      day TEXT NOT NULL, route TEXT NOT NULL, tier TEXT NOT NULL,
      cost REAL NOT NULL DEFAULT 0, calls INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (day, route, tier))`);
    sql.exec(`CREATE TABLE IF NOT EXISTS networks (
      day TEXT NOT NULL, hash TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (day, hash))`);
  }

  /**
   * Drop what's no longer needed, once per day: network counts from before today (they
   * only enforce today's cap) and spend from before yesterday (kept a day for /admin/spend).
   */
  cleanup(day: string): void {
    if (this.cleanedFor === day) return;
    this.sql.exec('DELETE FROM networks WHERE day < ?', day);
    this.sql.exec('DELETE FROM spend WHERE day < ?', daysBefore(day, 1));
    this.cleanedFor = day;
  }

  spent(day: string): number {
    const row = this.sql.exec('SELECT COALESCE(SUM(cost), 0) AS total FROM spend WHERE day = ?', day).toArray()[0];
    return Number(row?.total ?? 0);
  }

  /** Count one AI request for a network, unless it's already at the cap, and return today's spend. */
  begin(day: string, network: string, cap: number): BeginResult {
    this.cleanup(day);
    const row = this.sql.exec('SELECT count FROM networks WHERE day = ? AND hash = ?', day, network).toArray()[0];
    const before = Number(row?.count ?? 0);
    const allowed = before < cap;
    if (allowed) {
      this.sql.exec(
        'INSERT INTO networks (day, hash, count) VALUES (?, ?, 1) ON CONFLICT(day, hash) DO UPDATE SET count = count + 1',
        day,
        network,
      );
    }
    return { spent: this.spent(day), count: allowed ? before + 1 : before, allowed };
  }

  /** Add one request's Anthropic calls to the day's totals. */
  record(day: string, route: Route, calls: Call[]): void {
    for (const c of calls) {
      this.sql.exec(
        `INSERT INTO spend (day, route, tier, cost, calls) VALUES (?, ?, ?, ?, 1)
         ON CONFLICT(day, route, tier) DO UPDATE SET cost = cost + excluded.cost, calls = calls + 1`,
        day,
        route,
        c.tier,
        c.cost,
      );
    }
  }

  report(day: string): SpendReport {
    const rows = this.sql
      .exec('SELECT route, tier, cost, calls FROM spend WHERE day = ? ORDER BY route, tier', day)
      .toArray()
      .map((r) => ({ route: String(r.route), tier: String(r.tier), cost: Number(r.cost), calls: Number(r.calls) }));
    const sum = (key: 'route' | 'tier') =>
      rows.reduce<Record<string, { cost: number; calls: number }>>((acc, r) => {
        const a = (acc[r[key]] ??= { cost: 0, calls: 0 });
        a.cost += r.cost;
        a.calls += r.calls;
        return acc;
      }, {});
    const net = this.sql.exec('SELECT COUNT(*) AS networks, COALESCE(SUM(count), 0) AS requests FROM networks WHERE day = ?', day).toArray()[0];
    return {
      day,
      spent: rows.reduce((t, r) => t + r.cost, 0),
      rows,
      byRoute: sum('route'),
      byTier: sum('tier'),
      networks: Number(net?.networks ?? 0),
      requests: Number(net?.requests ?? 0),
    };
  }
}

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** The object's JSON protocol. Only the worker can reach it; checks guard against our own bugs. */
export async function handleLimits(store: LimitsStore, request: Request): Promise<Response> {
  let b: Record<string, unknown>;
  try {
    b = (await request.json()) as Record<string, unknown>;
  } catch {
    return reply({ error: 'Send JSON.' }, 400);
  }
  const day = String(b?.day ?? '');
  if (!DAY.test(day)) return reply({ error: 'Bad day.' }, 400);
  switch (new URL(request.url).pathname) {
    case '/begin': {
      const network = String(b.network ?? '');
      const cap = Number(b.cap);
      if (!/^[0-9a-f]{8,64}$/.test(network) || !Number.isFinite(cap)) return reply({ error: 'Bad begin.' }, 400);
      return reply(store.begin(day, network, cap));
    }
    case '/record': {
      const route = b.route;
      const calls = Array.isArray(b.calls) ? (b.calls as Call[]) : [];
      if ((route !== 'coach' && route !== 'review') || !calls.every((c) => isTier(c?.tier) && Number.isFinite(c.cost) && c.cost >= 0 && c.cost < 100)) {
        return reply({ error: 'Bad record.' }, 400);
      }
      store.record(day, route, calls);
      return reply({ ok: true });
    }
    case '/state':
      return reply({ spent: store.spent(day) });
    case '/report':
      return reply(store.report(day));
    default:
      return reply({ error: 'Not found.' }, 404);
  }
}

/**
 * The Durable Object itself: a thin wrapper that gives the store its SQLite storage.
 * Each request runs synchronously against storage, so concurrent requests can't race.
 */
export class Limits {
  private store: LimitsStore;
  constructor(ctx: DurableObjectState, _env: unknown) {
    this.store = new LimitsStore(ctx.storage.sql);
  }
  fetch(request: Request): Promise<Response> {
    return handleLimits(this.store, request);
  }
}

/** The binding's shape as the worker uses it (a real DurableObjectNamespace fits). */
export interface LimitsNamespace {
  idFromName(name: string): unknown;
  get(id: never): { fetch(url: string, init?: RequestInit): Promise<Response> };
}

/**
 * The worker's side. Every call has a short timeout: a slow or failing object must not
 * hold up the request, and the caller treats a failure as "cheap mode", never as open.
 */
export function limitsClient(ns: LimitsNamespace | undefined, timeoutMs = 1500) {
  const stub = ns ? ns.get(ns.idFromName('global') as never) : undefined;
  async function call<T>(path: string, body: unknown): Promise<T> {
    if (!stub) throw new Error('No LIMITS binding.');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Limits ${path} timed out.`)), timeoutMs);
    });
    try {
      const res = await Promise.race([
        stub.fetch(`https://limits${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
        timeout,
      ]);
      if (!res.ok) throw new Error(`Limits ${path}: ${res.status}`);
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    begin: (day: string, network: string, cap: number) => call<BeginResult>('/begin', { day, network, cap }),
    record: (day: string, route: Route, calls: Call[]) => call<{ ok: true }>('/record', { day, route, calls }),
    spent: async (day: string) => (await call<{ spent: number }>('/state', { day })).spent,
    report: (day: string) => call<SpendReport>('/report', { day }),
  };
}
export type LimitsClient = ReturnType<typeof limitsClient>;
