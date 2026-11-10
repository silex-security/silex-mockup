import type { TraceLane, TraceSegment } from "./types";

export type Tone = "blue" | "violet" | "amber" | "green" | "red" | "grey";

export interface WaterfallLane extends Pick<TraceLane, "roleId" | "segments" | "messages"> {
  name: string;
}

export interface WfBar {
  s: number;
  e: number;
  tone: Tone;
  fill?: "soft" | "hatch";
  mark?: "fail";
}

export interface WfBadge {
  tone: Tone;
  text: string;
}

export interface WfRow {
  depth: 0 | 1;
  name: string;
  sub: string;
  start: number;
  end: number;
  bars: WfBar[];
  label: string;
  badges: WfBadge[];
}

export interface WfHandoff {
  at: number;
  from: number;
  to: number;
  label: string;
}

export interface Waterfall {
  duration: number;
  span: number;
  ticks: number[];
  rows: WfRow[];
  handoffs: WfHandoff[];
}

export interface Frame {
  elapsed: string;
  done: number;
  steps: number;
  blocked: number;
  messages: number;
}

const MEMBER_TONES: Tone[] = ["violet", "blue", "amber", "green", "grey"];
const TICK_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
const LABEL_ROOM = 1.3;

const isWaiting = (sg: TraceSegment) => sg.kind === "wait" || sg.kind === "blocked" || sg.kind === "idle";
const secs = (n: number) => `${Math.round(n * 10) / 10}s`;

function splitLabel(label: string): [string, string] {
  const i = label.indexOf(" — ");
  return i < 0 ? [label, ""] : [label.slice(0, i), label.slice(i + 3)];
}

function barOf(sg: TraceSegment, tone: Tone): Omit<WfBar, "s" | "e"> {
  switch (sg.kind) {
    case "timeout":
      return { tone: "red", mark: "fail" };
    case "wait":
    case "blocked":
      return { tone, fill: "hatch" };
    case "idle":
      return { tone: "grey", fill: "hatch" };
    case "critical":
      return { tone };
    default:
      return { tone, fill: "soft" };
  }
}

function badgesOf(sg: TraceSegment, slowest: boolean): WfBadge[] {
  const out: WfBadge[] = [];
  if (sg.kind === "timeout") out.push({ tone: "red", text: "Timed out" });
  if (sg.kind === "critical") out.push({ tone: "amber", text: "Critical path" });
  if (sg.kind === "reusable") out.push({ tone: "violet", text: "Reusable context" });
  if (slowest) out.push({ tone: "violet", text: "Slowest" });
  return out;
}

function tickStep(duration: number): number {
  return TICK_STEPS.find((s) => duration / s <= 8) ?? TICK_STEPS[TICK_STEPS.length - 1];
}

/** Member rows with one task row per segment under each, and a handoff per message. Uses only the segments and messages given. */
export function layoutTrace(lanes: WaterfallLane[], duration: number): Waterfall {
  const working = lanes.flatMap((l) => l.segments.filter((sg) => !isWaiting(sg)));
  const slowest = working.length > 1 ? working.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a)) : null;

  const rows: WfRow[] = [];
  const memberRow = new Map<string, number>();
  const taskRows = new Map<string, number[]>();

  lanes.forEach((lane, li) => {
    const tone = MEMBER_TONES[li % MEMBER_TONES.length];
    const active = lane.segments.filter((sg) => !isWaiting(sg));
    memberRow.set(lane.roleId, rows.length);
    rows.push({
      depth: 0,
      name: lane.name,
      sub: "",
      start: lane.segments[0]?.start ?? 0,
      end: Math.max(0, ...lane.segments.map((sg) => sg.end)),
      bars: active.map((sg) => ({ s: sg.start, e: sg.end, tone, fill: "soft" })),
      label: `${secs(active.reduce((n, sg) => n + sg.end - sg.start, 0))} working`,
      badges: [],
    });
    taskRows.set(
      lane.roleId,
      lane.segments.map((sg) => {
        const [name, sub] = splitLabel(sg.label);
        rows.push({
          depth: 1,
          name,
          sub,
          start: sg.start,
          end: sg.end,
          bars: [{ s: sg.start, e: sg.end, ...barOf(sg, tone) }],
          label: secs(sg.end - sg.start),
          badges: badgesOf(sg, sg === slowest),
        });
        return rows.length - 1;
      }),
    );
  });

  const handoffs: WfHandoff[] = [];
  for (const lane of lanes) {
    for (const ms of lane.messages) {
      const target = lanes.find((l) => l.roleId === ms.to);
      if (!target) continue;
      const sent = lane.segments.findIndex((sg) => sg.end === ms.at);
      const sentIn = sent >= 0 ? sent : lane.segments.findIndex((sg) => sg.start <= ms.at && ms.at < sg.end);
      const inside = target.segments.findIndex((sg) => sg.start <= ms.at && ms.at < sg.end);
      const got = inside >= 0 ? inside : target.segments.findIndex((sg) => sg.start >= ms.at);
      handoffs.push({
        at: ms.at,
        from: sentIn >= 0 ? taskRows.get(lane.roleId)![sentIn] : memberRow.get(lane.roleId)!,
        to: got >= 0 ? taskRows.get(target.roleId)![got] : memberRow.get(target.roleId)!,
        label: ms.label,
      });
    }
  }
  handoffs.sort((a, b) => a.at - b.at);

  const step = tickStep(duration);
  const ticks = Array.from({ length: Math.floor(duration / step) + 1 }, (_, i) => i * step);
  return { duration, span: duration * LABEL_ROOM, ticks, rows, handoffs };
}

export function rowState(row: Pick<WfRow, "start" | "end">, at: number, playing: boolean): "pending" | "running" | "" {
  if (row.start >= at) return "pending";
  return playing && at < row.end ? "running" : "";
}

export function frameAt(lanes: WaterfallLane[], at: number): Frame {
  const steps = lanes.flatMap((l) => l.segments.filter((sg) => !isWaiting(sg)));
  return {
    elapsed: `${Math.round(at)}s`,
    done: steps.filter((sg) => sg.end <= at).length,
    steps: steps.length,
    blocked: lanes.filter((l) => l.segments.some((sg) => sg.kind === "blocked" && sg.start <= at && at < sg.end)).length,
    messages: lanes.reduce((n, l) => n + l.messages.filter((ms) => ms.at <= at).length, 0),
  };
}
