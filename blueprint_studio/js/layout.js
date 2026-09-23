/* Layered left->right layout (contract §9): longest-path layers over flow
   edges, rows ordered by the barycentre of each node's predecessors (with the
   out-port index as tie-break, so `true` / `approved` stay on the main row),
   data nodes in a band above their first accessor, prohibited nodes in a band
   below the flow rows under their first watched node. Deterministic, no overlaps. */

export function layout(graph, { nodeW = 184, nodeH = 96, gapX = 64, gapY = 40 } = {}) {
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const flow = graph.edges.filter(e => e.kind === 'flow');
  const access = graph.edges.filter(e => e.kind === 'access');
  const flowNodes = graph.nodes.filter(n => n.type !== 'data' && n.type !== 'prohibited');
  const ids = new Set(flowNodes.map(n => n.id));
  const portIndex = e => {
    return { true: 0, approved: 0, out: 0, false: 1, denied: 1 }[e.from.port] ?? 0;
  };

  /* longest-path layers (Kahn order; nodes in a cycle or unreachable fall back to layer 0) */
  const indeg = Object.fromEntries(flowNodes.map(n => [n.id, 0]));
  for (const e of flow) if (ids.has(e.to.node) && ids.has(e.from.node)) indeg[e.to.node]++;
  const queue = flowNodes.filter(n => indeg[n.id] === 0).map(n => n.id).sort(cmp);
  const layer = {}, order = [];
  while (queue.length) {
    const id = queue.shift(); order.push(id);
    for (const e of flow) if (e.from.node === id && ids.has(e.to.node) && --indeg[e.to.node] === 0) queue.push(e.to.node);
  }
  for (const id of order) {
    let l = 0;
    for (const e of flow) if (e.to.node === id && e.from.node in layer) l = Math.max(l, layer[e.from.node] + 1);
    layer[id] = l;
  }
  for (const n of flowNodes) if (!(n.id in layer)) layer[n.id] = 0;

  /* rows per layer by predecessor barycentre */
  const row = {};
  const maxLayer = Math.max(0, ...Object.values(layer));
  let flowRows = 0;
  for (let l = 0; l <= maxLayer; l++) {
    const inLayer = flowNodes.filter(n => layer[n.id] === l).map(n => {
      const preds = flow.filter(e => e.to.node === n.id && e.from.node in row);
      const key = preds.length ? preds.reduce((s, e) => s + row[e.from.node] + portIndex(e) * 0.4, 0) / preds.length : Infinity;
      return { id: n.id, key };
    }).sort((a, b) => a.key - b.key || cmp(a.id, b.id));
    const taken = new Set();
    for (const { id, key } of inLayer) {
      let r = Number.isFinite(key) ? Math.max(0, Math.round(key)) : 0;
      while (taken.has(r)) r++;
      taken.add(r); row[id] = r; flowRows = Math.max(flowRows, r + 1);
    }
  }

  const X = l => l * (nodeW + gapX), Y = r => r * (nodeH + gapY);
  const pos = {};
  for (const n of flowNodes) pos[n.id] = { x: X(layer[n.id]), y: Y(row[n.id]) };

  /* data band above: column of the first accessor, stacked upward */
  const upCount = {};
  for (const n of graph.nodes.filter(n => n.type === 'data').sort((a, b) => cmp(a.id, b.id))) {
    const acc = access.filter(e => e.to.node === n.id).map(e => e.from.node).filter(id => id in layer).sort((a, b) => layer[a] - layer[b] || cmp(a, b))[0];
    const col = acc ? layer[acc] : 0;
    const k = (upCount[col] = (upCount[col] || 0) + 1);
    pos[n.id] = { x: X(col), y: -k * (nodeH + gapY) };
  }

  /* prohibited band below the flow rows: column of the first watched node */
  const downCount = {};
  for (const n of graph.nodes.filter(n => n.type === 'prohibited').sort((a, b) => cmp(a.id, b.id))) {
    const w = (n.config.watches || []).find(id => id in layer);
    const home = w ? layer[w] : maxLayer;
    const free = [0, -1, 1, -2, 2, -3, 3].map(d => home + d).find(c => c >= 0 && !downCount[c]);   // spread sideways before stacking
    const col = free ?? home;
    const k = (downCount[col] = (downCount[col] || 0) + 1);
    pos[n.id] = { x: X(col), y: Y(flowRows) + gapY + (k - 1) * (nodeH + gapY) };
  }
  return pos;
}
