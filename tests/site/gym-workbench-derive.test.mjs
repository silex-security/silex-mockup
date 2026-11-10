// Workbench selectors over the seeded state (plan 4.2 to 4.4): version shown, node strip, diff, replay pick, run key.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedState, fixtureState } from '../../agent-gym/js/fixtures/index.js';
import { experimentSummary } from '../../agent-gym/js/selectors.js';
import { advanceAttempt, cancelAttempt, clearScenarioSelection, enqueueAttempt, renameExperiment, setEnvironment, setScenarioSet, toggleScenario } from '../../agent-gym/js/simulation/attempts.js';
import {
  attemptByKey, changeSet, missingDependencies, nodeDetail, nodeDiff, replayView, revisionNote, runKey, scenarioBuilderQuery, selectedNodeId, viewedVersion,
} from '../../agent-gym/js/workbench/derive.js';

const EXP = 'exp-029';
const ok = r => { assert.ok(r.state, JSON.stringify(r.error)); return r.state; };

test('the blueprint shows Variant A by default and Baseline on request; the strip starts on the changed node', () => {
  const s = seedState();
  assert.equal(viewedVersion(s, EXP, {}), 'variant');
  assert.equal(viewedVersion(s, EXP, { version: 'baseline' }), 'baseline');
  assert.equal(selectedNodeId(s, EXP, {}), 'draft-email');
  assert.equal(selectedNodeId(s, EXP, { node: 'send-email' }), 'send-email');
  assert.equal(selectedNodeId(s, EXP, { node: 'no-such-node' }), 'draft-email');
  const noVariant = { ...s, experiments: { ...s.experiments, [EXP]: { ...s.experiments[EXP], variantId: null } } };
  assert.equal(viewedVersion(noVariant, EXP, { version: 'variant' }), 'baseline', 'no variant means the baseline is all there is to show');
});

test('Draft email on Variant A reads as a model configuration change with a baseline diff', () => {
  const s = seedState();
  const d = nodeDetail(s, EXP, 'variant', 'draft-email');
  assert.equal(d.title, 'Draft email · Variant A');
  assert.equal(d.change, 'model configuration');
  const model = d.diff.find(r => r.key === 'model');
  assert.deepEqual([model.baseline, model.variant, model.changed], ['simulated-model-baseline', 'simulated-model-variant-a', true]);
  assert.ok(d.diff.some(r => r.key === 'timeoutRecovery' && r.changed));
  const base = nodeDetail(s, EXP, 'baseline', 'draft-email');
  assert.equal(base.title, 'Draft email · Baseline');
  assert.equal(base.change, null, 'the baseline view has no change');
  assert.equal(base.config.model, 'simulated-model-baseline');
});

test('other nodes describe their own dependency, inputs, outputs and the checks that read them', () => {
  const s = seedState();
  const send = nodeDetail(s, EXP, 'variant', 'send-email');
  assert.equal(send.change, null);
  assert.deepEqual(send.dependencies, [{ capability: 'email.send_email', matched: true }, { capability: 'email.get_send_status', matched: true }]);
  assert.deepEqual([send.inputs, send.outputs], ['Email draft, approval', 'Message id']);
  assert.ok(send.checks.some(c => c.label === 'Exactly one email sent' && c.scenario === 'Base case'));
  assert.ok(!send.checks.some(c => c.label === 'CRM updated once'), 'CRM checks belong to Update CRM');
  assert.deepEqual(send.faults, [{ scenario: 'Timeout after send', label: 'Timeout after send' }]);
  const skip = nodeDetail(s, EXP, 'variant', 'log-skipped');
  assert.deepEqual(skip.checks.map(c => c.label), ['Skip reason logged to CRM']);

  const it = ok(setEnvironment(s, { experimentId: EXP, environmentRef: { id: 'env-it', rev: '1.1' } }));
  assert.deepEqual(nodeDetail(it, EXP, 'variant', 'send-email').dependencies.map(x => x.matched), [false, false]);
  const missing = missingDependencies(it, EXP);
  assert.ok(missing.some(m => m.capability === 'crm.find_opportunity' && m.kind === 'tool'));
  assert.ok(missing.some(m => m.capability === 'email.timeout_after_send' && m.kind === 'fault'), 'the fault hook Timeout after send needs is reported apart from tools');
});

test('Compare changes lists every node and marks only the variant patch as changed', () => {
  const diff = nodeDiff(seedState(), EXP);
  assert.equal(diff.rows.length, 6);
  assert.deepEqual(diff.rows.filter(r => r.changed).map(r => r.id), ['draft-email']);
  assert.equal(diff.changedCount, 1);
});

test('the revision note names the frozen attempt the queue runs while the draft moves on', () => {
  const s = seedState();
  assert.deepEqual(revisionNote(s, EXP), { editing: 'Editing rev 4', frozen: 'rev 3 · attempt 1 is running in the queue', attemptId: 'attempt-002' });
  assert.equal(revisionNote(fixtureState(), EXP).frozen, null);
});

test('one run key per draft revision makes a repeated Run a no-op until the draft changes', () => {
  const s = seedState();
  const key = runKey(s, EXP);
  assert.equal(key, 'wb-exp-029-r4');
  const s1 = ok(enqueueAttempt(s, { experimentId: EXP, idempotencyKey: key }));
  const s2 = ok(enqueueAttempt(s1, { experimentId: EXP, idempotencyKey: runKey(s1, EXP) }));
  assert.equal(s2.attemptOrder.length, s.attemptOrder.length + 1);
  assert.equal(attemptByKey(s2, key).label, 'rev 4 · attempt 2');
  const s3 = ok(renameExperiment(s2, { experimentId: EXP, title: 'Experiment 029 b' }));
  assert.notEqual(runKey(s3, EXP), key);
});

test('after the attempt for a revision is cancelled or finished, Run on the same revision enqueues a new attempt, once', () => {
  const run = s => ok(enqueueAttempt(s, { experimentId: EXP, idempotencyKey: runKey(s, EXP) }));
  const s1 = run(seedState());
  const first = attemptByKey(s1, runKey(s1, EXP));
  const cancelled = ok(cancelAttempt(s1, { attemptId: first.id }));
  const s2 = run(cancelled);
  assert.equal(s2.attemptOrder.length, s1.attemptOrder.length + 1, 'a re-run after cancel is a new attempt');
  assert.equal(attemptByKey(s2, runKey(s2, EXP)).label, 'rev 4 · attempt 3');
  assert.equal(run(s2), s2, 'a double click on the re-run still enqueues once');

  let f = run(fixtureState());
  const id = f.attemptOrder[0];
  while (f.attempts[id].status !== 'completed') f = ok(advanceAttempt(f, { attemptId: id }));
  const again = run(f);
  assert.equal(again.attemptOrder.length, 2, 'a re-run after completion is a new attempt');
  assert.equal(run(again), again);
});

test('replay picks a recorded execution and falls back when the asked combination has not run', () => {
  const s = seedState();
  const r = replayView(s, EXP, {}, 'variant');
  assert.equal(r.attemptId, 'attempt-002');
  assert.deepEqual([r.execution.versionId, r.execution.scenarioId, r.execution.repeatIndex], ['variant', 'sc-base-case', 1]);
  assert.deepEqual(r.visited, ['find-opportunity', 'draft-email', 'contact-allowed', 'send-email', 'update-crm']);
  assert.equal(r.step, 1);
  assert.equal(r.currentNodeId, 'find-opportunity');
  const opted = replayView(s, EXP, { scenario: 'sc-contact-opted-out', rep: '3' }, 'baseline');
  assert.equal(opted.scenarios.find(x => x.id === 'sc-contact-opted-out').recorded, false, '12 of 18 runs: the third scenario has not run yet');
  assert.notEqual(opted.execution.scenarioId, 'sc-contact-opted-out');
  const timeout = replayView(s, EXP, { scenario: 'sc-timeout-after-send', rep: '2', step: '99' }, 'baseline');
  assert.deepEqual([timeout.execution.scenarioId, timeout.execution.repeatIndex, timeout.execution.versionId], ['sc-timeout-after-send', 2, 'baseline']);
  assert.equal(timeout.step, timeout.events.length, 'a step past the end clamps to the last event');
  assert.equal(timeout.blueprint.nodes.find(n => n.id === 'send-email').faultMarker, 'Timeout injection');
  assert.equal(replayView(fixtureState(), EXP, {}, 'variant'), null, 'nothing recorded, nothing to replay');
});

test('a five-scenario set put on the experiment by another screen recomputes the counts to 30 runs', () => {
  const s = seedState();
  const refs = ['sc-base-case', 'sc-timeout-after-send', 'sc-contact-opted-out', 'sc-sup-rephrased', 'sc-sup-ambiguous'].map(id => ({ id, rev: '1' }));
  const set = { id: 'set-test-five', rev: '1', name: 'Five scenarios', environmentRef: { id: 'env-sales', rev: '1.2' }, workflowRef: { id: 'wf-sales-follow-up', rev: '1' }, scenarioRefs: refs, digest: 'test' };
  const s1 = ok(setScenarioSet({ ...s, scenarioSets: { ...s.scenarioSets, 'set-test-five@1': set } }, { experimentId: EXP, scenarioSetRef: { id: 'set-test-five', rev: '1' } }));
  const sum = experimentSummary(s1, EXP);
  assert.deepEqual([sum.selectedScenarioCount, sum.runs, sum.pairs], [5, 30, 15]);
  assert.equal(sum.formula, '2 versions × 5 scenarios × 3 repetitions = 30 runs');
  const s2 = ok(clearScenarioSelection(s1, { experimentId: EXP }));
  assert.equal(experimentSummary(ok(toggleScenario(s2, { experimentId: EXP, scenarioId: 'sc-base-case' })), EXP).runs, 6);
});

test('scenario builder entries carry the experiment environment and workflow', () => {
  assert.deepEqual(scenarioBuilderQuery(seedState(), EXP, { source: 'trace' }), { environment: 'env-sales@1.2', workflow: 'wf-sales-follow-up', source: 'trace' });
});

test('the change set lists every field of each changed step and marks the ones that differ between the two versions', () => {
  const set = changeSet(seedState(), EXP);
  assert.deepEqual([set.baselineLabel, set.variantLabel, set.changeCount], ['Sales follow-up · rev 1', 'Variant A', 2]);
  assert.deepEqual(set.rows.map(r => [r.node, r.field, r.baseline, r.variant, r.changed]), [
    ['Draft email', 'model', 'simulated-model-baseline', 'simulated-model-variant-a', true],
    ['Draft email', 'timeoutRecovery', 'retry_new_key', 'check_status_reuse_key', true],
    ['Draft email', 'tone', 'concise', 'concise', false],
  ]);
  assert.equal(set.changeCount, set.rows.filter(r => r.changed).length);
  const noVariant = { ...seedState(), experiments: { ...seedState().experiments, [EXP]: { ...seedState().experiments[EXP], variantId: null } } };
  assert.equal(changeSet(noVariant, EXP), null, 'no variant, nothing to compare');
});

test('the change set follows the variant the experiment uses', () => {
  const small = changeSet(seedState(), 'exp-025');
  assert.deepEqual([small.baselineLabel, small.variantLabel, small.changeCount], ['Support triage v2 · rev 2', 'Small model', 2]);
  assert.deepEqual(small.rows.find(r => r.field === 'timeoutRecovery'), { nodeId: 'draft-reply', node: 'Draft reply', field: 'timeoutRecovery', baseline: 'check_status_reuse_key', variant: 'stop', changed: true });
});
