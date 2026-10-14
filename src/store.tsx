import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { AppState } from './types';
import { milestones, trackEvent } from './lib/analytics';
import { loadState, saveState } from './lib/storage';

interface Store {
  state: AppState;
  update: (fn: (s: AppState) => AppState) => void;
  replace: (s: AppState) => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);

  useEffect(() => saveState(state), [state]);

  // Count milestones (names only) as the user reaches them; restoring a backup isn't one.
  const prev = useRef(state);
  const restoring = useRef(false);
  useEffect(() => {
    if (!restoring.current) milestones(prev.current, state).forEach(trackEvent);
    restoring.current = false;
    prev.current = state;
  }, [state]);

  const update = useCallback((fn: (s: AppState) => AppState) => setState((s) => fn(s)), []);
  const replace = useCallback((s: AppState) => {
    restoring.current = true;
    setState(s);
  }, []);

  return <StoreContext.Provider value={{ state, update, replace }}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
