/* Canvas direction is view state (plan §3.12): a setDirection op, checked on
   import, carried through export/import, and outside the semantic hash. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hashGraph, applyPatch } from '../js/model.js';
import { newDocument } from '../js/store.js';
import { exportDocument, importDocument, checkGraph } from '../js/io.js';

const tpl = name => JSON.parse(readFileSync(new URL(`../templates/${name}.json`, import.meta.url)));

test('direction: setDirection sets LR/TB and refuses anything else', () => {
  const g = tpl('customer-refund').graph;
  assert.equal(applyPatch(g, [{ op: 'setDirection', direction: 'LR' }]).value.direction, 'LR');
  assert.equal(applyPatch({ ...g, direction: 'LR' }, [{ op: 'setDirection', direction: 'TB' }]).value.direction, 'TB');
  for (const bad of ['diagonal', 'lr', undefined, 1]) assert.equal(applyPatch(g, [{ op: 'setDirection', direction: bad }]).error.code, 'bad_op');
  assert.equal(g.direction, undefined, 'applyPatch is pure');
});

test('direction: outside the semantic hash', () => {
  const g = tpl('customer-refund').graph, meta = { name: 'x', domain: 'y' };
  assert.equal(hashGraph({ ...g, direction: 'LR' }, meta), hashGraph({ ...g, direction: 'TB' }, meta));
  assert.equal(hashGraph({ ...g, direction: 'LR' }, meta), hashGraph(g, meta));
});

test('direction: checkGraph accepts absent/LR/TB and rejects other values', () => {
  const g = tpl('customer-refund').graph;
  for (const d of [undefined, 'LR', 'TB']) assert.ok(checkGraph({ ...g, direction: d }, 'v1.0').ok, String(d));
  for (const d of ['diagonal', null, 0]) assert.equal(checkGraph({ ...g, direction: d }, 'v1.0').error.code, 'bad_graph', String(d));
});

test('direction: export -> import keeps it; a bad value fails the import', () => {
  const t = tpl('customer-refund'); t.graph.direction = 'LR';
  const doc = newDocument(t);
  const r = importDocument(exportDocument(doc));
  assert.ok(r.ok, JSON.stringify(r.error));
  assert.equal(r.value.revisions[0].graph.direction, 'LR');
  doc.revisions[0].graph.direction = 'diagonal';
  assert.equal(importDocument(exportDocument(doc)).error.code, 'bad_graph');
});
