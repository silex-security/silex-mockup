# 2026-09-21 — Artifact upgrade plan (v0.2, review round 2)

**Goal.** Bring the strongest ideas from two new artifacts into the demo site, without touching the
Security World Model content. Sources: `silex-explorer/docs/preview.html` and
`silex-explorer/docs/tech-explainer.html`. We borrow **interactions and ideas, not their look or their data**.

*v0.2: round 1 had DeepSeek and Codex both PLAN-REJECTED. §6 maps every objection to its change.*

## 1. Hard constraints
1. **SWM untouched**: `swm/**` and `<section id="security-model">` byte-identical, **and** its rendered tabs look and behave the same (screenshot comparison before/after). No change to global tokens it uses; new CSS is scoped under new class prefixes (`.rx-*`).
2. **Site data only.** Everything renders from existing incident objects (`incidentData`, `INC_REC`) plus one new, commented, **illustrative** constant block per feature. No names from the artifacts (Atlas, G-7, R1–R5, 1,152/61/23).
3. **Site look only.** Inter + IBM Plex Mono and existing tokens/components (`.card`, `.grade`, `.path-row`, `.status`, `.rationale`, `.promo`).
4. **Illustrative means labelled at the panel**, not only by the global badge: every new panel carries an explicit caption, e.g. *"Illustrative provenance example"* and *"Illustrative model comparison"*. Nothing claims an actual execution, a recorded model, or exhaustive coverage.
5. Single file, vanilla JS/SVG, no new libraries. Log in `logs/README.md`.

## 2. Pre-work (do first)
- **One candidate string.** The site says both "Bind **identity** + intent + mutation" (`incidentData['I-1042'].candidate`) and "Bind **approval to vendor** + intent + mutation" (PCP cards, static rec card). Collapse to **"Bind approval to vendor + intent + mutation"** everywhere.
- **Stable route IDs.** Path A = the observed, blocked route (last entry of `d.paths`); B, C, D = the others in order. The graph, the rows, the side-by-side and P3 all use these letters.
- **Grades as the data says.** I-1042 has one observed route (A) and three latent (B–D), and **no declared route is invented**. The incident's grade legend keeps "Declared" with the note *"appears before deployment, in Blueprint Studio"*.

## 3. The changes

| # | Where exactly | What |
|---|---|---|
| **P7** (backbone, first) | Scoped styles for the new panels + existing path rows | Grade = **line pattern + existing colour chip** (solid observed · dashed latent · dotted declared). State = colour **plus text label** "Open" / "Blocked". Keyboard-selectable routes. Animation plays only when the panel is visible, stops when the view is hidden, and is disabled under `prefers-reduced-motion`. |
| **P1** Route map | Incident → *Alternative paths*, right after the outcome heading + grade legend, before the existing rows | Left-to-right SVG of the incident's four routes to the outcome; PAY-042 visibly interrupts Path A. Attack tokens play once on tab open, with a **Replay** button. **Path B selected by default.** Click/Enter on a route → detail beside the graph (below on mobile): *"Originally inferred (latent) from: premises + sources · generating class + constraint"*, then a separate box: *"Illustrative simulation check: route reachable in the simulated environment; removing the inherited authority makes it unreachable. This does not upgrade the grade."* The existing rows stay, collapsed into an accessible route list under the graph. "Review candidates →" stays. Works for every incident from `d.paths`; the provenance example exists for I-1042 only, and others show grade + route text. |
| **P2** "Most secure ≠ best" | Incident → *Candidates*, replacing the top of `#incCands`; PCP before/after, six-objective detail and promotion ladder stay underneath | 2-axis chart: **y = residual reachability**, **x = business friction** (defined on the chart: share of legitimate executions blocked or held for manual review); latency stays in the detail below. Three explicit illustrative candidate records per incident (existing A/B/C: the binding control; *Remove agent write access*; *Human review for every mutation*), labelled directly, plus "today". Veto line + labelled slider. **Selection rule:** lowest reachability with friction ≤ veto (tie → lower friction). **Single source of truth:** the computed winner drives the RECOMMENDED/Rejected badges, `#incRecText`, `#incSbsControl`, the validated-state numbers, the Decision tab text and the Approve button. When nothing qualifies: "No acceptable candidate", and Approve is disabled. Default veto yields today's recommendation. |
| **P3** Model change check | *Pre-release*, full width beneath the Environment-change / Affected-workflows pair | Framed as a second kind of release-gate change: *"Model change: Finance Agent model update"*. Both models' output-check results shown **side by side** (identical). Graph diff: **Path C of I-1042 (Finance → Support → vendor merge → inherited authority)** exercised by the new model only. Link "Inspect Path C →" opens I-1042 with Path C selected. Captioned **"Illustrative model comparison, not recorded runs"**. |
| **P4** How routes are evaluated | *Assurance* §03, a sub-block after the `.as-wm` grid (section numbering unchanged) | Compact three-stage diagram, no cell grid: **candidate branches in the modelled set** → excluded by named laws (expandable list of reasons with counts) → **simulated executions**. For I-1042: *"187 simulated executions examined 4 routes; 3 remain open."* Counts are an illustrative constant block. Wording: *"Pruned ≠ sampled: every excluded branch names the law that excludes it, so each exclusion can be checked. Coverage is only as complete as the model's vocabulary and assumptions."* |
| **P5** Where this is today | *Assurance*, closing strip after §04 | Four jobs with Plan v1 statuses verbatim: Pre-deployment **Designed** → Blueprint Studio · Release gate **Building** → Pre-release · Runtime **Building** → PCP · Policy · Post-incident **Thesis → Building** → Incident Queue. Caption: *"Views in this demo are illustrative product screens."* |
| **Entry** | *Assurance*, beneath the intro paragraph | Button **"Follow one blocked attack →"** opens I-1042. |
| ~~P6~~ | — | **Deferred** (both reviewers). The bilingual investor story lives in the separate explainer. |

Also borrowed from the explainer: the short sequence **observe → reconstruct → explore → compare fixes** as small step labels on P1/P2 headers. Not borrowed: the long technology cards, research discussion and smoke-detector analogy.

## 4. Implementation
One owner (Claude) edits `index.html` sequentially, because parallel agents on one single-file page would collide. DeepSeek and Codex review the **diff and screenshots** before it is pushed.

## 5. Acceptance
- SWM: `git diff` shows nothing under `swm/` or inside the security-model section; before/after screenshots of its tabs match.
- Headless screenshots at 1440 and 390 px of Assurance, I-1042 *Alternative paths* and *Candidates*, and Pre-release: no overlap or clipped text.
- P2: default winner = the binding control; dragging the veto past *Remove agent write access* switches the winner and every dependent field; dragging below the lowest friction → "No acceptable candidate" + Approve disabled.
- P1: route selectable by keyboard; animation stops when the view is left; reduced-motion shows static tokens.
- No console errors when clicking through every nav item and all six incidents.
- `logs/README.md` entry + this plan archived.

## 6. Round-1 objections → changes

| Objection | Change |
|---|---|
| Illustrative fixtures masquerade as execution evidence (Codex 1) | Per-panel "Illustrative…" captions; the simulation check is separated from provenance and never upgrades the grade; no "recorded models" claim |
| P4 implies completeness (Codex 2) | Bounded "modelled set"; assumptions stated; executions ≠ routes; the reworded pruning sentence |
| P2 disconnected from the decision flow (Codex 3, DeepSeek) | Computed winner is the single source for badges, text, Decision tab and Approve; "none" disables approval; acceptance tests for switching |
| P3 fabricated second narrative in Ops view (DeepSeek 1) | Reframed as a release-gate **model change** (same job as environment change), derived from I-1042 Path C (inherited authority), captioned illustrative, deep-linked. **The split:** Codex said keep it in Pre-release; DeepSeek said cut it or move it to Assurance. My pick is Pre-release, because a model update is a release event, and "evals didn't catch it" is exactly a release-gate question. Judge the reframed version. |
| Look must stay the site's; dual-encode grades (both) | Constraint 3 + P7 |
| No declared route in I-1042 (both) | None invented; legend note points to Blueprint Studio |
| Candidate string inconsistency (DeepSeek) | Pre-work item 1 |
| Don't copy preview's probability arithmetic (Codex) | Explicit illustrative records; no independence math or additive friction |
| P4 grid too big (Codex) | Compact 3-stage diagram |
| P6 cost (both) | Deferred |
| Entry point (Codex) | "Follow one blocked attack →" |

## 7. Outcome (2026-09-21)
Plan approved in round 2 (DeepSeek, Codex, Claude). Implementation review took four rounds: Codex found approval-state persistence, Modify re-run metrics, winner-dependent scorecards, success claims under "no acceptable candidate", closed-incident state carry-over, and modified-scope ranking; DeepSeek found the leftover "identity" wording, the Decide button, and the PCP queue name. All fixed and covered by headless probes; both returned IMPL-APPROVED.
