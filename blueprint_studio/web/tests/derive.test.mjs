import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStore, newDocument, memoryStorage } from '../../js/store.js';
import { generateScenarioSet } from '../../js/adversary.js';
import { validate, compactResult } from '../../js/validate.js';
import { optimize, reparam } from '../../js/optimize.js';
import { runScenario } from '../../js/engine.js';
import { hashGraph, makeNode } from '../../js/model.js';
import { deriveTrace } from '../src/trace/derive.js';
import { FAMILIES } from '../src/trace/mapping.js';

const slice = JSON.parse(readFileSync(new URL('../../ontology/slice.json', import.meta.url)));
const tpl = name => JSON.parse(readFileSync(new URL(`../../templates/${name}.json`, import.meta.url)));

function confirmValidateOptimize(name, n = 40) {
  const t = tpl(name);
  const s = createStore({ storage: memoryStorage() });
  s.load(newDocument(t));
  assert.ok(s.dispatch({ type: 'confirm' }).ok);
  const r = s.active();
  const set = generateScenarioSet(r.graph, { n, baseHash: r.hash });
  const v = validate(r.graph, set);
  assert.ok(s.dispatch({ type: 'setValidation', rev: r.rev, jobId: s.startJob('validate:' + r.rev), revHash: r.hash, scenarioSetId: set.id, n, result: compactResult(v) }).ok);
  const opt = optimize(r.graph, { ...v, scenarioSetId: set.id }, set, s.meta());
  const candidates = opt.candidates.map((c, i) => ({ candidate: c.candidate, runId: 'run-' + (i + 1), result: compactResult(c.result), verdict: c.verdict }));
  assert.ok(s.dispatch({ type: 'setOptimization', rev: r.rev, jobId: s.startJob('optimize:' + r.rev), revHash: r.hash, scenarioSetId: set.id, candidates }).ok);
  return { s, rev: r.rev };
}

test('derive: Customer Refund funnel equals the engine numbers', () => {
  const { s, rev } = confirmValidateOptimize('customer-refund');
  const trace = deriveTrace({ doc: s.doc, revNo: rev, slice, meta: s.meta() });
  const f = trace.funnel;
  assert.equal(f.steps, 14);
  assert.equal(f.mapped, 10);
  assert.equal(f.unmapped, 4);
  assert.equal(f.classes, 4);
  assert.equal(f.associated, 48);
  assert.equal(f.relatedInstantiated, 4);
  assert.equal(f.withoutRelatedFamily, 44);
  assert.equal(f.relatedOutside, 2);
  assert.equal(f.paths, 7);
  assert.equal(f.runs, 240);
  assert.deepEqual(f.adversarial, { num: 200, den: 200 });
  assert.deepEqual(f.benign, { num: 16, den: 40 });
  assert.equal(f.findings, 6);
  assert.equal(f.candidates, 16);
  assert.equal(f.tested, 16);
  assert.equal(f.eligible, 2);
  assert.equal(f.ineligible, 14);
  assert.equal(trace.stamp.ontologyVersion, 'swm-1.0');
  assert.equal(trace.binding.kind, 'evaluated');
});

test('derive: per-family runs come from result.runs (never a constant)', () => {
  const { s, rev } = confirmValidateOptimize('customer-refund');
  const trace = deriveTrace({ doc: s.doc, revNo: rev, slice, meta: s.meta() });
  assert.equal(trace.laws.families.length, 6);
  for (const fam of trace.laws.families) assert.equal(fam.runs, 40, fam.id);
  assert.equal(trace.laws.families.find(f => f.id === 'below_threshold').violatingRuns, 40);
  assert.equal(trace.laws.families.find(f => f.id === 'benign').violatingRuns, 16);
});

test('derive: Vendor Bank Change and RAG Support Agent funnel numbers', () => {
  const a = confirmValidateOptimize('vendor-bank-change');
  const ta = deriveTrace({ doc: a.s.doc, revNo: a.rev, slice, meta: a.s.meta() });
  assert.equal(ta.funnel.candidates, 9);
  assert.equal(ta.funnel.eligible, 2);
  assert.equal(ta.recommended, 'threshold:amount:0+binding');

  const b = confirmValidateOptimize('ai-rag-support-agent');
  const tb = deriveTrace({ doc: b.s.doc, revNo: b.rev, slice, meta: b.s.meta() });
  assert.equal(tb.funnel.candidates, 15);
  assert.equal(tb.funnel.eligible, 2);
});

test('derive: statement lists residual findings and never says "no violations" while one remains', () => {
  const { s, rev } = confirmValidateOptimize('sales-lead-enrichment');
  const o = s.revision(rev).optimization;
  const injA = o.candidates.find(c => c.candidate.id === 'inj:a');
  assert.ok(injA && injA.verdict.eligible, 'inj:a is an eligible candidate');
  assert.ok((injA.result.findings || []).some(f => f.violating > 0), 'inj:a leaves a residual finding');
  assert.ok(s.dispatch({ type: 'approve', rev, candidateId: 'inj:a', at: '2026-09-24T00:00:00Z' }).ok);
  const trace = deriveTrace({ doc: s.doc, revNo: rev, slice, meta: s.meta() });
  assert.ok(trace.statement);
  assert.ok(trace.statement.violationsFound.some(v => v.finding === 'dup:duplicate_submit'), JSON.stringify(trace.statement.violationsFound));
  assert.ok(!/no violations/i.test(trace.statement.text), trace.statement.text);
  assert.ok(trace.statement.zeroViolations.length > 0, 'the closed monitor is listed as zero');
});

test('derive: candidate states under modify, reject and approve', () => {
  const { s, rev } = confirmValidateOptimize('customer-refund');
  let trace = deriveTrace({ doc: s.doc, revNo: rev, slice, meta: s.meta() });
  assert.equal(trace.candidates.length, 16);
  assert.ok(trace.candidates.every(c => c.state === 'eligible' || c.state === 'ineligible'));

  const target = trace.candidates.find(c => c.state === 'eligible');
  const o = s.revision(rev).optimization;
  const c = o.candidates.find(x => x.candidate.id === target.id);
  const next = reparam(s.revision(rev).graph, { ...s.revision(rev).validation.result, scenarioSetId: s.revision(rev).validation.scenarioSetId }, c.candidate, { threshold: { field: 'amount', x: 12345 } });
  assert.ok(s.dispatch({ type: 'modify', rev, candidateId: target.id, candidate: next }).ok);
  trace = deriveTrace({ doc: s.doc, revNo: rev, slice, meta: s.meta() });
  assert.equal(trace.candidates.find(x => x.id === target.id).state, 'stale');
  assert.equal(trace.funnel.tested, 15);

  const other = trace.candidates.find(x => x.state === 'eligible' || x.state === 'ineligible');
  assert.ok(s.dispatch({ type: 'reject', rev, candidateId: other.id }).ok);
  trace = deriveTrace({ doc: s.doc, revNo: rev, slice, meta: s.meta() });
  assert.equal(trace.candidates.find(x => x.id === other.id).state, 'rejected');
  assert.equal(trace.candidates.find(x => x.id === other.id).closes.length, 0);

  const toApprove = trace.candidates.find(x => x.state === 'eligible');
  assert.ok(s.dispatch({ type: 'approve', rev, candidateId: toApprove.id, at: 'x' }).ok);
  trace = deriveTrace({ doc: s.doc, revNo: rev, slice, meta: s.meta() });
  assert.equal(trace.candidates.find(x => x.id === toApprove.id).state, 'approved');
  assert.equal(trace.decision.action, 'approve');
  assert.equal(trace.decision.candidateId, toApprove.id);
});

test('derive: approved child binding labels numbers as the parent candidate run', () => {
  const { s, rev } = confirmValidateOptimize('customer-refund');
  const trace0 = deriveTrace({ doc: s.doc, revNo: rev, slice, meta: s.meta() });
  const target = trace0.candidates.find(c => c.state === 'eligible');
  assert.ok(s.dispatch({ type: 'approve', rev, candidateId: target.id, at: 'x' }).ok);
  const childRev = s.active().rev;
  const child = deriveTrace({ doc: s.doc, revNo: childRev, slice, meta: s.meta() });
  assert.equal(child.binding.kind, 'approvedChild');
  assert.equal(child.binding.parent.revLabel, 'v1.0');
  assert.equal(child.stage.decided, true);
  assert.equal(child.stage.optimized, false);
  assert.ok(child.statement, 'the child has a statement');
  assert.equal(child.statement.generatedFrom, 'the candidate run on v1.0');
});

test('derive: no forbidden words appear in any string', () => {
  const { s, rev } = confirmValidateOptimize('customer-refund');
  const trace0 = deriveTrace({ doc: s.doc, revNo: rev, slice, meta: s.meta() });
  const target = trace0.candidates.find(c => c.state === 'eligible');
  assert.ok(s.dispatch({ type: 'approve', rev, candidateId: target.id, at: 'x' }).ok);
  const full = deriveTrace({ doc: s.doc, revNo: rev, slice, meta: s.meta() });
  const json = JSON.stringify(full).toLowerCase();
  for (const w of ['safe', 'secure', 'verified', 'certified', 'observed', 'latent', 'world model fit']) {
    assert.ok(!json.includes(w), `forbidden word "${w}" present`);
  }
});

test('derive: attribution with two tools sharing one capability (only one watched)', () => {
  const graph = {
    nodes: [
      makeNode('trigger', 'tr', { config: { channel: 'support_chat', trust: 'untrusted' } }),
      makeNode('agent', 'ag', { config: { candidate: 'Agent', capabilities: [{ cap: 'shared.cap', limit: 5000 }], canSplit: false } }),
      makeNode('tool', 'toolA', { config: { cap: 'shared.cap', sideEffect: 'write', idempotencyKey: false } }),
      makeNode('tool', 'toolB', { config: { cap: 'shared.cap', sideEffect: 'write', idempotencyKey: false } }),
      makeNode('outcome', 'done', { config: { success: true, external: true } }),
      { id: 'unauth', type: 'prohibited', label: 'Unauthorized Shared Write', config: { monitor: 'unauthorized_write', cap: 'shared.cap', threshold: 500, scope: 'request', minApprovers: 1, probeRange: [500, 2000], severity: 'critical', watches: ['toolA'] } },
    ],
    edges: [
      { id: 'e1', kind: 'flow', from: { node: 'tr', port: 'out' }, to: { node: 'ag', port: 'in' } },
      { id: 'e2', kind: 'flow', from: { node: 'ag', port: 'out' }, to: { node: 'toolA', port: 'in' } },
      { id: 'e3', kind: 'flow', from: { node: 'toolA', port: 'out' }, to: { node: 'toolB', port: 'in' } },
      { id: 'e4', kind: 'flow', from: { node: 'toolB', port: 'out' }, to: { node: 'done', port: 'in' } },
    ],
  };
  const s = createStore({ storage: memoryStorage() });
  s.load(newDocument({ id: 'bp-fixture-two-tools', name: 'Two Tools', domain: 'Test', owner: 'T', graph }));
  assert.ok(s.dispatch({ type: 'confirm' }).ok);
  const r = s.active();
  const set = generateScenarioSet(r.graph, { n: 20, baseHash: r.hash });
  assert.ok(s.dispatch({ type: 'setValidation', rev: r.rev, jobId: s.startJob('validate:' + r.rev), revHash: r.hash, scenarioSetId: set.id, n: 20, result: compactResult(validate(r.graph, set)) }).ok);
  const trace = deriveTrace({ doc: s.doc, revNo: r.rev, slice, meta: s.meta() });
  const f = trace.simulation.findings.find(x => x.monitor === 'unauthorized_write');
  assert.ok(f);
  assert.deepEqual([...f.attributed].sort(), ['toolA', 'toolB']);
  assert.deepEqual(f.declaredWatch, ['toolA']);
  assert.equal(f.attributionDiffers, true);
});

test('derive: exposure at an unwatched external outcome is attributed from the evidence', () => {
  const graph = {
    nodes: [
      makeNode('trigger', 'tr', { config: { channel: 'support_chat', trust: 'untrusted' } }),
      makeNode('agent', 'ag', { config: { candidate: 'Agent', capabilities: [{ cap: 'write.cap', limit: 5000 }], canSplit: false } }),
      makeNode('decision', 'gate', { config: { condition: 'amount > 1000' } }),
      makeNode('tool', 'tool', { config: { cap: 'write.cap', sideEffect: 'write', idempotencyKey: false } }),
      makeNode('outcome', 'out1', { config: { success: true, external: true } }),
      makeNode('outcome', 'out2', { config: { success: false, external: true } }),
      makeNode('data', 'secret', { config: { sensitivity: 'secret' } }),
      { id: 'exposure', type: 'prohibited', label: 'Secret Exposure', config: { monitor: 'secret_exposure', severity: 'high', watches: ['out1'] } },
    ],
    edges: [
      { id: 'e1', kind: 'flow', from: { node: 'tr', port: 'out' }, to: { node: 'ag', port: 'in' } },
      { id: 'e2', kind: 'flow', from: { node: 'ag', port: 'out' }, to: { node: 'gate', port: 'in' } },
      { id: 'e3', kind: 'flow', from: { node: 'gate', port: 'true' }, to: { node: 'tool', port: 'in' } },
      { id: 'e4', kind: 'flow', from: { node: 'gate', port: 'false' }, to: { node: 'out2', port: 'in' } },
      { id: 'e5', kind: 'flow', from: { node: 'tool', port: 'out' }, to: { node: 'out1', port: 'in' } },
      { id: 'a1', kind: 'access', mode: 'read', from: { node: 'ag', port: 'acc' }, to: { node: 'secret', port: 'acc' } },
    ],
  };
  const s = createStore({ storage: memoryStorage() });
  s.load(newDocument({ id: 'bp-fixture-exposure', name: 'Exposure', domain: 'Test', owner: 'T', graph }));
  assert.ok(s.dispatch({ type: 'confirm' }).ok);
  const r = s.active();
  const set = generateScenarioSet(r.graph, { n: 20, baseHash: r.hash });
  assert.ok(s.dispatch({ type: 'setValidation', rev: r.rev, jobId: s.startJob('validate:' + r.rev), revHash: r.hash, scenarioSetId: set.id, n: 20, result: compactResult(validate(r.graph, set)) }).ok);
  const trace = deriveTrace({ doc: s.doc, revNo: r.rev, slice, meta: s.meta() });
  const f = trace.simulation.findings.find(x => x.id === 'exposure:injection_exfil');
  assert.ok(f, 'an exposure finding exists');
  assert.deepEqual(f.attributed, ['out2']);
  assert.deepEqual(f.declaredWatch, ['out1']);
  assert.equal(f.attributionDiffers, true);
});

test('derive: split sampling text is accurate at the cap of 10', () => {
  const text = FAMILIES.find(f => f.id === 'split').sampling;
  assert.ok(text.includes('capped at 10'));
  assert.ok(text.includes('guarantees neither an approval bypass nor a violation'));
  assert.ok(!/each under the per-piece/i.test(text));

  const graph = {
    nodes: [
      makeNode('trigger', 'tr', { config: { channel: 'support_chat', trust: 'untrusted' } }),
      makeNode('agent', 'ag', { config: { candidate: 'Agent', capabilities: [{ cap: 'w.cap', limit: 10000 }], canSplit: true } }),
      makeNode('tool', 'tool', { config: { cap: 'w.cap', sideEffect: 'write', idempotencyKey: false } }),
      makeNode('outcome', 'done', { config: { success: true, external: true } }),
      { id: 'unauth', type: 'prohibited', label: 'Unauthorized', config: { monitor: 'unauthorized_write', cap: 'w.cap', threshold: 100, scope: 'request', minApprovers: 1, probeRange: [100, 1000], severity: 'critical', watches: ['tool'] } },
    ],
    edges: [
      { id: 'e1', kind: 'flow', from: { node: 'tr', port: 'out' }, to: { node: 'ag', port: 'in' } },
      { id: 'e2', kind: 'flow', from: { node: 'ag', port: 'out' }, to: { node: 'tool', port: 'in' } },
      { id: 'e3', kind: 'flow', from: { node: 'tool', port: 'out' }, to: { node: 'done', port: 'in' } },
    ],
  };
  const set = generateScenarioSet(graph, { n: 20, baseHash: hashGraph(graph, { name: 'x', domain: 'y' }) });
  const splits = set.scenarios.filter(sc => sc.template === 'split');
  assert.equal(splits.length, 20);
  assert.ok(splits.some(sc => runScenario(graph, sc).ledger.writes.length === 10), 'k reaches the cap of 10');
});
