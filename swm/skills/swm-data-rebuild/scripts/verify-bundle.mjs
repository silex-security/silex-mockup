#!/usr/bin/env node
/* Independent bundle verifier. Run: node verify-bundle.mjs [data-directory]
   Local signatures transcribed from frozen T0, commit f3ec706.
   Do not import schema.mjs: its shipped compact schema is checked against this copy. */
import { readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REVIEW = ['published', 'curated', 'heuristic', 'illustrative'];
const RUNTIME = ['planner', 'memory-st', 'memory-lt', 'retriever', 'tool-reg', 'mcp', 'subagent',
  'cred-store', 'exec-ctx', 'guardrail', 'hitl', 'trace', 'harness', 'incident'];
const CORE = ['core', 'action', 'effect', 'state', 'control', 'evidence', 'objective', 'hazard'];
const KINDS = new Set(['group', 'class', 'countermeasure', 'tactic', 'technique', ...CORE,
  'domain', 'capability', 'workflow', 'entity', 'component', 'record', 'risk', ...RUNTIME]);
const PUBLIC = ['class', 'countermeasure', 'tactic', 'technique', 'risk'];
const GROUPABLE = ['class', 'countermeasure', 'tactic', 'technique', ...CORE, 'entity', 'component', 'risk', 'record'];
const product = (ss, ts) => ss.flatMap(s => ts.map(t => s + '>' + t));
const rule = (pairs, review) => ({ pairs, review });
const TREE = ['SUBCLASS_OF', 'GROUPED_UNDER', 'PART_OF', 'PART_OF_DOMAIN', 'ACHIEVES', 'INSTANCE_OF', 'OCCURRED_IN'];
const predicates = {
  SUBCLASS_OF: rule(['class>class', 'countermeasure>countermeasure', 'core>core', 'action>action',
    'effect>effect', 'state>state', 'control>control', 'evidence>evidence', 'objective>objective',
    'hazard>hazard', 'entity>core', 'component>core'], ['published', 'curated']),
  GROUPED_UNDER: rule(product(GROUPABLE, ['group']), ['curated']),
  PART_OF: rule(['capability>domain', 'workflow>capability', 'record>component'], ['curated', 'illustrative']),
  PART_OF_DOMAIN: rule(product(['entity', 'action', 'hazard', 'effect', 'state'], ['domain']), ['curated']),
  ACHIEVES: rule(['technique>tactic'], ['published']),
  INSTANCE_OF: rule(product(RUNTIME, ['component']), ['illustrative']),
  OCCURRED_IN: rule(['incident>trace'], ['illustrative']),
  DEPLOYED_IN: rule(['component>domain'], ['illustrative']),
  THREATENS: rule(product(['technique', 'risk'], ['component']), ['heuristic', 'curated']),
  COUNTERS: rule(product(['countermeasure', 'control'], ['technique', 'risk']), ['curated']),
  RELATED_MATCH: rule(product(CORE, PUBLIC), ['curated']),
  USED_IN: rule(['action>workflow'], ['curated']),
  MAY_CAUSE: rule(['action>effect'], ['curated']),
  HAZARD_FOR: rule(product(['hazard'], ['entity', 'action']), ['curated']),
  MAY_LEAD_TO: rule(product(['hazard'], ['effect', 'state']), ['curated']),
  CHARACTERIZES: rule(product(['hazard'], ['technique', 'tactic', 'risk']), ['curated']),
  MITIGATED_BY: rule(product(['hazard'], ['control', 'countermeasure']), ['curated']),
  REQUIRES_EVIDENCE: rule(['hazard>evidence'], ['curated']),
  RECORDED_BY: rule(['evidence>record'], ['curated']),
  BELONGS_TO: rule(product(RUNTIME, ['domain']), ['illustrative']),
  REALISES: rule(['trace>workflow'], ['illustrative']),
  IMPLEMENTS: rule(['tool-reg>action'], ['illustrative']),
  EXHIBITS: rule(['incident>hazard'], ['illustrative'])
};
/* T0 intentionally permits every runtime-kind pair for these fixture predicates. */
for (const p of ['DELEGATES_AUTHORITY', 'AUTHORIZES', 'READS_WRITES', 'RETRIEVES_FROM', 'CALLS', 'MUTATES',
  'GOVERNS', 'GATES', 'EXECUTED_BY', 'REACHES', 'CONTRIBUTED_TO', 'INTENDS', 'INVOKES', 'INFORMS', 'CAN_REACH'])
  predicates[p] = rule(product(RUNTIME, RUNTIME), ['illustrative']);
export const LOCAL_SCHEMA = { review: REVIEW, inheritance: ['SUBCLASS_OF'], tree: TREE, predicates };

function canonical(x) {
  if (Array.isArray(x)) return x.map(canonical).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (x && typeof x === 'object') return Object.fromEntries(Object.keys(x).sort().map(k => [k, canonical(x[k])]));
  return x;
}
const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const bump = (o, k) => { o[k] = (o[k] || 0) + 1; };
const edgeKey = (s, t, p) => JSON.stringify([s, t, p]);

function cycles(edges) {
  const adjacency = new Map(), color = new Map(), path = [], found = [];
  for (const [s, t] of edges) {
    if (!adjacency.has(s)) adjacency.set(s, new Set());
    adjacency.get(s).add(t);
  }
  function visit(id) {
    color.set(id, 1); path.push(id);
    for (const next of adjacency.get(id) || []) {
      if (color.get(next) === 1) found.push([...path.slice(path.indexOf(next)), next]);
      else if (!color.has(next)) visit(next);
    }
    path.pop(); color.set(id, 2);
  }
  for (const id of adjacency.keys()) if (!color.has(id)) visit(id);
  return found;
}

export function validateGraph(onto) {
  const problems = [], fail = m => problems.push(m);
  const metrics = { layerCount: {}, bySrc: {}, displayCycles: 0, subclassCycles: 0, signatureViolations: 0 };
  if (!Array.isArray(onto?.nodes) || !Array.isArray(onto?.links) || !Array.isArray(onto?.groups))
    return { problems: ['ontology needs nodes, links and groups arrays'], metrics };
  const { nodes, links } = onto, byId = new Map(nodes.map(n => [n.id, n]));
  const groups = new Set(onto.groups.map(g => g.id));
  const valid = links.filter(l => byId.has(l.s) && byId.has(l.t));
  const edges = new Set(valid.map(l => edgeKey(l.s, l.t, l.pred)));
  const out = (id, pred) => valid.filter(l => l.s === id && l.pred === pred).map(l => byId.get(l.t));
  if (onto.version !== 'swm-2.0') fail('version: expected swm-2.0, got ' + onto.version);
  if (!equal(onto.schema, LOCAL_SCHEMA)) fail('schema drift: bundled schema differs from independent frozen T0 table');
  if (byId.size !== nodes.length) fail('ontology.nodes contains duplicate ids');
  for (const n of nodes) {
    bump(metrics.layerCount, n.layer);
    if (typeof n.id !== 'string' || !n.id) fail('node has no string id');
    if (![1, 2, 3, 4].includes(n.layer)) fail(n.id + ': layer outside 1..4');
    if (!KINDS.has(n.kind)) fail(n.id + ': unknown kind ' + n.kind);
    if (!groups.has(n.group)) fail(n.id + ': unknown group ' + n.group);
    if (!Array.isArray(n.src) || !n.src.length) fail(n.id + ': no src');
    else for (const s of n.src) {
      if (!s?.sys) fail(n.id + ': source has no sys');
      else bump(metrics.bySrc, s.sys);
    }
    if (!REVIEW.includes(n.review)) fail(n.id + ': missing or invalid node review ' + n.review);
    if (n.layer === 4 && n.review !== 'illustrative') fail(n.id + ': runtime node must be illustrative');
    if (n.review === 'published' && !(n.src || []).some(s => s.sys && s.sys !== 'silex'))
      fail(n.id + ': published node has no public source');
    if (n.kind === 'entity' && /\(prohibited\)/i.test(n.label || '')) fail(n.id + ': (prohibited) entity must be retyped');
    if (n.prohibited && (n.layer !== 2 || !['effect', 'state'].includes(n.kind)))
      fail(n.id + ': prohibited outcome must be an L2 effect or state');
    if (n.candidate && (n.kind !== 'domain' || n.layer !== 2 || n.review !== 'curated'))
      fail(n.id + ': candidate must be a curated L2 domain');
  }
  for (const l of links) {
    const s = byId.get(l.s), t = byId.get(l.t), sig = predicates[l.pred];
    if (!s) fail('link source missing: ' + l.s);
    if (!t) fail('link target missing: ' + l.t);
    if (l.pred === 'SPECIALIZES') fail('SPECIALIZES is retired: ' + l.s + ' -> ' + l.t);
    if (!sig) { fail('unknown predicate ' + l.pred); metrics.signatureViolations++; }
    else {
      if (s && t && !sig.pairs.includes(s.kind + '>' + t.kind)) {
        fail('signature violation ' + l.pred + ': ' + l.s + ' (' + s.kind + ') -> ' + l.t + ' (' + t.kind + ')');
        metrics.signatureViolations++;
      }
      if (!sig.review.includes(l.review)) fail(l.pred + ': missing or disallowed link review ' + l.review + ' (' + l.s + ' -> ' + l.t + ')');
    }
    if (!l.src) fail(l.pred + ': missing link source provenance');
    if (l.review === 'published' && l.src === 'silex') fail(l.pred + ': Silex assertion cannot be published');
    if (l.pred === 'CHARACTERIZES' && t && (t.review !== 'published' || !(t.src || []).some(s => s.sys && s.sys !== 'silex')))
      fail(l.s + ': CHARACTERIZES must target a published threat');
    if (l.pred === 'MAY_LEAD_TO' && t && !t.prohibited) fail(l.s + ': MAY_LEAD_TO target is not prohibited');
  }

  const roots = nodes.filter(n => n.anchor);
  if (!roots.length) fail('no anchor nodes');
  function parentRule(n, pred, kind, layer, id) {
    const p = byId.get(n.parent);
    if (n.parentPred !== pred || !p || p.kind !== kind || p.layer !== layer || (id && p.id !== id))
      fail(n.id + ': display parent must use ' + pred + ' to ' + (id || ('L' + layer + ' ' + kind)));
  }
  function subtypeRule(n, kind) {
    if (!out(n.id, 'SUBCLASS_OF').some(p => p.layer === 1 && p.kind === kind))
      fail(n.id + ': missing SUBCLASS_OF an L1 ' + kind);
  }
  for (const n of nodes) {
    if (n.anchor) {
      if (n.parent != null || n.parentPred != null) fail(n.id + ': anchor must have no parent or parentPred');
      if (!((n.layer === 1 && n.kind === 'group') || (n.layer === 2 && n.kind === 'domain')))
        fail(n.id + ': only L1 groups and L2 domains are anchors');
    } else {
      const p = byId.get(n.parent);
      if (!p) fail(n.id + ': display parent missing: ' + n.parent);
      if (!TREE.includes(n.parentPred)) fail(n.id + ': parentPred not a tree predicate: ' + n.parentPred);
      if (p && p.layer > n.layer) fail(n.id + ': display parent layer exceeds child layer');
      if (!edges.has(edgeKey(n.id, n.parent, n.parentPred))) fail(n.id + ': display-parent edge missing');
    }
    if (n.kind === 'domain' && (n.layer !== 2 || !n.anchor || n.parent != null)) fail(n.id + ': domain must be an L2 anchor');
    if (n.layer === 2) {
      if (n.kind === 'capability') parentRule(n, 'PART_OF', 'domain', 2);
      if (n.kind === 'workflow') parentRule(n, 'PART_OF', 'capability', 2);
      if (['entity', 'action', 'hazard', 'effect', 'state'].includes(n.kind)) parentRule(n, 'PART_OF_DOMAIN', 'domain', 2);
      if (n.kind === 'entity') subtypeRule(n, 'core');
      if (n.kind === 'action' || n.prohibited) subtypeRule(n, n.kind);
    }
    if (n.layer === 3 && n.kind === 'component') parentRule(n, 'SUBCLASS_OF', 'core', 1);
    if (n.layer === 3 && n.kind === 'record') parentRule(n, 'PART_OF', 'component', 3, 'ag:trace');
    if (n.layer === 3 && n.kind === 'technique') parentRule(n, 'ACHIEVES', 'tactic', 1);
    if (n.layer === 3 && n.kind === 'risk') parentRule(n, 'GROUPED_UNDER', 'group', 1, 'grp:threat');
    if (n.layer === 4) {
      if (n.kind === 'incident') parentRule(n, 'OCCURRED_IN', 'trace', 4);
      else {
        parentRule(n, 'INSTANCE_OF', 'component', 3, 'ag:' + n.kind);
        if (!equal([...new Set(out(n.id, 'INSTANCE_OF').map(p => p.id))], ['ag:' + n.kind]))
          fail(n.id + ': INSTANCE_OF set disagrees with runtime kind');
      }
      if (n.domain) {
        if (byId.get('dom:' + n.domain)?.kind !== 'domain') fail(n.id + ': runtime domain missing');
        if (!equal([...new Set(out(n.id, 'BELONGS_TO').map(p => p.id))], ['dom:' + n.domain]))
          fail(n.id + ': BELONGS_TO disagrees with runtime domain');
      }
    }
  }
  if (byId.has('dom:horizontal')) fail('dom:horizontal is retired');
  for (const [name, pairs] of [
    ['display-parent', nodes.filter(n => n.parent).map(n => [n.id, n.parent])],
    ['SUBCLASS_OF', valid.filter(l => l.pred === 'SUBCLASS_OF').map(l => [l.s, l.t])]
  ]) {
    const found = cycles(pairs);
    metrics[name === 'display-parent' ? 'displayCycles' : 'subclassCycles'] = found.length;
    for (const path of found) fail(name + ' cycle: ' + path.join(' -> '));
  }
  const reachable = new Set(roots.map(n => n.id));
  let added = true;
  while (added) {
    added = false;
    for (const n of nodes) if (!reachable.has(n.id) && reachable.has(n.parent)) { reachable.add(n.id); added = true; }
  }
  const unreachable = nodes.filter(n => !reachable.has(n.id));
  if (unreachable.length) fail(unreachable.length + ' nodes unreachable from anchors: ' + unreachable.slice(0, 3).map(n => n.id).join(', '));

  for (const c of nodes.filter(n => n.layer === 3 && n.kind === 'component')) {
    const domains = new Set();
    for (const l of valid.filter(l => l.pred === 'INSTANCE_OF' && l.t === c.id)) {
      const n = byId.get(l.s);
      if (n.layer !== 4) fail(c.id + ': INSTANCE_OF source not L4');
      if (!n.domain) fail(c.id + ': runtime instance has no domain: ' + n.id);
      else domains.add('dom:' + n.domain);
    }
    if (!equal([...new Set(out(c.id, 'DEPLOYED_IN').map(n => n.id))], [...domains]))
      fail(c.id + ': DEPLOYED_IN differs from INSTANCE_OF runtime-domain set');
    if ((c.deployment === 'unobserved') !== (domains.size === 0))
      fail(c.id + ': deployment:unobserved must be set exactly when runtime-domain set is empty');
  }
  const threats = nodes.filter(n => n.layer === 3 && n.group === 'threat').map(n => n.id);
  const countered = new Set(valid.filter(l => l.pred === 'COUNTERS').map(l => l.t));
  if (!Array.isArray(onto.uncountered) || !equal(onto.uncountered, threats.filter(id => !countered.has(id))))
    fail('uncountered differs from L3 threats without COUNTERS');
  metrics.threats = threats.length; metrics.countered = threats.filter(id => countered.has(id)).length;

  if (!onto.chain) fail('ontology.chain missing');
  else {
    const layers = onto.chain.layers, hops = onto.chain.hops;
    if (!Array.isArray(layers) || !equal(layers.map(l => l.id), [1, 2, 3, 4])) fail('chain.layers must describe each layer 1..4 once');
    for (const l of Array.isArray(layers) ? layers : [])
      if (l.count !== (metrics.layerCount[l.id] || 0)) fail('chain.layers L' + l.id + ': count differs from graph');
    if (!Array.isArray(hops) || !equal(hops.map(h => h.from + ':' + h.to), ['1:2', '2:3', '3:4']))
      fail('chain.hops must describe each adjacent hop once');
    for (const h of Array.isArray(hops) ? hops : []) {
      const real = valid.filter(l => {
        const a = byId.get(l.s).layer, b = byId.get(l.t).layer;
        return (a === h.from && b === h.to) || (a === h.to && b === h.from);
      });
      const preds = {}; real.forEach(l => bump(preds, l.pred));
      if (h.count !== real.length || !equal(h.preds, preds)) fail('chain hop L' + h.from + '-L' + h.to + ': count/predicates differ from graph');
    }
    const skips = { count: 0, preds: {}, pairs: {} };
    for (const l of valid) {
      const a = byId.get(l.s).layer, b = byId.get(l.t).layer;
      if (Math.abs(a - b) < 2) continue;
      skips.count++; bump(skips.preds, l.pred); bump(skips.pairs, 'L' + Math.min(a, b) + '–L' + Math.max(a, b));
    }
    if (!equal(onto.chain.skips, skips)) fail('chain.skips count/predicates/layer pairs differ from graph');
    metrics.skips = skips.count;
  }
  for (const id of ['wf:WF-021', 'rt-inc-1042', 'dom:finance'])
    if (!byId.has(id)) fail(id + ' missing: page cross-links depend on it');
  for (const sys of ['d3fend', 'atlas', 'attack', 'uco', 'owasp'])
    if (!metrics.bySrc[sys]) fail('no nodes carry public source ' + sys);
  return { problems, metrics };
}

export function validateCoverage(cov, onto) {
  const problems = [], fail = m => problems.push(m);
  if (!cov?.tree || !Array.isArray(cov.gaps) || !Array.isArray(cov.dimensions))
    return ['coverage needs tree, gaps and dimensions'];
  const byId = new Map(onto.nodes.map(n => [n.id, n])), treeIds = new Set();
  (function walk(n) { treeIds.add(n.id); (n.children || []).forEach(walk); })(cov.tree);
  for (const g of cov.gaps) for (const s of g.scope || []) if (!treeIds.has(s)) fail('gap ' + g.id + ': scope not in coverage tree: ' + s);
  for (const d of cov.tree.children || []) {
    const n = byId.get('dom:' + d.id);
    if (!n) fail('coverage domain has no ontology node: ' + d.id);
    else if (n.candidate) fail('candidate domain must not enter coverage tree: ' + d.id);
  }
  if (!cov.kpis?.length) fail('coverage.kpis is empty');
  for (const dim of cov.dimensions) if (!(dim.id in (cov.tree.dims || {}))) fail('coverage.tree.dims missing ' + dim.id);
  if (cov.tree.ontologyCompleteness !== undefined) fail('ontologyCompleteness must be top-level');
  const complete = cov.ontologyCompleteness;
  if (!complete?.domains || complete.label !== 'Structural completeness') fail('top-level ontologyCompleteness missing or incorrectly labelled');
  else {
    const targets = (id, pred) => onto.links.filter(l => l.s === id && l.pred === pred).map(l => l.t), expected = {};
    for (const d of onto.nodes.filter(n => n.kind === 'domain')) {
      const hazards = onto.nodes.filter(n => n.layer === 2 && n.kind === 'hazard' && n.parent === d.id);
      const closed = hazards.filter(h => targets(h.id, 'CHARACTERIZES').length && targets(h.id, 'MITIGATED_BY').length &&
        targets(h.id, 'REQUIRES_EVIDENCE').length && targets(h.id, 'REQUIRES_EVIDENCE').every(e => targets(e, 'RECORDED_BY').length));
      expected[d.id.slice(4)] = { hazards: hazards.length, complete: closed.length,
        share: hazards.length ? +(closed.length / hazards.length).toFixed(3) : null, candidate: !!d.candidate };
    }
    if (!equal(complete.domains, expected)) fail('ontologyCompleteness per-domain counts/share differ from graph');
  }
  if ((cov.kpis || []).find(k => k.id === 'entities')?.delta !== onto.nodes.length + ' ontology types')
    fail('entities KPI delta must equal ontology node count');
  return problems;
}

export async function verifyBundle(directory) {
  const data = resolve(directory), notes = [], problems = [];
  const onto = JSON.parse(await readFile(join(data, 'ontology.json'), 'utf8'));
  const cov = JSON.parse(await readFile(join(data, 'coverage.json'), 'utf8'));
  const graph = validateGraph(onto);
  problems.push(...graph.problems, ...validateCoverage(cov, onto));
  for (const [file, global] of [['ontology.js', 'SILEX_SWM_ONTOLOGY'], ['coverage.js', 'SILEX_SWM_COVERAGE']]) {
    const text = await readFile(join(data, file), 'utf8');
    const match = text.match(new RegExp('window\\.' + global + '\\s*=\\s*([\\s\\S]*?)\\s*;?\\s*$'));
    if (!match) problems.push(file + ': missing window.' + global + ' assignment');
    else try {
      const payload = JSON.parse(match[1].replace(/;\s*$/, ''));
      if (JSON.stringify(payload) !== JSON.stringify(file === 'ontology.js' ? onto : cov)) problems.push(file + ' and its JSON twin disagree');
    } catch (error) { problems.push(file + ': browser payload is not JSON (' + error.message + ')'); }
    /* Retain the browser-bundle budget; use exact bytes, not rounded KB. */
    const bytes = (await stat(join(data, file))).size;
    notes.push(file + ' ' + (bytes / 1024).toFixed(1) + 'KB');
    if (bytes > 700 * 1024) problems.push(file + ': exceeds 700KB budget');
  }
  return { problems, metrics: graph.metrics, notes, onto, cov };
}

async function main() {
  const data = resolve(process.argv[2] || join(HERE, '..', '..', '..', 'data'));
  try {
    const r = await verifyBundle(data), { problems, metrics: m, onto, cov } = r;
    console.log('\nBundle: ' + data + '\n  ' + onto.nodes.length + ' nodes · ' + onto.links.length + ' links');
    console.log('  layers: ' + [1, 2, 3, 4].map(l => 'L' + l + ' ' + (m.layerCount[l] || 0)).join(' · '));
    console.log('  by source: ' + Object.entries(m.bySrc).map(([k, v]) => k + ' ' + v).join(' · '));
    console.log('  checks: ' + m.signatureViolations + ' signature violations · ' + m.displayCycles + ' display-parent cycles · ' + m.subclassCycles + ' SUBCLASS_OF cycles');
    console.log('  threats: ' + m.countered + '/' + m.threats + ' countered · ' + m.skips + ' skipped-layer links');
    if (cov.tree) console.log('  coverage: ' + Math.round(cov.tree.coverage * 100) + '% weighted · ' + cov.tree.entities?.toLocaleString() + ' entities · ' + cov.gaps?.length + ' gaps (illustrative)');
    console.log('  files: ' + r.notes.join(' · '));
    if (problems.length) {
      console.log('\n  ' + problems.length + ' problem(s):');
      problems.slice(0, 60).forEach(p => console.log('    ✗ ' + p));
      if (problems.length > 60) console.log('    … ' + (problems.length - 60) + ' more (API returns complete list)');
      process.exitCode = 1;
    } else console.log('\n  ✓ bundle matches the frozen contract, graph invariants and browser payloads\n');
  } catch (error) { console.error('verify-bundle: ' + error.message); process.exitCode = 1; }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
