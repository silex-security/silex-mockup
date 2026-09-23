import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hashGraph, applyPatch, makeNode, nextId } from '../js/model.js';
import { generateScenarioSet } from '../js/adversary.js';
import { lint, validate } from '../js/validate.js';

const tpl = name => JSON.parse(readFileSync(new URL(`../templates/${name}.json`, import.meta.url)));
const meta = { name: 'Customer Refund', domain: 'Customer Service' };

test('validate: refund baseline yields exactly the plan §4.6 complete finding list', () => {
  const graph = tpl('customer-refund').graph;
  const baseHash = hashGraph(graph, meta);
  const set = generateScenarioSet(graph, { n: 24, baseHash });
  const v = validate(graph, set);
  const ids = v.findings.map(f => f.id).sort();
  assert.deepEqual(ids, ['dup:duplicate_submit', 'exposure:injection_exfil', 'unauth:below_threshold', 'unauth:benign', 'unauth:replay', 'unauth:split']);
  for (const f of v.findings) { assert.ok(f.violating > 0, f.id); assert.equal(f.run, 24); assert.equal(f.grade, 'Declared'); }
  const cats = Object.fromEntries(v.findings.map(f => [f.id, f.category]));
  assert.equal(cats['unauth:benign'], 'Policy Gap (normal operation)');
  assert.equal(cats['unauth:below_threshold'], 'Missing Approval');
  assert.equal(cats['unauth:split'], 'Cross-Agent Risk');
  assert.equal(cats['unauth:replay'], 'Workflow Logic Risk');
  assert.equal(cats['dup:duplicate_submit'], 'Workflow Logic Risk');
  assert.equal(cats['exposure:injection_exfil'], 'Data Exposure');
  assert.equal(v.findings.find(f => f.id === 'unauth:below_threshold').severity, 'critical');
});

test('validate: vendor template produces its own (unauthorized_write) findings, no refund writes', () => {
  const graph = tpl('vendor-bank-change').graph;
  const baseHash = hashGraph(graph, { name: 'Vendor Bank-Detail Change', domain: 'Finance' });
  const set = generateScenarioSet(graph, { n: 24, baseHash });
  const v = validate(graph, set);
  // threshold 0 means every write needs approval, so every writing template finds a violation
  const ids = v.findings.map(f => f.id).sort();
  assert.deepEqual(ids, ['vunauth:below_threshold', 'vunauth:benign', 'vunauth:duplicate_submit', 'vunauth:injection_exfil', 'vunauth:replay', 'vunauth:split']);
  for (const f of v.findings) assert.equal(f.monitor, 'unauthorized_write');
  const caps = new Set(v.runs.flatMap(r => r.session.ledger.writes.map(w => w.cap)));
  assert.deepEqual([...caps], ['vendor.update']);
});

test('lint: refund template is clean', () => {
  assert.deepEqual(lint(tpl('customer-refund').graph).filter(i => i.severity === 'error'), []);
});

test('lint: catches dangling port, cycle, unreachable, unused data, no watches, bad expr', () => {
  const g = tpl('customer-refund').graph;
  const dangling = applyPatch(g, [{ op: 'removeEdge', id: 'e4' }]).value; // gate.true dangling
  assert.ok(lint(dangling).some(i => i.code === 'dangling_port'));

  const cycle2 = applyPatch(g, [{ op: 'removeEdge', id: 'e5' }, { op: 'addEdge', edge: { id: 'e3b', kind: 'flow', from: { node: 'gate', port: 'false' }, to: { node: 'triage', port: 'in' } } }]);
  assert.ok(cycle2.ok, JSON.stringify(cycle2.error));
  assert.ok(lint(cycle2.value).some(i => i.code === 'cycle'));

  const unreachable = applyPatch(g, [{ op: 'addNode', node: makeNode('agent', 'orphan', { config: {} }) }]).value;
  assert.ok(lint(unreachable).some(i => i.code === 'unreachable' && i.nodeId === 'orphan'));

  const unused = applyPatch(g, [{ op: 'addNode', node: makeNode('data', 'ghost', { config: { sensitivity: 'public' } }) }]).value;
  assert.ok(lint(unused).some(i => i.code === 'unused_data' && i.nodeId === 'ghost'));

  const nowatch = applyPatch(g, [{ op: 'setConfig', id: 'dup', key: 'watches', value: [] }]).value;
  assert.ok(lint(nowatch).some(i => i.code === 'no_watches' && i.nodeId === 'dup'));

  const badexpr = applyPatch(g, [{ op: 'setConfig', id: 'gate', key: 'condition', value: 'amount > nope' }]).value;
  assert.ok(lint(badexpr).some(i => i.code === 'expr_unknown_identifier'));
});

test('potentialPaths: from the untrusted trigger to the watched tool with guards', () => {
  const graph = tpl('customer-refund').graph;
  const v = validate(graph, generateScenarioSet(graph, { n: 1, baseHash: hashGraph(graph, meta) }));
  const toPayment = v.potential.filter(p => p.target === 'payment');
  assert.ok(toPayment.length >= 1);
  for (const p of toPayment) assert.ok(p.guards.includes('gate'));
});

test('review r1: lint requires a reachable success outcome and a decision condition / blocking rule', async () => {
  const { applyPatch, makeNode } = await import('../js/model.js');
  const g0 = JSON.parse((await import('node:fs')).readFileSync(new URL('../templates/customer-refund.json', import.meta.url))).graph;
  const noSuccess = applyPatch(g0, [{ op: 'setConfig', id: 'resolved', key: 'success', value: false }]).value;
  assert.ok(lint(noSuccess).some(i => i.code === 'no_success_outcome'));
  const noCond = applyPatch(g0, [{ op: 'setConfig', id: 'gate', key: 'condition', value: '' }]).value;
  assert.ok(lint(noCond).some(i => i.code === 'missing_config' && i.nodeId === 'gate'));
  const gate = makeNode('control', 'blk', { config: { kind: 'policy_gate', action: 'block', rule: '' } });
  assert.ok(lint(applyPatch(g0, [{ op: 'addNode', node: gate }]).value).some(i => i.code === 'missing_config' && i.nodeId === 'blk'));
});
