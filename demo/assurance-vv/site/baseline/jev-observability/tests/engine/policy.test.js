// validatePolicy: inverted bands, out-of-range thresholds, unknown tool mode/fail.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_POLICY } from '../../js/engine/types.js';
import { validatePolicy, toolConfig } from '../../js/engine/policy.js';

test('validatePolicy accepts DEFAULT_POLICY', () => {
  assert.deepEqual(validatePolicy(DEFAULT_POLICY), { ok: true, errors: [] });
});

test('validatePolicy rejects inverted bands (review_threshold ≥ block_threshold)', () => {
  const p = {
    ...DEFAULT_POLICY,
    thresholds: { ...DEFAULT_POLICY.thresholds, exfil: { review_threshold: 0.8, block_threshold: 0.35 } },
  };
  const r = validatePolicy(p);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => e.includes('must be < block_threshold')));
});

test('validatePolicy rejects equal thresholds too', () => {
  const p = {
    ...DEFAULT_POLICY,
    thresholds: { ...DEFAULT_POLICY.thresholds, payee_mismatch: { review_threshold: 0.5, block_threshold: 0.5 } },
  };
  assert.equal(validatePolicy(p).ok, false);
});

test('validatePolicy rejects thresholds outside [0,1]', () => {
  const low = { ...DEFAULT_POLICY, thresholds: { ...DEFAULT_POLICY.thresholds, exfil: { review_threshold: -0.1, block_threshold: 0.5 } } };
  assert.equal(validatePolicy(low).ok, false);
  const high = { ...DEFAULT_POLICY, thresholds: { ...DEFAULT_POLICY.thresholds, exfil: { review_threshold: 0.1, block_threshold: 1.2 } } };
  assert.equal(validatePolicy(high).ok, false);
});

test('validatePolicy rejects unknown tool mode and fail values', () => {
  const badMode = { ...DEFAULT_POLICY, tools: { ...DEFAULT_POLICY.tools, 'payments.execute': { mode: 'bad', fail: 'open' } } };
  assert.equal(validatePolicy(badMode).ok, false);
  const badFail = { ...DEFAULT_POLICY, tools: { ...DEFAULT_POLICY.tools, 'email.send': { mode: 'gate', fail: 'bad' } } };
  assert.equal(validatePolicy(badFail).ok, false);
  const badDefault = { ...DEFAULT_POLICY, default_tool: { mode: 'gate', fail: 'bad' } };
  assert.equal(validatePolicy(badDefault).ok, false);
});

test('toolConfig falls back to default_tool and non-tool → gate/open', () => {
  assert.deepEqual(toolConfig(DEFAULT_POLICY, 'payments.execute'), { mode: 'gate', fail: 'closed' });
  assert.deepEqual(toolConfig(DEFAULT_POLICY, 'vendor.lookup'), { mode: 'gate', fail: 'open' });
  assert.deepEqual(toolConfig(DEFAULT_POLICY, 'unknown.tool'), { mode: 'gate', fail: 'closed' });
  assert.deepEqual(toolConfig(DEFAULT_POLICY, null), { mode: 'gate', fail: 'open' });
});
