// What one worker instance remembers between requests, so the limits still hold (more
// loosely) while the counters' Durable Object is down or slow, and so callers already
// over their cap don't reach the object at all. Nothing here leaves the instance.
import type { KeyCap, RecordItem } from './limits';
import { modeWhenDown, type Mode } from './spend';

/** Unrecorded calls kept for the next successful record; beyond this the oldest are dropped. */
const MAX_QUEUED = 500;

export class IsolateState {
  private day = '';
  private lastSeen: { day: string; mode: Mode } | undefined;
  /** The counters reported today's spend at or over this budget: closed for the day unless the budget is raised. */
  private spentOut: { day: string; budget: number } | undefined;
  /** Requests counted here per key (network, IPv6 /48) while the counters were unreachable. */
  private localCounts = new Map<string, number>();
  /** Worst-case dollars of the requests let through here while the counters were unreachable. */
  private localSpent = 0;
  /** Networks the counters said were over a cap today, with the caps that applied. */
  private overCap = new Map<string, string>();
  private queued: RecordItem[] = [];
  /** Set once the missing-binding alert has been logged. */
  warnedNoBinding = false;

  private roll(day: string): void {
    if (day === this.day) return;
    this.day = day;
    this.localCounts.clear();
    this.localSpent = 0;
    this.overCap.clear();
  }

  /** Remember the breaker's mode and the spend the counters last reported. */
  seen(day: string, mode: Mode, spent: number, budget: number): void {
    this.lastSeen = { day, mode };
    if (spent >= budget) this.spentOut = { day, budget };
  }

  /**
   * Today's budget is spent (spend never goes down within a day), so the request can be
   * turned away without a round trip. A raised budget asks the counters again.
   */
  isSpentOut(day: string, budget: number): boolean {
    return this.spentOut?.day === day && budget <= this.spentOut.budget;
  }

  /** The mode to use when the counters can't be reached. */
  modeWhenDown(day: string): Mode {
    return modeWhenDown(this.lastSeen, day);
  }

  /**
   * Count a request locally while the counters are down, against each key's request cap
   * and this instance's dollar allowance (`cost` is the request's worst case). 'network'
   * once a key has used its requests here, 'spent' once the allowance is used.
   */
  admitWhenDown(day: string, keys: KeyCap[], cost: number, allowance: number): 'ok' | 'network' | 'spent' {
    this.roll(day);
    if (keys.some((k) => k.requests != null && (this.localCounts.get(k.hash) ?? 0) >= k.requests)) return 'network';
    if (this.localSpent + cost > allowance) return 'spent';
    for (const k of keys) this.localCounts.set(k.hash, (this.localCounts.get(k.hash) ?? 0) + 1);
    this.localSpent += cost;
    return 'ok';
  }

  noteOverCap(day: string, network: string, caps: string): void {
    this.roll(day);
    this.overCap.set(network, caps);
  }

  /** Known over its cap today (with the same caps), so it can be turned away without a round trip. */
  isOverCap(day: string, network: string, caps: string): boolean {
    this.roll(day);
    return this.overCap.get(network) === caps;
  }

  /** Keep records that couldn't be sent, to send with the next one. */
  queue(items: RecordItem[]): number {
    this.queued.push(...items);
    const dropped = Math.max(0, this.queued.length - MAX_QUEUED);
    if (dropped) this.queued.splice(0, dropped);
    return dropped;
  }

  takeQueued(): RecordItem[] {
    return this.queued.splice(0);
  }
}
