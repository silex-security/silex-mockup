import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyPatch } from '../js/model.js';
import { compileText, PHRASES } from '../js/nlcompile.js';

const tpl = name => JSON.parse(readFileSync(new URL(`../templates/${name}.json`, import.meta.url)));

test('nlcompile: every documented phrase compiles to its expected patch', () => {
  const graph = tpl('customer-refund').graph;

  // require approval above $X -> gating decision amount > X
  const r1 = compileText('Require approval above $500.', graph).value;
  assert.deepEqual(r1.unmatched, []);
  assert.ok(r1.ops.some(op => op.op === 'setConfig' && op.id === 'gate' && op.value === 'amount > 500'), JSON.stringify(r1.ops));

  // aggregate per day -> dayTotal
  const r2 = compileText('Aggregate per customer per day.', graph).value;
  assert.ok(r2.ops.some(op => op.op === 'setConfig' && op.id === 'gate' && op.value === 'dayTotal > 2000'));

  // bind approval to customer, order and amount
  const r3 = compileText('Bind the approval to customer, order and amount.', graph).value;
  assert.ok(r3.ops.some(op => op.op === 'setConfig' && op.id === 'approval' && op.key === 'binding' && op.value.length === 3));

  // single-use approvals
  const r4 = compileText('Make it a single-use approval.', graph).value;
  assert.ok(r4.ops.some(op => op.op === 'setConfig' && op.id === 'approval' && op.key === 'singleUse' && op.value === true));

  // prevent duplicate -> idempotency
  const r5 = compileText('Prevent duplicate compensation.', graph).value;
  assert.ok(r5.ops.some(op => op.op === 'setConfig' && op.id === 'payment' && op.key === 'idempotencyKey' && op.value === true));

  // never expose credentials -> redact gate
  const r6 = compileText('Never expose payment credentials.', graph).value;
  assert.ok(r6.ops.some(op => op.op === 'addNode' && op.node.type === 'control' && op.node.config.kind === 'policy_gate'));

  // notify the customer -> already has an external success outcome, so no-op
  const r7 = compileText('Notify the customer.', graph).value;
  assert.deepEqual(r7.ops, []);

  // unknown phrase -> unmatched
  const r8 = compileText('Please do something magical.', graph).value;
  assert.equal(r8.matched.length, 0);
  assert.equal(r8.unmatched.length, 1);
});

test('nlcompile: PHRASES documents the seven phrases', () => {
  assert.equal(PHRASES.length, 7);
});

test('nlcompile: compiled ops are applicable to the graph', () => {
  const graph = tpl('customer-refund').graph;
  const r = compileText('Require approval above $500. Bind the approval to customer, order, amount. Single-use approval.', graph).value;
  const patched = applyPatch(graph, r.ops);
  assert.ok(patched.ok, JSON.stringify(patched.error));
});
