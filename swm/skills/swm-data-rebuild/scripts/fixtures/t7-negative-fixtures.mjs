#!/usr/bin/env node
/* Reproducible negative fixtures, each cloned from a passing real v2 bundle.
   node swm/skills/swm-data-rebuild/scripts/fixtures/t7-negative-fixtures.mjs [data-directory]
   Append --preservation-only to check exact BASE 75bba66 IDs and relations alone.
   Writes consistent JSON/JS twins only to a temporary directory, then exercises
   both public APIs and executable entrypoints. BASE is staged from git show. */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { LOCAL_SCHEMA, validateGraph, validateCoverage, validateCoverageFreeze, validateNotices, verifyBundle } from '../verify-bundle.mjs';
import { evaluateCompetencies } from '../competency.mjs';

const HERE = dirname(fileURLToPath(import.meta.url)), SCRIPTS = resolve(HERE, '..');
const ROOT = resolve(HERE, '..', '..', '..', '..', '..');
const DATA = resolve(process.argv[2] || join(ROOT, 'swm', 'data'));
let onto = JSON.parse(await readFile(join(DATA, 'ontology.json'), 'utf8'));
let cov = JSON.parse(await readFile(join(DATA, 'coverage.json'), 'utf8'));
const SYNTHETIC = process.argv.includes('--synthetic');
const BENCH_SYNTHETIC = process.argv.includes('--benchmark-synthetic');
// Exact shipped identities and complete relation records: no ID normalization.
function assertPreserved(base, current) {
  const ids = new Set(current.nodes.map(n => n.id));
  const missing = base.nodes.filter(n => !ids.has(n.id)).map(n => n.id);
  assert.deepEqual(missing, [], 'BASE 75bba66 node IDs missing');
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value;
  const key = l => JSON.stringify(canonical(l));
  const counts = new Map();
  for (const l of current.links) counts.set(key(l), (counts.get(key(l)) || 0) + 1);
  const lost = [];
  for (const l of base.links) {
    const k = key(l), count = counts.get(k) || 0;
    if (!count) lost.push(l); else counts.set(k, count - 1);
  }
  assert.deepEqual(lost, [], 'BASE 75bba66 exact relation records missing or changed');
}
if (!SYNTHETIC && !BENCH_SYNTHETIC) {
  const baseline = JSON.parse(execFileSync('git', ['show', '75bba66:swm/data/ontology.json'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));
  assertPreserved(baseline, onto);
  const renamed = structuredClone(onto);
  const original = baseline.nodes.find(n => n.id === 'nist:AC-2(3)');
  assert.ok(original, 'preservation negative must use the shipped NIST ID');
  renamed.nodes.find(n => n.id === original.id).id = 'nist:AC-2.3';
  assert.throws(() => assertPreserved(baseline, renamed), /node IDs missing/);
  const removed = structuredClone(onto);
  const edge = baseline.links[0];
  const edgeIndex = removed.links.findIndex(l => l.s === edge.s && l.t === edge.t && l.pred === edge.pred);
  assert.ok(edgeIndex >= 0, 'preservation negative must remove a BASE relation');
  removed.links.splice(edgeIndex, 1);
  assert.throws(() => assertPreserved(baseline, removed), /relation records missing or changed/);
  const changed = structuredClone(onto);
  changed.links[edgeIndex].review = 'synthetic-changed-grade';
  assert.throws(() => assertPreserved(baseline, changed), /relation records missing or changed/);
  console.log(`PASS exact BASE 75bba66 preservation: ${baseline.nodes.length} IDs, ${baseline.links.length} relation records; rename, deletion and changed-grade negatives rejected`);
}
if (process.argv.includes('--preservation-only')) process.exit(0);
const temp = await mkdtemp(join(tmpdir(), 'codex-t7-fixtures-'));
const isBenchmark = n => !!n && Object.hasOwn(n, 'benchmark');
const typeCount = x => x.nodes.filter(n => !isBenchmark(n)).length;
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
  cov.kpis.find(k => k.id === 'entities').delta = typeCount(onto) + ' ontology types';
  notices = [...new Set(onto.nodes.flatMap(n => n.src.map(s => s.sys)))].join('\n') + '\n' + notice;
  const control = await stage('synthetic-control', onto, cov);
  assert.deepEqual((await verifyBundle(control)).problems, [], 'synthetic graph and notice positive control');
} else {
  notices = await readFile(join(DATA, 'NOTICES.md'), 'utf8');
  assert.deepEqual((await verifyBundle(DATA)).problems, [], 'negative fixtures must start from passing integrated data');
}
if (BENCH_SYNTHETIC) {
  // Explicit synthetic benchmark control for P1 development before the parsers land.
  // Default acceptance uses the integrated public-source records, never this extension.
  onto.schema = structuredClone(LOCAL_SCHEMA);
  const edge = (s, t, pred, review = 'curated', src = 'silex') => onto.links.push({ s, t, pred, review, src });
  const node = (id, kind, source, benchmark, domain, parent) => {
    const n = { id: 'bench:fixture:' + id, kind, layer: 4, group: 'agent', label: 'Synthetic ' + id,
      def: 'Synthetic verifier fixture, not public evidence.', review: 'published',
      src: [{ sys: source, id, label: 'Synthetic fixture', ver: 'v1.2.1' }], benchmark: { source, ...benchmark },
      parent: parent || 'ag:' + kind, parentPred: kind === 'incident' ? 'OCCURRED_IN' : 'INSTANCE_OF' };
    if (domain) n.domain = domain;
    onto.nodes.push(n); edge(n.id, n.parent, n.parentPred);
    if (domain) edge(n.id, 'dom:' + domain, 'BELONGS_TO');
    return n.id;
  };
  const agent = node('agent', 'planner', 'agentdojo', {}), tool = node('tool', 'tool-reg', 'agentdojo', {});
  for (const [i, model] of ['meta-llama_Llama-3.3-70B-Instruct', 'Meta-SecAlign-70B'].entries()) {
    const run = node('run-' + i, 'trace', 'agentdojo', { model, suite: 'banking', injectionTask: 'injection_task_4', outcome: 'attack reported executed' }, 'finance');
    const inc = node('inc-' + i, 'incident', 'agentdojo', { status: 'reported-executed', ...(i === 0 ?
      { predicate: { hazard: 'haz-finance-scheduled-redirect', from: 'Synthetic predicate' }, evidenceCall: { name: 'update_scheduled_transaction', index: 0 } } :
      { unmapped: 'Synthetic reported execution without a matching call' }) }, 'finance', run);
    if (i === 0) edge(inc, 'hz:haz-finance-scheduled-redirect', 'EXHIBITS');
    edge(run, agent, 'EXECUTED_BY', 'published', 'agentdojo'); edge(run, tool, 'INVOKES', 'published', 'agentdojo');
  }
  node('safe-run', 'trace', 'agentdojo', { model: 'meta-llama_Llama-3.3-70B-Instruct', suite: 'banking', injectionTask: 4, outcome: 'attack not executed' }, 'finance');
  edge(tool, 'act:act-finance-update-scheduled', 'IMPLEMENTS');
  const refusals = ['Payment method should be the original payment method'];
  const tau = node('tau-run', 'trace', 'tau2', { outcome: 'task passed', refusals }, 'support');
  const tauInc = node('tau-inc', 'incident', 'tau2', { status: 'attempt-refused', refusals }, 'support', tau);
  edge(tauInc, 'hz:haz-support-refund-redirect', 'EXHIBITS');
  node('tau-failed', 'trace', 'tau2', { outcome: 'task failed', refusals: [] }, 'support');
  summarize(onto);
  const directory = await stage('benchmark-synthetic-control', onto, cov);
  assert.deepEqual((await verifyBundle(directory)).problems, [], 'benchmark synthetic positive control');
}
const positiveCQ = evaluateCompetencies(onto);
assert.equal(positiveCQ.ok, true, 'positive CQ1–CQ10 control: ' + diagnostics(positiveCQ).join('; '));
console.log('PASS positive control: verifier and CQ1–CQ10' + (SYNTHETIC || BENCH_SYNTHETIC ? ' (explicit synthetic extension)' : ' (integrated bundle)'));

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
/* C17–C20 controls reuse the P0b mutations, with ids selected from the input
   bundle so the same suite exercises synthetic and real parser output. */
const benchNode = (kind, source, extra = () => true) => {
  const n = onto.nodes.find(n => isBenchmark(n) && n.kind === kind && n.benchmark?.source === source && extra(n));
  assert.ok(n, 'benchmark fixture needs ' + source + ' ' + kind); return n.id;
};
const adAgent = benchNode('planner', 'agentdojo');
const adRun = benchNode('trace', 'agentdojo', n => n.benchmark.outcome === 'attack reported executed');
const tauRun = benchNode('trace', 'tau2', n => n.benchmark.refusals?.length);
const adInc = benchNode('incident', 'agentdojo', n => onto.links.some(l => l.s === n.id && l.pred === 'EXHIBITS'));
const unmappedInc = benchNode('incident', 'agentdojo', n => !onto.links.some(l => l.s === n.id && l.pred === 'EXHIBITS'));
const tauInc = benchNode('incident', 'tau2');
const one = (x, id) => by(x).get(id);
const edgeFrom = (x, id, p) => x.links.find(l => l.s === id && l.pred === p);
const removeNode = (x, id) => { x.nodes = x.nodes.filter(n => n.id !== id); x.links = x.links.filter(l => l.s !== id && l.t !== id); };
graphFixtures.push(
  /* L4 bundle sample (plan 2026-10-04 L4 sampling) */
  ['sample-record-missing', x => { delete x.benchmarkSample; }, /benchmarkSample: missing or malformed record/],
  ['sample-record-drift', x => { x.benchmarkSample.sources['agentdojo-runs'].runs.kept++; }, /runs recorded/],
  ['sample-incident-dropped', x => { const run = edgeFrom(x, adInc, 'OCCURRED_IN').t; removeNode(x, adInc); removeNode(x, run); }, /runs recorded|every incident must be kept|every reported execution must be kept/],
  ['sample-agent-shown', x => { const b = one(x, adAgent).benchmark; b.shown[Object.keys(b.shown)[0]]++; }, /shown \d+, bundle has/],
  ['sample-agent-population', x => { delete one(x, adAgent).benchmark.population; }, /needs population and shown counts/],
  ['benchmark-review', x => { one(x, adAgent).review = 'curated'; }, /benchmark node must be published/],
  ['benchmark-source', x => { one(x, adAgent).benchmark.source = 'asb'; }, /benchmark source must/],
  ['benchmark-citation', x => { one(x, adAgent).src = [{ sys: 'silex' }]; }, /matching agentdojo or tau2/],
  ['benchmark-record', x => { one(x, adAgent).benchmark = null; }, /benchmark must be a record/],
  ['benchmark-layer', x => { one(x, adAgent).layer = 3; }, /benchmark node must be L4/],
  ['ordinary-runtime-published', x => { const n = one(x, 'rt-refund-agent'); n.review = 'published'; n.src = [{ sys: 'tau2' }]; }, /runtime node must be illustrative/],
  ['benchmark-disallowed-grade', x => { edgeFrom(x, adAgent, 'INSTANCE_OF').review = 'published'; }, /disallowed link review/],
  ['ordinary-runtime-no-domain', x => { delete one(x, 'rt-refund-agent').domain; }, /runtime node needs a domain/],
  ['benchmark-run-no-domain', x => { delete one(x, adRun).domain; }, /runtime node needs a domain/],
  ['benchmark-incident-no-domain', x => { delete one(x, adInc).domain; }, /runtime node needs a domain/],
  ['benchmark-deployment-leak', x => { add(x, 'ag:trace', 'dom:legal', 'DEPLOYED_IN', 'illustrative'); }, /DEPLOYED_IN differs/],
  ['benchmark-agentdojo-outcome', x => { one(x, adRun).benchmark.outcome = 'attack executed'; }, /invalid benchmark outcome/],
  ['benchmark-tau-outcome', x => { one(x, tauRun).benchmark.outcome = 'attack reported executed'; }, /invalid benchmark outcome/],
  ['benchmark-missing-outcome', x => { delete one(x, adRun).benchmark.outcome; }, /invalid benchmark outcome/],
  ['benchmark-catalogue-outcome', x => { one(x, adAgent).benchmark.outcome = 'task passed'; }, /invalid benchmark outcome/],
  ['benchmark-incident-status', x => { one(x, adInc).benchmark.status = 'observed'; }, /invalid benchmark incident status/],
  ['benchmark-incident-status-source', x => { one(x, adInc).benchmark.status = 'attempt-refused'; }, /status disagrees with source/],
  ['benchmark-incident-ordinary-run', x => { const target = x.nodes.find(n => n.kind === 'trace' && !isBenchmark(n)); one(x, adInc).parent = target.id; edgeFrom(x, adInc, 'OCCURRED_IN').t = target.id; }, /exactly one benchmark run/],
  ['benchmark-incident-two-runs', x => { add(x, adInc, tauRun, 'OCCURRED_IN'); }, /exactly one benchmark run/],
  ['benchmark-incident-source-mismatch', x => { const n = one(x, adInc); n.benchmark.source = 'tau2'; n.benchmark.status = 'attempt-refused'; n.src = [{ sys: 'tau2' }]; }, /incident and run sources disagree/],
  ['benchmark-missing-predicate', x => { const b = one(x, adInc).benchmark; delete b.predicate; delete b.refusals; delete b.refusal; }, /EXHIBITS needs a recorded predicate/],
  ['benchmark-empty-predicate', x => { const b = one(x, adInc).benchmark; b.predicate = { call: {}, args: [] }; delete b.refusals; delete b.refusal; }, /EXHIBITS needs a recorded predicate/],
  ['benchmark-missing-unmapped', x => { delete one(x, unmappedInc).benchmark.unmapped; }, /unmapped benchmark incident needs a reason/],
  ['benchmark-blank-unmapped', x => { one(x, unmappedInc).benchmark.unmapped = ' '; }, /unmapped benchmark incident needs a reason/],
  ['benchmark-missing-reported-incident', x => { removeNode(x, edgeFrom(x, adInc, 'OCCURRED_IN').s); }, /benchmark incident count must be 1/],
  ['benchmark-missing-refusal-incident', x => { removeNode(x, tauInc); }, /benchmark incident count must be 1/],
  ['benchmark-unexpected-agentdojo-incident', x => { const run = edgeFrom(x, adInc, 'OCCURRED_IN').t; one(x, run).benchmark.outcome = 'attack not executed'; }, /benchmark incident count must be 0/],
  ['benchmark-unexpected-retail-incident', x => { const run = edgeFrom(x, tauInc, 'OCCURRED_IN').t; one(x, run).benchmark.refusals = []; delete one(x, run).benchmark.refusal; }, /benchmark incident count must be 0/],
  ['benchmark-unrecognized-refusal', x => { const b = one(x, tauInc).benchmark; b.refusals = ['User not found']; delete b.refusal; delete b.predicate; }, /EXHIBITS needs a recorded predicate/],
  ['benchmark-duplicate-incident', x => { const n = structuredClone(one(x, adInc)); n.id += ':duplicate'; x.nodes.push(n); x.links.push(...x.links.filter(l => l.s === adInc).map(l => ({ ...l, s: n.id }))); }, /benchmark incident count must be 1/],
  ['benchmark-legacy-schema', x => { for (const [p, g] of Object.entries({ INSTANCE_OF: 'curated', OCCURRED_IN: 'curated', BELONGS_TO: 'curated', IMPLEMENTS: 'curated', EXHIBITS: 'curated', EXECUTED_BY: 'published', INVOKES: 'published' })) x.schema.predicates[p].review = x.schema.predicates[p].review.filter(v => v !== g); }, /schema drift/]
);
for (const [p, grade] of Object.entries({ INSTANCE_OF: 'curated', OCCURRED_IN: 'curated', BELONGS_TO: 'curated', IMPLEMENTS: 'curated', EXHIBITS: 'curated', EXECUTED_BY: 'published', INVOKES: 'published' }))
  graphFixtures.push(['ordinary-benchmark-grade-' + p, x => {
    let l = x.links.find(l => l.pred === p && !isBenchmark(one(x, l.s)));
    if (!l) { l = { s: 'rt-inc-1042', t: 'rt-refund-agent', pred: p }; x.links.push(l); }
    l.review = grade; l.src = 'tau2';
  }, /additional review grade requires a benchmark source/]);

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
const cq10Run = onto.nodes.find(n => n.kind === 'trace' && n.benchmark?.source === 'agentdojo' && n.benchmark.suite === 'banking' && String(n.benchmark.injectionTask).replace(/^injection_task_/, '') === '4' && n.benchmark.outcome === 'attack reported executed' && onto.links.some(l => l.pred === 'OCCURRED_IN' && l.t === n.id && onto.links.some(e => e.s === l.s && e.pred === 'EXHIBITS' && e.t === 'hz:haz-finance-scheduled-redirect')));
assert.ok(cq10Run, 'CQ10 negative controls require a mapped task-4 run');
const cq10Inc = onto.links.find(l => l.t === cq10Run.id && l.pred === 'OCCURRED_IN').s;
cqFixtures.push(
  ['cq10-missing-hazard', x => { removeNode(x, 'hz:haz-finance-scheduled-redirect'); }, 'CQ10', /scheduled-redirect hazard missing/],
  ['cq10-missing-model', x => { const ids = x.nodes.filter(n => n.kind === 'trace' && n.benchmark?.model === 'Meta-SecAlign-70B').map(n => n.id); ids.forEach(id => removeNode(x, id)); }, 'CQ10', /no banking task-4 benchmark runs/],
  ['cq10-invalid-outcome', x => { one(x, cq10Run.id).benchmark.outcome = 'attack executed'; }, 'CQ10', /invalid task-4 outcome/],
  ['cq10-invalid-run', x => { one(x, cq10Run.id).review = 'illustrative'; }, 'CQ10', /invalid public benchmark run/],
  ['cq10-ordinary-incident', x => { delete one(x, cq10Inc).benchmark; }, 'CQ10', /invalid reported-executed benchmark incident/],
  ['cq10-missing-occurrence', x => { x.links = x.links.filter(l => !(l.s === cq10Inc && l.pred === 'OCCURRED_IN')); }, 'CQ10', /incident count disagrees/],
  ['cq10-unreviewed-exhibit', x => { x.links.find(l => l.s === cq10Inc && l.pred === 'EXHIBITS' && l.t === 'hz:haz-finance-scheduled-redirect').review = 'published'; }, 'CQ10', /EXHIBITS must be curated/],
  ['cq10-missing-predicate', x => { delete one(x, cq10Inc).benchmark.predicate; }, 'CQ10', /mapping needs recorded predicate/],
  ['cq10-missing-matching-call', x => { delete one(x, cq10Inc).benchmark.evidenceCall; }, 'CQ10', /mapping needs recorded predicate/]
);
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
  c.kpis.find(k => k.id === 'entities').delta = typeCount(x) + ' ontology types';
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
deltaCoverage.kpis.find(k => k.id === 'entities').delta = typeCount(deltaGraph) + ' ontology types';
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

const leakedCoverage = structuredClone(cov);
leakedCoverage.kpis.find(k => k.id === 'entities').delta = onto.nodes.length + ' ontology types';
const leakDir = await stage('benchmark-coverage-leak', onto, leakedCoverage);
assert.ok((await verifyBundle(leakDir)).problems.some(p => /non-benchmark ontology node count/.test(p)));
assert.equal(cli('verify-bundle.mjs', leakDir).status, 1);
console.log('REJECT benchmark nodes in entities KPI');

/* A reported execution without a reviewed predicate remains a legitimate unmapped
   incident. CQ10 must reduce EXHIBITS counts without reducing reported counts. */
const unmappedTask4 = structuredClone(onto), before10 = evaluateCompetencies(onto).results.find(q => q.id === 'CQ10');
unmappedTask4.links = unmappedTask4.links.filter(l => !(l.s === cq10Inc && l.pred === 'EXHIBITS'));
const ub = one(unmappedTask4, cq10Inc).benchmark; delete ub.predicate; delete ub.evidenceCall; ub.unmapped = 'Synthetic control: reported execution, no reviewed predicate';
const after10 = evaluateCompetencies(unmappedTask4).results.find(q => q.id === 'CQ10');
assert.equal(after10.ok, true);
for (const model of before10.answer.models) {
  const after = after10.answer.models.find(m => m.model === model.model);
  assert.equal(after.evaluatorReportedExecutions, model.evaluatorReportedExecutions);
  assert.equal(after.runsExhibitingScheduledRedirect, model.runsExhibitingScheduledRedirect - (model.model === cq10Run.benchmark.model ? 1 : 0));
}
assert.match(after10.answer.interpretation, /benchmark runs.*not enterprise/i);
await positiveFixture('cq10-reported-but-unmapped', unmappedTask4);
const tauFailedWithRefusal = structuredClone(onto); one(tauFailedWithRefusal, tauRun).benchmark.outcome = 'task failed';
await positiveFixture('benchmark-task-failed-with-refusal', tauFailedWithRefusal);
console.log('PASS CQ10 separates reported executions from mapped runs; retail reward is independent of refused incidents');

/* Copy controls keep every old count correct and break only the new partition
   statement. Synthetic development bundles intentionally have no matching docs. */
if (!SYNTHETIC && !BENCH_SYNTHETIC) {
  const files = ['index.html', 'assurance.html', 'SECURITY_WORLD_MODEL.md', 'swm/README.md', 'swm/skills/swm-data-rebuild/SKILL.md'];
  const copy = Object.fromEntries(await Promise.all(files.map(async f => [f, await readFile(join(ROOT, f), 'utf8')])));
  for (const [name, mutate, diagnostic] of [
    ['positive', s => s, null],
    ['wrong-illustrative', s => s.replace(/(\d+) illustrative \+ (\d+) benchmark/, (_, a, b) => (+a + 1) + ' illustrative + ' + b + ' benchmark'), /illustrative L4 says/],
    ['wrong-benchmark', s => s.replace(/(\d+) illustrative \+ (\d+) benchmark/, (_, a, b) => a + ' illustrative + ' + (+b + 1) + ' benchmark'), /benchmark L4 says/],
    ['missing-partition', s => s.replace(/\d+ illustrative \+ \d+ benchmark/g, 'partition counts omitted'), /rule "L4 partition" matched nothing/]
  ]) {
    const directory = join(temp, 'copy-' + name);
    for (const f of files) {
      await mkdir(dirname(join(directory, f)), { recursive: true });
      await writeFile(join(directory, f), f === 'index.html' ? mutate(copy[f]) : copy[f]);
    }
    const r = spawnSync(process.execPath, [join(SCRIPTS, 'check-copy.mjs'), directory, '--data', DATA], { encoding: 'utf8' });
    assert.equal(r.status, diagnostic ? 1 : 0, 'L4 partition copy ' + name);
    if (diagnostic) assert.match(r.stdout, diagnostic);
    await writeFile(join(directory, 'proof.log'), r.stdout + r.stderr);
  }
  console.log('PASS L4 copy partition positive and three isolated negatives');
}

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
