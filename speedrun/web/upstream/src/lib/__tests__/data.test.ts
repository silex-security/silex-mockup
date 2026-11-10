import { describe, expect, it } from "vitest";
import { distinctRoles, totals } from "../data/aggregate";
import * as fx from "../data/fixtures";
import {
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
