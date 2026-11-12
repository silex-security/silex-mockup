import Link from "next/link";
import { Main } from "@/components/AppHeader";
import { CoverageStrip, KpiRow, RolesValue } from "@/components/blocks";
import { InsightRadar } from "@/components/charts/InsightRadar";
import { Sparkline } from "@/components/charts/Sparkline";
import { IconLedger, IconTeam } from "@/components/icons";
import { ScopeNav } from "@/components/nav";
import { ANOMALY, Card, Kicker, PageTitle, Pill, Tag, cx } from "@/components/ui";
import { getOrg } from "@/lib/data/service";
import { fmtInt, fmtPct, fmtUsd } from "@/lib/format";

export const metadata = { title: "Organization · SILEX Speedrun" };

const TREND = { improving: { tone: "mint", label: "Improving" }, flat: { tone: "mut", label: "Flat" }, regressing: { tone: "rose", label: "Regressing" } } as const;

export default function OrganizationPage() {
  const org = getOrg();
  const t = org.totals;
  const health = org.benchmarkHealth;
  const counts = {
    improving: health.filter((h) => h.trend === "improving").length,
    flat: health.filter((h) => h.trend === "flat").length,
    regressing: health.filter((h) => h.trend === "regressing").length,
    overdue: health.filter((h) => h.refreshOverdue).length,
  };
  const radarTeam = org.units.flatMap((u) => u.teams).find((x) => x.id === org.radar.regression.teamId);

  return (
    <Main>
      <PageTitle kicker="Speedrun · Organization" title="Organization">
        <ScopeNav active="org" />
        <Pill className="!h-10 px-3.5">Last 7 days</Pill>
      </PageTitle>

      <CoverageStrip {...org.coverage} />

      <KpiRow
        items={[
          { label: "Agent teams", value: t.teams },
          { label: "Agent roles / instances", value: <RolesValue roles={t.agentRoles} instances={t.instances} /> },
          { label: "Completed runs", value: fmtInt(t.runs) },
          { label: "Total cost", value: fmtUsd(t.totalCost) },
          { label: "Cost / successful run", value: fmtUsd(t.costPerSuccess) },
          { label: "Success rate", value: fmtPct(t.successRate) },
          { label: "P95 latency", value: `${org.p95Seconds}s` },
          { label: "Performance anomalies", value: t.anomalies, tone: "amb" },
        ]}
      />

      <div className="flex flex-wrap gap-4">
        <Card aria-label="Insight radar" className="flex min-w-0 flex-[1_1_600px] flex-col gap-2 overflow-hidden px-6 py-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-col gap-1">
              <Kicker>Insight radar</Kicker>
              <span className="text-xl font-semibold">Seven days of runs, one revolution</span>
            </div>
            <div className="flex-1" />
            <div className="flex gap-4 text-xs text-mut">
              <span className="flex items-center gap-1.5"><span className="h-[3px] w-3.5 rounded bg-acc2" />Runs</span>
              <span className="flex items-center gap-1.5"><span className="h-[3px] w-3.5 rounded bg-amb" />P95 regression</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border-[1.5px] border-rose" />Anomaly</span>
            </div>
          </div>
          <InsightRadar
            volumes={org.radar.volumes}
            regression={org.radar.regression}
            anomalies={org.radar.anomalies}
            days={org.radar.days}
            totalRuns={fmtInt(t.runs)}
            calloutTitle={radarTeam?.name ?? ""}
          />
        </Card>

        <Card aria-label="Performance anomalies" className="flex min-w-0 flex-[1_1_460px] flex-col gap-3 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex flex-col gap-1">
              <Kicker>Performance anomalies</Kicker>
              <span className="text-xl font-semibold">Agent teams that drifted in the last 7 days</span>
            </div>
            <div className="flex-1" />
            <Tag tone="solid" className="!h-[26px]">{t.anomalies} open</Tag>
          </div>
          {org.units.map((u) => (
            <div key={u.unit.id} className="flex flex-col gap-1">
              <Link href={`/speedrun/units/${u.unit.id}`} className="flex items-center gap-2.5 border-t border-line pt-3 text-fg hover:text-acc-text">
                {u.unit.icon === "people" ? <IconTeam size={18} /> : <IconLedger size={18} />}
                <span className="text-md font-semibold">{u.unit.name}</span>
                <span className="lbl">
                  {u.totals.teams} agent teams · {u.totals.anomalies} open
                </span>
              </Link>
              {u.teams
                .filter((x) => x.anomaly)
                .map((x) => (
                  <Link
                    key={x.id}
                    href={`/speedrun/teams/${x.id}`}
                    className="grid min-h-11 grid-cols-[104px_minmax(0,1fr)_auto_20px] items-center gap-3 rounded-lg px-2 py-2 text-fg hover:bg-wash"
                  >
                    <Tag tone={ANOMALY[x.anomaly!.kind].tone} className="justify-self-start">{ANOMALY[x.anomaly!.kind].label}</Tag>
                    <span className="flex flex-col">
                      <span className="font-semibold">{x.name}</span>
                      <span className="lbl">{x.members.length} agents</span>
                    </span>
                    <span className="font-mono text-base">{x.anomaly!.metric}</span>
                    <span aria-hidden className="text-mut">↗</span>
                  </Link>
                ))}
            </div>
          ))}
        </Card>
      </div>

      <Card aria-label="Benchmark health" className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <div className="flex flex-col gap-1">
            <Kicker>Benchmark health</Kicker>
            <span className="text-xl font-semibold">Each agent team&apos;s own suite, run weekly in the sandbox</span>
          </div>
          <div className="flex-1" />
          <Tag tone="mint" className="!h-7 !text-xs">{counts.improving} improving</Tag>
          <Tag tone="mut" className="!h-7 !text-xs">{counts.flat} flat</Tag>
          <Tag tone="rose" className="!h-7 !text-xs">{counts.regressing} regressing</Tag>
          {counts.overdue ? <Tag tone="amb" className="!h-7 !text-xs">{counts.overdue} suite overdue for refresh</Tag> : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse text-md">
            <thead>
              <tr className="h-10 bg-inset text-left text-2xs font-semibold tracking-[0.1em] text-mut">
                <th className="px-5">AGENT TEAM</th>
                <th>SUITE</th>
                <th>TREND · 8 WEEKS</th>
                <th>PASS^3</th>
                <th>BENCHMARK FIT</th>
                <th>ROLLING SET</th>
              </tr>
            </thead>
            <tbody>
              {health.map((h) => (
                <tr key={h.teamId} className="h-12 border-t border-line hover:bg-wash">
                  <td className="px-5">
                    <Link href={`/speedrun/teams/${h.teamId}/benchmarks`} className="text-fg hover:text-acc-text">
                      <strong>{h.teamName}</strong> <span className="lbl">{h.unitName}</span>
                    </Link>
                  </td>
                  <td className="font-mono text-xs text-mut">{h.suiteVersion}</td>
                  <td>
                    <span className="flex items-center gap-2">
                      <Sparkline values={h.passKTrend} width={64} height={18} dot={false} tone={h.trend === "improving" ? "mint" : h.trend === "regressing" ? "rose" : "mut"} />
                      <Tag tone={TREND[h.trend].tone}>{TREND[h.trend].label}</Tag>
                    </span>
                  </td>
                  <td className={cx("font-mono", h.trend === "regressing" && "font-semibold text-rose-text")}>{fmtPct(h.passK)}</td>
                  <td>
                    {h.fitTotal < 2 ? (
                      <span className="lbl">Not enough changes yet ({h.fitTotal})</span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Tag tone={h.fitHits === h.fitTotal ? "mint" : h.fitHits / h.fitTotal >= 0.75 ? "amb" : "mut"}>
                          {h.fitHits} / {h.fitTotal}
                          {h.fitHits < h.fitTotal ? ` · ${h.fitTotal - h.fitHits} miss` : ""}
                        </Tag>
                        {h.fitNote ? <span className="lbl">{h.fitNote}</span> : null}
                      </span>
                    )}
                  </td>
                  <td>{h.refreshOverdue ? <Tag tone="amb">Overdue · {h.rollingRefreshedDaysAgo}d</Tag> : <span className="lbl">Refreshed {h.rollingRefreshedDaysAgo}d ago</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-line px-5 py-3 text-base text-mut">
          Benchmark scores are graded simulated. Fit compares each change&apos;s benchmark prediction with what production later measured.
        </div>
      </Card>
    </Main>
  );
}
