/* Source module: AgentDojo (ETH Zürich) — banking, slack and workspace suites.
   Plan: logs/2026-10-03_SWM_DOMAIN_GROUNDING_EXEC_PLAN.md (E5), Part A S4/S13, F1.
   Contract: swm/tools/sources/CONTRACT.md — "sources keys and content" row `agentdojo` (sources only).

   STUB (P0c). Emits no nodes; returns `sources` for injection-task goals and tool names.
   Parsing is implemented in P1, after the T0 gate. */

export function parse(raws, selection) {
  return { nodes: [], links: [], sources: {}, omitted: [] };
}
