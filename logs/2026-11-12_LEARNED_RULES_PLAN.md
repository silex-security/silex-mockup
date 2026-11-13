# Learned rules behind an evidence gate: plan

Plan version: v0.3 (2026-11-12). Status: draft, plan gate round 3.

## 0. Run settings

- Roster: `standard`. Planner: Claude Code (Fable 5.2). Reviewers: `reviewer-claude` (Opus 5.5) and `reviewer-codex`. Coder, non-voting: DeepSeek.
- Transport: Orca panes.
- Repo: `silex-security/silex-mockup`, worktree `/Users/jianwang/workplace/Silex/silex-mockup-learned-rules`.
- Branch: `jwang3417/learned-rules`. BASE: `44e6acae21bdb158a5f48b00266ad6b37baf4e83` (origin/main, fetched 2026-11-12).
- `$SCRATCH`: `/var/folders/x3/8mdzc51d11j_z0l1mt77lpmr0000gn/T//fleet-ec9AdD`.
- Upstream source: `silex-ai-lab/jev-runtime-observability` at `de4ad51e84fc84c1304f2522f1d1f052f4af7b4c`, read from the local checkout `/Users/jianwang/workplace/Silex/jev-d1b`.
- Reviewer fixtures: `$SCRATCH/upstream/` holds copies of the upstream files the plan cites (`gate-reports.json`, `regate-README.md`, `gate.ts`, `learned-rule.ts`, and `cited-lines.txt` with the three cited passages) and `rules-from-sessions.json` (for each of the 60 sessions: ordinal, model, outcome, turns, the first gate's version and verdict, the last candidate). Reviewers rerun `$SCRATCH/probe/fixture-numbers.py` on those copies; its output is `fixture-numbers.out`. `upstream-numbers.py` is the planner's earlier probe on the real checkout and gives the same counts.
- Baseline at BASE (measured, one run): `node --test tests/site/*.test.mjs` gives 557 tests, 557 pass.

## 1. Goal and claim

The user asked to bring the upstream learned-rule loop into this demo, then sync `jev-simplified` with it. The audience is investors and prospective customers (confirmed by the user 2026-11-12).

One message for the viewer: **a rule that a model proposes is tested against known cases before anyone can publish it, the test was tightened once it proved too loose, and every rule carries its evidence count.**

What the page may claim, and no more. Every number comes from `fixture-numbers.out`.

- The figures are recorded results of an offline experiment in the upstream engine. They are not computed in the browser and they are not production figures.
- 60 model sessions ran (3 model configurations). 56 ended with a candidate rule that passed the first gate (`rule-gate-v1`). 4 ended with no passing rule.
- The first gate was too loose. Its test set had 1 known violation in dev. Probes then found that some of the 56 were wrong. Harder test cases were added, giving the current gate (`rule-gate-v2`). So the cases that now fail the 11 were written with knowledge of them. The page says this in visible text.
- Under the current gate, 45 of the 56 pass and 11 fail. 9 of the 11 fail with identical evidence.
- The 56 candidates use 8 distinct conditions as written: 2 among the 45, 6 among the 11.
- The current test set is synthetic: 29 items, 15 in dev and 14 held back. No customer data. The held-back items were written by the same author as the reference rule (upstream `logs/2026-10-27_RSI_RULE_LOOP_PLAN.md:160`). The upstream plan records one known remaining shortcut class (its step D1c).
- **No model-proposed rule entered a live policy.** Upstream says "There is no learner in the product" (`docs/CONTRACTS.md:337`). The publish path was exercised upstream with the hand-written reference rule only (regate README, row P5). The page uses "passes the gate" and "fails the gate", never "admitted", "live" or "enforced" for the 45.

## 2. What the viewer sees

The Runtime view's "Learning loop" tab has two sub-tabs today ("How it learns", "Measured results"). This plan adds a third, **"Rules, tested"**, key `rules`, reachable at `#view=runtime-observation&tab=learning&sub=rules`.

**The tab's shared header changes.** It reads "The judge learns from your reviewers" today, which would misdescribe the new sub-tab. New heading: "How the judge and the rules can improve, and how each was tested". It names two experiments and does not say the product learns today. The existing paragraph about the judge stays and gains one sentence: "Rules that a model proposes go through a test gate before anyone can publish them." The existing info tip keeps its judge text. Side effect of a third sub-tab: `mountSubnav` adds a "Next: Rules, tested →" button at the end of the "Measured results" panel.

The sub-tab, one screen and one message:

1. A headline computed from the data: "60 model sessions; 56 ended with a rule that passed a first gate. After harder test cases were added, the gate passes 45 and fails 11."
2. A chip `Measured · offline run` (`.rt-chip data-kind="ran"`).
3. A **visible limits line**, outside any `<details>`, with the attribute `data-rt-rules-note`: "Offline experiment on a synthetic 29-item test set. An earlier gate passed all 56. After probes found some of them wrong, harder test cases were added; those cases fail the 11. No proposed rule was put into a live policy. The test set was written by the same author as the reference rule." Its numbers (29, 56, 11) are rendered from the data.
4. Two cards side by side.
   - **Passes the gate.** The rule in plain words ("money already paid on the invoice + this payment > invoice amount → block"). Evidence: "Caught 4 of 4 known violations, flagged 0 of 11 normal payments. On the held-back set: 6 of 6, 0 of 8."
   - **Fails the gate.** Lead line: "9 of the 11 failing rules fail the same way." Example, the most common condition among those 9: "money already paid ≥ invoice amount → block". Evidence: "Caught 1 of 4 known violations. On the held-back set: 4 of 6." One plain sentence: it stops a payment only after the invoice is already paid in full, so it misses a payment that goes over the amount.
5. A closed `<details class="rt-more">` "All 8 conditions and the gate's criteria": a `class="dt"` table with one row per distinct condition (plain words, times written, dev caught and flagged, held-back caught and flagged, pass or fail, which criteria failed), the five criteria in plain words, and the remaining-shortcut limit. Both reviewers advised `<details>` over a separate page.

Not shown and not in the data file: which model wrote which rule (section 3).

## 3. Data: reports are vendored, the corpus is not

The upstream gate report already has the shape "dev details, holdout counts only" (`learned-rule.ts:124`). This plan vendors counts and rule conditions. It does not vendor the corpus or the gate code. Reason: this repo is public and upstream is private, and the held-back facts must stay away from any future proposer (upstream RSI plan, line 139).

Consequence, stated in the details text: the browser shows recorded results and cannot re-run the gate.

New file `jev-runtime/demo/data/learned-rules.json`, written by a generator, never by hand:

```
{
  generated_by: "tools/build-learned-rules.mjs",
  source: { repo, commit, files: [{ path, sha256 }] },
  failure_class: "invoice_overpayment",
  sessions: { total: 60, with_candidate: 56 },
  first_gate: { criteria_version: "rule-gate-v1", corpus_sha256, passed: 56 },
  gate: { criteria_version: "rule-gate-v2", corpus_sha256, corpus: { dev: 15, holdout: 14 } },
  rules: [ {                       // 56 entries, ordered by ordinal
    ordinal,
    condition,                     // the upstream Condition JSON, unchanged
    verdict_on_match: "BLOCK" | "HOLD" | "ALERT",
    report: { verdict: "PASS" | "FAIL",
              dev:     { violations, caught, benign, false_flags },
              holdout: { violations, caught, benign, false_flags },
              failed_criteria: [3, 5] }   // criterion numbers only
  } ]
}
```

Changes from v0.1: no `proposer`; no `failure.ref`; the raw `failures` strings (which carry dev item ids such as `OP-D1`) become `failed_criteria`, the leading number of each string; the gate identity lives once in `gate`; `first_gate` is new.

Left out on purpose: prompts, model responses, model names, model-written descriptions and rationales, item ids and item lists, token usage and spend.

Generator `tools/build-learned-rules.mjs <upstream checkout>`:

- refuses to run unless the checkout's `HEAD` equals the pinned commit;
- reads `runs/rule-regate-2026-11/gate-reports.json` (key `P4`), `runs/rule-proposer-2026-10/sessions/*.json` (outcome, the last attempt's `candidate` and `gate`, joined by `ordinal`). It does not read the corpus: the split sizes are `violations + benign` from the reports, which must agree across all 56;
- **refuses mixed inputs**: every `P4` report must carry the same `criteria_version` and `corpus_sha256`; every session with outcome `passed` must carry a first-gate `PASS` under one `criteria_version` and `corpus_sha256`; every `P4` ordinal must be a `passed` session. This is where v0.1's I1 now lives;
- records two `source.files` entries: `gate-reports.json` with its sha256, and the sessions directory with a manifest hash (the sha256 of the sorted lines `<file name> <file sha256>` over its 60 files);
- writes canonical JSON (sorted keys, two-space indent, trailing newline), so a rerun is byte-identical.

## 4. Code shape

One new module `js/rt-learned-rules.js`, importable without a DOM (the pattern of `js/rt-learning-visual.js`):

- `conditionText(condition)` → plain words. A small label table covers the facts that occur in the data; an unknown fact falls back to its key. `add` renders as "a + b"; `all` joins with "and"; `any` joins with "or".
- `ruleForms(data)` → one entry per distinct condition: `{ condition, count, verdict, dev, holdout, failed_criteria }`, ordered passing first, then by count descending, then by first ordinal. Two rules are the same form when their conditions are equal as canonical JSON. The two passing forms differ only in the operand order of `add`; they stay two rows, and the table header says "as written".
- `summary(data)` → `{ sessions, candidates, passed, failed, forms, sameWayFailed }`. `sameWayFailed` is the size of the largest group of failing rules with equal `dev` and `holdout` counts.
- `evidenceText(report)`, `criteriaText(n)` → the sentences in section 2.
- `mountLearnedRules(el, data)` → renders section 2, items 1 to 5, into `el`.

Invariants the data test holds on the public file:

- I1. `first_gate.passed` equals `sessions.with_candidate` equals `rules.length`. `sessions.total` is not smaller.
- I2. For every rule, `verdict` is `PASS` exactly when `failed_criteria` is empty. Criterion 3 is listed exactly when holdout caught is below holdout violations, criterion 4 exactly when a false-flag count is above 0, criterion 5 exactly when dev caught is below dev violations. Criteria 1 and 2 are listed for no rule, and each split has at least 1 violation and 3 benign items. This is a property of these 56 valid reports, not a restatement of the gate.
- I3. Rules with equal conditions have equal `verdict_on_match` and equal `report` (all vendored fields).
- I4. `dev.violations + dev.benign` equals `gate.corpus.dev` and the same for holdout, for every rule.
- I5. Leak check on the file's text: no key named `items`, `description`, `rationale`, `response_text`, `facts`, `proposer` or `model`; and no string value matches an item id (`/\b(OP-[DH]\d+|[SF]\d+\/pay)/`) or a model vendor name (`/deepseek|gemini|agy/i`).

## 5. Tasks

| # | Task | Owner | Depends on | Acceptance |
|---|---|---|---|---|
| 1 | Generator, data file, data test | planner | none | `node --test tests/site/learned-rules-data.test.mjs` passes; a second generator run leaves `git diff` empty |
| 2 | `js/rt-learned-rules.js` and its unit test | deepseek | 1 | `node --test tests/site/rt-learned-rules.test.mjs` passes; `node --check js/rt-learned-rules.js` exits 0 |
| 3 | Wire the sub-tab into the page, header text, styles, browser test, visible-notes registration | planner | 2 | the browser test passes; the full suite passes |
| 4 | Mutation checks, screenshots, README and log entries | planner | 3 | each mutation fails the predicted assertions; restored tree passes |

File ownership:

- Task 1 (planner): `tools/build-learned-rules.mjs`, `jev-runtime/demo/data/learned-rules.json`, `tests/site/learned-rules-data.test.mjs`.
- Task 2 (deepseek): `js/rt-learned-rules.js`, `tests/site/rt-learned-rules.test.mjs`. The coder reads the data file and `js/rt-learning-visual.js` as a pattern. It gets no access to the upstream checkout or to `$SCRATCH/upstream/`.
- Task 3 (planner): `index.html`, `js/jev-runtime-host.js`, `css/rt-learned-rules.css`, `tests/site/rt-learned-rules-page.test.mjs`, `tests/site/rt-subnav.test.mjs` (add `NOTES.learning.rules` and its `TEXT` pattern), `tests/site/run-site-probes.mjs` (line 442 asserts the old heading; it is a runner, not a `*.test.mjs`), and any other test that asserts the old tab heading.
- Task 4 (planner): `README.md`, `logs/README.md`, `logs/learned-rules-2026-11-12/` (screenshots).
- Record paths: `logs/2026-11-12_LEARNED_RULES_PLAN.md`.

Test design:

- **Data test.** I1 to I5. When the environment variable `JEV_UPSTREAM` names a checkout, the test also reruns the generator into a temp file and compares bytes. Without it that one case is skipped, and CI skips it. The skip is stated in the test name.
- **Unit test.** Expected strings are written from section 2, not copied from a run. `conditionText` on the reference condition; `ruleForms` on a three-rule fixture (two equal, one different) gives two forms with counts 2 and 1; `summary` on the real file equals counts the test recomputes by its own filter on `report.verdict`.
- **Browser test.** Uses the existing harness. Opened by the deep link, at 1280 px and at 390 px:
  - the tab heading and the sub-tab headline are both visible, and the heading is the new text;
  - the headline's four numbers equal counts the test computes itself from the JSON file (its own filter, not `summary()`);
  - the limits line is visible, is not inside a `<details>`, and contains both "After probes found some of them wrong, harder test cases were added" and "No proposed rule was put into a live policy";
  - two cards exist with the evidence sentences;
  - the details table has one row per distinct condition and does not overflow the page at 390 px;
  - the two existing sub-tabs still open.
- **Visible-notes rule.** `tests/site/rt-subnav.test.mjs` gets the new sub-tab's note selector and a `TEXT` pattern for the "After probes found" clause, so the repo's existing check holds the limits line to visible text.
- **Mutations (task 4).** M1: swap `caught` and `false_flags` in `evidenceText`; predicted failure: the unit test's passing-rule evidence assertion ("Caught 0 of 4 … flagged 4 of 11" against the expected sentence). M2: make `summary` count forms instead of rules; predicted failures: the unit test's `summary` assertion and the browser test's headline assertion (8 against 56).

Checks before the code gate: the full suite (`node --test tests/site/*.test.mjs`), `node --check js/*.js`, and `node tests/site/run-site-probes.mjs` (compared with its result at BASE, since it is not part of the suite).

## 6. Publication and what stays the user's decision

This repo is public and its `main` deploys to demo.opensilex.ai. Upstream is private. So:

- Work stays in local commits on `jwang3417/learned-rules` until the user answers D1.
- **D1.** May the following go into this public repo? Everything the data file publishes: the 56 rule conditions (fact names from the upstream catalog, operators, constants) and their `BLOCK` verdict; the pass and fail counts per split; the failed criterion numbers; the two gate version names and the two corpus hashes; the split sizes; the session counts; the failure class name; the upstream repo name, the pinned commit, and two internal paths (one file, one directory) with their hashes. Plus, in page text and the plan: the five gate criteria in plain words. All of it is synthetic and none of it is customer data, but it comes from a private repo. (The repo name is already public in `jev-runtime/VENDORED.json`.)
- **D2.** Model vendor names. The plan's default is that no model or vendor name appears in the data file or on the page. The user may ask for them.
- Opening the PR, merging it, and so deploying, are the user's.
- No paid model call happens in this build. The generator only reads files.

## 7. Not in this plan

- **The sync with `jev-simplified`.** It follows as its own plan after this one merges. The intended shape: `jev-simplified` takes `learned-rules.json` and `rt-learned-rules.js` from this repo's merge commit, hash-pinned in its `VENDORED.json`, the way it already pins the World Model.
- Porting the gate or the evaluator to the browser, and any "write your own rule" interaction.
- The second failure class (`payee_account_unlinked`) and the swapped-pair result. One class keeps the screen to one message.
- A link from a rule to a World Model node. No mapping exists in this repo.
- Any change to `jev-runtime/demo/` code. The two existing sub-tabs keep their content; the only changes they see are the shared heading and the automatic "Next" button (section 2).

## 8. Review record

### Round 1 (plan v0.1): both reviewers PLAN-REJECTED

Reply files: `$SCRATCH/lr-codex-plan-r1.md`, `$SCRATCH/lr-claude-plan-r1.md`.

| Objection (who) | Change in v0.2 |
|---|---|
| The 56 are survivors of the first gate from 60 sessions, not "all rules proposed" (codex 1, claude 1) | Headline starts from 60 sessions and 56 candidates (sections 1, 2). `sessions` and `first_gate` are in the data. |
| "Admitted" and "rejected" read as deployed; no proposed rule entered a policy; the publish path used the hand-written rule (codex 1, claude 1) | "Passes the gate" and "fails the gate" throughout. The limits line says no proposed rule was put into a live policy. Sub-tab renamed "Rules, tested". |
| The gate was revised after the 11 were found wrong; "fixed gate" hides that (claude 1) | "Fixed" dropped from the message. Section 1 states the sequence. The visible limits line says an earlier gate passed all 56. `first_gate` vendors the fact and I1 holds it. |
| Limits sit only inside a closed `<details>`, which this repo's visible-notes test forbids; synthetic and weak-holdout limits must be findable beside the headline (claude 2, codex 1) | Visible limits line with `data-rt-rules-note` (section 2, item 3). Registered in `tests/site/rt-subnav.test.mjs`, now in task 3's files. |
| The tab header "The judge learns from your reviewers" misdescribes the new sub-tab; test the context with `sub=rules` (codex 2, claude 2) | Shared heading reworded and one sentence added (section 2). The browser test asserts heading and headline together. Section 7 no longer says the tab is untouched. |
| I1 tests fields the vendored shape lacks (codex 3, claude 3) | Gate identity is stored once. The mixed-input check moved into the generator (section 3). New I1 and I4 test what the file carries. |
| I3 "equal reports" undefined once `rule_sha256` is dropped (claude 3) | I3 is defined on the vendored fields. |
| `failures` strings carry dev item ids; I5 checks only key names (codex 3, claude 3) | `failures` replaced by `failed_criteria` numbers. I5 also scans string values for item ids and vendor names. |
| D1 must list every published field, including repo name, paths, commit, hashes (claude 3) | D1 rewritten as the full list. `failure.ref` dropped. |
| Non-blocking, folded in: drop `proposer` (claude); browser test counts with its own filter, M2 predicts both failures (both); say the "Next" button appears (claude); lead the failing card with "9 of 11 fail the same way" (claude); name which probe reviewers rerun (claude); I2 is a property of these 56 reports (codex); 390 px overflow check (codex) | Sections 0, 2, 4, 5, 7. |
| Non-blocking, not taken: show the two passing forms as one row "2 orderings" (claude) | The module does not reason about equivalence. The table says "as written" and keeps 8 rows, so the data test and the screen count the same thing. |
| Non-blocking, not taken: an eight-form aggregate file instead of 56 entries (codex) | 56 entries keep the join to upstream ordinals auditable; the file stays small. |

### Round 2 (plan v0.2): both reviewers PLAN-REJECTED, two text points each, the same two

Reply files: `$SCRATCH/lr-codex-plan-r2.md`, `$SCRATCH/lr-claude-plan-r2.md`. reviewer-claude: "Both are text changes. Everything else in v0.2 I accept."

| Objection (who) | Change in v0.3 |
|---|---|
| The visible limits line says only "the gate was then tightened"; it must say the harder cases came after the weak rules were found (codex 2, claude 1) | Limits line now reads "After probes found some of them wrong, harder test cases were added; those cases fail the 11." The browser test and the `TEXT` pattern assert the clause. |
| The shared heading "both learn" claims a product capability; upstream says there is no learner in the product (codex 1, claude 2) | Heading is now "How the judge and the rules can improve, and how each was tested". The browser test asserts it. |
| Non-blocking, folded in: headline says the 56 passed a first gate (claude); the one message in past tense (claude); `source.files` specified as one file and one directory manifest, D1 corrected (claude); `run-site-probes.mjs` named in task 3 and in the checks (claude); the generator takes split sizes from the reports and no longer reads the corpus (codex) | Sections 1, 2, 3, 5, 6. |
