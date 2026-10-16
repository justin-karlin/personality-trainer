import { Fragment, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { REFERENCES } from '../data/references';
import type { Viz } from '../data/scienceCards';

// The chart on a science card. One accent colour marks the finding; context is neutral
// grey; text always uses text colours. Motion classes (m-*) come from the card motion
// rules in styles.css: they play once when the card is first shown, and are off for
// reduced motion.

const delay = (s: number) => ({ '--d': `${s}s` }) as CSSProperties;

export function CardViz({ viz, refs, note, alt }: { viz: Viz; refs: string[]; note: string; alt: string }) {
  return (
    <figure className={`viz viz-${viz.kind}`}>
      <div className="viz-body" role="img" aria-label={alt}>
        <Body viz={viz} />
      </div>
      <figcaption className="viz-source">
        {refs.map((id, i) => {
          const r = REFERENCES[id];
          return r ? (
            <Fragment key={id}>
              {i > 0 && '; '}
              <a href={r.url} target="_blank" rel="noreferrer">
                {r.short}
              </a>
            </Fragment>
          ) : null;
        })}
        {/* Each part of the note stays whole, so "self-report" doesn't break at its hyphen. */}
        {note &&
          note.split(' · ').map((part) => (
            <Fragment key={part}>
              {' · '}
              <span className="nobreak">{part}</span>
            </Fragment>
          ))}
      </figcaption>
    </figure>
  );
}

function Body({ viz }: { viz: Viz }) {
  switch (viz.kind) {
    case 'bars':
      return <Bars viz={viz} />;
    case 'line':
      return <Line viz={viz} />;
    case 'stat':
      return <Stat viz={viz} />;
    case 'range':
      return <Range viz={viz} />;
    case 'compare':
      return <Compare viz={viz} />;
    case 'streak':
      return <Streak viz={viz} />;
  }
}

function Bars({ viz }: { viz: Extract<Viz, { kind: 'bars' }> }) {
  const values = viz.rows.map((r) => r.value);
  const lo = Math.min(0, viz.domain?.[0] ?? 0, ...values);
  const hi = Math.max(0, viz.domain?.[1] ?? 0, ...values);
  const span = hi - lo || 1;
  const zero = (-lo / span) * 100;
  return (
    <>
      <p className="viz-title">{viz.title}</p>
      <div className={`vz-bars${lo < 0 ? ' vz-has-neg' : ''}`}>
        {viz.rows.map((r, i) => {
          const w = (Math.abs(r.value) / span) * 100;
          const neg = r.value < 0;
          return (
            <div className={`vz-bar-row${r.emphasis ? ' vz-em' : ''}`} key={r.label}>
              <span className="vz-bar-label">{r.label}</span>
              <span className="vz-bar-track">
                {lo < 0 && <span className="vz-bar-zero" style={{ left: `${zero}%` }} />}
                <span
                  className={`vz-bar m-stretch ${neg ? 'o-r vz-neg' : 'o-l'}`}
                  style={{ ...delay(0.15 + i * 0.15), left: `${neg ? zero - w : zero}%`, width: `${Math.max(w, 0.8)}%` }}
                />
                <span
                  className={`vz-bar-value m-fade${neg ? ' vz-neg' : ''}`}
                  style={{ ...delay(0.6 + i * 0.15), ...(neg ? { right: `${100 - (zero - w)}%` } : { left: `${zero + w}%` }) }}
                >
                  {r.display}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** Measures an element's width so an SVG can be drawn at 1 unit = 1 CSS pixel. */
function useWidth<T extends Element>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(Math.max(200, Math.round(el.getBoundingClientRect().width)) || fallback);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(200, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, width] as const;
}

function Line({ viz }: { viz: Extract<Viz, { kind: 'line' }> }) {
  const [ref, W] = useWidth<HTMLDivElement>(300);
  const H = W < 260 ? 112 : 132;
  const pad = { l: 8, r: 8, t: 24, b: 26 };
  const all = viz.series.flatMap((s) => s.values).filter((v): v is number => v != null);
  // Always include zero (the starting point) and leave headroom for point labels.
  const span = Math.max(...all, 0) - Math.min(...all, 0) || 1;
  const lo = Math.min(0, ...all) - span * 0.08;
  const hi = Math.max(0, ...all) + span * 0.15;
  const n = viz.xLabels.length;
  const x = (i: number) => pad.l + (n === 1 ? 0 : (i * (W - pad.l - pad.r)) / (n - 1));
  const y = (v: number) => pad.t + ((hi - v) * (H - pad.t - pad.b)) / (hi - lo);
  const anchorAt = (i: number) => (i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle');
  // Draw context series first so the emphasised one sits on top.
  const order = viz.series.map((s, i) => ({ s, i })).sort((a, b) => Number(!!a.s.emphasis) - Number(!!b.s.emphasis));
  return (
    <>
      <p className="viz-title">{viz.title}</p>
      <div ref={ref} className="vz-line-wrap">
        <svg className="vz-line-chart" viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
          <line className="vz-axis" x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} />
          {order.map(({ s, i }) => (
            <g key={s.label} className={s.emphasis ? 'vz-em' : 'vz-ctx'}>
              <path
                className="vz-series m-draw"
                pathLength={1}
                style={delay(0.2 + i * 0.3)}
                d={s.values
                  .map((v, j) => (v == null ? '' : `${j === 0 || s.values[j - 1] == null ? 'M' : 'L'}${x(j).toFixed(1)} ${y(v).toFixed(1)}`))
                  .join(' ')}
              />
              {s.values.map((v, j) =>
                v == null ? null : (
                  <circle key={j} className="vz-pt m-pop" style={delay(0.35 + i * 0.3 + j * 0.22)} cx={x(j)} cy={y(v)} r={4} />
                ),
              )}
            </g>
          ))}
          {(viz.labelPoints ?? []).map((lp, k) => {
            const v = viz.series[lp.series]?.values[lp.index];
            if (v == null) return null;
            return (
              <text
                key={k}
                className="vz-pt-label m-fade"
                style={delay(1 + k * 0.15)}
                x={x(lp.index)}
                y={y(v) - 10}
                textAnchor={anchorAt(lp.index)}
              >
                {lp.text}
              </text>
            );
          })}
          {viz.xLabels.map((l, i) => (
            <text key={l} className="vz-x-label" x={x(i)} y={H - 6} textAnchor={anchorAt(i)}>
              {l}
            </text>
          ))}
        </svg>
      </div>
      {viz.series.length > 1 && (
        <div className="vz-legend vz-legend-line">
          {viz.series.map((s) => (
            <span key={s.label} className={s.emphasis ? 'vz-em' : 'vz-ctx'}>
              <i />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

function Stat({ viz }: { viz: Extract<Viz, { kind: 'stat' }> }) {
  const sc = viz.scale;
  return (
    <div className="vz-stat">
      <span className="vz-stat-value m-rise">{viz.value}</span>
      <span className="vz-stat-label m-fade" style={delay(0.2)}>
        {viz.label}
      </span>
      {sc && (
        <div className="vz-ruler">
          <span className="vz-ruler-track" />
          <span
            className="vz-ruler-fill m-stretch o-l"
            style={{ ...delay(0.35), width: `${(Math.min(sc.value, sc.max) / sc.max) * 100}%` }}
          />
          {sc.marks.map((m) => (
            <span key={m.label} className="vz-ruler-mark" style={{ left: `${(m.at / sc.max) * 100}%` }}>
              <span>{m.label}</span>
            </span>
          ))}
        </div>
      )}
      {viz.minis && (
        <div className="vz-stat-minis">
          {viz.minis.map((m, i) => (
            <div key={m.label} className="m-rise" style={delay(0.5 + i * 0.12)}>
              <strong>{m.value}</strong>
              <span>{m.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Range({ viz }: { viz: Extract<Viz, { kind: 'range' }> }) {
  const at = (v: number) => `${(v / viz.axisMax) * 100}%`;
  const ends = [
    { ...viz.min, side: 'vz-start' },
    { ...viz.max, side: 'vz-end' },
  ];
  return (
    <>
      <p className="viz-title">{viz.title}</p>
      <div className="vz-range">
        <span className="vz-range-callout m-fade" style={{ ...delay(0.7), left: at(viz.mean.value) }}>
          {viz.mean.label}
          <strong>
            {viz.mean.display ?? viz.mean.value} {viz.unit}
          </strong>
        </span>
        <div className="vz-range-plot">
          <span className="vz-range-axis" />
          <span
            className="vz-range-bar m-stretch o-l"
            style={{ ...delay(0.15), left: at(viz.min.value), width: at(viz.max.value - viz.min.value) }}
          />
          <span className="vz-range-dot m-pop" style={{ ...delay(0.6), left: at(viz.mean.value) }} />
        </div>
        <div className="vz-range-ticks">
          {viz.ticks.map((t) => (
            <span key={t} style={{ left: at(t) }}>
              {t}
            </span>
          ))}
        </div>
        <div className="vz-range-ends">
          {ends.map((e) => (
            <span key={e.label} className={`${e.side} m-fade`} style={delay(0.45)}>
              {e.label}
              <strong>
                {e.display ?? e.value} {viz.unit}
              </strong>
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

function Compare({ viz }: { viz: Extract<Viz, { kind: 'compare' }> }) {
  return (
    <div className="vz-compare">
      {(['left', 'right'] as const).map((side, i) => {
        const p = viz[side];
        return (
          <div key={side} className={`vz-panel m-rise${viz.emphasis === side ? ' vz-em' : ''}`} style={delay(0.15 + i * 0.25)}>
            <span className="vz-panel-heading">{p.heading}</span>
            <strong className="vz-panel-verdict">{p.verdict}</strong>
            <span className="vz-panel-note">{p.note}</span>
          </div>
        );
      })}
    </div>
  );
}

function Streak({ viz }: { viz: Extract<Viz, { kind: 'streak' }> }) {
  const days = viz.days.split('');
  return (
    <>
      <p className="viz-title">{viz.title}</p>
      <div className="vz-streak" style={{ '--n': days.length } as CSSProperties}>
        {days.map((d, i) => (
          <span key={i} className={`vz-day m-fade ${d === 'x' ? 'vz-on' : 'vz-off'}`} style={delay(0.15 + i * 0.06)} />
        ))}
      </div>
      <p className="viz-units m-fade" style={delay(0.3 + days.length * 0.06)}>
        {viz.caption}
      </p>
    </>
  );
}
