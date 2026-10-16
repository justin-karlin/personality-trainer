import { useState } from 'react';
import { useStore } from '../store';
import { navigate } from '../router';
import { challengeById } from '../data/challenges';
import { currentWeekIndex, findWeek, previousPlannedWeek } from '../lib/program';
import { today } from '../lib/dates';
import { Scale } from '../components/common';
import { BARRIERS } from '../data/barriers';
import { planHint } from '../lib/plans';
import type { BarrierId, Commitment } from '../types';
import { WeekReview } from '../components/WeekReview';
import { buildReviewRequest, type ReviewChange } from '../lib/ai';

const NEXT_OPTIONS: { id: NonNullable<Commitment['next']>; label: string }[] = [
  { id: 'repeat', label: 'Keep' },
  { id: 'change', label: 'Change' },
  { id: 'drop', label: 'Drop' },
];

export function Reflect() {
  const { state, update } = useStore();
  const date = today();
  const idx = currentWeekIndex(state, date) ?? 0;
  // Reflect on last week if it's unreflected, otherwise on the current week.
  const prev = previousPlannedWeek(state, idx);
  const week = prev && !prev.reflection ? prev : (findWeek(state, idx) ?? prev);

  const [wentWell, setWentWell] = useState(week?.reflection?.wentWell ?? '');
  const [obstacles, setObstacles] = useState(week?.reflection?.obstacles ?? '');
  const [nextTime, setNextTime] = useState(week?.reflection?.nextTime ?? '');
  const [downsides, setDownsides] = useState(week?.reflection?.downsides ?? '');
  const [enjoyment, setEnjoyment] = useState<Record<string, number | undefined>>(() =>
    Object.fromEntries((week?.commitments ?? []).map((c) => [c.challengeId, c.enjoyment])),
  );
  const [next, setNext] = useState<Record<string, Commitment['next']>>(() =>
    Object.fromEntries((week?.commitments ?? []).map((c) => [c.challengeId, c.next])),
  );
  const [applyTo, setApplyTo] = useState(week?.reflection?.applyTo ?? '');
  // Weekly-review suggestions the person accepted, by plan.
  const [accepted, setAccepted] = useState<Record<string, ReviewChange | undefined>>({});
  const ftGoal = state.goals.find((g) => g.trait === 'C' && g.focus);
  const [barrier, setBarrier] = useState<BarrierId | undefined>(ftGoal?.focus?.barrier);

  if (!week) {
    return (
      <div>
        <h1>Weekly reflection</h1>
        <p>Plan and try a week first.</p>
        <button onClick={() => navigate('plan')}>Plan this week</button>
      </div>
    );
  }

  const canSave = !!(wentWell.trim() || obstacles.trim() || nextTime.trim() || Object.values(accepted).some(Boolean));

  function save() {
    update((s) => ({
      ...s,
      weeks: s.weeks.map((w) =>
        w.weekIndex === week!.weekIndex
          ? {
              ...w,
              commitments: w.commitments.map((c) => {
                const a = accepted[c.challengeId];
                return {
                  ...c,
                  enjoyment: enjoyment[c.challengeId] ?? c.enjoyment,
                  next: next[c.challengeId] ?? c.next,
                  ...(a?.ifThen ? { nextIfThen: a.ifThen } : {}),
                  ...(a?.target != null ? { nextTarget: a.target } : {}),
                };
              }),
              reflection: {
                date,
                wentWell: wentWell.trim(),
                obstacles: obstacles.trim(),
                nextTime: nextTime.trim(),
                applyTo: nextTime.trim() && applyTo ? applyTo : undefined,
                downsides: downsides.trim() || undefined,
              },
            }
          : w,
      ),
      goals: s.goals.map((g) => (g === ftGoal && g.focus ? { ...g, focus: { ...g.focus, barrier } } : g)),
    }));
    navigate(week!.weekIndex < idx && !findWeek(state, idx) ? 'plan' : 'today');
  }

  return (
    <div>
      <h1>Reflect on week {week.weekIndex + 1}</h1>
      <div className="card">
        <div className="stack">
          {week.commitments.map((c) => (
            <div key={c.challengeId} className="challenge-block">
              <div className="spread" style={{ flexWrap: 'nowrap', alignItems: 'baseline' }}>
                <strong style={{ flex: 1, minWidth: 0 }}>
                  {challengeById(c.challengeId)?.title ?? c.challengeId}
                </strong>
                <span className="muted" style={{ whiteSpace: 'nowrap' }}>
                  {Math.min(c.completions.length, c.target)}/{c.target} done
                </span>
              </div>
              <p style={{ margin: '8px 0 6px' }}>Enjoyed it?</p>
              <Scale
                label={`Enjoyment: ${challengeById(c.challengeId)?.title ?? c.challengeId}`}
                ends={['not at all', 'a lot']}
                min={1}
                max={5}
                value={enjoyment[c.challengeId]}
                onChange={(v) => setEnjoyment({ ...enjoyment, [c.challengeId]: v })}
              />
              <div className="scale-ends">
                <span>1 = not at all</span>
                <span>5 = a lot</span>
              </div>
              <p style={{ margin: '8px 0 4px' }}>Next week</p>
              <div
                className="chips"
                role="group"
                aria-label={`Next week: ${challengeById(c.challengeId)?.title ?? c.challengeId}`}
                style={{ margin: 0 }}
              >
                {NEXT_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    className="chip"
                    aria-pressed={next[c.challengeId] === o.id}
                    onClick={() =>
                      setNext({ ...next, [c.challengeId]: next[c.challengeId] === o.id ? undefined : o.id })
                    }
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card stack">
        <label className="field">
          <span>What went well?</span>
          <textarea
            value={wentWell}
            onChange={(e) => setWentWell(e.target.value)}
            placeholder="Small wins count."
          />
        </label>
        {ftGoal?.focus && (
          <label className="field">
            <span>Main obstacle</span>
            <select value={barrier ?? ''} onChange={(e) => setBarrier((e.target.value || undefined) as BarrierId | undefined)}>
              <option value="">Choose one</option>
              {BARRIERS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          <span>What got in the way?</span>
          <textarea
            value={obstacles}
            onChange={(e) => setObstacles(e.target.value)}
            placeholder="Time, energy, forgetting…"
          />
        </label>
        <label className="field">
          <span>Anything backfire?</span>
          <textarea
            rows={2}
            value={downsides}
            onChange={(e) => setDownsides(e.target.value)}
            placeholder="E.g. felt guilty"
          />
        </label>
        <p className="muted" style={{ margin: 0 }}>
          Feeling worse? <a href="#/progress">Pause</a> or <a href="#/settings">get support</a>.
        </p>
        <label className="field">
          <span>What will you change?</span>
          <textarea
            value={nextTime}
            onChange={(e) => setNextTime(e.target.value)}
            placeholder={'E.g. "If I\'m tired, then I\'ll do 2 minutes."'}
          />
        </label>
        {nextTime.trim() && (
          <label className="field">
            <span>Use as the plan for</span>
            <select value={applyTo} onChange={(e) => setApplyTo(e.target.value)}>
              <option value="">Don't change a plan</option>
              {week.commitments.map((c) => (
                <option key={c.challengeId} value={c.challengeId}>
                  {challengeById(c.challengeId)?.title ?? c.challengeId}
                </option>
              ))}
            </select>
            {applyTo && planHint(nextTime) && (
              <small style={{ color: 'var(--warn)' }}>{planHint(nextTime)}</small>
            )}
          </label>
        )}
      </div>

      <WeekReview
        commitments={week.commitments}
        build={(depth) => buildReviewRequest(state, week, { wentWell, obstacles, nextTime, downsides }, date, depth)}
        applied={accepted}
        onApply={(change, planId) => {
          setAccepted({ ...accepted, [planId]: change });
          // Accepting a suggestion is a decision about next week, shown in the chips above.
          if (change) setNext({ ...next, [planId]: change.kind === 'drop' ? 'drop' : 'change' });
        }}
        onClear={() => setAccepted({})}
      />

      <div className="page-actions">
        <button
          className="primary"
          disabled={!canSave}
          onClick={save}
        >
          Save reflection
        </button>
        {!canSave && <small>Answer one question to save.</small>}
      </div>
    </div>
  );
}
