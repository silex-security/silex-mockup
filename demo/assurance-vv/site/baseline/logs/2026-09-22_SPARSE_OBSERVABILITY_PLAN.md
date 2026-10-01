# Sparse Observability: terminology fix + feasibility view (plan v0.3)

Author: Claude (lead) · 2026-09-22 · Status: **v0.3 — APPROVED by all three seats in round 3 (plan hash `cc919a9`): DEEPSEEK: PLAN-APPROVED · CODEX: PLAN-APPROVED · CLAUDE: PLAN-APPROVED.**
Request: *"检索网站是否出现 Sparse Simulation 字样，改成 Sparse Observability（含义见 artifact 8b4qH4djFf9dFfnPQqvDVm）；如果需要改造 demo 网页（swm 之外）的逻辑来证明可行性，请给出 plan 并 review 执行。"*
Definition source: the artifact "Sparse Observability 如何实现 Reality Reconstruction" (2026-09-22), cited below as **SO**.

## 1. Findings (searched, not assumed)

- **`silex-mockup` (the demo site) never says "Sparse Simulation".** I checked the repo (`git grep -i sparse`, `swm/data` excluded) and the live HTML. The only hit is a design note about a decorative dot grid.
- **The term lives in `silex-explorer`**, in the investor pages built on 9/21:
  - `docs/preview.html`: section `#sparse`, "Sparse simulation: prune by law, simulate what's left"; a timeline entry at 2:50; the intro line.
  - `docs/tech-explainer.html`: the analogy list, pipeline step 04 "Explore", tech card `#t-sim`, and the stage-matrix row, each in EN and 中文 (稀疏仿真).
  - `README.md`: the explainer's description.
  - **The two live artifacts** published from those files: preview `JAFtk6YySCkbCBRXzrf9sx`, explainer `43vbwZuA9WVUY9mXXzaiFc`.
- **This is not a rename.** The two terms name different mechanisms:

| | "Sparse simulation" as written | **Sparse Observability** (SO) |
|---|---|---|
| Question | Which branches do we simulate? | What do we know about the environment, and how do we know it? |
| Mechanism | Prune candidate branches by named law, then simulate the remainder | Connect existing observations (trace) and declarations (IAM, manifest, config) through the ontology; fill gaps only where the type tiers allow; label every filled gap; list what cannot be represented |
| Output | Reachable routes | Each entity and relation labelled **observed / declared / latent**, plus an **unmodeled** block |
| Place in the chain | After reconstruction (SO: "已有 telemetry + 配置 → 类型层填 latent → **才到 simulation**") | The **input contract** of grounding |

A literal find/replace would produce false copy such as "Sparse observability: prune by law, simulate what's left". So the plan (A) retitles the simulation content honestly and (B) adds what SO actually claims.

## 2. Workstream A: `silex-explorer` wording and content (owner: claude)

Files: `docs/tech-explainer.html`, `docs/preview.html`, `README.md` in `silex-explorer`, and republishing the two artifacts **to their existing URLs**.

1. **Law-based pruning keeps its content under an honest name:** "Law-pruned simulation · 规律剪枝仿真". It stays a real step (the mockup's Assurance §03 already says "excluded by named laws → 187 simulated executions"). It is no longer presented as one of the headline technologies; it becomes the World-model card's "how the laws are used" block and the name of pipeline step 04.
2. **A new "Sparse observability → reality reconstruction · 稀疏可观测 → 现实重建" technology card** takes the freed slot. Its content comes from SO and nothing beyond it:
   - three sources: observed (trace), declared (manifest / IAM / config / contract), latent (type-level inference, always labelled inferred);
   - the unmodeled block;
   - it is the input contract, not a layer;
   - it covers Schema and World State, **not Laws** (SO step 4);
   - unobserved state can be declared or verified, never inferred (SO step 5).
   - The pitch line and its wording rule are used verbatim: never "complete reconstruction", never "exhaustive", latent stays latent.
   - **No paper numbers are copied onto the pages.** SO's footer says they are self-reported and in other domains, and cannot be extrapolated to Silex.
3. **Pipeline:** step 01 "Observe" shows two chips, Runtime graph and Sparse observability. Step 04 "Explore" uses "Law-pruned simulation". The runtime-graph card's "Honest about gaps" block moves into the new card, so the same content is not stated twice.
4. **Stage matrix:** "Sparse simulation" becomes **"Sparse observability"**:
   - demo: the three grades plus unmodeled on one screen, from recorded traces plus declared config;
   - design partner: three sparsity tiers (config only / config + partial trace / config + full trace) with stated failure conditions (SO open question Q1);
   - next: a grounding-precision proxy, i.e. how much unresolved divergence falls when a declaration is added (SO Q2).

   Simulation's staged-rollout text moves into the World-model row.
5. **Preview page:**
   - retitle `#sparse` "Law-pruned simulation", with its timeline label and intro line;
   - add a compact **"Reconstructed, not assumed"** strip to the World-model section: the grade legend, including unmodeled, and one sentence per grade.
6. **README:** the explainer description lists "ontology, world model, sparse observability, enterprise runtime graph".
7. **Acceptance:**
   - `git grep -i -E "sparse simulation|稀疏仿真"` returns nothing in `silex-explorer`;
   - EN and 中文 blocks are paired one to one;
   - both artifacts are republished at the same URLs, and a read-back matches the files;
   - no number from SO's papers appears.

## 3. Workstream B: feasibility view in `silex-mockup` Incident → Evidence (outside `swm/`)

**Why the demo needs it.** The site already names the steps "observe → reconstruct → explore" and tags some Evidence-graph nodes Observed or Inferred. But five of the nine non-counterfactual graph nodes (Finance Approver, PAY-042, Vendor bank record, Procurement Agent, Bank destination changed) carry no grade, and nothing shows *how* the picture was reconstructed from sparse sources. SO's claim is only demonstrable if one incident shows its inputs, the grade of every entity and relation, what is unmodeled, and what changes as the evidence thins.

### 3.1 Fixture: one source of truth, I-1042 only, illustrative

One JS object, `RECON_I1042`, in `index.html`. Every count, chip and edge style it drives is computed from it; none is hand-typed.

**Grade discipline (from SO):**
- **observed** = present in the trace or event logs;
- **declared** = asserted by configuration, IAM, manifest or policy, *including any unobserved state*, which "只能声明或验证";
- **latent** = type-level inference about **structure only** (a mechanism or a relation), always labelled inferred;
- **absent** = not in this tier's inputs (never "false");
- **unmodeled** = cannot be represented by the ontology at all.

**An unobserved state is never graded latent.**

**Tiers** (a segmented control; the default is T2, "today", which is the incident as it exists):
- **T1 · config only** (pre-deploy; the Blueprint Studio view)
- **T2 · config + partial trace** (today)
- **T3 · config + full trace**

**Sources:**

| Id | Source | Grade it yields | Present in |
|---|---|---|---|
| S1 | Finance Agent run trace (I-1042) | observed | T2 partial, T3 full |
| S2 | IAM grants & delegations | declared | T1–T3 |
| S3 | Tool manifest (Vendor Update Tool: WRITE vendor.bank_account) | declared | T1–T3 |
| S4 | Policy config (PAY-042) plus its block log | declared (config) / observed (block event) | config T1–T3; event T2–T3 |
| S5 | Vendor master (ERP) | **not connected** (the existing Coverage Gap "Procurement vendor data not connected") | none |

**Entities**: the nine graded nodes of the existing Evidence graph, mapped by element id. `kgCandidate` is counterfactual and is not graded. Grades are T1 / T2 / T3.

| # | Node (element id) | T1 | T2 | T3 | Note |
|---|---|---|---|---|---|
| n1 | External email (`kgInput`) | absent | observed | observed | |
| n2 | Finance Agent (`kgAgent`) | declared | observed | observed | |
| n3 | Finance Approver (`kgAuthority`) | declared | observed | observed | the approval event is in the workflow log |
| n4 | Intent provenance lost (`kgMechanism`) | absent | **latent** | **latent** | a mechanism is structure; it is never observed |
| n5 | PAY-042 (`kgControl`) | declared | observed | observed | the block event |
| n6 | Vendor Update Tool (`kgAction`) | declared | observed | observed | |
| n7 | Vendor bank record (`kgResource`) | declared | observed | observed | its **read** response is in the trace. Its **state at source** is not observable (S5 not connected), so that state stays **declared** until the ERP is connected or the change is verified. It is shown as the "Not connected" line, never as latent |
| n8 | Procurement Agent (**`kgProcurement`**, a new `id` attribute on the existing `.kg-node.agent` at left:30px / top:268px; attribute only, the node is not moved or restyled) | declared | declared | declared | no trace of its own |
| n9 | Bank destination changed (`kgOutcome`) | declared | **declared** | **declared** | it never happened (PAY-042 blocked the write). The prohibited outcome is declared-possible by policy; only verification could say more |

**Relations**: exactly the **eight edges drawn** in the existing graph, mapped by their SVG label. `INTERVENES_ON` is counterfactual and is not graded.

| # | Edge (label, from → to) | T1 | T2 | T3 | Note |
|---|---|---|---|---|---|
| r1 | INGESTS, email → Finance Agent | absent | observed | observed | |
| r2 | ADOPTS_INTENT, Finance Agent → mechanism | absent | latent | latent | |
| r3 | AUTHORIZED_BY, Finance Approver → mechanism | declared | latent | latent | the approval event is observed (n3). That it was *reused* for this intent is inferred |
| r4 | ENABLES, mechanism → Vendor Update Tool | absent | latent | latent | |
| r5 | MUTATES, Vendor Update Tool → Vendor bank record | declared | observed | observed | what is observed is the **mutation attempt**: the call is in the trace and was blocked. The card and the edge's accessible label say "mutation attempted · blocked; the record did not change", so observed never implies a state change |
| r6 | LEADS_TO, Vendor bank record → outcome | declared | declared | declared | policy law |
| r7 | GOVERNS, PAY-042 → Vendor Update Tool | declared | observed | observed | the block event |
| r8 | ALTERNATIVE_ROUTE, Procurement Agent → Vendor bank record | declared | declared | **latent** | with the full trace the hand-offs are seen and the inherited authority is inferred |

**Derived counts.** The probes assert these; they are listed here so reviewers can check the arithmetic.

| Tier | Nodes (obs · dec · lat · absent) | Relations (obs · dec · lat · absent) |
|---|---|---|
| T1 | 0 · 7 · 0 · 2 | 0 · 5 · 0 · 3 |
| T2 | 6 · 2 · 1 · 0 | 3 · 2 · 3 · 0 |
| T3 | 6 · 2 · 1 · 0 | 3 · 1 · 4 · 0 |

**The existing insight text changes.**
- The hand-typed "Observed evidence: **6 nodes · 5 transitions confirmed**" is replaced by the fixture-generated "**6 nodes · 3 relations observed**" at T2 (and the equivalent at T1 and T3).
- The "5 transitions" figure was hand-typed and does not survive grading of the drawn edges. The observed execution sequence is still shown in the known-path strip.
- The mechanism badge "Inferred · 86%" becomes the grade chip **"Latent · inferred"**. The confidence number is dropped, because a grade is not a confidence score.

**Unmodeled** (at every tier; listed, never dropped):
- U1: the Finance Agent's long-term memory contents at the time it adopted the instruction. There is no ontology class yet (the existing Coverage Gap "Long-term memory contents unmodelled").
- U2: the approver's out-of-band bank-change callback (phone). It is in no system, so it **cannot be inferred**; it can only be *declared* by the customer or *verified* afterwards (SO step 5). The actions are labelled "Declare" and "Verify"; both are inert in the demo and say so.

**Not connected** (at every tier): the vendor master (S5). "The vendor record's state at source is not observable; it stays declared until the ERP is connected or the change is verified."

**What each tier lets Silex say** (one line, shown under the control):
- T1: "The route is declared-possible. Nothing has happened; this is what Blueprint Studio shows before deploy."
- T2: "The known path is observed. How the email's instruction reused the approval is inferred (latent). The outcome never happened; it stays declared-possible until verified."
- T3: "More trace turns the Procurement route from declared into latent. It does not turn the vendor record's state into an observation while the ERP is not connected."

**Scope: I-1042 only.** The Evidence graph is shared by every incident (`renderIncident` fills it). For any other incident:
- the card is hidden;
- **every shared element this plan touches reverts exactly to BASE**: the node tags, the edges' `data-grade`, the "Observed evidence" insight text (back to "6 nodes · 5 transitions confirmed") and the mechanism badge (back to "Inferred · 86%");
- the originals are captured once at init and compared by the probes (R4).

### 3.2 UI (Evidence tab, below "Known attack / failure path")

- **The card:** titled **"How this picture was built · sparse observability"**, with a kicker "observe → reconstruct" matching the existing step labels. It contains:
  - the source list with present / not-connected state;
  - the tier control;
  - grade counts for nodes and relations;
  - a compact grouped list of the nine nodes and eight relations, each with a grade chip;
  - the Not-connected line and the unmodeled block;
  - the tier's one-line claim.
- **Legend:**
  - "absent = not in this tier's inputs, never false";
  - "unmodeled = cannot be represented at all";
  - "latent = inferred structure, never an unobserved state".
- **Graph re-tag.** Changing the tier re-tags the Evidence causal graph live, using the mapping above:
  - each graded node gets one grade chip, reusing the site's existing `.grade g-obs / g-lat / g-dec` badges, plus a neutral "absent" chip;
  - each of the eight edges gets a `data-grade` attribute. CSS draws observed solid, latent dashed and declared dotted, matching the Alternative-paths route map's "line pattern = evidence grade"; absent is faded.
  - Nodes and edges are **not repositioned**, and no edge is added or removed. The graph's view-mode classes (`observed`, `causal`, `counterfactual`) are filters, not grades, and are left untouched.
- **Caption:** "Illustrative reconstruction of one incident. Every entity and relation is labelled by how we know it; what we cannot represent is listed, not hidden."
  - In the Operations register, the caption is plain.
  - In the Assurance register only, the SO pitch line is added verbatim: "We don't ask for more telemetry…". This follows the positioning skill: security buyers are opened with evidence, not with "world model".
- **Assurance §03:** one added sentence linking to the card ("See how the I-1042 picture was reconstructed →").

### 3.3 Constraints

- **Scope:**
  - **`swm/` is byte-identical** (checked by hash);
  - views other than Incident → Evidence and the one Assurance sentence are unchanged: the harness's `outside` / `baseline` snapshots are equal except those two nodes;
  - other incidents' Evidence tabs are identical to BASE.
- **Claims:**
  - illustrative labels everywhere;
  - no SO paper numbers;
  - none of "complete", "exhaustive", "full reconstruction";
  - latent is never styled like observed, and never applied to an unobserved state.
- **Accessibility:**
  - the tier control is a radiogroup with arrow keys and Home/End, and `aria-live` announces the tier claim;
  - grade is conveyed by text as well as by colour and line pattern;
  - reduced motion: no transitions.
- **Performance** (replaces byte caps, per the `swm/BUILD_HISTORY.md` §2a suggestion of 2026-09-22):
  - BASE = the `main` HEAD at dispatch;
  - tier switch → next animation frame, p95 ≤ 100 ms over 20 switches, measured in-page with `performance.now()` plus `requestAnimationFrame`;
  - cold "open I-1042" median of 5 runs not regressed by more than 100 ms against BASE;
  - byte growth is **reported prominently** in the log, with a soft warning at 25 KB.
- **Layout:** no overlap or overflow at 1600 / 1366 / 768. Seats with image input (Claude, Codex) judge the tier re-tag screenshots at 1366 and 768.

### 3.4 Acceptance probes (Codex harness, scratch)

- **R1:** at T2, "6 nodes · 3 relations observed", generated from the fixture; the mechanism chip reads "Latent · inferred"; no "86%" remains in the Evidence graph.
- **R2:** per-tier node and relation counts equal the §3.1 table; every node and relation has exactly one grade per tier; the outcome (n9) is never latent; n7's state is never latent.
- **R3 (mapping):**
  - on load and after each switch, the chip on each mapped node element and the `data-grade` on each of the eight labelled edges equal the fixture;
  - no edge is added or removed, and no node moves (transforms and coordinates compared with BASE);
  - switching back to T2 restores it exactly.
- **R4:**
  - U1, U2 and the Not-connected line are shown at every tier;
  - opening any other incident hides the card and restores **all** touched shared elements (tags, `data-grade`, insight text, mechanism badge) exactly to BASE;
  - `kgProcurement` is the only attribute added to existing graph markup;
  - going back to I-1042 re-applies the fixture.
- **R5:** keyboard operation (arrows, Home/End); the `aria-live` text changes; reduced motion.
- **R6:** copy scan across **both repositories and both republished artifacts** (read back): no "sparse simulation" or "稀疏仿真"; none of the forbidden words in the new text.
- **R7:** `swm/` hash unchanged; `outside` / `baseline` modes equal except the Evidence card and the Assurance sentence; all 16 regression modes pass.
- **R8:** the performance gates; the 1600 / 1366 / 768 layout; the screenshots for seat judgement.

## 4. Owners and files

| Task | Owner | Files (exclusive) |
|---|---|---|
| A (explorer copy + artifact republish) | claude | `silex-explorer/docs/tech-explainer.html`, `docs/preview.html`, `README.md`, `logs/` |
| B-impl (fixture, card, graph re-tag, Assurance sentence) | codex | `silex-mockup/index.html` only |
| B-probes (R1–R8) | codex | `/private/tmp/swm-sparse-20260922/` (scratch) |
| Review | deepseek | read-only; reviews A and B |
| Log | claude | `silex-mockup/logs/2026-09-22_SPARSE_OBSERVABILITY_*.md`, `logs/README.md`, root README "What's changed" |

**Process:**
1. The plan goes to DeepSeek and Codex, with revisions until all three reply PLAN-APPROVED.
2. A and B run in parallel (disjoint repos).
3. Frozen diffs (mockup `git diff BASE -- index.html`; explorer `git diff BASE -- docs README.md`) go to all three seats until all reply IMPL-APPROVED.
4. Commit and push to `main` in both repos, which deploys silex-mockup. The user authorized "review 执行", which covers execution after unanimous approval.
5. Republish both explorer artifacts to their existing URLs.

## 5. Round-1 disposition

| Point (both seats) | Change in v0.2 |
|---|---|
| #1 The outcome was graded latent, but an unobserved state can only be declared or verified (SO step 5) | n9 is declared at every tier; n7's state at source is declared (the Not-connected line); a grade-discipline paragraph added; R2 asserts that neither is ever latent; the T2 and T3 claims were rewritten |
| #2 The relations were not mapped to the drawn graph | The fixture now uses exactly the 8 drawn edges, mapped by label, and 9 nodes mapped by element id; "5 transitions" becomes the generated "3 relations observed"; the "Inferred · 86%" badge becomes a grade chip; the view-mode classes are left as filters; R3 asserts the mapping and that nothing moves |
| Codex non-blocking | BASE, sample count and timing method named; growth reported prominently; the copy scan covers both repos and both artifacts |
| DeepSeek non-blocking | BUILD_HISTORY §2a named; n7 not-connected wording fixed; legend defines absent and unmodeled; seat screenshot judgement added (R8); I-1042-only scope and restoring other incidents' tags (R4) |

### Round 2

| Seat | Verdict | Disposition in v0.3 |
|---|---|---|
| DeepSeek | PLAN-APPROVED (non-blocking: the n8 id; revert shared elements for other incidents; r6 is fine as declared) | n8 id added; the shared-element revert is spelled out in the scope paragraph and R4 |
| Codex | PLAN-REJECTED #1: the Procurement node has no id, so the mapping is not implementable | n8 mapped to the new `kgProcurement` attribute (not moved or restyled); R4 asserts it is the only attribute added. Non-blocking: r5 is worded as an observed *attempt* in the card and the accessible label |

### Round 3

**All three seats approved** plan hash `cc919a9`: DeepSeek, Codex and Claude.

Folded in afterwards (a copy note, no scope change): the card's legend says a declared `LEADS_TO` reflects a **customer-declared policy constraint**. Sparse Observability does not model Laws (SO step 4).
