# Agentic Blueprint Studio (working version)

A workflow orchestrator for agentic systems, fully in the browser. It turns the scripted **Blueprint Studio** tab of the [SILEX demo](../index.html) into something you can actually use: draw a workflow, confirm it, validate it, optimise it, decide and register. Every finding, path and number downstream is **computed from the graph you built**.

Open `blueprint_studio/index.html` from any static server (for example `python3 -m http.server` at the repo root, then `/blueprint_studio/`). It has no build step, no framework and no dependencies. It needs a desktop-width screen.

Plan, semantics and review record: [`../logs/2026-09-22_BLUEPRINT_STUDIO_PLAN.md`](../logs/2026-09-22_BLUEPRINT_STUDIO_PLAN.md). Module contract: [`CONTRACT.md`](CONTRACT.md).

## What you can do

| Stage | What happens |
|---|---|
| **Build** | Drag node types from the palette. Connect an output port to an input: incompatible ports dim, and an edge only drops on a compatible port. Blue square ports connect agents and tools to data. Every field in the inspector changes engine behaviour, and expressions are checked as you type them. Also: undo/redo, copy/paste, marquee select, auto-layout, minimap, and rule-based text edits (no AI). The **Test run** panel executes the graph on one request, step by step if you like, and pauses at approvals for you to decide. |
| **Confirm** | Locks the revision and records its content hash. Every later edit is refused; *Edit as new revision* starts a draft with a parent. |
| **Validate** | Runs a frozen, seeded scenario set (six adversary templates) through the engine. Trace monitors decide whether each prohibited outcome occurred. Output: findings, the node paths that actually violated, static potential paths, and metrics with their formulas. |
| **Optimize** | Candidate patches are generated from the finding classes and tested on the **same** scenarios. Each is gated (lint clean, benign completion kept, nothing worse, every critical finding at 0 in the tested scenarios); the recommendation is the lowest-friction eligible candidate. Modify re-runs a candidate with new parameters; Reject removes it. |
| **Decide** | Approve creates a new **confirmed** revision containing exactly the tested patch, and checks that the hashes match. Accept as is is available when there are no findings. A decided revision's evidence is frozen. |
| **Register** | Adds the revision to a local inventory ("Registered · not deployed") and exports its controls and monitors as policy-as-code text. |

## What is real and what is simulated

- **Real:** the editor; the graph model; the engine, which interprets your graph node by node; the monitors; the scenario runs; and every number, which comes from those runs. The same graph and the same scenario set always produce identical results.
- **Simulated:** there are no real agents, tools or LLMs. Agents behave according to a **declared adversary model**:
  - agents follow instructions injected into untrusted input;
  - an agent marked `canSplit` may split a request;
  - a presented approval is reused whenever the control's binding allows it.
- **What a result means:** it says what *this graph* allows under *those behaviours*. It says nothing about any real agent. "0 violations in M tested scenarios" is a sampling result, not a proof, and the UI never says "closed" or "impossible".
- **Evidence grade:** every finding is graded **Declared** (from configuration, before deploy), matching the grade legend on the main demo.
- **Out of scope:** over-entitlement is not monitored in v1. `duplicate_effect` covers only double compensation for one order.
- **No AI:** the text box compiles a fixed set of phrases with rules. Anything it does not recognise is reported back, never guessed.
- **Severity inheritance:** a violation in *benign* scenarios ("Policy Gap (normal operation)") takes the severity of its prohibited outcome. On the refund template that is critical, so the recommendation has to close it.

## Adversary templates

| Template | What it tries |
|---|---|
| `below_threshold` | An amount above the business threshold but under the declared autonomy |
| `split` | A legitimate request split by an agent into pieces under the threshold |
| `replay` | A second order presenting the first order's approval |
| `duplicate_submit` | The same order submitted twice |
| `injection_exfil` | An injected instruction asking an agent to emit what it read |
| `benign` | Legitimate traffic; used for friction and completion, and monitored too |

## Files

```
index.html  css/studio.css             app shell; tokens and fonts copied from the demo
js/model.js   node types, ports, patch ops, canonical JSON, SHA-256        (claude)
js/store.js   revisions, single dispatch choke point, locks, jobs, lifecycle (claude)
js/canvas.js  js/inspector.js  js/app.js   editor and stages               (claude)
js/expr.js    safe expression language (no eval)                           (deepseek)
js/engine.js  js/monitors.js  js/adversary.js  js/validate.js              (deepseek)
js/optimize.js  js/io.js  js/nlcompile.js  js/layout.js                    (deepseek; fixes by claude)
templates/    Customer Refund; Vendor Bank-Detail Change (incident I-1042's shape)
tests/        node --test unit tests + tests/fixtures/semantics (exact expected ledgers)
tests/probe/run-probes.mjs   headless-Chrome acceptance probes (plan §7)
```

## Testing

```bash
cd blueprint_studio && node --test tests/          # unit + semantic fixtures
node blueprint_studio/tests/probe/run-probes.mjs   # from the repo root; needs Chrome; --shots <dir> saves screenshots
```
