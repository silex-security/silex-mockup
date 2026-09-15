# SILEX Mockup — PRD Alignment Plan

**Compares:** the 9/14 mockup ([silex-mockup.vercel.app](https://silex-mockup.vercel.app/), `silex-security/silex-mockup` @ `9381c2a`) and its `CHANGES.md`
**Against:** *SILEX Agentic Security Platform — Product Requirements Document (Web UX / Investor Demo), V1, September 2026*
**Date:** 2026-09-15
**Status:** Proposal for review. Nothing here has been implemented yet.

---

## 1. Summary

The 9/14 mockup already follows several of the PRD's core ideas:
- a pre-deployment entry and a post-deployment entry into one downstream flow;
- agents drawn differently from controls;
- alternative paths side by side with the recommended control;
- two audiences for policy review;
- a Validation Horizon;
- a collapsible Overview.

It diverges from the PRD in four structural ways:

1. **The lifecycle backbone is missing.** The PRD organizes the whole UX around *Build → Confirm → Validate → Optimize → Decide → Register → Deploy → Monitor → Revalidate → Recalibrate* (§49). The mockup's Blueprint flow is *Builder → Blueprint Check → Proving Ground → Control & Policy Review → Decision*. That flow merges Confirm with Validate and Approve with Register, and it never shows Deploy, so *Registered* and *Deployed* are not distinct (§22–24).
2. **Validation is a separate place instead of a step.** The mockup has a standalone *Agentic Control Validation (Proving Ground)* page that both flows jump to.
   - The PRD says the user-facing concept is simply **Validation**, and that *Proving Ground* is not a V1 term (§13, §39).
   - It says a surfaced recommendation is **already validated** (§3.3, §18), so the user should not be sent to run it again.
3. **Policy recommendations lack the PRD's evidence card.** The PRD's recommendation shows *current state → intervention → validated state → business impact*, generated from **candidates A/B/C** that were each simulated (§16–18). Decisions are **Approve / Modify / Reject** (§20). The mockup has two causal candidates, before/after tables with different metrics, and only an "Approve for shadow" action. Shadow deployment is V2 and TBD in the PRD (§42, §48).
4. **Environment means something different.** The PRD defines two things:
   - **Short-Term Validation**: change-triggered, with a visible manual *Revalidate Affected Workflows* action.
   - **Long-Term Validation**: monthly environment validation with visible progress.
   
   Both come with help annotations (§33–34). The mockup's Validation Horizon instead defines short-term as shadow/canary telemetry, adds a commercial *Diagnosis → treatment* card, and keeps a separate *Sim-to-Real* page for a concept the PRD lists as TBD (§48).

In addition, the mockup shows many metrics the PRD does not use, and it presents several open technical questions as settled facts. Examples: sim-to-real 94%, scenario diversity, grounding %, 18.4K entities, "142 types", ontology L1–L4. The PRD asks for a small metric set (§45) and wants those questions left as explicit TBDs "rather than being invented in the UX" (§48). It also shows live-production signals ("Production connected", "Live telemetry") that contradict the demo's non-goals (§43).

**Recommendation:** treat the PRD as the source of truth and build a **9/15 revision** on top of the 9/14 page with the same skill. Do P0 first (section 6); it is exactly what the PRD's 11-step demo story (§46) needs.

---

## 2. What already matches the PRD — keep

| PRD | Mockup today |
| --- | --- |
| §1, §6: pre- and post-deployment are two entry points into one engine | Blueprint step 3 onward is labelled "same as post-deployment"; incident flow bar |
| §8.1: natural-language workflow generation | Blueprint prompt box with the refund example, *Generate / Update* |
| §8.3: agents ≠ controls, visually | Control points use a dashed border, a ◆ marker and amber, plus a legend |
| §8.4 (partial): add agent, add control, delete node | *＋ Agent*, *＋ Control*, *Remove selected node*, drag, auto-layout |
| §11–12 (partial): draft state; confirmed version immutable, edits create a revision | *Save draft*; *Edit as v1.1 draft* after confirmation |
| §12: stepper shows exactly one current step | Fixed on 9/14 (done steps no longer look active) |
| §19: alternative path side by side with recommended control | Incident → *Control & Policy Review* side-by-side panel |
| §28: search close to the incident list; filters | Filter row moved next to the cards |
| §30.1 / §30.2: operator review vs high-authority queue | *In-incident review* / *Overall approval · CISO* switch |
| §32: Validation Horizon concept | *Validation Horizon* page |
| §36: collapsible secondary modules; World Model Coverage; Domain Suites on Overview | Four collapsed cards; World model coverage metric; domain suites list |
| §43: simulated agents acceptable | "Simulated agents · demo" pill; simulated blueprint workflow card |

---

## 3. Where the 9/14 changes conflict with the PRD — follow the PRD

| 9/14 decision (CHANGES.md) | PRD position | Action |
| --- | --- | --- |
| Navigation: *Pre-deployment / Post-deployment / Environment* | §5: **Overview / Workflow Security / Environment**; Workflow Security holds Blueprint Studio, Incident Queue, **Workflow Library**, Policy Review | Regroup (P0-1) |
| *Agentic Control Validation* as its own page; *Proving Ground* as a Blueprint step | §13, §39: user-facing term is **Validation**; Proving Ground not a V1 term | Fold validation into both flows; remove the nav item (P0-1, P0-3) |
| Incident flow: *…→ Agentic Control Validation → Approve for Shadow*; "Send to Agentic Control Validation" button | §3.3, §18: recommendations are already validated; §20: Approve / Modify / Reject; §42, §48: shadow is V2 / TBD | Replace with Approve / Modify (re-runs validation) / Reject (P0-5) |
| Blueprint *Decision → Workflow Library* (approve = register) | §20–22: approval and **Register Workflow** are separate decisions; §24: Registered ≠ Deployed | Split Decide and Register; add Deploy status (P0-3, P0-6) |
| Validation Horizon: short-term = shadow / canary / telemetry; medium + long merged into monthly backtest | §33: short-term = **change-triggered revalidation**, manual trigger; §34: long-term = monthly environment validation | Redefine short-term; keep monthly long-term (P0-7) |
| *Diagnosis → treatment* service-plan card | Not in PRD UX; §47 narrative is product-level | Move out of the product UI (investor deck); see question Q2 |
| Separate *Sim-to-Real* page | §48: sim-to-real definition is TBD; §45 metric set excludes it | Remove as a nav page; fold recalibration into Long-Term Validation (P0-1) |
| *Security Landscape* with 8 tabs (Runtime KG, Cross-Domain Risk, Business Harness, Model Health…) | §38: **Security Model** = Ontology, World Model, World Model Coverage, Coverage Gaps, all TBD; §42: rich ontology exploration and cross-domain risk are V2 | Rename; keep 4 surfaces; mark TBD; hide V2 tabs (P1-6) |
| Overview metric "Residual risk" | §39: "Residual risk is too broad"; use **Residual Reachability** | Rename everywhere (P0-9) |
| Run queue showing "2 running in parallel" | §42: multi-workflow parallel validation is V2 | Show one run at a time; parallel as V2 note (P2) |
| "Overall approval · CISO" shipped as a working view | §30.2 describes it, but §42 lists *CISO aggregate policy approval* as V1.5/V2 | Keep as a V1.5 preview, reshaped to the PRD table (P1-5); see Q3 |

---

## 4. Gap analysis by PRD area

Priority: **P0** = required for V1 / the §46 demo story · **P1** = V1 polish · **P2** = V1.5/V2, hide or label.

### 4.1 Information architecture and terminology

| PRD § | Requirement | Mockup today | Gap → action | Pri |
| --- | --- | --- | --- | --- |
| §5 | Overview / Workflow Security / Environment | Workspace / Pre-deployment / Post-deployment / Environment; Library under Environment | Regroup nav; Library moves under Workflow Security | P0 |
| §5 | Environment = Short-Term Validation, Long-Term Validation, Security Model | Validation Horizon, Sim-to-Real, Workflow Library, Security Landscape, Integrations | Two validation pages (or one page with two sections) + Security Model; drop Sim-to-Real; Integrations → V2 | P0 |
| §39 | Terms: *Agentic Blueprint (Studio)*, *Validation*, *Residual Reachability*, *Validated Policy Recommendation*, *Registered / Deployed Workflow* | "Agent Blueprint Studio", "Blueprint Check", "Proving Ground", "Agentic Control Validation", "Residual risk", "Candidate", "do(candidate control)" | Rename user-facing labels; keep causal notation only inside operator detail | P0 |
| §44 | No dead ends; every screen has a next action | Integrations nav button does nothing; Library "Open workflow" jumps into an incident; Sim-to-Real has no action | Give every page a next action; hide Integrations (V2) | P0 |
| §43 | Demo does not claim live production | Top bar "Live telemetry", "Last calibrated 12m ago"; sidebar "Production connected"; "Continuously learning" | Replace with demo-environment indicators | P0 |

### 4.2 Agentic Blueprint Studio (§7–§22)

| PRD § | Requirement | Mockup today | Gap → action | Pri |
| --- | --- | --- | --- | --- |
| §49, §12 | Stepper: **Build → Confirm → Validate → Optimize → Decide → Register** | Builder → Check → Proving Ground → Control & Policy Review → Decision | Rename and re-sequence steps; Confirm is its own step | P0 |
| §12 | *Confirm Blueprint* = "this graph is what we intend to deploy"; then validation | One button "Confirm v1.0 & Run Blueprint Check" | Separate **Confirm Blueprint** (shows the confirmation statement, locks v1.0) from **Validate Blueprint** | P0 |
| §13–14 | Baseline simulation: security findings in PRD categories + reachability | "Declared Coverage Map", 3 findings with ontology L1–L3 basis and domain baseline codes | Findings list using §14 categories (Unsafe Outcome, Missing Approval, Excessive Authority, Cross-Agent Risk, Tool Misuse, Data Exposure, Policy Gap, Workflow Logic Risk, Exposed Privilege); reachability per unsafe outcome; ontology basis shown as "TBD" | P0 |
| §15 | Alternative path exploration: Path A blocked / B open / C open → "is the unsafe outcome still reachable?" | Blueprint has one declared path; alternative paths only in the incident flow | Add alternative-path view inside the Blueprint Validate step | P0 |
| §16–17 | Candidates A/B/C, each simulated against baseline | Blueprint sends to the shared validation page; no candidates in the blueprint flow | **Optimize** step: three refund candidates (approval > $500; dual approval > $1,000; verified merchants only), each marked "validated", compared with baseline | P0 |
| §18 | Recommendation card: Current state (Defense Confidence, Residual Reachability, Critical Paths Open) → Intervention → Validated state → Business impact | Before/after tables with other metrics | Build the §18 card; reuse in incident flow | P0 |
| §19 | Side-by-side path ↔ control | Only in incident flow | Reuse in Blueprint Optimize step | P0 |
| §20 | Approve / Modify / Reject | Approve only | Add Modify (edit parameters → re-run validation, with progress) and Reject (return to alternatives) | P0 |
| §21 | Result states | Mixed ad-hoc statuses | Status chip set: Validation Running, Risk Identified, Candidate Testing, Recommendation Ready, Ready for Approval, Approved, Rejected, Needs Revision | P1 |
| §22 | **Register Workflow** after confirm + validate + approve | "Approve → add to Workflow Library" | Separate *Register Workflow* action with its preconditions listed | P0 |
| §8.2 | Node types: external actor, agent, human approver, tool, resource, data, action, control, decision, outcome | Trigger, agent role, decision, control point, tool/MCP, outcome, prohibited outcome | Add human approver, resource, data, action; keep prohibited outcome as an outcome subtype | P1 |
| §8.4 | Rename, connect / disconnect, change relationships, add approval step, reorder, modify business logic | Add, remove, drag, auto-layout | Add inline rename, edge connect/disconnect handles, *＋ Approval step*, reorder | P1 |
| §9 | Type-specific configuration panel | One generic inspector (role, implementation candidate, permission scope, credential) | Per-type forms: Agent (10 fields), Control (6), Business Constraint, Tool/Resource (5) | P1 |
| §10 | Agent role selector: preset + custom | Implementation-candidate select | Role dropdown with PRD presets + "Custom role…" | P1 |
| §11 | Drafts can be saved and reopened; drafts are not real workflows | Save draft toast only | "Drafts" list (reopen), visible *Draft — not an enterprise workflow* badge | P1 |

### 4.3 Workflow Library and Workflow Detail (§23–§27)

| PRD § | Requirement | Mockup today | Gap → action | Pri |
| --- | --- | --- | --- | --- |
| §23, §40 | Lifecycle: Draft → Confirmed → Validating → Ready for Approval → Approved → Registered → Deployed → Needs Revalidation (+ Archived / Disabled / Deprecated) | Statuses: Critical evidence, Review, Validating, Monitoring, Re-validated, Drift, Simulated | Show lifecycle status on every workflow; lifecycle legend | P0 |
| §24 | Registered ≠ Deployed | Not represented | Separate *Deployment status* (Pre-production / Deployed); the new blueprint workflow appears as **Registered · not deployed** with a *Mark as deployed* action | P0 |
| §25.2 | Inventory fields: domain, business owner, security owner, agents, tools, resources, permissions, controls, policies, status, validation status, last validation, deployment status, risk level, coverage confidence | Cards show agents / tools / incidents | Add a table view with these columns (cards stay as the default) | P0 |
| §25.3 | Domain organization (Finance, Customer Service, IT…) | "All domains" button only | Group or filter by domain using the PRD examples | P1 |
| §27 | Workflow Detail: header, graph, security posture, activity, expandable detail | No workflow page; "Open workflow" opens an incident | New **Workflow Detail** page; incident links move under Activity / Detail | P0 |
| §26 | Library evolves into the enterprise representation feeding the World Model | Not expressed | One-line explanation + link to Security Model | P1 |

### 4.4 Incidents and Policy Review (§28–§30)

| PRD § | Requirement | Mockup today | Gap → action | Pri |
| --- | --- | --- | --- | --- |
| §28 | Summary: Open Incidents, Critical Incidents, Affected Workflows, Residual Failures | Active incidents, Critical evidence, Mechanisms under review, Awaiting approval | Replace the four metrics | P0 |
| §28 | Filters: Domain, Workflow, Agent, Severity, Status, Incident Type, Time | Use case, Agent type, Priority, Stage, Last 30 days | Replace filter set | P0 |
| §29 | Detail sections: Evidence, Affected Workflow, Known Path, Alternative Paths, Existing Controls, Candidate Interventions, Validated Recommendation, Human Decision | Tabs: Evidence, Causal Workflow, Alternative Paths, Control & Policy Review; flow bar ends in validation → shadow | Restructure to the eight sections; flow bar = Evidence → Paths → Candidates → Recommendation → Decision; add Affected Workflow link to Workflow Detail | P0 |
| §3.3, §18 | No manual re-validation of a surfaced recommendation | "Send to Agentic Control Validation →" | Remove; the recommendation card states it was validated (runs, date) | P0 |
| §30.1 | Workflow / incident-level review keeps context (incident, workflow, path, control, validation result) | Present | Add the §18 card; Approve / Modify / Reject | P0 |
| §30.2 | Executive queue table: Workflow · Recommendation · Impact · Confidence · Status | Domain cards | Reshape into the PRD table; label V1.5 preview | P1 |

### 4.5 Environment (§31–§35) and Security Model (§38)

| PRD § | Requirement | Mockup today | Gap → action | Pri |
| --- | --- | --- | --- | --- |
| §31–32 | Why environment exists: validity decays as the enterprise changes; Immediate / Short-Term / Long-Term | Horizon cards: Immediate / Short-term (shadow) / Backtest monthly | Keep the three-horizon framing; rewrite per §32 questions | P0 |
| §33 | Short-Term: triggers list; "Environment Change Detected · 3 workflows may be affected"; **Revalidate Affected Workflows**; `?` help text; Manual → Suggested → Automatic | Not present | New Short-Term Validation view with change feed, affected workflows, manual button, progress, result (Revalidated / Needs Revision) | P0 |
| §34 | Long-Term: **Run Environment Validation** with six visible progress steps; `?` help text | Backtest history, schedule button, service-plan card | Add the run button and the six-step progress; keep backtest history; move service-plan card out (Q2) | P0 |
| §35 | V1 manual → V2 suggested → V3 automatic | Not shown | Small "Manual in V1" indicator next to both triggers | P1 |
| §38 | Security Model: Ontology, World Model, World Model Coverage, Coverage Gaps; layers TBD | Security Landscape: 8 tabs, L1–L4 architecture, 142 types, radar chart | Rename; four sections; **Coverage Gaps** as the actionable one; label ontology layers and World Model as TBD; hide Runtime KG, Cross-Domain Risk, Business Harness, Model Health (V2) | P1 |
| §37 | Domain Suites: Enterprise → domain → agents / workflows / controls; horizontal agents deferred | Domain suites with capabilities and runtime scope | Match the tree; note horizontal agents as later | P1 |

### 4.6 Overview and metrics (§36, §45, §48)

| PRD § | Requirement | Mockup today | Gap → action | Pri |
| --- | --- | --- | --- | --- |
| §36 | Enterprise Security Posture: Critical Open Risks, Defense Confidence, Workflows at Risk, Workflows Needing Revalidation | Defense confidence, World model coverage, Open failures, Residual risk | Replace the metric row | P0 |
| §36 | World Model Coverage; Domain Suites; **Workflow Coverage** (registered vs known); **Policy Decisions** (pending approvals) | First two present | Add Workflow Coverage and Policy Decisions modules | P0 |
| §45 | Limited metric set: Defense Confidence, Residual Reachability, Path Coverage, Workflow Coverage, World Model Coverage, Revalidation Status | Also: sim-to-real calibration, scenario diversity, environment coverage, grounding %, telemetry freshness, knowledge-graph size, drift, APE mutation rates | Keep the six on primary surfaces; move or remove the rest | P0 |
| §48 | Formulas (Defense Confidence, Coverage Confidence, Residual Reachability), Blueprint Check taxonomy, ontology mapping, World Model, sim-to-real, shadow timing stay explicit TBDs | Definitions panel presents drafts as definitions; L1–L4 and codes shown as fact | Definitions panel uses **PRD §39 wording**; each formula shows "Formula: TBD"; ontology basis and shadow timing labelled TBD | P0 |

---

## 5. CHANGES.md to-dos after the PRD

| 9/14 to-do | Status under the PRD |
| --- | --- |
| Must every control pass validation before shadow? | **Resolved in part.** A surfaced recommendation is already validated (§3.3, §18). *When* approved policies move to shadow / canary / production stays TBD (§48) and is V2 (§42). |
| Final module grouping; where Validation Horizon sits | **Resolved.** Overview / Workflow Security / Environment (§5); Validation Horizon = Short-Term + Long-Term under Environment (§32–34). |
| Domain suites on Overview? | **Resolved: yes** (§36). |
| Where horizontal agents sit | **Deferred** to later versions (§37). |
| Is "Blueprint" an industry term / rename? | **Resolved:** keep *Agentic Blueprint* / *Agentic Blueprint Studio* (§39). |
| Verify metric definitions | **Resolved for definitions** (§39); **formulas remain TBD** (§45, §48). |
| Blueprint Check items and ontology L1–L4 mapping | **Categories given** (§14); **taxonomy and mapping remain TBD** (§48). |
| Ontology and Security World Model presentation | **Still open** (§38, §48). |
| Replace illustrative numbers with real results | **Not required for the demo** (§43); keep numbers labelled illustrative. |
| CISO aggregate approval view | **V1.5 / V2** (§42). |
| Runtime KG, Cross-Domain Risk, Integrations | **V2** (§42). |
| Parallel runs with live status | **V2** (§42: multi-workflow parallel validation). |
| Real agents | **Non-goal** for the demo (§43). |

---

## 6. Improvement plan

Effort: **S** ≈ under half a day · **M** ≈ one day · **L** ≈ two days or more (single-file mockup, illustrative data).

### P0: make the §46 demo story work end to end

| # | Work item | PRD | Effort |
| --- | --- | --- | --- |
| P0-1 | **Restructure navigation**: Overview · Workflow Security (Agentic Blueprint Studio, Incident Queue, Workflow Library, Policy Review) · Environment (Short-Term Validation, Long-Term Validation, Security Model). Remove the *Agentic Control Validation* and *Sim-to-Real* nav items and hide *Integrations* (V2). Their useful content moves into the flows below. | §5, §39 | M |
| P0-2 | **Terminology pass**: Agentic Blueprint Studio; Validation; Validated Policy Recommendation; Residual Reachability; Registered / Deployed. Retire *Proving Ground*, *Blueprint Check*, *Residual risk* from user-facing text. Definitions panel uses §39 wording with "Formula: TBD". | §39, §45, §48 | S |
| P0-3 | **Blueprint lifecycle stepper**: Build → Confirm → Validate → Optimize → Decide → Register. Separate *Confirm Blueprint* (confirmation statement, version locked) from validation. | §12, §49 | M |
| P0-4 | **Validate step inside Blueprint Studio**: baseline simulation progress; findings in §14 categories; reachability per unsafe outcome; alternative-path view (A blocked / B open / C open). | §13–15 | L |
| P0-5 | **Optimize + Decide**: candidates A/B/C each marked validated; the §18 recommendation card (current → intervention → validated → business impact); path ↔ control side by side; **Approve / Modify / Reject**, where Modify re-runs validation with visible progress. Reuse the same card and actions in the incident flow and Policy Review, and remove "Send to Agentic Control Validation" and "Approve for shadow". | §16–20, §29, §30.1 | L |
| P0-6 | **Register and deploy states**: *Register Workflow* after approval; the new workflow appears in the Library as **Registered · not deployed** with *Mark as deployed*; lifecycle status and deployment status everywhere. | §22–24, §40 | M |
| P0-7 | **Workflow Library + Workflow Detail**: inventory table view with §25.2 columns; new Workflow Detail page (header, graph, security posture, activity, expandable detail). "Open workflow" goes here, not to an incident. | §25, §27 | L |
| P0-8 | **Incident Queue and Incident Detail realignment**: §28 summary metrics and filters; §29 eight sections; flow bar Evidence → Paths → Candidates → Recommendation → Decision; link to the affected workflow. | §28–29 | M |
| P0-9 | **Environment**: Short-Term Validation (change feed, "3 workflows may be affected", *Revalidate Affected Workflows*, progress, result, `?` help) and Long-Term Validation (*Run Environment Validation*, six visible steps, backtest history, `?` help). Immediate / Short / Long framing on top. | §31–34 | L |
| P0-10 | **Overview realignment**: Enterprise Security Posture metrics (Critical Open Risks, Defense Confidence, Workflows at Risk, Workflows Needing Revalidation); World Model Coverage; Domain Suites; add Workflow Coverage and Policy Decisions; secondary modules collapsed. | §36, §45 | M |
| P0-11 | **Demo honesty**: replace "Production connected", "Live telemetry", "Last calibrated 12m ago", "Continuously learning" with demo-environment indicators; keep "illustrative" labels. | §43 | S |
| P0-12 | **No dead ends**: every page ends in a next action matching §44's continuity chain (Confirm → Validate → Review → Approve → Register → Deploy). | §44 | S |

### P1: V1 polish

| # | Work item | PRD | Effort |
| --- | --- | --- | --- |
| P1-1 | Node types: add human approver, resource, data, action. | §8.2 | M |
| P1-2 | Editing: inline rename, connect / disconnect edges, *＋ Approval step*, reorder steps. | §8.4 | L |
| P1-3 | Type-specific configuration panel (Agent, Control, Business Constraint, Tool / Resource) and agent role selector (presets + custom). | §9–10 | M |
| P1-4 | Drafts list (save / reopen) and a visible "Draft — not an enterprise workflow" badge; §21 result-state chips. | §11, §21 | S |
| P1-5 | Executive policy queue as the §30.2 table, labelled *V1.5 preview*. | §30.2, §42 | S |
| P1-6 | **Security Model** page: Ontology, Security World Model, World Model Coverage, **Coverage Gaps**. Ontology layers and World Model marked TBD. | §38, §48 | M |
| P1-7 | Domain Suites tree (domain → agents / workflows / controls); horizontal agents noted as later. | §37 | S |
| P1-8 | "Manual in V1 → Suggested → Automatic" indicators on both environment triggers. | §35 | S |

### P2: V1.5 / V2, keep out of the V1 demo or show only as labelled previews

CISO aggregate approval as a full workflow · multi-workflow parallel validation · shadow / canary deployment · automatic revalidation and environment-change detection · production telemetry mapping · rich ontology exploration, Runtime Knowledge Graph, Cross-Domain Risk, Business Harness, Model Health · integration management · fully automated policy optimization (§42).

**Suggested order:**
1. P0-1, P0-2, P0-11: structure and words.
2. P0-3 to P0-6: the Blueprint happy path, which is the core of §46 steps 1–9.
3. P0-7, P0-8: Library and incidents.
4. P0-9, P0-10, P0-12: Environment and Overview, which are §46 steps 10–11.
5. P1.

---

## 7. Keep the PRD's TBDs visible, not invented

Per §48, the UI should label these as open rather than show made-up precision:

| TBD | How to show it |
| --- | --- |
| Blueprint Check taxonomy | Show §14 categories; small "taxonomy TBD" note |
| Ontology mapping | Findings show "Ontology basis: TBD" instead of L1/L2/L3 codes |
| Security World Model | Security Model page section marked "architecture and visualization TBD" |
| Defense Confidence / Coverage Confidence / Residual Reachability formulas | Values remain illustrative; definitions panel shows "Formula: TBD" |
| Sim-to-Real Calibration | No standalone page or headline metric; mentioned only as a Long-Term Validation activity |
| Shadow deployment timing | No "Approve for shadow"; Deploy step notes "shadow / canary: V2" |

---

## 8. How to implement

1. **Build a 9/15 revision** with the `meeting-to-mockup` skill (`silex_project/Skills/meeting-to-mockup/`):
   - start from the current `index.html` as the reference page;
   - write `build_0915.py` with asserted edits;
   - keep `class="chg"` markers so the in-page change panel lists 9/15 changes separately from 9/14.
2. **Replace the click-test steps** with the §46 story as 11 scripted steps:
   - describe → generate → confirm → validate → alternative paths → candidates → recommendation (validated) → approve → register → deploy → short-term revalidation → long-term validation;
   - add Modify / Reject branches and every nav item.
   
   Acceptance means 0 FAIL and 0 JS errors.
3. **Screenshots with highlights on** for Overview, Blueprint (each step), Workflow Detail, Incident Detail, Short-Term and Long-Term Validation; review before publishing.
4. **Update `CHANGES.md`** with a 9/15 section and move resolved to-dos using section 5 of this plan.
   - silex-mockup is public: keep teammate names and internal paths out.
   - Don't paste PRD text beyond UI labels.
5. **Deploy** by pushing to `main` (Vercel auto-deploys to silex-mockup.vercel.app). Consider protecting `main` first, since org members can push directly.

---

## 9. Acceptance: PRD §46 demo success criteria

| # | Viewer should understand | Where it is shown after this plan |
| --- | --- | --- |
| 1 | "I can describe an agentic workflow in English." | Blueprint Studio · Build (prompt) |
| 2 | "SILEX turns it into an editable workflow." | Build graph with typed nodes and editing (P0-3, P1-1, P1-2) |
| 3 | "I confirm that this represents what I intend to deploy." | Confirm step with confirmation statement (P0-3) |
| 4 | "SILEX simulates what could go wrong." | Validate · baseline findings and reachability (P0-4) |
| 5 | "It finds alternative ways the same failure could still happen." | Validate · alternative paths A/B/C (P0-4) |
| 6 | "It recommends policy changes." | Optimize · candidates (P0-5) |
| 7 | "Those recommendations have already been validated in simulation." | Recommendation card with validated state (P0-5) |
| 8 | "I approve the change." | Decide · Approve / Modify / Reject (P0-5) |
| 9 | "The workflow becomes part of my enterprise workflow inventory." | Register → Workflow Library, Registered · not deployed (P0-6, P0-7) |
| 10 | "After deployment, SILEX keeps validating it as my enterprise changes." | Mark as deployed → Short-Term Validation revalidation (P0-6, P0-9) |
| 11 | "Over time, SILEX increasingly understands my entire agentic operating environment." | Long-Term Validation, World Model Coverage, Security Model (P0-9, P0-10, P1-6) |

---

## 10. Questions to confirm before building

- **Q1. Validation Horizon label.** The PRD's nav lists *Short-Term Validation* and *Long-Term Validation* directly under Environment, but also names the umbrella concept *Validation Horizon* (§32). Should it be one page with two sections, or two nav items?
- **Q2. Diagnosis → treatment card.** It is a commercial framing that the PRD does not put in the product UI. Should it be removed from the mockup and kept for the investor deck, or kept as a clearly labelled "service plan" preview?
- **Q3. Executive policy review.** §4.4 and §30.2 describe it; §42 lists it as V1.5/V2. Should the demo show it as a labelled preview (this plan's default) or hide it?
- **Q4. Operator-level causal detail.** The mockup's causal graph, `do(control)` notation and counterfactual modes are not in the PRD. Should they stay inside Incident Detail as an expandable "technical detail", or be removed for V1?
