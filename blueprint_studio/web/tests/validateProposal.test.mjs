import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateProposal } from '../src/assist/validateProposal.js';
import { applyPatch } from '../../js/model.js';
import { lint } from '../../js/validate.js';

const graph = JSON.parse(readFileSync(new URL('../../templates/customer-refund.json', import.meta.url))).graph;

/* A proposal that parses to `__proto__` as an own key (JSON.parse makes it an
   own property, unlike a literal, which would set the prototype). */
const protoConfig = JSON.parse('{"__proto__": {"polluted": true}}');

test('validateProposal: rejects null, non-objects and unknown ops', () => {
  assert.equal(validateProposal(graph, null).ok, false);
  assert.equal(validateProposal(graph, 42).ok, false);
  assert.equal(validateProposal(graph, 'hi').ok, false);
  assert.equal(validateProposal(graph, []).ok, false);
  assert.equal(validateProposal(graph, {}).ok, false);
  assert.equal(validateProposal(graph, { ops: [] }).error.code, 'empty');
  assert.equal(validateProposal(graph, { ops: [{ op: 'hack' }] }).ok, false);
  assert.match(validateProposal(graph, { ops: [{ op: 'hack' }] }).error.message, /Change 1/);
});

test('validateProposal: setConfig with an unknown key or __proto__ is rejected', () => {
  assert.equal(validateProposal(graph, { ops: [{ op: 'setConfig', node: 'gate', key: 'nonsense', value: 1 }] }).ok, false);
  assert.equal(validateProposal(graph, { ops: [{ op: 'setConfig', node: 'gate', key: '__proto__', value: 'x' }] }).ok, false);
  // a forbidden key at depth (a config override carrying __proto__)
  assert.equal(validateProposal(graph, { ops: [{ op: 'insertStep', from: 'eligibility', to: 'gate', type: 'control', config: protoConfig }] }).ok, false);
});

test('validateProposal: out-of-range numbers are rejected', () => {
  assert.equal(validateProposal(graph, { ops: [{ op: 'setConfig', node: 'unauth', key: 'threshold', value: 1e10 }] }).ok, false);
  assert.equal(validateProposal(graph, { ops: [{ op: 'setConfig', node: 'gate', key: 'condition', value: { n: NaN } }] }).ok, false);
});

test('validateProposal: a later op may reference an earlier macro ref, remapped', () => {
  const r = validateProposal(graph, { ops: [
    { op: 'insertStep', from: 'eligibility', to: 'gate', type: 'control', ref: 'check' },
    { op: 'setLabel', node: { ref: 'check' }, label: 'Manager check' }
  ] });
  assert.ok(r.ok, JSON.stringify(r.error));
  assert.ok(r.value.created.length >= 1);
  const created = r.value.graph.nodes.find(n => n.label === 'Manager check');
  assert.ok(created, 'the created control was renamed through its ref');
  assert.equal(lint(r.value.graph).filter(i => i.severity === 'error').length, 0);
});

test('validateProposal: a failing third op rejects the whole proposal, naming the op', () => {
  const before = JSON.stringify(graph);
  const r = validateProposal(graph, { ops: [
    { op: 'setLabel', node: 'gate', label: 'Gate' },
    { op: 'setConfig', node: 'gate', key: 'condition', value: 'amount > 100' },
    { op: 'removeNode', node: 'no-such-node' }
  ] });
  assert.equal(r.ok, false);
  assert.match(r.error.message, /Change 3/);
  assert.equal(JSON.stringify(graph), before, 'the input graph is never mutated');
});

test('validateProposal: a valid macro proposal expands to primitive patch ops', () => {
  const r = validateProposal(graph, { ops: [{ op: 'addMonitor', node: 'payment', kind: 'unauthorized_write' }] });
  assert.ok(r.ok, JSON.stringify(r.error));
  assert.ok(r.value.ops.length >= 1);
  assert.ok(r.value.ops.every(o => o.op !== 'addMonitor'), 'macros are expanded to primitives');
  // the primitive ops apply cleanly to the original graph
  const patched = applyPatch(graph, r.value.ops);
  assert.ok(patched.ok);
  assert.equal(lint(patched.value).filter(i => i.severity === 'error').length, 0);
});

test('validateProposal: setConfig value must match the field type (select/bool/number)', () => {
  assert.equal(validateProposal(graph, { ops: [{ op: 'setConfig', node: 'approval', key: 'kind', value: 'nope' }] }).ok, false);
  assert.equal(validateProposal(graph, { ops: [{ op: 'setConfig', node: 'approval', key: 'singleUse', value: 'yes' }] }).ok, false);
  assert.equal(validateProposal(graph, { ops: [{ op: 'setConfig', node: 'gate', key: 'condition', value: 'amount >' }] }).ok, false);
  assert.equal(validateProposal(graph, { ops: [{ op: 'setConfig', node: 'approval', key: 'slaMinutes', value: 30 }] }).ok, true);
});
