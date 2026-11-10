import Link from "next/link";
import type { AgentTeam } from "@/lib/types";
import { getRole, getUnit, teamsForRole } from "@/lib/data/service";
import { IconTeam } from "./icons";
import { TeamTabs, type TeamTab } from "./nav";
import { Avatar } from "./ui";

export function TeamHeader({ team, tab, crumb }: { team: AgentTeam; tab: TeamTab; crumb?: string }) {
  const unit = getUnit(team.unitId)!.unit;
  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-acc-wash text-acc-text">
        <IconTeam size={22} />
      </span>
      <div className="flex flex-col gap-1">
        <nav aria-label="Breadcrumb" className="lbl !text-[13px]">
          <Link href="/speedrun" className="text-mut hover:text-fg">Speedrun</Link> ›{" "}
          <Link href={`/speedrun/units/${unit.id}/teams`} className="text-mut hover:text-fg">{unit.name}</Link> ›{" "}
          {crumb ? (
            <>
              <Link href={`/speedrun/teams/${team.id}`} className="text-mut hover:text-fg">{team.name}</Link> › {crumb}
            </>
          ) : (
            "Agent team"
          )}
        </nav>
        <h1 className="m-0 text-[30px] font-bold leading-[1.05] tracking-tight">{team.name}</h1>
      </div>
      <span className="flex pl-3.5">
        {team.members.map((mb) => {
          const r = getRole(mb.roleId);
          const shared = teamsForRole(mb.roleId).length > 1;
          return (
            <span key={mb.roleId} className="-ml-2 rounded-full border-2 border-bg bg-bg">
              <Avatar initials={r.initials} size={30} title={r.name} variant={mb.isLead ? "lead" : shared ? "solid" : "wash"} />
            </span>
          );
        })}
      </span>
      <span className="lbl">
        Lead + {team.members.length - 1} teammates
        {team.humanReviewers ? ` · ${team.humanReviewers} human reviewer` : ""} · {team.instances} instances
      </span>
      <Link
        href="#"
        data-host-hash={team.workflow.status === "registered" ? `view=workflow&workflow=${team.workflow.id}` : "view=library"}
        title={team.workflow.name}
        className="lbl !text-acc-text hover:underline"
      >
        {team.workflow.status === "registered" ? `Workflow ${team.workflow.id} →` : "Not in the Workflow Library →"}
      </Link>
      <div className="flex-1" />
      <TeamTabs teamId={team.id} active={tab} />
    </div>
  );
}
