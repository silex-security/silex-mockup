// Task 2 of logs/2026-10-02_RUNTIME_PIPELINE_VISUAL_PLAN.md: traceOf over every reference envelope.
// Pure, no DOM. Recomputed independently through runStream so a traceOf bug is not masked by the same data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { traceOf } from '../../js/rt-pipeline.js';
import { runStream } from '../../jev-runtime/demo/js/engine/router.js';
import { TENANT, scenariosFor } from '../../jev-runtime/demo/js/engine/scenarios.js';
import { DEFAULT_POLICY } from '../../jev-runtime/demo/js/engine/types.js';

const preTools = envs => envs.filter(e => e.boundary === 'pre_tool');

// §0 table, one entry per pre_tool action: [tool, decided_by, action].
const TABLE = {
  S1: [['erp.get_po', 'policy', 'allow'], ['vendor.lookup', 'policy', 'allow'], ['payments.execute', 'policy', 'allow']],
  S2: [['payments.execute', 'jev', 'hold_for_review']],
  S3: [['payments.execute', 'rule', 'deny']],
  S4: [['payments.execute', 'rule', 'hold_for_approval']],
  S5: [['payments.execute', 'policy', 'allow']],
  S6: [['email.send', 'rule', 'deny']],
  F1: [['vendor.lookup', 'fallback', 'allow_and_alert'], ['payments.execute', 'fallback', 'deny']],
  SOC1: [['siem.search', 'policy', 'allow'], ['firewall.block_ip', 'policy', 'allow'], ['ticket.update', 'policy', 'allow']],
  SOC2: [['siem.search', 'policy', 'allow'], ['firewall.allowlist_ip', 'rule', 'hold_for_approval'], ['ticket.update', 'policy', 'allow']],
  SOC3: [['siem.search', 'policy', 'allow'], ['identity.suspend_user', 'rule', 'hold_for_approval']],
  SOC4: [['siem.search', 'policy', 'allow'], ['webhook.post', 'rule', 'deny']],
  SOC5: [['siem.search', 'policy', 'allow'], ['identity.suspend_user', 'policy', 'allow'], ['identity.suspend_user', 'jev', 'hold_for_review'], ['identity.suspend_user', 'jev', 'hold_for_review']],
};

const EXIT = { allow: 'allow', allow_and_alert: 'allow', hold_for_review: 'hold', hold_for_approval: 'hold', deny: 'block', stop_and_handover: 'block' };

const allScenarios = () => [...scenariosFor('ap'), ...scenariosFor('soc')];

test('24 reference actions match the §0 table in order', () => {
  let n = 0;
  for (const t of allScenarios()) {
    const pre = preTools(runStream(t.spans, { tenant: TENANT, policy: DEFAULT_POLICY, seed: 7 }));
    assert.equal(pre.length, TABLE[t.scenario].length, t.scenario);
    pre.forEach((e, i) => {
      const [tool, decidedBy, action] = TABLE[t.scenario][i];
      assert.equal(e.tool.name, tool, `${t.scenario}[${i}] tool`);
      assert.equal(e.decided_by, decidedBy, `${t.scenario}[${i}] decided_by`);
      assert.equal(e.action, action, `${t.scenario}[${i}] action`);
      n++;
    });
  }
  assert.equal(n, 24);
});

test('traceOf exit and stage rules match the engine for all 24 actions', () => {
  for (const t of allScenarios()) {
    for (const e of preTools(runStream(t.spans, { tenant: TENANT, policy: DEFAULT_POLICY, seed: 7 }))) {
      const tr = traceOf(e);
      assert.equal(tr.tool, e.tool.name);
      assert.equal(tr.exit, EXIT[e.action]);
      assert.equal(tr.decidedBy, e.decided_by);
      assert.deepEqual(tr.stages, expectedStages(e), `${t.scenario} ${e.tool.name}`);
      assert.deepEqual(tr.ruleIds, (e.rule_hits ?? []).map(h => h.id));
      assert.equal(tr.reason, e.reasons?.[0] ?? null);
      assert.deepEqual(tr.fallback, e.fallback ? { fail: e.fallback.fail } : null);
    }
  }
});

function expectedStages(e) {
  switch (e.decided_by) {
    case 'rule': return { rules: 'hit', judge: 'ran-not-deciding', policy: 'bypassed' };
    case 'jev': return { rules: 'pass', judge: 'hit', policy: 'pass' };
    case 'policy': return { rules: 'pass', judge: 'pass', policy: 'pass' };
    case 'fallback': return { rules: 'pass', judge: e.jev_status === 'down' ? 'down' : 'timeout', policy: 'fallback' };
  }
}

test('a rule decision shows the judge ran, not deciding (S3)', () => {
  const e = preTools(runStream(scenariosFor('ap').find(t => t.scenario === 'S3').spans, { tenant: TENANT, policy: DEFAULT_POLICY, seed: 7 }))[0];
  const tr = traceOf(e);
  assert.equal(tr.decidedAt, 'rules');
  assert.deepEqual(tr.stages, { rules: 'hit', judge: 'ran-not-deciding', policy: 'bypassed' });
  assert.equal(tr.exit, 'block');
  assert.equal(e.jev_on_critical_path, false, 'judge still ran, but was not on the critical path');
});

test('F1 fallback distinguishes fail-open from fail-closed', () => {
  const [lookup, pay] = preTools(runStream(scenariosFor('ap').find(t => t.scenario === 'F1').spans, { tenant: TENANT, policy: DEFAULT_POLICY, seed: 7 }));
  const a = traceOf(lookup);
  assert.equal(a.decidedAt, 'fallback');
  assert.deepEqual(a.stages, { rules: 'pass', judge: 'timeout', policy: 'fallback' });
  assert.deepEqual(a.fallback, { fail: 'open' });
  assert.equal(a.exit, 'allow');
  assert.equal(a.alert, true);
  assert.equal(a.monitor, null);

  const b = traceOf(pay);
  assert.deepEqual(b.stages, { rules: 'pass', judge: 'timeout', policy: 'fallback' });
  assert.deepEqual(b.fallback, { fail: 'closed' });
  assert.equal(b.exit, 'block');
  assert.equal(b.alert, false);
});

test('monitor-mode S3 exits allow and reports wouldHave blocked', () => {
  const s3 = scenariosFor('ap').find(t => t.scenario === 'S3');
  const policy = structuredClone(DEFAULT_POLICY);
  policy.tools['payments.execute'].mode = 'monitor';
  const e = preTools(runStream(s3.spans, { tenant: TENANT, policy, seed: 7 }))[0];
  const tr = traceOf(e);
  assert.equal(e.action, 'allow');
  assert.equal(e.would_have, 'BLOCK');
  assert.equal(tr.exit, 'allow');
  assert.deepEqual(tr.monitor, { wouldHave: 'blocked' });
  assert.equal(tr.alert, false);
});

test('caption strings are pinned exactly', () => {
  const env = id => preTools(runStream(scenariosFor('ap').find(t => t.scenario === id).spans, { tenant: TENANT, policy: DEFAULT_POLICY, seed: 7 }))[0];
  assert.equal(traceOf(env('S3')).caption, 'payments.execute · blocked by rule amount_limit — amount 48000 exceeds approval limit 25000');
  assert.equal(traceOf(env('S2')).caption, 'payments.execute · held for review by the judge — payee_mismatch: risk 0.855 ≥ review 0.4');

  const f1 = preTools(runStream(scenariosFor('ap').find(t => t.scenario === 'F1').spans, { tenant: TENANT, policy: DEFAULT_POLICY, seed: 7 }));
  assert.equal(traceOf(f1[0]).caption, 'vendor.lookup · allowed by fallback (fail-open) — Jev timeout; fail-open → ALLOW');

  const soc2 = preTools(runStream(scenariosFor('soc').find(t => t.scenario === 'SOC2').spans, { tenant: TENANT, policy: DEFAULT_POLICY, seed: 7 }));
  assert.equal(traceOf(soc2[1]).caption, 'firewall.allowlist_ip · held for approval by rule allowlist_change_approval — allowlisting 203.0.113.7 without an approved change');
});

test('a policy allow has no reason and no dash in its caption', () => {
  const e = preTools(runStream(scenariosFor('ap').find(t => t.scenario === 'S1').spans, { tenant: TENANT, policy: DEFAULT_POLICY, seed: 7 }))[0];
  const tr = traceOf(e);
  assert.equal(tr.decidedAt, 'policy');
  assert.equal(tr.reason, null);
  assert.equal(tr.caption, 'erp.get_po · allowed by policy');
});

test('unknown action and unknown decided_by throw', () => {
  const base = preTools(runStream(scenariosFor('ap').find(t => t.scenario === 'S3').spans, { tenant: TENANT, policy: DEFAULT_POLICY, seed: 7 }))[0];
  assert.throws(() => traceOf({ ...base, action: 'bogus' }), /unknown action/);
  assert.throws(() => traceOf({ ...base, decided_by: 'bogus' }), /unknown decided_by/);
});
