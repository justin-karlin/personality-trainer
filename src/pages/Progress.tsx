import { useStore } from '../store';
import { navigate } from '../router';
import { TRAIT_IDS } from '../types';
import { TRAITS } from '../data/traits';
import { BarChart, LineChart } from '../components/Charts';
import { TraitBars } from '../components/TraitBars';
import { completionRate, isReassessmentDue, totalCompletions } from '../lib/program';
import { addDays, formatDate, today } from '../lib/dates';
import { traitColor } from '../components/common';
import { PathTrail } from '../components/PathTrail';
import { RecentDays } from '../components/RecentDays';

export function Progress() {
  const { state } = useStore();
  const date = today();
  const first = state.assessments[0];
  const latest = state.assessments[state.assessments.length - 1];
  const goalTraits = state.goals.map((g) => g.trait);
  const orderedTraits = [...goalTraits, ...TRAIT_IDS.filter((t) => !goalTraits.includes(t))];
  const weeks = [...state.weeks].sort((a, b) => a.weekIndex - b.weekIndex);

  return (
    <div>
      <h1>Progress</h1>
      <PathTrail state={state} date={date} />
      <RecentDays state={state} date={date} />

      <section className="card">
        <div className="spread">
          <h2 style={{ margin: 0 }}>Trait scores</h2>
          <button className={isReassessmentDue(state, date) ? 'primary' : ''} onClick={() => navigate('assess')}>
            Retake questionnaire
          </button>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          {state.assessments.length > 1
            ? `Change since ${formatDate(first.date)}. The thin line marks where you started. Expect small, slow shifts. In studies of structured programs lasting about 10 weeks, people's self-ratings of the targeted trait moved toward their goal by a small amount on average. By our estimate, that is roughly 0.1 to 0.2 points on this 1–5 scale. In the few studies that checked later, the change seemed to last. Scores also bounce a little between retakes and can dip, so watch the trend across several.`
            : 'Retake the questionnaire every 4 weeks to see how your scores move.'}
        </p>
        {latest && <TraitBars scores={latest.scores} baseline={state.assessments.length > 1 ? first.scores : undefined} />}
      </section>

      {state.assessments.length > 1 && (
        <section>
          <h2>Over time</h2>
          <div className="grid-2">
            {orderedTraits.map((t) => (
              <div className="card" key={t} style={{ marginBottom: 0 }}>
                <div className="row" style={{ gap: 6, marginBottom: 4 }}>
                  <span className="trait-dot" style={{ background: traitColor(t) }} />
                  <strong>{TRAITS[t].name}</strong>
                  {goalTraits.includes(t) && <span className="pill">Goal</span>}
                  <span className="muted" style={{ marginLeft: 'auto', fontSize: '0.85rem' }}>
                    {delta(latest.scores[t] - first.scores[t])}
                  </span>
                </div>
                <LineChart
                  title={`${TRAITS[t].name} score by assessment date`}
                  points={state.assessments.map((a) => ({ label: formatDate(a.date), value: a.scores[t] }))}
                  min={1}
                  max={5}
                  ticks={[1, 3, 5]}
                  color={traitColor(t)}
                  height={120}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {weeks.length > 0 && (
        <section className="card" style={{ marginTop: 14 }}>
          <h2>Follow-through by week</h2>
          <p className="muted">Share of weekly challenge targets you completed.</p>
          <BarChart
            title="Weekly challenge completion"
            bars={weeks.map((w) => ({ label: `W${w.weekIndex + 1}`, value: completionRate(w) }))}
            max={1}
            color="var(--accent)"
            format={(v) => `${Math.round(v * 100)}%`}
          />
        </section>
      )}

      {weeks.length > 0 && (
        <section className="card">
          <h2>Practice per week</h2>
          <p className="muted">
            Every completed challenge, including extra repetitions. In the studies, people who practised more often
            reported more growth.
          </p>
          <BarChart
            title="Completed challenges per week"
            bars={weeks.map((w) => ({ label: `W${w.weekIndex + 1}`, value: totalCompletions(w) }))}
            max={Math.ceil(Math.max(8, ...weeks.map(totalCompletions)) / 2) * 2}
            color="var(--accent)"
            format={(v) => String(Math.round(v))}
          />
        </section>
      )}

      {goalTraits.map((t) => {
        const series = weeklyStateAverages(state.checkins, t, weeks);
        if (series.length < 1) return null;
        return (
          <section className="card" key={t}>
            <h2>
              <span className="trait-dot" style={{ background: traitColor(t), marginRight: 8, verticalAlign: 'middle' }} />
              Daily ratings: {TRAITS[t].goalShort.toLowerCase()}
            </h2>
            <p className="muted">Weekly average of "{TRAITS[t].stateItem}" (1–7).</p>
            <LineChart
              title={`Weekly average daily rating for ${TRAITS[t].name}`}
              points={series}
              min={1}
              max={7}
              ticks={[1, 4, 7]}
              color={traitColor(t)}
            />
          </section>
        );
      })}
    </div>
  );
}

function delta(d: number): string {
  if (Math.abs(d) < 0.05) return 'no change';
  return `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}`;
}

function weeklyStateAverages(
  checkins: Record<string, { states: Partial<Record<string, number>> }>,
  trait: string,
  weeks: { weekIndex: number; startDate: string }[],
) {
  return weeks
    .map((w) => {
      const vals = Array.from({ length: 7 }, (_, d) => checkins[addDays(w.startDate, d)]?.states[trait]).filter(
        (v): v is number => v != null,
      );
      if (!vals.length) return null;
      return { label: `W${w.weekIndex + 1}`, value: vals.reduce((a, b) => a + b, 0) / vals.length };
    })
    .filter((p): p is { label: string; value: number } => p != null);
}
