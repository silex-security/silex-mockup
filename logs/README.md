# Change log — silex-mockup demo site

Every change to the demo website, newest first, with the dated plans and audits that drove
each one archived alongside (see the index at the bottom). Figures on the site are illustrative;
public ontology data is real (see [`../swm/data/SOURCES.md`](../swm/data/SOURCES.md)).

---

## 2026-09-21 — Security World Model visual upgrade (implementation)

[Implementation addendum and run log](2026-09-21_SWM_IMPLEMENTATION.md) · [Approved visual plan](2026-09-21_SWM_VISUAL_UPGRADE_PLAN.md).

- Implements the midnight-indigo chart stages, contextual inspectors, bounded ontology exploration and illustrative Refund relation example.
- User amendment: Security Ontology is first and the initial default; Ontology Layers follows, then World Model Coverage, Domain Suites and Coverage Gaps.
- Data, vendor bundle and other application views are preservation targets; validation and all-seat implementation verdicts are recorded in the run log. Implementation review pending; this entry does not imply deployment.

## 2026-09-21 — Security World Model visual upgrade (implemented, awaiting deployment)
[Implementation log](2026-09-21_SWM_IMPLEMENTATION.md) · [Plan v0.2](2026-09-21_SWM_VISUAL_UPGRADE_PLAN.md) · [Design frames](swm-visual-2026-09-21/index.html).

- Security Ontology is now first and default (L1 overview, 240 of 370 nodes; search across all 598; illustrative Refund example 9/24 with 8 stored relations), followed by Ontology Layers, World Model Coverage, Domain Suites and Coverage Gaps.
- Dark SWM stage with white inspectors; the data, vendor files, loader and tools are unchanged; other views are pixel-identical.
- Three-seat implementation review: R1 rejected (2 Layers blockers), R2 approved with a nit, and **R3 `27f07eb` unanimously approved**. Not yet published.

## 2026-09-21 — Security World Model visual upgrade (planning only)

[Plan](2026-09-21_SWM_VISUAL_UPGRADE_PLAN.md) · [Four design frames](swm-visual-2026-09-21/index.html) · [Review record](swm-visual-2026-09-21/REVIEW.md).

- Proposed a scoped midnight-indigo stage, larger coverage overview, inspectable relation focus, and four ontology planes, preserving the existing data and surrounding views.
- Native SVG design frames and Chrome PNG exports are review materials; no application code or dataset has changed, and nothing has been published.
- Roster: Claude + DeepSeek + Codex. Plan v0.2 and all four design frames passed two review rounds; all three seats returned PLAN-APPROVED. Codex authored/self-reviewed; Claude and DeepSeek reviewed independently. Literal verdicts and limitations are in the linked record.

## 2026-09-21 — Artifact upgrade: route map, measured fix, model change, route evaluation
Plan and review record: [`2026-09-21_ARTIFACT_UPGRADE_PLAN.md`](2026-09-21_ARTIFACT_UPGRADE_PLAN.md) (plan approved by DeepSeek, Codex and Claude in two rounds; implementation approved in four review rounds).

- **Incident → Alternative paths:** interactive route map of every route to the unsafe outcome. Line pattern = evidence grade, colour + text = Open / Blocked; the control (e.g. PAY-042) interrupts Path A; keyboard-selectable; Replay; animation stops when hidden and honours reduced motion. For I-1042, each route opens an **illustrative provenance example** (premises with sources, generating class + constraint) and a separate illustrative simulation check that never upgrades the grade. The text rows moved into a "Route list" disclosure.
- **Incident → Candidates:** "most secure ≠ best" chart of residual reachability × business friction with a draggable **business veto**. The recommendation is computed from illustrative candidate records and is the single source for the badges, PCP text, validated state, Decision tab and Approve button. "No acceptable candidate" disables approval.
- **Pre-release:** *Model change* card. Identical output checks for both models, while the graph diff shows the updated model exercising I-1042 Path C (deep link). Captioned illustrative; Path C stays latent.
- **Assurance:** "Follow one blocked attack →" entry; §03 gains *How candidate routes are evaluated* (bounded modelled set → excluded by named laws → 187 simulated executions → 4 routes, 3 open); new §05 *Where this is today* with the Plan v1 job statuses verbatim.
- **Consistency:** one candidate string, "Bind approval to vendor + intent + mutation".
- **Untouched:** `swm/` and the Security World Model view (byte-identical; rendered comparison differs only by D3 layout noise that also appears between two renders of the original).

## 2026-09-19 — Demo refine (per the Sep18 investor-narrative meeting TODO)
Commits `eb2fff6`, `c7f2afe`.

- **Fonts unified.** The site declared `Inter` but never *loaded* it, so it fell back to a
  different system font per machine ("字体 all over the place"). Now loads **Inter + IBM Plex Mono**
  from Google Fonts and folds every ad-hoc mono stack into one `--mono` token.
- **Assurance tab merged into the main demo.** A top-bar **register toggle** switches
  **Assurance** (investor / technical) ⇄ **Operations** (security team). Nav stays on the left.
- **Left nav → Agent Lifecycle rail:** Blueprint Studio (pre-deployment) · Pre-release (release
  gate) · PCP · Policy (runtime) · Incident Queue (post-incident).
- **Coverage Gaps info density.** The static panel showed 4 of the 8 real gaps; now shows **all 8**
  (from `coverage.json`) with severity badges (2 critical / 4 serious / 2 warning), a summary
  header, and deep-links (the refund-path gap opens WF-021).
- **Ontology Layers reveal.** A one-time L1→L4 build animation plays on first open (screen-record
  it for the "video" ask); it does not replay on interaction.
- **Removed** the top-right **"9/15 changes"** button.

## 2026-09-18 — Assurance restructure (proposed), World Model tab polish
Commits `da333a2`, `a1b2351`, `9aeffd3`, `7476a38`, `3e169f6`, `585f8c5`.

- **Assurance-first dual-register restructure** built to foreground Verification & Validation and
  the Enterprise World Model (v7 investor register). Reverted on `main` the same day and kept as a
  side-by-side proposal at **`/assurance.html`**; later merged into the main demo on 9/19.
- **Security World Model tabs:** default to **World Model Coverage** on entry; sub-tab order
  `World Model Coverage · Security Ontology · Ontology Layers · Domain Suites · Coverage Gaps`
  (left-aligned); **TBD** labels dropped.
- **`swm/README`** gained a Chinese plain-language data-provenance section (which public standards
  feed which chart; real vs. illustrative).

## 2026-09-17 — Positioning alignment (P0/P1) + SWM observatories rebuilt
Commits `5a37cc3`, `38e7450`, `de66709`, `1511568`, `bccc95a`, `09d619c`, `4c53cb2`.

- **Positioning P0/P1:** evidence grades (declared / latent / observed) on every path; the
  simulation → shadow → canary → production promotion ladder; six-objective candidate scorecards;
  "Policy Change Proposal" naming; never-inline + scoped-rollback notes.
- **Security World Model** rebuilt as three D3 observatories (Coverage, Ontology, Layers) over one
  real L1→L4 chain; white canvas; violet (layer) / plum (coverage) palette.

## 2026-09-16 — Demo rewrite from the 9/15 review
Nav regrouped into Workspace / Security / Environment; Short/Long-Term Validation renamed to
Workflow / System Validation and merged. See `2026-09-16_REWRITE_PLAN.md`.

## 2026-09-15 — 9/15 web demo review + UX pass
World Model Coverage moved to the Security World Model page; navigation restructured; 9 UX fixes
after a 201-element crawl. See `2026-09-15_CHANGES.md`, `2026-09-15_SITEMAP.md`, `2026-09-15_UX_FIXES.md`.

---

## Archived plans & audits (date-prefixed)

| Doc | What it is |
|---|---|
| [`2026-09-15_CHANGES.md`](2026-09-15_CHANGES.md) | Running change list + defaults chosen for open questions |
| [`2026-09-15_SITEMAP.md`](2026-09-15_SITEMAP.md) | Site-map and UX path audit (201-element crawl) |
| [`2026-09-15_UX_FIXES.md`](2026-09-15_UX_FIXES.md) | The logic behind each 9/15 UX fix |
| [`2026-09-16_REWRITE_PLAN.md`](2026-09-16_REWRITE_PLAN.md) | Demo rewrite plan from the 9/15 review |
| [`2026-09-17_PRD_ALIGNMENT_PLAN.md`](2026-09-17_PRD_ALIGNMENT_PLAN.md) | Page vs. PRD, P0/P1/P2 work |
| [`2026-09-17_SWM_OBSERVATORY_PLAN.md`](2026-09-17_SWM_OBSERVATORY_PLAN.md) | Plan for the D3 World-Model observatories |
| [`2026-09-17_POSITIONING_ALIGNMENT_PLAN.md`](2026-09-17_POSITIONING_ALIGNMENT_PLAN.md) | Aligning the demo with the Sept-2026 positioning |
| [`2026-09-17_docs-README.md`](2026-09-17_docs-README.md) | The old `docs/` index (for reference) |
| [`2026-09-18_ASSURANCE_RESTRUCTURE_PLAN.md`](2026-09-18_ASSURANCE_RESTRUCTURE_PLAN.md) | Assurance-first restructure plan (v7 investor register) |
| [`2026-09-21_ARTIFACT_UPGRADE_PLAN.md`](2026-09-21_ARTIFACT_UPGRADE_PLAN.md) | Artifact upgrade: route map, measured fix, model change, route evaluation (3-judge review) |

- **2026-09-21 · SWM Network view (WebVOWL-style animation)**: plan `2026-09-21_SWM_VOWL_NETWORK_PLAN.md` (v0.2, unanimous in round 2); implementation `2026-09-21_SWM_VOWL_IMPLEMENTATION.md` (unanimous IMPL-APPROVED in round 2 on `e978d6a`); contract, spike and frames in `swm-vowl-2026-09-21/`. Private branch `swm-vowl-network`.
