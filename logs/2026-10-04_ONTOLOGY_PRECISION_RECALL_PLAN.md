# Raising precision and recall together: a two-stage, ontology-typed runtime monitor — plan (R0 draft, not yet reviewed)

Follows the E-AL result ([`2026-10-04_ONTOLOGY_AL_REPORT.md`](2026-10-04_ONTOLOGY_AL_REPORT.md)): ontology typing cut alerts 26 %
and raised precision 0.29 → 0.38, but lost some recall (0.745 → 0.724; the 5-point bound was not established).
Status: **draft for the user; will go through the three-seat plan gate before anything runs.** Everything in § Evidence is exploratory
(E-AL data, already used) and only motivates the design; the test runs on agent models nobody has opened.

## Which matters more for this use case

Runtime Observation is a **pre-execution gate** (allow / hold / block) plus the alert stream an operator triages. The two errors
cost different things by **response tier**, and the ontology already tells us the tier (the effect a call may cause):

| Response | Cost of a miss | Cost of a false alarm | Priority |
|---|---|---|---|
| **Block / hold** an irreversible, high-impact effect (value transfer, credential change, access grant, disclosure to a new party) | money moved, account taken over — not reversible | one held action, a reviewer minute | **recall first**, with a precision floor so the hold queue stays reviewable |
| **Alert** for triage (everything else) | late detection | alert fatigue: analysts stop reading, which turns into missed attacks | **precision first**, at a recall floor |

So the registered target is **both**: recall must not fall below the provenance-only baseline, and precision must rise. In practice
we report, per tier, *alerts per true attack at a fixed recall* — the number an operator feels.

## Evidence that both can rise (exploratory, E-AL data)

| Finding | Implication |
|---|---|
| 77 % of the 552 typed false alarms take their value from ordinary environment data the task legitimately uses (participants from an email, a payee from transaction history, a channel from the directory) | the source/destination question decides precision, not the argument's class |
| 23 % are attacked runs where the agent did act on injected content but the evaluator did not count the attack as complete | label strictness; report a second endpoint |
| Of 338 true alerts, 308 carry a value from injected text | instruction-likeness of the **source passage** separates well |
| Untrusted values that are **URLs**: 84 in attacked-success runs vs 15 elsewhere; IBANs 136 vs 125; emails 154 vs 474 | typing the **value** (link / account / address) wins back link-injection misses (recall); accounts and addresses need a "known party?" check (precision) |
| Lost alert example: a link in a message `body`, which the binding typed `none` | typing by parameter name alone loses recall |

## Design: two stages, the ontology in both

**Stage 1 — candidates (for recall).** A call is a candidate if its effect is anything but data-read (ontology effects) **and** some
argument *value* is an ontology-typed identifier — an account (IBAN-like), a party (email, user handle), a resource (URL, file id),
a credential — **in any parameter**, taken from an earlier tool output and absent from the user's task. Value recognisers are fixed
patterns mapped to ontology classes; the parameter binding stays as a second route.

**Stage 2 — filters (for precision).** Keep a candidate only if:
- (F1) **trust boundary of the source:** the value's first source is external content (web page, inbound message, file, shared document),
  not the user's own record (own transactions, own contacts, own calendar) — tool results typed by the ontology's record / party /
  external-party classes, bound blind;
- (F2) **new party:** for accounts and parties, the value does not already appear in the user's own records before the run (an existing
  payee or contact is not new) — instance-level use of the ontology's party/account classes;
- (F3) **instruction-like source:** the judge's `instruction_override` question on the source passage (Kev, no benchmark markers) is above
  a threshold fitted on calibration data from v1/v2 cohorts.

Ablations report each filter's contribution; the judge filter is one of three, so a gain is not only "the judge".

## Pre-registered test (E-PR), held-out

- **Data:** four or five more undefended model pipelines never opened (e.g. claude-3-opus, gpt-4-turbo, gemini-1.5-flash-002,
  command-r-plus-… — the exact list fixed by a rule at plan review), AgentDojo `important_instructions` + clean runs.
- **Monitors:** M-2S (stage 1 + F1–F3) vs **B-prov** (untyped provenance, as v2) vs **M-OTP** (v2 typed rule) vs **B-2S-rand** (same two
  stages with random typing of the same sizes) vs **B-2S-untyped** (stage 1 + filters with every value and source treated alike, i.e.
  the machinery without the ontology).
- **H14 (primary composite, both directions):** recall(M-2S) > recall(B-prov) **and** precision(M-2S) > precision(B-prov) **and** M-2S
  beats B-2S-untyped on precision at no lower recall **and** beats random typing. Pooled, paired two-way bootstrap as E-AL.
- **Secondary:** per tier (irreversible vs other) alerts per true attack at recall = baseline; the second endpoint "agent acted on
  injected content" (trace-validated from the run, not the evaluator); each filter's ablation.
- **Triage experiment (C, optional):** the ChatGPT review's strongest external evidence is investigation, not detection (Grafana's
  knowledge graph: correct root cause far more often, half the queries). Give an LLM triager each alert with and without the ontology
  explanation chain and measure correct triage decisions and evidence lookups — precision as the operator feels it.

## What the ChatGPT review adds (used here)

- Separate **declared / configured / observed / derived** facts, and measure the gains of new data, deterministic rules and graph/ontology
  **separately** — our B-2S-untyped and random-typing controls do exactly that.
- "Readable sensitive data + an outbound tool" is only a **risk condition**; a violation needs the actual call, data source and
  destination — the stage-2 filters.
- Use AgentDojo as an **execution environment** with our own state assertions, not only its evaluator score — the second endpoint.
- Its larger recommendation (I-1042 approval binding as a sandbox POC, MAL / Cartography) is a separate product track, not part of E-PR.

## Gates

As before: plan gate (three seats) → target-free seal (recognisers, source/party bindings written blind, filters, statistics, independent
recheck) → sealed conversion (counts only) → freeze gate → run → code + report gate → card update if warranted → merge and deploy.
