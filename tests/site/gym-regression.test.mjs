// Regression batches: which experiments a press includes or skips, the batch tag on every attempt, the idempotency
// rule while a batch is live, the history rows and the cadence setting. Pure Node.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedState } from '../../agent-gym/js/fixtures/index.js';
import { advanceAttempt, cancelAttempt, clearScenarioSelection, saveExperiment } from '../../agent-gym/js/simulation/attempts.js';
import { stateProblems } from '../../agent-gym/js/integrity.js';
import { liveBatch, regressionHistory, regressionOf, regressionPlan, runRegression, setRegressionCadence } from '../../agent-gym/js/runs/regression.js';

const ok = r => { if (r.error) throw Error(`${r.error.code}: ${r.error.message}`); return r.state; };
const finishAll = state => {
  let s = state;
  for (const id of s.attemptOrder) while (['queued', 'running'].includes(s.attempts[id].status)) s = ok(advanceAttempt(s, { attemptId: id }));
  return s;
};

test('the seeded plan includes the four saved experiments that finished and skips the queued, the unsaved and the never-saved ones', () => {
  const plan = regressionPlan(seedState());
  assert.deepEqual(plan.included, [
    { experimentId: 'exp-024', title: 'Duplicate-send guard', runs: 6 }, { experimentId: 'exp-025', title: 'Smaller model for refund replies', runs: 12 },
    { experimentId: 'exp-026', title: 'Refund timeout steps', runs: 8 }, { experimentId: 'exp-027', title: 'Meeting scheduling', runs: 12 },
  ]);
  assert.deepEqual(plan.skipped, [
    { experimentId: 'exp-028', title: 'Support triage comparison', reason: 'rev 1 · attempt 1 is already queued' },
    { experimentId: 'exp-029', title: 'Experiment 029', reason: 'Draft rev 4 has unsaved changes; save it in the workbench to include it' },
    { experimentId: 'exp-030', title: 'Opt-out wording check', reason: 'Never saved' },
    { experimentId: 'exp-031', title: 'Meeting no-slot handling', reason: 'Never saved' },
    { experimentId: 'exp-032', title: 'Invoice review · Variant A', reason: 'Never saved' },
  ]);
});

test('Run regression now enqueues one attempt per included experiment, tagged with one batch', () => {
  const before = finishAll(ok(saveExperiment(seedState(), { experimentId: 'exp-029' })));
  const after = ok(runRegression(before));
  const added = after.attemptOrder.slice(before.attemptOrder.length).map(id => after.attempts[id]);
  assert.deepEqual(added.map(a => [a.experimentId, a.status, a.trigger]), ['exp-024', 'exp-025', 'exp-026', 'exp-027', 'exp-028', 'exp-029'].map(exp =>
    [exp, 'queued', { kind: 'regression', label: 'Regression batch 1', batchId: 'regression-1' }]));
  assert.deepEqual(regressionOf(after).batches.map(b => [b.id, b.number, b.attemptIds, b.skipped.map(x => x.experimentId)]), [['regression-1', 1, added.map(a => a.id), ['exp-030', 'exp-031', 'exp-032']]]);
  assert.deepEqual(stateProblems(after), [], 'the batch state passes the load check');
});

test('a second press while the batch is live changes nothing; once it finishes the next press is batch 2', () => {
  const first = ok(runRegression(seedState()));
  assert.equal(liveBatch(first)?.id, 'regression-1');
  const again = runRegression(first);
  assert.equal(again.state, first, 'no new attempt and no new batch');
  const done = finishAll(first);
  assert.equal(liveBatch(done), null);
  const second = ok(runRegression(done));
  assert.deepEqual(regressionOf(second).batches.map(b => b.id), ['regression-1', 'regression-2']);
  assert.equal(second.attemptOrder.length, done.attemptOrder.length + 5, 'the four saved finished experiments and the now-finished Support triage; the unsaved Sales draft is still skipped');
});

test('an experiment that fails the run gate is skipped with the gate reason; nothing to run is a typed error that writes nothing', () => {
  let s = ok(clearScenarioSelection(seedState(), { experimentId: 'exp-027' }));
  s = ok(saveExperiment(s, { experimentId: 'exp-027' }));
  assert.equal(regressionPlan(s).skipped.find(x => x.experimentId === 'exp-027').reason, 'Select at least one scenario');
  for (const id of Object.keys(s.experiments)) s = ok(saveExperiment(ok(clearScenarioSelection(s, { experimentId: id })), { experimentId: id }));
  const r = runRegression(s);
  assert.equal(r.error.code, 'regression_empty');
  assert.equal(r.error.skipped.length, Object.keys(s.experiments).length, 'every experiment fails the run gate');
});

test('history rows count planned and finished runs and attempts by verdict, newest batch first', () => {
  const live = ok(runRegression(seedState()));
  const [row] = regressionHistory(live);
  assert.deepEqual({ number: row.number, startedSeq: row.startedSeq, planned: row.planned, finished: row.finished, running: row.running, experiments: row.experiments.map(e => e.title), skipped: row.skipped.length },
    { number: 1, startedSeq: 7, planned: 38, finished: 0, running: 4, experiments: ['Duplicate-send guard', 'Smaller model for refund replies', 'Refund timeout steps', 'Meeting scheduling'], skipped: 5 });
  const done = finishAll(live);
  assert.deepEqual([regressionHistory(done)[0].finished, regressionHistory(done)[0].verdicts], [38, { pass: 3, fail: 0, regression: 1, inconclusive: 0 }]);
  const cancelled = ok(cancelAttempt(live, { attemptId: row.experiments[0].attemptId }));
  assert.deepEqual(regressionHistory(cancelled)[0].verdicts, { pass: 0, fail: 0, regression: 0, inconclusive: 1 });
});

test('the cadence is a stored setting with a monthly default, and an unknown cadence is refused', () => {
  assert.equal(regressionOf(seedState()).cadence, 'monthly');
  const s = ok(setRegressionCadence(seedState(), { cadence: 'quarterly' }));
  assert.deepEqual(regressionOf(s), { cadence: 'quarterly', batches: [] });
  assert.equal(setRegressionCadence(s, { cadence: 'quarterly' }).state, s);
  assert.equal(setRegressionCadence(s, { cadence: 'hourly' }).error.code, 'invalid_cadence');
  assert.deepEqual(stateProblems({ ...s, regression: { cadence: 'hourly', batches: [] } }), ['regression state is malformed']);
});
