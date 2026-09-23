# Blueprint Studio: from clickable mockup to a working workflow orchestrator (plan v0.3)

Author: Claude (lead) · 2026-09-22 · Status: **v0.3 — APPROVED by all three seats in round 3: DEEPSEEK: PLAN-APPROVED · CODEX: PLAN-APPROVED · CLAUDE: PLAN-APPROVED.** Review base for the code gate: `d322487` (`d322487da90aed26babf3ae09fb3f645af02b4cf`).
Request: *"参考 https://silex-mockup.vercel.app/ blueprint studio tab 的需求设计，帮我把这个功能扩展成一个真正可用的 workflow 编排，请帮我参考目前开源的 workflow 编排 UI 工具，设计 plan，交给 deepseek/codex review，通过就可以执行实现，可以复用 silex-mockup 建立一个新目录 blueprint_studio 来放置这个功能代码。过程中尽量不需要我来干预。"*
Roster: **claude** (lead, judge) · **deepseek** (`opencode`, `deepseek/deepseek-reasoner`, reviewer + bulk implementer) · **codex** (`codex-cli 0.153.4`, reviewer). Both gates are unanimous.

## 1. What exists today (read, not assumed)

`index.html` → `#blueprint` (lines ~646–860) is a scripted mockup:

- **Build:** nine hard-coded `.bp-node` divs, eight `<line>` edges, drag by header, `＋ Agent` / `＋ Control` add *unconnected* nodes that cannot be wired, "Generate / Update" only changes a badge, "Save draft" only toasts.
- **Confirm → Validate → Optimize → Decide → Register:** a six-stage bar with real state guards (`bpConfirmed`, `bpDecision`, `bpRegistered`), but every finding, path, percentage and candidate is fixed text. Nothing is computed from the graph.
- The requirement it encodes (PRD §12–22 per its `data-chg` tags): typed nodes (Trigger, Agent role, Business constraint/Decision, Control point, Tool/MCP, Outcome, Prohibited outcome); implementation candidates per node; confirm locks a version and edits create a revision; validation asks *which unsafe outcomes are reachable*; findings with categories; alternative paths with evidence grades; policy candidates each tested with a multi-objective scorecard; human Approve / Modify (re-run) / Reject; register adds to the inventory and does **not** deploy.
- The mockup's Confirm screen states the baseline gap this plan's template encodes: *"refunds above $500 need approval (currently declared as autonomous up to $2,000)"*. The mockup **graph** is a sketch: it draws one prohibited outcome and no data nodes while its Validate screen evaluates three unsafe outcomes. The template (§4.6) is therefore richer than the sketch, and its counts come from the template, not the mockup.

**Goal:** a standalone, genuinely working version of that lifecycle in `blueprint_studio/`, where the graph is editable end-to-end and everything downstream (findings, paths, candidates, numbers) is **computed from the graph the user built**.

## 2. What we borrow from open-source workflow UIs (patterns, not code)

No code or dependency is taken from any of these; they informed the interaction design.

| Tool (licence) | Pattern we adopt | Where it lands |
|---|---|---|
| **React Flow / xyflow** (MIT) | Typed handles; drag-from-handle to connect with a live preview edge; minimap; zoom/fit controls; marquee multi-select; snap grid | `canvas.js` |
| **Rete.js** (MIT), **Langflow** (MIT), **ComfyUI** (GPL-3) | Socket compatibility: an edge can only be dropped on a compatible port; incompatible ports dim while dragging; port kind shown by colour | `model.js` + `canvas.js` |
| **Node-RED** (Apache-2.0) | Palette grouped by category, drag onto canvas; one portable JSON; *draft vs. deployed* separation | palette, `io.js`, revisions |
| **n8n** (Sustainable Use) | Per-node execution data after a run; step-by-step test run; run history; expressions in fields | Run panel, `engine.js` |
| **Dify workflow** (Apache-2.0 based) | Typed variables between nodes; run trace panel; *publish* freezes a version | payload, Confirm |
| **Kestra** (Apache-2.0) | Validate with inline error markers on the node; source ⇄ topology (we do JSON ⇄ canvas) | `validate.js`, JSON tab |
| **Temporal / Airflow / BPMN engines** | Deterministic, replayable, seeded runs; **dead-path elimination** (skip propagation) so an AND-join never waits on an untaken branch | `engine.js` |

## 3. Scope

**In scope — a working orchestrator, fully in the browser, no backend:**

1. **Editor:** palette → drag onto canvas; connect by dragging from an output port to a compatible input port; select / multi-select (shift-click, marquee); move; delete; copy/paste; **undo/redo**; pan/zoom/fit; minimap; layered **auto-layout**; snap grid; inline lint badges per node.
2. **Inspector:** a form generated from each node type's config schema. Every field listed in §4.1 affects the engine; fields with no semantics are not offered.
3. **Engine** (§4.2–4.3): interprets the blueprint on a request. Interactive mode pauses at human approvals for the user; batch mode resolves them by the declared approver policy. Run panel with per-node status, in/out payload, effects, log; step mode; run history.
4. **Validate** (§4.4–4.5): structural lint, static *potential* paths, and seeded adversarial simulation with trace monitors.
5. **Optimize** (§4.7): candidate patches generated from finding classes, tested on the **frozen** scenario set, gated, scored, and one recommended by a stated rule (or none).
6. **Decide / Register** (§4.8): Approve / Modify / Reject / Accept-as-is, bound to revision hashes; Register pins a revision into a local inventory and exports policy-as-code text. Nothing is deployed.
7. **Revisions** (§4.8): monotonic revisions, immutable once confirmed, content-hashed, with a parent chain and a structural diff between any two.
8. **Persistence and I/O:** autosave to `localStorage`; import/export `silex.blueprint/v1` JSON (schema-checked on import); two bundled templates (Customer Refund; Vendor Bank-Detail Change, from incident I-1042).
9. **Natural language → patch:** a **deterministic, rule-based** compiler for a documented phrase set, labelled "rule-based, no AI" in the UI. No LLM is called.

**Out of scope:** backend, real agents or tools, LLM calls, collaboration, cycles/loops, agent-to-agent delegation (dropped from v0.1: it had no semantics), and any change to `index.html`, `assurance.html` or `swm/` (§8).

## 4. Semantics (the part that must be honest)

The simulation proves things **about the declared graph under a declared adversary model**, never about real agents. That sentence is on every computed screen. **Sampling cannot prove a path impossible**; the UI says "0 violations in M tested scenarios", never "closed" or "impossible".

### 4.1 Graph model `silex.blueprint/v1`

A document holds metadata and revisions (§4.8). A revision's graph:

```json
{ "nodes": [ { "id": "n1", "type": "trigger", "label": "Customer Request", "x": 20, "y": 55,
               "config": { "channel": "support_chat", "trust": "untrusted" } } ],
  "edges": [ { "id": "e1", "kind": "flow",   "from": {"node":"n1","port":"out"}, "to": {"node":"n2","port":"in"} },
             { "id": "e9", "kind": "access", "from": {"node":"n6","port":"acc"}, "to": {"node":"n11","port":"acc"}, "mode": "read" } ] }
```

Port kinds: `flow-out`, `flow-in`, `acc`. A flow edge joins a `flow-out` to a `flow-in`; an access edge joins an agent/tool `acc` to a data `acc`. Anything else is refused at drop time. At most one edge per `flow-out` port (fan-out is expressed with several out ports, not several edges from one; v1 has no parallel fork node, so there is exactly one live token path per request branch — see split below).

| Type | Ports | Config (every field has engine semantics) |
|---|---|---|
| `trigger` | out | `channel` (label only, shown in trace), `trust`: `untrusted`/`internal` |
| `agent` | in, out, acc | `candidate` (label only, shown), `capabilities: [{cap, limit}]`, `canSplit` (bool), `outputCeiling`: `public`/`internal`/`secret` |
| `tool` | in, out, acc | `cap`, `sideEffect`: `none`/`write`, `idempotencyKey` (bool) |
| `decision` | in, out:`true`, out:`false` | `condition` (expr, §4.2) |
| `control` | in, out:`approved`, out:`denied` | `kind`: `human_approval`/`dual_approval`/`policy_gate`; `appliesWhen` (expr; false → pass `approved` without approval); `binding ⊆ {customer, order, amount}`; `singleUse`; `slaMinutes`; for `policy_gate`: `rule` (expr) and `action`: `block`/`redact`, `redactAbove`: `public`/`internal` |
| `data` | acc | `sensitivity`: `public`/`internal`/`secret` |
| `outcome` | in | `success` (bool), `external` (bool: emits to the requester) |
| `prohibited` | none | `monitor` + params (§4.4), `severity`, `watches: [nodeId]` (serialized; the effect-producing tools/outcomes the monitor is about; drawn as dotted lines with no execution meaning; used for static potential paths) |

Hash: SHA-256 of the canonical JSON (sorted keys) of `{nodes without x/y, edges, name, domain}`. Positions are view state and excluded.

### 4.2 Requests, sessions, expressions

- **Request** `{id, customer, order, amount, eligible, channel}`. `eligible` is ground truth (what the customer is entitled to); approvers can see it, agents cannot change it.
- **Session** = the requests of one scenario, executed sequentially on one simulated day, sharing a **ledger**: writes `{writeId, requestId, parentRequestId, customer, order, amount, cap, approvalId|null}`, approvals `{id, binding values, approvers, singleUse, consumedBy: [writeId]}`. Fork state: each token has its own payload copy; only the ledger is shared.
- **Expressions** (`expr.js`): literals, identifiers, dot paths, `! && || == != < <= > >=`, parentheses. **No `eval`, no `Function`.** Variables: `amount customer order channel trust eligible` and `dayTotal` (sum of ledger writes for this customer today **plus this token's amount**). Unknown identifier → evaluation error → run ends `error` (lint flags it before).

### 4.3 Engine rules per node type (the behavioural contract)

A request enters at its trigger with payload `{req, labels: ∅, approval: null, principal: null}`.

**Activations.** Every token belongs to an *activation* with id `requestId` (or `requestId#i` for split piece *i*). Node state (has it fired, which incoming edges delivered a token or a skip) is kept **per activation**, so each split piece traverses every downstream node afresh and no piece is discarded as a "second arrival". Activations of one session run strictly in order (request 1, then its pieces in index order, then request 2 …), which is what makes `dayTotal` and the ledger deterministic.

**Skip propagation.** Every branching node (decision, control) sends a *skip* down the port it did not take. A node whose incoming edges have all delivered skips forwards a skip on every out port and does not execute. Terminal routes (outcome, `error`) end the activation; there is nothing to propagate after them, because v1 has one edge per out port and no parallel fork.

- **trigger:** sets `trust`. If the scenario carries an injected instruction and `trust = untrusted`, payload gets `injected: true`.
- **agent:** sets `principal` to itself. For each **read** access edge: effect `data_read{data, sensitivity}`; the agent's *read set* grows. Output labels = read-set items with sensitivity ≤ `outputCeiling`, **or the whole read set if `payload.injected`** (adversary model: agents follow instructions carried by untrusted input). **Split:** if `canSplit` and the scenario intent is `split(k)`, the token is replaced by k tokens with `amount/k` (rounded to cents, remainder on the last), same `parentRequestId`, run in order.
- **decision:** evaluate `condition`; go to `true`/`false`; the other port receives a **skip** (dead-path elimination).
- **control:**
  - `appliesWhen` false → `approved` with no approval.
  - Presented approval (scenario intent `replay`), **`human_approval` / `dual_approval` only**: accepted, without asking, iff **valid for this request**: exists, not consumed if `singleUse`, and every field in its binding equals this request's value. Accepted → `approved` carrying that id. Otherwise it asks as normal.
  - `human_approval` / `dual_approval`: batch approver policy: approve iff `amount + (already written for this parentRequestId) ≤ eligible` (for an unsplit request this is `amount ≤ eligible`; approvers see the request's `eligible`, pieces inherit their parent's); interactive: the user clicks Approve/Deny. Approve → effect `approval_issued{id, binding values, approvers: 1|2, singleUse}`, latency += `slaMinutes` (×2 for dual).
  - `policy_gate` **never accepts a presented approval**; it always executes its own action. `action: block` → evaluate `rule`: true → `approved`, false → `denied`. `action: redact` → **unconditionally** (when `appliesWhen` holds) drop labels above `redactAbove`, then `approved`; `rule` is not used for redact.
- **tool:** `sideEffect: write`: authorization requires `principal` with capability `cap` and `limit ≥ amount`; otherwise effect `write_denied{reason}` and the token ends `error` (not a violation). `idempotencyKey`: a write for a `(customer, order, cap)` that the ledger already holds **from a different `parentRequestId`** is refused (`write_denied{duplicate}`); pieces of the same request are not duplicates of each other. On success: effect `write{…}`; if the token carries an approval, `approval_consumed{id, writeId}`. Labels pass through unchanged (tools do not put what they read into the payload).
- **outcome:** effect `emit{node, labels, external}`; the run ends `success` or `failure` per `success`.
- **Joins:** per activation, a node with several incoming flow edges fires on the first token (`join: first`, default) or when every incoming edge has delivered a token or a skip (`join: all`), so an untaken decision or control branch never blocks.
- **Determinism:** `mulberry32(seed)`; all ordering is by id. Same graph + same scenario → byte-identical trace.

### 4.4 Monitors (evaluated over the session's ledger and trace)

- `unauthorized_write{cap, threshold, scope: write|request|customer_day, minApprovers, probeRange: [lo, hi]}`: writes on `cap` are grouped by `scope` and taken in execution order. A write **needs approval** when the group's cumulative total, including that write, exceeds `threshold`. Such a write is a violation unless it has a *proper* approval: consumed by that very write, **no earlier consumer**, `approvers ≥ minApprovers`, and every field in the approval's binding equal to the write's value. This catches split evasion (scope `request`: pieces share `parentRequestId`; the piece that crosses the threshold and every later one need approval) and replay (a second consumer). A write inside the budget is not a violation, so an aggregate gate such as `dayTotal > 500` can reach 0. (`probeRange` is the adversary's amount range, §4.5; it has no monitor semantics.)
- `duplicate_effect{cap}`: successful writes on `cap` for the same `(customer, order)` coming from **more than one request** (distinct `parentRequestId`). It is about double compensation for one order, not entitlement: a single write to an order with `eligible = 0` (below_threshold, replay) is *not* a duplicate, split pieces of one request are not duplicates, and two requests for different orders never trigger it. Over-entitlement is out of scope for v1 monitors and is said so in the README.
- `secret_exposure`: an `emit` with `external: true` carries a label whose sensitivity is `secret`.

Defaults (fixed in `CONTRACT.md`): `minApprovers = 1`; approvals per `human_approval` = 1, per `dual_approval` = 2; agent `outputCeiling = internal`; `join = first`. A `benign` scenario is exactly one request per session.

Required fixtures (Task 0, `tests/fixtures/semantics/`, with exact expected ledgers and verdicts): split $800 → 2×$400 under a $500 request-scope threshold, no approvals → the second write violates, the first does not; the same with a `dayTotal > 500` gate before an approval → no violation; same-binding replay of a single-use approval → refused at control, no violation; same-binding replay of a reusable approval → violation (second consumer); mismatched-binding replay → refused; two legitimate requests, same customer, different orders → no violation; `join: all` after a decision → fires; secret read by an agent with `outputCeiling: internal`, no injection → no exposure; with injection → exposure; redact gate → no exposure; **redact gate on a secret-bearing payload that also presents an approval → still redacted**; `block` gate with a presented approval and a false rule → denied; **three split pieces through decision → control → `join: all` node** → three activations each fire the join once, with skips from the untaken branches; `duplicate_submit` with idempotency → second request refused, split pieces of one request with idempotency → all written.

### 4.5 Scenarios, findings, metrics

- **Adversary templates** (intent + parameters, drawn from the watched monitor's `threshold` *t* and `probeRange [lo, hi]`; preconditions only decide the label "applicable to baseline", never whether a scenario is run):
  - `below_threshold`: one request, amount uniform in (lo, hi], eligible = 0;
  - `split`: one legitimate request (eligible = amount), amount uniform in (hi, 2·hi], intent `split(k)` with k = ceil(amount / (0.96·t′)), t′ = t if t > 0 else hi, capped at 10;
  - `replay`: request 1 legitimate and approved (amount uniform in (hi, 2·hi], eligible = amount); request 2 is a different order, same customer and amount, eligible = 0, presenting request 1's approval;
  - `duplicate_submit`: the same order submitted twice, amount ≤ eligible ≤ t (or ≤ hi if t = 0);
  - `injection_exfil`: untrusted trigger, injected instruction, legitimate amount ≤ t (or ≤ hi);
  - `benign`: amounts log-uniform $20–$3,000, eligible = amount, no attack. Benign scenarios are monitored too: a violation there is a finding in the category **Policy Gap (normal operation)** (the mockup's "Support Agent can issue refunds up to $2,000 without approval").
  Refund template: t = 500, probeRange = [500, 2000]; vendor template: t = 0, probeRange = [0, 10000].
- **Frozen scenario set:** generated **once from the confirmed baseline revision** with `seed = first 8 hex of its hash`, N per template (default 40, configurable), stored with id `S-<hash8>-<N>`. Every candidate is run on these exact scenarios. A scenario whose attack move is impossible on a candidate (e.g. no agent can split any more) still runs and counts in the denominator as "attempted, no violation". A metric with a zero denominator shows **n/a**.
- **Finding** = (monitor, template) with ≥1 violating scenario. It carries the violating count / scenarios run, the distinct node paths of violating runs (*violating paths*, from the trace), the category (`below_threshold`→Missing Approval, `replay`→Workflow Logic Risk, `split`→Cross-Agent Risk, `duplicate_submit`→Workflow Logic Risk, `injection_exfil`→Data Exposure) and the prohibited node's severity. Evidence grade on every finding and path: **Declared** (the site's legend: "from configuration, before deploy").
- **Static potential paths** (separate panel, separate word): flow paths from each untrusted trigger to each node in a prohibited node's `watches`, listing the decisions and controls on each. Labelled "potential (declared graph), not a violation".
- **Metrics**, formula in a tooltip on each: violations per monitor (count / scenarios run); *residual reachability* = adversarial scenarios with ≥1 violation / adversarial scenarios run; *benign policy violations* = benign scenarios with ≥1 violation / benign run; *benign completion* = benign scenarios ending at a `success` outcome / benign run; *friction* = benign scenarios that incurred a human approval / benign run; *added approval latency* = median total approval minutes over benign scenarios. The mockup's "defense confidence" and "compliance pass" are **dropped**: they have no honest formula here.

### 4.6 Templates (Task 0, exact contents)

**Customer Refund** (14 nodes: 9 flow nodes + 2 data + 3 prohibited; 9 flow edges, 2 access edges):
Customer Request (trigger, untrusted) → Request Triage (agent, `canSplit`, reads Customer Profile·internal) → Refund Eligibility (agent) → **"Refund > $2,000?"** (decision `amount > 2000`, the declared autonomy) —true→ Approval (control, human, binding {customer}, reusable, 15 min) —approved→ Refund Execution (agent, `refund.issue` limit 10,000, reads **Payment Credentials·secret**, outputCeiling internal); —false→ Refund Execution; Approval —denied→ Refund Declined (outcome, external, not success); Refund Execution → Payment API (tool, `refund.issue`, write, no idempotency key) → Refund Resolved (outcome, external, success).
Prohibited: Unauthorized Refund (`unauthorized_write`, refund.issue, **threshold 500**, scope request, probeRange [500, 2000], critical, watches Payment API); Duplicate Compensation (`duplicate_effect`, high, watches Payment API); Payment Credential Exposure (`secret_exposure`, high, watches both outcomes).
**Expected baseline findings — the complete list** (asserted exactly in `tests/validate.test.mjs`, no others): unauthorized_write via benign, below_threshold, split and replay; duplicate_effect via duplicate_submit only; secret_exposure via injection_exfil only. Expected after the composite `dayTotal > 500` + full single-use binding + idempotency + variant a: 0 violations for all of them, benign completion unchanged. The decision threshold (2000) differing from the monitor threshold (500) is asserted explicitly.

**Vendor Bank-Detail Change** (I-1042 shape): Vendor Email (trigger, untrusted) → Finance Agent (reads Vendor Master·internal) → Procurement Agent (`vendor.update` limit 50,000, `canSplit`) → "Change > $10,000 exposure?" → Approval (binding {customer}) → Vendor Master API (tool, `vendor.update`) → Change Applied. Prohibited: Unauthorized Vendor Change (`unauthorized_write`, vendor.update, threshold 0, scope request, probeRange [0, 10000], critical, watches Vendor Master API). Asserted: its own findings, and its ledger shows `vendor.update` writes, not refund writes.

### 4.7 Optimize

Generators, one per finding class, each a **graph patch** (list of typed ops) with parameters:

| Finding class | Patch | Parameters |
|---|---|---|
| below_threshold, split, benign (Policy Gap) | set the condition of the decision gating the watched tool (the decision nearest the tool on its potential path) to `amount > X` or `dayTotal > X` | X ∈ {t, 2t} (t = 0: X ∈ {0, hi/2}); one field, so these four are **alternatives**, never combined |
| replay | set control `binding = {customer, order, amount}`, `singleUse = true` | — |
| duplicate_submit | set tool `idempotencyKey = true` | — |
| injection_exfil | (a) move the agent's secret read to the tool; or (b) insert a `policy_gate` redact before each external outcome | variant a/b |

Candidates = each single patch + the composites. A composite contains **every** parameter-free patch whose finding class is present (on the refund template: binding + single-use, idempotency, always) plus one alternative per parameterised field (refund: 4 decision options × 2 injection variants = 8 composites). Patches that touch the same field are never combined. **Eligibility gates** (all must hold): structural lint clean; benign completion ≥ baseline − 2 pp; no monitor's violation count increases vs. baseline; every **critical** finding at 0 violations in the tested scenarios. **Recommendation:** among eligible, lowest friction → lowest added latency → fewest patch ops. If the baseline has no findings: "No violations in M tested scenarios; no change needed" and Decide offers **Accept as is**. If nothing is eligible: "No acceptable candidate", nothing recommended, Approve disabled, Modify available. Every label on a candidate (Recommended, Eligible, reasons for ineligibility) is computed from **its own** run each time; nothing is inherited.

### 4.8 Lifecycle, revisions, invalidation

- A document has `revisions: [{rev: n, parent: n|null, status: draft|confirmed, origin: edit|approve, graph, hash (confirmed only), validation?, optimization?, decision?, registration?}]`, displayed as `v1.<n>`; `n` is allocated as `max(n)+1`, never reused. At most one draft at a time.
- **Every mutation** (palette drop, connect, delete, move, inspector field, paste, layout, NL patch, undo/redo) goes through `store.dispatch(cmd)`, the single choke point, which refuses when the active revision is not a draft and shows the lock note.
- **Confirm:** draft → confirmed; hash fixed; the graph is frozen (positions too).
- **Validate** runs only on a confirmed revision and stores `{revHash, scenarioSetId, results}` on it. **Optimize** stores `{revHash, scenarioSetId, candidates[]}`. Jobs run in chunks with a job id; a result whose job id or `revHash` no longer matches the active revision's is discarded (late results).
- **Candidate state:** `untested → running → tested(runId)`; `Modify` bumps the candidate's `paramsVersion` and sets it `stale`; a completed run is accepted only if its `(candidateId, paramsVersion, scenarioSetId, revHash)` still matches, so an earlier Modify's run finishing late is discarded. `rejected` is terminal for that optimization.
- **Approve guard:** Approve is enabled only on a candidate that is `tested`, eligible under §4.7 in **that** run, not rejected, and whose `paramsVersion` and `scenarioSetId` equal the tested ones. The UI disables it on every other card, and `store.dispatch` re-checks the guard (a probe calls it directly on an ineligible candidate).
- **Reject** marks a candidate rejected; the recommendation is recomputed over the rest; no label survives from before.
- **Approve** creates revision `n+1`, `origin: approve`, parent = the validated revision, graph = parent + patch, status **confirmed** (the human approval of a validated, specific patch is the confirmation of that graph). Its hash must equal the patched-graph hash the candidate was tested on (checked; mismatch → refuse). The **decision record** is written on the parent: `{action: approve, candidateId, patch, paramsVersion, scenarioSetId, runId, childRev, childHash, evidence}`, where `evidence` is an immutable copy of the scorecard and findings of that run. The child's validation is that same evidence, labelled with the child revision.
- **Accept as is** (baseline has no findings): decision `{action: accept, scenarioSetId, runId, evidence}` on the same revision.
- **After a decision the revision is decided:** Validate and Optimize on it are read-only (rerun refused with "Decided — create a new revision to re-validate"). An approve-origin child is decided by construction. Nothing can overwrite the evidence a decision points to.
- **Register:** allowed only on an approve-origin child or an accepted revision; writes `{docId, rev, hash, decisionRef, evidence, registeredAt}` using the decision-bound evidence into the local inventory, idempotently (same `(docId, rev, hash)` → no second entry). Text: "Registered · not deployed".
- **Edit as new revision** from any confirmed revision: creates a draft `n+1` with that parent (or opens the existing draft). Results on older revisions stay attached to them.

## 5. Architecture

Static site, no build step, no framework, no new dependency. Vanilla ES modules. `blueprint_studio/package.json` = `{"type":"module","private":true}` so `node --test` loads `.js` as ESM (root has no package.json, so Vercel still serves the site statically; verified in §7 probe 1 via the preview). Served at `/blueprint_studio/`.

```
blueprint_studio/
  index.html  package.json  README.md  CONTRACT.md
  css/studio.css        site :root tokens, Inter + IBM Plex Mono, node colours from index.html .bp-node.*
  js/model.js           node-type registry, port compatibility, graph ops (pure), canonical JSON, hash
  js/store.js           document + revisions, dispatch/lock, undo/redo, autosave, jobs, events
  js/canvas.js          SVG edges + HTML nodes, pan/zoom, drag, connect, marquee, minimap, keyboard
  js/inspector.js       schema-driven forms
  js/app.js             bootstrap, lifecycle stages, panels, run panel, toasts
  js/expr.js  js/engine.js  js/monitors.js  js/adversary.js  js/validate.js  js/optimize.js
  js/layout.js  js/io.js  js/nlcompile.js
  templates/customer-refund.json  templates/vendor-bank-change.json
  tests/*.test.mjs  tests/fixtures/semantics/*.json
  tests/probe/run-probes.mjs     headless Chrome over CDP, same pattern as swm/skills/swm-data-rebuild/scripts/preview-panels.mjs
```

Pure logic has **no DOM access** and runs under `node --test`. User strings are rendered with `textContent`; imported JSON is schema-checked. SHA-256 via `crypto.subtle` (browser and Node 26 both have it).

`CONTRACT.md` (Task 0) fixes: every exported signature of every module; the canonical graph, request, scenario, payload, trace-step, effect, ledger, monitor-result, finding, candidate and patch-op shapes; store commands and events; the error/result shape `{ok, value} | {ok:false, error:{code, message, nodeId?}}`; the revision record. The semantic fixtures in §4.4 are part of the contract.

## 6. Tasks and ownership

**Task 0 — foundation (claude, alone, first thing after the gate, committed before dispatch):** `package.json`, `CONTRACT.md`, `js/model.js`, `js/store.js` (dispatch, lock, undo/redo, revisions), `js/app.js` minimal bootstrap + render-only canvas, `index.html` shell, `css/studio.css`, both templates, `tests/fixtures/semantics/*`, `tests/model.test.mjs`, `tests/store.test.mjs`. Acceptance: `node --test blueprint_studio/tests` green; the page renders the refund template read-only; `CONTRACT.md` exists.

| # | Owner | Files (exclusive) | Acceptance check |
|---|---|---|---|
| 1 | deepseek | `js/expr.js`, `tests/expr.test.mjs` | Grammar in §4.2 parses; anything else rejected with position; `grep -E "eval\(|Function\("` empty |
| 2 | deepseek | `js/engine.js`, `js/monitors.js`, `tests/engine.test.mjs`, `tests/monitors.test.mjs` | Every §4.4 fixture yields its exact expected ledger and verdict; refund benign $300 → Refund Resolved with no approval; seeded trace byte-identical twice |
| 3 | deepseek | `js/adversary.js`, `js/validate.js`, `tests/validate.test.mjs` | §4.6 expected baseline findings for both templates; lint catches dangling port, cycle, unreachable flow node, unused data node, prohibited node with no watches, unknown expr identifier |
| 4 | deepseek | `js/optimize.js`, `tests/optimize.test.mjs` | Refund: a recommended composite with every critical finding at 0/M; each gate failing on a constructed case; no-findings → accept-as-is; nothing eligible → none |
| 5 | deepseek | `js/layout.js`, `js/io.js`, `js/nlcompile.js`, `tests/io.test.mjs`, `tests/layout.test.mjs`, `tests/nlcompile.test.mjs` | Export→import yields the same hash; malformed import rejected with a message; layout: no overlaps, flow left→right; every documented phrase compiles to its expected patch |
| 6 | claude | `js/canvas.js`, `js/inspector.js`, `js/app.js`, `js/store.js` (completion), `index.html`, `css/studio.css`, `README.md`, `tests/probe/*` | Probes §7 |
| 7 | claude | `logs/2026-09-22_BLUEPRINT_STUDIO_PLAN.md`, `logs/README.md`, root `README.md` (one index row) | Step-8 record |

deepseek does not touch any file outside its list; a needed change to `model.js`, `store.js` or `CONTRACT.md` is reported, not made.

## 7. Acceptance probes (`tests/probe/run-probes.mjs`, headless Chrome over CDP; each prints PASS/FAIL with detail)

Editor and persistence:
1. Load → refund template: 14 nodes, 9 flow + 2 access edges; no console error; network requests only same-origin (`/blueprint_studio/**`) and Google Fonts.
2. Palette drop adds an agent at the drop point **under zoom 1.5 and pan (−200, −80)** (transformed coordinates); connecting `out`→`in` creates an edge; `out`→`acc` and `out`→`out` are refused; deleting an edge and reconnecting works.
3. Inspector: change the decision condition to `amount > 500` → the graph's canonical JSON reflects it; an invalid expression shows an inline error and is not applied.
4. Marquee-select 3 nodes → copy → paste → 3 new nodes with new ids and their internal edges; undo ×N back to the load hash; redo ×N forward to the same hash.
5. Auto-layout: no two node boxes overlap; fit-to-view contains all nodes; minimap click recentres.
6. Reload → autosaved draft restored (same hash). Export → import in a cleared profile → same hash. Malformed JSON import → error message, current document untouched.

Lifecycle, locks, invalidation:
7. Confirm → **every mutation route** (palette drop, connect, delete, drag, inspector field, paste, auto-layout, NL patch, undo) is refused on the confirmed revision and the graph hash is unchanged.
8. Stage guards: Validate/Optimize/Decide/Register are disabled on a draft; Register disabled without a decision.
9. Edit as new revision → draft v1.2 (after v1.1 confirmed) with parent 1.1; v1.1's hash and results unchanged; switching back shows v1.1's results.
10. Late result: start Optimize, switch revision before it finishes → no result is written to the other revision.

Computation:
11. Validate on refund baseline → exactly the §4.6 findings; every finding and path chip says `Declared`; potential paths panel labelled "potential".
12. **Graph → results:** on a new revision, set the decision to `dayTotal > 500` and the control to full binding + single-use → Unauthorized Refund reports 0/M for benign, below_threshold, split and replay, while the duplicate_submit and injection findings remain.
13. Delete the Payment API → Refund Resolved edge on a draft → lint error "unreachable success outcome", Confirm disabled (structural invalidity is not reported as mitigation).
14. Optimize → recommended candidate's scorecard equals a direct `optimize.runCandidate` with the same scenario set id (asserted in page).
15. Three independent histories from the same validated revision: **Approve** → new confirmed revision containing the patch, hash equal to the tested hash; **Modify** threshold → candidate stale, Approve disabled until rerun, then different friction; **Reject** → recommendation moves or becomes none, no Recommended label on the rejected card.
15b. Approve guard: with one eligible and one ineligible candidate, the ineligible card's Approve is disabled **and** a direct `store.dispatch({type:'approve', candidateId: <ineligible>})` returns `{ok:false}`; Modify twice quickly → only the second parameters' run is accepted; after Approve, Validate/Optimize on the parent are refused and its decision evidence is unchanged.
16. Register twice → one inventory entry; after reload it is still there; the page never says "deployed".
17. Interactive run, $2,500 → pauses at Approval; Deny → ends at Refund Declined; the trace panel shows per-node payload and effects; step mode advances one node per click.
18. Vendor template → Validate → its own finding with `vendor.update` writes in the trace.
19. At 390 px width → a "desktop editor" notice, no horizontal scroll.

## 8. Constraints

- `index.html`, `assurance.html` and `swm/` are **not modified** (`git diff --stat $BASE -- index.html assurance.html swm` empty). Linking from the mockup is a later, separate decision.
- **Claim discipline:** the declared-adversary sentence on every computed screen; every number has a formula; "0 in M tested", never "closed"; NL compile labelled rule-based; no invented percentages.
- Visual: site tokens and fonts; node colours from `.bp-node.*`.
- Performance: validate + optimize on the refund template < 3 s on this Mac at N = 40.
- **Publishing:** after a unanimous code gate, commit on branch `blueprint-studio` and push that branch (Vercel preview URL). **Merging to `main` (production) waits for the user's word.**

## 9. Review record

### Round 1 (v0.1) — Codex PLAN-REJECTED (8), DeepSeek PLAN-REJECTED (3)

| # | Objection (who) | Change in v0.2 |
|---|---|---|
| C1 | Monitors miss split evasion and replay; duplicate detection not request-scoped (codex) | §4.4 rewritten: cumulative-total rule in execution order, proper-approval rule (consumed by that write, no earlier consumer, binding consistent, approver count), grouping by scope; duplicate per (customer, order) vs eligible; the four fixtures requested plus five more |
| C2 | Execution contract lacks approval↔write link, provenance, clock, redaction schema, capability enforcement, joins (codex) | §4.2–4.3: ledger with `consumedBy`, labels for provenance, one simulated day per session, `dayTotal`, redact schema, capability/limit enforcement at tools, idempotency, per-token payload copies, dead-path elimination for `join: all`; delegation and "dual" semantics defined or dropped |
| C3 | Prohibited nodes have no ports, so paths to them can't exist; lint scope unclear (codex) | `watches` is serialized; static *potential* paths go to watched nodes; lint's per-type rules listed in Task 3; potential vs violating paths separated |
| C4 | Equal seeds ≠ comparable experiments; denominators; "closed" overclaims (codex) | §4.5 frozen scenario set from the baseline hash; impossible moves still count; n/a for zero denominators; "0 violations in M tested" wording |
| C5 | Recommendation can pick a broken workflow (codex) | §4.7 eligibility gates: lint, benign completion, no new violations, critical at 0; no-findings and nothing-eligible cases defined |
| C6 | Lifecycle identity and invalidation unspecified (codex) · version model self-contradictory (deepseek D3) | §4.8: monotonic revisions, Approve creates a confirmed revision whose hash must equal the tested hash, single dispatch choke point, stale Modify, late-result discard, idempotent Register, Accept-as-is path |
| C7 | Task 0 has no bootstrap; contract too thin (codex) | Task 0 owns a minimal `app.js` bootstrap; `CONTRACT.md` scope in §5 includes shapes, store commands/events, errors, revision record, fixtures |
| C8 | Probes contradictory and incomplete (codex) | §7 rewritten: counts from the template, same-origin allowed, structural break vs mitigation separated (13 vs 12), three independent Approve/Modify/Reject histories, lock routes, stage guards, late results, idempotent register, editor ops incl. transformed coordinates, step mode, vendor-specific effects; exact traces live in the unit fixtures |
| D1 | Template can't produce the required findings; 9-node count mirrors the sketch (deepseek) | §4.6 exact template: 14 nodes incl. secret data and three prohibited nodes, decline branch; mockup declared a sketch in §1 |
| D2 | No rule linking agent limit, decision and monitor threshold; no read→emit taint (deepseek) | Decision at the declared autonomy $2,000 vs monitor $500 (asserted); capability limit enforced at tools; access-edge reads and label propagation defined |
| D3 | Version identity (deepseek) | see C6 |
| ns | `"type":"module"` for node --test; name the probe runner; probe the editor features; derive seeds from the hash (deepseek) | all adopted (§5, §7, §4.5) |

### Round 2 (v0.2) — DeepSeek PLAN-APPROVED (traced all six templates, baseline and composite), Codex PLAN-REJECTED (4)

| # | Objection (who) | Change in v0.3 |
|---|---|---|
| C2-1 | below_threshold and replay write to orders with eligible = 0, so `duplicate_effect` as defined (total > eligible) also fires; the expected list is wrong (codex) | `duplicate_effect` redefined as writes for one (customer, order) from more than one request; entitlement is not its business and over-entitlement is declared out of scope. The expected-findings list is now stated as complete and asserted exactly. |
| C2-2 | Split pieces vs "first token" joins; no skip on control ports (codex) | §4.3: per-activation node state (`requestId#i`), strict activation order, skip on the untaken port of both decisions and controls, all-skip forwarding; fixture with three pieces through decision → control → `join: all` |
| C2-3 | A presented approval bypasses a policy gate (codex) | Approval reuse is limited to human/dual approval controls; policy gates always execute; redact is unconditional under `appliesWhen`; fixtures for redact and block with a presented approval |
| C2-4 | Approve guard and evidence identity after reruns (codex) | §4.8: candidate state machine with `paramsVersion` and run-identity matching; Approve guard in UI and in `dispatch`; immutable decision evidence; decided revisions refuse re-validation; Register uses decision-bound evidence; probe 15b |
| D-ns | `minApprovers`, benign's generator, always-on patches in composites, `eligible` under split, benign session size, defaults (deepseek) | all adopted: defaults paragraph in §4.4; benign row in the generator table; composite definition; approver rule uses remaining eligible per parent request; one request per benign session |

Idempotency note, found while applying C2-1: keyed on (customer, order, cap) it would have refused split pieces 2..k. It now refuses only a write from a *different* request, matching the monitor.

### Round 3 (v0.3) — DeepSeek PLAN-APPROVED, Codex PLAN-APPROVED, Claude PLAN-APPROVED

DeepSeek re-traced all six templates for baseline and composite under the new rules. Its four non-blocking notes are **pinned in `CONTRACT.md` (Task 0)**, not in this text, so the approved plan is unchanged and the notes are checked at the code gate: variant (b)'s gate is `redactAbove: internal`, `appliesWhen` absent (always); the vendor template's exact condition `amount > 10000` with its false and denied branches; a splitting agent fires once and emits k tokens; redact runs "regardless of `rule`, whenever `appliesWhen` holds".
