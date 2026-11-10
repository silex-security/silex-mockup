// The finance workflow in Gym (Invoice review): its environment, scenario set, handoffs and a seeded experiment, all run by the
// same executor as the other three workflows. Expected values come from the requirement, not from a run of the code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedState } from '../../agent-gym/js/fixtures/index.js';
import { FIXTURE_VERSION, refKey } from '../../agent-gym/js/model.js';
import { HANDOFFS } from '../../agent-gym/js/fixtures/handoffs.js';
import { acceptHandoff, handoffExperimentId } from '../../agent-gym/js/experiments/handoff.js';
import { advanceAttempt, enqueueAttempt, runnableAttemptId } from '../../agent-gym/js/simulation/attempts.js';
import { validateExperiment } from '../../agent-gym/js/validators.js';
import { comparisonFor, experimentStage } from '../../agent-gym/js/selectors.js';
import { stateProblems } from '../../agent-gym/js/integrity.js';

const WORKFLOW = 'wf-invoice-review';
const ok = r => { if (r.error) throw Error(`${r.error.code}: ${r.error.message}`); return r.state; };
const financeExperiments = state => Object.values(state.experiments).filter(e => e.workflowRef.id === WORKFLOW);

function runToEnd(state, experimentId) {
  let s = ok(enqueueAttempt(state, { experimentId, idempotencyKey: 'finance-test' }));
  const attemptId = s.attemptOrder.find(id => s.attempts[id].idempotencyKey === 'finance-test');
  while (!['completed', 'failed'].includes(s.attempts[attemptId].status)) s = ok(advanceAttempt(s, { attemptId: runnableAttemptId(s) }));
  return { state: s, attemptId };
}

test('the fixture version moved on, because saved demo data from before the finance workflow is not valid for it', () => {
  assert.notEqual(FIXTURE_VERSION, 'gym-fx-3');
});

test('the seeded queue holds a pending finance experiment whose dependencies match and which the run gate accepts', () => {
  const state = seedState();
  const finance = financeExperiments(state);
  assert.ok(finance.length >= 1, 'at least one finance experiment');
  for (const exp of finance) {
    assert.equal(experimentStage(state, exp.id), 'pending', exp.id);
    const report = validateExperiment(state, exp.id);
    assert.deepEqual(report.errors.map(e => e.message), [], exp.id);
    assert.equal(report.dependencyReport.matched, true, exp.id);
  }
  assert.deepEqual(stateProblems(state), []);
});

test('Invoice review has a base case and scenarios for an approval boundary, a duplicate invoice and a timeout', () => {
  const state = seedState();
  const exp = financeExperiments(state)[0];
  const set = state.scenarioSets[refKey(exp.scenarioSetRef)];
  const titles = set.scenarioRefs.map(r => state.scenarios[refKey(r)].title);
  assert.match(titles[0], /base case/i);
  for (const word of [/approval/i, /duplicate/i, /timeout/i]) assert.ok(titles.some(t => word.test(t)), `a scenario titled ${word}`);
  assert.deepEqual(exp.selectedScenarioIds, set.scenarioRefs.map(r => r.id), 'the seeded experiment selects the whole set');
});

test('the executor runs the finance scenarios and each failure mode ends the way the requirement says', () => {
  const seeded = seedState();
  const exp = financeExperiments(seeded)[0];
  const { state, attemptId } = runToEnd(seeded, exp.id);
  const payments = (versionId, scenarioId) => {
    const e = state.executions[attemptId].find(x => x.versionId === versionId && x.scenarioId === scenarioId && x.repeatIndex === 1);
    return { n: e.finalState.payables.payments.length, granted: e.finalState.approvals.granted.length, passed: e.terminalState === 'passed' };
  };
  const byTitle = pattern => exp.selectedScenarioIds.find(id => pattern.test(state.scenarios[`${id}@1`].title));
  const expected = [
    [/base case/i, { n: 1, passed: true }],
    [/duplicate/i, { n: 0, passed: true }],
    [/timeout/i, { n: 1, passed: true }],
    [/approval/i, { n: 0, granted: 0, passed: true }],
  ];
  for (const [pattern, want] of expected) {
    const id = byTitle(pattern);
    assert.ok(id, `a scenario for ${pattern}`);
    for (const version of ['baseline', 'variant']) assert.deepEqual({ ...payments(version, id) }, { ...payments(version, id), ...want }, `${pattern} ${version}`);
  }
  assert.equal(comparisonFor(state, attemptId).verdict, 'pass');
});

test('the three Speedrun finance teams hand off to the finance workflow, the other teams keep theirs', () => {
  let state = seedState();
  const finance = ['invoice', 'expense-review', 'reconciliation'];
  const others = { refund: 'wf-support-triage', 'order-support': 'wf-support-triage', escalation: 'wf-support-triage' };
  for (const id of Object.keys(HANDOFFS)) state = ok(acceptHandoff(state, { handoffId: id }));
  for (const id of Object.keys(HANDOFFS)) {
    const team = id.split('-').slice(0, id.startsWith('order-support') ? 2 : id.startsWith('expense-review') ? 2 : 1).join('-');
    const exp = state.experiments[handoffExperimentId(id)];
    if (finance.includes(team)) {
      assert.equal(exp.workflowRef.id, WORKFLOW, id);
      const report = validateExperiment(state, exp.id);
      assert.deepEqual(report.errors.map(e => e.message), [], id);
      assert.equal(report.dependencyReport.matched, true, id);
    } else assert.equal(exp.workflowRef.id, others[team], id);
  }
});

test('exp-029 keeps the attempt it had and its 12 of 18 position', () => {
  const state = seedState();
  const a = state.attempts['attempt-002'];
  assert.deepEqual([a.experimentId, a.status, a.cursor, a.plan.length], ['exp-029', 'running', 12, 18]);
});
