# Scenario Expansion view

Date 2026-10-11. A new top-level view, `#view=scenario-expansion` (sidebar: Environment → Scenario Expansion).

## What it shows

System Validation already lists "Generating adversarial scenarios" and "Running attack mutations" as static steps. This view makes those two steps concrete for one attack.

- **Seed:** bulk reads of files on a finance share (ATT&CK T1039), for the fictional tenant Acme Financial.
- **Five business conditions:** account role, approval, permission, data sensitivity, log coverage.
- **Ontology constraints** prune the combinations that cannot exist in this enterprise (C1–C5).
- **Every surviving variant** gets:
  - a **proposed** expected outcome, pending expert review: attack, approved normal, insufficient evidence or benign;
  - the **simulated** result of one illustrative volume rule (R1);
  - a provenance record that keeps three operations apart:
    - a **lab execution** (role, permission, sensitivity);
    - a **context overlay** (approval: injected, never executed);
    - an **observation-removal derivative** (log coverage: derived from a recorded run, never re-executed).

The intended target is an open-source attack-simulation lab (Attack Range is the example named on the page). Nothing in the view has run in a lab: every result carries the evidence grade `simulated` and the ontology version `scenario-slice 0.1`, and every variant carries `review: pending`.

## Sub-tabs

1. **Expand one attack** (`js/sx-expand.js`). The seed, then the five conditions, each with its ontology tier and operation. Then every combination, the constraint funnel, and the proposed-outcome groups. Last comes the chain of lab executions, context overlays and observation-removal derivatives.
2. **Where the rule holds** (`js/sx-coverage.js`). Role × permission against approval × sensitivity, with a switch for log coverage. Pruned cells are hatched and show the ids of the constraints that rule them out.
   - The six outcomes: caught, missed, false alarm, quiet as proposed, surfaced (alert raised, investigation still required) and silent gap.
   - Candidate findings grouped by (outcome, cause), each with a Replay button.
3. **Replay one variant** (`js/sx-replay.js`). A picker, the provenance chain, a runtime-graph SVG and a step-by-step timeline. Dropped events are greyed out. The verdict shows the rule result against the proposed outcome, plus two invariant checks: replay digest and observation subset.
4. **How results are judged** (static, in `index.html`). The method: credibility, effort and coverage, and detection value. Finding a gap and improving detection after a fix are assessed separately, and the generator never judges its own output.

## Model

`js/sx-model.js` is pure: no DOM, no network, no randomness. All counts on the page are computed from it at load. Currently (`node -e` over `expand()`) it gives:

- 243 combinations, of which C1–C5 remove 54 / 27 / 12 / 9 / 15, leaving 126 valid variants;
- 22 lab executions, 42 context overlays and 84 observation-removal derivatives;
- 6 candidate findings.

The expected-outcome order, the rule, the comparison table and the finding attribution order are documented in the module's comments and pinned by `tests/site/sx-model.test.mjs` as named cases.

## Wiring

- `js/sx-view.js` mounts the sub-tabs with `js/rt-subnav.js` the first time the view is shown.
- It reads `&sub=` from the hash itself (`expand|coverage|replay|judging`) on load and on every hashchange.
- It routes the `sx:replay` event from ② to ③.
- System Validation gains a "See how one attack is expanded" button (`data-wm-route`).

## Tests

- `sx-model` covers the funnel, the named cases, provenance, grades, findings and replay invariants.
- `sx-view` covers routing, deep links, keyboard, framing text, 390 px and console errors.
- `sx-expand`, `sx-coverage` and `sx-replay` cover each panel against the model.
- `sx-neutral` scans this view's files, this plan and its change-log entry for denied terms; the terms are stored as hashes.

The full suite (`node --test tests/site/*.test.mjs`) passes.

## Review

The view was built by a reviewed multi-agent fleet. Two independent reviewers and the planner approved the plan unanimously (v0.3, after three rounds). Every code change was reviewed against the same rules before merge.
