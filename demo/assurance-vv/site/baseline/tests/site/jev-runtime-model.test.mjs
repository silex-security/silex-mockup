// D1 of logs/2026-09-30_JEV_RUNTIME_VALIDATION_PLAN.md §1.2–1.4, §2: the Runtime Validation summary model.
// Recomputed independently through runStream, so a model bug cannot be masked by the same code it uses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeRun, summarize } from '../../js/jev-runtime-model.js';
import { runStream } from '../../jev-runtime/demo/js/engine/router.js';
import { TENANT, scenariosFor } from '../../jev-runtime/demo/js/engine/scenarios.js';
import { DEFAULT_POLICY } from '../../jev-runtime/demo/js/engine/types.js';

const NON_EXEC = new Set(['hold_for_review', 'hold_for_approval', 'deny', 'stop_and_handover']);
const preTools = envs => envs.filter(e => e.boundary === 'pre_tool');

const EXPECTED_LABELS = {
  S1: 'all ran', S2: 'review · judge', S3: 'blocked · rule', S4: 'held · rule', S5: 'ran · flagged', S6: 'blocked · rule', F1: 'blocked · fallback',
  SOC1: 'all ran', SOC2: 'held · rule', SOC3: 'held · rule', SOC4: 'blocked · rule', SOC5: 'review · judge',
};

test('metrics equal an independent recomputation over all 12 scenarios', () => {
  const metrics = { scenarios: 0, checked: 0, stopped: 0, rule: 0 };
  for (const domain of ['ap', 'soc']) for (const t of scenariosFor(domain)) {
    const pre = preTools(runStream(t.spans, { tenant: TENANT, policy: DEFAULT_POLICY, seed: 7 }));
    metrics.scenarios += 1;
    metrics.checked += pre.length;
    metrics.stopped += pre.filter(e => NON_EXEC.has(e.action)).length;
    metrics.rule += pre.filter(e => e.decided_by === 'rule').length;
  }
  assert.equal(metrics.scenarios, 12);
  assert.deepEqual(summarize().metrics, metrics);
});

test('every scenario carries its domain, title, outcome chip and line', () => {
  const s = summarize();
  assert.equal(s.reference, 'simulated · seed 7 · policy-v1 reference set');
  assert.deepEqual(s.scenarios.map(x => x.domain), [...Array(7).fill('ap'), ...Array(5).fill('soc')]);
  assert.deepEqual(s.scenarios.map(x => x.id), ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'F1', 'SOC1', 'SOC2', 'SOC3', 'SOC4', 'SOC5']);
  for (const sc of s.scenarios) {
    assert.equal(sc.outcome.label, EXPECTED_LABELS[sc.id], sc.id);
    assert.ok(typeof sc.title === 'string' && sc.title.length, sc.id + ' has a title');
    assert.match(sc.line, new RegExp(`^${sc.id} · `), sc.id + ' line is prefixed');
  }
});

test('the result lines for S3, SOC2 and SOC5 are exact', () => {
  const line = id => summarize().scenarios.find(x => x.id === id).line;
  assert.equal(line('S3'), 'S3 · 1 action: payments.execute blocked by rule amount_limit; 0 ran.');
  assert.equal(line('SOC2'), 'SOC2 · 3 actions: firewall.allowlist_ip held for approval by rule allowlist_change_approval; 2 ran.');
  assert.equal(line('SOC5'), 'SOC5 · 4 actions: identity.suspend_user held for review by the judge threshold (×2); 2 ran.');
});

test('a monitor-mode edit is described from the envelopes, not the reference', () => {
  const s3 = scenariosFor('ap').find(t => t.scenario === 'S3');
  const policy = structuredClone(DEFAULT_POLICY);
  policy.tools['payments.execute'].mode = 'monitor';
  const envs = runStream(s3.spans, { tenant: TENANT, policy, seed: 7 });
  const pay = preTools(envs)[0];
  assert.equal(pay.action, 'allow', 'monitor never enforces');
  assert.equal(pay.would_have, 'BLOCK');
  assert.equal(describeRun(envs, { id: 'S3' }), 'S3 · 1 action: payments.execute ran in monitor mode (would have been blocked); 1 ran.');
});

test('no result line claims delivery', () => {
  for (const sc of summarize().scenarios) {
    assert.doesNotMatch(sc.line, /\b(sent to|exported to|delivered to|forwarded to)\b|OTLP/i, sc.id);
  }
  const monitor = structuredClone(DEFAULT_POLICY);
  monitor.tools['payments.execute'].mode = 'monitor';
  const s3 = scenariosFor('ap').find(t => t.scenario === 'S3');
  assert.doesNotMatch(describeRun(runStream(s3.spans, { tenant: TENANT, policy: monitor, seed: 7 }), { id: 'S3' }), /sent to|exported to|delivered to|forwarded to|OTLP/i);
});
