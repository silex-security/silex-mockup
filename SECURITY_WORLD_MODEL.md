# Enterprise World Model — what was built (2026-09-17)

Record of the work on the **Enterprise World Model** section of the mockup: the *World Model
Coverage*, *Ontology Graph* and *Ontology Layers* tabs. Everything below is live at
[silex-mockup.vercel.app](https://silex-mockup.vercel.app/); the code lives in
[`swm/`](swm/README.md), and the page keeps its single-file shell in `index.html`.

> **Current state (2026-10-03).** This record starts with the 2026-09-17 build; later changes are
> summarised here and in §8. The view now has five sub-tabs: *Ontology Layers* (the default since
> 2026-10-02), *Ontology Graph*, *World Model Coverage*, and two static tabs, *Domain Suites* and
> *Coverage Gaps*, which are plain markup in `index.html`. Since the 2026-09-21 visual upgrade the
> charts draw on a dark stage with white inspectors (§5), and the Ontology Graph opens on a
> WebVOWL-style **Network** view. How those were built: [`swm/BUILD_HISTORY.md`](swm/BUILD_HISTORY.md).

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
L1 General Agent Ontology Graph        547 nodes · avg coverage 74%
      ↕  388 relations with L2 (SUBCLASS_OF, GROUPED_UNDER, MAY_CAUSE, hazard links)
L2 Domain Ontology Packs               204 nodes · 78%
      ↕  52 relations with L3 (DEPLOYED_IN, CHARACTERIZES, EXEMPLIFIED_BY)
L3 Agentic-System Ontology             187 nodes · 60%
      ↕  431 relations with L4 (INSTANCE_OF, BELONGS_TO, IMPLEMENTS, EXHIBITS)
L4 Runtime Knowledge Graph              24 nodes · 81% (illustrative; plus 544 public benchmark-run nodes)
      + 1047 relations that skip a tier (e.g. an L3 component SUBCLASS_OF an L1 core class)
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

`swm/tools/build-ontology.mjs` reads five public sources, plus the domain-grounding sources below,
distils them, merges Silex's own seed content and writes the bundles. Every input is pinned to a
commit or versioned URL with its sha256 in `swm/tools/sources/MANIFEST.json`; the build refuses
changed bytes. Raw downloads (~60MB, mostly ATT&CK) are cached in `swm/.cache/`,
which is git-ignored; only the distilled bundles are committed, so Vercel needs no build step.

| Source | Kept | Role |
|---|---|---|
| [MITRE D3FEND](https://d3fend.mitre.org/) | 213 | The `d3f:DigitalArtifact` subclass tree gives L1 its inheritance backbone; `DefensiveTechnique` gives policy/control semantics |
| [MITRE ATLAS](https://atlas.mitre.org/) | 131 | Tactics join L1 as general agentic threat semantics; techniques sit at L3 on the component they target; 35 mitigations with ATLAS's own `COUNTERS` edges |
| [MITRE ATT&CK Enterprise](https://attack.mitre.org/) | 101 | 15 tactics plus agent-relevant techniques as L1 threat semantics, 7 identity techniques added for the Identity & IT pack, and 33 mitigations with ATT&CK's own `COUNTERS` edges |
| [UCO](https://unifiedcyberontology.org/) | 72 | Upper classes from `core`, `identity`, `action`, `tool`, `pattern`, `observable` |
| [OWASP GenAI](https://genai.owasp.org/) | 25 | LLM Top 10 (2025) and the Agentic AI threat taxonomy T1–T15 |
| [ATLAS case studies](https://atlas.mitre.org/studies) | 57 | Published cases (17 incidents, 40 exercises) as L3 `case` nodes that `DEMONSTRATES` the techniques they used |
| [ATT&CK campaigns](https://attack.mitre.org/campaigns/) | 2 | Reviewed campaigns (Operation Wocao, Leviathan) for the security-code hazard |
| [FIBO](https://spec.edmcouncil.org/fibo/), [Common Data Model](https://github.com/microsoft/CDM), [OCSF 1.9.0](https://schema.ocsf.io/) | 4 · 6 · 11 | Domain classes the Finance, Customer Service and Identity & IT entities are **aligned to** (`CLOSE_MATCH`), with CDM and OCSF attributes |
| [NIST SP 800-53 Rev. 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final) | 11 | Controls the Identity & IT hazards are mapped to (curated, no compliance claim) |
| AgentDojo, τ²-bench, Agent Security Bench, ToolEmu | 60 citations | Benchmark tasks, policy rules and scenarios cited on hazards and actions, each graded **derived** or **related** |

### Domain grounding (2026-10-03)

The Finance, Customer Service and Identity & IT packs are grounded in public sources
([plan](logs/2026-10-03_SWM_DOMAIN_GROUNDING_EXEC_PLAN.md)):

- **Standards.** Finance is **aligned to** FIBO and the Common Data Model, Customer Service to the
  Common Data Model, Identity & IT to OCSF. Alignment is `CLOSE_MATCH` (similar meaning, no subclass
  claim). Entities with no equivalent public class, such as *Customer*, *Refund* and *Role*, are
  listed as unmatched with the reason.
- **Benchmarks.** 21 hazards cite AgentDojo injection tasks, τ²-bench policy rules, Agent Security
  Bench scenarios or ToolEmu cases. A citation is **derived** when the source describes the harmful
  behaviour and **related** when it describes a neighbouring rule; then the mechanism is
  Silex-modelled. Benchmarks are research environments, not observed enterprise behaviour.
- **Public cases.** A hazard is `EXEMPLIFIED_BY` a case only for a reviewed pair with a written
  rationale (4 pairs). Cases are events elsewhere: never L4, never counted in coverage.
- **Mitigations.** Published ATLAS and ATT&CK mitigations raise the countered L3 threats from 45 to 73
  of 105. NIST controls are curated mappings.

Licence texts and attributions are in [`swm/data/NOTICES.md`](swm/data/NOTICES.md).

### L4 public benchmark runs (2026-10-03)

L4 now holds 24 illustrative + 544 benchmark nodes ([plan](logs/2026-10-03_SWM_L4_BENCHMARK_RUNS_PLAN.md)):
346 published runs, 135 incidents, 3 agents and 60 tools. The 346 runs are a sample of the 946 selected
runs: one in three per business pack, with all 135 incidents and every typical example kept
([sampling plan](logs/2026-10-04_SWM_L4_SAMPLING_PLAN.md)). Agent inspectors still report the full counts.
A *Public benchmark runs* toggle shows them; since 2026-10-04 it is on by default.
- **Finance and Identity & IT:** AgentDojo runs of Llama-3.3-70B-Instruct and Meta-SecAlign-70B (the same
  base model with a prompt-injection defence) under the `important_instructions` attack. AgentDojo's
  evaluator reported the injected goal as executed in 107 runs: banking 73 vs 14, Slack 16 vs 3,
  workspace 1 vs 0. This is a descriptive comparison, not a controlled measurement of the defence.
- **Customer Service:** all 456 τ²-bench retail runs of Claude 3.7 Sonnet; 28 runs contain an attempt the
  tool refused (refund to a non-original method; action on an order in the wrong state).
- **Evaluator success is not a hazard.** An incident `EXHIBITS` an L2 hazard only when a reviewed trace
  predicate matches a specific call or the tool refused a mapped attempt: 119 mappings across 118
  incidents (one τ² incident has two). 17 stay unmapped with the reason, e.g. three
  "successes" whose memo is only "Bill payment": AgentDojo's tasks 0, 1 and 3 count any transfer to the
  attacker as success.
- Benchmark nodes never feed deployment, coverage or the KPIs.

**Total: 1506 nodes · 5244 typed relations; the browser payload `ontology.js` is about 2.0 MB (about 160 KB compressed). `verify-bundle.mjs` caps each browser bundle at 10 MB, and a cold-load timing probe guards load time.** 291 of those nodes are Silex-authored with no public source:
- the L1 core concepts, the L2 domain packs (two of them, CRM and Legal, are candidate packs outside
  the coverage figures), the L3 component list and record schemas — all graded `curated`;
- registered workflows and the whole L4 runtime graph, graded `illustrative`.

Every percentage is illustrative. The inspector shows each node's and relation's review grade;
public nodes keep their real identifiers so they can be checked. Provenance and licences:
[`swm/data/SOURCES.md`](swm/data/SOURCES.md).

Rebuild with `node swm/tools/build-ontology.mjs` (add `--offline` to rebuild from the cache).

## 5. The visual system

The section is **purple-dominant**. The 2026-09-17 build drew on a white canvas; since the
2026-09-21 visual upgrade the charts draw on a **dark stage** (`#10162b → #26305a`) and inspectors
stay on white paper, so each ramp has a stage and a paper variant (`swm/js/swm-core.js`, mirrored in
`swm/css/swm.css`):

| Encoding | On the stage | On paper | Notes |
|---|---|---|---|
| Abstraction layer (ordinal) | violet `#ece5ff → #9b82ef` | `#50339c → #8e70d9` | graph nodes, hierarchy, layer bands, ribbons, rail badges |
| Coverage (ordinal) | pink `#e0569f → #f8e2ef` | plum `#b0529c → #471d43` | sunburst, radar, meters, relation-density matrix |
| Status (reserved) | `#0ca30c / #fab219 / #ec835a / #d03b3b` | same | always an icon **and** a word, never colour alone, never tinting body text |

Two decisions worth keeping:

- **The eight ontology groups are not colour-coded.** Eight simultaneous hues cannot clear the
  all-pairs colour-vision floor in a node-link view, so the group rides on **glyph shape** (circle,
  square, diamond, triangle, wye, cross, star, asterisk) with the shapes listed in the rail and the
  legend. Colour is reserved for the two ordinal variables.
- **Layer and coverage are a hue apart on purpose.** They are two sequential encodings behind the
  same *colour by* switch; sharing violet made both modes repaint the graph identically.

Text on a filled mark is never guessed: `SWM.textOn()` returns whichever of white and ink has the
higher measured contrast against that exact fill, and `SWM.haloOn()` adds a thin opposite-colour
halo. Marks are drawn opaque so the measured colour is the colour on screen; the measured contrast
of each ramp step is noted beside it in `swm-core.js`.

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
index.html                     view shell, sub-tabs, deep links, Domain Suites and Coverage Gaps;
                               the three D3 panels are mount points + a lazy loader
swm/README.md                  module documentation and how to extend it
swm/BUILD_HISTORY.md           how the 2026-09-21 visual upgrade and Network view were built
swm/css/swm.css                dark stages, white inspectors, purple tokens, contrast rules
swm/css/swm-vowl.css           Network view styles
swm/js/swm-core.js             ramps, glyphs, contrast helpers, shared level bus, panel registry
swm/js/swm-loader.js           loads D3 + bundles the first time a panel is opened
swm/js/swm-coverage.js         Coverage Observatory
swm/js/swm-ontology.js         Ontology Graph (network / graph / hierarchy / relations)
swm/js/swm-vowl.js             Network view engine (loaded by index.html, not the loader)
swm/js/swm-vowl-ui.js          Network view controls
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
example. Dependency-free scripts back them: `check-sources.sh`, `validate-seed.mjs`,
`verify-bundle.mjs` and `preview-panels.mjs`, which renders all three panels in headless Chrome and
fails on a console error; the 2026-10-02 ontology-rigor run added `competency.mjs`,
`check-copy.mjs` and `probe-swm.mjs`. Each exits non-zero on failure, so the sequence doubles as a
CI job.

D3 and the ~585KB of bundles (`ontology.js` ~570KB, `coverage.js` ~15KB) load only when one of the
three panels is first opened, so the rest of the demo keeps its original weight.

## 8. Commits

| Commit | Change |
|---|---|
| `38e7450` | Rebuilt World Model Coverage and Security Ontology as D3 observatories |
| `de66709` | Made the ontology layers one chain, L1 → L2 → L3 → L4, and enforced it in the build |
| `1511568` | Put the three panels on a white canvas |
| `bccc95a` | Fixed the CSS rule that was greying every chart label; coverage to violet |
| `09d619c` | Ontology graph and layer chain to violet, coverage to plum |
| `16409f1` … `cb3e9b8` | 2026-09-21: dark-stage visual upgrade and the Network view ([build history](swm/BUILD_HISTORY.md)) |
| `f3ec706` … `d47fb7d` | 2026-10-02: ontology rigor — tiers as presentation groups, predicate signatures, hazards, review grades, regenerated bundle ([plan](logs/2026-10-02_SWM_ONTOLOGY_RIGOR_PLAN.md)) |

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
