/** Minimal sparkline. `tone` maps to a CSS variable so it follows the theme. */
export function Sparkline({
  values,
  width = 84,
  height = 22,
  tone = "acc2",
  dot = true,
  label,
}: {
  values: number[];
  width?: number;
  height?: number;
  tone?: "acc2" | "amb" | "mint" | "rose" | "mut";
  dot?: boolean;
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
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={color} strokeWidth={1.6} />
      {dot ? <circle cx={last[0]} cy={last[1]} r={2.4} fill={color} /> : null}
    </svg>
  );
}
