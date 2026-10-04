# E-AL freeze record (showcase plan Part A)

Kept separate from the plan file because the plan is itself in the seal list until the run completes.

| Seat | Round 1 | Round 2 | Round 3 (final) |
|---|---|---|---|
| coder-deepseek | `FREEZE-APPROVED` | `FREEZE-APPROVED` | `FREEZE-APPROVED` |
| reviewer-codex | `FREEZE-REJECTED` (2: dependency closure not sealed; run-al.sh not fail-closed on output agreement) | `FREEZE-REJECTED` (1: `seal()` did not fail closed under `&&`) | `FREEZE-APPROVED` |
| planner | | | `PLANNER (claude): FREEZE-APPROVED` |

Seal: [`2026-10-04_ONTOLOGY_AL_SEAL_HASHES.txt`](2026-10-04_ONTOLOGY_AL_SEAL_HASHES.txt) (61 entries: E-AL spec and code, both
implementations, fixtures, fault test, the showcase generator, the full repository-local dependency closure, `package-lock.json`,
the frozen v2 binding/snapshot/manifest, the held-out input manifest and counts, and the approved plan). Held-out cohort: 3 630
runs, 12 637 calls, 467 pooled positives.
