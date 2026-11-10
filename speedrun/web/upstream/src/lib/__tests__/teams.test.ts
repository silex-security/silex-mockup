import { describe, expect, it } from "vitest";
import * as fx from "../data/fixtures";
import {
  getBenchmarks,
  getBuilder,
  getTeamStructure,
  getTraceRun,
} from "../data/service";

describe.each(fx.teams.map((t) => [t.name, t] as const))("%s detail", (_name, team) => {
  const memberIds = new Set(team.members.map((m) => m.roleId));
  const s = getTeamStructure(team.id)!;
  const run = getTraceRun(team.id, s?.runId ?? "")!;
  const b = getBenchmarks(team.id)!;
  const builder = getBuilder(team.id)!;
  const health = fx.benchmarkHealth.find((h) => h.teamId === team.id)!;

  it("has structure, trace, benchmarks and builder", () => {
    expect(s).toBeDefined();
    expect(run).toBeDefined();
    expect(b).toBeDefined();
    expect(builder).toBeDefined();
  });

  it("structure only references team members and its own tasks", () => {
    const taskIds = new Set(s.tasks.map((t) => t.id));
    for (const t of s.tasks) {
      expect(memberIds.has(t.ownerRoleId)).toBe(true);
      if (t.dependsOn) expect(taskIds.has(t.dependsOn)).toBe(true);
    }
    for (const e of s.mailbox) {
      expect(memberIds.has(e.fromRoleId)).toBe(true);
      expect(memberIds.has(e.toRoleId)).toBe(true);
    }
    for (const c of s.candidates) for (const r of c.roleIds) expect(memberIds.has(r)).toBe(true);
    expect(s.candidates.filter((c) => c.status === "recommended")).toHaveLength(1);
    if (team.humanReviewers) expect(s.humanReview).toBeTruthy();
  });

  it("trace lanes fit the run and reference real members, tasks and candidates", () => {
    const taskIds = new Set(s.tasks.map((t) => t.id));
    const candIds = new Set(s.candidates.map((c) => c.id));
    expect(new Set(run.lanes.map((l) => l.roleId))).toEqual(memberIds);
    for (const id of run.criticalPath) expect(taskIds.has(id)).toBe(true);
    expect(taskIds.has(run.focus.taskId)).toBe(true);
    expect(memberIds.has(run.focus.roleId)).toBe(true);
    for (const l of run.lanes) {
      let last = 0;
      for (const seg of l.segments) {
        expect(seg.start).toBeGreaterThanOrEqual(last);
        expect(seg.end).toBeGreaterThan(seg.start);
        expect(seg.end).toBeLessThanOrEqual(run.durationSeconds);
        last = seg.end;
      }
      for (const m of l.markers) expect(candIds.has(m.candidateId)).toBe(true);
      for (const m of l.messages) expect(memberIds.has(m.to)).toBe(true);
    }
    expect(s.atSeconds).toBeLessThanOrEqual(run.durationSeconds);
  });

  it("trace run costs about the team's average cost per run", () => {
    expect(Math.abs(run.cost - team.totalCost / team.runs)).toBeLessThan(0.01);
    expect(run.durationSeconds).toBeLessThanOrEqual(team.p95Seconds);
  });

  it("variant presets suggest a change for the default change type", () => {
    const preset = run.variant.presets[run.variant.defaultChange];
    expect(preset.params.some((p) => p.suggested && p.suggested !== p.baseline)).toBe(true);
    const names = Object.values(run.variant.presets).flatMap((p) => p.params.map((x) => x.name));
    expect(new Set(names).size).toBe(names.length);
  });

  it("benchmark agrees with benchmark health and production", () => {
    expect(b.passK.map((v) => +(v * 100).toFixed(1))).toEqual(health.passKTrend);
    expect(b.scorecard.quality.passK).toBe(health.passK);
    expect(`Core ${b.suite.version}`).toBe(health.suiteVersion);
    expect(b.suite.rollingRefreshedDaysAgo).toBe(health.rollingRefreshedDaysAgo);
    expect(b.fit.length).toBe(health.fitTotal);
    expect(b.fit.filter((f) => f.fit).length).toBe(health.fitHits);
    expect(b.p95Production).toEqual(team.p95Trend);
    expect(b.scorecard.efficiency.p95).toBe(b.p95Benchmark.at(-1));
    for (const m of b.markers) expect(b.weeks).toContain(m.week);
  });

  it("case types add up to the suite and average to its pass^k", () => {
    const n = b.caseTypes.reduce((x, c) => x + c.cases, 0);
    expect(n).toBe(b.suite.anchorCases + b.suite.rollingCases);
    const weighted = b.caseTypes.reduce((x, c) => x + c.cases * c.passK, 0) / n;
    expect(Math.abs(weighted - b.scorecard.quality.passK)).toBeLessThan(0.005);
  });

  it("builder recommendations point at real concepts", () => {
    const concepts = new Set(builder.concepts.map((c) => c.id));
    expect(concepts.size).toBe(builder.concepts.length);
    for (const r of builder.recommendations) expect(concepts.has(r.conceptId)).toBe(true);
    expect(builder.recommendations.map((r) => r.id)).toContain(builder.construction.recommendationId);
    expect(builder.suiteName).toBe(health.suiteVersion);
  });
});
