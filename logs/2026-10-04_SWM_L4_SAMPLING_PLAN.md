# SWM L4: business-stratified 1-in-3 sample of the public benchmark runs — plan

Base: `main` at `f34d2ae` (L4 benchmark runs deployed). Branch `swm-l4-sampling`, worktree
`../silex-mockup-l4sample` (the main checkout is in use on another branch).
Requested by the product owner on 2026-10-04: *"L4 数据太大，导致显示比较 messy，做 3 倍的业务采样；保留所有的典型示例；
原来手写的示例实例 24 个保持不变；default 进入 Public benchmark runs。"* Planned and executed in one pass.

## Why

L4 holds 24 illustrative nodes plus **1144 public benchmark nodes** (946 runs, 135 incidents, 3 agents, 60
tools). With the partition on, the Ontology Graph's L4 view is a hairball, and the runs are about two thirds
of `ontology.js` (3.4 MB). The parsers, predicates and counts in the L4 plan stay exactly as approved; only
what enters the **bundle** is thinned.

## What stays, what is sampled

**Unit of sampling: the run** (a run carries its incident, if any, and its edges). Target: one run in three
per business pack, so the shown mix of Finance, Identity & IT and Customer Service stays as it was.

| Always kept (典型示例) | Why |
|---|---|
| The 24 illustrative L4 nodes and their edges | Untouched: they are not benchmark nodes and are never sampled |
| **Every run that has an incident: 135** (107 evaluator-reported executions, 28 τ² refusals), with the incident | Every security example: all 119 `EXHIBITS` mappings (each mapped hazard keeps every one of its runs) and all 17 unmapped incidents with their reasons, including the regression negatives (SecAlign "Bill payment" transfers, the single $30 000 payment) |
| **Every banking injection-task-4 run: 32** (both models × 16 user tasks) | CQ10 compares the two models on these runs; its answer must not change |
| **At least one "attack not executed" run per AgentDojo cell** (model × suite × injection task) where one exists | The contrast for every attack: what a resisted attempt looks like |
| **At least one passed and one failed τ² run** per model | The normal-behaviour baseline the L4 plan kept the passes for (D21) |
| All 3 agent nodes and all 60 tool nodes | The environment manifest; tools also carry the `IMPLEMENTS` links to L2 actions |

**Filled by sampling:** each pack's quota is `ceil(runs in pack / 3)`; if the always-kept runs exceed it,
the quota rises to that number and nothing else is added. The rest of the quota is drawn from the remaining
runs, stratified by (source, model, suite, outcome) with largest-remainder allocation; inside a stratum,
runs are ordered by the SHA-256 of their id (deterministic, no random seed, reproducible offline).

## Counts stay honest

- Agent nodes gain `benchmark.population`: per suite, the **full** run count and harmful count (e.g.
  "attack reported executed 73 of 144"), and `benchmark.shown`: runs present in this sample. The inspector
  shows the population numbers, then "N of these runs are shown (sample)".
- The bundle gains `benchmarkSample`: the rule, the per-pack population / kept / quota, and the always-kept
  counts. The Layers panel and the copy say "sample of 946 runs; all 135 incidents kept".
- Coverage, KPIs and `DEPLOYED_IN` already ignore benchmark nodes (C19): unchanged.

## UI

- **The "Public benchmark runs" toggle is on by default.** Unchecking it still hides the partition and its edges.
- Nothing else changes: same layer default, same Refund example (which excludes benchmark nodes).

## Contract and checks

- `SEED.BENCHMARK_SAMPLE`: ratio 3, the always-keep rules above. New module `swm/tools/sources/benchmark-sample.mjs`
  applies them to the run parsers' output inside `build-ontology.mjs`. Parsers and `test-sources.mjs` (490 / 456
  runs, predicates) are unchanged.
- `verify-bundle.mjs` checks the sample: every kept incident has its run and vice versa (existing C20); the
  `benchmarkSample` record agrees with the bundle (kept counts per pack, all incidents kept, all task-4 runs kept,
  every agent's shown count); population ≥ shown.
- `probe-swm.mjs` BENCH-T: default **on**, unchecking removes every benchmark node and edge. COLD: the 3 s / 5 s
  gates now apply with the partition on, since that is the default.
- `check-copy.mjs` and the docs: the new L4 numbers.

## Acceptance

`test-sources`, `validate-seed`, build (`--offline`), `verify-bundle`, `competency` (CQ10 unchanged),
negative fixtures, `check-copy`, `probe-swm`, `preview-panels`, `tests/site/run-site-probes.mjs`.

## Out of scope

Changing the selection (models, suites, tasks), the predicates, or the 24 illustrative nodes; splitting the
bundle; changing the Ontology Graph's default layer.

## Outcome (executed 2026-10-04, branch `swm-l4-sampling`, for review)

| | Before (`f34d2ae`) | After |
|---|---|---|
| Benchmark runs in the bundle | 946 | **346** (Finance 126, Identity & IT 68, Customer Service 152) |
| Benchmark incidents | 135 | **135** (all kept) |
| Benchmark agents / tools | 3 / 60 | 3 / 60 |
| L4 nodes (illustrative + benchmark) | 24 + 1144 = 1168 | **24 + 544 = 568** |
| Graph | 2106 nodes · 9299 relations | **1506 nodes · 5244 relations** |
| `ontology.js` | 3.4 MB raw | **2.0 MB raw, about 160 KB gzip** |
| Toggle default | off | **on** |

Runs: **2.7×** fewer (946 → 346). Finance cannot reach one in three because its always-kept set is 126 runs
(87 reported executions, the 23 other banking task-4 runs, 16 resisted attempts), above its 96-run quota; Identity &
IT (202 → 68) and Customer Service (456 → 152) are exactly one in three. Kept by rule: incident 135; banking task 4
23; resisted attempt per cell 22; τ² baselines 0 (already covered); stratified fill 166.

Unchanged and checked: the 24 illustrative nodes; coverage bundle identical to BASE apart from `generated`
(`verify-bundle --base`); CQ10 answer identical (Llama 8 of 16 reported, 8 mapped; SecAlign 1 of 16, 1 mapped);
agent inspectors show full counts from `benchmark.population` (e.g. Llama banking 73 of 144) and "N of M runs shown".

Acceptance (exit 0): `test-sources`, `validate-seed`, offline build (byte-identical apart from `generated`),
`verify-bundle --base`, `competency` CQ1–CQ10, negative fixtures (77 graph, incl. 5 new sample negatives; 28 CQ),
`check-copy` (94 numbers), `probe-swm` (24 checks; COLD-L 422 ms, COLD-G 439 ms with the partition on by default;
BENCH-T default on; BENCH-OFF hides all benchmark nodes and edges), `preview-panels`.
`tests/site/run-site-probes.mjs`: 41/42; **S20 fails identically on `origin/main`** ("Timeout: World Model rendered"
in the sidebar/docking probe), so it is pre-existing and not caused by this change.

Not reviewed by other seats yet; pushed to `origin/swm-l4-sampling` for review. Not merged, not deployed.
