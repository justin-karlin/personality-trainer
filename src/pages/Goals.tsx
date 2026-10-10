import { useState } from 'react';
import { useStore } from '../store';
import { navigate } from '../router';
import type { Goal, TraitId } from '../types';
import { TRAIT_IDS } from '../types';
import { TRAITS } from '../data/traits';
import { MAX_GOALS } from '../lib/program';
import { today } from '../lib/dates';
import { RefList, traitColor } from '../components/common';

export function Goals() {
  const { state, update } = useStore();
  const [selected, setSelected] = useState<TraitId[]>(state.goals.map((g) => g.trait));
  const [why, setWhy] = useState<Record<string, string>>(Object.fromEntries(state.goals.map((g) => [g.trait, g.why])));
  const [vision, setVision] = useState<Record<string, string>>(
    Object.fromEntries(state.goals.map((g) => [g.trait, g.vision])),
  );

  function toggle(t: TraitId) {
    setSelected((sel) => (sel.includes(t) ? sel.filter((x) => x !== t) : sel.length < MAX_GOALS ? [...sel, t] : sel));
  }

  const ready = selected.length > 0 && selected.every((t) => (why[t] ?? '').trim() && (vision[t] ?? '').trim());

  function save() {
    const date = today();
    const goals: Goal[] = selected.map((t) => ({
      trait: t,
      why: why[t].trim(),
      vision: vision[t].trim(),
      createdAt: state.goals.find((g) => g.trait === t)?.createdAt ?? date,
    }));
    update((s) => ({ ...s, goals, startDate: s.startDate ?? date }));
    navigate(state.weeks.length ? 'today' : 'plan');
  }

  // A fixed order: the app does not rank traits for the user. No trait level is
  // better in every situation, and nudging people toward "ideal" levels is one
  // of the concerns raised about these programs (Haehner et al., 2026).
  const order = TRAIT_IDS;

  return (
    <div>
      <h1>What do you want to work on?</h1>
      <p className="muted">
        Pick one or two traits, as students in a weekly-challenge study were encouraged to do. In that study, students
        who completed more of their challenges reported more growth in extraversion, conscientiousness and emotional
        stability, but not in agreeableness or openness. Signing up for challenges without doing them did not help. So
        take on only what you can follow through on. You can change your goals later.
      </p>
      <RefList ids={['hudson2019']} />

      <div className="stack">
        {order.map((t) => {
          const info = TRAITS[t];
          const on = selected.includes(t);
          return (
            <div
              key={t}
              className={`card selectable ${on ? 'selected' : ''}`}
              style={{ borderLeft: `4px solid ${traitColor(t)}` }}
            >
              <label className="spread" style={{ cursor: 'pointer' }}>
                <div>
                  <h3 style={{ marginBottom: 2 }}>{info.goalName}</h3>
                  <small>{info.goalBlurb}</small>
                </div>
                <input
                  type="checkbox"
                  checked={on}
                  disabled={!on && selected.length >= MAX_GOALS}
                  onChange={() => toggle(t)}
                  aria-label={info.goalName}
                />
              </label>
              {on && (
                <div className="stack" style={{ marginTop: 14 }}>
                  <label className="field">
                    <span>Why does this matter to you?</span>
                    <textarea
                      value={why[t] ?? ''}
                      onChange={(e) => setWhy({ ...why, [t]: e.target.value })}
                      placeholder={info.whyPlaceholder}
                    />
                  </label>
                  <label className="field">
                    <span>Picture yourself 12 weeks from now. What will you be doing differently?</span>
                    <textarea
                      value={vision[t] ?? ''}
                      onChange={(e) => setVision({ ...vision, [t]: e.target.value })}
                      placeholder={info.visionPlaceholder}
                    />
                    <small>Name specific behaviours, not just feelings. Behaviour is what you can practise.</small>
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card soft" style={{ marginTop: 14 }}>
        <small>
          Why "why"? Your reason is where change begins, but wanting to change is only a starting point. In studies
          where students rated themselves every week, those who wanted to change a trait more reported slightly more
          change in it. Among people left on their own without check-ins, wanting to change mostly did not predict
          change. Commitment to the goal and actually completing weekly actions went with change more consistently than
          how much people wanted it.
        </small>
        <RefList ids={['hudson2020', 'baranski2020', 'haehner2024', 'hudson2019', 'olaru2026']} />
      </div>

      <div className="row">
        <button className="primary" disabled={!ready} onClick={save}>
          Save goals →
        </button>
        {!ready && selected.length > 0 && <small>Fill in both questions for each goal.</small>}
      </div>
    </div>
  );
}
