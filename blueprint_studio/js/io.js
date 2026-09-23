/* Import/export, schema validation, graph diff, policy-as-code text (contract §9). */

import { SCHEMA, NODE_TYPES, canConnect, hashGraph, ok, fail, clone } from './model.js';

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
    const v = n.config[f.key];
    if (v === undefined) continue;                                   // defaults apply
    const bad = msg => fail('bad_graph', `Node ${n.id}: ${f.key} ${msg}`, { nodeId: n.id });
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
    if (!NODE_TYPES[n.type]) return fail('bad_graph', `${label}: unknown node type "${n.type}"`);
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
    if (r.validation && r.validation.revHash !== r.hash) return fail('hash_mismatch', `${label}: validation belongs to another graph`);
    if (r.optimization && (r.optimization.revHash !== r.hash || !r.validation || r.optimization.scenarioSetId !== r.validation.scenarioSetId)) return fail('hash_mismatch', `${label}: optimization belongs to another graph or scenario set`);
    if (r.decision) {
      if (!['approve', 'accept'].includes(r.decision.action)) return fail('schema', `${label}: bad decision`);
      if (r.decision.action === 'approve') {
        const child = byRev.get(r.decision.childRev);
        if (!child || child.parent !== r.rev || child.origin !== 'approve' || child.hash !== r.decision.childHash) return fail('hash_mismatch', `${label}: decision does not match its approved revision`);
      }
    }
    if (r.origin === 'approve') {
      const parent = byRev.get(r.parent);
      if (r.status !== 'confirmed' || !parent || parent.decision?.childRev !== r.rev) return fail('schema', `${label}: an approved revision needs its parent's decision`);
    }
  }
  return ok(doc);
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
