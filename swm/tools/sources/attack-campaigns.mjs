/* Source module: MITRE ATT&CK campaigns (campaign + uses).
   Plan: logs/2026-10-03_SWM_DOMAIN_GROUNDING_EXEC_PLAN.md (E5), Part A S10, D15.
   Contract: swm/tools/sources/CONTRACT.md — "Node id formats, kinds and placement" row `attack-campaigns.mjs`.

   STUB (P0c). Emits campaigns in `selection.ids` as L3 `case` nodes (`caseType: 'campaign'`),
   `DEMONSTRATES` edges per exact in-bundle `uses` target. Parsing is implemented in P1. */

export function parse(raws, selection) {
  return { nodes: [], links: [], sources: {}, omitted: [] };
}
