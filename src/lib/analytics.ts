// Anonymous usage counts via GoatCounter (https://www.goatcounter.com): which screens are
// opened, and how often people reach milestones such as finishing the questionnaire or
// checking in. No cookies, no identifiers, and nothing the user types or scores is ever sent.
// Counts are only sent from the published site, never from local or preview builds, and
// people can turn them off in Settings.
import type { AppState } from '../types';

const ENDPOINT = 'https://traittrainer.goatcounter.com/count';
/** Hosts that count. Add a custom domain here if the app moves to one. */
const HOSTS = ['justin-karlin.github.io'];
const OFF_KEY = 'trait-trainer:analytics-off';

export function analyticsAllowedOn(hostname: string): boolean {
  return HOSTS.includes(hostname);
}

export function analyticsOff(): boolean {
  try {
    return localStorage.getItem(OFF_KEY) === '1';
  } catch {
    return false;
  }
}

export function setAnalyticsOff(off: boolean): void {
  try {
    if (off) localStorage.setItem(OFF_KEY, '1');
    else localStorage.removeItem(OFF_KEY);
  } catch {
    // Storage blocked: nothing to remember, and nothing is sent either way below.
  }
}

function send(params: Record<string, string>): void {
  if (typeof window === 'undefined' || !analyticsAllowedOn(location.hostname) || analyticsOff()) return;
  const url = `${ENDPOINT}?${new URLSearchParams({ ...params, rnd: Math.random().toString(36).slice(2) })}`;
  try {
    if (navigator.sendBeacon?.(url)) return;
    new Image().src = url;
  } catch {
    // Offline or blocked: counts are best-effort.
  }
}

let firstPage = true;

/** A screen view, e.g. "/today". The referrer is only sent with the first one. */
export function trackPage(path: string, title: string): void {
  send({ p: path, t: title, ...(firstPage && document.referrer ? { r: document.referrer } : {}) });
  firstPage = false;
}

/** A milestone, counted by name only. */
export function trackEvent(name: string): void {
  send({ p: name, t: name, e: 'true' });
}

const total = (s: AppState) => ({
  assessments: s.assessments.length,
  goals: s.goals.length,
  weeks: s.weeks.length,
  reflections: s.weeks.filter((w) => w.reflection).length,
  checkins: Object.keys(s.checkins).length,
  done: s.weeks.reduce((n, w) => n + w.commitments.reduce((m, c) => m + c.completions.length, 0), 0),
});

/** Milestones reached between two states of the app (names only, never values). */
export function milestones(prev: AppState, next: AppState): string[] {
  const a = total(prev);
  const b = total(next);
  const out: string[] = [];
  if (!prev.acceptedDisclaimer && next.acceptedDisclaimer) out.push('started');
  if (b.assessments > a.assessments) out.push(b.assessments === 1 ? 'questionnaire-done' : 'questionnaire-retaken');
  if (b.goals > a.goals) out.push(b.goals === 1 ? 'goal-set' : 'second-goal-set');
  if (b.weeks > a.weeks) out.push(`week-${Math.min(b.weeks, 13)}-started`);
  if (b.reflections > a.reflections) out.push('weekly-reflection');
  if (b.checkins > a.checkins) out.push('check-in');
  if (b.done > a.done) out.push('challenge-done');
  return out;
}
