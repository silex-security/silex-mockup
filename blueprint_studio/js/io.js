/* Import/export, schema validation, graph diff, policy-as-code text (contract §9). */

import { SCHEMA, NODE_TYPES, canConnect, nodeById, ok, fail, clone } from './model.js';

export function exportDocument(doc) {
  return JSON.stringify(doc, null, 2);
}

export function importDocument(text) {
  let doc;
  try { doc = JSON.parse(text); } catch { return fail('json_parse', 'Not valid JSON'); }
  if (!doc || typeof doc !== 'object' || doc.schema !== SCHEMA) return fail('schema', 'Not a silex.blueprint/v1 document');
  if (!Array.isArray(doc.revisions) || !doc.revisions.length) return fail('schema', 'Document has no revisions');
  if (typeof doc.activeRev !== 'number') return fail('schema', 'activeRev must be a number');
  for (const rev of doc.revisions) {
    if (typeof rev.rev !== 'number' || !rev.graph) return fail('schema', `Revision ${rev.rev} is malformed`);
    const g = rev.graph;
    if (!Array.isArray(g.nodes) || !Array.isArray(g.edges)) return fail('bad_graph', `Revision ${rev.rev} graph is not {nodes, edges}`);
    for (const n of g.nodes) {
      if (!n || typeof n.id !== 'string' || !NODE_TYPES[n.type]) return fail('bad_graph', `Unknown node type "${n && n.type}"`);
      if (typeof n.config !== 'object' || n.config === null) return fail('bad_graph', `Node ${n.id} has no config`);
    }
    const empty = { nodes: g.nodes, edges: [] };
    for (const e of g.edges) {
      if (!e || typeof e.id !== 'string') return fail('bad_graph', 'Edge has no id');
      if (!nodeById(empty, e.from?.node) || !nodeById(empty, e.to?.node)) return fail('bad_graph', `Edge ${e.id} references an unknown node`);
      const r = canConnect(empty, e.from, e.to);
      if (!r.ok) return fail('bad_graph', `Edge ${e.id}: ${r.error.message}`);
      empty.edges.push(clone(e));
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
