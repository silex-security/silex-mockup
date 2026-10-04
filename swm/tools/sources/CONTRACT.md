# Source modules — contract

Plan: `logs/2026-10-03_SWM_DOMAIN_GROUNDING_EXEC_PLAN.md` (E5). Owner of this file: planner.
Owner of every `*.mjs` in this folder: coder-deepseek. Only the planner edits `build-ontology.mjs`,
which calls these modules.

## Rules for every module

- Pure ES module, no I/O, no network, no imports outside `node:` built-ins and `../schema.mjs`.
- One export: `export function parse(raws, selection)`.
  - `raws`: `{ [manifestName]: string }`. The file contents `build-ontology.mjs` read through
    `grab()`, keyed by their `MANIFEST.json` `name` (e.g. `'fibo-ClientsAndAccounts.rdf'`).
  - `selection`: the module's entry in `SEED.SOURCE_SELECTION` (in `swm/tools/silex-seed.mjs`), plus
    `selection.inBundle`: a `Set` of node ids already in the bundle (for the endpoint rule) and
    `selection.manifest`: `{ [name]: { url, repo, path, pin } }` for building URLs.
- Return `{ nodes, links, sources, omitted }` (any may be empty):
  - `nodes`: node objects ready to `add()`. Required fields: `id, label, group, layer, kind, def,
    review, src` (`src` = array of `{ sys, id, label, url }`). Optional: `attrs`, `caseType`,
    `refs`, `parentLink`.
  - `parentLink`: `{ t, pred, src, review }`, the display-parent edge the build passes to
    `setParent`. Every node must have one.
  - `links`: other edges `{ s, t, pred, src, review }`, all between ids this module emits or ids in
    `selection.inBundle`.
  - `sources`: `{ [key]: { sys, id, ver?, label, url, quote? } }` for benchmark and catalogue
    citations that attach to Silex nodes (no nodes of their own). `key` is the T0 key in the
    selection.
  - `omitted`: `[{ ref, reason }]`, every source reference the module saw but did not emit.
- **Fail loudly**: throw an `Error` naming the file and the item when a selected id, task, rule
  sentence, row, case or class is not found, or a pattern stops matching. Never return a partial
  result silently.
- **Deterministic**: sort `nodes` by `id`, `links` by `s|t|pred`, `omitted` by `ref`. No dates or
  random values.
- **URLs**: `https://github.com/<repo>/blob/<pin>/<path>`, with `#L<n>` where a line is known
  (Python classes, policy sentences). For D3FEND-style sites use the source's own page if the
  selection gives one.
- **Text**: whitespace collapsed and HTML tags stripped everywhere.
  - **Quotes are never cut.** `sources[*].quote` keeps the full task goal, policy sentence, document
    sentence, risky outcome or action string, exactly as in the source (AgentDojo goals keep their
    f-string placeholders, e.g. `{_ATTACKER_IBAN}`). Provenance must be complete.
  - Node `def` and `attrs[].def` are display text: cut to at most `SCHEMA.ATTR_DEF_MAX` (200)
    characters **including** the trailing `…`, at a word boundary, only when longer.
  - `label` keeps the source's own label.
- `attrs` (C9): `[{ name, def }]`, only attributes with a non-empty description; source order.
- **Review grades.** Nodes and the edges the source itself asserts (`SUBCLASS_OF` between imported
  classes, `DEMONSTRATES`, `COUNTERS`) are `'published'` with `src` = the source's `sys`. The
  navigation and domain-membership parent edges in the placement table below (`GROUPED_UNDER`,
  `PART_OF_DOMAIN`) are Silex placement, so they are `'curated'` with `src: 'silex'`. Modules emit
  no other curated edge; Silex judgments (alignment, case links, hazard sources) come from the seed
  through the build.

## Node id formats, kinds and placement

| Module | Emits | id | layer / kind / group | display parent (`parentLink`) |
|---|---|---|---|---|
| `fibo.mjs` | classes in `selection.classes` and their superclasses **within the same file** | `fibo:<LocalName>` | 2 / `class` / `resource` | `SUBCLASS_OF` to the in-file superclass if any, else `PART_OF_DOMAIN` → `dom:<selection.domain[localName]>` (`curated`, src `silex`). Extra `SUBCLASS_OF` links for further in-file parents |
| `cdm.mjs` | entities in `selection.docs` | `cdm:<entityName>` | 2 / `class` / `resource` | `PART_OF_DOMAIN` → `dom:<doc.domain>` (`curated`, src `silex`); `attrs` from `hasAttributes` (walk attribute groups) |
| `ocsf.mjs` | objects and event classes in the selection | `ocsf:<file stem>` (e.g. `ocsf:user`, `ocsf:account_change`) | 1 / `class` / `identity` for objects `user`, `resource` for `endpoint`, `workflow` for events | events: `SUBCLASS_OF` → `ocsf:iam` when they `extends: "iam"`; `ocsf:iam` and objects: `GROUPED_UNDER grp:<group>` (`curated`, src `silex`). `attrs` from the class's `attributes`, descriptions from the class or `ocsf-dictionary.json` |
| `nist-800-53.mjs` | controls in `selection.controls` | `nist:<ID>` upper-case, e.g. `nist:AC-2(3)` | 1 / `control` / `policy` | `GROUPED_UNDER grp:policy` (`curated`, src `silex`). `def` = first paragraph of the `statement` part (params resolved to their label or `[assignment]`) |
| `atlas-mitigations.mjs` | ATLAS `course-of-action` objects with ≥ 1 `mitigates` edge to a technique in `inBundle` | `atlas:<AML.Mxxxx>` | 1 / `countermeasure` / `policy` | `GROUPED_UNDER grp:policy`; `COUNTERS` (published) to each in-bundle `atlas:<technique>`; other targets → node `refs` and `omitted` |
| `attack-mitigations.mjs` | same for ATT&CK (`selection.techniques` adds the D13 ids to `inBundle`) | `attack:<Mxxxx>` | 1 / `countermeasure` / `policy` | as above, targets `attack:<Txxxx>` |
| `atlas-cases.mjs` | all case studies in `ATLAS.yaml` | `case:<AML.CSxxxx>` | 3 / `case` / `threat`, `caseType` = `incident`\|`exercise` | `GROUPED_UNDER grp:threat`; `DEMONSTRATES` (published) to each exact in-bundle technique id; others → `refs` |
| `attack-campaigns.mjs` | campaigns in `selection.ids` | `case:<Cxxxx>` | 3 / `case` / `threat`, `caseType` = `campaign` | `GROUPED_UNDER grp:threat`; `DEMONSTRATES` per exact in-bundle `uses` target |
| `agentdojo.mjs`, `tau2.mjs`, `banking-kb.mjs`, `asb.mjs`, `toolemu.mjs` | `sources` only | — | — | — |

`src.sys` values: `fibo`, `cdm`, `ocsf`, `nist-800-53`, `atlas` (mitigations), `attack`
(mitigations), `atlas-cs`, `attack-campaign`, `agentdojo`, `tau2`, `asb`, `toolemu`.

## `sources` keys and content

| Module | key | `id` | `ver` | `quote` |
|---|---|---|---|---|
| `agentdojo` | `<suite>/injection_task_<n>` and `<suite>/tool/<name>` | same as key | version of the task definition in effect at benchmark v1.2.2 (`1.0.0`, `1.1.2`, `1.2.0`, `1.2.1`), resolved from the `update_injection_task` decorators across the files given | the task `GOAL` string, f-string placeholders kept as written (e.g. `{_ATTACKER_IBAN}`) |
| `tau2` | rule keys from `selection.rules` and `retail/tool/<name>` | key | — | the verbatim sentence; must be found inside its `section` (`preamble` = before the first `## `) |
| `banking-kb` | document ids from `selection.docs` | doc id | — | the verbatim sentence given in the selection, found in the doc's `content` |
| `asb` | `<agent>/<Attacker Tool>` | key | — | `Attack goal`; row must have `Aggressive === "True"` (string), else throw. `label` = `ASB <agent> · <Attacker Tool> (generated scenario)`, since goals are often framed benignly |
| `toolemu` | case `name` and `<Toolkit>/<ToolName>` | key | — | for cases: the risky outcome or action string the selection names (verbatim) |

## Tests (`test-sources.mjs`, owner coder-deepseek)

Runs every module against the cached raw files in `swm/.cache/` (read through MANIFEST names) and
the real `SOURCE_SELECTION`, and checks: shape, determinism (two runs equal), every selected key
present, and for **each** module one deliberately broken input (a missing id, a changed sentence,
an `"Aggressive": "False"` row…) that must throw. Exit code 1 on any failure.

## L4 benchmark run modules (plan `logs/2026-10-03_SWM_L4_BENCHMARK_RUNS_PLAN.md`, R3)

`agentdojo-runs.mjs` and `tau2-runs.mjs` follow every rule above, with these additions. Their selection is
`SEED.BENCHMARK_RUNS.agentdojo` / `.tau2` plus `inBundle`, `manifest`, and `actionsByTool` (the inverse of
`SEED.BENCHMARK_ACTIONS`: tool key → L2 action id).

- **Input.** `raws['agentdojo-repo-089ed468cf3e.tar.gz']` is a `Buffer` (C21). Decompress with
  `zlib.gunzipSync`, then read tar headers: skip PAX `x`/`g` and GNU `L` long-name records correctly, join
  ustar `prefix` + `/` + `name`, advance by the size rounded up to 512. Only members matching
  `runs/<model>/<suite>/user_task_<n>/<attackType>/injection_task_<k>.json` for the selected models,
  suites, tasks and attack type are parsed. The τ² file is a string.
- **Completeness.** Throw unless the counts equal `selection.expect` (runs per suite, reported
  executions; τ² runs, failed runs, refusal runs) and the total is ≤ `SEED.BENCHMARK_RUNS.limit`.
- **Nodes** (all `layer: 4`, `review: 'published'`, a `benchmark` object, a non-silex `src`):

  | Kind | id | `benchmark` fields | `src` | `parentLink` |
  |---|---|---|---|---|
  | `planner` | `bench:agent:<source>:<model>` | `{ source, model, label }` | AgentDojo: blob URL of `runs/<model>/` at the pin; τ²: the result file URL | `INSTANCE_OF ag:planner` (curated, src silex) |
  | `tool-reg` | `bench:tool:<source>:<suite>/<name>` | `{ source, suite, tool }` | the tool's definition file at the pin (AgentDojo `default_suites/v1/tools/*.py`; τ² `src/tau2/domains/retail/tools.py`) | `INSTANCE_OF ag:tool-reg` (curated) |
  | `trace` | `bench:run:agentdojo:<model>:<suite>:<user_task>:<injection_task>` or `bench:run:tau2:<model>:<task_id>:<trial>` | `{ source, model, suite, userTask, injectionTask \| taskId, trial, simulationId, attackType, benchmarkVersion, pipelineName, outcome, utility \| reward, calls: [{ name, ok, refusal? }], refusals: [mapped refusal string] }` (calls ordered, duplicates kept; `refusals` = the distinct mapped refusal strings, exactly as in the selection, empty when none) | the run file (archive member blob URL) / result file + `#simulation=<id>` | `INSTANCE_OF ag:trace` (curated) |
  | `incident` | `bench:inc:<run id without "bench:run:">` | `{ source, status, predicate?, evidenceCall?, refusals?, unmapped? }`: AgentDojo incidents carry `predicate` (the matched row's hazard and `from`) and `evidenceCall` when one matched; τ² incidents carry the same `refusals` as their run | same as its run | `OCCURRED_IN` its run (curated) |

  `label`: run = `<model label> · <suite> · <user task> · <injection task | task id/trial>`; incident =
  `Benchmark incident · <outcome or refusal>`. `def` (≤ 200): the first user message. Message bodies and
  injected text are **not** copied.
- **Links.** `EXECUTED_BY` run → agent and `INVOKES` run → each distinct tool it called: `published`, src =
  the source sys. Runs and incidents carry `domain` (the suite's pack) and
  `BELONGS_TO dom:<domain>`: `curated`, src silex. Agents and tools have no domain (C19). `IMPLEMENTS` tool → action where `actionsByTool` has the tool
  key: `curated`. `EXHIBITS` incident → `hz:<hazard>` only when a predicate row matched (AgentDojo) or a
  mapped refusal occurred (τ²): `curated`.
- **Incidents.** AgentDojo: one per run with `security: true`, `status: 'reported-executed'`. τ²: one per
  run with a mapped refusal, `status: 'attempt-refused'`, one `EXHIBITS` per distinct mapped hazard. An
  incident with no `EXHIBITS` carries `unmapped` (the reason text from the selection).
- **Pairing a call with its result.** Use `tool_call_id` ↔ call `id` when both are present and unique.
  Otherwise (the selected AgentDojo traces have null ids) pair in order: the tool calls of one assistant
  message with the tool messages that immediately follow it, one to one. A call with no paired result, or
  an ambiguous pairing, is never evidence. `ok` = a paired result is present and its `error` is empty;
  absence of an error message alone is not `ok`.
- **Predicates** (AgentDojo). Evaluate `selection.predicates` against `calls` exactly as the seed comment
  states (identity fields by exact normalized equality, content fields by containment); record the first
  matching call (index, name, args subset) as `evidenceCall`. The four `negatives` must not match, and
  every value in `identityNegatives` substituted into a matching call must not match.
- **Tests** add: archive reader on the real archive (member count, a PAX-bearing member), the expected
  counts, every predicate on a positive and the listed negatives, τ² refusal → hazard, determinism.
