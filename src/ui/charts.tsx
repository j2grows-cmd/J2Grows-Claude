// Small dependency-free SVG charts for the run history.

import { useId, useState } from 'react';

export interface ChartSeries {
  label: string;
  values: number[];
  colour: string;
}

const niceMax = (v: number): number => {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
};

/** A line chart with area fill, a few grid lines and a hover read-out. `times` are seconds into the run. */
export function LineChart({ title, times, series, format, height = 150 }: { title: string; times: number[]; series: ChartSeries[]; format: (v: number) => string; height?: number }) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const W = 560;
  const H = height;
  const pad = { l: 8, r: 8, t: 10, b: 18 };
  const n = times.length;
  if (n < 2) return <div className="chart-empty muted">Not enough history yet. The chart fills in as the run goes on.</div>;
  const all = series.flatMap((s) => s.values);
  const max = niceMax(Math.max(...all, 0));
  const min = Math.min(0, ...all);
  const span = max - min || 1;
  const x = (i: number): number => pad.l + (i / (n - 1)) * (W - pad.l - pad.r);
  const y = (v: number): number => pad.t + (1 - (v - min) / span) * (H - pad.t - pad.b);
  const hrs = (t: number): string => (t >= 3600 ? `${(t / 3600).toFixed(1)} h` : `${Math.round(t / 60)} min`);
  const onMove = (e: React.PointerEvent<SVGSVGElement>): void => {
    const r = e.currentTarget.getBoundingClientRect();
    const f = (e.clientX - r.left) / r.width;
    setHover(Math.max(0, Math.min(n - 1, Math.round(((f * W - pad.l) / (W - pad.l - pad.r)) * (n - 1)))));
  };
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}t`} onPointerMove={onMove} onPointerLeave={() => setHover(null)} preserveAspectRatio="none" style={{ height }}>
        <title id={`${id}t`}>{`${title}: ${series.map((s) => `${s.label} ends at ${format(s.values[n - 1])}`).join(', ')}`}</title>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={pad.l} x2={W - pad.r} y1={y(min + span * f)} y2={y(min + span * f)} className="chart-grid" />
          </g>
        ))}
        {series.map((s) => {
          const d = s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
          return (
            <g key={s.label}>
              <path d={`${d} L${x(n - 1).toFixed(1)},${y(min)} L${x(0).toFixed(1)},${y(min)} Z`} fill={s.colour} opacity={0.12} />
              <path d={d} fill="none" stroke={s.colour} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} className="chart-cursor" />}
        <text x={pad.l} y={H - 4} className="chart-axis">{hrs(times[0])}</text>
        <text x={W - pad.r} y={H - 4} textAnchor="end" className="chart-axis">{hrs(times[n - 1])}</text>
      </svg>
      <figcaption className="chart-cap">
        <span className="chart-title">{title}</span>
        {series.map((s) => (
          <span key={s.label} className="chart-key">
            <i style={{ background: s.colour }} />
            {s.label} <b>{format(hover != null ? s.values[hover] : s.values[n - 1])}</b>
          </span>
        ))}
        {hover != null && <span className="muted">at {hrs(times[hover])}</span>}
      </figcaption>
    </figure>
  );
}
