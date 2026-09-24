# Proposal: Decision Trace — Blueprint validation shown through the Security Ontology and the Security World Model

Author: Claude (lead) · 2026-09-24 · Status: **v0.2 — round 1 rejected by both reviewers; this revision is for round 2 (changes are listed in §2.1). Needs unanimous approval before any code changes.**

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
| **Security World Model** (mockup) | An ontology of 598 types built from D3FEND, ATLAS, ATT&CK, UCO and OWASP. It is layered L1→L4. It has a coverage sunburst, blind spots, and a decision funnel ("2,304 branches → 2,117 excluded by named laws → 187 simulated → 4 routes"). | Every count in the funnel is **illustrative**. The ontology is connected to no decision. In the bundle, the threat ids and definitions are public (ATLAS/OWASP), but **all 105 `THREATENS` links (threat → component) and all 32 `COUNTERS` links are Silex-authored mock content** (`src: silex`). |
| **Knowledge base** | The theory. World Model = Ontology + Dynamics + Instance + Objectives. It has five named layers (**Schema, Laws, World State, Objectives, Calibration**) and the ladder of causation: rung 1 is coverage, rung 2 is intervention and ranking, rung 3 is counterfactual and calibration. It sets the evidence grades, and the PCP (Policy Change Proposal) as "a pull request with a proof attached". | Nothing runs. |

**The opportunity.** Blueprint is the one place where the mockup's funnel can be **computed rather than illustrated**. The ontology is the one place where Blueprint's findings can get a **semantic rationale** and a list of what they do *not* cover. Together they show the decision process the KB describes, using real numbers for a small, declared world.

## 2. Constraints from the KB (these shape the design)

- **C1 · Rungs.** Blueprint Check is rung 1 by design. "What it does not produce: a ranked policy recommendation. Ranking needs the Laws and Objectives (rung 2)" (product §6.5).
  - Our Optimize and Decide steps are rung 2. The trace must therefore **show the Laws and the Objectives explicitly**, as the rules the engine actually uses, so that the ranking is not magic.
- **C2 · World-model layers are named, never numbered:** Schema, Laws, World State, Objectives, Calibration. "L1–L4" belongs to the ontology tiers only.
- **C3 · Evidence grades (N4).**
  - Paths are *declared / latent / observed*. Outcomes are *simulated / shadow / canary / production*.
  - Blueprint produces **declared** paths and **simulated** outcomes, nothing else. Nothing is ever shown as observed.
  - There is no "Verified" grade. **"Latent" is reserved for paths over deployed instances** (product §6.1, B1). Nothing in Blueprint is latent.
  - **An ontology association is not an evidence grade.** Examples: "this step is a Tool Registry entry", or "this threat is associated with Tool Registry". Such a link carries **provenance** instead: *public id* (the ATLAS/OWASP entry itself) or *Silex association* (the Silex-authored mapping). It is shown separately from path and outcome grades.
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

## 2.1 Revisions from round 1 (v0.2)

Round 1: DeepSeek PLAN-REJECTED (1 blocking, 6 nits), Codex PLAN-REJECTED (3 blocking). Both verified the §3.3 engine numbers as correct.

| # | Defect | Change |
|---|---|---|
| **Codex 1 / DeepSeek 1** | "Latent by type" inflates the grade; Blueprint is a declared instance | "Latent" is removed everywhere. Paths are **declared** and outcomes **simulated**. Ontology links carry **provenance** (public id / Silex association), never a grade (C3, §3.1–§3.3, §5, X5) |
| **Codex 2** | The unconditional mappings invent semantics: data ≠ RAG index (Payment Credentials), and trigger ≠ execution context | §4's type mapping follows the ontology's **own definitions**, with a criterion per row. Data, trigger and decision are **unmapped**: the declaration does not establish their class. Unmapped steps are listed. The threat count is recomputed: **Customer Refund 10 of 14 steps mapped, to 4 classes; 48 associated threat classes**. Tests check the semantic counterexamples |
| **Codex 3** | Related threats are presented as exercised; subtracting from 72 implies the rest alone are unmodelled; AML.T0086 is a different mechanism; injection variant a is not a redaction gate | Each family lists **related public threats, with an abstraction limit per link** ("related, not tested"). AML.T0086 is dropped. No threat is counted as tested, and there is no "N − k unmodelled" arithmetic. Candidate controls are **described from their actual patch ops** (§4.3) |
| Found while revising | The bundle's threat→component links are all Silex-authored | Stated in §1 and on every association (provenance *Silex association · illustrative*) |
| Codex (while reviewing) | Parent vs approved-child evidence | The trace is bound to the **evaluated (parent) revision**. The approved child shows "evidence: v1.0's candidate run", with both hashes from the store's approval evidence (§3.1 Decision row, §3.4) |
| DeepSeek nits 1–6 | Seven columns, not five · objectives wording · "across four families" · `notSimulated` key · replay rationale · finding→class rule | All applied (§3.1, §3.2, §3.4, §4) |

## 3. The proposal: a **Decision Trace** view

A third top-level view next to Builder and Assurance: **Trace · 决策链路**. It is available once the revision is confirmed. It fills in stage by stage as Validate, Optimize and Decide complete. It has three linked parts: the **spine**, the **thread graph** and the **decision record**.

### 3.1 The spine: the world-model layers, each with what Blueprint supplies

The spine is a vertical list of named layers. Each row shows its **rung**, its **grade** and its **computed** numbers for the active revision:

| Layer | What Blueprint supplies (computed) | Rung | Grade |
|---|---|---|---|
| **Schema** | Each blueprint step is typed to an L3 component class **only where the declaration meets that class's definition** (§4.1). Otherwise it is listed as *unmapped*. For the mapped classes, the threat classes the bundle **associates** with them (`THREATENS`: public ids, Silex-authored association). **Customer Refund: 10 of 14 steps mapped, to 4 classes. 48 associated threat classes. 4 unmapped (2 data, 1 trigger, 1 decision).** | 1 | no grade: provenance *Silex mapping* / *Silex association · illustrative* |
| **Laws** | The engine's transition rules, named: authority (a write checks the last agent's capability and limit), taint (untrusted input → injected → secret read → external emit), approval binding and reuse, idempotency. The six scenario families, each with the law it exercises, its public threat ids (§4) and its **sampling**: 40 seeded requests per family, drawn from the disclosed ranges. **Every family runs on every graph. Nothing is pruned.** (The engine has an `applicability` function, but nothing calls it. Its reasons contradict actual runs, e.g. Vendor Bank Change's "no positive write threshold" family still violates 40/40. So the trace does not show it.) | 2 | declared adversary model, uncalibrated |
| **World State** | This declared instance: the revision label, the hash, and the static paths (`potentialPaths`) from each untrusted trigger to each protected target, with the guards on each path. **Customer Refund: 7 paths.** | 1 | **declared** |
| **Simulation** (the Laws executed over the World State) | 240 seeded runs → findings, each with its violating paths (counterexamples) and violating/run counts. | 2 | **simulated** |
| **Objectives** | The optimizer's actual rule, shown verbatim. **Eligibility:** no structural errors; benign completion ≥ baseline − 2 pp; no finding increases; no critical finding left. **Then rank by:** friction, then median added latency, then patch size. Against the KB's six objectives: **risk, friction and latency are approximated** (critical/no-increase gates, the friction rate, median added latency). **Coverage, compliance, cost and performance are not modelled.** | 2 | declared rule, uncalibrated |
| **Calibration** | Empty: "Needs production outcome records (predicted vs observed). Not available at design time." | 3 | — |
| **Decision** | The human decision (Decide) and the promotion ladder, with Simulation ✓ and Shadow, Canary and Production shown as *not run (outside this demo)*. The trace is bound to the **evaluated revision** (the parent, e.g. v1.0). There the decision names the approved child (v1.1) and its hash from the store's approval evidence. Opening Trace on the child shows "Approved from v1.0 — the evidence is v1.0's candidate run", links to it, and never re-labels the parent's results as the child's. | — | — |

### 3.2 The thread graph: follow one decision through every layer

A left-to-right React Flow graph, reusing the builder's nodes and the dagre layout, with seven columns:

```
Blueprint step  →  Ontology class (L3)  →  Related public threat  →  Scenario family (Law)  →  Finding  →  Candidate fix  →  Decision
  Payment API       Tool Registry           owaspa:T2 Tool Misuse        split (authority)         unauth:split  threshold+binding+…   approved v1.1
                    ag:tool-reg             owasp:LLM06 Exc. Agency
                    (Silex mapping)         (related, not tested — limit shown on the link)
```

- **Focus on one thread.** Clicking a finding, candidate or blueprint step highlights its whole chain across the columns and dims everything else. It also highlights the violating path on a mini blueprint. The default focus is the recommended or approved candidate: "why was this approved?"
- **Edges show their evidence grade or their provenance, never both, and never a grade Blueprint cannot produce:**
  - declared (from the blueprint's configuration): dashed;
  - simulated (from the engine's runs): solid;
  - Silex mapping / Silex association: dotted, with a label, and **no grade**;
  - not simulated: grey.
- **Finding → class rule** (DeepSeek nit 6). A finding attaches to the class of the step its monitor **watches**: a tool for unauthorized write and duplicate effect, an outcome for secret exposure. The classes of the steps on its violating paths are highlighted as context.
- **Every public node shows its real identifier with a link** (e.g. `AML.T0051` → atlas.mitre.org). Silex-authored links are labelled **Silex mapping**, as the mockup already labels `Silex mock`.
- **Size budget.** The graph draws only the threats **related to a simulated family**. The other associated threat classes are listed, collapsed, as "Associated with this workflow's classes, with no related scenario family (44)", grouped by class. They are never drawn (C8), and **none of the 48 is described as tested**.
- **Rejected candidates stay visible**, greyed, with the optimizer's own `reasons` (C6).

### 3.3 The funnel: the mockup's funnel, computed

A single row of counts. Each count can be clicked to show its members.

**Customer Refund, computed with the engine on 2026-09-24:**

```
10 of 14 steps mapped to 4 ontology classes · 4 unmapped (the declaration does not establish their class)      (Silex mapping)
 → 48 threat classes associated with those classes in ontology swm-1.0      (public ids · Silex association, illustrative)
   · 4 of them are related to a simulated family, at the abstraction stated on each link — related, not tested
   · 44 have no related family
   · 2 more related ids (owaspa:T3 via replay, owasp:LLM02 via injection_exfil) are associated with classes this declaration does not instantiate — shown, not counted
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
  "evaluatedRevision": {"rev": "v1.0", "hash": "…"}, "approvedChild": {"rev": "v1.1", "hash": "…"},
  "scenarioSet": "…", "gap": [{"finding": "unauth:split", "watches": "payment", "class": {"id": "ag:tool-reg", "provenance": "silex-mapping"},
     "relatedThreats": [{"id": "owaspa:T2", "provenance": "silex-association", "limit": "only threshold-splitting of one write tool is simulated"}],
     "law": "authority", "paths": [...], "grade": {"path": "declared", "outcome": "simulated"}}],
  "unmappedSteps": [{"id": "credentials", "type": "data", "why": "declaration does not establish retriever / credential broker / record system"}],
  "candidates": [{"id": "...", "eligible": true, "scorecard": {...}}, {"id": "...", "eligible": false, "rejectedBecause": ["..."]}],
  "objectives": {"eligibility": [...], "rank": ["friction", "addedLatencyMedian", "patchOps"], "approximated": ["risk", "friction", "latency"], "notModelled": ["coverage", "compliance", "cost", "performance"]},
  "decision": {"candidate": "...", "by": "human", "revision": "v1.1"},
  "semanticRationale": "…", "notSimulated": {"associatedThreatsWithoutRelatedFamily": 44, "layers": ["Calibration"]},
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
  - every threat the bundle associates with them through `THREATENS`, with each link's `src` kept (all are Silex-authored in swm-1.0);
  - their `COUNTERS` countermeasures;
  - each node's `id`, `label`, `group`, `layer`, `src` (with the public id and URL), and `version`.
  - Expected size: tens of KB.
  - A test fails if the slice is stale against `ontology.json`, or if any id in a mapping table is missing from the slice.
- **The mapping tables are Silex-authored.** They are labelled that way in the UI and in the JSON (`src: "silex-mapping"`), each with a one-line rationale.

### 4.1 Blueprint step → L3 class, by the ontology's own definitions

A step maps only when its declared configuration meets the class definition quoted from `ontology.json`. Otherwise it is **unmapped**, with the reason shown.

| Blueprint step | L3 class | Class definition (swm-1.0) | Criterion |
|---|---|---|---|
| agent | ag:planner | "Decomposes a goal into steps and chooses the next action." | Always: a Blueprint agent chooses the next action and holds capabilities |
| tool | ag:tool-reg | "Declared tools, their scopes and their side effects." | Always: a tool step declares its capability and side effect. **Not** ag:mcp, because the transport is not declared |
| control `human_approval` / `dual_approval` | ag:hitl | "Human decision point inserted into the agent loop." | `config.kind` is one of the two |
| control `policy_gate` | ag:guardrail | "Evaluates each proposed action against policy before it runs." | `config.kind === 'policy_gate'` |
| outcome, prohibited (monitor) | ag:harness | "Legitimate completion, prohibited outcomes, …" | Always |
| data | **unmapped** | — | The declaration (label, sensitivity) does not tell a retriever from a credential broker or a system of record. Counterexample: Customer Refund's *Payment Credentials* |
| trigger | **unmapped** | — | An entry point establishes no execution context (sandbox, runtime permissions) |
| decision | **unmapped** | — | A routing rule is not by itself a policy engine |

Tests assert the counterexamples: Payment Credentials and Customer Profile are unmapped; the request trigger is unmapped; `gate` is unmapped.

### 4.2 Scenario family → law → related public threats, each with its abstraction limit

"Related" means that the family simulates a narrow instance of the threat's mechanism. **It never means the threat was tested.** The threat ids and definitions are public; the relation is Silex-authored.

| Family | Law | Related public threats | Abstraction limit (shown on the link) |
|---|---|---|---|
| below_threshold | authority | owasp:LLM06 Excessive Agency; owaspa:T2 Tool Misuse | Only a write below the monitor's threshold by an agent whose capability allows it |
| split | authority | owasp:LLM06; owaspa:T2 | Only splitting one request into several under-threshold writes to one tool |
| replay | approval binding | owaspa:T3 Privilege Compromise | Only reuse of an earlier approval for a different request. In swm-1.0, T3 is associated with Credential Broker, which Blueprint does not instantiate |
| duplicate_submit | idempotency | **none** | A business-outcome failure (double compensation) with no public threat id |
| injection_exfil | taint | atlas:AML.T0051 LLM Prompt Injection; owasp:LLM01 Prompt Injection; owasp:LLM02 Sensitive Information Disclosure | The injection is a scripted flag on untrusted input, not crafted content. Disclosure is modelled only as a secret read reaching an external outcome. (AML.T0086, exfiltration through tool invocation, is **not** related: a different mechanism) |
| benign | — | — | The objectives baseline |

Across the four families that have related threats, that makes six distinct threat ids (DeepSeek nit 3).

### 4.3 Candidate → what it changes, described from its patch

The trace never names a control class for a candidate by fiat. It **reads the candidate's patch ops** and describes them. Any step the patch adds or changes is typed with §4.1.

| Candidate class | Patch ops (optimize.js) | Description, and the class of the added or changed step |
|---|---|---|
| threshold | setConfig on an existing decision's condition, or add decision + human_approval control before the tool | "Routes `field > x` to a human approval": the new control is ag:hitl; the decision stays unmapped |
| binding | setConfig binding = customer, order, amount; singleUse = true on the approval control | "Ties the approval to customer, order and amount, single use": changes an ag:hitl step |
| idem | setConfig idempotencyKey = true on the tool | "Adds an idempotency key to the write tool": changes an ag:tool-reg step; no public countermeasure id |
| injection a | moves the secret read from the agent to its downstream tool | "The agent no longer reads the secret; the tool does": a data-access change, no control class. **Not a redaction gate** |
| injection b | adds a policy_gate (redact above internal) before each external success outcome | "Redacts secrets before external outcomes": the new control is ag:guardrail |

We do not add D3FEND links. Every `COUNTERS` link in the bundle is Silex-authored, and none targets these threats.

## 5. Wording rules (checked by a probe, in English and 中文)

- **Never used:** *safe*, *secure* (as a verdict), *verified* (as a grade), *certified*, *observed* or *latent* (as the grade of anything Blueprint produced), *world model fit*, or *tested*/*exercised* applied to a public threat.
- **Every screen of the trace** carries a stamp: `ontology swm-1.0 · blueprint v1.x #hash · scenario set · grades: declared paths, simulated outcomes`.
- **Layers are named, never numbered** (C2). L1–L4 appear only for ontology tiers.

## 6. Architecture and ownership

| # | Owner | Files | Acceptance |
|---|---|---|---|
| 1 | deepseek | `tools/ontology-slice.mjs`, `ontology/slice.json`, `web/src/trace/mapping.js` (the §4.1 and §4.2 tables with definitions, criteria and limits), `tests/trace-data.test.mjs` | The slice is reproducible and not stale; every mapped id exists; the slice keeps each link's `src`. Semantic counterexamples: Payment Credentials, Customer Profile, the trigger and `gate` are unmapped. `duplicate_submit` has no related threat; AML.T0086 is absent |
| 2 | deepseek | `web/src/trace/derive.js`: pure functions (graph, validation, optimization, decision, slice) → {spine, funnel, thread graph, record}; `web/tests/derive.test.mjs` | The funnel equals the engine's own numbers on 3 templates. **Customer Refund: 10 of 14 mapped / 48 associated / 4 related / 7 paths / 240 runs / 200 of 200 / 16 of 40 / 6 findings / 16 candidates / 2 eligible.** The record's candidates and rejected reasons equal Optimize's. Candidate descriptions come from the patch ops (§4.3). The only grades present are `declared`, `simulated` and `not run` |
| 3 | claude | `web/src/trace/TraceView.jsx`, `ThreadGraph.jsx`, `Spine.jsx`, `DecisionRecord.jsx`, the App/nav wiring, the Validate, Optimize and Decide links, i18n, CSS | §7 probes |
| 4 | claude | probes, README, this plan's record | — |

- **No engine changes.** `derive.js` reads the existing results.
- **Bundle growth:** the slice (tens of KB) plus the view code.
- **Artifact:** the same URL, republished only after the code gate passes. Nothing is pushed.

## 7. Acceptance probes (headless Chrome, as before)

- **X1.** On Customer Refund, after Confirm, Validate, Optimize and Decide, **Trace** shows:
  - all seven spine rows;
  - the funnel counts equal to the engine's (`findings.length`, `runs.length`, `candidates.length`, eligible count, `potentialPaths` length) and to the slice's (mapped, unmapped, associated, related);
  - a stamp carrying the ontology version and the revision hash.
- **X2.** Clicking a finding highlights exactly its chain: blueprint step → class → threats → family → finding → candidates that close it. The mini blueprint highlights the finding's violating path nodes.
- **X3.** Rejected candidates show the optimizer's exact `reasons` strings.
- **X4.** On Vendor Bank Change, every family shows 40 runs and its law. `duplicate_submit` shows "no public threat id". Replay's owaspa:T3 is shown as "targets Credential Broker — not instantiated in this blueprint". The "Sampled, not pruned" footnote is present.
- **X5.** Wording: in English and 中文, the trace contains none of the §5 forbidden terms. The only grades present are declared, simulated and "not run". Every association carries a provenance label.
- **X10.** The unmapped list shows Payment Credentials, Customer Profile, the request trigger and `gate`, each with its reason. Candidate `inj:a` is described as moving the secret read, not as a redaction gate.
- **X11.** Opening Trace on the approved child shows "Approved from v1.0", links to the parent, and shows no simulation numbers of its own.
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

### Round 1 (v0.1): DeepSeek PLAN-REJECTED (1), Codex PLAN-REJECTED (3)

See §2.1. Both reviewers reproduced the engine numbers in §3.3.
