// The Speedrun shell sends Agent Gym navigation to the console's Gym. These are the pure rules it uses: which paths
// leave the app, which handoff a created experiment maps to, and the top-level URL it opens. Probe S51 in
// run-site-probes.mjs drives both directions in the real console.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HANDOFFS } from '../../agent-gym/js/fixtures/handoffs.js';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GYM_HOME, gymUrl, handoffIdFromPath, isGymPath } from '../../speedrun/web/src/gym.js';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../../speedrun/web/upstream/src');

const TEAMS = ['refund', 'order-support', 'escalation', 'invoice', 'expense-review', 'reconciliation'];
const CHANGES = ['retry-timeout', 'switch-tool', 'switch-model', 'prompt-context'];

test('only the app\'s own Agent Gym pages leave the app', () => {
  for (const p of ['/gym', '/gym/experiments/029']) assert.equal(isGymPath(p), true, p);
  for (const p of ['/speedrun', '/gymnastics', '/speedrun/teams/refund/trace', '/api/gym/experiments', '/']) assert.equal(isGymPath(p), false, p);
});

test('the variant form names the handoff from its team and kind of change, and Gym has a template for each', () => {
  for (const teamId of TEAMS) for (const change of CHANGES) {
    const id = handoffIdFromPath(`/gym/handoff/${teamId}-${change}`);
    assert.equal(id, `${teamId}-${change}`);
    assert.ok(Object.hasOwn(HANDOFFS, id), `Gym has a template for ${id}`);
  }
});

test('any other Gym path, including the old experiment pages, opens the Gym queue instead', () => {
  for (const p of ['/gym', '/gym/experiments/029', '/gym/handoff', '/gym/handoff/', '/gym/handoff/refund/../x', '/gym/handoff/Refund Team', '/speedrun/handoff/refund-retry-timeout'])
    assert.equal(handoffIdFromPath(p), null, p);
});

test('Speedrun no longer carries its own Gym pages or Gym API', () => {
  assert.equal(existsSync(resolve(SRC, 'app/gym')), false);
  assert.equal(existsSync(resolve(SRC, 'app/api/gym')), false);
  assert.equal(existsSync(resolve(SRC, 'components/ExperimentConfigurator.tsx')), false);
});

test('the console URL is a plain relative link that works with or without a parent window', () => {
  assert.equal(GYM_HOME, '../../index.html#view=gym');
  assert.equal(gymUrl(null), '../../index.html#view=gym');
  assert.equal(gymUrl('refund-retry-timeout'), '../../index.html#view=gym&path=%2Fhandoff%2Fspeedrun%2Frefund-retry-timeout');
});
