# silex-mockup

Clickable demo of the SILEX agentic security platform, aligned with the V1 PRD (Web UX / Investor Demo) on 2026-09-15.

- **Page:** [`index.html`](index.html), a single self-contained HTML file. Live at [silex-mockup.vercel.app](https://silex-mockup.vercel.app/).
- **Registers:** a top-bar toggle switches between two registers:
  - **Assurance** (investor / technical): Continuous Production Assurance, the Agent V&V matrix, the Enterprise World Model;
  - **Operations**: the security-team dashboard.

  The left nav is an **Agent Lifecycle** rail: Blueprint Studio → Pre-release → PCP · Policy → Incident Queue.
- **Blueprint Studio:** the computed Blueprint Studio from [`blueprint_studio/`](blueprint_studio/README.md), embedded in the Blueprint Studio view.
  - It includes the editor, templates, Ask AI, Validate → Optimize → Decide → Register, and the Decision Trace.
  - Its pending decisions, PCP cards and registrations appear on Overview, PCP · Policy and the Workflow Library, stored in this browser.
  - How it is wired: [`js/STUDIO_BRIDGE_CONTRACT.md`](js/STUDIO_BRIDGE_CONTRACT.md), plan [`logs/2026-09-24_STUDIO_CUTOVER_PLAN.md`](logs/2026-09-24_STUDIO_CUTOVER_PLAN.md).
- **Enterprise World Model:** the sub-tabs are *Ontology Layers* (default), *Ontology Graph*, *World Model Coverage*, *Domain Suites* and *Coverage Gaps*.
  - The first three are D3 panels over one L1 → L2 → L3 → L4 chain, built from MITRE D3FEND, ATT&CK, ATLAS, UCO and the OWASP GenAI lists; *Domain Suites* and *Coverage Gaps* are static, illustrative markup.
  - The Ontology Graph opens on the animated **Network** view (WebVOWL-style).
  - Domain packs are grounded in public standards and benchmarks; L4 adds a labelled partition of public benchmark runs (AgentDojo, τ²-bench), shown by default through a *Public benchmark runs* toggle. The bundle carries a 1-in-3 business-stratified sample: 346 of 946 runs, with all 135 incidents and every typical example kept; agent inspectors report the full counts.
  - What was built and why: [`SECURITY_WORLD_MODEL.md`](SECURITY_WORLD_MODEL.md). Code and data pipeline: [`swm/`](swm/README.md).
- **Runtime Observation (Jev runtime demo):** its own entry in the left nav's Environment group, between Enterprise World Model and System Validation. It shows each agent action checked before it runs (hard rules → Jev judgment battery → policy), with reference figures, scripted AP and SOC scenarios and the embedded demo.
  - The demo is vendored byte-for-byte in [`jev-runtime/`](jev-runtime/README.md) from jev-runtime-observability, and it is simulated end to end.
  - **Learning loop:** a "The judge learns from your reviewers" card shows the measured Kev fine-tune result (held-out AgentDojo, benchmark labels), read from the vendored `jev-runtime/demo/data/learning-evidence.json`. **Try the loop** opens the demo's simulated Learning loop tab. Plan: jev-runtime-observability `logs/2026-09-30_LEARNING_LOOP_SHOWCASE_PLAN.md`.
  - Plain-language guide (Chinese, screenshots of every page): [`docs/jev-runtime-guide/`](docs/jev-runtime-guide/README.md).
  - Deep link: `index.html#view=runtime-observation`; the old `#view=long-term&tab=runtime` redirects there. Plans: [`logs/2026-09-30_JEV_RUNTIME_VALIDATION_PLAN.md`](logs/2026-09-30_JEV_RUNTIME_VALIDATION_PLAN.md) (built as a System Validation tab), then [`logs/2026-09-30_RUNTIME_OBSERVE_VIEW_PLAN.md`](logs/2026-09-30_RUNTIME_OBSERVE_VIEW_PLAN.md) (moved to its own view).
- **Older Jev observability demo:** [`jev-observability/`](jev-observability/README.md) is the first, AP-only standalone page. It stays live, unchanged, and `jev-runtime/` supersedes it.
- **Left navigation:** on desktop it starts hidden so the content uses the full window. The sidebar icon (top left) shows it docked; the same icon in its header hides it again, like chatgpt.com, and the choice is remembered per browser. Hovering the far-left edge peeks it over the content and it slides away when the pointer leaves. Phones keep the icon strip. Plan: [`logs/2026-09-30_FLOATING_NAV_PLAN.md`](logs/2026-09-30_FLOATING_NAV_PLAN.md).
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

Each document is dated and kept as written; `logs/` also holds the design frames, review records and probe evidence for the bigger changes.
