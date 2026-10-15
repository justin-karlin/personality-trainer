// Test helpers only (not imported by the worker): fakes for the Durable Object namespace
// and the Anthropic client, so tests run in plain Node without a Workers runtime.
import type Anthropic from '@anthropic-ai/sdk';
import { LimitsStore, handleLimits, type LimitsNamespace, type Sql } from './limits';

/**
 * A LimitsStore on Node's built-in SQLite (Node 22.13+), so the real SQL is exercised.
 * Undefined where node:sqlite isn't available; tests that need it are skipped there.
 */
export async function sqliteStore(): Promise<LimitsStore | undefined> {
  let mod: { DatabaseSync: new (path: string) => { prepare(q: string): { all(...b: unknown[]): unknown[]; run(...b: unknown[]): unknown } } };
  try {
    const spec = 'node:sqlite';
    mod = await import(/* @vite-ignore */ spec);
  } catch {
    return undefined;
  }
  const db = new mod.DatabaseSync(':memory:');
  // Durable Object SQL runs each statement when exec() is called, so do the same here.
  const sql: Sql = {
    exec(query, ...bindings) {
      const stmt = db.prepare(query);
      const rows = /^\s*(SELECT|WITH)\b/i.test(query) ? (stmt.all(...bindings) as Record<string, unknown>[]) : (stmt.run(...bindings), []);
      return { toArray: () => rows };
    },
  };
  return new LimitsStore(sql);
}

/** A namespace whose single object is `store`, reached through the real JSON protocol. */
export function storeNamespace(store: LimitsStore): LimitsNamespace {
  return {
    idFromName: (name) => name,
    get: () => ({ fetch: (url, init) => handleLimits(store, new Request(url, init)) }),
  };
}

export interface FakeLimitsState {
  /** Dollars spent today, as /begin and /state report it. */
  spent?: number;
  /** False: the network is over its daily cap. */
  allowed?: boolean;
  /** Every call throws, like an unreachable object. */
  fail?: boolean;
}

/** A scripted namespace that records what the worker sent it. */
export function fakeLimits(state: FakeLimitsState = {}) {
  const seen = { begins: [] as Record<string, unknown>[], records: [] as Record<string, unknown>[], states: 0 };
  const ns: LimitsNamespace = {
    idFromName: (name) => name,
    get: () => ({
      async fetch(url, init) {
        if (state.fail) throw new Error('Durable Object unreachable.');
        const body = JSON.parse(String(init?.body ?? '{}'));
        const out = (o: unknown) => new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } });
        switch (new URL(url).pathname) {
          case '/begin':
            seen.begins.push(body);
            return out({ spent: state.spent ?? 0, count: 1, allowed: state.allowed ?? true });
          case '/record':
            seen.records.push(body);
            return out({ ok: true });
          case '/state':
            seen.states++;
            return out({ spent: state.spent ?? 0 });
          default:
            return new Response('{}', { status: 404 });
        }
      },
    }),
  };
  return { ns, seen };
}

/** An Anthropic message as the SDK returns it. */
export function message(body: unknown, opts: { stop?: string; input?: number; output?: number } = {}) {
  return {
    stop_reason: opts.stop ?? 'end_turn',
    content: [{ type: 'text', text: typeof body === 'string' ? body : JSON.stringify(body) }],
    usage: { input_tokens: opts.input ?? 1000, output_tokens: opts.output ?? 300 },
  };
}

/** A client that answers with `replies` in order and records each request. */
export function scriptedClient(...replies: unknown[]) {
  const requests: { model: string; max_tokens: number }[] = [];
  let i = 0;
  const create = async (args: { model: string; max_tokens: number }) => {
    requests.push(args);
    const r = replies[Math.min(i++, replies.length - 1)];
    if (r instanceof Error) throw r;
    return r;
  };
  return { client: { beta: { messages: { create } } } as unknown as Anthropic, requests, models: () => requests.map((r) => r.model) };
}
