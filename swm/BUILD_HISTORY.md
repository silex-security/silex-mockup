# Security World Model — build history and why it took the time it did

This note records how the 2026-09-21 SWM **visual upgrade** and **Network view** were built, and answers a question the team asked: *did the rebuild take long because it processes a lot of real data?* The short answer is no. Almost all of the time went into the review process, not into data.

Detailed plans, review verdicts and probe evidence: [`../logs/`](../logs/README.md). Change summary: the repository [README](../README.md#whats-changed).

## 1. The data is small and did not change

| | |
|---|---|
| Bundle | [`data/ontology.js`](data/ontology.js), **598 nodes / 800 typed relations**, about **343 KB**; [`data/coverage.js`](data/coverage.js), about **14 KB** |
| Real part | about **467 nodes** distilled from public sources: MITRE D3FEND 213, ATLAS 96, UCO 72, ATT&CK 61, OWASP GenAI 25. Original IDs are kept (see [`data/SOURCES.md`](data/SOURCES.md)) |
| Illustrative part | **131 Silex-authored nodes**: L2 domain packs, L3 components, L4 runtime instances, and **all coverage percentages** |
| Built when | **2026-09-17**, by [`tools/build-ontology.mjs`](tools/build-ontology.mjs). Neither 9/21 upgrade touched `data/`, `vendor/`, `tools/` or the loader; that was a hard rule of both plans |
| Rendering cost | milliseconds. The Network view's full L1 layout (370 nodes) computes in about **80–240 ms**; cold ready was a median of **360 ms** locally |

So neither data volume nor data processing explains the time.

## 2. Where the time actually went

From the commit history on 2026-09-21:

| Work | Time (approx.) | Commits |
|---|---|---|
| Visual upgrade: plan + four design frames | **1.5 h** (17:33 → 19:09) | `16409f1` |
| Visual upgrade: implementation + review | **2.5 h** (19:09 → 21:42) | `413436a`, `8ec7346` |
| Network view: research + plan | **0.7 h** (21:42 → 22:23) | `d8a2a0c` |
| Network view: implementation + review | **1.1 h** (22:23 → 23:27) | `6344f4a`, `cb3e9b8` |

Deployed together on 2026-09-22 (`main` fast-forwarded to `cb3e9b8`).

What consumed those hours:

1. **Unanimous three-seat review (Claude, DeepSeek, Codex).** Both the plan and the code need all three agents to approve. Any code change, however small, sends the revision back to every seat.
   - Visual upgrade:
     - plan: two rounds;
     - implementation: three rounds. R1 was rejected for two layout bugs in Ontology Layers: the legend covered the chart, and the "Outcome" asterisk glyph rendered invisible. R2 was approved with a nit; **R3 `27f07eb`** was unanimous.
   - Network view:
     - plan: two rounds; Codex's round-1 rejection raised four real integration and lifecycle gaps;
     - implementation: two rounds. DeepSeek's round-1 rejection caught a real bug (a search that jumped to another tier lost its zoom and halo) that neither other seat had found. **R2 `e978d6a`** was unanimous.
2. **Automated browser checks every round.**
   - Headless Chrome probes at three widths (1600 / 1366 / 768) and under reduced motion.
   - The Network view added 34 of its own checks.
   - A 16-mode regression suite confirms the other pages didn't change.
3. **Byte budget.** The visual upgrade ran about 13 KB over its growth cap and was trimmed with no feature removed. The Network view needed an approved reallocation of its 38 KB budget.
4. **Coordination overhead.**
   - Each agent turn takes several minutes.
   - Codex handed the visual-upgrade implementation to Claude midway.
   - Permission dialogs pause an agent until someone approves them.

## 3. Was it worth it?

The process caught defects that would otherwise have shipped:
- the invisible glyph;
- the legend overlap that hid a claim caveat;
- the cross-tier locate bug;
- the budget overrun;
- terminology that called illustrative runtime instances "classes".

The cost is wall-clock time, not compute.

**Suggested tiering (a team decision, not yet adopted):**

| Change size | Suggested process |
|---|---|
| Copy or small visual tweak, no logic | one implementer + one reviewer, spot-checked screenshots |
| New interaction or view logic | plan review + one implementation review round, regression probes |
| New view, data or claim changes | the full three-seat unanimous process used here |
