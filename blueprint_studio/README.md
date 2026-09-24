# Agentic Blueprint Studio (v2)

A workflow builder for agentic systems that runs entirely in the browser. You draw a workflow, confirm it, attack it with scripted scenarios, test candidate fixes, approve one and register it. Every finding and number is **computed from the graph on the canvas**.

- **Open:** `blueprint_studio/app/index.html` from any static server (for example `python3 -m http.server` at the repo root, then `/blueprint_studio/app/`). `blueprint_studio/index.html` redirects there.
- **Plan and review record:** [`../logs/2026-09-23_WORKFLOW_BUILDER_PLAN.md`](../logs/2026-09-23_WORKFLOW_BUILDER_PLAN.md). The engine it builds on was reviewed in [`../logs/2026-09-22_BLUEPRINT_STUDIO_PLAN.md`](../logs/2026-09-22_BLUEPRINT_STUDIO_PLAN.md).

## Built on open source

| Piece | Library (licence) | Why |
|---|---|---|
| Canvas | React Flow `@xyflow/react` (MIT) | The canvas under Dify, Langflow and Flowise: custom nodes, handles, edge buttons, minimap |
| Layout | dagre (MIT) | Layered layout, left to right by default or top to bottom; data sits before its readers, monitors after what they watch |
| Node search | cmdk (MIT) | The search menu. Ranking is our own: substring matching in English and 中文 |
| UI | React 19 + Vite 7 (MIT) | Built to static files with relative paths; no backend |

We borrowed patterns, not code, from Activepieces, Coze Studio and Dify, following the research report *Agent_Builder_UI_研究报告*:
- **Activepieces:** a "+" on every connection and beside every open output, so you build step by step.
- **Coze Studio:** node search with a plain-language explanation for every step, in 中文 and English.
- **Dify:** the canvas holds structure, the side panel holds details, and advanced settings stay collapsed.
- **Everywhere:** a clear **Test run** entry point, and a **Checklist** that takes you to each problem.

## What you can do

- **Builder**
  - **Add steps:** use "+" on a connection to insert a step, or "+" beside a node’s open output to add the next one. Branches are completed explicitly.
  - **Library:** search it, and drag or click a step onto the canvas.
  - **Settings:** click a node to open its settings (Basic, then Advanced). Expressions are checked as you type, and a refused edit shows up in the Checklist until you fix or discard it.
  - **Data and monitors:** add a data source from an agent or tool panel. Protect a tool or outcome with a monitor from its own panel.
  - **Editing:** undo and redo; **Arrange** re-runs the layout.
  - **Direction:** workflows flow **left to right**. **Arrange ▾ → Top to bottom** re-arranges and switches direction, and **Left to right** switches back.
    - A switch is one undo step.
    - The direction is saved with the revision (`graph.direction`), outside the semantic hash.
    - Documents saved before this option existed keep their top-to-bottom layout.
  - **Test run:** runs one request node by node, pauses at approvals for you to decide, and shows each step's effects.
- **Ask AI (n8n-style)**
  - Describe a change in English or 中文, e.g. "在 Refund Eligibility 后面加一个人工审批" or "rename Payment API to Stripe Refunds".
  - You get a proposal: a list of changes, the issues it fixes or leaves, and the affected steps highlighted on the canvas. **Nothing changes until you press Apply**, and one undo reverts it.
  - **Inside a Claude Artifact**, Claude writes the proposal using your own Claude account, and asks your permission the first time.
  - **Elsewhere, e.g. the static Vercel site**, a **rule-based** mode handles a fixed set of phrases in both languages and never guesses.
  - Either way the proposal is untrusted. It is validated change by change against the same checks an import uses before you can apply it.
- **Assurance:** Confirm → Validate → Optimize → Decide → Register.
  - **Validate** runs 240 seeded adversary scenarios. Monitors report what actually went wrong, and the exact paths where it happened.
  - **Optimize** tests candidate fixes on the same scenarios and recommends the lowest-friction eligible one.
  - **Approve** creates a new locked revision containing exactly the tested change.
  - **Register** records it as "Registered · not deployed".
- **中文 / English** toggle; File → Browse templates, import, download or **Copy JSON** (some viewers block downloads).

## Templates (n8n-style)

**File → Browse templates** opens a gallery grouped like n8n's library: AI, Sales, IT Ops, Marketing, Document Ops, Support, Other.

The 13 templates are modelled on common n8n workflow patterns:
- **AI:** RAG support agent; multi-agent research → write → review.
- **Support:** AI email triage; customer refund.
- **Sales:** lead enrichment → CRM → Slack; discount approval.
- **Marketing:** RSS → AI → social.
- **Document Ops:** invoice processing; contract review and e-signature; vendor bank-detail change.
- **IT Ops:** access requests; alert triage and containment.
- **Other:** employee onboarding.

They are **our own typed security graphs, not imported n8n workflows**. Gmail, Slack, CRM and similar tools appear as steps, not live connections. Every template states what its `amount`, `customer` and `order` stand for. Its expected findings are the ones the engine actually produces, and `tests/templates.test.mjs` checks them.

**How simulated requests are drawn.** The same six scenario types run for every template. Amounts are dollars, rounded to cents. The parameters come from the first unauthorized-write monitor: threshold *t* and probe range [*lo*, *hi*]. Without one, the defaults are t = 500, lo = 0, hi = 1000. Below, t′ = t if t > 0, else hi.

| Scenario | amount |
|---|---|
| below_threshold | [lo, hi); eligible 0 |
| split | [hi, 2·hi); pieces ⌈amount / 0.96·t′⌉, 2–10 |
| replay | [hi, 2·hi); second request eligible 0 |
| duplicate_submit, injection_exfil | [0, t′) |
| benign | log-uniform [20, 3000) |

## What is real and what is simulated

- **Real:**
  - the editor;
  - the engine that runs your graph node by node;
  - the monitors;
  - every number: the same graph and scenario set always give the same results.
- **Simulated:** there are no real agents, tools or models in the scenarios. Agents follow a **declared adversary model**:
  - they obey instructions injected into untrusted input;
  - they may split requests when allowed;
  - they reuse approvals when the binding permits.
- **What a result means:** "0 violations in the tested scenarios" is a sample, not a proof. Findings carry the evidence grade *Declared*. Nothing is ever deployed.
- **Ask AI's Claude mode** is the only place a model is used. It only *proposes* changes. It is available only inside the Claude Artifact viewer. It costs the viewer's own Claude usage.
- **English-only by design, in both languages:**
  - expression-parser error details;
  - JSON views and node ids;
  - the Optimize ineligibility reasons;
  - template step names, which are document content.

## Layout of the code

```
js/           the engine (pure ES modules, reviewed 2026-09-22): model, expr, engine, monitors, adversary, validate, optimize, io, nlcompile, store, layout (legacy)
templates/    13 templates + index.json (order and categories); bundled via import.meta.glob
web/          Vite + React source — CONTRACT.md is the integration contract
  src/state/     storeAdapter (React ↔ store), controller (jobs, runs, I/O), pendingInputs
  src/builder/   Canvas, nodes, edges, NodeSearch, ConfigPanel, Checklist, insert.js, layout.js (dagre), catalog
  src/assist/    AssistantPanel, propose.js (Claude), rules.js (rule-based), validateProposal.js
  src/assurance/ Confirm, Validate, Optimize, Decide, Register
  src/run/       TestRunPanel        src/i18n/ zh.js, en.js
app/          the built site (committed; `npm run check` fails if it is stale)
tests/        engine unit tests (incl. direction) + 16 semantic fixtures; probe/run-probes-v2.mjs (headless Chrome acceptance probes)
```

## Build and test

```bash
cd blueprint_studio/web && npm ci
npm run build      # writes ../app
npm test           # web unit tests (proposal validator, rules, prompt budget)
npm run i18n       # every key has Chinese
npm run check      # ../app matches a fresh build
cd .. && node --test tests/                          # engine unit tests
node tests/probe/run-probes-v2.mjs [--shots dir]     # from the repo root: acceptance probes (needs Chrome)
```
