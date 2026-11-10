// Agent Gym v2 fixtures and selectors (plan 4.1 to 4.5, 5.3, 5.4, 8.1; 13.1 items 1 and 11). Counts are the plan's numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENVIRONMENTS, deriveCapabilities, deriveFaultCapabilities } from '../../agent-gym/js/fixtures/environments.js';
import { VARIANTS, WORKFLOWS } from '../../agent-gym/js/fixtures/workflows.js';
import { SCENARIOS, SCENARIO_SETS } from '../../agent-gym/js/fixtures/scenarios.js';
import { digestOf, refKey } from '../../agent-gym/js/model.js';
import { seedState } from '../../agent-gym/js/fixtures/index.js';
import { runExecution } from '../../agent-gym/js/simulation/executor.js';
import { toggleScenario } from '../../agent-gym/js/simulation/attempts.js';
import {
  blueprintView, comparisonFor, dependencyStatus, environmentCards, experimentSummary, queueCounts, queueRows, scenarioRows,
} from '../../agent-gym/js/selectors.js';

const sales = ENVIRONMENTS.find(e => refKey(e) === 'env-sales@1.2');
const pair = r => [r.from, r.to].sort().join('|');

test('Sales operations has 4 components, 12 tools and the 4 relations of N2', () => {
  assert.deepEqual(sales.components.map(c => [c.id, c.kind, c.tools.length]),
    [['salesforce', 'crm', 4], ['gmail', 'email', 3], ['gcal', 'calendar', 3], ['customdb', 'db', 2]]);
  assert.equal(sales.components.flatMap(c => c.tools).length, 12);
  assert.deepEqual(sales.relations.map(r => [pair(r), r.field]).sort(), [
    ['customdb|gcal', 'email'], ['customdb|salesforce', 'contact_id'], ['gcal|gmail', 'email'], ['gmail|salesforce', 'email'],
  ]);
  assert.deepEqual([sales.name, sales.caps, sales.notes], ['Sales operations', ['CRM', 'Email', 'Calendar'], ['Shared contacts', 'Permissions', 'Tool behavior']]);
});

test('Gmail carries the N2 settings', () => {
  const gmail = sales.components.find(c => c.id === 'gmail');
  assert.deepEqual(gmail.tools.map(t => t.name), ['search_messages', 'send_email', 'get_send_status']);
  assert.deepEqual([gmail.permission, gmail.failureBehavior, gmail.dedup, gmail.mode], ['send_requires_approval', 'timeout_after_send', 'idempotency_key', 'simulated']);
  const db = sales.components.find(c => c.id === 'customdb');
  assert.equal(db.permission, 'read_only');
  assert.ok(db.tools.every(t => t.effect === 'read'));
});

test('the four environment templates: validated, simulated, internally consistent, derived capabilities', () => {
  assert.deepEqual(ENVIRONMENTS.map(e => [refKey(e), e.name, e.caps.join(' · ')]), [
    ['env-sales@1.2', 'Sales operations', 'CRM · Email · Calendar'],
    ['env-support@1.2', 'Customer support', 'Tickets · Payments · Knowledge base'],
    ['env-it@1.1', 'IT operations', 'Identity · Logs · Cloud'],
    ['env-finance@1.0', 'Finance operations', 'Ledger · Payables'],
  ]);
  for (const e of ENVIRONMENTS) {
    assert.equal(e.validation.status, 'validated', e.id);
    assert.ok(e.components.length >= 2 && e.components.every(c => c.mode === 'simulated' && c.tools.length > 0), e.id);
    for (const c of e.components) assert.ok(c.enabledTools.every(t => c.tools.some(x => x.name === t)), `${c.id} enables only its own tools`);
    const ids = new Set(e.components.map(c => c.id));
    assert.ok(e.relations.every(r => ids.has(r.from) && ids.has(r.to)), `${e.id} relations reference components`);
    assert.deepEqual(e.capabilities, deriveCapabilities(e.components));
    assert.deepEqual(e.faultCapabilities, deriveFaultCapabilities(e.components));
    const { digest, validation, ...content } = e;
    assert.equal(digest, digestOf(content), `${e.id} digest covers its content`);
  }
  assert.ok(sales.capabilities.includes('email.send_email'));
  assert.deepEqual(sales.faultCapabilities, ['email.timeout_after_send']);
});

test('Sales follow-up has the N1 graph and Variant A changes only the Draft email model', () => {
  const wf = WORKFLOWS.find(w => w.id === 'wf-sales-follow-up');
  const label = id => wf.nodes.find(n => n.id === id).label;
  assert.deepEqual(wf.nodes.map(n => [n.label, n.chip]), [
    ['Find opportunity', 'CRM'], ['Draft email', 'Model'], ['Contact allowed?', ''], ['Send email', 'Email'], ['Update CRM', 'CRM'], ['Log skipped contact', 'CRM'],
  ]);
  assert.deepEqual(wf.edges.map(e => `${label(e.from)} -> ${label(e.to)}${e.label ? ` [${e.label}]` : ''}`), [
    'Find opportunity -> Draft email', 'Draft email -> Contact allowed?', 'Contact allowed? -> Send email [Yes]',
    'Contact allowed? -> Log skipped contact [No]', 'Send email -> Update CRM',
  ]);
  assert.deepEqual(wf.source, { label: 'From Speedrun', fixture: true });
  assert.equal(wf.modelConfig['draft-email'].model, 'simulated-model-baseline');
  const variant = VARIANTS.find(v => v.id === 'variant-a');
  assert.equal(variant.name, 'Variant A');
  assert.deepEqual(variant.changedNodeIds, ['draft-email']);
  assert.deepEqual(variant.patch.map(p => p.model), ['simulated-model-variant-a']);
  assert.equal(variant.baseDigest, wf.digest);
  for (const w of WORKFLOWS) {
    assert.ok(w.requiredCapabilities.every(c => ENVIRONMENTS.some(e => e.capabilities.includes(c))), `${w.id} capabilities exist somewhere`);
    assert.ok(VARIANTS.some(v => v.workflowRef.id === w.id), `${w.id} has a variant`);
  }
});

test('scenario sets: 3 follow-up, 8 support for each support workflow revision, 6 meeting, 5 invoice review; all reviewed; refs resolve', () => {
  assert.deepEqual(SCENARIO_SETS.map(s => [s.id, s.scenarioRefs.length]), [['set-follow-up-resilience', 3], ['set-refund-triage', 8], ['set-refund-triage-v2', 8], ['set-meeting-scheduling', 6], ['set-invoice-review', 5]]);
  const followUp = SCENARIO_SETS[0].scenarioRefs.map(r => SCENARIOS.find(s => s.id === r.id));
  assert.deepEqual(followUp.map(s => s.title), ['Base case', 'Timeout after send', 'Contact opted out']);
  assert.deepEqual([followUp[2].initialState.summary, followUp[2].expectedBehavior.summary], ['opted out', 'skip email; log reason']);
  for (const set of SCENARIO_SETS) {
    assert.equal(new Set(set.scenarioRefs.map(r => r.id)).size, set.scenarioRefs.length, `${set.id} unique`);
    for (const r of set.scenarioRefs) assert.equal(SCENARIOS.find(s => s.id === r.id && s.rev === r.rev)?.reviewState, 'reviewed', r.id);
  }
});

test('seedState: 1 running at 12/18, 1 queued with 8 scenarios, 4 completed experiment runs and 4 completed shared-agent checks', () => {
  const s = seedState();
  assert.deepEqual(queueCounts(s), { queued: 1, running: 1, completed: 8, cancelled: 0, failed: 0, total: 10 });
  assert.deepEqual(queueRows(s).map(r => [r.title, r.environmentName, r.scenarioCount, r.status, r.progress.text, r.canViewResults]), [
    ['Sales follow-up · Variant A', 'Sales operations', 3, 'running', '12/18', false],
    ['Support triage comparison', 'Customer support', 8, 'queued', '0/48', false],
    ['Invoice review · shared-agent check', 'Finance operations', 5, 'completed', '10/10', true],
    ['Sales follow-up · shared-agent check', 'Sales operations', 3, 'completed', '6/6', true],
    ['Invoice review · shared-agent check', 'Finance operations', 5, 'completed', '10/10', true],
    ['Support triage v2 · shared-agent check', 'Customer support', 8, 'completed', '16/16', true],
    ['Refund timeout steps', 'Customer support', 2, 'completed', '8/8', true],
    ['Smaller model for refund replies', 'Customer support', 3, 'completed', '12/12', true],
    ['Duplicate-send guard', 'Sales operations', 3, 'completed', '6/6', true],
    ['Meeting scheduling', 'Sales operations', 6, 'completed', '12/12', true],
  ]);
  for (const id of s.attemptOrder) assert.equal(s.executions[id].length, s.attempts[id].cursor, `${id} cursor counts its executions`);
});

test('seeded executions are what the executor produces from the frozen snapshot', () => {
  const s = seedState();
  for (const id of s.attemptOrder) {
    const a = s.attempts[id];
    s.executions[id].forEach((e, i) => {
      assert.deepEqual(e, { ...runExecution(a.inputSnapshot, a.plan[i], a.seed), id: `${id}/${a.plan[i].id}`, attemptId: id }, e.id);
    });
  }
  const meeting = s.attemptOrder.find(id => s.attempts[id].title === 'Meeting scheduling');
  assert.equal(comparisonFor(s, meeting).completePairs, 6);
  const sales = s.attemptOrder.find(id => s.attempts[id].status === 'running');
  assert.equal(comparisonFor(s, sales).verdict, 'inconclusive', 'a running attempt is not complete');
});

test('exp-029 shows a draft one revision ahead of the frozen revision that runs', () => {
  const s = seedState();
  const exp = s.experiments['exp-029'];
  const running = Object.values(s.attempts).find(a => a.experimentId === 'exp-029');
  assert.equal(exp.title, 'Experiment 029');
  assert.equal(exp.draftRevision, exp.savedRevision + 1);
  assert.equal(running.label, `rev ${exp.savedRevision} · attempt 1`);
  assert.equal(running.inputSnapshot.experiment.draftRevision, exp.savedRevision);
  assert.equal(experimentSummary(s, 'exp-029').dirty, true);
});

test('workbench selectors: summary, dependencies, environment cards, scenario rows', () => {
  const s = seedState();
  const summary = experimentSummary(s, 'exp-029');
  assert.deepEqual([summary.versions, summary.selectedScenarioCount, summary.repetitions, summary.runs, summary.pairs], [2, 3, 3, 18, 9]);
  assert.equal(summary.formula, '2 versions × 3 scenarios × 3 repetitions = 18 runs');
  assert.deepEqual([dependencyStatus(s, 'exp-029').label, dependencyStatus(s, 'exp-029').canRun], ['Dependencies matched', true]);
  const cards = environmentCards(s, { selectedRef: s.experiments['exp-029'].environmentRef });
  assert.deepEqual(cards.map(c => [c.name, `v${c.rev}`, c.statusLabel, c.selected]),
    [['Sales operations', 'v1.2', 'Ready', true], ['Customer support', 'v1.2', 'Ready', false], ['IT operations', 'v1.1', 'Ready', false], ['Finance operations', 'v1.0', 'Ready', false]]);
  assert.deepEqual(environmentCards(s, { query: 'logs' }).filter(c => c.visible).map(c => c.name), ['IT operations']);
  const rows = scenarioRows(s, s.experiments['exp-029'].scenarioSetRef, { selectedIds: s.experiments['exp-029'].selectedScenarioIds, query: 'opted' });
  assert.deepEqual(rows.map(r => [r.title, r.selected, r.visible]), [['Base case', true, false], ['Timeout after send', true, false], ['Contact opted out', true, true]]);
  assert.deepEqual([rows[2].initialState, rows[2].expected], ['opted out', 'skip email; log reason']);
});

test('blueprint view: Variant A changes Draft email; the timeout marker follows the selected scenarios', () => {
  const s = seedState();
  const variant = blueprintView(s, 'exp-029', 'variant');
  assert.deepEqual(variant.nodes.filter(n => n.changed).map(n => n.label), ['Draft email']);
  assert.equal(variant.nodes.find(n => n.id === 'draft-email').model, 'simulated-model-variant-a');
  assert.deepEqual(variant.nodes.filter(n => n.faultMarker).map(n => [n.label, n.faultMarker]), [['Send email', 'Timeout injection']]);
  const baseline = blueprintView(s, 'exp-029', 'baseline');
  assert.deepEqual([baseline.versionLabel, baseline.nodes.filter(n => n.changed).length], ['Baseline', 0]);
  assert.equal(baseline.nodes.find(n => n.id === 'draft-email').model, 'simulated-model-baseline');
  const withoutTimeout = toggleScenario(s, { experimentId: 'exp-029', scenarioId: 'sc-timeout-after-send' }).state;
  assert.equal(blueprintView(withoutTimeout, 'exp-029', 'variant').nodes.some(n => n.faultMarker), false);
  assert.equal(experimentSummary(withoutTimeout, 'exp-029').runs, 12);
});

test('seedState is fast and returns fresh state each call', () => {
  const t0 = performance.now();
  const a = seedState();
  assert.ok(performance.now() - t0 < 100, 'well under 100 ms');
  const b = seedState();
  assert.notEqual(a.environments['env-sales@1.2'], b.environments['env-sales@1.2']);
  assert.deepEqual(a, b, 'deterministic');
});
