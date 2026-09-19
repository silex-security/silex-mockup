# Change log — silex-mockup demo site

Every change to the demo website, newest first, with the dated plans and audits that drove
each one archived alongside (see the index at the bottom). Figures on the site are illustrative;
public ontology data is real (see [`../swm/data/SOURCES.md`](../swm/data/SOURCES.md)).

---

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
