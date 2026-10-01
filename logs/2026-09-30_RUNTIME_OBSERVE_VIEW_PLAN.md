# Plan: Runtime Observe as its own view — r1

Date 2026-09-30 · branch `runtime-observe-tab` from `main` `d84c94d` · roster: planner Claude, `coder-deepseek`, `reviewer-codex`; both gates unanimous.

**User request:** "把Jev runtime observability demo 功能独立出来作为一个新tab 放在 'System Validation' tab 上面, 'Enterprise World Model' 下面, tab名字叫 'Runtime Observe'". In English: split the Jev runtime demo out into its own left-nav entry named **Runtime Observe**, placed below Enterprise World Model and above System Validation.

## 0. Today

The demo lives inside System Validation as its second tab. `logs/2026-09-30_JEV_RUNTIME_VALIDATION_PLAN.md` is live at `d84c94d`:

- `#long-term` has `.lt-tabs` (Periodic | Runtime) at `index.html:1058`, a tab-specific subtitle `#ltSub` (`:1054`), `#ltPeriodic` and `#ltRuntime` (`:1093`).
- The controller is `ltSelect` at `:1614–1619`. The `#view=long-term&tab=…` hash goes through `applyViewHash` at `:1621`.
- `js/jev-runtime-host.js`:
  - is triggered by `ltSelect` calling `window.__jevRuntimeShown`;
  - checks `#ltRuntime` hidden at load (`:145`);
  - sets `BACK = '../../index.html#view=long-term&tab=runtime'` (`:9`).
- The left nav's **Environment** group is `security-model` (Enterprise World Model) then `long-term` (System Validation), at `:467–468`. `showView()` (`:1266`) already calls `studioShown()` for `blueprint`.
- S13–S19 in `tests/site/run-site-probes.mjs` drive the Runtime tab (10 references).

## 1. What the user sees

- **Left nav, Environment:** Enterprise World Model · **Runtime Observe** (new, icon `◉`) · System Validation.
- **New view `#runtime-observe`:**
  - Title row: **Runtime Observe** with a `?` help ("Watch each agent action as it happens and see what runtime validation decides before it runs. Simulated engine."), and the subtitle "Action-wise. Is each agent action safe to run, decided before it runs?"
  - Then today's Runtime tab content, unchanged and in the same order: lead line with the simulated pill, four reference metrics, the six-step orchestration, the scripted scenarios with Run, and the embedded demo with Open full page.
  - The breadcrumb reads `SILEX / Runtime Observe`.
- **System Validation goes back to its pre-integration form.** The tabs, `#ltSub` swap and `#ltControls` hiding are removed. The cadence select and Run System Validation button are always visible, and its markup is what it was before the Runtime Validation plan, except for the `ltPeriodic` wrapper, which is also removed.
- **Deep links:**
  - `index.html#view=runtime-observe` opens the new view.
  - The old `#view=long-term&tab=runtime` (already shared, and used by the demo's Back link in earlier full-page URLs) **redirects** to `#view=runtime-observe`, via `history.replaceState`.
  - `#view=long-term` opens System Validation.
  - `#studio` routes are unchanged.
- **Back link and full page:** the host's `BACK` becomes `../../index.html#view=runtime-observe`.
- **Definitions:** the `Runtime Validation` entry is renamed **Runtime Observe**, with the same text. The System Validation definition is unchanged.
- **Removed:**
  - the `.lt-tabs` / `.lt-tab` CSS and the `.lt-tab` entries in the shared `.wm-tab` selector lists, returning the World Model CSS to its pre-integration form;
  - `window.__siteLtSelect`.
- **Kept:** `window.__siteRunSteps` and the `runSteps` `isCurrent` guard.

## 2. Code

- **`index.html`** (planner):
  - nav button `data-view="runtime-observe"`;
  - `viewNames['runtime-observe']`;
  - the new `<section class="view" id="runtime-observe">` holding the moved `#ltRuntime` content, with the `lt` wrapper removed. Every `rt*` id is unchanged, so the DOM contract of the earlier plan §5 still holds, minus the tab hooks;
  - `showView` calls `window.__jevRuntimeShown()` for `runtime-observe`, like `studioShown`;
  - `applyViewHash` handles the redirect;
  - System Validation and the CSS restored as above.
- **`js/jev-runtime-host.js`** (planner):
  - `BACK`;
  - the load-time check becomes "is `#runtime-observe` the active view";
  - no other behaviour changes.
- **`tests/site/run-site-probes.mjs`** (Codex) updates S13–S19 to the new view:
  - **S13:** System Validation has no tabs; its ids, six steps and Run behaviour equal the pre-integration page; the World Model tabs work.
  - **S14–S19:** the same assertions, reached through the nav item or `#view=runtime-observe`.
  - **New in S17:** the old `#view=long-term&tab=runtime` hash lands on Runtime Observe with the hash rewritten; the nav order is Enterprise World Model, Runtime Observe, System Validation; the active nav and breadcrumb are correct.
  - **New in S18:** 390 px nav and view hygiene.
- **Docs** (planner):
  - README;
  - `logs/README.md`;
  - `jev-runtime/README.md`;
  - the guide's §8 in **both** repos (identical copies), with three new screenshots;
  - the jev-work-plan skill's URL and description;
  - the earlier plan log gets one dated pointer line to this plan; its body stays as written.

**DeepSeek's role:** a review seat only. There is no mechanical bulk here; a split would cost more than it saves.

## 3. Acceptance

| Suite | Expected |
|---|---|
| `node --test tests/site/*.test.mjs` | 20/20 |
| `run-site-probes.mjs` | 19/19, with the updated S13–S19 |
| jev repo | untouched, apart from the guide copy and the skill |

Screenshots to show before deploy: nav order, Runtime Observe top, a Run result, the embedded demo, System Validation restored, and 390 px.

**Deploy:** a push to `main` is a public deploy. The user's request names the change on the live site, but per the standing rule I show screenshots and ask before pushing `main`. After deploy, re-check the live site with `--base` (S1, S3, S4, S5, S13, S14, S17).

### Plan gate outcome and build notes

- **r1 approved by all three seats.** `reviewer-codex`: PLAN-APPROVED. `coder-deepseek`: PLAN-APPROVED. PLANNER (claude): PLAN-APPROVED.
- **Build notes** (non-blocking suggestions the build follows):
  1. **`showView` hook:** guarded, `if(id==='runtime-observe'&&window.__jevRuntimeShown)…`. The host keeps its own load-time check, now `#runtime-observe.classList.contains('active')`. Both paths are needed: a cold deep link runs before the deferred module, and later nav clicks go through `showView`.
  2. **`applyViewHash`:**
     - an allowlist of `runtime-observe` and `long-term`;
     - the legacy `view=long-term&tab=runtime` is checked first: `replaceState` to `#view=runtime-observe`, then `showView` in the same call, because `replaceState` fires no `hashchange`;
     - `long-term` with any other tab opens System Validation;
     - other `view=` values are ignored, as today;
     - `#studio` and `#studio=new` stay with `js/studio-host.js`.
     - **No URL synchronization is promised:** nav clicks still don't change the hash.
  3. **Clean-up:**
     - the `role=tabpanel`, `aria-labelledby` and `hidden` attributes leave with the wrappers;
     - "loads when you open this tab" becomes "this view";
     - `#ltSub` becomes a plain static `<p>`, without the id and `data-*` attributes.
  4. **Definition:** it keeps the anchor `def-runtimeval`. Its term becomes **Runtime Observe**, with wording that fits observing: "Watch each agent action as it happens and see what runtime validation decides before it runs (hard rules → judgment → policy). Shown with a simulated engine."
  5. **Probes:**
     - `back` expects `../../index.html#view=runtime-observe`;
     - "leave and return" becomes Runtime Observe → System Validation → Runtime Observe, keeping the same frame document, edited policy, selected run, result and steps;
     - lazy loading: no iframe until Runtime Observe is first opened, then exactly one;
     - System Validation shows no tabs or wrappers, and its controls are visible;
     - legacy-redirect checks for both a cold load and a hash change in an already loaded page;
     - the `--base` comment notes the nav-order check.
  6. **Docs, by path:**
     - `README.md`, `logs/README.md`, `jev-runtime/README.md`;
     - `docs/jev-runtime-guide/README.md` §8 and `jev-runtime-observability/docs/demo/guide/README.md` §8, identical, with screenshots 08–10 replaced;
     - `jev-runtime-observability/skills/jev-work-plan/SKILL.md`.

## Build and code gate

**Build:**
- **P1 (planner):** `3e4e3c5`. The System Validation section is byte-identical to `fbd598d`, checked by the planner and independently by both reviewers.
- **P2 (Codex):** S13–S19 updated. Docs and the guide's §8 in both repos (identical, screenshots 08–10 replaced): `4e90667`.

**Restarts during this run:**
- the fleet panes were restarted after the repo-folder rename;
- Codex's startup self-update pulled the revoked bnpm build (`ENOENT`), so it was reinstalled from public npm (0.159.3) before review.

| Round | Revision | reviewer-codex | coder-deepseek |
|---|---|---|---|
| r1 | `4e90667` | IMPL-APPROVED | IMPL-APPROVED |

- **PLANNER (claude):** IMPL-APPROVED.
- **Codex's doc suggestion, taken after approval:** `jev-runtime/README.md` now links this plan (docs only).
- **Results:** `node --test tests/site/*.test.mjs` 20/20; `run-site-probes.mjs` 19/19.
- **Deploy:** pending the user's go-ahead. Merging to `main` deploys the public site.
