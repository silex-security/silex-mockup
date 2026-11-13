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

function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (text: string) => [...text].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

const TREND_BASE: Record<Trend, (rnd: () => number) => (t: number) => number> = {
  up: () => (t) => 0.15 + 0.7 * t,
  down: () => (t) => 0.85 - 0.7 * t,
  flat: () => () => 0.5,
  wave: (rnd) => {
    const f = 1.1 + 1.4 * rnd(), p = rnd(), amp = 0.2 + 0.12 * rnd();
    return (t) => 0.5 + amp * Math.sin(2 * Math.PI * (f * t + p));
  },
  step: (rnd) => {
    const cuts = [0.15 + 0.2 * rnd(), 0.45 + 0.15 * rnd(), 0.7 + 0.2 * rnd()];
    return (t) => 0.18 + 0.22 * cuts.filter((c) => t >= c).length;
  },
};
const TREND_NOISE: Record<Trend, number> = { up: 0.3, down: 0.3, flat: 0.34, wave: 0.2, step: 0.1 };
const TREND_POINTS = 26;

/** A decorative line: the trend's base curve plus a random walk seeded by `seed`. It carries no data. */
export function trendValues(trend: Trend, seed: string): number[] {
  const rnd = prng(hash(`${trend}-${seed}`)), base = TREND_BASE[trend](rnd);
  let drift = 0;
  return Array.from({ length: TREND_POINTS }, (_, i) => {
    drift = drift * 0.55 + (rnd() - 0.5) * TREND_NOISE[trend];
    return Math.min(1, Math.max(0, base(i / (TREND_POINTS - 1)) + drift));
  });
}

export function TrendMark({ trend, tone, seed, width = 112 }: { trend: Trend; tone: Tone; seed: string; width?: number }) {
  return <Sparkline values={trendValues(trend, seed)} tone={tone} dot={false} area width={width} height={22} />;
}
