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
