import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStore, newDocument, memoryStorage } from '../js/store.js';

const tpl = JSON.parse(readFileSync(new URL('../templates/customer-refund.json', import.meta.url)));
const fresh = (opts = {}) => { const s = createStore({ storage: memoryStorage(), ...opts }); s.load(newDocument(tpl)); return s; };

test('patch, undo, redo round-trip to identical hashes', () => {
  const s = fresh();
  const h0 = s.hashOf(s.active());
  assert.ok(s.dispatch({ type: 'patch', ops: [{ op: 'setConfig', id: 'gate', key: 'condition', value: 'amount > 500' }] }).ok);
  assert.ok(s.dispatch({ type: 'patch', ops: [{ op: 'removeNode', id: 'dup' }] }).ok);
  const h2 = s.hashOf(s.active());
  s.dispatch({ type: 'undo' }); s.dispatch({ type: 'undo' });
  assert.equal(s.hashOf(s.active()), h0);
  s.dispatch({ type: 'redo' }); s.dispatch({ type: 'redo' });
  assert.equal(s.hashOf(s.active()), h2);
});

test('drag moves merge into one undo entry', () => {
  const s = fresh();
  for (let i = 0; i < 5; i++) s.dispatch({ type: 'patch', ops: [{ op: 'moveNode', id: 'gate', x: 700 + i, y: 150 }], merge: 'drag:gate' });
  s.dispatch({ type: 'undo' });
  assert.equal(s.active().graph.nodes.find(n => n.id === 'gate').x, 680);
});

test('confirm locks every mutation route; new revision is monotonic and keeps the parent', () => {
  const s = fresh();
  assert.ok(s.dispatch({ type: 'confirm' }).ok);
  const v0 = s.active(); const h = v0.hash;
  for (const cmd of [{ type: 'patch', ops: [{ op: 'moveNode', id: 'gate', x: 1, y: 1 }] }, { type: 'undo' }, { type: 'redo' }, { type: 'confirm' }, { type: 'rename', name: 'x' }])
    assert.equal(s.dispatch(cmd).error.code, 'locked', cmd.type);
  assert.equal(s.hashOf(v0), h);
  const r1 = s.dispatch({ type: 'newRevision' }).value;
  assert.deepEqual([r1.rev, r1.parent, r1.status], [1, 0, 'draft']);
  assert.equal(s.dispatch({ type: 'newRevision' }).value.rev, 1, 'at most one draft: reopens it');
  s.dispatch({ type: 'confirm' });
  s.dispatch({ type: 'setActive', rev: 0 });
  assert.equal(s.dispatch({ type: 'newRevision', from: 0 }).value.rev, 2, 'numbers are never reused');
  assert.equal(s.revision(0).hash, h);
});

test('confirm is refused while lint reports errors', () => {
  const s = fresh({ lint: () => [{ severity: 'error', code: 'cycle', message: 'x' }] });
  assert.equal(s.dispatch({ type: 'confirm' }).error.code, 'lint_errors');
  assert.equal(s.active().status, 'draft');
});

test('autosave and restore', () => {
  const storage = memoryStorage();
  const a = createStore({ storage }); a.load(newDocument(tpl));
  a.dispatch({ type: 'patch', ops: [{ op: 'setLabel', id: 'gate', label: 'Changed' }] });
  const b = createStore({ storage });
  assert.ok(b.restore());
  assert.equal(b.active().graph.nodes.find(n => n.id === 'gate').label, 'Changed');
});
