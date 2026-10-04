# Stage-1 freeze record (plan R3)

Kept separate from the plan file, which is in the seal list until the run completes.

| Seat | Round 1 | Round 2 (final) |
|---|---|---|
| coder-deepseek | `FREEZE-APPROVED` | `FREEZE-APPROVED` |
| reviewer-codex | `FREEZE-REJECTED` (1: the input manifest was not covered by the seal) | `FREEZE-APPROVED` |
| planner | | `PLANNER (claude): FREEZE-APPROVED` |

Fix between rounds: `runs/onto-s1-INPUT-MANIFEST.sha256` committed and, with `runs/onto-s1-input/counts.json`, appended to the seal
(35 entries); a tampered manifest made `run-s1.sh` abort with SEAL MISMATCH before any statistic. Held-out pool: 12 195 runs, 48 747
calls, 0 parse failures, 2 469 pooled positives, 18 cohorts.
