# Changes

`index.html` is a clickable demo of the SILEX agentic security platform. Figures are illustrative and every agent is simulated.

Open the page and click **◆ 9/15 changes** in the top bar to list the latest changes, jump to each one, and outline the changed elements.

- **9/15, second pass** (this revision): the decisions from the page-by-page demo review — navigation regrouped, the two validation pages renamed, World Model Coverage moved off Overview. Plan: [`REWRITE_PLAN_0916.md`](REWRITE_PLAN_0916.md).
- **9/15, first pass**: realigned with the V1 PRD (*Web UX / Investor Demo*), following [`PRD_ALIGNMENT_PLAN.md`](PRD_ALIGNMENT_PLAN.md).
- **9/14** (previous): revision after the product demo review; summarized at the end of this file.

---

## 9/15, second pass — from the demo review

### Navigation regrouped

| Group | Items |
| --- | --- |
| **Workspace** | Overview · Agentic Blueprint Studio · Workflow Library |
| **Security** | Incident Queue · Policy Review |
| **Environment** | Security World Model · Workflow Validation · System Validation |

Blueprint Studio and the Workflow Library moved to Workspace: the operational sequence is pre-deploy → deployment → incident → policy review, and neither sits on that line — the library is a horizontal resource, and the studio is a place you go to build. `Security` then narrows to the two reactive screens. Sidebar items: 8 → 7.

### Validation pages renamed

The immediate / short-term / long-term framing was replaced with a distinction that says what each page is for: **long-term is system-wise, short-term is workflow-wise.**

| Before | After | What it is |
| --- | --- | --- |
| Short-Term Validation | **Workflow Validation** | Change-triggered. A workflow changes, it is revalidated. |
| Long-Term Validation | **System Validation** | Periodic. The whole environment and world model. |

- Both keep their own nav item and page.
- **Immediate Validation** loses its card: it has no page of its own and is answered inside each blueprint validation and each incident.
- **The horizon strip is gone** from both pages — it existed only to explain the retired three-tier framing.
- **The automation ladder is gone** (*Manual trigger → Suggested → Automatic*). It described our roadmap, not the flow the user is in. Its wording also came out of the `?` help text.
- **Cadence is enterprise-defined:** a selector (2 weeks / monthly / quarterly, default monthly) replaces the hardcoded *Monthly* pill. The button reads **Run System Validation**.
- **Backtest history stays**, under System Validation.

### Security World Model

- `Security Model` → **Security World Model**, and it is now the first item under Environment.
- **Coverage Gaps** is restated as its own reading — how much of the failure and attack surface the policies in place cover — rather than as the action arising from World Model Coverage. The two compound: if the environment is only partly understood, even full policy coverage leaves an uncovered remainder.

### Overview

- **World Model Coverage is removed**, because it is not actionable: the number does not tell the user what to do, and it now lives on the Security World Model page. Domain Suites takes the full row.

### Not changed, deliberately

- **Ontology layers** stay additive (*Four Tiers Over One Runtime Graph*). Whether the tiers are additive or a product of two dimensions is an open modelling question owned by the co-founder; the page should not move in either direction before that is settled.

### Still open

- Whether a radar chart belongs on Overview. It was wanted there early in the review, and the metric it visualises was cut from Overview later in the same review; the later decision is applied here.
- Who this revision is primarily for. Features were trimmed by asking what a CISO would care about, while two framings were described as being for investors.

---

## 9/15, first pass — aligned with the V1 PRD

> Navigation and the validation page names below were changed again by the second pass above. The rest still describes the page.

### Structure and wording

- **Navigation** follows PRD §5:
  - **Overview**
  - **Workflow Security**: Agentic Blueprint Studio, Incident Queue, Workflow Library, Policy Review
  - **Environment**: Short-Term Validation, Long-Term Validation, Security Model
- **Removed as pages:**
  - *Agentic Control Validation* / *Proving Ground*: validation is now a step inside both flows (§13, §39).
  - *Sim-to-Real*: its definition is TBD (§48); recalibration now appears as a Long-Term Validation activity.
  - *Validation Horizon* as a separate page: its three horizons now head both environment pages.
- **Hidden:** *Integrations* (V2, §42).
- **Terminology** (§39): *Agentic Blueprint Studio*, *Validation*, *Validated Policy Recommendation*, *Residual Reachability* (replaces "residual risk"), *Registered / Deployed*. "Proving Ground" and "Blueprint Check" no longer appear in the UI.
- **Demo honesty** (§43): "Production connected", "Live telemetry" and "Last calibrated" replaced with *Demo environment* and *Simulated agents · illustrative data*.
- **Definitions panel** uses PRD §39 wording; Defense Confidence, Coverage Confidence and Residual Reachability show *Formula TBD* (§48).

### Overview (§36)
- **Enterprise Security Posture:** Critical Open Risks, Defense Confidence, Workflows at Risk, Workflows Needing Revalidation.
- **World Model Coverage** with its largest gap and a link to Coverage Gaps.
- **Domain Suites** (Finance, Customer Service, IT, Procurement, Operations & HR), each linking to Security Model.
- **New:**
  - Workflow Coverage: registered vs known workflows, and deployed.
  - Policy Decisions: validated recommendations awaiting approval.
- Secondary modules (recent material activity, coverage-confidence detail) are collapsed.

### Agentic Blueprint Studio (§7–§22, §49)
- **Lifecycle stepper:** Build → Confirm → Validate → Optimize → Decide → Register, with one active step and a lifecycle status chip (Draft, Confirmed, Validating, Risk identified, Recommendation ready, Ready for approval, Approved, Rejected, Registered).
- **Build:** the natural-language workflow generator and graph editor from 9/14; agents and control points look different.
- **Confirm:**
  - Shows the confirmation statement ("this graph accurately represents the workflow the enterprise intends to deploy"), a checklist and an explicit acknowledgement.
  - Confirming locks v1.0; *Edit as v1.1 draft* creates a revision.
- **Validate:**
  - Visible run steps.
  - Security findings in PRD §14 categories, with taxonomy and ontology basis marked TBD.
  - Reachability per unsafe outcome.
  - Alternative paths A (blocked) / B / C / D (open).
- **Optimize:**
  - Candidates A/B/C, each marked *Validated · 2,400 scenarios*.
  - Residual paths side by side with the recommended control (§19).
  - The §18 recommendation card: current state → intervention → validated state → business impact.
- **Decide:** **Approve / Modify / Reject** (§20).
  - Modify changes the approval threshold and re-runs validation, updating the validated state.
  - Reject returns to the candidates.
  - Approve records the human decision in a confirmation dialog.
- **Register:** preconditions checklist and *Register Workflow*. The workflow lands in the library as **Registered · not deployed** (§22–24).

### Incident Queue and Incident Detail (§28–§29)
- **Queue:**
  - Summary metrics: Open Incidents, Critical Incidents, Affected Workflows, Residual Failures.
  - Filters: Domain, Workflow, Agent, Severity, Status, Type, Time.
  - Search sits next to the list.
- **Detail** follows *Evidence → Alternative Paths → Candidates & Recommendation → Decision*:
  - evidence, existing controls, mechanism and the known failure path;
  - open alternative paths;
  - three validated candidates, path ↔ control side by side, and the recommendation card;
  - Approve / Modify / Reject.
- **Link:** *Affected workflow →* opens Workflow Detail.
- **Removed:** "Send to Agentic Control Validation" and "Approve for shadow". Recommendations are already validated (§3.3, §18); shadow deployment is V2 (§42).
- **Kept:** the causal workflow graph, as a collapsed *Technical detail* section for security engineers.

### Workflow Library and Workflow Detail (§23–§27)
- **Library:**
  - Inventory table with the §25.2 columns: domain, business and security owner, agents, tools, resources, controls, policies, lifecycle, validation, last validation, deployment, risk, coverage confidence. A card view is still available.
  - Metrics for Registered, Deployed, Registered · not deployed, and Needs Revalidation.
  - Domain and deployment-state filters, plus the lifecycle legend (§23).
- **New Workflow Detail page:** header, high-level graph, security posture, activity, and expandable Evidence / Alternative Paths / Control History / Policy History / Validation Runs.
  - *Mark as deployed* appears only for registered, not-yet-deployed workflows.

### Policy Review (§30)
- **Workflow / incident review:** each recommendation keeps its context and opens it for the decision.
- **Executive queue:** the PRD table (Workflow · Recommendation · Impact · Confidence · Status), labelled **V1.5 preview**.
- **Status sync:** decisions made in a blueprint or incident update the matching status here and on Overview.

### Environment (§31–§35)
- **Short-Term Validation:**
  - Change feed (new tool, permission change, agent role change) and the three affected workflows.
  - **Revalidate Affected Workflows** runs visible steps and sets each workflow to *Revalidated* or *Needs Revision*.
  - `?` help text and the *Manual (V1) → Suggested (V2) → Automatic (V3)* ladder.
- **Long-Term Validation:**
  - **Run Environment Validation** with the six PRD steps: recalibrate, update dependencies, generate adversarial scenarios, run attack mutations, test policy resilience, update residual risk.
  - Backtest history, `?` help text and the automation ladder.
- **Security Model** (§38):
  - Tabs: Domain Suites, World Model Coverage, **Coverage Gaps** (new), Security Ontology, Ontology Layers.
  - Ontology and Security World Model presentation marked TBD.
  - Runtime Knowledge Graph, Cross-Domain Risk, Business Harness and Model Health hidden as V2.
- **Removed from the product UI:** the *Diagnosis → treatment* service-plan card (commercial framing).

### Open questions answered with defaults in this revision

| Question from the plan | Default used | Change it by |
| --- | --- | --- |
| Q1: Validation Horizon as one page or two nav items | **Settled in the second pass:** two nav items, renamed Workflow Validation and System Validation; the three-horizon strip removed | — |
| Q2: Diagnosis → treatment card | Removed from the product UI | Restore as a labelled service-plan preview |
| Q3: Executive policy review | Shown as a labelled V1.5 preview | Hide the *Executive queue* switch |
| Q4: Causal graph and `do(control)` notation | Kept as collapsed technical detail in Incident Detail | Remove the *Technical detail* section |

---

## Remaining to-dos

### From the plan, not done yet (P1)
- [ ] **Node types** (§8.2): add human approver, resource, data and action nodes to the Blueprint graph.
- [ ] **Graph editing** (§8.4): inline rename, connect / disconnect edges, *＋ Approval step*, reorder steps.
- [ ] **Configuration panel** (§9–10): type-specific forms for Agent, Control, Business Constraint and Tool / Resource; agent role selector with presets and custom role.
- [ ] **Drafts** (§11): a drafts list to save and reopen blueprints; a visible "Draft — not an enterprise workflow" badge in Build.

### Partly done (P0 follow-ups)
- [ ] **Incident filters** are visual only; search works, the Domain / Workflow / Agent / Severity / Status / Type / Time filters do not filter yet.
- [ ] **Workflow Coverage:** list the 7 known-but-unregistered workflows (currently a count only).
- [ ] **Workflow Detail graph** is static; link it to the editable graph in Agentic Blueprint Studio.
- [ ] **Short-Term Validation** uses a fixed change feed; derive affected workflows from actual changes, such as a workflow just marked as deployed.
- [ ] **Policy Review workflow cards** open context for the decision; consider inline Approve / Reject for operators.
- [ ] **Blueprint Deploy step:** deployment happens from Workflow Detail (*Mark as deployed*); decide whether Blueprint Studio should also offer it after registration.

### PRD TBDs, to stay labelled TBD in the UI (§48)
- [ ] Blueprint Check / validation risk taxonomy
- [ ] Ontology mapping of findings
- [ ] Security World Model architecture and visualization
- [ ] Defense Confidence, Coverage Confidence and Residual Reachability formulas
- [ ] Sim-to-Real Calibration definition
- [ ] When approved policies move to shadow / canary / production

### V1.5 / V2, kept out of this demo (§42)
- [ ] Executive policy approval as a full workflow (currently a preview)
- [ ] Multi-workflow parallel validation
- [ ] Shadow and canary deployment
- [ ] Automatic revalidation and environment-change detection
- [ ] Production telemetry mapping
- [ ] Rich ontology exploration, Runtime Knowledge Graph, Cross-Domain Risk
- [ ] Integration management

### Confirm with the team
- [ ] Keep or change the Q1–Q4 defaults above.

---

## 9/14 — previous revision (summary)

- Navigation regrouped into pre-deployment / post-deployment / environment.
- New Validation Horizon page (immediate, short-term, monthly backtest).
- Blueprint joined the incident flow after the check.
- Paths and control suggestions side by side.
- Run queue with a decision step.
- Two audiences for policy review.
- Overview simplified with collapsed secondary cards.

The PRD alignment above supersedes the navigation grouping, the Proving Ground step, the short-term horizon definition and the "residual risk" wording from that revision. The full 9/14 list is in the git history of this file.

---

## 2026-09-17 — Security World Model observatory (D3)

- **World Model Coverage** is now a zoomable sunburst over Enterprise → Domain → Capability →
  Workflow. The six-dimension radar beside it re-reads at whichever level is in focus, the KPI row
  is generated from the coverage bundle, and the gap list cross-filters to the selected subtree
  (gap actions still jump into the Workflow Library, a workflow or an incident).
- **Security Ontology** is now a four-layer explorer with three renderings of the same data:
  force graph (rings = distance from the group anchor), radial hierarchy, and a group × group
  relation matrix. Search, group filters, and a *colour by* switch (abstraction layer /
  coverage / status) sit in the rail; the inspector shows each node's definition, its real
  public identifier, its coverage and its typed relations.
- **Data**: 591 types and 769 typed relations, distilled at build time from MITRE D3FEND,
  MITRE ATT&CK Enterprise, MITRE ATLAS, UCO and the OWASP LLM / Agentic AI lists. L2 domain
  packs, L3 agentic components, the L4 runtime graph and every percentage remain Silex mock
  content and say so in the inspector. See `swm/data/SOURCES.md`.
- **Weight**: D3 and the ~300KB bundle load only when one of the two panels is first opened,
  so the rest of the demo is unchanged. D3 is vendored, so the demo also runs offline.
- Domain Suites, Coverage Gaps and Ontology Layers panels are untouched.

### 2026-09-17 (later) — the layers are one chain, L1 → L2 → L3 → L4

- **Corrected relationship.** The Ontology Layers tab used to draw L2 and L3 as intersecting lenses
  ("neither is instantiated by the other"). They are a chain: an agentic system is a specialisation
  of the domain it runs in. The data now follows the same rule — each L3 component hangs under the
  domain pack its runtime instances are actually deployed in, with the other domains kept as
  `DEPLOYED_IN` edges, and components used everywhere land in a "Cross-domain & Horizontal" pack
  (the same bucket the horizontal-agents coverage gap talks about).
- **The chain is enforced.** Every node carries an explicit `parent` and the build script fails if a
  parent sits more than one layer above its child. `L1→L2 43 · L2→L3 21 · L3→L4 22` relations cross
  the hops today.
- **Ontology Layers is now a D3 panel**: four bands sized and counted from the bundle, ribbons as
  thick as the relations crossing each hop, group mix per layer, and a side card explaining each hop
  with a real example.
- **Shared abstraction level.** `SWM.setLevel` / `SWM.onLevel` join the Layers tab and the Ontology
  Explorer: pick L3 on either side and the other is already there.
- **Side effect worth noting:** ATLAS techniques and the OWASP catalogues previously had no
  hierarchical parent, so they were unreachable by expanding the graph. They now hang off the
  component they threaten and appear when that component is opened.

### 2026-09-17 (later still) — light theme for the three observatory panels

- The dark observatory canvas made several labels hard to read, so all three panels
  (**World Model Coverage**, **Security Ontology**, **Ontology Layers**) now sit on a white canvas
  that matches the rest of the app.
- Both ordinal ramps were re-validated against `#ffffff` and re-stepped: abstraction layer
  `#86b6ef → #104281`, coverage `#5cc79e → #0e4c3a`. The reserved status palette replaces the
  previous ad-hoc status colours, and status is now a tinted icon beside ink text rather than
  tinted text.
- Text on filled marks (sunburst arcs, matrix cells) picks white or ink by measured contrast and
  carries an opposite-colour halo, so no label sits below 3:1 on its own mark.
- Fixed a rendering bug the light theme exposed: collapsed sunburst arcs and their labels were
  hidden with `fill-opacity`, which leaves the stroke painted — they showed up as a white seam and
  a stack of outlined glyphs at twelve o'clock. Both now use `opacity`.

### 2026-09-17 (final pass) — violet coverage ramp, and the bug that was greying every label

- **The real cause of the unreadable labels:** `.swm-stage text { fill: … }` in the stylesheet was
  overriding the `fill` attribute on every arc, band and matrix label, because a CSS declaration
  beats an SVG presentation attribute. Whatever contrast the code picked, the label was repainted
  muted grey. The fallback is now scoped to `text:not([fill])`.
- **Coverage now uses a violet ramp** (`#b8a3ee → #35206e`) instead of the teal one. Teal's middle
  steps sat where neither black nor white reads well; every violet step leaves at least 5:1 for the
  chosen text colour.
- `SWM.textOn()` picks the higher-contrast option rather than the first one that clears 3:1, and the
  halo was thinned (1.7px) so it stops closing up the counters of 10px glyphs.
- The relation-matrix caption moved into the legend, where it no longer collides with the rotated
  column headers.

### 2026-09-17 (final) — purple across the whole Security World Model

- The **Security Ontology** graph, its hierarchy and relation views, and the **Ontology Layers**
  bands and ribbons now use a violet ramp (`#b8a3ee → #50339c`) instead of blue, so the section
  reads as one purple family.
- **Coverage** moved to a plum ramp (`#dfa0d5 → #54254f`). Layer and coverage are two sequential
  encodings behind the same "colour by" switch, so they are deliberately a hue apart; sharing the
  violet steps would have made the two modes look identical.
- The layer number on each band is now a filled pill in the true layer colour with contrast-picked
  text, so the palest layer never has to carry small text on white.
- Group anchors in the graph are a deeper violet rather than grey.
