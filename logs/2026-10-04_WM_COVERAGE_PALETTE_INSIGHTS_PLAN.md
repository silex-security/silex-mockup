# World Model Coverage: system palette and "why is coverage low" hover insights — plan

Plan v3 · 2026-10-04 · branch `wm-coverage-insights` · base `main` at `fbbdc64` (`BASE` recorded at Step 5).
Requested by the product owner: in **Enterprise World Model → World Model Coverage** (panel `wm-overview`),
(1) the colours do not match the rest of the system; (2) the hover tooltip should explain *why* coverage is
low and suggest a plan.

## Roster

| Seat | Agent | Role |
|---|---|---|
| planner | Claude (Opus 5.5), calling pane | plan, palette + wiring slice, probes, vote |
| coder-deepseek | OpenCode `deepseek/deepseek-v4-pro` | plan/diff review, insight module + unit test |
| reviewer-codex | Codex `-m gpt-5.5` | plan/diff review only |

Seats share one checkout; ownership below never overlaps. Gates are unanimous.

## Findings (live site, headless 1440 px screenshots of all World Model sub-tabs)

- Every other surface uses the site's indigo family: `--blue #718aff`, `--blue2 #536bdb`, `--lav #e9edff`
  (`index.html` `:root`), and the Ontology Graph paints its dark stage with periwinkle/lavender nodes.
- Coverage alone uses a **pink/magenta** ramp: stage `COVERAGE_RAMP #e0569f→#f8e2ef`, paper
  `COVERAGE_RAMP_PAPER #b0529c→#471d43` (`swm/js/swm-core.js:17-19`, mirrored in `swm/css/swm.css:15-16`),
  the Gap-weight mode `#9aa4e8→#f06a9f` (`swm/js/swm-coverage.js:103`, `swm.css:132`) and the radar
  `rgba(152,63,136,.16)` (`swm.css:260`). The side-card dimension bars render as dark plum.
- Other consumers of the same ramp: Ontology Graph "colour by coverage" (`swm-ontology.js:203,209,913`) and
  the Ontology Layers meters (`swm-layers.js:210`). They change with the shared ramp, which is intended
  (one coverage colour everywhere).
- The tooltip today says only name, kind, entities, coverage % and status (`swm-coverage.js:141-147`). The
  bundle already holds what an explanation needs: six per-node `dims`, children with `entities`, and `gaps`
  with `scope`, `detail`, `severity`, `action` (`swm/data/coverage.js`, generated; **not edited**).
- `SWM.tip.move` flips below the cursor near the top but never clamps the bottom edge; a taller tooltip can
  overflow the viewport (`swm-core.js` `tip.move`).

## Design

### A. Palette (keep lightness semantics, change hue to the system's indigo)

High coverage stays lightest on the dark stage (no change to label logic or meaning); the hue moves from
pink to the site's indigo. Proposed stops (40/55/70/85/100 %), WCAG contrast measured:

- stage `#5f74e6 #7f93f5 #a2b2fb #c6d0ff #e9edff` — 3.10 … 10.9 vs `#26305a`, 4.4 … 15.4 vs `#10162b`;
  top stop = `--lav`.
- paper `#6a7fe8 #5a70e0 #536bdb #3f54b8 #2c3c8c` — every stop ≥ 3:1 vs `#fff` (graphical-object minimum;
  exact low stops tuned in implementation, values validated by the probe); `#536bdb` = `--blue2`.
- Gap-weight mode: ramp `#7079b3` (no gap, slate-indigo, 3.07) → `#b7a3ff` (SWM accent, 5.87) → `#e2d8ff`
  (≥ 45 % missing, 9.38), contrast vs `#26305a`; the mode switch stays visible without leaving the system
  palette. JS and CSS use these exact hexes (one `GAP_RAMP` in `swm-core.js`, mirrored in `.swm-ramp.gaps`).
- Radar area/stroke/points and `.swm-meter` default move to the paper indigo tokens.
- Reserved status colours (critical/serious/warning/healthy, always with icon + label) are **unchanged**.
- CSS tokens `--swm-c*`, `--swm-pc*`, `.swm-ramp(.gaps)` updated in step with `swm-core.js` (the file header
  says to keep the two in step).

### B. Insight content (deterministic, derived only from the bundle)

For a hovered node `n` (any depth), `SWM.coverageInsights(n, ctx)` returns:

1. **Headline** — `Why 55%:` + weakest dimension, e.g. "lowest in Resource & Data (47 %)". For a node at or
   above the Healthy threshold (`coverageStatus === 'good'`, ≥ 88 %) the headline reads "Healthy — weakest
   dimension is …" and no "why low" framing is used.
2. **Weakest dimensions** — the two lowest of the six `dims`, each with the gap to the parent's same
   dimension (bundle example: WF-055 Resource & Data 47 % vs Purchase to Pay 62 % → "−15 pts vs Purchase to Pay"); for the root, gap to the root's own dimension mean.
3. **What pulls it down** (non-leaf only) — up to two children ranked by entity-weighted shortfall to the 88 %
   threshold, `(0.88 − child.coverage) × child.entities / n.entities`, positive only; shown as
   "WF-055 · Vendor Master Change 55 % · 520 entities". The tooltip shows the ranking and the child's own
   figures, **not** the computed points (the authored aggregate is not guaranteed to equal the weighted mean
   of children, so a "costs N pts" claim would be unsupported).
4. **Recorded gaps** — gaps whose `scope` includes `n`'s id, severity-first (critical > serious > warning),
   max 2, plus "+K more in the gap list" when more exist; title + severity icon/label.
5. **Plan** — at most 3 numbered steps: first the `action.label` of the in-scope gaps that have one (in the
   order above), then a dimension playbook step for each weakest dimension not already covered:
   - identity → "Bind agent identities and delegated authority to the identity provider"
   - agent → "Inventory the agents and tools these workflows call"
   - workflow → "Register the missing workflow branches and trace them end to end"
   - policy → "Map controls and approval rules onto the workflow steps"
   - resource → "Connect the system of record so data access is observed at the source"
   - outcome → "Define the intended and prohibited business outcomes"
6. **Footer** — "Derived from authored demo figures · suggested steps are illustrative".

Rendering `SWM.coverageInsightHtml(ins, opts)`: all bundle text through `SWM.esc` / `SWM.fixtureText`;
status shown as icon + label via `SWM.statusHtml`, never colour alone; compact mode for the tooltip.

### C. Where it appears

- **Tooltip** on sunburst arcs (replaces today's body; keeps "click to drill into N children").
- **Companion list rows** (keyboard reachable): the same tooltip on `mouseenter` and `focus`, hidden on
  `mouseleave`/`blur`, so it is not mouse-only; the focused row gets `aria-describedby` pointing at the
  tooltip element (which gets a stable id), removed on blur.
- **Side card** "Why NN %" block under the facts for the focused node, so touch users get the same
  explanation without hover.
- Tooltip `max-width` 300 → 340 px; `tip.move` clamps the bottom edge too.

## Tasks and file ownership

| # | Owner | Files (exclusive) | Acceptance check |
|---|---|---|---|
| T1 | deepseek | `swm/js/swm-coverage-insights.js` (new), `tests/site/swm-coverage-insights.test.mjs` (new) | `node --test tests/site/swm-coverage-insights.test.mjs` passes; module loads after `swm-core.js` with no DOM access at load time |
| T2 | planner | `swm/js/swm-core.js`, `swm/css/swm.css`, `swm/js/swm-coverage.js`, `swm/js/swm-loader.js` | stage/paper/gap ramps as in A; no pink/magenta hex left in coverage paths; insights wired per C; loader loads the new file between core and coverage |
| T3 | planner | `swm/skills/swm-data-rebuild/scripts/probe-swm.mjs` | new probe `COV-INS` (see below); `LAZY` list gets the new file; all existing probes still pass |
| T4 | planner | this plan file, `logs/README.md` | changelog entry + outcome record |

T1 contract (planner writes nothing in T1's files; DeepSeek writes nothing outside them):

```js
// IIFE on window.SWM, same style as the other swm/js files ('use strict', ES5 syntax, no imports).
SWM.coverageInsights(node, ctx) -> {
  status,               // SWM.coverageStatus(node.data.coverage)
  headline,             // plain text
  weakDims: [{ id, name, value, vsName, delta }],   // 2 items, delta in points (signed number)
  drivers:  [{ id, name, coverage, entities }],     // 0..2, non-leaf only
  gaps:     [{ id, title, severity }], moreGaps,    // 0..2 + count of the rest
  plan:     [string],                               // 0..3
}
// node: a d3 hierarchy node (node.data, node.parent, node.children) — the test builds one with a tiny
// hand-written hierarchy shim (no d3 dependency in the test).
// ctx: { dimensions, gaps }  (from SWM.coverage())
SWM.coverageInsightHtml(ins, { compact: bool }) -> string (escaped)
```

The unit test loads `swm/data/coverage.js` and a minimal `SWM` stub (`esc`, `fixtureText`, `coverageStatus`,
`statusHtml`, `status`) in a `vm` context and asserts at least: WF-055 headline names Resource & Data 47 %,
plan step 1 is "Connect data" (gap `g-vendor`); Procurement's first driver is its direct child
`po-p2p · Purchase to Pay`, and `po-p2p`'s first driver is `WF-055 · Vendor Master Change` (drivers are direct
children only);
enterprise gaps critical-first (asserted as an ordering, not fixed ids) with
`moreGaps === inScope.length − 2` computed from the bundle, so a rebuild fails only on a rule regression; Identity & IT (91 %) gets the Healthy headline;
a hostile bundle string (`<img onerror>`) comes out escaped; a node without `dims` does not throw.

### Probe `COV-INS` (T3, headless, local server, existing harness)

1. Open `wm-overview`; no JS errors.
2. Hover (real mouse event at the arc centroid) the WF-055 arc after drilling to Procurement → tooltip
   contains "Resource & Data", "Connect data", and the illustrative footer.
3. Reach a companion-list row by **Tab key presses** (CDP key events, not `element.focus()`), assert
   `:focus-visible` and `aria-describedby` → the tooltip (`role=tooltip`) is shown; Tab away → hidden.
4. Side card shows the "Why" block for the focused node.
4b. Touch path at 390 px: tap (click at centre) a companion-list row → the focus drills in and the side
   card's "Why" block names the new node; no horizontal overflow (P1 still passes).
5. Computed `fill` of every **coverage/gap-weight arc, radar area/points and dimension meter** (status chips
   and icons excluded, so reserved red/orange never trip it): none in the old pink set; every coverage fill
   ≥ 3:1 vs `#26305a`; ramp endpoints equal the planned stops.
6. Ontology Graph "colour by coverage" and Layers meters render with the new ramp (no JS error).
7. Prove-it-fails: run `COV-INS` against `BASE` (`--root` a `BASE` worktree) and record that it fails.

Also run: `probe-swm.mjs` (all), `preview-panels.mjs`, `tests/site/run-site-probes.mjs`, and screenshots of
the coverage panel before/after (1440 px and 390 px) for the code review.

## Out of scope / untouched

`swm/data/*` and the build (authored figures unchanged), the Coverage Gaps tab, Domain Suites, the status
palette, every other view. No new figures are claimed; every insight is a rearrangement of authored demo data
and says so.

## Publication

After a unanimous code gate: merge to `main` and push (auto-deploys to `silex-mockup.vercel.app`; the
request "给出plan，通过后执行" authorises execution after approval); live read-back with `COV-INS` steps 1–2
against the production URL if the harness supports `--base`, otherwise a headless screenshot + DOM check.

## Round-1 objections → changes

| Objection / suggestion (who) | Change |
|---|---|
| 1. Test spec named `WF-055` (a grandchild) as Procurement's driver, contradicting the direct-children rule (Codex, blocking) | T1 test spec: Procurement → `po-p2p` first; `po-p2p` → `WF-055` first |
| Probe the touch path explicitly (Codex, non-blocking) | `COV-INS` step 4b: 390 px tap on a list row → side-card "Why" block |
| Scope the old-pink check to coverage marks so status colours never trip it (Codex, non-blocking) | `COV-INS` step 5 limited to arcs, radar, meters |
| §B.2 "−9 pts" example was not the bundle's figure (DeepSeek, non-blocking) | replaced with the real WF-055 vs Purchase to Pay figure (−15 pts) |
| Name the gap-weight hexes (DeepSeek, non-blocking) | `#7079b3 → #b7a3ff → #e2d8ff`, one `GAP_RAMP` mirrored in CSS |
| Darker low stage stop `#5567d9` so labels flip to white (DeepSeek, non-blocking) | **Not taken**: `#5567d9` is 2.62 vs `#26305a`, below the 3:1 floor for the arc itself. Keeping `#5f74e6` (3.10); its label still gets 4.3:1 dark text plus a halo |
| Tab-order keyboard probe, touch tap (DeepSeek, non-blocking) | step 3 uses real Tab key events; step 4b taps at 390 px |
| Don't hardcode `moreGaps === 6` (DeepSeek, non-blocking) | computed from the bundle; ordering asserted separately |
| `aria-describedby` from the row to the tooltip (DeepSeek, non-blocking) | added to §C and probe step 3 |

## Round-2 (plan v3)

No blocking objections. DeepSeek's notes for T2 (three-stop evenly spaced CSS gap gradient; set the tooltip id
and `aria-describedby` only after the tooltip node exists, clear on blur) are folded into implementation.

## Plan gate verdicts (plan v3)

- coder-deepseek (deepseek-v4-pro): PLAN-APPROVED (round 2; round 1 approved v1)
- reviewer-codex (gpt-5.5): PLAN-APPROVED (round 2; round 1 rejected v1, one objection, fixed)
- PLANNER (claude): PLAN-APPROVED — plan v3

`BASE` for the code gate: `fbbdc64d30c415416d4b35993e18f8a382806ca0`.

## Outcome (2026-10-04)

**Shipped.** Coverage arcs, legend, dimension bars and radar now use the site's indigo (`--lav` … `--blue2`);
Gap weight goes slate → accent violet. Hovering an arc or a list row, or focusing a row with the keyboard, shows
*why* the coverage is what it is: the two weakest dimensions vs the parent, the children that pull it down, the
recorded gaps in scope and up to three suggested steps; the same block sits in the side card for the focused node
(touch). Example, WF-055 · Vendor Master Change: "Why 55 %: lowest in Resource & Data (47 %)", −15 pts vs
Purchase to Pay; gap "Procurement vendor data not connected"; plan 1. Connect data, 2. Connect the system of
record…, 3. Register the missing workflow branches…

- **Files:** `swm/js/swm-coverage-insights.js` (new, DeepSeek; planner follow-ups below),
  `tests/site/swm-coverage-insights.test.mjs` (new, DeepSeek; 9 tests), `swm/js/swm-core.js` (ramps, `GAP_RAMP`,
  `gapColor`, tip id + bottom clamp), `swm/css/swm.css` (tokens, gap legend, radar, insight styles),
  `swm/js/swm-coverage.js` (wiring), `swm/js/swm-loader.js`, `probe-swm.mjs` (`COV-INS-*`, `LAZY`).
- **Planner follow-ups to T1:** a missing dimension is skipped (never read as 0 %); no delta without a parent
  value; driver entities via `SWM.num`; after code review, bundle action labels verbatim and the fixture suffix.
- **Checks on revision `f3522138`:** `probe-swm.mjs` 32/32 (new `COV-INS-TIP/SIDE/KBD/COLOUR/TOUCH/OTHERS`, all
  six **fail on `fbbdc64`** via `--root`), `preview-panels.mjs` ok, `run-site-probes.mjs` 42/42, every
  `tests/site/*.test.mjs` passes.
- **Untouched:** `swm/data/*` (authored figures), Coverage Gaps, Domain Suites, the reserved status palette.

### Code-gate rounds

| Round | Revision | DeepSeek | Codex | Change |
|---|---|---|---|---|
| 1 | `52a19327` | IMPL-APPROVED (5 nits) | IMPL-REJECTED: `SPECIAL_GAP` replaced two authored gap actions with hand-written labels, against §B.5 | removed (the planner's T1 brief had asked for it); fixture suffix on plan steps and driver names (by id: `fixtureText` on a full name repeats it); arc click hides the tip; no `aria-live` on the whole card; no empty tip wrapper; new verbatim-label test |
| 2 | `f3522138` | IMPL-APPROVED | IMPL-APPROVED | — |

Not taken: the gap-weight legend's CSS midpoint vs the B-spline arc midpoint (endpoints match and are probed;
cosmetic). Left for a later change (nits after approval): the side gap cards keep their older button wording
("Focus Customer Refund", "Inspect memory gap") while the suggested plan uses the bundle labels; the unit test
copies the `FIXTURE_IDS` regex rather than loading `swm-core.js`.

### Code gate verdicts (revision `f3522138f8f68cef94ec4da243bd3611c00957d6`, base `fbbdc64`)

- coder-deepseek (deepseek-v4-pro): IMPL-APPROVED
- reviewer-codex (gpt-5.5): IMPL-APPROVED
- PLANNER (claude): IMPL-APPROVED


## Deploy record (2026-10-04)

Pushed `5ee76ae` to `main` (fast-forward from `fbbdc64`); Vercel auto-deploy. Live read-back:
`swm/js/swm-coverage-insights.js` 200 `application/javascript`; `swm-core.js`, `swm.css`, `swm-loader.js` serve
the new build (the first fetch of `swm-core.js` hit a stale edge copy, then MISS → new). `COV-INS-*` + `E1` run
against `https://silex-mockup.vercel.app/index.html` (scratch copy of `probe-swm.mjs` with only `base` changed):
**7/7 pass**.
