# Enterprise World Model — what was built (2026-09-17)

Record of the work on the **Enterprise World Model** section of the mockup: the *World Model
Coverage*, *Ontology Graph* and *Ontology Layers* tabs. Everything below is live at
[silex-mockup.vercel.app](https://silex-mockup.vercel.app/); the code lives in
[`swm/`](swm/README.md), and the page keeps its single-file shell in `index.html`.

Planning and audit documents are archived in [`logs/`](logs/) — the step plan for this work is
[`logs/2026-09-17_SWM_OBSERVATORY_PLAN.md`](logs/2026-09-17_SWM_OBSERVATORY_PLAN.md).

---

## 1. The problem with the previous version

The three tabs were static markup: a hand-drawn SVG radar with six fixed numbers, a grid of eight
coloured tokens standing in for the ontology, and a tier diagram claiming that **L2 (domain) and L3
(agentic-system) intersect and neither instantiates the other**. Nothing could be drilled into,
nothing came from data, the "142 entity types" figure was typed by hand, and the layer relationship
as drawn was wrong.

## 2. What it is now

| Tab | What it does |
|---|---|
| **World Model Coverage** | Zoomable sunburst over Enterprise → Domain → Capability → Workflow. A six-dimension radar beside it **re-reads at whichever level is in focus**, KPIs come from the bundle, and the gap list cross-filters to the selected subtree while keeping its jumps into the Workflow Library, a workflow or an incident. A second mode recolours the ring by unmodelled share instead of coverage. |
| **Ontology Graph** | Four-layer explorer with three renderings of one graph: force layout (rings = distance from the group anchor), radial hierarchy, and a group × group relation matrix. Rail carries the layer selector, search, group filters and a *colour by* switch (layer / coverage / status). The inspector gives each node's definition, its real public identifier with a link, its coverage and its typed relations. |
| **Ontology Layers** | The four tiers drawn from the data: four bands with real counts, average coverage and group mix, ribbons as thick as the typed relations between adjacent tiers, and a caption for the relations that skip a tier. Clicking a band sets the shared abstraction level. |

All three share one abstraction level (`SWM.setLevel` / `SWM.onLevel`), so picking L3 in the Layers
tab leaves the Explorer already at L3, and vice versa.

## 3. Tiers, the display tree and subsumption (updated 2026-10-02)

The four tiers are **presentation groups, not taxonomic ranks**. The 2026-09-17 version enforced a
single chain, with every node's parent at most one tier up. That forced category errors: a domain pack was
written as a kind of *Workflow*, and each agentic component hung under one arbitrary domain. The
ontology-rigor run ([plan](logs/2026-10-02_SWM_ONTOLOGY_RIGOR_PLAN.md)) replaced it:

```
L1 General Agent Ontology Graph        448 nodes · avg coverage 74%
      ↕  278 relations with L2 (SUBCLASS_OF, GROUPED_UNDER, MAY_CAUSE, hazard links)
L2 Domain Ontology Packs               167 nodes · 78%
      ↕  36 relations with L3 (DEPLOYED_IN, CHARACTERIZES)
L3 Agentic-System Ontology             125 nodes · 60%
      ↕  22 relations with L4 (INSTANCE_OF)
L4 Runtime Knowledge Graph              24 nodes · 81%
      + 205 relations that skip a tier (e.g. an L3 component SUBCLASS_OF an L1 core class)
```

- **Only `SUBCLASS_OF` asserts subsumption.** Domain membership is `PART_OF_DOMAIN`, deployment is
  `DEPLOYED_IN`, and the eight L1 groups are navigation (`GROUPED_UNDER`).
- **Every predicate has a signature** (allowed node-kind pairs and review grades) in
  `swm/tools/schema.mjs`. The build refuses to write a bundle that breaks one, that has a cycle in
  the display tree or in the `SUBCLASS_OF` graph, or that hangs a node under a lower tier.
- **A domain pack is an L2 root.** Its entities, actions, hazards and prohibited outcomes hang under
  it with `PART_OF_DOMAIN`, and each also `SUBCLASS_OF` an L1 core class.
- **An agentic component is a kind of an L1 core class.** It is `DEPLOYED_IN` exactly the domains
  where the illustrative runtime graph has an instance of it. Short-term memory, sub-agent
  delegation and execution context have none, so they claim no deployment and are marked
  *unobserved*.
- **Hazards close a chain.** An L2 hazard is `HAZARD_FOR` an entity or action. It `CHARACTERIZES` a
  published threat, is `MITIGATED_BY` a control, `REQUIRES_EVIDENCE` of an evidence type, and that
  evidence is `RECORDED_BY` a telemetry record schema. Prohibited outcomes are effects or states that
  a hazard `MAY_LEAD_TO`, not business entities.
- **Every node and relation carries a review grade:** `published`, `curated` (Silex-authored
  assertion), `heuristic` (keyword-mapped) or `illustrative` (mock runtime and coverage). The
  inspector shows it.

## 4. Where the data comes from

`swm/tools/build-ontology.mjs` fetches five public sources, distils them, merges Silex's own seed
content and writes the bundles. Raw downloads (~60MB, mostly ATT&CK) are cached in `swm/.cache/`,
which is git-ignored; only the distilled bundles are committed, so Vercel needs no build step.

| Source | Kept | Role |
|---|---|---|
| [MITRE D3FEND](https://d3fend.mitre.org/) | 213 | The `d3f:DigitalArtifact` subclass tree gives L1 its inheritance backbone; `DefensiveTechnique` gives policy/control semantics |
| [MITRE ATLAS](https://atlas.mitre.org/) | 96 | Tactics join L1 as general agentic threat semantics; techniques sit at L3 on the component they target |
| [MITRE ATT&CK Enterprise](https://attack.mitre.org/) | 61 | 14 tactics plus agent-relevant techniques as L1 threat semantics |
| [UCO](https://unifiedcyberontology.org/) | 72 | Upper classes from `core`, `identity`, `action`, `tool`, `pattern`, `observable` |
| [OWASP GenAI](https://genai.owasp.org/) | 25 | LLM Top 10 (2025) and the Agentic AI threat taxonomy T1–T15 |

**Total: 764 nodes · 1387 typed relations; the browser payload `ontology.js` is about 569 KB (the 700 KB budget `verify-bundle.mjs` enforces).** 297 of those nodes are Silex-authored:
- the L1 core concepts, the L2 domain packs (two of them, CRM and Legal, are candidate packs outside
  the coverage figures), the L3 component list and record schemas — all graded `curated`;
- registered workflows and the whole L4 runtime graph, graded `illustrative`.

Every percentage is illustrative. The inspector shows each node's and relation's review grade;
public nodes keep their real identifiers so they can be checked. Provenance and licences:
[`swm/data/SOURCES.md`](swm/data/SOURCES.md).

Rebuild with `node swm/tools/build-ontology.mjs` (add `--offline` to rebuild from the cache).

## 5. The visual system

The section is **purple-dominant**, on a white canvas, with every ramp run through the dataviz
palette validator against `#ffffff`:

| Encoding | Ramp | Notes |
|---|---|---|
| Abstraction layer (ordinal) | violet `#b8a3ee → #50339c` | graph nodes, hierarchy, layer bands, ribbons, rail badges |
| Coverage (ordinal) | plum `#dfa0d5 → #54254f` | sunburst, radar, meters, relation-density matrix |
| Status (reserved) | `#0ca30c / #fab219 / #ec835a / #d03b3b` | always an icon **and** a word, never colour alone, never tinting body text |

Two decisions worth keeping:

- **The eight ontology groups are not colour-coded.** Eight simultaneous hues cannot clear the
  all-pairs colour-vision floor in a node-link view, so the group rides on **glyph shape** (circle,
  square, diamond, triangle, wye, cross, star, asterisk) with the shapes listed in the rail and the
  legend. Colour is reserved for the two ordinal variables.
- **Layer and coverage are a hue apart on purpose.** They are two sequential encodings behind the
  same *colour by* switch; sharing violet made both modes repaint the graph identically.

Text on a filled mark is never guessed: `SWM.textOn()` returns whichever of white and ink has the
higher measured contrast against that exact fill, and `SWM.haloOn()` adds a thin opposite-colour
halo. Every step of both ramps leaves its chosen text colour at **≥ 4.8:1**, and marks are drawn
opaque so the measured colour is the colour on screen.

## 6. Bugs found and fixed along the way

| Symptom | Cause |
|---|---|
| Every chart label rendered muted grey, no matter what the code picked | `.swm-stage text { fill: … }` in the stylesheet — a CSS declaration beats an SVG presentation attribute. The fallback is now scoped `text:not([fill])`. This was the real reason labels were unreadable |
| A white seam and a stack of outlined glyphs at twelve o'clock | Collapsed sunburst arcs and their labels were hidden with `fill-opacity`, which leaves the stroke painted. Both now use `opacity` |
| Arcs vanished after two consecutive drill-downs | Opacity was computed from the pre-transition frame instead of the target frame |
| "Open incidents: 34" at enterprise level | Incidents are recorded on both domains and capabilities; the sum counted them twice |
| "8 gaps inside Finance" when Finance has none | A fallback widened the scope filter to any ancestor; gaps are now strictly scoped to the focused node |
| ATLAS and OWASP entries unreachable in the graph | They had no hierarchical parent — only `THREATENS` edges — so no amount of expanding reached them. Fixed as part of the chain work |

## 7. File map

```
index.html                     unchanged shell; the three panels are mount points + a lazy loader
swm/README.md                  module documentation and how to extend it
swm/css/swm.css                white canvas, purple tokens, contrast rules
swm/js/swm-core.js             ramps, glyphs, contrast helpers, shared level bus, panel registry
swm/js/swm-loader.js           loads D3 + bundles the first time a panel is opened
swm/js/swm-coverage.js         Coverage Observatory
swm/js/swm-ontology.js         Ontology Explorer
swm/js/swm-layers.js           Ontology Layers chain
swm/data/ontology.json|.js     generated graph + chain summary
swm/data/coverage.json|.js     generated coverage tree, gaps, KPIs
swm/data/SOURCES.md            provenance and licences
swm/tools/build-ontology.mjs   fetch + distil + validate pipeline (node, no dependencies)
swm/tools/silex-seed.mjs       Silex's own L2/L3/L4 content
swm/skills/                    agent skills + scripts for rebuilding on another host
swm/vendor/d3.v7.min.js        pinned D3 7.9.0 so the demo runs offline
```

### Rebuilding somewhere else

`swm/skills/` packages the procedure so another host — or another agent — can regenerate the data
without reverse-engineering the pipeline. `swm-data-rebuild` covers prerequisites, the five-step
run, what a healthy build prints and what to do when an upstream URL moves; `swm-simulation-data`
covers the invented half of the bundle, with a field-by-field schema and a worked "add a domain"
example. Four dependency-free scripts back them: `check-sources.sh`, `validate-seed.mjs`,
`verify-bundle.mjs` and `preview-panels.mjs`, which renders all three panels in headless Chrome and
fails on a console error. All four exit non-zero on failure, so the sequence doubles as a CI job.

D3 and the ~350KB of bundles load only when one of the three panels is first opened, so the rest of
the demo keeps its original weight.

## 8. Commits

| Commit | Change |
|---|---|
| `38e7450` | Rebuilt World Model Coverage and Security Ontology as D3 observatories |
| `de66709` | Made the ontology layers one chain, L1 → L2 → L3 → L4, and enforced it in the build |
| `1511568` | Put the three panels on a white canvas |
| `bccc95a` | Fixed the CSS rule that was greying every chart label; coverage to violet |
| `09d619c` | Ontology graph and layer chain to violet, coverage to plum |

## 9. Known limits and obvious next steps

- **Naming is still pending technical alignment.** The tiers and the counts are settled; the final
  names of the four layers are not, and the tab keeps its TBD marker.
- **The Hierarchy view still files the L2 domain packs under the Workflow heading**, because the
  view arranges every tier by the eight L1 groups. The packs themselves are L2 roots, not kinds of
  Workflow (see §3).
- **Coverage percentages are authored, not computed.** The formula is TBD per the PRD; the panel is
  built so that swapping in real numbers is a data change, not a code change.
- Possible additions: overlaying the causal path of a chosen incident on the graph, a diff view
  between two bundle builds, and wiring the Domain Suites tab into the same shared level.
