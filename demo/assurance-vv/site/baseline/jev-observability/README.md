# Real-time Agent Risk Signals (Jev observability demo)

> **Superseded** by [`../jev-runtime/`](../jev-runtime/README.md) (the current demo with the Runs view and the SOC agent), shown in System Validation → Runtime. This page stays live, unchanged.

A standalone, clickable demo of the POC in the report *Jev 驱动的实时 Agent 可观测性* (2026-09): a **decision plane over an
agent's trace stream**, not another trace viewer. An AP / Procurement agent's spans pass **hard rules → a Jev judgment
battery → a policy in code**; the page shows each decision, why it was made, how long it took, and what a customer
gateway would receive.

- **Page:** [`index.html`](index.html), served as `/jev-observability/` next to the main demo. No build step, no dependencies.
- **Plan and review record:** [`../logs/2026-09-27_JEV_OBSERVABILITY_PLAN.md`](../logs/2026-09-27_JEV_OBSERVABILITY_PLAN.md).
- **Module contract:** [`CONTRACT.md`](CONTRACT.md).

## What it shows

| Tab | What you can do |
|---|---|
| **Live** | Play the stream, inject scenarios S1–S6 and the F1 timeout, force a judge fault (RTT spike, timeout, down), filter, and inspect any span: the decision order, the simulated Jev answers against their threshold bands, the three paths (hard rule / Jev / LLM), the verdict envelope and the SIEM line. KPIs update from the log. |
| **Replay** | Re-run one logged span under other thresholds, or sweep every threshold. A hard-rule decision never changes. |
| **Policy Studio** | Edit thresholds, per-tool Monitor / Gate mode and fail-open / fail-closed. Each edit is a new policy version. Hard-rule constants are not editable here. |
| **About & evidence** | What is simulated, the report's public numbers with their caveats, and the report's POC gates as hypotheses. |

Scenarios (report p.15): S1 normal payment · S2 payee ≠ account holder → REVIEW · S3 over the approval limit → BLOCK by rule ·
S4 no approval evidence → HOLD · S5 tool 200 but ERP read-back not posted → ALERT · S6 an instruction injected in an invoice note
steers `email.send` to an outside domain → BLOCK · F1 judge timeout → payment fails closed, lookup fails open with an alert.

## What is simulated

Everything that would need a live system:

- **No model is called.** `jev-sim` computes each probability from State Engine features plus seeded jitter, and the Inspector
  lists those features. The judge id is `jev-sim/1.13-shape (simulated)`.
- **Latencies** are drawn from the report's POC budget (p.9) and, for the slow path, from the range of its external experiments (p.4).
- **Cost** uses the vendor list price quoted in the report with simulated token counts; no LLM price is shown.
- **KPIs** are computed from the page's own log; false-block rate and recall are against the author's scenario labels, not a benchmark.
- **The tenant, vendors, invoices and domains** are fictional.

## Run and test

```bash
cd jev-observability
python3 -m http.server 8765        # then open http://localhost:8765/   (?seed=N, ?autoplay=0)
npm test                           # engine tests (node --test)
npm run fixture                    # regenerate data/fixture.json from the engine (deterministic)
npm run probe                      # headless-Chrome acceptance probes P1–P8
```

## Layout

```
index.html  css/app.css  js/ui/*.js          UI (Live, Replay, Policy Studio, About)
js/engine/types.js scenarios.js rng.js        shared enums, battery, default policy; scenario spans; seeded PRNG
js/engine/state.js rules.js jev-sim.js        State Engine; hard rules; simulated Jev battery
js/engine/llm-sim.js policy.js router.js      slow path; policy combine + fallback ladder; decision order
js/engine/kpi.js siem.js                      KPIs from the log; SIEM JSONL line
tests/engine/  tests/probe/  tools/  data/    unit tests; acceptance probes; fixture builder; generated fixture
```
