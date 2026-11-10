"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ExperimentConfig } from "@/lib/types";
import { IconCheckCircle, IconLayers, IconWarn } from "./icons";
import { Tag, btnClass, cx } from "./ui";

/** Test set + run settings with a live execution and cost estimate. */
export function ExperimentConfigurator({ config, sourceHref }: { config: ExperimentConfig; sourceHref: string }) {
  const [sets, setSets] = useState(config.testSet);
  const [reps, setReps] = useState(config.repetitions);
  const [conc, setConc] = useState(config.concurrency);
  const [cap, setCap] = useState(config.budgetCap);
  const [started, setStarted] = useState(false);

  const est = useMemo(() => {
    const cases = sets.filter((s) => s.checked).reduce((n, s) => n + s.count, 0);
    const executions = cases * reps * 2;
    return { cases, executions, cost: executions * config.costPerExecution };
  }, [sets, reps, config.costPerExecution]);
  const overBudget = est.cost > cap;
  const ready = est.cases > 0 && !overBudget;

  return (
    <>
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-3.5">
          <section className="card overflow-hidden" aria-label="Variant changes">
            <div className="flex flex-col gap-2.5 px-4 py-4">
              <div>
                <div className="text-xl font-bold">Variant changes</div>
                <div className="text-sm text-mut">{config.target}</div>
              </div>
              <div className="overflow-hidden rounded-xl border border-line2">
                <div className="grid grid-cols-[1.2fr_1fr_1fr] bg-inset px-4 py-2.5 text-[11px] font-semibold tracking-[0.1em] text-mut">
                  <span>PARAMETER</span><span>BASELINE</span><span>VARIANT</span>
                </div>
                {config.params.map((p) => {
                  const diff = p.baseline !== p.variant;
                  return (
                    <div key={p.name} className="grid grid-cols-[1.2fr_1fr_1fr] items-center border-t border-line text-[15px]">
                      <span className="px-4 py-2.5">{p.name}</span>
                      <span className="px-4 py-2.5 font-mono">{p.baseline}</span>
                      <span className={cx("px-4 py-2.5 font-mono", diff && "bg-acc-wash font-bold text-acc-text")}>{p.variant}</span>
                    </div>
                  );
                })}
              </div>
              <div className="lbl !text-[13px]">{config.note}</div>
            </div>
          </section>

          <section className="card flex flex-col gap-3 px-4 py-4" aria-label="Test set">
            <div className="flex flex-wrap items-start gap-3">
              <div>
                <div className="text-xl font-bold">Test set</div>
                <div className="text-sm text-mut">Same cases for baseline and variant.</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {sets.map((s, i) => (
                <label key={s.name} className={cx("inline-flex h-10 cursor-pointer items-center gap-2 rounded-[10px] border px-3 text-sm", s.highlight && s.checked ? "border-acc2 bg-acc-wash" : "border-line2 bg-card")}>
                  <input
                    type="checkbox"
                    checked={s.checked}
                    onChange={() => setSets((xs) => xs.map((x, j) => (j === i ? { ...x, checked: !x.checked } : x)))}
                    className="h-[18px] w-[18px] accent-[var(--acc)]"
                  />
                  {s.name}
                  <span className="rounded-md bg-inset px-1.5 font-mono text-xs font-semibold text-fg2">{s.count}</span>
                </label>
              ))}
            </div>
            <span className="text-sm text-mut">{est.cases} cases selected</span>
            <div className="overflow-hidden rounded-xl border border-line2">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-inset text-left text-[11px] font-semibold tracking-[0.1em] text-mut">
                    <th className="px-3.5 py-2.5">CASE</th><th>TYPE</th><th>SOURCE</th>
                  </tr>
                </thead>
                <tbody>
                  {config.sampleCases.map((c) => (
                    <tr key={c.id} className="h-[42px] border-t border-line">
                      <td className="px-3.5"><span className="font-mono">{c.id}</span> {c.title}</td>
                      <td><Tag tone={c.type === "Timeout" ? "mint" : c.type === "Boundary" ? "amb" : c.type === "Similar run" ? "blue" : c.type.includes("Team") ? "acc" : "mut"}>{c.type}</Tag></td>
                      <td>{c.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <span className="lbl !text-[13px]">Showing {config.sampleCases.length} of {est.cases} cases</span>
          </section>
        </div>

        <aside className="card flex min-w-0 max-w-[560px] flex-[1_1_460px] flex-col gap-3.5 px-5 py-4" aria-label="Experiment settings">
          <div className="text-[22px] font-bold">Experiment settings</div>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Optimization objective
            <select defaultValue={config.objective} className="h-[42px] rounded-[10px] border border-line2 bg-card px-3 text-sm font-medium text-fg">
              <option>Latency</option><option>Cost</option><option>Success</option>
            </select>
          </label>
          <div className="flex flex-col gap-1.5 text-sm font-semibold">
            Evaluation criteria
            <div className="rounded-[10px] border border-line2 bg-inset px-3 py-2.5 text-sm font-normal">{config.criteria}</div>
          </div>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-sm font-semibold">Acceptance checks</legend>
            {config.acceptanceChecks.map((c) => (
              <label key={c} className="flex items-center gap-2.5 text-sm"><input type="checkbox" defaultChecked className="h-[18px] w-[18px] accent-[var(--acc)]" />{c}</label>
            ))}
          </fieldset>
          <label className="grid grid-cols-[1fr_160px] items-center gap-3 text-sm font-semibold">
            Minimum improvement
            <input defaultValue={config.improvementThreshold} className="h-[42px] rounded-[10px] border border-line2 bg-card px-3 text-sm text-fg" />
          </label>
          <div className="h-px bg-line" />
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Execution environment
            <select defaultValue={config.environment} className="h-[42px] rounded-[10px] border border-line2 bg-card px-3 text-sm font-medium text-fg"><option>{config.environment}</option></select>
            <span className="lbl font-normal">External writes go to the sandbox environment.</span>
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            <NumField label="Repetitions" value={reps} onChange={setReps} min={1} max={10} />
            <NumField label="Concurrency" value={conc} onChange={setConc} min={1} max={20} />
            <NumField label="Budget cap ($)" value={cap} onChange={setCap} min={1} max={10000} />
          </div>
          <div className={cx("flex flex-wrap items-center gap-3.5 rounded-xl border p-3.5", overBudget ? "border-rose bg-rose-wash" : "border-line bg-wash")}>
            <IconLayers size={20} className="text-acc-text" />
            <div className="flex-1">
              <div className="font-semibold">{est.cases} cases × {reps} repeats × 2 versions</div>
              <div className="lbl">{est.executions.toLocaleString()} executions · replayed from the changed task onward, ≈ ${config.costPerExecution.toFixed(2)} each</div>
            </div>
            <div className="border-l border-line2 pl-3.5">
              <div className="lbl">Estimated cost</div>
              <div className={cx("text-xl font-bold", overBudget ? "text-rose-text" : "text-acc-text")}>~${Math.round(est.cost)}</div>
            </div>
          </div>
          {overBudget ? <p role="alert" className="m-0 text-sm text-rose-text">Estimate exceeds the budget cap — raise the cap or select fewer cases.</p> : null}
        </aside>
      </div>

      <div className="sticky bottom-0 -mx-4 mt-1 flex flex-wrap items-center gap-3.5 border-t border-line bg-hdr px-4 py-3.5 backdrop-blur sm:-mx-8 sm:px-8">
        {ready ? (
          <span className="flex items-center gap-2.5 text-base font-semibold"><IconCheckCircle size={22} className="text-mint" />{started ? "Queued — waiting for the sandbox slot" : "Ready to run"}</span>
        ) : (
          <span className="flex items-center gap-2.5 text-base font-semibold text-amb-text"><IconWarn size={20} />{est.cases === 0 ? "Select at least one case set" : "Over budget"}</span>
        )}
        <span className="h-5 w-px bg-line2" />
        <span className="text-sm text-mut">Results will be graded <strong className="text-fg2">simulated</strong> · see source in <Link href={sourceHref} className="text-acc-text">Speedrun ↗</Link></span>
        <div className="flex-1" />
        <Link href="/gym" className={btnClass()}>Back to queue</Link>
        <button type="button" disabled={!ready || started} onClick={() => setStarted(true)} className={cx(btnClass(true), "disabled:opacity-50")}>
          {started ? "Queued" : "Run experiment →"}
        </button>
      </div>
    </>
  );
}

function NumField({ label, value, onChange, min, max }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-mut">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
        className="h-[42px] rounded-[10px] border border-line2 bg-card px-3 text-sm text-fg"
      />
    </label>
  );
}
