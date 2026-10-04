# Change log — silex-mockup demo site

Newest first, with what changed and why. The plans, review records and audits are the date-prefixed files in this folder; the index is on the [project README](../README.md#plans-reviews-and-audits).

## 2026-10-04 — Runtime Observation: "What the ontology adds" card, and a held-out alert-load test (not confirmed)

- **New card** in Runtime Observation: the same runtime provenance graph with and without ontology types on real AgentDojo runs of held-out agent models — four examples chosen by a fixed rule (caught by both, alert saved, alert lost, missed by both) with a without/with-ontology toggle and the ontology's explanation chain (effect → argument class → where the value came from).
- **Pre-registered E-AL test** (3 630 runs of five further held-out models): ontology types cut alerts 1 200 → 890 and raised precision 0.29 → 0.38, beating random typing, but recall within 5 points was not established, so the claim is shown as **Not confirmed**, with each part. Report: [`2026-10-04_ONTOLOGY_AL_REPORT.md`](2026-10-04_ONTOLOGY_AL_REPORT.md).
- **Judge figure corrected in context:** the learning card now notes that its numbers come from a format-separable split; on real held-out trajectories the fine-tuned judge scores 0.741 (run level).
- **Untouched:** every other view, the vendored `jev-runtime/` files; site probes 42/42, card probes 11/11. Plan and record: [`2026-10-04_ONTOLOGY_OBSERVATION_SHOWCASE_PLAN.md`](2026-10-04_ONTOLOGY_OBSERVATION_SHOWCASE_PLAN.md).

## 2026-10-04 — Enterprise World Model: L4 benchmark runs sampled 1 in 3, shown by default

- **Why:** with 1144 benchmark nodes, the L4 view was too dense to read, and the runs were two thirds of `ontology.js`.
- **What:** the bundle keeps **346 of the 946** selected runs: one in three per business pack (Finance 126, Identity & IT 68, Customer Service 152). Always kept: every run with an incident (all **135** incidents), every banking injection-task-4 run (CQ10), one resisted attempt per AgentDojo model × suite × injection task. The rest is stratified by source, model, suite and outcome and ordered by the SHA-256 of the run id (deterministic). Finance stays above one in three because its always-kept set (126) exceeds the quota.
- **Counts stay honest:** agent nodes carry the full population per suite (e.g. Llama banking 73 of 144) and the inspector adds "N of M runs shown"; the bundle records the rule and per-pack counts in `benchmarkSample`.
- **UI:** the *Public benchmark runs* toggle is **on by default**; unchecking it still hides every benchmark node and edge.
- **Untouched:** the parsers and their counts, the 24 illustrative L4 nodes, the coverage bundle, CQ10's answer.
- **Effect:** graph 2106 → 1506 nodes, 9299 → 5244 relations; L4 1168 → 568 nodes; `ontology.js` 3.4 MB → 2.0 MB. Cold load with the partition on: Layers 422 ms, Graph 439 ms.
- **Checks:** verifier checks the sample record (5 new negative fixtures); all gates pass; site probe S20 fails identically on the previous `main`. Plan and outcome: [`2026-10-04_SWM_L4_SAMPLING_PLAN.md`](2026-10-04_SWM_L4_SAMPLING_PLAN.md).
## 2026-10-04 — Why the ontology showed no effect, and a v2 test on held-out agent models: still no confirmed effect

- **Diagnosis (exploratory, v1 data):** the fine-tuned judge is saturated (half its scores are 0) and moves about as much for the right tool's ontology as for another tool's; 8 % of calls reached an ontology action; 98.6 % of calls in successful-attack runs use tools that also occur in negative runs (clean runs and failed attacks); an instance-level provenance proxy carries strong signal. v1's judge test split was format-separable (0.961 there vs 0.742 on real trajectories). All explanations are recorded as untested.
- **v2 (pre-registered, 3 544 held-out runs of Claude 3.7 Sonnet, Gemini 2.0 Flash, GPT-4o, Command R+):** the ontology used as types over the runtime provenance graph (blind onboarding binding). H10, H11, H12 **not supported**: typed provenance beat random typing (p 0.008), but an improvement over untyped provenance was not established (Δ 0.011, 95 % CI −0.037 to 0.061, p 0.28); provenance improved the judge (0.741 → 0.825); the untyped version reached 0.813 and the typed one's further gain was not established. Descriptively, the typed rule raised 817 alerts vs 1 099 at similar recall (0.813 vs 0.807, each rule's own operating point), a possible alert-load benefit that would need its own pre-registered test. Report: [`2026-10-04_ONTOLOGY_V2_REPORT.md`](2026-10-04_ONTOLOGY_V2_REPORT.md).
- **Untouched:** `swm/data/`, the build, the site. New files only under `swm/experiments/ontology-value/v2/` and `logs/`.
- **Reviews:** plan 2 rounds; target-free seal; freeze 3 rounds; code + report gate; all unanimous (Claude planner, DeepSeek V4 Pro, Codex). Plan and record: [`2026-10-04_ONTOLOGY_NULL_DIAGNOSIS_AND_V2_PLAN.md`](2026-10-04_ONTOLOGY_NULL_DIAGNOSIS_AND_V2_PLAN.md).

## 2026-10-04 — Does the ontology help runtime observability? Pre-registered experiments: null result

- **What:** three pre-registered experiments on public benchmarks, each with non-ontology and mismatched-ontology controls: **E1** ontology context in the runtime judge's input (Kev, AgentDojo test split), **E5** ontology context or ontology-typed alert gating for detecting evaluator-reported attack success in 2 092 published AgentDojo runs of Llama-3.3-70B and Meta-SecAlign-70B, **E3** predicting other same-harm attack paths from one blocked attack (descriptive).
- **Result:** neither confirmatory hypothesis is supported (H1 p = 0.80, H7 p = 1.0, Holm over {H1, H7}). Ontology context did not beat plain tool descriptions or the context of a *different* tool; ontology gating (stratified AUROC 0.575) lost to a plain write-impact gate (0.802). E3 did not test ontology path expansion where the ontology had content: banking and Slack had no targets, and all 5 targets were in workspace, where the ontology predictor emitted no predictions; its pooled zero recall is evidence neither for nor against. The E1b retraining check (H3) is also not supported. Full numbers: [`2026-10-04_ONTOLOGY_OBSERVABILITY_VALUE_REPORT.md`](2026-10-04_ONTOLOGY_OBSERVABILITY_VALUE_REPORT.md).
- **What it tested:** the pre-import ontology (`350362a`, no AgentDojo-derived content) with curated blind onboarding bindings (9 of 74 tools reach an L2 action). An observed limitation, not an established cause of the null (no experiment isolated it): in this ontology only L2 actions carry effects and hazards, and few agent tools bind to one, so most tools carry only a class label.
- **Untouched:** `swm/data/`, the build, the schema, the site, `learning-evidence.json`. New code only under `swm/experiments/ontology-value/`.
- **Reviews:** plan 3 rounds + amendment R4; code seal; freeze gate 3 rounds; code + report gate 3 rounds; all unanimous across planner (Claude), DeepSeek V4 Pro (blind) and Codex. Plan, freeze record and outcome: [`2026-10-03_ONTOLOGY_OBSERVABILITY_VALUE_PLAN.md`](2026-10-03_ONTOLOGY_OBSERVABILITY_VALUE_PLAN.md).

## 2026-10-03 — Enterprise World Model: L4 public benchmark runs

- **What:** L4 gains a labelled partition of **946 public benchmark runs** (≤ 1000, product owner's limit): AgentDojo banking (Finance) and Slack/workspace (Identity & IT) runs of Llama-3.3-70B-Instruct and Meta-SecAlign-70B, and all τ²-bench retail (Customer Service) runs of Claude 3.7 Sonnet. 135 incidents, 3 agents, 60 tools; L4 = 24 illustrative + 1144 benchmark nodes. Bundle 2106 nodes · 9299 links, `ontology.js` 3.4 MB (217 KB gzip).
- **Evaluator success is not a hazard:** an incident `EXHIBITS` an L2 hazard only when a reviewed trace predicate matches a specific, successfully paired call, or the tool refused a mapped attempt (119 mappings across 118 incidents; 17 unmapped with a reason). Found on the way: AgentDojo banking tasks 0/1/3 count any transfer to the attacker as success. New narrowly defined Finance hazard: *Scheduled Payment Redirected On An Injected Instruction*.
- **UI:** a *Public benchmark runs* toggle (on by default since 2026-10-04, when the bundle switched to a 1-in-3 sample: [plan](2026-10-04_SWM_L4_SAMPLING_PLAN.md)) in the Ontology Graph; inspectors for runs, incidents, agents (per-suite counts) and tools; the Layers panel shows L4 as two numbers.
- **Untouched (checked against BASE `75bba66`):** every node id and relation record (exact), `DEPLOYED_IN` and deployment flags, the coverage tree and percentages; benchmark nodes never feed deployment, coverage or KPIs. The `index.html` router now also accepts `(` `)` in node ids, so `nist:AC-2(3)` deep-links. Site probes 41/42, as at BASE.
- **Reviews:** plan 3 rounds, T0 2, code 3; unanimous. Plan and record: [`2026-10-03_SWM_L4_BENCHMARK_RUNS_PLAN.md`](2026-10-03_SWM_L4_BENCHMARK_RUNS_PLAN.md).

## 2026-10-03 — Enterprise World Model: Finance, Customer Service and Identity & IT grounded in public sources

- **Why:** external feedback said the ontology was generic MITRE/OWASP with no domain grounding. The L2 packs existed but every node was Silex-authored.
- **Sources (all pinned, sha256 in `swm/tools/sources/MANIFEST.json`):** FIBO, Microsoft Common Data Model, OCSF 1.9.0 (domain standards); AgentDojo, τ²-bench, Agent Security Bench, ToolEmu (benchmarks); ATLAS case studies, ATT&CK campaigns and mitigations, ATLAS mitigations, NIST SP 800-53 Rev. 5. Licence texts and attributions: `swm/data/NOTICES.md`.
- **Model:**
  - Entities are **aligned to** public classes with `CLOSE_MATCH` (13); entities with no equivalent class (*Customer*, *Refund*, *Role*, …) are listed as unmatched with the reason.
  - 21 hazards and 16 actions cite 63 benchmark sources, each graded **derived** or **related**; 11 new hazards, 15 new actions, 3 OCSF-defined record schemas.
  - 57 ATLAS cases (17 incidents, 40 exercises) and 2 campaigns are L3 `case` nodes; 4 reviewed hazard→case pairs.
  - 68 published mitigations raise countered L3 threats from 45 to 73 of 105.
  - Bundle 766 → 961 nodes, 1389 → 2339 relations; `ontology.js` 865 KB. Bundle cap raised to 10 MB, guarded by a cold-load probe (Layers 528 ms, Graph 426 ms).
- **Untouched (checked against BASE `350362a`):** every existing node id, label, kind, layer, parent and review grade; all 1389 existing relations with their grades; the coverage tree, gaps, percentages and runtime figures (verifier `--base` check); `index.html` structure and routes (site probes 41/42, same as BASE).
- **Inspector:** public sources with derived/related grade, definition version and full quote; case type; OCSF deprecation; alignment or no-match reason; collapsed attributes.
- **Reviews:** plan 5 rounds, T0 2, code 2; unanimous. Plan and run record: [`2026-10-03_SWM_DOMAIN_GROUNDING_EXEC_PLAN.md`](2026-10-03_SWM_DOMAIN_GROUNDING_EXEC_PLAN.md); scope document [`swm/2026-10-03_SWM_DOMAIN_GROUNDING_PLAN.md`](../swm/2026-10-03_SWM_DOMAIN_GROUNDING_PLAN.md).

## 2026-10-02 — Runtime Observation: the six text steps become a live pipeline picture

- **Why:** the *How runtime validation works* card sat ~700 px above the Run buttons, with the learning card between them, so you could not see it while a scenario ran. Its six text steps ("OpenTelemetry-shaped span", "atomic questions"…) were hard to follow.
- **Placement:** the card is gone. An animated pipeline now sits at the top of **Scripted scenarios**, directly above the Run buttons, with `#rtStatus` and `#rtResult` moved alongside it. Card order: scenarios, then the learning card, then the decision plane.
- **The picture** (`js/rt-pipeline.js`, `css/rt-pipeline.css`): a tool-name token passes Agent action → Hard rules → Judge (Jev) → Policy, leaves by Allow / Hold / Block, and lands in Evidence ("preview only; nothing leaves the browser"). Each box has one plain-language caption. Everything shown comes from the envelopes:
  - a rule decision shows the judge as "ran · not deciding" (it does run, off the critical path);
  - F1 shows "timed out" and fallback fail-open / fail-closed;
  - monitor mode shows "would have been …".
- **States:**
  - Idle loops three real default-policy reference envelopes (S1 allow, S2 hold, S3 block), labelled "Example ·", and pauses off screen.
  - Run replays the envelopes the embedded demo returned, so Policy Studio edits show up, with per-action dots and Skip.
  - Under reduced motion it renders in one synchronous pass.
  - A newer Run supersedes the old one; a frame timeout shows an error state.
- **Run no longer scrolls to the frame.** **See this run in the decision plane ↓** does that instead. Try the loop still scrolls.
- **Untouched:** the vendored demo (`jev-runtime-vendored.test.mjs`), System Validation's six steps (S42 checks they still animate), and the learning card's content.
- **Probes:** S15/S18/S19/S21 repointed from `#rtSteps` to the pipeline hooks. New S39–S42 cover R1–R9. R2 fails when the host replays the reference envelopes instead of the frame's. R5 fails when all three supersede guards are removed. Site probes 41/42: S20 also fails on the base commit `200f5f4` (environmental). Unit tests 29/29; SWM probes all pass.
- **Guide:** `docs/jev-runtime-guide/README.md` §8.1–8.3 and screenshots 08/09 updated.
- **Plan and reviews:** [`2026-10-02_RUNTIME_PIPELINE_VISUAL_PLAN.md`](2026-10-02_RUNTIME_PIPELINE_VISUAL_PLAN.md). Chinese summary: [`2026-10-02_RUNTIME_PIPELINE_SUMMARY_ZH.md`](2026-10-02_RUNTIME_PIPELINE_SUMMARY_ZH.md).

## 2026-10-02 — Deep links, incident ontology row and robustness fixes taken from jev-simplified

- **World Model and incident deep links:**
  - Routes: `#view=security-model&tab=…&node=…`, `#view=incident&incident=…`, `#view=workflow&workflow=…`.
  - A cold link waits for the lazy bundle via `swm:loader-ready`.
  - Back/Forward keep the full origin, and Studio routes are kept.
  - An abandoned request is cancelled through a route generation.
  - An unknown node, tab or incident shows a notice and falls back.
  - The Assurance explorer button uses a deep link.
- **Robustness:**
  - The loader shows Retry, which re-requests only failed files.
  - Focusing a node clears the degree and subclass filters.
  - Panels boot only when visible (`SWM.isShown`); `assurance.html` is unaffected.
- **Incident Detail Ontology row,** keyed by the site incident and never by number:
  - I-1042 → the bank-detail hazard, then two separate relations from it: `CHARACTERIZES` ATLAS AML.T0052 and `MITIGATED_BY` Dual Approval. They are chips into the World Model, shown with the agreed caveats.
  - I-1038 → "No modelled hazard yet", shown as a blind spot.
- **Inspector chain text for L4 nodes:** each line is one complete, directed assertion (instance `INSTANCE_OF` component; threat `THREATENS` component; countermeasure `COUNTERS` threat), each with its grade.
- **New probes:** P1–P6 in `probe-swm.mjs` and S22–S38 in `run-site-probes.mjs` (local only). S22 fails on the base code, and P6 (chain direction, added after code review round 1) fails on the first candidate; both pass now.
- **Plan and reviews:** [`2026-10-02_JEV_LEARNINGS_PLAN.md`](2026-10-02_JEV_LEARNINGS_PLAN.md). Chinese summary: [`2026-10-02_JEV_LEARNINGS_SUMMARY_ZH.md`](2026-10-02_JEV_LEARNINGS_SUMMARY_ZH.md).

## 2026-10-02 — Ontology Layers is the default World Model sub-tab

- Entering **Enterprise World Model** now opens **Ontology Layers**, which is moved to the first sub-tab, left of **Ontology Graph**. The page subtitle follows it.
- `assurance.html` is a separate older snapshot and keeps its own tab order.
- New probe **D1** in `probe-swm.mjs` checks the order, the active tab and panel, and that the layers render. It fails on the previous version, as expected.
- All other SWM probes still pass. Site probes are 20/21, the same as before; S20 is environmental.

## 2026-10-02 — Security World Model: ontology rigor and wider coverage

- **Tiers are presentation groups, not taxonomic ranks.** Only `SUBCLASS_OF` asserts subsumption. Domain membership (`PART_OF_DOMAIN`), deployment (`DEPLOYED_IN`) and grouping (`GROUPED_UNDER`) are separate predicates. No domain is a "kind of Workflow", and no component sits under one arbitrary domain.
- **A frozen contract, `swm/tools/schema.mjs`,** gives every predicate its node-kind pairs and review grades. The build refuses a bundle that breaks it or has a display-tree or `SUBCLASS_OF` cycle.
- **New semantics:**
  - 80 Silex core concepts: authority, intent, provenance, action, effect, state, control, evidence;
  - domain actions and hazards, each closing a chain: threat, control, evidence, record schema;
  - prohibited outcomes as effects or states;
  - CRM and Legal as candidate packs, outside the coverage figures.
- **Every node and relation carries a review grade** (`published`, `curated`, `heuristic`, `illustrative`), shown in the inspector. Components with no runtime instance are marked unobserved, and threats without a mapped countermeasure are listed.
- **New checks:** `verify-bundle.mjs` (independent signatures), `competency.mjs` (CQ1–CQ6), negative fixtures, `check-copy.mjs` (every printed count against the bundle) and `probe-swm.mjs` (8 UI probes).
- **Deliberately unchanged:** coverage tree, gaps and KPI values, public node IDs, the Refund example (probe R1 against BASE), and every other view (site probes as at BASE).
- Plan, all review rounds and the outcome: [`2026-10-02_SWM_ONTOLOGY_RIGOR_PLAN.md`](2026-10-02_SWM_ONTOLOGY_RIGOR_PLAN.md).

## 2026-10-01 — Promotion gate verdicts on Runtime Observation

- The "The judge learns from your reviewers" card replaces the Kev-4B sentence with **Would this gate promote it?**: Kev-0.8B fine-tuned KEEP (fixed 17, broke 2), Kev-4B fine-tuned DISCARD (safety check: missed cases 25 → 27). Read from the vendored generated JSON.
- The vendored demo is re-synced to jev `be8fda2`: the Learning loop tab now plays three rounds (NEAR-MISS, KEEP, DISCARD) into a model history. Guide §9 is updated in both repos.
- The plan and reviews are in the jev repo: `logs/2026-10-01_LINEAGE_GATE_PLAN.md`.

## 2026-10-01 — Learning loop on Runtime Observation

- A new card, "The judge learns from your reviewers", sits after the six-step orchestration. It shows the six-stage loop, three measured tiles and the Kev-4B gate lesson. Every value is read from the vendored, generated `learning-evidence.json`, and each tile says these are benchmark labels, not customer reviewers yet.
- **Try the loop** opens the embedded demo on its new Learning loop tab, a simulated toy model with an outcome-first summary and Play the loop.
- The vendored demo is re-synced to jev `9ca7ffe`. Probes: new S21, also in the live subset. The plan and reviews are in the jev repo: `logs/2026-09-30_LEARNING_LOOP_SHOWCASE_PLAN.md`.

## 2026-09-30 — Floating left navigation

- Desktop: the dark sidebar starts hidden; content fills the window.
- A sidebar icon (topbar, top left) docks it; the same icon in the sidebar header hides it (ChatGPT-style). The choice persists per browser (`silex.nav.pinned`).
- Hovering the far-left edge peeks it over the content; it hides when the pointer leaves, on Esc or an outside click.
- Phones (≤ 760 px) are unchanged. Probes: new S20; `nav()` docks through the real icon. Plan and reviews: [`2026-09-30_FLOATING_NAV_PLAN.md`](2026-09-30_FLOATING_NAV_PLAN.md).

## 2026-09-30 — Runtime Observation becomes its own view

[Plan and review record](2026-09-30_RUNTIME_OBSERVE_VIEW_PLAN.md).

- **Runtime Observation** is now its own left-nav view in the Environment group, between Enterprise World Model and System Validation. Its content is the former Runtime tab, unchanged.
- **System Validation** is back to its original single page. Its section is byte-identical to the version before the integration (`fbd598d`).
- **The old deep link** `#view=long-term&tab=runtime` redirects to `#view=runtime-observation`.

## 2026-09-30 — Runtime Validation in System Validation (Jev runtime demo)

[Plan, review record and deploy](2026-09-30_JEV_RUNTIME_VALIDATION_PLAN.md).

- **Two tabs:** System Validation now has *Periodic · environment-wide* (unchanged) and *Runtime · every agent action*.
- **The Runtime tab:**
  - reference metrics and outcome chips computed from the simulated engine;
  - a six-step orchestration that runs per scenario;
  - scripted AP and SOC scenarios with **Run**;
  - the Jev runtime demo, embedded.
- **Vendored demo:** `jev-runtime/` is a byte-identical copy from jev-realtime-observability (`efce258`), with a sync tool and an integrity test.
- **Honesty:** everything is labelled simulated, and the Evidence step is a preview only.
- **Review:** three seats; plan r3 and code r2, unanimous. The probes go to S19; the live read-back passed 7/7.

## 2026-09-27 — Jev real-time observability demo (new standalone page)

[Plan v0.2 and review record](2026-09-27_JEV_OBSERVABILITY_PLAN.md) · [Demo README](../jev-observability/README.md).

- A new directory, `jev-observability/`, holds a self-contained page, *Real-time Agent Risk Signals*. It is built from the report "Jev 驱动的实时 Agent 可观测性" (POC page p.15, blueprint p.11–14).
- An AP / Procurement agent's spans pass hard rules → a simulated Jev battery → a policy in code:
  - **Live:** trace stream, KPIs and the Decision Inspector, with scenarios S1–S6, the F1 timeout and fault injection;
  - **Replay:** re-run a span under other thresholds, or sweep every threshold;
  - **Policy Studio:** versioned thresholds, and per-tool Monitor / Gate and fail-open / fail-closed;
  - **About & evidence:** what is simulated, the report's public numbers with their caveats, and its POC gates as hypotheses.
- Claim discipline:
  - no model is called: the judge is `jev-sim`, which derives its probabilities from State Engine features;
  - latencies are simulated from the report's budget;
  - KPIs are computed from the page's own log, and false-block rate and recall are measured against author labels, not a benchmark;
  - the report's public figures appear only in the evidence panel.
- Evidence: 23 engine tests (`npm test`); the fixture is byte-identical across regenerations; 8/8 headless probes (`npm run probe`). P2, P4 and P5 were each shown to fail against a mutated copy.
- **Left alone:** `index.html`, `assurance.html`, `swm/`, `blueprint_studio/` and `js/`. The review diff touches only `jev-observability/`, this file, the project README and the plan file.

## 2026-09-22 — Sparse Observability: how the I-1042 picture was reconstructed

[Plan v0.3](2026-09-22_SPARSE_OBSERVABILITY_PLAN.md) · [Implementation log](2026-09-22_SPARSE_OBSERVABILITY_IMPLEMENTATION.md).

- **Incident I-1042 → Evidence** gains the card "How this picture was built · sparse observability":
  - each source (trace, IAM, tool manifest, policy, vendor master — not connected) is shown with its state;
  - a tier switch: config only / config + partial trace / config + full trace;
  - every node and relation carries one grade (observed / declared / latent);
  - an **unmodeled** list and the tier's one-line claim.
- The Evidence graph re-tags live from the same single-source fixture.
- An unobserved state is never labelled latent: the blocked outcome stays declared-possible until verified.
- It applies to I-1042 only; other incidents and `swm/` are unchanged.
- The term "Sparse Simulation" never appeared on this site. The investor pages in `silex-explorer` used it for law-based pruning, which is now "Law-pruned simulation". Those pages gained a Sparse Observability section.
- Three-seat review: the plan was approved in round 3; the implementation was approved in round 3 and again, after two non-blocking fixes, in round 4 (`a4289ad`).

## 2026-09-22 — Security World Model: visual upgrade + Network view (deployed)

Deployed to production on 2026-09-22 (`main` fast-forwarded to `cb3e9b8`). Both changes below went live together.

**Network view, WebVOWL-style animation.** [Plan v0.2](2026-09-21_SWM_VOWL_NETWORK_PLAN.md) · [Implementation log](2026-09-21_SWM_VOWL_IMPLEMENTATION.md) · [Contract, spike & frames](swm-vowl-2026-09-21/).

- A new default view in Security Ontology, modelled on the [SEPSES ontology demo](https://sepses.ifs.tuwien.ac.at/onto/index-en.html):
  - the layout computes behind a real progress bar, then reveals and settles visibly, and stops at rest;
  - notation: circles for nodes, floating relation labels, dashed subclass links;
  - interaction: drag to pin, hover and click highlighting, Pause / Reset, a zoom slider, and a pulsing halo on search results;
  - filters and data: a minimum-degree filter, a subclass toggle, a Source colour mode (467 public / 131 Silex-authored nodes), and live statistics.
- It renders only the existing bundle (598 nodes / 800 relations). It is a clean D3 v7 reimplementation; VOWL / WebVOWL (MIT) is credited in the About text.
- Graph, Hierarchy and Relations views and the Refund example are unchanged.
- Three-seat review (Claude, DeepSeek, Codex):
  - plan: approved unanimously in round 2;
  - implementation: round 1 rejected (a deferred search-locate bug); **round 2 `e978d6a` approved unanimously**.
  - Probes: 34/34 Network checks and 16/16 regression modes pass.

**Visual upgrade.** [Implementation log](2026-09-21_SWM_IMPLEMENTATION.md) · [Plan v0.2](2026-09-21_SWM_VISUAL_UPGRADE_PLAN.md) · [Design frames](swm-visual-2026-09-21/index.html) · [Plan review record](swm-visual-2026-09-21/REVIEW.md).

- A midnight-indigo chart stage with white inspectors.
- Security Ontology is first and the default, followed by Ontology Layers, World Model Coverage, Domain Suites and Coverage Gaps.
- Security Ontology: a bounded L1 overview (240 of 370 nodes in Graph view), search across all 598 nodes, and an illustrative Refund example (9 of 24 runtime nodes, 8 stored relations).
- The data, vendor files, loader and tools are unchanged; other views are pixel-identical.
- Review: the plan passed two rounds. Implementation review went: R1 rejected (2 Layers blockers), R2 approved with a nit, **R3 `27f07eb` approved unanimously**.

## 2026-09-21 — Artifact upgrade: route map, measured fix, model change, route evaluation

[Plan and review record](2026-09-21_ARTIFACT_UPGRADE_PLAN.md). The plan was approved by DeepSeek, Codex and Claude in two rounds; the implementation was approved in four review rounds.

- **Incident → Alternative paths:** an interactive route map of every route to the unsafe outcome.
  - Line pattern = evidence grade; colour + text = Open / Blocked. The control (e.g. PAY-042) interrupts Path A.
  - Routes are keyboard-selectable, and there is a Replay. The animation stops when hidden and honours reduced motion.
  - For I-1042, each route opens an **illustrative provenance example** (premises with sources, generating class + constraint) and a separate illustrative simulation check that never upgrades the grade.
  - The text rows moved into a "Route list" disclosure.
- **Incident → Candidates:** a "most secure ≠ best" chart of residual reachability × business friction, with a draggable **business veto**.
  - The recommendation is computed from illustrative candidate records.
  - That recommendation is the single source for the badges, PCP text, validated state, Decision tab and Approve button.
  - "No acceptable candidate" disables approval.
- **Pre-release:** a *Model change* card. The output checks are identical for both models, while the graph diff shows the updated model exercising I-1042 Path C (deep link). It is captioned illustrative; Path C stays latent.
- **Assurance:**
  - a "Follow one blocked attack →" entry;
  - §03 gains *How candidate routes are evaluated* (bounded modelled set → excluded by named laws → 187 simulated executions → 4 routes, 3 open);
  - a new §05 *Where this is today*, with the Plan v1 job statuses verbatim.
- **Consistency:** one candidate string, "Bind approval to vendor + intent + mutation".

## 2026-09-19 — Demo refine (per the Sep18 investor-narrative meeting TODO)

Commits `eb2fff6`, `c7f2afe`.

- **Fonts unified.** The site declared `Inter` but never loaded it, so each machine fell back to a different system font. It now loads **Inter + IBM Plex Mono** from Google Fonts, with a single `--mono` token.
- **Assurance tab merged into the main demo** behind the top-bar **register toggle** (Assurance ⇄ Operations).
- **Left nav → Agent Lifecycle rail:** Blueprint Studio · Pre-release · PCP · Policy · Incident Queue.
- **Coverage Gaps** now shows **all 8** real gaps (2 critical / 4 serious / 2 warning), with deep links.
- **Ontology Layers** plays a one-time L1 → L4 build animation on first open.
- **Removed** the top-right "9/15 changes" button.

## 2026-09-18 — Assurance restructure (proposed), World Model tab polish

Commits `da333a2`, `a1b2351`, `9aeffd3`, `7476a38`, `3e169f6`, `585f8c5`.

- **Assurance-first dual-register restructure** (v7 investor register). It was reverted on `main` the same day and kept as a proposal at `/assurance.html`, then merged into the main demo on 9/19.
- Security World Model sub-tabs reordered, and the **TBD** labels dropped. (Superseded on 9/21, when Security Ontology became first.)
- `swm/README` gained a Chinese plain-language data-provenance section.

## 2026-09-17 — Positioning alignment (P0/P1) + SWM observatories rebuilt

Commits `5a37cc3`, `38e7450`, `de66709`, `1511568`, `bccc95a`, `09d619c`, `4c53cb2`.

- **Positioning P0/P1:**
  - evidence grades (declared / latent / observed) on every path;
  - the simulation → shadow → canary → production promotion ladder;
  - six-objective candidate scorecards;
  - "Policy Change Proposal" naming;
  - never-inline and scoped-rollback notes.
- **Security World Model** rebuilt as three D3 observatories (Coverage, Ontology, Layers) over one real L1 → L4 chain.

## 2026-09-16 — Demo rewrite from the 9/15 review

Nav regrouped into Workspace / Security / Environment. Short/Long-Term Validation was renamed to Workflow / System Validation and merged. See [`logs/2026-09-16_REWRITE_PLAN.md`](2026-09-16_REWRITE_PLAN.md).

## 2026-09-15 — 9/15 web demo review + UX pass

World Model Coverage moved to the Security World Model page and navigation was restructured. Nine UX fixes followed a 201-element crawl. See [`logs/2026-09-15_CHANGES.md`](2026-09-15_CHANGES.md), [`logs/2026-09-15_SITEMAP.md`](2026-09-15_SITEMAP.md) and [`logs/2026-09-15_UX_FIXES.md`](2026-09-15_UX_FIXES.md).

---

Figures on the site are illustrative; public ontology data is real (see [`../swm/data/SOURCES.md`](../swm/data/SOURCES.md)).
