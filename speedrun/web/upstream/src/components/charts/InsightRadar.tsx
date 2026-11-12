/**
 * Insight radar: one revolution = seven days. Each bar is a time bucket's run
 * volume; amber bars carry a P95 regression; rose rings are anomalies.
 */
export function InsightRadar({
  volumes,
  regression,
  anomalies,
  days,
  totalRuns,
  calloutTitle,
}: {
  volumes: number[];
  regression: { from: number; to: number; label: string };
  anomalies: number[];
  days: string[];
  totalRuns: string;
  calloutTitle: string;
}) {
  const C = 260;
  const R0 = 128;
  const n = volumes.length;
  const maxV = Math.max(...volumes);
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (a: number, r: number) => [C + r * Math.cos(a), C + r * Math.sin(a)] as const;

  const bars = volumes.map((v, i) => {
    const a = angle(i);
    const [x1, y1] = pt(a, R0);
    const [x2, y2] = pt(a, R0 + 10 + (v / maxV) * 62);
    return { x1, y1, x2, y2, regress: i >= regression.from && i <= regression.to };
  });

  const dayAngle = (k: number) => -Math.PI / 2 + (k * 2 * Math.PI) / days.length;
  const mid = (regression.from + regression.to) / 2;
  const [calloutX, calloutY] = pt(angle(mid), 220);

  return (
    <div className="relative mx-auto w-full max-w-[620px]">
      <svg viewBox="-70 0 660 520" width="100%" role="img" aria-label={`Runs across seven days; ${calloutTitle} ${regression.label}`}>
        <ellipse cx={C} cy={C} rx={250} ry={120} fill="none" stroke="var(--acc2)" strokeOpacity={0.25} transform={`rotate(-24 ${C} ${C})`} />
        <ellipse cx={C} cy={C} rx={240} ry={150} fill="none" stroke="var(--acc2)" strokeOpacity={0.14} transform={`rotate(38 ${C} ${C})`} />
        <circle cx={C} cy={C} r={208} fill="none" stroke="var(--line)" />
        <circle cx={C} cy={C} r={R0} fill="none" stroke="var(--line2)" />
        <circle cx={C} cy={C} r={104} fill="none" stroke="var(--rose)" strokeOpacity={0.45} strokeDasharray="2 5" />
        <circle cx={C} cy={C} r={64} fill="var(--wash)" stroke="var(--acc2)" strokeOpacity={0.4} />
        {days.map((_, k) => {
          const [a1, b1] = pt(dayAngle(k), R0);
          const [a2, b2] = pt(dayAngle(k), 208);
          return <line key={k} x1={a1} y1={b1} x2={a2} y2={b2} stroke="var(--line)" />;
        })}
        {bars.map((b, i) => (
          <line
            key={i}
            x1={b.x1}
            y1={b.y1}
            x2={b.x2}
            y2={b.y2}
            stroke={b.regress ? "var(--amb)" : "var(--acc2)"}
            strokeOpacity={b.regress ? 1 : 0.55}
            strokeWidth={3}
            strokeLinecap="round"
          />
        ))}
        {anomalies.map((i) => {
          const [x, y] = pt(angle(i), 104);
          return <circle key={i} cx={x} cy={y} r={5.5} fill="var(--card)" stroke="var(--rose)" strokeWidth={2} />;
        })}
        <text x={C} y={C - 6} textAnchor="middle" fill="var(--fg)" fontSize={22} fontWeight={700}>
          {totalRuns}
        </text>
        <text x={C} y={C + 16} textAnchor="middle" fill="var(--mut)" fontSize={11} letterSpacing={1.5}>
          RUNS · 7D
        </text>
        {days.map((d, k) => {
          const a = dayAngle(k);
          const [x, y] = pt(a, 236);
          const anchor = Math.abs(Math.cos(a)) < 0.2 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
          return (
            <text key={d} x={x} y={y + 4} textAnchor={anchor} fill="var(--mut)" fontSize={12} fontFamily="var(--font-mono)">
              {d}
            </text>
          );
        })}
      </svg>
      <div
        className="absolute whitespace-nowrap rounded-lg border border-amb bg-card px-3 py-2 text-xs shadow-[var(--pop-shadow)]"
        style={{ left: `${((calloutX + 70) / 660) * 100}%`, top: `${(calloutY / 520) * 100}%` }}
      >
        <div className="font-semibold">{calloutTitle}</div>
        <div className="text-amb-text">{regression.label}</div>
      </div>
    </div>
  );
}
