import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { runScenario, createRun } from '../js/engine.js';

const dir = new URL('./fixtures/semantics/', import.meta.url);
const fixtures = readdirSync(dir).filter(f => f.endsWith('.json')).sort()
  .map(f => JSON.parse(readFileSync(new URL(f, dir))));

const derive = session => ({
  activations: session.activations.map(a => ({ id: a.id, end: a.end, status: a.status })),
  writes: session.ledger.writes.map(w => ({ activation: w.activation, amount: w.amount, approval: w.approvalId ? 'issued:' + session.ledger.approvals[w.approvalId].activation : null })),
  approvalsIssued: session.effects.filter(e => e.type === 'approval_issued').length,
  approvalsReused: session.effects.filter(e => e.type === 'approval_reused').length,
  writeDenied: session.effects.filter(e => e.type === 'write_denied').map(e => ({ activation: e.activation, reason: e.reason })),
  emits: session.effects.filter(e => e.type === 'emit').map(e => ({ activation: e.activation, node: e.node, labels: e.labels.map(l => l.data) })),
  nodeFires: (() => {
    const c = {};
    for (const s of session.trace) if (s.status !== 'skip' && s.status !== 'waiting') c[s.node] = (c[s.node] || 0) + 1;
    return c;
  })()
});

const KEYS = ['activations', 'writes', 'approvalsIssued', 'approvalsReused', 'writeDenied', 'emits', 'nodeFires'];

for (const fx of fixtures) {
  test(`engine: ${fx.name}`, () => {
    const session = runScenario(fx.graph, fx.scenario);
    const got = derive(session);
    for (const k of KEYS) {
      if (!(k in fx.expect)) continue;
      if (k === 'nodeFires') {
        for (const [n, c] of Object.entries(fx.expect.nodeFires)) assert.equal(got.nodeFires[n] || 0, c, `${fx.name}: nodeFires.${n}`);
      } else {
        assert.deepEqual(got[k], fx.expect[k], `${fx.name}: ${k}`);
      }
    }
  });
}

test('engine: deterministic — same graph + scenario twice is byte-identical', () => {
  const fx = fixtures.find(f => f.name === 'split-daytotal-gate');
  const a = JSON.stringify(runScenario(fx.graph, fx.scenario));
  const b = JSON.stringify(runScenario(fx.graph, fx.scenario));
  assert.equal(a, b);
});

test('engine: interactive run pauses at a human approval and resumes on resolve', () => {
  // $800 split is not what we want; use replay-reusable shape (single request 900 -> approval).
  const fx = fixtures.find(f => f.name === 'replay-reusable');
  const single = { ...fx.scenario, requests: [fx.scenario.requests[0]] };
  const run = createRun(fx.graph, single, { interactive: true });
  // step until waiting or done
  let waits = 0;
  while (!run.done && !run.waiting && waits < 1000) { run.step(); waits++; }
  assert.ok(run.waiting, 'expected to pause at the approval control');
  assert.equal(run.waiting.node, 'C');
  run.resolveApproval(true);
  while (!run.done) run.step();
  const res = run.result();
  assert.equal(res.activations[0].status, 'success');
  assert.equal(res.ledger.writes.length, 1);
  assert.equal(res.ledger.writes[0].approvalId, 'ap1');
});

/* ---- regressions from code review round 1 (codex) ---- */
import { applyPatch as _ap, makeNode as _mk } from '../js/model.js';
import { runScenario as _run } from '../js/engine.js';
const _refund = () => JSON.parse(readFileSync(new URL('../templates/customer-refund.json', import.meta.url))).graph;
const _req = o => ({ id: 'r1', customer: 'c1', order: 'o1', amount: 2500, eligible: 2500, channel: 'support_chat', ...o });

test('review r1: an appliesWhen evaluation error ends the activation and performs no write', () => {
  const g = _ap(_refund(), [{ op: 'setConfig', id: 'approval', key: 'appliesWhen', value: '!amount' }]).value;
  const r = _run(g, { id: 's', template: 't', requests: [_req()] });
  assert.equal(r.ledger.writes.length, 0);
  assert.deepEqual(r.activations.map(a => a.status), ['error']);
});

test('review r1: two splitting agents do not lose money; ids stay unique; intent is consumed once', () => {
  const g = _ap(_refund(), [{ op: 'setConfig', id: 'eligibility', key: 'canSplit', value: true }]).value;
  const r = _run(g, { id: 's', template: 't', requests: [_req({ amount: 800, eligible: 800, intent: { split: 2 } })] });
  const total = r.ledger.writes.reduce((a, w) => a + w.amount, 0);
  assert.equal(total, 800);
  const ids = r.activations.map(a => a.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('review r1: a splitter after a decision still receives the untaken branch skip at a join:all node', () => {
  // request -> triage -> eligibility -> gate -(false)-> S (splitting agent) -> execution(join all) ; gate -(true)-> approval -(approved)-> execution
  let g = _refund();
  const S = _mk('agent', 'splitter', { x: 0, y: 0, config: { canSplit: true } });
  const eFalse = g.edges.find(e => e.from.node === 'gate' && e.from.port === 'false');
  g = _ap(g, [{ op: 'setConfig', id: 'triage', key: 'canSplit', value: false }, { op: 'addNode', node: S }, { op: 'removeEdge', id: eFalse.id },
    { op: 'addEdge', edge: { id: 'x1', kind: 'flow', from: { node: 'gate', port: 'false' }, to: { node: 'splitter', port: 'in' } } },
    { op: 'addEdge', edge: { id: 'x2', kind: 'flow', from: { node: 'splitter', port: 'out' }, to: { node: 'execution', port: 'in' } } },
    { op: 'setConfig', id: 'execution', key: 'join', value: 'all' }]).value;
  const r = _run(g, { id: 's', template: 't', requests: [_req({ amount: 1000, eligible: 1000, intent: { split: 2 } })] });
  assert.deepEqual(r.activations.map(a => `${a.id}:${a.status}:${a.end}`).sort(), ['r1#1:success:resolved', 'r1#2:success:resolved']);
  assert.equal(r.ledger.writes.length, 2);
});

test('review r1: trace steps carry their effects (write, approval, read)', () => {
  const r = _run(_refund(), { id: 's', template: 't', requests: [_req()] });
  const all = r.trace.flatMap(st => st.effects.map(e => e.type));
  for (const t of ['data_read', 'approval_issued', 'write', 'approval_consumed', 'emit']) assert.ok(all.includes(t), t);
  assert.equal(all.length, r.effects.length, 'every effect is attached to exactly one step');
});

test('review r2: pieces after a decision run strictly in order through a dayTotal gate and a join:all node', () => {
  let g = _refund();
  const S = _mk('agent', 'splitter', { config: { canSplit: true } });
  const C = _mk('control', 'ctl2', { config: { kind: 'human_approval', appliesWhen: 'dayTotal > 500', binding: ['customer', 'order', 'amount'], singleUse: true } });
  const eFalse = g.edges.find(e => e.from.node === 'gate' && e.from.port === 'false');
  g = _ap(g, [{ op: 'setConfig', id: 'triage', key: 'canSplit', value: false }, { op: 'setConfig', id: 'gate', key: 'condition', value: 'amount > 5000' },
    { op: 'addNode', node: S }, { op: 'addNode', node: C }, { op: 'removeEdge', id: eFalse.id },
    { op: 'addEdge', edge: { id: 'y1', kind: 'flow', from: { node: 'gate', port: 'false' }, to: { node: 'splitter', port: 'in' } } },
    { op: 'addEdge', edge: { id: 'y2', kind: 'flow', from: { node: 'splitter', port: 'out' }, to: { node: 'ctl2', port: 'in' } } },
    { op: 'addEdge', edge: { id: 'y3', kind: 'flow', from: { node: 'ctl2', port: 'approved' }, to: { node: 'execution', port: 'in' } } },
    { op: 'addEdge', edge: { id: 'y4', kind: 'flow', from: { node: 'ctl2', port: 'denied' }, to: { node: 'declined', port: 'in' } } },
    { op: 'setConfig', id: 'execution', key: 'join', value: 'all' }]).value;
  const r = _run(g, { id: 's', template: 't', requests: [_req({ amount: 1500, eligible: 1500, intent: { split: 3 } })] });
  assert.deepEqual(r.ledger.writes.map(w => w.activation), ['r1#1', 'r1#2', 'r1#3']);
  assert.deepEqual(r.ledger.writes.map(w => !!w.approvalId), [false, true, true]);
  assert.deepEqual(r.activations.map(a => a.status), ['success', 'success', 'success']);
});
