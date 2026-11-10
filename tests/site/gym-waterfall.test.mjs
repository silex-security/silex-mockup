// The Gym run trace as a waterfall: a pure layout of one execution's events on the step sequence. Events carry only an order, so the axis is steps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runWaterfall } from '../../agent-gym/js/runs/waterfall.js';

const labels = { n1: 'Find', n2: 'Draft' };
const events = [
  { seq: 1, nodeId: 'n1', type: 'tool_call', tool: 'crm.find', request: {}, responseState: 'ok', sideEffectState: 'none', note: 'crm.find → ok' },
  { seq: 2, nodeId: 'n2', type: 'model', note: 'drafted' },
  { seq: 3, nodeId: 'n2', type: 'tool_call', tool: 'email.send', request: {}, responseState: 'timeout', sideEffectState: 'committed', note: 'email.send → timeout · committed' },
  { seq: 4, nodeId: '', type: 'approval', note: 'Approval granted (scripted event)' },
  { seq: 5, nodeId: 'n1', type: 'policy_block', tool: 'crm.delete', request: {}, responseState: 'denied', sideEffectState: 'blocked', attemptedPolicyViolation: true, note: 'blocked' },
];
const assertions = [{ pass: true }, { pass: false }];

test('one event is one step wide and the axis is the sequence', () => {
  const w = runWaterfall(events, labels, assertions);
  assert.equal(w.total, 5);
  const e = w.rows.filter(r => r.depth === 2).sort((a, b) => a.start - b.start);
  assert.deepEqual(e.map(r => [r.name, r.start, r.end]), [['crm.find', 0, 1], ['Model', 1, 2], ['email.send', 2, 3], ['Approval', 3, 4], ['crm.delete', 4, 5]]);
});

test('rows run run, node, its events, in order of first appearance, and a revisited node keeps one row with two bars', () => {
  const w = runWaterfall(events, labels, assertions);
  assert.deepEqual(w.rows.map(r => [r.key, r.depth, r.parent]), [
    ['run', 0, null],
    ['node:n1', 1, 'run'], ['e1', 2, 'node:n1'], ['e5', 2, 'node:n1'],
    ['node:n2', 1, 'run'], ['e2', 2, 'node:n2'], ['e3', 2, 'node:n2'],
    ['node:', 1, 'run'], ['e4', 2, 'node:'],
  ]);
  const node = key => w.rows.find(r => r.key === key);
  assert.deepEqual(node('node:n1').bars, [{ start: 0, end: 1, tone: 'blue', fill: 'soft' }, { start: 4, end: 5, tone: 'red', fill: 'soft' }]);
  assert.deepEqual(node('node:n2').bars, [{ start: 1, end: 3, tone: 'blue', fill: 'soft' }]);
  assert.equal(node('node:').name, 'Scenario event');
  assert.equal(node('node:n2').name, 'Draft');
  assert.deepEqual(node('run').bars, [{ start: 0, end: 5, tone: 'red', fill: 'soft' }]);
});

test('each event takes its tone from what happened', () => {
  const w = runWaterfall(events, labels, assertions);
  const bar = key => w.rows.find(r => r.key === key).bars[0];
  assert.deepEqual(bar('e1'), { start: 0, end: 1, tone: 'blue', fill: null });
  assert.deepEqual(bar('e2'), { start: 1, end: 2, tone: 'violet', fill: null });
  assert.deepEqual(bar('e3'), { start: 2, end: 3, tone: 'amber', fill: 'hatch' });
  assert.deepEqual(bar('e4'), { start: 3, end: 4, tone: 'green', fill: null });
  assert.deepEqual(bar('e5'), { start: 4, end: 5, tone: 'red', fill: null, mark: 'fail' });
});

test('labels carry the recorded response and side effect, and a violation attempt is badged', () => {
  const w = runWaterfall(events, labels, assertions);
  const row = key => w.rows.find(r => r.key === key);
  assert.equal(row('e1').label, 'ok');
  assert.equal(row('e3').label, 'timeout · committed');
  assert.equal(row('e2').label, '');
  assert.deepEqual(row('e5').badges, [{ text: 'Policy violation attempted', tone: 'red' }]);
});

test('counts', () => {
  const w = runWaterfall(events, labels, assertions);
  assert.deepEqual(w.counts, { tools: 3, timeouts: 1, failed: 1, assertionsFailed: 1 });
  assert.deepEqual(runWaterfall([], labels, []).rows, []);
});

test('a pending approval is waiting, drawn hatched', () => {
  const w = runWaterfall([{ seq: 1, nodeId: 'n1', type: 'approval', note: 'Approval requested' }], labels, []);
  assert.deepEqual(w.rows[2].bars[0], { start: 0, end: 1, tone: 'amber', fill: 'hatch' });
});
