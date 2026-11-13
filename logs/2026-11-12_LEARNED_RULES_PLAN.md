# Learned rules behind an evidence gate: plan

Plan version: v0.1 (2026-11-12). Status: draft, before the plan gate.

## 0. Run settings

- Roster: `standard`. Planner: Claude Code (Fable 5.2). Reviewers: `reviewer-claude` (Opus 5.5) and `reviewer-codex`. Coder, non-voting: DeepSeek.
- Transport: Orca panes.
- Repo: `silex-security/silex-mockup`, worktree `/Users/jianwang/workplace/Silex/silex-mockup-learned-rules`.
- Branch: `jwang3417/learned-rules`. BASE: `44e6acae21bdb158a5f48b00266ad6b37baf4e83` (origin/main, fetched 2026-11-12).
- `$SCRATCH`: `/var/folders/x3/8mdzc51d11j_z0l1mt77lpmr0000gn/T//fleet-ec9AdD`.
- Upstream source: `silex-ai-lab/jev-runtime-observability` at `de4ad51e84fc84c1304f2522f1d1f052f4af7b4c`, read from the local checkout `/Users/jianwang/workplace/Silex/jev-d1b`.
- Reviewer fixtures: `$SCRATCH/upstream/` holds copies of the upstream files the plan cites (`gate-reports.json`, the regate `README.md`, `gate.ts`, `learned-rule.ts`, the two plan lines) and `rules-from-sessions.json` (ordinal, model, last candidate for each of the 60 sessions). `$SCRATCH/probe/fixture-numbers.py` recomputes section 1's numbers from those copies.
- Baseline at BASE (measured, one run): `node --test tests/site/*.test.mjs` gives 557 tests, 557 pass.

## 1. Goal and claim

The user asked to bring the upstream learned-rule loop into this demo, then sync `jev-simplified` with it. The audience is investors and prospective customers (confirmed by the user 2026-11-12).

One message for the viewer: **a rule that a model proposes takes effect only after it passes a fixed evidence gate, and every rule carries its evidence count.**

What the page may claim, and no more:

- The figures are measured offline in the upstream engine. They are not computed in the browser and they are not production figures.
- The corpus is synthetic: 29 items, 15 in dev and 14 in holdout, for two failure classes. No customer data.
- Three hosted model configurations ran 60 proposer sessions in total. 56 sessions ended with a rule that passed the first gate. Under the current gate (`rule-gate-v2`), 45 of those 56 pass and 11 fail.
- The 56 rules use 8 distinct conditions: 2 among the 45 that pass, 6 among the 11 that fail.
- Proposing ran offline upstream, as a script outside the server (`scripts/propose-rules.ts`). The page says "offline experiment" and does not say the product learns rules by itself.
- The holdout was written by the same author as the reference rule (upstream `logs/2026-10-27_RSI_RULE_LOOP_PLAN.md:160`). The page calls the gate "a fixed test set", not proof of generalisation. The upstream plan records one known remaining shortcut class (deferred to its step D1c). The details text states both limits.

Every number above comes from `$SCRATCH/probe/upstream-numbers.py` (output in `upstream-numbers.out`), which reads the upstream run files.

## 2. What the viewer sees

The Runtime view's "Learning loop" tab has two sub-tabs today ("How it learns", "Measured results"). This plan adds a third, **"Rules, gated"**, key `rules`, reachable at `#view=runtime-observation&tab=learning&sub=rules`.

One screen, one message (the user's UI principle of 2026-11-12: one message per screen, depth behind a link):

1. A headline computed from the data: "Models proposed 56 rules for one failure. The evidence gate admitted 45 and rejected 11."
2. A chip `Measured · offline run` (`.rt-chip data-kind="ran"`).
3. Two cards side by side.
   - **Admitted.** The rule in plain words ("money already paid on the invoice + this payment > invoice amount → block"). Its evidence: "Caught 4 of 4 known violations, flagged 0 of 11 normal payments. On the held-back set: 6 of 6, 0 of 8."
   - **Rejected.** The most common failing condition ("money already paid ≥ invoice amount → block"), proposed 5 times. Its evidence: "Caught 1 of 4 known violations. On the held-back set: 4 of 6." One plain sentence on why: it stops a payment only after the invoice is already paid in full, so it misses a payment that goes over the amount.
4. A closed `<details class="rt-more">` "All 8 rule forms and the gate's five criteria": a `class="dt"` table with one row per distinct condition (plain-words condition, times proposed, dev caught and flagged, holdout caught and flagged, verdict), the five criteria in plain words, and the limits from section 1.

Design question for the reviewers' advice: whether item 4 should be a `<details>` block (smallest diff, the pattern this view already uses) or a separate page.

Not shown: model vendor names. The 11 failing rules all come from one vendor's model, and naming a vendor on a public site is the user's call (section 6). The data file carries neutral ids (`model-a`, `model-b`, `model-c`).

## 3. Data: reports are vendored, the corpus is not

The gate report upstream already has the shape "dev details, holdout counts only" (`contracts/learned-rule.ts` `GateReport`). This plan vendors reports and rule conditions. It does not vendor the corpus or the gate code. Reason: this repo is public and upstream is private, and the holdout facts must stay away from any future proposer (upstream RSI plan, line 139).

Consequence, stated on the page: the browser shows recorded results and cannot re-run the gate.

New file `jev-runtime/demo/data/learned-rules.json`, written by a generator, never by hand:

```
{
  generated_by: "tools/build-learned-rules.mjs",
  source: { repo, commit, files: [{ path, sha256 }] },
  gate: { criteria_version, corpus_sha256, corpus: { dev: 15, holdout: 14 } },
  failure: { class: "invoice_overpayment", ref: "corpus:S10/pay-2" },
  sessions: { total: 60, passed_first_gate: 56 },
  rules: [ {                       // 56 entries, ordered by ordinal
    ordinal, proposer: "model-a" | "model-b" | "model-c",
    condition,                     // the upstream Condition JSON, unchanged
    verdict_on_match: "BLOCK" | "HOLD" | "ALERT",
    report: { verdict: "PASS" | "FAIL",
              dev:     { violations, caught, benign, false_flags },
              holdout: { violations, caught, benign, false_flags },
              failures: [string] }
  } ]
}
```

Left out on purpose: prompts, model responses, model-written descriptions and rationales, dev item lists, token usage and spend.

Generator `tools/build-learned-rules.mjs <upstream checkout>`:

- refuses to run unless the checkout's `HEAD` equals the pinned commit;
- reads `runs/rule-regate-2026-11/gate-reports.json` (key `P4`) and `runs/rule-proposer-2026-10/sessions/*.json` (last attempt's `candidate`, joined by `ordinal`);
- records the sha256 of each input file;
- writes canonical JSON (sorted keys, two-space indent, trailing newline), so a rerun is byte-identical.

## 4. Code shape

One new module `js/rt-learned-rules.js`, importable without a DOM (the pattern of `js/rt-learning-visual.js`):

- `conditionText(condition)` → plain words. A small label table covers the facts that occur in the data; an unknown fact falls back to its key. `add` renders as "a + b"; `all` joins with "and"; `any` joins with "or".
- `ruleForms(data)` → one entry per distinct condition: `{ condition, count, verdict, dev, holdout, failures }`, ordered admitted first, then by count descending, then by first ordinal. Two rules are the same form when their conditions are equal as canonical JSON. The two admitted forms differ only in operand order of `add`; they stay two rows, because the module does not reason about equivalence.
- `summary(data)` → `{ proposed, admitted, rejected, forms }`, all counted from `data.rules`.
- `evidenceText(report)` and `failureText(failures)` → the sentences in section 2.
- `mountLearnedRules(el, data)` → renders section 2 into `el`.

Invariants the data test holds:

- I1. Every report has the same `criteria_version` and `corpus_sha256` as `data.gate`.
- I2. `verdict` is `PASS` exactly when `failures` is empty, and exactly when holdout caught equals holdout violations, dev caught equals dev violations, and both false-flag counts are 0. (Criteria 1 and 2 hold for every vendored rule; the test asserts each split has at least 1 violation and at least 3 benign items.)
- I3. Rules with equal conditions have equal reports.
- I4. `sessions.passed_first_gate` equals `rules.length`.
- I5. No key named `items`, `description`, `rationale`, `response_text` or `facts` appears anywhere in the file.

## 5. Tasks

| # | Task | Owner | Depends on | Acceptance |
|---|---|---|---|---|
| 1 | Generator, data file, data test | planner | none | `node --test tests/site/learned-rules-data.test.mjs` passes; a second generator run leaves `git diff` empty |
| 2 | `js/rt-learned-rules.js` and its unit test | deepseek | 1 | `node --test tests/site/rt-learned-rules.test.mjs` passes; `node --check js/rt-learned-rules.js` exits 0 |
| 3 | Wire the sub-tab into the page, styles, browser test | planner | 2 | the browser test passes; the full suite passes |
| 4 | Mutation checks, screenshots, README and log entries | planner | 3 | each mutation fails the predicted assertion; restored tree passes |

File ownership:

- Task 1 (planner): `tools/build-learned-rules.mjs`, `jev-runtime/demo/data/learned-rules.json`, `tests/site/learned-rules-data.test.mjs`.
- Task 2 (deepseek): `js/rt-learned-rules.js`, `tests/site/rt-learned-rules.test.mjs`. The coder reads the data file and `js/rt-learning-visual.js` as a pattern. It gets no access to the upstream checkout.
- Task 3 (planner): `index.html`, `js/jev-runtime-host.js`, `css/rt-learned-rules.css`, `tests/site/rt-learned-rules-page.test.mjs`.
- Task 4 (planner): `README.md`, `logs/README.md`, `logs/learned-rules-2026-11-12/` (screenshots).
- Record paths: `logs/2026-11-12_LEARNED_RULES_PLAN.md`.

Test design:

- **Data test.** I1 to I5. When the environment variable `JEV_UPSTREAM` names a checkout, the test also reruns the generator into a temp file and compares bytes. Without it that one case is skipped, and CI skips it. The skip is stated in the test name.
- **Unit test.** Expected strings are written from section 2, not copied from a run. `conditionText` on the reference condition; `ruleForms` on a three-rule fixture (two equal, one different) gives two forms with counts 2 and 1; `summary` on the real file equals counts recomputed in the test by a different route (a filter on `report.verdict`).
- **Browser test.** Uses the existing harness (`tests/site/sx-harness.mjs`). The deep link opens the sub-tab; the headline's three numbers equal the counts from the data file; two cards exist with the evidence sentences; the details table has one row per form; the chip reads "Measured"; the two existing sub-tabs still open.
- **Mutations (task 4).** M1: swap `caught` and `false_flags` in `evidenceText`; predicted first failure is the unit test's admitted-evidence assertion. M2: make `summary` count forms instead of rules; predicted first failure is the headline assertion (8 against 56).

Checks before the code gate: the full suite (`node --test tests/site/*.test.mjs`), `node --check js/*.js`, and `node tools/style-audit.mjs` if the style tests call for it.

## 6. Publication and what stays the user's decision

This repo is public and its `main` deploys to demo.opensilex.ai. Upstream is private. So:

- Work stays in local commits on `jwang3417/learned-rules` until the user answers D1.
- **D1.** May the 56 rule conditions, their counts and the gate criteria text go into this public repo? They are synthetic and carry no customer data, but they come from a private repo.
- **D2.** Name the model vendors on the page, or keep neutral ids (the plan's default)?
- Opening the PR, merging it, and so deploying, are the user's.
- No paid model call happens in this build. The generator only reads files.

## 7. Not in this plan

- **The sync with `jev-simplified`.** It follows as its own plan after this one merges. The intended shape: `jev-simplified` takes `learned-rules.json` and `rt-learned-rules.js` from this repo's merge commit, hash-pinned in its `VENDORED.json`, the way it already pins the World Model.
- Porting the gate or the evaluator to the browser, and any "write your own rule" interaction.
- The second failure class (`payee_account_unlinked`) and the swapped-pair result. The data has them upstream; one class keeps the screen to one message.
- A link from a learned rule to a World Model node. No mapping exists in this repo.
- Any change to `jev-runtime/demo/` code or to the existing two sub-tabs.

## 8. Review record

(empty until round 1)
