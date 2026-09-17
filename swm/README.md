# Security World Model — Observatory

D3-based replacement for the **World Model Coverage** and **Security Ontology** panels
under *Security World Model* in [`../index.html`](../index.html). Two panels, one shared
notion of abstraction: **L1 general → L2 domain → L3 agentic-system → L4 runtime**.

```
swm/
  css/swm.css              dark observatory canvas + light inspector chrome
  js/swm-core.js           colour scales, glyphs, tooltip, provenance chips, panel registry
  js/swm-loader.js         lazy-loads d3 + bundles the first time a panel is opened
  js/swm-ontology.js       Ontology Explorer  (graph / hierarchy / relation matrix)
  js/swm-coverage.js       Coverage Observatory (zoomable sunburst + contextual radar)
  data/ontology.json|.js   generated graph: 591 nodes, 769 typed relations
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

Run through the dataviz palette validator against the canvas surface `#131a30`:

- **Abstraction layer** is ordinal, so it gets a single-hue blue ramp
  (`#2f5c94 → #9cc6f7`) — passes monotone lightness, step gaps and surface contrast.
- **Coverage** gets its own teal ramp (`#17705a → #aeecd5`), same checks.
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
