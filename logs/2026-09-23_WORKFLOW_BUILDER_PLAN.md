# Workflow Builder v2: rebuild the Blueprint Studio editor on open-source foundations (plan v0.8)

Author: Claude (lead) · 2026-09-23 · Status: **v0.6 — v0.5 was APPROVED unanimously and its implementation passed the unanimous code gate (c9652d0). §3.11 (an n8n-style template gallery, added at the user's request) was approved unanimously in round 8: DEEPSEEK: PLAN-APPROVED · CODEX: PLAN-APPROVED · CLAUDE: PLAN-APPROVED.**
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

## 3.10 Amendment (v0.4): Ask AI — edit the workflow from a prompt (n8n-style)

**The user's request (2026-09-23):** "还需要类似 n8n 的功能可以提供 prompt 可以直接增删改 workflow". n8n's AI Workflow Builder turns a chat prompt into workflow changes. Ours does the same, within the security product's rules.

**UX:**
- **Where:** an **Ask AI** button in the builder's top bar opens a right-side chat panel, in the same slot as the config and test-run panels.
- **Input:** the user types a request in either language, e.g. "在 Refund Eligibility 后面加一个人工审批，金额超过 1000 才需要；删除 Duplicate Compensation 监控；把 Payment API 改名为 Stripe Refunds".
- **Proposal:** the assistant answers with a **proposal**:
  - a one-line summary;
  - the list of changes (human-readable, from `describeOp`);
  - the **lint delta** (issues added and removed);
  - the affected nodes highlighted on the canvas.
- **Apply / Discard:** **Apply** dispatches the proposal as **one patch = one undo step**. **Discard** drops it. **Nothing is applied without the click.**
- **Follow-ups:** they see the current graph and the chat so far.
- **On a confirmed revision:** the assistant offers "Edit as new revision" first and never proposes on a locked graph.

**Two proposers; one validator:**
1. **Claude (in the Claude Artifact demo).** Declare the Artifact `sample` capability. `sample.json` is called once per request (`modelTier: 'default'`, `cache: false`, with a Stop button) with:
   - the instruction;
   - the compact current graph (ids, types, labels, config, edges);
   - the node-type schema summary from `NODE_TYPES`;
   - the allowed operations;
   - the last chat turns;
   - the user's message.

   The reply format is `{summary, ops:[…]}`. It runs on the viewer's own Claude usage, and the first call asks the viewer's consent. Errors follow the capability's codes:
   - `not_granted` or `sampling_disabled`: fall back to the rule-based mode, with a note;
   - `rate_limited`: tell the user;
   - `invalid_json`: offer "Try again";
   - no automatic retry.
2. **Rule-based (always available; the only mode on the static Vercel site, which has no model or key).**
   - It extends the existing phrase set with add / delete / rename / set, in English and 中文: "add <type> after <node>", "insert <type> between <A> and <B>", "delete <node>", "rename <node> to <name>", "set <field> of <node> to <value>", "protect <tool> with <monitor>". It also reuses `nlcompile.compileText` for the existing policy phrases.
   - It is labelled "Rule-based — no AI" in the panel. When `sample` is unavailable, the panel says "AI proposals are available when this page runs as a Claude artifact".

**The proposal language and its validation (the model's output is untrusted input):**
- **Ops accepted:** the seven primitive patch ops, plus four **macro ops** expanded by the approved `insert.js` builders, so structural edits stay lint-clean:
  - `{op:'insertStep', edge|from+to, type, label?, config?}` → `insertOnEdge`
  - `{op:'addNext', node, port, type, label?, config?}` → `addAfter`
  - `{op:'addMonitor', node, kind}` → `addMonitor`
  - `{op:'addData', node, label, sensitivity}` → `addData`
- **Validation, in order, with the first failure rejecting the whole proposal and naming the op:**
  1. The reply is an object with an `ops` array of at most 30.
  2. Each op is on the whitelist.
  3. Node types pass `isNodeType`, which checks own properties only.
  4. Ids exist, or are new ids made with `nextId` (a model-supplied id for `addNode` is replaced).
  5. The macros expand.
  6. `applyPatch` succeeds.
  7. The **resulting graph passes the same structural and config check that import uses**. The only engine change: `io.js` exports its existing `checkGraph`.
  8. Positions come from the dagre layout, never from the model.
- **Lint:** the lint delta is shown but does not block, so a user may knowingly apply a change that leaves an incomplete branch. The checklist then lists it as usual.
- **Rendering:** every string the model returns is rendered as text only: no `dangerouslySetInnerHTML`, no URLs followed.
- **Prompt injection:** labels in the graph could carry injected text, so the prompt fences the graph as data. Nothing is applied without the user's click, and every apply is one undo step.

**Ownership:**

| Owner | Files | What |
|---|---|---|
| claude | `web/src/assist/AssistantPanel.jsx`, `propose.js` (the Claude proposer and prompt), `expand.js` (macros → ops), `validateProposal.js`, and the one-line `io.js` export | The panel, the Claude proposer, the expander and the validator |
| deepseek | `web/src/assist/rules.js` | The rule-based proposer (bilingual grammar), with unit tests in `web/tests/rules.test.mjs` (`node --test`) |
| deepseek | `web/src/i18n/zh.js` | The new keys |

**Probes (A):**
- **A1 (rule-based, real input):**
  - "add a human approval after Refund Eligibility" → the preview shows the insert → Apply → the graph is lint-clean → one undo restores the hash;
  - "删除 Duplicate Compensation" → the node and its watch line are removed;
  - "rename Payment API to Stripe Refunds" → the label changes.
- **A2 (Claude path, with the probe injecting a stub `window.claude` whose `use('sample')` returns fixed replies):**
  - a valid macro proposal → preview → apply;
  - an invalid proposal (an unknown type, `__proto__`, a bad config value, an op on a missing id, 31 ops) → rejected with the op named and the graph unchanged;
  - a locked revision → no proposal, and "Edit as new revision" is offered;
  - `not_granted` → falls back to rule-based mode with the note.
- **A3 (screenshots, both languages):** the panel with a proposal preview, added to V1.
- **Not testable headless:** a real Claude call inside the claude.ai viewer. After publishing, Claude verifies the artifact declares `sample`. The user's first real prompt is the live check, and this is said plainly in the hand-over.

**Also in v0.4, from Claude's own screenshot review before the code gate:**
- candidate labels in Optimize and Decide are rendered in the UI from the candidate's classes and params, so they are translated in 中文;
- the Optimize header layout;
- the minimap size.

Ineligibility reasons stay as engine English detail and are added to the documented English-only list.

### 3.10.1 Revisions from round 4 (v0.5)

**A. Proposal lifecycle and binding (Codex 1)**

- **Binding:** every request gets a `requestId` and captures `{docId, rev, graphHash, requestId}` at send time. A proposal carries that binding plus the **exact expanded patch** that was previewed.
- **One request at a time:**
  - a new prompt aborts the running call (a new `AbortController` per call);
  - **Stop** aborts it;
  - an abort, a late reply or a failed reply is dropped when its `requestId` is no longer current;
  - no partial or failed reply ever leaves an applicable proposal.
- **Staleness:** any store event that changes the doc, revision, draft status or graph hash marks the current proposal `stale`. The preview says "The workflow changed since this was proposed — ask again", and Apply is disabled.
- **Apply** re-checks, in order:
  1. the proposal is current and not stale;
  2. doc, rev and graph hash are equal to the binding;
  3. the revision is a draft;
  4. no Apply has already happened, since the proposal is consumed on first Apply.

  It then dispatches **exactly the previewed ops** as one patch, and a double click cannot apply twice.
- **Confirmed revision:** the panel shows "Edit as new revision"; send is disabled.

**B. Validation is per operation, against a working graph (Codex 2)**

- **Structural checks before anything is applied:**
  - `ops` is an array of 1–30 plain objects;
  - every string is ≤ 200 chars and every array ≤ 20 items;
  - no key named `__proto__`, `constructor` or `prototype` at any depth;
  - numbers are finite and within the field's bounds (±1e9).
- **Per-op schemas, with exactly these keys:**
  - `setLabel {id, label}`
  - `setConfig {id, key, value}`: `key` must be a schema field of that node's type that applies to its current config (`when`); `value` must pass the same field-type check import uses (`select` in options, `bool`, finite `number`, a `caps` list, a `range`, `nodeRefs` to existing nodes, an `expr` that parses)
  - `removeNode {id}`, `removeEdge {id}`
  - `connect {from:{node,port}, to:{node,port}}`: the primitive `addEdge` is not offered to the model; the id comes from `nextId` and the edge is checked with `canConnect`
  - macros `insertStep {from, to | edge, type, label?, config?}`, `addNext {node, port, type, label?, config?}`, `addMonitor {node, kind}`, `addData {node, label, sensitivity}`
  - raw `addNode` and `moveNode` are **not** offered to the model: nodes are created only through macros, and positions come from layout.
- **Sequential expansion on a working graph:**
  - Op *k* is expanded and applied to the graph produced by ops 1…k−1.
  - A macro may carry a model-chosen `ref` ("new1"). Later ops may use `{ref:"new1"}` wherever a node id is expected, and it is remapped to the id `nextId` actually allocated.
  - A macro's `label` and `config` overrides are validated with the `setConfig` rules above, then **appended as `setLabel` / `setConfig` ops on the new node**, so the approved `insert.js` builders are used unchanged.
- **Errors:**
  - Any exception during validation, expansion or application is caught and becomes a Result naming the op index.
  - The first failure rejects the whole proposal, and the graph is untouched.
- **Final check:** the final graph must pass `io.checkGraph` (as v0.4), which adds import's canonical-edge and reference checks.
- **Tests (DeepSeek-owned, `web/tests/validateProposal.test.mjs`, run by `node --test`):**
  - `null`, non-objects and unknown ops;
  - a `setConfig` with an unknown key or `__proto__`;
  - out-of-range numbers;
  - a multi-op proposal whose later ops reference an earlier macro's `ref`;
  - a proposal whose third op fails, leaving the graph unchanged.

**C. The `sample` capability, handled completely (Codex 3; DeepSeek non-blocking)**

- **Availability:** `window.claude` absent, **or** `await claude.use('sample')` resolves `null`, both mean the Claude mode is hidden and the panel runs rule-based with its note.
- **Permanent codes:** `not_granted`, `sampling_disabled`, `not_declared`, `capability_disabled`, `capability_removed` and `tools_unavailable` switch to rule-based mode for the rest of the page load. The panel shows one line explaining it and never re-asks.
- **Per-request codes:**
  - `cancelled` is silent;
  - `rate_limited` and `session_expired` show a message and keep the input;
  - `refused` clears any partial output and asks the user to rephrase;
  - `empty_completion` asks for less;
  - `invalid_json` offers a manual "Try again";
  - `prompt_too_large` shows "This workflow is too large to send; ask about one part";
  - `upstream_error` and **any unknown code** offer a manual retry.
- **Never retry automatically.** Failures never leave an applicable proposal.
- **Waiting state:** "Thinking… (the first request asks your permission)" shows from send until the reply, with a Stop button. There is no page timer; the platform ends over-long calls.
- **Size:**
  - the assembled prompt is measured in UTF-8 bytes against `sample.limits().maxPromptBytes`, or 65536 if limits is unavailable, keeping 4 KiB of headroom;
  - the oldest chat turns are dropped first;
  - if it's still too large, the graph section keeps ids, types, labels and the configs of nodes the message names, and summarises the rest by type count;
  - if it's still too large, the request is refused locally with the `prompt_too_large` message.

**D. Probe additions (A2, stub `window.claude`)**

- The stub's `use('sample')` returns `null`, so the panel is rule-based.
- A permanent code (`capability_removed`) switches to rule-based mode and hides the Claude option.
- **Stop** during a slow stub reply leaves no proposal.
- An **edit during generation** makes the late reply stale, and Apply is disabled.
- **Switching document**, and **confirming before Apply**, both disable Apply.
- **Repeated Apply** applies once: the hash changes once and there is one undo entry.
- An **oversized message** is refused locally, with no call made.
- Earlier turns are dropped when the chat grows.

**E. Wording fixes**

- "Engine changes" now reads: the `canConnect` change (§6) **and** exporting `checkGraph` from `io.js`. Both are listed in the review.
- The ineligibility reasons are added to the English-only list in §3.8.

**Ownership:** unchanged. `web/tests/validateProposal.test.mjs` goes to deepseek, alongside `rules.js`; the validator itself stays claude's.

## 3.11 Amendment (v0.6): n8n-style templates

**Request (2026-09-23):** "templates 有点少，可以把 n8n 的那些主流模版都支持一下".

**What "mainstream n8n" means here** (checked on 2026-09-23):
- n8n.io/workflows groups about 12k community templates into **AI, Sales, IT Ops, Marketing, Document Ops, Support, Other**.
- Commonly cited leading patterns are:
  - AI email triage and auto-response (Gmail + OpenAI);
  - AI chat and RAG support agents;
  - lead enrichment (webhook → enrichment → CRM → Slack);
  - invoice and document processing;
  - RSS or web → AI writing → social posting;
  - multi-agent researcher → writer → reviewer.

**Honesty rules:**
- **Our own models, not n8n's.** These templates are modelled on those patterns and written in our typed graph. No n8n workflow JSON is imported or copied.
- **Integrations are named, not connected.** Gmail, Slack, CRM, accounting, IdP and EDR appear as typed steps (trigger / agent / tool / data), not live connections. Each template says so in its description.
- **What `amount` means:** it is the engine's one numeric request field. Every template states what it stands for (invoice total, discount $, deal value, privilege level 0–100, alert severity 0–100, and so on), and the gallery shows it.

**Templates** (11 new, 13 in total). Each is a real Silex security graph: it has an untrusted entry where n8n's would have one, at least one write tool with a capability and limit, and an approval or gate where the business rule needs one. It also has **at least one monitor**, and a **declared gap** that the scenarios find, as in the refund template.

| # | Category (n8n) | Template | n8n pattern | `amount` means | Monitors (at least) |
|---|---|---|---|---|---|
| 1 | AI | Support chat agent with knowledge base (RAG) | Chat trigger → AI agent + vector store → reply | Goodwill credit $ | Unauthorized write (credit), secret exposure (reply) |
| 2 | AI | Multi-agent research → write → review → publish | Research agent → writer → reviewer → CMS | Promotion budget $ | Unauthorized write (publish without review), secret exposure |
| 3 | Support | AI email triage and auto-reply | Gmail trigger → classify → draft/reply → CRM | Refund amount named in the email | Unauthorized write (refund), secret exposure (auto-reply) |
| 4 | Sales | Lead enrichment → CRM → Slack | Webhook/form → enrichment API → CRM upsert → Slack | Deal value $ | Duplicate effect (duplicate CRM records), secret exposure (enrichment API key) |
| 5 | Sales | Quote discount approval | CRM deal → AI pricing agent → approval → CPQ | Discount $ | Unauthorized write (discount above policy) |
| 6 | Marketing | RSS → AI social post | RSS/web trigger → AI writer → LinkedIn/X | Ad boost budget $ | Unauthorized write (post without review), secret exposure (API token) |
| 7 | Document Ops | Invoice processing and payment | Email attachment → extraction → approval → accounting/payment | Invoice total $ | Unauthorized write (payment), duplicate effect (paying one invoice twice) |
| 8 | Document Ops | Contract review and e-signature | Upload → AI review → legal approval → send for signature | Contract value $ | Unauthorized write (sending without legal approval), secret exposure |
| 9 | IT Ops | Access request provisioning (finance roles) | Slack/Jira request → AI agent → manager approval → IdP grant | Spend authority the requested role grants $ | Unauthorized write (a role above the policy without approval), duplicate effect |
| 10 | IT Ops | Security alert triage and containment | SIEM webhook → AI triage → on-call approval → EDR isolate | Estimated business impact of isolating the host, $ per hour | Unauthorized write (a high-impact isolation without approval) |
| 11 | Other (HR) | Employee onboarding | HR form → account creation → welcome email | Monthly licence cost of the requested accounts $ | Unauthorized write (licence spend above policy), duplicate effect (duplicate accounts), secret exposure (personal data in the welcome email) |

Plus, re-categorised: **Customer Refund** (Support) and **Vendor Bank-Detail Change** (Document Ops / Finance).

**Template file format:** existing fields, plus `category` (one of the seven n8n categories), `n8nPattern` (one line), `amountMeaning` and `integrations` (display names only). Chinese name, description, pattern and amount meaning live in `zh.js` under `tpl.<id>.*`. Positions come from the dagre layout on load.

**Gallery UI (n8n's template browser):**
- **Opening it:** from File → "Browse templates" and from the empty state.
- **Browsing:** a modal with category tabs (All + the seven), a search box (both languages; name, pattern, integrations), and cards.
- **Each card shows:** the name, a one-line description, the n8n pattern, the integration chips, "amount = …", the node count, and a mini strip of node-type icons.
- **Use template** starts a new document, like today's template start.
- **Keyboard and phone:** the modal is keyboard accessible (Esc closes, arrow and Tab focus) and works at phone width (one column).

**Acceptance (tests and probes):**
- **Unit test `tests/templates.test.mjs`**, one per template. Each template must:
  - import cleanly and be lint-clean;
  - have every schema field present (`io.checkGraph`);
  - run baseline validation at n = 20 and produce **exactly** its declared `expectedFindings` (`prohibitedId:template` list, committed in the template file and justified in a one-line `why` each);
  - run `optimize` without error, with a recommendation that either exists or is explicitly declared `"none"` with a reason.
- **Probe G1:** the gallery lists 13 cards; each category tab filters correctly; the search "发票" and the search "invoice" both find Invoice processing.
- **Probe G2:** every template, loaded through the gallery, renders with no console error and no overlapping nodes (measured). This is checked in English and Chinese.
- **Probe G3:** Ask AI in rule-based mode works on two new templates, e.g. "add a human approval after <node>" on Invoice processing.
- **Visual:** V1 screenshots of the gallery in both languages.

**Ownership:**
- **deepseek:** the 11 template JSON files, their `expectedFindings` and `why`, `tests/templates.test.mjs`, and the zh strings. DeepSeek authors the graphs because they are data-heavy.
- **claude:**
  - the gallery (`web/src/templates/Gallery.jsx`);
  - template loading through a manifest (`templates/index.json`, bundled with `import.meta.glob`, replacing the two static imports);
  - the empty-state and File menu entries;
  - probes G1–G3;
  - the README.
- **Engine:** unchanged.

### 3.11.1 Revisions from round 6 (v0.7)

**Every template's `amount` is money** (Codex 1, DeepSeek 1).
- **Why:** the engine simulates one numeric field. Benign scenarios draw it log-uniform from **$20 to $3,000** for every template, and adversarial ones from the first unauthorized-write monitor's `probeRange`.
- **Rows 9–11 are redefined as dollar quantities** (see the table), so they are continuous, positive, and on the same scale as the benign draw. No template claims a bounded integer scale.
- **Thresholds and ranges:** each template's thresholds and `probeRange` are set in that dollar scale.
- **Disclosure:** the gallery, the template description and the README all say: "Simulated requests: benign $20–$3,000 (log-uniform); adversarial ranges from the monitor's probe range."
- **Engine:** unchanged.

**Disclosure fields** (DeepSeek non-blocking, adopted):
- `amountMeaning`;
- `customerMeaning` and `orderMeaning`, since `duplicate_effect` keys on (customer, order) — for example lead = order in #4, and employee = customer, account = order in #11;
- an explicit note where `amount` is cosmetic, meaning no unauthorized-write monitor reads it (#4);
- for #3, "the amount is supplied with the request; the email is not parsed".

**Authoring loop** (DeepSeek, adopted):
1. Build the graph.
2. Run the real scenario set.
3. Inspect every finding.
4. Commit the **observed** list as `expectedFindings`, with a one-line `why` per finding explaining the mechanism in the graph. A finding with no meaningful mechanism means the graph is changed, not the list.

**Domain assertions** (Codex 1):
- `tests/templates.test.mjs` checks every generated request, for every template, at n = 20: `amount` and `eligible` are finite, `amount > 0`, `eligible ≥ 0`, and both are at cent precision.
- Adversarial `below_threshold` amounts lie inside the monitor's `probeRange`.
- Findings are asserted only on these generated scenarios, and each finding's violating runs are re-run and checked to come from the template it names.

### 3.11.2 Revisions from round 7 (v0.8)

**The disclosed ranges are the generator's actual rules** (Codex 1). Read from `js/adversary.js`; the engine is unchanged.
- **Parameters.** `scenarioParams(graph)` uses the **first `unauthorized_write` monitor by id**: *t* = threshold, [*lo*, *hi*] = probeRange. With no such monitor it falls back to **t = 500, lo = 0, hi = 1000**. Below, *t′* = *t* if *t* > 0, else *hi*.
- **Draws.** Uniform draws are over [a, b). Every amount is rounded to cents, so a draw from 0 can round to **$0.00**.

| Scenario | amount | eligible |
|---|---|---|
| below_threshold | uniform [lo, hi) | 0 |
| split | uniform [hi, 2·hi); pieces k = clamp(⌈amount / (0.96·t′)⌉, 2, 10) | amount |
| replay | both requests uniform [hi, 2·hi) (the same amount) | r1 = amount; r2 = 0 |
| duplicate_submit | uniform [0, t′), the same order twice | amount |
| injection_exfil | uniform [0, t′) | amount |
| benign | log-uniform [20, 3000) | amount |

- **Disclosure.** The gallery's "Simulated requests" note and the README show this table, not a single summary line. For a template without an unauthorized-write monitor, they say explicitly that the default parameters apply.
- **Assertions.** `tests/templates.test.mjs` recomputes `scenarioParams()` for each template, the fallback included, and checks every generated request against the row for its scenario type:
  - the range;
  - finite values;
  - cent precision;
  - `amount ≥ 0`, where zero is allowed only for duplicate_submit and injection_exfil (and for below_threshold when lo = 0).

**Template #4's amount** (Codex 2). It is **not read by any unauthorized-write monitor, but it is still checked against the agent's capability limit** at the CRM write. So the template gives the enrichment agent a limit above the scenarios' maximum (at least 2·hi). The test asserts that, in the baseline, **every** duplicate_submit scenario on #4 executes both CRM writes: two `write` effects, no `write_denied`. The same assertion applies to #7, #9 and #11, the other templates whose duplicate findings are expected. `amountMeaning` for #4 reads: "Deal value $ (not checked by a monitor; subject to the agent's capability limit)".

**DeepSeek's round-7 nits.** The per-finding `why` lines on #11 name its two mechanisms distinctly: spend above policy, and the same account created twice. Templates that don't need a zero lower bound use `probeRange` lo > 0.

**The lifecycle is unchanged in substance.** Confirm → Validate → Optimize → Decide → Register are re-rendered in React on the same `store.js` commands, guards and evidence rules, with the same claim discipline. They live in a secondary **Assurance** view reached from the top bar.

## 3.12 Amendment (v0.9): left-to-right canvas, with top-to-bottom as an Arrange option

**User request (2026-09-23):** "修改builder交互生产workflow页面成左右方向编排页面（目前是上下方向），“Arrange” 图标那里可以给一个用户option的子图标自动arrange并切换成上下编排的workflow。" In English: make the builder canvas flow left to right, as it does today top to bottom. Next to Arrange, add a sub-option that arranges automatically and switches the workflow to top to bottom.

**Where the direction lives.** It is stored in the graph as `graph.direction`, set to `'LR'` or `'TB'`. It is view state, like the node x and y, so it has no effect on the semantic hash: `semanticGraph` already keeps only nodes and edges.

Keeping it in the graph, and not in a viewer preference, means the positions and the handle sides can never disagree:
- undo and redo restore it together with the positions;
- autosave, export and import carry it with the revision it belongs to;
- approving a candidate, or starting a new revision, clones it.

**Defaults.**
- New documents, from any template or blank, are `'LR'`.
- A graph without the field is treated as `'TB'`. Documents saved or exported before this change have top-to-bottom positions, so they keep showing exactly as they did. The Arrange menu shows which direction is current, so switching them is one click.

**Engine changes. These are the only ones.**
- `model.applyPatch` gets one new op, `{op:'setDirection', direction:'LR'|'TB'}`. Any other value fails with `bad_op`.
- `io.checkGraph` rejects a graph whose `direction` is present and is not `'LR'` or `'TB'`.
- Ask AI's proposal language does not get this op. Proposals keep the graph's current direction.

**Layout** (`builder/layout.js`). dagre's `rankdir` comes from the graph's direction. The rank relationships stay as they are:
- data goes one rank before its reader, which is above it in TB and to its left in LR;
- a monitor goes one rank after what it watches.

Spacing is tuned for each direction. In LR, ranks are further apart so the port labels and "+" stubs on the right have room. Every caller already goes through `layoutGraph` or `layoutOps` and gets the graph's direction: Arrange, the "+" inserts, Ask AI's apply, and the template load.

**Nodes and edges.** Each handle rotates with the direction:

| Handle | TB | LR |
|---|---|---|
| flow in | Top | Left |
| flow out ports | Bottom, spread along it | Right, spread along it |
| agent/tool "reads data" | Top, left 18% | Left, top 18% |
| data `acc` | Bottom | Right |
| tool/outcome watch source | Bottom, left 88% | Right, top 88% |
| monitor watch target | Top | Left |

Port labels (yes/no, approved/denied) and "+" stubs go beside each out port: below it in TB, to its right in LR. Edges keep `getSmoothStepPath`, which follows the handle positions. The midpoint "+" is unchanged.

**The Arrange control** is a split button. It is hidden on locked revisions, as Arrange is today.
- **Arrange** (`#arrangeBtn`) re-runs the layout in the current direction. This is unchanged behaviour.
- **▾** (`#arrangeMenuBtn`) opens a small menu with two items, each with an icon and a check mark on the current direction:
  - "Left to right" (`[data-dir="LR"]`);
  - "Top to bottom" (`[data-dir="TB"]`).
- Picking an item dispatches **one patch**: `[{op:'setDirection'}, ...layoutOps(graph in that direction)]`, labelled "Arrange left to right" or "Arrange top to bottom". Then the canvas fits the view. One undo restores the old direction and the old positions together.
- Escape, or a click outside, closes the menu. Every string is in en and zh.

**Acceptance (new probes):**
- **D1.** A template opens LR: every flow edge's target is to the right of its source (target x > source x + width/2), and B7's no-overlap check passes in LR, in en and zh.
- **D2.** The menu's "Top to bottom" item produces TB: flow targets are below their sources, and a flow in-handle is on the node's top edge. One undo restores LR and the exact previous positions. Redo reapplies both.
- **D3.** Export → import keeps `direction`. A graph with `direction: 'diagonal'` fails to import with `bad_graph`. The semantic hash is equal for the same graph in LR and TB.
- **D4.** A locked revision shows neither Arrange nor the menu.
- **Unit tests:** a `setDirection` op test; `checkGraph` accepting and rejecting direction values; `layoutGraph` monotonic along x in LR and along y in TB for every template.
- **Existing tests:** all existing probes still pass. Probes whose geometry assumed TB are updated to read the direction.

**Ownership.** Claude implements everything; the change is small and touches the UI throughout. DeepSeek and Codex review the plan and the code. No push.

### 3.12.1 Revisions from round 9 (v0.10)

- **Ask AI apply uses the current direction** (Codex #1). A direction switch does not change the semantic hash, so a proposal made before the switch stays applicable. Apply now lays out the previewed result in the direction the graph has at that moment: `layoutOps({...p.after, direction: dirOf(store.active().graph)})`. The frozen ops are still applied unchanged, and layout recomputes every position, so the result has no stale positions and no stale handle sides.
  - New probe **D5**: propose a change in LR, switch to TB from the menu, then Apply. The result is TB: `graph.direction === 'TB'` and flow targets are below their sources. One undo returns to the TB graph from before Apply.
- **Where the LR default is injected** (DeepSeek nit 2):
  - `controller.laidOut` sets `graph.direction = 'LR'` before it lays out a template;
  - `startBlank` creates `{nodes: [], edges: [], direction: 'LR'}`;
  - one helper, `dirOf(graph) = graph.direction === 'LR' ? 'LR' : 'TB'`, is the single reader.
- **Only handle `Position` changes** (DeepSeek nit 3). Handle ids (`in`, out ports, `acc`, `w`) are unchanged, so every stored edge stays valid.
- **The direction switch lays out the projected graph** (DeepSeek nit 5). The ops are `setDirection` followed by `layoutOps({...graph, direction: next})`.
- **§6 is updated** (DeepSeek nit 1). The allowed engine changes now include `setDirection` in `model.applyPatch` and the `direction` check in `io.checkGraph`.
- **Stale comments** in `layout.js` and in `Builder.ensureVisible` are updated (DeepSeek nit 4).

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
  - **Added by §3.12 (v0.9):** `model.applyPatch` gains `{op:'setDirection', direction:'LR'|'TB'}`, and `io.checkGraph` rejects a `direction` other than `'LR'` or `'TB'`. Neither affects the semantic hash or the simulation.
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

### Round 4 (v0.4 amendment): DeepSeek PLAN-APPROVED, Codex PLAN-REJECTED (3)

| # | Objection (who) | Change in v0.5 |
|---|---|---|
| C4-1 | Proposals aren't bound to their source graph; there's no late-response handling and no protection against a repeated Apply (codex) | §3.10.1 A: request binding, one request at a time, a stale state, Apply re-checks and consumes, plus probes |
| C4-2 | An op whitelist plus `checkGraph` isn't enough: `setConfig` accepts arbitrary keys, there are prototype keys, `ref` remapping and macro overrides are undefined (codex) | §3.10.1 B: per-op schemas and bounds, a working-graph expansion with `ref` remapping, overrides turned into validated `setLabel`/`setConfig`, raw `addNode`/`moveNode` withheld from the model, exceptions turned into Results, unit tests |
| C4-3 | The `sample` handling is incomplete: the `null` capability, the full set of permanent codes, the waiting state, the byte bound (codex; deepseek non-blocking) | §3.10.1 C: every code mapped, unknown codes treated as retryable manually, the byte budget with a truncation order; probes in D |
| D-ns | Error code map, prompt size, and the "only engine change" wording (deepseek) | C, and E |

### Round 5 (v0.5): DeepSeek PLAN-APPROVED, Codex PLAN-APPROVED, Claude PLAN-APPROVED

DeepSeek's non-blocking notes are applied in the implementation, and the plan text is unchanged:
- per-op value checks apply the op to a working graph and run the exported `checkGraph`, so no second export is needed;
- the rule-based proposer's output goes through the same validator;
- a macro's overrides are applied in dependency order (`kind` / `action` / `monitor` first);
- `web/package.json` gains `"test": "node --test tests/"`.


## 9. Implementation record and outcome

Branch `blueprint-studio` (local; not pushed). Code-review base: `5989ec4` (the approved v0.3 plan commit).
- **Task 0 (claude), `131aede`:** the Vite/React Flow app, store adapter, controller, builder foundation, the Validate pattern, and the `canConnect` change with 3 tests.
- **Tasks 1, 2 and 5 (claude):**
  - builder: canvas, nodes, "+" insertion, node search with our own bilingual ranking, config panel, checklist;
  - test-run panel, About panel;
  - probes; the v1 DOM UI removed.
- **Tasks 3 and 4 (deepseek):** Confirm / Optimize / Decide / Register; the Chinese dictionary (380 keys).
- **§3.10 Ask AI:**
  - claude: `AssistantPanel`, the Claude proposer and prompt budget, `validateProposal`, and exporting `io.checkGraph`;
  - deepseek: `rules.js`, the rule-based proposer, plus its tests and the proposal-validator tests.

**Found by Claude's own probes before review:**
- Clicks landed before fit-view settled (a probe-harness bug).
- cmdk's fuzzy subsequence matching made "outcome" select Tool. It was replaced by our own ranking: label prefix, then label, then synonym, then description, substring-only, in both languages.
- A blank flow zoomed to 1.8× and new steps landed off-screen. Fit is now capped at 1×, and new steps are kept visible.
- The stub dropped `__proto__` in a JSON round-trip (a probe bug; the stub now delivers raw JSON).

### Code review (plan v0.5)

| Round | DeepSeek | Codex | Codex defects → fixes |
|---|---|---|---|
| 1 (`8906b8d`) | APPROVED | REJECTED (4) | (1) The AI preview hid applied settings → the preview lists the exact expanded changes, and Apply dispatches that frozen patch. (2) Capability and range inputs ignored Undo → controlled inputs. (3) Checklist Discard didn't restore the field, and an invalid range was ignored → drafts follow the pending registry, and invalid ranges and limits register as pending. (4) Rules changed meaning ("above $1,000", dual, 500.75) → faithful qualifiers and numbers. New probes C1–C4 |
| 2 (`2d18a66`) | APPROVED | REJECTED (2) | (1) Connection lines had no ports → `A [port] → B [port]`, with C1 made strict. (2) Unsupported clauses were silently dropped → a whole-sentence anchored grammar |
| 3 (`f2d9127`) | APPROVED | REJECTED (1) | The legacy `nlcompile` fallback was unanchored → removed; the legacy phrases are reimplemented in the anchored grammar, and negations are unmatched |
| 4 (`44b8134`) | APPROVED | REJECTED (1) | Redaction covered only the first incoming edge → `insertStep {edge}` added to the proposal language; from/to is ambiguous-safe; a gate on every incoming edge; probe C5 |
| 5 (`c9652d0`, full `9e56643`) | **IMPL-APPROVED** | **IMPL-APPROVED** | — |

**Final verdicts on revision `c9652d0`** (`git diff 5989ec4`, excluding the built `app/` and the lockfile; full diff `9e56643`):
- DEEPSEEK: IMPL-APPROVED
- CODEX: IMPL-APPROVED
- CLAUDE: IMPL-APPROVED

**Evidence at approval:**
- 37/37 headless probes, covering T0, B1–B10, R1–R3, L1–L9, I1, T1–T4, PERF, A1, A2, A2b and C1–C5. T1 builds a working flow from empty in 11 real input events.
- 37 web unit tests and 94 engine unit tests.
- `npm run check`: the committed `app/` equals a fresh build.
- `npm run i18n`: 380 keys.
- The bundle is 237 kB gzip.
- `index.html`, `assurance.html` and `swm/` are unchanged.

**What each seat caught:**
- **Codex:** every implementation defect (4+2+1+1). At plan stage: the proposal binding, per-op validation and the full `sample` error map, and the `canConnect` duplicate-edge conflict.
- **DeepSeek:** at plan stage, the branching-insert dangling port and the missing monitor authoring (with Codex). In implementation: the scanner's handling of dynamic i18n keys. It built the four Assurance pages, the dictionary, the rule grammar and the proposal tests.
- **Claude:** the plan and its revisions, the builder, Ask AI's safety design, the probes, and the pre-review fixes listed above.

**Roster:** Claude + DeepSeek + Codex, unanimous at every gate. DeepSeek's balance and Codex's Pro limit were both verified before use.

**Demo for the user's review.** The private Claude Artifact https://claude.ai/artifact/2ftyPhgEcbnX6hjb4LjNQS serves the approved `app/` bundle unchanged (checked with `cmp`), and declares the `sample` capability so that Ask AI can use Claude inside the viewer. Its file listing shows all three files at their built sizes.

**Not verified headless:** a real Claude call in the viewer. The user's first Ask AI prompt there is the live check. Nothing has been pushed, and the v1 log edits from 2026-09-22 remain in `git stash`.

### Round 6 (v0.6 templates amendment): DeepSeek PLAN-REJECTED (1), Codex PLAN-REJECTED (1)

| # | Objection (who) | Change in v0.7 |
|---|---|---|
| D6-1 / C6-1 | Rows 9–11 promise 0–100 or integer units, but benign amounts are always $20–$3,000, continuous (both) | §3.11.1: every template's amount is money; rows 9–11 redefined; the benign range disclosed everywhere; domain assertions over every generated request |
| D6-ns | Disclose `order`/`customer` meaning; say where amount is cosmetic; #3 amount is supplied; `expectedFindings` from the observed run | all adopted (§3.11.1) |

### Round 7 (v0.7): DeepSeek PLAN-APPROVED, Codex PLAN-REJECTED (2)

| # | Objection (codex) | Change in v0.8 |
|---|---|---|
| C7-1 | The range disclosure was inaccurate (split/replay [hi, 2hi], duplicate/injection [0, t′), the default params when no monitor, rounding to 0) | §3.11.2: the exact rule table from `adversary.js`, disclosed in the gallery and README; assertions via `scenarioParams()` incl. the fallback; zero allowed where the draw can produce it |
| C7-2 | Calling #4's amount "cosmetic" is misleading: capability limits still apply | §3.11.2: reworded; the agent's limit is ≥ 2·hi; the test asserts both duplicate writes execute (also on #7, #9, #11) |

### Round 8 (v0.8): DeepSeek PLAN-APPROVED, Codex PLAN-APPROVED, Claude PLAN-APPROVED

DeepSeek's nit on the stale `(lo, hi]` comment in `adversary.js` is taken as a one-line comment fix; there is no behaviour change.



### Templates implementation and code review (plan v0.8 §3.11–§3.11.2)

- **Built:** 11 new templates by DeepSeek, giving 13 in total across 7 n8n-style categories. Claude added metadata to the 2 original templates, leaving their graphs unchanged. Claude also built the gallery (category tabs, bilingual search, cards, range disclosure), wired it to File → Browse templates and the empty state, and added probes G1–G3.
- **Round 1:** DeepSeek IMPL-APPROVED. Codex IMPL-REJECTED with 2 defects:
  1. The RAG template had no knowledge base. Fixed: it now has a `Knowledge Base (vector store)` data node, and a test asserts that it is read.
  2. The multi-agent template had no writer stage and treated the reviewer agent as an approval. Fixed: a Writer Agent was added, and the monitor became "Publish Without Editor Approval". A test asserts the researcher → writer → reviewer → CMS order.
- **Round 2:** DeepSeek IMPL-APPROVED, Codex IMPL-APPROVED, Claude IMPL-APPROVED.
- **Evidence:** engine tests 139/139, web tests 37/37, i18n 392 keys, `npm run check` green, probes 40/40.
- **Delivery:** the demo artifact was republished to the same URL (version 2). Nothing was pushed.

### Round 9 (v0.9 direction amendment): DeepSeek PLAN-APPROVED, Codex PLAN-REJECTED (1)

Codex found that an Ask AI proposal made before a direction switch would be laid out in the old direction when applied. The fix is in §3.12.1, along with DeepSeek's nits.

### Round 10 (v0.10): DeepSeek PLAN-APPROVED, Codex PLAN-APPROVED, Claude PLAN-APPROVED
