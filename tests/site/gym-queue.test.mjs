// The experiment queue's view model: rows, counts, filter and the stage-to-action table. Pure Node over seedState.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedState } from '../../agent-gym/js/fixtures/index.js';
import { STAGES, experimentStage } from '../../agent-gym/js/selectors.js';
import { STAGE_LABEL, queueSummary, queueView } from '../../agent-gym/js/experiments/queue.js';

const row = (view, id) => view.rows.find(r => r.id === id);

test('the unfiltered queue lists every experiment, newest first, each in the stage the state machine gives it', () => {
  const s = seedState();
  const view = queueView(s, {});
  assert.deepEqual(view.rows.map(r => r.id), Object.values(s.experiments).sort((a, b) => b.number - a.number).map(e => e.id));
  for (const r of view.rows) assert.equal(r.stage, experimentStage(s, r.id), r.id);
  assert.deepEqual(view.counts, { all: 9, pending: 3, queued: 1, running: 1, needs_review: 1, done: 3 });
  assert.deepEqual(view.tabs.map(t => [t.id, t.label, t.count]), [['all', 'All', 9], ...STAGES.map(id => [id, STAGE_LABEL[id], view.counts[id]])]);
});

test('the action label and target depend only on the stage', () => {
  const s = seedState();
  const view = queueView(s, {});
  const action = id => { const a = row(view, id).action; return [a.label, a.route, a.params]; };
  assert.deepEqual(action('exp-030'), ['Configure', 'workbench', { experimentId: 'exp-030' }]);
  assert.deepEqual(action('exp-028'), ['View', 'workbench', { experimentId: 'exp-028' }]);
  assert.deepEqual(action('exp-029'), ['Open', 'run-detail', { experimentId: 'exp-029', attemptId: 'attempt-002' }]);
  assert.deepEqual(action('exp-027'), ['Review', 'results', { experimentId: 'exp-027', attemptId: 'attempt-001' }]);
  assert.deepEqual(action('exp-024'), ['Results', 'results', { experimentId: 'exp-024', attemptId: 'attempt-004' }]);
});

test('a row carries its source, objective and the one-line result or progress from the selectors', () => {
  const view = queueView(seedState(), {});
  assert.deepEqual([row(view, 'exp-024').source, row(view, 'exp-024').objective], [{ kind: 'speedrun', label: 'Speedrun trace: duplicate follow-up emails', ref: '/speedrun/teams/invoice/trace' }, { id: 'policy_violations', label: 'Policy violations' }]);
  assert.equal(row(view, 'exp-024').workflowName, 'Sales follow-up');
  assert.equal(row(view, 'exp-025').workflowName, 'Support triage v2');
  assert.deepEqual(row(view, 'exp-029').progress, { done: 12, total: 18, pct: 67, text: '12/18' });
  assert.equal(row(view, 'exp-030').progress, null);
  assert.equal(row(view, 'exp-030').result, null);
  assert.match(row(view, 'exp-025').result.text, /2 regressed/);
  assert.deepEqual(row(view, 'exp-025').outcome, { decision: 'reject', label: 'Reject' });
  assert.equal(row(view, 'exp-027').outcome, null);
});

test('a status keeps the rows of that stage, and the counts stay those of the whole queue', () => {
  const s = seedState();
  const view = queueView(s, { status: 'done' });
  assert.deepEqual(view.rows.map(r => r.id), ['exp-026', 'exp-025', 'exp-024']);
  assert.equal(view.counts.all, 9);
  assert.deepEqual(queueView(s, { status: 'pending' }).rows.map(r => r.id), ['exp-032', 'exp-031', 'exp-030']);
});

test('search matches the experiment name or id, the workflow name and the source label, ignoring case', () => {
  const s = seedState();
  const ids = q => queueView(s, { q }).rows.map(r => r.id);
  assert.deepEqual(ids('refund'), ['exp-026', 'exp-025'], 'experiment name');
  assert.deepEqual(ids('SUPPORT TRIAGE'), ['exp-028', 'exp-026', 'exp-025'], 'workflow name');
  assert.deepEqual(ids('speedrun trace'), ['exp-032', 'exp-030', 'exp-027', 'exp-024'], 'source label');
  assert.deepEqual(ids('exp-028'), ['exp-028'], 'id');
  assert.deepEqual(ids('no such thing'), []);
  assert.deepEqual(queueView(s, { status: 'done', q: 'support' }).rows.map(r => r.id), ['exp-026', 'exp-025']);
});

test('the four summary cards count their stage and say one thing about it, read from the queue', () => {
  const cards = queueSummary(seedState());
  assert.deepEqual(cards.map(c => [c.id, c.label, c.count]), [['pending', 'Pending', 3], ['queued', 'Queued', 1], ['running', 'Running', 1], ['needs_review', 'Needs review', 1]]);
  assert.match(cards.find(c => c.id === 'running').detail, /Experiment 029.*12\/18/);
  assert.match(cards.find(c => c.id === 'queued').detail, /Support triage comparison/);
  assert.match(cards.find(c => c.id === 'needs_review').detail, /Meeting scheduling/);
  assert.ok(cards.every(c => c.detail.length > 0));
});
