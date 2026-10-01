# Plan: Runtime Validation in System Validation, backed by the Jev runtime demo — r3

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

**System Validation gets two tabs under its title.** They look like the Enterprise World Model's tabs but use their own classes, `.lt-tabs`/`.lt-tab`. The World Model controller (`index.html:1515`) selects every `.wm-tab` and `.wm-panel` on the page, so reusing those classes would wire these tabs into it. The site CSS adds `.lt-tab` to the existing `.wm-tab` rules (a selector list, no new look). The World Model's JS is not touched.

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
     - `Actions checked`: the pre_tool envelopes;
     - `Stopped before running`: those pre_tool envelopes whose gateway action does not execute (`hold_for_review`, `hold_for_approval`, `deny`, `stop_and_handover`). S5's post_tool ALERT, a finding after an executed payment, is not a stop, and neither is F1's lookup, which is allowed with an alert;
     - `Decided by a hard rule`: the same pre_tool set, `decided_by: rule`.
     - Each card's footer says "simulated · seed 7 · policy-v1 reference set". Policy Studio edits inside the frame do not change these cards; the frame's own KPIs follow the frame.
  3. **"How runtime validation works".** This is the same `run-steps` card as tab 1, with six steps:
     1. Capture the action (an OpenTelemetry-shaped span; simulated input)
     2. Hard rules (veto; no model can override)
     3. Jev judgment battery (one call, atomic questions)
     4. Policy (thresholds; gate or monitor per tool)
     5. Gateway action (allow / hold / block)
     6. Evidence (a simulated verdict envelope and SIEM JSON line, preview only; nothing leaves the browser)

     Pressing a scenario's **Run** animates these steps with the site's `runSteps()`. The result line underneath is then **computed from that scenario's envelopes**. Example: "SOC2 · 3 actions: `firewall.allowlist_ip` held for approval by rule `allowlist_change_approval`; 2 ran."
  4. **"Scripted scenarios".** Two side-by-side lists, **AP payments agent** (S1–S6, F1) and **SOC triage agent** (SOC1–SOC5). They stack on phones.
     - Each row: id, title, an outcome chip computed from the engine (for example "held · rule", "blocked · rule", "review · judge", "all ran"), and a **Run** button.
  5. **"Decision plane (simulated)".** The Jev demo in an iframe (`.studio-frame-wrap` sizing), loaded on first visit to the tab.
     - The mockup card's header (not the demo) has **Open full page ↗** (`#rtOpenFull`). It opens `jev-runtime/demo/index.html` without `embed` and keeps the frame's current `domain` and `seed`. It also passes `back` (§3) so the demo's back link returns to this tab.
     - **Run** on a scenario:
       - if the frame is already on that scenario's agent, it calls `__jevDemo.inject(id)` with no reload;
       - otherwise it reloads the frame on that agent (`?embed=1&domain=ap|soc&autoplay=0`) and injects once `__jevDemo.ready`.
       - Either way it then scrolls the frame into view, and the injected run is the selected card.
     - **The result line comes from the envelopes that this Run's `__jevDemo.inject(id)` returned,** using their gateway action and recorded mode. The frame may carry Policy Studio edits, and an injected span's id seeds its jitter, so the reference model cannot describe a particular run. The scenario-list chips and the metric cards are the **default-policy reference** and are labelled so.
     - **Run concurrency** is latest request wins. Each Run takes a request token, and every asynchronous step checks the token: the step animation's callback, the frame-ready wait and the inject. A stale step does nothing. While a run is starting, its Run button shows "Running…" and is disabled.
     - If the frame is not ready within 10 s, `#rtResult` shows an error ("The simulated demo did not load; open it full page") instead of a result.
- **Deep link:** `index.html#view=long-term&tab=runtime` (or `tab=periodic`) opens System Validation on that tab. The new handler acts only on a hash starting with `view=`. The Studio's existing `#studio` / `#studio=new` routes (`js/studio-host.js`) are left as they are, and any other hash is ignored.
- **`runSteps` becomes an explicit hook.** The site exposes `window.__siteRunSteps = runSteps` next to `__siteShowView` (`index.html:1553`), so the host module does not rely on an implicit global.
  - `runSteps(el, { ms, onDone, isCurrent })` gains an optional `isCurrent()` guard. Each scheduled timer checks it before touching a step's classes or calling `onDone`. A stale animation therefore cannot change a newer run's indicators.
  - The existing System Validation call passes no guard and behaves exactly as today.
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

- **Sync:** `tools/sync-jev-runtime.mjs <jev-checkout> <commit>` copies those paths with `git show <commit>:<path>`, never from a working tree.
  - It resolves `<commit>` to its full hash and records it.
  - It copies runtime files only: `.d.ts` type stubs are skipped.
  - It removes vendored paths that no longer exist upstream.
  - It rewrites `VENDORED.json`.
- **Integrity test:** `tests/site/jev-runtime-vendored.test.mjs` covers the vendored source files. It fails if any file differs from its manifest hash, if a manifest file is missing, or if an unlisted file appears under `demo/`, `js/` or `css/`. `README.md` and `VENDORED.json` are written locally and exempt. Local edits cannot drift silently; a change has to go upstream and be re-synced.
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
  - It is only accepted if the **decoded** value (from `URLSearchParams`) is a relative path: it starts with `./` or `../`, has no `//` and no scheme. Anything else keeps the default, `../index.html` "← Live console".
  - The unit test covers `javascript:`, `jav%61script:`, `//evil`, `%2F%2Fevil`, `https://x`, an empty value, a malformed value and a valid `../../index.html#view=long-term&tab=runtime`.
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
- **S13:** tab 1 is unchanged. Run System Validation still works, and the ids and history row are the same as before. After switching Periodic ↔ Runtime, the Enterprise World Model's tabs keep their active panel, and its arrow-key navigation still works.
- **S14:** tab 2's four metrics equal the model recomputed in the probe.
- **S15:** Run SOC2 animates the steps. The result line matches the envelopes. The frame shows the SOC agent (`__jevDemo.domain === 'soc'`) with the SOC2 run selected and "Held for approval · did not run". The same flow covers:
  - a second SOC run, which injects without a reload;
  - rapid SOC2 → S3 clicks, after which only S3's result, frame state and six step classes remain, and no Run button is left disabled;
  - in the same frame, setting `payments.execute` to monitor in the demo's Policy Studio and then running S3: the result line says the call ran (and would have been blocked), while the reference chip still reads its default-policy outcome and is labelled as the reference;
  - leaving the tab and coming back.
- **S16:** Run S3 switches the frame to the AP agent. Its run reads "Blocked · did not run".
- **S17:** the deep link opens tab 2, and `#studio` still opens Blueprint Studio. Open full page, after an AP run and after a SOC run, keeps the domain and seed, has no `embed`, and carries a correctly encoded `back`; following back returns to tab 2.
- **Claims check,** scoped to the host's `#rtSteps` and `#rtResult` (the unchanged iframe text is out of scope): no affirmative delivery claim. The text must not match `/\b(sent to|exported to|delivered to|forwarded to)\b|OTLP/i`, and it must contain "preview only".
- **S18:** no JS errors on the site or in the frame. No horizontal scroll at 1440 and 390 px. The simulated labels are visible.

`--base` live mode later re-checks S13, S14 and S17.

Upstream, Codex extends `demo-probes.ts` for `embed` and `back` (a bad `back` is ignored).

## 5. DOM contract (tab 2)

- `#long-term .lt-tabs [data-lt-tab="periodic"|"runtime"]` (role tab, `aria-selected`, arrow keys within this group only)
- `#ltPeriodic` (today's content, wrapped)
- `#ltRuntime`
- `#rtMetrics [data-rt-metric="scenarios|checked|stopped|rule"]`
- `#rtSteps .run-step` (six) and `#rtResult`
- `#rtScenarios [data-rt-scenario="S3"] [data-rt-run]` and `[data-rt-outcome]`
- `#rtFrameWrap iframe#rtFrame`
- `#rtOpenFull`
- `window.__jevRuntime = { ready, run(id), summary() }`
- `window.__siteRunSteps` (exposed by the site)

## 6. Deploy

- **This plan's builds stay on branches.** The jev repo change merges to its own `main` after the code gate; that repo's `main` is not deployed anywhere.
- **The silex-mockup merge is a public deploy.** It is fast-forwarded to `main` only after the code gate **and the user's go-ahead**, with screenshots shown first. After the push, the live site is read back with `--base` (S13, S14, S17), and the result is recorded in this log.

## 7. Not in scope

- No change to Blueprint Studio, the World Model (its JS is not touched; its tab CSS gains `.lt-tab` in a selector list), the other views, or the older `jev-observability/`, beyond one README line.
- No real model, no server and no persistence: the demo is in-browser and simulated.
- No rewording of tab 1's illustrative figures.

## Round 1 objections → changes (r2)

| # | Objection (who) | Change |
|---|---|---|
| 1 | The `.wm-tab` reuse collides with the World Model controller (`index.html:1515`) (Codex #1) | Own `.lt-tabs`/`.lt-tab` classes, sharing only the CSS selector list. The World Model JS is untouched. S13 checks the World Model's tabs and keys after switching. |
| 2 | The Evidence step implied an OTLP export the browser demo doesn't do; Capture implied live instrumentation (Codex #2) | Steps say "OpenTelemetry-shaped span; simulated input" and "simulated verdict envelope and SIEM JSON preview; nothing is sent". A claims check is added. |
| s | Codex suggestions | Latest-request-wins tokens, disabled Run while starting, a 10 s ready timeout with an error; metrics over the pre_tool set with non-executing actions (S5/F1 not stops), labelled a fixed reference set; manifest exemptions, full commit hash, stale-file removal; tests for Open full page, `#studio` and `back`. |
| s | DeepSeek suggestions | `window.__siteRunSteps`; same-agent Run injects without a reload; `back` validated after decoding, with encoded-scheme tests; the hash handler acts only on `view=` and leaves `#studio`; `.d.ts` not vendored; Open full page is the mockup card's link. |

## Round 2 objections → changes (r3)

| # | Objection (who) | Change |
|---|---|---|
| 1 | The claims check (no "sent") contradicted the required wording "nothing is sent" (Codex #1) | The wording is now "preview only; nothing leaves the browser". The check is scoped to `#rtSteps`/`#rtResult`, bans affirmative delivery phrases and OTLP, and requires "preview only". |
| s | Codex suggestions | The result line comes from that Run's inject envelopes; the chips and metrics are labelled default-policy reference; a monitor-edit test. `runSteps` gets an optional `isCurrent` guard, so a stale animation cannot touch a newer run's steps; the rapid-click test checks the six step classes and that no button is left disabled. |

### Plan gate outcome
- **r1:** `reviewer-codex` PLAN-REJECTED (2 objections). `coder-deepseek` PLAN-APPROVED (5 suggestions).
- **r2:** `reviewer-codex` PLAN-REJECTED (1 objection, a self-contradicting claims check). `coder-deepseek` PLAN-APPROVED.
- **r3:** approved by all three. `reviewer-codex`: PLAN-APPROVED. `coder-deepseek`: PLAN-APPROVED. PLANNER (claude): PLAN-APPROVED.
- **The user** had asked to plan and then execute. Per the standing instruction, the build starts once the review passes, and screenshots are shown before any deploy.
