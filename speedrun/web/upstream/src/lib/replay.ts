import type { TraceLane } from "./types";

export type ReplayKind = "start" | "done" | "timeout" | "wait" | "blocked" | "unblocked" | "message" | "opportunity";

export interface ReplayEvent {
  at: number;
  roleId: string;
  kind: ReplayKind;
  text: string;
  toRoleId?: string;
}

export type LaneState = "pending" | "working" | "waiting" | "blocked" | "done";

export interface LaneStatus {
  status: LaneState;
  label: string;
}

type ReplayLane = Pick<TraceLane, "roleId" | "segments" | "markers" | "messages">;

export function replayEvents(lanes: ReplayLane[], { markers }: { markers: boolean }): ReplayEvent[] {
  const runEnd = Math.max(0, ...lanes.flatMap((l) => l.segments.map((s) => s.end)));
  const events: ReplayEvent[] = [];
  for (const { roleId, segments, markers: mks, messages } of lanes) {
    for (const sg of segments) {
      switch (sg.kind) {
        case "timeout":
          events.push({ at: sg.start, roleId, kind: "start", text: sg.label }, { at: sg.end, roleId, kind: "timeout", text: sg.label });
          break;
        case "wait":
          events.push({ at: sg.start, roleId, kind: "wait", text: sg.label });
          break;
        case "blocked":
          events.push({ at: sg.start, roleId, kind: "blocked", text: sg.label });
          if (sg.end < runEnd) events.push({ at: sg.end, roleId, kind: "unblocked", text: sg.label });
          break;
        default:
          events.push({ at: sg.start, roleId, kind: "start", text: sg.label }, { at: sg.end, roleId, kind: "done", text: sg.label });
      }
    }
    for (const ms of messages) events.push({ at: ms.at, roleId, kind: "message", text: ms.label, toRoleId: ms.to });
    if (markers) for (const mk of mks) events.push({ at: mk.at, roleId, kind: "opportunity", text: `Opportunity ${mk.candidateId}` });
  }
  return events.sort((a, b) => a.at - b.at);
}

const STATE_OF = { timeout: "working", wait: "waiting", blocked: "blocked" } as const;

export function laneStatus(lane: Pick<TraceLane, "segments">, at: number): LaneStatus {
  const { segments } = lane;
  if (segments.length === 0 || at < segments[0].start) return { status: "pending", label: "Not started" };
  const sg = segments.find((s) => at >= s.start && at < s.end);
  if (sg) return { status: STATE_OF[sg.kind as keyof typeof STATE_OF] ?? "working", label: sg.label };
  if (at >= segments[segments.length - 1].end) return { status: "done", label: "Finished" };
  return { status: "waiting", label: "Idle" };
}
