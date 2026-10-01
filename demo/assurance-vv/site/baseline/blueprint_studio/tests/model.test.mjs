import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { NODE_TYPES, canConnect, applyPatch, makeNode, hashGraph, sha256Hex, canonical, nextId } from '../js/model.js';

const tpl = name => JSON.parse(readFileSync(new URL(`../templates/${name}.json`, import.meta.url)));

test('sha256 matches node:crypto', () => {
  for (const s of ['', 'abc', 'x'.repeat(55), 'y'.repeat(56), 'z'.repeat(64), '蓝图 ✓'.repeat(40)])
    assert.equal(sha256Hex(s), createHash('sha256').update(s).digest('hex'));
});

test('canonical JSON sorts keys and ignores undefined', () => {
  assert.equal(canonical({ b: 1, a: [2, { d: undefined, c: 3 }] }), '{"a":[2,{"c":3}],"b":1}');
});

test('refund template has the plan §4.6 shape', () => {
  const { graph } = tpl('customer-refund');
  assert.equal(graph.nodes.length, 14);
  assert.equal(graph.edges.filter(e => e.kind === 'flow').length, 9);
  assert.equal(graph.edges.filter(e => e.kind === 'access').length, 2);
  const gate = graph.nodes.find(n => n.id === 'gate'), unauth = graph.nodes.find(n => n.id === 'unauth');
  assert.equal(gate.config.condition, 'amount > 2000');
  assert.equal(unauth.config.threshold, 500);
  assert.notEqual(gate.config.condition, `amount > ${unauth.config.threshold}`, 'declared autonomy differs from the business constraint');
  assert.equal(graph.nodes.find(n => n.id === 'credentials').config.sensitivity, 'secret');
  assert.deepEqual(graph.nodes.filter(n => n.type === 'prohibited').map(n => n.config.monitor).sort(), ['duplicate_effect', 'secret_exposure', 'unauthorized_write']);
});

test('every template and fixture edge is accepted by canConnect and every node type is known', () => {
  const graphs = [tpl('customer-refund').graph, tpl('vendor-bank-change').graph];
  const dir = new URL('./fixtures/semantics/', import.meta.url);
  for (const f of readdirSync(dir)) graphs.push(JSON.parse(readFileSync(new URL(f, dir))).graph);
  for (const g of graphs) {
    for (const n of g.nodes) assert.ok(NODE_TYPES[n.type], n.type);
    const empty = { nodes: g.nodes, edges: [] };
    const r = applyPatch(empty, g.edges.map(edge => ({ op: 'addEdge', edge })));
    assert.ok(r.ok, JSON.stringify(r.error));
  }
});

test('port compatibility', () => {
  const g = tpl('customer-refund').graph;
  const clean = { nodes: g.nodes, edges: [] };
  assert.ok(canConnect(clean, { node: 'request', port: 'out' }, { node: 'triage', port: 'in' }).ok);
  assert.equal(canConnect(clean, { node: 'request', port: 'out' }, { node: 'triage', port: 'acc' }).error.code, 'incompatible_ports');
  assert.equal(canConnect(clean, { node: 'request', port: 'out' }, { node: 'gate', port: 'true' }).error.code, 'incompatible_ports');
  assert.equal(canConnect(clean, { node: 'profile', port: 'acc' }, { node: 'credentials', port: 'acc' }).error.code, 'bad_access');
  const acc = canConnect(clean, { node: 'profile', port: 'acc' }, { node: 'triage', port: 'acc' });
  assert.equal(acc.value.from.node, 'triage', 'access edges are normalised actor -> data');
  assert.equal(canConnect(g, { node: 'request', port: 'out' }, { node: 'eligibility', port: 'in' }).error.code, 'port_taken');
});

test('applyPatch is pure and all-or-nothing; removeNode drops edges and watches', () => {
  const g = tpl('customer-refund').graph;
  const before = JSON.stringify(g);
  const r = applyPatch(g, [{ op: 'removeNode', id: 'payment' }]);
  assert.ok(r.ok);
  assert.equal(JSON.stringify(g), before);
  assert.ok(!r.value.edges.some(e => e.from.node === 'payment' || e.to.node === 'payment'));
  assert.deepEqual(r.value.nodes.find(n => n.id === 'unauth').config.watches, []);
  const bad = applyPatch(g, [{ op: 'setLabel', id: 'gate', label: 'x' }, { op: 'removeNode', id: 'nope' }]);
  assert.equal(bad.ok, false);
  assert.equal(JSON.stringify(g), before);
});

test('hash ignores positions and changes with semantics', () => {
  const g = tpl('customer-refund').graph, meta = { name: 'Customer Refund', domain: 'Customer Service' };
  const moved = applyPatch(g, [{ op: 'moveNode', id: 'gate', x: 999, y: 999 }]).value;
  const changed = applyPatch(g, [{ op: 'setConfig', id: 'gate', key: 'condition', value: 'amount > 500' }]).value;
  assert.equal(hashGraph(g, meta), hashGraph(moved, meta));
  assert.notEqual(hashGraph(g, meta), hashGraph(changed, meta));
});

test('makeNode applies defaults; nextId skips taken ids', () => {
  const n = makeNode('control', 'c-1');
  assert.equal(n.config.kind, 'human_approval');
  assert.equal(nextId(['agent-1', 'agent-2'], 'agent'), 'agent-3');
});

test('v2 model change: two branch ports of one node may target the same input; one port still takes one edge', () => {
  const g0 = tpl('customer-refund').graph;
  const d = makeNode('decision', 'd2', { config: { condition: 'amount > 100' } });
  const g = applyPatch(g0, [{ op: 'addNode', node: d },
    { op: 'addEdge', edge: { id: 'x1', kind: 'flow', from: { node: 'd2', port: 'true' }, to: { node: 'payment', port: 'in' } } },
    { op: 'addEdge', edge: { id: 'x2', kind: 'flow', from: { node: 'd2', port: 'false' }, to: { node: 'payment', port: 'in' } } }]);
  assert.ok(g.ok, JSON.stringify(g.error));
  assert.equal(canConnect(g.value, { node: 'd2', port: 'true' }, { node: 'resolved', port: 'in' }).error.code, 'port_taken');
});
