# Speedrun

SILEX Speedrun is an embedded app, built into `speedrun/app/` from `speedrun/web/upstream/`, that shows agent-team performance and proposes changes. A visitor walks from the organization to a team, inspects a trace, and sends a variant to Agent Gym. Every figure is illustrative.

## Sub-features

- `sr-org` shows the Organization screen with coverage, KPIs and anomalies.
- `sr-team` shows a team's structure and the performance optimizer.
- `sr-trace` replays a team's trace.
- `sr-benchmarks` shows a team's benchmarks and the Benchmark Builder.
- `sr-variant` sends a change to Agent Gym with *Create variant*, which opens `#/handoff/speedrun/<team>-<change>` in the console's Agent Gym.
- `sr-url` keeps the console URL in step with the app route (`#view=speedrun&path=<app route>`).
- `sr-theme` switches between the dark and light theme from the app header and remembers the choice.

No journey covers Speedrun yet. The steps below were read from the page on 2026-11-15 and are the starting point for one.

## How to get to it (user POV)

- Choose Speedrun in the sidebar, under SILEX Speedrun.
- Open `#view=speedrun`, or a screen directly, for example `#view=speedrun&path=%2Fspeedrun%2Fteams%2Frefund%2Ftrace`.
- From an Agent Gym experiment that came from Speedrun, choose *View source in Speedrun*.

## Driving it with drive.mjs

Every selector is inside the frame, so pass `{ frame: '#speedrunFrame' }`.

- **Open a team.** `go('#view=speedrun&path=' + encodeURIComponent('/speedrun/teams/refund'))`, then wait until `document.getElementById('speedrunFrame').contentDocument` shows an `h1` or `h2` reading `Refund Team`.
- **Move inside the app.** The team's links are `a[href="#/speedrun/teams/refund/trace"]`, `a[href="#/speedrun/teams/refund/benchmarks"]` and `a[href="#/speedrun/teams/refund/builder"]`.
- **URL.** After a link is chosen, the console hash carries the new route in `&path=`.
- **Routes to cover.** `tools/site-shot.mjs` lists the screens it shoots in `SPEEDRUN_ROUTES`. Use the same list.

## Gotchas

- The app is a built bundle. Change `speedrun/web/upstream/` and run `node tools/build-speedrun.mjs` before driving; a stale `speedrun/app/` shows the old behaviour.
- The app renders after the frame's document is complete. Wait for text on the screen.
- The handoff to Agent Gym crosses two frames. After *Create variant*, the console switches to an Agent Gym view, so read `#gymFrame` next, not `#speedrunFrame`.
