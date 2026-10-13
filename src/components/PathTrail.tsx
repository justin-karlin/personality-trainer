import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { AppState } from '../types';
import { TRAITS } from '../data/traits';
import { STAGES, currentStage, goalStage, primaryGoal } from '../lib/path';
import { EvidencePill, RefList } from './common';
import { Icon } from './Icon';

// Horizontal offsets of the five nodes, as a share of the trail's width: a winding trail.
const OFFSETS = ['4%', '28%', '8%', '30%', '12%'];

interface Point {
  x: number;
  y: number;
}

/** The stepwise path as a winding trail of nodes, following the first goal. */
export function PathTrail({ state, date }: { state: AppState; date: string }) {
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
  const [points, setPoints] = useState<Point[]>([]);

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
            <path className="todo" d={curve(points.slice(Math.max(0, idx)))} />
            {idx > 0 && <path className="done" d={curve(points.slice(0, idx + 1))} />}
          </svg>
        )}
        <ol>
          {STAGES.map((s, i) => {
            const status = i < idx ? 'done' : i === idx ? 'current' : 'locked';
            return (
              <li key={s.id} className={status} aria-current={status === 'current' ? 'step' : undefined}>
                <div className="step-row" style={{ '--x': OFFSETS[i] } as CSSProperties}>
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
                      {status === 'done' ? ' · Done' : status === 'current' ? ' · Now' : ''}
                    </span>
                    <strong>{s.title}</strong>
                  </span>
                </div>
                {status === 'current' && (
                  <div className="now-box">
                    <p>
                      <strong>Now:</strong> {focus}
                    </p>
                    {second && secondStage && (
                      <p className="muted" style={{ marginTop: 6, fontSize: '0.9rem' }}>
                        Your {TRAITS[second.trait].goalShort.toLowerCase()} goal has its own path and is at step{' '}
                        {STAGES.indexOf(secondStage) + 1}: {secondStage.title.toLowerCase()}.
                      </p>
                    )}
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
