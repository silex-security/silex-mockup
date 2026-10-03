/* Source module: Microsoft Common Data Model (CDM).
   Plan: logs/2026-10-03_SWM_DOMAIN_GROUNDING_EXEC_PLAN.md (E5), Part A S6/S9.
   Contract: swm/tools/sources/CONTRACT.md — "Node id formats, kinds and placement" row `cdm.mjs`.

   STUB (P0c). Emits entities in `selection.docs` as L2 `class` nodes with `attrs`.
   Parsing is implemented in P1, after the T0 gate. */

export function parse(raws, selection) {
  return { nodes: [], links: [], sources: {}, omitted: [] };
}
