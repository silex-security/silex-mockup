# Change log — silex-mockup demo site

Newest first, with what changed and why. The plans, review records and audits are the date-prefixed files in this folder; the index is on the [project README](../README.md#plans-reviews-and-audits).

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
