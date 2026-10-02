---
name: swm-simulation-data
description: "Author or regenerate the simulated (Silex-invented) content behind the SILEX Security World Model — domain packs, capabilities, workflows, agentic components, the runtime knowledge graph, coverage percentages and coverage gaps in swm/tools/silex-seed.mjs. Use when adding or renaming a domain, capability, workflow, component, runtime node or gap; when re-skinning the demo for another industry or customer; when coverage numbers or the radar need to tell a different story; or when a rebuild reports chain violations after a seed edit."
---

# The simulated half of the Security World Model

The bundle is two things welded together. The public nodes come from public ontologies (MITRE
D3FEND, ATT&CK, ATLAS, UCO, OWASP) and keep their real identifiers. Everything else is **invented
for the demo**, and it all comes from one file:

```
swm/tools/silex-seed.mjs
```

Everything in that file is illustrative: the five domain packs, their capabilities and workflows, the
thirteen agentic components, the whole runtime graph, every coverage percentage, every radar reading
and every gap. The build stamps them `src: silex` so the inspector can say so. **Keep that honesty
property** — never move invented content into a `src` that names a public source, and never invent an
identifier that looks like `AML.Txxxx`, `T1078` or `D3-…`.

## The loop

```bash
node swm/skills/swm-simulation-data/scripts/validate-seed.mjs   # invariants, before building
node swm/tools/build-ontology.mjs --offline                     # rebuild from cache (fast)
node swm/skills/swm-data-rebuild/scripts/verify-bundle.mjs       # what the page will actually get
node swm/skills/swm-data-rebuild/scripts/preview-panels.mjs      # look at it
```

`--offline` is the right flag while iterating on the seed: the public sources have not changed, so
there is no reason to re-download 60MB. Drop it for the final build.

## What each export drives

| Export | Lands as | Visible in |
|---|---|---|
| `GROUPS` | the eight L1 anchors; **glyph shape**, not colour, carries the group | rail chips, legend, every node |
| `LAYERS` | L1–L4 names and blurbs | level rail, layer bands, breadcrumbs |
| `DIMENSIONS` | the six radar axes | Coverage radar |
| `DOMAINS` | L2 packs → capabilities → workflows, plus entity types | sunburst rings, Explorer L2, Domain Suites copy |
| `AGENTIC_COMPONENTS` | L3 components, each specialising the L1 core class in `COMPONENT_ISA` | Explorer L3, layer band L3 |
| `RUNTIME` | L4 nodes and their typed edges | Explorer L4, inspector relations |
| `GAPS` | the gap list and its cross-filter | Coverage side panel |
| `OWASP_LLM`, `OWASP_AGENTIC` | published risks attached to the component they threaten | Explorer, expand a component |
| `GROUP_HINTS` | keyword → group for public and domain entities | which glyph a node gets |
| `CORE_L1` | the Silex L1 core: identity/authority, intent/provenance, actions, effects, states, objectives, controls, evidence, hazard root | Explorer L1, hierarchy, inspector |
| `ENTITY_ISA` / `COMPONENT_ISA` | the L1 class every L2 entity and every L3 component specialises | Explorer hierarchy parent |
| `DOMAIN_ACTIONS` | actions per pack, their effects (`MAY_CAUSE`) and workflows (`USED_IN`) | Explorer L2, competency checks |
| `PROHIBITED` | the prohibited outcomes and states, retyped effect/state | Explorer L2, outcome group |
| `DOMAIN_HAZARDS` | conditions joining entity/action, threat, control and evidence | Explorer L2, inspector |
| `RECORD_SCHEMAS` | telemetry schemas that record the evidence a hazard requires | Explorer L3 under `ag:trace` |
| `COUNTER_MAP` | threat → countermeasure mappings | Explorer, `COUNTERS` edges, uncountered list |
| `INCIDENT_HAZARDS` | incident → hazard fixtures | Explorer L4, competency check CQ5 |
| `CANDIDATE_DOMAINS` | CRM and Legal, ontology only, no coverage figures | Explorer L2 anchors |

Numbers matter beyond their labels:

- `capability.entities` and `workflow.entities` **size the sunburst arcs**; a domain's total is the
  sum of its capabilities.
- `coverage` (0–1) colours every arc and sets the hero number when that node is focused.
- `dims` gives the radar its reading **at that level**. A node without `dims` inherits its parent's,
  shifted by the coverage difference — which is why the radar changes as you drill.
- `component.instances` sizes graph nodes and fills "Runtime instances" in the inspector.

## Invariants the validator enforces

- ids are unique across domains, capabilities, workflows, components, runtime nodes and gaps;
- a workflow id looks like `WF-021` — the page cross-links on that shape;
- every `coverage` is a number in 0–1, and every `dims` carries exactly the six dimension ids;
- a runtime node's `type` is an L3 component id, **or** it names an explicit `parent` that is another
  runtime node (that is how incidents hang off the workflow they occurred in);
- a runtime node's `domain` is a real domain id, and both ends of every runtime link exist;
- a gap's `scope` entries are `'enterprise'` or real domain / capability / workflow ids — a typo here
  silently hides the gap, which is why it is checked;
- a gap's `action.kind` is one of `gap`, `libUnregistered`, `incident`, `workflow`, matching the
  delegated click handler in `index.html`;
- every OWASP entry targets a component that exists.

For the ontology-rigour exports it also enforces:

- every id resolves, and every predicate's source/target kinds fit `swm/tools/schema.mjs`;
- `ENTITY_ISA` covers every entity in all seven packs and `COMPONENT_ISA` all thirteen components;
- every L2 hazard has `characterizes`, `mitigatedBy` and `requiresEvidence`, every prohibited outcome
  is reached by a hazard, and no hazard relabels a prohibited outcome;
- every evidence a hazard requires is recorded by some `RECORD_SCHEMAS` entry;
- all 25 OWASP risks are in `COUNTER_MAP`, and the public ids it names exist in the built bundle;
- the core `SUBCLASS_OF` graph is acyclic.

## Recipes

**Add a workflow.** Append `{ id:'WF-0xx', name:…, coverage:…, entities:… }` to a capability's
`workflows`. It appears as an outer sunburst ring and an L2 node. If a gap should point at it, add
its id to that gap's `scope`.

**Add a capability.** Append to a domain's `capabilities` with `id`, `name`, `coverage`, `entities`,
`incidents`, `dims` and at least one workflow. The domain's entity total and weighted coverage
recompute themselves.

**Add a domain pack.** Append to `DOMAINS`. Needed: `id`, `name`, `code` (two letters), `coverage`,
`agents`, `workflows`, `incidents`, `pack`, `owner`, `dims`, `entities[]`, `capabilities[]`. Do **not**
put prohibited outcomes in `entities`: author them in `PROHIBITED` (retyped effect/state) instead. Add
an `ENTITY_ISA` entry for every entity, actions in `DOMAIN_ACTIONS`, and 3–5 `DOMAIN_HAZARDS`. See
`references/worked-example.md` for a full one, and `CANDIDATE_DOMAINS` for an ontology-only pack.

**Add an agentic component.** Append to `AGENTIC_COMPONENTS` with `id`, `name`, `group`, `coverage`,
`instances`, `blurb`, and add its `COMPONENT_ISA` entry naming the L1 `core` class it specialises.
Give it at least one runtime instance; a component with none gets no `DEPLOYED_IN` edge and is
labelled `deployment:'unobserved'` — correct behaviour, not a bug, but say so deliberately.

**Add a core concept.** Append to `CORE_L1` with `id` (bare), `label`, `group`, `kind` (a
`CORE_KINDS` value), `def` in your own words, and `parent` (another core id of a compatible kind, or
`grp:<group>` for a root). `relatedMatch` may point at public bundle ids.

**Add an action.** Append to `DOMAIN_ACTIONS[domainId]` with `isA` a core action, `mayCause` core
effects, `workflows` that exist, and `implementedBy` only a real `tool-reg` runtime node that truly
runs it.

**Add a hazard.** Append to `DOMAIN_HAZARDS[domainId]` with `hazardFor` (entity labels of that domain
or action ids), `characterizes` (a public technique/tactic/risk), `mitigatedBy` (a core control or a
D3FEND technique) and `requiresEvidence` (a core evidence). Add `mayLeadTo` a `PROHIBITED` id so the
prohibited outcome stays reachable, and make sure the label does not relabel that outcome.

**Add a prohibited outcome.** Append to `PROHIBITED[domainId]` with `kind` `effect` or `state`, `isA`
a core class of that kind, and a `def` justifying the retype. Its label must not appear in a hazard
label, and some hazard must reach it via `mayLeadTo`.

**Add a record schema.** Append to `RECORD_SCHEMAS` with `records` naming core evidence ids. Every
evidence a hazard requires must appear in some schema, so add a schema whenever you add new evidence.

**Add a counter-mapping.** Append to `COUNTER_MAP` with a `threat` L3 id (kind `technique` or `risk`),
a `control` (core control id or D3FEND technique id) and a short `note`. All 25 OWASP risks must stay
covered.

**Add runtime nodes.** Append to `RUNTIME.nodes`; set `type` to the component it instantiates, or
`parent` to another runtime node for incidents and outcomes. Wire behaviour with `RUNTIME.links`
triples `['source','target','PREDICATE']` in UPPER_SNAKE. The predicate shows verbatim in the
inspector, so pick words the demo narrative already uses (`DELEGATES_AUTHORITY`, `CALLS`, `MUTATES`,
`GOVERNS`, `GATES`, `REACHES`, `CONTRIBUTED_TO`).

**Add a gap.** Append to `GAPS` with `id`, `title`, `detail`, `severity`, `scope[]` and an `action`
(or `null` for "Later"). Severity uses the reserved status palette, so it also sets the icon.

**Re-skin for another industry.** Replace `DOMAINS`, `RUNTIME` and `GAPS` wholesale; keep `GROUPS`,
`LAYERS`, `DIMENSIONS`, `AGENTIC_COMPONENTS`, the OWASP tables and `GROUP_HINTS` — those are not
industry-specific. Then fix the four couplings listed below, and rebuild.

## Couplings outside the seed

Changing these ids without updating `index.html` breaks navigation, and `verify-bundle.mjs` checks
the first two:

| Id | Used by |
|---|---|
| `WF-021` (Customer Refund) | the demo story, the Workflow Library, `data-open-workflow` jumps |
| `I-1042` (refund loop incident) | the Incident Queue and a gap action |
| Domain names and codes | the Domain Suites tab, which is still authored markup |
| Gap `action.kind` values | the delegated `[data-gap] [data-lib-unregistered] [data-open-incident] [data-open-workflow]` handler |

## Keeping the story straight

The numbers are a narrative: HR is the weak domain (68%), Procurement's vendor data is unconnected,
Customer Service carries the refund incident, Identity & IT is the strongest. If you change a
percentage, change the gap and the copy that references it too — the demo's credibility comes from
those three agreeing. `index.html` repeats several of these figures as authored text, so grep for a
number before assuming the seed is the only place it lives.

## References

- `references/seed-schema.md` — every field of every export, with types and what it drives.
- `references/worked-example.md` — adding a Logistics domain end to end, and re-skinning the demo.
