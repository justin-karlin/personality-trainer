import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { AppState } from '../types';
import { TRAITS } from '../data/traits';
import { STAGES, currentStage, extendStep, goalStage, goalWeek, pausePath, primaryGoal, restartStep, resumePath } from '../lib/path';
import { useStore } from '../store';
import type { Goal } from '../types';
import { EvidencePill, RefList } from './common';
import { formatDate } from '../lib/dates';
import { Icon } from './Icon';

// Horizontal offsets of the five nodes, as a share of the trail's width: a winding trail.
// Wider screens use a wider swing so the trail doesn't hug the left edge.
const OFFSETS = ['4%', '28%', '8%', '30%', '12%'];
const OFFSETS_WIDE = ['6%', '40%', '14%', '46%', '20%'];

interface Point {
  x: number;
  y: number;
}

/** The stepwise path as a winding trail of nodes, following the first goal. */
export function PathTrail({ state, date }: { state: AppState; date: string }) {
  const { update } = useStore();
  const stage = currentStage(state, date);
  const idx = STAGES.findIndex((s) => s.id === stage);
  const current = STAGES[idx];
  const primary = primaryGoal(state);
  const second = state.goals.find((g) => g !== primary);
  const secondStage = second ? STAGES.find((s) => s.id === goalStage(second, state.programWeeks, date)) : undefined;
  const focus =
    stage === 'consolidate' && second
      ? 'Keep your best habits going, retake the questionnaire and re-check your goals.'
      : current.focus;

  const wrapRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [boxBottom, setBoxBottom] = useState<number | null>(null);

  // Draw the trail through the nodes' measured centres, so it follows the layout at any width.
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const measure = () => {
      const box = wrap.getBoundingClientRect();
      const next = nodeRefs.current.flatMap((n) => {
        if (!n) return [];
        const r = n.getBoundingClientRect();
        return [{ x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 }];
      });
      setPoints((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      const b = boxRef.current?.getBoundingClientRect();
      setBoxBottom(b ? b.bottom - box.top : null);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [idx]);

  return (
    <section className="card" aria-labelledby="path-title">
      <div className="spread">
        <h2 id="path-title" style={{ margin: 0 }}>
          Your path{primary && second ? `: ${TRAITS[primary.trait].goalShort}` : ''}
        </h2>
        <span className="pill moderate">
          Step {idx + 1} of {STAGES.length}
        </span>
      </div>

      <div className="trail" ref={wrapRef}>
        {points.length === STAGES.length && (
          <svg className="trail-line" aria-hidden="true">
            {/* The "Now" box sits below the current node, so the dotted trail resumes from its bottom edge. */}
            {idx + 1 < points.length && (
              <path
                className="todo"
                d={curve([
                  boxBottom != null ? { x: points[idx + 1].x, y: boxBottom } : points[idx],
                  ...points.slice(idx + 1),
                ])}
              />
            )}
            {idx > 0 && <path className="done" d={curve(points.slice(0, idx + 1))} />}
          </svg>
        )}
        <ol role="list">
          {STAGES.map((s, i) => {
            const status = i < idx ? 'done' : i === idx ? 'current' : 'locked';
            return (
              <li key={s.id} className={status} aria-current={status === 'current' ? 'step' : undefined}>
                <div className="step-row" style={{ '--x': OFFSETS[i], '--x-wide': OFFSETS_WIDE[i] } as CSSProperties}>
                  <span
                    className={`node ${status}`}
                    ref={(el) => {
                      nodeRefs.current[i] = el;
                    }}
                    aria-hidden="true"
                  >
                    <Icon
                      name={status === 'done' ? 'check' : status === 'current' ? 'star' : 'lock'}
                      size={status === 'current' ? 30 : 22}
                      stroke={status === 'current' ? 2 : 2.4}
                    />
                  </span>
                  <span className="node-label">
                    <span className="eyebrow">
                      Step {i + 1}
                      {status === 'done' ? ' · Done' : status === 'current' ? ' · Now' : ' · Later'}
                    </span>
                    <strong>{s.title}</strong>
                  </span>
                </div>
                {status === 'current' && (
                  <div className="now-box" ref={boxRef}>
                    <p>
                      <strong>Now:</strong> {focus}
                    </p>
                    {second && secondStage && (
                      <p className="muted" style={{ marginTop: 6, fontSize: '0.9rem' }}>
                        Your {TRAITS[second.trait].goalShort.toLowerCase()} goal has its own path and is at step{' '}
                        {STAGES.indexOf(secondStage) + 1}: {secondStage.title.toLowerCase()}.
                      </p>
                    )}
                    {primary && <ScheduleControls goal={primary} programWeeks={state.programWeeks} date={date} update={update} />}
                    <details style={{ marginTop: 6 }}>
                      <summary>Why this step?</summary>
                      <p style={{ fontSize: '0.92rem', margin: '6px 0' }}>{current.why}</p>
                      <div className="row" style={{ gap: 6 }}>
                        <EvidencePill level={current.evidence} />
                        <RefList ids={current.refs} />
                      </div>
                      <small className="muted" style={{ display: 'block', marginTop: 6 }}>
                        Steps 1–3 target things that went with more change in studies (small links, mostly in
                        self-ratings). The main trials also had people work on one trait. The order and the
                        consolidation step are this app's own design and haven't been tested.
                      </small>
                    </details>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/**
 * The schedule is a suggestion based on time, not a measure of progress, so it can
 * be paused, stretched by a week, or restarted from the start of the current step.
 */
function ScheduleControls({
  goal,
  programWeeks,
  date,
  update,
}: {
  goal: Goal;
  programWeeks: number;
  date: string;
  update: ReturnType<typeof useStore>['update'];
}) {
  const week = goalWeek(goal, date) + 1;
  const change = (fn: (g: Goal) => Goal) =>
    update((s) => ({ ...s, goals: s.goals.map((g) => (g.trait === goal.trait ? fn(g) : g)) }));
  return (
    <div className="schedule">
      <small className="fine">
        {goal.pausedOn
          ? `Paused since ${formatDate(goal.pausedOn)}. The schedule waits until you resume.`
          : `Week ${Math.min(week, programWeeks)} of ${programWeeks} on the suggested schedule.`}{' '}
        The schedule counts time, not how much you've changed; your action record and questionnaire show that.
      </small>
      <div className="row" style={{ gap: 12 }}>
        {goal.pausedOn ? (
          <button type="button" className="link-btn" onClick={() => change((g) => resumePath(g, date))}>
            Resume
          </button>
        ) : (
          <>
            <button type="button" className="link-btn" onClick={() => change(extendStep)}>
              Stay on this step another week
            </button>
            <button type="button" className="link-btn" onClick={() => change((g) => restartStep(g, programWeeks, date))}>
              Restart this step
            </button>
            <button type="button" className="link-btn" onClick={() => change((g) => pausePath(g, date))}>
              Pause
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** A smooth vertical S-curve through the points. */
function curve(ps: Point[]): string {
  if (ps.length < 2) return '';
  return ps
    .map((p, i) => {
      if (i === 0) return `M${p.x} ${p.y}`;
      const a = ps[i - 1];
      const my = (a.y + p.y) / 2;
      return `C${a.x} ${my} ${p.x} ${my} ${p.x} ${p.y}`;
    })
    .join(' ');
}
