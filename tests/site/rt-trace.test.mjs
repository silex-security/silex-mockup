// gateTrace lays the gate checks of one run on a shared time axis. Pure, no DOM.
// The expected values are worked out by hand from the two envelopes below.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gateTrace } from '../../js/rt-trace.js';
import { runStream } from '../../jev-runtime/demo/js/engine/router.js';
import { TENANT, scenariosFor } from '../../jev-runtime/demo/js/engine/scenarios.js';
import { DEFAULT_POLICY } from '../../jev-runtime/demo/js/engine/types.js';

const allowed = {
  boundary: 'pre_tool', agent: 'ap-agent', tool: { name: 'erp.get_po' }, action: 'allow', decided_by: 'policy',
  decision_latency_ms: 70, latency_breakdown: { rules: 5, serialize: 10, jev: 50, policy: 5 },
};
const blocked = {
  boundary: 'pre_tool', agent: 'ap-agent', tool: { name: 'payments.execute' }, action: 'deny', decided_by: 'rule',
  rule_hits: [{ id: 'amount_limit' }], decision_latency_ms: 10, latency_breakdown: { rules: 10, serialize: 0, jev: 0, policy: 0 },
};

test('actions follow one another on the gate-time axis', () => {
  const t = gateTrace([allowed, blocked]);
  assert.equal(t.agent, 'ap-agent');
  assert.equal(t.total, 80);
  assert.deepEqual(t.actions.map(a => [a.tool, a.start, a.end, a.exit]), [['erp.get_po', 0, 70, 'allow'], ['payments.execute', 70, 80, 'block']]);
});

test('each action splits into its checks, in pipeline order', () => {
  const [a] = gateTrace([allowed, blocked]).actions;
  assert.deepEqual(a.checks.map(c => [c.key, c.start, c.end]), [['rules', 0, 5], ['serialize', 5, 15], ['judge', 15, 65], ['policy', 65, 70]]);
});

test('a check that took no time is left out', () => {
  const [, b] = gateTrace([allowed, blocked]).actions;
  assert.deepEqual(b.checks.map(c => [c.key, c.start, c.end]), [['rules', 70, 80]]);
});

test('counts outcomes and marks the slowest action', () => {
  const t = gateTrace([allowed, blocked]);
  assert.deepEqual(t.counts, { allow: 1, hold: 0, block: 1 });
  assert.deepEqual(t.actions.map(a => a.slowest), [true, false]);
});

test('a single action is not called the slowest', () => {
  assert.deepEqual(gateTrace([blocked]).actions.map(a => a.slowest), [false]);
});

test('non pre_tool envelopes are ignored and an empty run has no time', () => {
  assert.equal(gateTrace([{ boundary: 'post_tool' }]).total, 0);
  assert.deepEqual(gateTrace([{ boundary: 'post_tool' }, blocked]).actions.map(a => a.start), [0]);
});

test('every scripted scenario: the checks of an action add up to its decision latency', () => {
  for (const domain of ['ap', 'soc']) {
    for (const sc of scenariosFor(domain)) {
      const envs = runStream(sc.spans, { tenant: TENANT, policy: DEFAULT_POLICY, seed: 7 });
      for (const [i, a] of gateTrace(envs).actions.entries()) {
        const env = envs.filter(e => e.boundary === 'pre_tool')[i];
        assert.equal(a.end - a.start, env.decision_latency_ms, `${sc.scenario} action ${i}`);
        assert.equal(a.checks.reduce((n, c) => n + c.end - c.start, 0), env.decision_latency_ms, `${sc.scenario} action ${i} checks`);
      }
    }
  }
});
