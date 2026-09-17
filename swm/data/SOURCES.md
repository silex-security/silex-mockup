# Security World Model — data sources

Generated 2026-09-17 by `swm/tools/build-ontology.mjs`.
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

## The layer chain

Every node carries an explicit `parent`, and the build fails if a node's parent is not in the same
layer or exactly one layer above it. The chain is **L1 general → L2 domain pack → L3 agentic system
as deployed in that domain → L4 runtime instance**; `ontology.json` also ships a `chain` summary with
per-layer counts and the typed relations crossing each hop, which is what the Ontology Layers panel
draws.

## Honesty note

Nodes carry a `src` array naming where each one came from. Anything marked `silex` — the L2 domain
packs, the L3 component list, the whole L4 runtime graph, coverage percentages, and the
threat → component and countermeasure → threat mappings — is **illustrative mockup content**, not
published data. Public-ontology nodes keep their real identifiers so they can be checked.
