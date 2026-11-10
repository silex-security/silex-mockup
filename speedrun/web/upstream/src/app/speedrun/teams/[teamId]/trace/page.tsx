import { notFound } from "next/navigation";
import { Main } from "@/components/AppHeader";
import { TeamHeader } from "@/components/TeamHeader";
import { Gantt } from "@/components/charts/Gantt";
import { IconArrowRight } from "@/components/icons";
import { Avatar, ButtonLink, Card, Tag, cx } from "@/components/ui";
import { getRole, getTeam, getTeamStructure, getTraceRun } from "@/lib/data/service";
import { laneViews } from "@/lib/data/lanes";
import { fmtUsd } from "@/lib/format";

const OUTCOME = {
  authorized: { label: "Authorized", cls: "text-mint-text" },
  approved: { label: "Approved", cls: "text-mint-text" },
  resolved: { label: "Resolved", cls: "text-mint-text" },
  escalated: { label: "Escalated", cls: "text-amb-text" },
  failed: { label: "Failed", cls: "text-rose-text" },
  rejected: { label: "Rejected", cls: "text-rose-text" },
} as const;

export default async function TracePage({
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

  if (!run) {
    return (
      <Main>
        <TeamHeader team={team} tab="trace" crumb="Trace" />
        <Card className="p-8 text-center text-mut">No reconstructed trace is available for {team.name} yet.</Card>
      </Main>
    );
  }

  const f = run.focus;
  const top = structure?.candidates.find((c) => c.status === "recommended");
  const second = structure?.candidates.find((c) => c.status === "candidate");

  return (
    <Main>
      <TeamHeader team={team} tab="trace" crumb={`Run #${run.runId}`} />

      <Card aria-label="Run measures" className="grid grid-cols-2 overflow-hidden md:grid-cols-3 xl:grid-cols-6">
        {[
          ["Duration", `${run.durationSeconds}s`],
          ["Cost", fmtUsd(run.cost)],
          ["Outcome", OUTCOME[run.outcome].label],
          ["Critical path", run.criticalPath.join(" → ")],
          ["Blocked teammate time", `${run.blockedSeconds}s`],
          ["Messages", String(run.lanes.reduce((s, l) => s + l.messages.length, 0))],
        ].map(([k, v], i) => (
          <div key={k} className={cx("flex flex-col gap-0.5 px-4 py-2.5", i > 0 && "border-l border-line")}>
            <span className="lbl">{k}</span>
            <span className={cx("text-xl font-bold", k === "Outcome" && OUTCOME[run.outcome].cls, k === "Blocked teammate time" && "text-amb-text")}>{v}</span>
          </div>
        ))}
      </Card>

      <div className="flex flex-wrap items-start gap-4">
        <Card aria-label="Trace replay" className="min-w-0 flex-[999_1_700px] overflow-hidden">
          <div className="flex flex-wrap items-center gap-3.5 border-b border-line px-4 py-3">
            <span className="font-semibold">Run #{run.runId} — who waited on whom</span>
            <div className="flex-1" />
            <div className="flex flex-wrap gap-3 text-xs text-mut">
              <span className="flex items-center gap-1.5"><span className="h-2 w-3.5 rounded-sm bg-amb" />Critical path</span>
              <span className="flex items-center gap-1.5"><span className="blocked h-1.5 w-4" />Blocked / idle</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-3.5 rounded-sm border-[1.5px] border-dashed border-acc2" />Reusable context</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px] bg-acc2" />Message</span>
            </div>
          </div>
          <Gantt lanes={laneViews(team, run)} duration={run.durationSeconds} initialAt={structure?.atSeconds ?? 0} />
        </Card>

        <aside aria-label="Task details" className="card flex min-w-0 max-w-[450px] flex-[1_1_380px] flex-col gap-3.5 p-5">
          <div className="flex items-center gap-3">
            <Avatar initials={getRole(f.roleId).initials} size={40} variant="solid" />
            <div>
              <div className="text-lg font-semibold">{f.taskId} · {f.title}</div>
              <div className="lbl !text-[13px]">{getRole(f.roleId).name} · {f.tool}</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[["Duration", `${f.durationSeconds}s`], ["Cost", fmtUsd(f.cost)], ["Attempts", String(f.attempts)]].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-line bg-inset px-3 py-2.5">
                <div className="lbl">{k}</div>
                <div className="text-xl font-bold">{v}</div>
              </div>
            ))}
          </div>
          <div className="rounded-[10px] border border-line p-3 text-[13px] leading-relaxed">
            <div><span className="lbl">Acted as</span> {f.actedAs}</div>
            <div><span className="lbl">State touched</span> {f.stateTouched} <Tag tone="rose">live · never reused</Tag></div>
            <div><span className="lbl">Downstream</span> {f.downstream}</div>
          </div>
          {top ? (
            <div className="flex flex-col gap-2.5 rounded-[14px] border-[1.5px] border-acc2 p-4">
              <Tag className="self-start !h-[26px] !text-xs">{top.id} · {top.objective}</Tag>
              <div className="text-xl font-bold">{top.title}</div>
              <div className={cx("grid gap-2", (top.params?.length ?? 0) > 1 ? "grid-cols-2" : "grid-cols-1")}>
                {top.params?.map((p) => (
                  <div key={p.name} className="rounded-xl border border-line bg-inset px-3 py-2.5">
                    <div className="lbl">{p.name}</div>
                    <div className="text-lg font-bold">{p.current} → <span className="text-acc-text">{p.candidate}</span></div>
                  </div>
                ))}
              </div>
              <div className="lbl !text-[13px]">{top.estimate} estimated{top.estimateNote ? ` · ${top.estimateNote}` : ""} · validate in Agent Gym</div>
            </div>
          ) : null}
          {second?.brief ? (
            <div className="flex gap-2 rounded-[10px] bg-wash px-3 py-2.5 text-[13px] leading-snug">
              <span className="font-mono font-bold text-acc-text">{second.id}</span>
              <span>{second.brief}</span>
            </div>
          ) : null}
          <ButtonLink href={`/speedrun/teams/${teamId}/variant?run=${run.runId}`} primary className="!h-[52px] !text-base">
            Create variant <IconArrowRight />
          </ButtonLink>
        </aside>
      </div>
    </Main>
  );
}
