# Runtime Observation scenarios

Runtime Observation shows one agent action being checked before it runs: hard rules, then the Jev judge, then policy. A visitor picks one of 34 scripted situations and watches where the action stops. It is simulated end to end.

## Sub-features

- `rt-run` runs the chosen scenario through the pipeline animation, from `READY` through `RUNNING` to `COMPLETE`.
- `rt-outcome` shows per action whether it was allowed, held for a person, or blocked, and by what.
- `rt-skip` jumps the animation to its end.
- `rt-stage-pause` pauses on a pipeline stage when it is clicked and resumes on the second click (not covered by a journey).
- `rt-trace` plays the gate trace waterfall of the same run under the pipeline (not covered by a journey).
- `rt-tabs` switches between Scenarios, Decision plane, Learning loop, Ontology, Agent fleet and Judge latency (not covered by a journey).
- `rt-plane-link` opens the same run in the Decision plane tab (not covered by a journey).

## How to get to it (user POV)

- Choose Runtime Observation in the sidebar, under SILEX Runtime.
- Open `#view=runtime-observation`. A tab opens directly with `&tab=plane`, `learning`, `ontology`, `fleet` or `latency`.
- On the Scenarios tab, pick a situation from the Scenario dropdown. It runs at once. Run repeats it.

## Driving it with drive.mjs

Journey: `skills/verify/journeys/runtime-scenario.mjs`.

- **Open.** `go('#view=runtime-observation')`. `#rtStatus` reads `READY`, and `#rtScenarioSelect` holds 34 options with a value.
- **Run a scenario.** `choose('#rtScenarioSelect', 'S1')`, then wait for `#rtStatus` to read `RUNNING`.
- **Finish.** `click('#rtPipeSkip')`, then wait for `#rtStatus` to read `COMPLETE`. Without Skip the animation takes several seconds per action.
- **Read the outcome.** `#rtPipeCaption` names the last action and its decision. `#rtScenWhat` describes the scenario.
- **Allowed case.** S1 is the ordinary payment. It ends `Action 3 of 3 · payments.execute · allowed by policy`.
- **Blocked case.** S3 is the over-limit payment. It ends on its first action with `blocked by rule amount_limit`.
- **Repeat.** `click('#rtRunBtn')` runs the chosen scenario again.
- **Proof.** `shot()` after each `COMPLETE`. The picture shows the status chip, the outcome chip and the stage where the action stopped.

## Gotchas

- The scenario picker is a native `<select>`. Use `choose`, because its popup is drawn by the OS and is not in the page.
- Scenario ids S1 to S12 are the AP and SOC reference set that the KPI row counts. The other 22 are the creator-platform scenarios. The option text states the expected outcome, for example `S3 · Over-limit payment (blocked · rule)`.
- The gate trace under the pipeline plays only when it scrolls into view, so its counters can still read 0 in a screenshot taken right after `COMPLETE`.
- `#rtFrame` (the embedded Jev runtime demo) is hidden on the Scenarios tab. Other tabs show it; wait for its `contentDocument` before reading it.
