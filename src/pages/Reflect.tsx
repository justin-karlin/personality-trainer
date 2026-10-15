import { useState } from 'react';
import { useStore } from '../store';
import { navigate } from '../router';
import { challengeById } from '../data/challenges';
import { completionRate, currentWeekIndex, findWeek, previousPlannedWeek } from '../lib/program';
import { formatDate, today } from '../lib/dates';
import { summarizeWeek } from '../lib/actions';
import { ProgressBar, RefList, Scale } from '../components/common';
import { BARRIERS } from '../data/barriers';
import { planHint } from '../lib/plans';
import type { BarrierId, Commitment } from '../types';
import { WeekReview } from '../components/WeekReview';
import { buildReviewRequest, type ReviewChange } from '../lib/ai';

const NEXT_OPTIONS: { id: NonNullable<Commitment['next']>; label: string }[] = [
  { id: 'repeat', label: 'Keep it as is' },
  { id: 'change', label: 'Keep it, change the plan' },
  { id: 'drop', label: 'Drop it' },
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
        <p>Plan and try a week of challenges first. Then come back here to reflect.</p>
        <button onClick={() => navigate('plan')}>Plan this week</button>
      </div>
    );
  }

  const rate = completionRate(week);
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
        <ProgressBar value={rate} />
        <small>{Math.round(rate * 100)}% of targets met</small>
        <div className="stack" style={{ marginTop: 12 }}>
          {week.commitments.map((c) => {
            const s = summarizeWeek({ ...week, commitments: [c] }, date);
            const other = [
              s.partly && `tried part ${s.partly}×`,
              s.skipped && `skipped ${s.skipped}×`,
              s.noChance && `no chance ${s.noChance}×`,
            ].filter(Boolean);
            return (
              <div key={c.challengeId}>
                <div className="spread" style={{ flexWrap: 'nowrap', alignItems: 'baseline' }}>
                  <strong style={{ flex: 1, minWidth: 0 }}>
                    {challengeById(c.challengeId)?.title ?? c.challengeId}
                  </strong>
                  <small style={{ whiteSpace: 'nowrap' }}>
                    {Math.min(c.completions.length, c.target)}/{c.target} done
                  </small>
                </div>
                <small className="fine">
                  Plan: {c.ifThen}
                  {other.length > 0 && (
                    <>
                      <br />
                      Also logged: {other.join(', ')}.
                    </>
                  )}
                  {s.daysLogged < s.daysSoFar && (
                    <>
                      <br />
                      No entry on {s.daysSoFar - s.daysLogged} of {s.daysSoFar} days.
                    </>
                  )}
                </small>
                {c.revisions && c.revisions.length > 0 && (
                  <details>
                    <summary>Plan changed {c.revisions.length === 1 ? 'once' : `${c.revisions.length} times`}</summary>
                    <ul className="fine" style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                      {c.revisions.map((r, i) => (
                        <li key={i}>
                          {i === 0 ? 'Original' : 'Then'}: {r.ifThen}{' '}
                          <span className="muted">(changed {formatDate(r.replaced)})</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                <small className="fine" style={{ marginBottom: 6 }}>
                  How much did you enjoy it? (1 = not at all, 5 = a lot)
                </small>
                <Scale
                  label={`Enjoyment: ${challengeById(c.challengeId)?.title ?? c.challengeId}`}
                  ends={['not at all', 'a lot']}
                  min={1}
                  max={5}
                  value={enjoyment[c.challengeId]}
                  onChange={(v) => setEnjoyment({ ...enjoyment, [c.challengeId]: v })}
                />
                <small className="fine" style={{ margin: '8px 0 4px' }}>
                  Was it doable and useful? What should happen to it next week?
                </small>
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
            );
          })}
        </div>
        <small style={{ display: 'block', marginTop: 8 }}>
          Plans you keep are filled in for you next week. In one analysis of a 3-month coaching app (PEACH), people who
          enjoyed their practice more reported slightly more change, so the planner also suggests the challenges you
          liked first. That's a hint from one study's data, not a tested rule.
        </small>
        <RefList ids={['olaru2026']} />
      </div>

      <div className="card stack">
        <label className="field">
          <span>What went well? Which strengths did you use?</span>
          <textarea
            value={wentWell}
            onChange={(e) => setWentWell(e.target.value)}
            placeholder="Even small wins count."
          />
          <small>Starting from what's working can help you stay motivated.</small>
        </label>
        {ftGoal?.focus && (
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>What was the main thing in the way of “{ftGoal.focus.problem}”?</div>
            <div className="chips" role="group" aria-label="Main thing in the way" style={{ margin: '4px 0 0' }}>
              {BARRIERS.map((b) => (
                <button
                  key={b.id}
                  className="chip"
                  aria-pressed={barrier === b.id}
                  onClick={() => setBarrier(barrier === b.id ? undefined : b.id)}
                >
                  {b.label}
                </button>
              ))}
            </div>
            <small className="fine" style={{ marginTop: 4 }}>
              The planner matches next week's suggestions to this.
            </small>
          </div>
        )}
        <label className="field">
          <span>What got in the way?</span>
          <textarea
            value={obstacles}
            onChange={(e) => setObstacles(e.target.value)}
            placeholder="Time, energy, forgetting, a situation you avoided…"
          />
        </label>
        <label className="field">
          <span>Did anything backfire or cost you something? (optional)</span>
          <textarea
            rows={2}
            value={downsides}
            onChange={(e) => setDownsides(e.target.value)}
            placeholder="E.g. felt guilty about a missed day, went along with something I disagreed with, a conversation got tense"
          />
          <small>
            Practice can have costs. If something keeps backfiring, change or drop that challenge. If you feel worse
            overall, it's fine to pause (Progress → Your path), and Settings lists where to get support.
          </small>
        </label>
        <label className="field">
          <span>What will you do differently next week?</span>
          <textarea
            value={nextTime}
            onChange={(e) => setNextTime(e.target.value)}
            placeholder={'E.g. "If I feel too tired after work, then I\'ll do the 2-minute version."'}
          />
          <small>Turning an obstacle into an if-then plan is the core of the WOOP method.</small>
        </label>
        {nextTime.trim() && (
          <label className="field">
            <span>Use this as next week's plan for</span>
            <select value={applyTo} onChange={(e) => setApplyTo(e.target.value)}>
              <option value="">Don't change a plan</option>
              {week.commitments.map((c) => (
                <option key={c.challengeId} value={c.challengeId}>
                  {challengeById(c.challengeId)?.title ?? c.challengeId}
                </option>
              ))}
            </select>
            {applyTo && planHint(nextTime) ? (
              <small style={{ color: 'var(--warn)' }}>{planHint(nextTime)} You can also fix it when you plan.</small>
            ) : (
              <small>It replaces that plan's wording next week, and you can still edit it there.</small>
            )}
          </label>
        )}
        <RefList ids={['allemand2017', 'oettingen2015']} />
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
        {!canSave && <small>Answer at least one question to save.</small>}
      </div>
    </div>
  );
}
