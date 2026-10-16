import { useState } from 'react';
import { useStore } from '../store';
import { navigate } from '../router';
import type { Goal, TraitId } from '../types';
import { offeredTraits } from '../types';
import { AGREEABLENESS_NOTE, TRAITS } from '../data/traits';
import { LOW_COMMITMENT, maxGoals } from '../lib/path';
import { LOW_C } from '../lib/coach';
import { currentWeekIndex, findWeek } from '../lib/program';
import { challengeById } from '../data/challenges';
import { today } from '../lib/dates';
import { RefList, Scale, traitColor } from '../components/common';

// Short commitment check, written for this app. PEACH measured goal commitment
// with three items at baseline; these are not those items or a validated scale.
const COMMITMENT_ITEMS = [
  'This goal really matters to me.',
  'I will keep working on it even when it gets hard.',
  'I am ready to make time for it most days.',
];

const PROBLEM_EXAMPLES = ['Starting tasks I keep putting off', 'Keeping commitments I make to others', 'Finishing what I start'];

export function Goals() {
  const { state, update } = useStore();
  const date = today();
  const limit = maxGoals(state, date);
  const latestC = state.assessments[state.assessments.length - 1]?.scores.C;
  const lowC = latestC != null && latestC <= LOW_C;
  const [selected, setSelected] = useState<TraitId[]>(state.goals.map((g) => g.trait));
  const [why, setWhy] = useState<Record<string, string>>(Object.fromEntries(state.goals.map((g) => [g.trait, g.why])));
  const [vision, setVision] = useState<Record<string, string>>(
    Object.fromEntries(state.goals.map((g) => [g.trait, g.vision])),
  );
  // Follow-through goals name one concrete problem and a sign that it's getting better.
  const [problem, setProblem] = useState(state.goals.find((g) => g.trait === 'C')?.focus?.problem ?? '');
  const [better, setBetter] = useState(state.goals.find((g) => g.trait === 'C')?.focus?.better ?? '');
  // Answers changed on this visit; otherwise a saved goal shows its stored answers.
  const [commit, setCommit] = useState<Record<string, (number | undefined)[]>>({});
  const saved = (t: TraitId) => state.goals.find((g) => g.trait === t);
  const shownAnswers = (t: TraitId): (number | undefined)[] => commit[t] ?? saved(t)?.commitmentAnswers ?? [];

  function toggle(t: TraitId) {
    setSelected((sel) => (sel.includes(t) ? sel.filter((x) => x !== t) : sel.length < limit ? [...sel, t] : sel));
  }

  /** Complete answers, or null. */
  const answersOf = (t: TraitId): number[] | null => {
    const v = shownAnswers(t);
    return COMMITMENT_ITEMS.every((_, i) => v[i] != null) ? (v.slice(0, COMMITMENT_ITEMS.length) as number[]) : null;
  };
  // Goals saved before the answers were stored keep their mean until an item is changed.
  const commitmentOf = (t: TraitId): number | null => {
    const v = answersOf(t);
    if (v) return v.reduce((a, b) => a + b, 0) / v.length;
    return commit[t] ? null : (saved(t)?.commitment ?? null);
  };

  const ready =
    selected.length > 0 &&
    selected.every((t) => (why[t] ?? '').trim() && (vision[t] ?? '').trim() && commitmentOf(t) != null) &&
    (!selected.includes('C') || (problem.trim() && better.trim()));

  function save() {
    const goals: Goal[] = selected.map((t) => ({
      trait: t,
      why: why[t].trim(),
      vision: vision[t].trim(),
      createdAt: saved(t)?.createdAt ?? date,
      commitment: commitmentOf(t) ?? undefined,
      commitmentAnswers: answersOf(t) ?? undefined,
      ...(t === 'C' ? { focus: { ...saved(t)?.focus, problem: problem.trim(), better: better.trim() } } : {}),
      pathDelayDays: saved(t)?.pathDelayDays,
      pausedOn: saved(t)?.pausedOn,
    }));
    update((s) => ({ ...s, goals, startDate: s.startDate ?? date }));
    // Send people to plan when this week has no challenges for one of their goals yet.
    const idx = currentWeekIndex(state, date);
    const week = idx == null ? undefined : findWeek(state, idx);
    const planned = new Set(week?.commitments.map((c) => challengeById(c.challengeId)?.trait));
    navigate(goals.every((g) => planned.has(g.trait)) ? 'today' : 'plan');
  }

  // A fixed order: the app does not rank traits for the user. No trait level is
  // better in every situation, and nudging people toward "ideal" levels is one
  // of the concerns raised about these programs (Haehner et al., 2026).
  const order = offeredTraits(state.goals.map((g) => g.trait));

  return (
    <div>
      <h1>What do you want to work on?</h1>
      <p>
        {limit === 1
          ? 'Pick one goal to start. You can add the other later.'
          : 'You can work on both. Add the second only if the first feels settled.'}
      </p>
      {lowC && state.goals.length === 0 && (
        <p>
          Is follow-through what you struggle with most? Then it's a reasonable first goal, but pick the one that
          matters most to you.
        </p>
      )}

      <div className="stack">
        {order.map((t) => {
          const info = TRAITS[t];
          const on = selected.includes(t);
          const c = commitmentOf(t);
          return (
            <div key={t} className={`card selectable ${on ? 'selected' : ''}`}>
              <label className="row" style={{ cursor: 'pointer', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                <span className="trait-dot" style={{ background: traitColor(t), marginTop: 7 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ marginBottom: 2 }}>{info.goalName}</h3>
                  <div className="muted">{info.goalBlurb}</div>
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
                  {t === 'A' && (
                    <details>
                      <summary>What this goal means</summary>
                      <p>{AGREEABLENESS_NOTE}</p>
                    </details>
                  )}
                  {t === 'C' && (
                    <>
                      <label className="field">
                        <span>What's one task or commitment you keep putting off?</span>
                        <textarea
                          rows={2}
                          value={problem}
                          onChange={(e) => setProblem(e.target.value)}
                          placeholder="E.g. “Starting my thesis chapter” or “Replying to my team's messages on time”"
                        />
                      </label>
                      <div className="chips" role="group" aria-label="Or start from" style={{ marginTop: 8, alignItems: 'center' }}>
                        <small className="muted">Or start from:</small>
                        {PROBLEM_EXAMPLES.map((ex) => (
                          <button key={ex} type="button" className="chip" onClick={() => setProblem(ex)}>
                            {ex}
                          </button>
                        ))}
                      </div>
                      <label className="field">
                        <span>How would you know it's getting better?</span>
                        <textarea
                          rows={2}
                          value={better}
                          onChange={(e) => setBetter(e.target.value)}
                          placeholder="E.g. “I start it on the day I planned, at least 3 days a week”"
                        />
                        <small>Something you can see or count.</small>
                      </label>
                    </>
                  )}
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
                    <small>Name things you'll do, not just feelings.</small>
                  </label>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>How committed are you?</div>
                    {COMMITMENT_ITEMS.map((item, i) => (
                      <div key={item} style={{ marginBottom: 8 }}>
                        <div>{item}</div>
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
                        <p style={{ margin: 0 }}>
                          Your commitment looks lukewarm, and commitment predicted change best. Try a goal you care
                          about more, or a narrower one (one situation, one behaviour).
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <details className="card soft" style={{ marginTop: 14 }}>
        <summary>Why these questions?</summary>
        <p>
          Picking a goal isn't enough. The people who changed most were committed to their goal and did more small,
          concrete actions. How much people wanted to change mattered less.
        </p>
        <RefList ids={['olaru2026', 'hudson2019', 'hudson2020', 'baranski2020', 'haehner2024']} />
        {lowC && (
          <>
            <p>
              In two student studies, doing follow-through challenges went with growth in it even for people who hadn't
              chosen it.
            </p>
            <RefList ids={['hudson2021']} />
          </>
        )}
      </details>

      <div className="page-actions">
        <button className="primary" disabled={!ready} onClick={save}>
          Save goals →
        </button>
        {!ready && selected.length > 0 && <small>Answer the questions for each goal.</small>}
      </div>
    </div>
  );
}
