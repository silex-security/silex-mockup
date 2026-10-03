/* Source module: NIST SP 800-53 Rev. 5 (OSCAL catalog).
   Plan: logs/2026-10-03_SWM_DOMAIN_GROUNDING_EXEC_PLAN.md (E5), Part A S11.
   Contract: swm/tools/sources/CONTRACT.md — "Node id formats, kinds and placement" row `nist-800-53.mjs`.

   STUB (P0c). Emits controls in `selection.controls` as L1 `control` nodes.
   Parsing is implemented in P1, after the T0 gate. */

export function parse(raws, selection) {
  return { nodes: [], links: [], sources: {}, omitted: [] };
}
