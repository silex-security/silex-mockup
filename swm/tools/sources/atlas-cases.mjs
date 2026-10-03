/* Source module: MITRE ATLAS case studies (ATLAS.yaml).
   Plan: logs/2026-10-03_SWM_DOMAIN_GROUNDING_EXEC_PLAN.md (E5), Part A S2, T2.
   Contract: swm/tools/sources/CONTRACT.md — "Node id formats, kinds and placement" row `atlas-cases.mjs`.

   STUB (P0c). Emits all 57 case studies as L3 `case` nodes with `caseType`, `DEMONSTRATES`
   edges to in-bundle techniques. Parsing is implemented in P1, after the T0 gate. */

export function parse(raws, selection) {
  return { nodes: [], links: [], sources: {}, omitted: [] };
}
