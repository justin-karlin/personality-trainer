import { useState, type ReactNode } from 'react';
import { useStore } from '../store';
import { navigate } from '../router';
import { challengeById } from '../data/challenges';
import { TRAITS } from '../data/traits';
import { LOW_C, coachTips, type Tip } from '../lib/coach';
import { currentWeekIndex, findWeek, isProgramComplete } from '../lib/program';
import { STAGES, currentStage, goalWeek, primaryGoal } from '../lib/path';
import { hasCheckinData } from '../lib/checkin';
import { formatDate, today } from '../lib/dates';
import { FollowThroughKit } from '../components/FollowThroughKit';
import { Icon, type IconName } from '../components/Icon';
import { isIosBrowser } from '../lib/transfer';
import { OUTCOME_LABEL, outcomeOn, setOutcome } from '../lib/actions';
import type { ActionOutcome } from '../types';
import { durable } from '../lib/durable';

const OTHER_OUTCOMES: ActionOutcome[] = ['partly', 'skipped', 'no-chance'];

const MOVE_HINT_KEY = 'trait-trainer:move-hint-dismissed';

const TIP_ICON: Record<Tip['tone'], IconName> = { info: 'bulb', success: 'party', warn: 'alert', care: 'heart' };

export function Today() {
  const { state, update } = useStore();
  const [showMoveHint, setShowMoveHint] = useState(() => {
    try {
      return isIosBrowser() && durable.getItem(MOVE_HINT_KEY) !== '1';
    } catch {
      return isIosBrowser();
    }
  });
  const date = today();
  const idx = currentWeekIndex(state, date) ?? 0;
  const week = findWeek(state, idx);
  // The check-in prompt card below replaces the coach's own check-in reminder.
  const tips = coachTips(state, date).filter((t) => t.id !== 'checkin');
  const checkin = hasCheckinData(state.checkins[date]) ? state.checkins[date] : undefined;
  const latestC = state.assessments[state.assessments.length - 1]?.scores.C;
  const lowC = latestC != null && latestC <= LOW_C;
  const stage = STAGES.find((s) => s.id === currentStage(state, date));
  const complete = isProgramComplete(state, date);
  // The header follows the same path as the stage label: the first goal's own weeks.
  const primary = primaryGoal(state);
  const pathWeek = primary ? goalWeek(primary, date) + 1 : idx + 1;
  const weekNo = Math.min(pathWeek, state.programWeeks);

  /** Log today's outcome for one planned action; choosing the current outcome again clears it. */
  function logOutcome(challengeId: string, outcome: ActionOutcome) {
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
                  : setOutcome(c, date, outcomeOn(c, date) === outcome ? undefined : outcome),
              ),
            },
      ),
    }));
  }

  return (
    <div>
      <header className="today-head">
        <div style={{ minWidth: 0 }}>
          <h1>{formatDate(date, { weekday: 'long', month: 'short', day: 'numeric' })}</h1>
          {/* The ring shows the week; screen readers get it (and the step) in words. */}
          <p className={primary?.pausedOn || complete ? '' : 'sr-only'}>
            {primary?.pausedOn
              ? 'Paused'
              : complete
                ? 'Maintenance'
                : [`Week ${pathWeek} of ${state.programWeeks}`, stage?.title ?? ''].filter(Boolean).join(' · ')}
          </p>
        </div>
        <WeekRing value={complete ? 1 : weekNo / state.programWeeks} label={complete ? 'Done' : `${weekNo}/${state.programWeeks}`} />
      </header>

      {showMoveHint && (
        <div className="card tip warn">
          <h3>Installing the app?</h3>
          <p>
            <a href="#/settings">Move your data</a> first. The installed app starts empty.
          </p>
          <div className="row">
            <button
              className="ghost"
              onClick={() => {
                try {
                  durable.setItem(MOVE_HINT_KEY, '1');
                } catch {
                  // Can't remember the choice; hide it for now.
                }
                setShowMoveHint(false);
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {complete && (
        <div className="card tip success" style={{ marginTop: 12 }}>
          <span className="tip-icon">
            <Icon name="party" size={18} />
          </span>
          <h2>You finished the {state.programWeeks} weeks</h2>
          <p>Retake the questionnaire, then keep one favourite challenge going.</p>
          <div>
            <button style={{ marginTop: 8 }} onClick={() => navigate('assess')}>
              Retake questionnaire
            </button>
          </div>
        </div>
      )}

      {state.goals.some((g) => g.trait === 'C' && !g.focus) && (
        <p style={{ margin: '12px 4px 0' }}>
          <a href="#/goals">Name your task</a>
        </p>
      )}

      {week ? (
        <div className="stack" style={{ marginTop: 16 }}>
          {week.commitments.map((c) => {
            const ch = challengeById(c.challengeId);
            if (!ch) return null;
            const todayOutcome = outcomeOn(c, date);
            const doneToday = todayOutcome === 'done';
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
                        {count} of {c.target} done
                      </span>
                    </div>
                  </div>
                  <button
                    className={`done-btn ${doneToday ? 'on' : ''}`}
                    onClick={() => logOutcome(c.challengeId, 'done')}
                    aria-pressed={doneToday}
                    aria-label={`Did it today: ${ch.title}`}
                  >
                    <Icon name="check" size={26} stroke={3} />
                  </button>
                </div>
                <p className="ifthen">{highlightIfThen(c.ifThen)}</p>
                <div className="challenge-foot">
                  {!doneToday && (
                    <details className="outcomes-menu">
                      <summary>{todayOutcome ? `Today: ${OUTCOME_LABEL[todayOutcome]}` : 'Not done?'}</summary>
                      <div className="outcomes" role="group" aria-label={`Not done today? ${ch.title}`}>
                        {OTHER_OUTCOMES.map((o) => (
                          <button
                            key={o}
                            className={`outcome-chip ${todayOutcome === o ? 'on' : ''}`}
                            aria-pressed={todayOutcome === o}
                            onClick={() => logOutcome(c.challengeId, o)}
                          >
                            {OUTCOME_LABEL[o]}
                          </button>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            );
          })}
          <a className="btn ghost block" href="#/plan">
            Edit plan
          </a>
        </div>
      ) : (
        <div className="card">
          <p>No plan yet this week.</p>
          <button className="primary" onClick={() => navigate('plan')}>
            Plan week {idx + 1}
          </button>
        </div>
      )}

      <section className="card prompt-card" style={{ marginTop: 12 }} aria-labelledby="checkin-title">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 id="checkin-title">{checkin ? 'Checked in' : 'Daily check-in'}</h2>
          {checkin && (
            <p>
              {checkinSummary(
                checkin.mood,
                state.goals.map((g) => [TRAITS[g.trait].goalShort, checkin.states[g.trait]] as const),
              )}
            </p>
          )}
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
              {/* Care tips keep their full text (it carries the support lines); others show only the lead. */}
              {t.tone === 'care' ? <p>{t.body}</p> : t.lead && <p>{t.lead}</p>}
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
  return parts.length ? parts.join(' · ') : 'Note saved.';
}
