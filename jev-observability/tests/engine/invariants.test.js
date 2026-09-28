// Invariants across seeds 1..20: background traffic never blocks, and a
// threshold sweep (0.05 steps, valid bands) never changes S3/S4's decision.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStream, TENANT } from '../../js/engine/scenarios.js';
import { DEFAULT_POLICY } from '../../js/engine/types.js';
import { runStream } from '../../js/engine/router.js';
import { validatePolicy } from '../../js/engine/policy.js';
import { runScenario } from './helpers.js';

const NOUL_QUESTIONS = ['exfil', 'payee_mismatch', 'grounded', 'intervene'];

test('seeds 1..20: background traffic never BLOCK/HOLD/STOP', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const envs = runStream(buildStream(seed), {
      tenant: TENANT, policy: DEFAULT_POLICY, seed, history: [], faults: null,
    });
    for (const e of envs) {
      if (!e.scenario) {
        assert.ok(!['BLOCK', 'HOLD', 'STOP'].includes(e.decision),
          `seed ${seed} background ${e.span_id} → ${e.decision}`);
      }
    }
  }
});

test('seeds 1..20: threshold sweep never changes S3/S4 decision or decided_by', () => {
  for (let seed = 1; seed <= 20; seed++) {
    for (const scenarioId of ['S3', 'S4']) {
      const baseline = runScenario(scenarioId, seed)[0];
      for (const qid of NOUL_QUESTIONS) {
        for (let r = 0.05; r < 1; r += 0.05) {
          for (let b = r + 0.05; b <= 1; b += 0.05) {
            const policy = {
              ...DEFAULT_POLICY,
              thresholds: { ...DEFAULT_POLICY.thresholds, [qid]: { review_threshold: r, block_threshold: b } },
            };
            assert.equal(validatePolicy(policy).ok, true);
            const e = runScenario(scenarioId, seed, { policy })[0];
            assert.equal(e.decision, baseline.decision,
              `sweep changed ${scenarioId} (seed ${seed}, ${qid} ${r}/${b})`);
            assert.equal(e.decided_by, baseline.decided_by,
              `sweep changed ${scenarioId} decided_by (seed ${seed}, ${qid} ${r}/${b})`);
          }
        }
      }
    }
  }
});
