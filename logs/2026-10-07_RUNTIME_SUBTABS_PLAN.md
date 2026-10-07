# 2026-10-07 — Runtime Observation: sub-tabs and hover text (plan)

**Status:** built on 2026-10-07 (see §8). The standalone mockup used for the two review rounds was removed once the real view replaced it; the view itself is `index.html#view=runtime-observation`.

## 0. Revision v2 (2026-10-07, after the v1 review)

- **More text is fine once the content is split into tabs, as long as it is easy to understand.** Each tab now opens with a plain-language intro: the question it answers and how to read it. Every number has a one-line plain caption, and each tab ends with a "what this means" takeaway. The per-tab word cap from v1 (≤ 200) is dropped; the jargon still goes to ⓘ (p-values, CIs, n, hardware, sources).
- **Tab names:** bigger (17 px, active one bold with a 3 px underline). The tabs carry no "Simulated", "Measured", "S1" or "S2" chips. The evidence status moves into each tab: a chip on its intro card, and the S1/S2 verdicts on the Ontology segmented control and verdict bar.
- **Scenarios:** keep the original `rtPipeline` animation (`js/rt-pipeline.js`, unchanged), including the idle loop of reference examples. The 12 scenario rows become one **dropdown** (`<select>` with an *AP payments agent* and a *SOC triage agent* optgroup; each option shows its ID, short name and expected outcome). Below it, a "what to watch" line explains the scenario in plain words, followed by **Run** and the animation. Picking a scenario runs it.

## 1. Feedback and goal

Feedback: the Runtime Observation view has too much text and the page is too long.

Measured today (rendered DOM, all cards opened): **~1 900 words** in one scroll, five stacked cards (Scripted scenarios, Decision plane, Learning, Ontology, Latency). The Ontology card alone is ~900 words: two per-model tables, two long caveat paragraphs and an example trace.

Goal:

- One section per **sub-tab**: the view never scrolls far past one screen.
- Each tab **shows only** numbers, verdicts and a one-line scope. Methodology, p-values, CIs, provenance and caveats move to **ⓘ hover text** (also on focus and tap).
- **Delete nothing.** Every sentence moves to a tip, a closed disclosure or the linked report (traceability table in §5).

Target (v2): no word cap. Each tab reads top to bottom as intro → how to read it → numbers with plain captions → takeaway; technical detail sits behind ⓘ.

## 2. What must stay visible (claim guardrails)

Hover text is for detail, never for a qualification that changes the meaning of a claim. These stay on screen:

| Must stay visible | Where |
|---|---|
| "Simulated" on the scenarios, decision plane and reference figures | tab chips + header pill |
| S2 **Not confirmed**, next to S1 **Confirmed** | Ontology segmented control (both chips always visible) + verdict bar + S1 scope sentence naming the non-replication |
| S1 scope: "holds for held-out AgentDojo cohorts only; not replicated on AgentDyn" | S1 verdict bar |
| Recall: "observed, not a guarantee" | recall tiles |
| Judge reality check: 0.741 on real trajectories vs 0.961 on the test split | amber line, Learning tab |
| "benchmark labels, not yet customer reviewers"; "Promote · future" | Learning tab footer + loop step |
| Latency: "one location, one day, not a vendor SLA; speed only, not answer quality" | Latency tab footer |

The existing forbidden-phrase and claims probes (S18, S42, `ontology-s2-card.test.mjs`) keep running against the visible text. The tests for these guardrails assert they are **visible**, not merely present in the DOM.

## 3. Information architecture

```
Runtime Observation                            [Simulated judge · fictional tenant ⓘ]
Is each agent action safe to run, decided before it runs?
Plain one-sentence lead: rules → judge → policy; run / hold / block.
┌ 12 Scripted scenarios │ 24 Actions checked │ 10 Stopped │ 6 Hard rule ┐   ← one compact strip, captions kept
  Scenarios    Decision plane    Learning loop    Ontology    Judge latency     ← 17 px, no chips
─────────────────────────────────────────────────────────────────────────────────
<one tab panel>
```

- Header: the `rt-lead` paragraph is rewritten as one plain sentence and stays visible; the reference-figures line → ⓘ on the pill; the KPI cards become one strip and keep their captions.
- The tab bar uses the Enterprise World Model `.wm-tabs` behaviour (`role=tablist`, arrow keys), styled larger (17 px). The tab labels carry no status chips; each tab's intro card carries its own (Simulated engine / Measured).
- Default tab: **Scenarios**.
- Deep link: `#view=runtime-observation&tab=<scenarios|plane|learning|ontology|latency>[&s=s1|s2|ex]`. The current `#view=runtime-observation` and the old `#view=long-term&tab=runtime` still land on Scenarios.

### Per tab

| Tab | Visible | Moved to ⓘ / disclosure |
|---|---|---|
| **Scenarios** | Intro → a dropdown of the 12 scenarios (optgroups AP / SOC) + Run + a "what to watch" line with the expected-outcome chip → the **original `rtPipeline` animation** full width (idle loop before the first pick) → the result sentence + "See this run in the decision plane →" (switches tab) → "How to read the picture" (one plain line per stage) | Reference-figures provenance |
| **Decision plane** | Intro + four numbered "things to try" (switch agents, open a run, Replay, Policy Studio) → the embedded demo + "Open full page" | — |
| **Learning loop** | Intro (benchmark labels, not yet customer reviewers) → 6-step loop with one line per step (Promote = future) → 3 tiles with plain names ("Catches goal deviation", "Spots instruction override", "Speed stays the same") and captions → the gate explained in one sentence + KEEP/DISCARD rows → the amber reality check in plain words | Threshold/FPR/CI footnotes, "all 9 caveats" list tip, source runs, future-work note |
| **Ontology** | Intro explaining what an ontology label is and what was tested → a three-card glossary (alerts / precision / recall in plain words) → segmented `Test 1 · AgentDojo [Confirmed] / Test 2 · AgentDyn [Not confirmed] / See one attack, step by step` → verdict bar with a bold plain-language result + scope → 3 tiles with captions → the 3 pre-registered tests, each with a plain sub-line → (Test 2) a "why it may differ" takeaway → the example as a numbered story with the injected text and the ontology's three reasons visible | p-values, CIs and per-model tables in a closed "Statistics and per-model numbers" `<details>`; run counts and cohorts in the verdict ⓘ; the example-selection rule |
| **Judge latency** | Intro (why a 400 ms budget) → 3 tiles ("typical answer" = p50, "slow cases" = p95) → bars with the budget line → the 10 s replay → a "what this means" takeaway that keeps "speed only, not a vendor SLA" | Measurement method, OpenAI processing-time split, hardware |

## 4. The hover-text component (`.tip`)

One new component, shared by every tab:

- Markup: `<span class="tip" tabindex="0" data-tip="short text">i</span>`, or `data-tip-ref="<template id>"` for rich text (lists, bold). Long text lives in `<template>` elements, so it is in the page source (tests and search can still find it) but not in the flow.
- One shared `position:fixed` popover, so it is not clipped by cards or the iframe. It flips above the icon near the bottom edge.
- It opens on **hover, keyboard focus, and tap/click** (click pins it; a second click, outside click or Esc closes it). `role=button`, `aria-label="More information"`, `aria-expanded`. Touch and keyboard users can still reach everything.
- Visually it matches the existing `.help` bubble (same dark tooltip). `.help`'s CSS `::after` approach clips inside cards and cannot hold lists, so this component replaces it.

## 5. Implementation steps

| # | Change | Files |
|---|---|---|
| 1 | Add the `.tip` component (JS + CSS) | new `js/rt-tip.js`, new `css/rt-subtabs.css` |
| 2 | Replace the five `.rt-fold` cards with the tab bar + five `role=tabpanel` sections; slim the header and KPI strip | `index.html` (§ `#runtime-observation`, ~lines 1139–1185) |
| 3 | Tabs, hash deep link, arrow keys; "See this run in the decision plane ↓" switches to the Decision plane tab instead of scrolling | new `js/rt-subtabs.js`; `js/rt-pipeline.js` (`rtSeeRun` handler) |
| 4 | Retire the fold mechanism | delete `js/rt-fold.js` + its CSS in `index.html` (lines 366–369) |
| 5 | Ontology renderer: S1/S2/examples segmented; paragraphs → templates; tables → `<details>`; p/CI → per-row tips | `js/rt-ontology.js` |
| 6 | Learning evidence: tiles + gate rows visible; caveats → one list tip; reality line kept visible | `js/jev-runtime-host.js` (renders `rtLearningEvidence`, `rtJudgeRealNote`) |
| 7 | Latency: method paragraph → tip | `js/rt-latency.js` |
| 8 | Scenario list → `<select>` + Run + "what to watch" line (new `WATCH` copy per scenario ID, kept beside the scenarios) | `js/jev-runtime-host.js` (`renderReference` renders `rtScenarios`; the Run handler reads the select instead of per-row buttons). `js/rt-pipeline.js` unchanged |
| 9 | Tests (below) + README Runtime Observation bullet + a `logs/README.md` entry | `tests/site/*`, `README.md`, `logs/README.md` |

**Decision-plane iframe:** keep loading it when the *view* opens (as today), not when the tab opens. The Scenarios tab drives it (S40 "See this run"), and an iframe inside a `display:none` panel keeps running. The mockup lazy-loads it on the tab only because the mockup has no scenario hand-off.

**Traceability:** before the build, dump the rendered text of today's view (all folds open). After the build, dump the visible text plus all `.tip` and `<template>` text. A script checks that every sentence of the old dump appears in the new one (or is listed as intentionally reworded). This is how "delete nothing" is enforced.

## 6. Tests to update

- `run-site-probes.mjs`: `rtReady()` opens folds → it should open the needed tab instead. S13–S19 and S39–S43 select the tab before asserting. Add new probes:
  - **S44:** the tabs, the deep link `&tab=ontology&s=s2`, arrow keys, and the default tab.
  - **S45:** a tip opens on hover, focus and tap, closes on Esc, and stays inside the viewport at 390 px.
  - **S46:** the §2 guardrail strings are visible (`offsetParent !== null`) on their tabs.
  - **S47:** the scenario dropdown has 12 options in two optgroups; choosing one runs it through the same `pipeline.replay` path; the existing S15/S16/S40 scenario probes drive the select instead of `[data-rt-run]` buttons.
- `ontology-s1-card`, `ontology-s2-card`, `ontology-card.test.mjs`: replace the fold-toggle click with selecting the tab and segment. Assertions that read caveat text should read it from the tip templates.
- `judge-latency-card.test.mjs`: the same change (open the tab, not the fold).
- Run the full site probes and card tests, plus a 390 px screenshot of every tab.

## 7. Open questions

1. **Default tab:** Scenarios (the story starts there) or Decision plane (the richest demo)? The plan says Scenarios.
2. Should **Example runs** stay inside Ontology, or become a sixth tab? The plan keeps it inside Ontology to hold the tab count at five. The live card has four cases (caught by both / alert saved / alert lost / missed by both); the mockup shows only the first, and the build keeps all four as a small chooser.
3. Should the KPI strip stay above the tabs (always visible), or move into the Scenarios tab (it describes the scripted set)? The plan keeps it above as the view's summary.

## 8. Build record (2026-10-07)

- **Built as planned**, with these differences:
  - Hover bodies are hidden `<span class="rt-tip-body">` elements inside each ⓘ, not `<template>`s: a template's content is not part of `textContent`, and the card tests read caveats and notes from the page text. The popover copies a body without ids or `data-` hooks.
  - The KPI strip stays above the tabs; Example runs stays inside Ontology, with all four cases.
  - At < 900 px a pick centres the vertical pipeline (it was `nearest`): the caption the replay adds pushed a flush-bottom picture off screen.
  - The decision-plane iframe still loads when the view opens, so the Scenarios tab can drive it while its tab is hidden.
- **Traceability:** a sentence diff of the old view's text against the new view's text (on screen plus tip bodies) finds every caveat, figure and source sentence. The only rewordings: the lead ("Before an AI agent's action runs, Silex checks it in three steps…"), "Every reviewer answer can become a training label", "Would the gate let the new judge in?", the reality-check wording, "This compares speed only", and "below" dropped from the S1 note.
- **Tests:** the planned S45–S47 were folded into S44 (tips, visible claims) and S14/S40 (dropdown). Site probes 44/44 (S20 now opens the Decision plane tab before tapping the demo's Replay tab); card tests ontology-card 9/9, ontology-s1-card 9/9, ontology-s2-card 13/13, judge-latency-card 8/8; unit tests rt-pipeline 8/8, jev-runtime-model 6/6, jev-runtime-vendored 2/2. S20's initial-width check failed intermittently in this environment, on the previous `main` too.
