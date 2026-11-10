import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replayEvents, laneStatus } from '../../speedrun/web/upstream/src/lib/replay.ts';

const refund = [
  { roleId: 'refund-lead', segments: [
    { start: 0, end: 3, kind: 'lead', label: 'T1 Parse' },
    { start: 3, end: 29, kind: 'idle', label: 'Idle' },
    { start: 29, end: 30, kind: 'lead', label: 'Close case' }], markers: [], messages: [] },
  { roleId: 'order-specialist', segments: [
    { start: 3, end: 11, kind: 'timeout', label: 'Attempt 1' },
    { start: 11, end: 13, kind: 'wait', label: 'Retry delay' },
    { start: 13, end: 24, kind: 'critical', label: 'Attempt 2' }],
    markers: [{ at: 11.5, candidateId: '01' }], messages: [{ at: 24, to: 'policy-reviewer', label: 'order details' }] },
  { roleId: 'policy-reviewer', segments: [
    { start: 3, end: 9, kind: 'reusable', label: 'T3 Load policy' },
    { start: 9, end: 24, kind: 'blocked', label: 'Blocked on T2' },
    { start: 24, end: 27, kind: 'critical', label: 'T4 Check' }], markers: [], messages: [] },
];

test('refund run at 18s: order-specialist works, the reviewer is blocked on it, the lead is idle', () => {
  const at = Object.fromEntries(refund.map((l) => [l.roleId, laneStatus(l, 18).status]));
  assert.deepEqual(at, { 'refund-lead': 'idle', 'order-specialist': 'working', 'policy-reviewer': 'blocked' });
});

test('lane status covers pending, timeout, wait and done', () => {
  const order = refund[1];
  assert.equal(laneStatus(order, 1).status, 'pending');
  assert.equal(laneStatus(order, 5).status, 'working');
  assert.equal(laneStatus(order, 12).status, 'waiting');
  assert.equal(laneStatus(order, 24).status, 'done');
});

test('events are sorted by time and follow the per-kind rules', () => {
  const ev = replayEvents(refund, { markers: true });
  assert.deepEqual(ev.map((e) => e.at), ev.map((e) => e.at).sort((a, b) => a - b));
  const kinds = (role) => ev.filter((e) => e.roleId === role).map((e) => `${e.at}:${e.kind}`);
  assert.deepEqual(kinds('order-specialist'), ['3:start', '11:timeout', '11:wait', '11.5:opportunity', '13:start', '24:done', '24:message']);
  assert.deepEqual(kinds('refund-lead'), ['0:start', '3:done', '29:start', '30:done'], 'idle time emits no events');
  assert.ok(!kinds('policy-reviewer').includes('9:start'), 'blocked emits no start');
});

test('a blocked segment that runs to the end of the run emits no unblocked event', () => {
  const lanes = [{ roleId: 'a', segments: [{ start: 0, end: 5, kind: 'work', label: 'w' }, { start: 5, end: 10, kind: 'blocked', label: 'b' }], markers: [], messages: [] }];
  assert.deepEqual(replayEvents(lanes, { markers: false }).map((e) => e.kind), ['start', 'done', 'blocked']);
});

test('the message at 24s names its recipient and markers can be switched off', () => {
  const msg = replayEvents(refund, { markers: false }).find((e) => e.kind === 'message');
  assert.equal(msg.at, 24);
  assert.equal(msg.toRoleId, 'policy-reviewer');
  assert.equal(replayEvents(refund, { markers: false }).some((e) => e.kind === 'opportunity'), false);
});
