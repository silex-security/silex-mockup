# SWM visual upgrade implementation — v0.3.1 addendum and run log

## Approved scope + user amendment

Implement the approved [visual upgrade plan v0.2](2026-09-21_SWM_VISUAL_UPGRADE_PLAN.md), with these explicit user instructions superseding P1/default tab in the plan and the tab strips drawn in the static frames:

1. **Security Ontology** (`wm-ontology`) is leftmost and the initial default subtab.
2. **Ontology Layers** (`wm-architecture`) is second.
3. **World Model Coverage** (`wm-overview`) is immediately right of Ontology Layers.
4. **Domain Suites** (`wm-landscape`), then **Coverage Gaps** (`wm-gaps`) remain available.

On fresh load, entering Security World Model opens Ontology/L1 and loads that panel. Ordinary return to the section preserves the currently selected SWM subtab and shared abstraction level. Explicit gap actions can switch to Coverage, and Layers' Explorer action switches to Ontology. The explicitly labelled Assurance “Open the full World Model explorer” entry always selects `wm-ontology` after showing SWM, even if Coverage was last active. The generic sidebar and changes-modal entries preserve the last subtab. A narrowly scoped target attribute on that one Assurance link and its matching handler is the sole allowed edit outside SWM markup; it changes navigation, not visuals/content. Returning normally also preserves active Ontology example/focus state.

**Cold-load gap handoff:** a gap action must work before the core or Coverage module is loaded. T1's scoped index handler stores the latest request in `window.SWM_PENDING_COVERAGE_FOCUS` before selecting Coverage. T2's Coverage init installs `SWM.focusCoverage(request)` and consumes/clears the pending request once; when that function already exists, the handler consumes it immediately. A request names only the actual fixture leaf ID plus optional gap ID. Coalesce repeated early clicks into one latest request, do not add per-click subscriptions. Test first-click behaviour with delayed script loading and again warm. `swm-loader.js` need not change.

Tabs have role/aria-selected/aria-controls and roving tabindex with arrow-key navigation. This intentionally supersedes the historical 2026-09-18 Coverage-default choice. Both DOM order and keyboard navigation follow the new order; no old active Coverage panel may flash on first entry. The gallery is historical design documentation; its old tab strip does not override this amendment.

This task now authorizes implementation and local browser preview. The earlier planning-only constraint is superseded. No data, vendor or build-pipeline changes; no global visual restyling or new dependency. Existing v0.2 acceptance checks remain, with added default/tab-order probes.

## Base and ownership

- Fixed implementation BASE: `16409f12f7bf199fe2c665f56d82ece7b8af86a6`.
- Working branch: `swm-visual-upgrade`.
- Roster: Claude + DeepSeek + Codex, unanimous plan and implementation gates.
- Claude owns `index.html` (SWM markup and scoped SWM integration only), `swm/css/swm.css`, `swm/js/swm-core.js`, `swm/js/swm-ontology.js` (T1/T3).
- DeepSeek owns `swm/js/swm-coverage.js`, `swm/js/swm-layers.js` (T2/T4), once shared interfaces are agreed.
- Codex owns this run log, log index, scratch probes/screenshots and final integration review. No concurrent writes to agent-owned files; fixes requested from the owner until it hands back ownership.
- `swm/js/swm-loader.js` stays unchanged unless a concrete integration need is reviewed by the seats. No edits to `swm/data`, `swm/tools`, `swm/vendor`, unrelated application views or global CSS.

Baseline working tree was clean. A full original snapshot is in `/private/tmp/swm-implementation-20260921/baseline`; existing approved data/vendor SHA-256 baseline is `logs/swm-visual-2026-09-21/baseline-data-sha256.json`.

## Required checks

Also test Coverage → Assurance → explicit Explorer link returns to Ontology; cold-script-loading → Gaps → refund focus works on the first click; ordinary return preserves focus mode. All v0.2 §5 checks apply: four SWM screenshots at 1600×1000 and 1366×768; stacked 768×1024 layout; contrast and reduced motion; bounded 240-node L1 graph; valid 9/24 example and real edge directions; Reset/back; search/filter and shared layer state; bars/radar and coverage drilldown; both local fixture gap routes; no wrong global workflow/incident jumps; other-nav/no-console-error and candidate-veto/approval persistence/deep-link regressions. Data/vendor and unrelated-view source checks are mandatory. Review full diff against fixed BASE, including all intended new files, with literal approvals tied to its hash. Record any measured acceptance limitation candidly.

## Planning confirmation — v0.3.1

- CODEX: PLAN-APPROVED — v0.2 design plus the user's explicit tab-order/default amendment above; no new blocking concern.
- CLAUDE: PLAN-APPROVED — `/private/tmp/swm-implementation-20260921/claude-plan-v031.md`; both v0.3 blockers resolved.
- DEEPSEEK: PLAN-APPROVED — `/private/tmp/swm-implementation-20260921/deepseek-plan-v031.md`; confirms both additions.

## Implementation steps and review

All three literal PLAN-APPROVED verdicts read for v0.3.1; implementation gate opened. Record shared-interface agreement, work handoffs, probes, defects, revisions and literal final verdicts here. No shared-branch commit, push or deployment before a unanimous implementation review.

### Shared interface agreement before parallel implementation

- Request shape: `window.SWM_PENDING_COVERAGE_FOCUS = {leaf: 'WF-021', gap: 'g-refund' | 'g-memory'}`; optional `gap` may be absent. Index writes it, selects Coverage, then calls `SWM.focusCoverage()` **without an argument** if available. This function consumes/clears the slot if present; init does the same. Optional direct `{leaf,gap}` argument may be supported by Coverage but the index never uses it, avoiding synchronous-boot double application.
- Unknown leaf/gap must show an honest unavailable/empty detail rather than throw. Memory detail expansion is idempotent (set expanded, never toggle). Repeated pending clicks retain only the latest request.
- Assurance's explicit entry selects the Ontology tab but does not reset its selected node/example state.
- Keep existing SWM APIs callable. Claude publishes any added lifecycle/palette interfaces in `foundation-ready.md` before DeepSeek begins renderer changes; DeepSeek must request shared CSS changes from Claude.

### Foundation handoff

- Claude published the shared interface contract; syntax and navigation checks passed. Private checkpoint `413436a` captures only index/core/CSS; no shared commit or publication.
- Codex independently passed seven navigation checks (initial tab, exact order, return persistence, Assurance deep link, arrow navigation, ARIA, no errors).
- DeepSeek dispatched T2/T4 after the checkpoint; Claude continues T3 in disjoint files.
- Original recommendation/incident regression passed 11 checks before implementation; the same probe will run after integration.

### Independent integration checks (in progress)

- Eight outside-SWM navigation screenshots matched the original pixel-for-pixel at 1366×768; all navigation rendered without JS exceptions. All eleven existing candidate/approval/deep-link probes passed after the shared foundation.
- Ontology: sixteen checks passed (240 parent-closed real L1 nodes, inventory counts, nine focus + fifteen context nodes, eight stored relations and their provenance, preserve on ordinary return, Reset L4 then Back previous L1, full-dataset search, three render modes, no-result state, no JS exceptions). Missing required edge test fails closed with an unavailable message.
- Cold gap handoff: five checks passed with D3 deliberately delayed 1.6 s; memory request queues, consumes once, and focuses the correctly named local Customer Refund fixture without leaving SWM.
- Initial local performance: five cold navigation-to-Ontology-ready runs 574/500/545/435/426 ms (median 500, worst 574); twenty graph selections p95 162.3 ms, worst 177.6 ms. Settled layout remains stable. Final animation/size checks pending fixes.
- Corrections sent to owners before full review: persistent Back after Reset; nonoverlapping group/relationship labels; final-state recovery after hidden animation; readable asterisk glyph; Coverage header/legend spacing and enterprise scope labels; honest empty-gap wording; retained29.4K metadata; Layers proportional widths, keyboard operation, bounded/reduced-motion reveal and illustrative-instance wording.

### Completed integration before review

Both owners handed back their files. Codex completed narrow integration fixes: strict 240-node cap across successive group expansions (new focus replaces old pins, BFS still walks already-pinned ancestors); root zoom/radar cancellation when hidden; final-state redraw after interrupted Layers reveal; 220–240 ms selection transitions; preserved gap focus on resize; explicit SVG focus rings; and more room for dense L1 clusters with the legend/provenance in normal flow. No data changes.

Final browser probe suites (including their no-console-error checks):

| Suite | Checks | Failures |
|---|---:|---:|
| navigation | 7 | 0 |
| ontology | 17 | 0 |
| coverage | 13 | 0 |
| layers | 9 | 0 |
| cold | 5 | 0 |
| hidden | 8 | 0 |
| contrast | 6 | 0 |
| missing | 2 | 0 |
| regression | 11 | 0 |
| outside | 2 | 0 |
| render | 10 | 0 |
| performance | 6 | 0 |

Scratch evidence: `/private/tmp/swm-implementation-20260921/<suite>/results.json`, probe script `probe.mjs`, four views at all three target sizes in `render/`. Outside-SWM screenshots remain pixel-identical across all eight navigation destinations. Data/vendor SHA-256 values match the frozen baseline; loader/tools unchanged. All SWM JS syntax checks and `git diff --check` pass.

Final performance: cold navigation → Ontology ready, five local Chrome runs [439, 437, 1229, 922, 816] ms; median 816 ms, worst 1229 ms. Twenty selections p95 137 ms. Reduced motion and hidden-state probes pass. JS+CSS growth **49,673 bytes** against fixed BASE, below 50,000 bytes.

Limitations: at narrow widths the ontology canvas scrolls horizontally with a labelled hint and accessible list; the global application shell remains unchanged. Headless checks establish bounded transitions and final states, not subjective animation smoothness on every device. Dense L1 labels are group labels; individual records are available by selection/search/list.

### Full implementation review

A frozen full BASE diff, including this log and the log index, will be hashed for all three seats. Final literal verdicts and the reviewed revision will be appended below as review metadata; no implementation edits after approval without re-review. No publication is implied by a local implementation pass.

### Round 1 (revision `935dee3`)

Main-task coordination passed from Codex to Claude at the user's request (`HANDOFF_TO_CLAUDE.md`); the roster is unchanged (Claude + DeepSeek + Codex).

| Seat | Verdict on `935dee3` |
|---|---|
| Codex | IMPL-APPROVED |
| DeepSeek | IMPL-APPROVED (+ caption nit) |
| Claude | IMPL-REJECTED — 2 blockers |

Round 1 objections → R2 changes:

| Objection (who) | Change |
|---|---|
| Layers legend and hint overlay the L4 plane and each other; the hint hides "does not implement Laws, Objectives or Calibration" at 1366×768 (Claude B1) | `#swmLayersStage .swm-legend, .swm-hint` now in normal flow below the SVG (same rule as the Ontology stage); the reserved bottom band dropped (`pad.bottom` 118 → 24) |
| Outcome asterisk painted with `fill`, invisible in the plane glyph row and "Groups at this tier" chips (Claude B2) | `SWM.paintGlyph` for the plane glyphs and `SWM.glyphAttrs` for the chips |
| Plane coverage figure not labelled illustrative (Claude nit) | "nodes · illustrative coverage NN%" |
| Gap-weight caption said "darker = represented, red = missing"; the ramp is light violet → pink (DeepSeek nit) | Caption corrected; the CSS `.swm-ramp.gaps .bar` gradient now matches the drawn ramp, and the redundant inline override was removed |

R2 verification (`probe.mjs`, all passing):
- navigation 7; ontology 17; coverage 13; **layers 16** (9 + new overlap / caveat-visibility checks at 1600, 1366 and 768 + an Outcome-glyph paint check); cold 5; hidden 8; contrast 6; missing 2; regression 11; outside 2; render 10; performance 6.
- **The new Layers checks fail on the frozen R1 tree** (legend on plane and hint on legend at 1600/1366, asterisk unpainted), so they detect the defect.
- Performance: cold navigation → Ontology ready [624, 434, 493, 452, 385] ms (median 452, worst 624); twenty selections p95 125 ms.
- Data/vendor SHA-256 match the frozen baseline (6 files); loader/tools unchanged; JS syntax and `git diff --check` pass.
- JS+CSS growth **49,639 bytes** (< 50,000).

### Round 2 (revision `b3d5c35`)

| Seat | Verdict on `b3d5c35` |
|---|---|
| Claude | IMPL-APPROVED |
| DeepSeek | IMPL-APPROVED |
| Codex | IMPL-APPROVED (+ 1 non-blocking) |

Codex's non-blocking note was a regression introduced in R2: at 768 px the longer "nodes · illustrative coverage" caption overlapped the abbreviated plane description. Plan §5 requires no overlapping text at the stacked width, so it was fixed rather than shipped. R3 changes one line: on narrow stages each plane keeps its name and counts, and the inspector carries the description. A new probe check (no text intersection inside any plane, at 1600/1366/768) **fails on the R2 tree at 768 and passes on R3**. R3 re-runs: layers 19, render 10, hidden 8, contrast 6, navigation 7, performance 6, all passing. Growth 49,744 bytes.

### Round 3 (revision `27f07eb`): final

| Seat | Literal verdict on `27f07eb301635b50882dff6bc188e4f1814d5eac` |
|---|---|
| Claude | CLAUDE: IMPL-APPROVED |
| DeepSeek | IMPL-APPROVED (no blocking or non-blocking items) |
| Codex | IMPL-APPROVED |

**The implementation gate passed unanimously on revision `27f07eb`** (BASE `16409f1`, 8 files; verdict files `claude-review-r3.md`, `deepseek-review-r3.md`, `codex-review-r3.md` in the scratch root). This section is review metadata appended after the votes; no implementation change followed. The approved state is preserved on the private branch `swm-visual-upgrade`. **Pushing to `main` deploys the public site (Vercel), so it waits for the user's explicit deployment authorization.**
