// Experiment-level selectors and the settings reducer: the stage state machine, the recorded outcome, the result
// summary and the acceptance verdict, all read from real reducer output. Pure Node.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureState, seedState } from '../../agent-gym/js/fixtures/index.js';
import { OBJECTIVE, SOURCE_KIND } from '../../agent-gym/js/model.js';
import { OBJECTIVES, compareAttempt } from '../../agent-gym/js/metrics.js';
import { acceptanceVerdict, attemptResultSummary, experimentOutcome, experimentResultSummary, experimentStage, queueRows } from '../../agent-gym/js/selectors.js';
import {
  advanceAttempt, cancelAttempt, enqueueAttempt, failAttempt, pauseAttempt, recordReview, resumeAttempt, setExperimentSettings,
} from '../../agent-gym/js/simulation/attempts.js';

const ok = r => { if (r.error) throw Error(`${r.error.code}: ${r.error.message}`); return r.state; };
const finish = (state, attemptId) => { let s = state; while (['queued', 'running'].includes(s.attempts[attemptId].status)) s = ok(advanceAttempt(s, { attemptId })); return s; };
const lastAttempt = s => s.attemptOrder.at(-1);

test('every objective the experiment can choose has a measure, and every experiment declares its settings', () => {
  assert.deepEqual(Object.keys(OBJECTIVES), [...OBJECTIVE]);
  for (const exp of Object.values(seedState().experiments)) {
    assert.ok(OBJECTIVE.includes(exp.objective), `${exp.id} objective ${exp.objective}`);
    assert.ok(SOURCE_KIND.includes(exp.source.kind) && exp.source.label, `${exp.id} source`);
    assert.equal(typeof exp.acceptance.noRegression, 'boolean');
    assert.ok(Number.isInteger(exp.acceptance.minImprovedPairs) && exp.acceptance.minImprovedPairs >= 0);
  }
});

test('the stage of an experiment follows its latest queued, running or completed attempt', () => {
  let s = fixtureState();
  assert.equal(experimentStage(s, 'exp-029'), 'pending', 'no attempt yet');
  s = ok(enqueueAttempt(s, { experimentId: 'exp-029', idempotencyKey: 'k1' }));
  const id = lastAttempt(s);
  assert.equal(experimentStage(s, 'exp-029'), 'queued');
  s = ok(advanceAttempt(s, { attemptId: id }));
  assert.equal(experimentStage(s, 'exp-029'), 'running');
  s = ok(pauseAttempt(s, { attemptId: id }));
  assert.equal(experimentStage(s, 'exp-029'), 'running', 'paused still holds the slot');
  s = finish(ok(resumeAttempt(s, { attemptId: id })), id);
  assert.equal(experimentStage(s, 'exp-029'), 'needs_review');
  s = ok(recordReview(s, { attemptId: id, decision: 'pass_for_demo', reviewedAt: '2026-11-10T00:00:00Z' }));
  assert.equal(experimentStage(s, 'exp-029'), 'done');
  s = ok(enqueueAttempt(s, { experimentId: 'exp-029', idempotencyKey: 'k2' }));
  assert.equal(experimentStage(s, 'exp-029'), 'queued', 'a new attempt reopens the experiment');
});

test('a cancelled or failed attempt never decides the stage: with nothing else behind it the experiment reads pending', () => {
  let s = ok(enqueueAttempt(fixtureState(), { experimentId: 'exp-027', idempotencyKey: 'k' }));
  const id = lastAttempt(s);
  s = ok(advanceAttempt(s, { attemptId: id }));
  assert.equal(experimentStage(ok(cancelAttempt(s, { attemptId: id })), 'exp-027'), 'pending');
  assert.equal(experimentStage(ok(failAttempt(s, { attemptId: id })), 'exp-027'), 'pending');
});

test('a cancelled re-run leaves the earlier reviewed attempt as the stage', () => {
  let s = finish(ok(enqueueAttempt(fixtureState(), { experimentId: 'exp-027', idempotencyKey: 'a' })), 'attempt-001');
  s = ok(recordReview(s, { attemptId: 'attempt-001', decision: 'needs_iteration', reviewedAt: '2026-11-10T00:00:00Z' }));
  s = ok(cancelAttempt(ok(enqueueAttempt(s, { experimentId: 'exp-027', idempotencyKey: 'b' })), { attemptId: 'attempt-002' }));
  assert.equal(experimentStage(s, 'exp-027'), 'done');
  assert.deepEqual(experimentOutcome(s, 'exp-027'), { decision: 'needs_iteration', label: 'Needs iteration' });
});

test('the outcome is the recorded review of the latest counted attempt, and null before one', () => {
  let s = finish(ok(enqueueAttempt(fixtureState(), { experimentId: 'exp-027', idempotencyKey: 'a' })), 'attempt-001');
  assert.equal(experimentOutcome(s, 'exp-027'), null);
  assert.equal(experimentOutcome(s, 'exp-029'), null);
  s = ok(recordReview(s, { attemptId: 'attempt-001', decision: 'pass_for_demo', reviewedAt: '2026-11-10T00:00:00Z' }));
  assert.deepEqual(experimentOutcome(s, 'exp-027'), { decision: 'pass_for_demo', label: 'Pass for demo' });
});

test('the result summary is read from the comparison, and absent until an attempt has finished', () => {
  let s = ok(enqueueAttempt(fixtureState(), { experimentId: 'exp-029', idempotencyKey: 'a' }));
  assert.equal(experimentResultSummary(s, 'exp-029'), null, 'queued');
  s = finish(s, 'attempt-001');
  const cmp = compareAttempt(s.attempts['attempt-001'], s.executions['attempt-001']);
  const summary = experimentResultSummary(s, 'exp-029');
  assert.match(summary.text, new RegExp(`${cmp.improvedPairs} improved`));
  assert.match(summary.text, new RegExp(`${cmp.regressedPairs} regressed`));
  assert.equal(experimentResultSummary(s, 'exp-030'), null, 'never run');
});

test('the acceptance verdict lists a check for each rule the experiment set, and passes only when all hold', () => {
  let s = finish(ok(enqueueAttempt(fixtureState(), { experimentId: 'exp-029', idempotencyKey: 'a' })), 'attempt-001');
  const verdict = acceptanceVerdict(s, 'attempt-001');
  assert.deepEqual(verdict.checks.map(c => c.id), ['complete', 'no-regression', 'min-improved', 'objective', 'shared-agents']);
  assert.ok(verdict.checks.every(c => c.label && c.detail));
  assert.equal(verdict.passed, verdict.checks.every(c => c.passed));

  s = ok(setExperimentSettings(fixtureState(), { experimentId: 'exp-027', noRegression: false, minImprovedPairs: 0, noSharedRegression: false }));
  s = finish(ok(enqueueAttempt(s, { experimentId: 'exp-027', idempotencyKey: 'b' })), 'attempt-001');
  assert.deepEqual(acceptanceVerdict(s, 'attempt-001').checks.map(c => c.id), ['complete', 'objective'], 'rules switched off are not checked');

  s = ok(setExperimentSettings(fixtureState(), { experimentId: 'exp-027', minImprovedPairs: 2 }));
  s = finish(ok(enqueueAttempt(s, { experimentId: 'exp-027', idempotencyKey: 'c' })), 'attempt-001');
  const strict = acceptanceVerdict(s, 'attempt-001');
  assert.equal(strict.checks.find(c => c.id === 'min-improved').passed, false);
  assert.match(strict.checks.find(c => c.id === 'min-improved').detail, /0 improved/);
  assert.equal(strict.passed, false);
});

test('a partial comparison fails the acceptance verdict on completeness', () => {
  let s = ok(enqueueAttempt(fixtureState(), { experimentId: 'exp-029', idempotencyKey: 'a' }));
  s = ok(advanceAttempt(s, { attemptId: 'attempt-001' }));
  const verdict = acceptanceVerdict(s, 'attempt-001');
  assert.equal(verdict.checks.find(c => c.id === 'complete').passed, false);
  assert.equal(verdict.passed, false);
});

test('the acceptance verdict follows the settings frozen into the attempt, not later draft edits', () => {
  let s = finish(ok(enqueueAttempt(fixtureState(), { experimentId: 'exp-027', idempotencyKey: 'a' })), 'attempt-001');
  const before = acceptanceVerdict(s, 'attempt-001');
  s = ok(setExperimentSettings(s, { experimentId: 'exp-027', minImprovedPairs: 50 }));
  assert.deepEqual(acceptanceVerdict(s, 'attempt-001'), before);
});

test('the objective decides which measure the objective check reads', () => {
  const run = objective => {
    let s = ok(setExperimentSettings(fixtureState(), { experimentId: 'exp-029', objective }));
    s = finish(ok(enqueueAttempt(s, { experimentId: 'exp-029', idempotencyKey: objective })), 'attempt-001');
    return acceptanceVerdict(s, 'attempt-001').checks.find(c => c.id === 'objective');
  };
  assert.match(run('success').label, /Success rate/);
  assert.match(run('policy_violations').detail, /^3 → 0$/, 'three duplicate sends in the baseline, none in the variant');
  assert.equal(run('steps').passed, false, 'the status check costs the variant extra steps');
});

test('setExperimentSettings is a draft edit: it bumps the draft revision and rejects values outside the model', () => {
  const s0 = fixtureState();
  const rev = s0.experiments['exp-029'].draftRevision;
  const s1 = ok(setExperimentSettings(s0, { experimentId: 'exp-029', objective: 'steps', noRegression: false, minImprovedPairs: 4 }));
  assert.deepEqual([s1.experiments['exp-029'].objective, s1.experiments['exp-029'].acceptance], ['steps', { noRegression: false, minImprovedPairs: 4, noSharedRegression: true }]);
  assert.equal(s1.experiments['exp-029'].draftRevision, rev + 1);
  assert.equal(ok(setExperimentSettings(s1, { experimentId: 'exp-029', objective: 'steps' })), s1, 'no change, no new revision');
  assert.equal(setExperimentSettings(s0, { experimentId: 'exp-029', objective: 'latency' }).error.code, 'invalid_objective');
  assert.equal(setExperimentSettings(s0, { experimentId: 'exp-029', minImprovedPairs: -1 }).error.code, 'min_improved_out_of_range');
  assert.equal(setExperimentSettings(s0, { experimentId: 'exp-029', minImprovedPairs: 1.5 }).error.code, 'min_improved_out_of_range');
  assert.equal(setExperimentSettings(s0, { experimentId: 'nope', objective: 'steps' }).error.code, 'experiment_missing');
});

test('every queue row carries the one-line result of its own attempt, and only a completed attempt has one', () => {
  const s = seedState();
  const rows = Object.fromEntries(queueRows(s).map(r => [r.attemptId, r]));
  assert.equal(rows['attempt-002'].result, null, 'running');
  assert.equal(rows['attempt-003'].result, null, 'queued');
  assert.deepEqual(rows['attempt-005'].result, attemptResultSummary(s, 'attempt-005'));
  assert.deepEqual(rows['attempt-005'].result, experimentResultSummary(s, 'exp-025'), 'the experiment summary is the one of its stage attempt');
  assert.deepEqual(rows['attempt-004'].result, { text: 'Policy violations 1 → 0 · 1 improved · 0 regressed', tone: 'green' });
  const cancelled = ok(cancelAttempt(s, { attemptId: 'attempt-002' }));
  assert.equal(attemptResultSummary(cancelled, 'attempt-002'), null, 'a cancelled attempt compares as inconclusive and says nothing');
});
