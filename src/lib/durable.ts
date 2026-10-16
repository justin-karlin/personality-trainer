// Durable key-value storage for the few things the app remembers on the device.
//
// On the website this is plain localStorage, exactly as before. In the iOS app, the OS may
// clear WebView storage (localStorage) under storage pressure, so every value is also kept
// in Capacitor Preferences (UserDefaults), which the OS does not clear. Preferences is
// asynchronous, so at startup we read every key once into memory (see hydrateDurable, called
// before the first render); after that reads are synchronous, and writes go to memory,
// localStorage and Preferences.
//
// Which copy wins at startup:
// - A small marker in localStorage (UNSYNCED_KEY) lists keys saved to localStorage but not yet
//   confirmed in Preferences (a write failed, the app was closed first, or the plugin wasn't
//   readable). For those, localStorage is the newer copy: it wins and is copied to Preferences.
//   The marker lives in localStorage, so if the OS clears WebView storage it goes too.
// - Otherwise Preferences wins (and is copied to localStorage). If Preferences is empty, the
//   localStorage value from an earlier build is copied into it.
//
// If the plugin doesn't answer in time, the app starts from localStorage. When the late answer
// shows Preferences holds something else (e.g. WebView storage was cleared), that copy is
// restored and the page reloads, so the user sees their data rather than a fresh start. If a
// read fails, it is tried again on the next save.
import { Preferences } from '@capacitor/preferences';
import { isNative } from './native';

/** Every key the app keeps. All of them are read into memory at startup on native. */
export const DURABLE_KEYS = [
  'trait-trainer:v1',
  'trait-trainer:analytics-off',
  'trait-trainer:kit-closed',
  'trait-trainer:move-hint-dismissed',
] as const;

/** How long startup waits for Preferences before rendering from localStorage. */
export const HYDRATE_TIMEOUT_MS = 2000;

export interface PreferencesLike {
  get(o: { key: string }): Promise<{ value: string | null }>;
  set(o: { key: string; value: string }): Promise<void>;
  remove(o: { key: string }): Promise<void>;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface DurableDeps {
  native: boolean;
  prefs: PreferencesLike;
  /** Returns localStorage, or throws/returns undefined where it is unavailable. */
  local: () => KeyValueStorage | undefined;
  /** Reloads the page after a late read restored the durable copy. */
  reload?: () => void;
}

export interface Durable extends KeyValueStorage {
  /** Read keys from Preferences into memory (native only). Never rejects; resolves by the timeout. */
  hydrate(keys?: readonly string[], timeoutMs?: number): Promise<void>;
  /** Resolves when every queued Preferences write has settled (for tests and shutdown). */
  idle(): Promise<void>;
}

/** localStorage key listing the keys whose localStorage copy is newer than Preferences. */
export const UNSYNCED_KEY = 'trait-trainer:durable-unsynced';

/** Per key on native: still reading, safe to write to Preferences, or the read failed. */
type KeyStatus = 'reading' | 'ok' | 'failed';
type PendingOp = { op: 'set'; value: string } | { op: 'remove' };
const toOp = (value: string | null): PendingOp => (value === null ? { op: 'remove' } : { op: 'set', value });

export function createDurable(deps: DurableDeps): Durable {
  const ls = (): KeyValueStorage | undefined => {
    try {
      return deps.local() ?? undefined;
    } catch {
      return undefined;
    }
  };
  const lsGet = (key: string): string | null => {
    try {
      return ls()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  };
  const lsSet = (key: string, value: string) => {
    try {
      ls()?.setItem(key, value);
    } catch {
      // Private mode or quota: the in-memory copy (and Preferences on native) still has it.
    }
  };
  const lsRemove = (key: string) => {
    try {
      ls()?.removeItem(key);
    } catch {
      // ignore
    }
  };

  if (!deps.native) {
    return {
      getItem: lsGet,
      setItem: lsSet,
      removeItem: lsRemove,
      hydrate: () => Promise.resolve(),
      idle: () => Promise.resolve(),
    };
  }

  /** The current value of each key the app has read or written this session. */
  const memory = new Map<string, string | null>();
  const status = new Map<string, KeyStatus>();
  /** The latest write not yet sent to Preferences, per key (older ones are superseded). */
  const pending = new Map<string, PendingOp>();
  /** What localStorage held for each key when startup began. */
  const startLocal = new Map<string, string | null>();
  let chain: Promise<void> = Promise.resolve();
  /** Set once a late read restored the durable copy: the page is reloading, so ignore writes. */
  let restoring = false;

  const readUnsynced = (): Set<string> => {
    try {
      const list: unknown = JSON.parse(lsGet(UNSYNCED_KEY) ?? '[]');
      return new Set(Array.isArray(list) ? list.filter((k): k is string => typeof k === 'string') : []);
    } catch {
      return new Set();
    }
  };
  const unsynced = readUnsynced();
  let startUnsynced = new Set(unsynced);
  function markUnsynced(key: string, on: boolean) {
    if (unsynced.has(key) === on) return;
    if (on) unsynced.add(key);
    else unsynced.delete(key);
    if (unsynced.size) lsSet(UNSYNCED_KEY, JSON.stringify([...unsynced]));
    else lsRemove(UNSYNCED_KEY);
  }

  const statusOf = (key: string): KeyStatus => status.get(key) ?? 'ok';
  const current = (key: string) => (memory.has(key) ? memory.get(key)! : lsGet(key));
  // Before a key's read has succeeded, its localStorage copy may only win next launch if
  // localStorage wasn't empty at startup; otherwise it may be a fresh start over cleared storage.
  const mayWinNextLaunch = (key: string) =>
    statusOf(key) === 'ok' || startUnsynced.has(key) || (startLocal.get(key) ?? null) !== null;

  // Writes go through one chain, one at a time. A flush sends whatever is latest for the key
  // when its turn comes, so a slow write never causes a newer value to be lost or reordered.
  function schedule(key: string) {
    chain = chain.then(async () => {
      if (statusOf(key) !== 'ok') return; // sent once the key's read succeeds
      const op = pending.get(key);
      if (!op) return;
      pending.delete(key);
      try {
        if (op.op === 'set') await deps.prefs.set({ key, value: op.value });
        else await deps.prefs.remove({ key });
        if (!pending.has(key)) markUnsynced(key, false);
      } catch {
        // Keep it queued (the next save retries it) and marked, so the next launch prefers
        // the localStorage copy. Never log the value itself.
        if (!pending.has(key)) pending.set(key, op);
        console.warn(`Trait Trainer: couldn't save "${key}" to device storage.`);
      }
    });
  }

  function write(key: string, value: string | null) {
    if (restoring) return;
    if (mayWinNextLaunch(key)) markUnsynced(key, true);
    memory.set(key, value);
    if (value === null) lsRemove(key);
    else lsSet(key, value);
    pending.set(key, toOp(value));
    if (statusOf(key) === 'failed') void readKey(key, () => true);
    else schedule(key);
  }

  /** Queue whatever the app holds now, unless Preferences already has it. */
  function catchUp(key: string, durable: string | null) {
    if (pending.has(key)) return;
    const now = current(key);
    if (now !== durable) pending.set(key, toOp(now));
    else markUnsynced(key, false);
  }

  function readKey(key: string, isLate: () => boolean): Promise<void> {
    status.set(key, 'reading');
    const local0 = startLocal.get(key) ?? null;
    return Promise.resolve()
      .then(() => deps.prefs.get({ key }))
      .then(
        ({ value }) => {
          if (restoring) return;
          const durable = value ?? null;
          status.set(key, 'ok');
          if (startUnsynced.has(key)) {
            // localStorage was saved after Preferences: it is the newer copy.
            if (!memory.has(key)) memory.set(key, lsGet(key));
            catchUp(key, durable);
          } else if (!isLate()) {
            // In time: Preferences wins; otherwise migrate what localStorage has. (A save made
            // while reading is newer than both, and stays queued.)
            if (pending.has(key)) {
              // keep it
            } else if (durable !== null) {
              memory.set(key, durable);
              if (local0 !== durable) lsSet(key, durable);
            } else {
              memory.set(key, local0);
              catchUp(key, null);
            }
          } else if (durable === null || durable === local0) {
            // Late, but the app's copy continues the durable one: catch Preferences up.
            catchUp(key, durable);
          } else {
            // Late, and the app started from a different copy (e.g. WebView storage was
            // cleared): restore the durable one and reload so the app shows it.
            restoring = true;
            memory.set(key, durable);
            lsSet(key, durable);
            pending.delete(key);
            markUnsynced(key, false);
            deps.reload?.();
            return;
          }
          if (pending.has(key)) schedule(key);
        },
        () => {
          // The plugin failed: run from localStorage, keep any write queued, retry on the next save.
          status.set(key, 'failed');
        },
      );
  }

  return {
    getItem: current,
    setItem(key, value) {
      // The store saves on every launch; skip the Preferences write when nothing changed.
      const unchanged = memory.has(key) && memory.get(key) === value && !pending.has(key) && statusOf(key) === 'ok';
      if (unchanged) lsSet(key, value);
      else write(key, value);
    },
    removeItem(key) {
      write(key, null);
    },
    hydrate(keys = DURABLE_KEYS, timeoutMs = HYDRATE_TIMEOUT_MS) {
      let late = false;
      startUnsynced = new Set(unsynced);
      const reads = keys.map((key) => {
        startLocal.set(key, lsGet(key));
        return readKey(key, () => late);
      });
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<void>((resolve) => {
        timer = setTimeout(() => {
          late = true;
          resolve();
        }, timeoutMs);
      });
      return Promise.race([Promise.all(reads).then(() => undefined), timeout]).finally(() => clearTimeout(timer));
    },
    async idle() {
      let seen: Promise<void>;
      do {
        seen = chain;
        await seen;
      } while (seen !== chain);
    },
  };
}

/** The app's storage: localStorage on the web, localStorage + Preferences in the iOS app. */
export const durable: Durable = createDurable({
  native: isNative(),
  prefs: Preferences,
  local: () => (typeof localStorage === 'undefined' ? undefined : localStorage),
  reload: () => location.reload(),
});

/** Call once before the first render. On the web it resolves at once. */
export function hydrateDurable(): Promise<void> {
  return durable.hydrate().catch(() => undefined);
}
