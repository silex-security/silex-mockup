# Proposal: Decision Trace — Blueprint validation shown through the Security Ontology and the Security World Model

Author: Claude (lead) · 2026-09-24 · Status: **v0.1 — draft for review by DeepSeek and Codex. Needs unanimous approval before any code changes.**

## 0. The ask

**User (2026-09-24):** "请阅读我们mockup demo 网站的security world model 部分， 以及我们的知识库…, 帮我提一个proposal，如何把blueprint的验证可行性跟ontology graph以及security world model结合起来展示决策过程， 给出提案并给codex/deepseek 解释并review 通过后可以修改artifact"

In English: combine Blueprint's validation feasibility with the ontology graph and the Security World Model, so that the **decision process** is visible. Once the reviewers approve, change the Blueprint Studio artifact.

**Sources read:**
- **Mockup** (`silex-mockup`):
  - `SECURITY_WORLD_MODEL.md` and `swm/README.md`;
  - the Assurance page's sections 03–04 in `index.html`: the Enterprise World Model card, the funnel "How candidate routes are evaluated", and the path grades;
  - `swm/data/ontology.json`: `swm-1.0`, 598 nodes, 800 typed links.
- **Knowledge base** (`~/workplace/Silex/silex_knowledge_base/wiki`):
  - `concepts/Security World Model`, `Security Ontology`, `Evidence Grades (Observed, Latent, Declared)`, `Design-Time Verification`, `Counterfactual Simulation`, `Ladder of Causation`;
  - `sources/reports/Where an Ontology Stops`;
  - Blogs 05–07;
  - the Jev, AgentO and Formal Agents reports;
  - papers: CaMeLoT, Agentproof, Sentinel, LEDGER, TRW.
- **Product and positioning specs:** `~/.claude/skills/silex-product/SKILL.md` §6.5, B1–B6, N4, N9, PCP, and §13; `silex-positioning`.

## 1. What exists, and the gap

| Asset | What it is today | What it lacks |
|---|---|---|
| **Blueprint Studio** (artifact) | A real, deterministic engine. A graph gets Confirm → Validate (240 seeded runs, monitors, violating paths) → Optimize (candidates, eligibility, ranking) → Decide → Register. Every number is computed. | **No semantics.** A finding says `unauth:split`, not *which class of thing failed, against which published threat, under which law*. It never says what it did **not** test. |
| **Security World Model** (mockup) | An ontology of 598 types built from D3FEND, ATLAS, ATT&CK, UCO and OWASP. It is layered L1→L4. It has a coverage sunburst, blind spots, and a decision funnel ("2,304 branches → 2,117 excluded by named laws → 187 simulated → 4 routes"). | Every count in the funnel is **illustrative**. The ontology is connected to no decision. |
| **Knowledge base** | The theory. World Model = Ontology + Dynamics + Instance + Objectives. It has five named layers (**Schema, Laws, World State, Objectives, Calibration**) and the ladder of causation: rung 1 is coverage, rung 2 is intervention and ranking, rung 3 is counterfactual and calibration. It sets the evidence grades, and the PCP (Policy Change Proposal) as "a pull request with a proof attached". | Nothing runs. |

**The opportunity.** Blueprint is the one place where the mockup's funnel can be **computed rather than illustrated**. The ontology is the one place where Blueprint's findings can get a **semantic rationale** and a list of what they do *not* cover. Together they show the decision process the KB describes, using real numbers for a small, declared world.

## 2. Constraints from the KB (these shape the design)

- **C1 · Rungs.** Blueprint Check is rung 1 by design. "What it does not produce: a ranked policy recommendation. Ranking needs the Laws and Objectives (rung 2)" (product §6.5).
  - Our Optimize and Decide steps are rung 2. The trace must therefore **show the Laws and the Objectives explicitly**, as the rules the engine actually uses, so that the ranking is not magic.
- **C2 · World-model layers are named, never numbered:** Schema, Laws, World State, Objectives, Calibration. "L1–L4" belongs to the ontology tiers only.
- **C3 · Evidence grades (N4).**
  - Paths are *declared / latent / observed*. Outcomes are *simulated / shadow / canary / production*.
  - Blueprint produces **declared** paths and **simulated** outcomes, nothing else. Nothing is ever shown as observed.
  - There is no "Verified" grade.
- **C4 · N9/B5. Assurance, never certification.**
  - Every statement is **as of an ontology version, a blueprint hash and a scenario set**.
  - An empty result reads "No violations in the tested scenarios under ontology swm-1.0, from this declaration", never "safe".
- **C5 · Findings name their generating class and constraint** (§3 / Blog 05). Example: "a write tool (`ag:tool-reg`) is reached from an untrusted trigger through an agent holding `refund.issue ≤ 10000`, with no approval bound to `amount`".
- **C6 · The PCP shape.** The record shows:
  - the gap;
  - the candidates;
  - the simulated impact;
  - **rejected candidates and why**;
  - the recommendation with its rationale;
  - the evidence grade;
  - rollback.
  - "Ranked, not recommended": alternatives always stay visible.
- **C7 · Unmodelled residual.** Every result carries an explicit `unmodeled` block (AgentO report; Jev §4.3). A **plausibility is not an evidence grade.**
- **C8 · Not a linter, not a knowledge-graph product** (B2, §13).
  - The ontology appears as the **reason** behind a decision, not as a 598-node browser.
  - We never emit dozens of rule warnings.
- **C9 · The Laws are declared, not learned.** The KB asks where Laws come from and marks that as an open question.
  - The engine's laws are a **declared adversary model**, uncalibrated.
  - The Calibration layer is shown **empty, with what would fill it** (predicted vs observed from production outcome records). It is never faked.
- **C10 · The promotion ladder:** Simulation → Shadow → Canary → Production. The Studio reaches **Simulation only**, and says "a filter, not a verdict".

## 3. The proposal: a **Decision Trace** view

A third top-level view next to Builder and Assurance: **Trace · 决策链路**. It is available once the revision is confirmed. It fills in stage by stage as Validate, Optimize and Decide complete. It has three linked parts: the **spine**, the **thread graph** and the **decision record**.

### 3.1 The spine: the world-model layers, each with what Blueprint supplies

The spine is a vertical list of named layers. Each row shows its **rung**, its **grade** and its **computed** numbers for the active revision:

| Layer | What Blueprint supplies (computed) | Rung | Grade |
|---|---|---|---|
| **Schema** | The blueprint's nodes typed to L3 component classes (`INSTANCE_OF`), each by a stated rule, for example *tool → Tool Registry (ag:tool-reg)*. From the ontology: the number of published threat classes (ATLAS/OWASP, `THREATENS`) that target those classes. **Customer Refund: 7 classes, 72 threat classes.** | 1 | latent (possible by type) |
| **Laws** | The engine's transition rules, named: authority (a write checks the last agent's capability and limit), taint (untrusted input → injected → secret read → external emit), approval binding and reuse, idempotency. The six scenario families, each with the law it exercises, its public threat ids (§4) and its **sampling**: 40 seeded requests per family, drawn from the disclosed ranges. **Every family runs on every graph. Nothing is pruned.** (The engine has an `applicability` function, but nothing calls it. Its reasons contradict actual runs, e.g. Vendor Bank Change's "no positive write threshold" family still violates 40/40. So the trace does not show it.) | 2 | declared adversary model, uncalibrated |
| **World State** | This declared instance: the revision label, the hash, and the static paths (`potentialPaths`) from each untrusted trigger to each protected target, with the guards on each path. **Customer Refund: 7 paths.** | 1 | **declared** |
| **Simulation** (the Laws executed over the World State) | 240 seeded runs → findings, each with its violating paths (counterexamples) and violating/run counts. | 2 | **simulated** |
| **Objectives** | The optimizer's actual rule, shown verbatim. **Eligibility:** no structural errors; benign completion ≥ baseline − 2 pp; no finding increases; no critical finding left. **Then rank by:** friction, then median added latency, then patch size. Of the KB's six objectives, **compliance and cost are marked "not modelled"**. | 2 | declared weights |
| **Calibration** | Empty: "Needs production outcome records (predicted vs observed). Not available at design time." | 3 | — |
| **Decision** | The human decision (Decide), its revision, and the promotion ladder, with Simulation ✓ and Shadow, Canary and Production shown as *not run (outside this demo)*. | — | — |

### 3.2 The thread graph: follow one decision through every layer

A left-to-right React Flow graph, reusing the builder's nodes and the dagre layout, with five columns:

```
Blueprint step  →  Ontology class (L3)  →  Threat (ATLAS / OWASP)  →  Scenario family (Law)  →  Finding  →  Candidate fix  →  Decision
  Payment API       Tool Registry           owaspa:T2 Tool Misuse       split                    unauth:split  threshold:amount:2000   approved v1.1
                    ag:tool-reg             owasp:LLM06 Exc. Agency
```

- **Focus on one thread.** Clicking a finding, candidate or blueprint step highlights its whole chain across the columns and dims everything else. It also highlights the violating path on a mini blueprint. The default focus is the recommended or approved candidate: "why was this approved?"
- **Edges carry their grade:**
  - declared: dashed;
  - latent by type: dotted;
  - simulated: solid;
  - not modelled: grey.
- **Every public node shows its real identifier with a link** (e.g. `AML.T0051` → atlas.mitre.org). Silex-authored links are labelled **Silex mapping**, as the mockup already labels `Silex mock`.
- **Size budget.** The graph shows only threats linked to a finding or a candidate. The other threat classes are **counted** in a collapsed "Not modelled by this simulator (66)" list, grouped by component. They are never drawn (C8).
- **Rejected candidates stay visible**, greyed, with the optimizer's own `reasons` (C6).

### 3.3 The funnel: the mockup's funnel, computed

A single row of counts. Each count can be clicked to show its members.

**Customer Refund, computed with the engine on 2026-09-24:**

```
72 threat classes target this workflow's component types            (latent by type · ontology swm-1.0)
 → 6 of them are exercised by the simulator's six families · 66 not modelled by this simulator
   (+1 exercised threat, owaspa:T3 via replay, targets Credential Broker — a class no step here instantiates; shown, not counted)
 → 7 declared paths from an untrusted trigger to a protected target   (declared)
 → 6 families × 40 seeded requests = 240 simulated runs → 200 of 200 adversarial runs violate · 16 of 40 benign runs violate → 6 findings   (simulated)
 → 16 candidate fixes tested → 2 eligible · 14 rejected, each with the optimizer's reason → 1 recommended by the objectives rule → approved by a person
```

The other templates, from the same run:
- **Vendor Bank Change:** 9 candidates, 2 eligible, recommended `threshold:amount:0+binding`.
- **RAG Support Agent:** 15 candidates, 2 eligible.

The live view computes these for whatever graph is on the canvas; nothing is typed in.

**Footnote: *Sampled, not pruned.*** Unlike the mockup's illustrative funnel, where branches are "excluded by named laws", Blueprint prunes nothing. It samples 40 requests per family. A family with 0 violations is evidence from 40 samples, not an exhaustive check.

### 3.4 The decision record (PCP-shaped), exportable

A panel, **Copy / Download decision record (JSON)**, that assembles the following from what the store already holds:

```json
{ "record": "silex.decision-trace/v0", "ontologyVersion": "swm-1.0", "blueprint": {"rev": "v1.1", "hash": "…", "parent": "v1.0"},
  "scenarioSet": "…", "gap": [{"finding": "unauth:split", "class": "ag:tool-reg", "threats": ["owaspa:T2","owasp:LLM06"], "law": "authority", "paths": [...], "grade": {"path": "declared", "outcome": "simulated"}}],
  "candidates": [{"id": "...", "eligible": true, "scorecard": {...}}, {"id": "...", "eligible": false, "rejectedBecause": ["..."]}],
  "objectives": {"eligibility": [...], "rank": ["friction", "addedLatencyMedian", "patchOps"], "notModelled": ["compliance", "cost"]},
  "decision": {"candidate": "...", "by": "human", "revision": "v1.1"},
  "semanticRationale": "…", "unmodeled": {"threatClasses": 66, "layers": ["Calibration"]},
  "promotion": {"simulation": "done", "shadow": "not run", "canary": "not run", "production": "not run"},
  "rollback": "v1.0",
  "statement": "No violations in the tested scenarios under ontology swm-1.0, from this declaration. Not a certification." }
```

The record is **derived, never stored**. Import of documents is unchanged: the trace is recomputed from the document, the same way imported evidence already is.

### 3.5 Cross-links

- A Validate finding and an Optimize candidate each get a **"Trace"** link that opens the thread graph focused on them.
- The Decide page gets a **"Why this decision?"** link.
- The mockup's own Security World Model pages are **not changed** by this proposal. Linking the mockup explorer to the Studio is a follow-up.

## 4. Data: an ontology slice, and two mapping tables

- **`blueprint_studio/ontology/slice.json`** is generated by `blueprint_studio/tools/ontology-slice.mjs` from `swm/data/ontology.json`. It contains:
  - the 13 L3 component classes;
  - every threat that `THREATENS` them (the 72 in scope, plus any threat that targets another L3 class);
  - their `COUNTERS` countermeasures;
  - each node's `id`, `label`, `group`, `layer`, `src` (with the public id and URL), and `version`.
  - Expected size: tens of KB.
  - A test fails if the slice is stale against `ontology.json`, or if any id in a mapping table is missing from the slice.
- **The mapping tables are Silex-authored.** They are labelled that way in the UI and in the JSON (`src: "silex-mapping"`), each with a one-line rationale.

**Blueprint type → L3 class:**

| Blueprint type | L3 class |
|---|---|
| agent | ag:planner |
| tool | ag:tool-reg |
| data | ag:retriever |
| control `human_approval` / `dual_approval` | ag:hitl |
| control `policy_gate` | ag:guardrail |
| decision | ag:guardrail |
| trigger | ag:exec-ctx |
| outcome, prohibited | ag:harness |

**Scenario family → public threats**, plus the law it exercises:

| Family | Law | Public threats |
|---|---|---|
| below_threshold | authority | owasp:LLM06 Excessive Agency; owaspa:T2 Tool Misuse |
| split | authority | owaspa:T2; owasp:LLM06 |
| replay | approval binding | owaspa:T3 Privilege Compromise |
| duplicate_submit | idempotency | **none**: a business-outcome failure, with no public threat id (said so) |
| injection_exfil | taint | atlas:AML.T0051 LLM Prompt Injection; atlas:AML.T0086 Exfiltration via AI Agent Tool Invocation; owasp:LLM01; owasp:LLM02 |
| benign | — (the objectives baseline) | — |

**Candidate class → the control it adds**, as an L3 class:

| Candidate class | Control (L3 class) | Countermeasure |
|---|---|---|
| threshold | ag:guardrail + ag:hitl | |
| binding | ag:hitl | counters owaspa:T3 |
| idem | a Silex control (idempotency key) | no public countermeasure id |
| injection | ag:guardrail (redaction) | |

We do not invent D3FEND links that the bundle does not already contain.

## 5. Wording rules (checked by a probe, in English and 中文)

- **Never used:** *safe*, *secure* (as a verdict), *verified* (as a grade), *certified*, *observed* (as the grade of anything Blueprint produced), or *world model fit*.
- **Every screen of the trace** carries a stamp: `ontology swm-1.0 · blueprint v1.x #hash · scenario set · grades: declared paths, simulated outcomes`.
- **Layers are named, never numbered** (C2). L1–L4 appear only for ontology tiers.

## 6. Architecture and ownership

| # | Owner | Files | Acceptance |
|---|---|---|---|
| 1 | deepseek | `tools/ontology-slice.mjs`, `ontology/slice.json`, `web/src/trace/mapping.js` (the three tables, with rationales), `tests/trace-data.test.mjs` | The slice is reproducible and not stale; every mapped id exists; a family with no public threat is explicit |
| 2 | deepseek | `web/src/trace/derive.js`: pure functions (graph, validation, optimization, decision, slice) → {spine, funnel, thread graph, record}; `web/tests/derive.test.mjs` | The funnel equals the engine's own numbers on 3 templates. **Customer Refund: 72 / 6 / 7 / 240 / 200 of 200 / 16 of 40 / 6 / 16 / 2.** The record's candidates and rejected reasons equal Optimize's. Grades are never `observed` |
| 3 | claude | `web/src/trace/TraceView.jsx`, `ThreadGraph.jsx`, `Spine.jsx`, `DecisionRecord.jsx`, the App/nav wiring, the Validate, Optimize and Decide links, i18n, CSS | §7 probes |
| 4 | claude | probes, README, this plan's record | — |

- **No engine changes.** `derive.js` reads the existing results.
- **Bundle growth:** the slice (tens of KB) plus the view code.
- **Artifact:** the same URL, republished only after the code gate passes. Nothing is pushed.

## 7. Acceptance probes (headless Chrome, as before)

- **X1.** On Customer Refund, after Confirm, Validate, Optimize and Decide, **Trace** shows:
  - all seven spine rows;
  - the funnel counts equal to the engine's (`findings.length`, `runs.length`, `candidates.length`, eligible count, `potentialPaths` length, applicability);
  - a stamp carrying the ontology version and the revision hash.
- **X2.** Clicking a finding highlights exactly its chain: blueprint step → class → threats → family → finding → candidates that close it. The mini blueprint highlights the finding's violating path nodes.
- **X3.** Rejected candidates show the optimizer's exact `reasons` strings.
- **X4.** On Vendor Bank Change, every family shows 40 runs and its law. `duplicate_submit` shows "no public threat id". Replay's owaspa:T3 is shown as "targets Credential Broker — not instantiated in this blueprint". The "Sampled, not pruned" footnote is present.
- **X5.** Wording: in English and 中文, the trace contains none of the §5 forbidden terms. The only grades present are declared, latent, simulated and "not run".
- **X6.** Before Validate, Trace shows only Schema and World State, with "run Validate to fill Laws/Simulation". Nothing is fabricated.
- **X7.** The decision record JSON parses, and its hash, candidates and decision match the store. After export → import, the record is identical.
- **X8.** Public ids link to their official pages; Silex-mapping items are labelled.
- **X9.** All existing probes (45) and all unit tests still pass.

## 8. Out of scope

- Changing the mockup site's Security World Model pages.
- Calibration against real runtime data.
- Drawing the full 598-node ontology.
- Any claim of fit or accuracy.
- A domain-pack (L2) baseline comparison. This is noted as the next step: §6.5's "departs from the finance-agent baseline here".

## 9. Review record

*(pending)*
