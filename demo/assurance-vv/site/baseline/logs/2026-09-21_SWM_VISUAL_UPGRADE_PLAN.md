# Security World Model visual upgrade — plan v0.2

Date: 2026-09-21 · Status: awaiting three-seat review. **Planning and design documents only; no product code change is authorized in this run.**

## 1. Goal and baseline

用户反馈：数据已经足够，但展示不够炫酷。让投资人在 30 秒内看清“覆盖什么 → 关系是什么 → 如何从通用概念落到实例”，并愿意点击探索。视觉冲击来自大图、清晰层次与可解释的交互。

Current local `index.html` is byte-identical to the fetched live page at https://silex-mockup.vercel.app/. Repository HEAD inspected: `bca6459d2d148655e4c9b0414699923d8ee4ace4`. Existing D3 panels rendered with no console errors in Chrome 151: Coverage 48 path marks, Ontology default 50 node marks, Layers 23 path marks. Before screenshots: `/private/tmp/swm-visual-20260921/before/{coverage,ontology,layers}.png`.

Current weaknesses: dense small labels; low emphasis on the selected object; empty initial inspector; multiple rails compete with the graph; the layer diagram reads like four ordinary cards. Do not solve these with extra data, a full-site redesign, or ungrounded effects.

**Claim boundary:** this website is a clickable demo. Its public ontology identifiers are real; its enterprise runtime instances, coverage percentages, gaps and Silex mappings are illustrative. A richer graph is not a running engine. The plan must make the existing data exploration feel tangible without claiming execution, prediction, observed telemetry or calibration evidence.

## 2. Direction and effects

Retain the current dark application sidebar, white top bar, white page and typography. Within the three core SWM panels, use a large midnight-indigo stage (`#10162b` to `#26305a`), violet selection accents, clear off-white text, restrained depth and a white contextual inspector. This intentionally revisits the previous white-chart choice in a scoped presentation upgrade; colours and contrast need re-validation on dark surfaces.

- Main chart occupies about three quarters of the content width; detailed facts occupy the remaining quarter.
- One primary reading task per tab. Remove competing text above the main figure by consolidating it into a concise subtitle and a persistent provenance strip; retain source details in an expandable block. Preserve any still-applicable technical-alignment caveat in that block.
- Sparse dot-grid is decorative only, not an encoding. No stars, decorative fake graph nodes, orbiting particles, global blur, spinning galaxy, live counters or fake scanning console.
- Initial stage reveal lasts at most 650 ms, once per session. Selection transitions 180–280 ms. Ontology layout settles deterministically and stops; no perpetual motion. Layers can replay a labelled **diagram reveal**, not an engine run. No moving dots along edges.
- Under `prefers-reduced-motion: reduce`, all reveals and transitions become immediate. Hidden tabs stop simulations/transitions, and return without jumping layout or adding duplicate subscriptions.
- Dark-stage body text ≥4.5:1, meaningful marks/focus indicators ≥3:1. Colour remains secondary to labels, arrowheads, glyphs and status words. Broad dark graphs must stay readable on a projector.

## 3. Placement, behaviour and design frames

Four static SVG design frames and their PNG exports are in `logs/swm-visual-2026-09-21/`. Open its `index.html` as the design gallery. SVG geometry is a reviewable design specification, not production implementation. Numbers and highlighted relations are drawn from unchanged bundle data. The Ontology tab has default and focus frames. Frames use 1600×1000 to show the full layout; the production layout must adapt instead of shrinking that whole image.

### P1 — Shared SWM presentation shell

Keep all five tabs and their IDs: World Model Coverage (`wm-overview`), Security Ontology (`wm-ontology`), Ontology Layers (`wm-architecture`), Domain Suites (`wm-landscape`), Coverage Gaps (`wm-gaps`). Default tab remains Coverage. Do not change global sidebar, global top-bar layout, registers or other views. Frames represent existing shell visually rather than prescribing global CSS edits.

Within `#security-model`, use a short headline (“Make the invisible legible.”) and the task-specific subtitle in each frame. Chart and metadata follow directly under existing tabs. A visible local provenance line must travel with each chart; the global “Simulated agents · Illustrative data” pill is insufficient by itself. Any unchanged lower-panel explanatory content remains available below the main view.

At 1600/1680 widths: stage / inspector = fluid remainder / 304 px, gap 16 px; no extra permanent left rail in the Ontology tab. Move L1–L4 choices and search above the stage; group filters and colour-mode controls remain available in an expandable accessible toolbar. At 1366×768, shorten stage to fit its main labels and primary action in first viewport where feasible; supporting facts may scroll below. At ≤1100 px stack inspector below stage; at 768 px make toolbar wrap and provide labelled chart pan/zoom plus a readable list/table equivalent. Do not simply scale text below legibility.

### P2 — Coverage: a large legible overview

Frame: `01-coverage.svg` / `.png`. Place four compact KPIs directly below tabs: authored demo coverage, domain-pack count, known demo gaps, bundle node/relation counts. Retain the existing 29.4K authored entity KPI in an expandable “Illustrative scope metadata” section, explicitly labelled as a fixture figure; this is distinct from the 598-node ontology inventory. Move last-calibration and drift demo details to an expandable “Illustrative calibration metadata” section; retain their existing values and explicitly mark them as authored, not a fresh timestamp.

Keep zoomable sunburst and Coverage / Gap weight modes. Enlarge its center value, add domain names and exact percentages in a companion list **within the dark stage**, and reduce arc-label collisions using a pixel-space fit check (hover/focus reveals full names). Numbered domain labels in the inner ring map to the companion list without relying on colour. Angular size retains the current sum of leaf `entities` weights, not the parent `entities` field; coverage remains the authored `coverage` field, not a newly computed score. Explain both encodings locally. A new dark-surface monotonic plum ramp uses a newly explicit 40–100% display range (the old legend says 40–100%, while the old JS bucket function is not that linear scale); clamp values outside it and label the endpoint as a bound; low/high endpoints have labels.

Clicking a domain in either ring or companion list updates the same `focus`. Ring, breadcrumbs, center, six dimensions, scope facts and gap list all re-read that subtree. Domain list becomes its children on drilldown. At a leaf show the workflow name and a return action; no invented children. Enterprise KPIs stay explicitly labelled Enterprise when the chart is drilled in.

The right column defaults to six labelled horizontal bars for exact comparisons, with **Bars / Radar** switch retaining the existing radar. The frame shows bars. Existing dimension IDs are Identity & Authority, Agent & Tool, Workflow, Policy & Control, Resource & Data, Business Outcome; they are model-completeness dimensions, not the six Business Harness objectives.

Below dimensions, preview the first two critical gaps at enterprise scope (then severity/ID deterministic order) and offer **View all N gaps** that expands the full in-scope list in the same panel, preserving semantically valid action routes and applying the fixture-local collision rule below. No invented gaps. With no gap in scope, show an honest empty state. Changing scope resets a stale expanded list while all actions keep using current data.

**Fixture-local navigation rule (also applies to Coverage Gaps):** bundle workflow IDs and website workflow IDs are separate namespaces. Bundle `WF-021` means Customer Refund; website `WF-021` means Finance · Vendor Master Update. Bundle `I-1042` means Refund loop; website `I-1042` means Vendor bank mutation. Do not alias either to a merely similar workflow/incident. `g-refund` instead displays “Focus Customer Refund (SWM fixture)” and focuses the `WF-021` leaf within Coverage. `g-memory` displays “Inspect memory gap (SWM fixture)” and focuses that same leaf with the memory-gap detail expanded. Neither action leaves SWM. Every rendered SWM occurrence of this workflow uses “WF-021 · Customer Refund (SWM fixture)” (shortened only with an accessible full label), not a bare ID. Any future workflow/incident action requires an explicit verified semantic match; otherwise show local fixture detail and “Not linked to a workflow/incident page in this demo.” Existing valid generic Register/Connect/library actions are retained. The bundle is not edited. Static Coverage Gaps buttons follow this same rule through SWM-scoped markup/handlers; no broad global event interception.

### P3 — Ontology: readable relationships, not a hairball

Frames: `02a-ontology-overview.svg` / `.png` (default) and `02-ontology.svg` / `.png` (example focus). Existing default remains general L1, starting with a parent-preserving breadth-first expansion from its eight anchors up to the existing 240-node cap, arranged in stable spaced groups, with “240 shown of 370 L1 nodes / 598 across all tiers.” This expands the old 50-node initial state while retaining the L1 default and bounded rendering. Order roots by bundle group order and children by ID; each child enters only after its parent. Search/drill-in must expose any node outside this initial subset. Summary inspector distinguishes 467 public-source and 131 Silex-authored nodes across all tiers; these are counts, not evidence confidence scores. Group totals are inventory labels, not fabricated graph nodes. Expand/search reveals more of the real graph; no decorative dots. This frame makes the initial scale and exploration affordance reviewable. A clearly labelled **Example: Refund workflow** action enters L4, selects `rt-refund-agent` and focuses its documented neighborhood. The frame depicts that selected example state, not a new default or a live trace.

Exact selected set for the frame: `rt-user-csr`, `rt-svc-identity`, `rt-refund-agent`, `rt-tool-refund`, `rt-ledger`, `rt-refund-mem`, `rt-kb-index`, `rt-policy-500`, `rt-hitl-t2`. Render the 8 existing edges whose endpoints are both in that set as the focus edges. Keep the other 15 L4 nodes and their stored L4-to-L4 relations as non-interactive muted context (≤15% opacity, no labels; accessible through Reset/list), rather than deleting the wider layer. The low-contrast context is redundant, not an actionable or informational mark; readable counts and the Reset/list expose the complete scope. Caption “9 of 24 runtime nodes focused / 8 focus relations.” Do not dim and retain L1 nodes while labelling the scope L4. Highlight the 4 stored relations CSR → service identity → Refund Agent → issueRefund() → Payment Ledger, with their predicates DELEGATES_AUTHORITY, AUTHORIZES, CALLS, MUTATES. This is **an illustrative relation neighborhood, not an observed execution trace, attack discovery or causal proof**. Do not reconcile or reuse this fixture's I-1042 label as the website's other I-1042 incident: their narratives differ. The example does not navigate to an incident.

A focus feature derives nodes by stable IDs and edges from the bundle; fail closed to “Example unavailable in this bundle” if any required node or relation is absent. It does not inject replacement edges. The subset is clearly labelled with focus and scope counts. On entering the example, save prior layer/filter/search state, clear incompatible filters, switch through shared SWM state to L4 and settle all 24 runtime nodes, then bring the 9 focus nodes into readable lanes in one ≤650 ms transition (immediate under reduced motion). Reset focus restores the ordinary L4 layer with all 24 nodes; a separate “Back to previous view” restores the saved prior state, including L1 if that was the entry state. Layer/search/group changes exit example mode and clear stale inspector selections; no contradictory selection/count survives. Non-example selection highlights incoming/outgoing one-hop relations with distinguishable direction. Clicking an edge shows its actual source, target, predicate and `src`, not the node's source substituted for edge provenance.

Keep Graph / Hierarchy / Relations views, all layers, search over the full dataset, group filters, colour modes and source links. Preserve shared `SWM.level` with Layers. Use deterministic seeded positions and bounded force settling; cap visible nodes at the existing 240 with an explicit “N shown of M in scope” message and search/drill-in, never silently claiming full graph display. Layout position and glow encode focus only; do not imply measured distance or evidence confidence. Glyph shapes continue to encode ontology groups.

Node inspector coverage always reads the selected node’s own `coverage` value, never the workflow or previous node value. Do not attach observed/latent/declared grades: this bundle lacks per-edge supporting evidence for those grades. Source provenance and illustrative labels are what it actually supports.

### P4 — Layers: four tiers with structural depth

Frame: `03-layers.svg` / `.png`. Replace flat wide bands with shallow oblique planes, drawn as SVG polygons (no WebGL / 3D library). Text stays upright and readable, not transformed with the plane. At narrow widths use ordinary vertical bands.

Keep exact bundle counts: L1 370, L2 86, L3 118, L4 24. Call the aggregate **598 nodes**, not 598 ontology types, because L4 contains instances. Cross-tier summaries from `chain.hops`: 43 SPECIALIZES, 21 DEPLOYED_IN, 22 INSTANCE_OF. Equal plane footprint is layout only; ribbon widths scale linearly from counts and are labelled. Counts do not establish provenance; Silex-authored mappings remain labelled.

Frame shows L3 selected. Clicking any plane sets shared `SWM.setLevel`; its inspector and “Open selected layer in Explorer” action agree. Describe hops as structural adjacency; `chain.hops` normalization is not the directed `s` → `t` relation itself. Actual predicate direction comes from underlying links in the inspector. Preserve explicit parent-chain semantics and do not claim all graph relations are parent relations or cannot cross tiers.

Always distinguish **four ontology tiers** from the world model's five named layers: L1–L3 supply Schema, L4 supplies World State instances. This display does not implement or demonstrate Laws, Objectives or Calibration. No “four-layer world model,” no digital twin or live-runtime label.

### P5 — Preserve and verify surrounding views

Domain Suites and Coverage Gaps stay in place and keep their data and semantically valid functionality (the P2 fixture-local navigation fix is explicitly in scope); no unnecessary fifth visual system. Only adopt scoped text/spacing if needed for consistency. The older static `model-layers` block below Coverage is not another version of the ontology tiers: retain it as a clearly separate, collapsed “Illustrative model-component summary” and label all its percentages as authored. Do not present its mixed legacy names as a canonical world-model layer taxonomy. Existing semantically valid navigation to workflows/library/incidents remains functional; check destination names and business meaning against current page data, not just route IDs. Mismatched fixture links use P2 local focus. Other views including the previous upgrade's recommendation selection, veto thresholds, approval persistence and Pre-release Path C deep link are regression targets, not redesign scope.

## 4. Scope, owners and implementation sequence (future run)

This run delivers plan + design artifacts + review log. No product implementation, commit, push or deployment is part of the present task.

Estimated future implementation: 3–4 focused developer-days plus review/fix time, using existing D3 7.9.0 and static serving. Stop the estimate at a performance/usability issue rather than silently adding a new rendering stack.

Before implementing: every seat must approve the same plan/design version, record the fixed pre-implementation base per repo (`git rev-parse HEAD`) in the run log, then implement in a private working branch. No shared commit/push/deploy before all-seat implementation approval and user deployment authorization.

| Task | Owner / files | Acceptance check |
|---|---|---|
| T0 — Capture baseline and design contract | Codex planning; future implementer stores screenshots/state probes in scratch and log | Data/vendor hashes and outside-SWM baseline recorded; 1600×1000, 1366×768, 768×1024 layouts specified; approved artifact hashes recorded |
| T1 — Scoped palette, layout and shared accessibility | Claude: `swm/css/swm.css`, `swm/js/swm-core.js`, SWM-only markup in `index.html` | No global token changes; sync JS ramp constants and CSS token copies, including textOn/haloOn results; dark-surface text and meaningful mark contrast checked; tooltips inherit proper colours even when mounted on body; reduced-motion works |
| T2 — Coverage presentation + linked states | DeepSeek: `swm/js/swm-coverage.js` only, after T1 interface settles | All domain and leaf focus states use bundle values; companion list/radar/bars/gaps stay in sync; Gap weight legend changes correctly; empty gaps and back navigation work |
| T3 — Ontology focus + rendering | Claude: `swm/js/swm-ontology.js` | Default frame’s 240 real nodes and L1 count 370 verified; example has nine focused of 24 L4 nodes and eight focus edges; directions/provenance exact; no fabricated links; reset/search/layer changes clear stale focus; all three render modes preserved |
| T4 — Layer plane drawing | DeepSeek: `swm/js/swm-layers.js` only after T2 | Four counts and three hop totals match data; shared layer action works both directions; actual edges show true direction; narrow-screen bands readable |
| T5 — Integrated probes, review, run log | Claude integrates only once DeepSeek stops writing; Claude + DeepSeek + Codex review full base diff | All checks below pass; literal three-seat IMPL verdicts on same full revision; log before any authorized publish |

File ownership is exclusive while agents run. Shared API changes are requested from Claude. `swm/js/swm-loader.js` should remain unchanged unless an approved integration need appears. **No changes** to `swm/data/*`, `swm/tools/*`, `swm/vendor/*`, other views' markup or global CSS. No dependency installation or pipeline rebuild needed.

## 5. Acceptance / review criteria

1. **Visual:** four settled screenshots (Coverage, Ontology default, Ontology focus, Layers) at 1600×1000 and 1366×768; one stacked layout at 768×1024. At 1366 chart labels and primary actions remain readable at 100% zoom, no unexpected page-width overflow, inspector does not cover chart. Demo smoke script: Coverage → Customer Service → WF-021 Customer Refund (inside SWM only) → Enterprise; Ontology L1 overview → example L4 (9/24 focus) → inspect edge → Reset L4 → Back to previous L1; Layers → L3 → Explorer. A reviewer should explain each figure without reading a paragraph.
2. **Data:** unchanged SHA-256 for every `swm/data/*` file; rendered values checked against bundle rather than copied design text. Do not introduce new coverage aggregations or imply the presentation recomputes authored values. The 29,440 enterprise entity count equals the sum of the five domain totals; the design does not need to reconcile them. 82% shown as authored rounded aggregate, not a computed metric. Only current bundle nodes/edges may appear.
3. **State:** test domain drilldown/back/leaf/empty-gap state; modes and scope synchronize; switching SWM tabs repeatedly creates no duplicate canvas/listeners, preserves valid shared level, and clears stale inspectors/tooltips. Graph missing-example/no-search-results paths render meaningful states, not success claims. No SWM control opens a workflow or incident whose business meaning contradicts its visible label. In particular, g-refund and g-memory stay in SWM, focus the correctly named fixture leaf, and never call the global WF-021 or I-1042 routes. Verify this in both Coverage and the static Coverage Gaps tab. Retain verified generic library/register/connect behavior.
4. **Access:** keyboard tab navigation and Enter/Space activate visible controls; focus is visible; SVG nodes/edges have accessible names and corresponding list/inspector controls; hover information is also obtainable through focus/click. No information depends on colour or animation. Contrast measured against final composited fill, not nominal tokens.
5. **Performance:** on this host's Chrome at 1366×768, full page cold navigation → requested SWM diagram ready ≤3 s locally (test 5 runs, report median and worst); selection/drilldown p95 ≤200 ms to begin visible response over 20 actions, final transition ≤650 ms. Deterministic force simulation stops within 1 s; no animation loop after settling or when hidden. New JS+CSS combined growth ≤50 KB uncompressed excluding design artifacts; current lazy-loading preserved. If bound fails, reduce effects/visible geometry before adding dependencies.
6. **Regression:** current three-panel render probe passes; no console errors on all five SWM tabs and every existing nav destination. Outside-SWM screenshots match baseline (mask only established nondeterministic regions after a two-original-render control); existing veto=1 / veto=40, approval-reopen, modified-candidate ranking, PCP labels and Path C deep link still behave as before.
7. **Gate:** save full review diff against fixed BASE including checkpoint commits, staged/unstaged content and intended new files (`git add -N` for new files; `git diff "$BASE"`; inspect `git status --short`). Hash saved full diff; every seat reviews same revision and supporting screenshots/probe results. New changes require re-review. Local design documents never constitute an implementation pass.

## 6. Review record

Roster: Claude + DeepSeek + Codex. Codex drafts the plan/designs after Claude's service returned 529; user had explicitly requested in Claude pane that Codex draft and Claude/DeepSeek review. No seat substituted or removed. Codex still makes its own literal judgment against the final artifact manifest; it is not an independent fourth review.

| Round | Plan / design | Claude | DeepSeek | Codex | Outcome |
|---|---|---|---|---|---|
| 1 | v0.1 / v0.1 SVG frames | PLAN-REJECTED: two blockers | PLAN-APPROVED (SVG/data review; no PNG capability) | Accepted Claude’s two blockers | Revise fixture navigation and default graph design |
| 2 | v0.2 / four v0.2 frames | Pending | Pending | Pending | Re-review same revised artifact set |

Preflight from DeepSeek: accepted paired JS/CSS palette recalculation, static/illustrative timestamp discipline, local source provenance and legacy-summary separation. Kept the sunburst and L1 Graph default to preserve existing interaction; hierarchy/treemap preference is non-blocking. Did not adopt the statement that Layers contains “no mock”: its counts are verifiable bundle counts, but many relations/nodes are Silex-authored. Computing visible subset counts or domain count from existing arrays is presentation bookkeeping, not new coverage inference.

### Round 1 objections → changes

| Who / item | Change in v0.2 |
|---|---|
| Claude B1: WF-021 collision, incorrect gap navigation | P2 local sunburst focus for g-refund and g-memory; namespaced fixture labels everywhere; same rule for static Gaps; no speculative alias; smoke checks assert business meaning, not merely ID |
| Claude B2: default/full graph not visualized | Added 02a default L1 frame with 240 real nodes and 370/598 scope labels; example retains 15 muted runtime-context nodes; states and Reset/back semantics explicit |
| DeepSeek N3: unsupported inconsistency statement | Removed: enterprise entity count equals domain sum. No need to recalculate authored coverage |
| DeepSeek N4/N5 | Inspector reads per-node coverage; the 40–100 display domain is explicitly new, not a claim about current bucket code |
| Claude/DeepSeek aesthetics | Keep source tags truthful, make low-coverage marks pass contrast, keep five tabs but dark canvas only where quantitative graphs need it. Do not downweight any seat’s gate: Codex is self-review, two independent reviews, every literal vote required |

A missing seat leaves the gate pending. Log actual findings and objection → change mapping here or in `swm-visual-2026-09-21/REVIEW.md`; copy literal verdicts only after reading them. Preserve final artifact hashes separately from appended review-record metadata to avoid a self-referential file hash.
