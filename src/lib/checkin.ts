import type { DailyCheckin } from '../types';

/** A check-in counts only if it has a rating, a mood or a non-empty note. */
export function hasCheckinData(c: DailyCheckin | undefined): boolean {
  if (!c) return false;
  return c.mood != null || Object.values(c.states).some((v) => v != null) || !!c.note?.trim();
}
