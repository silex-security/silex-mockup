# Assurance restructure plan — foreground Verification & Validation (v7 investor register)

**Input:** `SILEX_Investor_Positioning_v7_CN.docx` (the company/investor register) + the real world-model
data already in the repo (`swm/data/ontology.json` — 598 nodes / 800 links / L1–L4; `swm/data/coverage.json`
— KPIs, 8 gaps). **Target:** a restructured `index.html`. **This round: plan + effect mockup for review;
implementation follows approval.**

## 0. The register shift (read first)
The 9/16 pass tuned the demo for the **security buyer** — world model kept *under the hood*. This request
is the opposite emphasis: **lead with Assurance / Agent V&V / the Enterprise World Model**, backed by
ontology data. That is the **investor / technical-buyer register** (v7). Both are legitimate; they are
different audiences. Recommendation: make **Assurance the primary framing** and keep the operator screens
(Incident, Policy) as the *evidence underneath it*, so the site reads top-down as
**Assurance → V&V → World Model → operational evidence**.

> Guardrails still hold: *assurance, not certification*; declared/latent/observed always labelled; no "safe"
> verdict; failure closure ≠ blocking one path; ranked alternatives; the autonomy flywheel is a value-unlock.

## 1. New information architecture (tabs + priority)

| Now (operator-first) | → | Proposed (assurance-first) |
|---|---|---|
| Workspace › Overview | → | **Assurance** — Continuous Production Assurance dashboard (the new home) |
| — | → | **Verification** — did execution conform to design? (outcome + control side) |
| Environment › Validation (Workflow/System) | → | **Validation** — is the spec still correct, and is the failure *closed*? |
| Environment › World Model | → | **Enterprise World Model** — L1–L4 ontology + runtime graph + coverage + gaps (data-driven) |
| Security › Incident Queue / Policy Review | → | **Evidence** (grouped) — incidents, PCPs, the One-Blocked-Attack exhibit, as the runtime evidence under V&V |
| Workspace › Blueprint Studio | → | **Design-time** — Blueprint Check (declared-grade), folded under Verification |

**Priority order (nav):** Assurance · Verification · Validation · Enterprise World Model · Evidence · Design-time.
The operator flows are unchanged internally — they move *under* the V&V framing rather than being deleted.

## 2. The organizing exhibit — the Agent V&V matrix
Straight from the doc: Verification asks *does execution conform to spec*; Validation asks *is the spec still
correct under reality*. Each on two sides. This 2×2 is the spine of the new Assurance page:

| | **Verification** (conforms to spec) | **Validation** (spec still correct) |
|---|---|---|
| **Outcome side** | Actual state == expected state · *N trajectories replayed, deviations flagged* | Expected state still correct under current reality · *workflows invalidated by env change* |
| **Control side** | Policy enforced as specified · *controls active* | **Failure Closure** — does the control prevent the prohibited outcome, or only block one path? · *latent alternative paths still open* |

The **One-Blocked-Attack** scenario becomes the concrete Validation·Control (Failure-Closure) exhibit, with
declared/latent/observed grades.

## 3. Data mapping — what feeds what (all real, from the repo)

| Section | Data source | Concrete figures |
|---|---|---|
| Assurance KPIs | `coverage.json.kpis` | Weighted coverage **82%** (+4 pts) · Entities understood **29.4K** (598 types) · Known blind spots **8** (2 critical) · Last calibration **6h** (sim-vs-observed **94%**, drift 1.2%) |
| World Model layer stack | `ontology.json.layers` | L1 general **370** nodes (74%) · L2 domain **86** (78%) · L3 agentic-system **118** (60%) · L4 runtime **24** (81%) |
| Standards provenance | `ontology.json.stats` | D3FEND 213 · ATT&CK 61 · ATLAS 96 · UCO 72 · OWASP 25 |
| Ontology structure | `ontology.json.links` | SUBCLASS_OF 274 · ACHIEVES 126 · THREATENS 105 · SPECIALIZES 85 … (the type→instance grounding) |
| Failure Closure targets | ontology prohibited outcomes | 5: Unrecoverable Payout · PII Disclosure to Wrong Party · Standing Privilege · Unauthorised Pay Change · Unverified Bank Change |
| Coverage gaps | `coverage.json.gaps` | 8 gaps incl. 2 critical (Procurement vendor data not connected; Long-term memory unmodelled) |
| World-model fit | `coverage.json.kpis[calib]` | Simulation-vs-observed agreement **94%** — the falsifiability number |

The site already loads this data (`swm/js/swm-loader.js`); the new Assurance/V&V panels bind to the same JSON,
so nothing new needs generating.

## 4. The autonomy flywheel (the "effect" of assurance)
The doc's value-unlock argument, made visual: **Assurance → Authority → Production Actions → Runtime Evidence
→ better World Model → stronger Validation → more Assurance**, with the headline *"raises the autonomy ceiling."*
Shown as a ring on the Assurance page, with a concrete before/after (e.g. a workflow's approval threshold
moved from human to agent once its failure closure was validated).

## 5. Deliverables & sequence
1. **This plan** (`docs/ASSURANCE_RESTRUCTURE_PLAN.md`).
2. **Effect mockup** — a published Artifact showing the proposed Assurance landing + V&V matrix + World Model
   panel + flywheel, rendered with the real figures above, for review. *(No change to `index.html` yet.)*
3. On approval — implement in `index.html`: new nav order, the Assurance home, the V&V matrix, the
   data-bound World Model panel; move Incident/Policy under "Evidence."

## 6. Open questions for you
- **Dual-register or full switch?** Make Assurance the whole site's frame (investor/technical), or keep a
  security-buyer mode and add Assurance as the lead view? (Affects how much of the operator copy changes.)
- **Depth of the World Model view** — the full 598-node graph is heavy; propose a layer-stack + coverage
  summary as the default, with the full graph one click deeper.
- Working names (Blueprint Check / Proving Ground) and D1 (is "Security World Model" buyer-facing) still apply.
