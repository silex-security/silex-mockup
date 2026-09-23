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
  const x0 = s.active().graph.nodes.find(n => n.id === 'gate').x;
  for (let i = 0; i < 5; i++) s.dispatch({ type: 'patch', ops: [{ op: 'moveNode', id: 'gate', x: x0 + 20 + i, y: 150 }], merge: 'drag:gate' });
  s.dispatch({ type: 'undo' });
  assert.equal(s.active().graph.nodes.find(n => n.id === 'gate').x, x0);
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

/* ---- lifecycle (plan §4.8) with hand-made results; the real engine is exercised by the probes */
import { applyPatch, hashGraph } from '../js/model.js';
function validated() {
  const s = fresh(); s.dispatch({ type: 'confirm' });
  const r = s.active();
  const job = s.startJob('validate:' + r.rev);
  assert.ok(s.dispatch({ type: 'setValidation', rev: r.rev, jobId: job, revHash: r.hash, scenarioSetId: 'S-x-40', n: 40, result: { findings: [{ id: 'f' }], metrics: {}, lint: [], runs: [] } }).ok);
  const patch = [{ op: 'setConfig', id: 'gate', key: 'condition', value: 'dayTotal > 500' }];
  const patchedHash = hashGraph(applyPatch(r.graph, patch).value, s.meta());
  const cand = (id, eligible) => ({ candidate: { id, label: id, kind: 'single', classes: [], params: { x: 500 }, paramsVersion: 1, patch }, runId: 'run-' + id,
    result: { patchedHash, findings: [], metrics: {}, lint: [], runs: [] }, verdict: { eligible, reasons: [], scorecard: {} } });
  const oj = s.startJob('optimize:' + r.rev);
  assert.ok(s.dispatch({ type: 'setOptimization', rev: r.rev, jobId: oj, revHash: r.hash, scenarioSetId: 'S-x-40', candidates: [cand('good', true), cand('bad', false)] }).ok);
  return { s, r, patchedHash };
}

test('late or superseded results are discarded', () => {
  const s = fresh(); s.dispatch({ type: 'confirm' }); const r = s.active();
  const old = s.startJob('validate:0'); const cur = s.startJob('validate:0');
  const res = { findings: [], metrics: {}, lint: [], runs: [] };
  assert.equal(s.dispatch({ type: 'setValidation', rev: 0, jobId: old, revHash: r.hash, scenarioSetId: 'S', n: 1, result: res }).error.code, 'stale_job');
  s.dispatch({ type: 'newRevision' }); s.dispatch({ type: 'setActive', rev: 0 });
  assert.equal(s.dispatch({ type: 'setValidation', rev: 0, jobId: cur, revHash: r.hash, scenarioSetId: 'S', n: 1, result: res }).error.code, 'stale_job', 'switching revisions cancels jobs');
});

test('approve guard: ineligible, stale and rejected candidates are refused', () => {
  const { s } = validated();
  assert.equal(s.dispatch({ type: 'approve', rev: 0, candidateId: 'bad' }).error.code, 'not_approvable');
  const c = s.revision(0).optimization.candidates[0].candidate;
  s.dispatch({ type: 'modify', rev: 0, candidateId: 'good', candidate: { ...c, params: { x: 1000 }, paramsVersion: 2 } });
  assert.equal(s.dispatch({ type: 'approve', rev: 0, candidateId: 'good' }).error.code, 'not_approvable', 'stale after modify');
  const j1 = s.startJob('cand:0:good'), j2 = s.startJob('cand:0:good');
  const r = s.revision(0);
  const msg = { type: 'candidateResult', rev: 0, candidateId: 'good', paramsVersion: 2, scenarioSetId: 'S-x-40', revHash: r.hash, runId: 'r2', result: { patchedHash: 'x' }, verdict: { eligible: true } };
  assert.equal(s.dispatch({ ...msg, jobId: j1 }).error.code, 'stale_job', 'an older rerun finishing late is discarded');
  assert.equal(s.dispatch({ ...msg, paramsVersion: 1, jobId: j2 }).error.code, 'stale_job');
  s.dispatch({ type: 'reject', rev: 0, candidateId: 'good' });
  assert.equal(s.dispatch({ type: 'approve', rev: 0, candidateId: 'good' }).error.code, 'not_approvable');
});

test('approve creates a confirmed child with the tested hash; the parent is decided; register is idempotent', () => {
  const { s, patchedHash } = validated();
  const r = s.dispatch({ type: 'approve', rev: 0, candidateId: 'good' });
  assert.ok(r.ok, JSON.stringify(r.error));
  const child = s.active();
  assert.deepEqual([child.rev, child.parent, child.status, child.origin, child.hash], [1, 0, 'confirmed', 'approve', patchedHash]);
  assert.equal(s.revision(0).decision.childHash, patchedHash);
  const job = s.startJob('validate:0');
  assert.equal(s.dispatch({ type: 'setValidation', rev: 0, jobId: job, revHash: s.revision(0).hash, scenarioSetId: 'S', n: 1, result: {} }).error.code, 'decided');
  assert.equal(s.dispatch({ type: 'register', rev: 0 }).error.code, 'not_registrable');
  const a = s.dispatch({ type: 'register', rev: 1 }), b = s.dispatch({ type: 'register', rev: 1 });
  assert.ok(a.ok && b.ok);
  assert.equal(s.inventory().length, 1);
  assert.match(s.inventory()[0].status, /not deployed/);
});

test('accept as is only without findings', () => {
  const { s } = validated();
  assert.equal(s.dispatch({ type: 'accept', rev: 0 }).error.code, 'has_findings');
  const t = fresh(); t.dispatch({ type: 'confirm' }); const r = t.active(); const j = t.startJob('validate:0');
  t.dispatch({ type: 'setValidation', rev: 0, jobId: j, revHash: r.hash, scenarioSetId: 'S', n: 40, result: { findings: [], metrics: {}, lint: [], runs: [] } });
  assert.ok(t.dispatch({ type: 'accept', rev: 0 }).ok);
  assert.ok(t.dispatch({ type: 'register', rev: 0 }).ok);
});

test('review r2: register refuses a decision without evidence even if it got into the store', () => {
  const s = fresh(); s.dispatch({ type: 'confirm' });
  s.active().decision = { action: 'accept' };            // simulate a document that bypassed import validation
  assert.equal(s.dispatch({ type: 'register', rev: 0 }).error.code, 'bad_evidence');
  assert.equal(s.inventory().length, 0);
});
