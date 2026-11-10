// Agent Gym v2 environment builder domain: draft, commands, undo and redo, validation, the scripted assistant,
// the fixture file boundary and Save as template (plan 5, 7.1, 7.2, 9.3; 13.1 items 1 and 2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clone, refKey } from '../../agent-gym/js/model.js';
import { seedState } from '../../agent-gym/js/fixtures/index.js';
import { validateExperiment } from '../../agent-gym/js/validators.js';
import { setEnvironment } from '../../agent-gym/js/simulation/attempts.js';
import {
  DRAFT_ID, applyEnvironmentCommand, contentOf, draftStatus, redoEnvironment, undoEnvironment, validateEnvironmentDraft,
} from '../../agent-gym/js/environment/commands.js';
import { validateEnvironment } from '../../agent-gym/js/environment/validate.js';
import { ensureEnvironmentDraft, seedDraft } from '../../agent-gym/js/environment/seed.js';
import { draftSummary } from '../../agent-gym/js/environment/selectors.js';
import { interpret, sendAssistantMessage } from '../../agent-gym/js/environment/assistant.js';
import { environmentDependencyCheck, saveEnvironmentTemplate, templateRefFor } from '../../agent-gym/js/environment/templates.js';
import { FIXTURE_LIMITS, parseEnvironmentFixture } from '../../agent-gym/js/environment/fixture-file.js';

const ok = result => { assert.ok(result.state, JSON.stringify(result.error)); return result.state; };
const start = () => ok(ensureEnvironmentDraft(seedState(), {}));
const draftOf = state => state.environmentDrafts[DRAFT_ID];
const run = (state, command) => ok(applyEnvironmentCommand(state, { draftId: DRAFT_ID, command }));
const update = (state, componentId, patch) => run(state, { type: 'updateComponent', componentId, patch });
const validate = state => ok(validateEnvironmentDraft(state, { draftId: DRAFT_ID }));
const say = (state, text) => ok(sendAssistantMessage(state, { draftId: DRAFT_ID, text }));
const confirmAdapter = state => run(state, { type: 'confirmAssumption', assumptionId: draftOf(state).assumptions.find(a => a.kind === 'behavior' && a.state === 'pending').id });
const save = state => saveEnvironmentTemplate(state, { draftId: DRAFT_ID, validationDigest: draftOf(state).validation?.digest });
const codes = (draft, mutate = d => d) => validateEnvironment(mutate(clone(draft))).errors.map(e => e.code);
const component = (draft, id) => draft.components.find(c => c.id === id);

test('the N2 draft has 4 systems, 12 tools, 4 relationships, 3 components ready and 1 assumption to confirm', () => {
  const draft = draftOf(start());
  const s = draftSummary(draft);
  assert.equal(s.text, '4 systems · 12 tools · 4 relationships');
  assert.deepEqual(s.rows.map(r => [r.name, r.toolCount, r.status]), [['Salesforce', 4, 'ready'], ['Gmail', 3, 'needs_review'], ['Google Calendar', 3, 'ready'], ['Customer DB', 2, 'ready']]);
  assert.deepEqual([s.ready, s.pending, s.status], [3, 1, 'draft']);
  assert.ok(draft.assumptions.some(a => a.text === 'Synthetic customer data' && a.kind === 'info'), 'the synthetic-data note exists and is not counted');
  assert.deepEqual(component(draft, 'customdb').permission, 'read_only');
  assert.deepEqual([component(draft, 'gmail').permission, component(draft, 'gmail').failureBehavior, component(draft, 'gmail').dedup], ['send_requires_approval', 'timeout_after_send', 'custom_adapter']);
  assert.ok(draft.components.every(c => c.mode === 'simulated'));
  assert.deepEqual(draft.chat.filter(t => t.role === 'user').length, 2);
  assert.deepEqual(draft.chat.at(-1).changes, ['Customer DB: read only', 'Gmail: timeout enabled'], 'the second turn lists the changes the assistant really made');
  const again = ok(ensureEnvironmentDraft(update(start(), 'gcal', { name: 'Calendar' }), {}));
  assert.equal(component(draftOf(again), 'gcal').name, 'Calendar', 'ensuring an existing draft keeps its edits');
});

test('validating before the adapter is confirmed needs review and cannot save; confirm then validate enables save', () => {
  let s = validate(start());
  assert.equal(draftStatus(draftOf(s)), 'needs_review');
  assert.deepEqual(draftOf(s).validation.pendingAssumptionIds, ['dedup-gmail']);
  assert.equal(save(s).error?.code, 'validation_stale');
  s = confirmAdapter(s);
  assert.equal(draftStatus(draftOf(s)), 'draft', 'confirming changes behavior, so the earlier report is stale');
  assert.deepEqual([draftSummary(draftOf(s)).ready, draftSummary(draftOf(s)).pending], [4, 0]);
  s = validate(s);
  assert.equal(draftStatus(draftOf(s)), 'validated');
  assert.ok(save(s).state);
});

test('a behaviour edit after validation makes the report stale; a rename or a layout-only change does not', () => {
  const valid = validate(confirmAdapter(start()));
  assert.equal(draftStatus(draftOf(run(valid, { type: 'rename', name: 'Sales sandbox' }))), 'validated');
  assert.equal(draftStatus(draftOf(update(valid, 'gcal', { name: 'Calendar' }))), 'validated');
  const edited = update(valid, 'gcal', { permission: 'read_only', enabledTools: ['find_free_slots', 'list_events'] });
  assert.equal(draftStatus(draftOf(edited)), 'draft');
  assert.equal(save(edited).error?.code, 'validation_stale');
});

test('validator rules: each broken property fails with its own code', () => {
  const draft = draftOf(confirmAdapter(start()));
  assert.deepEqual(validateEnvironment(draft), { ...validateEnvironment(draft), errors: [], status: 'validated' });
  const gmail = d => component(d, 'gmail');
  assert.deepEqual(codes(draft, d => { gmail(d).tools[0].name = 'Search Messages'; gmail(d).enabledTools[0] = 'Search Messages'; return d; }), ['tool_schema']);
  assert.ok(codes(draft, d => { gmail(d).tools[1].input = { to: 42 }; return d; }).includes('tool_schema'));
  assert.deepEqual(codes(draft, d => { d.relations[0].field = 'segment'; return d; }), ['relation_field', 'relation_field']);
  assert.ok(codes(draft, d => { d.relations.push({ id: 'rel-x', from: 'salesforce', to: 'ghost', field: 'email' }); return d; }).includes('reference_integrity'));
  assert.deepEqual(codes(draft, d => { component(d, 'salesforce').permission = 'read_only'; return d; }), ['read_only_write', 'read_only_write']);
  assert.deepEqual(codes(draft, d => { gmail(d).permission = 'read_write'; return d; }), ['approval_boundary']);
  assert.ok(codes(draft, d => { component(d, 'customdb').failureBehavior = 'timeout_after_send'; return d; }).includes('fault_unsupported'));
  assert.deepEqual(codes(draft, d => { gmail(d).failureBehavior = 'drop_packets'; return d; }).sort(), ['capability_missing', 'setting_unknown'], 'an unknown fault is rejected and the timeout capability goes missing');
  assert.deepEqual(codes(draft, d => { gmail(d).mode = 'live'; return d; }), ['mode_unsupported']);
  const noStatus = codes(draft, d => { gmail(d).enabledTools = ['search_messages', 'send_email']; return d; });
  assert.deepEqual(noStatus.sort(), ['capability_missing', 'dedup_unsupported']);
  assert.match(validateEnvironment({ ...draft, components: draft.components.map(c => c.id === 'gmail' ? { ...c, enabledTools: ['search_messages', 'send_email'] } : c) }).errors.find(e => e.code === 'capability_missing').message, /email\.get_send_status/);
  const pending = validateEnvironment(draftOf(start()));
  assert.deepEqual([pending.errors, pending.status], [[], 'needs_review']);
  assert.ok(validateEnvironment({ ...draft, components: draft.components.map(c => c.id === 'gmail' ? { ...c, dedup: 'none' } : c) }).warnings.some(w => w.code === 'retry_duplicates'));
});

test('removing a component a relation or the workflow needs makes validation fail and names the cause', () => {
  const removed = run(confirmAdapter(start()), { type: 'removeComponent', componentId: 'gcal' });
  const draft = draftOf(removed);
  assert.equal(draftSummary(draft).brokenRelations.length, 2, 'the two calendar links stay, visibly broken');
  assert.equal(draftStatus(draftOf(validate(removed))), 'invalid');
  const noDb = draftOf(validate(run(confirmAdapter(start()), { type: 'removeComponent', componentId: 'customdb' })));
  assert.match(noDb.validation.errors.map(e => e.message).join(' | '), /db\.lookup_contact/);
});

test('undo and redo restore the exact draft content, cover assistant and component changes, and recompute status', () => {
  const s0 = validate(confirmAdapter(start()));
  const snaps = [contentOf(draftOf(s0))];
  let s = s0;
  for (const step of [
    st => update(st, 'gmail', { failureBehavior: 'none' }),
    st => say(st, 'Make Customer DB read-write'),
    st => run(st, { type: 'addComponent', catalogId: 'helpdesk' }),
    st => run(st, { type: 'removeRelation', relationId: 'rel-sf-db' }),
  ]) { s = step(s); snaps.push(contentOf(draftOf(s))); }
  assert.equal(draftStatus(draftOf(s)), 'draft');
  for (let i = snaps.length - 2; i >= 0; i--) { s = ok(undoEnvironment(s, { draftId: DRAFT_ID })); assert.deepEqual(contentOf(draftOf(s)), snaps[i], `undo to step ${i}`); }
  assert.equal(draftStatus(draftOf(s)), 'validated', 'undoing back to the validated content makes the report current again');
  assert.equal(draftOf(s).history.past.length, 1, 'only the adapter confirmation is left to undo');
  assert.equal(undoEnvironment(ok(undoEnvironment(s, { draftId: DRAFT_ID })), { draftId: DRAFT_ID }).error?.code, 'nothing_to_undo');
  for (let i = 1; i < snaps.length; i++) { s = ok(redoEnvironment(s, { draftId: DRAFT_ID })); assert.deepEqual(contentOf(draftOf(s)), snaps[i], `redo to step ${i}`); }
  assert.equal(redoEnvironment(s, { draftId: DRAFT_ID }).error?.code, 'nothing_to_redo');
  const branched = update(ok(undoEnvironment(s, { draftId: DRAFT_ID })), 'gcal', { name: 'Cal' });
  assert.equal(draftOf(branched).history.future.length, 0, 'a new edit clears redo');
});

test('the assistant applies recognised intents as one undoable step and lists the real field changes', () => {
  const cases = [
    ['Make the customer database read-write', ['Customer DB: read and write'], d => component(d, 'customdb').permission === 'read_write'],
    ['Disable Gmail timeout testing', ['Gmail: timeout disabled'], d => component(d, 'gmail').failureBehavior === 'none'],
    ['Drop approval before sending', ['Gmail: read and write'], d => component(d, 'gmail').permission === 'read_write'],
    ['Make Salesforce read-only', ['Salesforce: read only', 'Salesforce: update_opportunity disabled', 'Salesforce: log_activity disabled'], d => component(d, 'salesforce').enabledTools.length === 2],
    ['Add Helpdesk', ['Added Helpdesk'], d => !!component(d, 'helpdesk') && 'tickets' in d.dataSeed],
    ['Remove Google Calendar', ['Removed Google Calendar'], d => !component(d, 'gcal')],
    ['Rename the environment to Sales sandbox', ['Environment name: Sales sandbox'], d => d.name === 'Sales sandbox'],
    ['Link Salesforce and Google Calendar by email', ['Linked Salesforce and Google Calendar by email'], d => d.relations.some(r => r.from === 'salesforce' && r.to === 'gcal')],
    ['Add Helpdesk and link Helpdesk and Salesforce by email', ['Added Helpdesk', 'Linked Helpdesk and Salesforce by email'], d => d.relations.some(r => r.from === 'helpdesk')],
  ];
  for (const [text, changes, holds] of cases) {
    const before = start();
    const after = say(before, text);
    const d = draftOf(after);
    assert.deepEqual(d.chat.at(-1).changes, changes, text);
    assert.equal(d.chat.at(-1).text, `Updated ${changes.length} setting${changes.length === 1 ? '' : 's'}.`);
    assert.deepEqual(d.chat.at(-2), { role: 'user', text, chips: d.chat.at(-2).chips });
    assert.ok(holds(d), text);
    assert.equal(d.history.past.length, 1, `${text} is one undo step`);
    assert.deepEqual(contentOf(draftOf(ok(undoEnvironment(after, { draftId: DRAFT_ID })))), contentOf(draftOf(before)));
  }
  const needsApproval = say(say(start(), 'Drop approval before sending'), 'Require approval before sending');
  assert.equal(component(draftOf(needsApproval), 'gmail').permission, 'send_requires_approval');
});

test('unrecognised or impossible input explains the supported range, offers options, and changes nothing', () => {
  const before = start();
  for (const text of ['Make it production ready', 'Add Slack', 'Link Salesforce and Gmail by contact_id', 'Remove Payments', 'Make Gmail read-only and connect my real inbox']) {
    const after = say(before, text);
    const d = draftOf(after);
    assert.deepEqual(contentOf(d), contentOf(draftOf(before)), text);
    assert.equal(d.history.past.length, 0, text);
    const reply = d.chat.at(-1);
    assert.equal(reply.kind, 'help', text);
    assert.doesNotMatch(reply.text, /Updated/, text);
    assert.match(reply.text, /Nothing was changed|understands/, text);
    assert.ok(reply.chips.length >= 3 && reply.chips.every(o => interpret(contentOf(d), o).ok), `${text}: every offered option is itself recognised`);
  }
  assert.match(draftOf(say(before, 'Add Slack')).chat.at(-1).text, /not simulated in this preview/);
  const noop = draftOf(say(before, 'Make the customer database read-only'));
  assert.equal(noop.chat.at(-1).kind, 'noop');
  assert.match(noop.chat.at(-1).text, /^No change needed/);
  assert.equal(sendAssistantMessage(before, { draftId: DRAFT_ID, text: '   ' }).error.code, 'empty_message');
});

test('Save as template writes a new immutable revision and never changes env-sales@1.2 or any attempt snapshot', () => {
  const s0 = start();
  const salesBefore = clone(s0.environments['env-sales@1.2']);
  const attemptsBefore = clone(s0.attempts);
  const executionsBefore = clone(s0.executions);
  const ready = validate(confirmAdapter(s0));
  const ref = templateRefFor(ready, DRAFT_ID);
  assert.deepEqual(ref, { id: 'tpl-sales-operations', rev: '1' });
  const saved = ok(save(ready));
  const revision = saved.environments[refKey(ref)];
  assert.ok(revision);
  assert.deepEqual([revision.validation.status, revision.validation.digest === revision.digest], ['validated', true]);
  assert.ok(revision.capabilities.includes('email.get_send_status') && revision.faultCapabilities.includes('email.timeout_after_send'));
  assert.ok(revision.components.every(c => c.mode === 'simulated'));
  assert.deepEqual(draftOf(saved).baseRef, ref);
  assert.equal(save(saved).state.environments, saved.environments, 'saving the same content again writes nothing new');

  const used = ok(setEnvironment(saved, { experimentId: 'exp-029', environmentRef: ref }));
  const report = validateExperiment(used, 'exp-029');
  assert.deepEqual(report.errors.filter(e => /environment|dependency/.test(e.code)), []);
  assert.equal(report.dependencyReport.matched, true);
  assert.equal(environmentDependencyCheck(saved, 'exp-029', ref).ok, true);

  const next = ok(save(validate(update(used, 'gcal', { permission: 'read_only', enabledTools: ['find_free_slots', 'list_events'] }))));
  assert.ok(next.environments['tpl-sales-operations@2'], 'a changed draft saves as the next revision');
  assert.equal(next.environments['tpl-sales-operations@1'].digest, revision.digest, 'revision 1 is untouched');
  assert.deepEqual(next.environments['env-sales@1.2'], salesBefore);
  assert.deepEqual(next.attempts, attemptsBefore);
  assert.deepEqual(next.executions, executionsBefore);
});

test('the dependency check reports what an experiment would miss without writing anything', () => {
  const s = start();
  const check = environmentDependencyCheck(s, 'exp-029', { id: 'env-support', rev: '1.2' });
  assert.equal(check.ok, false);
  assert.ok(check.missing.includes('email.send_email') && check.missing.includes('email.get_send_status'));
  assert.deepEqual(s.experiments['exp-029'].environmentRef, { id: 'env-sales', rev: '1.2' });
  assert.equal(environmentDependencyCheck(s, 'exp-029', { id: 'env-sales', rev: '1.2' }).ok, true);
});

test('a local fixture file is parsed with field and size limits before it can become one undoable import', () => {
  const source = JSON.stringify({
    name: 'Imported desk',
    components: [
      { id: 'desk', kind: 'tickets', name: 'Desk', category: 'Tickets', permission: 'read_write', tools: [{ name: 'get_ticket', effect: 'read', input: { ticketId: 'string' }, output: { ticket: 'Ticket' } }] },
      { id: 'notes', kind: 'kb', name: 'Notes', category: 'Knowledge base', tools: [{ name: 'search_articles', effect: 'read', input: { query: 'string' }, output: { articles: 'Article[]' } }] },
    ],
    relations: [{ from: 'desk', to: 'notes', field: 'topic' }],
  });
  const parsed = parseEnvironmentFixture(source);
  assert.equal(parsed.ok, true, JSON.stringify(parsed.errors));
  assert.deepEqual(parsed.summary, { name: 'Imported desk', systems: 2, tools: 2, relationships: 1, assumptions: 0 });
  const imported = draftOf(run(start(), { type: 'importFixture', content: parsed.content }));
  assert.deepEqual([imported.name, draftSummary(imported).text], ['Imported desk', '2 systems · 2 tools · 1 relationship']);

  const bad = (patch, pattern) => {
    const result = parseEnvironmentFixture(JSON.stringify({ ...JSON.parse(source), ...patch }));
    assert.equal(result.ok, false);
    assert.match(result.errors.join(' | '), pattern);
  };
  bad({ components: [{ ...JSON.parse(source).components[0], mode: 'live' }] }, /live connections are not supported/);
  bad({ token: 'x' }, /token is not a known field/);
  bad({ components: [{ ...JSON.parse(source).components[0], failureBehavior: 'explode' }] }, /failureBehavior must be one of/);
  bad({ relations: [{ from: 'desk', to: 'ghost', field: 'topic' }] }, /relations\[0\]/);
  bad({ components: Array.from({ length: FIXTURE_LIMITS.components + 1 }, (_, i) => ({ ...JSON.parse(source).components[0], id: `c${i}` })) }, /1 to 12 components/);
  assert.match(parseEnvironmentFixture('x'.repeat(10), FIXTURE_LIMITS.bytes + 1).errors[0], /limit is 64 KB/);
  assert.match(parseEnvironmentFixture('{nope').errors[0], /not valid JSON/);
});

test('an imported file can never deliver a confirmed or downgraded Custom adapter assumption', () => {
  const s0 = start();
  const { components, relations, dataSeed } = draftOf(s0);
  const file = assumptions => JSON.stringify({ name: 'Sales from file', components: components.map(({ pos, ...c }) => c), relations, dataSeed, assumptions });
  const downgraded = [{ id: 'dedup-gmail', componentId: 'gmail', kind: 'info', text: 'Gmail deduplicates by key' }];
  assert.equal(parseEnvironmentFixture(file(downgraded)).ok, false, 'a file cannot claim a derived assumption id');
  assert.equal(parseEnvironmentFixture(file([{ id: 'adapter-ok', componentId: 'gmail', kind: 'behavior', text: 'Trust the adapter' }])).ok, false, 'behaviour assumptions come from the components, not the file');
  const content = parseEnvironmentFixture(file([])).content;
  for (const assumption of [{ ...downgraded[0], state: 'pending' }, { ...downgraded[0], kind: 'behavior', state: 'confirmed' }]) {
    let s = validate(run(s0, { type: 'importFixture', content: { ...content, assumptions: [assumption] } }));
    const adapter = draftOf(s).assumptions.filter(a => a.id === 'dedup-gmail');
    assert.deepEqual(adapter.map(a => [a.kind, a.state]), [['behavior', 'pending']], `import of ${assumption.kind}/${assumption.state}`);
    assert.equal(draftStatus(draftOf(s)), 'needs_review');
    assert.equal(save(s).error?.code, 'validation_stale');
    s = validate(confirmAdapter(s));
    assert.equal(draftStatus(draftOf(s)), 'validated', 'only the confirm command confirms it');
  }
});
