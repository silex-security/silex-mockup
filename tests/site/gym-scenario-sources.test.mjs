// Scenario builder sources and the scripted assistant (plan 6.1, 6.2). Upload is a local-file boundary: limits on
// size, extension, schema, fields and rows; scripts and external URLs are refused.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedState } from '../../agent-gym/js/fixtures/index.js';
import { UPLOAD_LIMITS, checkFileMeta, parseCsv, parseUpload } from '../../agent-gym/js/scenario/upload.js';
import { askAssistant, ASSISTANT_LABEL } from '../../agent-gym/js/scenario/assistant.js';
import { DEFAULT_ENVIRONMENT, applySource, draftIdFor, ensureDraft } from '../../agent-gym/js/scenario/draft.js';
import { SAMPLE_TRACE, baseFromTrace, blueprintRequirements } from '../../agent-gym/js/scenario/sources.js';

const ID = draftIdFor(DEFAULT_ENVIRONMENT);
const must = r => { if (r.error) throw Error(`${r.error.code}: ${r.error.message}`); return r.state; };
const fresh = () => must(ensureDraft(seedState(), { environmentRef: DEFAULT_ENVIRONMENT }));
const file = (name, text) => ({ name, size: new TextEncoder().encode(text).length, text });
const lastReply = s => s.scenarioDrafts[ID].chat.at(-1).text;

test('a JSON or CSV file of test cases parses into base specs with a summary', () => {
  const json = parseUpload(file('cases.json', JSON.stringify([
    { title: 'Approval first', prompt: 'Draft the Acme follow-up for my approval.', outcome: 'draft_and_request_approval', initialState: 'No approval yet' },
    { title: 'Bad outcome', prompt: 'x', outcome: 'teleport' },
    { title: 'Extra', prompt: 'x', outcome: 'clarify', owner: 'me' },
  ])));
  assert.equal(json.ok, true);
  assert.deepEqual(json.summary, { fileName: 'cases.json', format: 'json', total: 3, accepted: 1, rejected: 2 });
  assert.deepEqual(json.rejected.map(r => r.reason), ['Item 2 has an unsupported outcome "teleport"', 'Item 3 has an unknown field "owner"']);
  assert.equal(json.rows[0].spec.source.label, 'Upload · cases.json');
  assert.equal(json.rows[0].spec.messages[0].text, 'Draft the Acme follow-up for my approval.');
  const csv = parseUpload(file('cases.csv', 'title,prompt,expected_behavior,outcome\n"Ask, then wait","Follow up with Alex, ask me first.",Draft; ask,draft_and_request_approval\n'));
  assert.equal(csv.rows.length, 1);
  assert.equal(csv.rows[0].spec.title, 'Ask, then wait');
  assert.deepEqual(parseCsv('a,"b ""q"""\r\n1,2'), [['a', 'b "q"'], ['1', '2']]);
});

test('files over the limits, with scripts, markup or URLs, or of the wrong type are refused before anything is applied', () => {
  assert.match(checkFileMeta({ name: 'cases.xlsx', size: 10 }), /Only .json or .csv/);
  assert.match(checkFileMeta({ name: 'cases.json', size: UPLOAD_LIMITS.maxBytes + 1 }), /limit is 64 KB/);
  const refuse = (name, text) => { const r = parseUpload(file(name, text)); assert.equal(r.ok, false, text); assert.equal(r.rows.length, 0); return r.error; };
  assert.match(refuse('a.json', '[{"title":"<script>alert(1)</script>","prompt":"x","outcome":"clarify"}]'), /script tag/);
  assert.match(refuse('a.json', '[{"title":"t","prompt":"see https://example.com","outcome":"clarify"}]'), /external URL/);
  assert.match(refuse('a.csv', 'title,prompt,outcome\nt,javascript:alert(1),clarify'), /javascript/);
  assert.match(refuse('a.json', '{"nope":1}'), /array of test cases/);
  assert.match(refuse('a.json', '[{'), /could not be read as JSON/);
  assert.match(refuse('a.json', JSON.stringify(Array.from({ length: 21 }, (_, i) => ({ title: `t${i}`, prompt: 'p', outcome: 'clarify' })))), /21 test cases; the limit is 20/);
  assert.match(refuse('a.json', JSON.stringify([{ title: 't', prompt: 'p'.repeat(501), outcome: 'clarify' }])), /No test case passed/);
});

test('the sample trace and the simulated blueprint fill the base, labelled as local sources', () => {
  assert.equal(SAMPLE_TRACE.label, 'Sample trace');
  let s = fresh();
  s = must(applySource(s, { draftId: ID, spec: baseFromTrace() }));
  const d = s.scenarioDrafts[ID];
  assert.equal(d.base.source.label, 'Sample trace');
  assert.equal(d.base.reviewState, 'needs_review', 'a filled base waits for a person');
  assert.ok(d.items.every(i => i.reviewState === 'needs_review'));
  const reqs = blueprintRequirements(s.workflows['wf-sales-follow-up@1']);
  assert.deepEqual(reqs.map(r => r.text), ['email.send_email requires approval', 'Opted-out contacts are never emailed']);
  assert.ok(reqs.every(r => r.spec.source.label === 'Simulated blueprint'));
});

test('the scripted assistant edits through the reducers, never confirms its own expectation, and explains its range', () => {
  assert.equal(ASSISTANT_LABEL, 'Scripted assistant demo');
  let s = fresh();
  s = must(askAssistant(s, { draftId: ID, text: 'task: Prepare a short follow-up' }));
  assert.equal(s.scenarioDrafts[ID].base.task, 'Prepare a short follow-up');
  assert.ok(s.scenarioDrafts[ID].items.every(i => i.inherits.includes('task') ? i.task === 'Prepare a short follow-up' : true));
  s = must(askAssistant(s, { draftId: ID, text: 'expected: Draft and wait for my approval' }));
  assert.equal(s.scenarioDrafts[ID].base.reviewState, 'needs_review');
  assert.match(lastReply(s), /cannot confirm my own expectation/);
  s = must(askAssistant(s, { draftId: ID, text: 'add 2 rephrasings' }));
  assert.equal(s.scenarioDrafts[ID].items.filter(i => i.type === 'rephrasing').length, 3);
  s = must(askAssistant(s, { draftId: ID, text: 'add a timeout' }));
  assert.equal(s.scenarioDrafts[ID].items.at(-1).label, 'Timeout after send');
  assert.equal(s.scenarioDrafts[ID].items.at(-1).reviewState, 'needs_review');
  s = must(askAssistant(s, { draftId: ID, text: 'show differences' }));
  assert.match(lastReply(s), /^1\. Rephrasing: Prompt reworded/);
  s = must(askAssistant(s, { draftId: ID, text: 'add 50 rephrasings' }));
  assert.match(lastReply(s), /Count must be 1 to 20/);
  s = must(askAssistant(s, { draftId: ID, text: 'book me a flight to Lisbon' }));
  assert.match(lastReply(s), /did not recognise that/);
  assert.match(lastReply(s), /Count 1 to 20/);
});
