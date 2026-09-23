# Blueprint Studio — module contract

Frozen before implementation (Task 0). The semantics are in the plan, [`../logs/2026-09-22_BLUEPRINT_STUDIO_PLAN.md`](../logs/2026-09-22_BLUEPRINT_STUDIO_PLAN.md) §4, which wins over this file if they ever disagree. This file fixes **shapes and signatures**, plus the details the plan left to it (marked *pinned*).

All modules are ES modules in `js/`. Pure modules (`model expr engine monitors adversary validate optimize layout io nlcompile`) never touch the DOM, `window`, `document` or `localStorage`, and are deterministic. They are tested with `node --test tests/` from `blueprint_studio/`.

## 0. Conventions

- **Result shape** for anything that can fail on user input: `{ok:true, value}` or `{ok:false, error:{code, message, nodeId?, edgeId?, pos?}}`. Helpers `ok()` / `fail()` are exported by `model.js`. Programming errors (wrong argument types) may throw.
- **No `eval`, no `new Function`, no `innerHTML` with user strings** anywhere.
- Money amounts are numbers in dollars, rounded to cents with `Math.round(x * 100) / 100`.
- Ordering is always deterministic: by id (string compare) unless stated.
- Randomness only via `mulberry32(seed)` from `adversary.js`; seeds are 32-bit unsigned ints.

## 1. Graph (`model.js`, owner claude — already implemented)

```js
Graph   = { nodes: Node[], edges: Edge[] }
Node    = { id, type, label, x, y, config }        // type ∈ keys of NODE_TYPES
Edge    = { id, kind: 'flow', from:{node,port}, to:{node,port} }
        | { id, kind: 'access', mode: 'read', from:{node: agentOrTool, port:'acc'}, to:{node: data, port:'acc'} }
```

Exports: `SCHEMA, NODE_TYPES, CATEGORIES, SENSITIVITY, BINDING_FIELDS, ok, fail, canConnect(graph, from, to), makeNode(type, id, {x,y,label,config}), nextId(takenIds, prefix), clone, applyPatch(graph, ops) → Result<Graph>, canonical(value) → string, semanticGraph(graph, meta), hashGraph(graph, {name, domain}) → hex, sha256Hex(str), nodeById, portsOf, portDef, flowOut(graph, nodeId, portId), flowIn(graph, nodeId), accessOf(graph, nodeId) → data nodes`.

Node types, ports and config: `NODE_TYPES` in `model.js` is the source of truth. Port ids: trigger `out`; agent/tool `in out acc`; decision `in true false`; control `in approved denied`; data `acc`; outcome `in`; prohibited none. Every flow-bearing node except trigger has `config.join ∈ {first, all}` (default `first`).

**Patch ops** (the only way graphs change — editor, optimizer and NL compiler all emit these):

```js
{op:'addNode', node}  {op:'removeNode', id}  {op:'moveNode', id, x, y}  {op:'setLabel', id, label}
{op:'setConfig', id, key, value}  {op:'addEdge', edge /* with id */}  {op:'removeEdge', id}
```

`removeNode` also removes the node's edges and its id from every prohibited node's `watches`. `addEdge` validates with `canConnect`. A patch is all-or-nothing.

## 2. Requests, scenarios, sessions

```js
Request  = { id, customer, order, amount, eligible, channel,
             trigger?,            // node id; default: first trigger node by id
             injected?,           // bool
             intent?: {split: k} | {presentApprovalOf: requestId} }
Scenario = { id, template, requests: Request[] }          // one session = one simulated day
ScenarioSet = { id /* 'S-<hash8>-<n>' */, seed, n, baseHash, params, scenarios: Scenario[] }
```

`template ∈ {below_threshold, split, replay, duplicate_submit, injection_exfil, benign}` (fixtures use `'fixture'`).

## 3. Expressions (`expr.js`, owner deepseek)

```js
parse(src)            → Result<Ast>        // error.code 'expr_syntax', error.pos = char index
evaluate(ast, vars)   → Result<boolean|number|string>   // 'expr_unknown_identifier', 'expr_type'
identifiers(ast)      → string[]           // root identifiers used
check(src)            → Result<Ast>        // parse + every identifier ∈ EXPR_VARS
EXPR_VARS             = ['amount','customer','order','channel','trust','eligible','dayTotal']
```

Grammar: `or := and ('||' and)*; and := not ('&&' not)*; not := '!' not | cmp; cmp := primary (('=='|'!='|'<'|'<='|'>'|'>=') primary)?; primary := number | string ('…' or "…") | true | false | ident('.'ident)* | '(' or ')'`. Comparisons of number with number or string with string only; otherwise `expr_type`. `&&`/`||`/`!` require booleans. An empty string is **not** a valid expression (`appliesWhen: ''` means "always" and is handled by the engine, not by `expr`).

## 4. Engine (`engine.js`, owner deepseek)

```js
runScenario(graph, scenario, opts?) → SessionResult
createRun(graph, scenario, opts?)   → Run        // interactive / step mode
opts = { approver?: (ctx) => boolean }           // default: the batch approver policy (§4.3)
Run  = { step() → StepResult, resolveApproval(approve: boolean) → StepResult, get waiting() → null | {activation, node}, get done() → boolean, result() → SessionResult }
StepResult = { done, waiting: null | {activation, node}, step: TraceStep | null }
```

`step()` executes exactly one node for one activation (or one skip propagation) and returns its `TraceStep`. At a `human_approval`/`dual_approval` control in interactive mode (created with `opts.interactive = true`), `step()` returns `waiting` and makes no progress until `resolveApproval()`. `runScenario` = `createRun` + loop with the batch approver.

```js
SessionResult = {
  scenarioId, template,
  activations: [{ id /* 'r1' or 'r1#2' */, requestId, parentRequestId, piece /* 0 = unsplit, else 1..k */,
                  status: 'success'|'failure'|'error', end /* node id where it ended */, path: nodeId[] /* executed nodes in order */ }],
  trace: TraceStep[],
  effects: Effect[],                 // in execution order
  ledger: { writes: Write[], approvals: { [id]: Approval } },
  latencyMinutes,                    // sum of approval SLA minutes incurred
  humanApprovals                     // number of approvals that asked a human (not reused)
}
TraceStep = { seq, activation, node, type, status: 'ok'|'skip'|'waiting'|'error',
              in: PayloadSnapshot|null, out: { port: string|null, payload: PayloadSnapshot|null }, effects: Effect[], note? }
PayloadSnapshot = { req: Request, labels: [{data, sensitivity}], approval: string|null, principal: string|null, injected: bool }
Write    = { writeId /* 'w1'.. */, node, activation, requestId, parentRequestId, customer, order, amount, cap, approvalId: string|null }
Approval = { id /* 'ap1'.. */, node, activation, binding: {customer?, order?, amount?}, approvers: 1|2, singleUse, consumedBy: writeId[] }
Effect   = {type:'data_read', node, activation, data, sensitivity}
         | {type:'write', ...Write}
         | {type:'write_denied', node, activation, cap, amount, reason: 'no_principal'|'no_capability'|'over_limit'|'duplicate'}
         | {type:'approval_issued', node, activation, id, binding, approvers, singleUse, latency}
         | {type:'approval_denied', node, activation}
         | {type:'approval_reused', node, activation, id}
         | {type:'approval_consumed', node, activation, id, writeId}
         | {type:'redact', node, activation, removed: [{data, sensitivity}]}
         | {type:'emit', node, activation, labels: [{data, sensitivity}], external, success}
         | {type:'error', node, activation, code, message}
```

*Pinned details:*

- **Activation ids:** unsplit request → its `id`; split piece i (1-based) → `id#i`. `parentRequestId` = the request id for both. Session order: request 1's activation(s) fully (pieces in index order), then request 2, …
- **Split:** the splitting agent **fires once** for the request (one set of `data_read` effects), then emits k tokens, one per piece activation, which continue from its `out` port. Pieces: `amount/k` rounded to cents, remainder on the last piece. `eligible` stays the request's.
- **Trigger choice:** `request.trigger` or the first trigger node by id.
- **dayTotal** = sum of `ledger.writes` for this customer so far in the session + this token's `amount`.
- **Principal:** the last agent the token passed through. Capability check at a `write` tool: principal exists (`no_principal`), has `{cap}` (`no_capability`), `limit ≥ amount` (`over_limit`).
- **Idempotency:** a write for `(customer, order, cap)` already present in the ledger with a **different** `parentRequestId` → `write_denied duplicate`. A refused write ends the activation with `status: 'error'`, `end` = the tool.
- **Batch approver:** approve iff `amount + (sum of ledger writes with this parentRequestId) ≤ eligible`. Dual approval: same decision, `approvers: 2`, latency 2 × SLA.
- **Presented approval** (`intent.presentApprovalOf: rid`): the approval issued most recently during an activation of request `rid`. Checked only at `human_approval`/`dual_approval` controls whose `appliesWhen` holds: valid iff it exists, `!(singleUse && consumedBy.length)`, and every bound field equals the request's value. Valid → `approval_reused`, token carries it, no latency. Invalid or absent → ask the approver as normal.
- **Policy gates** never look at approvals. `block`: rule true → `approved`, false → `denied`. `redact`: regardless of `rule`, whenever `appliesWhen` holds, drop labels whose sensitivity rank is above `redactAbove` (`public < internal < secret`), emit a `redact` effect (even if nothing was removed), go `approved`.
- **appliesWhen** empty or absent → holds. When it does not hold, the control goes `approved` without any approval (any kind).
- **Labels:** an agent's read set is its access-edge data. Output labels = token labels ∪ (read-set items with rank ≤ `outputCeiling`), or ∪ the whole read set if `injected`. Tools never add labels. Injection flag: set at the trigger iff `request.injected && trigger.config.trust === 'untrusted'`.
- **Skips:** decision/control send a skip on the untaken port(s). A node that has received skips on **all** incoming flow edges for an activation forwards skips on all its out ports and does not execute (its `TraceStep.status = 'skip'`). A `join: first` node fires on the first token for that activation and ignores later tokens/skips for it. A `join: all` node fires when every incoming edge has delivered a token or a skip for that activation, and at least one was a token.
- **Errors:** a taken out port with no edge, or an expression error → `error` effect, activation `status: 'error'`.
- **Outcome:** `emit` effect; activation ends `success` if `config.success` else `failure`.
- Same graph + same scenario → `JSON.stringify(runScenario(...))` identical.

## 5. Monitors (`monitors.js`, owner deepseek)

```js
evaluateMonitors(graph, sessionResult) → MonitorResult[]      // one per prohibited node, ordered by node id
MonitorResult = { node, monitor, violations: [{ activation, writeId?, emitNode?, reason }] }
```

Plan §4.4, exactly. *Pinned:* `unauthorized_write` groups writes on `cap` by scope key (`write` → writeId, `request` → parentRequestId, `customer_day` → customer), in ledger order; a write needs approval when the running group total including it exceeds `threshold`; proper approval = `approvalId` set, that approval's `consumedBy[0] === writeId`, `approvers ≥ minApprovers`, every bound field equals the write's. `duplicate_effect`: for each `(customer, order)` on `cap`, every write whose `parentRequestId` differs from the first write's is a violation. `secret_exposure`: every `emit` with `external: true` carrying a `secret` label.

## 6. Scenarios (`adversary.js`, owner deepseek)

```js
mulberry32(seed) → () => number in [0,1)
TEMPLATES = ['below_threshold','split','replay','duplicate_submit','injection_exfil','benign']
scenarioParams(graph) → { t, lo, hi, trigger }      // from the first unauthorized_write prohibited node by id;
                                                     // none → t = 500, lo = 0, hi = 1000 (pinned)
generateScenarioSet(graph, { n = 40, seed, baseHash }) → ScenarioSet
applicability(graph, template) → { applicable: boolean, reason }   // label only; never filters scenarios
```

Plan §4.5 for each template's draws. *Pinned:* customers `c<k>`, orders `o<k>` unique per scenario unless the template reuses them; request ids `r1, r2` per scenario; scenario ids `<template>-<index>`; `seed` default = `parseInt(baseHash.slice(0, 8), 16)`; the set id is `S-${baseHash.slice(0,8)}-${n}`; draws happen in template order then index order from one PRNG stream, so the set depends only on `(seed, n, params)`. `injection_exfil` and `benign` requests use `channel` of the trigger.

## 7. Validation (`validate.js`, owner deepseek)

```js
lint(graph) → Issue[]            Issue = { severity: 'error'|'warning', code, message, nodeId?, edgeId? }
potentialPaths(graph) → [{ prohibited, target, path: nodeId[], guards: nodeId[] /* decisions + controls on path */ }]
runScenarios(graph, scenarios) → RunRecord[]      RunRecord = { scenarioId, template, session: SessionResult, monitors: MonitorResult[] }
summarize(graph, runs) → { findings: Finding[], metrics: Metrics }
validate(graph, scenarioSet) → { scenarioSetId, lint, potential, runs, findings, metrics }   // convenience, sync
Finding = { id /* `${prohibited}:${template}` */, prohibited, monitor, template, category, severity,
            violating, run /* scenarios of that template */, paths: [{ nodes: nodeId[], count }], grade: 'Declared' }
Metrics = { byMonitor: { [prohibitedId]: { violating, run } },
            residualReachability: { num, den }, benignCompletion: { num, den }, benignPolicyViolations: { num, den },
            friction: { num, den }, addedLatencyMedian: number|null }
```

Lint codes (errors unless noted): `no_trigger`, `no_success_outcome` (no success outcome reachable from any trigger), `dangling_port` (a flow out port with no edge), `cycle`, `unreachable` (flow node not reachable from a trigger), `unused_data` (warning), `no_watches` (prohibited with empty `watches`), `bad_watch` (watch target not a tool/outcome), `expr_syntax` / `expr_unknown_identifier` (decision condition, control `appliesWhen`, gate `rule`), `missing_config` (e.g. write tool with empty `cap`). Violating paths = the distinct `activation.path` of violating activations. Categories: benign → `Policy Gap (normal operation)`, below_threshold → `Missing Approval`, replay → `Workflow Logic Risk`, split → `Cross-Agent Risk`, duplicate_submit → `Workflow Logic Risk`, injection_exfil → `Data Exposure`. A scenario "violates" if any monitor reports ≥1 violation for it. Finding order: severity (critical, high, medium), then prohibited id, then template order.

## 8. Optimize (`optimize.js`, owner deepseek)

```js
generateCandidates(graph, validation) → Candidate[]
Candidate = { id, label, kind: 'single'|'composite', classes: string[], params: object, paramsVersion: 1, patch: PatchOp[] }
reparam(graph, validation, candidate, params) → Candidate      // same id, paramsVersion + 1, regenerated patch
runCandidate(graph, candidate, scenarioSet) → Result<{ patchedGraph, patchedHash, lint, runs, findings, metrics }>
score(baseline /* validate() output */, candResult) → { eligible: boolean, reasons: string[], scorecard }
scorecard = { violationsClosed: {num, den}, residualReachability, benignCompletion, friction, addedLatencyMedian, patchOps }
recommend(scored: [{candidate, result, verdict}], rejectedIds: Set) → candidateId | null
optimize(graph, validation, scenarioSet) → { candidates: [{candidate, result, verdict}], recommended }   // convenience
```

Plan §4.7. *Pinned:* variant (b)'s inserted gate is `{kind:'policy_gate', action:'redact', redactAbove:'internal', appliesWhen:''}`, placed on every flow edge into an external outcome, with new ids from `nextId`. "The decision gating the watched tool" = the last decision on the static potential path(s) from the trigger to the watched tool; if none, the threshold generators insert a new decision + human control (binding customer, 15 min) before the tool. Candidate ids are stable strings built from their class and params (e.g. `threshold:dayTotal:500+binding+idem+inj:a`). `patchedHash = hashGraph(patchedGraph, meta)` where meta is passed by the caller as `runCandidate(graph, cand, set, meta)`.

## 9. Layout, I/O, NL (`layout.js`, `io.js`, `nlcompile.js`, owner deepseek)

```js
layout(graph, { nodeW = 184, nodeH = 96, gapX = 64, gapY = 40 }) → { [nodeId]: {x, y} }
exportDocument(doc) → string              // pretty JSON of the whole document
importDocument(text) → Result<Document>   // schema-checked; codes 'json_parse', 'schema', 'bad_graph'
diffGraphs(a, b) → { addedNodes, removedNodes, changedNodes: [{id, fields}], addedEdges, removedEdges }
policyExport(doc, rev) → string           // human-readable policy-as-code text of the revision's controls, gates and monitors
PHRASES = [{ pattern: string (documentation), example, produces: string }]
compileText(text, graph) → Result<{ ops: PatchOp[], matched: string[], unmatched: string[] }>
```

Layout: layered left→right by longest path from triggers over flow edges; data nodes placed above their first accessor, prohibited nodes below their first watched node; no overlaps. NL phrases (case-insensitive, one per sentence): "require (manager )?approval above $X" → set the gating decision to `amount > X` (inserting decision + control if absent); "aggregate (per customer )?per day" → switch it to `dayTotal`; "bind (the )?approval to (the )?(customer|order|amount)(, …)" → binding; "single-use approval(s)" → `singleUse`; "prevent duplicate …" → `idempotencyKey` on write tools; "never (send|expose) … credentials" / "redact secrets" → variant (b) gate; "notify the customer" → ensure an external success outcome exists. Anything else is returned in `unmatched`, never guessed.

## 10. Store and document (`store.js`, owner claude)

```js
Document = { schema: 'silex.blueprint/v1', id, name, domain, owner, activeRev, revisions: Revision[] }
Revision = { rev, parent, status: 'draft'|'confirmed', origin: 'edit'|'approve', graph, hash,
             validation: null | { jobId, revHash, scenarioSetId, n, result },
             optimization: null | { jobId, revHash, scenarioSetId, candidates: [{ candidate, state: 'untested'|'running'|'tested'|'stale'|'rejected', runId, result, verdict }], recommended },
             decision: null | { action: 'approve'|'accept', candidateId?, patch?, paramsVersion?, scenarioSetId, runId, childRev?, childHash?, evidence } }
```

`store.dispatch(cmd)` is the single mutation choke point; commands `patch undo redo confirm newRevision setActive rename` (Task 0) and the lifecycle commands `setValidation setOptimization candidateState modify reject approve accept register` (Task 6). Events: `store.on(fn)` receives `{reason: <command type>|'load'|'refused', cmd?, error?}`.

## 11. Fixtures

`tests/fixtures/semantics/*.json` = `{ name, description, graph, scenario, approver: 'policy', expect }`. `expect` keys (all optional except `activations`, `writes`, `violations`): `activations: [{id, end, status}]` (exact list, in order), `writes: [{activation, amount, approval}]` (exact ledger order; `approval` is `null` or `'issued:<activation>'` = the approval issued during that activation), `approvalsIssued`, `approvalsReused`, `writeDenied: [{activation, reason}]`, `emits: [{activation, node, labels: dataIds}]`, `nodeFires: {nodeId: count}` (executed, not skipped), `violations: {prohibitedId: [activation…]}`. `tests/engine.test.mjs` and `tests/monitors.test.mjs` must load every fixture and assert every present key exactly.
