# Sparse Observability — implementation log (2026-09-22)

Plan: [`2026-09-22_SPARSE_OBSERVABILITY_PLAN.md`](2026-09-22_SPARSE_OBSERVABILITY_PLAN.md) v0.3. It was approved in round 3 by all three seats; round 1 was rejected by both reviewers, and round 2 was rejected by Codex.
Definition source: the artifact "Sparse Observability 如何实现 Reality Reconstruction" (2026-09-22).

## What the search found

- `silex-mockup` (the demo site, repo and live) **never** said "Sparse Simulation".
- The term was in `silex-explorer` (`docs/tech-explainer.html`, `docs/preview.html`, `README.md` and the two artifacts built from them).
- There it named a *different* mechanism: prune branches by law, then simulate what remains. So it was **re-meant, not renamed**:
  - that content became "Law-pruned simulation · 规律剪枝仿真";
  - a new Sparse Observability section says what SO actually claims.

## Workstream A: `silex-explorer` (owner: Claude)

- **Explainer:** a new "Sparse observability → reality reconstruction · 稀疏可观测 → 现实重建" card, covering:
  - the three grades plus unmodeled;
  - the input contract, not a layer;
  - "not the laws";
  - an unobserved state can only be declared or verified;
  - no paper numbers;
  - the pitch line in EN and 中文.
- Law-pruned simulation moved into the World-model card, the pipeline's step 04 and the World-model stage-matrix row. The runtime-graph card now points to the new card.
- **Preview:** the section is retitled "Law-pruned simulation", and a "Reconstructed, not assumed" strip adds the four grade chips.
- **Review:** DeepSeek IMPL-APPROVED in r1 (4 nits, applied) and r2 `f69cc64`; Codex IMPL-APPROVED; Claude IMPL-APPROVED.

## Workstream B: `silex-mockup` Incident I-1042 → Evidence (owner: Codex)

**What was built:**
- The `RECON_I1042` fixture is the single source for:
  - the "How this picture was built · sparse observability" card: sources S1–S5 with per-tier state, a T1/T2/T3 radiogroup, counts, 9 nodes, 8 relations, the unmodeled block, Not connected, and the tier claims;
  - a live re-tag of the Evidence causal graph: one chip per node, and a `data-grade` line pattern per edge, with edges mapped by `data-edge` label.
- "6 nodes · 5 transitions confirmed" became the generated "6 nodes · 3 relations observed". "Inferred · 86%" became "Latent · inferred".
- It applies to I-1042 only; every other incident reverts exactly to BASE.
- One sentence was added to Assurance §03, and the pitch line appears in the Assurance register only.
- `swm/` is byte-identical.

**Implementation review rounds:**

| Round | Revision | Verdicts | Notes |
|---|---|---|---|
| r1 | `bc87121` | CLAUDE: IMPL-REJECTED | Five defects Codex's own probes missed, because they compared the page with its own fixture: 3 relation grades ≠ plan (T1 / T3 counts wrong); old static badges beside the new chips (contradictory at T1); sources ≠ plan; no relation list; tier names and claims not verbatim |
| r2 | `291af45` | CLAUDE: IMPL-REJECTED | The card was fixed. The graph still showed two grades. Root cause: the chips targeted the title `<strong>` instead of its `.kg-node`, and the mechanism chip was static |
| r3 | `a5db7bb` | **CLAUDE · DEEPSEEK · CODEX: IMPL-APPROVED** | Verified independently: exactly one grade per `.kg-node` at every tier, matching the plan |
| r4 | `a4289ad` | **CLAUDE · DEEPSEEK · CODEX: IMPL-APPROVED** | Non-blocking items applied: no hand-typed mechanism text; edges mapped by label, not position |

**Evidence on r4:**
- sparse probes 14/14;
- all 16 regression modes pass;
- tier switch p95 13 ms (gate 100 ms);
- cold open of I-1042: median 521 ms on both BASE and the working tree (gate BASE + 100 ms);
- growth: `index.html` +15.3 KB (soft warning at 25 KB; reported, not gated, per `swm/BUILD_HISTORY.md` §2a).

**Lesson:** a probe that checks the page against the implementer's own fixture cannot catch a fixture that departs from the plan. The acceptance literals must come from the plan text.

## Deploy

After unanimous approval, as the user authorized ("review 执行"):
- both repos fast-forwarded `main` and pushed; silex-mockup redeploys on Vercel;
- the two explorer artifacts were republished to their existing URLs.

The live read-back results are recorded below.
