// Scenario library read models: condition coverage per set (variations, overrides and patched initial state), the
// gaps, the run evidence per scenario, and the card order. Pure Node.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { refKey } from '../../agent-gym/js/model.js';
import { seedState } from '../../agent-gym/js/fixtures/index.js';
import { advanceAttempt } from '../../agent-gym/js/simulation/attempts.js';
import { scenarioDimensions, scenarioLibrary, setCoverage } from '../../agent-gym/js/scenario/library.js';

const ok = r => { if (r.error) throw Error(`${r.error.code}: ${r.error.message}`); return r.state; };
const scenariosOf = (state, setId) => state.scenarioSets[`${setId}@1`].scenarioRefs.map(r => state.scenarios[refKey(r)]);
const counts = coverage => Object.fromEntries(coverage.map(d => [d.dimension, d.count]));
const card = (state, name) => scenarioLibrary(state, { experimentId: 'exp-029' }).find(c => c.name === name);

test('Timeout after send counts as a tool failure and Contact opted out as data and state, though neither has a variation', () => {
  const s = seedState();
  const byTitle = Object.fromEntries(scenariosOf(s, 'set-follow-up-resilience').map(x => [x.title, scenarioDimensions(x)]));
  assert.deepEqual(byTitle, { 'Base case': [], 'Timeout after send': ['tool_failure'], 'Contact opted out': ['data_state'] });
  const coverage = setCoverage(scenariosOf(s, 'set-follow-up-resilience'));
  assert.deepEqual(counts(coverage), { prompt: 0, tool_failure: 1, permission: 0, data_state: 1 });
  assert.deepEqual(coverage.filter(d => d.gap).map(d => d.gapText), ['No prompt scenario', 'No permission scenario']);
});

test('generated variations, permission overrides and data overrides each count under their own dimension', () => {
  const s = seedState();
  assert.deepEqual(counts(setCoverage(scenariosOf(s, 'set-refund-triage'))), { prompt: 4, tool_failure: 1, permission: 1, data_state: 1 });
  assert.deepEqual(counts(setCoverage(scenariosOf(s, 'set-meeting-scheduling'))), { prompt: 3, tool_failure: 0, permission: 1, data_state: 1 });
  const dataOverride = { ...scenariosOf(s, 'set-follow-up-resilience')[0], overrides: [{ kind: 'data', target: 'contact.optOut', value: true, label: 'Opted out' }] };
  assert.deepEqual(scenarioDimensions(dataOverride), ['data_state']);
});

test('a set that ran to completion shows each scenario\'s latest baseline and variant pass counts; a running set says so', () => {
  const s = seedState();
  const meeting = card(s, 'Meeting scheduling').evidence;
  assert.equal(meeting.completed.attemptId, 'attempt-001');
  assert.deepEqual(meeting.completed.rows[0], { scenarioId: 'sc-mtg-intro', title: 'Book intro call', inRun: true, baseline: { pass: 1, total: 1 }, variant: { pass: 1, total: 1 }, regressed: 0, improved: 0 });
  const followUp = card(s, 'Follow-up resilience').evidence;
  assert.deepEqual([followUp.completed.attemptId, followUp.live.attemptId, followUp.live.progress], ['attempt-004', 'attempt-002', '12/18'], 'Duplicate-send guard finished on this set while Sales follow-up still runs');

  let done = s;
  while (done.attempts['attempt-002'].status === 'running') done = ok(advanceAttempt(done, { attemptId: 'attempt-002' }));
  assert.deepEqual(card(done, 'Follow-up resilience').evidence.completed.rows.map(r => [r.title, `${r.baseline.pass}/${r.baseline.total}`, `${r.variant.pass}/${r.variant.total}`]), [
    ['Base case', '3/3', '3/3'], ['Timeout after send', '0/3', '3/3'], ['Contact opted out', '3/3', '3/3'],
  ]);
});

test('cards list the workbench experiment\'s set first, carry usage and review counts, and the search hides non-matching sets', () => {
  const cards = scenarioLibrary(seedState(), { experimentId: 'exp-029' });
  assert.deepEqual(cards.map(c => [c.name, c.rev, c.count, c.reviewed, c.usedBy.map(u => u.id)]), [
    ['Follow-up resilience', '1', 3, 3, ['exp-024', 'exp-029', 'exp-030']], ['Invoice review', '1', 5, 5, ['exp-032']], ['Meeting scheduling', '1', 6, 6, ['exp-027', 'exp-031']],
    ['Refund triage v2', '1', 8, 8, ['exp-025']], ['Refund triage', '1', 8, 8, ['exp-026', 'exp-028']],
  ]);
  assert.deepEqual(scenarioLibrary(seedState(), { query: 'refund', experimentId: 'exp-029' }).filter(c => c.visible).map(c => c.name), ['Refund triage v2', 'Refund triage']);
  assert.deepEqual(scenarioLibrary(seedState(), { query: 'opted out', experimentId: 'exp-029' }).filter(c => c.visible).map(c => c.name), ['Follow-up resilience'], 'scenario titles match');
});
