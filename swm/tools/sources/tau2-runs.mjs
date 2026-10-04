/* Source module: τ²-bench retail results (public benchmark runs).
   Plan: logs/2026-10-03_SWM_L4_BENCHMARK_RUNS_PLAN.md (R3), Source R2.
   Contract: swm/tools/sources/CONTRACT.md — "L4 benchmark run modules".

   STUB (P0c). Reads the pinned result file and emits benchmark agent/tool/run/incident
   nodes (L4, published). Selection is SEED.BENCHMARK_RUNS.tau2. Implemented in P1. */

export function parse(raws, selection) {
  return { nodes: [], links: [], sources: {}, omitted: [] };
}
