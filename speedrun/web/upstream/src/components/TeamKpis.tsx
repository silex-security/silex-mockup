import type { AgentTeam } from "@/lib/types";
import { costPerSuccess } from "@/lib/data/aggregate";
import { fmtInt, fmtPct, fmtSigned, fmtUsd } from "@/lib/format";
import { cx } from "./ui";

/** Six outcome tiles for a team. "Good" direction differs per metric. */
export function TeamKpis({ team }: { team: AgentTeam }) {
  const d = team.deltas;
  const tile = (label: string, value: string, delta: string, good: boolean | null, warn = false) => (
    <div className={cx("card flex flex-col gap-1 px-4 py-3.5", warn && "!border-amb")}>
      <span className="lbl">{label}</span>
      <span className="text-2xl font-bold tracking-tight">{value}</span>
      <span className={cx("text-xs", good === null ? "text-mut" : good ? "text-mint-text" : "text-amb-text")}>{delta}</span>
    </div>
  );
  return (
    <section aria-label="Outcome measures" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {tile("Completed runs", fmtInt(team.runs), `${fmtSigned(d.runs, "%")} (7d)`, null)}
      {tile("Total cost", fmtUsd(team.totalCost), `${fmtSigned(d.cost, "%")} (7d)`, null)}
      {tile("Cost / success", fmtUsd(costPerSuccess(team)), `${fmtSigned(d.costPerSuccess, "%")} (7d)`, d.costPerSuccess <= 0)}
      {tile("Success rate", fmtPct(team.successRate), `${fmtSigned(d.successPp, "pp")} (7d)`, d.successPp >= 0)}
      {tile("P95 latency", `${team.p95Seconds}s`, `${fmtSigned(d.p95Seconds, "s", 0)} vs prior week`, d.p95Seconds <= 0, d.p95Seconds >= 5)}
      {tile("Instances reporting", `${team.instancesReporting} / ${team.instances}`, team.instancesReporting < team.instances ? `${team.instances - team.instancesReporting} stale` : "all reporting", null)}
    </section>
  );
}
