/* Top-to-bottom layered layout with dagre (plan §3.2, §7 B7).
   Every model node is laid out, data and monitors included: a data resource is
   ranked above its first reader (edge data -> reader) and a monitor below what
   it watches (edge watched -> monitor), so dagre itself guarantees no overlap.
   Node boxes have fixed sizes per kind (text ellipsises), so the sizes used
   here are the rendered sizes; `measured` (from React Flow) overrides them. */
import dagre from '@dagrejs/dagre';

export const COMPACT = new Set(['data', 'prohibited']);
export const sizeOf = n => (COMPACT.has(n.type) ? { width: 208, height: 52 } : { width: 272, height: 76 });

export function layoutGraph(graph, measured = {}) {
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({ rankdir: 'TB', nodesep: 44, ranksep: 58, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));
  const size = n => measured[n.id] || sizeOf(n);
  for (const n of graph.nodes) g.setNode(n.id, { ...size(n) });
  for (const e of graph.edges) {
    if (e.kind === 'flow') g.setEdge(e.from.node, e.to.node, { weight: 3, minlen: 1 }, e.id);
    else g.setEdge(e.to.node, e.from.node, { weight: 1, minlen: 1 }, e.id);            // data above its reader
  }
  for (const n of graph.nodes) if (n.type === 'prohibited')
    for (const w of n.config.watches || []) if (graph.nodes.some(x => x.id === w)) g.setEdge(w, n.id, { weight: 1, minlen: 1 }, 'watch:' + n.id + ':' + w);
  dagre.layout(g);
  const pos = {};
  for (const n of graph.nodes) { const p = g.node(n.id), s = size(n); pos[n.id] = { x: Math.round(p.x - s.width / 2), y: Math.round(p.y - s.height / 2) }; }
  return pos;
}

export const layoutOps = (graph, measured) => Object.entries(layoutGraph(graph, measured)).map(([id, p]) => ({ op: 'moveNode', id, x: p.x, y: p.y }));
