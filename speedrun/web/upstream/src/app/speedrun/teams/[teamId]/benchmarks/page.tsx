import { notFound } from "next/navigation";
import { Main } from "@/components/AppHeader";
import { TeamHeader } from "@/components/TeamHeader";
import { LineChart } from "@/components/charts/LineChart";
import { IconPlay } from "@/components/icons";
import { Bar, ButtonLink, Card, Kicker, Tag, btnClass, cx } from "@/components/ui";
import { getBenchmarks, getTeam } from "@/lib/data/service";
import { fmtPct, fmtUsd } from "@/lib/format";

export default async function BenchmarksPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const team = getTeam(teamId);
  if (!team) notFound();
  const b = getBenchmarks(teamId);

  if (!b) {
    return (
      <Main>
        <TeamHeader team={team} tab="benchmarks" crumb="Benchmarks" />
        <Card className="p-8 text-center text-mut">
          {team.name} has no benchmark suite yet. <a className="text-acc-text" href={`/speedrun/teams/${teamId}/builder`}>Build one from the ontology →</a>
        </Card>
      </Main>
    );
  }

  const { suite, scorecard: sc } = b;
  const cases = suite.anchorCases + suite.rollingCases;
  const weeklyExec = cases * suite.repeats;
  const fitHits = b.fit.filter((f) => f.fit).length;
  const markerIdx = b.markers.map((m) => ({ index: b.weeks.indexOf(m.week), label: m.label }));
  const shadeFrom = b.p95Production.findIndex((v, i) => v - b.p95Benchmark[i] >= 5);
  const gap = shadeFrom >= 0 ? b.p95Production.at(-1)! - b.p95Benchmark.at(-1)! : 0;

  const range = (vals: number[], pad: number, step: number) => [
    Math.floor((Math.min(...vals) - pad) / step) * step,
    Math.ceil((Math.max(...vals) + pad) / step) * step,
  ];
  const [passMin, passMax] = range(b.passK.map((v) => v * 100), 1, 5);
  const [p95Min, p95Max] = range([...b.p95Benchmark, ...b.p95Production], 2, 5);

  const gatesPass = sc.quality.gate === "pass" && sc.safety.gate === "pass";
  const scored = gatesPass ? <Tag>Scored</Tag> : <Tag tone="mut">Not scored</Tag>;
  const gate = (state: "pass" | "fail") =>
    state === "pass" ? <Tag tone="mint">✓ Gate passed</Tag> : <Tag tone="rose">✕ Gate failed</Tag>;

  return (
    <Main>
      <TeamHeader team={team} tab="benchmarks" crumb="Benchmarks" />

      <Card aria-label="Benchmark suite" className="flex flex-wrap items-center gap-5 px-5 py-3.5">
        <div className="flex flex-col gap-1">
          <span className="lbl">Suite</span>
          <span className="font-semibold">{suite.name} {suite.version}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="lbl">Case sets</span>
          <span className="text-sm"><strong>Anchor</strong> {suite.anchorCases}, frozen · <strong>Rolling</strong> {suite.rollingCases}, refreshed {suite.rollingRefreshedDaysAgo}d ago</span>
        </div>
        <div className="flex flex-col gap-1"><span className="lbl">Repeats</span><span className="font-mono text-sm">k = {suite.repeats}</span></div>
        <div className="flex flex-col gap-1"><span className="lbl">Pinned to</span><span className="font-mono text-[13px]">{suite.pinned}</span></div>
        <div className="flex-1" />
        <div className="flex flex-col gap-1 text-right"><span className="lbl">Last run {suite.lastRun} · next {suite.nextRun}</span><span className="lbl">Also on model, prompt, tool or team change</span></div>
        <button type="button" className={btnClass(true)}><IconPlay size={12} />Run now</button>
      </Card>

      <section aria-label="Scorecard" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <Kicker>Scorecard · run {suite.lastRun}</Kicker>
          <span className="lbl !text-[13px]">Checked in order — efficiency only counts once quality and safety pass. All scores graded <strong className="text-fg2">simulated</strong>.</span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ScoreCard n={1} title="Quality" status={gate(sc.quality.gate)}>
            <Metric label="Task success" value={fmtPct(sc.quality.taskSuccess)} sub={`± ${sc.quality.taskSuccessCi}`} />
            <Metric label={`pass^${suite.repeats} (all ${suite.repeats} runs)`} value={fmtPct(sc.quality.passK)} sub={`± ${sc.quality.passKCi}`} />
          </ScoreCard>
          <ScoreCard n={2} title="Safety" status={gate(sc.safety.gate)}>
            <Metric label="New policy violations" value={String(sc.safety.newViolations)} sub={`vs baseline ${team.baseline}`} />
            <Metric label="Reuse validity" value={fmtPct(sc.safety.reuseValidity)} sub="reused entries still valid" />
          </ScoreCard>
          <ScoreCard n={3} title="Efficiency" status={scored}>
            <Metric label="Net cost / success" value={fmtUsd(sc.efficiency.netCostPerSuccess)} sub={`incl. Silex overhead ${fmtUsd(sc.efficiency.silexOverhead)}`} />
            <Metric label="P50 · P95" value={`${sc.efficiency.p50}s · ${sc.efficiency.p95}s`} sub={`P95 ± ${sc.efficiency.p95Ci}s`} />
          </ScoreCard>
          <ScoreCard n={4} title="Teamwork" status={scored}>
            <Metric label="Team vs best single member" value={`${sc.teamwork.teamVsBestMemberPp > 0 ? "+" : ""}${sc.teamwork.teamVsBestMemberPp}pp`} sub={sc.teamwork.teamVsBestMemberPp > 0 ? "success; team wins" : "best member wins"} valueClass={sc.teamwork.teamVsBestMemberPp > 0 ? "text-mint-text" : "text-rose-text"} />
            <Metric label="Blocked · overhead" value={`${sc.teamwork.blockedSeconds}s · ${sc.teamwork.overheadPct}%`} sub="per run · of tokens" />
          </ScoreCard>
        </div>
      </section>

      <div className="flex flex-wrap gap-3.5">
        <Card aria-label="Reliability trend" className="flex min-w-0 flex-[1_1_520px] flex-col gap-1.5 px-5 py-4">
          <div className="flex items-baseline gap-2.5"><span className="font-semibold">Reliability · pass^{suite.repeats}</span><span className="lbl">anchor set, weekly</span></div>
          <LineChart
            labels={b.weeks}
            series={[{ name: "pass^k", values: b.passK.map((v) => v * 100), color: "var(--acc2)" }]}
            min={passMin}
            max={passMax}
            format={(v) => `${v.toFixed(v % 1 ? 1 : 0)}%`}
            markers={markerIdx}
            ariaLabel={`pass^${suite.repeats} from ${fmtPct(b.passK[0])} to ${fmtPct(b.passK.at(-1)!)}`}
          />
        </Card>
        <Card aria-label="Latency trend" className="flex min-w-0 flex-[1_1_520px] flex-col gap-1.5 px-5 py-4">
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="font-semibold">P95 latency · benchmark vs production</span>
            <span className="flex gap-3 text-xs text-mut">
              <span className="flex items-center gap-1.5"><span className="h-[3px] w-3.5 rounded bg-acc2" />Benchmark · simulated</span>
              <span className="flex items-center gap-1.5"><span className="h-[3px] w-3.5 rounded bg-fg2" />Production · observed</span>
            </span>
          </div>
          <LineChart
            labels={b.weeks}
            series={[
              { name: "Production", values: b.p95Production, color: "var(--fg2)", width: 2 },
              { name: "Benchmark", values: b.p95Benchmark, color: "var(--acc2)" },
            ]}
            min={p95Min}
            max={p95Max}
            format={(v) => `${Math.round(v)}s`}
            shadeFrom={shadeFrom >= 0 ? shadeFrom : undefined}
            shadeLabel={gap ? `fit gap ${gap}s` : undefined}
            ariaLabel="Benchmark and production P95 latency over eight weeks"
          />
        </Card>
      </div>

      <div className="flex flex-wrap items-start gap-3.5">
        <Card aria-label="Benchmark fit" className="min-w-0 flex-[999_1_600px] overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
            <div>
              <div className="text-base font-semibold">Benchmark fit</div>
              <div className="lbl !text-[13px]">Did the benchmark predict what production later measured?</div>
            </div>
            <div className="flex-1" />
            <span className="text-[22px] font-bold">{fitHits} of {b.fit.length}</span>
            <span className="lbl">changes within interval</span>
          </div>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-inset text-left text-xs font-semibold text-mut">
                <th className="px-3.5 py-2.5">Change</th><th>Benchmark predicted</th><th>Production measured</th><th>Fit</th>
              </tr>
            </thead>
            <tbody>
              {b.fit.map((f) => (
                <tr key={f.change} className={cx("border-t border-line", !f.fit && "bg-amb-wash")}>
                  <td className="px-3.5 py-2.5">{f.fit ? f.change : <strong>{f.change}</strong>} {f.note ? <span className="lbl">{f.note}</span> : null}</td>
                  <td className="font-mono">{f.predicted}</td>
                  <td className={cx("font-mono", !f.fit && "font-semibold text-amb-text")}>{f.measured}</td>
                  <td>{f.fit ? <Tag tone="mint">✓</Tag> : <Tag tone="amb">✕ Miss</Tag>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3 text-[13px]">
            <span className="flex-[1_1_320px] leading-snug text-fg2"><strong>{b.fitNote.title}:</strong> {b.fitNote.text}</span>
            {b.fitNote.action ? <ButtonLink href={`/speedrun/teams/${teamId}/builder`}>{b.fitNote.action}</ButtonLink> : null}
          </div>
        </Card>
        <aside className="flex min-w-0 max-w-[460px] flex-[1_1_380px] flex-col gap-3.5">
          <Card aria-label="Results by case type" className="flex flex-col gap-2.5 p-4">
            <div className="flex items-baseline gap-2"><span className="font-semibold">pass^{suite.repeats} by case type</span><span className="lbl">{cases} cases</span></div>
            {b.caseTypes.map((ct) => {
              const weak = ct.passK < 0.85;
              return (
                <div key={ct.name} className="grid grid-cols-[150px_minmax(0,1fr)_60px] items-center gap-3 text-[13px]">
                  <span>{ct.name} <span className="lbl">{ct.cases}</span></span>
                  <Bar value={ct.passK} tone={weak ? "amb" : "acc2"} height={8} />
                  <span className={cx("text-right font-mono", weak && "font-semibold text-amb-text")}>{fmtPct(ct.passK)}</span>
                </div>
              );
            })}
            <span className="lbl">{b.weakSpotNote}</span>
          </Card>
          <Card aria-label="Benchmark cost" className="flex items-center gap-3 px-4 py-3.5">
            <div className="flex-1">
              <div className="text-sm font-semibold">≈ {fmtUsd(weeklyExec * suite.costPerExecution, 0)} / week to run</div>
              <div className="lbl">{weeklyExec} executions · counted in net cost / success</div>
            </div>
          </Card>
        </aside>
      </div>
    </Main>
  );
}

function ScoreCard({ n, title, status, children }: { n: number; title: string; status: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card flex flex-col gap-2.5 p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-fg font-mono text-[11px] font-bold text-card">{n}</span>
        <span className="font-semibold">{title}</span>
        <div className="flex-1" />
        {status}
      </div>
      <div className="grid grid-cols-2 gap-2.5">{children}</div>
    </div>
  );
}

function Metric({ label, value, sub, valueClass }: { label: string; value: string; sub: string; valueClass?: string }) {
  return (
    <div>
      <div className="lbl">{label}</div>
      <div className={cx("text-[26px] font-bold tracking-tight", valueClass)}>{value}</div>
      <div className="lbl">{sub}</div>
    </div>
  );
}
