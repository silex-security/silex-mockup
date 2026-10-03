/* Source module: OCSF schema (Open Cybersecurity Schema Framework).
   Plan: logs/2026-10-03_SWM_DOMAIN_GROUNDING_EXEC_PLAN.md (E5), Part A S12.
   Contract: swm/tools/sources/CONTRACT.md — "Node id formats, kinds and placement" row `ocsf.mjs`.

   STUB (P0c). Emits IAM event classes and selected objects as L1 `class` nodes with `attrs`.
   Parsing is implemented in P1, after the T0 gate. */

export function parse(raws, selection) {
  return { nodes: [], links: [], sources: {}, omitted: [] };
}
