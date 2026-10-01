# SWM visual upgrade — review record

**Final outcome: PLAN-APPROVED unanimously by Claude, DeepSeek and Codex after two rounds.**

Reviewed target: **plan v0.2 + four v0.2 SVG frames and PNG exports**. Content hashes: [review-v0.2-manifest.json](review-v0.2-manifest.json). The plan file is the frozen submission, whose §6 statuses reflect submission time; this separate record carries the final verdicts so the approved input hashes remain unchanged.

## Scope and roster

User request: prepare a visual upgrade plan, draw the result, and have several agents review it. Only planning/design files changed in this run. No application implementation, data rebuild, commit, push or deployment.

- **Codex:** plan/design author and explicit self-review; current calling seat.
- **Claude:** independent review of the plan, current source/data and rendered PNGs; Herdr `w3:p1`. Initially returned service-side 529; recovered for both formal review rounds.
- **DeepSeek:** independent source/data and SVG-XML review; Herdr `coder-deepseek` / `w3:p2`, OpenCode `deepseek/deepseek-reasoner` (UI alias DeepSeek V4 Pro). It cannot inspect PNG images and did not claim visual image review.

All three seats are required. Author approval is not represented as an independent third-model review. No roster substitution.

## Steps

1. Read the existing SWM architecture, CSS, panel code and bundles. Fetched the live index: byte-identical to the local index. Repository base inspected: `bca6459d2d148655e4c9b0414699923d8ee4ace4`.
2. Captured the three existing panels with the repo's headless Chrome script: all rendered, no console errors. Screenshots remain in `/private/tmp/swm-visual-20260921/before/`.
3. DeepSeek independently checked data/provenance and implementation constraints while Codex drafted. Kept palette-copy synchronization, clear illustrative labels and separation of the legacy component summary from ontology tiers. Did not adopt the inaccurate preflight claim that all layer relations contain no Silex-authored content.
4. Codex drew v0.1 SVG/PNG frames with current bundle values. Sent the same plan/artifact target and review criteria to both independent seats, with a SHA-256 manifest.
5. Round 1: Claude returned **PLAN-REJECTED**, DeepSeek returned **PLAN-APPROVED**. Codex accepted Claude's blockers and revised the plan; no majority override.
6. Added fixture-local navigation rules for the two collision-prone actions and a default Ontology scale frame. Focus retains 15 real L4 context nodes. Removed the unsupported entity-total discrepancy statement and clarified per-node coverage. Sent all v0.2 inputs to both seats again, including the previously approving seat.

7. Round 2: Claude and DeepSeek each returned **PLAN-APPROVED** on v0.2; Codex recorded **CODEX: PLAN-APPROVED** against the same manifest. No design/spec edits after those verdicts; this record and log index are outcome metadata only.

## Round 1 blockers → changes

| Objection | Resolution in v0.2 |
|---|---|
| Claude: SWM WF-021 / I-1042 IDs collide with unrelated site stories; existing navigation would open the wrong business page | g-refund and g-memory stay within SWM and focus the correctly named Customer Refund fixture. No data edits or invented alias. Applies in Coverage and Coverage Gaps; regression checks assert destination meaning |
| Claude: the only Ontology frame showed nine boxes, leaving its default scale state unreviewable | Added 02a with a 240-node parent-preserving L1 expansion and 240/370/598 scope counts. Example focuses 9/24 L4 nodes with 15 muted context nodes; Reset/Back are distinct |

## Final literal verdicts — v0.2

- **CODEX: PLAN-APPROVED** — full explicit self-review in `/private/tmp/swm-visual-20260921/codex-r2.md`.
- **CLAUDE: PLAN-APPROVED** — literal `PLAN-APPROVED` in `/private/tmp/swm-visual-20260921/claude-r2.md`. Confirmed all nine hashes; viewed the four PNGs, verified BFS reachability, all gap actions, 9+15 L4 nodes and relation counts. Both blockers resolved; no new blocker.
- **DEEPSEEK: PLAN-APPROVED** — literal `PLAN-APPROVED` in `/private/tmp/swm-visual-20260921/deepseek-r2.md`. Independently verified both blocker resolutions, the new overview counts/source splits, all focus relations, entity totals and per-node coverage. No new blocker. Review was SVG XML/source/data, not PNG viewing.

## Non-blocking items carried to implementation

No post-approval edits to the frozen plan/design inputs are made for these preferences. They do not waive implementation acceptance:

- Use the bundle-defined group glyphs (notably Workflow `wye`, Outcome `asterisk`); the drawn glyph approximations are not a new semantic definition.
- Verify 240-node density at 1366×768; the nine-node focus must remain readable, and its 9/24 context count clear. Keep changes to the approved default subject to review.
- Consider per-group “N shown of M” labels and lower-opacity inter-group links to reduce visual density.
- Recheck low-end coverage colours against the final composited stage. The plan already requires readable marks and labels.
- Static design frames do not prove keyboard interaction, responsive layout, animation performance or navigation; these need implementation probes and a separate unanimous implementation review.

## Validation and artifacts

- Four native SVGs parse as XML and export successfully in local Chrome; no console errors in the artifact capture.
- Source/data checks confirm nine selected nodes and eight existing focus edges; four highlighted predicates and directions match `s`/`t` records; layer totals 370/86/118/24 and hops 43/21/22 match the bundle.
- Data/vendor SHA-256 baselines match; `index.html` remains byte-identical to the fetched live page. Only `logs/` contains this run's changes.
- [Design gallery](index.html) · [Chinese reading guide](README.md) · [Plan](../2026-09-21_SWM_VISUAL_UPGRADE_PLAN.md).
