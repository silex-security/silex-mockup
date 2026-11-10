// Agent Gym v2 run gate (plan 4.2 to 4.4, 7.2, 9.3; 13.1 items 3 and 5). Each blocking condition from plan 7.2
// produces a typed error with a fix, and "Dependencies matched" comes from the dependency report.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureState } from '../../agent-gym/js/fixtures/index.js';
import { buildEnvironmentRevision } from '../../agent-gym/js/fixtures/environments.js';
import { validateExperiment } from '../../agent-gym/js/validators.js';
import { N3_SET } from './gym-n3-scenarios.mjs';

const EXP = 'exp-029';
const editExp = (state, patch) => ({ ...state, experiments: { ...state.experiments, [EXP]: { ...state.experiments[EXP], ...patch } } });
const codes = report => report.errors.map(e => e.code);

function withSalesRevision(state, rev, editGmail) {
  const { capabilities, faultCapabilities, validation, digest, ...spec } = structuredClone(state.environments['env-sales@1.2']);
  editGmail(spec.components.find(c => c.id === 'gmail'));
  const env = buildEnvironmentRevision({ ...spec, rev });
  return editExp({ ...state, environments: { ...state.environments, [`env-sales@${rev}`]: env } }, { environmentRef: { id: 'env-sales', rev } });
}

test('the default experiment is runnable: 18 runs, 9 pairs, dependencies matched', () => {
  const r = validateExperiment(fixtureState(), EXP);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.dependencyReport, { matched: true, missing: [] });
  assert.deepEqual([r.executionCount, r.pairCount], [18, 9]);
});

test('a five-scenario set counts 30 runs and 15 pairs', () => {
  const s = fixtureState();
  const scenarios = { ...s.scenarios, ...Object.fromEntries(N3_SET.map(x => [`${x.id}@1`, x])) };
  const set = { id: 'set-n3', rev: '1', name: 'Approval variations', environmentRef: { id: 'env-sales', rev: '1.2' }, workflowRef: { id: 'wf-sales-follow-up', rev: '1' }, scenarioRefs: N3_SET.map(x => ({ id: x.id, rev: '1' })), digest: 'x' };
  const state = editExp({ ...s, scenarios, scenarioSets: { ...s.scenarioSets, 'set-n3@1': set } }, { scenarioSetRef: { id: 'set-n3', rev: '1' }, selectedScenarioIds: N3_SET.map(x => x.id) });
  const r = validateExperiment(state, EXP);
  assert.deepEqual(r.errors, []);
  assert.deepEqual([r.executionCount, r.pairCount], [30, 15]);
});

test('every blocking condition from plan 7.2 is a typed error with a fix', () => {
  const s = fixtureState();
  const cases = [
    ['environment_missing', editExp(s, { environmentRef: { id: 'env-sales', rev: '9.9' } })],
    ['baseline_missing', editExp(s, { workflowRef: { id: 'wf-gone', rev: '1' } })],
    ['variant_missing', editExp(s, { variantId: null })],
    ['no_scenarios_selected', editExp(s, { selectedScenarioIds: [] })],
    ['repetitions_out_of_range', editExp(s, { repetitions: 0 })],
    ['repetitions_out_of_range', editExp(s, { repetitions: 11 })],
    ['repetitions_out_of_range', editExp(s, { repetitions: 2.5 })],
    ['scenario_unreviewed', { ...s, scenarios: { ...s.scenarios, 'sc-timeout-after-send@1': { ...s.scenarios['sc-timeout-after-send@1'], reviewState: 'needs_review' } } }],
    ['unknown_override', { ...s, scenarios: { ...s.scenarios, 'sc-base-case@1': { ...s.scenarios['sc-base-case@1'], overrides: [{ kind: 'data', target: 'contact.salary', value: 1, label: '' }] } } }],
    ['scenario_not_in_set', editExp(s, { selectedScenarioIds: ['sc-base-case', 'sc-mtg-intro'] })],
  ];
  for (const [code, state] of cases) {
    const r = validateExperiment(state, EXP);
    assert.ok(codes(r).includes(code), `${code}: got ${codes(r)}`);
    for (const e of r.errors) assert.ok(e.fix?.label, `${e.code} has a fix label`);
  }
  for (const repetitions of [1, 10]) assert.deepEqual(codes(validateExperiment(editExp(s, { repetitions }), EXP)), [], `${repetitions} repetitions are legal`);
});

test('an unreviewed scenario names the scenario to review', () => {
  const s = fixtureState();
  const state = { ...s, scenarios: { ...s.scenarios, 'sc-contact-opted-out@1': { ...s.scenarios['sc-contact-opted-out@1'], reviewState: 'draft' } } };
  const e = validateExperiment(state, EXP).errors.find(x => x.code === 'scenario_unreviewed');
  assert.deepEqual([e.scenarioId, e.fix.action], ['sc-contact-opted-out', 'review-scenario']);
  assert.equal(validateExperiment(editExp(state, { selectedScenarioIds: ['sc-base-case'] }), EXP).errors.length, 0, 'deselecting it unblocks the run');
});

test('removing get_send_status from Gmail unmatches the dependency (plan 9.3)', () => {
  const state = withSalesRevision(fixtureState(), '1.3', gmail => { gmail.enabledTools = gmail.enabledTools.filter(t => t !== 'get_send_status'); });
  const r = validateExperiment(state, EXP);
  assert.deepEqual(r.dependencyReport, { matched: false, missing: ['email.get_send_status'] });
  assert.deepEqual(r.errors.find(e => e.code === 'dependency_unmatched').missing, ['email.get_send_status']);
});

test('a selected fault scenario needs the fault hook in the environment', () => {
  const state = withSalesRevision(fixtureState(), '1.4', gmail => { gmail.failureBehavior = 'none'; });
  const r = validateExperiment(state, EXP);
  assert.deepEqual(r.dependencyReport.missing, ['email.timeout_after_send']);
  assert.equal(validateExperiment(editExp(state, { selectedScenarioIds: ['sc-base-case', 'sc-contact-opted-out'] }), EXP).dependencyReport.matched, true,
    'without the timeout scenario the same environment matches');
});

test('an incompatible environment lists everything it is missing and keeps the draft', () => {
  const state = editExp(fixtureState(), { environmentRef: { id: 'env-support', rev: '1.2' } });
  const r = validateExperiment(state, EXP);
  assert.equal(r.dependencyReport.matched, false);
  assert.deepEqual(r.dependencyReport.missing.sort(), ['crm.find_opportunity', 'crm.log_activity', 'crm.update_opportunity', 'db.lookup_contact', 'email.get_send_status', 'email.send_email', 'email.timeout_after_send'].sort());
  assert.deepEqual(state.experiments[EXP].selectedScenarioIds.length, 3, 'the selection is untouched');
});

test('a scenario set written for another workflow blocks Run with a fix that changes the set', () => {
  const s = fixtureState();
  const meeting = s.scenarioSets['set-meeting-scheduling@1'];
  const state = editExp(s, { scenarioSetRef: { id: meeting.id, rev: meeting.rev }, selectedScenarioIds: meeting.scenarioRefs.map(r => r.id) });
  const r = validateExperiment(state, EXP);
  const e = r.errors.find(x => x.code === 'scenario_set_workflow_mismatch');
  assert.ok(e, `got ${codes(r)}`);
  assert.equal(e.fix.action, 'change-scenario-set');
});

test('the gate re-reviews each scenario against the experiment workflow: an instruction conflict may not expect a send', () => {
  const s = fixtureState();
  const conflict = { ...structuredClone(s.scenarios['sc-base-case@1']), id: 'sc-conflict-send', variation: { dimension: 'prompt', type: 'instruction_conflict', label: 'Instruction conflict' }, scriptedEvents: [], stateChecks: [], expectedBehavior: { summary: 'Send it now', outcome: 'complete' } };
  const set = { ...s.scenarioSets['set-follow-up-resilience@1'] };
  const state = editExp({ ...s, scenarios: { ...s.scenarios, 'sc-conflict-send@1': conflict }, scenarioSets: { ...s.scenarioSets, 'set-follow-up-resilience@1': { ...set, scenarioRefs: [...set.scenarioRefs, { id: 'sc-conflict-send', rev: '1' }] } } },
    { selectedScenarioIds: ['sc-base-case', 'sc-conflict-send'] });
  const e = validateExperiment(state, EXP).errors.find(x => x.scenarioId === 'sc-conflict-send');
  assert.equal(e?.code, 'drops_approval');
  assert.equal(e.fix.action, 'review-scenario');
});
