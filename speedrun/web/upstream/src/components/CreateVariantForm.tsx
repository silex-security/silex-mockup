"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ChangeType, VariantContext } from "@/lib/types";
import { IconArrowRight } from "./icons";
import { Tag, btnClass, cx } from "./ui";

const CHANGES: { id: ChangeType; title: string; tag: string }[] = [
  { id: "retry-timeout", title: "Retry & timeout", tag: "Latency" },
  { id: "switch-tool", title: "Switch tool", tag: "Cost / Latency" },
  { id: "switch-model", title: "Switch model", tag: "Cost / Latency" },
  { id: "prompt-context", title: "Prompt & context", tag: "Tokens / Cost" },
];

export function CreateVariantForm({
  teamId,
  teamName,
  roleName,
  target,
  sharedTeams,
  runId,
  baseline,
  variant,
}: {
  teamId: string;
  teamName: string;
  roleName: string;
  target: string;
  sharedTeams: number;
  runId: string;
  baseline: string;
  variant: VariantContext;
}) {
  const router = useRouter();
  const [change, setChange] = useState<ChangeType>(variant.defaultChange);
  const def = { ...CHANGES.find((c) => c.id === change)!, ...variant.presets[change] };
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.values(variant.presets).flatMap((p) => p.params.map((x) => [x.name, x.suggested ?? x.baseline]))),
  );

  const params = def.params.map((p) => ({ name: p.name, baseline: p.baseline, variant: values[p.name] ?? p.baseline }));
  const changed = params.filter((p) => p.variant.trim() !== p.baseline).length;

  function submit() {
    router.push(`/gym/handoff/${teamId}-${change}`);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-3.5"
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl font-bold">Create variant</span>
        <Tag tone="amb" className="!h-6">Draft</Tag>
        <div className="flex-1" />
        <Link href={`/speedrun/teams/${teamId}/trace?run=${runId}`} aria-label="Close" className="flex h-9 w-9 items-center justify-center text-2xl text-mut">×</Link>
      </div>
      <div className="text-lg text-fg2">{roleName} / {target}</div>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-line2 px-3 py-1.5">Baseline {baseline}</span>
        <span className="rounded-full border border-line2 px-3 py-1.5">▷ Run #{runId}</span>
        <span className="rounded-full border border-acc2 px-3 py-1.5 text-acc-text">{teamName}</span>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-md font-semibold">Choose a change</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CHANGES.map((c) => (
            <label key={c.id} className={cx("flex cursor-pointer items-start gap-3 rounded-xl px-3.5 py-3", change === c.id ? "border-2 border-acc2 bg-acc-wash" : "border border-line2 bg-card")}>
              <input type="radio" name="change" checked={change === c.id} onChange={() => setChange(c.id)} className="mt-0.5 h-[18px] w-[18px] accent-[var(--acc)]" />
              <span className="flex-1">
                <span className="flex justify-between gap-1.5 text-md font-semibold">{c.title}<Tag>{c.tag}</Tag></span>
                <span className="lbl">{variant.presets[c.id].desc}</span>
              </span>
            </label>
          ))}
        </div>
        {sharedTeams > 1 ? (
          <div className="flex gap-2 rounded-lg bg-amb-wash px-3 py-2.5 text-base leading-snug text-amb-text">
            <span aria-hidden>ⓘ</span>
            <span>{roleName} is shared by {sharedTeams} teams. Model and prompt changes apply to the agent, so they reach the other teams too.</span>
          </div>
        ) : null}
      </fieldset>

      <div className="overflow-hidden rounded-xl border border-line2">
        <div className="grid grid-cols-[1.3fr_.8fr_1fr] gap-3 bg-inset px-3.5 py-2.5 text-base font-semibold text-mut">
          <span>Parameter</span><span>Current</span><span>Variant</span>
        </div>
        {def.params.map((p) => {
          const v = values[p.name] ?? p.baseline;
          const diff = v.trim() !== p.baseline;
          return (
            <div key={p.name} className="grid grid-cols-[1.3fr_.8fr_1fr] items-center gap-3 border-t border-line px-3.5 py-2 text-md">
              <label htmlFor={`p-${p.name}`}>{p.name}</label>
              <span className="font-mono">{p.baseline}</span>
              <input
                id={`p-${p.name}`}
                value={v}
                onChange={(e) => setValues((s) => ({ ...s, [p.name]: e.target.value }))}
                className={cx("h-[38px] w-full rounded-lg border px-3 font-mono text-md", diff ? "border-acc2 bg-acc-wash font-bold text-acc-text" : "border-line2 bg-card text-fg")}
              />
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-[1fr_1.4fr] gap-2.5">
        <Link href={`/speedrun/teams/${teamId}/trace?run=${runId}`} className={cx(btnClass(), "!h-11")}>Cancel</Link>
        <button type="submit" disabled={changed === 0} className={cx(btnClass(true), "!h-11 disabled:opacity-50")}>
          Send to Agent Gym <IconArrowRight />
        </button>
      </div>
      <span className="lbl text-center">{changed} parameter{changed === 1 ? "" : "s"} changed · opens a pending experiment in Agent Gym</span>
    </form>
  );
}
