# SWM Ontology: WebVOWL-style animated Network view (plan v0.2)

Author: Claude (lead) · 2026-09-21 · Status: **v0.2 — APPROVED by all three seats (round 2: DeepSeek PLAN-APPROVED, Codex PLAN-APPROVED, Claude PLAN-APPROVED). See §8–§9.**
Branch: `swm-vowl-network`, cut from `swm-visual-upgrade` @ `8ec7346` (**BASE**). Private; not pushed, not merged.
Request: *"研究 https://sepses.ifs.tuwien.ac.at/onto/index-en.html 的 demo 动画，最大程度做成它 demo 的动画效果。"*

## 1. What the reference demo actually does (researched, not guessed)

The SEPSES page is a Widoco document. Its overview section embeds **WebVOWL 1.1.7** (`webvowl/index.html`, MIT, © 2014-2019 Link, Lohmann, Marbach, Negru, Wiens) rendering the *Agentic AI Ontology* (26 classes, 74 properties). I downloaded the app and read `webvowl.js`; I also ran it locally and interacted with it. The animation has these parts:

| # | Behaviour | How WebVOWL does it (source) |
|---|---|---|
| A1 | **Hidden pre-layout plus progress bar** | Graph container `opacity 0`; the force ticks off-screen while a bar shows `Generating visualization … NN%`, computed as `200·(1−10·alpha)` (`hiddenRecalculatePositions`, l.4925) |
| A2 | **Reveal, then visible settle** | At roughly half cooling the container snaps to `opacity 1` and `force.resume()`, so the viewer watches the graph drift and breathe into place |
| A3 | **VOWL notation** | Classes are circles with the label inside; external classes are dark blue with white text. Every property is a rectangle label that is **itself a force node** (a link is split into two link parts through its label), which gives the curved, floating look. `subClassOf` is a dashed line with a hollow triangle; datatypes are yellow boxes |
| A4 | **Force constants** | charge −500 (labels ×0.8), gravity 0.025, linkStrength 1, class distance 200, datatype distance 120 (options l.12549) |
| A5 | **Drag = reheat + pick-and-pin** | Dragging reheats the force and neighbours follow elastically. With *Pick & pin* on, the node stays pinned with a pin marker; click the pin to release |
| A6 | **Hover and focus** | Hover highlights the node, its incident links and property labels; a click focuses it and fills *Selection Details* in the sidebar |
| A7 | **Bottom menu** | Search (locate: animated zoom to the hit plus a pulsing halo), Export, **Filter** (degree-of-collapsing slider, subclass / datatype / set-operator toggles), **Options** (distances), **Modes** (pick & pin, compact notation, colour externals), **Reset** (re-layout), **Pause** |
| A8 | **Zoom control** | Vertical zoom slider with + / − and a centre button; wheel zoom with a 150 ms transition |
| A9 | **Sidebar** | Title, IRI, version, Description, Metadata, **Statistics** (counts), Selection Details |

Reference capture: `logs/swm-vowl-2026-09-21/webvowl-ref-loading.png` (A1 phase). The settled graph was inspected live; the reference pages stay out of the repo.

## 2. Feasibility spike (already run, on our real bundle)

`logs/swm-vowl-2026-09-21/spike.html` is a throwaway D3 **v7** reimplementation of A1–A5 on `swm/data/ontology.js`, measured in headless Chrome at 1200×720, seeded:

| Tier | Nodes | Relations | Sim nodes (with label nodes) | Pre-layout to reveal | Settle | Render p95/frame |
|---|---|---|---|---|---|---|
| L1 full notation | 370 | 362 | 732 | 242 ms | 207 frames, 2.9 s | 1.0 ms · tick interval p95 25.5 ms |
| L1 compact | 370 | 362 | 370 | 77–111 ms | 207 frames, 2.9 s | 0.8 ms · 25.8 ms |
| L2 | 86 | 80 | 166 | 33–38 ms | 207 frames, 2.9 s | 0.5 ms · 26.1 ms |
| L3 | 118 | 105 | 223 | 47 ms | 207 frames, 2.8 s | 0.4 ms · 26.0 ms |
| L4 | 24 | 28 | 52 | 9–28 ms | — | — |

"Render" times only the DOM position update. The **tick interval** (time between successive live ticks, which includes force computation and browser frame pacing) is flat at about 26 ms across tiers, so headless frame pacing sets it, not our work. Force computation per tick is about pre-layout ms ÷ 93 ticks, so **≈ 2.6 ms at L1 full**. This is evidence that the work fits a frame, not proof of smoothness; the implementation gates in §4 are what count.

Frames: `spike-l_1_compact.png`, `spike-l_2.png`, `spike-l_3.png`, `spike-l_4.png`. **Conclusion:** the effect is affordable at every tier, in both notations. The spike is not production code: it has no accessibility, integration or claim text.

## 3. What we build

A new **Network** view in the Security Ontology tab, beside Graph / Hierarchy / Relations, and made the **default view**. It **adapts** A1–A9 to the SWM bundle. The deliberate omissions are: VOWL datatype boxes and set operators (the bundle has none), **Export** (the SVG/JSON download is not part of the demo story), and the **Options** distance sliders (force constants are pinned in the contract so the performance gates stay reproducible).

### 3.1 Animation sequence (A1, A2)
1. **Enter / tier change / Reset:** the graph layer is `opacity 0`. A stage-top bar reads **"Laying out 86 nodes · 80 relations … NN%"** (L4: "Laying out 24 illustrative runtime instances · 28 relations …"), with NN taken from real cooling progress: `log(alpha)/log(alphaReveal)`, `alphaReveal = 0.12`. Ticks run in ≤ 12 ms chunks (`setTimeout`), so the bar moves and the page stays responsive.
2. **Honest pacing:** the bar only reports computation. If the layout finishes in under 450 ms, the bar's CSS width transition (≤ 450 ms) completes the fill. **No artificial delay is added to the layout, and no text claims we are loading or streaming enterprise data.**
3. **Reveal:** the layer fades in over `SWM.dur(400)`, fit-to-view is applied, and the bar fades out.
4. **Visible settle:** the simulation continues live from `alpha 0.12` to `alphaMin 0.001` (about 3 s), then **stops**, so no timer runs after rest.
5. **Return to a settled tier:** the cached positions render instantly, with no replay (the same rule as the approved T3).

### 3.2 VOWL visual grammar mapped to SWM (A3)
**Terminology:** records are called **nodes** everywhere (bar, live region, statistics, counts). L1–L3 nodes are ontology classes; **L4 nodes are illustrative runtime instances**, and the L4 kicker keeps the existing Schema vs World State wording. The circle is a visual adaptation used for both.
- **Node** = a circle. Radius is `10 + 4√degree`, capped at 26; group anchors are 30 with a ring. The label is inside, wrapped to two lines and truncated with the full text in the tooltip and inspector. **The group glyph is drawn small inside the circle**, so "groups ride on shape" (approved plan §2 / P3) still holds.
- **Fill** follows the existing colour modes (tier / coverage / status) plus a new **Source** mode, which is the Network default. It is the VOWL *external* analogue: **public-source nodes (467) are dark indigo with white text, and Silex-authored nodes (131) are light violet**, taken from each node's `src[0].sys`. This is real bundle data.
- **Relation** = a predicate label box (`subclass of`, `threatens`, `achieves` …) that is its own force node, drawn as a quadratic curve through the label.
  - `SUBCLASS_OF` / `SPECIALIZES` are dashed with a hollow triangle.
  - Every other relation is solid with a filled arrow.
  - Label boxes use the paper palette with `SWM.darkText`, which meets contrast.
- **Not replicated: VOWL datatype boxes (yellow) and set operators.** The bundle has no datatype properties or set operators, and we do not invent them. The About text says so.
- **Compact notation:** L1 starts compact (no label nodes; predicate shown on hover or selection). L2–L4 start in full notation. The Modes toggle switches either way (the spike shows 732 sim nodes is affordable).

### 3.3 Interaction (A5–A8)
- **Drag:** sets `alphaTarget(.3)` and restarts, so neighbours follow elastically; on release `alphaTarget(0)` lets the simulation cool and stop again. **Pick & pin** is on by default: a dragged node stays pinned with a small pin marker, and clicking the marker (or pressing `Enter` on a focused pinned node's "Unpin" action in the inspector) releases it.
- **Hover:** highlights the node, its incident relations and labels, and its neighbours; everything else dims to 25 %. **Click** selects: an accent focus ring plus the existing inspector node card (Selection Details). Clicking a label box selects the edge and opens the existing edge card (source → target, predicate, `src` provenance).
- **Bottom stage bar** (VOWL menu analogue). **There is exactly one filter/colour control on screen:**
  - **Filter** = the *existing* "Filters & colour" popover (T0). In Network it gains a "Minimum degree" slider (0 … tier max; collapses low-degree nodes) and a "Subclass relations" toggle, and its colour list gains **Source**. The group chips stay where they are. The bottom-bar Filter button simply opens that popover.
  - **Modes** popover (T2): Pick & pin, Compact notation. No colour picker here.
  - **Reset:** unpins all, re-seeds and replays §3.1.
  - **Pause / Resume** (`aria-pressed`): pause freezes the simulation; resume reheats to 0.3.
- **Zoom:** a vertical slider with + / − and a Fit (crosshair) button, synced with wheel and pinch zoom through `d3.zoom`; range 0.2–4.
- **Search locate:** the existing toolbar search (all 598 nodes, tier switch on pick) now, in Network view, animates zoom-to-node (`SWM.dur(650)`) and a **pulsing halo** (three pulses, CSS), as WebVOWL does.
- **Statistics** (A9): a disclosure at the top of the default inspector card, with **real counts in scope**: nodes shown / in tier, relations by predicate, public vs Silex-authored nodes, pinned count.
- **L1 legibility (not a hairball):** L1 opens compact, with degree-scaled radii and anchor rings; member labels inside circles are drawn only when the circle radius is ≥ 12 px on screen at the current zoom, and colliding labels are dropped. At 1366 and 768 the three seats judge the L1 frame as clustered and legible, not a hairball (V15).

### 3.4 Integration contract (T0 freezes it; answers Codex R1 #1)

- **Ownership of the SVG and zoom.** `swm-ontology.js` keeps owning `svg`, `gRoot` and the single `d3.zoom`. In Network, `render()` hands the engine a dedicated `<g class="swm-vowl">` inside `gRoot` plus the zoom instance. The engine applies zoom only through `svg.call(zoom.transform, …)`. The ontology's zoom handler forwards `k` to `SWM.vowl.zoomed(k)` for slider sync.
- **Two render paths, keyed by scope.** `scopeKey = tier | groups | minDegree | subclass | compact`.
  - When `render()` runs in Network with the **same** `scopeKey` as the mounted engine (select, edge select, hover, colour change, query), it does **not** clear the SVG, reset the zoom or touch the simulation. It calls `SWM.vowl.update({selected, edge, colorBy, query})`, which only restyles.
  - Only a **changed** `scopeKey`, Reset, or entering Network calls `SWM.vowl.render(ctx)`, which is a new generation with the §3.1 sequence.
  - Positions and pins are cached per `scopeKey`, so returning to a settled scope does not replay.
- **Effective scope reaches every surface.** Filtering is the engine's pure `SWM.vowl.filter()`, which the ontology calls in `netScope()`; `SWM.vowl.scope()` echoes the mounted scope (the `'scope'` event was dropped in CONTRACT.md as redundant). The ontology sets `current = {nodes, links, network: true}` from it before `renderChrome()` / `renderList()` / `renderInspector()`, so the header, accessible list, Statistics and bar counts all derive from the same arrays.
- **Options live in ontology state.** `state.net = {minDegree, subclass, compact, pickPin, pins:Set}` belongs to the ontology `state`. `snapshot()` and Back save and restore it, and the engine reads it from `ctx.state`. Network pins are separate from Graph's `state.pinned` cap pins.
- **Edge selection without a node.** `renderInspector()` gains an edge-only card: when `state.edge` is set and no node is selected, it shows source → target, predicate, `src` provenance and "no execution evidence". In Network, clicking a label box sets `state.edge` and leaves `state.selected` unchanged.
- **Keyboard route to relations.** In Network, the accessible list appends a **"Relations of <selected node>"** group: one button per incident relation in scope, which selects that edge. This is bounded by degree; the label boxes are not tab stops.
- **Leaving Network** for Graph, Hierarchy, Relations or the Example calls `SWM.vowl.destroy()`. The Example flow is unchanged and still enters from any view.

### 3.5 Unchanged
- Graph / Hierarchy / Relations views, the fail-closed runtime **Example** (the 9-node lanes), tiers shared with Layers, search semantics, Layers / Coverage / Domain Suites / Gaps, and data / vendor / loader / tools.

## 4. Constraints

- **Claims:** the view renders only the bundle (598 nodes / 800 links). The view is named **"Network"**, never "Live", because nothing is runtime telemetry. Coverage colours stay labelled *illustrative*, and progress text describes layout computation only.
- **Licence:** a clean reimplementation in D3 v7. **No WebVOWL code, CSS or assets are copied.** The Ontology About text credits the notation and interaction model: "Network view notation adapted from VOWL (Lohmann et al.); interaction model inspired by WebVOWL (MIT)." There is no WebVOWL branding.
- **Motion:**
  - Everything runs through `SWM.dur()`.
  - **Reduced motion:** no bar animation; the layout is computed synchronously to rest and rendered once; no halo pulse; drag moves only the dragged node, with no reheat.
  - **Lifecycle and cancellation** (answers Codex R1 #2). The engine has one generation counter `gen` and a phase: `prelayout | settling | paused | rest | hidden`.
    - Every async callback (pre-layout chunk `setTimeout`, watchdog, reveal / zoom / locate transitions, halo pulse end) captures `gen` and returns if it is stale.
    - All timer ids are stored and cleared. Transitions are `interrupt()`ed; halo elements are removed.
    - The generation increments on tier or scope change, Reset, `destroy()` (leaving Network), and hide.
  - **Hide / return:**
    - Hiding the tab or section (`SWM.onPanel`) in any phase stops the simulation, cancels the chunks and the watchdog, and marks the phase `hidden`.
    - On return, an unfinished layout (pre-layout or settling) is **computed to rest synchronously** and rendered final, with no bar replay.
    - A layout that was `paused` returns still paused, at the same positions.
  - **Pause** freezes positions until Resume. The simulation is stopped and the watchdog disarmed. A drag while paused moves only the dragged node, with no reheat.
  - **Watchdog.** It is armed only while `phase === 'settling'`, the view is visible, and `gen` is current. If `end` has not fired 6 s after reveal (rAF starved or throttled), it ticks synchronously to rest. It never fires while paused, hidden or destroyed.
- **Accessibility:**
  - The progress bar is `role=progressbar` with `aria-valuenow`, and an `aria-live` region announces "Layout ready: N nodes".
  - Nodes are keyboard-focusable under the existing rule (anchors always; every node when the tier has ≤ 60 shown), with Enter / Space to select.
  - Popover buttons have `aria-expanded`, toggles `aria-pressed`, and the slider has a label.
  - The existing accessible node list remains the text equivalent.
- **Performance gates** (headless Chrome, dev Mac, probe-measured). Milestones:
  - **shell** = Ontology panel and progress bar visible;
  - **ready** = graph revealed and interactive (the reveal fade has started; clicks and drags work);
  - **rest** = the simulation's `end`.

  Gates:
  - shell median ≤ BASE cold median + 150 ms (BASE 452 ms);
  - **ready ≤ 1,200 ms worst-case cold at L1 compact** (20 runs);
  - pre-layout ≤ 300 ms at L1 compact and ≤ 500 ms at L1 full;
  - per-tick JS work (force computation plus DOM update) p95 ≤ 8 ms at L1 full;
  - live tick-interval p95 at L1 full ≤ 1.25 × the L4 interval p95 in the same run (frame pacing normalised);
  - rest ≤ 4.5 s after ready;
  - **no `tick` for ≥ 1 s after `end`**.
- **Force constants (pinned in `CONTRACT.md`, taken from the measured spike, not from WebVOWL's v3 values).** D3 v7 `forceManyBody` differs from v3 `charge`, so WebVOWL's −500 / 0.025 / 1 do not transfer.
  - charge: node −420, label −120, `distanceMax` 420, `theta` 0.9;
  - link: 55 px per label half plus radius (full) or 90 px (compact), strength 0.9;
  - `forceX` 0.025, `forceY` 0.035; collide r+3 for nodes, w/2 for labels;
  - `alphaReveal` 0.12, `alphaMin` 0.001, default `alphaDecay`;
  - seeds: positions 1729, simulation 7.
- **Byte budget** (new, separate from the finished 50 KB upgrade budget), growth over BASE `8ec7346`:
  - `swm/js/swm-vowl.js` ≤ 22,000 B
  - `swm/js/swm-vowl-ui.js` ≤ 9,000 B
  - `swm/css/swm-vowl.css` ≤ 4,000 B
  - integration edits to `swm-ontology.js` + `index.html` + `swm-core.js` ≤ 3,000 B
  - **total ≤ 38,000 B.** This is cumulative with the finished 50,000 B upgrade budget (≈ 88 KB of JS/CSS growth over `16409f1` in total); neither figure is the site total.
- **Layout:**
  - 1600 / 1366: no overlap between the bottom bar, zoom slider and legend.
  - 768: the bottom bar wraps inside the stage, popovers stay within the viewport, and the page never overflows horizontally.

## 5. Tasks, owners and file ownership

Everyone must not touch files outside their list; report needed changes instead.

| T | Owner | Files (exclusive) | Work | Acceptance |
|---|---|---|---|---|
| **T0** foundation | claude | `swm/js/swm-ontology.js`, `swm/js/swm-core.js`, `index.html` | The `Network` view button (default); all of §3.4, including the two render paths, `state.net` in snapshot / Back, the effective-scope hand-off, the edge-only inspector card, the "Relations of" list group, and the Filters & colour additions (degree slider, subclass toggle, Source colour); script and CSS tags; stub `swm-vowl.js`, `swm-vowl-ui.js` and `swm-vowl.css`; the frozen **engine API contract** plus force constants in `logs/swm-vowl-2026-09-21/CONTRACT.md`. Committed privately **before** dispatch | `node --check` passes; view switching works with stubs; T3's adapted regression suite passes for Graph / Hierarchy / Relations / Example |
| **T1** engine | claude | `swm/js/swm-vowl.js` | §3.1–3.3 engine: scope and filters, simulation with label nodes, render, reveal / settle / stop, drag and pin, hover and focus, pause / reset, zoom, locate halo, visibility, reduced motion, watchdog, stats | Probes V1–V10 |
| **T2** controls + style | deepseek | `swm/js/swm-vowl-ui.js`, `swm/css/swm-vowl.css` | The bottom stage bar, Filter / Modes popovers, zoom slider, Statistics disclosure and progress-bar markup, all via the engine API only; the visual styling of §3.2 (circle / label / link / halo / pin / bar classes) | Probes V11–V14; no overlap at 1600 / 1366 / 768 |
| **T3** probes + perf | codex | `/private/tmp/swm-vowl-20260921/probe.mjs` (an adapted copy of the old harness) and `/private/tmp/swm-vowl-20260921/probe-vowl.mjs` (scratch; not committed) | (a) **Regression split** (answers Codex R1 #3): every old Graph-specific assertion (the default 240 L1 nodes, successive expansions ≤ 240, Example → Reset → Back = 240, performance "240 then stable after 1 s") first **selects Graph explicitly** and keeps its original numbers and stability checks unchanged; only the "default view" assertion moves to Network. (b) A CDP suite for V1–V16 plus the §4 gates, on a scratch copy, reporting through `document.title` | T0: (a) green. Final revision: (a) + (b) green |
| **T4** log | claude | `logs/2026-09-21_SWM_VOWL_IMPLEMENTATION.md`, `logs/README.md` | Round records and literal verdicts | — |

**Engine API contract (T0 freezes it):**
```
SWM.vowl.render(ctx)   // new generation; ctx: {svg, layer:<g>, zoom, dims, nodes, links, tier, byId, colorOf,
                       //   state (incl. state.net), scopeKey, onSelectNode(id), onSelectEdge(rawLink), onScope()}
SWM.vowl.update(sel)   // same scopeKey: restyle only {selected, edge, colorBy, query}; no sim/zoom change
SWM.vowl.key()         // mounted scopeKey or null
SWM.vowl.scope()       // effective {nodes, links} after minDegree / subclass filters
SWM.vowl.pause(bool) · .reset() · .fit() · .zoom(k) · .zoomed(k) · .locate(id) · .stats() · .phase()
SWM.vowl.hide() · .show() · .destroy()   // lifecycle of §4; hide/show are called from SWM.onPanel
SWM.vowl.on(evt, fn)   // 'progress'(pct) 'ready'(stats) 'rest'() 'scope'() 'zoom'(k) 'pin'(stats) 'pause'(bool)
                       // Options change via the ontology: set state.net.* then render()
```

## 6. Acceptance probes

- **V1:** entering Ontology shows Network by default; the bar is visible with 0 < pct ≤ 100; the graph layer has opacity 0 until `ready`.
- **V2:** at `ready`, L1 has 370 node circles and 362 relations; L2 has 86 / 80, L3 118 / 105 and L4 24 / 28; L2 has 80 label boxes; L1 has 0 label boxes (compact).
- **V3:** after `end`, no `tick` fires for ≥ 1 s; the simulation's alpha is below alphaMin.
- **V4:** a synthetic drag moves the node and its neighbours; pick & pin leaves `fx/fy` set with a pin marker; unpin clears it.
- **V5:** hover dims non-neighbours; click fills the inspector with that node; clicking a label box **before any node is selected** opens the edge-only card with the real predicate and provenance. Node select, edge select and colour change **preserve every node position, the zoom transform and the pins** (compared before and after) and fire no new `tick`.
- **V6:** Pause stops ticks (`aria-pressed=true`) and Resume restarts them; Reset unpins and replays the bar.
- **V7:** search "prompt injection" → tier L3, and the zoom transform centres `atlas:AML.T0051`; the halo element exists, and is absent under reduced motion.
- **V8:** a minimum degree of 3 hides exactly the nodes with degree < 3; turning Subclass off removes every SUBCLASS_OF / SPECIALIZES relation. **The scope header, accessible list, Statistics and circles all report the same counts.**
- **V9 (lifecycle):**
  - Hiding during **pre-layout** and during settle stops all ticks and chunks; returning shows the rested layout with no bar replay.
  - **Pause for 8 s:** no tick and no position change (the watchdog stays silent); Resume restarts.
  - Rapid L1 → L2 → L3 tier changes and Network → Graph → Network within 300 ms: only the last generation renders, and no stale `progress` / `ready` fires.
  - After leaving Network, no `tick` or timer callback fires for 2 s.
  - A rAF-starved run is snapped to rest by the watchdog.
- **V10:** reduced motion gives the final state immediately, with no transitions.
- **V11:** Colour → Source gives public-source nodes the dark fill and Silex-authored ones the light fill, with counts 467 / 131 across tiers; only one colour control exists in the DOM.
- **V12:** the zoom slider, wheel and Fit stay in sync.
- **V13:** the Statistics numbers equal the counts recomputed from the bundle.
- **V14:** no overlap or overflow at 1600 / 1366 / 768; keyboard reaches every control; focus is visible.
- **V15:** L1 Network screenshots at 1366 and 768 are judged legible and clustered by all three seats; no text is drawn over other text.
- **V16 (copy):**
  - No user-visible Network string says "class" for a count.
  - L4 shows "illustrative runtime instances" and the Schema / World State wording.
  - The bar and live region say "nodes".
  - The About text carries the VOWL / WebVOWL credit and the omissions list.
- **Regression:** the adapted `probe.mjs` (T3a) passes every mode (Graph with its 240 cap and stability selected explicitly, Hierarchy, Relations, Example, Layers, Coverage, navigation, cold gaps). Network intentionally supersedes the old default only; no Graph check is weakened.

## 7. Process

1. This plan goes to DeepSeek and Codex with byte-identical prompts. Revise until all three reply **PLAN-APPROVED**.
2. T0 is committed privately, then T1 / T2 / T3 run in parallel.
3. Integration, then the frozen `git diff 8ec7346` (hashed) goes to all three seats. Revise until all three reply **IMPL-APPROVED**; any code change means a re-review by every seat.
4. Commit on `swm-vowl-network`. **No merge or push without the user's explicit go-ahead** (the SWM upgrade deploy question is still open).

## 8. Round-1 disposition

| Seat | Verdict | Disposition in v0.2 |
|---|---|---|
| DeepSeek | PLAN-APPROVED (4 non-blocking) | Readiness milestones defined (§4 shell / ready / rest); L1 legibility rule and V15; one colour control (Filter = existing popover, Modes has none; V11); force constants pinned to the measured spike set (§4, CONTRACT) |
| Codex #1 | integration contract | New §3.4: SVG and zoom ownership, the two render paths keyed by `scopeKey`, the effective-scope hand-off, `state.net` in snapshot, the edge-only inspector card, the "Relations of" keyboard list; V5 and V8 extended |
| Codex #2 | cancellation / watchdog | §4 lifecycle: generation counter, phases, timer and transition cancellation; Pause freezes; the watchdog is scoped to visible settling; V9 extended |
| Codex #3 | regression split | T3a adapts the harness: Graph checks select Graph explicitly, keeping 240 and stability; only the default moves to Network |
| Codex #4 | "class" terminology | "nodes" everywhere; L4 = illustrative runtime instances; V16 |
| Codex non-blocking | L1 full measurement, adapted not complete, absolute ready max | §2 re-measured (tick interval, per-tick work); omissions stated in §3; ready ≤ 1,200 ms worst-case gate |

## 9. Round-2 record

- Plan hash reviewed: `7f11c9fd812470724c1f1f4202098c20729c8239`.
- **DEEPSEEK: PLAN-APPROVED · CODEX: PLAN-APPROVED · CLAUDE: PLAN-APPROVED.**
- Non-blocking notes folded in afterwards (wording and metadata only, no scope change):
  - "Layout ready: N nodes";
  - the budget is cumulative.
- Notes to carry into the contract and implementation:
  - V5 measures zero position change from rest or pause; during settling, selection must not restart or replace the simulation.
  - T3a runs alongside T0.
  - Spike intervals should be timed start-to-start. The ÷93 per-tick figure is an estimate; the §4 gates govern.
  - `update()` takes the ontology's `state.edge` shape `{s,t,pred,src}`, frozen in CONTRACT.md.
