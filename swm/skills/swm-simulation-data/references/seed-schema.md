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

A component's parent is computed, not authored: it is the domain pack where most of its runtime
instances live, or `dom:horizontal` when it has none.

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
