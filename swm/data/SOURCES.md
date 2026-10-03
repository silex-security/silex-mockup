# Enterprise World Model — data sources

Generated 2026-10-02 by `swm/tools/build-ontology.mjs`.
Raw downloads are cached in `swm/.cache/` (git-ignored); only the distilled bundles are committed.

| Source | Fetched from | Licence / terms | Nodes kept |
|---|---|---|---|
| [MITRE D3FEND](https://d3fend.mitre.org/) | `https://d3fend.mitre.org/ontologies/d3fend.json` | MITRE D3FEND Terms of Use (free, attribution) | 213 |
| [MITRE ATLAS](https://atlas.mitre.org/) | `https://raw.githubusercontent.com/mitre-atlas/atlas-navigator-data/main/dist/stix-atlas.json` | Apache-2.0 / MITRE ATLAS Terms of Use | 96 |
| [MITRE ATT&CK Enterprise](https://attack.mitre.org/) | `https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json` | MITRE ATT&CK Terms of Use (free, attribution) | 61 |
| [Unified Cyber Ontology (UCO)](https://unifiedcyberontology.org/) | `https://github.com/ucoProject/UCO` | Apache-2.0 | 72 |
| [OWASP GenAI Security Project](https://genai.owasp.org/) | `https://genai.owasp.org/llm-top-10/` | CC BY-SA 4.0 | 25 |

## How the distillation works

- **D3FEND** — the `d3f:DigitalArtifact` subclass tree (breadth-first, documented classes first,
  capped) supplies the L1 inheritance backbone; `d3f:DefensiveTechnique` supplies policy/control semantics.
- **ATLAS** — the tactics join L1 as general agentic threat semantics; each technique sits at L3,
  attached to the agentic component it targets.
- **ATT&CK Enterprise** — the 14 tactics plus agent-relevant techniques (identity, credential, data,
  API, execution, exfiltration keywords) become L1 threat semantics.
- **UCO** — `core`, `action`, `identity`, `observable`, `tool` and `pattern` modules are parsed for
  `owl:Class` declarations with labels and definitions; they seed the L1 upper classes.
- **OWASP** — the LLM Top 10 (2025) and the Agentic AI threat taxonomy (T1–T15) are carried as
  published lists and attached to the agentic components they target.

## Layers, the display tree and subsumption

L1 general → L2 domain pack → L3 agentic system → L4 runtime instance are **presentation groups, not
taxonomic ranks**. Only `SUBCLASS_OF` asserts subsumption. Domain membership is `PART_OF_DOMAIN`,
deployment is `DEPLOYED_IN` and the eight L1 groups are navigation (`GROUPED_UNDER`). Every node
keeps one display `parent` (its `parentPred` is a tree predicate) for the Hierarchy view. The build
refuses to write a bundle if a link breaks its predicate signature or review grades
(`swm/tools/schema.mjs`), if the display tree or the `SUBCLASS_OF` graph has a cycle, or if a
display parent sits in a lower layer. `ontology.json` ships a `chain` summary with per-layer counts,
the relations between adjacent layers and the relations that skip a layer.

## Honesty note

Every node and link carries a `review` grade:

- `published`: structure from a public source; the node keeps its real identifier.
- `curated`: a Silex-authored semantic assertion. This covers the core L1 concepts, domain packs,
  actions, hazards, prohibited outcomes, record schemas, countermeasure mappings and OWASP targets.
- `heuristic`: keyword-mapped, i.e. which component an ATLAS technique threatens.
- `illustrative`: mock content. This covers registered workflows, the whole L4 runtime graph,
  everything derived from it (deployment, instances, incidents) and every coverage percentage.

CRM and Legal are candidate packs. They are ontology only and not part of the coverage figures.
