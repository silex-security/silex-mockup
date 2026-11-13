import type { AgentTeam } from "@/lib/types";
import { costPerSuccess } from "@/lib/data/aggregate";
import { fmtInt, fmtPct, fmtSigned, fmtUsd } from "@/lib/format";
import { cx } from "./ui";
import { TrendMark, type Tone, type Trend } from "./charts/Sparkline";

/** Six outcome tiles for a team. "Good" direction differs per metric. The trend mark follows the delta's sign. */
export function TeamKpis({ team }: { team: AgentTeam }) {
  const d = team.deltas;
  const tile = (label: string, value: string, delta: string, good: boolean | null, change: number, warn = false) => {
    const trend: Trend = change > 0 ? "up" : change < 0 ? "down" : "flat";
    const tone: Tone = good === null ? "acc2" : good ? "mint" : "amb";
    return (
      <div className={cx("card relative flex flex-col gap-1 px-4 py-3.5", warn && "!border-amb")}>
        <span className="lbl">{label}</span>
        <span className="text-3xl font-bold tracking-tight">{value}</span>
        <span className={cx("text-xs", good === null ? "text-mut" : good ? "text-mint-text" : "text-amb-text")}>{delta}</span>
        <span className="pointer-events-none absolute bottom-3 right-3 opacity-80">
          <TrendMark trend={trend} tone={tone} />
        </span>
      </div>
    );
  };
  const stale = team.instancesReporting < team.instances;
  return (
    <section aria-label="Outcome measures" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {tile("Completed runs", fmtInt(team.runs), `${fmtSigned(d.runs, "%")} (7d)`, null, d.runs)}
      {tile("Total cost", fmtUsd(team.totalCost), `${fmtSigned(d.cost, "%")} (7d)`, null, d.cost)}
      {tile("Cost / success", fmtUsd(costPerSuccess(team)), `${fmtSigned(d.costPerSuccess, "%")} (7d)`, d.costPerSuccess <= 0, d.costPerSuccess)}
      {tile("Success rate", fmtPct(team.successRate), `${fmtSigned(d.successPp, "pp")} (7d)`, d.successPp >= 0, d.successPp)}
      {tile("P95 latency", `${team.p95Seconds}s`, `${fmtSigned(d.p95Seconds, "s", 0)} vs prior week`, d.p95Seconds <= 0, d.p95Seconds, d.p95Seconds >= 5)}
      {tile("Instances reporting", `${team.instancesReporting} / ${team.instances}`, stale ? `${team.instances - team.instancesReporting} stale` : "all reporting", stale ? false : null, 0)}
    </section>
  );
}
