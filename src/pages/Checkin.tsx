import { useStore } from '../store';
import { navigate } from '../router';
import type { DailyCheckin } from '../types';
import { TRAITS } from '../data/traits';
import { today } from '../lib/dates';
import { Scale } from '../components/common';
import { Icon } from '../components/Icon';
import { hasCheckinData } from '../lib/checkin';

/** The 20-second daily check-in. Answers save as they are tapped, so leaving early loses nothing. */
export function Checkin() {
  const { state, update } = useStore();
  const date = today();
  const checkin = state.checkins[date];

  function patch(p: Partial<DailyCheckin>) {
    update((s) => {
      // Use the date at the moment of the tap, in case the screen was left open past midnight.
      const d = today();
      const cur = s.checkins[d] ?? { date: d, states: {} };
      const next = { ...cur, ...p, states: { ...cur.states, ...p.states } };
      const checkins = { ...s.checkins };
      if (hasCheckinData(next)) checkins[d] = next;
      else delete checkins[d]; // an emptied note shouldn't count as a check-in
      return { ...s, checkins };
    });
  }

  return (
    <div>
      <div className="checkin-head">
        <a className="btn ghost icon-btn back-btn" href="#/today" aria-label="Back to Today">
          <Icon name="back" size={22} stroke={2} />
        </a>
        <h1>Daily check-in</h1>
      </div>

      <div className="stack">
        {state.goals.map((g) => (
          <fieldset className="card question" key={g.trait}>
            <legend id={`q-${g.trait}`}>{TRAITS[g.trait].stateItem}</legend>
            <Scale
              label={TRAITS[g.trait].stateItem}
              labelledBy={`q-${g.trait}`}
              ends={['not at all', 'very much']}
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
          <legend id="q-mood">Mood today</legend>
          <Scale
            label="Mood today"
            labelledBy="q-mood"
            ends={['very low', 'great']}
            value={checkin?.mood}
            onChange={(v) => patch({ mood: v })}
          />
          <div className="scale-ends">
            <span>1 = very low</span>
            <span>7 = great</span>
          </div>
        </fieldset>

        <div className="card">
          <label className="field">
            <span>Note</span>
            <textarea
              value={checkin?.note ?? ''}
              onChange={(e) => patch({ note: e.target.value })}
              placeholder="What happened?"
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
