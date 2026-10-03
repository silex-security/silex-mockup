/* Source module: Agent Security Bench (ASB) — all_attack_tools.jsonl.
   Plan: logs/2026-10-03_SWM_DOMAIN_GROUNDING_EXEC_PLAN.md (E5), Part A S7/S14, F5.
   Contract: swm/tools/sources/CONTRACT.md — "sources keys and content" row `asb` (sources only).

   STUB (P0c). Emits no nodes; returns `sources` for `Aggressive === "True"` rows (harm from
   `Attack goal`). Parsing is implemented in P1, after the T0 gate. */

export function parse(raws, selection) {
  return { nodes: [], links: [], sources: {}, omitted: [] };
}
