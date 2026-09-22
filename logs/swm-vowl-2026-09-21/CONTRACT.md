# Network view: frozen contract (T0, plan v0.2 §3.4 / §5)

This is the contract between T0/T1 (Claude: `swm-ontology.js`, `swm-core.js`, `index.html`, `swm-vowl.js`) and T2 (DeepSeek: `swm-vowl-ui.js`, `swm-vowl.css`). Change it only by agreement, and record any change here.

## Loading

- `index.html` loads `swm/css/swm-vowl.css` (a `<link>` after `swm.css`), then `swm/js/swm-vowl.js` and `swm/js/swm-vowl-ui.js` as `<script defer>` after `swm-loader.js`. The loader is untouched.
- **Neither file may touch `window.SWM` or `window.d3` at top level**, because both load before the lazy bundle. Each file registers a factory:
  - `window.SWM_VOWL = function (SWM, d3) { return engineApi; }` (T1)
  - `window.SWM_VOWL_UI = function (SWM, d3) { return uiApi; }` (T2)
- `swm-ontology.js` instantiates them on first Network use: `SWM.vowl = SWM_VOWL(SWM, d3)`, `SWM.vowlUI = SWM_VOWL_UI(SWM, d3)`. If either factory is missing, Network shows an honest empty state ("Network view unavailable") and the other views still work.

## Ontology state (owned by `swm-ontology.js`)

```
state.view      'network' (default) | 'graph' | 'tree' | 'matrix'
state.colorBy   'source' (default) | 'layer' | 'coverage' | 'status'
state.net = { minDegree: 0, subclass: true, compact: {1:true,2:false,3:false,4:false}, pickPin: true, pins: Set<id> }
state.selected  node id | null
state.edge      { s, t, pred, src } | null      ← the ONE edge shape everywhere
```

`snapshot()` / Back save and restore `state.net` (with the pins copied).

## Engine: `SWM.vowl` (T1)

```
filter(nodes, links, net)  → { nodes, links, deg: Map }   pure
    links are raw bundle links {s,t,pred,src}, restricted to the given nodes.
    Drops SUBCLASS_OF/SPECIALIZES when !net.subclass; degree counts the remaining links;
    drops nodes with degree < net.minDegree, then links that touch a dropped node. One pass.
render(ctx)   new generation (see "ctx" below). Runs plan §3.1 on a new or changed scopeKey;
              on a cached, rested scopeKey it restores positions instantly.
update(sel)   sel = { selected, edge, colorBy, query, matches }. Restyle only: no simulation, zoom or tick change.
key()         mounted scopeKey | null
scope()       { nodes, links } last mounted
pause(bool) · reset() · fit(ms?) · zoom(k) · zoomed(k) · locate(id) · resize(dims)
hide() · show() · destroy() · phase()   'prelayout'|'settling'|'paused'|'rest'|'hidden'|null
stats()       { nodes, tierNodes, relations, byPred:{PRED:n}, publicNodes, silexNodes, pinned, tier }
on(evt, fn)   'progress'(pct, text) · 'ready'(stats) · 'rest'() · 'zoom'(k) · 'pin'(stats) · 'pause'(bool) · 'phase'(p)
```

`locate(id)` called during pre-layout is deferred until `ready`.

### ctx

```
{ svg: d3 selection, layer: d3 selection <g class="swm-vowl"> (inside the zoomed root), zoom: d3.zoom,
  dims: {w, h}, nodes, links (raw, already filtered), deg, tier, tierNodes, byId, scopeKey,
  colorOf(n), tipHtml(n), aria(n), net: state.net, selected, edge, colorBy, query, matches: Set<id>,
  onSelectNode(id), onSelectEdge(rawLink), onPinsChanged() }
```

### DOM the engine draws in `ctx.layer`, and the classes CSS styles

- `g.vw-links > path.vw-link` (+ `.sub` for SUBCLASS_OF/SPECIALIZES, dashed with a hollow triangle), plus the classes `.hl` (incident to hover or selection), `.dim`, `.sel` (the selected edge).
- `g.vw-props > g.vw-prop` (full notation only) containing `rect` and `text`, with the classes `.hl`, `.dim`, `.sel`. It is clickable and selects the edge.
- `g.vw-nodes > g.vw-node` containing `circle.vw-body`, `path.glyph` and `text.vw-lab` (0–2 `tspan`), with the classes `.anchor`, `.hl`, `.dim`, `.sel`, `.match`, `.pinned`. The fill is set by the engine from `ctx.colorOf`, and the label fill from `SWM.textOn`.
- `g.vw-pin` (child of a pinned `.vw-node`): a small pin marker; clicking it unpins.
- `circle.vw-halo` (search locate): CSS animates it (three pulses); the engine removes it after about 2.4 s. It is not created under reduced motion.
- Markers `#vwArrow`, `#vwArrowHi` (filled) and `#vwTri`, `#vwTriHi` (hollow) are created by the engine in the svg `defs`.
- The layer gets the class `.vw-hidden` (opacity 0) during pre-layout and loses it at reveal. CSS supplies the fade (`transition: opacity .4s`, none under reduced motion).

## UI: `SWM.vowlUI` (T2)

```
mount(stageEl, host)  once per ontology init; builds, inside the stage:
   .vw-progress  (top-centre bar: role=progressbar, aria-valuemin/max/now, text from 'progress')
   .vw-live      (visually hidden aria-live=polite: "Layout ready: N nodes" on 'ready')
   .vw-bar       (bottom menu: Filter · Modes ▾ · Reset · Pause/Resume [aria-pressed])
   .vw-pop       (Modes popover: Pick & pin, Compact notation; aria-expanded on its button)
   .vw-zoom      (vertical slider labelled "Zoom", + / − / Fit)
   It subscribes to engine events itself (host.engine.on).
show(bool)            the ontology calls show(true) only while the Network view is active
statsHtml(stats)      → HTML for the inspector's "Statistics" <details> (the ontology inserts it)
host = { engine: SWM.vowl,
         getNet(): state.net,
         setNet(key, value): sets state.net[key] (for 'compact', the current tier's entry) and re-renders,
         openFilters(): opens the existing "Filters & colour" popover }
```

There is no colour picker in the UI: colour stays in the existing Filters & colour popover, which T0 extends with a "Network" section (a Minimum degree slider and a Subclass relations toggle) and a **Source** colour button.

## Colours (T0, in `swm-ontology.js` `colorOf`)

`source`:
- public-source node `#5563d6` (white label, contrast ≈ 4.9);
- Silex-authored node `#d9ccff` (dark label).

Anchor circles keep the ring `#b7a3ff`.

## Force constants (T1), plan §4

charge node −420 / label −120, distanceMax 420, theta .9 · link: 55 px per label half + radius (full), 90 px (compact), strength .9 · forceX .025, forceY .035 · collide r+3 / w/2 · alphaReveal .12, alphaMin .001, default alphaDecay · seeds: positions 1729, simulation 7.

## Changes recorded during integration (2026-09-21, before IMPL review R1)

1. **UI placement:** `mount()` inserts `.vw-ui` right **after `#swmCanvas`**, in normal flow. `.vw-row`, which holds `.vw-bar` and `.vw-pop`, is static, so the bar can never cover the legend or foot. Found at 1600 and 768, where the absolute bar overlapped the legend and the "Scroll sideways" hint. `.vw-progress` and `.vw-zoom` stay absolute overlays in the stage.
2. **Render while hidden:** a `render(ctx)` arriving while the panel is not shown (for example a tier change from Layers) draws but does not lay out. Its phase is `hidden`, and `show()` computes it to rest synchronously (plan §4 hide/return rule).
3. **Label threshold:** in-circle labels show when the on-screen radius is `r·k ≥ 12` (was 18 in plan v0.2 §3.3; the plan text is updated). At 18, L4 circles showed no labels at the fit zoom.
4. **Engine probe hooks:** `SWM.vowl._ticks` counts live simulation ticks (manual pre-layout ticks are not counted).
