import type { AppState } from '../types';
import { addDays, formatDate } from '../lib/dates';
import { hasCheckinData } from '../lib/checkin';
import { Flame, Icon } from './Icon';

/** The last 7 days as dots: filled when a challenge was done, tinted when only a check-in was logged. */
export function RecentDays({ state, date }: { state: AppState; date: string }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(date, i - 6));
  const practised = new Set(state.weeks.flatMap((w) => w.commitments.flatMap((c) => c.completions)));
  const active = days.filter((d) => practised.has(d)).length;
  return (
    <section className="card" aria-labelledby="days-title">
      <div className="spread">
        <h2 id="days-title" style={{ margin: 0 }}>
          Last 7 days
        </h2>
        <span className="row" style={{ gap: 4, fontWeight: 700, color: 'var(--streak-text)', fontSize: '0.88rem' }}>
          <Flame size={18} />
          {active} of 7 days practised
        </span>
      </div>
      <ul className="days" role="list">
        {days.map((d) => {
          const acted = practised.has(d);
          const logged = hasCheckinData(state.checkins[d]);
          const status = acted ? 'challenge done' : logged ? 'checked in' : 'no activity';
          return (
            <li key={d} className={d === date ? 'today' : ''}>
              <span className={`day-dot ${acted ? 'on' : logged ? 'logged' : ''}`} aria-hidden="true">
                {acted ? (
                  <Icon name="check" size={16} stroke={3} />
                ) : logged ? (
                  <svg width="10" height="10" viewBox="0 0 10 10">
                    <circle cx="5" cy="5" r="4" fill="currentColor" />
                  </svg>
                ) : null}
              </span>
              <span>
                {d === date ? 'Today' : formatDate(d, { weekday: 'short' })}
                <span className="sr-only">, {status}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="days-legend" aria-hidden="true">
        <span>
          <span className="legend-dot" /> Practised
        </span>
        <span>
          <span className="legend-dot logged" /> Checked in only
        </span>
      </p>
    </section>
  );
}
