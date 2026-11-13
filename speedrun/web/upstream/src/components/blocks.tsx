import type { ReactNode } from "react";
import { Card, Tag, cx } from "./ui";
import { fmtInt } from "@/lib/format";
import { TrendMark, type Tone, type Trend } from "./charts/Sparkline";

export function CoverageStrip({
  staleInstances,
  incompleteTraces,
  missingCostInstances,
  missingEvaluationRuns,
}: {
  staleInstances: number;
  incompleteTraces: number;
  missingCostInstances: number;
  missingEvaluationRuns: number;
}) {
  const item = (label: string, value: string) => (
    <div>
      <div className="lbl">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
  return (
    <Card aria-label="Data coverage" className="flex flex-wrap items-center gap-6 px-5 py-3.5">
      <Tag className="!h-[34px] px-3.5 !text-base">Data coverage</Tag>
      <div className="grid flex-[1_1_640px] grid-cols-2 gap-6 md:grid-cols-4">
        {item("Missing / stale data", `${staleInstances} ${staleInstances === 1 ? "instance" : "instances"}`)}
        {item("Incomplete traces", `${fmtInt(incompleteTraces)} traces`)}
        {item("Missing cost", `${missingCostInstances} instances`)}
        {item("Missing success evaluation", `${fmtInt(missingEvaluationRuns)} runs`)}
      </div>
    </Card>
  );
}

const TONE_TEXT: Record<Tone, string | undefined> = {
  amb: "text-amb-text",
  rose: "text-rose-text",
  mint: "text-mint-text",
  acc2: "text-acc-text",
  mut: undefined,
};

export function KpiRow({ items }: { items: { label: string; value: ReactNode; tone?: Tone; trend?: Trend }[] }) {
  return (
    <Card aria-label="Key measures" className="grid grid-cols-2 overflow-hidden sm:grid-cols-4 xl:grid-cols-8">
      {items.map((k, i) => (
        <div key={k.label} className={cx("flex flex-col gap-1.5 px-4 py-3.5", i > 0 && "border-l border-line")}>
          <span className="lbl">{k.label}</span>
          <span className={cx("text-3xl font-bold tracking-tight", k.tone && TONE_TEXT[k.tone])}>{k.value}</span>
          {k.trend ? (
            <span className="flex opacity-80">
              <TrendMark trend={k.trend} tone={k.tone ?? "acc2"} />
            </span>
          ) : null}
        </div>
      ))}
    </Card>
  );
}

export function RolesValue({ roles, instances }: { roles: number; instances: number }) {
  return (
    <>
      {roles} <span className="text-md font-medium text-mut">/ {fmtInt(instances)}</span>
    </>
  );
}
