# Enterprise World Model

The Enterprise World Model view, under SILEX Foundry, shows the four-layer ontology and how well it covers the enterprise. Three of its tabs are D3 panels over `swm/data/ontology.json`. Two are static, illustrative markup.

## Sub-features

- `wm-layers` shows the four layers, L1 to L4 (the default tab, *Ontology Layers*).
- `wm-graph` shows the animated Network view of the ontology (*Ontology Graph*).
- `wm-coverage` shows coverage arcs, and explains a low score on hover (*World Model Coverage*).
- `wm-suites` shows the domain packs (*Domain Suites*, static).
- `wm-gaps` shows recorded gaps (*Coverage Gaps*, static).
- `wm-benchmark-toggle` shows or hides the public benchmark runs in L4.

No journey covers the World Model yet. The steps below were read from the page on 2026-11-15 and are the starting point for one.

## How to get to it (user POV)

- Choose Enterprise World Model in the sidebar, under SILEX Foundry.
- Choose *Explore the world model* on the home page.
- Open `#view=security-model`, or a tab directly with `&tab=wm-architecture`, `wm-ontology`, `wm-overview`, `wm-landscape` or `wm-gaps`.

## Driving it with drive.mjs

- **Open.** `go('#view=security-model')`. The hash gains `&tab=wm-architecture`, and `#wmtab-architecture` has `aria-selected="true"`.
- **Switch tab.** `click('#wmtab-ontology')`, `click('#wmtab-overview')`, `click('#wmtab-landscape')` or `click('#wmtab-gaps')`. The chosen tab gets `aria-selected="true"` and the hash carries its `data-wm-panel` value.
- **Proof for a D3 panel.** Wait until the panel holds an `svg` with drawn children before `shot()`. A screenshot of an empty stage proves nothing.

## Gotchas

- The Network view animates. Run with reduced motion, or wait for it to settle, before comparing two screenshots.
- The bundle carries a 1-in-3 sample of the benchmark runs (346 of 946). Counts on the page come from the full set, so do not derive an expected count from the bundled rows.
- `tests/site/hero-kpis.test.mjs` reads the home page figures against the data files. A change to `data/onto-s1.json` needs that test and this view checked together.
