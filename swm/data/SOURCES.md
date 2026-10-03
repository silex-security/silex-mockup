# Enterprise World Model — data sources

Generated 2026-10-03 by `swm/tools/build-ontology.mjs`.
Raw downloads are cached in `swm/.cache/` (git-ignored); only the distilled bundles are committed.

| Source | Fetched from | Licence / terms | Nodes kept |
|---|---|---|---|
| [MITRE D3FEND](https://d3fend.mitre.org/) | `https://d3fend.mitre.org/ontologies/d3fend/1.6.0/d3fend.json` | MITRE D3FEND Terms of Use (free, attribution) | 213 |
| [MITRE ATLAS](https://atlas.mitre.org/) | `https://raw.githubusercontent.com/mitre-atlas/atlas-navigator-data/6f66878fc7571c3ae2bb129cfd160568688b4a0c/dist/stix-atlas.json` | Apache-2.0 / MITRE ATLAS Terms of Use | 131 |
| [MITRE ATT&CK Enterprise](https://attack.mitre.org/) | `https://raw.githubusercontent.com/mitre-attack/attack-stix-data/6cda5ad8462c79e14fbb872f4e09059b18e0cfc4/enterprise-attack/enterprise-attack.json` | MITRE ATT&CK Terms of Use (free, attribution) | 101 |
| [Unified Cyber Ontology (UCO)](https://unifiedcyberontology.org/) | `https://github.com/ucoProject/UCO/tree/7ebb3957e9e9a2e1bb9c66cd1ede8c912a726344` | Apache-2.0 | 72 |
| [OWASP GenAI Security Project](https://genai.owasp.org/) | `https://genai.owasp.org/llm-top-10/` | CC BY-SA 4.0 | 25 |
| [MITRE ATLAS case studies (ATLAS 5.6.0)](https://atlas.mitre.org/studies) | `https://github.com/mitre-atlas/atlas-data/blob/3259f388d19cbcca11bacf12a0ef97f4198f711b/dist/ATLAS.yaml` | Apache-2.0 | 57 |
| [MITRE ATT&CK campaigns and mitigations (Enterprise 19.2)](https://attack.mitre.org/campaigns/) | `https://github.com/mitre-attack/attack-stix-data/tree/6cda5ad8462c79e14fbb872f4e09059b18e0cfc4` | MITRE ATT&CK Terms of Use (free, attribution) | 2 |
| [EDM Council FIBO](https://spec.edmcouncil.org/fibo/) | `https://github.com/edmcouncil/fibo/tree/9a7b90ccc64e` | MIT | 4 |
| [Microsoft Common Data Model](https://github.com/microsoft/CDM) | `https://github.com/microsoft/CDM/tree/dd21d715e05e` | CC-BY-4.0 (extracted and truncated) | 6 |
| [Open Cybersecurity Schema Framework 1.9.0](https://schema.ocsf.io/) | `https://github.com/ocsf/ocsf-schema/tree/1.9.0` | Apache-2.0 (with NOTICE) | 11 |
| [NIST SP 800-53 Rev. 5 (OSCAL catalog 5.2.0)](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final) | `https://github.com/usnistgov/oscal-content/tree/78650f02ad93` | US public domain + CC0 1.0 | 11 |
| [AgentDojo (banking, slack, workspace)](https://agentdojo.spylab.ai/) | `https://github.com/ethz-spylab/agentdojo/tree/089ed468cf3e` | MIT | 26 |
| [τ²-bench (retail, banking_knowledge)](https://github.com/sierra-research/tau2-bench) | `https://github.com/sierra-research/tau2-bench/tree/5bfa7e37b366` | MIT | 15 |
| [Agent Security Bench (ASB)](https://github.com/agiresearch/ASB) | `https://github.com/agiresearch/ASB/tree/544540ff0788` | MIT | 10 |
| [ToolEmu](https://toolemu.com/) | `https://github.com/ryoungj/ToolEmu/tree/ac4a7ab7ed8c` | Apache-2.0 | 9 |

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

## Domain grounding (Finance, Customer Service, Identity & IT)

Plan `logs/2026-10-03_SWM_DOMAIN_GROUNDING_EXEC_PLAN.md`. Every input below is pinned to a commit or a
versioned URL in `swm/tools/sources/MANIFEST.json` with its sha256; the build refuses changed bytes.
Licence texts and attributions are in `NOTICES.md`.

- **Domain standards.** Finance entities are **aligned to** FIBO and the Common Data Model, Customer
  Service entities to the Common Data Model, Identity & IT entities to OCSF, with `CLOSE_MATCH`
  (skos:closeMatch: similar meaning, no subclass claim). Entities with no equivalent public class are
  listed as unmatched with the reason, not hidden.
- **Benchmarks.** Hazards and actions cite AgentDojo injection tasks, τ²-bench policy rules and
  documents, Agent Security Bench scenarios and ToolEmu cases. Each citation is graded **derived** (the
  source describes the harmful behaviour) or **related** (a neighbouring rule or behaviour; the
  mechanism is Silex-modelled). Benchmarks are research environments, not observed enterprise
  behaviour. ASB scenarios are generated descriptions without an executable check; ToolEmu cases are
  potential failure scenarios for LLM-emulated tools.
- **Public cases.** ATLAS case studies (incidents and exercises, typed as such) and a reviewed set of
  ATT&CK campaigns are L3 `case` nodes that `DEMONSTRATES` the techniques they used. They are events
  elsewhere: never L4, never counted in coverage. A hazard is `EXEMPLIFIED_BY` a case only for a
  reviewed pair with a written rationale.
- **Published mitigations.** ATLAS and ATT&CK mitigations enter as L1 countermeasures with the
  publisher's own `COUNTERS` edges, graded published. NIST SP 800-53 controls enter as L1 controls;
  which hazard a control mitigates is a curated mapping, not a compliance claim.
- **Endpoint rule.** A published case or mitigation edge is linked only to a technique id that is in
  the bundle; other references stay on the node as `refs`.

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
