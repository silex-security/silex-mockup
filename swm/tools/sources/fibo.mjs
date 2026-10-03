/* Source module: FIBO (EDM Council Financial Industry Business Ontology).
   Plan: logs/2026-10-03_SWM_DOMAIN_GROUNDING_EXEC_PLAN.md (E5), Part A S3.
   Contract: swm/tools/sources/CONTRACT.md — "Node id formats, kinds and placement" row `fibo.mjs`.

   STUB (P0c). Emits classes in `selection.classes` and their in-file superclasses as
   L2 `class` nodes. Parsing is implemented in P1, after the T0 gate. */

export function parse(raws, selection) {
  return { nodes: [], links: [], sources: {}, omitted: [] };
}
