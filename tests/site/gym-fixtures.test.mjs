// Agent Gym v2 fixtures (plan 4.1, 5.3, 5.4, 8.1; 13.1 item 1). Counts are the plan's numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENVIRONMENTS, deriveCapabilities, deriveFaultCapabilities } from '../../agent-gym/js/fixtures/environments.js';
import { VARIANTS, WORKFLOWS } from '../../agent-gym/js/fixtures/workflows.js';
import { SCENARIOS, SCENARIO_SETS } from '../../agent-gym/js/fixtures/scenarios.js';
import { digestOf, refKey } from '../../agent-gym/js/model.js';

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

test('the three environment templates: validated, simulated, internally consistent, derived capabilities', () => {
  assert.deepEqual(ENVIRONMENTS.map(e => [refKey(e), e.name, e.caps.join(' · ')]), [
    ['env-sales@1.2', 'Sales operations', 'CRM · Email · Calendar'],
    ['env-support@1.2', 'Customer support', 'Tickets · Payments · Knowledge base'],
    ['env-it@1.1', 'IT operations', 'Identity · Logs · Cloud'],
  ]);
  for (const e of ENVIRONMENTS) {
    assert.equal(e.validation.status, 'validated', e.id);
    assert.ok(e.components.length >= 3 && e.components.every(c => c.mode === 'simulated' && c.tools.length > 0), e.id);
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

test('scenario sets: 3 follow-up, 8 support, 6 meeting; all reviewed; refs resolve', () => {
  assert.deepEqual(SCENARIO_SETS.map(s => [s.id, s.scenarioRefs.length]), [['set-follow-up-resilience', 3], ['set-refund-triage', 8], ['set-meeting-scheduling', 6]]);
  const followUp = SCENARIO_SETS[0].scenarioRefs.map(r => SCENARIOS.find(s => s.id === r.id));
  assert.deepEqual(followUp.map(s => s.title), ['Base case', 'Timeout after send', 'Contact opted out']);
  assert.deepEqual([followUp[2].initialState.summary, followUp[2].expectedBehavior.summary], ['opted out', 'skip email; log reason']);
  for (const set of SCENARIO_SETS) {
    assert.equal(new Set(set.scenarioRefs.map(r => r.id)).size, set.scenarioRefs.length, `${set.id} unique`);
    for (const r of set.scenarioRefs) assert.equal(SCENARIOS.find(s => s.id === r.id && s.rev === r.rev)?.reviewState, 'reviewed', r.id);
  }
});
