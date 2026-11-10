# Agent Gym v2 module contract

This is the interface every Agent Gym module codes against. The product plan is `.audit/plan.md` in the build worktree (plan v2, 2026-11-10). The three reference screens are N1 `agent_gym1.png` (workbench), N2 `agent_gym2.png` (create environment) and N3 `agent_gym3.png` (create scenario).

Agent Gym is a static page at `agent-gym/index.html`. It uses native ES modules with no build step and no framework. Everything is simulated. No module makes a network call other than loading its own static files.

## Layers

| Layer | Files | Rule |
| --- | --- | --- |
| Shapes | `js/model.js` | JSDoc typedefs, enums, `refKey`, `digestOf`, `clone`. Frozen. Ask the lead for changes. |
| Fixtures | `js/fixtures/*.js` | Pure data builders. `js/fixtures/index.js` exports `seedState()` returning a full `GymState`. |
| Domain | `js/environment/*`, `js/scenario/*`, `js/simulation/*`, `js/validators.js`, `js/metrics.js`, `js/selectors.js` | Pure functions. No DOM, no storage, no timers (the scheduler is the one exception, see below). |
| Store | `js/store.js` | The only writer of state and of `localStorage`. |
| Shell | `js/app.js`, `js/router.js`, `js/sections.js`, `js/components/*`, `css/tokens.css`, `css/shell.css` | Header, section tabs, routing, shared widgets. |
| Views | `js/views/*.js` with one CSS file per screen | Read through selectors, write through reducers. |

## State and reducers

The store holds one `GymState` (see `model.js`). A reducer is a pure function:

```js
/** @returns {{ state: GymState } | { error: GymError }} */
function reducer(state, command) {}
```

A reducer never mutates its input. It returns a new state (use `clone` or spread) or a typed error. Views call:

```js
const result = store.dispatch(reducer, command);   // { ok: true, state } | { ok: false, error }
```

`dispatch` persists on success and notifies subscribers. A failed dispatch changes nothing. Views never write state, never touch `localStorage`, and never keep their own copy of a count. Every number on screen comes from a selector over the store.

```js
createStore({ storage, seed }) -> {
  getState(), subscribe(fn) -> unsubscribe,
  dispatch(reducer, command),
  reset(),                       // re-seeds Gym v2 only, never localStorage.clear()
  persistence                    // { mode: 'local' | 'memory', error: GymError | null }
}
```

Persistence uses the key `silex.gym.demo.v2` with `schemaVersion` and `fixtureVersion`. An unknown version, corrupt JSON, a quota error or unavailable storage falls back to memory mode and surfaces `persistence.error` in the shell. On load, every attempt with status `running` gets `runner: 'paused'`.

View-only state that must survive a refresh (the selected tab, node, component, scenario row, version being viewed) lives in the route query. Everything else that is ephemeral stays in the view.

## Routes

`js/router.js` owns parsing and building. Views use `router.go(name, params, query)` and `router.href(...)`. Never build a hash by hand, and never accept an external return URL.

```text
#/experiments?status=all|pending|queued|running|needs_review|done&q=<text>   experiment queue (default route)
#/workbench/:experimentId                                   workbench
#/environments                                              environment library (template list)
#/environments/new?returnTo=:experimentId&focus=describe    environment builder
#/environments/:id/revisions/:rev                           environment revision (read-only detail)
#/scenarios/new?environment=:id@:rev&workflow=:id&source=chat|trace|blueprint|upload&mode=prompt|tool_failure|permission|data_state
#/scenarios                                                 scenario library (saved sets)
#/scenario-sets/:id/revisions/:rev                          scenario set revision (read-only detail)
#/runs?status=all|running|queued|completed|cancelled&trigger=all|manual|change|regression   run list, release gate, regression
#/experiments/:experimentId/attempts/:attemptId             run detail
#/experiments/:experimentId/attempts/:attemptId/results     results
```

`q` is search text: 1 to 64 characters from letters, digits, space and `. _ @ , -`, starting with a letter or digit. Any other value is dropped. A route may name its own validator for a query key, and that validator replaces the generic pattern for the key.

The default route is `#/experiments`. An unknown route renders a not-found panel with a link back to the experiment queue.

## Sections and embedding

`js/sections.js` splits the routes into four sections: Workbench (the experiment queue, which is the section root, and `workbench`), Environments (the environment library, builder and revision), Scenarios (the scenario library, builder and set) and Runs & results (the run list, run detail and results). Each section has a root route. The UI kit and the not-found page belong to no section. A new route joins exactly one section, and `tests/site/gym-host.test.mjs` fails until it does.

The shell shows the four sections as one row of tabs under the header. The tab whose section owns the current route carries `aria-current="page"`.

The SILEX console (`index.html`) shows the app in one iframe behind four views, one per section, through `js/gym-host.js`. It loads `agent-gym/index.html?embed=1`. In embed mode the shell leaves out its product header, because the console has its own, and the preview marker moves from the footer to the end of the section tabs, where it opens a menu with Reset demo data. The console reads `window.__gym.router` to follow navigation inside the app, so a view must change the route only through the router.

## View interface

```js
/** @param {HTMLElement} root  @param {{ store, router, announce(text), route, setLeaveGuard({ pending, apply, discard }) }} ctx */
export function mount(root, ctx) { return { update(route) {}, destroy() {} }; }
```

`app.js` calls `mount` when the route name changes, `update` when only params or query change, and `destroy` before leaving. `destroy` must remove every listener, timer and subscription the view created.

## DOM and components

`js/components/dom.js` exports `h(tag, props, ...children)`. Strings become text nodes, so user and fixture text is never parsed as HTML. No view assigns `innerHTML` with dynamic content. `mountView(root, render, store)` re-renders on store changes by reconciling the new tree into the live DOM. An element with the same tag and the same `data-focus-key` (else the same position) is kept, so open disclosures, the field being edited and held presses survive a scheduler tick. A replaced element gets focus back by `data-focus-key` and scroll by `data-scroll-key`. A view that holds unapplied edits registers `ctx.setLeaveGuard`, and the shell then holds a route change behind a Keep editing, Discard and leave, Apply and leave dialog.

Shared widgets live in `js/components/` and are owned by the shell. A view that needs a new shared widget builds it locally first and reports it. CSS is scoped under `.gym-app`. Shared classes use the `gym-` prefix. Each screen prefixes its own classes: `xq-` experiment queue, `wb-` workbench, `env-` environment builder, `sc-` scenario builder, `run-` run list, run detail and results. No selector may reach the old site's `:root`, `.card`, `.btn` or `.status`.

Every control does something or says why it cannot. A disabled control carries a visible or `title` reason. Dialogs trap focus, close on Escape and restore focus. Async status changes go through `ctx.announce`.

## Simulation interface

`js/simulation/` is pure except `scheduler.js`.

```js
validateExperiment(state, experimentId) -> { errors: GymError[], warnings: GymError[], dependencyReport: { matched: boolean, missing: string[] }, executionCount, pairCount }
freezeAttempt(state, experimentId, idempotencyKey) -> Attempt        // deep copies every revision
planExecutions(snapshot) -> PlanItem[]                               // fixed order
runExecution(snapshot, planItem, seed) -> Execution                  // deterministic; own state copy per call
compareAttempt(attempt, executions) -> Comparison

// reducers
saveExperiment(state, { experimentId })
enqueueAttempt(state, { experimentId, idempotencyKey })             // same key returns the same attempt
advanceAttempt(state, { attemptId })                                // appends exactly one execution
pauseAttempt / resumeAttempt / cancelAttempt (state, { attemptId })
recordReview(state, { attemptId, decision, note })

startScheduler(store, { tickMs, frozen }) -> stop()                  // one runner; at most one running attempt
```

`Completed` means every planned execution has a terminal state. It does not mean every check passed. A cancelled or incomplete attempt compares as `inconclusive`. The page query `?clock=frozen` starts the scheduler frozen, which holds the seeded queue at 12/18 for screenshots.

The seed has eight experiments, exp-024 to exp-031. It is built by the real reducers: the experiments that finished are enqueued while exp-029 and exp-028 are held (paused), then the queue order is set to run order and the two are resumed, so exactly one attempt is running. exp-029 keeps the attempt ids and the 12/18 position it had before the queue page existed.

## Experiments, stages and conclusions

An `ExperimentDraft` also carries three settings, edited through `setExperimentSettings(state, { experimentId, objective?, noRegression?, minImprovedPairs? })`. It is a draft edit like the others: it bumps `draftRevision`, and Run freezes the settings into the attempt snapshot.

```js
objective: 'success' | 'policy_violations' | 'steps'                 // metrics.js OBJECTIVES
acceptance: { noRegression: boolean, minImprovedPairs: number }       // 0 to 99
source: { kind: 'manual' | 'speedrun' | 'studio', label: string }
```

Objectives are limited to what the executor already records for every execution: pass or fail (`success`), the guarded violations in `finalState.violations` (`policy_violations`) and the length of `events` (`steps`). Executions carry no duration and the simulation has no price, so there is no latency or cost objective. `OBJECTIVES[id]` holds the label, the one-line hint, the direction that is better, and the measure over one version's scored runs. Success is higher-is-better, the other two are lower-is-better.

Stage and outcome are never stored. They are read from the attempts and reviews in `selectors.js`:

```js
experimentStage(state, experimentId)        -> 'pending' | 'queued' | 'running' | 'needs_review' | 'done'
experimentOutcome(state, experimentId)      -> null | { decision, label }     // the recorded review of the stage attempt
attemptResultSummary(state, attemptId)      -> null | { text, tone }          // completed attempts only
experimentResultSummary(state, experimentId) -> null | { text, tone }         // the stage attempt's summary
acceptanceVerdict(state, attemptId)         -> { passed, checks: [{ id, label, passed, detail }] }
```

The stage is one table read top to bottom over the experiment's stage attempt, which is its latest attempt that is queued, running or completed.

| Stage attempt | Stage |
| --- | --- |
| none | `pending` |
| `queued` | `queued` |
| `running`, including a paused runner | `running` |
| `completed`, no review recorded | `needs_review` |
| `completed`, reviewed | `done` |

A cancelled or failed attempt is abandoned work and never decides the stage. An experiment whose only attempts were cancelled or failed reads `pending`, and its row offers Configure again. A cancelled re-run behind a reviewed attempt leaves the experiment `done`. A new attempt reopens a `done` experiment as `queued`.

`acceptanceVerdict` reads the settings frozen into the attempt, never the current draft. Its checks, in order: `complete` (every pair finished), `no-regression` (only when the experiment asks for it), `min-improved` (only when the minimum is above 0) and `objective` (the variant is no worse than the baseline on the chosen objective). It passes when every listed check passes. `recordReview` is unchanged and still needs a Pass verdict for Pass for demo. The acceptance verdict is information next to the review, not a second gate.

Every number and result line on screen comes from these selectors and from `compareAttempt`. No fixture holds a typed percentage.

### Experiment queue

The title Experiment queue belongs to this page and its breadcrumbs only. The workbench panel is titled Run queue and the Runs page list is titled All runs.

`js/experiments/queue.js` builds the queue's rows, the stage tabs with counts over the whole queue, and the four summary cards (Pending, Queued, Running, Needs review). Search matches the experiment name or id, the workflow name and the source label, ignoring case. The model has no team, so the source label stands in for it. Last activity shows `Reviewed <date>` for a reviewed experiment, else the attempt label, else `Draft rev N`, because the simulation keeps no wall-clock time.

The row button comes from one lookup keyed by stage:

| Stage | Label | Opens |
| --- | --- | --- |
| `pending` | Configure | workbench |
| `queued` | View | workbench |
| `running` | Open | run detail of the running attempt |
| `needs_review` | Review | results of the stage attempt |
| `done` | Results | results of the stage attempt |

Class prefix `xq-`, styles in `css/queue.css`. The table reuses the `run-table` look of the Runs list and stacks into labelled cards below 1280px.

### Configure, Run, Review

`components/steps.js` draws the step indicator and `experiments/steps.js` decides each step. The current step comes from the route (workbench, run detail, results). Whether another step has a target comes from the stage attempt, or from the attempt named in the route when it belongs to the experiment. A step with a target is a link built through the router. A step without one is not a link, has `aria-disabled`, and says why in its `title`.

The workbench shows the indicator, a what-changes strip (`workbench/derive.js` `changeSet`, computed from the version data, with differing cells highlighted) and the experiment settings block. The Results view shows the acceptance checks and the objective next to the comparison. The All runs list and the workbench Run queue show one result line per completed attempt and, once reviewed, the review decision.

## Counting rules

`runs = versions × selected scenarios × repetitions`. `pairs = selected scenarios × repetitions`. The default is 2 × 3 × 3 = 18 runs and 9 pairs. With the five-scenario set it is 30 runs and 15 pairs. Progress is executions with a terminal state over planned executions.

## Simulated truth

Component mode is always `simulated`. App names and icons describe a simulated capability, not a connected account. The shell shows `Concept preview · Simulated data` on every screen. `Timeout after send` means the side effect committed and the response timed out. A prompt that says "approved" or "skip approval" never creates an approval grant. Only a scenario's `scriptedEvents` can.
