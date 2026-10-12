// logs/2026-10-11_FLEET_ONTOLOGY_GRAPH_PLAN.md, task T1: the fleet ontology model (js/rt-onto-fleet-model.js) and the
// two generated files (tools/gen-onto-data.mjs). Pure node: no browser, no git, no network, so it also runs in CI's
// `git archive` export. The schema graph is checked against the pack, the per-call facts and decisions against the
// vendored engine run here independently, the queues and X1 chain against fleetModel(), and both data files against a
// fresh generation byte for byte; the files list is also checked against this test's own walk of the file system.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fleetOntology, loadFleetOntology, sliceExport, PACK_PATH, FILES_PATH, TOOL_ACTION, PREFIX_CLASS,
} from '../../js/rt-onto-fleet-model.js';
import { fleetModel, FACT_OF_RULE } from '../../js/rt-fleet.js';
import { generate, SLICE_PATH } from '../../tools/gen-onto-data.mjs';
import { runStream, prepareSpan } from '../../jev-runtime/demo/js/engine/router.js';
import { TENANT, scenariosFor } from '../../jev-runtime/demo/js/engine/scenarios.js';
import { buildState } from '../../jev-runtime/demo/js/engine/state.js';
import { DEFAULT_POLICY } from '../../jev-runtime/demo/js/engine/types.js';
import { DOMAINS } from '../../jev-runtime/demo/js/engine/domains.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const readJson = rel => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const pack = readJson(PACK_PATH);
const bundle = readJson('swm/data/ontology.json');
const files = readJson(FILES_PATH);
const m = fleetOntology(pack, files, { seed: 7 });
const NON_EXECUTING = new Set(['hold_for_review', 'hold_for_approval', 'deny', 'stop_and_handover']);
const key = t => JSON.stringify([t.s, t.p, t.o, t.grade ?? null]);
const trace = id => m.traces.find(t => t.id === id);

test('counts match the plan and the pack', () => {
  assert.deepEqual(m.counts, {
    classes: 39, teams: 5, relations: 30, predicates: 27, anchors: 14, attributes: 10, traces: 22, calls: 30, triples: 78, rules: 8,
  });
  assert.equal(m.schema.nodes.length, 39 + 5 + 14 + 10);
  assert.deepEqual(m.pack, {
    id: pack.meta.id, title: pack.meta.title, tenant: pack.meta.tenant, candidate: true, outside_coverage: true, path: PACK_PATH,
  });
  assert.equal(m.files, files, 'the files list is passed through');
});

test('predicates: one per pack predicate, marked relation, attribute or meta', () => {
  assert.deepEqual(m.predicates.map(p => p.id), Object.keys(pack.predicates));
  for (const p of m.predicates) {
    const sig = pack.predicates[p.id];
    const want = ['SUBCLASS_OF', 'COMPLETE_FOR'].includes(p.id) ? 'meta' : sig.range.includes('literal') ? 'attribute' : 'relation';
    assert.equal(p.kind, want, p.id);
    assert.deepEqual(p.domain, sig.domain);
    assert.deepEqual(p.range, sig.range);
  }
});

test('schema: links resolve, relations are the pack edges, eleven action classes, 14 anchors', () => {
  const ids = new Set(m.schema.nodes.map(n => n.id));
  assert.equal(ids.size, m.schema.nodes.length, 'node ids are unique');
  for (const l of m.schema.links) {
    assert.ok(ids.has(l.s), `link source ${l.s} is a node`);
    assert.ok(ids.has(l.o), `link target ${l.o} is a node`);
  }
  // Every relation/owned link is exactly one pack edge, with its grade, and every edge is drawn once.
  const rel = m.schema.links.filter(l => l.role === 'relation' || l.role === 'owned');
  assert.deepEqual(rel.map(key).sort(), pack.edges.map(key).sort());
  for (const l of rel) assert.equal(l.role, l.p === 'OWNED_BY_TEAM' ? 'owned' : 'relation');
  assert.equal(rel.filter(l => l.role === 'owned').length, 10);
  // One subclass link per class.
  const sub = m.schema.links.filter(l => l.role === 'subclass');
  assert.deepEqual(sub.map(l => `${l.s}>${l.o}`).sort(), pack.classes.map(c => `${c.id}>${c.subClassOf}`).sort());
  // Roles.
  const role = r => m.schema.nodes.filter(n => n.role === r);
  assert.equal(role('action').length, 11);
  assert.ok(role('action').some(n => n.id === 'pack:ReviewableAction'), 'the root action is an action');
  assert.equal(role('class').length + role('action').length, pack.classes.length);
  assert.deepEqual(role('team').map(n => n.id).sort(), pack.teams.map(t => t.id).sort());
  // Anchors: the non-pack superclasses, labelled as in swm/data/ontology.json, each with a World Model route.
  const anchors = role('anchor');
  assert.deepEqual(anchors.map(n => n.id).sort(), [...new Set(pack.classes.map(c => c.subClassOf).filter(s => !s.startsWith('pack:')))].sort());
  assert.equal(anchors.length, 14);
  for (const a of anchors) {
    const b = bundle.nodes.find(n => n.id === a.id);
    assert.ok(b, `${a.id} is in the bundle`);
    assert.equal(a.label, b.label, a.id);
    assert.equal(a.wm, `#view=security-model&tab=wm-ontology&node=${encodeURIComponent(a.id)}`);
  }
});

test('attribute boxes: ten, on the top class of each kind, one attribute link each', () => {
  const boxes = m.schema.nodes.filter(n => n.role === 'attribute');
  const per = {};
  for (const b of boxes) per[b.label] = (per[b.label] ?? 0) + 1;
  assert.deepEqual(per, { EXPIRES: 1, STATUS: 2, REFUNDED_USD: 1, LIMIT_USD: 3, SPENT_USD: 1, VERIFICATION_LEVEL: 1, REQUIRES_VERIFICATION: 1 });
  const links = m.schema.links.filter(l => l.role === 'attribute');
  assert.equal(links.length, boxes.length);
  const byClass = new Map(pack.classes.map(c => [c.id, c]));
  for (const b of boxes) {
    const l = links.filter(x => x.o === b.id);
    assert.equal(l.length, 1, `${b.id} has one link`);
    const [p, cls] = b.id.replace(/^attr:/, '').split('@');
    assert.equal(l[0].p, p); assert.equal(l[0].s, cls); assert.equal(b.label, p);
    const c = byClass.get(cls), sig = pack.predicates[p];
    assert.ok(sig.range.includes('literal') && p !== 'COMPLETE_FOR', `${p} is literal-valued`);
    assert.ok(sig.domain.includes(c.kind), `${cls} is in ${p}'s domain`);
    assert.notEqual(byClass.get(c.subClassOf)?.kind, c.kind, `${cls}'s superclass is of another kind`);
  }
  assert.deepEqual(links.filter(l => l.p === 'REQUIRES_VERIFICATION').map(l => l.s), ['pack:ReviewableAction']);
  assert.ok(!boxes.some(b => b.label === 'COMPLETE_FOR'), 'COMPLETE_FOR is not drawn as boxes');
});

test('TOOL_ACTION covers every reviewed tool, and each action class is owned by that tool\'s reviewer', () => {
  const reviewers = DOMAINS.creator.reviewers;
  assert.deepEqual(Object.keys(TOOL_ACTION).sort(), Object.keys(reviewers).sort());
  const owned = new Map(pack.edges.filter(e => e.p === 'OWNED_BY_TEAM').map(e => [e.s, e.o]));
  for (const [tool, cls] of Object.entries(TOOL_ACTION)) {
    assert.equal(owned.get(cls), `team:${reviewers[tool]}`, tool);
  }
  for (const cls of Object.values(PREFIX_CLASS)) assert.ok(pack.classes.some(c => c.id === cls), `${cls} is a pack class`);
});

test('every instance in every slice maps to a pack class; literals never merge', () => {
  const classes = new Set(pack.classes.map(c => c.id));
  for (const t of m.traces) for (const c of t.calls) {
    const nodes = new Map(c.facts.nodes.map(n => [n.id, n]));
    assert.equal(nodes.size, c.facts.nodes.length, `${t.id}#${c.index}: node ids unique`);
    for (const n of c.facts.nodes) {
      if (n.literal) assert.equal(n.cls, null);
      else assert.ok(classes.has(n.cls), `${t.id}#${c.index}: ${n.id} → ${n.cls}`);
    }
    for (const l of c.facts.links) assert.equal(nodes.get(l.s).literal, false, `${t.id}#${c.index}: subject ${l.s} is an instance`);
    const lits = c.facts.links.filter(l => nodes.get(l.o).literal).map(l => l.o);
    assert.equal(new Set(lits).size, lits.length, `${t.id}#${c.index}: one literal node per triple`);
  }
});

test('per-call facts, used flags and decisions equal the engine\'s own per-call results', () => {
  const run = (t, ontology) => runStream(t.spans, { tenant: TENANT, policy: DEFAULT_POLICY, seed: 7, ontology })
    .filter(e => e.boundary === 'pre_tool')
    .map(e => ({ decision: e.decision, stopped: NON_EXECUTING.has(e.action), rules: (e.rule_hits ?? []).map(h => h.id) }));
  const engine = scenariosFor('creator');
  assert.deepEqual(m.traces.map(t => t.id), engine.map(t => t.scenario));
  for (const et of engine) {
    const t = trace(et.scenario);
    const spans = et.spans.filter(sp => sp.boundary === 'pre_tool');
    const on = run(et, true), off = run(et, false);
    assert.equal(t.calls.length, spans.length, et.scenario);
    assert.equal(t.variant, et.scenario.slice(-1));
    spans.forEach((sp, i) => {
      const c = t.calls[i];
      assert.equal(c.index, i);
      assert.equal(c.tool, sp.tool.name);
      assert.equal(c.as_of, sp.context?.creator?.as_of ?? null);
      assert.deepEqual(c.on, on[i], `${et.scenario}#${i} with the slice`);
      assert.deepEqual(c.off, off[i], `${et.scenario}#${i} trace only`);
      const used = new Set(Object.values(buildState(prepareSpan(sp, { ontology: true }), [], TENANT, 0).facts.creator?.used ?? {}).flat().map(key));
      const triples = sp.context?.creator?.triples ?? [];
      assert.equal(c.facts.links.length, triples.length);
      c.facts.links.forEach((l, j) => {
        const tr = triples[j];
        const o = c.facts.nodes.find(n => n.id === l.o);
        assert.equal(l.s, tr.s); assert.equal(l.p, tr.p); assert.equal(l.grade, tr.grade);
        assert.equal(o.literal ? o.label : o.id, String(tr.o));
        assert.equal(l.used, used.has(key(tr)), `${et.scenario}#${i}: ${key(tr)} used`);
      });
    });
    const first = t.calls.findIndex(c => c.on.stopped);
    assert.equal(t.deciding, first >= 0 ? first : t.calls.length - 1, `${et.scenario} deciding call`);
  }
});

test('SD1b: the license is valid on the first call and expired on the second', () => {
  const t = trace('SD1b');
  assert.equal(t.calls.length, 2);
  const [a, b] = t.calls;
  assert.equal(a.as_of, '2026-10-10');
  assert.equal(a.on.decision, 'ALLOW'); assert.equal(a.on.stopped, false); assert.equal(a.off.decision, 'ALLOW');
  assert.equal(a.facts.links.filter(l => l.used).length, 0);
  assert.equal(b.as_of, '2026-10-20');
  assert.equal(b.on.decision, 'BLOCK'); assert.equal(b.on.stopped, true); assert.deepEqual(b.on.rules, ['asset_license']);
  assert.equal(b.off.stopped, false);
  assert.ok(b.facts.links.some(l => l.used && l.p === 'EXPIRES'));
  assert.equal(t.deciding, 1);
});

test('SD2b: spend 300, 700, 950 across allow, allow, hold; only the holding call has used triples', () => {
  const t = trace('SD2b');
  assert.equal(t.calls.length, 3);
  const spent = t.calls.map(c => {
    const l = c.facts.links.find(x => x.p === 'SPENT_USD');
    return c.facts.nodes.find(n => n.id === l.o).label;
  });
  assert.deepEqual(spent, ['300', '700', '950']);
  assert.deepEqual(t.calls.map(c => c.on.decision), ['ALLOW', 'ALLOW', 'HOLD']);
  assert.deepEqual(t.calls.map(c => c.on.stopped), [false, false, true]);
  assert.deepEqual(t.calls.map(c => c.facts.links.some(l => l.used)), [false, false, true]);
  assert.deepEqual(t.calls[2].on.rules, ['cumulative_limit']);
  assert.equal(t.deciding, 2);
});

test('risky traces: ten of eleven are stopped with the slice (not TR2b), each with used triples on its deciding call', () => {
  const risky = m.traces.filter(t => t.variant === 'b');
  assert.equal(risky.length, 11);
  const stopped = risky.filter(t => t.calls.some(c => c.on.stopped));
  assert.deepEqual(risky.filter(t => !stopped.includes(t)).map(t => t.id), ['TR2b']);
  for (const t of stopped) {
    assert.ok(t.calls[t.deciding].facts.links.some(l => l.used), `${t.id}: the deciding call has a used triple`);
  }
  assert.ok(trace('X1Bb').calls[trace('X1Bb').deciding].facts.links.some(l => l.used));
});

test('the eight rules: predicates read, lists declared complete, traces stopped', () => {
  const preds = new Set(Object.keys(pack.predicates));
  const relations = new Set(m.predicates.filter(p => p.kind === 'relation').map(p => p.id));
  assert.deepEqual(m.rules.map(r => r.id), DOMAINS.creator.rules.map(r => r[0]));
  for (const r of m.rules) {
    const row = DOMAINS.creator.rules.find(x => x[0] === r.id);
    assert.equal(r.effect, row[1]); assert.equal(r.text, row[3]); assert.deepEqual(r.tools, row[2].split(' · '));
    assert.ok(r.predicates.length > 0, `${r.id} reads at least one predicate`);
    for (const p of r.predicates) assert.ok(preds.has(p), `${r.id}: ${p} is a pack predicate`);
    for (const p of r.complete) assert.ok(relations.has(p), `${r.id}: complete ${p} is a relation predicate`);
    assert.deepEqual(r.predicates, [...r.predicates].sort());
    assert.deepEqual(r.complete, [...r.complete].sort());
    assert.ok(FACT_OF_RULE[r.id], `${r.id} has a fact`);
    assert.ok(r.stoppedOn.length > 0, `${r.id} stops at least one trace with the slice`);
    assert.deepEqual(r.stoppedOff, [], `${r.id} stops nothing trace-only`);
  }
  const rule = id => m.rules.find(r => r.id === id);
  assert.deepEqual(rule('cross_principal_read').predicates, ['COMPLETE_FOR']);
  for (const p of ['MANAGES', 'HAS_SCOPE']) assert.ok(rule('cross_principal_read').complete.includes(p), p);
  assert.ok(rule('mcn_payout_scope').predicates.includes('HAS_SCOPE') && rule('mcn_payout_scope').complete.includes('HAS_SCOPE'));
  assert.ok(rule('asset_license').predicates.includes('LICENSED_UNDER') && rule('asset_license').complete.includes('LICENSED_UNDER'));
  assert.deepEqual(rule('ad_use_eligibility').stoppedOn, ['X1Cb', 'X1Bb']);
});

test('queues and the X1 chain are fleetModel()\'s', () => {
  const fm = fleetModel({ seed: 7 });
  assert.deepEqual(m.queues, fm.queues);
  assert.deepEqual(m.x1, fm.x1);
  assert.equal(m.queues.on.total, 10);
  assert.equal(m.queues.off.total, 0);
});

test('loadFleetOntology fetches the pack and the files list', async () => {
  const asked = [];
  const got = await loadFleetOntology({ fetchJson: async url => { asked.push(url); return readJson(url); } });
  assert.deepEqual(asked.sort(), [FILES_PATH, PACK_PATH].sort());
  assert.deepEqual(got.counts, m.counts);
  assert.deepEqual(got.files, files);
  await assert.rejects(loadFleetOntology({ fetchJson: async () => { throw new Error('offline'); } }), /offline/);
});

test('both generated files equal a fresh generation byte for byte', () => {
  const fresh = generate(ROOT);
  for (const path of [SLICE_PATH, FILES_PATH]) {
    assert.equal(readFileSync(join(ROOT, path), 'utf8'), fresh[path], `${path} is stale: run node tools/gen-onto-data.mjs`);
  }
  const slice = readJson(SLICE_PATH);
  assert.equal(slice.vendored_commit, readJson('jev-runtime/VENDORED.json').commit);
  assert.deepEqual(slice.traces, sliceExport({ seed: 7 }).traces);
  assert.equal(slice.traces.reduce((n, t) => n + t.calls.reduce((k, c) => k + c.triples.length, 0), 0), 78);
});

test('the files list names every ontology-related JSON file on disk, and nothing else', () => {
  // This test's own walk, independent of the generator's.
  const found = [];
  const walk = dir => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.json')) {
        const rel = relative(ROOT, full).split(sep).join('/');
        if (/onto|ontology|packs\//.test(rel)) found.push(rel);
      }
    }
  };
  walk(ROOT);
  const want = new Set([...found, 'swm/data/coverage.json', 'swm/tools/sources/MANIFEST.json', SLICE_PATH, FILES_PATH]);
  const listed = files.files.map(f => f.path);
  assert.equal(new Set(listed).size, listed.length, 'paths are unique');
  const extra = listed.filter(p => !want.has(p)), missing = [...want].filter(p => !listed.includes(p));
  assert.deepEqual({ extra, missing }, { extra: [], missing: [] }, `files list out of date; extra: ${extra.join(', ') || 'none'}; missing: ${missing.join(', ') || 'none'}`);
  assert.equal(listed.length, 193);
  const exp = files.files.filter(f => f.group === 'experiments');
  assert.equal(exp.length, 180);
  for (const f of files.files) {
    assert.ok(existsSync(join(ROOT, f.path)), `${f.path} exists`);
    assert.ok(['fleet', 'measured', 'experiments', 'site'].includes(f.group), `${f.path}: group ${f.group}`);
    assert.ok(f.holds && f.usedBy, `${f.path} is described`);
    if (f.path === FILES_PATH) assert.equal(f.bytes, undefined, 'the list has no size of its own');
    else assert.equal(typeof f.bytes, 'number', `${f.path} has a size`);
  }
  assert.deepEqual(files.groups.map(g => g.id), ['fleet', 'measured', 'experiments', 'site']);
  for (const f of exp) {
    const dir = f.path.slice('swm/experiments/ontology-value/'.length).split('/').slice(0, -1).join('/') || '.';
    assert.equal(f.holds, files.folders[dir], `${f.path} carries its folder's description`);
  }
});
