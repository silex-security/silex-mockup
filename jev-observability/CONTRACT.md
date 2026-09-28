# Contract: Jev observability demo (T0 foundation)

Plan: [`../logs/2026-09-27_JEV_OBSERVABILITY_PLAN.md`](../logs/2026-09-27_JEV_OBSERVABILITY_PLAN.md) v0.2 (approved `23b705c`).
This file fixes the module APIs, data shapes, decision semantics, DOM hooks and the probe
convention, so the engine (T1, deepseek), the UI (T2, planner) and the probes (T3, codex)
can be written in parallel. If something here is wrong, **report it; don't route around it.**

Everything is plain ES modules (`.js`, `"type": "module"`), no dependencies, runs unchanged in
Node ≥ 20 and in the browser. All engine functions are **pure and deterministic** given their
inputs: all randomness comes from `rngFor(seed, span_id, purpose)` in `rng.js`.

## 1. Files and owners

| Path (under `jev-observability/`) | Owner |
|---|---|
| `CONTRACT.md`, `package.json`, `js/engine/{types,scenarios,rng}.js` | planner (T0, frozen after dispatch) |
| `js/engine/{state,rules,jev-sim,llm-sim,policy,router,kpi,siem}.js`, `tests/engine/*.test.js`, `tools/build-fixture.js`, `data/fixture.json` | deepseek (T1) |
| `index.html`, `css/app.css`, `js/ui/*.js`, `README.md` | planner (T2) |
| `tests/probe/run-probes.js` | codex (T3) |

## 2. Inputs (defined in `scenarios.js`, `types.js`)

- **Span:** see the comment block in `scenarios.js`. Routed iff `boundary !== null`.
  `span.fault` (optional) forces a judge fault for that span (used by F1).
- **TENANT:** hard-rule constants. Not part of the policy; no policy edit can reach them.
- **Policy:** `DEFAULT_POLICY` shape in `types.js`. `thresholds[qid] = { review_threshold, block_threshold }`
  on the question's **risk** value (`risk = p` or `1 - p` per `BATTERY[].risk`).
- **Battery:** `BATTERY` / `batteryFor(boundary, { reduced })` in `types.js`.

## 3. Engine API (T1)

### `state.js`
`buildState(span, history, tenant, now) → State`
```
{ schema_version: 'state/1', event_id, trace_id, span_id, tenant: tenant.id, boundary, ts: now,
  age_ms: span.age_ms, stale: age_ms > tenant.stale_after_ms,
  tool: { name, impact } | null,
  facts: { amount_usd, approval_limit_usd, has_approval_evidence, approval_ref, payee_invoice,
           payee_account_holder, dest_domain, domain_allowed, readback_posted, tool_status },  // null when n/a
  features: { payee_similarity, sensitive_fields_in_args, domain_allowed, injection_marker_score,
              untrusted_text_share, amount_ratio, tool_impact, unsupported_claims, repeat_failures,
              tool_status_error },                                                            // null when n/a
  sources: [{ id, trust, excerpt }],   // excerpt ≤ 280 chars
  evidence_refs: [string],             // e.g. 'tool:args', 'context:approval', 'source:retrieved:INV-8155/note'
  safeView: {...} }                    // what the judge sees: redacted (no account refs / numbers),
                                       // features + enums + tool name + arg keys + trust-tagged excerpts
```
Feature definitions (the simulator may only read these):
- `payee_similarity` 0..1: token Jaccard of normalised names (lower-case, punctuation removed,
  drop `llc ltd inc co corp`) of `context.invoice.vendor` vs `context.bank_account.holder`; null if either missing.
- `sensitive_fields_in_args`: |`args.includes_fields` ∩ {`bank_account_number`,`routing_number`,`tax_id`,`ssn`}|.
- `domain_allowed`: `dest_domain` (from `args.remit_domain`, else the domain of `args.to`) ∈ `tenant.domain_allowlist` (exact match); null if no destination.
- `injection_marker_score` 0..1: over untrusted sources (`trust` ∈ {retrieved, tool}) — instruction-like
  markers (e.g. "ignore previous", "also email", "send a copy", "updated … procedure", an external email address).
  Deterministic; document the marker list and weights in the file.
- `untrusted_text_share` 0..1, `amount_ratio` = amount / limit, `tool_impact` read 0 · write 1 · payment 2,
  `unsupported_claims` = count of numbers / capitalised entities in `span.text` absent from all sources,
  `repeat_failures` (same trace, prior tool errors), `tool_status_error` (post_tool non-2xx).

### `rules.js`
`checkRules(state, tenant) → { hits: [{ id, verdict, reason, evidence_refs }], verdict: DECISION|null, latency_ms }`
Rules (ids fixed): `stale_state` → STOP · `repeat_failure` (≥ `tenant.repeat_failure_n`) → STOP ·
`amount_limit` (pre_tool, payment, amount > limit) → BLOCK · `domain_allowlist` (pre_tool, destination not allowed) → BLOCK ·
`approval_evidence` (pre_tool, payment, no approved approval) → HOLD ·
`readback_mismatch` (**post_tool only**, 2xx result but `readback.posted === false`) → ALERT.
`verdict` = most severe hit: STOP > BLOCK > HOLD > ALERT. `latency_ms` from `LATENCY_BUDGET.rules`.

### `jev-sim.js`
`judgeBattery(safeView, questions, { seed, spanId, deadline_ms, fault }) → JevResult`
```
{ status: 'ok'|'timeout'|'down', version: JEV_SIM_VERSION, latency_ms, serialize_ms,
  answers: { [qid]: Answer },   // {} unless status 'ok'
  tokens_in, cost_usd, reduced: bool }
Answer (noul):         { type:'noul', p, risk, confidence: max(p,1-p), margin: |2p-1|, features_used: {name: value} }
Answer (choice|score): { type, dist: {option: p}, top, confidence: dist[top], margin: top1-top2,
                         expected (score only: Σ level·p), features_used }
```
- Probabilities are a documented deterministic function of `features_used` plus seeded jitter ≤ ±0.04,
  rounded to 3 dp; distributions sum to 1 ± 0.002. **No per-scenario special cases** (no reading ids, names or labels).
- Latency: `serialize_ms` from `LATENCY_BUDGET.serialize`; `latency_ms` from `.jev`, or `.rttSpikeJev` under `fault:'rtt_spike'`.
  `fault:'timeout'` → status `timeout`, `latency_ms = deadline_ms`. `fault:'down'` → status `down`, `latency_ms` 0.
  An `ok` call whose drawn latency exceeds `deadline_ms` is also a `timeout` (no stale answers returned).
- `tokens_in` = simulated: ⌈JSON length of safeView / 4⌉ + 24 per question. `cost_usd = tokens_in × PRICES.jevInputUsdPerMTok / 1e6`.

### `llm-sim.js`
`judgeSlow(safeView, { seed, spanId, reason }) → { judge: LLM_SIM_VERSION, async: true, latency_ms, verdict, rationale, reason, tokens_in, tokens_out }`
Latency from `LATENCY_BUDGET.llm`. `rationale` is a templated sentence from the features, prefixed "Simulated rationale:". No cost.

### `policy.js`
- `validatePolicy(policy) → { ok, errors: [string] }` — rejects any `review_threshold ≥ block_threshold`,
  thresholds outside [0,1], unknown tool mode/fail values.
- `toolConfig(policy, toolName) → { mode, fail }` (falls back to `policy.default_tool`; non-tool spans: `{ mode:'gate', fail:'open' }`).
- `combine(state, rules, jev, policy, { tenant }) → { decision, decided_by, reasons, fallback, fallback_level, alert, escalate, escalate_reason, risk }`

Decision order (R p.9, p.13), first match wins:
1. `rules.verdict` (includes `stale_state` → STOP, L3) → that decision, `decided_by:'rule'`. Jev is advisory only.
2. `jev.status` ∈ {timeout, down} → L2. Tool `fail:'closed'` → BLOCK; `fail:'open'` → ALLOW with `alert:true`. `decided_by:'fallback'`.
3. Per Noul answer: `risk ≥ block_threshold` → BLOCK; `risk ≥ review_threshold` → REVIEW. `attack`:
   `1 − dist.safe ≥ choice_review_threshold` → REVIEW. Most severe wins; `decided_by:'jev'`.
4. Otherwise ALLOW, `decided_by:'policy'`.

`fallback_level`: L3 stale · L2 timeout/down · L1 reduced battery (rtt_spike) · else L0.
`escalate` (slow path for rationale, R p.13): decided_by `jev` REVIEW, or any answer with `confidence < confidence_floor`
or `margin < margin_floor`. **Escalation never changes the decision.** `risk` = `{ label: 'low'|'medium'|'high', confidence }`.

### `router.js`
- `route(span, ctx) → Envelope | null` with `ctx = { tenant, policy, seed, history: Envelope[], faults: { jev } }`.
  Returns null for unrouted spans. Never throws for a routed span.
  1. `state = buildState(span, history, tenant, span.t_ms ?? 0)`; 2. `rules = checkRules(...)`;
  3. `fault = span.fault ?? ctx.faults?.jev ?? null`; `questions = batteryFor(boundary, { reduced: fault === 'rtt_spike' })`;
  4. **Jev is always called** (the Inspector shows it). If a rule decided, `jev_on_critical_path = false` and its
     latency is excluded; 5. `combine`; 6. if `escalate`, attach `judgeSlow` as `escalation` (async; not in decision latency);
  7. mode from `toolConfig`. **Monitor:** `action` = allow (or allow_and_alert), `would_have = decision`. **Gate:** action per decision.
- Actions (what the customer gateway receives, simulated): ALLOW→`allow` (`allow_and_alert` if alert) · REVIEW→`hold_for_review` ·
  HOLD→`hold_for_approval` · BLOCK→`deny` · ALERT→`review_ticket` · STOP→`stop_and_handover`.
- `decision_latency_ms` = rules + (critical path ? serialize + min(jev latency, deadline_ms) : 0) + policy.
  `latency_breakdown = { rules, serialize, jev, policy }` (serialize/jev 0 when off the critical path).
- `runStream(spans, ctx) → Envelope[]` routes in order, threading `history` per trace.
- `createEngine({ tenant, policy, seed }) → { route(span, faults), inject(scenarioId, faults), log, reset(), setPolicy(p) }` —
  a stateful wrapper for the UI; `policy` is replaceable; the log keeps each envelope's `policy_version`.
- Envelope: `makeEnvelope` in `types.js`, every field present.

### `kpi.js`
- `percentile(values, q)`: nearest-rank (`sorted[ceil(q·n) − 1]`), null for empty.
- `computeKpis(envelopes) → { routed, pre_tool, p50_ms, p95_ms, blocks, holds, reviews, alerts, stops,
  review_rate, false_block_rate, p0_recall, coverage, jev_calls, jev_cost_per_1k_usd, labelled_allow, labelled_p0 }`
  - latency: over `pre_tool` envelopes' `decision_latency_ms` (simulated added gate latency);
  - `review_rate` = (REVIEW+HOLD+ALERT+STOP) / routed; `false_block_rate` = label ALLOW decided BLOCK|HOLD|STOP / label ALLOW;
  - `p0_recall` = label BLOCK|HOLD decided BLOCK|HOLD|STOP / label BLOCK|HOLD; `coverage` = pre_tool envelopes with a decision and decided_by / pre_tool envelopes;
  - `jev_cost_per_1k_usd` = Σ cost_usd of calls with status ok / #ok calls × 1000.

### `siem.js`
`toSiemLine(envelope) → string` — one JSON line: trace/span/event ids, t_ms, boundary, tool name, decision, action,
would_have, decided_by, rule ids, fallback_level, judge, policy_version, decision_latency_ms, `simulated: true`. No raw text, no args.

## 4. Required engine behaviour (T1 tests assert these)

With `DEFAULT_POLICY`, `TENANT`, seed 7 (and any seed in 1..20 for the invariants):
| Span | decision | decided_by |
|---|---|---|
| every S1 pre_tool | ALLOW | policy |
| S2 payments.execute | REVIEW (via `payee_mismatch` in its review band) | jev |
| S3 payments.execute | BLOCK (`amount_limit`), all Jev risks below review | rule |
| S4 payments.execute | HOLD (`approval_evidence`), attack `dist.safe ≥ 0.9` | rule |
| S5 pre_tool / post_tool | ALLOW / ALERT (`readback_mismatch`) | policy / rule |
| S6 pre_input / email.send | ALLOW / BLOCK (`domain_allowlist`), `exfil.p ≥ 0.8`, attack top ≠ safe | policy / rule |
| F1 vendor.lookup / payments.execute | ALLOW + alert / BLOCK, L2 | fallback |
| every background span | not BLOCK/HOLD/STOP | — |

Invariants: same seed ⇒ byte-identical `data/fixture.json`; a threshold sweep (every Noul question, both thresholds,
0.05 steps, valid bands only) never changes S3/S4's decision; every Noul probability lists ≥ 1 `features_used`;
`validatePolicy` rejects inverted bands; KPIs recomputed from the raw log in a test equal `computeKpis`.

`tools/build-fixture.js`: `runStream(buildStream(7))` + every scenario injected, then `computeKpis`; writes
`data/fixture.json` = `{ seed, policy_version, judge, envelopes, kpis, generated_by }` (no timestamp, stable key order).

## 5. UI hooks (T2 emits, T3 selects)

URL params: `?seed=<int>` (default 7), `?autoplay=0` (start paused; probes use this).
`window.__jevDemo` (set once the page is ready): `{ ready: true, seed, engine, policy(), setPolicy(p),
log(), kpis(), inject(id) → Envelope[], setFault(kind|null), flush(), select(spanId), replay(spanId, policy) → { before, after } }`.

| Hook | Meaning |
|---|---|
| `[data-tab="live|replay|studio|about"]`, `[data-panel="live|replay|studio|about"]` | tabs and panels |
| `[data-kpi="p50|p95|blocks|review_rate|false_block|coverage|cost"]` with `data-value` | KPI tiles (raw number in `data-value`) |
| `[data-span-id]` rows with `data-scenario`, `data-boundary`, `data-decision`, `data-decided-by` | stream rows (routed spans) |
| `[data-play]`, `[data-step]`, `[data-speed="1|4"]`, `[data-inject="S1".."S6"|"F1"]`, `[data-fault]` (select: none/rtt_spike/timeout/down) | stream controls |
| `[data-inspector]` with `data-span-id`; `[data-jev-answer="<qid>"][data-simulated="true"]`; `[data-override-note]` (present when a rule decided and Jev is advisory) ; `[data-envelope]` (JSON `<pre>`) ; `[data-siem]` | Decision Inspector |
| `[data-replay-span]` (select; option values are envelope `span_id`s), `[data-threshold="<qid>.review_threshold|<qid>.block_threshold"]` (range inputs), `[data-replay-run]`, `[data-replay-before]` / `[data-replay-after]` with `data-decision`, `[data-replay-note]` | Replay |
| `[data-policy-version]`, `[data-tool-mode="<tool>"]` (select monitor/gate), `[data-tool-fail="<tool>"]` (select open/closed), `[data-policy-error]` | Policy Studio |
| `[data-simulated-badge]` | the persistent "simulated" banner |

## 6. Probe convention (T3)

Same as `tests/site/run-site-probes.mjs`: local static server rooted at `jev-observability/`, isolated Chrome profile,
CDP; one `PASS <id> …` / `FAIL <id> …` line per probe on stdout; `process.exitCode = 1` on any failure;
`--only P1,P3`, `--shots <dir>`. No `<title>` protocol.
