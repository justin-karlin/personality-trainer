// The day's counters: AI spend by route and tier, reservations for requests in flight,
// and AI requests and dollars per client key (network, IPv6 /48, ASN). One global
// SQLite-backed Durable Object holds them, so every worker instance sees the same totals.
// It stores numbers and salted hashes only, never content or addresses, and deletes old
// days as it goes. The rules that use these numbers live in spend.ts.
//
// Requests in flight are bounded too: before calling a model, a request reserves the
// worst case of its ladder, and the breaker decides on spend *plus* reservations. When
// the request finishes, its actual cost replaces the reservation. A reservation that is
// never settled (the worker died, or the record call failed) expires and counts in full.
// Each request id is counted once, so a retried or late record can't count twice.
//
// The object speaks plain JSON over fetch (not RPC) so this file needs no Workers-only
// imports and tests can drive the store and the client with fakes.
import { isTier, type Tier } from './models';
import { RESERVATION_TTL_MS, crisisAllowed, daysBefore, decideMode, type Caps, type Mode } from './spend';

/** The subset of Durable Object SQL storage the store uses (node:sqlite fits it in tests). */
export interface Sql {
  exec(query: string, ...bindings: (string | number | null)[]): { toArray(): Record<string, unknown>[] };
}

export type Route = 'coach' | 'review';
export interface Call {
  tier: Tier;
  /** Dollars, from responseCost(tier, usage). */
  cost: number;
}

/** A client key (salted hash) and its daily caps. */
export interface KeyCap extends Caps {
  hash: string;
}

export interface BeginInput {
  day: string;
  /** A fresh id for this request; settles its reservation later. */
  id: string;
  route: Route;
  budget: number;
  /** The caller's keys; the first is its network, the rest coarser groupings. */
  keys: KeyCap[];
  /** Worst-case dollars for the request's ladder in each mode. */
  estimates: { normal: number; cheap: number };
}
export interface BeginResult {
  mode: Mode;
  /** Dollars recorded today. */
  spent: number;
  /** Spent plus reservations for requests in flight (before this one). */
  committed: number;
  /** False when closed or a key is over a cap; nothing is counted or reserved then. */
  allowed: boolean;
  rejected?: 'closed' | 'network';
  /** This network's AI requests today, including this one if allowed. */
  count: number;
}

export interface CrisisInput {
  day: string;
  id: string;
  /** What this request's calls have cost so far. */
  spentSoFar: number;
  /** Worst case of the crisis call. */
  estimate: number;
  budget: number;
  reserve: number;
}
export interface CrisisResult {
  allowed: boolean;
  reason?: 'reserve' | 'network' | 'unknown-request';
}

export interface RecordItem {
  day: string;
  route: Route;
  /**
   * The request's id from begin. Sent even when begin seemed to fail: a begin that timed
   * out on the worker may still have reserved, and this settles it.
   */
  id: string;
  calls: Call[];
  /** No model answered: don't count the request against its keys' daily caps. */
  refund?: boolean;
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
  /** Reservations for requests in flight right now. */
  pending: number;
  rows: SpendRow[];
  byRoute: Record<string, { cost: number; calls: number }>;
  byTier: Record<string, { cost: number; calls: number }>;
  /** Distinct client networks and AI requests let through today (no addresses or hashes). */
  networks: number;
  requests: number;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const HASH = /^[0-9a-f]{8,64}$/;
const ID = /^[0-9a-f-]{8,64}$/;

/** Reservations that expire unsettled are recorded under this tier name. */
export const UNSETTLED = 'unsettled';

type StoredKey = { hash: string; crises: number | null; usd: number | null };

export class LimitsStore {
  private cleanedFor = '';

  constructor(
    private sql: Sql,
    private clock: () => number = Date.now,
  ) {
    sql.exec(`CREATE TABLE IF NOT EXISTS spend (
      day TEXT NOT NULL, route TEXT NOT NULL, tier TEXT NOT NULL,
      cost REAL NOT NULL DEFAULT 0, calls INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (day, route, tier))`);
    // network = 1 marks a client network's own row (its first key), as opposed to its IPv6
    // /48 or ASN, so the report counts each request once.
    sql.exec(`CREATE TABLE IF NOT EXISTS networks (
      day TEXT NOT NULL, hash TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0,
      cost REAL NOT NULL DEFAULT 0, crises INTEGER NOT NULL DEFAULT 0,
      network INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (day, hash))`);
    sql.exec(`CREATE TABLE IF NOT EXISTS pending (
      id TEXT PRIMARY KEY, day TEXT NOT NULL, route TEXT NOT NULL,
      amount REAL NOT NULL, expires INTEGER NOT NULL, keys TEXT NOT NULL)`);
    // Request ids already counted (settled, or expired in full), so each is counted once.
    sql.exec(`CREATE TABLE IF NOT EXISTS settled (id TEXT PRIMARY KEY, day TEXT NOT NULL)`);
  }

  /**
   * Count expired reservations as spent (in full, since their real cost is unknown), and
   * once per day drop what's no longer needed: key counts from before today (they only
   * enforce today's caps) and spend from before yesterday (kept a day for /admin/spend).
   */
  cleanup(day: string): void {
    const now = this.clock();
    for (const r of this.sql.exec('SELECT id, day, route, amount, keys FROM pending WHERE expires < ?', now).toArray()) {
      this.addSpend(String(r.day), String(r.route), UNSETTLED, Number(r.amount));
      this.addKeyCost(String(r.day), JSON.parse(String(r.keys)) as StoredKey[], Number(r.amount));
      this.settle(String(r.id), String(r.day));
    }
    if (this.cleanedFor === day) return;
    this.sql.exec('DELETE FROM networks WHERE day < ?', day);
    this.sql.exec('DELETE FROM spend WHERE day < ?', daysBefore(day, 1));
    this.sql.exec('DELETE FROM settled WHERE day < ?', daysBefore(day, 1));
    this.cleanedFor = day;
  }

  spent(day: string): number {
    const row = this.sql.exec('SELECT COALESCE(SUM(cost), 0) AS total FROM spend WHERE day = ?', day).toArray()[0];
    return Number(row?.total ?? 0);
  }

  pending(day: string): number {
    const row = this.sql.exec('SELECT COALESCE(SUM(amount), 0) AS total FROM pending WHERE day = ?', day).toArray()[0];
    return Number(row?.total ?? 0);
  }

  private keyRow(day: string, hash: string) {
    const r = this.sql.exec('SELECT count, cost, crises FROM networks WHERE day = ? AND hash = ?', day, hash).toArray()[0];
    return { count: Number(r?.count ?? 0), cost: Number(r?.cost ?? 0), crises: Number(r?.crises ?? 0) };
  }

  /** A key's reservations for requests in flight, other than request `except`'s. */
  private keyPending(day: string, hash: string, except = ''): number {
    const r = this.sql
      .exec(
        `SELECT COALESCE(SUM(p.amount), 0) AS total FROM pending p, json_each(p.keys) k
         WHERE p.day = ? AND p.id != ? AND json_extract(k.value, '$.hash') = ?`,
        day,
        except,
        hash,
      )
      .toArray()[0];
    return Number(r?.total ?? 0);
  }

  /**
   * Whether a key's dollars, counting its requests in flight (other than `except`) and
   * `extra`, have reached its cap. Until they settle, the key gets no more expensive
   * models, so concurrent requests can take it past its cap by at most one request's
   * worst case (a settled total at the cap is turned away outright, in begin).
   */
  private atUsdCap(day: string, keys: { hash: string; usd: number | null }[], except = '', extra = 0): boolean {
    return keys.some((k) => k.usd != null && this.keyRow(day, k.hash).cost + this.keyPending(day, k.hash, except) + extra >= k.usd);
  }

  private bumpKey(day: string, hash: string, field: 'count' | 'crises', by: number, network = false): void {
    this.sql.exec(
      `INSERT INTO networks (day, hash, ${field}, network) VALUES (?, ?, MAX(0, ?), ?)
       ON CONFLICT(day, hash) DO UPDATE SET ${field} = MAX(0, ${field} + ?), network = MAX(network, excluded.network)`,
      day,
      hash,
      by,
      network ? 1 : 0,
      by,
    );
  }

  private settle(id: string, day: string): void {
    this.sql.exec('DELETE FROM pending WHERE id = ?', id);
    this.sql.exec('INSERT OR IGNORE INTO settled (id, day) VALUES (?, ?)', id, day);
  }

  private addKeyCost(day: string, keys: StoredKey[], cost: number): void {
    if (!(cost > 0)) return;
    for (const k of keys) {
      this.sql.exec(
        'INSERT INTO networks (day, hash, cost) VALUES (?, ?, ?) ON CONFLICT(day, hash) DO UPDATE SET cost = cost + excluded.cost',
        day,
        k.hash,
        cost,
      );
    }
  }

  private addSpend(day: string, route: string, tier: string, cost: number): void {
    this.sql.exec(
      `INSERT INTO spend (day, route, tier, cost, calls) VALUES (?, ?, ?, ?, 1)
       ON CONFLICT(day, route, tier) DO UPDATE SET cost = cost + excluded.cost, calls = calls + 1`,
      day,
      route,
      tier,
      cost,
    );
  }

  /**
   * Decide the breaker's mode on spend plus reservations, then, unless closed or a key is
   * over a cap, count the request against each key and reserve its worst case. A closed
   * or capped request counts against nothing, so retrying while the AI rests costs no
   * allowance, and raising the budget reopens it for everyone. A key whose dollars are
   * taken up by its requests still in flight gets this one in cheap mode, not a 429.
   */
  begin(b: BeginInput): BeginResult {
    this.cleanup(b.day);
    const spent = this.spent(b.day);
    const committed = spent + this.pending(b.day);
    let mode = decideMode(committed, b.budget);
    if (mode === 'closed') return { mode, spent, committed, allowed: false, rejected: 'closed', count: 0 };
    const rows = b.keys.map((k) => this.keyRow(b.day, k.hash));
    const over = b.keys.some((k, i) => (k.requests != null && rows[i].count >= k.requests) || (k.usd != null && rows[i].cost >= k.usd));
    if (over) return { mode, spent, committed, allowed: false, rejected: 'network', count: rows[0]?.count ?? 0 };
    if (mode === 'normal' && this.atUsdCap(b.day, b.keys)) mode = 'cheap';
    b.keys.forEach((k, i) => this.bumpKey(b.day, k.hash, 'count', 1, i === 0));
    const keys: StoredKey[] = b.keys.map((k) => ({ hash: k.hash, crises: k.crises, usd: k.usd }));
    this.sql.exec(
      'INSERT OR REPLACE INTO pending (id, day, route, amount, expires, keys) VALUES (?, ?, ?, ?, ?, ?)',
      b.id,
      b.day,
      b.route,
      b.estimates[mode],
      this.clock() + RESERVATION_TTL_MS,
      JSON.stringify(keys),
    );
    return { mode, spent, committed, allowed: true, count: (rows[0]?.count ?? 0) + 1 };
  }

  /**
   * One atomic check-and-reserve for a crisis-tier call in cheap mode: within budget +
   * reserve counting every request in flight, within each key's daily crisis cap (the
   * trigger is text the caller writes, so it can be farmed), and while each key's
   * dollars, counting its requests in flight, are under its cap.
   */
  crisis(c: CrisisInput): CrisisResult {
    this.cleanup(c.day);
    const row = this.sql.exec('SELECT amount, keys FROM pending WHERE id = ?', c.id).toArray()[0];
    if (!row) return { allowed: false, reason: 'unknown-request' };
    const others = this.spent(c.day) + this.pending(c.day) - Number(row.amount);
    if (!crisisAllowed(others + c.spentSoFar, c.estimate, c.budget, c.reserve)) return { allowed: false, reason: 'reserve' };
    const keys = JSON.parse(String(row.keys)) as StoredKey[];
    if (keys.some((k) => k.crises != null && this.keyRow(c.day, k.hash).crises >= k.crises)) return { allowed: false, reason: 'network' };
    if (this.atUsdCap(c.day, keys, c.id, c.spentSoFar)) return { allowed: false, reason: 'network' };
    for (const k of keys) this.bumpKey(c.day, k.hash, 'crises', 1);
    this.sql.exec(
      'UPDATE pending SET amount = ?, expires = ? WHERE id = ?',
      c.spentSoFar + c.estimate,
      this.clock() + RESERVATION_TTL_MS,
      c.id,
    );
    return { allowed: true };
  }

  /**
   * Add requests' Anthropic calls to the day's totals, and settle their reservations.
   * Each id counts once: one already settled (a retried or re-sent record) or expired
   * (counted in full) is skipped, and one with no reservation (its begin never reached
   * the object) has its calls added once. So recording is idempotent.
   */
  record(items: RecordItem[]): void {
    for (const item of items) {
      if (this.sql.exec('SELECT id FROM settled WHERE id = ?', item.id).toArray().length) continue;
      const row = this.sql.exec('SELECT keys FROM pending WHERE id = ?', item.id).toArray()[0];
      for (const c of item.calls) this.addSpend(item.day, item.route, c.tier, c.cost);
      if (row) {
        const keys = JSON.parse(String(row.keys)) as StoredKey[];
        this.addKeyCost(item.day, keys, item.calls.reduce((t, c) => t + c.cost, 0));
        if (item.refund) for (const k of keys) this.bumpKey(item.day, k.hash, 'count', -1);
      }
      this.settle(item.id, item.day);
    }
  }

  report(day: string): SpendReport {
    this.cleanup(day);
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
    const net = this.sql
      .exec('SELECT COUNT(*) AS networks, COALESCE(SUM(count), 0) AS requests FROM networks WHERE day = ? AND network = 1', day)
      .toArray()[0];
    return {
      day,
      spent: rows.reduce((t, r) => t + r.cost, 0),
      pending: this.pending(day),
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

/** A configured amount (budget, reserve, cap): no upper bound, so a large budget isn't refused. */
const amount = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
/** An amount the worker computed for one request: bounded, against our own bugs. */
const money = (v: unknown) => amount(v) && (v as number) < 1000;
const cap = (v: unknown) => v === null || amount(v);
const isRoute = (v: unknown): v is Route => v === 'coach' || v === 'review';
const validCalls = (v: unknown): v is Call[] =>
  Array.isArray(v) && v.length <= 20 && v.every((c) => isTier(c?.tier) && Number.isFinite(c.cost) && c.cost >= 0 && c.cost < 100);

/** The object's JSON protocol. Only the worker can reach it; checks guard against our own bugs. */
export async function handleLimits(store: LimitsStore, request: Request): Promise<Response> {
  let b: Record<string, unknown>;
  try {
    b = (await request.json()) as Record<string, unknown>;
  } catch {
    return reply({ error: 'Send JSON.' }, 400);
  }
  const path = new URL(request.url).pathname;
  if (path === '/record') {
    const items = b?.items;
    const ok =
      Array.isArray(items) &&
      items.length <= 1000 &&
      items.every((i) => DAY.test(String(i?.day)) && isRoute(i.route) && ID.test(String(i.id)) && validCalls(i.calls));
    if (!ok) return reply({ error: 'Bad record.' }, 400);
    store.record(items as RecordItem[]);
    return reply({ ok: true });
  }
  const day = String(b?.day ?? '');
  if (!DAY.test(day)) return reply({ error: 'Bad day.' }, 400);
  switch (path) {
    case '/begin': {
      const keys = b.keys as KeyCap[];
      const est = b.estimates as BeginInput['estimates'];
      const ok =
        ID.test(String(b.id)) &&
        isRoute(b.route) &&
        amount(b.budget) &&
        Array.isArray(keys) &&
        keys.length >= 1 &&
        keys.length <= 4 &&
        keys.every((k) => HASH.test(String(k?.hash)) && cap(k.requests) && cap(k.usd) && cap(k.crises)) &&
        money(est?.normal) &&
        money(est?.cheap);
      if (!ok) return reply({ error: 'Bad begin.' }, 400);
      return reply(store.begin(b as unknown as BeginInput));
    }
    case '/crisis': {
      if (!ID.test(String(b.id)) || ![b.spentSoFar, b.estimate].every(money) || ![b.budget, b.reserve].every(amount)) return reply({ error: 'Bad crisis.' }, 400);
      return reply(store.crisis(b as unknown as CrisisInput));
    }
    case '/state':
      store.cleanup(day);
      return reply({ spent: store.spent(day), pending: store.pending(day) });
    case '/report':
      return reply(store.report(day));
    default:
      return reply({ error: 'Not found.' }, 404);
  }
}

/**
 * The Durable Object itself: a thin wrapper that gives the store its SQLite storage.
 * Each request runs synchronously against storage once its body is read, so concurrent
 * requests can't interleave inside begin, crisis or record.
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
    begin: (input: BeginInput) => call<BeginResult>('/begin', input),
    crisis: (input: CrisisInput) => call<CrisisResult>('/crisis', input),
    record: (items: RecordItem[]) => call<{ ok: true }>('/record', { items }),
    state: (day: string) => call<{ spent: number; pending: number }>('/state', { day }),
    report: (day: string) => call<SpendReport>('/report', { day }),
  };
}
export type LimitsClient = ReturnType<typeof limitsClient>;
