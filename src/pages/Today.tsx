import { useStore } from '../store';
import { navigate } from '../router';
import type { DailyCheckin, TraitId } from '../types';
import { CHALLENGES, challengeById } from '../data/challenges';
import { TRAITS } from '../data/traits';
import { coachTips } from '../lib/coach';
import {
  completionRate,
  completionsByTrait,
  currentWeekIndex,
  findWeek,
  isProgramComplete,
  weekStart,
} from '../lib/program';
import { addDays, daysBetween, formatDate, today } from '../lib/dates';
import { ProgressBar, RefList, Scale, TraitTag } from '../components/common';

export function Today() {
  const { state, update } = useStore();
  const date = today();
  const idx = currentWeekIndex(state, date) ?? 0;
  const week = findWeek(state, idx);
  const tips = coachTips(state, date);
  const checkin = state.checkins[date];
  const dayOfWeek = daysBetween(weekStart(state, idx), date);
  const done = completionsByTrait(week, CHALLENGES);

  function toggleDone(challengeId: string) {
    update((s) => ({
      ...s,
      weeks: s.weeks.map((w) =>
        w.weekIndex !== idx
          ? w
          : {
              ...w,
              commitments: w.commitments.map((c) =>
                c.challengeId !== challengeId
                  ? c
                  : {
                      ...c,
                      completions: c.completions.includes(date)
                        ? c.completions.filter((d) => d !== date)
                        : [...c.completions, date],
                    },
              ),
            },
      ),
    }));
  }

  function patchCheckin(p: Partial<DailyCheckin>) {
    update((s) => {
      const cur = s.checkins[date] ?? { date, states: {} };
      return { ...s, checkins: { ...s.checkins, [date]: { ...cur, ...p, states: { ...cur.states, ...p.states } } } };
    });
  }

  return (
    <div>
      <div className="spread">
        <div>
          <h1 style={{ marginBottom: 0 }}>{formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}</h1>
          <small>
            Week {idx + 1} of {state.programWeeks} · day {dayOfWeek + 1}
          </small>
        </div>
      </div>

      <div className="card soft" style={{ marginTop: 14 }}>
        {state.goals.map((g) => (
          <div key={g.trait} style={{ marginBottom: 6 }}>
            <div className="spread">
              <TraitTag trait={g.trait} goal />
              <small>
                {done[g.trait] ?? 0} done this week
              </small>
            </div>
            <small className="muted">Why: {g.why}</small>
          </div>
        ))}
        <small>
          Count every time you practise. In the studies, people who did their challenges more often reported more
          growth.
        </small>
        <RefList ids={['hudson2019', 'hudson2021']} />
      </div>

      {isProgramComplete(state, date) && (
        <div className="card tip success" style={{ marginTop: 16 }}>
          <h3>You've completed the {state.programWeeks}-week program</h3>
          <p>
            Retake the questionnaire to see where you are now, then keep one favourite challenge per goal going. In a
            one-year follow-up of a coaching app, people's gains in extraversion and conscientiousness held without
            growing further, and neuroticism kept falling, among the 1 in 10 who answered again. The app will suggest
            another retake in about 3 months.
          </p>
          <RefList ids={['stieger2024']} />
          <button onClick={() => navigate('assess')}>Retake questionnaire</button>
        </div>
      )}

      <section style={{ marginTop: 18 }}>
        <div className="spread">
          <h2 style={{ margin: 0 }}>This week's challenges</h2>
          {week && (
            <button className="ghost" onClick={() => navigate('plan')}>
              Edit plan
            </button>
          )}
        </div>
        {week ? (
          <>
            <div style={{ margin: '8px 0 14px' }}>
              <ProgressBar value={completionRate(week)} />
              <small>{Math.round(completionRate(week) * 100)}% of this week's targets done</small>
            </div>
            <div className="stack">
              {week.commitments.map((c) => {
                const ch = challengeById(c.challengeId);
                if (!ch) return null;
                const doneToday = c.completions.includes(date);
                return (
                  <div className="card" key={c.challengeId} style={{ marginBottom: 0 }}>
                    <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                      <button
                        className={`check ${doneToday ? 'on' : ''}`}
                        onClick={() => toggleDone(c.challengeId)}
                        aria-pressed={doneToday}
                        aria-label={doneToday ? `Undo: ${ch.title}` : `Mark done today: ${ch.title}`}
                      >
                        {doneToday ? '✓' : ''}
                      </button>
                      <div style={{ flex: 1 }}>
                        <div className="spread">
                          <strong>{ch.title}</strong>
                          <small>
                            {c.completions.length}/{c.target} this week
                          </small>
                        </div>
                        <div style={{ fontSize: '0.92rem' }}>
                          <span className="muted">Plan:</span> {c.ifThen}
                        </div>
                        <details style={{ marginTop: 4 }}>
                          <summary style={{ fontSize: '0.85rem' }}>How to do it</summary>
                          <p style={{ fontSize: '0.92rem', marginTop: 6 }}>{ch.instructions}</p>
                        </details>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="card">
            <p>You haven't planned this week yet.</p>
            <button className="primary" onClick={() => navigate('plan')}>
              Plan week {idx + 1}
            </button>
          </div>
        )}
      </section>

      <section style={{ marginTop: 22 }}>
        <h2>Daily check-in</h2>
        <div className="card stack">
          {state.goals.map((g) => (
            <StateRating
              key={g.trait}
              trait={g.trait}
              value={checkin?.states[g.trait]}
              onChange={(v) => patchCheckin({ states: { [g.trait]: v } })}
            />
          ))}
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Overall mood today</div>
            <Scale label="Mood" value={checkin?.mood} onChange={(v) => patchCheckin({ mood: v })} />
            <div className="spread">
              <small>1 = very low</small>
              <small>7 = great</small>
            </div>
          </div>
          <label className="field">
            <span>Note (optional)</span>
            <textarea
              value={checkin?.note ?? ''}
              onChange={(e) => patchCheckin({ note: e.target.value })}
              placeholder="What happened? What did you notice?"
            />
          </label>
        </div>
      </section>

      {tips.length > 0 && (
        <section style={{ marginTop: 22 }}>
          <h2>Coach</h2>
          {tips.map((t) => (
            <div key={t.id} className={`card tip ${t.tone}`}>
              <h3>{t.title}</h3>
              <p>{t.body}</p>
              {t.refs && <RefList ids={t.refs} />}
              {t.action && (
                <button style={{ marginTop: 8 }} onClick={() => navigate(t.action!.route)}>
                  {t.action.label}
                </button>
              )}
            </div>
          ))}
        </section>
      )}

      <RecentDays />
    </div>
  );
}

function StateRating({ trait, value, onChange }: { trait: TraitId; value?: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{TRAITS[trait].stateItem}</div>
      <Scale label={TRAITS[trait].stateItem} value={value} onChange={onChange} />
      <div className="spread">
        <small>1 = not at all</small>
        <small>7 = very much</small>
      </div>
    </div>
  );
}

/** A compact 7-day strip so people can see their streak of activity. */
function RecentDays() {
  const { state } = useStore();
  const date = today();
  const days = Array.from({ length: 7 }, (_, i) => addDays(date, i - 6));
  const allCompletions = new Set(state.weeks.flatMap((w) => w.commitments.flatMap((c) => c.completions)));
  return (
    <section style={{ marginTop: 22 }}>
      <h3>Last 7 days</h3>
      <div className="row" style={{ gap: 6 }}>
        {days.map((d) => {
          const acted = allCompletions.has(d);
          const logged = !!state.checkins[d];
          return (
            <div
              key={d}
              title={`${formatDate(d)}: ${acted ? 'challenge done' : 'no challenge'}${logged ? ', checked in' : ''}`}
              style={{
                flex: 1,
                minWidth: 36,
                textAlign: 'center',
                padding: '6px 0',
                borderRadius: 10,
                background: acted ? 'var(--success-soft)' : 'var(--surface-2)',
                color: acted ? 'var(--success)' : 'var(--muted)',
                fontSize: '0.8rem',
                border: d === date ? '1px solid var(--accent)' : '1px solid transparent',
              }}
            >
              <div>{formatDate(d, { weekday: 'narrow' })}</div>
              <div>{acted ? '●' : logged ? '○' : '·'}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
