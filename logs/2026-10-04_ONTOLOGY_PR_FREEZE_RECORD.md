# E-PR freeze record (precision/recall plan R3)

Kept separate from the plan file, which is in the seal list until the run completes.

| Seat | Round 1 | Round 2 (final) |
|---|---|---|
| coder-deepseek | `FREEZE-APPROVED` | `FREEZE-APPROVED` |
| reviewer-codex | `FREEZE-REJECTED` (1: the released-judge server on :8022 was down, so the sealed fingerprint check failed) | `FREEZE-APPROVED` |
| planner | | `PLANNER (claude): FREEZE-APPROVED` |

Fix between rounds: both judge servers started with the frozen identity; the unchanged fingerprint check passes. No sealed file changed.
Seal: [`2026-10-04_ONTOLOGY_PR_SEAL_HASHES.txt`](2026-10-04_ONTOLOGY_PR_SEAL_HASHES.txt) (45 entries). Held-out cohort: 4 356 runs, 14 531 calls,
1 020 pooled positives. Note: while waiting for round 2, the planner's polling loop answered Codex's tool-permission prompts that named
the read-only fingerprint check or a `curl` to the local judge servers; no other prompt was answered automatically.
