/* Source module: τ²-bench retail domain (Sierra Research) — policy rules and tool names.
   Plan: logs/2026-10-03_SWM_DOMAIN_GROUNDING_EXEC_PLAN.md (E5), Part A S5, F6/F7.
   Contract: swm/tools/sources/CONTRACT.md — "sources keys and content" row `tau2` (sources only).

   STUB (P0c). Emits no nodes; returns `sources` for rule sentences and tool names.
   Parsing is implemented in P1, after the T0 gate. */

export function parse(raws, selection) {
  return { nodes: [], links: [], sources: {}, omitted: [] };
}
