# Plan: Runtime Observation — replace the six-step text with a live pipeline animation — r3

Date 2026-10-02 · branch `runtime-pipeline-visual` from `main` `200f5f4` (= `origin/main`, fetched and fast-forwarded before branching) · roster: planner Claude, `coder-deepseek` (OpenCode, `deepseek/deepseek-v4-pro`; `deepseek-reasoner` is not offered on this machine), `reviewer-codex` (`gpt-5.5`); both gates unanimous. The Codex seat reviews only (no build slice): its weekly limit showed 7 % left at start.

**User request:** "https://silex-mockup.vercel.app/ 'Runtime Observation' Tab，页面上的 'How runtime validation works' 位置不太合理，因为 'Scripted scenarios' 在跑的时候是看不到这个内容的，里面的 steps 用户不太好理解，找出方案把文字改成动态图片。"

In English: (a) the *How runtime validation works* card sits where you cannot see it while you press **Run** in *Scripted scenarios*; (b) its six text steps are hard to understand; (c) replace the text with an animated picture.

## 0. Today (`index.html` at `200f5f4`)

- View `#runtime-observation`, `index.html:1101–1148`. Order: lead card · four metric cards · `#rtReference` · **How runtime validation works** (`#rtSteps`, six `.run-step` rows, `#rtStatus`, `#rtResult`, `:1116–1129`) · *The judge learns from your reviewers* (`#rtLearning`, `:1130–1138`) · **Scripted scenarios** (`#rtScenarios`, `:1139–1142`) · Decision plane (`#rtFrameWrap`, `:1143–1146`).
- At 1440×2600 the steps card is ~700 px above the first Run button, with the learning card (~410 px) between them. At a 900 px viewport the steps and the Run buttons are never on screen together.
- `js/jev-runtime-host.js` `run(id)` (`:86–123`): animates the six rows with `window.__siteRunSteps` (260 ms per row, the same for every scenario, so the animation says nothing about this run) while the frame loads, injects the scenario into the iframe, writes `describeRun(envs)` into `#rtResult`, then `scrollIntoView` to the frame.
- `window.__siteRunSteps` (`index.html:1341`) is shared with System Validation (`#ltSteps`); it stays.
- Probes touching the old card: `tests/site/run-site-probes.mjs` lines 317, 325, 331–339, 382, 427–428, 482–483 (`#rtSteps` classes), 442 (learning card follows the orchestration card). `claims()` (`:284`) requires the text "preview only", which today lives only in the removed step 6. Line 461 is S21's **Try the loop** scroll-to-demo check; it stays (Try the loop keeps scrolling). No existing probe asserts Run's auto-scroll.
- Guide: `docs/jev-runtime-guide/README.md:177` lists the card.

### Engine facts the picture must respect (computed with `runStream`, `DEFAULT_POLICY`, seed 7, script in §6)

| Scenario | pre_tool actions → `tool:decided_by:action` |
|---|---|
| S1 | erp.get_po:policy:allow · vendor.lookup:policy:allow · payments.execute:policy:allow |
| S2 | payments.execute:jev:hold_for_review |
| S3 | payments.execute:rule:deny |
| S4 | payments.execute:rule:hold_for_approval |
| S5 | payments.execute:policy:allow (post_tool alert → chip "ran · flagged") |
| S6 | email.send:rule:deny |
| F1 | vendor.lookup:fallback:allow_and_alert · payments.execute:fallback:deny (`jev_status: timeout`) |
| SOC1 | siem.search · firewall.block_ip · ticket.update, all policy:allow |
| SOC2 | siem.search:policy:allow · firewall.allowlist_ip:rule:hold_for_approval · ticket.update:policy:allow |
| SOC3 | siem.search:policy:allow · identity.suspend_user:rule:hold_for_approval |
| SOC4 | siem.search:policy:allow · webhook.post:rule:deny |
| SOC5 | siem.search:policy:allow · identity.suspend_user:policy:allow · identity.suspend_user:jev:hold_for_review ×2 |

24 actions in total, matching the "Actions checked" card. 1–4 actions per scenario.

**A rule decision does not skip the judge.** S3/S4 envelopes still carry 5 judge answers, with `jev_on_critical_path: false`. The picture must show the judge as *ran, not deciding*, never as *skipped*. F1 has `jev_status: "timeout"`, `risk: null`, and the decision `decided_by: "fallback"`: `vendor.lookup` fail-open (`fallback.fail: "open"`), `payments.execute` fail-closed. Each envelope has `reasons[]` and `rule_hits[]` for the caption.

## 1. What the user sees

### 1.1 Placement

New order of the view: lead · metrics · `#rtReference` · **Scripted scenarios with the live pipeline** · *The judge learns…* · Decision plane.

- The *How runtime validation works* card is **removed**. Its role moves into the *Scripted scenarios* card, which now reads, top to bottom:
  - card head: **Scripted scenarios** · "Press **Run**: each of the agent's actions goes through the pipeline below." · `#rtStatus` chip (moved here; Ready / Running / Complete / Error as today);
  - **`#rtPipeline`**, the animated picture (§1.2), full card width, ~190 px tall on desktop;
  - `#rtResult` (moved here, unchanged text) plus a "See this run in the decision plane ↓" link (`#rtSeeRun`) that scrolls to the frame (hidden until a Run completes);
  - the two scenario lists, as today.
- So the picture sits directly above the Run buttons. At 1440×900, with the card head at the top of the viewport, the pipeline and every Run button are on screen together (probe R4).
- **Run no longer auto-scrolls to the frame.** Scrolling away would hide the animation the user just asked to see. The `#rtSeeRun` link replaces it (probe R9). **Try the loop keeps its scroll** (S21:461 unchanged). On narrow screens (<900 px), where the lists stack and a lower Run button can be below the pipeline, Run scrolls the pipeline into view with `block: 'nearest'` before playing.

### 1.2 The picture (`#rtPipeline`, inline SVG + HTML captions)

A left-to-right flow, one lane, with a fork at the end:

```
 [Agent action] → [Hard rules] → [Judge (Jev)] → [Policy] ─┬─► Allow  ✓ runs
   tool call       fixed checks    model answers    turns       ├─► Hold   ⏸ waits for a person
   it wants        can veto alone  risk questions   answers     └─► Block  ✕ never runs
                                                    into a                │
                                                    decision        [Evidence] record of the decision
```

- Each stage is a rounded box with a small icon and a **one-line plain-language caption** under it (the text above). These replace the old jargon ("OpenTelemetry-shaped span", "atomic questions", "thresholds · gate or monitor per tool"); the jargon stays in the help `?` tooltip and the guide.
- A **token** (a pill with the tool name, e.g. `payments.execute`) travels box to box. Each box it passes turns green ✓ (passed), or turns its outcome colour where the decision is made:
  - `decided_by: rule` → Hard rules box turns red/amber with the rule id (`amount_limit`). The judge box shows **"ran · not deciding"** (grey dashed), Policy is bypassed, token exits through Hold or Block.
  - `decided_by: jev` → rules ✓, Judge box turns amber/red with the triggering reason from `reasons[0]` (e.g. "payee_mismatch: risk 0.855 ≥ review 0.4"), Policy applies the threshold, exit by the envelope's action (Hold or Block; the reference set only has Hold).
  - `decided_by: policy` → rules ✓, judge ✓ (low risk), policy ✓, exit Allow.
  - `decided_by: fallback` → Judge box shows **"timed out"** (hatched), Policy box state `fallback`, labelled from `env.fallback.fail`: "fallback · fail-open" or "fallback · fail-closed"; exit by the envelope's action. F1: `vendor.lookup` fail-open → Allow + alert badge; `payments.execute` fail-closed → Block.
  - `mode: monitor` with `would_have ≠ ALLOW` → the deciding box keeps its hit colour but is outlined dashed with "monitor" under it, exit Allow, with a badge "monitor mode · would have been blocked/held", so a red box feeding a green exit reads as intended.
  - Then the token drops into **Evidence**, which increments a small counter ("2 records"). The Evidence box caption reads "record of the decision · preview only; nothing leaves the browser" (the claim the removed step 6 carried; `claims()` reads it from `#rtPipeline`).
- **Caption line** (`#rtPipeCaption`, `aria-live="polite"`): "Action 2 of 3 · firewall.allowlist_ip · held for approval by rule allowlist_change_approval — <reasons[0]>" (format in §2.1). The rule id comes from `rule_hits[].id`, the text after the dash from `reasons[0]`. Built only from the envelope.
- Pace: ~1.4 s per action (SOC5, 4 actions ≈ 6 s). A **Skip** button jumps to the final frame.
- `prefers-reduced-motion: reduce`: no travel animation and **no per-action timers**: `replay()` renders every action's final state and dots in one synchronous pass, sets mode `done`, and resolves on the next microtask.

### 1.3 States

- **Idle (before any Run)**: a slow loop over three **real reference envelopes** from the default-policy reference set: S1 `payments.execute` (Allow, policy), S2 `payments.execute` (Hold, judge), S3 `payments.execute` (Block, rule). Caption prefix: "Example · S3 · default-policy reference". This shows all three exits before anyone presses Run. The loop runs only while the view is active, the pipeline is on screen (IntersectionObserver) and the tab is visible. It does not run under reduced motion (a static frame of S3 instead).
- **Replay (after Run)**: the host injects the scenario into the frame as today, takes the **envelopes the frame returned** (so Policy Studio edits show up), and replays their `pre_tool` actions in order. Caption prefix: "This run". Status Running → Complete when the replay ends. `#rtResult` is written when the replay ends (same `describeRun` text).
- **Done**: the last action's final frame stays, with every action's verdict as a row of small dots under the token lane (one per action, coloured by exit; hover/focus shows the caption). Idle loop does not resume until the view is re-entered.
- **Superseded**: a newer Run (or Try the loop) cancels the replay at once (same token guard as today); the pipeline resets and plays the new run.
- **Error** (frame not ready in 10 s): the host calls `pipeline.error(message)`; the pipeline shows a static frame, mode `error`, caption = message ("The simulated demo did not load; open it full page."), alongside today's `#rtResult` error.

### 1.4 Claims

- The picture shows only what the envelopes say. No invented latencies, no animated numbers that are not in the envelope.
- The pill "Simulated judge · fictional tenant" stays in the lead card; the pipeline's corner carries a small "simulated" tag.
- Forbidden words per the existing `claims()` probe check apply to the pipeline text.

## 2. Contract (written before dispatch; DeepSeek, Codex and planner build against it)

### 2.1 `js/rt-pipeline.js` (ES module, no dependencies)

```js
export function traceOf(env)
// Pure. env = one pre_tool envelope. Returns
// { tool, exit: 'allow'|'hold'|'block', decidedAt: 'rules'|'judge'|'policy'|'fallback',
//   decidedBy: env.decided_by, stages: { rules, judge, policy } each one of
//   'pass'|'hit'|'ran-not-deciding'|'timeout'|'down'|'bypassed'|'fallback',
//   fallback: null | { fail: 'open'|'closed' },              // from env.fallback.fail
//   monitor: null | { wouldHave: 'blocked'|'held for approval'|'held for review'|'stopped' },
//   alert: boolean, ruleIds: string[], reason: string|null, caption: string }
// exit: allow|allow_and_alert → allow; hold_for_review|hold_for_approval → hold; deny|stop_and_handover → block.
// Stage rules: rule → {rules:'hit', judge:'ran-not-deciding', policy:'bypassed'};
//   jev → {rules:'pass', judge:'hit', policy:'pass'}; policy → all 'pass';
//   fallback → {rules:'pass', judge: env.jev_status==='down' ? 'down' : 'timeout', policy:'fallback'}.
// caption (the one format; renderer and unit tests use it): "<tool> · <verdict words> by <who> — <reasons[0]>"
//   who = "rule <ids joined ', '>" | "the judge" | "policy" | "fallback (fail-open)" | "fallback (fail-closed)";
//   verdict words: allowed | held for review | held for approval | blocked | stopped; "allowed" for monitor-mode passes,
//   followed by " (monitor mode · would have been <wouldHave>)". The pipeline prefixes "Action i of n · ".
// Unknown action or decided_by → throws (probe-visible), never guesses.

export function mountPipeline(root, { reducedMotion = false } = {})
// Renders the SVG + captions into root. Returns
// { idle(examples: {id, env}[]), replay(envs, { isCurrent }) → Promise<'done'|'stale'>,
//   skip(), stop(), reset(), error(message) }
// replay() filters to boundary==='pre_tool' itself, in array order. reducedMotion → one synchronous pass (§1.2).
```

### 2.2 DOM hooks (probes read these, not pixels)

- `#rtPipeline[data-mode="idle|replay|done|error"]`, `[data-action-index]` (1-based), `[data-action-count]`, `[data-source="reference|run"]`.
- Stage boxes `[data-stage="action|rules|judge|policy|evidence"][data-state="idle|active|pass|hit|ran-not-deciding|timeout|down|bypassed|fallback"]`.
- Exits `[data-exit="allow|hold|block"][data-lit]`.
- Token `#rtToken[data-tool]`. Caption `#rtPipeCaption`. Skip `#rtPipeSkip`. Per-action dots `#rtPipeDots > [data-exit]`.
- Moved, unchanged ids: `#rtStatus`, `#rtResult`. New: `#rtSeeRun`. Removed: `#rtSteps`.

### 2.3 `js/jev-runtime-model.js` addition

`export function referenceExamples({ seed = 7 } = {})` → `[{id:'S1', env}, {id:'S2', env}, {id:'S3', env}]`, the `payments.execute` pre_tool envelope of each, from `runStream` at `DEFAULT_POLICY`. No other change to the module.

### 2.4 Styles

`css/rt-pipeline.css`, linked from `index.html`. Uses only the site tokens (`--ink --muted --line --soft --blue --green --green-bg --amber --amber-bg --red --red-bg --mono`) and the site font. All selectors scoped under `#rtPipeline`.

## 3. Tasks and file ownership

Each owner touches only the files in its list. Report needed changes elsewhere; don't make them.

| # | Owner | Files | Task | Acceptance |
|---|---|---|---|---|
| 1 | planner | `index.html`, `js/jev-runtime-host.js` | Foundation first, **one atomic checkpoint**: remove the steps card, move `#rtStatus`/`#rtResult` into the scenarios card, add the empty `#rtPipeline` mount, `#rtSeeRun`, the CSS link, card order per §1.1; **and** in the host, drop both `#rtSteps` uses (`run()`'s `__siteRunSteps` call and `rtTryLoop`'s reset) in favour of a local no-op stub with the §2.1 API, so Run and Try the loop work. Checkpoint-commit, then dispatch 2. | Page loads, no JS errors; Run S3 completes with the right `#rtResult`; Try the loop works |
| 2 | deepseek | `js/rt-pipeline.js`, `css/rt-pipeline.css`, `js/jev-runtime-model.js` (§2.3 only), `tests/site/rt-pipeline.test.mjs`, `tests/site/jev-runtime-model.test.mjs` | Build §1.2–1.3 against §2. Unit tests: `traceOf` over all 24 reference envelopes matches the §0 table and the §2.1 stage rules (rule-decided → judge `ran-not-deciding`, policy `bypassed`; F1 `vendor.lookup` → judge `timeout`, policy `fallback`, `fallback.fail` 'open', exit allow, alert true; F1 `payments.execute` → fail 'closed', exit block); captions use `rule_hits[].id` for rule ids; a monitor-mode envelope (S3 with `payments.execute` in monitor) → exit allow + wouldHave 'blocked'; unknown action throws; `referenceExamples()` ids and decided_by are policy/jev/rule. | `node --test tests/site/*.test.mjs` green |
| 3 | planner | `js/jev-runtime-host.js` | Replace the stub with `mountPipeline`. Wire it: idle loop on view show with `referenceExamples()`; `run()` waits for frame + inject, then `replay(envs)`, then result/status; cancel on new Run / Try the loop (Try keeps its scroll); `pipeline.error()` on frame timeout; no auto-scroll on Run; narrow-screen `nearest` scroll; `#rtSeeRun`. | Probes R1–R9 |
| 4 | planner | `tests/site/run-site-probes.mjs` | Update probes that read `#rtSteps` (lines 317, 325, 331–339, 382, 427–428, 482–483) to the pipeline hooks; `claims()` call sites read `#rtPipeline` + `#rtResult` text; line 442 becomes "learning card follows the scenarios card"; line 461 (Try the loop scroll) unchanged. Add R1–R9 (§4). Prove at least R2 and R5 fail on a deliberately broken host (e.g. replay of the reference envs instead of the frame's). | all R-probes pass; prior probes keep their pass count |
| 5 | planner | `docs/jev-runtime-guide/README.md`, `logs/README.md`, this plan | Guide line 177 → pipeline description; changelog; outcome. | — |

## 4. Acceptance probes (headless Chrome, `run-site-probes.mjs`)

- **R1 Idle:** on entering the view, `#rtPipeline[data-mode=idle][data-source=reference]` cycles S1→S2→S3; the S3 frame shows rules `hit`, judge `ran-not-deciding`, exit `block`. Caption starts "Example ·". Leaving the view stops it (no further `data-action-index` changes).
- **R2 Replay matches the frame:** for S3, SOC2, SOC5 and F1, after Run the sequence of (`data-tool`, lit exit, the rules/judge/policy `data-state` triple) equals `traceOf` (imported by the probe) of the frame's `__jevDemo` envelopes for that run, in order; `data-action-count` equals their pre_tool count. `#rtResult` text equals `describeRun` of the same envelopes (existing `rtResult` helper).
- **R3 Monitor mode:** with `payments.execute` set to monitor in Policy Studio, Run S3 → exit `allow`, badge contains "would have been blocked".
- **R4 Visible while running:** at 1440×900, for every scenario's Run button, at the moment replay starts `#rtPipeline` and the clicked button both intersect the viewport. At 390×844, for S1 (top of the stacked list) both intersect; for SOC5 (bottom) `#rtPipeline` is fully in the viewport during replay (after the `nearest` scroll).
- **R5 Supersede:** Run SOC5 then S3 within 300 ms → final `data-source=run`, count 1, tool `payments.execute`, exit `block`; no SOC5 dot remains; status Complete.
- **R6 Reduced motion:** with `prefers-reduced-motion: reduce` emulated, Run S1 completes with no CSS transitions on `#rtToken` and final mode `done` within 500 ms of the frame being ready; no idle loop.
- **R7 Skip:** pressing `#rtPipeSkip` during SOC5 → mode `done`, 4 dots, result written.
- **R8 Hygiene and error:** no console errors on the view; `claims()` passes on `#rtPipeline` + `#rtResult` text ("preview only" present); with the frame's `__jevDemo.ready` forced false, Run → after 10 s `#rtPipeline[data-mode=error]`, caption = the error message, status Error; no horizontal scroll at 390 px; `#rtSteps` absent; `#ltSteps` (System Validation) still animates via `__siteRunSteps`.

- **R9 No Run scroll; See this run:** at 1440×900 after Run S3 completes, `scrollY` is unchanged from replay start (± 2 px) and `#rtFrameWrap` top is below the viewport; `#rtSeeRun` is visible; clicking it brings `#rtFrameWrap` to the top third (same check as S21:461).

Existing suites must keep their pass counts (unit `node --test`, site probes, `probe-swm.mjs`).

## 5. Out of scope

- The vendored demo under `jev-runtime/demo/` (unchanged; `jev-runtime-vendored.test.mjs` guards it).
- System Validation's six-step card (same text-steps pattern; not asked).
- The learning card's content.
- A GIF/video asset. Considered and rejected: a baked GIF cannot follow the run the user pressed, cannot reflect Policy Studio edits, does not theme, and is not accessible. SVG driven by the envelopes does all four.

## 6. Method for the numbers in §0

```bash
node -e '(async()=>{const {runStream}=await import("./jev-runtime/demo/js/engine/router.js");const {TENANT,scenariosFor}=await import("./jev-runtime/demo/js/engine/scenarios.js");const {DEFAULT_POLICY}=await import("./jev-runtime/demo/js/engine/types.js");for(const d of ["ap","soc"])for(const t of scenariosFor(d)){const e=runStream(t.spans,{tenant:TENANT,policy:DEFAULT_POLICY,seed:7}).filter(x=>x.boundary==="pre_tool");console.log(t.scenario,e.length,e.map(x=>x.tool.name+":"+x.decided_by+":"+x.action).join(" | "))}})()'
```

## Review record

Review base: `200f5f4` (`200f5f4ccc17ad738352243e0f7204c2d1772876`); every code-gate diff is `git diff 200f5f4`.

### Round-1 objections → changes

Verdicts r1: DeepSeek PLAN-REJECTED (3), Codex PLAN-REJECTED (2).

| Objection (who) | Change |
|---|---|
| 1 (Codex): Task 1 removes `#rtSteps` while the host still calls `__siteRunSteps` on it; foundation can't pass "Run works" | Task 1 is now one atomic checkpoint over `index.html` + `js/jev-runtime-host.js` with a no-op pipeline stub (both files were already the planner's) |
| 2 (Codex): no API for the error state | `error(message)` added to §2.1; §1.3 Error rewritten; probed in R8 |
| 1 (DeepSeek): "preview only" claim lost, `claims()` would fail | Evidence box caption carries "preview only; nothing leaves the browser" (§1.2); `claims()` reads `#rtPipeline`; R8 asserts it |
| 2 (DeepSeek): fallback under-specified, F1 `vendor.lookup` is fail-open | `decidedAt: 'fallback'`, policy state `fallback`, `fallback.fail` in the trace; label from the envelope; unit tests pin both F1 actions |
| 3 (DeepSeek): probe scope wrong (461 is Try the loop; 482–483 missing; no probe for no-scroll / `#rtSeeRun`) | §0 citations corrected; 461 kept; 482–483 added to Task 4; new R9 |
| Non-blocking, folded in (both) | R4 names S1/SOC5 per width; Try-the-loop reset in Task 1; rule id from `rule_hits[].id` (`allowlist_change_approval`), text from `reasons[0]`; jev exit Hold or Block; reduced motion = one synchronous pass, no timers |

### Round-2 verdicts and r3 folds

Verdicts r2: DeepSeek PLAN-APPROVED, Codex PLAN-APPROVED. r3 folds in non-blocking suggestions only, so it goes back to both for confirmation.

| Suggestion (who) | Change |
|---|---|
| §0 F1 parenthetical says fail-closed only (DeepSeek) | both fail modes named |
| Judge state hardcoded `timeout`; engine also has `jev_status: down` (DeepSeek) | fallback judge state from `jev_status` (`timeout` / `down`); state added to §2.2 |
| Caption format differs between §1.2 and §2.1 (DeepSeek) | one format defined in §2.1; §1.2 points to it |
| R2 "deciding stage" ambiguous (DeepSeek) | R2 compares the rules/judge/policy state triple to `traceOf` imported by the probe |
| Monitor mode: red box into green exit may confuse (DeepSeek) | dashed outline + "monitor" label on the deciding box |
| §1.1 "every Run button" vs R4 testing two (Codex) | R4 checks every Run button at 1440×900 |

### Plan gate: passed on r3 (3 rounds)

- `coder-deepseek`: PLAN-APPROVED (r3)
- `reviewer-codex`: PLAN-APPROVED (r3)
- PLANNER (claude): PLAN-APPROVED (r3)

Two r3 nits are left to implementation (no plan change): the fallback bullet in §1.2 also covers `down`, as §2.1 says; R4 resets the scroll to the card head before each click.

## Code gate record

Diff revisions are `git hash-object` of `git diff 200f5f4 -- . ':!*.png'`.

| Round | Revision | DeepSeek | Codex | Defects → fixes |
|---|---|---|---|---|
| r1 | `73d41a9a` | IMPL-APPROVED | IMPL-REJECTED (3) | (1) a new Run left the previous run's frame and dots up while the frame loaded → host calls `pipeline.reset()`; (2) `error()` kept stale dots and metadata → cleared; (3) idle Evidence said "0 records" after an example passed it → "1 record" per example. Each got an assertion (S41, S42, S39/S41), shown to fail with its fix reverted. Also the Google Fonts link indentation (DeepSeek nit). |
| r2 | `83b65879` | IMPL-APPROVED | IMPL-REJECTED (1) | Monitor styling took the deciding box's colour from the enforced allow exit, and a fallback had no monitor outline → colour from `would_have`, fallback outlined on Policy; S39 asserts both (S3, F1), each shown to fail with its half reverted. |
| r3 | `f2922fdd` | **pending**: the DeepSeek API returned "Insufficient Balance" (request `31422cbd-3b27-4764-b362-1676b47158f2`) before it could reply | IMPL-APPROVED | — |

The planner's fixes to `js/rt-pipeline.js` after DeepSeek reported Task 2 done, before r1: missing note spans on the Evidence box (crash); the example caption separator; clearing the previous action's stages at the start of each action; re-placing the token on resize; pausing the idle loop immediately when off screen; placing the token on a box's top edge (above the exits column at the fork), so it never covers text.

Contract wording governs where the plan's prose differs: §1.3 says the replay caption prefix is "This run"; §2.1 and the code use "Action i of n · " (noted by both reviewers, non-blocking). `data-action-count` counts the three examples during the idle loop. Reduced motion is read once at load.

PLANNER (claude): IMPL-APPROVED on `f2922fdd`, base `200f5f4`.

