/** Minimal sparkline. `tone` maps to a CSS variable so it follows the theme. */
export function Sparkline({
  values,
  width = 84,
  height = 22,
  tone = "acc2",
  dot = true,
  area = false,
  label,
}: {
  values: number[];
  width?: number;
  height?: number;
  tone?: "acc2" | "amb" | "mint" | "rose" | "mut";
  dot?: boolean;
  area?: boolean;
  label?: string;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 3;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const last = pts[pts.length - 1];
  const color = `var(--${tone})`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {area ? <polygon points={`${pts.map((p) => p.join(",")).join(" ")} ${last[0]},${height} ${pts[0][0]},${height}`} fill={color} fillOpacity={0.14} /> : null}
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={color} strokeWidth={1.6} />
      {dot ? <circle cx={last[0]} cy={last[1]} r={2.4} fill={color} /> : null}
    </svg>
  );
}

export type Trend = "up" | "down" | "flat" | "wave" | "step";
export type Tone = "acc2" | "amb" | "mint" | "rose" | "mut";

export const TREND_SHAPES: Record<Trend, number[]> = {
  up: [3, 4, 3.6, 5, 5.8, 5.4, 7, 7.6, 8.8, 9.6],
  down: [9.6, 8.6, 9, 7.4, 6.6, 6.9, 5, 4.4, 3.2, 2.6],
  flat: [5, 5.6, 4.7, 5.3, 5.9, 4.8, 5.4, 5.1, 5.7, 5.2],
  wave: [4, 6.2, 8, 6.4, 3.8, 3.2, 5.4, 7.6, 7, 5],
  step: [3, 3.4, 3, 3.3, 7, 7.3, 6.8, 7.2, 9, 8.8],
};

export function TrendMark({ trend, tone }: { trend: Trend; tone: Tone }) {
  return <Sparkline values={TREND_SHAPES[trend]} tone={tone} dot={false} area width={72} height={20} />;
}
