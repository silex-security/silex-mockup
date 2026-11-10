"use client";

import { useEffect, useRef, useState } from "react";
import type { SegmentKind, TraceLane } from "@/lib/types";
import { IconMail, IconPlay } from "../icons";
import { Avatar, Tag, cx } from "../ui";

export interface LaneView extends TraceLane {
  name: string;
  initials: string;
  isLead: boolean;
  shared: boolean;
}

const SEG: Record<SegmentKind, string> = {
  work: "bg-bar",
  lead: "bg-fg opacity-70",
  critical: "bg-amb",
  timeout: "border-2 border-amb bg-transparent",
  wait: "hatch-amb",
  blocked: "blocked !top-[15px] !h-1.5",
  reusable: "border-[1.5px] border-dashed border-acc2 bg-acc-wash",
};

/** Team trace as a timeline: one row per member, tasks as bars, messages as markers. */
export function Gantt({
  lanes,
  duration,
  initialAt = 18,
  showMarkers = true,
  compact = false,
}: {
  lanes: LaneView[];
  duration: number;
  initialAt?: number;
  showMarkers?: boolean;
  compact?: boolean;
}) {
  const [at, setAt] = useState(initialAt);
  const [playing, setPlaying] = useState(false);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setAt((a) => {
        const next = a + dt * 3; // 3× real time
        if (next >= duration) {
          setPlaying(false);
          return duration;
        }
        return next;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [playing, duration]);

  const pct = (s: number) => `${(s / duration) * 100}%`;
  const labelCol = compact ? 250 : 300;
  const ticks = Array.from({ length: Math.floor(duration / 5) + 1 }, (_, i) => i * 5);

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="relative" style={{ minWidth: compact ? 620 : 780 }}>
          <div className="grid min-h-[38px] items-center border-b border-line" style={{ gridTemplateColumns: `${labelCol}px minmax(0,1fr)` }}>
            <span className="px-3.5 text-[13px] font-semibold">Member · task</span>
            <span className="flex justify-between pr-1 font-mono text-xs text-mut">
              {ticks.map((t) => <span key={t}>{t}s</span>)}
            </span>
          </div>
          {lanes.map((lane) => (
            <div key={lane.roleId} className={cx("border-b border-line last:border-0", lane.highlighted && "bg-wash shadow-[inset_3px_0_0_var(--acc2)]")}>
              <div className="grid min-h-9 items-center" style={{ gridTemplateColumns: `${labelCol}px minmax(0,1fr)` }}>
                <span className="flex items-center gap-2 px-3.5 text-[13px] font-semibold">
                  <Avatar initials={lane.initials} size={22} variant={lane.isLead ? "lead" : lane.shared ? "solid" : "wash"} />
                  {lane.name}
                  {lane.isLead ? <span className="lbl font-normal">lead</span> : null}
                  {lane.shared ? <Tag tone="acc">Shared</Tag> : null}
                </span>
                <span
                  className="relative h-9"
                  style={{ backgroundImage: "linear-gradient(90deg, var(--line) 1px, transparent 1px)", backgroundSize: `${(5 / duration) * 100}% 100%` }}
                >
                  {lane.segments.map((sg, i) => (
                    <span
                      key={i}
                      title={`${sg.label} · ${sg.start}–${sg.end}s`}
                      className={cx("absolute top-[11px] box-border h-3.5 rounded-[5px]", SEG[sg.kind])}
                      style={{ left: pct(sg.start), width: pct(sg.end - sg.start) }}
                    />
                  ))}
                  {showMarkers &&
                    lane.markers.map((mk) => (
                      <span
                        key={mk.candidateId + mk.at}
                        title={`Opportunity ${mk.candidateId}`}
                        className="absolute top-1 -ml-3.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-acc2 bg-card font-mono text-[11px] font-bold text-acc-text"
                        style={{ left: pct(mk.at) }}
                      >
                        {mk.candidateId}
                      </span>
                    ))}
                  {lane.messages.map((ms) => (
                    <span
                      key={ms.at}
                      title={`Message → ${ms.label}`}
                      className="absolute top-2 -ml-2.5 flex h-5 w-5 items-center justify-center rounded-[5px] bg-acc2 text-white"
                      style={{ left: pct(ms.at) }}
                    >
                      <IconMail size={11} />
                    </span>
                  ))}
                </span>
              </div>
              {!compact ? (
                <div className="grid pb-1.5 text-xs text-mut" style={{ gridTemplateColumns: `${labelCol}px minmax(0,1fr)` }}>
                  <span className="pl-11 pr-3.5">{lane.summary}</span>
                </div>
              ) : null}
            </div>
          ))}
          <span aria-hidden className="pointer-events-none absolute bottom-0 top-[38px] w-0.5 bg-fg opacity-70" style={{ left: `calc(${labelCol}px + (100% - ${labelCol}px) * ${at / duration})` }} />
        </div>
      </div>
      <div className="flex items-center gap-3 p-3.5">
        <button
          type="button"
          aria-label={playing ? "Pause" : "Play"}
          onClick={() => {
            if (at >= duration) setAt(0);
            setPlaying((p) => !p);
          }}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-acc text-white"
        >
          {playing ? <span className="flex gap-1"><span className="h-3.5 w-1 bg-white" /><span className="h-3.5 w-1 bg-white" /></span> : <IconPlay size={14} />}
        </button>
        <input
          type="range"
          min={0}
          max={duration}
          step={0.5}
          value={at}
          onChange={(e) => {
            setPlaying(false);
            setAt(Number(e.target.value));
          }}
          aria-label="Playhead position"
          className="flex-1 accent-[var(--acc2)]"
        />
        <span className="font-mono text-[13px] text-mut">{Math.round(at)}s / {duration}s</span>
      </div>
    </div>
  );
}
