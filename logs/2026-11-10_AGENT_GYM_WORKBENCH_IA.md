# Agent Gym: one app in four console views

**Request (2026-11-10):** make the Experiment Workbench the core of Agent Gym, and rewrite, merge or delete the three older Agent Gym views (Pre-release, Scenario Expansion, System Validation). Later in the same change the owner asked for the embedded app to read as a console view, because its style was too different from the main site.

**Branch:** `gym-console`, from `e2c4dfc` on `agent-gym-v2`, with `8d7dd27` (the Gym palette retheme) merged in.

## What a visitor sees

- The Agent Gym group in the left nav has four views, in this order: **Experiment Workbench** (`#view=gym`), **Environments** (`#view=gym-environments`), **Scenarios** (`#view=gym-scenarios`) and **Runs & Results** (`#view=gym-runs`). The top rail and the home product map list the same four, because both are rendered from the sidebar by `js/suite-nav.js`.
- All four show one Agent Gym app (`agent-gym/index.html?embed=1`) in one frame, each at its own route: `#/workbench/exp-029`, `#/environments`, `#/scenarios`, `#/runs?status=all`. Each view's title row says Agent Gym, the part's purpose and *Open full page →*.
- The group description now describes the workbench loop: build a simulated environment, choose scenarios, run the baseline against a variant, keep the runs as evidence.
- Inside the app a slim row of tabs (Workbench, Environments, Scenarios, Runs & results) shows that the four parts are one product. The console's sidebar starts hidden on desktop, so this row is often the first place a visitor sees the parts.
- Embedded, the app leaves out its product header (logo, Agent Studio, Speedrun, Agent Gym, workspace menu), since the console has that chrome. *Reset demo data* moves behind the *Concept preview · Simulated data* marker at the end of the tab row. The page titles step down to 22 px and the subtitles to 13 px, so the console's title row stays the page heading. The page background is the console's gray and the frame has no border of its own, so there is no seam.
- The standalone page keeps its header and gains the tab row.

## How the console and the app stay in step

- **One frame, never reloaded.** The four views share one frame container placed after their sections; it is shown whenever one of them is active. Moving an iframe in the DOM reloads it, and a reload marks a running attempt *Paused after refresh*, so the frame never moves. The console changes the app's route through the frame's `location.hash`.
- **One mapping.** `agent-gym/js/sections.js` lists the four sections and the route names each owns. The app's tabs and `js/gym-host.js` both import it, and the console parses routes with the app's own `parse`. A test fails when a route belongs to no section or to two.
- **Both ways.** Opening a Gym view sends the app to that part's home route unless the site URL names a route. When a link inside the app opens another part (for example *View all runs* on the workbench), the host writes the site URL with `replaceState` first and then switches the console view, so the sidebar highlight, the rail and the breadcrumb follow. It listens to the app router's `subscribe` and to the frame's `hashchange`, so view-state changes and a leave-guard that puts a route back are both followed.
- **Links.** The site URL is `#view=<view>&path=<app route>`, with no path at a part's home route. Reload and shared links reopen the same screen. Back and Forward step through the app's routes and switch the console view with them.
- **Old links.** One table in `index.html`, `LEGACY_VIEWS`, sends `#view=short-term` and `#view=long-term` to Runs & Results and `#view=scenario-expansion` to Scenarios. The older `#view=long-term&tab=runtime` still opens Runtime Observation.

## What was removed

- The `short-term`, `long-term` and `scenario-expansion` sections of `index.html`, their sidebar buttons, `viewNames` entries, script wiring (`renderShortTerm`, the change feed fed by deployments and approved policies, System Validation's run and cadence handlers, the model-change card's handlers) and the CSS only they used (found with a script that lists classes nothing else names).
- The *Experiment Workbench* link out of the sidebar (`nav-ext`) and its CSS.
- The two 9/15 change-list rows and the two glossary entries that described the removed views.
- Scenario Expansion's modules and tests: `js/sx-*.js` (5), `css/sx-*.css` (4), `tests/site/sx-*.test.mjs` (6). `tests/site/sx-harness.mjs` stays, because three Runtime Observation tests use it; it now waits for `window.__gymHost` instead of `window.__sxView`, as does one probe in `tests/site/rt-onto-vision.test.mjs`.
- Links that pointed at the removed views now point at a Gym view: the home page's two Verification & Validation cards (Runs & Results, Environments) and the Overview's *revalidate* link (Experiment Workbench).

The content of the removed views (change-triggered revalidation, system-wide backtests, one attack varied by business conditions) is being folded into the app's Scenarios and Runs pages in a parallel change.

## Verified

- `node --test tests/site/*.test.mjs`: 366 tests, 364 pass, 2 fail, 0 skipped (374 of 374 passed before; 17 Scenario Expansion tests deleted, 9 added). Both failures are the same page: `#/environments/new` at 320 px is 330 px wide (336 px embedded). `agent-gym-v2` at `8d7dd27` fails the standalone case the same way (330 > 320) without this change, so the cause is in the environment builder after the palette retheme, not here.
- `node tests/site/run-site-probes.mjs`: 47 of 47 pass, S20 included. New S47 loads `#view=gym`, checks the frame and embed mode, switches the four views and back with one frame document, follows *View all runs* and an in-app tab to the sidebar, rail and breadcrumb, walks Back and Forward, opens `#view=gym-runs&path=…` cold and on a loaded page, and opens the three old links. With the host's view switch removed, S47 fails at `gym-runs at #/runs?status=all`, as expected.
- `node --check` on every `js/*.js` and every `agent-gym/js/**/*.js`: clean.
- Live clock, headless Chrome at 1440 × 900: starting on `#view=gym`, the seeded attempt went from 12 to 15 of 18 executions in 3 s, kept advancing through Environments, Scenarios, Runs & Results, Runtime Observation and back to the workbench, finished, and the next attempt started. Every attempt kept `runner: active`, and the frame document was the same object throughout, so nothing reloaded.
- 390 px: all four Gym views have page width 390 = scroll width 390, and the embedded app 362 = 362.
- Reference screens with the new tab row, standalone (`tools/gym-shot.mjs` sizes): N1 1585 × 992 page scroll 14 → 50 px, N2 1568 × 1003 0 → 34 px, N3 1586 × 992 13 → 49 px. The row is 36 px tall.
- Screenshots of the four views with the sidebar docked and hidden, and of `#view=library` for comparison, were read by eye: one header, the console's title row as the page heading, no frame border, the app's cards on the console's gray.
