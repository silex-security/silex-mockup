import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hashGraph, applyPatch } from '../js/model.js';
import { generateScenarioSet } from '../js/adversary.js';
import { validate } from '../js/validate.js';
import { generateCandidates, runCandidate, score, recommend, optimize, reparam } from '../js/optimize.js';

const tpl = name => JSON.parse(readFileSync(new URL(`../templates/${name}.json`, import.meta.url)));
const meta = { name: 'Customer Refund', domain: 'Customer Service' };
const frac = m => (m.den ? m.num / m.den : 0);

test('optimize: refund recommends a dayTotal>500 composite closing every critical finding', () => {
  const graph = tpl('customer-refund').graph;
  const baseHash = hashGraph(graph, meta);
  const set = generateScenarioSet(graph, { n: 20, baseHash });
  const baseline = validate(graph, set);
  const out = optimize(graph, baseline, set, meta);

  assert.ok(out.recommended, 'a candidate should be recommended');
  assert.ok(out.recommended.startsWith('threshold:dayTotal:500'), out.recommended);
  assert.ok(out.recommended.includes('+binding+idem+inj:a'), out.recommended);

  const rec = out.candidates.find(c => c.candidate.id === out.recommended);
  assert.ok(rec.verdict.eligible, JSON.stringify(rec.verdict.reasons));
  for (const f of rec.result.findings) if (f.severity === 'critical') assert.equal(f.violating, 0, f.id);
  // every finding closed (0 violations), benign completion unchanged
  assert.equal(rec.result.findings.every(f => f.violating === 0), true);
  const bBen = frac(baseline.metrics.benignCompletion), cBen = frac(rec.result.metrics.benignCompletion);
  assert.ok(Math.abs(bBen - cBen) < 0.02, `benign ${bBen} -> ${cBen}`);

  // the recommended composite's patch, applied, produces the tested hash
  const patched = applyPatch(graph, rec.candidate.patch);
  assert.ok(patched.ok);
  assert.equal(hashGraph(patched.value, meta), rec.result.patchedHash);
});

test('optimize: recommendation rule prefers fewest ops among equal-friction composites', () => {
  const graph = tpl('customer-refund').graph;
  const baseHash = hashGraph(graph, meta);
  const set = generateScenarioSet(graph, { n: 12, baseHash });
  const baseline = validate(graph, set);
  const out = optimize(graph, baseline, set, meta);
  // every eligible composite uses dayTotal:500; variant a (1 op) beats variant b (gate + edges)
  assert.ok(out.recommended.includes('inj:a'));
  const a = out.candidates.find(c => c.candidate.id === out.recommended);
  const b = out.candidates.find(c => c.candidate.id === out.recommended.replace('inj:a', 'inj:b'));
  assert.ok(a.verdict.eligible);
  assert.ok(b.verdict.eligible, JSON.stringify(b.verdict.reasons));
  assert.ok(a.verdict.scorecard.patchOps < b.verdict.scorecard.patchOps);
});

test('optimize: no-findings baseline -> no candidates (accept-as-is)', () => {
  const graph = tpl('customer-refund').graph;
  const baseHash = hashGraph(graph, meta);
  const set = generateScenarioSet(graph, { n: 12, baseHash });
  const baseline = validate(graph, set);
  // apply the recommended composite, then validate: no findings remain
  const out0 = optimize(graph, baseline, set, meta);
  const recPatch = out0.candidates.find(c => c.candidate.id === out0.recommended).candidate.patch;
  const fixed = applyPatch(graph, recPatch).value;
  const fixedHash = hashGraph(fixed, meta);
  const set2 = generateScenarioSet(fixed, { n: 12, baseHash: fixedHash });
  const clean = validate(fixed, set2);
  assert.equal(clean.findings.length, 0, clean.findings.map(f => f.id).join(','));
  const out2 = optimize(fixed, clean, set2, meta);
  assert.equal(out2.candidates.length, 0);
  assert.equal(out2.recommended, null);
});

test('optimize: score gates reject each constructed failure', () => {
  const graph = tpl('customer-refund').graph;
  const set = generateScenarioSet(graph, { n: 8, baseHash: hashGraph(graph, meta) });
  const baseline = validate(graph, set);
  const baseResult = { lint: [], potential: [], runs: [], findings: baseline.findings, metrics: baseline.metrics, patchOps: 0 };

  // lint gate
  const lintFail = { ...baseResult, lint: [{ severity: 'error', code: 'dangling_port', message: 'x' }] };
  assert.equal(score(baseline, lintFail).eligible, false);
  assert.ok(score(baseline, lintFail).reasons.some(r => r.includes('lint')));

  // benign completion gate
  const benFail = { ...baseResult, metrics: { ...baseline.metrics, benignCompletion: { num: 0, den: baseline.metrics.benignCompletion.den } } };
  assert.equal(score(baseline, benFail).eligible, false);

  // violation increase gate: a critical finding that got worse
  const incFinding = baseline.findings.find(f => f.severity === 'critical');
  const inc = { ...baseResult, findings: [{ ...incFinding, violating: incFinding.violating + 1 }] };
  assert.equal(score(baseline, inc).eligible, false);

  // critical-at-0 gate: a critical finding still open
  const still = { ...baseResult, findings: [{ ...incFinding, violating: 1 }] };
  assert.equal(score(baseline, still).eligible, false);
});

test('optimize: recommend returns null when nothing is eligible or all rejected', () => {
  const cand = { id: 'c1', label: 'c', kind: 'composite', classes: [], params: {}, paramsVersion: 1, patch: [] };
  const scored = [{ candidate: cand, result: {}, verdict: { eligible: false, reasons: ['lint'], scorecard: {} } }];
  assert.equal(recommend(scored, new Set()), null);
  const eligible = [{ candidate: cand, result: {}, verdict: { eligible: true, reasons: [], scorecard: { friction: { num: 0, den: 1 }, addedLatencyMedian: 0, patchOps: 1 } } }];
  assert.equal(recommend(eligible, new Set([cand.id])), null);
  assert.equal(recommend(eligible, new Set()), cand.id);
});

test('optimize: reparam bumps paramsVersion and changes the scorecard', () => {
  const graph = tpl('customer-refund').graph;
  const set = generateScenarioSet(graph, { n: 10, baseHash: hashGraph(graph, meta) });
  const baseline = validate(graph, set);
  const cand = generateCandidates(graph, baseline).find(c => c.id === 'threshold:dayTotal:500');
  assert.ok(cand);
  const rerun = reparam(graph, baseline, cand, { threshold: { field: 'dayTotal', x: 1000 } });
  assert.equal(rerun.id, cand.id);
  assert.equal(rerun.paramsVersion, 2);
  assert.ok(rerun.patch.some(op => op.op === 'setConfig' && op.value === 'dayTotal > 1000'));
  const r = runCandidate(graph, rerun, set, meta);
  assert.ok(r.ok);
});

test('optimize: performance at n=40 is under 3 s', () => {
  const graph = tpl('customer-refund').graph;
  const baseHash = hashGraph(graph, meta);
  const set = generateScenarioSet(graph, { n: 40, baseHash });
  const t0 = performance.now();
  const baseline = validate(graph, set);
  const out = optimize(graph, baseline, set, meta);
  const dt = performance.now() - t0;
  // eslint-disable-next-line no-console
  console.log(`validate+optimize (n=40, ${out.candidates.length} candidates): ${dt.toFixed(1)} ms`);
  assert.ok(dt < 3000, `took ${dt}ms`);
});

test('optimize: classes come from monitor + template; threshold 0 uses {0, hi/2}; vendor ids unique and a composite is eligible', async () => {
  const { readFileSync } = await import('node:fs');
  const { hashGraph } = await import('../js/model.js');
  const { generateScenarioSet } = await import('../js/adversary.js');
  const { validate } = await import('../js/validate.js');
  const { optimize, generateCandidates } = await import('../js/optimize.js');
  const t = JSON.parse(readFileSync(new URL('../templates/vendor-bank-change.json', import.meta.url)));
  const set = generateScenarioSet(t.graph, { n: 20, baseHash: hashGraph(t.graph, t) });
  const v = validate(t.graph, set);
  const cands = generateCandidates(t.graph, v);
  const ids = cands.map(c => c.candidate ? c.candidate.id : c.id);
  assert.equal(new Set(ids).size, ids.length, 'candidate ids are unique');
  assert.ok(!ids.some(id => id.includes('idem') || id.includes('inj')), 'unauthorized writes via duplicate/injection templates are not given idempotency or secret patches');
  assert.ok(ids.includes('threshold:amount:5000'), 'hi/2 option exists when t = 0');
  const o = optimize(t.graph, v, set, t);
  assert.ok(o.recommended && o.recommended.includes('binding'), o.recommended);
});
