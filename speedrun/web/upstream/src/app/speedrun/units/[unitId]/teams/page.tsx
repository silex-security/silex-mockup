import Link from "next/link";
import { notFound } from "next/navigation";
import { Main } from "@/components/AppHeader";
import { CoverageStrip, KpiRow, RolesValue } from "@/components/blocks";
import { Sparkline } from "@/components/charts/Sparkline";
import { IconSearch, IconTeam } from "@/components/icons";
import { ScopeNav } from "@/components/nav";
import { ANOMALY, Avatar, Bar, Card, PageTitle, Pill, Tag, btnClass, cx } from "@/components/ui";
import { costPerSuccess } from "@/lib/data/aggregate";
import { getRole, getUnit, teamsForRole } from "@/lib/data/service";
import { fmtInt, fmtPct, fmtUsd } from "@/lib/format";
import type { AgentTeam } from "@/lib/types";

export const metadata = { title: "Agent Team Explorer · SILEX Speedrun" };

const SORTS = {
  p95: { label: "P95", fn: (a: AgentTeam, b: AgentTeam) => b.p95Seconds - a.p95Seconds },
  runs: { label: "Runs", fn: (a: AgentTeam, b: AgentTeam) => b.runs - a.runs },
  cost: { label: "Cost / success", fn: (a: AgentTeam, b: AgentTeam) => costPerSuccess(b) - costPerSuccess(a) },
  success: { label: "Success rate", fn: (a: AgentTeam, b: AgentTeam) => a.successRate - b.successRate },
} as const;
type SortKey = keyof typeof SORTS;

export default async function TeamExplorerPage({
  params,
  searchParams,
}: {
  params: Promise<{ unitId: string }>;
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const { unitId } = await params;
  const { q = "", sort = "p95" } = await searchParams;
  const summary = getUnit(unitId);
  if (!summary) notFound();
  const { unit, totals: t } = summary;
  const sortKey: SortKey = sort in SORTS ? (sort as SortKey) : "p95";

  const needle = q.trim().toLowerCase();
  const rows = summary.teams
    .filter(
      (x) =>
        !needle ||
        x.name.toLowerCase().includes(needle) ||
        x.members.some((mb) => getRole(mb.roleId).name.toLowerCase().includes(needle)),
    )
    .sort(SORTS[sortKey].fn);

  const sharedRoles = new Set(summary.teams.flatMap((x) => x.members.map((mb) => mb.roleId)).filter((id, i, arr) => arr.indexOf(id) !== i));

  return (
    <Main>
      <PageTitle kicker={`${unit.name} / Performance`} title="Agent Team Explorer">
        <ScopeNav active="team" unitId={unitId} />
        <Pill className="!h-10 px-3.5">Last 7 days</Pill>
      </PageTitle>

      <CoverageStrip {...unit.coverage} />

      <KpiRow
        items={[
          { label: "Agent teams", value: t.teams, tone: "acc2", trend: "flat" },
          { label: "Agent roles / instances", value: <RolesValue roles={t.agentRoles} instances={t.instances} />, tone: "acc2", trend: "flat" },
          { label: "Completed runs", value: fmtInt(t.runs), tone: "acc2", trend: "up" },
          { label: "Total cost", value: fmtUsd(t.totalCost), tone: "amb", trend: "wave" },
          { label: "Cost / success", value: fmtUsd(t.costPerSuccess), tone: "amb", trend: "down" },
          { label: "Success rate", value: fmtPct(t.successRate), tone: "mint", trend: "up" },
          { label: "P95 latency", value: `${unit.p95Seconds}s`, tone: "acc2", trend: "wave" },
          { label: "Anomalies", value: t.anomalies, tone: "amb", trend: "step" },
        ]}
      />

      <form className="flex flex-wrap gap-3" action={`/speedrun/units/${unitId}/teams`}>
        <label className="flex h-10 flex-[1_1_360px] items-center gap-2.5 rounded-lg border border-line2 bg-card px-3.5">
          <IconSearch size={18} className="text-mut" />
          <input name="q" defaultValue={q} aria-label="Search agent teams" placeholder="Search agent teams or agents…" className="flex-1 bg-transparent text-md text-fg outline-none" />
        </label>
        <label className="flex items-center gap-2 text-md text-mut">
          Sort by
          <select name="sort" defaultValue={sortKey} className="h-10 rounded-lg border border-line2 bg-card px-3 text-md text-fg">
            {Object.entries(SORTS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </label>
        <button type="submit" className={btnClass()}>Apply</button>
      </form>

      <Card aria-label="Agent teams" className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-3.5">
          <span className="text-2xl font-bold">{unit.name}</span>
          <span className="h-5 w-px bg-line2" />
          <span className="text-md text-mut">
            {t.teams} agent teams · {t.agentRoles} agent roles, {sharedRoles.size} shared across teams
          </span>
          <div className="flex-1" />
          <Link href={`/speedrun/units/${unitId}`} className="text-md text-acc-text">Relationships →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] border-collapse">
            <thead>
              <tr className="h-12 border-b border-line text-left text-base text-mut">
                <th className="px-5 font-normal">Agent team</th>
                <th className="font-normal">Members</th>
                <th className="font-normal">Runs</th>
                <th className="font-normal">Cost / success</th>
                <th className="font-normal">Success rate</th>
                <th className="font-normal">P95{sortKey === "p95" ? " ↓" : ""}</th>
                <th className="font-normal">Anomalies</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => {
                const lowSuccess = x.anomaly?.kind === "low-success";
                return (
                  <tr key={x.id} className="h-20 border-b border-line text-md last:border-0 hover:bg-wash">
                    <td className="px-5">
                      <Link href={`/speedrun/teams/${x.id}`} className="flex items-center gap-3.5 text-fg">
                        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-line bg-inset"><IconTeam size={20} /></span>
                        <span className="flex flex-col gap-0.5">
                          <span className="text-lg font-semibold">{x.name}</span>
                          <span className="lbl !text-base">{x.description}</span>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <span className="flex items-center gap-2.5">
                        <span className="flex pl-2">
                          {x.members.map((mb) => {
                            const r = getRole(mb.roleId);
                            const shared = teamsForRole(mb.roleId).length > 1;
                            return (
                              <span key={mb.roleId} className="-ml-2 rounded-full border-2 border-card">
                                <Avatar initials={r.initials} size={28} title={`${r.name}${mb.isLead ? " · lead" : ""}${shared ? " · shared" : ""}`} variant={mb.isLead ? "lead" : shared ? "solid" : "wash"} />
                              </span>
                            );
                          })}
                        </span>
                        <span className="lbl">{x.members.length}</span>
                      </span>
                    </td>
                    <td className="font-mono">{fmtInt(x.runs)}</td>
                    <td className={cx("font-mono", x.anomaly?.kind === "expensive" && "font-semibold text-amb-text")}>{fmtUsd(costPerSuccess(x))}</td>
                    <td>
                      <span className="flex w-[130px] flex-col gap-1.5">
                        <span className={cx("font-semibold", lowSuccess && "text-rose-text")}>{fmtPct(x.successRate)}</span>
                        <Bar value={x.successRate} tone={lowSuccess ? "rose" : "acc2"} height={5} />
                      </span>
                    </td>
                    <td>
                      <span className="flex items-center gap-3">
                        <span className="font-mono font-semibold">{x.p95Seconds}s</span>
                        <Sparkline values={x.p95Trend} width={90} dot={false} tone={x.anomaly?.kind === "slow" ? "amb" : "mut"} />
                      </span>
                    </td>
                    <td>{x.anomaly ? <Tag tone={ANOMALY[x.anomaly.kind].tone} className="!h-6 !text-xs">{ANOMALY[x.anomaly.kind].label}</Tag> : <span className="lbl">—</span>}</td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-mut">
                    No agent teams match “{q}”.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap justify-between gap-3 border-t border-line px-5 py-3.5 text-md text-mut">
          <span className="flex items-center gap-2">
            Showing {rows.length} of {t.teams} agent teams · <Avatar initials="L" variant="lead" size={16} /> lead · <Avatar initials="S" variant="solid" size={16} /> shared across teams
          </span>
          <span>Sorted by {SORTS[sortKey].label}</span>
        </div>
      </Card>
    </Main>
  );
}
