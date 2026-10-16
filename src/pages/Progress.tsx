import { useStore } from '../store';
import { navigate } from '../router';
import { TRAIT_IDS } from '../types';
import { TRAITS } from '../data/traits';
import { BarChart, LineChart } from '../components/Charts';
import { TraitBars } from '../components/TraitBars';
import { completionRate, isReassessmentDue } from '../lib/program';
import { addDays, formatDate, today } from '../lib/dates';
import { traitColor } from '../components/common';
import { PathTrail } from '../components/PathTrail';
import { RecentDays } from '../components/RecentDays';
import { FriendRatings } from '../components/FriendRatings';

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

      <h2 className="section-head">What you did</h2>
      <RecentDays state={state} date={date} />

      {weeks.length > 0 && (
        <section className="card">
          <h3>Targets met</h3>
          <BarChart
            title="Share of weekly targets met"
            bars={weeks.map((w) => ({ label: `W${w.weekIndex + 1}`, value: completionRate(w) }))}
            max={1}
            color="var(--accent)"
            format={(v) => `${Math.round(v * 100)}%`}
          />
        </section>
      )}

      {goalTraits.some((t) => weeklyStateAverages(state.checkins, t, weeks, date).length > 0) && (
        <h2 className="section-head">Daily ratings</h2>
      )}
      {goalTraits.map((t) => {
        const series = weeklyStateAverages(state.checkins, t, weeks, date);
        if (series.length < 1) return null;
        return (
          <section className="card" key={t}>
            <h3>
              <span className="trait-dot" style={{ background: traitColor(t), marginRight: 8, verticalAlign: 'middle' }} />
              {TRAITS[t].goalShort} (1–7)
            </h3>
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

      <h2 className="section-head">Questionnaire scores</h2>
      <section className="card">
        <p className="muted" style={{ marginTop: 0 }}>
          {state.assessments.length > 1 ? `Thin line = ${formatDate(first.date)}. ` : ''}Expect small changes.
        </p>
        {latest && <TraitBars scores={latest.scores} baseline={state.assessments.length > 1 ? first.scores : undefined} percentiles={false} />}
        <button
          className={`block ${isReassessmentDue(state, date) ? 'primary' : ''}`}
          style={{ marginTop: 12 }}
          onClick={() => navigate('assess')}
        >
          Retake questionnaire
        </button>
      </section>

      {state.assessments.length > 1 && (
        <section>
          <h3>Over time</h3>
          <div className="grid-2">
            {orderedTraits.map((t) => (
              <div className="card" key={t} style={{ marginBottom: 0 }}>
                <div className="row" style={{ gap: 6, marginBottom: 4 }}>
                  <span className="trait-dot" style={{ background: traitColor(t) }} />
                  <strong>{TRAITS[t].name}</strong>
                  {goalTraits.includes(t) && <span className="pill">Goal</span>}
                  <span className="muted" style={{ marginLeft: 'auto' }}>
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

      <FriendRatings />
    </div>
  );
}

function delta(d: number): string {
  if (Math.abs(d) < 0.05) return 'no change';
  return `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}`;
}

/** Weekly means of one daily rating. */
function weeklyStateAverages(
  checkins: Record<string, { states: Partial<Record<string, number>> }>,
  trait: string,
  weeks: { weekIndex: number; startDate: string }[],
  date: string,
) {
  type Point = { label: string; value: number };
  return weeks
    .map((w): Point | null => {
      const days = Array.from({ length: 7 }, (_, d) => addDays(w.startDate, d)).filter((d) => d <= date);
      const vals = days.map((d) => checkins[d]?.states[trait]).filter((v): v is number => v != null);
      if (!vals.length) return null;
      return { label: `W${w.weekIndex + 1}`, value: vals.reduce((a, b) => a + b, 0) / vals.length };
    })
    .filter((p): p is Point => p != null);
}
