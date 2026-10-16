import type { AppState } from '../types';
import { durable } from './durable';

const KEY = 'trait-trainer:v1';

export const DEFAULT_PROGRAM_WEEKS = 12;

export function emptyState(): AppState {
  return {
    version: 1,
    acceptedDisclaimer: false,
    programWeeks: DEFAULT_PROGRAM_WEEKS,
    assessments: [],
    goals: [],
    weeks: [],
    checkins: {},
  };
}

/** Validate and normalise untrusted JSON (from storage or an imported file). */
export function parseState(raw: unknown): AppState {
  if (!raw || typeof raw !== 'object') throw new Error('Not a Trait Trainer data file.');
  const s = raw as Partial<AppState>;
  if (s.version !== 1) throw new Error('Unsupported data version.');
  const base = emptyState();
  return {
    ...base,
    ...s,
    assessments: Array.isArray(s.assessments) ? s.assessments : [],
    goals: Array.isArray(s.goals) ? s.goals : [],
    weeks: Array.isArray(s.weeks) ? s.weeks : [],
    checkins: s.checkins && typeof s.checkins === 'object' ? s.checkins : {},
    observerRatings: Array.isArray(s.observerRatings) ? s.observerRatings : [],
    ratingRequests: Array.isArray(s.ratingRequests) ? s.ratingRequests : [],
    programWeeks: typeof s.programWeeks === 'number' ? s.programWeeks : base.programWeeks,
  };
}

export function loadState(): AppState {
  try {
    const raw = durable.getItem(KEY);
    if (!raw) return emptyState();
    return parseState(JSON.parse(raw));
  } catch {
    return emptyState();
  }
}

export function saveState(state: AppState): void {
  try {
    durable.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable (private mode, quota); the app still works in memory.
  }
}

export function clearState(): void {
  try {
    durable.removeItem(KEY);
  } catch {
    // ignore
  }
}
