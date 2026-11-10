// Shared-agent impact ("blast radius"): a variant changes how one agent behaves at one step, and every other workflow the
// same agent works in is affected too. Pure checks over the reducers and selectors; the page is in gym-impact-ui.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedState, fixtureState } from '../../agent-gym/js/fixtures/index.js';
import { clone } from '../../agent-gym/js/model.js';
import { stateProblems } from '../../agent-gym/js/integrity.js';
import { advanceAttempt, cancelAttempt, enqueueAttempt, runnableAttemptId, setExperimentSettings } from '../../agent-gym/js/simulation/attempts.js';
import { checkSharedImpact, impactRunCount, impactRuns, sharedAgentImpact } from '../../agent-gym/js/runs/impact.js';
import { acceptanceVerdict, attemptResultSummary, experimentStage, experimentSummary, queueRows } from '../../agent-gym/js/selectors.js';
import { runKey } from '../../agent-gym/js/workbench/derive.js';

const ok = r => { if (r.error) throw Error(`${r.error.code}: ${r.error.message}`); return r.state; };
const impactAttempts = (state, experimentId) => state.attemptOrder.map(id => state.attempts[id]).filter(a => a.impactOf?.experimentId === experimentId);
const finishImpact = (state, experimentId) => {
  let s = state;
  while (impactAttempts(s, experimentId).some(a => ['queued', 'running'].includes(a.status))) s = ok(advanceAttempt(s, { attemptId: runnableAttemptId(s) }));
  return s;
};
const names = list => list.map(w => w.name).sort();

test('every step names an agent that exists, and a step naming an unknown agent fails the integrity check', () => {
  const state = seedState();
  const ids = Object.keys(state.agents);
  assert.ok(ids.length >= 2);
  for (const [id, a] of Object.entries(state.agents)) assert.deepEqual(Object.keys(a).sort(), ['id', 'name'], id);
  for (const w of Object.values(state.workflows)) for (const n of w.nodes) assert.ok(ids.includes(n.agentId), `${w.name} · ${n.label}`);
  assert.deepEqual(stateProblems(state), []);

  const broken = clone(state);
  broken.workflows['wf-invoice-review@1'].nodes[0].agentId = 'agent-nobody';
  assert.deepEqual(stateProblems(broken), ['wf-invoice-review@1: Read invoice names agent agent-nobody, which does not exist']);
});

test('at least two agents work in two or more workflows, one is changed by the exp-029 variant and one works in Invoice review', () => {
  const state = seedState();
  const workflowsOf = agentId => new Set(Object.values(state.workflows).filter(w => w.nodes.some(n => n.agentId === agentId)).map(w => w.id));
  const shared = Object.keys(state.agents).filter(id => workflowsOf(id).size >= 2);
  assert.ok(shared.length >= 2);
  const draft = state.workflows['wf-sales-follow-up@1'].nodes.find(n => n.id === 'draft-email').agentId;
  assert.ok(shared.includes(draft), 'the agent exp-029 changes is shared');
  assert.ok(shared.some(id => workflowsOf(id).has('wf-invoice-review')), 'an agent in Invoice review is shared');
});

test('sharedAgentImpact names the changed agent, its changed fields and only the other workflows it works in', () => {
  const impact = sharedAgentImpact(seedState(), 'exp-029');
  assert.equal(impact.agents.length, 1);
  const [agent] = impact.agents;
  assert.equal(agent.name, 'Correspondence agent');
  assert.deepEqual(agent.changedFields, ['model', 'timeoutRecovery'], 'the same fields the What changes strip marks as different');
  assert.deepEqual(names(agent.workflows), ['Invoice review', 'Support triage v2']);
  assert.deepEqual(agent.workflows.find(w => w.workflowId === 'wf-support-triage').steps, ['Draft reply', 'Reply to customer']);
  assert.ok(!agent.workflows.some(w => w.workflowId === 'wf-sales-follow-up'), 'the experiment\'s own workflow is not listed');
});

test('an experiment whose changed agent works nowhere else has no shared agent', () => {
  const state = clone(seedState());
  state.workflows['wf-invoice-review@1'].nodes.find(n => n.id === 'schedule-payment').agentId = 'agent-ledger';
  assert.deepEqual(sharedAgentImpact(state, 'exp-027'), { agents: [] });
  assert.equal(acceptanceVerdict(state, 'attempt-001').checks.some(c => c.id === 'shared-agents'), false);
  assert.equal(checkSharedImpact(state, { experimentId: 'exp-027' }).error.code, 'impact_nothing_to_run');
});

test('a changed field the other workflow\'s step does not have makes it not comparable, with the reason, and no run is faked', () => {
  const state = seedState();
  const rows = impactRuns(state, 'exp-027');
  assert.deepEqual(rows.map(r => [r.name, r.state]), [['Invoice review', 'not_comparable']]);
  assert.match(rows[0].reason, /Schedule payment has no model or timeoutRecovery setting/);
  assert.equal(checkSharedImpact(state, { experimentId: 'exp-027' }).error.code, 'impact_nothing_to_run');
  assert.equal(impactRunCount(state, 'exp-027'), 0);
});

test('the check runs each comparable workflow\'s own scenario set with the same field changes, as change attempts linked to the experiment', () => {
  const before = seedState();
  const after = ok(checkSharedImpact(before, { experimentId: 'exp-029' }));
  const added = after.attemptOrder.slice(before.attemptOrder.length).map(id => after.attempts[id]);
  assert.deepEqual(added.map(a => a.inputSnapshot.workflow.name).sort(), ['Invoice review', 'Support triage v2']);
  for (const a of added) {
    assert.equal(a.trigger.kind, 'change');
    assert.equal(a.experimentId, 'exp-029');
    assert.equal(a.impactOf.experimentId, 'exp-029');
    assert.equal(a.status, 'queued');
    assert.equal(a.inputSnapshot.repetitions, 1);
  }
  const support = added.find(a => a.inputSnapshot.workflow.id === 'wf-support-triage');
  assert.equal(support.inputSnapshot.scenarioSet.id, 'set-refund-triage-v2');
  assert.equal(support.inputSnapshot.scenarios.length, 8);
  assert.equal(support.plan.length, 16, '2 versions × 8 scenarios × 1 repetition');
  const patch = support.inputSnapshot.variant.patch;
  assert.deepEqual(patch.map(p => [p.nodeId, p.model]), [['draft-reply', 'simulated-model-variant-a']], 'only the step that has the changed settings');
  assert.equal(impactRunCount(before, 'exp-029'), 26, '16 for Support triage v2 plus 10 for Invoice review');
});

test('impact runs are not part of the experiment: stage, run count, run key and attempt numbering are unchanged', () => {
  const before = seedState();
  const after = ok(checkSharedImpact(before, { experimentId: 'exp-029' }));
  assert.equal(experimentStage(after, 'exp-029'), experimentStage(before, 'exp-029'));
  assert.deepEqual(experimentSummary(after, 'exp-029'), experimentSummary(before, 'exp-029'));
  assert.equal(experimentSummary(after, 'exp-029').runs, 18);
  assert.equal(runKey(after, 'exp-029'), runKey(before, 'exp-029'));
  const manual = ok(enqueueAttempt(after, { experimentId: 'exp-032', idempotencyKey: 'k' }));
  assert.match(manual.attempts[manual.attemptOrder.at(-1)].label, /attempt 1$/);
  const rows = queueRows(after).filter(r => r.impactOf?.experimentId === 'exp-029');
  assert.equal(rows.length, 2);
  assert.equal(queueRows(after).filter(r => !r.impactOf).length, queueRows(before).filter(r => !r.impactOf).length, 'no own run was added');
});

test('asking again while a check is queued or running enqueues nothing new; a cancelled check can be asked for again', () => {
  const once = ok(checkSharedImpact(seedState(), { experimentId: 'exp-029' }));
  assert.equal(checkSharedImpact(once, { experimentId: 'exp-029' }).state, once, 'the very same state, not a second batch');
  const start = finishUntilImpactRuns(once);
  const running = ok(advanceAttempt(start, { attemptId: runnableAttemptId(start) }));
  assert.equal(running.attempts[runnableAttemptId(start)].status, 'running');
  assert.equal(checkSharedImpact(running, { experimentId: 'exp-029' }).state, running);
  let s = once;
  for (const a of impactAttempts(once, 'exp-029')) s = ok(cancelAttempt(s, { attemptId: a.id }));
  const again = ok(checkSharedImpact(s, { experimentId: 'exp-029' }));
  assert.equal(impactAttempts(again, 'exp-029').length, 4, 'two cancelled plus two new');
  assert.equal(new Set(impactAttempts(again, 'exp-029').map(a => a.idempotencyKey)).size, 4);
});

function finishUntilImpactRuns(state) {
  let s = state;
  while (!impactAttempts(s, 'exp-029').some(a => a.id === runnableAttemptId(s))) s = ok(advanceAttempt(s, { attemptId: runnableAttemptId(s) }));
  return s;
}

test('the acceptance verdict reads the impact runs: not run yet, then passed once they finish with no regressed pair', () => {
  const done = seedState();
  const pending = acceptanceVerdict(done, 'attempt-006').checks.find(c => c.id === 'shared-agents');
  assert.deepEqual([pending.passed, pending.state, pending.detail], [false, 'pending', 'Not run yet']);

  const queued = ok(checkSharedImpact(done, { experimentId: 'exp-026' }));
  assert.equal(acceptanceVerdict(queued, 'attempt-006').checks.find(c => c.id === 'shared-agents').state, 'pending');
  const finished = finishImpact(queued, 'exp-026');
  const check = acceptanceVerdict(finished, 'attempt-006').checks.find(c => c.id === 'shared-agents');
  assert.deepEqual([check.passed, check.state], [true, 'passed']);
  assert.equal(check.runs.length, 2, 'links to both impact runs');
});

test('the rule is a setting frozen into the attempt: switched off, there is no such check', () => {
  const off = ok(setExperimentSettings(seedState(), { experimentId: 'exp-032', noSharedRegression: false }));
  assert.equal(off.experiments['exp-032'].acceptance.noSharedRegression, false);
  const queued = ok(enqueueAttempt(off, { experimentId: 'exp-032', idempotencyKey: 'k' }));
  assert.equal(acceptanceVerdict(queued, queued.attemptOrder.at(-1)).checks.some(c => c.id === 'shared-agents'), false);
  const on = ok(enqueueAttempt(seedState(), { experimentId: 'exp-032', idempotencyKey: 'k' }));
  assert.equal(acceptanceVerdict(on, on.attemptOrder.at(-1)).checks.some(c => c.id === 'shared-agents'), true);
});

test('the seed carries finished impact runs: the smaller model that stops after a timeout regresses the careful Invoice review', () => {
  const state = seedState();
  const rows = impactRuns(state, 'exp-025');
  const byName = Object.fromEntries(rows.map(r => [r.name, r]));
  assert.equal(byName['Invoice review'].state, 'done');
  assert.equal(byName['Invoice review'].regressed, 1, 'only the timeout scenario: the baseline schedules once, the smaller model stops');
  assert.equal(byName['Sales follow-up'].regressed, 0);
  const check = acceptanceVerdict(state, 'attempt-005').checks.find(c => c.id === 'shared-agents');
  assert.deepEqual([check.passed, check.state, check.detail], [false, 'failed', '1 regressed pair in 1 workflow']);
  assert.match(attemptResultSummary(state, 'attempt-005').text, /shared workflows: 1 regressed/);
  assert.equal(attemptResultSummary(state, 'attempt-005').tone, 'red');

  const exp024 = acceptanceVerdict(state, 'attempt-004').checks.find(c => c.id === 'shared-agents');
  assert.deepEqual([exp024.passed, exp024.state], [true, 'passed']);
});

test('an impact attempt that points at no experiment fails the integrity check', () => {
  const state = clone(ok(checkSharedImpact(seedState(), { experimentId: 'exp-029' })));
  const id = state.attemptOrder.at(-1);
  state.attempts[id].impactOf.experimentId = 'exp-999';
  assert.deepEqual(stateProblems(state), [`${id}: is an impact run of exp-999, which does not exist`]);
  assert.deepEqual(stateProblems(fixtureState()), []);
});
