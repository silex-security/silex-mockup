import { notFound } from "next/navigation";
import { Main } from "@/components/AppHeader";
import { CreateVariantForm } from "@/components/CreateVariantForm";
import { TeamHeader } from "@/components/TeamHeader";
import { Gantt } from "@/components/charts/Gantt";
import { Card } from "@/components/ui";
import { getRole, getTeam, getTeamStructure, getTraceRun, teamsForRole } from "@/lib/data/service";
import { laneViews } from "@/lib/data/lanes";

export default async function VariantPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ run?: string }>;
}) {
  const { teamId } = await params;
  const { run: runParam } = await searchParams;
  const team = getTeam(teamId);
  if (!team) notFound();
  const structure = getTeamStructure(teamId);
  const run = getTraceRun(teamId, runParam ?? structure?.runId ?? "");
  if (!run) notFound();
  const role = getRole(run.focus.roleId);

  return (
    <Main>
      <TeamHeader team={team} tab="trace" crumb="Create variant" />
      <div className="flex flex-wrap items-start gap-4">
        <Card aria-label="Trace replay" className="min-w-0 flex-[999_1_600px] overflow-hidden">
          <div className="border-b border-line px-4 py-3 font-semibold">
            Run #{run.runId} · {run.durationSeconds}s · the change targets {run.focus.taskId} {run.focus.title}
          </div>
          <Gantt lanes={laneViews(team, run)} duration={run.durationSeconds} initialAt={structure?.atSeconds ?? 0} showMarkers={false} compact />
        </Card>
        <aside aria-label="Create variant" className="card min-w-0 max-w-[600px] flex-[1_1_520px] p-5">
          <CreateVariantForm
            teamId={team.id}
            teamName={team.name}
            roleName={role.name}
            target={`${run.focus.taskId} ${run.focus.title}`}
            sharedTeams={teamsForRole(role.id).length}
            runId={run.runId}
            baseline={team.baseline}
            variant={run.variant}
          />
        </aside>
      </div>
    </Main>
  );
}
