// Release gate: every gate state from its state table, and the gate read from real reducer output. Pure Node.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureState, seedState } from '../../agent-gym/js/fixtures/index.js';
import { advanceAttempt, cancelAttempt, enqueueAttempt, recordReview, saveExperiment } from '../../agent-gym/js/simulation/attempts.js';
import { gateState, releaseGateRows } from '../../agent-gym/js/runs/gate.js';

const ok = r => { if (r.error) throw Error(`${r.error.code}: ${r.error.message}`); return r.state; };
const gateOf = (state, id) => releaseGateRows(state).find(r => r.experimentId === id);
const finish = (state, attemptId) => { let s = state; while (['queued', 'running'].includes(s.attempts[attemptId].status)) s = ok(advanceAttempt(s, { attemptId })); return s; };
const runToEnd = s => { let next = s; for (const id of next.attemptOrder) next = finish(next, id); return next; };
const review = (s, attemptId, decision) => ok(recordReview(s, { attemptId, decision, reviewedAt: '2026-11-10T00:00:00Z' }));

test('the gate state table: each combination of run status, verdict and review gives one state', () => {
  const attempt = status => ({ status });
  const cases = [
    [{ savedRevision: null, attempt: null }, 'not_run', 'Not run'],
    [{ savedRevision: 3, attempt: null }, 'not_run', 'Not run'],
    [{ savedRevision: 3, attempt: attempt('queued'), progress: '0/18', verdict: 'inconclusive' }, 'running', 'Running'],
    [{ savedRevision: 3, attempt: attempt('running'), progress: '12/18', verdict: 'inconclusive' }, 'running', 'Running'],
    [{ savedRevision: 3, attempt: attempt('completed'), verdict: 'pass', review: null }, 'needs_review', 'Needs review'],
    [{ savedRevision: 3, attempt: attempt('completed'), verdict: 'regression', review: null }, 'blocked', 'Blocked'],
    [{ savedRevision: 3, attempt: attempt('completed'), verdict: 'fail', review: null }, 'blocked', 'Blocked'],
    [{ savedRevision: 3, attempt: attempt('cancelled'), verdict: 'inconclusive', review: null }, 'blocked', 'Blocked'],
    [{ savedRevision: 3, attempt: attempt('completed'), verdict: 'pass', review: { decision: 'needs_iteration' } }, 'blocked', 'Blocked'],
    [{ savedRevision: 3, attempt: attempt('completed'), verdict: 'fail', review: { decision: 'reject' } }, 'blocked', 'Blocked'],
    [{ savedRevision: 3, attempt: attempt('completed'), verdict: 'pass', review: { decision: 'pass_for_demo' } }, 'cleared', 'Cleared for demo'],
  ];
  for (const [facts, state, label] of cases) {
    const gate = gateState(facts);
    assert.deepEqual([gate.state, gate.label], [state, label], JSON.stringify(facts));
  }
  assert.equal(gateState(cases[1][0]).reason, 'No run of rev 3 yet');
  assert.equal(gateState(cases[5][0]).reason, 'Verdict Regression');
  assert.equal(gateState(cases[8][0]).reason, 'Reviewed Needs iteration');
});

test('the seeded gate: Sales follow-up is running a run frozen before its draft changed; Meeting scheduling awaits review', () => {
  const rows = releaseGateRows(seedState());
  assert.deepEqual(rows.map(r => [r.experimentId, r.gate.label, r.gate.reason, r.attempt?.id, r.draftChanged]), [
    ['exp-029', 'Running', '12/18 executions finished', 'attempt-002', true],
    ['exp-028', 'Running', 'Queued', 'attempt-003', false],
    ['exp-027', 'Needs review', 'Pass verdict; not reviewed yet', 'attempt-001', false],
  ]);
  assert.equal(rows[0].change.text, 'Model configuration change on Draft email');
});

test('a completed pass needs review, then reads Cleared for demo after Pass for demo, and Blocked after Needs iteration', () => {
  const done = runToEnd(seedState());
  assert.deepEqual([gateOf(done, 'exp-029').gate.state, gateOf(done, 'exp-029').verdict], ['needs_review', 'pass']);
  assert.equal(gateOf(review(done, 'attempt-002', 'pass_for_demo'), 'exp-029').gate.label, 'Cleared for demo');
  assert.equal(gateOf(review(done, 'attempt-002', 'needs_iteration'), 'exp-029').gate.state, 'blocked');
});

test('a cancelled run blocks the gate as inconclusive; saving the changed draft leaves the new revision not run', () => {
  const cancelled = ok(cancelAttempt(seedState(), { attemptId: 'attempt-002' }));
  assert.deepEqual([gateOf(cancelled, 'exp-029').gate.state, gateOf(cancelled, 'exp-029').gate.reason], ['blocked', 'Run cancelled; verdict Inconclusive']);
  const saved = ok(saveExperiment(seedState(), { experimentId: 'exp-029' }));
  assert.deepEqual([gateOf(saved, 'exp-029').gate.state, gateOf(saved, 'exp-029').gate.reason], ['not_run', 'No run of rev 4 yet']);
  assert.equal(gateOf(fixtureState(), 'exp-027').gate.state, 'not_run');
});

test('a run of the saved revision with no variant says so', () => {
  const s = fixtureState();
  const noVariant = { ...s, experiments: { ...s.experiments, 'exp-029': { ...s.experiments['exp-029'], variantId: null } } };
  assert.equal(gateOf(noVariant, 'exp-029').change, null);
  assert.ok(enqueueAttempt(noVariant, { experimentId: 'exp-029', idempotencyKey: 'k' }).error, 'the run gate still needs a variant');
});
