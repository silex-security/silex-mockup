# Fleet ontology in the Ontology tab: role, relation graph and files — plan v0.5

Date: 2026-10-11. Branch `fleet-ontology-graph`, base `47562d2` (origin/main). Status: **plan v0.3 + v0.5 amendment approved unanimously; implementation approved unanimously (code review round 3); merged and deployed (see Deploy record)**.
v0.2 answered the eight blocking objections of round 1; v0.3 answers round 2's one (tables in *Review record*).

## Goal

On `#view=runtime-observation&tab=fleet`, the ontology is what lets the simulated fleet stop a problem whose pieces sit
with different agents: each scripted call carries a slice of **declared typed facts** (who manages whom, what a video may
be used for, where a pool syncs to), typed rules read those facts, and `OWNED_BY_TEAM` routes each stopped call to the
team that owns it. Today that role is explained only in tips and prose on the fleet tab, the candidate pack
`swm/data/packs/creator-platform.json` is a bare link, and the per-call facts live inside a vendored JS module. This
change brings that role into the **Ontology** tab, draws the ontology as an explorable **relation graph**, and lists
**every ontology-related JSON file** on the site, one row and one raw link per file.

Out of scope: the measured sub-tabs (How types help, Pre-registered test, Example runs) beyond the scoped notes below;
the vendored engine (read only); the Enterprise World Model view and `swm/data/ontology.json` (read only, byte-identical);
the pack (read only; `creator-pack.test.mjs` unchanged).

## Evidence grade and wording (applies to every new string)

- The two new sub-tabs are **simulated**: the vendored engine, a fictional tenant (Acme Shorts) and a **candidate** pack
  outside the site's coverage figures. Each new sub-panel shows its own visible grade line, `data-onto-fleet-grade`:
  "Simulated engine · fictional tenant · candidate pack, outside the coverage figures. Not the measured result in the
  first sub-tabs."
- The tab-level note `[data-rt-onto-nojudge]` ("…No judge model is used here.") is true only of the measured sub-tabs,
  and the fleet engine runs the simulated judge. It becomes, by sub-tab **name** (badges can shift if `onto-s1.json` is
  absent): "How types help, Pre-registered test and Example runs: the same alert rule, with and without ontology types,
  on real held-out agent runs. <span data-rt-onto-nojudge>No judge model is used there.</span> In the agent fleet and
  Graph & files: the ontology the simulated agent fleet runs on." The case-sensitive probe `/No judge model/` matches the
  hooked span. The tab keeps its `Measured` chip (`data-kind="ran"`) and gains a second chip beside it, `data-kind="sim"`,
  "Simulated · fleet sub-tabs", so neither chip depends on how many measured sub-tabs exist.
- **The X1 mechanism, stated as it is.** The engine evaluates each trace independently; no runtime linking of traces
  happens. The shared facts are *declared context* present in each call's slice; what a *trace-only* monitor lacks is
  those facts, not another agent's trace. Every place that describes X1 in the new sub-tabs carries, as visible text,
  the three limits the fleet tab already states (`js/rt-fleet-x1.js`): "The chain comes from declared typed facts, not
  from linking traces at runtime." "Each check is evaluated on its own." "In a real run, the hold at the first step means
  the later calls never happen." Hook `[data-onto-fleet-limits]`.
- Every number in the new sub-tabs is computed at page load from the pack JSON, the vendored engine or the generated
  files list (nothing typed in). Scenario labels are the author's, not a benchmark. No "verdict", "pass", "certified",
  "detects", "guarantee" in new text. No real company, brand or product names; `no-real-brand.test.mjs` gains the new
  files (T1, T3).

## What the visitor gets

Two sub-tabs appended to the Ontology tab's bar (default stays `how`, so existing links and tests hold):

**In the agent fleet** (`sub=fleet`, hint "What the ontology does for six agents"). Three jobs, each with a computed
figure and an example from the model:

1. *Gives each call the declared facts its trace lacks* — "N triples across M checked calls" (78 across 30), and the X1
   chain's decisive facts (video FEATURES a minor; advertising EXCLUDES minors; hot pool SYNCS_TO ad candidates) from
   `model.x1[].on.triples`, followed by the three limits above.
2. *Typed rules read those facts* — the eight creator rules: id, BLOCK/HOLD, the predicates it read (derived from the
   engine's `facts.creator.used`, plus "declared complete: …" for `COMPLETE_FOR`), and the risky traces it stopped with
   the slice versus trace only.
3. *Routes each stop to the owning team* — stopped calls per reviewing team via `OWNED_BY_TEAM`, with the slice versus
   trace only (`fleetModel().queues`: 10 versus 0).

Links (all `data-wm-route`, like every in-page route, so they work when the hash already equals the target): "See it run
in the Agent fleet tab →" (`#view=runtime-observation&tab=fleet`) and "Explore the graph →"
(`#view=runtime-observation&tab=ontology&sub=graph`).

**Graph & files** (`sub=graph`, hint "The pack, each call's facts, every JSON file"):

- **Schema mode** (default). Nodes: the pack's 39 classes, its 5 teams, the 14 L1 concepts of `swm/data/ontology.json`
  the pack specialises (toggle, on), and **attribute boxes** (VOWL datatype style) for the pack's literal-valued
  predicates. Links: the 30 typed relations (10 are `OWNED_BY_TEAM`, role `owned`), styled by grade (declared solid,
  observed dashed, inferred dotted); `SUBCLASS_OF` (toggle, on); and one `attribute` link per attribute box.
  Attribute boxes: for each predicate whose range is `literal` other than `COMPLETE_FOR`, one box per domain kind,
  attached to each class of that kind whose superclass is not of the same kind (so `REQUIRES_VERIFICATION` attaches to
  `pack:ReviewableAction` once, not to its ten subclasses). That gives 10 boxes (EXPIRES 1, STATUS 2, REFUNDED_USD 1,
  LIMIT_USD 3, SPENT_USD 1, VERIFICATION_LEVEL 1, REQUIRES_VERIFICATION 1); the model computes them, the test checks
  them against the pack. `COMPLETE_FOR` is a statement about a list ("this subject's X list is complete"), applies to
  almost every kind, and is not drawn as boxes; it appears in the predicate strip.
  **Predicate strip**: one chip per pack predicate (27), `[data-graph-pred="<P>"]`, marked relation / attribute / meta,
  with its domain → range kinds on hover. **Rule picker**: two independent flags. `data-hi="true"` goes on the chips of
  the rule's `predicates` and on every relation link and attribute box with one of those predicates; `data-complete="true"`
  goes on the chips of the rule's `complete` list (the predicates its `COMPLETE_FOR` triples declared complete) and on
  every relation link with one of those predicates. A chip can carry both (HAS_SCOPE for `mcn_payout_scope`,
  LICENSED_UNDER for `asset_license`). Every one of the eight rules lights at least one chip and at least one link or box
  by either flag; `cross_principal_read`, which reads only `COMPLETE_FOR`, lights the MANAGES and HAS_SCOPE links by
  `data-complete`.
  **Inspector** (click, or Enter on a focused node): id, label, kind, superclass, incoming/outgoing relations,
  attributes, rules that read its predicates, and for an L1 concept "Open in the Enterprise World Model →" (a
  `data-wm-route` button to `#view=security-model&tab=wm-ontology&node=<id>`, an existing route).
- **Facts mode**: a trace picker (22) and a **call picker** for that trace's pre_tool calls (30 calls in all; SD1b has
  two, SD2b three; ten of the eleven risky traces are stopped with the slice, TR2b is not). Default: trace `X1Bb`, and in every trace the **deciding call** (the
  first call stopped with the slice, else the last call). The graph shows **that call's** slice only: instance nodes
  labelled with their pack class, literal boxes (dates, amounts, levels, predicate names), and the triples the engine
  marked `used` for that call highlighted. Caption: the call's tool, its `as_of`, and its decision with the slice and
  trace only, e.g. SD1b call 1 "as of 2026-10-10 · with the slice: allowed · trace only: allowed" versus call 2 "as of
  2026-10-20 · with the slice: blocked (asset_license)".
- **Ontology files**: every ontology-related JSON file on the site, from the generated list `data/ontology-files.json`
  (§Contract E), one row per file with its path as a link to the raw file, size, what it holds and where it is used.
  Groups: *The fleet's ontology* (pack, `data/creator-slice.json`, the files list itself); *Measured results*
  (`data/onto-*.json` and their `*.SOURCE.json`); *Experiment inputs and outputs* (the 180 files under
  `swm/experiments/ontology-value/`, in a `<details>` per subfolder with the folder's description and file count); *The
  World Model and elsewhere* (`swm/data/ontology.json` and `swm/data/coverage.json`, noting the World Model loads their
  `.js` forms; `swm/tools/sources/MANIFEST.json`, the pinned external sources `ontology.json` is built from;
  `blueprint_studio/ontology/slice.json`, generated from `ontology.json` for the Blueprint Studio).
- "Show as table" `<details data-graph-table>` under the graph: every node and link of the current mode as rows (the
  accessible and narrow-screen fallback).

The fleet tab gets one line under its intro: "How the ontology works here, as a graph →", a `data-wm-route` button to
`#view=runtime-observation&tab=ontology&sub=fleet`.

## Files

New (all public, neutral):

| Path | What | Task |
|---|---|---|
| `js/rt-onto-fleet-model.js` | pure model, no DOM (Contract A) | T1 |
| `tools/gen-onto-data.mjs` | writes `data/creator-slice.json` and `data/ontology-files.json` | T1 |
| `data/creator-slice.json`, `data/ontology-files.json` | generated (Contracts D, E) | T1 |
| `js/rt-onto-fleet.js`, `css/rt-onto-fleet.css` | In the agent fleet (Contract B) | T3 |
| `js/rt-onto-graph.js`, `css/rt-onto-graph.css` | Graph & files (Contract C) | T2 |
| `tests/site/rt-onto-fleet-model.test.mjs` | node, no browser, no git | T1 |
| `tests/site/rt-onto-fleet.test.mjs`, `tests/site/rt-onto-graph.test.mjs` | headless via `sx-harness.mjs` `withPage` | T3, T2 |

Changed: `js/rt-fleet.js` (export `FACT_OF_RULE`; T1), `js/rt-ontology.js` (T3), `index.html` (two `<link>`s, the scoped
note and chip, the fleet-tab line; T3), `tests/site/rt-subnav.test.mjs` (T3), `tests/site/no-real-brand.test.mjs` (FILES
gains the new model, data and plan in T1, the two view modules in T3), `logs/README.md` change-log entry and this plan
(T4, planner).

## Contract A — `js/rt-onto-fleet-model.js`

```js
export const PACK_PATH = 'swm/data/packs/creator-platform.json';
export const FILES_PATH = 'data/ontology-files.json';
export const TOOL_ACTION = {   // the ten tools → their action class; test: OWNED_BY_TEAM(class) = DOMAINS.creator.reviewers[tool]
  'promo.push_trend_to_homepage': 'pack:ActionPushTrend', 'promo.add_to_hot_pool': 'pack:ActionHotPool',
  'ads.select_creative': 'pack:ActionSelectCreative', 'ads.launch_campaign': 'pack:ActionLaunchCampaign',
  'help.update_login_email': 'pack:ActionUpdateLoginEmail', 'help.refund_coins': 'pack:ActionRefund',
  'creator.update_payout_account': 'pack:ActionPayoutChange', 'studio.buy_promotion': 'pack:ActionBuyPromotion',
  'creator.get_creator_analytics': 'pack:ActionAnalyticsRead', 'studio.use_asset': 'pack:ActionUseAsset',
};
export const PREFIX_CLASS = { account: 'pack:Account', agency: 'pack:MCNAgency', asset: 'pack:Asset', budget: 'pack:Budget',
  card: 'pack:PaymentInstrument', creator: 'pack:Creator', event: 'pack:SensitiveEvent', license: 'pack:License',
  pool: 'pack:Pool', purpose: 'pack:Purpose', region: 'pack:Region', scope: 'pack:Scope', session: 'pack:Session',
  subject: 'pack:Subject', team: 'pack:Team', topic: 'pack:Topic', video: 'pack:Video' };   // plus tool: via TOOL_ACTION
export function fleetOntology(pack, files, { seed = 7 } = {})   // pure; parsed pack and files list → FleetOntology
export async function loadFleetOntology({ fetchJson } = {})   // fetches PACK_PATH and FILES_PATH, then fleetOntology
export function sliceExport({ seed = 7 } = {})                 // Contract D object
```

`FleetOntology`:

```
{
  pack:   { id, title, tenant, candidate: true, outside_coverage: true, path: PACK_PATH },
  counts: { classes: 39, teams: 5, relations: 30, predicates: 27, anchors: 14, attributes: 10, traces: 22, calls: 30,
            triples: 78, rules: 8 },                      // triples summed over calls, with repeats
  predicates: [{ id, kind: 'relation'|'attribute'|'meta', domain: [kinds], range: [kinds] }],   // 27; meta = SUBCLASS_OF, COMPLETE_FOR
  schema: {
    nodes: [{ id, label, kind, role: 'class'|'action'|'team'|'anchor'|'attribute', wm?: '#view=security-model&tab=wm-ontology&node=<id>' }],
    links: [{ s, p, o, grade: 'declared'|'observed'|'inferred'|null, role: 'relation'|'owned'|'subclass'|'attribute' }],
  },
  rules:  [{ id, effect: 'BLOCK'|'HOLD', tools: [..], text, predicates: [..sorted], complete: [..sorted], stoppedOn: [trace ids], stoppedOff: [trace ids] }],
  traces: [{ id, title, agent, variant: 'a'|'b', deciding: <call index>,
             calls: [{ index, tool, as_of, on: { decision, stopped, rules }, off: { decision, stopped, rules },
                       facts: { nodes: [{ id, label, cls: <pack class id>|null, literal: bool }],
                                links: [{ s, p, o, grade, used: bool }] } }] }],
  queues: fleetModel().queues,  x1: fleetModel().x1,
  files:  the parsed files list (Contract E), passed through,
}
```

Rules for the model:

- Schema from the pack only. `role: 'action'` for a class whose `subClassOf` chain reaches `pack:ReviewableAction`
  (eleven, the root included); `anchor` for a non-`pack:` superclass id; `team` for `pack.teams`; attribute boxes as
  described under *Schema mode*, id `attr:<P>@<class id>`. Anchor labels from the id's last segment
  (`core:core-authenticated-subject` → "Authenticated Subject", `uco:observable:Account` → "Account"); the node test
  checks all 14 against `swm/data/ontology.json`, so the page never fetches the 2.5 MB bundle.
- Decisions, queues and X1 come from `fleetModel({ seed })`, so the new sub-tabs and the fleet tab cannot disagree. Its
  per-trace `on`/`off` arrays are already per pre_tool call, in order; call `index` is that position.
- Per call: `used` = `buildState(prepareSpan(span, { ontology: true }), [], TENANT, 0).facts.creator.used` for that span;
  a triple of the call's slice is `used: true` if it is in any of that call's used sets. Facts map to rules by
  `FACT_OF_RULE` (exported from `js/rt-fleet.js`, not copied). `rules[].predicates` = sorted union of the `p` of all its
  used triples over all calls; `rules[].complete` = sorted union of the `o` of its used `COMPLETE_FOR` triples.
- Instance `cls` from `PREFIX_CLASS` / `TOOL_ACTION` by the id's prefix; anything else (number, date, level, predicate
  name) is a literal node with an id unique per triple, so literals never merge.

## Contract B — `js/rt-onto-fleet.js`

`mountOntoFleet(el, model, { tip }) → { play(), pause() }` (no-ops) renders the sub-panel. Hooks: `[data-onto-fleet-grade]`,
`[data-onto-fleet-job="facts"|"rules"|"routes"]`, `[data-onto-fleet-limits]`, rule rows `[data-onto-fleet-rule="<id>"]`
with `[data-onto-fleet-preds]`, team rows `[data-onto-fleet-team="<team>"]` with `data-on`/`data-off`, and the two route
buttons `[data-onto-fleet-go="fleet"|"graph"]` carrying `data-wm-route`.

## Contract C — `js/rt-onto-graph.js`

`mountOntoGraph(el, model, { tip, loadD3 }) → { ensure(), play(), pause(), mode(m), rule(id), trace(id, call?), select(id) }`.

- **Drawing does not depend on animation.** `play`/`pause` are no-ops. `ensure()` loads d3 once and draws; it is
  idempotent and returns a promise. `js/rt-ontology.js` calls it when the sub-tab is first shown: on `rt:sub` with
  `{ tab: 'ontology', sub: 'graph' }`, and, because `loadFleetOntology()` can resolve after the bar mounted and after
  that event fired, right after `mountOntoGraph` if `sub.current() === 'graph'` (cold deep link). Reduced motion therefore
  changes nothing. The panel may still be hidden when `ensure()` runs (`requestSub` opens the sub-tab before the tab is
  shown), so the layout uses a fixed viewBox and never measures the panel.
- `loadD3()`: one shared in-flight promise; reuse `window.d3` if present; otherwise inject one `<script
  src="swm/vendor/d3.v7.min.js">`. A failure shows "Could not load the graph library" with a Retry button; the
  predicate strip, the table and the files list render without d3.
- Layout: `d3.forceSimulation(...).randomSource(d3.randomLcg(7)).stop()` then a fixed number of ticks, from
  deterministic initial positions, drawn once. Pan and zoom by `d3.zoom`. Nodes are `<g tabindex="0" role="button"
  data-graph-node="<id>" data-role>`; Enter/Space select; Esc clears.
- Hooks: `[data-graph-mode="schema"|"facts"]`, `[data-graph-anchors]`, `[data-graph-subclass]`, `select[data-graph-rule]`,
  `select[data-graph-trace]`, `select[data-graph-call]`, `svg[data-graph-svg]` with `data-mode`, links
  `[data-graph-link]` with `data-p`, `data-grade`, `data-role`, `data-used`, `data-hi`, `data-complete`; attribute boxes
  (`[data-graph-node][data-role="attribute"]`) with `data-hi`; predicate chips `[data-graph-pred]` with `data-kind`,
  `data-hi`, `data-complete`; `[data-graph-inspector]` (with `[data-graph-wm]`, a `data-wm-route`
  button, for anchors); `[data-graph-caption]`; `details[data-graph-table]` rows `[data-graph-row]`; the files block
  `[data-graph-files]` with rows `[data-graph-file="<path>"]` and folder groups `details[data-graph-folder="<dir>"]`;
  `[data-onto-fleet-grade]`.
- Legend: grade line styles, node roles, instance circles vs literal and attribute boxes ("notation adapted from VOWL",
  as the World Model's Network view says).
- 390 px: the SVG scales to the card (viewBox), controls and chips wrap, the inspector stacks under the graph, no
  horizontal page scroll.

## Contract D — `data/creator-slice.json`

```
{ "source": "jev-runtime/demo/js/engine/scenarios-creator.js", "vendored_commit": <jev-runtime/VENDORED.json commit>,
  "tenant": "Acme Shorts (fictional)", "pack": "swm/data/packs/creator-platform.json",
  "note": "Generated by tools/gen-onto-data.mjs from the vendored engine; do not edit. …",
  "traces": [ { "id", "title", "agent", "variant", "calls": [ { "index", "tool", "as_of", "triples": [ {s,p,o,grade} ] } ] } ] }
```

The page does not fetch it (the engine is already loaded); it is the downloadable form of every call's slice.

## Contract E — `data/ontology-files.json`

```
{ "note": "Generated by tools/gen-onto-data.mjs; do not edit.", "rule": "<the inclusion rule, in words>",
  "groups": [ { "id": "fleet"|"measured"|"experiments"|"site", "title", "about" } ],
  "folders": { "<dir under swm/experiments/ontology-value/>": "<what it holds>" },
  "files": [ { "path", "group", "bytes", "holds", "usedBy" } ] }
```

Inclusion rule: every `*.json` under the site root (skipping `node_modules` and dot-directories) whose path matches
`/onto|ontology|packs\//`, plus `swm/data/coverage.json`, `swm/tools/sources/MANIFEST.json` and the two generated files;
`bytes` is omitted for `data/ontology-files.json` itself, and paths are de-duplicated (the list itself also matches
`/onto/`). Rows: the 189 matching files that exist today (180 under the experiments folder) + `data/ontology-files.json`
+ `swm/data/coverage.json` + `swm/tools/sources/MANIFEST.json` + `data/creator-slice.json` = 193. A stray untracked
matching JSON in a dev checkout makes the equality test fail loudly; its message names the extra path. `holds`/`usedBy` come from a fixed description map in the generator, per file for the 13 non-experiment files and
per folder for the experiments (`.`, `e3`, `e3/out`, `e3/out/b1`, `b2`, `b3`, `p-onto`, `fixtures/firewall`, `out`, `pr`,
`v2`, `v2/out`); the generator fails on a matched file or folder without a description. The generator walks the file
system, not git, so the same check holds in CI's `git archive` export, which is the deployed tree.

## Tasks

| Task | Owner | Depends | Deliverables |
|---|---|---|---|
| T1 model + data | coder-opus | — | Contracts A, D, E; `FACT_OF_RULE` export; `rt-onto-fleet-model.test.mjs`; no-real-brand FILES (model, generator, data, plan) |
| T2 graph | coder-sol | Contract A shape; builds against T1's committed model as soon as it lands (a contract-shaped fixture until then) | Contract C, `css/rt-onto-graph.css`, `rt-onto-graph.test.mjs` |
| T3 sub-tab wiring + In the agent fleet | coder-opus | T1 | Contract B, `css/rt-onto-fleet.css`; `js/rt-ontology.js`: the two items, `mountOntoFleet` and `mountOntoGraph` from one `loadFleetOntology()` started in `init()`, the `ensure()` calls; the bar mounts even if `onto-observability.json` fails (the measured panels then show the existing "could not be loaded" line, the fleet sub-tabs still work), and if `loadFleetOntology()` fails the two fleet panels show "The fleet ontology could not be loaded." while the measured ones are unaffected; `index.html` edits; `rt-onto-fleet.test.mjs`; `rt-subnav.test.mjs`; no-real-brand FILES (two view modules) |
| T4 log | planner | T1–T3 | review record here, `logs/README.md` entry |

## Tests and acceptance

`node --test tests/site/*.test.mjs` passes with Chrome present (no skips); `node --check` on every new `js/*.js` and the
generator.

- **Model (node, no git):** the counts above; every schema link endpoint is a node; every `relation`/`owned` link is one
  pack edge with its grade; 14 anchors whose derived labels equal the bundle's; 10 attribute boxes as specified; eleven
  `action` classes; `TOOL_ACTION` complete and each class's `OWNED_BY_TEAM` equals the engine's reviewer for its tool;
  every instance prefix in every slice maps to a pack class; for each of the 8 rules `predicates` is non-empty and a
  subset of the pack predicates, and `cross_principal_read.complete` includes `MANAGES` and `HAS_SCOPE`; `queues` and
  `x1` deep-equal `fleetModel()`'s; per-call facts and decisions equal the engine's own per-call results, checked
  explicitly for SD1b (call 1 allowed as of 2026-10-10, call 2 blocked by `asset_license` as of 2026-10-20) and SD2b
  (spent 300, 700, 950 across allow, allow, hold, each call's `used` only on the call that holds); every risky trace
  stopped with the slice has ≥1 used triple on its deciding call; `data/creator-slice.json` and
  `data/ontology-files.json` equal a fresh generation byte for byte (the latter by walking the file system), every
  listed path exists, every matched file is listed; the pack and `ontology.json` keep their pinned hashes (existing).
- **In the agent fleet (headless):** a cold deep link `…&tab=ontology&sub=fleet` opens it; the grade line and the three
  limits are visible; eight rule rows with non-empty predicates; team `data-on`/`data-off` equal `fleetModel().queues`;
  arriving at `#view=runtime-observation&tab=fleet`, switching to Ontology → In the agent fleet by clicks, then "See it run"
  opens the fleet tab; arriving at `…&tab=ontology&sub=fleet`, switching to Agent fleet by click, then its new line opens
  the sub-tab; "Explore the graph" opens Graph & files; no page errors.
- **Graph & files (headless):** with reduced motion emulated **before** a cold deep link `…&tab=ontology&sub=graph`, the
  graph draws 68 nodes (39 + 5 + 14 + 10) and every schema link, the inspector and controls work; without reduced
  motion the node positions are the same; anchors off removes the 14 anchors and their links; for each of the 8 rules
  the chips with `data-hi="true"` are exactly its `predicates`, the chips with `data-complete="true"` are exactly its
  `complete`, and ≥1 link or box has `data-hi="true"` or `data-complete="true"` (explicitly: `mcn_payout_scope`'s
  HAS_SCOPE chip has both flags; `cross_principal_read` lights the MANAGES and HAS_SCOPE links by `data-complete`); an anchor's `[data-graph-wm]` opens
  the World Model on that node; facts mode defaults to X1Bb's deciding call with ≥1 `data-used="true"` and a caption
  naming both decisions; SD1b call 1 and call 2 show different captions; the files block has 193 rows, the experiments
  folders hold 180, and every row's link returns 200 from the local server; d3 blocked (request intercepted) shows the
  Retry message while chips, table and files still render; at 1400 and 390 px no horizontal page scroll; no page
  errors.
- **Notes (`rt-subnav.test.mjs`):** NOTES gains `fleet: ['[data-rt-subpanel="fleet"] [data-onto-fleet-grade]',
  '[data-rt-subpanel="fleet"] [data-onto-fleet-limits]']` and `graph: ['[data-rt-subpanel="graph"] [data-onto-fleet-grade]']`, TEXT
  `/Simulated engine/` and `/not from linking traces at runtime/`; the existing ontology notes and texts still pass.
- **Existing:** the measured sub-tabs' tests pass untouched apart from NOTES; `no-real-brand` scans the new files.
- **Live (after deploy):** the planner opens both deep links on demo.opensilex.ai at 1400 and 390 px, fetches the two
  generated files and two raw links from the files list; recorded below.

## Gates and publication

Standard roster as last run, minus MiMo: planner Claude (this pane), reviewers `reviewer-claude` and `reviewer-codex`,
coders `coder-opus` and `coder-sol`. Plan gate and code gate unanimous (planner + both reviewers). Coders commit on
`fleet-ontology-graph` only. After the code gate: merge to `main`, push (CI deploys), live check, record here. The repo is
public: no private paths, outside organisations' names or internal data in any file, commit message or branch name.

## Amendment v0.4/v0.5 — the Vision graph (user direction, mid-implementation)

The user, after v0.3 was approved: the graph drawn in the Ontology tab need not stay literal; it should express where
Silex is heading, in the manner of their explainer page (an alert at the centre of typed relations to who, what
permission, which task and what target; an "alert only ↔ with ontology" switch; a "whole enterprise ↔ this decision"
focus switch; every figure labelled as an illustration, not a measurement). Everything in v0.3 stays; this adds a lead
block to **Graph & files** and changes nothing already built.

**Graph & files, new order:** (1) **The vision** (new, default on screen), (2) **What exists today**: the v0.3 graph
(schema and facts modes) under that heading, (3) the files list. Hint becomes "The vision, today's pack, every JSON file".

**The vision block** (`js/rt-onto-vision.js`, `css/rt-onto-vision.css`, `mountOntoVision(el, { tip, pack, reducedMotion })
→ { play(), pause() }`; under reduced motion the ontology view is set at mount, since the bar never calls `play()`):

- Grade line, visible, `[data-vision-grade]`, chip `data-kind="sim"` "Illustration": "Where Silex is heading, not the
  current build. Nodes and relations marked *today* exist in the candidate pack; the rest are the vision. No figure here is a
  measurement."
- A hand-authored relation sketch (fixed coordinates in a viewBox, no d3, no force layout), centred on one fleet action,
  **"Ad Buyer · launch paid campaign"**. Ring 1, the decision's own world, each with a labelled typed edge: the video it
  promotes (USES), the subject the video FEATURES, the purpose that EXCLUDES that subject, the hot pool that SYNCS_TO ad
  candidates, the budget it CHARGES, the music LICENSED_UNDER, the team the action is OWNED_BY_TEAM (Trust & Safety), the
  person who DELEGATES_AUTHORITY to the agent, the consent record, and the hard rule that GATES it. Ring 2, the rest of
  the enterprise: other domains' work (supplier payments, SOC triage, onboarding, refunds, contracts, access requests,
  other creators, other campaigns, payroll) as faint nodes; a ring-2 node with a pack class (refunds →
  `pack:ActionRefund`) is tagged `today` like any other.
- Each node carries `data-status="today"` (with `data-pack-id`, a real pack class or team id) or `data-status="vision"`.
  **An edge is `today` only if (s's `data-pack-id`, `data-p`, o's `data-pack-id`) is one of the pack's 30 edge triples**
  (both pool nodes are `pack:Pool`; the music node is `pack:Asset`); every other edge is `vision`, even between two
  `today` nodes. So FEATURES, EXCLUDES, SYNCS_TO, OWNED_BY_TEAM and LICENSED_UNDER can be today; USES, the action's
  CHARGES (the pack has only Team CHARGES Budget), DELEGATES_AUTHORITY, GATES and the consent link are vision;
  the legend explains both; vision nodes and edges are drawn dashed.
- Switch A, `[data-vision-view="trace"|"onto"]`: *Trace only* shows the action with the raw ids a trace carries
  (its arguments read from the engine's X1Bb span, `video_id` and `amount_usd`; nothing invented) and four open questions (who is in it? may it be used for ads? which team reviews?
  who allowed this?); *With the ontology* draws ring 1 with the answers. Default: trace only, switching once to the
  ontology view on first show (skipped under reduced motion, which shows the ontology view at once).
- Switch B, `[data-vision-focus="all"|"local"]`: *Whole enterprise* shows both rings at equal weight; *This decision*
  fades ring 2 and keeps ring 1. Caption: "Not deleting the world; choosing the context this one step needs."
- A four-step strip under the sketch, `[data-vision-step]`: fill in context → narrow to this decision → hard rules for red
  lines, the judge for grey areas → people for the exceptions; each step tagged *today · simulated on this site* (with where it exists on the
  site: the Agent fleet tab, the Decision plane) or *vision*. No numbers. (Unlike the explainer, no hypothetical
  triage counts: the site's figures are computed or measured, and a made-up 10,000-action split would be the one typed-in
  number on these sub-tabs.)
- Hooks: `[data-onto-vision]`, `[data-vision-node="<id>"]` with `data-status`, `data-ring` (0 centre, 1, 2),
  `[data-vision-edge]` with `data-p`, `data-status`, the two switch groups, `[data-vision-caption]`, `[data-vision-step]`.
- Motion: CSS transitions only (≤ 600 ms), none under reduced motion. 390 px: the sketch scales by viewBox, labels stay
  ≥ 11 px as rendered (measured on screen at 1400 and 390 px, since viewBox scaling shrinks SVG text), the switches wrap, no horizontal page scroll.

**Wiring (T3 addendum):** the Graph & files panel gets `<div data-onto-vision-mount>` first, then the v0.3 graph mount
under an `<h3>` "What exists today", then (inside the graph module) the files. `bind('graph', …)` gets a combined handle
whose `play()` only plays the vision's switch once; the graph's `ensure()` stays on v0.3's own path (`rt:sub` and
after-mount), never inside `play()`, so reduced motion still draws the graph.

**Task T5** (owner: whichever coder finishes first; planner assigns): the vision module, CSS and
`tests/site/rt-onto-vision.test.mjs` (headless): grade line visible; every `today` node's `data-pack-id` is a pack class
or team id, and at least six nodes are `today`; every edge endpoint is a node; every `today` edge's triple is a pack edge, at
least four edges are `today`, every edge whose `data-p` is not a pack predicate is `vision`; trace-only fields equal the
X1Bb call's argument names; rendered labels ≥ 11 px at 1400 and 390 px; switch A changes ring-1 visibility; switch
B sets ring 2 faded and ring 1 not; reduced motion before a cold deep link `…&sub=graph` shows the ontology view with no
running transitions; 390 px no horizontal scroll; no page errors; `no-real-brand` FILES gains the module. NOTES in
`rt-subnav.test.mjs` gain `'[data-rt-subpanel="graph"] [data-vision-grade]'` with TEXT `/not the current build/`.

## Review record

### Plan round 1 (v0.1, sha 3de327928cbb) — both PLAN-REJECTED

| # | Objection | v0.2 |
|---|---|---|
| codex 1, claude 1 | d3 loads only on `play()`, which the bar skips under reduced motion | `ensure()` draws on first show, independent of `play()`; reduced-motion cold deep-link test |
| codex 2 | trace-level union of facts hides per-call state (SD1b dates, SD2b spend) | per-call facts, decisions and `used`; call picker; deciding-call default; SD1b/SD2b tests; Contract D per call |
| codex 3 | experiments folder as one row hides 180 files, and its link 404s | generated per-file list (Contract E), folder `<details>`, every link checked, file-system walk valid in the CI export |
| codex 4 | "carries facts between agents" implies runtime linking | wording rewritten; the three fleet-tab limits shown and tested |
| claude 2 | rule picker lights nothing for rules that read attributes; COMPLETE_FOR understated | attribute boxes, predicate strip, exact-set highlight for all 8 rules, `complete` list |
| claude 3 | plain hash links fail when the hash already equals the target | all routes use `data-wm-route`; tests arrive by the target hash first |
| claude 4a | the grade-line hook exists in both panels, so the visible-notes check fails | NOTES scoped by panel |
| claude 4b | neutrality guards do not scan the new files | `no-real-brand.test.mjs` FILES extended, owners named |

Non-blocking taken: explicit tool map, the `.js` forms and MANIFEST in the files list, the blueprint slice's origin,
`x1` at top level, "78 triples across 30 calls", one shared d3 promise and `randomLcg(7)`, the bar survives a failed
measured fetch, `logs/README.md`, a scoped chip, names instead of badge numbers in the note.

### Plan round 2 (v0.2, sha a7cf3698fb7a) — both PLAN-REJECTED, one shared objection

| # | Objection | v0.3 |
|---|---|---|
| codex 1, claude 1 | one `data-hi` value cannot mark a predicate both read and declared complete (HAS_SCOPE, LICENSED_UNDER); `cross_principal_read` lights no link or box | independent `data-hi` and `data-complete` on chips and links; `complete` lights MANAGES/HAS_SCOPE links; per-rule exact-set acceptance for both flags |

Non-blocking taken: the "No judge model" phrase capitalised in a hooked span; a separate Simulated chip instead of a
counted scope; the limits selector scoped by panel; `ensure()` ordering after a late model load and no measuring of a
hidden panel; the self-listing de-duplicated and the 193 broken down.

### Plan round 3 (v0.3, sha 6e773c52a466) — PLAN-APPROVED, unanimous

reviewer-claude PLAN-APPROVED, reviewer-codex PLAN-APPROVED, planner PLAN-APPROVED. Non-blocking taken into T1: the model
test asserts every `rules[].complete` entry is a relation predicate (attribute boxes carry only `data-hi`).

### Plan round 4 (v0.4, sha f71058382d74) — claude PLAN-REJECTED, codex PLAN-APPROVED

| # | Objection | v0.5 |
|---|---|---|
| claude 1 (codex nb 1 says the same) | `today` defined for nodes only; several sketch edges are not pack relations | an edge is today only if its triple is a pack edge; USES, the action's CHARGES, DELEGATES_AUTHORITY, GATES and the consent link are vision; tests check it |

Non-blocking taken: `reducedMotion` passed to the vision mount; `ensure()` kept off `play()`; step tags "today ·
simulated on this site"; refunds tagged today, payroll added as a vision node; trace-only fields read from the X1Bb call
(no `pool`); rendered label size checked at 1400 and 390 px.

### Plan round 5 (v0.5, sha f14d8f2cc9b1) — PLAN-APPROVED, unanimous

reviewer-claude PLAN-APPROVED, reviewer-codex PLAN-APPROVED, planner PLAN-APPROVED. Non-blocking taken into T5: at
narrow widths the sketch keeps a minimum width and scrolls inside its own card (the page never scrolls sideways; the
check measures the page), and "the raw fields the call carries" instead of "ids".

## Code review record

Implementation paths: everything in the branch diff outside `logs/` (20 files). Base `47562d2`.

| Round | Head | Diff hash | reviewer-claude | reviewer-codex | Blocking points and fixes |
|---|---|---|---|---|---|
| 1 | `89ba42c` | `3b9764e10024` | IMPL-REJECTED | IMPL-REJECTED | claude: "each on its own team" was false (6 agents, 5 teams) → counts computed from the engine, wording tested. codex: calls with no declared facts drew NaN transforms → finite empty state "No declared facts for this call", five empty calls tested, SVG diagnostics captured. Non-blocking taken: graph labels ≥ 11 px at 390 px (in-card scrolling), render errors separate from library-load errors, the vision's automatic switch settles on leave, one pack fetch, video label from the engine. |
| 2 | `35dc70d` | `1494b200aa8a` | IMPL-REJECTED | IMPL-APPROVED | claude: at 390 px on touch, the enlarged graph trapped one-finger scrolling → d3 zoom ignores single touch, `touch-action: pan-x pan-y`, a touch test (made deterministic with synthesized scroll and pinch gestures). Non-blocking taken: no writes to d3's private zoom state; the vision probe armed by URL. |
| 3 | `0d5d607` | `c43d98c94217` | IMPL-APPROVED | IMPL-APPROVED | — (planner IMPL-APPROVED: suite 118/118 four times at default concurrency, no skips) |
| 4 | `b6e4337` | `186a6edc4f18` | IMPL-APPROVED | IMPL-REJECTED | After the first merge (`32f9533`) CI failed: on the Linux runner a synthesized one-finger swipe scrolled nothing, so the deploy did not run. The touch test was rewritten: always-running checks of the computed `touch-action`, the mounted zoom filter and uncancelled one-finger touches, plus native-gesture layers gated by a control swipe (skipped, with a diagnostic, only when the control cannot scroll either). codex: no always-running two-finger gesture, so broken pinch could pass when native pinch is skipped → added. (codex's first attempt stopped at "model at capacity"; resent once.) |
| 5 | `e6bec39` | `9c30d84a9d8d` | IMPL-APPROVED | IMPL-APPROVED | — (in-page two-touch zoom in both modes, its negative control fails without the touch handlers; ancestor `touch-action` checked; planner IMPL-APPROVED, suite 124/124 locally) |

Acceptance exception: on CI, the native-gesture layers of the touch test may skip (reported by `t.diagnostic`) when the runner cannot synthesize touch gestures; the deterministic layer and the in-page two-touch zoom always run.

Also in this run: the vision test and two older timing checks (`rt-onto-visual`, `rt-subnav`) now wait on page state, not the clock, since the Ontology bar now mounts after more fetches. Left for later (non-blocking): a plain mouse wheel over the tall schema graph zooms before the page scrolls (d3's default; a Ctrl/⌘-wheel zoom would change that); a gesture crossing a schema ↔ facts switch, and a swipe straight after a pinch, are not covered by the tests.
