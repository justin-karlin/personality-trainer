// What one worker instance remembers between requests, so the limits still hold (more
// loosely) while the counters' Durable Object is down or slow, and so callers already
// over their cap don't reach the object at all. Nothing here leaves the instance.
import type { RecordItem } from './limits';
import { modeWhenDown, type Mode } from './spend';

/** Unrecorded calls kept for the next successful record; beyond this the oldest are dropped. */
const MAX_QUEUED = 500;

export class IsolateState {
  private day = '';
  private lastSeen: { day: string; mode: Mode } | undefined;
  /** Requests counted here per network while the counters were unreachable. */
  private localCounts = new Map<string, number>();
  /** Networks the counters said were over a cap today, with the caps that applied. */
  private overCap = new Map<string, string>();
  private queued: RecordItem[] = [];
  /** Set once the missing-binding alert has been logged. */
  warnedNoBinding = false;

  private roll(day: string): void {
    if (day === this.day) return;
    this.day = day;
    this.localCounts.clear();
    this.overCap.clear();
  }

  /** Remember the breaker's mode the counters last reported. */
  seen(day: string, mode: Mode): void {
    this.lastSeen = { day, mode };
  }

  /** The mode to use when the counters can't be reached. */
  modeWhenDown(day: string): Mode {
    return modeWhenDown(this.lastSeen, day);
  }

  /** Count a request locally while the counters are down; false once this instance's cap is reached. */
  countWhenDown(day: string, network: string, cap: number): boolean {
    this.roll(day);
    const n = this.localCounts.get(network) ?? 0;
    if (n >= cap) return false;
    this.localCounts.set(network, n + 1);
    return true;
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
