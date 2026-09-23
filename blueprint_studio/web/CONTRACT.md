# Blueprint Studio v2 — React integration contract (Task 0)

Plan: [`../../logs/2026-09-23_WORKFLOW_BUILDER_PLAN.md`](../../logs/2026-09-23_WORKFLOW_BUILDER_PLAN.md). The engine contract for `../js/*` is still [`../CONTRACT.md`](../CONTRACT.md).

## Build

```bash
cd blueprint_studio/web && npm ci && npm run build   # writes ../app (committed)
npm run check   # fails if ../app differs from a fresh build
npm run i18n    # fails if zh.js lacks a key used in src/ or listed in src/i18n/required.js
```

Engine modules are imported from `../../js/*.js` and bundled; templates from `../../templates/*.json`. **Do not modify `../js`**. The one allowed model change (duplicate-edge check by source port) is already in.

## State (`src/state/`)

- **`storeAdapter.js`**
  - `store` is the single `createStore({ storage, lint })` instance.
  - `useStudio()` subscribes a component to changes. **Call it at the top of every component that reads the store or the controller.** It returns an increasing version number. The store mutates in place, so read `store.active()` / `store.doc` during render; never cache them across renders.
  - `bump()` forces a re-render of all subscribers.
- **`pendingInputs.js`**
  - `pending.set(nodeId, field, draft, message)`, `pending.clear(nodeId, field)`, `pending.list()`, `pending.size`.
  - These are refused config edits. While `pending.size > 0`, Confirm is disabled (`controller.confirm()` also refuses).
- **`controller.js`** — the only place with side effects besides `store.dispatch`. Pages call these:

| Function | Does |
|---|---|
| `getRoute()` | `{ view: 'builder'\|'assurance', stage, panel, decideId, toast, selected, focus }` |
| `go(view, stage?)` | Switch view; for assurance, set the stage (`confirm validate optimize decide register`) |
| `setPanel(null\|'run')`, `setSelected(sel)`, `focusNode(id\|null)`, `setDecideId(id)` | UI state |
| `toast(text, kind?)` | Transient message (`'info'` \| `'error'`) |
| `startFromTemplate(name)`, `startBlank()`, `importText(text)`, `exportText()` | Documents |
| `setActiveRevision(rev)`, `newRevision()` | Revisions |
| `confirm()` | Confirm the active draft. Refuses while pending inputs exist. Returns a Result |
| `runValidation(n)` / `runOptimize()` / `modifyCandidate(id, params)` | Async jobs; late results are refused by the store. Progress is in `jobs = { running: 'validate'\|'optimize'\|null, done, total }` |
| `recommendedId(rev)`, `approvable(rev, candRecord)` | Recommendation and approve guard (same rules as v1) |
| `approve(candidateId)`, `reject(candidateId)`, `accept()`, `register()` | Lifecycle commands on the active revision. Return a Result |
| `patchedGraph(rev, candidate)` | Result of applying a candidate's patch |
| `diffGraphs(a, b)` | Structural diff (`io.diffGraphs`) |
| `policyText(revNumber)` | Policy-as-code text |
| `revLabel(n)`, `isDecided(rev)` | Helpers |
| `run`, `startRun`, `stepRun`, `resolveRun`, `clearRun`, `runHighlights`, `sameCtx` | Test runs (TestRunPanel) |

`store.inventory()` lists registered entries. A revision's records (`validation`, `optimization`, `decision`) have the shapes in `../CONTRACT.md` §10.

## Pages (`src/assurance/`)

- `Validate.jsx` is the worked pattern: `useStudio()` → read `store.active()` → render → call controller functions.
- Shared pieces live in `common.jsx`:
  - `Page`, `Claim`, `MetricsRow`, `ScoreCard`, `Progress`, `DiffList`;
  - `describeOp(graph, op)`, `pathLabel(graph, ids)`, `nodeLabelIn(graph, id)`, `pct`, `frac`.
- Keep the v1 element ids used by the probes. Confirm: `#confirmAck`, `#confirmBtn`, `#toValidateBtn`. Optimize: `#runOptimizeBtn`, cards `.cand[data-cand]`, `[data-reject]`, `[data-modify]`, `select[data-param]`. Decide: `#approveBtn`, `#rejectBtn`, `#modifyBtn`, `#acceptBtn`, `#toRegisterBtn`, `#decideChip`. Register: `#registerBtn`.
- Claim discipline (plan §6):
  - every computed page shows `<Claim/>`;
  - numbers come with formulas (`MetricsRow`, `ScoreCard`);
  - never write "closed", "impossible" or "deployed" (except "Registered · not deployed").
- The stepper guards are in `App.jsx` (`stageEnabled`).

## i18n (`src/i18n/`)

- Write every string as `t('area.key', 'English default', params?)`. `{name}` placeholders are filled from params.
- **`zh.js` must contain every key used in `src/`, plus those in `required.js`**: node labels, descriptions and synonyms, groups, lint codes, effect types and monitors. `npm run i18n` checks this.
- `en.js` only overrides English defaults.
- **Stays English in both modes, by design:** expression-parser error details, JSON views and node ids.
- Key naming: `area.thing` in lower camel case. Dynamic keys follow the patterns already used:
  - `opt.<field>.<value>`
  - `field.<key>`, `help.<key>`
  - `sens.<level>`, `kind.<kind>`, `scope.<scope>`
  - `status.<s>`, `act.<status>`, `port.<id>`
  - `deny.<reason>`, `ch.<channel>`, `trust.<t>`
  - `category.<Category>`, `severity.<s>`, `template.<t>`
  - `stage.<s>`, `kicker.<type>`

  Provide Chinese for every value the model can produce: the channel, trust, sensitivity, kind, action, scope, monitor and severity options in `../js/model.js` `NODE_TYPES`; the port ids; the six templates; the six finding categories.

## Probes

`tests/probe/run-probes-v2.mjs` finds elements by the ids above and by `data-*` attributes on nodes (`[data-node]`), edge "+" buttons (`[data-plus]`), port stubs (`[data-stub]`), search items (`[cmdk-item][data-type]`), checklist entries (`.ci[data-kind]`) and monitor picks (`[data-monitor]`). Keep them.
