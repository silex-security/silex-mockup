# silex-mockup

Clickable demo of SILEX, enterprise infrastructure for AI agents. SILEX is a shared, self-evolving ontology and runtime knowledge graph, delivered as a product suite across the agent lifecycle on a common foundation. The demo walks that suite, view by view, with illustrative data. It is a single self-contained page, [`index.html`](index.html), live at [demo.opensilex.ai](https://demo.opensilex.ai/).

| Product | Lifecycle stage | Demo views | Deep link |
|---|---|---|---|
| SILEX Foundry | Shared knowledge, the common foundation | Enterprise World Model | `#view=security-model` |
| Agent Studio | Pre-deployment | Blueprint Studio, Workflow Library | `#view=blueprint`, `#view=library` |
| Agent Gym | Verify and validate | Pre-release, Scenario Expansion, System Validation | `#view=short-term`, `#view=scenario-expansion`, `#view=long-term` |
| SILEX Runtime | Production | Runtime Observation, PCP · Policy, Incident Queue | `#view=runtime-observation`, `#view=policies`, `#view=incidents` |
| SILEX Speedrun | Performance (roadmap) | Speedrun | `#view=speedrun` |

The home view, **Platform** (`#view=assurance`), shows the product suite as a map, five outcomes the suite enables, and the evidence base. Each product card carries its status today (Designed, Building or Roadmap).

### SILEX Foundry

- **Enterprise World Model:** the sub-tabs are *Ontology Layers* (default), *Ontology Graph*, *World Model Coverage*, *Domain Suites* and *Coverage Gaps*.
  - The first three are D3 panels over one L1 → L2 → L3 → L4 chain, built from MITRE D3FEND, ATT&CK, ATLAS, UCO and the OWASP GenAI lists; *Domain Suites* and *Coverage Gaps* are static, illustrative markup.
  - The Ontology Graph opens on the animated **Network** view (WebVOWL-style).
  - Domain packs are grounded in public standards and benchmarks; L4 adds a labelled partition of public benchmark runs (AgentDojo, τ²-bench), shown by default through a *Public benchmark runs* toggle. The bundle carries a 1-in-3 business-stratified sample: 346 of 946 runs, with all 135 incidents and every typical example kept; agent inspectors report the full counts.
  - *World Model Coverage* uses the site's indigo palette; hovering an arc or list row explains why coverage is low (weakest dimensions, children that pull it down, recorded gaps, suggested steps labelled illustrative). Plan: [`logs/2026-10-04_WM_COVERAGE_PALETTE_INSIGHTS_PLAN.md`](logs/2026-10-04_WM_COVERAGE_PALETTE_INSIGHTS_PLAN.md).
  - What was built and why: [`SECURITY_WORLD_MODEL.md`](SECURITY_WORLD_MODEL.md). Code and data pipeline: [`swm/`](swm/README.md).

### Agent Studio

- **Blueprint Studio:** the computed Blueprint Studio from [`blueprint_studio/`](blueprint_studio/README.md), embedded in the Blueprint Studio view.
  - It includes the editor, templates, Ask AI, Validate → Optimize → Decide → Register, and the Decision Trace.
  - Its pending decisions, PCP cards and registrations appear on Overview, PCP · Policy and the Workflow Library, stored in this browser.
  - How it is wired: [`js/STUDIO_BRIDGE_CONTRACT.md`](js/STUDIO_BRIDGE_CONTRACT.md), plan [`logs/2026-09-24_STUDIO_CUTOVER_PLAN.md`](logs/2026-09-24_STUDIO_CUTOVER_PLAN.md).

### Agent Gym

- **Pre-release, Scenario Expansion, System Validation:** the three Agent Gym views. They keep their view ids and deep links (`#view=short-term`, `#view=scenario-expansion`, `#view=long-term`).

### SILEX Runtime

- **Runtime Observation (Jev runtime demo):** the first entry under SILEX Runtime in the left nav. It shows each agent action checked before it runs (hard rules → Jev judgment battery → policy), with reference figures, scripted AP and SOC scenarios and the embedded demo.
  - Five sub-tabs: *Scenarios* (default), *Decision plane*, *Learning loop*, *Ontology*, *Judge latency*. Each tab opens with a plain-language intro and how to read it, shows numbers with plain captions, and ends with a takeaway; technical detail (p-values, CIs, sample sizes, hardware, sources) sits behind ⓘ hover text (hover, focus or tap). Deep link: `#view=runtime-observation&tab=ontology`. Plan: [`logs/2026-10-07_RUNTIME_SUBTABS_PLAN.md`](logs/2026-10-07_RUNTIME_SUBTABS_PLAN.md).
  - *Scenarios*: pick one of the 12 scripted scenarios from a dropdown (it runs at once; **Run** repeats it) and watch it go through the pipeline animation. Clicking one of the six pipeline stages pauses the animation there, and clicking it again resumes. *See this run in the decision plane* opens the Decision plane tab.
  - **Ontology** (*What the ontology adds*): the same runtime provenance graph with and without ontology types, on real benchmark runs of held-out agent models. It shows the pre-registered AgentDojo test and the example runs:
    - **Stage-1 (S1)**, confirmed on AgentDojo: 12 195 never-opened runs, precision 0.41 → 0.54, recall 0.84 → 0.87. The page scopes it to AgentDojo's tasks and these models only; recall is an observation, not a guarantee.
    - **Check Report** opens the report.
    - The S2 replication on AgentDyn (not confirmed: precision 0.36 → 0.31, recall 0.85 → 0.99) was removed from the page on 2026-10-07; its plan, freeze record and report stay in `logs/`.
    - Plans and records: [`logs/2026-10-04_ONTOLOGY_STAGE1_PLAN.md`](logs/2026-10-04_ONTOLOGY_STAGE1_PLAN.md), [`logs/2026-10-06_ONTOLOGY_S2_AGENTDYN_PLAN.md`](logs/2026-10-06_ONTOLOGY_S2_AGENTDYN_PLAN.md), [`logs/2026-10-06_ONTOLOGY_S2_REPORT.md`](logs/2026-10-06_ONTOLOGY_S2_REPORT.md).
  - **Judge latency** (*How fast is the judge?*): measured, Kev-0.8B fine-tuned (local, Apple M4 Pro) against gpt-4o-mini (OpenAI API) on the same 708 held-out items: p50 152 vs 670 ms, p95 347 vs 990 ms, 99 % vs 0.3 % within the 400 ms gate budget. Data: [`data/judge-latency.json`](data/judge-latency.json).
  - The demo is vendored byte-for-byte in [`jev-runtime/`](jev-runtime/README.md) from jev-runtime-observability, and it is simulated end to end.
  - **Learning loop:** the "The judge learns from your reviewers" tab shows the measured Kev fine-tune result (held-out AgentDojo, benchmark labels), read from the vendored `jev-runtime/demo/data/learning-evidence.json`. **Try the loop** opens the demo's simulated Learning loop tab. Plan: jev-runtime-observability `logs/2026-09-30_LEARNING_LOOP_SHOWCASE_PLAN.md`.
  - Plain-language guide (Chinese, screenshots of every page): [`docs/jev-runtime-guide/`](docs/jev-runtime-guide/README.md).
  - Deep link: `index.html#view=runtime-observation`; the old `#view=long-term&tab=runtime` redirects there. Plans: [`logs/2026-09-30_JEV_RUNTIME_VALIDATION_PLAN.md`](logs/2026-09-30_JEV_RUNTIME_VALIDATION_PLAN.md) (built as a System Validation tab), then [`logs/2026-09-30_RUNTIME_OBSERVE_VIEW_PLAN.md`](logs/2026-09-30_RUNTIME_OBSERVE_VIEW_PLAN.md) (moved to its own view).
- **Older Jev observability demo:** [`jev-observability/`](jev-observability/README.md) is the first, AP-only standalone page. It stays live, unchanged, and `jev-runtime/` supersedes it.

### SILEX Speedrun

- **Speedrun:** the SILEX Speedrun app (source in `speedrun/web/upstream/`, forked from [wangfe/silex-speedrun](https://github.com/wangfe/silex-speedrun) and edited here; `node tools/build-speedrun.mjs` rebuilds `speedrun/app/`), embedded in the Speedrun view (`#view=speedrun`). The product stays marked Roadmap and every figure is illustrative.
  - Screens: Organization overview (data coverage, KPIs, insight radar, anomalies, benchmark health), Business Unit (role and team relationships), Agent Team Explorer, and per team the structure with the performance optimizer, trace replay, benchmarks and the Benchmark Builder. *Create variant* sends a change to the app's Agent Gym queue, where the experiment can be configured.
  - The app opens in the dark theme of the product design. Its header toggle switches to light and the choice is remembered per browser. Its *Agent Studio* link opens Blueprint Studio.
  - The site URL follows the screen that is open (`#view=speedrun&path=<app route>`), so a reload or a shared link reopens it. For example `#view=speedrun&path=%2Fgym` opens the app's Agent Gym experiment queue.
  - Each agent team links to its Workflow Library entry and back (Performance column, workflow detail button, Governance link in the team header). `tests/site/library-speedrun-link.test.mjs` keeps the two lists in agreement.
  - What a visitor creates (experiments, benchmark builds) lives in the page and resets on reload.
  - The title row links to the one figure that is measured today, the runtime judge's latency.
  - How it is built and updated: [`speedrun/`](speedrun/README.md).

### Site shell

- **Navigation:** the left nav groups the views by product, in lifecycle order: Platform, SILEX Foundry, Agent Studio, Agent Gym, SILEX Runtime, SILEX Speedrun. The top bar shows the same products as a lifecycle rail (Foundry · Studio → Gym → Runtime → Speedrun). The rail highlights the product that owns the open view, and a click opens that product's first view. The nav, the rail and the home product map are all rendered from one source, the sidebar markup, by [`js/suite-nav.js`](js/suite-nav.js). The earlier Assurance / Operations toggle is gone, and `assurance.html` keeps the earlier page unchanged.
- **Sidebar behaviour:** on desktop it starts hidden so the content uses the full window. The sidebar icon (top left) shows it docked; the same icon in its header hides it again, like chatgpt.com, and the choice is remembered per browser. Hovering the far-left edge peeks it over the content and it slides away when the pointer leaves. Phones keep the icon strip. Plan: [`logs/2026-09-30_FLOATING_NAV_PLAN.md`](logs/2026-09-30_FLOATING_NAV_PLAN.md).
- **Figures are illustrative, except in Blueprint Studio.**
  - Blueprint Studio runs a deterministic engine on the declared graph: simulated outcomes under a declared adversary model, with no real agents or tools.
  - Every other panel is illustrative.
  - Public ontology data is real (see [`swm/data/SOURCES.md`](swm/data/SOURCES.md)).

## What changed, and when

Every change to this demo, newest first, with the reasoning behind each one: [`logs/README.md`](logs/README.md).

## Plans, reviews and audits

| Doc | What it is |
|---|---|
| [`2026-09-15_CHANGES.md`](logs/2026-09-15_CHANGES.md) | Running change list + defaults chosen for open questions |
| [`2026-09-15_SITEMAP.md`](logs/2026-09-15_SITEMAP.md) | Site-map and UX path audit (201-element crawl) |
| [`2026-09-15_UX_FIXES.md`](logs/2026-09-15_UX_FIXES.md) | The logic behind each 9/15 UX fix |
| [`2026-09-16_REWRITE_PLAN.md`](logs/2026-09-16_REWRITE_PLAN.md) | Demo rewrite plan from the 9/15 review |
| [`2026-09-17_PRD_ALIGNMENT_PLAN.md`](logs/2026-09-17_PRD_ALIGNMENT_PLAN.md) | Page vs. PRD, P0/P1/P2 work |
| [`2026-09-17_SWM_OBSERVATORY_PLAN.md`](logs/2026-09-17_SWM_OBSERVATORY_PLAN.md) | Plan for the D3 World-Model observatories |
| [`2026-09-17_POSITIONING_ALIGNMENT_PLAN.md`](logs/2026-09-17_POSITIONING_ALIGNMENT_PLAN.md) | Aligning the demo with the Sept-2026 positioning |
| [`2026-09-17_docs-README.md`](logs/2026-09-17_docs-README.md) | The old `docs/` index (for reference) |
| [`2026-09-18_ASSURANCE_RESTRUCTURE_PLAN.md`](logs/2026-09-18_ASSURANCE_RESTRUCTURE_PLAN.md) | Assurance-first restructure plan (v7 investor register) |
| [`2026-09-21_ARTIFACT_UPGRADE_PLAN.md`](logs/2026-09-21_ARTIFACT_UPGRADE_PLAN.md) | Artifact upgrade: route map, measured fix, model change, route evaluation (3-judge review) |
| [`2026-09-21_SWM_VISUAL_UPGRADE_PLAN.md`](logs/2026-09-21_SWM_VISUAL_UPGRADE_PLAN.md) | SWM visual upgrade plan v0.2; design frames and review record in [`swm-visual-2026-09-21/`](logs/swm-visual-2026-09-21/) |
| [`2026-09-21_SWM_IMPLEMENTATION.md`](logs/2026-09-21_SWM_IMPLEMENTATION.md) | SWM visual upgrade implementation and three-seat review rounds (R3 `27f07eb`) |
| [`2026-09-21_SWM_VOWL_NETWORK_PLAN.md`](logs/2026-09-21_SWM_VOWL_NETWORK_PLAN.md) | Network view (WebVOWL-style) plan v0.2; contract, spike and frames in [`swm-vowl-2026-09-21/`](logs/swm-vowl-2026-09-21/) |
| [`2026-09-21_SWM_VOWL_IMPLEMENTATION.md`](logs/2026-09-21_SWM_VOWL_IMPLEMENTATION.md) | Network view implementation, review rounds (R2 `e978d6a`) and deploy record |
| [`2026-09-22_SPARSE_OBSERVABILITY_PLAN.md`](logs/2026-09-22_SPARSE_OBSERVABILITY_PLAN.md) | Sparse Observability plan v0.3: the terminology finding, the I-1042 reconstruction fixture, and three review rounds |
| [`2026-09-22_SPARSE_OBSERVABILITY_IMPLEMENTATION.md`](logs/2026-09-22_SPARSE_OBSERVABILITY_IMPLEMENTATION.md) | Implementation rounds r1–r4, the evidence and the deploy record |
| [`2026-09-27_JEV_OBSERVABILITY_PLAN.md`](logs/2026-09-27_JEV_OBSERVABILITY_PLAN.md) | Jev real-time observability demo (`jev-observability/`): plan v0.2, plan and code review rounds, outcome |
| [`2026-09-30_JEV_RUNTIME_VALIDATION_PLAN.md`](logs/2026-09-30_JEV_RUNTIME_VALIDATION_PLAN.md) | Runtime Validation tab in System Validation, backed by the vendored Jev runtime demo (`jev-runtime/`): plan r3, review rounds, outcome |
| [`2026-09-30_RUNTIME_OBSERVE_VIEW_PLAN.md`](logs/2026-09-30_RUNTIME_OBSERVE_VIEW_PLAN.md) | Runtime Observation moved out of System Validation into its own nav view; plan, reviews, outcome |
| [`2026-09-30_FLOATING_NAV_PLAN.md`](logs/2026-09-30_FLOATING_NAV_PLAN.md) | Floating left nav: hidden by default, click toggle to dock (ChatGPT-style), edge-hover peek; plan r1–r3, reviews, outcome |
| [`2026-10-03_SWM_DOMAIN_GROUNDING_EXEC_PLAN.md`](logs/2026-10-03_SWM_DOMAIN_GROUNDING_EXEC_PLAN.md) | Domain grounding of Finance, Customer Service and Identity & IT in public standards, benchmarks and cases; plan E1–E5, T0 gate, code gate, outcome (scope: [`swm/2026-10-03_SWM_DOMAIN_GROUNDING_PLAN.md`](swm/2026-10-03_SWM_DOMAIN_GROUNDING_PLAN.md)) |
| [`2026-10-03_SWM_L4_BENCHMARK_RUNS_PLAN.md`](logs/2026-10-03_SWM_L4_BENCHMARK_RUNS_PLAN.md) | L4 public benchmark runs (AgentDojo, τ²-bench): selection, trace-predicate mapping, T0 and code gates, outcome |
| [`2026-10-04_SWM_L4_SAMPLING_PLAN.md`](logs/2026-10-04_SWM_L4_SAMPLING_PLAN.md) | L4 bundle: business-stratified 1-in-3 sample of the benchmark runs (all incidents and typical examples kept), toggle on by default; plan and outcome |
| [`2026-10-03_ONTOLOGY_OBSERVABILITY_VALUE_PLAN.md`](logs/2026-10-03_ONTOLOGY_OBSERVABILITY_VALUE_PLAN.md) | Does the ontology help runtime observability? Pre-registered experiments E1, E5, E3: null result |
| [`2026-10-04_ONTOLOGY_NULL_DIAGNOSIS_AND_V2_PLAN.md`](logs/2026-10-04_ONTOLOGY_NULL_DIAGNOSIS_AND_V2_PLAN.md) | Why the ontology showed no effect, and a v2 test on held-out agent models: still no confirmed effect |
| [`2026-10-04_ONTOLOGY_OBSERVATION_SHOWCASE_PLAN.md`](logs/2026-10-04_ONTOLOGY_OBSERVATION_SHOWCASE_PLAN.md) | "What the ontology adds" card in Runtime Observation, and the held-out alert-load test E-AL (not confirmed) |
| [`2026-10-04_ONTOLOGY_PRECISION_RECALL_PLAN.md`](logs/2026-10-04_ONTOLOGY_PRECISION_RECALL_PLAN.md) | Two-stage, ontology-typed runtime monitor E-PR (not confirmed) |
| [`2026-10-04_ONTOLOGY_STAGE1_PLAN.md`](logs/2026-10-04_ONTOLOGY_STAGE1_PLAN.md) | Stage-1 test: ontology typing alone raises precision with recall within 3 points (confirmed on AgentDojo; not replicated on AgentDyn) |
| [`2026-10-06_ONTOLOGY_S2_AGENTDYN_PLAN.md`](logs/2026-10-06_ONTOLOGY_S2_AGENTDYN_PLAN.md) · [`…_S2_FREEZE_RECORD.md`](logs/2026-10-06_ONTOLOGY_S2_FREEZE_RECORD.md) · [`…_S2_REPORT.md`](logs/2026-10-06_ONTOLOGY_S2_REPORT.md) | S2: replication of Stage-1 on AgentDyn (not confirmed) |
| [`2026-10-04_SWM_GRAPH_ZOOM_FIX_PLAN.md`](logs/2026-10-04_SWM_GRAPH_ZOOM_FIX_PLAN.md) | Ontology Graph: Network zoom buttons did nothing; plan and fix |
| [`2026-10-04_WM_COVERAGE_PALETTE_INSIGHTS_PLAN.md`](logs/2026-10-04_WM_COVERAGE_PALETTE_INSIGHTS_PLAN.md) | World Model Coverage: system palette and "why is coverage low" hover insights |
| [`2026-10-07_RUNTIME_SUBTABS_PLAN.md`](logs/2026-10-07_RUNTIME_SUBTABS_PLAN.md) | Runtime Observation: five sub-tabs, plain-language intros, ⓘ hover text, scenario dropdown |

Each document is dated and kept as written; `logs/` also holds the design frames, review records and probe evidence for the bigger changes.
