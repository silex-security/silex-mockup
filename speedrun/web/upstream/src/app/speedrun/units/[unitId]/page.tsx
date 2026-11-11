import Link from "next/link";
import { notFound } from "next/navigation";
import { Main } from "@/components/AppHeader";
import { CoverageStrip, KpiRow, RolesValue } from "@/components/blocks";
import { RelationshipGraph } from "@/components/charts/RelationshipGraph";
import { IconPerson, IconTeam, IconWarn } from "@/components/icons";
import { ScopeNav } from "@/components/nav";
import { Card, Kicker, PageTitle, Pill, Tag } from "@/components/ui";
import { getUnit, listUnits, unitRoles } from "@/lib/data/service";
import { fmtInt, fmtPct, fmtUsd } from "@/lib/format";

export const metadata = { title: "Business Unit · SILEX Speedrun" };

export default async function UnitPage({
  params,
  searchParams,
}: {
  params: Promise<{ unitId: string }>;
  searchParams: Promise<{ role?: string }>;
}) {
  const { unitId } = await params;
  const { role } = await searchParams;
  const summary = getUnit(unitId);
  if (!summary) notFound();
  const { unit, totals: t, teams } = summary;

  const leadIds = new Set(teams.flatMap((x) => x.members.filter((mb) => mb.isLead).map((mb) => mb.roleId)));
  const teammates = unitRoles(unitId)
    .filter((r) => !leadIds.has(r.role.id))
    .sort((a, b) => b.teamIds.length - a.teamIds.length || a.role.name.localeCompare(b.role.name));
  const selected = teammates.find((r) => r.role.id === role) ?? teammates[0];
  const selectedTeams = teams.filter((x) => selected.teamIds.includes(x.id));
  const selectedRuns = selectedTeams.reduce((s, x) => s + x.runs, 0);

  return (
    <Main>
      <PageTitle
        kicker="Speedrun · Business Unit"
        title={
          <span className="flex flex-wrap items-center gap-3.5">
            Business Unit
            <span className="flex gap-1.5 text-sm font-semibold">
              {listUnits().map((u) => (
                <Link
                  key={u.unit.id}
                  href={`/speedrun/units/${u.unit.id}`}
                  aria-current={u.unit.id === unitId ? "page" : undefined}
                  className={`rounded-[10px] border px-3.5 py-2 ${u.unit.id === unitId ? "border-acc2 bg-acc-wash text-acc-text" : "border-line2 bg-card text-fg2"}`}
                >
                  {u.unit.name}
                </Link>
              ))}
            </span>
          </span>
        }
      >
        <ScopeNav active="unit" unitId={unitId} />
        <Pill className="!h-11 px-3.5">Last 7 days</Pill>
      </PageTitle>

      <CoverageStrip {...unit.coverage} />

      <KpiRow
        items={[
          { label: "Agent teams", value: t.teams },
          { label: "Agent roles / instances", value: <RolesValue roles={t.agentRoles} instances={t.instances} /> },
          { label: "Completed runs", value: fmtInt(t.runs) },
          { label: "Total cost", value: fmtUsd(t.totalCost) },
          { label: "Cost / successful run", value: fmtUsd(t.costPerSuccess) },
          { label: "Success rate", value: fmtPct(t.successRate) },
          { label: "P95 latency", value: `${unit.p95Seconds}s` },
          { label: "Performance anomalies", value: t.anomalies, tone: "amb" },
        ]}
      />

      <Card aria-label="Team and agent relationships" className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
          <span className="flex items-center gap-2 font-semibold">
            <IconTeam size={16} />
            Team–agent relationships
          </span>
          <span className="lbl">Who is on which agent team — and which agents are shared. Select a teammate to inspect it.</span>
          <div className="flex-1" />
          <span className="text-[13px] text-mut">
            {t.teams} agent teams · {teammates.length} teammates · each team&apos;s lead shown on its card
          </span>
        </div>
        <div className="flex flex-wrap">
          <div className="dot-grid min-w-0 flex-[999_1_640px] overflow-x-auto py-4">
            <RelationshipGraph unitId={unitId} teams={teams} teammates={teammates} selectedRoleId={selected.role.id} />
          </div>
          <aside aria-label="Agent details" className="flex min-w-0 max-w-[420px] flex-[1_1_340px] flex-col gap-3.5 border-l border-line p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-acc-wash text-acc-text">
                <IconPerson size={20} />
              </span>
              <div>
                <div className="text-[22px] font-bold">{selected.role.name}</div>
                {selected.teamIds.length > 1 ? <Tag tone="solid">Shared agent</Tag> : <Tag tone="mut">Single team</Tag>}
              </div>
            </div>
            <p className="m-0 text-sm leading-relaxed text-fg2">{selected.role.description}</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-[10px] border border-line bg-inset p-2.5">
                <div className="lbl">Runs it took part in</div>
                <div className="text-[17px] font-bold">{fmtInt(selectedRuns)}</div>
              </div>
              <div className="rounded-[10px] border border-line bg-inset p-2.5">
                <div className="lbl">Teams</div>
                <div className="text-[17px] font-bold">{selected.teamIds.length}</div>
              </div>
            </div>
            <div className="flex flex-col gap-2 border-t border-line pt-3">
              <Kicker>Member of agent teams · {selectedTeams.length}</Kicker>
              {selectedTeams.map((x) => (
                <Link key={x.id} href={`/speedrun/teams/${x.id}`} className="flex h-11 items-center gap-2.5 rounded-[10px] border border-line bg-inset px-3 text-sm text-fg hover:border-acc2">
                  <IconTeam size={16} />
                  {x.name}
                  <span className="flex-1" />
                  <span className="lbl">{x.members.find((mb) => mb.roleId === selected.role.id)?.duty}</span>
                </Link>
              ))}
            </div>
            {selected.teamIds.length > 1 ? (
              <div className="flex gap-2.5 rounded-xl bg-amb-wash p-3 text-[13px] leading-snug text-amb-text">
                <IconWarn size={16} className="mt-0.5 flex-none" />
                <span>
                  {selected.teamIds.length} leads, {selected.teamIds.length} permission contexts: this agent inherits a different lead&apos;s permissions in each team. A change reaches all of them, so Agent Gym tests it against each team&apos;s cases.
                </span>
              </div>
            ) : null}
          </aside>
        </div>
      </Card>
    </Main>
  );
}
