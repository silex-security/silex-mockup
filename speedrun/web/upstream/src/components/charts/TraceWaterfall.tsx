"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { replayEvents } from "@/lib/replay";
import { frameAt, layoutTrace, rowState, type WfBar } from "@/lib/trace-waterfall";
import { cx } from "../ui";
import type { LaneView } from "./Gantt";
import { RunLog } from "./RunLog";

const SPEEDS = [1, 2, 0.5] as const;
const SWEEP_MS = 12000;

const look = (b: Pick<WfBar, "tone" | "fill" | "mark">) => ({ "data-tone": b.tone, "data-fill": b.fill, "data-mark": b.mark });

/** Team trace as a waterfall: member rows, a task row under each, handoffs between them. Plays once it scrolls into view. */
export function TraceWaterfall({ lanes, duration, title }: { lanes: LaneView[]; duration: number; title: string }) {
  const w = useMemo(() => layoutTrace(lanes, duration), [lanes, duration]);
  const events = useMemo(() => replayEvents(lanes, { markers: true }), [lanes]);
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(0);
  const root = useRef<HTMLElement>(null);
  const waiting = useRef(true);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      waiting.current = false;
      setAt(duration);
      return;
    }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && waiting.current) {
        waiting.current = false;
        setPlaying(true);
      }
    }, { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, [duration]);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      const dt = now - last;
      last = now;
      let done = false;
      setAt((a) => {
        const next = Math.min(duration, a + (dt / SWEEP_MS) * duration * SPEEDS[speed]);
        done = next >= duration;
        return next;
      });
      if (done) setPlaying(false);
      else raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, duration]);

  const pct = (v: number) => `${(v / w.span) * 100}%`;
  const frame = frameAt(lanes, at);
  const seek = (e: MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPlaying(false);
    setAt(Math.min(duration, Math.max(0, ((e.clientX - r.left) / r.width) * w.span)));
  };
  const toggle = () => {
    if (playing) return setPlaying(false);
    waiting.current = false;
    if (at >= duration) setAt(0);
    setPlaying(true);
  };
  const kpis = [
    ["Elapsed", frame.elapsed, undefined],
    ["Steps done", `${frame.done} of ${frame.steps}`, undefined],
    ["Blocked now", String(frame.blocked), "amber"],
    ["Messages sent", String(frame.messages), undefined],
  ] as const;

  return (
    <section aria-label="Trace replay" ref={root} className="tw card overflow-hidden">
      <div className="tw-top"><b>{title}</b></div>
      <div className="tw-kpis">
        {kpis.map(([k, v, tone]) => (
          <div key={k}><small>{k}</small><span data-replay-time={k === "Elapsed" ? "" : undefined} data-tone={tone} data-on={tone && Number(v) > 0 ? "" : undefined}>{v}</span></div>
        ))}
      </div>
      <div className="tw-scroll">
        <div className="tw-grid">
          <div className="tw-head">Member · task</div>
          <div className="tw-head tw-axis" onClick={seek}>
            {w.ticks.map((x) => <i key={x} style={{ left: pct(x) }}>{x}s</i>)}
          </div>
          <div className="tw-names">
            {w.rows.map((r, i) => (
              <div key={i} className={cx("tw-row", rowState(r, at, playing))} data-depth={r.depth}>
                <span className="tw-name">{r.name}</span>
                {r.sub ? <span className="tw-sub">{r.sub}</span> : null}
              </div>
            ))}
          </div>
          <div className="tw-lanes" onClick={seek}>
            {w.ticks.slice(1).map((x) => <span key={x} className="tw-tick" style={{ left: pct(x) }} />)}
            {w.handoffs.map((h) => (
              <span
                key={`${h.at}-${h.from}`}
                className="sr-handoff"
                title={h.label}
                data-dir={h.to < h.from ? "up" : "down"}
                hidden={at < h.at}
                style={{ left: pct(h.at), top: `calc(var(--tw-row) * ${Math.min(h.from, h.to) + 0.5})`, height: `calc(var(--tw-row) * ${Math.abs(h.to - h.from)})` }}
              />
            ))}
            {w.rows.map((r, i) => (
              <div key={i} className="tw-lane">
                {r.bars.map((b) => {
                  const shown = Math.min(b.e, at) - b.s;
                  return (
                    <span
                      key={b.s}
                      className={cx("tw-bar", playing && b.s < at && at < b.e && "growing")}
                      {...look(b)}
                      hidden={shown <= 0}
                      style={{ left: pct(b.s), width: `max(3px, ${pct(Math.max(0, shown))})` }}
                    />
                  );
                })}
                <span className="tw-label" hidden={at < r.end} style={{ left: pct(r.end) }}>
                  {r.label}
                  {r.badges.map((b) => <em key={b.text} data-tone={b.tone}>{b.text}</em>)}
                </span>
              </div>
            ))}
            <span className="tw-playhead" hidden={at >= duration} style={{ left: pct(at) }} />
          </div>
        </div>
      </div>
      <div className="tw-foot">
        <div className="tw-ctl">
          <button type="button" aria-label="Play or pause" onClick={toggle}>{playing ? "❚❚" : "▶"}</button>
          <button type="button" aria-label="Replay from the start" onClick={() => { waiting.current = false; setAt(0); setPlaying(true); }}>↻</button>
          <button type="button" aria-label="Playback speed" onClick={() => setSpeed((s) => (s + 1) % SPEEDS.length)}>{SPEEDS[speed]}x</button>
        </div>
        <div className="tw-legend">
          <span><i data-fill="soft" />Tool work</span>
          <span><i />Critical path</span>
          <span><i data-fill="hatch" />Waiting or blocked</span>
          <span><i data-tone="red" />Failed attempt</span>
          <span><i className="sr-handoff-key" />Handoff</span>
        </div>
      </div>
      <RunLog events={events.filter((e) => e.at <= at)} lanes={lanes} onSeek={(t) => { setPlaying(false); setAt(t); }} />
    </section>
  );
}
