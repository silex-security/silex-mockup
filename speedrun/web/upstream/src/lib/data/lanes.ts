import type { LaneView } from "@/components/charts/Gantt";
import type { AgentTeam, TraceRun } from "../types";
import { getRole, teamsForRole } from "./service";

export function laneViews(team: AgentTeam, run: TraceRun): LaneView[] {
  return run.lanes.map((l) => {
    const r = getRole(l.roleId);
    return {
      ...l,
      name: r.name,
      initials: r.initials,
      isLead: team.members.some((mb) => mb.roleId === l.roleId && mb.isLead),
      shared: teamsForRole(l.roleId).length > 1,
    };
  });
}
