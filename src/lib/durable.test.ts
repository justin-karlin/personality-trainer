import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDurable, DURABLE_KEYS, UNSYNCED_KEY, type KeyValueStorage, type PreferencesLike } from './durable';
import { clearState, emptyState, loadState, saveState } from './storage';

const KEY = 'trait-trainer:v1';
const OFF = 'trait-trainer:analytics-off';

function fakeLocal(init: Record<string, string> = {}) {
  const data = new Map(Object.entries(init));
  const store: KeyValueStorage & { data: Map<string, string> } = {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
  return store;
}

/** A fake Preferences whose calls can be held open, to test slow writes and startup. */
function fakePrefs(init: Record<string, string> = {}) {
  const data = new Map(Object.entries(init));
  const log: string[] = [];
  let gate: Promise<void> | null = null;
  let getGate: Promise<void> | null = null;
  const prefs: PreferencesLike & {
    data: Map<string, string>;
    log: string[];
    hold(): () => void;
    holdGets(): () => void;
    failWrites: boolean;
    failGets: boolean;
  } = {
    data,
    log,
    failWrites: false,
    failGets: false,
    hold() {
      let open!: () => void;
      gate = new Promise((r) => (open = r));
      return () => {
        gate = null;
        open();
      };
    },
    holdGets() {
      let open!: () => void;
      getGate = new Promise((r) => (open = r));
      return open;
    },
    async get({ key }) {
      if (getGate) await getGate;
      if (prefs.failGets) throw new Error('not implemented');
      return { value: data.get(key) ?? null };
    },
    async set({ key, value }) {
      if (gate) await gate;
      if (prefs.failWrites) throw new Error('disk full');
      log.push(`set ${key}=${value}`);
      data.set(key, value);
    },
    async remove({ key }) {
      if (gate) await gate;
      log.push(`remove ${key}`);
      data.delete(key);
    },
  };
  return prefs;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('app state on the web', () => {
  it('saves, loads, imports and clears in the same localStorage format as before', () => {
    const local = fakeLocal();
    vi.stubGlobal('localStorage', local);
    expect(loadState()).toEqual(emptyState());
    const s = { ...emptyState(), acceptedDisclaimer: true, programWeeks: 8 };
    saveState(s);
    expect(local.data.get(KEY)).toBe(JSON.stringify(s));
    expect(loadState().programWeeks).toBe(8);
    saveState(emptyState()); // what Settings' delete-everything does
    expect(loadState().acceptedDisclaimer).toBe(false);
    clearState();
    expect(local.data.has(KEY)).toBe(false);
  });
});

describe('durable storage on the web', () => {
  it('is plain localStorage and never calls Preferences', async () => {
    const local = fakeLocal({ [KEY]: '{"a":1}' });
    const prefs = fakePrefs({ [KEY]: 'ignored' });
    const spy = vi.spyOn(prefs, 'get');
    const d = createDurable({ native: false, prefs, local: () => local });
    await d.hydrate();
    expect(d.getItem(KEY)).toBe('{"a":1}');
    d.setItem(OFF, '1');
    expect(local.data.get(OFF)).toBe('1');
    d.removeItem(KEY);
    expect(local.data.has(KEY)).toBe(false);
    await d.idle();
    expect(spy).not.toHaveBeenCalled();
    expect(prefs.log).toEqual([]);
  });

  it('works without localStorage at all', () => {
    const d = createDurable({
      native: false,
      prefs: fakePrefs(),
      local: () => {
        throw new Error('SecurityError');
      },
    });
    expect(d.getItem(KEY)).toBeNull();
    expect(() => d.setItem(KEY, 'x')).not.toThrow();
  });
});

describe('durable storage in the iOS app', () => {
  it('reads Preferences into memory at startup', async () => {
    const local = fakeLocal();
    const prefs = fakePrefs({ [KEY]: 'saved', [OFF]: '1' });
    const d = createDurable({ native: true, prefs, local: () => local });
    await d.hydrate();
    expect(d.getItem(KEY)).toBe('saved');
    expect(d.getItem(OFF)).toBe('1');
    expect(d.getItem('trait-trainer:kit-closed')).toBeNull();
  });

  it('survives the OS clearing localStorage', async () => {
    const local = fakeLocal();
    const prefs = fakePrefs();
    const first = createDurable({ native: true, prefs, local: () => local });
    await first.hydrate();
    first.setItem(KEY, 'months of logs');
    await first.idle();
    local.data.clear(); // WebView storage cleared
    const next = createDurable({ native: true, prefs, local: () => local });
    await next.hydrate();
    expect(next.getItem(KEY)).toBe('months of logs');
  });

  it('migrates localStorage from an earlier build into Preferences without deleting it', async () => {
    const local = fakeLocal({ [KEY]: 'old build', [OFF]: '1' });
    const prefs = fakePrefs();
    const d = createDurable({ native: true, prefs, local: () => local });
    await d.hydrate();
    await d.idle();
    expect(d.getItem(KEY)).toBe('old build');
    expect(prefs.data.get(KEY)).toBe('old build');
    expect(prefs.data.get(OFF)).toBe('1');
    expect(local.data.get(KEY)).toBe('old build');
    expect(local.data.get(OFF)).toBe('1');
  });

  it('prefers Preferences when both have a value, and copies it to localStorage', async () => {
    const local = fakeLocal({ [KEY]: 'stale' });
    const prefs = fakePrefs({ [KEY]: 'durable' });
    const d = createDurable({ native: true, prefs, local: () => local });
    await d.hydrate();
    await d.idle();
    expect(d.getItem(KEY)).toBe('durable');
    expect(prefs.data.get(KEY)).toBe('durable');
    expect(local.data.get(KEY)).toBe('durable');
    expect(prefs.log).toEqual([]);
  });

  it('writes through to both and removes from both (reset, analytics on)', async () => {
    const local = fakeLocal();
    const prefs = fakePrefs({ [KEY]: 'data', [OFF]: '1' });
    const d = createDurable({ native: true, prefs, local: () => local });
    await d.hydrate();
    d.setItem(KEY, 'imported');
    expect(local.data.get(KEY)).toBe('imported');
    d.removeItem(OFF);
    d.removeItem(KEY);
    expect(d.getItem(KEY)).toBeNull();
    expect(local.data.has(KEY)).toBe(false);
    await d.idle();
    expect(prefs.data.has(KEY)).toBe(false);
    expect(prefs.data.has(OFF)).toBe(false);
    // A cleared key stays cleared after a restart.
    const next = createDurable({ native: true, prefs, local: () => local });
    await next.hydrate();
    expect(next.getItem(KEY)).toBeNull();
  });

  it('never loses the latest save while an earlier write is in flight', async () => {
    const local = fakeLocal();
    const prefs = fakePrefs();
    const d = createDurable({ native: true, prefs, local: () => local });
    await d.hydrate();
    const release = prefs.hold();
    d.setItem(KEY, 'v1');
    await Promise.resolve();
    d.setItem(KEY, 'v2');
    d.setItem(KEY, 'v3');
    expect(d.getItem(KEY)).toBe('v3');
    release();
    await d.idle();
    expect(prefs.data.get(KEY)).toBe('v3');
    expect(prefs.log.at(-1)).toBe(`set ${KEY}=v3`);
    expect(prefs.log.filter((l) => l.startsWith('set'))).not.toContain(`set ${KEY}=v2`);
  });

  it('keeps going when a Preferences write fails, without logging the value', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const local = fakeLocal();
    const prefs = fakePrefs();
    const d = createDurable({ native: true, prefs, local: () => local });
    await d.hydrate();
    prefs.failWrites = true;
    expect(() => d.setItem(KEY, 'my private reflection')).not.toThrow();
    await expect(d.idle()).resolves.toBeUndefined();
    expect(d.getItem(KEY)).toBe('my private reflection');
    expect(local.data.get(KEY)).toBe('my private reflection');
    for (const call of warn.mock.calls) expect(JSON.stringify(call)).not.toContain('private');
    prefs.failWrites = false;
    d.setItem(KEY, 'later');
    await d.idle();
    expect(prefs.data.get(KEY)).toBe('later');
  });

  it('falls back to localStorage when the plugin fails to read', async () => {
    const local = fakeLocal({ [KEY]: 'local copy' });
    const prefs = fakePrefs({ [KEY]: 'durable' });
    prefs.failGets = true;
    const d = createDurable({ native: true, prefs, local: () => local });
    await expect(d.hydrate()).resolves.toBeUndefined();
    expect(d.getItem(KEY)).toBe('local copy');
    d.setItem(KEY, 'edited');
    await d.idle();
    expect(prefs.data.get(KEY)).toBe('durable'); // not touched while the plugin misbehaves
  });

  describe('startup timeout', () => {
    it('renders from localStorage if Preferences does not answer in time', async () => {
      vi.useFakeTimers();
      const local = fakeLocal({ [KEY]: 'local copy' });
      const prefs = fakePrefs({ [KEY]: 'local copy' });
      prefs.holdGets(); // never answers
      const d = createDurable({ native: true, prefs, local: () => local });
      const ready = d.hydrate(DURABLE_KEYS, 500);
      await vi.advanceTimersByTimeAsync(500);
      await expect(ready).resolves.toBeUndefined();
      expect(d.getItem(KEY)).toBe('local copy');
    });

    it('catches Preferences up once a late read shows the app continued from it', async () => {
      vi.useFakeTimers();
      const local = fakeLocal({ [KEY]: 'same' });
      const prefs = fakePrefs({ [KEY]: 'same' });
      const answer = prefs.holdGets();
      const d = createDurable({ native: true, prefs, local: () => local });
      const ready = d.hydrate([KEY], 500);
      await vi.advanceTimersByTimeAsync(500);
      await ready;
      d.setItem(KEY, 'newer');
      await d.idle();
      expect(prefs.data.get(KEY)).toBe('same'); // held until the read comes back
      answer();
      await vi.advanceTimersByTimeAsync(0);
      await d.idle();
      expect(prefs.data.get(KEY)).toBe('newer');
    });

    it('migrates late when Preferences turns out to be empty', async () => {
      vi.useFakeTimers();
      const local = fakeLocal({ [KEY]: 'old build' });
      const prefs = fakePrefs();
      const answer = prefs.holdGets();
      const d = createDurable({ native: true, prefs, local: () => local });
      const ready = d.hydrate([KEY], 500);
      await vi.advanceTimersByTimeAsync(500);
      await ready;
      answer();
      await vi.advanceTimersByTimeAsync(0);
      await d.idle();
      expect(prefs.data.get(KEY)).toBe('old build');
    });

    it('restores the durable copy and reloads when a late read shows localStorage was cleared', async () => {
      vi.useFakeTimers();
      const local = fakeLocal(); // WebView storage was cleared
      const prefs = fakePrefs({ [KEY]: 'months of logs' });
      const answer = prefs.holdGets();
      const reload = vi.fn();
      const d = createDurable({ native: true, prefs, local: () => local, reload });
      const ready = d.hydrate([KEY], 500);
      await vi.advanceTimersByTimeAsync(500);
      await ready;
      expect(d.getItem(KEY)).toBeNull();
      d.setItem(KEY, 'fresh empty state'); // the store's first save, before the answer
      answer();
      await vi.advanceTimersByTimeAsync(0);
      await d.idle();
      expect(reload).toHaveBeenCalledTimes(1);
      expect(d.getItem(KEY)).toBe('months of logs');
      expect(local.data.get(KEY)).toBe('months of logs');
      expect(prefs.data.get(KEY)).toBe('months of logs');
      d.setItem(KEY, 'a save while reloading');
      await d.idle();
      expect(prefs.data.get(KEY)).toBe('months of logs');
      // After the reload, the app starts from the restored copy.
      const next = createDurable({ native: true, prefs, local: () => local });
      await next.hydrate([KEY], 500);
      expect(next.getItem(KEY)).toBe('months of logs');
    });

    it('keeps the durable copy if the plugin never answers and localStorage was empty', async () => {
      vi.useFakeTimers();
      const local = fakeLocal();
      const prefs = fakePrefs({ [KEY]: 'months of logs' });
      prefs.holdGets(); // never answers this session
      const d = createDurable({ native: true, prefs, local: () => local });
      const ready = d.hydrate([KEY], 500);
      await vi.advanceTimersByTimeAsync(500);
      await ready;
      d.setItem(KEY, 'fresh empty state');
      await d.idle();
      expect(prefs.data.get(KEY)).toBe('months of logs');
      vi.useRealTimers();
      const fresh = fakePrefs(Object.fromEntries(prefs.data));
      const next = createDurable({ native: true, prefs: fresh, local: () => local });
      await next.hydrate([KEY]);
      expect(next.getItem(KEY)).toBe('months of logs');
    });
  });
});

describe('durable storage keeps the newest copy across launches', () => {
  const relaunch = async (prefs: PreferencesLike, local: KeyValueStorage) => {
    const d = createDurable({ native: true, prefs, local: () => local });
    await d.hydrate([KEY]);
    await d.idle();
    return d;
  };

  it('retries a failed write, and prefers the newer localStorage copy on the next launch', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const local = fakeLocal();
    const prefs = fakePrefs({ [KEY]: 'v1' });
    const d = await relaunch(prefs, local);
    prefs.failWrites = true;
    d.setItem(KEY, 'v2 with a check-in');
    await d.idle();
    expect(prefs.data.get(KEY)).toBe('v1');
    expect(local.data.get(UNSYNCED_KEY)).toContain(KEY);
    prefs.failWrites = false;
    // The same value saved again is not skipped: the failed write is retried.
    d.setItem(KEY, 'v2 with a check-in');
    await d.idle();
    expect(prefs.data.get(KEY)).toBe('v2 with a check-in');
    expect(local.data.has(UNSYNCED_KEY)).toBe(false);
  });

  it('keeps a save whose Preferences write never landed (e.g. the app was closed)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const local = fakeLocal();
    const prefs = fakePrefs({ [KEY]: 'v1' });
    const d = await relaunch(prefs, local);
    prefs.failWrites = true;
    d.setItem(KEY, 'v2 with a check-in');
    await d.idle();
    prefs.failWrites = false;
    const next = await relaunch(prefs, local);
    expect(next.getItem(KEY)).toBe('v2 with a check-in');
    expect(prefs.data.get(KEY)).toBe('v2 with a check-in');
    expect(local.data.has(UNSYNCED_KEY)).toBe(false);
  });

  it('retries a failed startup read on the next save, so Delete everything reaches Preferences', async () => {
    const local = fakeLocal({ [KEY]: 'v1' });
    const prefs = fakePrefs({ [KEY]: 'v1' });
    prefs.failGets = true;
    const d = await relaunch(prefs, local);
    prefs.failGets = false;
    d.setItem(KEY, 'empty state');
    await new Promise((r) => setTimeout(r, 0));
    await d.idle();
    expect(prefs.data.get(KEY)).toBe('empty state');
    expect((await relaunch(prefs, local)).getItem(KEY)).toBe('empty state');
  });

  it('keeps a session made while Preferences could not be read', async () => {
    const local = fakeLocal({ [KEY]: 'v1' });
    const prefs = fakePrefs({ [KEY]: 'v1' });
    prefs.failGets = true;
    const d = await relaunch(prefs, local);
    d.setItem(KEY, 'empty state'); // Delete everything
    await new Promise((r) => setTimeout(r, 0));
    await d.idle();
    expect(prefs.data.get(KEY)).toBe('v1');
    prefs.failGets = false;
    const next = await relaunch(prefs, local);
    expect(next.getItem(KEY)).toBe('empty state');
    expect(prefs.data.get(KEY)).toBe('empty state');
  });

  it('keeps a removal made while Preferences could not be read', async () => {
    const local = fakeLocal({ [KEY]: 'v1' });
    const prefs = fakePrefs({ [KEY]: 'v1' });
    prefs.failGets = true;
    const d = await relaunch(prefs, local);
    d.removeItem(KEY);
    await new Promise((r) => setTimeout(r, 0));
    prefs.failGets = false;
    const next = await relaunch(prefs, local);
    expect(next.getItem(KEY)).toBeNull();
    expect(prefs.data.has(KEY)).toBe(false);
  });
});
