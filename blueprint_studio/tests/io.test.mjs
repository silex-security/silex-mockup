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
  assert.equal(importDocument(JSON.stringify({ schema: 'silex.blueprint/v1', id: 'x', name: 'x', domain: 'x', owner: 'x', activeRev: 0, revisions: [{ rev: 0, parent: null, status: 'draft', origin: 'edit', hash: null, graph: bad.graph }] })).error.code, 'bad_graph');
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

test('review r1: import rejects bad activeRev, bad config types and a tampered confirmed graph', async () => {
  const { createStore, newDocument, memoryStorage } = await import('../js/store.js');
  const st = createStore({ storage: memoryStorage() }); st.load(newDocument(tpl('customer-refund'))); st.dispatch({ type: 'confirm' });
  const good = JSON.parse(exportDocument(st.doc));
  assert.ok(importDocument(JSON.stringify(good)).ok);
  assert.equal(importDocument(JSON.stringify({ ...good, activeRev: 999 })).error.code, 'schema');
  const badCaps = JSON.parse(JSON.stringify(good)); badCaps.revisions[0].graph.nodes.find(n => n.id === 'execution').config.capabilities = 'all';
  assert.equal(importDocument(JSON.stringify(badCaps)).ok, false);
  const tampered = JSON.parse(JSON.stringify(good)); tampered.revisions[0].graph.nodes.find(n => n.id === 'gate').config.condition = 'amount > 99999';
  assert.equal(importDocument(JSON.stringify(tampered)).error.code, 'hash_mismatch');
});

test('review r2: import rejects missing applicable config, prototype node types, and incomplete lifecycle evidence', async () => {
  const { createStore, newDocument, memoryStorage } = await import('../js/store.js');
  const st = createStore({ storage: memoryStorage() }); st.load(newDocument(tpl('customer-refund')));
  const draft = JSON.parse(exportDocument(st.doc));
  const noKind = JSON.parse(JSON.stringify(draft)); delete noKind.revisions[0].graph.nodes.find(n => n.id === 'approval').config.kind;
  assert.equal(importDocument(JSON.stringify(noKind)).ok, false);
  const proto = JSON.parse(JSON.stringify(draft)); proto.revisions[0].graph.nodes[0].type = '__proto__';
  const pr = importDocument(JSON.stringify(proto)); assert.equal(pr.ok, false); assert.equal(pr.error.code, 'bad_graph');
  st.dispatch({ type: 'confirm' });
  const conf = JSON.parse(exportDocument(st.doc));
  const bareValidation = JSON.parse(JSON.stringify(conf)); bareValidation.revisions[0].validation = { revHash: conf.revisions[0].hash };
  assert.equal(importDocument(JSON.stringify(bareValidation)).error.code, 'bad_evidence');
  const bareAccept = JSON.parse(JSON.stringify(conf)); bareAccept.revisions[0].decision = { action: 'accept' };
  assert.equal(importDocument(JSON.stringify(bareAccept)).error.code, 'bad_evidence');
});

/* ---- review r3: a genuinely approved document, then targeted tampering ---- */
async function approvedDoc() {
  const { createStore, newDocument, memoryStorage } = await import('../js/store.js');
  const { generateScenarioSet } = await import('../js/adversary.js');
  const V = await import('../js/validate.js');
  const O = await import('../js/optimize.js');
  const st = createStore({ storage: memoryStorage(), lint: V.lint });
  st.load(newDocument(tpl('customer-refund'))); st.dispatch({ type: 'confirm' });
  const r = st.active(), set = generateScenarioSet(r.graph, { n: 20, baseHash: r.hash });
  const vres = V.compactResult(V.validate(r.graph, set));
  st.dispatch({ type: 'setValidation', rev: 0, jobId: st.startJob('validate:0'), revHash: r.hash, scenarioSetId: set.id, n: 20, result: vres });
  let k = 0;
  const cands = O.generateCandidates(r.graph, { ...vres, scenarioSetId: set.id }).map(c => {
    const run = O.runCandidate(r.graph, c, set, st.meta());
    return { candidate: c, runId: 'run-' + (++k), result: V.compactResult(run.value), verdict: O.score(vres, run.value) };
  });
  st.dispatch({ type: 'setOptimization', rev: 0, jobId: st.startJob('optimize:0'), revHash: r.hash, scenarioSetId: set.id, candidates: cands });
  const rec = O.recommend(st.revision(0).optimization.candidates.map(c => ({ candidate: c.candidate, result: c.result, verdict: c.verdict })), new Set());
  assert.ok(st.dispatch({ type: 'approve', rev: 0, candidateId: rec }).ok);
  return { st, text: exportDocument(st.doc), rec };
}

test('review r3: a genuine approved document imports and registers; each tampering is rejected by import and by register', async () => {
  const { createStore, memoryStorage } = await import('../js/store.js');
  const { lint } = await import('../js/validate.js');
  const { text, rec } = await approvedDoc();
  assert.ok(importDocument(text).ok, JSON.stringify(importDocument(text).error));
  const tamper = [
    d => { d.revisions[0].optimization.candidates.find(c => c.candidate.id === rec).state = 'rejected'; },
    d => { d.revisions[0].optimization.candidates.find(c => c.candidate.id === rec).verdict.eligible = false; },
    d => { d.revisions[0].decision.runId = 'run-nope'; },
    d => { d.revisions[0].decision.evidence.metrics.friction = { num: 999, den: 1 }; },
    d => { d.revisions[0].validation.result.metrics = {}; },
    d => { d.revisions[1].validation.result.metrics.friction = { num: 0, den: 1 }; },
    d => { d.revisions[0].optimization.candidates[0].result.metrics.friction = { num: 1, den: 1 }; }
  ];
  for (const [i, t] of tamper.entries()) {
    const d = JSON.parse(text); t(d);
    const r = importDocument(JSON.stringify(d));
    assert.equal(r.ok, false, 'import accepted tampering #' + i);
    if (i <= 5) {                                              // register re-checks without import's re-run
      const st = createStore({ storage: memoryStorage(), lint }); st.load(d);
      assert.equal(st.dispatch({ type: 'register', rev: 1 }).ok, false, 'register accepted tampering #' + i);
    }
  }
});

test('review r4: malformed candidate params / paramOptions are rejected as a Result, never thrown', async () => {
  const { text, rec } = await approvedDoc();
  const other = JSON.parse(text).revisions[0].optimization.candidates.find(c => c.candidate.id !== rec && Object.keys(c.candidate.paramOptions).length).candidate.id;
  for (const t of [
    d => { d.revisions[0].optimization.candidates.find(c => c.candidate.id === other).candidate.params = { threshold: null }; },
    d => { d.revisions[0].optimization.candidates.find(c => c.candidate.id === other).candidate.paramOptions = { threshold: 7 }; },
    d => { d.revisions[0].optimization.candidates.find(c => c.candidate.id === other).candidate.label = 'totally safe'; },
    d => { d.revisions[0].optimization.candidates.find(c => c.candidate.id === other).candidate.params = { threshold: { field: 'amount', x: 12345 } }; }
  ]) {
    const d = JSON.parse(text); t(d);
    let r; assert.doesNotThrow(() => { r = importDocument(JSON.stringify(d)); });
    assert.equal(r.ok, false);
  }
});

test('review r4: a legitimately modified candidate (paramsVersion 2, new params, re-run) still imports', async () => {
  const { createStore, newDocument, memoryStorage } = await import('../js/store.js');
  const { generateScenarioSet } = await import('../js/adversary.js');
  const V = await import('../js/validate.js'); const O = await import('../js/optimize.js');
  const st = createStore({ storage: memoryStorage(), lint: V.lint });
  st.load(newDocument(tpl('customer-refund'))); st.dispatch({ type: 'confirm' });
  const r = st.active(), set = generateScenarioSet(r.graph, { n: 20, baseHash: r.hash });
  const vres = V.compactResult(V.validate(r.graph, set));
  st.dispatch({ type: 'setValidation', rev: 0, jobId: st.startJob('validate:0'), revHash: r.hash, scenarioSetId: set.id, n: 20, result: vres });
  const cands = O.generateCandidates(r.graph, { ...vres, scenarioSetId: set.id }).map((c, i) => { const run = O.runCandidate(r.graph, c, set, st.meta()); return { candidate: c, runId: 'run-' + i, result: V.compactResult(run.value), verdict: O.score(vres, run.value) }; });
  st.dispatch({ type: 'setOptimization', rev: 0, jobId: st.startJob('optimize:0'), revHash: r.hash, scenarioSetId: set.id, candidates: cands });
  const c = st.revision(0).optimization.candidates.find(x => Object.keys(x.candidate.paramOptions).includes('threshold')).candidate;
  const alt = c.paramOptions.threshold.find(o => JSON.stringify(o) !== JSON.stringify(c.params.threshold));
  const next = O.reparam(r.graph, { ...vres, scenarioSetId: set.id }, c, { ...c.params, threshold: alt });
  st.dispatch({ type: 'modify', rev: 0, candidateId: c.id, candidate: next });
  const run = O.runCandidate(r.graph, next, set, st.meta());
  assert.ok(st.dispatch({ type: 'candidateResult', rev: 0, candidateId: c.id, jobId: st.startJob('cand:0:' + c.id), paramsVersion: 2, scenarioSetId: set.id, revHash: r.hash, runId: 'run-m', result: V.compactResult(run.value), verdict: O.score(vres, run.value) }).ok);
  const imp = importDocument(exportDocument(st.doc));
  assert.ok(imp.ok, JSON.stringify(imp.error));
});
