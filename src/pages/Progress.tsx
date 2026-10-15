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
import { summarizeWeek } from '../lib/actions';
import type { WeekPlan } from '../types';

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
      <p className="muted">
        Each section measures something different: what you did, how you rated your days, your questionnaire scores,
        and how others see you. They're related, but one can't stand in for another.
      </p>
      <PathTrail state={state} date={date} />

      <h2 className="section-head">What you did</h2>
      <RecentDays state={state} date={date} />

      {weeks.length > 0 && <ActionRecord weeks={weeks} date={date} />}

      {weeks.length > 0 && (
        <section className="card">
          <h3>Targets met by week</h3>
          <p className="muted">Days you did a planned action, as a share of that week's targets.</p>
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
        <h2 className="section-head">How you rated your days</h2>
      )}
      {goalTraits.map((t) => {
        const series = weeklyStateAverages(state.checkins, t, weeks, date);
        if (series.length < 1) return null;
        const rated = series.reduce((n, p) => n + p.days, 0);
        const possible = series.reduce((n, p) => n + p.of, 0);
        return (
          <section className="card" key={t}>
            <h3>
              <span className="trait-dot" style={{ background: traitColor(t), marginRight: 8, verticalAlign: 'middle' }} />
              Daily check-ins: {TRAITS[t].goalShort.toLowerCase()}
            </h3>
            <p className="muted">
              Weekly average of "{TRAITS[t].stateItem}" (1–7). A quick self-rating of each day, not a personality
              score. Based on {rated} of {possible} days; days without a check-in are left out.
            </p>
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
        <div className="spread">
          <h3 style={{ margin: 0 }}>Your answers, scored</h3>
          <button className={isReassessmentDue(state, date) ? 'primary' : ''} onClick={() => navigate('assess')}>
            Retake questionnaire
          </button>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          The app's personality measure: the 50-item IPIP questionnaire, scored 1–5 from your own answers.{' '}
          {state.assessments.length > 1
            ? `Change since ${formatDate(first.date)}. The thin line marks where you started. Expect small, slow shifts. In studies of structured programs lasting about 10 weeks, people's self-ratings of the targeted trait moved toward their goal by a small amount on average, measured before and after rather than against a control group. By our estimate, that is roughly 0.1 to 0.2 points on this 1–5 scale. In the few studies that checked later, the change seemed to last. Scores also bounce a little between retakes and can dip, so watch the trend across several.`
            : 'Retake it every 4 weeks to see how your scores move.'}
        </p>
        {latest && <TraitBars scores={latest.scores} baseline={state.assessments.length > 1 ? first.scores : undefined} />}
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

      <FriendRatings />
    </div>
  );
}

/** A week-by-week table of logged outcomes, with how many days have any record. */
function ActionRecord({ weeks, date }: { weeks: WeekPlan[]; date: string }) {
  const rows = weeks.filter((w) => w.startDate <= date).map((w) => ({ w, s: summarizeWeek(w, date) }));
  const anyLegacy = rows.some((r) => r.s.legacy > 0);
  return (
    <section className="card">
      <h3>Your action record</h3>
      <p className="muted">
        What you logged for your planned actions each week. "Days logged" counts days with any entry; the rest have no
        record.
      </p>
      <div className="table-scroll">
        <table className="ratings action-table">
          <thead>
            <tr>
              <th scope="col">Week</th>
              <th scope="col">Done</th>
              <th scope="col">Tried</th>
              <th scope="col">Skipped</th>
              <th scope="col">No chance</th>
              <th scope="col">Days logged</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ w, s }) => {
              const onlyLegacy = s.legacy > 0 && s.legacy === s.done && s.partly + s.skipped + s.noChance === 0;
              return (
                <tr key={w.weekIndex}>
                  <th scope="row">W{w.weekIndex + 1}</th>
                  <td>
                    {s.done}
                    {s.legacy > 0 && '*'}
                  </td>
                  <td>{onlyLegacy ? '–' : s.partly}</td>
                  <td>{onlyLegacy ? '–' : s.skipped}</td>
                  <td>{onlyLegacy ? '–' : s.noChance}</td>
                  <td>
                    {s.daysLogged} of {s.daysSoFar}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {anyLegacy && (
        <small className="fine">
          * Includes practice days logged before the app recorded what happened on other days. Those older entries only
          say a challenge was practised that day; they don't record tries, skips or missed chances.
        </small>
      )}
    </section>
  );
}

function delta(d: number): string {
  if (Math.abs(d) < 0.05) return 'no change';
  return `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}`;
}

/** Weekly means of one daily rating, with how many of the week's days (so far) were rated. */
function weeklyStateAverages(
  checkins: Record<string, { states: Partial<Record<string, number>> }>,
  trait: string,
  weeks: { weekIndex: number; startDate: string }[],
  date: string,
) {
  type Point = { label: string; value: number; days: number; of: number };
  return weeks
    .map((w): Point | null => {
      const days = Array.from({ length: 7 }, (_, d) => addDays(w.startDate, d)).filter((d) => d <= date);
      const vals = days.map((d) => checkins[d]?.states[trait]).filter((v): v is number => v != null);
      if (!vals.length) return null;
      return { label: `W${w.weekIndex + 1}`, value: vals.reduce((a, b) => a + b, 0) / vals.length, days: vals.length, of: days.length };
    })
    .filter((p): p is Point => p != null);
}
