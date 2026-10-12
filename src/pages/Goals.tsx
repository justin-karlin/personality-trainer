import { useState } from 'react';
import { useStore } from '../store';
import { navigate } from '../router';
import type { Goal, TraitId } from '../types';
import { TRAIT_IDS } from '../types';
import { TRAITS } from '../data/traits';
import { LOW_COMMITMENT, maxGoals } from '../lib/path';
import { today } from '../lib/dates';
import { RefList, Scale, traitColor } from '../components/common';

// Short commitment check, written for this app. PEACH measured goal commitment
// with three items at baseline; these are not those items or a validated scale.
const COMMITMENT_ITEMS = [
  'This goal really matters to me.',
  'I will keep working on it even when it gets hard.',
  'I am ready to make time for it most days.',
];

export function Goals() {
  const { state, update } = useStore();
  const date = today();
  const limit = maxGoals(state, date);
  const [selected, setSelected] = useState<TraitId[]>(state.goals.map((g) => g.trait));
  const [why, setWhy] = useState<Record<string, string>>(Object.fromEntries(state.goals.map((g) => [g.trait, g.why])));
  const [vision, setVision] = useState<Record<string, string>>(
    Object.fromEntries(state.goals.map((g) => [g.trait, g.vision])),
  );
  // Answers given on this visit. A saved goal keeps its stored score until one
  // of its items is changed, so re-saving doesn't alter it by rounding.
  const [commit, setCommit] = useState<Record<string, (number | undefined)[]>>({});
  const savedCommitment = (t: TraitId) => state.goals.find((g) => g.trait === t)?.commitment;
  const shownAnswers = (t: TraitId): (number | undefined)[] => {
    if (commit[t]) return commit[t];
    const saved = savedCommitment(t);
    return COMMITMENT_ITEMS.map(() => (saved != null ? Math.round(saved) : undefined));
  };

  function toggle(t: TraitId) {
    setSelected((sel) => (sel.includes(t) ? sel.filter((x) => x !== t) : sel.length < limit ? [...sel, t] : sel));
  }

  const commitmentOf = (t: TraitId): number | null => {
    const v = commit[t];
    if (!v) return savedCommitment(t) ?? null;
    if (COMMITMENT_ITEMS.some((_, i) => v[i] == null)) return null;
    return v.reduce((a, b) => a! + b!, 0)! / COMMITMENT_ITEMS.length;
  };

  const ready =
    selected.length > 0 &&
    selected.every((t) => (why[t] ?? '').trim() && (vision[t] ?? '').trim() && commitmentOf(t) != null);

  function save() {
    const goals: Goal[] = selected.map((t) => ({
      trait: t,
      why: why[t].trim(),
      vision: vision[t].trim(),
      createdAt: state.goals.find((g) => g.trait === t)?.createdAt ?? date,
      commitment: commitmentOf(t) ?? undefined,
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
        {limit === 1
          ? 'Start with one trait. Once it reaches the consolidation stage of your path, you can add a second.'
          : 'You can work on up to two traits now. Add the second only if the first feels settled.'}{' '}
        In the studies, picking a goal wasn't enough. The people who changed most were more committed to it and completed
        more small, concrete actions. For emotional stability, it also mattered that people chose the goal themselves.
      </p>
      <RefList ids={['olaru2026', 'hudson2019', 'hudson2021', 'roberts2017']} />

      <div className="stack">
        {order.map((t) => {
          const info = TRAITS[t];
          const on = selected.includes(t);
          const c = commitmentOf(t);
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
                  disabled={!on && selected.length >= limit}
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
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>How committed are you?</div>
                    {COMMITMENT_ITEMS.map((item, i) => (
                      <div key={item} style={{ marginBottom: 8 }}>
                        <small>{item}</small>
                        <Scale
                          label={item}
                          min={1}
                          max={5}
                          value={shownAnswers(t)[i]}
                          onChange={(v) => {
                            const next = [...shownAnswers(t)];
                            next[i] = v;
                            setCommit({ ...commit, [t]: next });
                          }}
                        />
                      </div>
                    ))}
                    <div className="spread">
                      <small>1 = not at all</small>
                      <small>5 = completely</small>
                    </div>
                    {c != null && c <= LOW_COMMITMENT && (
                      <div className="card tip warn" style={{ margin: '8px 0 0', padding: 12 }}>
                        <small>
                          Your commitment looks lukewarm. In a large app study, commitment to the goal was the one
                          predictor linked to change on every measure, including ratings by friends and family, while how
                          much people wanted to change showed up only in their own ratings. Consider a trait you care
                          about more, or a narrower goal (one situation, one behaviour).
                        </small>
                        <RefList ids={['olaru2026']} />
                      </div>
                    )}
                  </div>
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
        {!ready && selected.length > 0 && <small>Answer the questions for each goal.</small>}
      </div>
    </div>
  );
}
