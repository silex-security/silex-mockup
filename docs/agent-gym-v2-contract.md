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
| Shell | `js/app.js`, `js/router.js`, `js/components/*`, `css/tokens.css`, `css/shell.css` | Header, routing, shared widgets. |
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
#/workbench/:experimentId                                   workbench
#/environments                                              environment library (template list)
#/environments/new?returnTo=:experimentId&focus=describe    environment builder
#/environments/:id/revisions/:rev                           environment revision (read-only detail)
#/scenarios/new?environment=:id@:rev&workflow=:id&source=chat|trace|blueprint|upload&mode=prompt|tool_failure|permission|data_state
#/scenarios                                                 scenario library (saved sets)
#/scenario-sets/:id/revisions/:rev                          scenario set revision (read-only detail)
#/runs?status=all|running|queued|completed|cancelled        run list
#/experiments/:experimentId/attempts/:attemptId             run detail
#/experiments/:experimentId/attempts/:attemptId/results     results
```

The default route is `#/workbench/exp-029`. An unknown route renders a not-found panel with a link back to the workbench.

## View interface

```js
/** @param {HTMLElement} root  @param {{ store, router, announce(text), route, setLeaveGuard({ pending, apply, discard }) }} ctx */
export function mount(root, ctx) { return { update(route) {}, destroy() {} }; }
```

`app.js` calls `mount` when the route name changes, `update` when only params or query change, and `destroy` before leaving. `destroy` must remove every listener, timer and subscription the view created.

## DOM and components

`js/components/dom.js` exports `h(tag, props, ...children)`. Strings become text nodes, so user and fixture text is never parsed as HTML. No view assigns `innerHTML` with dynamic content. `mountView(root, render, store)` re-renders on store changes by reconciling the new tree into the live DOM. An element with the same tag and the same `data-focus-key` (else the same position) is kept, so open disclosures, the field being edited and held presses survive a scheduler tick. A replaced element gets focus back by `data-focus-key` and scroll by `data-scroll-key`. A view that holds unapplied edits registers `ctx.setLeaveGuard`, and the shell then holds a route change behind a Keep editing, Discard and leave, Apply and leave dialog.

Shared widgets live in `js/components/` and are owned by the shell. A view that needs a new shared widget builds it locally first and reports it. CSS is scoped under `.gym-app`. Shared classes use the `gym-` prefix. Each screen prefixes its own classes: `wb-` workbench, `env-` environment builder, `sc-` scenario builder, `run-` run list, run detail and results. No selector may reach the old site's `:root`, `.card`, `.btn` or `.status`.

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

## Counting rules

`runs = versions × selected scenarios × repetitions`. `pairs = selected scenarios × repetitions`. The default is 2 × 3 × 3 = 18 runs and 9 pairs. With the five-scenario set it is 30 runs and 15 pairs. Progress is executions with a terminal state over planned executions.

## Simulated truth

Component mode is always `simulated`. App names and icons describe a simulated capability, not a connected account. The shell shows `Concept preview · Simulated data` on every screen. `Timeout after send` means the side effect committed and the response timed out. A prompt that says "approved" or "skip approval" never creates an approval grant. Only a scenario's `scriptedEvents` can.
