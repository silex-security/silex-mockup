/* Structural edits as single patches (plan §3.2, §3.5). Each builder returns
   the complete op list — including the re-arrangement moves — so one user
   action is one store dispatch and one undo step. Pure: no React, no store. */
import { makeNode, nextId, applyPatch, nodeById, NODE_TYPES } from '../../../js/model.js';
import { layoutOps } from './layout.js';
import { t } from '../i18n/index.js';

export const EDGE_INSERTABLE = ['agent', 'tool', 'decision', 'control'];            // "+" on an edge
export const PORT_ADDABLE = ['agent', 'tool', 'decision', 'control', 'outcome'];     // "+" on an open out port
export const LIBRARY_ADDABLE = Object.keys(NODE_TYPES);                              // left library

function ids(graph) {
  const n = new Set(graph.nodes.map(x => x.id)), e = new Set(graph.edges.map(x => x.id));
  return {
    node(prefix) { const id = nextId(n, prefix); n.add(id); return id; },
    edge(prefix = 'e') { const id = nextId(e, prefix); e.add(id); return id; }
  };
}
const flow = (id, from, fport, to, tport = 'in') => ({ op: 'addEdge', edge: { id, kind: 'flow', from: { node: from, port: fport }, to: { node: to, port: tport } } });
const newNode = (type, id, x, y) => makeNode(type, id, { x, y, label: t(`node.${type}.label`, NODE_TYPES[type].label) });

/* Appends the layout of the graph that `ops` produce. */
function arranged(graph, ops, measured) {
  const r = applyPatch(graph, ops);
  if (!r.ok) return r;
  return { ok: true, value: [...ops, ...layoutOps(r.value, measured)] };
}

/* The first outcome that is not a success (by id), or null. */
export const declineOutcome = graph => graph.nodes.filter(n => n.type === 'outcome' && !n.config.success).sort((a, b) => (a.id < b.id ? -1 : 1))[0] || null;

/* "+" on flow edge A→B. */
export function insertOnEdge(graph, edgeId, type, measured) {
  if (!EDGE_INSERTABLE.includes(type)) return { ok: false, error: { code: 'not_insertable', message: `${type} cannot be inserted on an edge` } };
  const e = graph.edges.find(x => x.id === edgeId && x.kind === 'flow');
  if (!e) return { ok: false, error: { code: 'unknown_edge', message: 'No such edge' } };
  const A = nodeById(graph, e.from.node), B = nodeById(graph, e.to.node);
  const I = ids(graph), id = I.node(type);
  const ops = [{ op: 'removeEdge', id: e.id }, { op: 'addNode', node: newNode(type, id, (A.x + B.x) / 2, (A.y + B.y) / 2) }, flow(I.edge(), A.id, e.from.port, id)];
  if (type === 'agent' || type === 'tool') ops.push(flow(I.edge(), id, 'out', B.id, e.to.port));
  if (type === 'decision') ops.push(flow(I.edge(), id, 'true', B.id, e.to.port), flow(I.edge(), id, 'false', B.id, e.to.port));
  if (type === 'control') {
    ops.push(flow(I.edge(), id, 'approved', B.id, e.to.port));
    let decline = declineOutcome(graph);
    if (!decline) {
      const did = I.node('outcome');
      decline = makeNode('outcome', did, { x: B.x + 300, y: B.y, label: t('builder.declined', 'Declined'), config: { success: false, external: true } });
      ops.push({ op: 'addNode', node: decline });
    }
    ops.push(flow(I.edge(), id, 'denied', decline.id));
  }
  return arranged(graph, ops, measured);
}

/* "+" on an open out port: the new node's own out ports stay open (stubs). */
export function addAfter(graph, nodeId, port, type, measured) {
  if (!PORT_ADDABLE.includes(type)) return { ok: false, error: { code: 'not_addable', message: `${type} cannot follow a port` } };
  const A = nodeById(graph, nodeId);
  const I = ids(graph), id = I.node(type);
  return arranged(graph, [{ op: 'addNode', node: newNode(type, id, A.x, A.y + 140) }, flow(I.edge(), nodeId, port, id)], measured);
}

/* From the library: an unconnected node (a monitor arrives unattached). */
export function addStandalone(graph, type, x, y) {
  const I = ids(graph), id = I.node(type);
  const node = type === 'prohibited' ? monitorNode(id, 'unauthorized_write', null, [], x, y) : newNode(type, id, x, y);
  return { ok: true, value: [{ op: 'addNode', node }], id };
}

/* A monitor node with only the fields that apply to its kind (plan §3.5). */
function monitorNode(id, kind, cap, watches, x, y) {
  const base = { monitor: kind, severity: kind === 'unauthorized_write' ? 'critical' : 'high', watches };
  const config = kind === 'unauthorized_write' ? { ...base, cap: cap || 'refund.issue', threshold: 500, scope: 'request', minApprovers: 1, probeRange: [500, 2000] }
    : kind === 'duplicate_effect' ? { ...base, cap: cap || 'refund.issue' } : base;
  return { id, type: 'prohibited', label: t(`monitor.${kind}.label`, kind), x: Math.round(x), y: Math.round(y), config };
}

/* "Protect with a monitor" from a tool's or outcome's config panel. */
export function addMonitor(graph, targetId, kind, measured) {
  const T = nodeById(graph, targetId);
  const I = ids(graph), id = I.node('monitor');
  return arranged(graph, [{ op: 'addNode', node: monitorNode(id, kind, T.type === 'tool' ? T.config.cap : null, [targetId], T.x + 300, T.y) }], measured);
}

/* "Reads data" from an agent's or tool's config panel. */
export function addData(graph, actorId, label, sensitivity, measured) {
  const A = nodeById(graph, actorId);
  const I = ids(graph), id = I.node('data');
  const node = makeNode('data', id, { x: A.x - 260, y: A.y, label, config: { sensitivity } });
  return arranged(graph, [{ op: 'addNode', node }, { op: 'addEdge', edge: { id: I.edge('a'), kind: 'access', mode: 'read', from: { node: actorId, port: 'acc' }, to: { node: id, port: 'acc' } } }], measured);
}
export function attachData(graph, actorId, dataId, measured) {
  const I = ids(graph);
  return arranged(graph, [{ op: 'addEdge', edge: { id: I.edge('a'), kind: 'access', mode: 'read', from: { node: actorId, port: 'acc' }, to: { node: dataId, port: 'acc' } } }], measured);
}
