/* Import/export, schema validation, graph diff, policy-as-code text (contract §9). */

import { SCHEMA, NODE_TYPES, isNodeType, canConnect, hashGraph, applyPatch, canonical, ok, fail, clone } from './model.js';
import { generateScenarioSet } from './adversary.js';
import { validate, compactResult } from './validate.js';
import { generateCandidates, reparam, runCandidate, score } from './optimize.js';
import { decisionProblem } from './store.js';

export function exportDocument(doc) {
  return JSON.stringify(doc, null, 2);
}

/* Strict, atomic import: the document is returned only if every field has the
   type its schema says, every edge passes canConnect, revision references are
   consistent, and every confirmed revision's hash is recomputed and matches —
   so evidence can never be attached to a graph it was not computed on. */
const isStr = v => typeof v === 'string';
const isNum = v => typeof v === 'number' && Number.isFinite(v);
function checkConfig(n, ids) {
  const def = NODE_TYPES[n.type];
  for (const f of def.schema) {
    if (f.when && !f.when(n.config)) continue;                        // field does not apply to this configuration
    const v = n.config[f.key];
    const bad = msg => fail('bad_graph', `Node ${n.id}: ${f.key} ${msg}`, { nodeId: n.id });
    if (v === undefined) return bad('is missing');                     // the engine reads every applicable field
    switch (f.type) {
      case 'text': case 'expr': if (!isStr(v)) return bad('must be text'); break;
      case 'number': if (!isNum(v)) return bad('must be a number'); break;
      case 'bool': if (typeof v !== 'boolean') return bad('must be true or false'); break;
      case 'select': if (!f.options.includes(v)) return bad(`must be one of ${f.options.join(', ')}`); break;
      case 'multiselect': if (!Array.isArray(v) || v.some(x => !f.options.includes(x))) return bad('has an unknown value'); break;
      case 'range': if (!Array.isArray(v) || v.length !== 2 || !v.every(isNum) || v[1] <= v[0]) return bad('must be [lo, hi] with lo < hi'); break;
      case 'caps': if (!Array.isArray(v) || v.some(c => !c || !isStr(c.cap) || !isNum(c.limit))) return bad('must be a list of {cap, limit}'); break;
      case 'nodeRefs': if (!Array.isArray(v) || v.some(x => !ids.has(x))) return bad('references an unknown node'); break;
    }
  }
  return ok();
}
function checkGraph(g, label) {
  if (!g || !Array.isArray(g.nodes) || !Array.isArray(g.edges)) return fail('bad_graph', `${label}: graph is not {nodes, edges}`);
  const ids = new Set();
  for (const n of g.nodes) {
    if (!n || !isStr(n.id) || !n.id || ids.has(n.id)) return fail('bad_graph', `${label}: missing or duplicate node id`);
    ids.add(n.id);
    if (!isNodeType(n.type)) return fail('bad_graph', `${label}: unknown node type "${n.type}"`);
    if (!isStr(n.label) || !isNum(n.x) || !isNum(n.y)) return fail('bad_graph', `${label}: node ${n.id} needs a label and numeric x, y`);
    if (typeof n.config !== 'object' || n.config === null || Array.isArray(n.config)) return fail('bad_graph', `${label}: node ${n.id} has no config`);
  }
  for (const n of g.nodes) { const r = checkConfig(n, ids); if (!r.ok) return r; }
  const built = { nodes: g.nodes, edges: [] }, eids = new Set();
  for (const e of g.edges) {
    if (!e || !isStr(e.id) || eids.has(e.id)) return fail('bad_graph', `${label}: missing or duplicate edge id`);
    eids.add(e.id);
    if (!['flow', 'access'].includes(e.kind)) return fail('bad_graph', `${label}: edge ${e.id} has an unknown kind`);
    const r = canConnect(built, e.from || {}, e.to || {});
    if (!r.ok) return fail('bad_graph', `${label}: edge ${e.id}: ${r.error.message}`);
    if (r.value.kind !== e.kind || r.value.from.node !== e.from.node || r.value.to.node !== e.to.node) return fail('bad_graph', `${label}: edge ${e.id} is not in canonical form`);
    built.edges.push(clone(e));
  }
  return ok();
}

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const isResult = v => isObj(v) && Array.isArray(v.findings) && isObj(v.metrics) && Array.isArray(v.lint) && Array.isArray(v.runs);
const isEvidence = v => isObj(v) && Array.isArray(v.findings) && isObj(v.metrics);
const CAND_STATES = ['untested', 'running', 'tested', 'stale', 'rejected'];

/* Lifecycle evidence must be complete and must belong to this revision's graph. */
function checkEvidence(r, byRev, meta, label) {
  const bad = (code, msg) => fail(code, `${label}: ${msg}`);
  const v = r.validation, o = r.optimization, d = r.decision;
  if (v != null) {
    if (!isObj(v) || v.revHash !== r.hash || !isStr(v.scenarioSetId) || !Number.isInteger(v.n) || v.n < 1 || !isResult(v.result)) return bad('bad_evidence', 'validation is incomplete or belongs to another graph');
  }
  if (o != null) {
    if (!isObj(o) || o.revHash !== r.hash || !v || o.scenarioSetId !== v.scenarioSetId || !Array.isArray(o.candidates)) return bad('bad_evidence', 'optimization is incomplete or belongs to another graph or scenario set');
    const ids = new Set();
    for (const c of o.candidates) {
      if (!isObj(c) || !isObj(c.candidate) || !isStr(c.candidate.id) || ids.has(c.candidate.id) || !Array.isArray(c.candidate.patch) || !Number.isInteger(c.candidate.paramsVersion) || !CAND_STATES.includes(c.state)) return bad('bad_evidence', 'a candidate record is malformed');
      ids.add(c.candidate.id);
      if (c.state === 'tested' && (!isResult(c.result) || !isStr(c.result.patchedHash) || !isObj(c.verdict) || typeof c.verdict.eligible !== 'boolean')) return bad('bad_evidence', `candidate ${c.candidate.id} has no complete result`);
    }
  }
  if (d != null) {
    if (!isObj(d) || !isEvidence(d.evidence) || !isStr(d.scenarioSetId)) return bad('bad_evidence', 'decision has no evidence');
    if (d.action === 'accept') {
      if (!v || v.result.findings.length || d.scenarioSetId !== v.scenarioSetId || d.evidence.findings.length) return bad('bad_evidence', 'accept-as-is needs a completed validation with no findings');
    } else if (d.action === 'approve') {
      const c = o && o.candidates.find(x => x.candidate.id === d.candidateId);
      if (!c || !Array.isArray(d.patch) || canonical(d.patch) !== canonical(c.candidate.patch) || d.scenarioSetId !== o.scenarioSetId || !isStr(d.runId)) return bad('bad_evidence', 'approval does not match a tested candidate');
      const patched = applyPatch(r.graph, d.patch);
      const child = byRev.get(d.childRev);
      if (!patched.ok || hashGraph(patched.value, meta) !== d.childHash || !child || child.parent !== r.rev || child.origin !== 'approve' || child.hash !== d.childHash) return bad('hash_mismatch', 'approval does not match its approved revision');
    } else return bad('schema', 'bad decision');
  }
  if (r.origin === 'approve') {
    const parent = byRev.get(r.parent);
    if (r.status !== 'confirmed' || !parent || parent.decision?.action !== 'approve' || parent.decision.childRev !== r.rev || !v) return bad('schema', "an approved revision needs its parent's decision and its evidence");
  }
  return ok();
}

export function importDocument(text) {
  let doc;
  try { doc = JSON.parse(text); } catch { return fail('json_parse', 'Not valid JSON'); }
  if (!doc || typeof doc !== 'object' || doc.schema !== SCHEMA) return fail('schema', 'Not a silex.blueprint/v1 document');
  for (const k of ['id', 'name', 'domain', 'owner']) if (!isStr(doc[k]) || !doc[k]) return fail('schema', `Document ${k} must be a non-empty string`);
  if (!Array.isArray(doc.revisions) || !doc.revisions.length) return fail('schema', 'Document has no revisions');
  const byRev = new Map();
  for (const r of doc.revisions) {
    if (!r || !Number.isInteger(r.rev) || r.rev < 0 || byRev.has(r.rev)) return fail('schema', 'Revision numbers must be unique non-negative integers');
    byRev.set(r.rev, r);
  }
  if (!byRev.has(doc.activeRev)) return fail('schema', 'activeRev does not name a revision');
  if (doc.revisions.filter(r => r.status === 'draft').length > 1) return fail('schema', 'At most one draft revision');
  const meta = { name: doc.name, domain: doc.domain };
  for (const r of doc.revisions) {
    const label = 'v1.' + r.rev;
    if (!['draft', 'confirmed'].includes(r.status) || !['edit', 'approve'].includes(r.origin)) return fail('schema', `${label}: bad status or origin`);
    if (r.parent !== null && !(byRev.has(r.parent) && r.parent < r.rev)) return fail('schema', `${label}: parent must be an earlier revision`);
    const g = checkGraph(r.graph, label); if (!g.ok) return g;
    if (r.status === 'confirmed') {
      if (hashGraph(r.graph, meta) !== r.hash) return fail('hash_mismatch', `${label}: the graph does not match its confirmed hash`);
    } else if (r.hash != null || r.validation || r.optimization || r.decision) return fail('schema', `${label}: a draft carries no hash or evidence`);
    const ev = checkEvidence(r, byRev, meta, label); if (!ev.ok) return ev;
  }
  let re;
  try { re = recompute(doc, byRev, meta); }
  catch (e) { return fail('evidence_mismatch', 'The evidence cannot be recomputed: ' + String(e && e.message || e)); }   // malformed input never escapes as a throw
  if (!re.ok) return re;
  return ok(doc);
}

/* Imported evidence is never trusted: every stored validation, candidate result
   and verdict is recomputed with the same deterministic engine on the same
   scenario set and must match exactly; every decision must be consistent with
   the records it cites (the same check Register applies). */
function recompute(doc, byRev, meta) {
  const same = (a, b) => canonical(a) === canonical(b);
  for (const r of doc.revisions) {
    const label = 'v1.' + r.rev, v = r.validation;
    if (!v || r.origin === 'approve') continue;                   // an approved child's evidence is its parent's candidate run, checked below
    const set = generateScenarioSet(r.graph, { n: v.n, baseHash: r.hash });
    if (set.id !== v.scenarioSetId) return fail('evidence_mismatch', `${label}: scenario set id differs from its hash and size`);
    if (!same(compactResult(validate(r.graph, set)), v.result)) return fail('evidence_mismatch', `${label}: validation results differ from a re-run`);
    if (r.optimization) {
      const vres = { ...v.result, scenarioSetId: v.scenarioSetId };
      const generated = generateCandidates(r.graph, vres);
      for (const c of r.optimization.candidates) {
        const g0 = generated.find(x => x.id === c.candidate.id);
        if (!g0) return fail('evidence_mismatch', `${label}: candidate ${c.candidate.id} is not one the optimizer generates`);
        /* params must be exactly one of the optimizer's own options per key; then the whole
           record (label, classes, params, paramOptions, patch) must equal the regenerated one */
        const p = c.candidate.params;
        const keysOk = p && typeof p === 'object' && !Array.isArray(p) && same(Object.keys(p).sort(), Object.keys(g0.params).sort())
          && Object.keys(p).every(k => (g0.paramOptions[k] || [g0.params[k]]).some(o => same(o, p[k])));
        if (!keysOk) return fail('evidence_mismatch', `${label}: candidate ${c.candidate.id} has parameters the optimizer does not offer`);
        const expect = same(p, g0.params) ? g0 : reparam(r.graph, vres, g0, p);
        const { paramsVersion: _a, ...got } = c.candidate, { paramsVersion: _b, ...want } = expect;
        if (!same(got, want) || !Number.isInteger(c.candidate.paramsVersion) || c.candidate.paramsVersion < 1) return fail('evidence_mismatch', `${label}: candidate ${c.candidate.id} differs from what its parameters generate`);
        if (c.result == null) { if (c.state === 'tested') return fail('bad_evidence', `${label}: tested candidate without a result`); continue; }
        const run = runCandidate(r.graph, c.candidate, set, meta);
        if (!run.ok) return fail('evidence_mismatch', `${label}: candidate ${c.candidate.id} no longer applies`);
        if (!same(compactResult(run.value), c.result) || !same(score(v.result, run.value), c.verdict)) return fail('evidence_mismatch', `${label}: candidate ${c.candidate.id} results differ from a re-run`);
      }
    }
    if (r.decision) {
      const child = r.decision.action === 'approve' ? byRev.get(r.decision.childRev) : null;
      const problem = decisionProblem(r, child);
      if (problem) return fail('evidence_mismatch', `${label}: ${problem}`);
    }
  }
  return ok();
}

export function diffGraphs(a, b) {
  const byId = (g, id) => g.nodes.find(n => n.id === id);
  const aNodes = new Set(a.nodes.map(n => n.id)), bNodes = new Set(b.nodes.map(n => n.id));
  const addedNodes = b.nodes.filter(n => !aNodes.has(n.id));
  const removedNodes = a.nodes.filter(n => !bNodes.has(n.id));
  const changedNodes = [];
  for (const n of b.nodes) {
    if (!aNodes.has(n.id)) continue;
    const o = byId(a, n.id);
    const fields = [];
    for (const k of ['type', 'label']) if (JSON.stringify(o[k]) !== JSON.stringify(n[k])) fields.push(k);
    const keys = new Set([...Object.keys(o.config || {}), ...Object.keys(n.config || {})]);
    for (const k of [...keys].sort()) if (JSON.stringify((o.config || {})[k]) !== JSON.stringify((n.config || {})[k])) fields.push('config.' + k);
    if (fields.length) changedNodes.push({ id: n.id, fields });
  }
  const aEdges = new Set(a.edges.map(e => e.id)), bEdges = new Set(b.edges.map(e => e.id));
  const addedEdges = b.edges.filter(e => !aEdges.has(e.id));
  const removedEdges = a.edges.filter(e => !bEdges.has(e.id));
  return { addedNodes, removedNodes, changedNodes, addedEdges, removedEdges };
}

export function policyExport(doc, rev) {
  const r = (rev && typeof rev === 'object') ? rev : doc.revisions.find(x => x.rev === rev);
  if (!r) return '';
  const graph = r.graph;
  const lines = [`# ${doc.name} — v1.${r.rev}`, ''];
  for (const n of graph.nodes.filter(n => n.type === 'control').sort((a, b) => a.id < b.id ? -1 : 1)) {
    if (n.config.kind === 'policy_gate') {
      lines.push(`- gate "${n.label}": ${n.config.action}${n.config.action === 'redact' ? ` above ${n.config.redactAbove}` : (n.config.rule ? ` when ${n.config.rule}` : '')}`);
    } else {
      lines.push(`- approval "${n.label}": bind ${(n.config.binding || []).join(', ') || 'nothing'}${n.config.singleUse ? ' (single-use)' : ''} · SLA ${n.config.slaMinutes} min`);
    }
  }
  for (const n of graph.nodes.filter(n => n.type === 'prohibited').sort((a, b) => a.id < b.id ? -1 : 1)) {
    lines.push(`- monitor "${n.label}" (${n.config.monitor}, ${n.config.severity}) watches ${(n.config.watches || []).join(', ') || 'nothing'}`);
  }
  return lines.join('\n');
}
