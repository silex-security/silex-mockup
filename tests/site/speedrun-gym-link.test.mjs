// The Speedrun shell sends Agent Gym navigation to the console's Gym. These are the pure rules it uses: which paths
// leave the app, which handoff a created experiment maps to, and the top-level URL it opens. Probe S51 in
// run-site-probes.mjs drives both directions in the real console.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HANDOFFS } from '../../agent-gym/js/fixtures/handoffs.js';
import { GYM_HOME, gymUrl, handoffIdOf, isGymPath } from '../../speedrun/web/src/gym.js';

const TEAMS = ['refund', 'order-support', 'escalation', 'invoice', 'expense-review', 'reconciliation'];
const CHANGES = ['retry-timeout', 'switch-tool', 'switch-model', 'prompt-context'];

test('only the app\'s own Agent Gym pages leave the app', () => {
  for (const p of ['/gym', '/gym/experiments/029']) assert.equal(isGymPath(p), true, p);
  for (const p of ['/speedrun', '/gymnastics', '/speedrun/teams/refund/trace', '/api/gym/experiments', '/']) assert.equal(isGymPath(p), false, p);
});

test('an experiment created by Create variant maps to the handoff for its team and kind of change', () => {
  for (const teamId of TEAMS) for (const change of CHANGES) {
    const id = handoffIdOf({ teamId, config: { variantName: `${change}-v031` } });
    assert.equal(id, `${teamId}-${change}`);
    assert.ok(Object.hasOwn(HANDOFFS, id), `Gym has a template for ${id}`);
  }
});

test('an experiment the shell cannot map, such as a seeded one, opens the Gym queue instead', () => {
  assert.equal(handoffIdOf({ teamId: 'refund', config: { variantName: 'retry-policy-v2' } }), null);
  assert.equal(handoffIdOf({ teamId: 'invoice' }), null);
  assert.equal(handoffIdOf(undefined), null);
  assert.equal(handoffIdOf({ teamId: 'refund/../x', config: { variantName: 'retry-timeout-v1' } }), null, 'a team id that is not an id never builds a handoff');
});

test('the console URL is a plain relative link that works with or without a parent window', () => {
  assert.equal(GYM_HOME, '../../index.html#view=gym');
  assert.equal(gymUrl(null), '../../index.html#view=gym');
  assert.equal(gymUrl('refund-retry-timeout'), '../../index.html#view=gym&path=%2Fhandoff%2Fspeedrun%2Frefund-retry-timeout');
});
