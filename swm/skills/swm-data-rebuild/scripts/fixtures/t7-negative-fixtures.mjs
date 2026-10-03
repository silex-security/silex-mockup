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
import { validateGraph, validateCoverage, validateCoverageFreeze, validateNotices, verifyBundle } from '../verify-bundle.mjs';
import { evaluateCompetencies } from '../competency.mjs';

const HERE = dirname(fileURLToPath(import.meta.url)), SCRIPTS = resolve(HERE, '..');
const ROOT = resolve(HERE, '..', '..', '..', '..', '..');
const DATA = resolve(process.argv[2] || join(ROOT, 'swm', 'data'));
const temp = await mkdtemp(join(tmpdir(), 'codex-t7-fixtures-'));
let onto = JSON.parse(await readFile(join(DATA, 'ontology.json'), 'utf8'));
let cov = JSON.parse(await readFile(join(DATA, 'coverage.json'), 'utf8'));
const SYNTHETIC = process.argv.includes('--synthetic');
const notice = await readFile(join(ROOT, 'swm/.cache/ocsf-NOTICE'), 'utf8');
let notices;
if (SYNTHETIC) {
  // Explicit synthetic control for developing new checks against pre-grounding P0.
  // Never used by the default integrated-bundle acceptance run.
  const link = (s, t, pred, src = 'silex', review = 'curated') => onto.links.push({ s, t, pred, src, review });
  const node = (id, kind, layer, group, parent, parentPred, sys, extra = {}) => {
    onto.nodes.push({ id, label: 'Synthetic ' + id, kind, layer, group, parent, parentPred,
      review: sys === 'silex' ? 'curated' : 'published', src: [{ sys, id, label: 'Synthetic fixture' }], ...extra });
    link(id, parent, parentPred);
  };
  for (const n of onto.nodes) if (n.kind === 'entity' && ['dom:finance', 'dom:support', 'dom:identity-it'].includes(n.parent)) n.unmatched = 'Synthetic unmatched fixture';
  node('fibo:fixture-account', 'class', 2, 'resource', 'dom:finance', 'PART_OF_DOMAIN', 'fibo');
  link('ent:finance:bank-account', 'fibo:fixture-account', 'CLOSE_MATCH');
  link('hz:haz-finance-unverified-instruction', 'ent:finance:bank-account', 'HAZARD_FOR');
  link('hz:haz-finance-unverified-instruction', 'atlas:AML.T0051', 'CHARACTERIZES');
  onto.nodes.find(n => n.id === 'hz:haz-finance-unverified-instruction').src.push({ sys: 'agentdojo', id: 'banking/injection_task_4', label: 'Synthetic scenario', rel: 'derived', ver: '1.2.0' });
  node('atlas:fixture-mitigation', 'countermeasure', 1, 'policy', 'grp:policy', 'GROUPED_UNDER', 'atlas');
  link('atlas:fixture-mitigation', 'atlas:AML.T0051', 'COUNTERS', 'atlas', 'published');
  node('case:fixture-case', 'case', 3, 'threat', 'grp:threat', 'GROUPED_UNDER', 'atlas-cs', { caseType: 'exercise' });
  link('case:fixture-case', 'atlas:AML.T0051', 'DEMONSTRATES', 'atlas-cs', 'published');
  link('hz:haz-finance-unverified-instruction', 'case:fixture-case', 'EXEMPLIFIED_BY');
  node('cdm:fixture-order', 'class', 2, 'resource', 'dom:support', 'PART_OF_DOMAIN', 'cdm', { attrs: [{ name: 'id', def: 'Synthetic documented id' }] });
  link('ent:support:order', 'cdm:fixture-order', 'CLOSE_MATCH');
  link('hz:haz-support-refund-loop', 'ent:support:order', 'HAZARD_FOR');
  onto.nodes.find(n => n.id === 'hz:haz-support-refund-loop').src.push(
    { sys: 'tau2', id: 'retail/rule/once-per-order', label: 'Synthetic rule', rel: 'related' },
    { sys: 'asb', id: 'ecommerce_manager_agent/Refunds', label: 'Synthetic scenario', rel: 'related' });
  node('nist:fixture-control', 'control', 1, 'policy', 'grp:policy', 'GROUPED_UNDER', 'nist-800-53');
  link('hz:haz-it-orphan-account', 'nist:fixture-control', 'MITIGATED_BY');
  node('attack:fixture-mitigation', 'countermeasure', 1, 'policy', 'grp:policy', 'GROUPED_UNDER', 'attack');
  link('attack:fixture-mitigation', 'attack:T1078', 'COUNTERS', 'attack', 'published');
  node('ocsf:authentication', 'class', 1, 'workflow', 'grp:workflow', 'GROUPED_UNDER', 'ocsf');
  node('rec:rec-authentication-event', 'record', 3, 'workflow', 'ag:trace', 'PART_OF', 'silex');
  link('core:core-evidence-identity-assertion', 'rec:rec-authentication-event', 'RECORDED_BY');
  link('rec:rec-authentication-event', 'ocsf:authentication', 'CLOSE_MATCH');
  const countered = new Set(onto.links.filter(l => l.pred === 'COUNTERS').map(l => l.t));
  onto.uncountered = onto.nodes.filter(n => n.layer === 3 && ['technique', 'risk'].includes(n.kind) && !countered.has(n.id)).map(n => n.id);
  summarize(onto);
  cov.kpis.find(k => k.id === 'entities').delta = onto.nodes.length + ' ontology types';
  notices = [...new Set(onto.nodes.flatMap(n => n.src.map(s => s.sys)))].join('\n') + '\n' + notice;
  const control = await stage('synthetic-control', onto, cov);
  assert.deepEqual((await verifyBundle(control)).problems, [], 'synthetic graph and notice positive control');
} else {
  notices = await readFile(join(DATA, 'NOTICES.md'), 'utf8');
  assert.deepEqual((await verifyBundle(DATA)).problems, [], 'negative fixtures must start from passing integrated data');
}
const positiveCQ = evaluateCompetencies(onto);
assert.equal(positiveCQ.ok, true, 'positive CQ1–CQ9 control: ' + diagnostics(positiveCQ).join('; '));
console.log('PASS positive control: verifier and CQ1–CQ9' + (SYNTHETIC ? ' (explicit synthetic P0 extension)' : ' (integrated bundle)'));

const by = x => new Map(x.nodes.map(n => [n.id, n]));
const add = (x, s, t, pred, review = 'curated') => x.links.push({ s, t, pred, src: 'silex', review });
const coreRoots = onto.nodes.filter(n => n.layer === 1 && n.kind === 'core' && n.parentPred === 'GROUPED_UNDER');
assert.ok(coreRoots.length >= 2);
const rootA = coreRoots[0].id, rootB = coreRoots[1].id;
/* Recompute summaries after a mutation so a cycle/signature fixture is not
   rejected merely because it has stale layer counts. */
function summarize(x) {
  const index = new Map(x.nodes.map(n => [n.id, n])), bump = (o, k) => { o[k] = (o[k] || 0) + 1; };
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
  await writeFile(join(directory, 'NOTICES.md'), notices || '');
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
  }, /INSTANCE_OF set disagrees with runtime kind/],
  ['case-type-invalid', x => { x.nodes.find(n => n.kind === 'case').caseType = 'observed'; }, /invalid caseType/],
  ['case-parent-invalid', x => { const n = x.nodes.find(n => n.kind === 'case'); n.parent = 'grp:policy'; add(x, n.id, n.parent, 'GROUPED_UNDER'); }, /case.*display parent|display parent must use.*grp:threat/],
  ['demonstrates-signature', x => { x.links.find(l => l.pred === 'DEMONSTRATES').t = 'owasp:LLM06'; }, /signature violation DEMONSTRATES/],
  ['demonstrates-grade', x => { x.links.find(l => l.pred === 'DEMONSTRATES').review = 'curated'; }, /DEMONSTRATES:.*disallowed/],
  ['exemplified-signature', x => { x.links.find(l => l.pred === 'EXEMPLIFIED_BY').s = 'act:act-finance-payment-release'; }, /signature violation EXEMPLIFIED_BY/],
  ['exemplified-grade', x => { x.links.find(l => l.pred === 'EXEMPLIFIED_BY').review = 'published'; }, /EXEMPLIFIED_BY:.*disallowed/],
  ['close-match-signature', x => { x.links.find(l => l.pred === 'CLOSE_MATCH').t = 'core:core-control-monitoring'; }, /signature violation CLOSE_MATCH/],
  ['close-match-grade', x => { x.links.find(l => l.pred === 'CLOSE_MATCH').review = 'published'; }, /CLOSE_MATCH:.*disallowed/],
  ['class-domain-signature', x => { x.links.find(l => l.pred === 'PART_OF_DOMAIN' && by(x).get(l.s)?.kind === 'class').t = 'grp:resource'; }, /signature violation PART_OF_DOMAIN/],
  ['class-parent-invalid', x => { const n = x.nodes.find(n => n.layer === 2 && n.kind === 'class'); n.parent = 'grp:resource'; n.parentPred = 'GROUPED_UNDER'; add(x, n.id, n.parent, n.parentPred); }, /L2 class display parent/],
  ['source-rel-missing', x => { delete x.nodes.find(n => n.kind === 'hazard' && n.src.some(s => s.sys !== 'silex')).src.find(s => s.sys !== 'silex').rel; }, /non-Silex hazard\/action source needs rel/],
  ['source-rel-invalid', x => { x.nodes.find(n => n.kind === 'hazard' && n.src.some(s => s.sys !== 'silex')).src.find(s => s.sys !== 'silex').rel = 'proven'; }, /non-Silex hazard\/action source needs rel/],
  ['action-rel-missing', x => { x.nodes.find(n => n.kind === 'action').src.push({ sys: 'agentdojo', id: 'banking/tool/send_money', label: 'Fixture action source', ver: '1.0.0' }); }, /non-Silex hazard\/action source needs rel/],
  ['agentdojo-version-missing', x => { delete x.nodes.find(n => n.src.some(s => s.sys === 'agentdojo')).src.find(s => s.sys === 'agentdojo').ver; }, /AgentDojo source needs ver/],
  ['entity-no-alignment', x => { const n = x.nodes.find(n => n.kind === 'entity' && n.parent === 'dom:finance'); delete n.unmatched; x.links = x.links.filter(l => !(l.s === n.id && l.pred === 'CLOSE_MATCH')); }, /entity needs CLOSE_MATCH/],
  ['case-in-threat-partition', x => { x.uncountered.push(x.nodes.find(n => n.kind === 'case').id); }, /uncountered differs/],
  ['record-close-match-signature', x => { const l = x.links.find(l => l.pred === 'CLOSE_MATCH' && by(x).get(l.s)?.kind === 'record'); l.t = 'attack:T1078'; }, /signature violation CLOSE_MATCH/],
  ['attribute-over-limit', x => { x.nodes.find(n => n.attrs?.length).attrs[0].def = 'x'.repeat(201); }, /attribute def exceeds/],
  ['attribute-on-entity', x => { x.nodes.find(n => n.kind === 'entity').attrs = [{ name: 'id', def: 'value' }]; }, /attrs only allowed/],
  ['nist-parent-invalid', x => { const n = x.nodes.find(n => n.src.some(s => s.sys === 'nist-800-53')); n.parent = 'grp:resource'; add(x, n.id, n.parent, 'GROUPED_UNDER'); }, /display parent must use GROUPED_UNDER to grp:policy/]

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
  }, 'CQ6', /unreached by hazards/],
  ['cq7-no-fibo-path', x => { x.links = x.links.filter(l => !(l.pred === 'CLOSE_MATCH' && (by(x).get(l.t)?.src || []).some(s => s.sys === 'fibo'))); }, 'CQ7', /no FIBO class/],
  ['cq7-no-scenario', x => { by(x).get('hz:haz-finance-unverified-instruction').src = by(x).get('hz:haz-finance-unverified-instruction').src.filter(s => s.sys !== 'agentdojo'); }, 'CQ7', /no AgentDojo scenario/],
  ['cq7-no-published-mitigation', x => { x.links = x.links.filter(l => !(l.pred === 'COUNTERS' && l.src === 'atlas' && l.review === 'published')); }, 'CQ7', /no ATLAS technique/],
  ['cq7-no-reviewed-case', x => { x.links = x.links.filter(l => !(l.s === 'hz:haz-finance-unverified-instruction' && l.pred === 'EXEMPLIFIED_BY')); }, 'CQ7', /reviewed ATLAS case link missing/],
  ['cq8-no-cdm-path', x => { x.links = x.links.filter(l => !(l.pred === 'CLOSE_MATCH' && (by(x).get(l.t)?.src || []).some(s => s.sys === 'cdm'))); }, 'CQ8', /no aligned CDM entity/],
  ['cq8-no-tau-rule', x => { by(x).get('hz:haz-support-refund-loop').src = by(x).get('hz:haz-support-refund-loop').src.filter(s => s.sys !== 'tau2'); }, 'CQ8', /no tau2 policy rule/],
  ['cq8-no-asb', x => { by(x).get('hz:haz-support-refund-loop').src = by(x).get('hz:haz-support-refund-loop').src.filter(s => s.sys !== 'asb'); }, 'CQ8', /no ASB scenario/],
  ['cq9-no-nist', x => { x.links = x.links.filter(l => !(l.s === 'hz:haz-it-orphan-account' && (by(x).get(l.t)?.src || []).some(s => s.sys === 'nist-800-53'))); }, 'CQ9', /no mapped NIST control/],
  ['cq9-no-attack-mitigation', x => { x.links = x.links.filter(l => !(l.pred === 'COUNTERS' && l.t === 'attack:T1078' && l.src === 'attack')); }, 'CQ9', /no characterized T1078/],
  ['cq9-no-ocsf-record', x => { x.links = x.links.filter(l => !(l.pred === 'CLOSE_MATCH' && (by(x).get(l.t)?.src || []).some(s => s.sys === 'ocsf'))); }, 'CQ9', /no OCSF class/]

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

/* --base allows only the two declared graph-derived paths and top-level timestamp. */
const baselineFile = join(temp, 'baseline-coverage.json');
await writeFile(baselineFile, JSON.stringify(cov));
const allowedCoverage = structuredClone(cov);
allowedCoverage.generated = 'changed-generation-time';
allowedCoverage.ontologyCompleteness.note = 'changed graph-derived display';
assert.deepEqual(validateCoverageFreeze(allowedCoverage, cov), []);
const allowedDir = await stage('coverage-freeze-positive', onto, allowedCoverage);
assert.deepEqual((await verifyBundle(allowedDir, { base: baselineFile })).problems, []);
const allowedCLI = spawnSync(process.execPath, [join(SCRIPTS, 'verify-bundle.mjs'), '--base', baselineFile, allowedDir], { encoding: 'utf8' });
assert.equal(allowedCLI.status, 0);
const deltaGraph = structuredClone(onto);
addCoreSubtype(deltaGraph, 'core:fixture-freeze-subtype', 'core:human-approval', 'Coverage-freeze graph change');
summarize(deltaGraph);
const deltaCoverage = structuredClone(cov);
deltaCoverage.generated = 'new-generation';
deltaCoverage.kpis.find(k => k.id === 'entities').delta = deltaGraph.nodes.length + ' ontology types';
const deltaDirectory = await stage('coverage-freeze-delta-positive', deltaGraph, deltaCoverage);
assert.deepEqual((await verifyBundle(deltaDirectory, { base: baselineFile })).problems, []);
const deltaCLI = spawnSync(process.execPath, [join(SCRIPTS, 'verify-bundle.mjs'), deltaDirectory, '--base', baselineFile], { encoding: 'utf8' });
assert.equal(deltaCLI.status, 0, 'a real graph-derived entities.delta change must pass');
for (const [name, mutate] of [
  ['percentage', c => { c.tree.coverage += .001; }],
  ['tree-order', c => { c.tree.children.reverse(); }],
  ['gap', c => { c.gaps[0].title += ' changed'; }],
  ['runtime-count', c => { c.tree.children[0].agents += 1; }],
  ['kpi-label', c => { c.kpis.find(k => k.id === 'entities').label += ' changed'; }]
]) {
  const c = structuredClone(cov); mutate(c);
  const directory = await stage('coverage-freeze-' + name, onto, c);
  const r = await verifyBundle(directory, { base: baselineFile });
  assert.ok(r.problems.some(p => p.startsWith('coverage freeze:')), name);
  const result = spawnSync(process.execPath, [join(SCRIPTS, 'verify-bundle.mjs'), directory, '--base', baselineFile], { encoding: 'utf8' });
  assert.equal(result.status, 1); assert.match(result.stdout, /coverage freeze:/);
  await writeFile(join(directory, 'proof.log'), result.stdout + result.stderr);
}
console.log('PASS coverage freeze: allowed fields and five forbidden CLI mutations');
assert.deepEqual(validateNotices(notices, onto, notice), []);
for (const [name, text] of [['missing-sys', notices.replace(/\bfibo\b/gi, 'removed-source')], ['missing-ocsf-text', notices.replace(notice.trim(), 'removed OCSF notice')]]) {
  const directory = await stage('notice-' + name, onto);
  await writeFile(join(directory, 'NOTICES.md'), text);
  const r = await verifyBundle(directory);
  assert.ok(r.problems.some(p => /NOTICES.md: missing/.test(p)), name);
  const result = cli('verify-bundle.mjs', directory); assert.equal(result.status, 1); assert.match(result.stdout, /NOTICES.md: missing/);
}
const missingNoticeDir = await stage('notice-file-missing', onto);
// A nonexistent file is simulated by passing an otherwise staged twin directory without copying its notice.
const noNotice = join(temp, 'no-notice'); await mkdir(noNotice);
for (const file of ['ontology.json', 'ontology.js', 'coverage.json', 'coverage.js']) await writeFile(join(noNotice, file), await readFile(join(missingNoticeDir, file)));
assert.ok((await verifyBundle(noNotice)).problems.some(p => /NOTICES.md: required/.test(p)));
assert.equal(cli('verify-bundle.mjs', noNotice).status, 1);
console.log('PASS NOTICES positive and missing-source / missing-OCSF-text / missing-file negatives');

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
