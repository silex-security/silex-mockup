# silex-mockup

Clickable demo of the SILEX agentic security platform, aligned with the V1 PRD (Web UX / Investor Demo) on 2026-09-15.

- **Page:** [`index.html`](index.html), a single self-contained HTML file. Live at [silex-mockup.vercel.app](https://silex-mockup.vercel.app/).
- **Registers:** a top-bar toggle switches between two registers:
  - **Assurance** (investor / technical): Continuous Production Assurance, the Agent V&V matrix, the Enterprise World Model;
  - **Operations**: the security-team dashboard.

  The left nav is an **Agent Lifecycle** rail: Blueprint Studio → Pre-release → PCP · Policy → Incident Queue.
- **Security World Model:** the sub-tabs are *Security Ontology* (default), *Ontology Layers*, *World Model Coverage*, *Domain Suites* and *Coverage Gaps*.
  - They are D3 panels over one L1 → L2 → L3 → L4 chain, built from MITRE D3FEND, ATT&CK, ATLAS, UCO and the OWASP GenAI lists.
  - The Security Ontology opens on the animated **Network** view (WebVOWL-style).
  - What was built and why: [`SECURITY_WORLD_MODEL.md`](SECURITY_WORLD_MODEL.md). Code and data pipeline: [`swm/`](swm/README.md).
- **Figures are illustrative.** All agents are simulated; no engine runs behind the page. Public ontology data is real (see [`swm/data/SOURCES.md`](swm/data/SOURCES.md)).

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

Each document is dated and kept as written; `logs/` also holds the design frames, review records and probe evidence for the bigger changes.
