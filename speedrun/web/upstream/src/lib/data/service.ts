/**
 * Mock data service. Pages (server components) and the /api route handlers both
 * call these functions, so the UI and the API always return the same shapes.
 * Swap this module for real backends without touching the screens.
 */
import type {
  AgentRole,
  AgentTeam,
  BenchmarkHealth,
  BenchmarkView,
  BuilderView,
  BusinessUnit,
  CreateExperimentInput,
  Experiment,
  ExperimentStatus,
  TeamStructure,
  TraceRun,
} from "../types";
import * as fx from "./fixtures";
import { roleTeamCounts, sumCoverage, totals, type Totals } from "./aggregate";

export interface UnitSummary {
  unit: BusinessUnit;
  totals: Totals;
  teams: AgentTeam[];
}

export interface OrgView {
  name: string;
  p95Seconds: number;
  totals: Totals;
  coverage: ReturnType<typeof sumCoverage>;
  units: UnitSummary[];
  radar: {
    volumes: number[];
    regression: { from: number; to: number; teamId: string; label: string };
    anomalies: number[];
    days: string[];
  };
  benchmarkHealth: (BenchmarkHealth & { teamName: string; unitName: string })[];
}

export function getRole(id: string): AgentRole {
  const r = fx.agentRoles.find((x) => x.id === id);
  if (!r) throw new Error(`unknown role ${id}`);
  return r;
}

export function getRoles(): AgentRole[] {
  return fx.agentRoles;
}

export function getTeam(id: string): AgentTeam | undefined {
  return fx.teams.find((t) => t.id === id);
}

export function listTeams(unitId?: string): AgentTeam[] {
  return unitId ? fx.teams.filter((t) => t.unitId === unitId) : fx.teams;
}

export function getUnit(id: string): UnitSummary | undefined {
  const unit = fx.businessUnits.find((u) => u.id === id);
  if (!unit) return undefined;
  const teams = listTeams(id);
  return { unit, teams, totals: totals(teams) };
}

export function listUnits(): UnitSummary[] {
  return fx.businessUnits.map((u) => getUnit(u.id)!);
}

/** Roles of a business unit with how many of its teams each one is in. */
export function unitRoles(unitId: string): { role: AgentRole; teamIds: string[] }[] {
  const teams = listTeams(unitId);
  const counts = roleTeamCounts(teams);
  return [...counts.keys()].map((roleId) => ({
    role: getRole(roleId),
    teamIds: teams.filter((t) => t.members.some((mb) => mb.roleId === roleId)).map((t) => t.id),
  }));
}

/** Teams across the whole organization that include a role. */
export function teamsForRole(roleId: string): AgentTeam[] {
  return fx.teams.filter((t) => t.members.some((mb) => mb.roleId === roleId));
}

export function getOrg(): OrgView {
  const units = listUnits();
  return {
    name: fx.organization.name,
    p95Seconds: fx.organization.p95Seconds,
    totals: totals(fx.teams),
    coverage: sumCoverage(fx.businessUnits.map((u) => u.coverage)),
    units,
    radar: {
      volumes: fx.organization.radarVolumes,
      regression: fx.organization.radarRegression,
      anomalies: fx.organization.radarAnomalies,
      days: fx.organization.radarDays,
    },
    benchmarkHealth: fx.benchmarkHealth.map((h) => {
      const team = getTeam(h.teamId)!;
      return { ...h, teamName: team.name, unitName: fx.businessUnits.find((u) => u.id === team.unitId)!.name };
    }),
  };
}

export function getTeamStructure(teamId: string): TeamStructure | undefined {
  return fx.teamStructures.find((s) => s.teamId === teamId);
}

export function getTraceRun(teamId: string, runId: string): TraceRun | undefined {
  return fx.traceRuns.find((r) => r.teamId === teamId && r.runId === runId);
}

export function getBenchmarks(teamId: string): BenchmarkView | undefined {
  return fx.benchmarkViews.find((b) => b.suite.teamId === teamId);
}

export function getBuilder(teamId: string): BuilderView | undefined {
  return fx.builderViews.find((b) => b.teamId === teamId);
}

/** Start constructing a recommended case family (mock: flips status). */
export function buildRecommendation(teamId: string, recommendationId: string) {
  const view = getBuilder(teamId);
  const rec = view?.recommendations.find((r) => r.id === recommendationId);
  if (!rec) return undefined;
  if (rec.status === "proposed") rec.status = "building";
  return rec;
}

/** What the suite looks like if every recommendation is accepted. */
export function builderImpact(view: BuilderView, costPerExecution: number, repeats: number, currentCases: number) {
  const tested = view.concepts.filter((c) => c.cases > 0).length;
  const added = view.recommendations.reduce((s, r) => s + r.cases, 0);
  const coveredAfter = new Set([...view.concepts.filter((c) => c.cases > 0).map((c) => c.id), ...view.recommendations.map((r) => r.conceptId)]).size;
  return {
    conceptsTested: tested,
    conceptsTotal: view.concepts.length,
    conceptsAfter: coveredAfter,
    casesBefore: currentCases,
    casesAfter: currentCases + added,
    weeklyCostBefore: Math.round(currentCases * repeats * costPerExecution),
    weeklyCostAfter: Math.round((currentCases + added) * repeats * costPerExecution),
  };
}

/* ---------------- Agent Gym ---------------- */

// In-memory store so POST /api/gym/experiments works during a server session.
// Kept on globalThis so pages and route handlers (separate module graphs) share it.
const g = globalThis as unknown as { __silexExperiments?: Experiment[] };
const store: Experiment[] = (g.__silexExperiments ??= [...fx.experiments]);

export function listExperiments(status?: ExperimentStatus): Experiment[] {
  const all = [...store].sort((a, b) => a.updatedMinutesAgo - b.updatedMinutesAgo || Number(b.id) - Number(a.id));
  return status ? all.filter((e) => e.status === status) : all;
}

export function experimentCounts(): Record<ExperimentStatus | "all", number> {
  const c = { all: store.length, pending: 0, queued: 0, running: 0, "needs-review": 0, done: 0 };
  for (const e of store) c[e.status]++;
  return c;
}

export function getExperiment(id: string): Experiment | undefined {
  return store.find((e) => e.id === id);
}

export function getSandboxCapacity() {
  return fx.sandboxCapacity;
}

export class ValidationError extends Error {}

export function createExperiment(input: CreateExperimentInput): Experiment {
  const team = getTeam(input.teamId);
  if (!team) throw new ValidationError(`unknown team ${input.teamId}`);
  if (!input.title?.trim()) throw new ValidationError("title is required");
  if (!Array.isArray(input.params) || input.params.length === 0) throw new ValidationError("at least one parameter is required");
  if (!input.params.some((p) => p.baseline !== p.variant)) throw new ValidationError("variant must change at least one parameter");

  const run = fx.traceRuns.find((r) => r.teamId === team.id);
  if (!run) throw new ValidationError(`no reconstructed trace for ${team.name}`);

  const nextId = String(Math.max(...store.map((e) => Number(e.id))) + 1).padStart(3, "0");
  const objective =
    input.changeType === run.variant.defaultChange
      ? run.variant.objective
      : input.changeType === "retry-timeout" || input.changeType === "switch-tool"
        ? "Latency"
        : "Cost";
  const exp: Experiment = {
    id: nextId,
    title: input.title.trim(),
    teamId: team.id,
    source: "speedrun",
    objective,
    status: "pending",
    result: { text: "Test set required", tone: "neutral" },
    updatedMinutesAgo: 0,
    config: {
      ...fx.buildGymConfig({ teamId: team.id, params: input.params, variantName: `${input.changeType}-v${nextId}`, scope: input.testScope, objective }),
      target: input.target,
    },
  };
  store.push(exp);
  return exp;
}

/** Test-set size and run cost for an experiment config (baseline + variant). */
export function experimentEstimate(e: Experiment) {
  const cases = e.config!.testSet.filter((t) => t.checked).reduce((s, t) => s + t.count, 0);
  const executions = cases * e.config!.repetitions * 2;
  return { cases, executions, cost: Math.round(executions * e.config!.costPerExecution) };
}
