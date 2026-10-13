import { useStore } from '../store';
import { navigate } from '../router';
import type { DailyCheckin } from '../types';
import { TRAITS } from '../data/traits';
import { formatDate, today } from '../lib/dates';
import { Scale } from '../components/common';
import { Icon } from '../components/Icon';

/** The 20-second daily check-in. Answers save as they are tapped, so leaving early loses nothing. */
export function Checkin() {
  const { state, update } = useStore();
  const date = today();
  const checkin = state.checkins[date];

  function patch(p: Partial<DailyCheckin>) {
    update((s) => {
      const cur = s.checkins[date] ?? { date, states: {} };
      return { ...s, checkins: { ...s.checkins, [date]: { ...cur, ...p, states: { ...cur.states, ...p.states } } } };
    });
  }

  return (
    <div>
      <div className="checkin-head">
        <a className="btn ghost icon-btn" href="#/today" aria-label="Back to Today">
          <Icon name="back" size={22} stroke={2} />
        </a>
        <div>
          <h1>Daily check-in</h1>
          <small>{formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}</small>
        </div>
      </div>

      <div className="stack">
        {state.goals.map((g) => (
          <fieldset className="card question" key={g.trait}>
            <legend>{TRAITS[g.trait].stateItem}</legend>
            <Scale
              label={TRAITS[g.trait].stateItem}
              value={checkin?.states[g.trait]}
              onChange={(v) => patch({ states: { [g.trait]: v } })}
            />
            <div className="scale-ends">
              <span>1 = not at all</span>
              <span>7 = very much</span>
            </div>
          </fieldset>
        ))}

        <fieldset className="card question">
          <legend>Overall mood today</legend>
          <Scale label="Overall mood today" value={checkin?.mood} onChange={(v) => patch({ mood: v })} />
          <div className="scale-ends">
            <span>1 = very low</span>
            <span>7 = great</span>
          </div>
        </fieldset>

        <div className="card">
          <label className="field">
            <span>Note (optional)</span>
            <textarea
              value={checkin?.note ?? ''}
              onChange={(e) => patch({ note: e.target.value })}
              placeholder="What happened? What did you notice?"
            />
          </label>
        </div>

        <button className="primary block" onClick={() => navigate('today')}>
          Save check-in
        </button>
      </div>
    </div>
  );
}
