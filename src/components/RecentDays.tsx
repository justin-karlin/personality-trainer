import type { AppState } from '../types';
import { addDays, formatDate } from '../lib/dates';
import { hasCheckinData } from '../lib/checkin';
import { outcomesOn } from '../lib/actions';
import { Flame, Icon } from './Icon';

type DayStatus = 'done' | 'logged' | 'rated' | 'none';

const STATUS_TEXT: Record<DayStatus, string> = {
  done: 'did a planned action',
  logged: 'logged an action, not done',
  rated: 'check-in only, no action logged',
  none: 'nothing logged',
};

/**
 * The last 7 days, keeping actions and check-ins apart: a tick when a planned action
 * was done, a dash when an outcome was logged but not done (tried, skipped, no chance),
 * a dot when there was only a check-in (a self-rating, not an action), and blank
 * when nothing was logged.
 */
export function RecentDays({ state, date }: { state: AppState; date: string }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(date, i - 6));
  const status = (d: string): DayStatus => {
    const outcomes = outcomesOn(state.weeks, d);
    if (outcomes.includes('done')) return 'done';
    if (outcomes.length) return 'logged';
    return hasCheckinData(state.checkins[d]) ? 'rated' : 'none';
  };
  const statuses = days.map(status);
  const doneDays = statuses.filter((s) => s === 'done').length;
  return (
    <section className="card" aria-labelledby="days-title">
      <div className="spread">
        <h3 id="days-title" style={{ margin: 0 }}>
          Last 7 days
        </h3>
        <span className="row" style={{ gap: 4, fontWeight: 700, color: 'var(--streak-text)' }}>
          <Flame size={18} />
          {doneDays} of 7 done
        </span>
      </div>
      <ul className="days" role="list">
        {days.map((d, i) => {
          const s = statuses[i];
          return (
            <li key={d} className={d === date ? 'today' : ''}>
              <span className={`day-dot ${s === 'done' ? 'on' : s}`} aria-hidden="true">
                {s === 'done' ? (
                  <Icon name="check" size={16} stroke={3} />
                ) : s === 'logged' ? (
                  <svg width="12" height="12" viewBox="0 0 12 12">
                    <path d="M2 6h8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                ) : s === 'rated' ? (
                  <svg width="8" height="8" viewBox="0 0 8 8">
                    <circle cx="4" cy="4" r="3" fill="currentColor" />
                  </svg>
                ) : null}
              </span>
              <span>
                {d === date ? (
                  <>
                    <span className="today-word">Today</span>
                    <span className="today-day" aria-hidden="true">
                      {formatDate(d, { weekday: 'short' })}
                    </span>
                  </>
                ) : (
                  formatDate(d, { weekday: 'short' })
                )}
                <span className="sr-only">, {STATUS_TEXT[s]}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="days-legend" aria-hidden="true">
        <span>
          <span className="legend-dot" /> Done
        </span>
        <span>
          <span className="legend-dot logged" /> Not done
        </span>
        <span>
          <span className="legend-dot rated" /> Check-in
        </span>
        <span>Blank = no log</span>
      </p>
    </section>
  );
}
