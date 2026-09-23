# Workflow Builder v2: rebuild the Blueprint Studio editor on open-source foundations (plan v0.3)

Author: Claude (lead) · 2026-09-23 · Status: **v0.3 — APPROVED by all three seats in round 3: DEEPSEEK: PLAN-APPROVED · CODEX: PLAN-APPROVED · CLAUDE: PLAN-APPROVED.** Code-review base: `8d5b900`.
Request: *"反馈是 studio 编排的太粗糙了，可以利用已有的开源工具来做我们的 workflow builder，参考这个研究报告来生成我们的方案（Downloads/Agent_Builder_UI_研究报告.docx），一致通过后生成一个 demo 网站给我 review。"*
Roster: **claude** (lead, judge) · **deepseek** (`opencode`, `deepseek/deepseek-reasoner`) · **codex** (Pro account, limit verified 2026-09-23). Both gates are unanimous.
Predecessor: [`2026-09-22_BLUEPRINT_STUDIO_PLAN.md`](2026-09-22_BLUEPRINT_STUDIO_PLAN.md). Its engine was approved unanimously on revision `951bf49`. That branch was never pushed, and the user stopped the push.

## 1. What the feedback and the report say

**Feedback:** the editor is too rough. It is a hand-rolled DOM/SVG canvas: fixed-size cards, hand-drawn curves, no edge "+" insert, no node search, and an inspector that is one long form.

**What the report says** (`Agent_Builder_UI_研究报告`, 2026-09-23; Dify, Coze Studio, Activepieces, Langflow, n8n and Flowise reviewed):

- **Its own advice for building a builder:** "借鉴 Activepieces 的逐步添加动作；借鉴 Coze Studio 的节点搜索与中文解释；借鉴 Dify 的配置与画布分层。高级选项按需展开，并始终提供明确的试运行入口和错误定位。不要把所有模型参数和工具端口一次性展示给新用户。"
- **Visual preference:** Dify, for its layering of structure (canvas) and detail (config panel), light cards, and sparing semantic colour.
- **Licences:**
  - Flowise is archived (end of life 2026-08-31).
  - n8n uses the Sustainable Use licence, which is not open source.
  - Dify uses a modified Apache 2.0 with added conditions.
- **The report's own test tasks:** first-time build, add a branch, feed deliberately wrong input, hand the flow to someone else. This plan adopts them as acceptance tasks (§7).

## 2. Choice: which open-source tools

We cannot embed a whole platform (Coze Studio, Activepieces, Dify). Each needs a backend, would not run on the static Vercel site, and has no place for our security semantics: monitors, adversary scenarios, evidence grades. So we build on the **editor frameworks those products use**.

| Candidate | Licence | Fit | Decision |
|---|---|---|---|
| **React Flow** `@xyflow/react` 12.11.6 | MIT | Canvas engine under Dify, Langflow and Flowise; custom nodes, handles, edge buttons, minimap, controls, selection, undo pattern; very large ecosystem | **Use** for the canvas |
| **FlowGram.AI** `@flowgram.ai/*` 1.0.15 (ByteDance, the Coze Studio team) | MIT | Has both a fixed-layout (step list) and a free-layout editor. But the **fixed layout models a tree of blocks, and our graphs are DAGs whose branches merge** (Refund Execution has two inputs). Its free layout duplicates React Flow with a heavier DI stack (inversify) | Considered; **not used**. The reason is recorded here |
| **@dagrejs/dagre** 3.1.1 | MIT | Layered auto-layout, top-to-bottom | **Use** in the new UI. The legacy `layout.js` and its test are kept, unused |
| elkjs 0.12 | EPL-2.0 / GPL-3.0 | Better layout, heavier licence | Not used |
| **cmdk** 1.1.1 | MIT | Command menu / search list (the Coze-style node search) | **Use** |
| React 19.3 + Vite 7 | MIT | Build to static files with relative paths | **Use** |

**Feasibility spike (done, in scratch):**
- React Flow + dagre + our pure engine modules, built with Vite (`base: './'`), served from a sub-path.
- In headless Chrome it rendered 14 React Flow nodes. `validate()` running in the bundle returned the expected 6 findings.
- Bundle: 492 kB JS / 157 kB gzip.

**What is kept unchanged:** the approved pure modules (`model expr engine monitors adversary validate optimize io nlcompile store layout`), with their 91 tests and 16 semantic fixtures. They become the engine package; the rebuild is the **UI only**. Any change to them is listed and re-reviewed.

## 3. The new builder: interaction design

These are the report's three borrowings, one per region, plus its onboarding rules.

1. **Layout (Dify: structure vs detail).** Node library on the left, React Flow canvas in the centre, and a config panel on the right that opens only when a node is selected. The top bar holds the name, revision chip, **Checklist**, **Test run** (primary), the **Assurance** view and 中文/EN.

2. **Step-by-step adding (Activepieces).** The default flow runs **top to bottom** (dagre `TB`). "+" appears in two places. Each opens the node search (item 3), **filtered to what can legally go there**. Every insertion is **one patch, and so one undo step**.
   - **"+" on a flow edge A→B** offers only nodes that have both an input and an output (agent, tool, decision, control):
     - **Agent / tool:** remove A→B; add A→new and new→B.
     - **Decision:** remove A→B; add A→new, **new.true→B and new.false→B**. Both branches start empty and rejoin at B (the Activepieces branch pattern; B accepts several inputs). The user then fills either branch with "+" on its edge. *This needs the one model change in §6: `canConnect` must treat edges from different out ports of one node to the same input as distinct.*
     - **Control (approval or gate):** remove A→B; add A→new, new.approved→B, and new.denied→**the graph's decline outcome** (the first outcome with `success: false`). If there is none, the same patch creates one ("Declined": external, not success), placed beside B.
     - The result passes the **unchanged** `lint()`.
   - **"+" on an open out port** (a port with no edge, drawn as a stub) offers every flow type, outcomes included. A branching node added this way shows its own open ports as stubs. The checklist lists them as *incomplete branch* (lint `dangling_port`) until each one is connected. That is the explicit branch-completion step.
   - **"+" never offers:**
     - triggers, which come from the library or the empty state;
     - data resources, which are attached from an agent's or tool's config panel (item 5);
     - monitors (item 5).
   - Dragging from one handle to another still connects directly, under the same `canConnect` rule.

3. **Node search with explanations (Coze Studio).** A searchable node menu (cmdk), grouped by category. Each entry has a one-line plain-language explanation in **中文 and English**. Search matches both languages, synonyms (审批 / approval / gate) and node ids. The same component serves the left library and the "+" buttons.

4. **Config panel with progressive disclosure (the report: "高级选项按需展开").**
   - Each node type's fields are split into **Basic** (always shown) and **Advanced** (collapsed). For a control: kind, applies-when and binding are Basic; single-use, SLA and join are Advanced.
   - Each field has a help line.
   - Expressions are checked as you type, and the error position is shown.
   - The split is declared in `web/src/ui/fieldGroups.js`; `model.js` is untouched.

5. **Nodes that read at a glance; data and monitors as real nodes.** There is a custom React Flow node per type: icon, type colour (Silex tokens), title, and a one-line summary of its config ("amount > 2000", "bind customer · reusable"). Out handles are labelled (yes/no, approved/denied), and open ports show "+" stubs. **Every model node is a canvas node:** B1 counts 14 model nodes = 14 rendered nodes. Data resources and monitors use a compact style.
   - **Data:**
     - It sits above its readers, joined by a dashed access line.
     - To create one, open an agent's or tool's config panel, section *Reads data*, and pick an existing resource or *＋ New data resource* (name, sensitivity). That adds the node and the access edge in one patch. Removing it there removes the edge.
   - **Monitors (prohibited outcomes):**
     - They are compact red nodes, placed by the layout below what they watch.
     - One dotted *watches* line runs to each watched node. A monitor watching two nodes is one node with two lines, never two copies.
     - **From a tool's or outcome's config panel:** in the section *Protect with a monitor*, choose *Unauthorized write*, *Duplicate effect* or *Secret exposure*, each with a 中文/English explanation. The new monitor already watches that node, in one patch. Its `cap` comes from the tool for *Unauthorized write* and *Duplicate effect*; *Secret exposure* has no cap and is offered on outcomes. Config fields that don't apply to the chosen monitor are not written.
     - **From the library:** the monitor arrives unattached. The checklist lists it as `no_watches`, and like any node it can be located and selected. Its config panel has a *Watches* checklist.
     - Monitors are edited and deleted like any node.

6. **Checklist and error location (Dify's checklist; the report's "错误定位").** A toolbar button with a count opens a list with **three kinds of entry**:
   - **Pending input:** an edit the config panel refused (an invalid expression, a non-number). It is **not** in the graph: the panel keeps the draft and its error locally and registers it in a UI-state registry (`web/src/state/pendingInputs.js`).
     - The entry names the node and the field. Clicking it selects the node, opens its panel and focuses the field.
     - Each entry has *Discard*, which restores the graph's current value.
     - **Confirm is disabled while any pending input exists**, so nobody confirms believing a rejected edit was applied.
   - **Node issue:** a `lint()` issue with a `nodeId` or `edgeId`. Clicking it selects the node (or the edge's source), centres it and flashes its outline. Nodes with issues show a red corner badge.
   - **Flow issue:** a `lint()` issue with no node (`no_trigger`, `no_success_outcome`, `cycle`). Clicking it fits the view and shows the flow-level explanation with its fix hint ("connect a path from a trigger to a success outcome").

   In every kind:
   - Each issue is written from its **`code` and the node label, through the i18n dictionary**: every lint code has a 中文 and an English sentence. The engine's English `message` appears only as secondary detail.
   - Clicking an issue selects the node, centres the canvas on it and flashes its outline.
   - Nodes with issues show a red corner badge.

7. **Test run (Dify's run panel).**
   - A right-side panel with an input form (amount, eligible, split, injected, replay, duplicate) and Run / Step buttons.
   - While a run is in progress, canvas nodes show status rings: running, waiting, ok, error, skipped.
   - The panel shows the per-node trace: input, output, and effects with translated effect names.
   - A human approval appears as an **Approve / Deny** card in the panel.
   - The run is bound to its graph snapshot, and any edit cancels a pending run (as in v1).

8. **Language.** A 中文 / English toggle, remembered per browser; the default follows the browser language. One dictionary holds every UI string, lint-code sentence, effect-type name and node explanation. **Stays English in both modes** (the README says so): expression-parser error details, the JSON views, and node ids.

9. **Onboarding.**
   - An empty state offering two starter templates (Customer Refund, Vendor Bank Change) and "start from a trigger".
   - It never shows every parameter at once.
   - An About panel states what is simulated and what the demo viewer cannot do (downloads).

**The lifecycle is unchanged in substance.** Confirm → Validate → Optimize → Decide → Register are re-rendered in React on the same `store.js` commands, guards and evidence rules, with the same claim discipline. They live in a secondary **Assurance** view reached from the top bar.

## 4. Architecture

```
blueprint_studio/
  js/            approved pure engine modules (unchanged; layout.js kept with its test, unused by the v2 UI)
  templates/     unchanged
  tests/         unchanged unit tests; tests/probe/run-probes-v2.mjs (new)
  web/           NEW Vite + React source (pinned exact versions, package-lock committed, npm ci)
    CONTRACT.md                 the React integration contract (Task 0)
    vite.config.js              base './', outDir '../app'
    src/main.jsx, App.jsx       routing state: builder | assurance/<stage>
    src/state/storeAdapter.js   store.on -> a monotonically increasing `version`; useStudio() = useSyncExternalStore(subscribe, () => version).
                                The store mutates in place, so the version, not the object, is the snapshot; components read
                                store.active()/doc during render. store.dispatch stays the single mutation choke point.
    src/state/controller.js     the NON-UI logic ported from js/app.js: template load, restore and persistence, import / export (+ Copy JSON),
                                scenario-set cache, runValidation / runOptimize / modifyCandidate / testCandidate with store jobs
                                (late results discarded exactly as in v1), and the test-run context. Assurance pages only read the store
                                and call controller functions.
    src/builder/                Canvas, nodes/*, edges/InsertEdge, NodeSearch, ConfigPanel, Checklist, insert.js (the §3.2 patches), layout.js (dagre)
    src/run/TestRunPanel.jsx
    src/assurance/Confirm, Validate, Optimize, Decide, Register (.jsx)
    src/i18n/zh.js, en.js       src/ui/fieldGroups.js      src/styles/tokens.css (Silex tokens, Inter / IBM Plex Mono, React Flow theme)
  app/           BUILT static output, committed (Vercel serves the repo statically, with no build step on deploy)
  index.html     redirects to app/. The old DOM UI files (js/canvas.js, js/inspector.js, js/app.js, css/) are removed.
```

- **Build:** `cd blueprint_studio/web && npm ci && npm run build` writes `blueprint_studio/app/`. `npm run check` rebuilds into a temp dir and fails if `app/` differs, so the committed bundle can't go stale.
- **Unchanged:** `index.html` (the site), `assurance.html` and `swm/` are **not modified**.
- **Security:**
  - no `dangerouslySetInnerHTML`, no `eval`;
  - imports still go through the strict `importDocument`;
  - fonts are the only external request;
  - the bundle loads nothing from a CDN.

## 5. Tasks and ownership

**Task 0 (claude, first, committed before dispatch).** Covers:
- the Vite project;
- `storeAdapter`, `controller` and `web/CONTRACT.md`, which gives every controller function's signature and the i18n key-naming rule;
- tokens and the i18n scaffold;
- the Canvas with custom nodes and the dagre layout;
- `Validate.jsx` as the worked pattern.

**Acceptance (probe T0):**
- a patch dispatched through the store re-renders the canvas;
- `controller.runValidation()` fills `Validate.jsx`;
- switching revision mid-run discards the result.

| # | Owner | Files (exclusive) | Acceptance |
|---|---|---|---|
| 1 | claude | `web/src/builder/*`, `web/src/ui/fieldGroups.js` | B1–B10 |
| 2 | claude | `web/src/run/TestRunPanel.jsx` | R1–R3 |
| 3 | deepseek | `web/src/assurance/Confirm.jsx, Optimize.jsx, Decide.jsx, Register.jsx` (ported from `js/app.js` renderConfirm / renderOptimize / renderDecide / renderRegister, following Validate.jsx and CONTRACT.md) | L1–L9 |
| 4 | deepseek | `web/src/i18n/zh.js`, `web/src/i18n/en.js` (every key the code uses, every lint code and effect type, node explanations and synonyms for all 8 types) | I1 and the missing-key script |
| 5 | claude | `tests/probe/run-probes-v2.mjs`, `blueprint_studio/README.md`, logs | §7 |

## 6. Constraints

- **Engine modules unchanged except one listed change**, `layout.js` included (kept for compatibility). The 91 existing unit tests must still pass.
  - **The one model change:** in `model.js` `canConnect`, the flow duplicate-edge check also compares `from.port`. Old: the same source node, target node and target port counts as a duplicate. New: the same **source port** and target port counts as a duplicate.
  - Why: two branches of one decision (true, false) or control (approved, denied) may rejoin the same step.
  - Why the engine is unaffected: join state is keyed by edge id (`delivered`); dead-path skips travel per edge; `lint()` looks only at out ports; `importDocument` uses `canConnect`, so it follows automatically.
  - New unit tests:
    - `canConnect` accepts true→B then false→B, and still rejects a second edge from the same port;
    - the engine, on a decision whose two branches target B, fires B exactly once per activation for both `join: first` and `join: all`;
    - `importDocument` round-trips such a graph.
- **Claim discipline, as in v1:**
  - the declared-adversary sentence;
  - "0 in M tested";
  - every number with its formula;
  - the rule-based NL label;
  - "Registered · not deployed".
- **Performance:**
  - the bundle is under 600 kB gzip;
  - validate + optimize on the refund template at n = 40 runs in under 3 s.
- **Delivery for the user's review, after a unanimous code gate:**
  - **Primary: a private Claude Artifact**, using the Artifact tool's multi-file publish. It maps `index.html` plus every built file under `app/assets/` and `templates/` by relative path. The same path was used on 2026-09-23 for the v1 demo (ES modules, `fetch` of templates, localStorage).
  - **Checked after publishing:** the Artifact's file listing contains every built asset.
  - **Viewer limits, stated in the About panel:** the viewer blocks downloads, so Export also has **Copy JSON**; Import (file picker) works; persistence is per viewer.
  - **Fallback, always available and exercised by the probes:** `python3 -m http.server` at the repo root → `/blueprint_studio/app/`.
  - The branch stays local; nothing is pushed until the user says so.

## 7. Acceptance probes (headless Chrome over CDP, real mouse and keyboard)

These turn the report's tasks into probes.

**Task 0**
- T0: see §5.

**Builder (B)**
- B1: The refund template loads with 14 model nodes = 14 rendered nodes, custom node components and labelled handles; no console errors.
- B2: **"+" on the Eligibility → Gate edge**:
  - The search lists only agent / tool / decision / control. Typing "审批" or "approval" finds Control point.
  - Choosing it inserts it with approved→Gate and denied→Refund Declined. The graph passes the **unchanged** `lint()`, and one undo restores the original hash.
  - Two test runs then pass through it: one approved (reaches Refund Resolved), one denied (reaches Refund Declined).
- B2b: **"+" on an edge with Decision**:
  - The result is true→B and false→B, lint-clean.
  - "+" on the false edge adds an agent inside that branch.
  - Test runs with a true and a false condition each pass through their own branch (trace paths asserted).
- B3: **"+" on an open port** of a new agent adds the next step, connected to that port.
- B4: The config panel shows only Basic fields by default, and Advanced expands. An invalid expression shows its position and is not applied.
- B5: **Checklist**, all three kinds:
  - Deleting the Payment API → Refund Resolved edge lists `dangling_port` as a *node issue*; clicking it selects and centres Payment API. It also lists `no_success_outcome` as a *flow issue*; clicking it fits the view and shows the fix hint.
  - Typing `amount >` into the Gate condition shows an inline error and adds a *pending input* entry. The graph is unchanged, and Confirm is disabled. Clicking the entry focuses the field, and *Discard* removes the entry.
- B6: Undo/redo across insert, delete and config edits returns to identical hashes.
- B7: Auto-layout (dagre TB) runs **after React Flow has measured node sizes**. The measured node boxes don't overlap, in **both English and 中文** and with monitors and data present, and fit-view contains every node.
- B8: A confirmed revision refuses every mutation route: "+" is hidden, drag is disabled, config is read-only, and a direct dispatch returns `locked`.
- B9: **Monitors:**
  - *Protect with a monitor → Unauthorized write* on Payment API creates one monitor watching it (one dotted line).
  - A monitor added from the library is unattached, and the checklist locates it (`no_watches`).
  - Watching two nodes draws two lines from one node.
  - Deleting it removes it and its lines.
  - On the T1 flow, adding this monitor and validating yields a finding.
- B10: **Data:** *Reads data → New data resource (secret)* on an agent adds the data node and the access edge in a single undo step.

**Run (R)**
- R1: A $2,500 run pauses at Approval with an Approve/Deny card in the panel. Deny ends at Refund Declined.
- R2: Status rings appear on the executed nodes, and the trace lists translated effects.
- R3: Editing the graph cancels a pending run.

**Lifecycle (L)** (re-targets of v1 probes 6, 8–16 and 21)
- L1: stage guards;
- L2: exact baseline findings;
- L3: graph → results;
- L4: the recommended scorecard equals a direct run;
- L5: independent Approve / Modify / Reject histories, plus the approve guard;
- L6: Register is idempotent and never claims deployment;
- L7: a late result is discarded on revision switch, and each revision shows its own results;
- L8: a decided revision refuses re-validation;
- L9: reload restores the autosaved document, and a tampered import is rejected.

**i18n and visual (I, V)**
- I1: Switching to 中文 changes every UI string, checklist sentence and node explanation, except the documented English-only parts. A script finds no key missing in either language, and node search matches Chinese terms.
- V1: **Visual review**, since visual quality was the rejection reason. Screenshots in both languages of:
  - the builder at rest;
  - node search open;
  - the config panel, Basic and Advanced;
  - the checklist open;
  - the test-run panel mid-run;
  - one Assurance page.

  Codex and Claude review them in the code gate; DeepSeek cannot read images.

**Report tasks (T)**
- T1: **First build from the empty state:**
  - trigger → agent → tool → outcome, using only "+" buttons;
  - then set the agent's capability and the tool's cap in the config panel;
  - the result is lint-clean, and a **test run succeeds**: it reaches the success outcome with one write in the trace;
  - real input events are counted and recorded, not claimed as a user study.
- T2: **Add a condition branch** with "+" (as in B2b), complete it, and exercise both branches.
- T3: **Wrong input:** an invalid expression (a *pending input* entry) and a dangling port (a *node issue*). The checklist names each one, and following each entry reaches the right field or node.
- T4: **Export, then import** in a fresh profile → the same hash.

**Unchanged:** the 91 engine unit tests still pass.

## 8. Review record

### Round 1 (v0.1): DeepSeek PLAN-REJECTED (2), Codex PLAN-REJECTED (6)

| # | Objection (who) | Change in v0.2 |
|---|---|---|
| D1/C1 | Inserting a branching node on an edge leaves a dangling port; the generic insert doesn't fit triggers, outcomes, data or monitors (both) | §3.2, type-specific insertion. Edge "+" is filtered to agent / tool / decision / control. A decision gets true→B and false→B; a control gets approved→B and denied→the decline outcome, created if missing. Port "+" leaves stubs listed as *incomplete branch*. Data and monitors get their own paths. One patch per insertion = one undo. Probes B2 and B2b run both outcomes and both branches |
| D2/C2 | No way to author monitors; the badges don't map to the graph (both) | §3.5: monitors stay real graph nodes, compact, with one dotted line per watched node. They are created from a tool or outcome config panel, or from the library (unattached; the checklist locates them). Probe B9 includes a finding on a flow built from scratch |
| C3 | The React external-store contract is missing; controller ownership is unassigned | §4: `storeAdapter` (a version counter as the snapshot) + `controller.js` (a port of app.js's non-UI logic: jobs, imports, persistence, routing), written up in `web/CONTRACT.md` in Task 0 and proven by probe T0 |
| C4 | Deleting `layout.js` contradicts "tests unchanged" (DeepSeek too, as non-blocking) | `layout.js` and its test are kept as legacy. The new dagre layout gets its own probe (B7), on measured sizes, in both languages, with monitors and data present |
| C5 | The probes don't prove a usable replacement | T1 now requires a configured, successful test run; T2 exercises both branches; the lifecycle probes are restored (late result, revision switching, decided guard, persistence, tampered import); V1 adds a screenshot review in both languages |
| C6 | No proven delivery path for the demo | §6: the Artifact multi-file publish with a verified file listing and a Copy JSON fallback, plus a local static-server fallback; still no push |
| ns | i18n of engine messages; what the 14-node count means; the store snapshot (DeepSeek) | The checklist renders from the lint *code*, and the English-only parts are listed; B1 counts 14 model nodes = 14 rendered nodes; the snapshot is covered by C3 |

### Round 2 (v0.2): DeepSeek PLAN-APPROVED, Codex PLAN-REJECTED (2)

| # | Objection (who) | Change in v0.3 |
|---|---|---|
| C2-1 | Decision true→B + false→B is rejected by `canConnect` as `duplicate_edge` (the check ignores the source port); the same goes for a control inserted just before the decline outcome (codex) | Verified in `model.js`: the duplicate check compares source node, target node and target port. §6 now lists **one model change**: add `from.port` to the check, with three new unit tests. The engine is unaffected (joins keyed by edge id, per-edge skips) |
| C2-2 | Checklist error location can't come from `lint()` alone: a rejected expression is never in the graph, and `no_success_outcome` has no node (codex) | §3.6: three kinds of entry — *pending input* (a UI registry fed by the config panel, with Discard; Confirm blocked while any exist), *node issue*, *flow issue* (fit view + fix hint). B5 and T3 rewritten to test each kind |
| ns | *Secret exposure* has no cap; don't write fields that don't apply; the choice among several decline outcomes (deepseek) | §3.5 states the cap rule and says unused fields aren't written. The choice of decline outcome stays "first by id", documented |

### Round 3 (v0.3) — DeepSeek PLAN-APPROVED, Codex PLAN-APPROVED, Claude PLAN-APPROVED

DeepSeek re-verified the `canConnect` change against the engine's join and skip handling, `lint()` and `checkGraph`, and noted that the duplicate check was a genuine miss in its own round-2 approval.
