/* Canvas: HTML nodes + SVG edges inside a pan/zoom viewport.
   Task 0: render only. Interaction (drag, connect, marquee, keyboard, minimap) lands in Task 6. */
import { NODE_TYPES, portsOf } from './model.js';

export const NODE_W = 184;

export function createCanvas({ wrap, viewport, nodesEl, edgesEl }) {
  const view = { x: 40, y: 30, k: 1 };
  let graph = { nodes: [], edges: [] };

  function applyView() { viewport.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.k})`; }

  function nodeMeta(n) {
    const c = n.config;
    switch (n.type) {
      case 'trigger': return `${c.channel} · ${c.trust}`;
      case 'agent': return (c.capabilities || []).map(x => `${x.cap} ≤ ${x.limit}`).join(', ') || 'no write capability';
      case 'tool': return `${c.cap} · ${c.sideEffect}${c.idempotencyKey ? ' · idempotent' : ''}`;
      case 'decision': return c.condition;
      case 'control': return c.kind === 'policy_gate' ? `gate · ${c.action}` : `${c.kind.replace('_', ' ')} · bind ${(c.binding || []).join('+') || '—'}${c.singleUse ? ' · single-use' : ''}`;
      case 'data': return c.sensitivity;
      case 'outcome': return `${c.success ? 'success' : 'not success'}${c.external ? ' · external' : ''}`;
      case 'prohibited': return c.monitor + (c.monitor === 'unauthorized_write' ? ` > ${c.threshold}` : '');
      default: return '';
    }
  }

  function portXY(n, port) {
    const el = nodesEl.querySelector(`[data-node="${CSS.escape(n.id)}"]`);
    const h = el ? el.offsetHeight : 90;
    const def = portsOf(n).find(p => p.id === port);
    if (!def) return [n.x, n.y];
    if (def.kind === 'in') return [n.x, n.y + 42];
    if (def.kind === 'acc') return [n.x + NODE_W / 2, n.y];
    const outs = portsOf(n).filter(p => p.kind === 'out');
    const i = outs.findIndex(p => p.id === port);
    return [n.x + NODE_W, n.y + (outs.length === 1 ? 42 : 30 + i * Math.max(26, (h - 40) / outs.length))];
  }

  function render(g) {
    graph = g;
    nodesEl.textContent = '';
    for (const n of g.nodes) {
      const def = NODE_TYPES[n.type];
      const el = document.createElement('div');
      el.className = 'node ' + def.css; el.dataset.node = n.id;
      el.style.left = n.x + 'px'; el.style.top = n.y + 'px';
      const head = document.createElement('div'); head.className = 'head';
      const small = document.createElement('small'); small.textContent = def.label; head.append(small);
      const strong = document.createElement('strong'); strong.textContent = n.label;
      const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = nodeMeta(n);
      el.append(head, strong, meta);
      nodesEl.append(el);
    }
    drawEdges();
  }

  function drawEdges() {
    edgesEl.textContent = '';
    const NS = 'http://www.w3.org/2000/svg';
    const byId = new Map(graph.nodes.map(n => [n.id, n]));
    for (const e of graph.edges) {
      const a = byId.get(e.from.node), b = byId.get(e.to.node); if (!a || !b) continue;
      const [x1, y1] = portXY(a, e.from.port), [x2, y2] = portXY(b, e.to.port);
      const p = document.createElementNS(NS, 'path');
      const dx = Math.max(40, Math.abs(x2 - x1) / 2);
      p.setAttribute('d', e.kind === 'access' ? `M${x1},${y1} C${x1},${y1 - 50} ${x2},${y2 + 50} ${x2},${y2 + 84}` : `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`);
      p.setAttribute('class', e.kind); p.dataset.edge = e.id;
      edgesEl.append(p);
    }
  }

  applyView();
  return { render, view, applyView, get graph() { return graph; } };
}
