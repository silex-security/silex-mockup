# `silex-seed.mjs` — field reference

Every export, every field, and what it drives. Types are plain JS; `pct` means a number in `0..1`.

## `GROUPS` — the eight L1 anchors

| Field | Type | Notes |
|---|---|---|
| `id` | string | referenced by components, runtime nodes and `GROUP_HINTS` |
| `name` | string | shown in the rail, legend and inspector kicker |
| `glyph` | string | a `d3.symbol*` name: `symbolCircle`, `symbolSquare`, `symbolDiamond`, `symbolTriangle`, `symbolWye`, `symbolCross`, `symbolStar`, `symbolAsterisk`. **Shape carries the group; colour never does** |
| `blurb` | string | chip tooltip and anchor definition |

Eight is not arbitrary: eight simultaneous hues cannot clear the all-pairs colour-vision floor in a
node-link view, so the encoding is shape. Adding a ninth group means finding a ninth distinguishable
glyph, not a ninth colour.

## `LAYERS` — the chain

| Field | Type | Notes |
|---|---|---|
| `id` | 1–4 | the chain is fixed at four; the level bus and the band chart assume it |
| `key` | string | `general` / `domain` / `agentic` / `runtime` |
| `name`, `blurb` | string | level rail, layer bands, the side card in Ontology Layers |

## `DIMENSIONS` — the radar axes

`{ id, name }` × 6. `id` must match the keys used in every `dims` object. The radar geometry places
six axes; changing the count means changing `swm-coverage.js`.

## `DOMAINS` — L2 packs

| Field | Type | Drives |
|---|---|---|
| `id` | string | node id `dom:<id>`; referenced by runtime `domain` and gap `scope` |
| `name` | string | sunburst label, breadcrumb, Explorer node |
| `code` | string | two-letter badge (matches the Domain Suites tab) |
| `coverage` | pct | arc colour, hero number, weighted roll-up |
| `agents`, `workflows`, `incidents` | number | inspector facts; `incidents` is summed one level only |
| `pack`, `owner` | string | inspector facts, and the `src` label on its entity types |
| `dims` | `{6 × pct}` | the radar at domain level |
| `entities` | string[] | L2 entity types; each is mapped to a group by `GROUP_HINTS` |
| `capabilities` | array | see below |

### `capabilities[]`

| Field | Type | Drives |
|---|---|---|
| `id` | string | node id `cap:<id>`; usable in gap `scope` |
| `name` | string | sunburst ring 2 |
| `coverage` | pct | arc colour |
| `entities` | number | **arc size**; the domain's total is the sum of these |
| `incidents` | number | inspector fact |
| `dims` | `{6 × pct}` | the radar at capability level |
| `workflows` | array | ring 3 |

### `workflows[]`

`{ id: 'WF-0xx', name, coverage: pct, entities: number }`. The id shape is load-bearing: the page
cross-links workflows by id, and the sunburst labels the outer ring with the id alone.

## `AGENTIC_COMPONENTS` — L3

| Field | Type | Drives |
|---|---|---|
| `id` | string | node id `ag:<id>`; runtime nodes point at it via `type`; OWASP tables target it |
| `name` | string | node label |
| `group` | group id | glyph shape |
| `coverage` | pct | colour under "colour by coverage", inspector meter |
| `instances` | number | node size, "Runtime instances" |
| `blurb` | string | inspector definition |

A component's parent is computed, not authored: it is the L1 core class named by `COMPONENT_ISA`, and
its `DEPLOYED_IN` edges go to the domains of its runtime instances. A component with no runtime
instance gets no `DEPLOYED_IN` edge and a `deployment:'unobserved'` attribute instead (the inspector
shows it as "no runtime instance in the illustrative graph").

## `RUNTIME` — L4

### `nodes[]`

| Field | Type | Drives |
|---|---|---|
| `id` | string | used verbatim as the node id (prefix `rt-` by convention) |
| `name` | string | label |
| `group` | group id | glyph |
| `type` | component id | the L3 node it instantiates (`INSTANCE_OF`) |
| `parent` | runtime id | **instead of** `type` when it hangs off another runtime node (`OCCURRED_IN`) |
| `domain` | domain id | `BELONGS_TO` edge and the deployment tally that places its component |
| `coverage` | pct | colour under "colour by coverage" |
| `severity` | status key | incidents only: `critical` / `serious` / `warning` / `good` |
| `outcome` | string | outcomes only: `prohibited` / `legitimate` |
| `blurb` | string | inspector definition |

### `links[]`

Triples `[source, target, 'PREDICATE']`, both ends runtime ids, predicate UPPER_SNAKE. These are the
behavioural edges the inspector lists; they are not part of the layer chain.

## `GAPS`

| Field | Type | Drives |
|---|---|---|
| `id` | string | uniqueness only |
| `title`, `detail` | string | the card |
| `severity` | status key | chip colour **and** icon |
| `scope` | string[] | every coverage-tree id the gap belongs to: `'enterprise'`, a domain, a capability, a workflow. The gap shows when the focused node is in this list |
| `action` | `{label, kind, value}` \| null | button; `kind` ∈ `gap` \| `libUnregistered` \| `incident` \| `workflow`, mapping to the `data-*` handler in `index.html`. `null` renders a "Later" tag |

## `OWASP_LLM` / `OWASP_AGENTIC`

Triples `[id, label, componentId]`, e.g. `['LLM01','Prompt Injection','planner']`. The published list
is public; the **mapping to a component is Silex's**, and the build marks the edge accordingly. Keep
ids and titles verbatim from the OWASP publication — they are quoted in the inspector.

## `GROUP_HINTS`

Ordered `[groupId, RegExp]` pairs; **first match wins**. Used for every public class and every domain
entity type that does not carry an explicit group. Order matters: `threat` before `outcome` would
swallow "Impact", which is why the outcome pattern lists `prohibited` first and the ATT&CK Impact
tactic is special-cased in the build.

---

## Ontology-rigour exports

These were added by the 2026-10-02 ontology rigor plan. Their shapes and the predicate signatures
they must satisfy are frozen in `swm/tools/schema.mjs`; `validate-seed.mjs` checks every reference
and kind pair against that file. **Every id below is a bare Silex id** (no namespace prefix) unless
it points at a public node, which keeps its bundle id (`attack:T1078`, `d3f:d3f:Credential`,
`owasp:LLM06`, `atlas:AML.T0051`).

### `CORE_L1` — L1 Silex concepts

`[{ id, label, group, kind, def, parent, relatedMatch? }]`

| Field | Type | Notes |
|---|---|---|
| `id` | string | the bare id every other export references |
| `kind` | `CORE_KINDS` | `core` / `action` / `effect` / `state` / `control` / `evidence` / `objective` / `hazard` |
| `parent` | string | another core id (subsumption) or `grp:<group>` (navigation only) |
| `relatedMatch` | string[]? | public bundle ids; the target kind must be one `RELATED_MATCH` allows |

The id `financial-value-transfer` (effect) and `human-approval` (control) are looked up by name by
the competency questions, so keep them exactly. `core-control-dual-approval` is a `SUBCLASS_OF`
`human-approval` because it is two independent humans, so CQ2 treats it as a human-approval control.

`parent` asserts **definitional** subsumption: every instance of the child must necessarily be an
instance of the parent given the two definitions. A scope is not an authority, a purpose is not a
request, a registry is not a callable tool, and a compensation change is not a value transfer, so
those hang under `grp:<group>` instead. Add a general L1 class when several nodes need a shared
supertype (as `core-registry` and `core-connector` do for the tool-registry and MCP components).

### `ENTITY_ISA` — L2 entity → L1 class

`ENTITY_ISA[domainId][entityLabel] = coreId`, for **every** entity in `DOMAINS` and
`CANDIDATE_DOMAINS`. The key is the entity **label**, spelled exactly as in that pack's `entities`
array; the target must be a `core`-kind concept.

### `COMPONENT_ISA` — L3 component → L1 class

`COMPONENT_ISA[componentId] = coreId`, for all thirteen `AGENTIC_COMPONENTS`. The target must be a
`core`-kind concept; it becomes the component's display parent.

### `DOMAIN_ACTIONS` — per-domain actions

`DOMAIN_ACTIONS[domainId] = [{ id, label, isA, mayCause:[effect id], workflows:[WF id], implementedBy?:[rt id] }]`.
`isA` is a core action; `mayCause` are core effects; `workflows` must exist. `implementedBy` may only
name a real `tool-reg` runtime node (`rt-tool-refund`, `rt-tool-vendor`, `rt-db-vendor`, `rt-ledger`)
and only where it truly applies.

### `PROHIBITED` — prohibited outcomes and states

`PROHIBITED[domainId] = [{ id, label, kind:'effect'|'state', isA, def }]`. Holds the five former
`"(prohibited)"` entities (which are removed from `DOMAINS[].entities`). `isA` must be a core concept
of the same kind, and `def` explains the retype. No hazard label may equal or contain a prohibited
label.

### `DOMAIN_HAZARDS` — conditions that close a chain

`DOMAIN_HAZARDS[domainId] = [{ id, label, def, hazardFor, mayLeadTo?, characterizes, mitigatedBy, requiresEvidence }]`.

- `hazardFor`: entity labels of that domain, or action ids of that domain.
- `characterizes`: public threat ids of kind `technique`, `tactic` or `risk`.
- `mitigatedBy`: core control ids (kind `control`) or public D3FEND technique ids (kind `countermeasure`).
- `requiresEvidence`: core evidence ids (kind `evidence`).
- `mayLeadTo` (optional): prohibited ids; every prohibited outcome must be reached by at least one hazard.

All three of `characterizes`, `mitigatedBy` and `requiresEvidence` are required, so every L2 hazard
closes the principle-3 chain.

### `RECORD_SCHEMAS` — telemetry schemas

`[{ id, label, def, records:[evidence id] }]`, six to eight of them, hanging under `ag:trace`. Every
evidence id referenced by any hazard must appear in some `records` list.

### `COUNTER_MAP` — threat → countermeasure

`[{ threat, control, note }]`. `threat` is an L3 threat id (kind `technique` or `risk`); `control` is
a core control id or a public D3FEND technique id. All 25 OWASP risks must be covered, plus every
ATLAS technique that can be justified honestly; `note` says why. The note must describe protection
the referenced control's `def` actually provides — a value ceiling bounds money moved, not resource
overload, so rate/volume threats use `core-control-rate-limit` and review-queue flooding uses
`core-control-review-throttle`.

### `INCIDENT_HAZARDS` — incident → hazard

`[{ incident, hazard }]`, both existing ids. Becomes an `EXHIBITS` edge graded `illustrative`.

### `CANDIDATE_DOMAINS` — ontology-only packs

`[{ id, name, code, pack, owner, entities, capabilities:[{ id, name, workflows:[{ id, name }] }] }]`.
No coverage figures. Their entities still need `ENTITY_ISA`, and their actions and hazards are
authored exactly like the existing packs'.

### Validation

```bash
node swm/skills/swm-simulation-data/scripts/validate-seed.mjs [seed.mjs]
```

It resolves every id, checks every kind pair against `schema.mjs`, proves the hazard chain complete,
checks the anti-relabel rule and evidence coverage, and rejects duplicate or colliding ids.
