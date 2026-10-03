/* Source module: τ²-bench banking_knowledge domain (banking policy documents).
   Plan: logs/2026-10-03_SWM_DOMAIN_GROUNDING_EXEC_PLAN.md (E5), Part A S8.
   Contract: swm/tools/sources/CONTRACT.md — "sources keys and content" row `banking-kb` (sources only).

   STUB (P0c). Emits no nodes; returns `sources` for document sentences named in the selection.
   Parsing is implemented in P1, after the T0 gate. */

export function parse(raws, selection) {
  return { nodes: [], links: [], sources: {}, omitted: [] };
}
