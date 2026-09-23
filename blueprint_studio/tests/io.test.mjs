import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hashGraph, applyPatch } from '../js/model.js';
import { newDocument } from '../js/store.js';
import { exportDocument, importDocument, diffGraphs, policyExport } from '../js/io.js';

const tpl = name => JSON.parse(readFileSync(new URL(`../templates/${name}.json`, import.meta.url)));
const meta = { name: 'Customer Refund', domain: 'Customer Service' };

test('io: export -> import round-trips and yields the same hash', () => {
  const doc = newDocument(tpl('customer-refund'));
  const text = exportDocument(doc);
  const r = importDocument(text);
  assert.ok(r.ok, JSON.stringify(r.error));
  const graph = r.value.revisions.find(rev => rev.rev === doc.activeRev).graph;
  assert.equal(hashGraph(graph, meta), hashGraph(doc.revisions[0].graph, meta));
});

test('io: malformed import is rejected with a message', () => {
  assert.equal(importDocument('{not json').error.code, 'json_parse');
  assert.equal(importDocument('{"schema":"other"}').error.code, 'schema');
  assert.equal(importDocument('{"schema":"silex.blueprint/v1","revisions":[]}').error.code, 'schema');
  const bad = JSON.parse(readFileSync(new URL('../templates/customer-refund.json', import.meta.url)));
  bad.graph.nodes.push({ id: 'ghost', type: 'nope', config: {} });
  assert.equal(importDocument(JSON.stringify({ schema: 'silex.blueprint/v1', id: 'x', name: 'x', domain: 'x', owner: 'x', activeRev: 0, revisions: [{ rev: 0, graph: bad.graph }] })).error.code, 'bad_graph');
});

test('io: diffGraphs reports added/removed/changed nodes and edges', () => {
  const a = tpl('customer-refund').graph;
  const b = applyPatch(a, [{ op: 'setConfig', id: 'gate', key: 'condition', value: 'dayTotal > 500' }, { op: 'removeEdge', id: 'e9' }, { op: 'addEdge', edge: { id: 'e9b', kind: 'flow', from: { node: 'payment', port: 'out' }, to: { node: 'resolved', port: 'in' } } }]).value;
  const d = diffGraphs(a, b);
  assert.deepEqual(d.addedNodes, []);
  assert.deepEqual(d.removedNodes, []);
  assert.deepEqual(d.removedEdges.map(e => e.id), ['e9']);
  assert.deepEqual(d.addedEdges.map(e => e.id), ['e9b']);
  assert.deepEqual(d.changedNodes, [{ id: 'gate', fields: ['config.condition'] }]);
});

test('io: policyExport lists the revision controls and monitors (number or object)', () => {
  const doc = newDocument(tpl('customer-refund'));
  const rev = doc.revisions[0];
  const text = policyExport(doc, rev.rev);
  assert.ok(text.includes('approval'));
  assert.ok(text.includes('Unauthorized Refund'));
  assert.ok(text.includes('unauthorized_write'));
  assert.ok(policyExport(doc, rev).includes('Customer Refund'));
});
