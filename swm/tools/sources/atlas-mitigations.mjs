/* Source module: MITRE ATLAS mitigations (course-of-action + mitigates).
   Plan: logs/2026-10-03_SWM_DOMAIN_GROUNDING_EXEC_PLAN.md (E5), Part A S1, T1.
   Contract: swm/tools/sources/CONTRACT.md — "Node id formats, kinds and placement" row `atlas-mitigations.mjs`.

   STUB (P0c). Emits ATLAS `course-of-action` objects (≥ 1 in-bundle `mitigates`) as L1
   `countermeasure` nodes with `COUNTERS` (published) edges. Parsing is implemented in P1. */

export function parse(raws, selection) {
  return { nodes: [], links: [], sources: {}, omitted: [] };
}
