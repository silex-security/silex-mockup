"use client";

import { useEffect, useRef } from "react";
import type { ReplayEvent, ReplayKind } from "@/lib/replay";
import { Avatar, cx } from "../ui";
import type { LaneView } from "./Gantt";

const VERB: Record<ReplayKind, string> = {
  start: "Started",
  done: "Finished",
  timeout: "",
  wait: "Waiting",
  blocked: "",
  unblocked: "Unblocked",
  message: "Sent",
  opportunity: "Spotted",
};

const TONE: Partial<Record<ReplayKind, string>> = {
  timeout: "text-amb-text",
  blocked: "text-amb-text",
  wait: "text-amb-text",
  opportunity: "text-acc-text",
};

const clock = (s: number) => `+${s.toFixed(1).padStart(4, "0")}s`;

/** Events the playhead has passed, newest at the bottom. Clicking one seeks there. */
export function RunLog({ events, lanes, onSeek }: { events: ReplayEvent[]; lanes: LaneView[]; onSeek: (at: number) => void }) {
  const ref = useRef<HTMLOListElement>(null);
  const who = (id: string) => lanes.find((l) => l.roleId === id);

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events.length]);

  return (
    <ol ref={ref} data-replay-log aria-label="Run log" className="m-0 max-h-56 list-none overflow-y-auto border-t border-line p-0">
      {events.map((e, i) => {
        const lane = who(e.roleId);
        const to = e.toRoleId ? who(e.toRoleId)?.name : undefined;
        return (
          <li key={i} data-replay-event={e.kind}>
            <button type="button" onClick={() => onSeek(e.at)} className="flex w-full items-center gap-2.5 px-3.5 py-1.5 text-left text-[13px] hover:bg-wash">
              <span className="w-14 flex-none font-mono text-xs text-mut">{clock(e.at)}</span>
              <Avatar initials={lane?.initials ?? "?"} size={20} variant={lane?.isLead ? "lead" : "wash"} title={lane?.name} />
              <span className={cx("min-w-0 flex-1 truncate", TONE[e.kind])}>
                <span className="font-semibold">{VERB[e.kind] || e.text}</span>
                {VERB[e.kind] && e.kind !== "unblocked" ? ` ${e.text}` : null}
                {to ? <span className="text-mut"> to {to}</span> : null}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
