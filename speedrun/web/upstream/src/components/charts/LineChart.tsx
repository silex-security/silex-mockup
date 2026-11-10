/**
 * Small-multiple line chart (one y-axis per chart, never dual axes).
 * Optional vertical markers and a shaded window.
 */
export interface Series {
  name: string;
  values: number[];
  color: string; // CSS colour or var()
  width?: number;
}

export function LineChart({
  labels,
  series,
  min,
  max,
  format,
  markers = [],
  shadeFrom,
  shadeLabel,
  ariaLabel,
  lastLabels = true,
}: {
  labels: string[];
  series: Series[];
  min: number;
  max: number;
  format: (v: number) => string;
  markers?: { index: number; label: string }[];
  shadeFrom?: number;
  shadeLabel?: string;
  ariaLabel: string;
  lastLabels?: boolean;
}) {
  const W = 540;
  const H = 200;
  const L = 40;
  const R = 510;
  const T = 30;
  const B = 170;
  const x = (i: number) => L + (i / (labels.length - 1)) * (R - L - 10);
  const y = (v: number) => B - ((v - min) / (max - min)) * (B - T);
  const mid = (min + max) / 2;
  const labelIdx = labels.map((_, i) => i).filter((i) => i % 2 === 0 || i === labels.length - 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={ariaLabel}>
      {[max, mid, min].map((v) => (
        <g key={v}>
          <line x1={L} y1={y(v)} x2={R} y2={y(v)} stroke="var(--line)" />
          <text x={L - 6} y={y(v) + 4} textAnchor="end" fill="var(--mut)" fontSize={11} fontFamily="var(--font-mono)">{format(v)}</text>
        </g>
      ))}
      {shadeFrom !== undefined ? (
        <g>
          <rect x={x(shadeFrom)} y={T - 8} width={R - x(shadeFrom)} height={B - T + 8} fill="var(--amb-wash)" />
          {shadeLabel ? <text x={x(shadeFrom) + 4} y={T - 12} fill="var(--amb-text)" fontSize={10} fontWeight={600}>{shadeLabel}</text> : null}
        </g>
      ) : null}
      {markers.map((m) => (
        <g key={m.label}>
          <line x1={x(m.index)} y1={T - 8} x2={x(m.index)} y2={B} stroke="var(--mut)" strokeDasharray="3 4" strokeOpacity={0.6} />
          <text x={x(m.index) + 4} y={T - 12} fill="var(--mut)" fontSize={10}>{m.label}</text>
        </g>
      ))}
      {series.map((s) => (
        <g key={s.name}>
          <polyline points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke={s.color} strokeWidth={s.width ?? 2.5} />
          {s.values.map((v, i) => (
            <circle key={i} cx={x(i)} cy={y(v)} r={i === s.values.length - 1 ? 4.5 : 3} fill={i === s.values.length - 1 ? s.color : "var(--card)"} stroke={s.color} strokeWidth={2} />
          ))}
          {lastLabels ? (
            <text x={x(s.values.length - 1) - 4} y={y(s.values[s.values.length - 1]) - 10} textAnchor="end" fill="var(--fg)" fontSize={12} fontWeight={700}>
              {format(s.values[s.values.length - 1])}
            </text>
          ) : null}
        </g>
      ))}
      {labelIdx.map((i) => (
        <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fill="var(--mut)" fontSize={11} fontFamily="var(--font-mono)">{labels[i]}</text>
      ))}
    </svg>
  );
}
