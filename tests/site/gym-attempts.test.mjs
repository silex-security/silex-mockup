// Agent Gym v2 attempt lifecycle and draft edits (plan 4.2, 4.4, 4.5, 7.2, 9.3; 13.1 items 6 and 11).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { digestOf } from '../../agent-gym/js/model.js';
import { fixtureState, seedState } from '../../agent-gym/js/fixtures/index.js';
import {
  addVariant, advanceAttempt, cancelAttempt, clearScenarioSelection, createOrSelectVariant, enqueueAttempt, pauseAttempt,
  freezeAttempt, recordReview, renameExperiment, resumeAttempt, runnableAttemptId, saveExperiment, setRepetitions, setScenarioSet,
  setWorkflow, toggleScenario,
} from '../../agent-gym/js/simulation/attempts.js';
import { compareAttempt } from '../../agent-gym/js/metrics.js';

const EXP = 'exp-029';
const ok = result => { assert.ok(result.state, JSON.stringify(result.error)); return result.state; };
const enqueue = (s, experimentId = EXP, idempotencyKey = `key-${experimentId}`) => ok(enqueueAttempt(s, { experimentId, idempotencyKey }));
const advance = (s, attemptId, times = 1) => { for (let i = 0; i < times; i++) s = ok(advanceAttempt(s, { attemptId })); return s; };
const finish = (s, attemptId) => { while (s.attempts[attemptId].status !== 'completed') s = advance(s, attemptId); return s; };

test('enqueue twice with one key creates one attempt; a new key creates another', () => {
  const s0 = fixtureState();
  const s1 = enqueue(s0, EXP, 'click-1');
  const s2 = enqueue(s1, EXP, 'click-1');
  assert.equal(s2, s1, 'the same key returns the same state');
  assert.equal(s2.attemptOrder.length, 1);
  const a = s2.attempts[s2.attemptOrder[0]];
  assert.deepEqual([a.status, a.runner, a.cursor, a.plan.length, a.label], ['queued', 'active', 0, 18, 'rev 3 · attempt 1']);
  const s3 = enqueue(s2, EXP, 'click-2');
  assert.equal(s3.attemptOrder.length, 2);
  assert.equal(s3.attempts[s3.attemptOrder[1]].label, 'rev 3 · attempt 2');
  assert.equal(s0.attemptOrder.length, 0, 'reducers never mutate their input');
});

test('an idempotency key belongs to its experiment, so another experiment\'s enqueue is never swallowed', () => {
  const s = enqueue(enqueue(fixtureState(), EXP, 'shared'), 'exp-027', 'shared');
  assert.deepEqual(s.attemptOrder.map(id => s.attempts[id].experimentId), [EXP, 'exp-027']);
});

test('enqueue validates first and saves the draft it freezes', () => {
  const blocked = enqueueAttempt(ok(clearScenarioSelection(fixtureState(), { experimentId: EXP })), { experimentId: EXP, idempotencyKey: 'k' });
  assert.equal(blocked.error.code, 'experiment_invalid');
  assert.equal(blocked.error.fix.action, 'select-scenarios');
  const edited = ok(setRepetitions(fixtureState(), { experimentId: EXP, repetitions: 2 }));
  assert.equal(edited.experiments[EXP].savedRevision, 3);
  const s = enqueue(edited);
  assert.deepEqual([s.experiments[EXP].draftRevision, s.experiments[EXP].savedRevision], [4, 4]);
  assert.equal(s.attempts[s.attemptOrder[0]].plan.length, 12);
});

test('editing the draft after freezing changes neither the digest nor the results', () => {
  let s = enqueue(fixtureState());
  const id = s.attemptOrder[0];
  const frozen = s.attempts[id];
  assert.ok(Object.isFrozen(frozen.inputSnapshot.workflow.modelConfig['draft-email'].traits));
  assert.throws(() => { frozen.inputSnapshot.scenarios[0].title = 'changed'; }, TypeError);
  assert.equal(frozen.inputDigest, digestOf(frozen.inputSnapshot));

  s = ok(renameExperiment(s, { experimentId: EXP, title: 'Experiment 029' }));
  s = ok(setRepetitions(s, { experimentId: EXP, repetitions: 1 }));
  s = ok(toggleScenario(s, { experimentId: EXP, scenarioId: 'sc-timeout-after-send' }));
  s = { ...s, workflows: { ...s.workflows, 'wf-sales-follow-up@1': { ...s.workflows['wf-sales-follow-up@1'], modelConfig: {} } } };
  s = finish(s, id);
  const after = s.attempts[id];
  assert.equal(after.inputDigest, frozen.inputDigest);
  assert.equal(digestOf(after.inputSnapshot), frozen.inputDigest);
  assert.equal(s.executions[id].length, 18);
  const c = compareAttempt(after, s.executions[id]);
  assert.deepEqual([c.totals.baseline.pass, c.totals.variant.pass], [6, 9], 'results come from the frozen revision');
});

test('advance appends exactly one execution and completed does not mean passed', () => {
  let s = enqueue(fixtureState());
  const id = s.attemptOrder[0];
  for (let i = 1; i <= 18; i++) {
    s = advance(s, id);
    assert.equal(s.executions[id].length, i);
    assert.equal(s.attempts[id].cursor, i);
    assert.equal(s.attempts[id].status, i === 18 ? 'completed' : 'running');
  }
  assert.deepEqual(s.executions[id].map(e => e.id), s.attempts[id].plan.map(p => `${id}/${p.id}`), 'executions follow the plan order');
  assert.ok(s.executions[id].every(e => e.attemptId === id));
  assert.ok(s.executions[id].some(e => e.terminalState === 'failed'), 'the completed attempt still has failing runs');
  assert.equal(advanceAttempt(s, { attemptId: id }).error.code, 'attempt_finished');
});

test('one running attempt at a time; completing releases the slot to the next queued attempt', () => {
  let s = enqueue(enqueue(fixtureState(), EXP), 'exp-027');
  const [a, b] = s.attemptOrder;
  assert.equal(runnableAttemptId(s), a);
  s = advance(s, a);
  assert.equal(advanceAttempt(s, { attemptId: b }).error.code, 'slot_busy');
  s = finish(s, a);
  assert.deepEqual([s.attempts[a].status, s.attempts[b].status], ['completed', 'running']);
  assert.equal(runnableAttemptId(s), b);
  s = advance(s, b);
  assert.equal(s.executions[b].length, 1);
});

test('cancel keeps finished executions, never runs the rest, and releases the slot', () => {
  let s = enqueue(enqueue(fixtureState(), EXP), 'exp-027');
  const [a, b] = s.attemptOrder;
  s = advance(s, a, 5);
  s = ok(cancelAttempt(s, { attemptId: a }));
  assert.deepEqual([s.attempts[a].status, s.executions[a].length, s.attempts[a].cursor], ['cancelled', 5, 5]);
  assert.equal(advanceAttempt(s, { attemptId: a }).error.code, 'attempt_finished');
  assert.equal(s.attempts[b].status, 'running');
  assert.equal(compareAttempt(s.attempts[a], s.executions[a]).verdict, 'inconclusive');
  assert.equal(ok(cancelAttempt(s, { attemptId: a })), s, 'cancel is idempotent');
  const rerun = enqueue(s, EXP, 'rerun');
  assert.equal(rerun.attemptOrder.length, 3, 'a rerun creates a new attempt');
});

test('pause holds the slot; resume continues; paused attempts are not runnable', () => {
  let s = enqueue(enqueue(fixtureState(), EXP), 'exp-027');
  const [a, b] = s.attemptOrder;
  s = advance(s, a, 2);
  s = ok(pauseAttempt(s, { attemptId: a }));
  assert.equal(advanceAttempt(s, { attemptId: a }).error.code, 'attempt_paused');
  assert.equal(runnableAttemptId(s), null, 'a paused running attempt keeps the slot');
  assert.equal(advanceAttempt(s, { attemptId: b }).error.code, 'slot_busy');
  s = ok(resumeAttempt(s, { attemptId: a }));
  assert.equal(runnableAttemptId(s), a);
  assert.equal(advance(s, a).executions[a].length, 3);
});

test('recordReview needs a finished attempt and a legal decision, and is never a deployment', () => {
  let s = enqueue(fixtureState());
  const id = s.attemptOrder[0];
  assert.equal(recordReview(s, { attemptId: id, decision: 'pass_for_demo' }).error.code, 'attempt_not_finished');
  s = finish(s, id);
  assert.equal(recordReview(s, { attemptId: id, decision: 'deploy' }).error.code, 'invalid_decision');
  s = ok(recordReview(s, { attemptId: id, decision: 'needs_iteration', note: 'Check retries', reviewedAt: '2026-11-09T12:00:00Z' }));
  assert.deepEqual(s.attempts[id].review, { decision: 'needs_iteration', note: 'Check retries', reviewedAt: '2026-11-09T12:00:00Z', deploymentState: 'not_deployed' });
  assert.equal(s.attempts[id].status, 'completed', 'review is separate from status');
});

test('pass for demo needs a Pass verdict, also when a second review replaces the first', () => {
  let s = advance(enqueue(fixtureState()), 'attempt-001', 4);
  s = ok(cancelAttempt(s, { attemptId: 'attempt-001' }));
  assert.equal(compareAttempt(s.attempts['attempt-001'], s.executions['attempt-001']).verdict, 'inconclusive');
  assert.equal(recordReview(s, { attemptId: 'attempt-001', decision: 'pass_for_demo' }).error?.code, 'review_needs_pass');
  s = ok(recordReview(s, { attemptId: 'attempt-001', decision: 'needs_iteration', note: 'Rerun' }));
  const again = recordReview(s, { attemptId: 'attempt-001', decision: 'pass_for_demo' });
  assert.equal(again.error?.code, 'review_needs_pass');
  let done = finish(enqueue(fixtureState()), 'attempt-001');
  done = ok(recordReview(done, { attemptId: 'attempt-001', decision: 'reject' }));
  done = ok(recordReview(done, { attemptId: 'attempt-001', decision: 'pass_for_demo' }));
  assert.equal(done.attempts['attempt-001'].review.decision, 'pass_for_demo', 'the default attempt reads Pass, so a second review may pass it');
});

test('draft edits bump the draft revision and save marks it saved', () => {
  let s = fixtureState();
  assert.equal(renameExperiment(s, { experimentId: EXP, title: '   ' }).error.code, 'invalid_title');
  assert.equal(setRepetitions(s, { experimentId: EXP, repetitions: 11 }).error.code, 'repetitions_out_of_range');
  assert.equal(toggleScenario(s, { experimentId: EXP, scenarioId: 'sc-mtg-intro' }).error.code, 'scenario_not_in_set');
  assert.equal(ok(setRepetitions(s, { experimentId: EXP, repetitions: 3 })), s, 'a no-op edit keeps the state');
  s = ok(toggleScenario(s, { experimentId: EXP, scenarioId: 'sc-base-case' }));
  assert.deepEqual(s.experiments[EXP].selectedScenarioIds, ['sc-timeout-after-send', 'sc-contact-opted-out']);
  s = ok(toggleScenario(s, { experimentId: EXP, scenarioId: 'sc-base-case' }));
  assert.deepEqual(s.experiments[EXP].selectedScenarioIds, ['sc-base-case', 'sc-timeout-after-send', 'sc-contact-opted-out'], 'set order is kept');
  assert.deepEqual([s.experiments[EXP].draftRevision, s.experiments[EXP].savedRevision], [5, 3]);
  s = ok(saveExperiment(s, { experimentId: EXP }));
  assert.equal(s.experiments[EXP].savedRevision, 5);
  s = ok(setScenarioSet(s, { experimentId: EXP, scenarioSetRef: { id: 'set-meeting-scheduling', rev: '1' } }));
  assert.equal(s.experiments[EXP].selectedScenarioIds.length, 6, 'using a new set selects its scenarios');
});

test('only one variant: select the existing one, create when absent, typed error on a second', () => {
  let s = { ...fixtureState() };
  s.experiments = { ...s.experiments, [EXP]: { ...s.experiments[EXP], variantId: null } };
  s = ok(createOrSelectVariant(s, { experimentId: EXP }));
  assert.equal(s.experiments[EXP].variantId, 'variant-a');
  const limit = addVariant(s, { experimentId: EXP });
  assert.equal(limit.error.code, 'variant_limit');
  assert.ok(limit.error.fix.label);

  const { 'variant-a': _gone, ...others } = s.variants;
  let bare = { ...s, variants: others, experiments: { ...s.experiments, [EXP]: { ...s.experiments[EXP], variantId: null } } };
  bare = ok(createOrSelectVariant(bare, { experimentId: EXP }));
  const created = bare.variants[bare.experiments[EXP].variantId];
  assert.deepEqual([created.name, created.changedNodeIds, created.patch[0].model], ['Variant A', ['draft-email'], 'simulated-model-variant-a']);
  assert.equal(Object.values(bare.variants).filter(v => v.workflowRef.id === 'wf-sales-follow-up').length, 1);
  assert.equal(ok(createOrSelectVariant(bare, { experimentId: EXP })), bare, 'pressing it again selects, never duplicates');
});

test('switching workflow picks that workflow\'s variant and keeps the scenarios', () => {
  const s = ok(setWorkflow(fixtureState(), { experimentId: EXP, workflowRef: { id: 'wf-meeting-scheduling', rev: '1' } }));
  assert.equal(s.experiments[EXP].variantId, 'variant-meeting-a');
  assert.equal(s.experiments[EXP].selectedScenarioIds.length, 3);
});

test('an attempt whose runner faults becomes failed, releases the slot and compares as inconclusive', () => {
  let s = enqueue(enqueue(fixtureState(), EXP), 'exp-027');
  const [a, b] = s.attemptOrder;
  const snap = structuredClone(s.attempts[a].inputSnapshot);
  snap.environment.dataSeed.db.contacts = [];
  snap.scenarios[0].initialState.patch = { 'contact.optOut': true };
  s = { ...s, attempts: { ...s.attempts, [a]: { ...s.attempts[a], inputSnapshot: snap } } };
  s = advance(s, a);
  assert.deepEqual([s.attempts[a].status, s.executions[a].length, s.executions[a][0].terminalState], ['failed', 1, 'error']);
  assert.equal(s.attempts[b].status, 'running', 'the slot passes to the next queued attempt');
  assert.equal(runnableAttemptId(s), b);
  assert.equal(advanceAttempt(s, { attemptId: a }).error.code, 'attempt_finished');
  assert.equal(compareAttempt(s.attempts[a], s.executions[a]).verdict, 'inconclusive');
});

test('a new attempt never reuses an existing attempt id, even when seq lags behind', () => {
  const s = { ...seedState(), seq: 0 };
  assert.ok(!(freezeAttempt(s, EXP, 'k').id in s.attempts));
  const next = enqueue(s, EXP, 'k');
  assert.equal(next.attemptOrder.length, 4);
  assert.equal(new Set(next.attemptOrder).size, 4);
  assert.equal(next.attempts['attempt-001'].title, s.attempts['attempt-001'].title, 'the existing attempt is untouched');
});

test('a dangling or duplicate scenario ref is a typed error, never a throw', () => {
  const s = fixtureState();
  const dangling = { ...s, scenarios: { ...s.scenarios } };
  delete dangling.scenarios['sc-contact-opted-out@1'];
  const r = enqueueAttempt(dangling, { experimentId: EXP, idempotencyKey: 'd' });
  assert.equal(r.error?.code, 'experiment_invalid');
  assert.ok(r.error.errors.some(e => e.code === 'scenario_missing'), r.error.errors.map(e => e.code).join());
  const key = 'set-meeting-scheduling@1';
  const set = s.scenarioSets[key];
  const dup = { ...s, scenarioSets: { ...s.scenarioSets, [key]: { ...set, scenarioRefs: [set.scenarioRefs[0], ...set.scenarioRefs] } } };
  assert.equal(setScenarioSet(dup, { experimentId: EXP, scenarioSetRef: { id: set.id, rev: set.rev } }).error?.code, 'scenario_set_invalid');
  assert.equal(setScenarioSet(dangling, { experimentId: 'exp-027', scenarioSetRef: { id: 'set-follow-up-resilience', rev: '1' } }).error?.code, 'scenario_set_invalid');
});
