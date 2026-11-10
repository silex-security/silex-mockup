import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutTrace, rowState, frameAt } from '../../speedrun/web/upstream/src/lib/trace-waterfall.ts';

const refund = [
  { roleId: 'refund-lead', name: 'Refund Lead', messages: [], segments: [
    { start: 0, end: 3, kind: 'lead', label: 'T1 Parse & create tasks' },
    { start: 3, end: 29, kind: 'idle', label: 'Idle — monitoring' },
    { start: 29, end: 30, kind: 'lead', label: 'Close case' }] },
  { roleId: 'order-specialist', name: 'Order Specialist', messages: [{ at: 24, to: 'policy-reviewer', label: 'order details' }], segments: [
    { start: 3, end: 11, kind: 'timeout', label: 'Attempt 1 — timed out at 8s' },
    { start: 11, end: 13, kind: 'wait', label: 'Retry delay 2s' },
    { start: 13, end: 24, kind: 'critical', label: 'Attempt 2 — 11s' }] },
  { roleId: 'policy-reviewer', name: 'Policy Reviewer', messages: [{ at: 27, to: 'refund-reviewer', label: 'eligible ✓' }], segments: [
    { start: 3, end: 9, kind: 'reusable', label: 'T3 Load refund policy (6.1k tok)' },
    { start: 9, end: 24, kind: 'blocked', label: 'Blocked on T2' },
    { start: 24, end: 27, kind: 'critical', label: 'T4 Check eligibility' }] },
  { roleId: 'refund-reviewer', name: 'Refund Reviewer', messages: [{ at: 29, to: 'refund-lead', label: 'authorized' }], segments: [
    { start: 3, end: 8, kind: 'reusable', label: 'Load refund policy — duplicate' },
    { start: 8, end: 27, kind: 'blocked', label: 'Blocked on T4' },
    { start: 27, end: 29, kind: 'critical', label: 'T5 Authorize refund' }] },
];

const w = layoutTrace(refund, 30);
const bar = (r) => r.bars.map((b) => [b.s, b.e, b.tone, b.fill ?? '', b.mark ?? ''].join(' '));

test('refund run lays out as member rows with one task row per segment, in order', () => {
  assert.deepEqual(
    w.rows.map((r) => `${r.depth}:${r.name}`),
    ['0:Refund Lead', '1:T1 Parse & create tasks', '1:Idle', '1:Close case',
      '0:Order Specialist', '1:Attempt 1', '1:Retry delay 2s', '1:Attempt 2',
      '0:Policy Reviewer', '1:T3 Load refund policy (6.1k tok)', '1:Blocked on T2', '1:T4 Check eligibility',
      '0:Refund Reviewer', '1:Load refund policy', '1:Blocked on T4', '1:T5 Authorize refund'],
  );
});

test('each member keeps one tone, waiting and blocked time is hatched, a timeout is a red failed mark', () => {
  assert.deepEqual(w.rows.slice(1, 4).map(bar), [['0 3 violet soft '], ['3 29 grey hatch '], ['29 30 violet soft ']]);
  assert.deepEqual(w.rows.slice(5, 8).map(bar), [['3 11 red  fail'], ['11 13 blue hatch '], ['13 24 blue  ']]);
  assert.deepEqual(w.rows.slice(9, 12).map(bar), [['3 9 amber soft '], ['9 24 amber hatch '], ['24 27 amber  ']]);
  assert.deepEqual(w.rows.slice(13, 16).map(bar), [['3 8 green soft '], ['8 27 green hatch '], ['27 29 green  ']]);
});

test('a member row sums its working time and draws only the time it spent working', () => {
  assert.deepEqual(w.rows[0].bars.map((b) => [b.s, b.e]), [[0, 3], [29, 30]]);
  assert.equal(w.rows[0].label, '4s working');
  assert.equal(w.rows[4].label, '19s working');
  assert.equal(w.rows[8].label, '9s working');
  assert.equal(w.rows[12].label, '7s working');
  assert.deepEqual([0, 4, 8, 12].map((i) => w.rows[i].end), [30, 24, 27, 29]);
});

test('bar-end labels carry the duration, and badges mark the failure, the critical path and the slowest step', () => {
  const task = (i) => [w.rows[i].label, w.rows[i].badges.map((b) => `${b.tone}:${b.text}`)];
  assert.deepEqual(task(5), ['8s', ['red:Timed out']]);
  assert.deepEqual(task(6), ['2s', []]);
  assert.deepEqual(task(7), ['11s', ['amber:Critical path', 'violet:Slowest']]);
  assert.deepEqual(task(9), ['6s', ['violet:Reusable context']]);
  assert.deepEqual(task(11), ['3s', ['amber:Critical path']]);
  assert.deepEqual(task(14), ['19s', []]);
  assert.equal(w.rows.flatMap((r) => r.badges).filter((b) => b.text === 'Slowest').length, 1);
});

test('the sub label is what follows the dash in the source label', () => {
  assert.equal(w.rows[2].sub, 'monitoring');
  assert.equal(w.rows[5].sub, 'timed out at 8s');
  assert.equal(w.rows[13].sub, 'duplicate');
  assert.equal(w.rows[1].sub, '');
});

test('the axis ticks every 5s up to the run end, with room right of the last bar for its label', () => {
  assert.deepEqual(w.ticks, [0, 5, 10, 15, 20, 25, 30]);
  assert.ok(w.span > 30);
});

test('each message becomes a handoff from the sending task row to the task row the receiver is in then', () => {
  assert.deepEqual(w.handoffs, [
    { at: 24, from: 7, to: 11, label: 'order details' },
    { at: 27, from: 11, to: 15, label: 'eligible ✓' },
    { at: 29, from: 15, to: 3, label: 'authorized' },
  ]);
});

test('a message that arrives while the receiver is blocked lands on the blocked row', () => {
  const lanes = [
    { roleId: 'a', name: 'A', messages: [{ at: 6, to: 'b', label: 'within policy' }], segments: [{ start: 2, end: 6, kind: 'reusable', label: 'T3' }] },
    { roleId: 'b', name: 'B', messages: [], segments: [{ start: 2, end: 17, kind: 'blocked', label: 'Blocked on T2' }, { start: 17, end: 26, kind: 'critical', label: 'T4' }] },
  ];
  assert.deepEqual(layoutTrace(lanes, 26).handoffs, [{ at: 6, from: 1, to: 3, label: 'within policy' }]);
});

test('a message to a member that is not in the run draws no handoff', () => {
  const lone = [{ ...refund[1], messages: [{ at: 24, to: 'nobody', label: 'x' }] }];
  assert.deepEqual(layoutTrace(lone, 30).handoffs, []);
});

test('rows are pending before their start and running while the playhead is inside them', () => {
  const attempt2 = w.rows[7];
  assert.equal(rowState(attempt2, 10, true), 'pending');
  assert.equal(rowState(attempt2, 13, true), 'pending');
  assert.equal(rowState(attempt2, 20, true), 'running');
  assert.equal(rowState(attempt2, 20, false), '');
  assert.equal(rowState(attempt2, 24, true), '');
  assert.equal(rowState(attempt2, 30, true), '', 'nothing is pending once the run is over');
});

test('live counters at 18s: Order Specialist is mid-attempt, the reviewers are blocked, no message sent yet', () => {
  assert.deepEqual(frameAt(refund, 18), { elapsed: '18s', done: 4, steps: 8, blocked: 2, messages: 0 });
});

test('live counters at the end count every step and message', () => {
  assert.deepEqual(frameAt(refund, 30), { elapsed: '30s', done: 8, steps: 8, blocked: 0, messages: 3 });
});
