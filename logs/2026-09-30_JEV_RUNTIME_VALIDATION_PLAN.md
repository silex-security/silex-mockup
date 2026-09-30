# Plan: Runtime Validation in System Validation, backed by the Jev runtime demo — r1

Date 2026-09-30 · branch `jev-runtime-validation` in `silex-mockup` (from `main` `fbd598d`) and `demo-embed` in `jev-realtime-observability` (from `main` `eb9b8e4`) · roster: planner Claude, `coder-deepseek`, `reviewer-codex`; both gates unanimous.

**User request:** "把Jev runtime observability demo 网页integrate到 silex-mockup, 建一个或者多个新目录给Jev demo用; 网页 'System Validation' 可以加一个 Runtime Validation 编排来给Jev demo; 请阅读silex-mockup 网站, 做plan来执行。" In English: integrate the Jev runtime observability demo page into silex-mockup, in one or more new directories for the Jev demo; add a Runtime Validation arrangement to the site's System Validation page to present it; read the site first, then plan and execute.

## 0. What the site and the demo are today (read from the code)

**silex-mockup** is one static `index.html`, about 249 KB.
- It has a left nav: Assurance · Agent Lifecycle (Blueprint Studio, Pre-release, PCP · Policy, Incident Queue) · Environment (Enterprise World Model, **System Validation**) · Workspace. `showView(id)` switches `<section class="view">`s, and there is no URL routing.
- Vercel serves the repo root and deploys every push to `main`. The site has no pull requests, and a push is a public deploy.
- **System Validation** (`index.html:1030–1068`, view id `long-term`) is "system-wise and periodic":
  - four metric cards;
  - a card of six `run-step`s, animated by `runSteps()` when "Run System Validation" is pressed;
  - a backtest-history table.
  - All its figures are illustrative.
- **Precedent for embedding a sub-app:** Blueprint Studio is a separate app in `blueprint_studio/`. `js/studio-host.js` loads it into an iframe on first visit (`.studio-frame-wrap`) and talks to it through the URL hash.
- **Tests:** `tests/site/run-site-probes.mjs` (headless Chrome, S1–S12; a `--base` mode re-checks the live site) and `tests/site/studio-bridge.test.mjs`.
- **Design tokens** (`:root` in `index.html:19`) are the same `--ink/--muted/--line/--blue/--green/--red/--amber`, Inter and IBM Plex Mono that the Jev demo already uses.

**An older Jev demo already lives in the site.** `jev-observability/` came from `logs/2026-09-27_JEV_OBSERVABILITY_PLAN.md` and is live at `/jev-observability/`.
- It is the AP-only first version: a span-stream layout, no Runs view, no SOC agent.
- `index.html` does not link to it.
- The current demo lives in `jev-realtime-observability/web/demo/` (`main` `590f89a`+). It adds the Runs layout shared with the live console (`web/js/runs.js`, `verdict.js`, `web/css/runs.css`) and the AP | SOC agent switch.
- That page is 26 files. Its only dependencies outside `web/demo/` are `../../../js/runs.js` (which imports `./verdict.js`) and `../css/runs.css`.

## 1. What the user sees

**System Validation gets two tabs under its title.** They use the site's own `.wm-tabs`/`.wm-tab` style, as on the Enterprise World Model:

```
System Validation ?                                  [Monthly ▾] [⟳ Run System Validation]   ← only on the first tab
System-wise. Is the broader enterprise environment still safe …
[ Periodic · environment-wide ]  [ Runtime · every agent action ]
```

- **Tab 1, "Periodic · environment-wide":** today's content, unchanged in markup, ids and behaviour.
- **Tab 2, "Runtime · every agent action"** (the Runtime Validation arrangement), top to bottom:
  1. **Lead line.** "Runtime validation checks each agent action as it happens, before it runs: hard rules → a Jev judgment battery → a policy in code. The gateway then allows, holds or blocks it. Below, a simulated engine runs the scripted scenarios; the judge, latencies and tenant are simulated."
     - A pill beside it: "Simulated judge · fictional tenant". This follows the site's "Simulated agents · illustrative data" pattern.
  2. **Four metric cards, computed and never typed.** They come from the vendored engine: every scripted scenario of both agents, default policy, seed 7.
     - `Scripted scenarios` (12: AP 7 + SOC 5);
     - `Actions checked` (pre_tool decisions);
     - `Stopped before running` (HOLD / BLOCK / REVIEW / STOP);
     - `Decided by a hard rule`.
     - Each card's footer says "simulated · seed 7 · policy-v1".
  3. **"How runtime validation works".** This is the same `run-steps` card as tab 1, with six steps:
     1. Capture the action (OpenTelemetry boundary span)
     2. Hard rules (veto; no model can override)
     3. Jev judgment battery (one call, atomic questions)
     4. Policy (thresholds; gate or monitor per tool)
     5. Gateway action (allow / hold / block)
     6. Evidence (verdict envelope → SIEM / OTLP)

     Pressing a scenario's **Run** animates these steps with the site's `runSteps()`. The result line underneath is then **computed from that scenario's envelopes**. Example: "SOC2 · 3 actions: `firewall.allowlist_ip` held for approval by rule `allowlist_change_approval`; 2 ran."
  4. **"Scripted scenarios".** Two side-by-side lists, **AP payments agent** (S1–S6, F1) and **SOC triage agent** (SOC1–SOC5). They stack on phones.
     - Each row: id, title, an outcome chip computed from the engine (for example "held · rule", "blocked · rule", "review · judge", "all ran"), and a **Run** button.
  5. **"Decision plane (simulated)".** The Jev demo in an iframe (`.studio-frame-wrap` sizing), loaded on first visit to the tab.
     - Its header has **Open full page ↗**.
     - **Run** on a scenario reloads the frame on that scenario's agent (`?embed=1&domain=ap|soc&autoplay=0`), injects the scenario when the demo reports `ready`, and scrolls the frame into view. The injected run is then the selected card.
- **Deep link:** `index.html#view=long-term&tab=runtime` opens tab 2. Only this pair is recognised; any other hash is ignored, as today.
- **Definitions** gains `Runtime Validation`: "Action-wise and continuous: each agent action is checked before it runs (hard rules → judgment → policy). Shown here with a simulated engine."

## 2. New directories

**`jev-runtime/` is a vendored, byte-identical copy** of the current demo and the three shared files. It keeps the jev repo's `web/` layout, so no import path is rewritten:

```
jev-runtime/
  demo/…            ← jev-realtime-observability/web/demo/** (index.html, css/, js/engine/, js/ui/)
  js/runs.js        ← web/js/runs.js
  js/verdict.js     ← web/js/verdict.js
  css/runs.css      ← web/css/runs.css
  VENDORED.json     ← source repo, commit, and sha256 of every file
  README.md
```

- **Sync:** `tools/sync-jev-runtime.mjs <jev-checkout> <commit>` copies those paths with `git show <commit>:<path>`, never from a working tree, and rewrites `VENDORED.json`.
- **Integrity test:** `tests/site/jev-runtime-vendored.test.mjs` fails if any file differs from its manifest hash, if a manifest file is missing, or if an unlisted file appears. Local edits cannot drift silently; a change has to go upstream and be re-synced.
- **The host module** is `js/jev-runtime-host.js`, a plain `.js` ES module (the lesson from the Studio cutover: no `.mjs` on static hosting). It:
  - builds tab 2;
  - computes the cards and chips by importing `jev-runtime/demo/js/engine/*.js`;
  - owns the iframe.
- **The pure summary model** is `js/jev-runtime-model.js`. Its `summarize(engine)` → `{ metrics, scenarios: [{ domain, id, title, outcome, lines }] }` has no DOM access and is unit-tested.
- **The old `jev-observability/` is left in place and unchanged**, because it is live and it was reviewed. Its README gains one line saying it is superseded by `jev-runtime/`. The site README and `logs/README.md` point to the new directory.

## 3. The one upstream change (jev-realtime-observability, `demo-embed`)

The demo needs two query options, added in the jev repo first and then vendored:

- **`?embed=1`** hides the brand row's title and the back link. The SIMULATED badge, agent switch and tabs stay. Page padding is reduced.
  - The agent switch already keeps other query parameters, so `embed=1` survives a switch.
- **`?back=<relative url>`** sets the back link's target and turns its label into "← Back".
  - It is only accepted if it is a relative path (`^\.{1,2}/` and no `//` or scheme). Anything else keeps the default, `../index.html` "← Live console".
  - The mockup's full-page link passes `back=../../index.html%23view=long-term%26tab=runtime`.

Both are covered by `tests/probe/demo-probes.ts`, which Codex extends. They must not change the default page: the existing 13 checks keep passing.

## 4. Tasks and ownership

**F0 (planner, alone, first):**
- the upstream `?embed` / `?back` change and a unit test for the `back` validation;
- `tools/sync-jev-runtime.mjs`, the vendored `jev-runtime/` at the upstream commit, `VENDORED.json` and the integrity test;
- the DOM contract for tab 2 (§5).

Acceptance: the vendored page opens at `/jev-runtime/demo/index.html` with no JS errors; the integrity test is green.

**D1 (deepseek):**
- `js/jev-runtime-model.js`;
- `tests/site/jev-runtime-model.test.mjs`, which checks:
  - metrics and outcomes equal an independent recomputation through `runStream`;
  - outcome chips for all 12 scenarios;
  - the result-line text for SOC2, SOC5 and S3.

**P1 (planner):**
- `index.html`: the tabs, tab-2 markup and CSS using site classes only, the Definitions entry and hash handling;
- `js/jev-runtime-host.js`: the iframe lifecycle, the Run → steps → inject flow, and sizing;
- READMEs and `logs/README.md`.

**P2 (codex):** `tests/site/run-site-probes.mjs` gains **S13–S18**:
- **S13:** tab 1 is unchanged. Run System Validation still works, and the ids and history row are the same as before.
- **S14:** tab 2's four metrics equal the model recomputed in the probe.
- **S15:** Run SOC2 animates the steps. The result line matches the envelopes. The frame shows the SOC agent (`__jevDemo.domain === 'soc'`) with the SOC2 run selected and "Held for approval · did not run".
- **S16:** Run S3 switches the frame to the AP agent. Its run reads "Blocked · did not run".
- **S17:** the deep link opens tab 2. Open full page carries `embed` off and a valid `back`, and following back returns to tab 2.
- **S18:** no JS errors on the site or in the frame. No horizontal scroll at 1440 and 390 px. The simulated labels are visible.

`--base` live mode later re-checks S13, S14 and S17.

Upstream, Codex extends `demo-probes.ts` for `embed` and `back` (a bad `back` is ignored).

## 5. DOM contract (tab 2)

- `#long-term .wm-tabs [data-lt-tab="periodic"|"runtime"]`
- `#ltPeriodic` (today's content, wrapped)
- `#ltRuntime`
- `#rtMetrics [data-rt-metric="scenarios|checked|stopped|rule"]`
- `#rtSteps .run-step` (six) and `#rtResult`
- `#rtScenarios [data-rt-scenario="S3"] [data-rt-run]` and `[data-rt-outcome]`
- `#rtFrameWrap iframe#rtFrame`
- `#rtOpenFull`
- `window.__jevRuntime = { ready, run(id), summary() }`

## 6. Deploy

- **This plan's builds stay on branches.** The jev repo change merges to its own `main` after the code gate; that repo's `main` is not deployed anywhere.
- **The silex-mockup merge is a public deploy.** It is fast-forwarded to `main` only after the code gate **and the user's go-ahead**, with screenshots shown first. After the push, the live site is read back with `--base` (S13, S14, S17), and the result is recorded in this log.

## 7. Not in scope

- No change to Blueprint Studio, the World Model, the other views, or the older `jev-observability/`, beyond one README line.
- No real model, no server and no persistence: the demo is in-browser and simulated.
- No rewording of tab 1's illustrative figures.
