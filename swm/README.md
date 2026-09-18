# Security World Model — Observatory

D3-based replacement for the **World Model Coverage**, **Security Ontology** and
**Ontology Layers** panels under *Security World Model* in [`../index.html`](../index.html).
Three panels, one shared abstraction level (`SWM.level`, `SWM.setLevel`, `SWM.onLevel`):
**L1 general → L2 domain → L3 agentic-system → L4 runtime**.

## The chain is a hard rule, not a drawing

Every node in the bundle names one `parent`, and `build-ontology.mjs` exits non-zero if any parent
sits more than one layer above its child. So the layers are a real chain rather than a picture of
one: an agentic component hangs under the domain pack it is actually deployed in (derived from the
runtime instances), a published ATLAS or OWASP threat hangs under the component it targets, and a
runtime node hangs under the component it instantiates. The Ontology Layers panel draws exactly that
— band counts and ribbon widths come from `ontology.chain`.

```
swm/
  css/swm.css              dark observatory canvas + light inspector chrome
  js/swm-core.js           colour scales, glyphs, tooltip, provenance chips, panel registry
  js/swm-loader.js         lazy-loads d3 + bundles the first time a panel is opened
  js/swm-ontology.js       Ontology Explorer  (graph / hierarchy / relation matrix)
  js/swm-coverage.js       Coverage Observatory (zoomable sunburst + contextual radar)
  js/swm-layers.js         Ontology Layers     (the L1→L2→L3→L4 chain, bands + ribbons)
  data/ontology.json|.js   generated graph: 598 nodes, 800 typed relations, plus a chain summary
  data/coverage.json|.js   generated coverage tree, gaps and KPIs
  data/SOURCES.md          where every public node came from, and its licence
  tools/build-ontology.mjs fetch + distil pipeline (node, no dependencies)
  tools/silex-seed.mjs     Silex's own L2/L3/L4 mock content
  vendor/d3.v7.min.js      pinned D3 7.9.0, so the demo also runs offline
```

## Rebuilding the data

```bash
node swm/tools/build-ontology.mjs            # fetch, distil, write data/
node swm/tools/build-ontology.mjs --offline  # rebuild from swm/.cache only
```

Raw downloads (~60MB, mostly ATT&CK) land in `swm/.cache/`, which is git-ignored.
Only the distilled bundles are committed, so Vercel needs no build step.

## What is real and what is mock

| Layer | Content | Source |
|---|---|---|
| L1 | Upper classes, digital-artifact tree, defensive techniques, enterprise tactics | UCO, MITRE D3FEND, MITRE ATT&CK — real identifiers, real definitions |
| L3 threats | AI/agent attack techniques and risk catalogues | MITRE ATLAS, OWASP LLM Top 10 (2025), OWASP Agentic AI T1–T15 |
| L2 / L3 components / L4 | Domain packs, agentic components, runtime graph, every percentage | **Silex mock content** — illustrative, marked `silex` in the inspector |

The threat → component and countermeasure → threat edges are Silex-authored mappings over
public data; they are labelled as such. See [`data/SOURCES.md`](data/SOURCES.md).

## Encoding decisions

The panels sit on a **white canvas**, and every ramp was re-validated with the dataviz palette
validator against `#ffffff`:

- **Abstraction layer** is ordinal, so it gets a single-hue blue ramp
  (`#86b6ef → #104281`, light end 2.11:1 on white) — passes monotone lightness, step gaps and
  surface contrast.
- **Coverage** gets its own teal ramp (`#5cc79e → #0e4c3a`, light end 2.08:1), same checks.
- **Text on a filled mark** is never guessed: `SWM.textOn()` picks white only when it clears 3:1
  against that mark, otherwise ink, and `SWM.haloOn()` adds the opposite-colour halo so a label
  survives landing on a boundary. Marks are drawn fully opaque so the measured colour is the
  colour on screen.
- **Status never tints body text.** `SWM.statusHtml()` renders a tinted icon beside a word on the
  normal ink token, which is what the reserved palette's sub-3:1 steps require.
- **Ontology group is carried by glyph shape, not colour.** Eight simultaneous hues cannot
  clear the all-pairs CVD floor in a node-link view, so the eight groups use eight D3
  symbols, listed with their shapes in the rail and in the legend.
- Status (critical / serious / warning / healthy) is a reserved palette and always ships
  with an icon and a word, never colour alone.

## Extending it

- New domain, capability, workflow, agentic component, runtime node or gap → edit
  `tools/silex-seed.mjs` and rebuild.
- New public source → add a fetcher + parser in `tools/build-ontology.mjs`, give its nodes
  a `src` entry, and record it in `SOURCES.md`.
- The two panels are registered by id (`wm-overview`, `wm-ontology`) through
  `SWM.register()`; a third panel only needs a mount point and one more `register` call.
