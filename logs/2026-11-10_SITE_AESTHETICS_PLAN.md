# Site aesthetics plan

Status: approved on 2026-11-10 with the default scope, direction and delivery. P0 to P3 are merged. P4 is built.

The demo console (`index.html`) grew view by view and has no shared visual system. This plan gives it one, then applies it to the shell, the Platform home and the data views. A visitor sees one product instead of five pages. A maintainer changes a colour or a type size in one file.

## Scope

In scope: the console shell, every view written in `index.html`, the `css/rt-*.css` and `swm/css` panels, the Agent Gym tokens, and the host rows around the embedded apps.

Out of scope: the inside of the Speedrun app (its dark theme follows the product design), the inside of Blueprint Studio, and `jev-runtime/` (vendored byte for byte). The direction is a refinement of the current light indigo look, not a rebrand.

## What the audit found

Evidence is ten screenshots at 1440x900 plus two extra sizes, and value counts over the inline CSS of `index.html`.

1. **No token discipline.** The inline CSS holds 118 distinct hex colours, 25 font sizes, 22 radii and 19 shadows (`node tools/style-audit.mjs`). 202 font-size declarations are under 12px. 108 elements carry inline `style`.
2. **Page width differs per view.** Platform is capped at 1060px and sits left at 1440px and off centre at 1920px. Every other view runs full width.
3. **Flat hierarchy on the home view.** The hero is text on grey. The 01 to 04 sections use the same white card at the same weight. The column beside the L1 to L4 card is empty except for one link.
4. **Four tab styles.** World Model, Runtime Observation, Incidents and Agent Gym each draw tabs differently.
5. **Three primary buttons.** Light indigo `#718aff` with white text (contrast 3.1:1, calculated, below the 4.5:1 text minimum), solid black, and outlined blue.
6. **Doubled headers around embedded apps.** Agent Gym shows "Agent Gym", its tab row, then "Experiment Workbench" twice. Speedrun shows a console title row above the app's own header. Blueprint Studio opens on an empty white box with one line of text.
7. **Sidebar icons are Unicode glyphs** and render differently per system font.

## Phases

One PR per phase, stacked in this order. Each ends in the checks under Verification.

### P0. Build the measuring tools

- `tools/site-shot.mjs`: screenshots every view at 1280, 1440 and 1920 wide, reusing `tests/site/ontology-card/browser.mjs`. Fails on page errors and on horizontal overflow.
- `tools/style-audit.mjs`: counts distinct colours, font sizes, radii and shadows per stylesheet and prints the table above.
- Commit the baseline screenshots and the baseline counts under `logs/site-aesthetics-2026-11-10/`.
- Found while building it: a fresh load of `#view=blueprint` never opened Blueprint Studio. Fixed in `js/studio-host.js` with `tests/site/studio-deeplink.test.mjs`.

### P1. One token file, no visible redesign

- Create `css/tokens.css`: colour roles (ink, muted, line, surface, accent, four statuses), a six-step type scale with a 12px floor, a 4px spacing grid, three radii, two shadows.
- Move the inline CSS of `index.html` to `css/console.css` and snap raw values to tokens with a codemod kept in `tools/`.
- Point `agent-gym/css/tokens.css` at the same values so the two cannot drift.
- Expected result: the pages look almost the same, slightly more regular. The audit counts drop to the token set.
- Built. `css/console.css` went from 118 raw colours to 1 (white), from 25 font sizes to 13 and from 22 radii to 10 (`node tools/style-audit.mjs`). `tests/site/style-budget.test.mjs` holds the line.
- Changed from the plan. The type scale has ten steps with a 10px floor, not six with a 12px floor. Raising 8px to 10px labels to 12px breaks the fixed-size diagram boxes, so that move happens per view in P2 and P5. The test counts text under 12px (202 today) and only lets the number fall.
- Changed from the plan. `--blue2` went from `#536bdb` to `#4a61d2` and the status text colours took the Agent Gym values, because the contrast test failed on the old ones (4.09:1 on the page background).

### P2. Shell and shared components

- One centred page container and one page-header pattern (title, one-line purpose, actions) for every view.
- One tab component, one KPI card, one badge set, one button set with a primary that passes 4.5:1.
- SVG icons in the sidebar.
- Review gate: before and after screenshots of all views, posted for your review.
- Built, waiting for review. Platform is centred at 1180px, cards use the small shadow, the three tab rows share one style, the hero button passes 4.5:1, and the sidebar icons are SVG masks keyed on `data-view`. After shots are in `logs/site-aesthetics-2026-11-10/p2-1440/`.
- Not done here. The KPI card and badge variants stay as they are until P5, where each view is touched anyway.

### P3. Platform home

- Give the hero a visual (the lifecycle rail as a diagram) and a clear primary action.
- Vary section weight so 01 to 04 do not read as four identical grids. Fill or remove the empty column.
- Review gate: before and after screenshots.
- Built, waiting for review. The hero is a dark band with the headline, a drawing of the four ontology tiers with one path lit, two actions and the four figures as one strip. Section numbers are chips, the five outcome cards end in text links, and the evidence section is two even columns with the I-1042 link inside the first card. After shots are in `logs/site-aesthetics-2026-11-10/p3-1440/`.

### P4. Embedded app frames

- Remove the doubled title rows around Agent Gym and Speedrun. Keep one header per screen.
- Give Blueprint Studio and the other frames a loading skeleton.
- Make the frame edge fit the dark Speedrun app.
- Built. The console's title row above Agent Gym and Speedrun is one line (product, status, one sentence, one action), which gives the app about 50px more height. Frames show a ring and a page outline while they open. The Speedrun frame has a dark edge. After shots are in `logs/site-aesthetics-2026-11-10/p4-1440/`.
- Not done here. The headers inside the apps are the apps' own and stay.

### P5. Data views

- Workflow Library table, Incidents & Decisions, Runtime Observation, Operations Overview and the World Model side panels move to the shared components. Fix spacing and empty states.

## Verification, every phase

- `node --test tests/` passes (61 site test files today).
- `node tools/site-shot.mjs` writes the full matrix with no page error and no overflow at 1280px.
- `node tools/style-audit.mjs` stays within the token budget from P1 onward. A test enforces it.
- Text tokens pass 4.5:1 against their surface, checked by a script.
- I read every screenshot before reporting a phase done.

## What this plan leaves out on purpose

The pstack multi-phase skeleton asks for ten live lanes and a perf gate per PR. This is a static mockup with no backend, so the plan uses the screenshot matrix and the test suite instead. Say so if you want the full gate.

## Open choices, with defaults

- **Scope.** Default: as above, embedded app interiors untouched.
- **Direction.** Default: refine the light indigo look. A darker or more editorial direction would need two or three prototypes first.
- **Delivery.** Default: six stacked PRs. P2 and P3 wait for your review of the screenshots.
