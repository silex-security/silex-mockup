/* Source module: ToolEmu (ICLR 2024) — all_cases.json / all_toolkits.json.
   Plan: logs/2026-10-03_SWM_DOMAIN_GROUNDING_EXEC_PLAN.md (E5), Part A S15, C16.
   Contract: swm/tools/sources/CONTRACT.md — "sources keys and content" row `toolemu` (sources only).

   STUB (P0c). Emits no nodes; returns `sources` for cases and tool names (potential risky
   outcomes/actions, not occurred failures). Parsing is implemented in P1, after the T0 gate. */

export function parse(raws, selection) {
  return { nodes: [], links: [], sources: {}, omitted: [] };
}
