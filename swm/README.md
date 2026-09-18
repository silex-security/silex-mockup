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
  skills/                  agent skills + scripts for rebuilding on another host
  vendor/d3.v7.min.js      pinned D3 7.9.0, so the demo also runs offline
```

## Rebuilding the data

```bash
node swm/tools/build-ontology.mjs            # fetch, distil, write data/
node swm/tools/build-ontology.mjs --offline  # rebuild from swm/.cache only
```

Raw downloads (~60MB, mostly ATT&CK) land in `swm/.cache/`, which is git-ignored.
Only the distilled bundles are committed, so Vercel needs no build step.

### On a host that has never run this

The full procedure — prerequisites, what a healthy run looks like, and what to do when an upstream
moves — is packaged as two agent skills under [`skills/`](skills/README.md), which also read as plain
runbooks. Link them once per host (see that README) or just follow them.

```bash
./swm/skills/swm-data-rebuild/scripts/check-sources.sh         # 1. are the nine upstreams reachable?
node swm/skills/swm-simulation-data/scripts/validate-seed.mjs  # 2. is the simulated seed consistent?
node swm/tools/build-ontology.mjs                              # 3. build
node swm/skills/swm-data-rebuild/scripts/verify-bundle.mjs     # 4. verify what the page will get
node swm/skills/swm-data-rebuild/scripts/preview-panels.mjs    # 5. headless screenshots of all three panels
```

Requirements: node ≥ 18 (global `fetch`; node ≥ 22 only for the screenshot step), ~70MB of disk for
the cache, outbound HTTPS to `d3fend.mitre.org` and `raw.githubusercontent.com`, and a Chrome or
Chromium binary if you want step 5. No npm install, ever — there is no `package.json` by design.

Each script exits non-zero on failure, so the five lines above work as a CI job. Never hand-edit a
bundle: `verify-bundle.mjs` checks that `ontology.js` and `ontology.json` still agree.

### Changing the simulated content

The invented half of the bundle — domain packs, capabilities, workflows, agentic components, the
whole runtime graph, every percentage and every gap — lives in `tools/silex-seed.mjs`. Adding a
domain, wiring new runtime behaviour, retelling the coverage story or re-skinning the demo for another
industry is covered by [`skills/swm-simulation-data`](skills/swm-simulation-data/SKILL.md), with a
field-by-field schema in its `references/seed-schema.md` and a worked "add a Legal domain" example in
`references/worked-example.md`. Validate before building:

```bash
node swm/skills/swm-simulation-data/scripts/validate-seed.mjs [path/to/candidate-seed.mjs]
```

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

- **Abstraction layer** is ordinal, so it gets a single-hue violet ramp
  (`#b8a3ee → #50339c`, light end 2.21:1 on white) — passes monotone lightness, step gaps and
  surface contrast. Violet is the section's primary colour: the ontology graph, the hierarchy, the
  layer bands and the ribbons are all drawn from it.
- **Coverage** gets a plum ramp (`#dfa0d5 → #54254f`, light end 2.07:1), same checks. Layer and
  coverage are two sequential encodings the Explorer switches between, so they stay in the purple
  family but a hue apart — otherwise flipping "colour by" would repaint the graph in the same
  colours. Every step of both ramps leaves a text colour with at least 4.8:1 against it, which the
  earlier teal ramp's middle steps did not.
- **Text on a filled mark** is never guessed: `SWM.textOn()` returns whichever of white and ink has
  the higher measured contrast against that exact fill, and `SWM.haloOn()` adds a thin
  opposite-colour halo so a label survives landing on a boundary. Marks are drawn fully opaque so
  the measured colour is the colour on screen.
- **A CSS rule beats an SVG `fill` attribute**, so the stage's fallback text colour is scoped
  `text:not([fill])`. Without that, every contrast-picked label was silently repainted grey — which
  is exactly how the labels became unreadable in the first place.
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
