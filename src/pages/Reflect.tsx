import { useState } from 'react';
import { useStore } from '../store';
import { navigate } from '../router';
import { challengeById } from '../data/challenges';
import { completionRate, currentWeekIndex, findWeek, previousPlannedWeek } from '../lib/program';
import { today } from '../lib/dates';
import { ProgressBar, RefList, Scale } from '../components/common';

export function Reflect() {
  const { state, update } = useStore();
  const date = today();
  const idx = currentWeekIndex(state, date) ?? 0;
  // Reflect on last week if it's unreflected, otherwise on the current week.
  const prev = previousPlannedWeek(state, idx);
  const week = prev && !prev.reflection ? prev : findWeek(state, idx) ?? prev;

  const [wentWell, setWentWell] = useState(week?.reflection?.wentWell ?? '');
  const [obstacles, setObstacles] = useState(week?.reflection?.obstacles ?? '');
  const [nextTime, setNextTime] = useState(week?.reflection?.nextTime ?? '');
  const [enjoyment, setEnjoyment] = useState<Record<string, number | undefined>>(() =>
    Object.fromEntries((week?.commitments ?? []).map((c) => [c.challengeId, c.enjoyment])),
  );

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

  function save() {
    update((s) => ({
      ...s,
      weeks: s.weeks.map((w) =>
        w.weekIndex === week!.weekIndex
          ? {
              ...w,
              commitments: w.commitments.map((c) => ({ ...c, enjoyment: enjoyment[c.challengeId] ?? c.enjoyment })),
              reflection: { date, wentWell: wentWell.trim(), obstacles: obstacles.trim(), nextTime: nextTime.trim() },
            }
          : w,
      ),
    }));
    navigate(week!.weekIndex < idx && !findWeek(state, idx) ? 'plan' : 'today');
  }

  return (
    <div>
      <h1>Reflect on week {week.weekIndex + 1}</h1>
      <div className="card">
        <ProgressBar value={rate} />
        <small>{Math.round(rate * 100)}% of targets completed</small>
        <div className="stack" style={{ marginTop: 12 }}>
          {week.commitments.map((c) => (
            <div key={c.challengeId}>
              <div className="spread" style={{ flexWrap: 'nowrap', alignItems: 'baseline' }}>
                <strong style={{ flex: 1, minWidth: 0 }}>{challengeById(c.challengeId)?.title ?? c.challengeId}</strong>
                <small style={{ whiteSpace: 'nowrap' }}>
                  {Math.min(c.completions.length, c.target)}/{c.target} done
                </small>
              </div>
              <small className="fine" style={{ marginBottom: 6 }}>How much did you enjoy it? (1 = not at all, 5 = a lot)</small>
              <Scale
                label={`Enjoyment: ${challengeById(c.challengeId)?.title ?? c.challengeId}`}
                ends={['not at all', 'a lot']}
                min={1}
                max={5}
                value={enjoyment[c.challengeId]}
                onChange={(v) => setEnjoyment({ ...enjoyment, [c.challengeId]: v })}
              />
            </div>
          ))}
        </div>
        <small style={{ display: 'block', marginTop: 8 }}>
          In one analysis of a 3-month coaching app (PEACH), people who enjoyed their practice more reported slightly
          more change over the program. So the planner will suggest the challenges you liked again and push the ones you didn't further down.
        </small>
        <RefList ids={['olaru2026']} />
      </div>

      <div className="card stack">
        <label className="field">
          <span>What went well? Which strengths did you use?</span>
          <textarea value={wentWell} onChange={(e) => setWentWell(e.target.value)} placeholder="Even small wins count." />
          <small>Starting from what's working can help you stay motivated.</small>
        </label>
        <label className="field">
          <span>What got in the way?</span>
          <textarea
            value={obstacles}
            onChange={(e) => setObstacles(e.target.value)}
            placeholder="Time, energy, forgetting, a situation you avoided…"
          />
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
        <RefList ids={['allemand2017', 'oettingen2015']} />
      </div>

      <div className="page-actions">
        <button className="primary" disabled={!wentWell.trim() && !obstacles.trim() && !nextTime.trim()} onClick={save}>
          Save reflection
        </button>
        {!wentWell.trim() && !obstacles.trim() && !nextTime.trim() && <small>Answer at least one question to save.</small>}
      </div>
    </div>
  );
}
