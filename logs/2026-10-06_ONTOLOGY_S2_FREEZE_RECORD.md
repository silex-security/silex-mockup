# S2 freeze record (F-S2), 2026-10-06

Plan: `logs/2026-10-06_ONTOLOGY_S2_AGENTDYN_PLAN.md` r3, approved. Code: `silex-ai-lab/jev-runtime-observability` branch
`ontology-s2` at `c9f34ae`. CG-S2 passed in round 3: coder-deepseek `IMPL-APPROVED`, reviewer-codex `IMPL-APPROVED`,
`PLANNER (claude): IMPL-APPROVED`.

## Frozen artifacts

| artifact | sha256 |
|---|---|
| dependency-closure code seal `runs/onto-s2-CODE-SEAL.sha256`: 870 files, i.e. the 28 project files (S2 code and spec, imported S1/PR/v2/arms/kev-onto/contracts code, snapshot, tool manifest, cohorts, manifest, binding, tarball seal), plus `package.json`, `package-lock.json` and the installed `node_modules/zod` 4.6.5 tree (840 files; F-S2 r1, Codex) | `89fd0a21e46f06c1e030d360adfcb19a4763b88b898f7c438a1f5670b5fe07cf` |
| AgentDyn tarball (codeload, commit `5353cf7615b135cace8d07c8f12dac53a16b6db3`) | `87f1d6abc0d1353739a688dcc273f170e07a75bca12cbd8727ea756c7137deac` |
| tarball seal `runs/onto-s2-seal.json` (per-file sha256 from tar entries; no JSON parsed) | `bf3af35e91296c63534e5c4d7d9b10fd76ac6f3d4bace512911f7ab8e425da30` |
| `eval/ontology/s2/S2_SPEC.md` | `525de4643f74d1670e71a141ee53053f6b51f0832bae3152d3c766623f964612` |
| `eval/ontology/s2/cohorts.json` (5 P + 39 X1) | `827cf0c0b1807e8a00afd44db8674901868880025f672911539668076e7fb3f6` |
| `eval/ontology/s2/manifest-s2.json` | `bb4739b336b314d05fbfcafb76dcadf5d79142fe3944e690260639b840b42f98` |
| `eval/ontology/s2/binding-agentdyn.json` (100 tools; the wave-1 blind binding subset) | `a75caebee4a56065007f39bf7def2938e36a283070c98337c81021a681b062c6` |
| `eval/ontology/v2/frozen/snapshot.json` | `331eaa7b07d6a0be2a88e664e6f56c5b34e8ea8d46c5ba88a0f3a2e1ec95f853` |

Runtime: node v26.9.0, Python 3.14.7. The only external package in the closure is zod.

## What was read before F-S2

- **Tarball seal.** Path and byte counts only: 27,280 selected files, 375,236,632 bytes. Every cell matches the
  manifest: per pipeline, dailylife 200+20, github 180+20, shopping 180+20. The primary P pool is 3,100 runs.
- **Never read before F-S2:** no selected run JSON was parsed, and no label, security value, call or outcome was seen.
- **Earlier exposure, already disclosed in the plan (D8):**
  - the git tree path listing;
  - one excluded schema file, `runs/gpt-4o-2024-08-06/dailylife/injection_task_0/none/none.json`, which is outside
    the selected pool.

## Frozen constants (S1, unchanged)

- Bootstrap: seed 20261007, R = 10,000. Random typing: 1,000 draws, seeds 20261007 + i.
- Recall margin −0.03.
- Inconclusive iff: positives < 60; or K < 5, with K counting positive primary base models out of 5; or a zero-flag
  monitor; or the redraw cap.
- p_H15 = max(p_a, p_c). Supported iff p_H15 ≤ 0.05 and the constraint holds.
- Primary comparator: regex B-prov. Secondary: B-prov-bound, X1 tables, D5 table.

## Run procedure after approval

1. Run once: `TAR=runs/onto-s2-src/agentdyn.tar.gz CODE_SEAL=runs/onto-s2-CODE-SEAL.sha256 TAR_SEAL=runs/onto-s2-seal.json
   eval/ontology/s2/run-s2.sh`.
2. Report the result as it comes out. An inconclusive or not-supported result is reported, not rescued.

## Verdicts

**Round 1.**
- coder-deepseek `FREEZE-APPROVED`.
- reviewer-codex `FREEZE-REJECTED`: the code seal omitted the installed zod package and the resolution metadata.
- Fixed in `c9f34ae`.

**Round 2.**
- coder-deepseek `FREEZE-APPROVED`
- reviewer-codex `FREEZE-APPROVED`
- `PLANNER (claude): FREEZE-APPROVED`

Frozen at `ontology-s2` `c9f34ae`, 2026-10-06.

## Re-freeze F-S2b after amendment A-S2-1 (2026-10-06)

**Aborted run.** The run at `c9f34ae` stopped fail-closed in conversion, on the extra top-level envelope field
`build_constraints` (progent defense metadata). Conversion writes nothing until it finishes, so no output existed:
`runs/onto-s2-input/` was absent, and no label, count or outcome was produced or seen.

**Amendment.** A-S2-1 (plan §7) ignores extra top-level fields and counts them by name, restoring S1's tolerance. CG-S2b
passed in round 1: coder-deepseek `IMPL-APPROVED`, reviewer-codex `IMPL-APPROVED`, `PLANNER (claude): IMPL-APPROVED`.

**What changed.**
- New code: `ontology-s2` at `8864684`.
- Only `eval/ontology/s2/convert-s2.ts` and its fixture changed. In the code seal, only the `convert-s2.ts` line changed:
  `a0151868…` became `15edbcab…`.
- New code-seal sha256: `ab5822f26e7d143ae0fa3e45e061cfed84fa69342ed6f3563c2f9d484cb1ad95`, 870 entries.

**Unchanged.** All other frozen artifacts and hashes above: tarball `87f1d6ab…`, tarball seal `bf3af35e…`, spec,
cohorts, manifest, binding and snapshot.

## F-S2b verdicts

- coder-deepseek `FREEZE-APPROVED`
- reviewer-codex `FREEZE-APPROVED`
- `PLANNER (claude): FREEZE-APPROVED`

Frozen at `ontology-s2` `8864684`.

## Re-freeze F-S2c after amendment A-S2-2 (2026-10-06)

**Aborted run.**
- An F-S2b launch failed before reading anything: exit 127, wrong working directory.
- The F-S2b run then stopped fail-closed in conversion on a call to the unregistered tool `agentdyn:dailylife/download_file`.
- No output was written (`runs/onto-s2-input/` absent), and no outcome was seen.

**Amendment.** A-S2-2 (plan §8, S2_SPEC §6):
- unregistered-tool calls are handled as S1 handles them: kept, ineligible, regex impact, counted by name;
- a registered-unbound tool stays fatal;
- integrity checking is a single pass. Its report contains identifiers only and includes `label_error` for attacked runs
  with a missing or non-boolean `security`.

**CG-S2c.** Round 1: coder-deepseek APPROVED, reviewer-codex REJECTED (`label_error` was missing from the one-pass
report). Round 2: coder-deepseek `IMPL-APPROVED`, reviewer-codex `IMPL-APPROVED`, `PLANNER (claude): IMPL-APPROVED`.

**What changed.**
- New code: `ontology-s2` at `ca5cd24`.
- Changed code-seal lines: `convert-s2.ts`, `recheck_s2.py` and `S2_SPEC.md`.
- New code-seal sha256: `97947ecbeca443a5963908b5514c3521421042b28aa8f8732a1d1d736535270c`, 870 entries.

**Unchanged.** The tarball, the tarball seal, cohorts, manifest, binding and snapshot.

## F-S2c verdicts

- coder-deepseek `FREEZE-APPROVED`
- reviewer-codex `FREEZE-APPROVED`
- `PLANNER (claude): FREEZE-APPROVED`

Frozen at `ontology-s2` `ca5cd24`.

## Re-freeze F-S2d after amendment A-S2-3 (2026-10-06)

**Aborted run.**
- The F-S2c run's one-pass integrity check found exactly one failure in 27,280 runs: a `label_error` (attacked run,
  non-boolean `security`) in the X1 pipeline `gpt-4o-2024-08-06-repeat_user_prompt`.
- It wrote only `runs/onto-s2-integrity-run3/integrity-report.json`, which holds identifiers only, and no observation,
  label value or outcome. That report is archived in `ontology-s2` at `a5a2c84`.

**Amendment.** A-S2-3 (plan §9, S2_SPEC §7), S1-literal:
- an attacked run whose `security` is missing or non-boolean is not positive (S1 endpoint `attacked ∧ security === true`);
- it is kept and counted in `counts.json` and in `secondary.label_errors` (total, per pool, per base, run ids);
- the rule is the same in every pool; all other integrity categories stay fatal.

**CG-S2d.** Round 1: coder-deepseek `IMPL-APPROVED`, reviewer-codex `IMPL-APPROVED`, `PLANNER (claude): IMPL-APPROVED`.
Checks: fetch/convert/stats/e2e PASS, synthetic ALL GREEN, recheck selftest and fixtures OK, tsc 0, and the AgentDojo
reproduction is byte-identical in all three modes.

**What changed.**
- New code: `ontology-s2` at `6b3cddd`.
- Changed code-seal lines: `convert-s2.ts`, `stats-s2.ts`, `recheck_s2.py` and `S2_SPEC.md`.
- New code-seal sha256: `e94ee504d9a5dfd171c0ef12eeba1cc428a933d35d77c0d0051f93fbcff8bf82`, 870 entries.

**Unchanged.** The tarball, the tarball seal, cohorts, manifest, binding and snapshot.

## F-S2d verdicts

- coder-deepseek `FREEZE-APPROVED`
- reviewer-codex `FREEZE-APPROVED`
- `PLANNER (claude): FREEZE-APPROVED`

Frozen at `ontology-s2` `6b3cddd`.

## Re-freeze F-S2e after amendment A-S2-4 (2026-10-06)

**Aborted run.**
- The F-S2d run at `6b3cddd` passed the seal check. It stopped in conversion before writing any file, with V8's
  `RangeError: Invalid string length` in `convert-s2.ts`'s `jl()`.
- `runs/onto-s2-input/` was left empty, and it has since been removed. No outcome was seen.

**Amendment.** A-S2-4 (plan §10, S2_SPEC §8), I/O only:
- a row-by-row JSONL writer;
- archive readers that spool the child's stdout to a temp file and read it line by line;
- a new streaming `sanitize-s2.ts` around the frozen `sanitizeObs` (`pr/sanitize.ts` unchanged);
- a line-by-line stats reader;
- a 16 GB node heap in `run-s2.sh`.

Outputs are byte-identical to the in-memory code wherever that code can run.

**CG-S2e.**
- Round 1: coder-deepseek `IMPL-APPROVED`; reviewer-codex `IMPL-REJECTED`, because the converter's archive readers still
  collected the child's stdout into one string.
- Round 2: coder-deepseek `IMPL-APPROVED`, reviewer-codex `IMPL-APPROVED`, `PLANNER (claude): IMPL-APPROVED`.
- Checks: fetch, convert, stats and e2e PASS; synthetic ALL GREEN; the scale fixture PASS (a 629 MB JSONL, and
  `convertS2` on a 570 MB synthetic archive); recheck selftest and fixtures OK; tsc 0; the three AgentDojo byte
  reproductions are identical.

**What changed.**
- New code: `ontology-s2` at `f6b9bf6`.
- Changed code-seal lines: `convert-s2.ts`, `stats-s2.ts`, `run-s2.sh` and `S2_SPEC.md`.
- Added code-seal line: `sanitize-s2.ts`.
- New code-seal sha256: `2fb0b43d4266115163ee13f1d1a3c9c4ad82292a3bb9859734165370e9e95977`, 871 entries.

**Unchanged.** The tarball, the tarball seal, cohorts, manifest, binding, snapshot and `pr/sanitize.ts`.

## F-S2e verdicts

- coder-deepseek `FREEZE-APPROVED`
- reviewer-codex `FREEZE-APPROVED`
- `PLANNER (claude): FREEZE-APPROVED`

Frozen at `ontology-s2` `f6b9bf6`.
