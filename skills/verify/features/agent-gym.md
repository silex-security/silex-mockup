# Agent Gym

Agent Gym is one app, `agent-gym/index.html`, shown in the console in a single frame that four sidebar views share: Experiment Workbench, Environments, Scenarios and Runs & Results. A visitor picks an experiment, runs a baseline against a variant on scripted scenarios, and reviews the result. Every run is a deterministic simulation in the browser.

## Sub-features

- `gym-queue` lists every experiment with its stage and next action, and filters by stage and by text.
- `gym-url` keeps the console URL in step with the app route (`#view=<view>&path=<app route>`), so reload, Back and Forward reopen the same screen.
- `gym-workbench` configures and runs an experiment at `#/workbench/<experiment>` (not covered by a journey).
- `gym-environment` creates an environment at `#/environments/new` (not covered by a journey).
- `gym-scenario` creates a scenario set at `#/scenarios/new` (not covered by a journey).
- `gym-results` replays a run and records a review decision at `#/runs` (not covered by a journey).
- `gym-handoff` creates a pending experiment from Speedrun at `#/handoff/speedrun/<team>-<change>` (not covered by a journey).
- `gym-reset` clears the demo data from the *Concept preview · Simulated data* menu (not covered by a journey).

## How to get to it (user POV)

- Choose Experiment Workbench, Environments, Scenarios or Runs & Results in the sidebar, under Agent Gym.
- Open `#view=gym`, `#view=gym-environments`, `#view=gym-scenarios` or `#view=gym-runs`, with `&path=<encoded app route>` for a screen inside the part.
- Use the row of tabs inside the app (Workbench, Environments, Scenarios, Runs & results) to move between the parts.
- Open `agent-gym/index.html` on its own page from *Open full page* in the *Concept preview* menu.

## Driving it with drive.mjs

Journey: `skills/verify/journeys/gym-queue.mjs`. Every selector below is inside the frame, so pass `{ frame: '#gymFrame' }`.

- **Open.** `go('#view=gym')`, then wait until `document.getElementById('gymFrame').contentDocument` is complete and holds `button.gym-tab[data-tab="pending"]`. The app route is `#/experiments`.
- **Filter by stage.** `click('button.gym-tab[data-tab="pending"]', { frame: '#gymFrame' })`. The tabs are `all`, `pending`, `queued`, `running`, `needs_review` and `done`.
- **Read the rows.** Rows are `table.dt tbody tr.xq-row` with `data-experiment` and `data-stage`. The row count equals the number in the tab label, for example `Pending · 3`, and every row has that stage.
- **URL.** The app route becomes `#/experiments?status=pending`, and the console hash becomes `#view=gym&path=%2Fexperiments%3Fstatus%3Dpending`.
- **Reload.** `reload()`, then wait for the same route and rows.
- **Open an experiment.** The experiment name in a row is `a[data-focus-key="xq:open:<experiment>"]` and leads to `#/workbench/<experiment>`.
- **Proof.** `shot()` after the filter and after the reload.

## Gotchas

- State lives in `localStorage` under `silex.gym.demo.v2`. Each drive starts from the seeded demo data (9 experiments: 3 pending, 1 queued, 1 running, 1 needs review, 3 done). A journey that needs a finished run must run one through the page.
- The frame's `contentDocument` exists before the app has rendered. Wait for an element of the screen, not for `readyState` alone.
- `click` checks that the frame itself is not covered. A console modal or the open sidebar on a narrow window can cover it.
- Elements carry `data-focus-key`. Prefer it to text when a label is likely to be reworded.
- The seeded running experiment advances while the page is open, so do not assert on its progress figure.
