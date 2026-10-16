import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';

// Small, dependency-free SVG charts. Specs: 2px lines, r=4 markers with a
// surface-coloured ring, hairline recessive grid, labels in text colours,
// hover tooltip on every chart, and a screen-reader table of the data.

const PAD = { top: 16, right: 16, bottom: 26, left: 44 };

/** Track the rendered width so the SVG draws at 1:1 scale and text keeps its real size. */
function useWidth(ref: RefObject<HTMLElement | null>, fallback = 320): number {
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(Math.max(200, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

export interface Point {
  label: string;
  value: number;
}

interface Hover {
  i: number;
  x: number;
  y: number;
}

function useHover(n: number, xAt: (i: number) => number) {
  const [hover, setHover] = useState<Hover | null>(null);
  function onMove(e: PointerEvent<SVGSVGElement>) {
    if (!n) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const vx = e.clientX - rect.left;
    let best = 0;
    for (let i = 1; i < n; i++) if (Math.abs(xAt(i) - vx) < Math.abs(xAt(best) - vx)) best = i;
    setHover({ i: best, x: xAt(best), y: e.clientY - rect.top });
  }
  return { hover, onMove, onLeave: () => setHover(null) };
}

export function LineChart({
  points,
  min,
  max,
  color,
  height = 140,
  ticks,
  format = (v) => v.toFixed(1),
  title,
}: {
  points: Point[];
  min: number;
  max: number;
  color: string;
  height?: number;
  ticks: number[];
  format?: (v: number) => string;
  title: string;
}) {
  const box = useRef<HTMLElement>(null);
  const W = useWidth(box);
  const H = height;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const xAt = (i: number) => PAD.left + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const yAt = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * innerH;
  const { hover, onMove, onLeave } = useHover(points.length, xAt);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${xAt(i)},${yAt(p.value)}`).join(' ');
  const last = points[points.length - 1];

  return (
    <figure ref={box} style={{ margin: 0, position: 'relative' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        role="img"
        aria-label={title}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        style={{ display: 'block', touchAction: 'pan-y' }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={yAt(t)} y2={yAt(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={PAD.left - 6} y={yAt(t) + 3.5} textAnchor="end" fontSize={15} fill="var(--muted)">
              {t}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          points.length <= 6 || i === 0 || i === points.length - 1 ? (
            <text key={i} x={xAt(i)} y={H - 6} textAnchor="middle" fontSize={15} fill="var(--muted)">
              {p.label}
            </text>
          ) : null,
        )}
        {hover && (
          <line x1={xAt(hover.i)} x2={xAt(hover.i)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--muted)" strokeWidth={1} />
        )}
        <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={xAt(i)}
            cy={yAt(p.value)}
            r={hover?.i === i ? 5 : 4}
            fill={color}
            stroke="var(--surface)"
            strokeWidth={2}
          />
        ))}
        {last && (
          <text
            x={Math.min(xAt(points.length - 1) + 8, W - 2)}
            y={yAt(last.value) - 8}
            textAnchor={points.length > 1 ? 'end' : 'start'}
            fontSize={15}
            fontWeight={600}
            fill="var(--text)"
          >
            {format(last.value)}
          </text>
        )}
      </svg>
      {hover && <Tooltip x={hover.x} y={hover.y} label={points[hover.i].label} value={format(points[hover.i].value)} />}
      <DataTable title={title} rows={points.map((p) => [p.label, format(p.value)])} />
    </figure>
  );
}

export function BarChart({
  bars,
  max,
  color,
  height = 140,
  format,
  title,
}: {
  bars: Point[];
  max: number;
  color: string;
  height?: number;
  format: (v: number) => string;
  title: string;
}) {
  const box = useRef<HTMLElement>(null);
  const W = useWidth(box);
  const H = height;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / Math.max(bars.length, 1);
  const bw = Math.min(24, slot - 2);
  const xAt = (i: number) => PAD.left + slot * i + slot / 2;
  const yAt = (v: number) => PAD.top + (1 - v / max) * innerH;
  const { hover, onMove, onLeave } = useHover(bars.length, xAt);
  const r = 4;

  return (
    <figure ref={box} style={{ margin: 0, position: 'relative' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        role="img"
        aria-label={title}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        style={{ display: 'block', touchAction: 'pan-y' }}
      >
        {[0, max / 2, max].map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={yAt(t)} y2={yAt(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={PAD.left - 6} y={yAt(t) + 3.5} textAnchor="end" fontSize={15} fill="var(--muted)">
              {format(t)}
            </text>
          </g>
        ))}
        {bars.map((b, i) => {
          const x = xAt(i) - bw / 2;
          const y = yAt(b.value);
          const h = yAt(0) - y;
          const rr = Math.min(r, h, bw / 2);
          // Rounded data-end, square baseline.
          const d =
            h <= 0
              ? ''
              : `M${x},${yAt(0)} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + bw - rr} Q${x + bw},${y} ${x + bw},${y + rr} V${yAt(0)} Z`;
          return (
            <g key={i} opacity={hover && hover.i !== i ? 0.55 : 1}>
              {d && <path d={d} fill={color} />}
              <text x={xAt(i)} y={H - 6} textAnchor="middle" fontSize={15} fill="var(--muted)">
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
      {hover && <Tooltip x={hover.x} y={hover.y} label={bars[hover.i].label} value={format(bars[hover.i].value)} />}
      <DataTable title={title} rows={bars.map((b) => [b.label, format(b.value)])} />
    </figure>
  );
}

function Tooltip({ x, y, label, value }: { x: number; y: number; label: string; value: string }) {
  return (
    <div
      role="presentation"
      style={{
        position: 'absolute',
        left: x,
        top: Math.max(0, y - 56),
        transform: 'translateX(-50%)',
        background: 'var(--text)',
        color: 'var(--bg)',
        borderRadius: 8,
        padding: '4px 8px',
        fontSize: 15,
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <div style={{ opacity: 0.8 }}>{label}</div>
      <strong>{value}</strong>
    </div>
  );
}

function DataTable({ title, rows }: { title: string; rows: string[][] }) {
  return (
    // Screen-reader copy of the chart's data; hidden on screen to keep the page short.
    <div className="sr-only">
      <table>
        <caption>{title}</caption>
        <tbody>
          {rows.map(([a, b], i) => (
            <tr key={i}>
              <td style={{ padding: '2px 12px 2px 0' }}>{a}</td>
              <td style={{ fontVariantNumeric: 'tabular-nums' }}>{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
