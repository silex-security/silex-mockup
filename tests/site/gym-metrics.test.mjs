// Agent Gym v2 comparison (plan 8.2, 8.4; 13.1 item 9). The expected pass table is plan 8.2's rule: every default
// scenario passes on both versions except Timeout after send on the baseline (blind retry with a new key).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureState } from '../../agent-gym/js/fixtures/index.js';
import { advanceAttempt, enqueueAttempt } from '../../agent-gym/js/simulation/attempts.js';
import { planExecutions, runExecution } from '../../agent-gym/js/simulation/executor.js';
import { compareAttempt } from '../../agent-gym/js/metrics.js';

const expectedPass = (scenarioId, versionId) => !(scenarioId === 'sc-timeout-after-send' && versionId === 'baseline');

function completedDefaultAttempt() {
  let s = enqueueAttempt(fixtureState(), { experimentId: 'exp-029', idempotencyKey: 'k' }).state;
  const id = s.attemptOrder[0];
  while (s.attempts[id].status !== 'completed') s = advanceAttempt(s, { attemptId: id }).state;
  return { attempt: s.attempts[id], executions: s.executions[id] };
}

test('the default 18 runs give baseline 6/9, Variant A 9/9, 9 complete pairs, 3 improved, 0 regressed', () => {
  const { attempt, executions } = completedDefaultAttempt();
  assert.equal(executions.length, 18);
  for (const e of executions) assert.equal(e.terminalState, expectedPass(e.scenarioId, e.versionId) ? 'passed' : 'failed', e.id);
  const want = v => ({ pass: executions.filter(e => e.versionId === v && expectedPass(e.scenarioId, v)).length, total: 9 });
  const c = compareAttempt(attempt, executions);
  assert.deepEqual(c.totals, { baseline: want('baseline'), variant: want('variant') });
  assert.deepEqual(c.totals, { baseline: { pass: 6, total: 9 }, variant: { pass: 9, total: 9 } });
  assert.deepEqual([c.expectedPairs, c.completePairs, c.missingPairs, c.improvedPairs, c.regressedPairs, c.verdict], [9, 9, [], 3, 0, 'pass']);
  assert.deepEqual(c.byScenario.map(r => [r.title, r.baseline.pass, r.variant.pass, r.improved, r.regressed]),
    [['Base case', 3, 3, 0, 0], ['Timeout after send', 0, 3, 3, 0], ['Contact opted out', 3, 3, 0, 0]]);
  const improved = c.pairs.filter(p => p.kind === 'improved');
  assert.deepEqual(improved.map(p => p.pairId), ['sc-timeout-after-send#1', 'sc-timeout-after-send#2', 'sc-timeout-after-send#3']);
  assert.ok(improved[0].deltas.includes('At most one email for the logical task: fail → pass'), improved[0].deltas.join(' | '));
});

test('deleting one pair, one result, or cancelling makes the verdict inconclusive', () => {
  const { attempt, executions } = completedDefaultAttempt();
  const withoutPair = executions.filter(e => !(e.scenarioId === 'sc-base-case' && e.repeatIndex === 2));
  const c = compareAttempt(attempt, withoutPair);
  assert.deepEqual([c.verdict, c.completePairs, c.missingPairs], ['inconclusive', 8, ['sc-base-case#2']]);
  assert.equal(compareAttempt(attempt, executions.slice(1)).verdict, 'inconclusive');
  assert.equal(compareAttempt({ ...attempt, status: 'cancelled' }, executions).verdict, 'inconclusive');
  const cancelledResult = executions.map((e, i) => i === 0 ? { ...e, terminalState: 'cancelled' } : e);
  assert.equal(compareAttempt(attempt, cancelledResult).verdict, 'inconclusive', 'a cancelled result never counts as a pass');
  const errored = executions.map((e, i) => i === 0 ? { ...e, terminalState: 'error' } : e);
  assert.equal(compareAttempt(attempt, errored).verdict, 'inconclusive');
});

test('a variant that loses the timeout recovery is a regression', () => {
  const { attempt } = completedDefaultAttempt();
  const snap = structuredClone(attempt.inputSnapshot);
  [snap.workflow.modelConfig['draft-email'].traits, snap.variant.patch[0].traits] = [snap.variant.patch[0].traits, snap.workflow.modelConfig['draft-email'].traits];
  const plan = planExecutions(snap);
  const executions = plan.map(item => runExecution(snap, item, 29));
  const c = compareAttempt({ ...attempt, plan, inputSnapshot: snap }, executions);
  assert.deepEqual([c.regressedPairs, c.improvedPairs, c.verdict], [3, 0, 'regression']);
  assert.ok(c.pairs.find(p => p.kind === 'regressed').deltas.includes('new duplicate violation'));
});

test('a new opt-out violation on the variant is a regression even when both runs pass', () => {
  const { attempt, executions } = completedDefaultAttempt();
  const target = executions.find(e => e.scenarioId === 'sc-contact-opted-out' && e.versionId === 'variant');
  const tampered = executions.map(e => e !== target ? e
    : { ...e, finalState: { ...e.finalState, violations: [{ kind: 'opt_out', capability: 'email.send_email', attempted: true, seq: 5 }] } });
  const c = compareAttempt(attempt, tampered);
  const pair = c.pairs.find(p => p.pairId === `sc-contact-opted-out#${target.repeatIndex}`);
  assert.deepEqual([pair.kind, pair.deltas], ['regressed', ['new opt_out violation']]);
  assert.equal(c.verdict, 'regression');
});

test('pass needs every variant run to pass: a complete comparison with failing variant runs reads fail', () => {
  const { attempt, executions } = completedDefaultAttempt();
  const allFail = executions.map(e => ({ ...e, terminalState: 'failed' }));
  const c = compareAttempt(attempt, allFail);
  assert.deepEqual([c.totals.baseline.pass, c.totals.variant.pass, c.completePairs, c.regressedPairs, c.verdict], [0, 0, 9, 0, 'fail']);
  const oneFails = executions.map(e => e.versionId === 'variant' && e.scenarioId === 'sc-timeout-after-send' && e.repeatIndex === 1 ? { ...e, terminalState: 'failed' } : e);
  const c2 = compareAttempt(attempt, oneFails);
  assert.deepEqual([c2.regressedPairs, c2.totals.variant.pass, c2.verdict], [0, 8, 'fail'], 'the baseline also failed this pair, so it is no regression, and still no pass');
});

test('totals count each planned execution once and ignore executions outside the plan', () => {
  const { attempt, executions } = completedDefaultAttempt();
  const duplicate = structuredClone(executions.find(e => e.versionId === 'baseline' && e.scenarioId === 'sc-base-case'));
  const stray = { ...structuredClone(executions[0]), id: 'stray', scenarioId: 'sc-stranger' };
  const c = compareAttempt(attempt, [...executions, duplicate, stray]);
  assert.deepEqual(c.totals, { baseline: { pass: 6, total: 9 }, variant: { pass: 9, total: 9 } });
  assert.deepEqual(c.byScenario.map(r => r.baseline.total + r.variant.total), [6, 6, 6]);
  assert.equal(c.verdict, 'pass');
});

test('an attempt that is running or failed never reads pass, whatever its executions say', () => {
  const { attempt, executions } = completedDefaultAttempt();
  for (const status of ['running', 'queued', 'failed']) assert.equal(compareAttempt({ ...attempt, status }, executions).verdict, 'inconclusive', status);
});
