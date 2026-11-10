import { beforeEach, describe, expect, it } from "vitest";
import { distinctRoles, totals } from "../data/aggregate";
import * as fx from "../data/fixtures";
import {
  ValidationError,
  createExperiment,
  experimentCounts,
  experimentEstimate,
  getExperiment,
  getOrg,
  getUnit,
  listUnits,
} from "../data/service";

const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(0.01);

describe("aggregates add up", () => {
  it("organization totals equal the sum of its business units", () => {
    const org = getOrg();
    const units = listUnits();
    expect(org.totals.teams).toBe(units.reduce((s, u) => s + u.totals.teams, 0));
    expect(org.totals.runs).toBe(units.reduce((s, u) => s + u.totals.runs, 0));
    expect(org.totals.instances).toBe(units.reduce((s, u) => s + u.totals.instances, 0));
    close(org.totals.totalCost, units.reduce((s, u) => s + u.totals.totalCost, 0));
    expect(org.totals.anomalies).toBe(units.reduce((s, u) => s + u.totals.anomalies, 0));
  });

  it("unit totals equal the sum of their teams", () => {
    for (const u of listUnits()) {
      expect(u.totals.runs).toBe(u.teams.reduce((s, t) => s + t.runs, 0));
      close(u.totals.totalCost, u.teams.reduce((s, t) => s + t.totalCost, 0));
      close(u.totals.costPerSuccess, u.totals.totalCost / u.totals.successfulRuns);
    }
  });

  it("counts distinct roles, not team memberships", () => {
    expect(distinctRoles(fx.teams)).toHaveLength(21);
    expect(getUnit("customer-service")!.totals.agentRoles).toBe(8);
    expect(getUnit("finance")!.totals.agentRoles).toBe(13);
    expect(totals(fx.teams).agentRoles).toBe(fx.agentRoles.length);
  });

  it("every team has exactly one lead and only known roles", () => {
    const ids = new Set(fx.agentRoles.map((r) => r.id));
    for (const t of fx.teams) {
      expect(t.members.filter((m) => m.isLead)).toHaveLength(1);
      for (const m of t.members) expect(ids.has(m.roleId)).toBe(true);
    }
  });

  it("benchmark health covers every team", () => {
    expect(new Set(getOrg().benchmarkHealth.map((h) => h.teamId))).toEqual(new Set(fx.teams.map((t) => t.id)));
  });
});

describe("Agent Gym", () => {
  beforeEach(() => {
    const g = globalThis as unknown as { __silexExperiments?: unknown[] };
    g.__silexExperiments!.splice(0, Infinity, ...fx.experiments);
  });

  it("status counts sum to the total", () => {
    const c = experimentCounts();
    expect(c.pending + c.queued + c.running + c["needs-review"] + c.done).toBe(c.all);
    expect(c.all).toBe(18);
  });

  it("estimates executions as cases × repeats × 2 versions", () => {
    const e = experimentEstimate(getExperiment("028")!);
    expect(e.cases).toBe(120);
    expect(e.executions).toBe(720);
    expect(e.cost).toBe(108);
  });

  it("creates a pending experiment with the next id", () => {
    const e = createExperiment({
      teamId: "refund",
      title: "Shorter timeout",
      target: "Order Specialist / T2 Fetch order",
      changeType: "retry-timeout",
      testScope: "similar-runs",
      params: [{ name: "First-attempt timeout", baseline: "8s", variant: "4s" }],
    });
    expect(e.id).toBe("029");
    expect(e.status).toBe("pending");
    expect(getExperiment("029")).toBe(e);
  });

  it("rejects invalid input", () => {
    const base = { teamId: "refund", title: "x", target: "t", changeType: "retry-timeout" as const, testScope: "this-run" as const };
    expect(() => createExperiment({ ...base, teamId: "nope", params: [{ name: "a", baseline: "1", variant: "2" }] })).toThrow(ValidationError);
    expect(() => createExperiment({ ...base, title: " ", params: [{ name: "a", baseline: "1", variant: "2" }] })).toThrow(ValidationError);
    expect(() => createExperiment({ ...base, params: [{ name: "a", baseline: "1", variant: "1" }] })).toThrow(ValidationError);
  });
});
