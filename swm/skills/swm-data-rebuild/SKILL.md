---
name: swm-data-rebuild
description: "Rebuild the SILEX Security World Model data bundle (swm/data/ontology.* and coverage.*) from the public ontologies on any host — check the upstream sources, validate the simulated seed, run the distillation pipeline, verify the produced bundle, and screenshot the three panels headlessly. Use when moving the silex-mockup repo to a new machine, when a rebuild fails or a source URL moved, when the bundle looks stale or inconsistent with the page, or before committing regenerated data."
---

# Rebuilding the Security World Model data

The three *Security World Model* panels in `index.html` render from two generated bundles,
`swm/data/ontology.js` and `swm/data/coverage.js`. This skill rebuilds them from scratch on a host
that has never run the pipeline.

Run everything from the repository root.

## 0. Prerequisites

| Need | Why | Check |
|---|---|---|
| node ≥ 18 | the pipeline uses global `fetch`; no npm packages at all | `node -v` |
| node ≥ 22 | only for `preview-panels.mjs` (global `WebSocket`) | `node -v` |
| ~70MB free disk | raw downloads cached in `swm/.cache/` (git-ignored) | `df -h .` |
| Outbound HTTPS | `d3fend.mitre.org` and `raw.githubusercontent.com` | step 1 |
| Chrome/Chromium | only for the headless screenshot check | `CHROME=… ` to override |

Nothing is installed; there is no `package.json` and no lockfile by design.

## 1. Check the upstream sources

```bash
./swm/skills/swm-data-rebuild/scripts/check-sources.sh
```

Nine URLs must answer `200`: D3FEND, ATLAS, ATT&CK and six UCO modules. If any does not, do **not**
patch around it silently — read `references/troubleshooting.md`, which lists the known failure mode
and the fallback for each source. A moved URL is fixed in one place: the `SOURCES` map at the top of
`swm/tools/build-ontology.mjs`.

## 2. Validate the simulated seed

```bash
node swm/skills/swm-simulation-data/scripts/validate-seed.mjs
```

`swm/tools/silex-seed.mjs` holds everything the demo invents: the L2 domain packs, the L3 component
list, the whole L4 runtime graph, every percentage and every coverage gap. The build trusts it, so
validate it first — especially after editing. The companion skill **swm-simulation-data** explains
how to change it.

## 3. Build

```bash
node swm/tools/build-ontology.mjs            # fetch, distil, write swm/data/
node swm/tools/build-ontology.mjs --offline  # rebuild from swm/.cache only
```

A healthy run ends like this (counts drift as the upstream ontologies change — that is expected;
the shape is what matters):

```
  sources : d3fend 213 · atlas 96 · attack 61 · uco 72 · owasp 25
  graph   : 598 nodes (L1 370 · L2 86 · L3 118 · L4 24) · 800 links
  bundles : ontology 334KB · coverage 14KB
  chain   : L1→L2 43 · L2→L3 21 · L3→L4 22
  chain   : L1 → L2 → L3 → L4 verified, no layer skipped
```

**The build fails loudly on purpose.** If any node's parent sits more than one layer above it, the
script prints the offending nodes and exits non-zero rather than publishing a bundle whose layer
chain is a lie. Treat a non-zero exit as a stop, not a warning.

Sizes are controlled by four caps in the last third of `build-ontology.mjs`:
`artifactCap: 170` and `techniqueCap: 54` (D3FEND), `cap: 80` (ATLAS techniques), `cap: 46` with a
keyword filter (ATT&CK techniques), and `parseUco(ucoRaw, 72)`. Raising them grows the graph roughly
linearly; the panels stay readable to about 900 nodes, and the runtime caps visible nodes at 240 per
view regardless.

## 4. Verify the bundle

```bash
node swm/skills/swm-data-rebuild/scripts/verify-bundle.mjs
```

This re-derives the invariants instead of trusting the build: `.js` twins match their `.json`, no
dangling links, no duplicate ids, every node reachable from an anchor, the chain summary agrees with
the actual links, gap scopes exist in the coverage tree, the ids `index.html` cross-links to are
present (`wf:WF-021`, `rt-inc-1042`, `dom:finance`, `dom:horizontal`), and every public source
actually made it in. Exit code 1 means do not commit.

## 5. See it render

```bash
node swm/skills/swm-data-rebuild/scripts/preview-panels.mjs /tmp/swm-preview
```

Serves the repo on a loopback port, drives headless Chrome over the DevTools protocol, opens each of
the three panels, writes `coverage.png`, `ontology.png` and `layers.png`, and fails if a panel
renders no marks or the console reports an error. Look at the images: a bundle can be structurally
valid and still look wrong (labels colliding, a ring collapsing to nothing).

For a browser you can click through instead, serve the repo any way you like — e.g.
`python3 -m http.server 8777` — and open `http://127.0.0.1:8777/index.html`. The page also works
over `file://`, because the bundles are plain scripts that assign globals rather than `fetch`ed JSON.

## 6. Commit

Commit `swm/data/*.json`, `swm/data/*.js` and `swm/data/SOURCES.md`. Never commit `swm/.cache/`
(already git-ignored) and never hand-edit a bundle — the `.js` and `.json` twins must stay identical,
and `verify-bundle.mjs` checks that they do. Mention the new counts in the commit message; a rebuild
that changes node counts is a content change, not a no-op.

## What this pipeline will not do

- It will not invent public identifiers. Every node carries `src`; anything the demo made up is
  marked `silex` and says so in the inspector.
- It will not reformat the panels. Colour, layout and interaction live in `swm/css` and `swm/js`;
  the bundle only carries data.
- It will not upgrade D3. `swm/vendor/d3.v7.min.js` is pinned so the demo runs offline.

## Files

| Path | Role |
|---|---|
| `swm/tools/build-ontology.mjs` | fetch + distil + validate + write |
| `swm/tools/silex-seed.mjs` | the simulated content (see **swm-simulation-data**) |
| `swm/data/SOURCES.md` | regenerated each build: provenance, licences, distillation rules |
| `scripts/check-sources.sh` | probe the nine upstream URLs |
| `scripts/verify-bundle.mjs` | independent check of the built bundles |
| `scripts/preview-panels.mjs` | headless render of the three panels |
| `references/troubleshooting.md` | per-source failure modes and fallbacks |
