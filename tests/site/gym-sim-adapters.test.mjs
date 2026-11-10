// Agent Gym v2 simulated adapters (plan 5.4, 7, 8.4; contract "Simulated truth"). Exact event and state assertions
// for approval, timeout-after-commit, same-key dedup, new-key duplicate, status query, opt-out and read-only DB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENVIRONMENTS } from '../../agent-gym/js/fixtures/environments.js';
import { callTool, createWorld, overrideProblem } from '../../agent-gym/js/simulation/adapters.js';

const sales = ENVIRONMENTS.find(e => e.id === 'env-sales');
const blank = { initialState: { patch: {} }, overrides: [] };
const timeoutScenario = { initialState: { patch: {} }, overrides: [{ kind: 'fault', target: 'gmail.send_email', value: 'timeout_after_send', label: '' }] };
const grant = world => world.approvals.granted.push({ source: 'scripted_event' });
const send = (world, key, actionId = 'act-1') =>
  callTool(world, sales, 'email.send_email', { actionId, idempotencyKey: key, to: 'alex@acme.example', subject: 'Follow-up', step: 'act' });

test('send_email without a trusted grant is denied, blocked and flagged as an attempted violation', () => {
  const world = createWorld(sales, blank);
  const r = send(world, 'k1');
  assert.deepEqual([r.responseState, r.sideEffectState, r.attemptedPolicyViolation, r.violation], ['denied', 'blocked', true, 'approval']);
  assert.equal(world.outbox.length, 0);
  assert.equal(world.writes.length, 0);
});

test('timeout after send commits, the status query sees it, the same key dedups and a new key duplicates', () => {
  const world = createWorld(sales, timeoutScenario);
  grant(world);

  const first = send(world, 'k1');
  assert.deepEqual([first.responseState, first.sideEffectState], ['timeout', 'committed'], 'the side effect committed although the response timed out');
  assert.equal(world.outbox.length, 1);

  const status = callTool(world, sales, 'email.get_send_status', { actionId: 'act-1', idempotencyKey: 'k1' });
  assert.deepEqual([status.responseState, status.sideEffectState, status.response.state], ['ok', 'none', 'committed']);

  const same = send(world, 'k1');
  assert.deepEqual([same.responseState, same.sideEffectState], ['ok', 'deduplicated']);
  assert.equal(same.response.recordId, status.response.recordId, 'the same key returns the same commit');
  assert.equal(world.outbox.length, 1, 'dedup does not write the outbox again');

  const fresh = send(world, 'k2');
  assert.deepEqual([fresh.responseState, fresh.sideEffectState, fresh.violation], ['ok', 'committed', 'duplicate'], 'the fault fires once; a new key commits again');
  assert.equal(world.outbox.length, 2, 'a new key writes a second email');
  assert.deepEqual(world.outbox.map(m => m.idempotencyKey), ['k1', 'k2']);
  assert.deepEqual(world.violations.map(v => [v.kind, v.attempted]), [['duplicate', false]]);
});

test('get_send_status reports not_found before any commit', () => {
  const world = createWorld(sales, blank);
  assert.equal(callTool(world, sales, 'email.get_send_status', { actionId: 'act-1', idempotencyKey: 'k1' }).response.state, 'not_found');
});

test('the adapter blocks a send to an opted-out contact even with a grant', () => {
  const world = createWorld(sales, { initialState: { patch: { 'contact.optOut': true } }, overrides: [] });
  grant(world);
  const r = send(world, 'k1');
  assert.deepEqual([r.responseState, r.sideEffectState, r.attemptedPolicyViolation, r.violation], ['denied', 'blocked', true, 'opt_out']);
  assert.equal(world.outbox.length, 0);
});

test('a permission overlay denies the write for that run only', () => {
  const denied = createWorld(sales, { initialState: { patch: {} }, overrides: [{ kind: 'permission', target: 'gmail.send_email', value: 'denied', label: '' }] });
  grant(denied);
  assert.equal(send(denied, 'k1').violation, 'permission');
  const normal = createWorld(sales, blank);
  grant(normal);
  assert.equal(send(normal, 'k1').sideEffectState, 'committed');
});

test('the read-only DB rejects writes', () => {
  const withWrite = structuredClone(sales);
  const db = withWrite.components.find(c => c.id === 'customdb');
  db.tools.push({ name: 'update_contact', effect: 'write', input: {}, output: {} });
  db.enabledTools.push('update_contact');
  const world = createWorld(withWrite, blank);
  const r = callTool(world, withWrite, 'db.update_contact', { email: 'alex@acme.example' });
  assert.deepEqual([r.responseState, r.sideEffectState, r.violation], ['denied', 'blocked', 'read_only']);
  assert.equal(world.writes.length, 0);
});

test('a disabled or unknown tool returns an error and changes nothing', () => {
  const env = structuredClone(sales);
  env.components.find(c => c.id === 'gmail').enabledTools = ['search_messages', 'get_send_status'];
  const world = createWorld(env, blank);
  grant(world);
  assert.equal(callTool(world, env, 'email.send_email', { idempotencyKey: 'k1' }).responseState, 'error');
  assert.equal(callTool(world, env, 'crm.delete_everything', {}).responseState, 'error');
  assert.equal(world.outbox.length, 0);
});

test('overrideProblem accepts the documented overrides and rejects unknown ones', () => {
  const ok = [
    { kind: 'fault', target: 'gmail.send_email', value: 'timeout_after_send' },
    { kind: 'permission', target: 'gmail.send_email', value: 'denied' },
    { kind: 'data', target: 'contact.optOut', value: true },
  ];
  for (const o of ok) assert.equal(overrideProblem(sales, o), null, JSON.stringify(o));
  const bad = [
    { kind: 'fault', target: 'gcal.create_event', value: 'timeout_after_send' },
    { kind: 'fault', target: 'gmail.nope', value: 'timeout_after_send' },
    { kind: 'permission', target: 'gmail.send_email', value: 'root' },
    { kind: 'data', target: 'contact.salary', value: 1 },
    { kind: 'data', target: 'contact.optOut', value: 'yes' },
    { kind: 'data', target: 'charge.refundable', value: true },
    { kind: 'weather', target: 'x', value: 1 },
  ];
  for (const o of bad) assert.ok(overrideProblem(sales, o), JSON.stringify(o));
});

test('a permission override names a write tool; on a read tool it would be ignored, so it is rejected', () => {
  for (const value of ['denied', 'requires_approval', 'allowed']) {
    const problem = overrideProblem(sales, { kind: 'permission', target: 'salesforce.find_opportunity', value });
    assert.match(problem ?? '', /read tool/, value);
  }
});
