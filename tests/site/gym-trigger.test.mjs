// Attempt triggers: why each attempt was enqueued, the manual default, the seeded triggers, and saved data from
// before triggers existed. Pure Node.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../agent-gym/js/store.js';
import { STORAGE_KEY } from '../../agent-gym/js/model.js';
import { fixtureState, seedState } from '../../agent-gym/js/fixtures/index.js';
import { enqueueAttempt, triggerOf } from '../../agent-gym/js/simulation/attempts.js';
import { attemptsByStatus, queueRows } from '../../agent-gym/js/selectors.js';

const ok = r => { if (r.error) throw Error(`${r.error.code}: ${r.error.message}`); return r.state; };
const storageWith = state => {
  const data = new Map([[STORAGE_KEY, JSON.stringify(state)]]);
  return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k), clear() { throw Error('never clear'); } };
};
const withoutTriggers = state => ({ ...state, attempts: Object.fromEntries(Object.entries(state.attempts).map(([id, a]) => { const { trigger, ...rest } = a; return [id, rest]; })) });

test('an attempt enqueued without a trigger is a manual run, and a given trigger is kept', () => {
  const manual = ok(enqueueAttempt(fixtureState(), { experimentId: 'exp-029', idempotencyKey: 'k1' }));
  assert.deepEqual(manual.attempts[manual.attemptOrder[0]].trigger, { kind: 'manual', label: 'Manual run' });
  const change = { kind: 'change', label: 'Model configuration change on Draft email' };
  const changed = ok(enqueueAttempt(fixtureState(), { experimentId: 'exp-029', idempotencyKey: 'k2', trigger: change }));
  assert.deepEqual(changed.attempts[changed.attemptOrder[0]].trigger, change);
});

test('the seeded Sales follow-up attempt is a change on Draft email; the other two were started by hand', () => {
  const rows = queueRows(seedState()).map(r => [r.title, r.trigger.kind, r.trigger.label]);
  assert.deepEqual(rows, [
    ['Sales follow-up · Variant A', 'change', 'Model configuration change on Draft email'],
    ['Support triage comparison', 'manual', 'Manual run'],
    ['Meeting scheduling', 'manual', 'Manual run'],
  ]);
  assert.deepEqual(attemptsByStatus(seedState(), 'all', 'change').map(r => r.attemptId), ['attempt-002']);
  assert.deepEqual(attemptsByStatus(seedState(), 'running', 'manual'), []);
});

test('saved data from before triggers and regression loads in local mode and reads as manual runs', () => {
  const old = withoutTriggers(seedState());
  assert.equal('regression' in old, false);
  assert.ok(Object.values(old.attempts).every(a => !('trigger' in a)));
  const store = createStore({ storage: storageWith(old), seed: seedState });
  assert.deepEqual({ mode: store.persistence.mode, error: store.persistence.error }, { mode: 'local', error: null });
  const state = store.getState();
  assert.equal(state.experiments['exp-029'].title, 'Experiment 029', 'the saved state was loaded, not re-seeded');
  assert.deepEqual(Object.values(state.attempts).map(triggerOf), Array(3).fill({ kind: 'manual', label: 'Manual run' }));
  assert.equal(attemptsByStatus(state, 'all', 'manual').length, 3);
});

test('a saved trigger of an unknown kind, or naming a missing regression batch, is refused at load', () => {
  for (const trigger of [{ kind: 'cron', label: 'x' }, { kind: 'regression', label: 'Regression batch 9', batchId: 'regression-9' }]) {
    const bad = seedState();
    bad.attempts['attempt-001'] = { ...bad.attempts['attempt-001'], trigger };
    const store = createStore({ storage: storageWith(bad), seed: seedState });
    assert.equal(store.persistence.mode, 'memory', JSON.stringify(trigger));
    assert.equal(store.persistence.error.code, 'storage_inconsistent');
  }
});
