#!/usr/bin/env node
/* Reproducible negative fixtures, each cloned from a passing real v2 bundle.
   node swm/skills/swm-data-rebuild/scripts/fixtures/t7-negative-fixtures.mjs [data-directory]
   Writes consistent JSON/JS twins only to a temporary directory, then exercises
   both public APIs and executable entrypoints. BASE is staged from git show. */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { validateGraph, validateCoverage, verifyBundle } from '../verify-bundle.mjs';
import { evaluateCompetencies } from '../competency.mjs';

const HERE = dirname(fileURLToPath(import.meta.url)), SCRIPTS = resolve(HERE, '..');
const ROOT = resolve(HERE, '..', '..', '..', '..', '..');
const DATA = resolve(process.argv[2] || join(ROOT, 'swm', 'data'));
const temp = await mkdtemp(join(tmpdir(), 'codex-t7-fixtures-'));
const onto = JSON.parse(await readFile(join(DATA, 'ontology.json'), 'utf8'));
const cov = JSON.parse(await readFile(join(DATA, 'coverage.json'), 'utf8'));
const good = await verifyBundle(DATA);
assert.deepEqual(good.problems, [], 'negative fixtures must start from passing shipped data');
assert.equal(evaluateCompetencies(onto).ok, true, 'positive CQ control');
console.log('PASS positive control: verifier and CQ1–CQ6');

const by = x => new Map(x.nodes.map(n => [n.id, n]));
const add = (x, s, t, pred, review = 'curated') => x.links.push({ s, t, pred, src: 'silex', review });
const coreRoots = onto.nodes.filter(n => n.layer === 1 && n.kind === 'core' && n.parentPred === 'GROUPED_UNDER');
assert.ok(coreRoots.length >= 2);
const rootA = coreRoots[0].id, rootB = coreRoots[1].id;
/* Recompute summaries after a mutation so a cycle/signature fixture is not
   rejected merely because it has stale layer counts. */
function summarize(x) {
  const index = by(x), bump = (o, k) => { o[k] = (o[k] || 0) + 1; };
  for (const l of x.chain.layers) {
    const members = x.nodes.filter(n => n.layer === l.id);
    l.count = members.length; l.groups = {};
    members.forEach(n => bump(l.groups, n.group));
  }
  for (const h of x.chain.hops) {
    h.count = 0; h.preds = {}; h.examples = [];
    for (const l of x.links) {
      const a = index.get(l.s), b = index.get(l.t);
      if (!a || !b) continue;
      if ((a.layer === h.from && b.layer === h.to) || (a.layer === h.to && b.layer === h.from)) {
        h.count++; bump(h.preds, l.pred);
      }
    }
  }
  x.chain.skips = { count: 0, preds: {}, pairs: {} };
  for (const l of x.links) {
    const a = index.get(l.s), b = index.get(l.t);
    if (!a || !b || Math.abs(a.layer - b.layer) < 2) continue;
    x.chain.skips.count++; bump(x.chain.skips.preds, l.pred);
    bump(x.chain.skips.pairs, 'L' + Math.min(a.layer, b.layer) + '–L' + Math.max(a.layer, b.layer));
  }
}
async function stage(name, x, c = cov) {
  const directory = join(temp, name); await mkdir(directory);
  for (const [stem, global, data] of [['ontology', 'SILEX_SWM_ONTOLOGY', x], ['coverage', 'SILEX_SWM_COVERAGE', c]]) {
    await writeFile(join(directory, stem + '.json'), JSON.stringify(data, null, 1));
    await writeFile(join(directory, stem + '.js'), 'window.' + global + ' = ' + JSON.stringify(data) + ';\n');
  }
  return directory;
}
function cli(script, directory) {
  const r = spawnSync(process.execPath, [join(SCRIPTS, script), directory], { encoding: 'utf8' });
  assert.equal(r.error, undefined);
  return r;
}
function diagnostics(r) {
  return [...r.common, ...r.results.flatMap(q => q.problems)];
}

const graphFixtures = [
  ['display-parent-cycle', x => {
    const index = by(x);
    for (const [s, t] of [[rootA, rootB], [rootB, rootA]]) {
      index.get(s).parent = t; index.get(s).parentPred = 'SUBCLASS_OF'; add(x, s, t, 'SUBCLASS_OF');
    }
  }, /display-parent cycle:/],
  ['non-parent-subclass-cycle', x => {
    const before = x.nodes.map(n => [n.id, n.parent, n.parentPred]);
    add(x, rootA, rootB, 'SUBCLASS_OF'); add(x, rootB, rootA, 'SUBCLASS_OF');
    assert.deepEqual(x.nodes.map(n => [n.id, n.parent, n.parentPred]), before, 'subclass fixture must keep every display parent');
  }, /SUBCLASS_OF cycle:/],
  ['non-tree-parent-predicate', x => {
    const n = by(x).get(rootA), target = x.nodes.find(n => n.layer === 1 && n.kind === 'class');
    n.parent = target.id; n.parentPred = 'RELATED_MATCH'; add(x, n.id, target.id, 'RELATED_MATCH');
  }, /parentPred not a tree predicate/],
  ['parent-layer-inversion', x => {
    const n = by(x).get(rootA); n.parent = 'ag:planner'; n.parentPred = 'SUBCLASS_OF'; add(x, n.id, n.parent, 'SUBCLASS_OF');
  }, /display parent layer exceeds child layer/],
  ['schema-drift', x => { x.schema.predicates.MAY_CAUSE.pairs = ['action>state']; }, /schema drift:/],
  ['signature-invalid', x => {
    const l = x.links.find(l => l.pred === 'MAY_CAUSE');
    l.t = x.nodes.find(n => n.layer === 1 && n.kind === 'state').id;
  }, /signature violation MAY_CAUSE:/],
  ['node-review-missing', x => { delete by(x).get(rootA).review; }, /missing or invalid node review/],
  ['link-review-invalid', x => { x.links.find(l => l.pred === 'DEPLOYED_IN').review = 'published'; }, /disallowed link review/],
  ['deployment-mismatch', x => { x.links = x.links.filter(l => !(l.pred === 'DEPLOYED_IN' && l.s === 'ag:planner')); }, /DEPLOYED_IN differs/],
  ['unobserved-marker-missing', x => { delete by(x).get('ag:exec-ctx').deployment; }, /deployment:unobserved/],
  ['retired-specializes', x => { add(x, rootA, by(x).get(rootA).parent, 'SPECIALIZES'); }, /SPECIALIZES is retired/],
  ['prohibited-entity', x => { x.nodes.find(n => n.layer === 2 && n.kind === 'entity').label += ' (prohibited)'; }, /\(prohibited\) entity/],
  ['uncountered-partition', x => { x.uncountered.pop(); }, /uncountered differs/],
  ['wrong-runtime-instance', x => {
    const n = by(x).get('rt-refund-agent');
    const l = x.links.find(l => l.s === n.id && l.pred === 'INSTANCE_OF');
    l.t = 'ag:mcp'; n.parent = 'ag:mcp';
  }, /INSTANCE_OF set disagrees with runtime kind/]
];
for (const [name, mutate, expected] of graphFixtures) {
  const x = structuredClone(onto); mutate(x); summarize(x);
  const r = validateGraph(x);
  assert.ok(r.problems.some(p => expected.test(p)), name + ' must produce its intended diagnostic');
  if (name === 'non-parent-subclass-cycle') {
    assert.equal(r.metrics.displayCycles, 0, 'subclass negative must have an acyclic display graph');
    assert.equal(r.metrics.signatureViolations, 0, 'subclass cycle uses compatible kinds');
    assert.ok(r.problems.every(p => p.startsWith('SUBCLASS_OF cycle:')), 'subclass fixture must fail only on semantic cycles');
  }
  const directory = await stage(name, x);
  const result = cli('verify-bundle.mjs', directory);
  assert.equal(result.status, 1, name + ': verifier CLI must reject');
  assert.match(result.stdout, expected);
  await writeFile(join(directory, 'proof.log'), result.stdout + result.stderr);
  console.log('REJECT ' + name + ': ' + r.problems.find(p => expected.test(p)));
}

const cqFixtures = [
  ['cq1-no-applicable-hazard', x => {
    x.links = x.links.filter(l => l.pred !== 'HAZARD_FOR');
  }, 'CQ1', /no applicable hazards/],
  ['cq2-missing-financial-class', x => {
    x.nodes = x.nodes.filter(n => n.id !== 'core:financial-value-transfer');
    x.links = x.links.filter(l => l.s !== 'core:financial-value-transfer' && l.t !== 'core:financial-value-transfer');
  }, 'CQ2', /required L1 effect class missing/],
  ['cq2-missing-approval-class', x => {
    x.nodes = x.nodes.filter(n => n.id !== 'core:human-approval');
    x.links = x.links.filter(l => l.s !== 'core:human-approval' && l.t !== 'core:human-approval');
  }, 'CQ2', /required L1 control class missing/],
  ['cq3-contradictory-partition', x => { x.uncountered = []; }, 'CQ3', /partition contradicts COUNTERS/],
  ['cq4-candidate-no-isa', x => {
    const domain = x.nodes.find(n => n.kind === 'domain' && n.candidate);
    const entity = x.nodes.find(n => n.layer === 2 && n.kind === 'entity' && n.parent === domain.id);
    x.links = x.links.filter(l => !(l.s === entity.id && l.pred === 'SUBCLASS_OF'));
  }, 'CQ4', /missing SUBCLASS_OF to L1/],
  ['cq5-no-exhibited-hazard', x => {
    x.links = x.links.filter(l => !(l.s === 'rt-inc-0987' && l.pred === 'EXHIBITS'));
  }, 'CQ5', /EXHIBITS hazard missing/],
  ['cq5-nonillustrative-incident', x => {
    x.links.find(l => l.s === 'rt-inc-0987' && l.pred === 'EXHIBITS').review = 'curated';
  }, 'CQ5', /EXHIBITS assertion must be illustrative/],
  ['cq6-evidence-no-record', x => {
    x.links = x.links.filter(l => l.pred !== 'RECORDED_BY');
  }, 'CQ6', /incomplete principle-3 chain/],
  ['cq6-unreached-prohibited', x => {
    const outcome = x.nodes.find(n => n.prohibited);
    x.links = x.links.filter(l => !(l.pred === 'MAY_LEAD_TO' && l.t === outcome.id));
  }, 'CQ6', /unreached by hazards/]
];
for (const [name, mutate, question, expected] of cqFixtures) {
  const x = structuredClone(onto); mutate(x);
  const r = evaluateCompetencies(x), q = r.results.find(q => q.id === question);
  assert.equal(q.ok, false); assert.ok(q.problems.some(p => expected.test(p)), name);
  const directory = await stage(name, x), result = cli('competency.mjs', directory);
  assert.equal(result.status, 1, name + ': competency CLI must reject');
  assert.match(result.stdout, expected);
  await writeFile(join(directory, 'proof.log'), result.stdout + result.stderr);
  console.log('REJECT ' + name + ': ' + q.problems.find(p => expected.test(p)));
}

/* CQ2 must accept a legitimate empty result, including approval subclasses. */
function addCoreSubtype(x, id, root, label) {
  x.nodes.push({ ...structuredClone(by(x).get(root)), id, label,
    def: 'Synthetic subclass for T7 fixture checks.', parent: root, parentPred: 'SUBCLASS_OF' });
  add(x, id, root, 'SUBCLASS_OF');
}
async function positiveFixture(name, x) {
  summarize(x);
  const c = structuredClone(cov);
  c.kpis.find(k => k.id === 'entities').delta = x.nodes.length + ' ontology types';
  const directory = await stage(name, x, c);
  assert.deepEqual((await verifyBundle(directory)).problems, [], name + ': valid graph control');
  const result = cli('competency.mjs', directory);
  assert.equal(result.status, 0, name + ': competency CLI must pass');
  await writeFile(join(directory, 'proof.log'), result.stdout + result.stderr);
}
const allApproved = structuredClone(onto);
addCoreSubtype(allApproved, 'core:fixture-approval-subtype', 'core:human-approval', 'Fixture approval subtype');
for (const h of allApproved.nodes.filter(n => n.layer === 2 && n.kind === 'hazard'))
  add(allApproved, h.id, 'core:fixture-approval-subtype', 'MITIGATED_BY');
const approvedCQ2 = evaluateCompetencies(allApproved).results.find(q => q.id === 'CQ2');
assert.equal(approvedCQ2.ok, true); assert.deepEqual(approvedCQ2.answer, []);
await positiveFixture('cq2-valid-empty', allApproved);
console.log('PASS CQ2 valid empty result via mapped human-approval subclass');

/* Financial effect subclasses must be traversed, not matched by label keywords. */
const effectSubtype = structuredClone(onto);
addCoreSubtype(effectSubtype, 'core:fixture-financial-subtype', 'core:financial-value-transfer', 'Fixture subtype');
for (const l of effectSubtype.links) if (l.pred === 'MAY_CAUSE' && l.t === 'core:financial-value-transfer') l.t = 'core:fixture-financial-subtype';
const originalCQ2 = evaluateCompetencies(onto).results.find(q => q.id === 'CQ2');
const subtypeCQ2 = evaluateCompetencies(effectSubtype).results.find(q => q.id === 'CQ2');
assert.equal(subtypeCQ2.ok, true);
assert.deepEqual(subtypeCQ2.answer.map(a => a.action), originalCQ2.answer.map(a => a.action));
await positiveFixture('cq2-financial-subclass', effectSubtype);
console.log('PASS CQ2 financial effect subclasses preserve queried actions');

/* Stage all four BASE files exactly; expected failure must not be a load error. */
const base = join(temp, 'BASE'); await mkdir(base);
for (const stem of ['ontology', 'coverage']) for (const ext of ['json', 'js']) {
  const bytes = execFileSync('git', ['show', '74ed19a:swm/data/' + stem + '.' + ext], { cwd: ROOT });
  await writeFile(join(base, stem + '.' + ext), bytes);
}
for (const script of ['verify-bundle.mjs', 'competency.mjs']) {
  const r = cli(script, base);
  assert.equal(r.status, 1, script + ': BASE must fail');
  assert.doesNotMatch(r.stdout + r.stderr, /ENOENT|SyntaxError|ERR_MODULE_NOT_FOUND/);
  assert.match(r.stdout, /expected (?:version )?swm-2\.0/);
  await writeFile(join(base, script + '.log'), r.stdout + r.stderr);
  console.log('REJECT BASE ' + script + ': exit 1, semantic/version diagnostics (four files loaded)');
}
const directBase = evaluateCompetencies(JSON.parse(await readFile(join(base, 'ontology.json'), 'utf8')));
console.log('BASE CQ status: ' + directBase.results.map(q => q.id + '=' + (q.ok ? 'PASS' : 'FAIL')).join(' '));
console.log('Proof directory: ' + temp);
console.log('PASS all ' + graphFixtures.length + ' graph negatives, ' + cqFixtures.length + ' CQ negatives, CQ2 positives and BASE rejections');
