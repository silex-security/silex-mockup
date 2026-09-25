/* Generates storage.sample.json: real bs.doc.*, bs.reg.* and bs.summary.v1 values
   produced by the Blueprint Studio store and engine (cutover plan §4, slice 1).
   Run from the repo root: node tests/site/fixtures/make-storage-fixture.mjs */
import { readFileSync, writeFileSync } from 'node:fs';
const B = new URL('../../../blueprint_studio/', import.meta.url);
const { createStore, newDocument, memoryStorage } = await import(new URL('js/store.js', B));
const { generateScenarioSet } = await import(new URL('js/adversary.js', B));
const { validate, compactResult } = await import(new URL('js/validate.js', B));
const { optimize } = await import(new URL('js/optimize.js', B));
const { buildSummary } = await import(new URL('web/src/state/summary.js', B));
const tpl = name => JSON.parse(readFileSync(new URL(`templates/${name}.json`, B)));

const storage = memoryStorage();
function run(s, n = 40) {
  const r = s.active(), set = generateScenarioSet(r.graph, { n, baseHash: r.hash });
  const v = validate(r.graph, set);
  if (!s.dispatch({ type: 'setValidation', rev: r.rev, jobId: s.startJob('validate:' + r.rev), revHash: r.hash, scenarioSetId: set.id, n, result: compactResult(v) }).ok) throw new Error('validate');
  return { r, set, v };
}
function optimizeRev(s, { r, set, v }) {
  const opt = optimize(r.graph, { ...v, scenarioSetId: set.id }, set, s.meta());
  const candidates = opt.candidates.map((c, i) => ({ candidate: c.candidate, runId: 'run-' + (i + 1), result: compactResult(c.result), verdict: c.verdict }));
  if (!s.dispatch({ type: 'setOptimization', rev: r.rev, jobId: s.startJob('optimize:' + r.rev), revHash: r.hash, scenarioSetId: set.id, candidates }).ok) throw new Error('optimize');
  return opt;
}
// 1: awaiting approval (Customer Refund)
const a = createStore({ storage });
a.load(newDocument({ ...tpl('customer-refund'), id: 'bp-fixture-awaiting' }));
a.dispatch({ type: 'confirm' }); optimizeRev(a, run(a));
// 2: a NON-recommended eligible candidate approved, child registered (Vendor Bank Change)
const b = createStore({ storage });
b.load(newDocument({ ...tpl('vendor-bank-change'), id: 'bp-fixture-approved' }));
b.dispatch({ type: 'confirm' }); const ob = optimizeRev(b, run(b));
const elig = b.active().optimization.candidates.filter(c => c.verdict.eligible).map(c => c.candidate.id);
const pickId = elig.find(id => id !== ob.recommended) || elig[0];
if (!b.dispatch({ type: 'approve', rev: 0, candidateId: pickId, at: '2026-09-24T10:00:00.000Z' }).ok) throw new Error('approve');
if (!b.dispatch({ type: 'register', rev: b.active().rev, at: '2026-09-24T10:05:00.000Z' }).ok) throw new Error('register');
// 3: awaiting acceptance (no monitors → zero findings), with a label that must render as text
const c = createStore({ storage });
const t3 = tpl('customer-refund');
c.load(newDocument({ ...t3, id: 'bp-fixture-accept', name: '<img src=x onerror=alert(1)> Refund', graph: { ...t3.graph, nodes: t3.graph.nodes.filter(n => n.type !== 'prohibited') } }));
c.dispatch({ type: 'confirm' }); run(c, 10);

const out = {};
for (const k of storage.keys().sort()) if (k.startsWith('bs.doc.') || k.startsWith('bs.reg.')) out[k] = storage.getItem(k);
out['bs.summary.v1'] = JSON.stringify(buildSummary(storage, '2026-09-24T10:10:00.000Z'));
writeFileSync(new URL('storage.sample.json', import.meta.url), JSON.stringify(out, null, 1));
const sum = JSON.parse(out['bs.summary.v1']);
console.log(sum.docs.map(d => `${d.docId}: ` + d.revs.map(r => `${r.label} ${r.status}/${r.origin} awaiting=${r.awaiting} rec=${r.recommended?.id || '-'} dec=${r.decision?.action || '-'}:${r.decision?.candidateId || ''}`).join(' | ')).join('\n'));
console.log('approved non-recommended:', pickId !== ob.recommended, pickId, 'vs', ob.recommended);
