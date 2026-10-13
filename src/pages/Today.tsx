import type { ReactNode } from 'react';
import { useStore } from '../store';
import { navigate } from '../router';
import { CHALLENGES, challengeById } from '../data/challenges';
import { TRAITS } from '../data/traits';
import { LOW_C, coachTips, type Tip } from '../lib/coach';
import { completionsByTrait, currentWeekIndex, findWeek, isProgramComplete } from '../lib/program';
import { STAGES, currentStage, goalWeek, primaryGoal } from '../lib/path';
import { hasCheckinData } from '../lib/checkin';
import { formatDate, today } from '../lib/dates';
import { RefList } from '../components/common';
import { FollowThroughKit } from '../components/FollowThroughKit';
import { Flame, Icon, type IconName } from '../components/Icon';

const TIP_ICON: Record<Tip['tone'], IconName> = { info: 'bulb', success: 'party', warn: 'alert', care: 'heart' };

export function Today() {
  const { state, update } = useStore();
  const date = today();
  const idx = currentWeekIndex(state, date) ?? 0;
  const week = findWeek(state, idx);
  // The check-in prompt card below replaces the coach's own check-in reminder.
  const tips = coachTips(state, date).filter((t) => t.id !== 'checkin');
  const checkin = hasCheckinData(state.checkins[date]) ? state.checkins[date] : undefined;
  const done = completionsByTrait(week, CHALLENGES);
  const latestC = state.assessments[state.assessments.length - 1]?.scores.C;
  const lowC = latestC != null && latestC <= LOW_C;
  const stage = STAGES.find((s) => s.id === currentStage(state, date));
  const complete = isProgramComplete(state, date);
  // The header follows the same path as the stage label: the first goal's own weeks.
  const primary = primaryGoal(state);
  const pathWeek = primary ? goalWeek(primary, date) + 1 : idx + 1;
  const weekNo = Math.min(pathWeek, state.programWeeks);

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

  return (
    <div>
      <header className="today-head">
        <div style={{ minWidth: 0 }}>
          <h1>{formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}</h1>
          <p>
            {complete ? 'Maintenance' : pathWeek > state.programWeeks ? `Week ${pathWeek}` : `Week ${pathWeek} of ${state.programWeeks}`}
            {stage ? ` · ${stage.title}` : ''}
          </p>
        </div>
        <WeekRing value={complete ? 1 : weekNo / state.programWeeks} label={complete ? 'Done' : `${weekNo}/${state.programWeeks}`} />
      </header>

      {state.goals.map((g) => (
        <div className="goal-card" key={g.trait}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h2>{TRAITS[g.trait].goalName}</h2>
            <p>
              <strong style={{ color: 'var(--text)' }}>Why:</strong> {g.why}
            </p>
          </div>
          <div className="streak">
            <span className="streak-count">
              <Flame size={22} />
              {done[g.trait] ?? 0}
            </span>
            <span className="streak-label">done this week</span>
          </div>
        </div>
      ))}

      {complete && (
        <div className="card tip success" style={{ marginTop: 12 }}>
          <span className="tip-icon">
            <Icon name="party" size={18} />
          </span>
          <h2>You've completed the {state.programWeeks}-week program</h2>
          <p>
            Retake the questionnaire to see where you are now, then keep one favourite challenge per goal going. In a
            one-year follow-up of a coaching app, people's gains in extraversion and conscientiousness held without
            growing further, and neuroticism kept falling, among the 1 in 10 who answered again. The app will suggest
            another retake in about 3 months.
          </p>
          <RefList ids={['stieger2024']} />
          <div>
            <button style={{ marginTop: 8 }} onClick={() => navigate('assess')}>
              Retake questionnaire
            </button>
          </div>
        </div>
      )}

      <div className="spread" style={{ margin: '20px 4px 10px' }}>
        <h2 style={{ margin: 0, fontSize: '1rem' }}>This week's challenges</h2>
        {week && (
          <a className="btn ghost" href="#/plan">
            Edit plan
          </a>
        )}
      </div>
      {week ? (
        <div className="stack">
          {week.commitments.map((c) => {
            const ch = challengeById(c.challengeId);
            if (!ch) return null;
            const doneToday = c.completions.includes(date);
            const count = c.completions.length;
            return (
              <div className="card challenge" key={c.challengeId} style={{ marginBottom: 0 }}>
                <div className="challenge-top">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3>{ch.title}</h3>
                    <div className="pips">
                      <span aria-hidden="true">
                        {Array.from({ length: Math.min(c.target, 7) }, (_, i) => (
                          <span key={i} className={`pip ${i < count ? 'on' : ''}`} />
                        ))}
                      </span>
                      <span>
                        {count} of {c.target} this week
                      </span>
                    </div>
                  </div>
                  <button
                    className={`done-btn ${doneToday ? 'on' : ''}`}
                    onClick={() => toggleDone(c.challengeId)}
                    aria-pressed={doneToday}
                    aria-label={`Done today: ${ch.title}`}
                  >
                    <Icon name="check" size={26} stroke={3} />
                  </button>
                </div>
                <p className="ifthen">{highlightIfThen(c.ifThen)}</p>
                <details>
                  <summary>How to do it</summary>
                  <p style={{ fontSize: '0.92rem', margin: '6px 0 0' }}>{ch.instructions}</p>
                </details>
              </div>
            );
          })}
          <small style={{ display: 'block', padding: '0 4px' }}>
            Count every time you practise. In the studies, people who did their challenges more often reported more
            growth.
          </small>
        </div>
      ) : (
        <div className="card">
          <p>You haven't planned this week yet.</p>
          <button className="primary" onClick={() => navigate('plan')}>
            Plan week {idx + 1}
          </button>
        </div>
      )}

      <section className="card prompt-card" style={{ marginTop: 12 }} aria-labelledby="checkin-title">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 id="checkin-title">{checkin ? 'Checked in today' : "Log today's check-in"}</h2>
          <p>
            {checkin
              ? checkinSummary(
                  checkin.mood,
                  state.goals.map((g) => [TRAITS[g.trait].goalShort, checkin.states[g.trait]] as const),
                )
              : 'A 20-second rating of how you acted today.'}
          </p>
        </div>
        <a className={`btn ${checkin ? '' : 'primary'}`} href="#/checkin">
          {checkin ? 'Edit' : 'Check in'}
        </a>
      </section>

      {tips.length > 0 && (
        <section style={{ marginTop: 20 }} aria-labelledby="coach-title">
          <h2 id="coach-title" className="sr-only">
            Coach tips
          </h2>
          {tips.map((t) => (
            <div key={t.id} className={`card tip ${t.tone}`}>
              <span className="tip-icon">
                <Icon name={TIP_ICON[t.tone]} size={18} />
              </span>
              <h3>{t.title}</h3>
              <p>{t.body}</p>
              {t.refs && <RefList ids={t.refs} />}
              {t.action && (
                <div>
                  <a className="btn" style={{ marginTop: 8 }} href={`#/${t.action.route}`}>
                    {t.action.label}
                  </a>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      <FollowThroughKit state={state} date={date} open={lowC && currentStage(state, date) === 'small'} />
    </div>
  );
}

function WeekRing({ value, label }: { value: number; label: string }) {
  const r = 19;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ring" width="48" height="48" viewBox="0 0 44 44" aria-hidden="true">
      <circle className="ring-track" cx="22" cy="22" r={r} fill="none" strokeWidth="3" />
      <circle
        className="ring-fill"
        cx="22"
        cy="22"
        r={r}
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${Math.max(0.01, value) * c} ${c}`}
        transform="rotate(-90 22 22)"
      />
      <text className="ring-label" x="22" y="26" textAnchor="middle" fontSize="11.5">
        {label}
      </text>
    </svg>
  );
}

/** Bold the "If" and "then" of an if-then plan so the cue and action stand out. */
export function highlightIfThen(text: string): ReactNode {
  // Prefer the "then" after a comma, so a "then" inside the cue isn't bolded.
  const m =
    /^\s*(if|when)\b([\s\S]*?)(,\s*)\b(then)\b([\s\S]*)$/i.exec(text) ??
    /^\s*(if|when)\b([\s\S]*?)(,?\s*)\b(then)\b([\s\S]*)$/i.exec(text);
  if (!m) return text;
  return (
    <>
      <strong>{m[1]}</strong>
      {m[2]}
      {m[3]}
      <strong>{m[4]}</strong>
      {m[5]}
    </>
  );
}

function checkinSummary(mood: number | undefined, ratings: (readonly [string, number | undefined])[]): string {
  const parts = ratings.filter(([, v]) => v != null).map(([name, v]) => `${name} ${v}/7`);
  if (mood != null) parts.push(`mood ${mood}/7`);
  return parts.length ? `${parts.join(' · ')}.` : 'Saved. Add ratings any time today.';
}
