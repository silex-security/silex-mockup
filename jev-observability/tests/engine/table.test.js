// Section 4 required engine behaviour table, asserted at seed 7.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStream, TENANT } from '../../js/engine/scenarios.js';
import { DEFAULT_POLICY } from '../../js/engine/types.js';
import { runStream } from '../../js/engine/router.js';
import { runScenario } from './helpers.js';

test('S1: every pre_tool span → ALLOW / policy', () => {
  const envs = runScenario('S1', 7);
  assert.equal(envs.length, 3);
  for (const e of envs) {
    assert.equal(e.boundary, 'pre_tool');
    assert.equal(e.decision, 'ALLOW');
    assert.equal(e.decided_by, 'policy');
  }
});

test('S2: payments.execute → REVIEW via payee_mismatch review band', () => {
  const [e] = runScenario('S2', 7);
  assert.equal(e.tool.name, 'payments.execute');
  assert.equal(e.decision, 'REVIEW');
  assert.equal(e.decided_by, 'jev');
  const pm = e.answers.payee_mismatch;
  const t = DEFAULT_POLICY.thresholds.payee_mismatch;
  assert.ok(pm.risk >= t.review_threshold, `risk ${pm.risk} >= ${t.review_threshold}`);
  assert.ok(pm.risk < t.block_threshold, `risk ${pm.risk} < ${t.block_threshold}`);
});

test('S3: payments.execute → BLOCK (amount_limit), all Jev risks below review', () => {
  const [e] = runScenario('S3', 7);
  assert.equal(e.decision, 'BLOCK');
  assert.equal(e.decided_by, 'rule');
  assert.ok(e.rule_hits.some(h => h.id === 'amount_limit'));
  for (const qid of ['exfil', 'payee_mismatch', 'intervene']) {
    const a = e.answers[qid];
    const t = DEFAULT_POLICY.thresholds[qid];
    assert.ok(a.risk < t.review_threshold, `${qid} risk ${a.risk} < ${t.review_threshold}`);
  }
  assert.ok(1 - e.answers.attack.dist.safe < DEFAULT_POLICY.choice_review_threshold);
});

test('S4: payments.execute → HOLD (approval_evidence), attack dist.safe ≥ 0.9', () => {
  const [e] = runScenario('S4', 7);
  assert.equal(e.decision, 'HOLD');
  assert.equal(e.decided_by, 'rule');
  assert.ok(e.rule_hits.some(h => h.id === 'approval_evidence'));
  assert.ok(e.answers.attack.dist.safe >= 0.9, `safe ${e.answers.attack.dist.safe} >= 0.9`);
});

test('S5: pre_tool ALLOW / post_tool ALERT (readback_mismatch)', () => {
  const envs = runScenario('S5', 7);
  assert.equal(envs.length, 2);
  const [pre, post] = envs;
  assert.equal(pre.decision, 'ALLOW');
  assert.equal(pre.decided_by, 'policy');
  assert.equal(post.boundary, 'post_tool');
  assert.equal(post.decision, 'ALERT');
  assert.equal(post.decided_by, 'rule');
  assert.ok(post.rule_hits.some(h => h.id === 'readback_mismatch'));
});

test('S6: pre_input ALLOW / email.send BLOCK (domain_allowlist), exfil.p ≥ 0.8, attack top ≠ safe', () => {
  const [pre, send] = runScenario('S6', 7);
  assert.equal(pre.boundary, 'pre_input');
  assert.equal(pre.decision, 'ALLOW');
  assert.equal(pre.decided_by, 'policy');
  assert.equal(send.boundary, 'pre_tool');
  assert.equal(send.decision, 'BLOCK');
  assert.equal(send.decided_by, 'rule');
  assert.ok(send.rule_hits.some(h => h.id === 'domain_allowlist'));
  assert.ok(send.answers.exfil.p >= 0.8, `exfil.p ${send.answers.exfil.p} >= 0.8`);
  assert.notEqual(send.answers.attack.top, 'safe');
});

test('F1: lookup ALLOW + alert / payment BLOCK, both L2 fallback', () => {
  const [lookup, payment] = runScenario('F1', 7);
  assert.equal(lookup.tool.name, 'vendor.lookup');
  assert.equal(lookup.decision, 'ALLOW');
  assert.equal(lookup.decided_by, 'fallback');
  assert.equal(lookup.alert, true);
  assert.equal(lookup.fallback_level, 'L2');
  assert.equal(payment.tool.name, 'payments.execute');
  assert.equal(payment.decision, 'BLOCK');
  assert.equal(payment.decided_by, 'fallback');
  assert.equal(payment.fallback_level, 'L2');
});

test('every background span is not BLOCK/HOLD/STOP (seed 7)', () => {
  const envs = runStream(buildStream(7), {
    tenant: TENANT, policy: DEFAULT_POLICY, seed: 7, history: [], faults: null,
  });
  for (const e of envs) {
    if (!e.scenario) {
      assert.ok(!['BLOCK', 'HOLD', 'STOP'].includes(e.decision),
        `background ${e.span_id} → ${e.decision}`);
    }
  }
});
