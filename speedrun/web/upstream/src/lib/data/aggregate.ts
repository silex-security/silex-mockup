/**
 * Derived figures. Anything shown above team level is computed here from the
 * per-team fixtures, so sums, weighted rates and role counts can't drift apart.
 */
import type { AgentTeam, DataCoverage } from "../types";

export interface Totals {
  teams: number;
  agentRoles: number;
  instances: number;
  runs: number;
  successfulRuns: number;
  successRate: number;
  totalCost: number;
  costPerSuccess: number;
  anomalies: number;
}

export const successfulRuns = (t: AgentTeam) => t.runs * t.successRate;
export const costPerSuccess = (t: AgentTeam) => t.totalCost / successfulRuns(t);

/** Distinct agent roles across a set of teams (a shared role counts once). */
export function distinctRoles(teams: AgentTeam[]): string[] {
  return [...new Set(teams.flatMap((t) => t.members.map((mb) => mb.roleId)))];
}

/** How many of the given teams each role belongs to. */
export function roleTeamCounts(teams: AgentTeam[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of teams) for (const mb of t.members) counts.set(mb.roleId, (counts.get(mb.roleId) ?? 0) + 1);
  return counts;
}

export function totals(teams: AgentTeam[]): Totals {
  const runs = teams.reduce((s, t) => s + t.runs, 0);
  const succ = teams.reduce((s, t) => s + successfulRuns(t), 0);
  const cost = teams.reduce((s, t) => s + t.totalCost, 0);
  return {
    teams: teams.length,
    agentRoles: distinctRoles(teams).length,
    instances: teams.reduce((s, t) => s + t.instances, 0),
    runs,
    successfulRuns: succ,
    successRate: runs ? succ / runs : 0,
    totalCost: round2(cost),
    costPerSuccess: succ ? cost / succ : 0,
    anomalies: teams.filter((t) => t.anomaly).length,
  };
}

export function sumCoverage(items: DataCoverage[]): Pick<DataCoverage, "staleInstances" | "incompleteTraces" | "missingCostInstances" | "missingEvaluationRuns"> {
  return {
    staleInstances: items.reduce((s, c) => s + c.staleInstances, 0),
    incompleteTraces: items.reduce((s, c) => s + c.incompleteTraces, 0),
    missingCostInstances: items.reduce((s, c) => s + c.missingCostInstances, 0),
    missingEvaluationRuns: items.reduce((s, c) => s + c.missingEvaluationRuns, 0),
  };
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
