// Ratings from people who know the user, with no server. The user sends a request link;
// the rater answers in their own browser (nothing is stored there) and sends back a reply
// link or code, which the user adds to their own data.
import { OBSERVER_ITEMS, RATED_TRAITS } from '../data/observer';
import type { ObserverRating, TraitId } from '../types';
import { PUBLIC_URL, isNative } from './native';

export interface RatingRequest {
  id: string;
  /** How the rater should refer to the user (optional first name). */
  name: string;
  traits: TraitId[];
}

export interface RatingReply {
  requestId: string;
  relation: string;
  date: string;
  /** Item answers (1–5) per trait, in OBSERVER_ITEMS order. */
  answers: Partial<Record<TraitId, number[]>>;
  /** Perceived change, −2 (much less) … +2 (much more). */
  change: Partial<Record<TraitId, number>>;
}

const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));

const REQ = 'TR1.';
const REP = 'TA1.';

export function encodeRequest(r: RatingRequest): string {
  return REQ + b64(JSON.stringify({ i: r.id, n: r.name.slice(0, 40), t: r.traits }));
}

export function decodeRequest(code: string): RatingRequest {
  const c = extractCode(code, REQ);
  try {
    const o = JSON.parse(unb64(c.slice(REQ.length)));
    const traits = (Array.isArray(o.t) ? o.t : []).filter((t: TraitId) => RATED_TRAITS.includes(t));
    if (typeof o.i !== 'string' || !traits.length) throw new Error();
    return { id: o.i, name: typeof o.n === 'string' ? o.n.slice(0, 40) : '', traits };
  } catch {
    throw new Error('This rating link is incomplete. Ask for the link again.');
  }
}

export function encodeReply(r: RatingReply): string {
  return REP + b64(JSON.stringify({ i: r.requestId, r: r.relation, d: r.date, a: r.answers, c: r.change }));
}

export function decodeReply(code: string): RatingReply {
  const c = extractCode(code, REP);
  try {
    const o = JSON.parse(unb64(c.slice(REP.length)));
    const answers: RatingReply['answers'] = {};
    const change: RatingReply['change'] = {};
    for (const t of RATED_TRAITS) {
      const a = o.a?.[t];
      if (Array.isArray(a) && a.length === OBSERVER_ITEMS[t]!.length && a.every((x) => Number.isInteger(x) && x >= 1 && x <= 5)) answers[t] = a;
      const ch = o.c?.[t];
      if (Number.isInteger(ch) && ch >= -2 && ch <= 2) change[t] = ch;
    }
    if (typeof o.i !== 'string' || !Object.keys(answers).length || !/^\d{4}-\d\d-\d\d$/.test(o.d)) throw new Error();
    return { requestId: o.i, relation: typeof o.r === 'string' ? o.r.slice(0, 30) : 'Someone', date: o.d, answers, change };
  } catch {
    throw new Error('That reply is incomplete. Ask them to send it again, or copy the whole thing.');
  }
}

/** Accept a bare code or a whole link containing one. */
function extractCode(text: string, prefix: string): string {
  const t = text.trim();
  const i = t.indexOf(prefix);
  if (i < 0) throw new Error(prefix === REQ ? 'That isn’t a rating link.' : 'That doesn’t look like a rating reply.');
  return t.slice(i).replace(/[\s&#].*$/s, '');
}

/** Mean item score (1–5) with reverse keys, on the same scale as the self-report. */
export function observerScore(trait: TraitId, answers: number[]): number {
  const items = OBSERVER_ITEMS[trait]!;
  const sum = answers.reduce((s, a, i) => s + (items[i][1] === 1 ? a : 6 - a), 0);
  return sum / items.length;
}

export function toObserverRating(reply: RatingReply): ObserverRating {
  const scores: ObserverRating['scores'] = {};
  for (const [t, a] of Object.entries(reply.answers) as [TraitId, number[]][]) scores[t] = observerScore(t, a);
  return {
    id: `${reply.requestId}-${reply.date}-${reply.relation}`,
    requestId: reply.requestId,
    date: reply.date,
    relation: reply.relation,
    scores,
    change: reply.change,
  };
}

/** Base URL of the app, without the hash, for share links. */
export function appUrl(): string {
  // In the App Store app the page address is internal; friends need the public website.
  if (isNative()) return PUBLIC_URL;
  return `${location.origin}${location.pathname}`;
}
