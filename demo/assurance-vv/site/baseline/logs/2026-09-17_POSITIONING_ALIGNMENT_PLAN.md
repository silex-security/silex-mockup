# Positioning alignment plan — aligning the demo with the September 2026 narrative

**Input:** Silex AI Investor Positioning **v7** (company register) + the September 2026 security
update (*continuous policy coverage and optimization*) + Product Form Spec **v0.11**.
**Target:** `index.html` (the security product demo).
**Scope:** this is a **messaging/IA alignment** pass, not a UX-flow pass (that was `REWRITE_PLAN_0916.md`).

> Every change below traces to the `silex-positioning` and `silex-product` skills. Where a change
> touches an **open decision**, its D-number is called out — those need advisor sign-off, not a build.

---

## 0. The framing decision that gates everything

**This demo is in the SECURITY-BUYER register.** It is a product UI a CISO / AppSec operator drives,
not an investor deck. Two consequences from the positioning skill:

- **Lead with attack paths, coverage, and policy options.** Keep **"Enterprise World Model,"
  "Agentic AI infrastructure," "Agent V&V," the Correspondence Problem, and Phase-2 expansion OUT
  of the operator's main flow.** (The site is already clean here: 0 uses of "V&V,"
  "correspondence," "Agentic AI infrastructure" — keep it that way.)
- **The one exception is the World Model Explorer.** Product Spec §3 makes the World Model Explorer
  the *one native surface* — so keeping a **World Model** view is correct. But frame it as the
  Explorer / counterfactual studio (the demo surface), **not** as where daily work happens, and do
  not make the operator *enter* through it.

**⚠️ D1 is open** — whether "Security World Model" is buyer-facing at all. The site currently says
"world model" 14× and "ontology" 18× in operator-facing copy. **Confirm D1 with the advisor before
finalizing:** recommendation is two registers (SWM for the Explorer/architecture view; Coverage Map
+ PCP everywhere else). Until then, treat prominent SWM/ontology copy outside the Explorer as
provisional.

---

## 1. Two confirmed content gaps (P0 — these are load-bearing claims currently missing)

### 1.1 The **latent** evidence grade is absent
The site uses **observed** (12×) and **declared** (3×) but **"latent" appears 0 times.** Latent is
**the differentiated half** of the whole thesis (both skills): a path asserted possible *by type over
real deployed instances*, with no trace behind it — "the route nobody has walked is the route nobody
has tested." Without it, the demo looks like any graph product.

**Fix:** wherever paths/coverage are shown (Overview coverage, Incident "Alternative paths," Blueprint
"Reachability," World Model), label every path **declared / latent / observed**, visually distinct,
each **naming the class + constraint that generated it**. Never show a latent/declared path with
observed confidence (N4). The "Alternative paths to *Unauthorized refund*" list is the first place
to fix — some of those five paths are latent, and saying so is the point.

### 1.2 The **promotion ladder** is absent
**simulation → shadow → canary → production** appears 0 times (no "shadow," "canary," "promotion").
This is the security register's single best objection-killer for "you're letting an AI rewrite my
policy," and N2 (a human approves before anything reaches an execution surface).

**Fix:** add an explicit **promotion strip** to the Policy Decision / Validation flow and the PCP
card: every recommendation shows its current stage on the ladder, with rollback preserved at each
stage. State plainly that **no policy reaches production from simulation alone.**

---

## 2. Name the five product objects (P1)

The demo already *shows* most of these — it just doesn't name them with the canonical vocabulary.
Align the labels (carrying the working-name caveat where noted):

| In the demo now | Canonical object | Note |
|---|---|---|
| "World Model Coverage" / coverage panels | **Coverage Map** (attack paths, each covered/partial/uncovered, with grade) | The countable unit is the **attack path, not the alert** |
| "Validated policy recommendation" / "Decision" card | **Policy Change Proposal (PCP)** | A change request, "a PR with a proof attached" — not an alert |
| Backtest / effectiveness-over-time | **Outcome Record** (predicted vs observed) | Surfaced as policy effectiveness; internally = world-model fit |
| Blueprint "Validation · baseline simulation" env | **Proving Ground** *(working name)* | Say "working name"; it's a **surface, not the product** |
| "Agentic Blueprint Studio" (design-time, if agent runs from config) | **Blueprint Check** *(working name)* | Declared-grade; front door to the runtime product; **not a linter**; never a "no-exposure" verdict (B1–B5) |

**Guardrail:** "Blueprint Check" and "Proving Ground" are **working names, not approved branding** —
don't hard-brand them in headline UI without sign-off.

---

## 3. Make **One Blocked Attack** the explicit spine (P1)

The Incident flow (I-1042 "Vendor bank mutation attempted" → alternative paths → candidates →
decision) is already the flagship scenario in disguise. Sharpen it to the canonical shape so the
narrative reads end-to-end:

**one blocked attack → reconstruct the environment → the *other* open paths (with grades) → ranked
policy options → staged validation → measured outcome → learn.**

- **Open from a win, not a breach.** The incident header should say the customer's **existing
  guardrails blocked it** — Silex starts *there* and asks "was that one path, or the only path?"
- Keep the five-paths table; add the **grade** to each path (§1.1).
- Candidates A/B/C already exist — make **ranking explicit** and add the two hard-to-copy fields
  below (§4).
- Add the **promotion ladder** to the decision (§1.2).

The organizing principle should appear once, as the section frame:
**Coverage tells us *where* to improve · Optimization tells us *how* · Real-world outcomes teach us
*what works*.**

---

## 4. Two fields that make the product's judgment visible (P1)

Per Product Spec §2.2, a PCP's differentiation lives in two fields the demo should surface:

- **Rejected candidates** — show at least one policy option that **worked and was eliminated anyway,
  and why** (business friction / cost). Watching a working defense get dropped is where the
  judgment becomes visible; it needs the Objectives layer to reproduce.
- **Semantic rationale** — state *why in type terms* ("this is privilege escalation through a
  delegated identity"), not merely "this path exists."

---

## 5. The six objectives (P1)

The candidate cards score on ad-hoc axes ("Defense 79% · Reachability · Latency"). Replace/expand to
the canonical **six**: **risk reduction · coverage · business friction · compliance · cost ·
performance** (N5). A control that stops the attack and also stops the business is not a valid
recommendation — the Business Harness is what makes that legible.

---

## 6. Guardrail compliance fixes (P0/P1)

| Item | Issue in the demo | Fix |
|---|---|---|
| **Illustrative numbers** | 93% (×4), +21%, −40%-style figures shown as validation *results* | These are **illustrative, not measured** (positioning Guardrails). Add a persistent **"synthetic environment · illustrative figures"** marker; avoid echoing the exact flagged numbers (93 / +21 / −40) as if benchmarks. |
| **Never inline / never hold enforcement** | Ensure nothing implies Silex blocks inline or owns the decision | Show the loop as **propose → human approve → deploy through the customer's own surface** (PR to policy-as-code / IAM / gateway). N1–N2. The 9/16 removal of the manual→suggested→**automatic** ladder already helps — keep "automatic" out. |
| **Ranked alternatives, not one fix** | "recommend" appears 30× vs "rank" 1× | Output is **ranked alternatives with rationale, expected impact, evidence, confidence** — not a single fix. Make the ranking visible. |
| **Scoped rollback** | If rollback is claimed | Scope to **agent-side state**; business effects get a **compensating-action recommendation**, not auto-reversal. |
| **"Safe" / certification** | ✓ Already OK — copy says "unsafe outcomes," issues no "safe" verdict | Keep it. Never add a "safe"/"certified"/"100% covered" verdict; the ontology widens the search, it doesn't make it exhaustive. |
| **Design-time claim** | Blueprint output | Declared-grade only; label it "what the configuration permits, not what exists"; point to the runtime product; **never "no exposure."** |

---

## 7. Investor consistency, kept under the hood (P2)

The site must not *contradict* v7, but must not *lead* with it. If a technical/investor affordance is
wanted, add a single **"Architecture / how it works"** view (separate from the operator flow) that
may surface the Security World Model's five **named** layers (Schema · Laws · World State ·
Objectives · Calibration — **never numbered**), the four ontology tiers (L1–L4), and
declared→latent→observed. Gate it behind D1. **Never** put EWM, "Agentic AI infrastructure," V&V, or
Phase-2 expansion into the operator's daily screens.

---

## 8. Priority summary

| P | Change | Why |
|---|---|---|
| **P0** | Add the **latent** evidence grade to all path/coverage displays (§1.1) | The differentiated claim is currently missing |
| **P0** | Add the **promotion ladder** to policy/validation (§1.2) | The register's objection-killer + N2 |
| **P0** | Confirm **D1** (is SWM buyer-facing?) before touching SWM/ontology copy (§0) | Gates §2, §7 |
| **P0** | **Illustrative-figure** markers; drop result-looking 93%/+21%/−40% (§6) | Positioning guardrail |
| **P1** | Name the five **product objects** with canonical vocab (§2) | Coherence with the spec |
| **P1** | Sharpen the **One Blocked Attack** spine; open from a win (§3) | The fastest-landing story |
| **P1** | Add **rejected candidates** + **semantic rationale** to the PCP (§4) | Where judgment becomes visible |
| **P1** | Score candidates on the **six objectives** (§5) | N5 |
| **P1** | Ensure **ranked alternatives**, never one fix; **never inline**; **scoped rollback** (§6) | N1–N2, guardrails |
| **P2** | Optional **architecture/investor** view, gated by D1 (§7) | Consistency without leading |

## 9. Decisions to confirm before building
- **D1** — Security World Model buyer-facing? (gates §0, §2, §7)
- **D3** — coverage-first vs co-equal coverage+optimization framing in the hero
- **D15** — Blueprint Check packaging (affects how prominently it's branded)
- **Working names** — "Blueprint Check" / "Proving Ground" are not approved branding
- **Illustrative-number policy** — house rule for demo figures so none reads as a benchmark

---

## 10. Result — what was implemented (2026-09-17)

P0 and P1 were carried out in `index.html` (both the Blueprint flagship flow and the JS-rendered
Incident flow). JS syntax verified (`node --check`); every new CSS class cross-checked against its
markup. Changes are additive.

| # | Item | Status | Where |
|---|---|---|---|
| P0-1 | **Latent** evidence grade on all paths (+ legend, each latent path names its constraint) | ✅ Done | Blueprint "Alternative paths"; Incident `pathRow`/`gradeBadge`; both get a grade legend |
| P0-2 | **Promotion ladder** (simulation → shadow → canary → production; "no policy reaches production from simulation alone") | ✅ Done | Both PCP cards; approve-modal text realigned |
| P0-3 | **Illustrative** marker | ✅ Already present | Topbar "Simulated agents · illustrative data" pill |
| P0 | Confirm **D1** (is SWM buyer-facing?) | ⏸️ **Needs advisor** | Gates the "World Model" → "Coverage Map" rename below |
| P1-4 | **Six objectives** on candidates (risk · coverage · biz friction · compliance · cost · performance) | ✅ Done | `sixObj()` helper; both flows |
| P1-5 | **Rejected candidates + semantic rationale** | ✅ Done | Candidates tagged "Rejected — why"; type-level `rationale` line on each PCP |
| P1-6 | Product-object naming — **Policy Change Proposal** | ✅ Done | "Validated policy recommendation" → "Policy Change Proposal" (both), staged-validation subtitle |
| P1-6 | Naming — "World Model Coverage" → "Coverage Map" | ⏸️ **Deferred (D1)** | Not renamed pending D1 |
| P1-7 | **Never-inline + scoped rollback** | ✅ Done | Both decision cards (`deploy-note`) |
| — | Working names (Blueprint Check / Proving Ground) | ⏸️ Not applied | Not approved branding; left as "Agentic Blueprint Studio" etc. |
| P2-7 | Architecture / investor view | ⛔ Out of scope | Gated by D1; not part of this pass |

**Open items carried forward:** D1 (SWM buyer-facing?), D3 (hero coverage-first vs co-equal), D15
(Blueprint Check packaging), a house rule for illustrative figures. All are advisor decisions, not
build work.
