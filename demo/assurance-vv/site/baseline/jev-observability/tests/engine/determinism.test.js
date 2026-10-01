// Determinism, feature provenance, and KPI consistency.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { percentile, computeKpis } from '../../js/engine/kpi.js';
import { toSiemLine } from '../../js/engine/siem.js';
import { buildFixture } from '../../tools/build-fixture.js';
import { allEnvelopes } from './helpers.js';

test('percentile uses nearest-rank and returns null for empty', () => {
  assert.equal(percentile([1, 2, 3, 4], 0.5), 2);
  assert.equal(percentile([1, 2, 3, 4, 5], 0.5), 3);
  assert.equal(percentile([10], 0.95), 10);
  assert.equal(percentile([], 0.5), null);
  assert.equal(percentile(null, 0.5), null);
});

test('same seed ⇒ byte-identical decision log', () => {
  assert.equal(JSON.stringify(allEnvelopes(7)), JSON.stringify(allEnvelopes(7)));
});

test('buildFixture is byte-identical across calls', () => {
  const a = JSON.stringify(buildFixture());
  const b = JSON.stringify(buildFixture());
  assert.equal(a, b);
});

test('every Noul answer lists ≥ 1 features_used', () => {
  for (const e of allEnvelopes(7)) {
    for (const ans of Object.values(e.answers)) {
      if (ans.type === 'noul') {
        assert.ok(Object.keys(ans.features_used).length >= 1, `${e.span_id} noul has no features_used`);
      }
    }
  }
});

test('choice/score distributions sum to 1 ± 0.002', () => {
  for (const e of allEnvelopes(7)) {
    for (const ans of Object.values(e.answers)) {
      if (ans.type === 'choice' || ans.type === 'score') {
        const sum = Object.values(ans.dist).reduce((a, b) => a + b, 0);
        assert.ok(Math.abs(sum - 1) <= 0.002, `${e.span_id} dist sums to ${sum}`);
      }
    }
  }
});

test('computeKpis matches a manual recomputation from the raw log', () => {
  const envs = allEnvelopes(7);
  const k = computeKpis(envs);

  assert.equal(k.routed, envs.length);
  assert.equal(k.pre_tool, envs.filter(e => e.boundary === 'pre_tool').length);
  assert.equal(k.blocks, envs.filter(e => e.decision === 'BLOCK').length);
  assert.equal(k.holds, envs.filter(e => e.decision === 'HOLD').length);
  assert.equal(k.reviews, envs.filter(e => e.decision === 'REVIEW').length);
  assert.equal(k.alerts, envs.filter(e => e.decision === 'ALERT').length);
  assert.equal(k.stops, envs.filter(e => e.decision === 'STOP').length);

  assert.equal(k.review_rate, (k.reviews + k.holds + k.alerts + k.stops) / k.routed);

  const labelledAllow = envs.filter(e => e.label?.expected === 'ALLOW');
  const falseBlocks = labelledAllow.filter(e => ['BLOCK', 'HOLD', 'STOP'].includes(e.decision)).length;
  assert.equal(k.false_block_rate, labelledAllow.length ? falseBlocks / labelledAllow.length : 0);

  const labelledP0 = envs.filter(e => ['BLOCK', 'HOLD'].includes(e.label?.expected));
  const p0Caught = labelledP0.filter(e => ['BLOCK', 'HOLD', 'STOP'].includes(e.decision)).length;
  assert.equal(k.p0_recall, labelledP0.length ? p0Caught / labelledP0.length : 0);

  const preTool = envs.filter(e => e.boundary === 'pre_tool');
  const preToolDecided = preTool.filter(e => e.decision && e.decided_by).length;
  assert.equal(k.coverage, preTool.length ? preToolDecided / preTool.length : 0);

  assert.equal(k.jev_calls, envs.length);
  const okCalls = envs.filter(e => e.jev_status === 'ok');
  const totalCost = okCalls.reduce((s, e) => s + e.cost_usd, 0);
  assert.equal(k.jev_cost_per_1k_usd, okCalls.length ? (totalCost / okCalls.length) * 1000 : 0);

  assert.equal(k.labelled_allow, labelledAllow.length);
  assert.equal(k.labelled_p0, labelledP0.length);
});

test('toSiemLine is one JSON line with no raw text/args', () => {
  const env = allEnvelopes(7)[0];
  const line = toSiemLine(env);
  assert.equal(line.split('\n').length, 1);
  const obj = JSON.parse(line);
  assert.equal(obj.trace_id, env.trace_id);
  assert.equal(obj.simulated, true);
  assert.equal(obj.decision, env.decision);
  for (const banned of ['text', 'args', 'reasons', 'features', 'answers', 'sources']) {
    assert.ok(!(banned in obj), `SIEM line leaked ${banned}`);
  }
});
