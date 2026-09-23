/* Canvas: HTML nodes + SVG edges inside one pan/zoom viewport.
   Interaction vocabulary after React Flow / Rete: typed ports, drag-from-port
   to connect with compatibility dimming, marquee select, wheel zoom at the
   cursor, minimap. Every change goes out through onPatch (-> store.dispatch);
   the canvas never mutates the graph itself. */
import { NODE_TYPES, portsOf, canConnect, nextId, clone } from './model.js';

export const NODE_W = 184;
const NS = 'http://www.w3.org/2000/svg';
const SNAP = 10;
const snap = v => Math.round(v / SNAP) * SNAP;

export function nodeMeta(n) {
  const c = n.config;
  switch (n.type) {
    case 'trigger': return `${c.channel} · ${c.trust}`;
    case 'agent': return [(c.capabilities || []).map(x => `${x.cap} ≤ ${x.limit}`).join(', ') || 'no write capability', c.canSplit ? 'can split' : ''].filter(Boolean).join(' · ');
    case 'tool': return `${c.cap || '—'} · ${c.sideEffect}${c.idempotencyKey ? ' · idempotent' : ''}`;
    case 'decision': return c.condition;
    case 'control': return c.kind === 'policy_gate'
      ? `gate · ${c.action}${c.action === 'block' ? ' if !(' + (c.rule || '…') + ')' : ' > ' + c.redactAbove}`
      : `${c.kind.replace('_', ' ')} · bind ${(c.binding || []).join('+') || '—'}${c.singleUse ? ' · single-use' : ''}${c.appliesWhen ? ' · when ' + c.appliesWhen : ''}`;
    case 'data': return c.sensitivity;
    case 'outcome': return `${c.success ? 'success' : 'not success'}${c.external ? ' · external' : ''}`;
    case 'prohibited': return c.monitor + (c.monitor === 'unauthorized_write' ? ` · approval > ${c.threshold} per ${c.scope}` : '');
    default: return '';
  }
}

export function createCanvas({ wrap, viewport, nodesEl, edgesEl, minimap, onPatch, onSelect, onUndo, onRedo, onZoom }) {
  const view = { x: 40, y: 30, k: 1 };
  let graph = { nodes: [], edges: [] };
  let opts = { issues: {}, run: {}, locked: false };
  const sel = { nodes: new Set(), edge: null };
  const els = new Map();                      // node id -> element
  let clipboard = null;
  let linking = null;                         // {from, path}

  /* ------------------------------------------------------------ geometry */
  const rect = () => wrap.getBoundingClientRect();
  function screenToWorld(cx, cy) { const r = rect(); return { x: (cx - r.left - view.x) / view.k, y: (cy - r.top - view.y) / view.k }; }
  function worldToScreen(x, y) { const r = rect(); return { x: r.left + view.x + x * view.k, y: r.top + view.y + y * view.k }; }
  function applyView() { viewport.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.k})`; drawMinimap(); onZoom && onZoom(view.k); }
  function setView(x, y, k) { view.x = x; view.y = y; view.k = Math.max(0.3, Math.min(2.5, k)); applyView(); }
  function zoomAt(cx, cy, factor) {
    const r = rect(), k = Math.max(0.3, Math.min(2.5, view.k * factor));
    const wx = (cx - r.left - view.x) / view.k, wy = (cy - r.top - view.y) / view.k;
    view.x = cx - r.left - wx * k; view.y = cy - r.top - wy * k; view.k = k; applyView();
  }
  function bounds() {
    if (!graph.nodes.length) return { x: 0, y: 0, w: 400, h: 300 };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of graph.nodes) { const h = els.get(n.id)?.offsetHeight || 90; x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x + NODE_W); y1 = Math.max(y1, n.y + h); }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  function fit() {
    const r = rect(), b = bounds(), pad = 40;
    const k = Math.max(0.3, Math.min(1.2, Math.min((r.width - pad * 2) / b.w, (r.height - pad * 2) / b.h)));
    setView((r.width - b.w * k) / 2 - b.x * k, (r.height - b.h * k) / 2 - b.y * k, k);
  }

  function portXY(n, portId) {
    const el = els.get(n.id);
    const pe = el && el.querySelector(`.port[data-port="${portId}"]`);
    if (pe) return [n.x + pe.offsetLeft + 6, n.y + pe.offsetTop + 6];
    return [n.x, n.y];
  }

  /* ------------------------------------------------------------- render */
  function render(g, o = {}) {
    graph = g; opts = { issues: {}, run: {}, locked: false, ...o };
    for (const id of [...sel.nodes]) if (!g.nodes.some(n => n.id === id)) sel.nodes.delete(id);
    if (sel.edge && !g.edges.some(e => e.id === sel.edge)) sel.edge = null;
    const seen = new Set();
    for (const n of g.nodes) {
      seen.add(n.id);
      let el = els.get(n.id);
      if (!el || el.dataset.type !== n.type) { if (el) el.remove(); el = buildNode(n); els.set(n.id, el); nodesEl.append(el); }
      el.style.left = n.x + 'px'; el.style.top = n.y + 'px';
      el.querySelector('strong').textContent = n.label;
      el.querySelector('.meta').textContent = nodeMeta(n);
      const iss = opts.issues[n.id] || [];
      const badge = el.querySelector('.badge');
      const errs = iss.filter(i => i.severity === 'error').length;
      badge.hidden = !iss.length; badge.textContent = iss.length ? String(iss.length) : '';
      badge.className = 'badge' + (errs ? '' : ' warn'); badge.title = iss.map(i => i.message).join('\n');
      el.classList.toggle('selected', sel.nodes.has(n.id));
      el.classList.remove('run-ok', 'run-wait', 'run-err', 'run-skip');
      if (opts.run[n.id]) el.classList.add('run-' + opts.run[n.id]);
    }
    for (const [id, el] of els) if (!seen.has(id)) { el.remove(); els.delete(id); }
    drawEdges(); drawMinimap();
  }

  function buildNode(n) {
    const def = NODE_TYPES[n.type];
    const el = document.createElement('div');
    el.className = 'node ' + def.css; el.dataset.node = n.id; el.dataset.type = n.type;
    const head = document.createElement('div'); head.className = 'head';
    const small = document.createElement('small'); small.textContent = def.label;
    const badge = document.createElement('span'); badge.className = 'badge'; badge.hidden = true;
    head.append(small, badge);
    const strong = document.createElement('strong');
    const meta = document.createElement('div'); meta.className = 'meta';
    el.append(head, strong, meta);
    const outs = def.ports.filter(p => p.kind === 'out');
    def.ports.forEach(p => {
      const pe = document.createElement('div');
      pe.className = 'port ' + p.kind; pe.dataset.port = p.id; pe.dataset.node = n.id; pe.title = p.label || p.id;
      if (p.kind === 'out') {
        pe.style.top = (outs.length === 1 ? 36 : 22 + outs.indexOf(p) * 30) + 'px';
        if (p.label) { const l = document.createElement('span'); l.className = 'plabel'; l.textContent = p.label; pe.append(l); }
      }
      el.append(pe);
    });
    return el;
  }

  function curve(x1, y1, x2, y2) { const dx = Math.max(40, Math.abs(x2 - x1) / 2); return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`; }
  function drawEdges() {
    edgesEl.textContent = '';
    const byId = new Map(graph.nodes.map(n => [n.id, n]));
    for (const n of graph.nodes) if (n.type === 'prohibited') for (const w of n.config.watches || []) {
      const t = byId.get(w); if (!t) continue;
      const th = els.get(t.id)?.offsetHeight || 90;
      const p = document.createElementNS(NS, 'path');
      const x1 = n.x + NODE_W / 2, y1 = n.y, x2 = t.x + NODE_W / 2, y2 = t.y + th;
      p.setAttribute('d', `M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`);
      p.setAttribute('class', 'watch'); edgesEl.append(p);
    }
    for (const e of graph.edges) {
      const a = byId.get(e.from.node), b = byId.get(e.to.node); if (!a || !b) continue;
      const [x1, y1] = portXY(a, e.from.port), [x2, y2] = portXY(b, e.to.port);
      const d = e.kind === 'access' ? `M${x1},${y1} C${x1},${y1 - 60} ${x2},${y2 - 60} ${x2},${y2}` : curve(x1, y1, x2, y2);
      const hit = document.createElementNS(NS, 'path');
      hit.setAttribute('d', d); hit.setAttribute('class', 'hit'); hit.dataset.edge = e.id; hit.style.pointerEvents = 'stroke';
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d); p.dataset.edge = e.id;
      p.setAttribute('class', e.kind + (sel.edge === e.id ? ' selected' : '') + (opts.run['edge:' + e.id] ? ' run-hot' : ''));
      edgesEl.append(hit, p);
    }
    if (linking) edgesEl.append(linking.path);
  }

  function drawMinimap() {
    if (!minimap) return;
    const ctx = minimap.getContext('2d'), W = minimap.width, H = minimap.height;
    ctx.clearRect(0, 0, W, H);
    const b = bounds(), r = rect();
    const vw = { x: -view.x / view.k, y: -view.y / view.k, w: r.width / view.k, h: r.height / view.k };
    const x0 = Math.min(b.x, vw.x), y0 = Math.min(b.y, vw.y), x1 = Math.max(b.x + b.w, vw.x + vw.w), y1 = Math.max(b.y + b.h, vw.y + vw.h);
    const s = Math.min((W - 8) / (x1 - x0 || 1), (H - 8) / (y1 - y0 || 1));
    minimap._map = { x0, y0, s };
    const colors = { trigger: '#737b85', agent: '#718aff', decision: '#e2a04e', control: '#e2a04e', tool: '#9a72d4', outcome: '#377456', prohibited: '#c54545', data: '#4d8fb3' };
    for (const n of graph.nodes) { ctx.fillStyle = colors[n.type] || '#999'; ctx.fillRect(4 + (n.x - x0) * s, 4 + (n.y - y0) * s, Math.max(2, NODE_W * s), Math.max(2, 80 * s)); }
    ctx.strokeStyle = '#536bdb'; ctx.lineWidth = 1.5;
    ctx.strokeRect(4 + (vw.x - x0) * s, 4 + (vw.y - y0) * s, vw.w * s, vw.h * s);
  }
  minimap?.addEventListener('pointerdown', e => {
    e.stopPropagation();
    const m = minimap._map; if (!m) return;
    const br = minimap.getBoundingClientRect();
    const wx = m.x0 + (e.clientX - br.left - 4) / m.s, wy = m.y0 + (e.clientY - br.top - 4) / m.s;
    const r = rect(); setView(r.width / 2 - wx * view.k, r.height / 2 - wy * view.k, view.k);
  });

  /* ---------------------------------------------------------- selection */
  function select(ids, { add = false, edge = null } = {}) {
    if (!add) sel.nodes.clear();
    for (const id of ids) sel.nodes.add(id);
    sel.edge = edge;
    for (const [id, el] of els) el.classList.toggle('selected', sel.nodes.has(id));
    drawEdges();
    onSelect && onSelect({ nodes: [...sel.nodes], edge: sel.edge });
  }

  /* ------------------------------------------------------- interactions */
  wrap.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))); }, { passive: false });

  wrap.addEventListener('pointerdown', e => {
    if (e.button !== 0 && e.button !== 1) return;
    wrap.focus({ preventScroll: true });
    const port = e.target.closest('.port');
    const nodeEl = e.target.closest('.node');
    const edgeHit = e.target.closest('path.hit');
    if (port) return startLink(e, port);
    if (nodeEl) return startNodeDrag(e, nodeEl);
    if (edgeHit) { select([], { edge: edgeHit.dataset.edge }); return; }
    if (e.shiftKey) return startMarquee(e);
    startPan(e);
  });

  function track(e, move, up) {
    const id = e.pointerId;
    try { wrap.setPointerCapture(id); } catch { /* synthetic events */ }
    const mv = ev => { if (ev.pointerId === id) move(ev); };
    const fin = ev => { if (ev.pointerId !== id) return; wrap.removeEventListener('pointermove', mv); wrap.removeEventListener('pointerup', fin); wrap.removeEventListener('pointercancel', fin); up(ev); };
    wrap.addEventListener('pointermove', mv); wrap.addEventListener('pointerup', fin); wrap.addEventListener('pointercancel', fin);
  }

  function startPan(e) {
    const sx = e.clientX, sy = e.clientY, vx = view.x, vy = view.y; let moved = false;
    wrap.classList.add('panning');
    track(e, ev => { if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 3) moved = true; view.x = vx + ev.clientX - sx; view.y = vy + ev.clientY - sy; applyView(); },
      () => { wrap.classList.remove('panning'); if (!moved) select([]); });
  }

  function startMarquee(e) {
    const r = rect(), box = document.createElement('div'); box.className = 'marquee'; wrap.append(box);
    const sx = e.clientX, sy = e.clientY;
    const upd = ev => { const x = Math.min(sx, ev.clientX) - r.left, y = Math.min(sy, ev.clientY) - r.top; Object.assign(box.style, { left: x + 'px', top: y + 'px', width: Math.abs(ev.clientX - sx) + 'px', height: Math.abs(ev.clientY - sy) + 'px' }); };
    track(e, upd, ev => {
      box.remove();
      const a = screenToWorld(Math.min(sx, ev.clientX), Math.min(sy, ev.clientY)), b = screenToWorld(Math.max(sx, ev.clientX), Math.max(sy, ev.clientY));
      const hit = graph.nodes.filter(n => { const h = els.get(n.id)?.offsetHeight || 90; return n.x < b.x && n.x + NODE_W > a.x && n.y < b.y && n.y + h > a.y; }).map(n => n.id);
      select(hit, { add: e.metaKey || e.ctrlKey });
    });
  }

  function startNodeDrag(e, nodeEl) {
    const id = nodeEl.dataset.node;
    if (e.shiftKey) { if (sel.nodes.has(id)) { sel.nodes.delete(id); select([...sel.nodes]); } else select([id], { add: true }); return; }
    if (!sel.nodes.has(id)) select([id]);
    const start = screenToWorld(e.clientX, e.clientY);
    const origin = new Map([...sel.nodes].map(nid => { const n = graph.nodes.find(x => x.id === nid); return [nid, { x: n.x, y: n.y }]; }));
    const key = 'drag:' + Date.now();
    let moved = false, refused = false;
    track(e, ev => {
      if (refused) return;
      const p = screenToWorld(ev.clientX, ev.clientY), dx = p.x - start.x, dy = p.y - start.y;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 3 / view.k) return;
      moved = true;
      const ops = [...origin].map(([nid, o]) => ({ op: 'moveNode', id: nid, x: snap(o.x + dx), y: snap(o.y + dy) }));
      const r = onPatch(ops, 'Move', key);
      if (r && !r.ok) refused = true;
    }, () => {});
  }

  function startLink(e, portEl) {
    const node = graph.nodes.find(n => n.id === portEl.dataset.node);
    const def = portsOf(node).find(p => p.id === portEl.dataset.port);
    if (def.kind === 'in') return;                                  // connect from outputs and access ports
    const from = { node: node.id, port: def.id };
    const [x1, y1] = portXY(node, def.id);
    const path = document.createElementNS(NS, 'path'); path.setAttribute('class', 'preview');
    linking = { from, path }; edgesEl.append(path);
    const ports = [...nodesEl.querySelectorAll('.port')];
    for (const p of ports) p.classList.toggle('dim', !canConnect(graph, from, { node: p.dataset.node, port: p.dataset.port }).ok);
    let target = null;
    track(e, ev => {
      const w = screenToWorld(ev.clientX, ev.clientY);
      path.setAttribute('d', def.kind === 'acc' ? `M${x1},${y1} L${w.x},${w.y}` : curve(x1, y1, w.x, w.y));
      const under = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('.port');
      if (target && target !== under) target.classList.remove('target');
      target = under && !under.classList.contains('dim') ? under : null;
      target && target.classList.add('target');
    }, ev => {
      const under = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('.port') || target;
      for (const p of ports) p.classList.remove('dim', 'target');
      path.remove(); linking = null;
      if (!under) return;
      connect(from, { node: under.dataset.node, port: under.dataset.port });
    });
  }

  function connect(from, to) {
    const r = canConnect(graph, from, to);
    if (!r.ok) return onPatch([{ op: 'addEdge', edge: { id: '_', from, to } }], 'Connect');   // let the store report why
    const id = nextId(graph.edges.map(x => x.id), r.value.kind === 'access' ? 'a' : 'e');
    return onPatch([{ op: 'addEdge', edge: { id, ...r.value } }], 'Connect');
  }

  /* ------------------------------------------------------------ keyboard */
  function deleteSelection() {
    const ops = [];
    if (sel.edge) ops.push({ op: 'removeEdge', id: sel.edge });
    for (const id of sel.nodes) ops.push({ op: 'removeNode', id });
    if (!ops.length) return;
    const r = onPatch(ops, 'Delete');
    if (r && r.ok) select([]);
  }
  function copy() {
    const ids = new Set(sel.nodes); if (!ids.size) return false;
    clipboard = { nodes: clone(graph.nodes.filter(n => ids.has(n.id))), edges: clone(graph.edges.filter(e => ids.has(e.from.node) && ids.has(e.to.node))) };
    return true;
  }
  function paste() {
    if (!clipboard) return;
    const taken = new Set(graph.nodes.map(n => n.id)), etaken = new Set(graph.edges.map(e => e.id));
    const map = new Map(), ops = [];
    for (const n of clipboard.nodes) {
      const id = nextId(taken, n.type); taken.add(id); map.set(n.id, id);
      ops.push({ op: 'addNode', node: { ...clone(n), id, x: n.x + 40, y: n.y + 40, label: n.label + ' (copy)' } });
    }
    for (const op of ops) if (op.node.type === 'prohibited') op.node.config.watches = (op.node.config.watches || []).map(w => map.get(w) || w);
    for (const e of clipboard.edges) {
      const id = nextId(etaken, e.kind === 'access' ? 'a' : 'e'); etaken.add(id);
      ops.push({ op: 'addEdge', edge: { ...clone(e), id, from: { ...e.from, node: map.get(e.from.node) }, to: { ...e.to, node: map.get(e.to.node) } } });
    }
    const r = onPatch(ops, 'Paste');
    if (r && r.ok) { select([...map.values()]); clipboard = { nodes: clipboard.nodes.map(n => ({ ...n, x: n.x + 40, y: n.y + 40 })), edges: clipboard.edges }; }
  }
  wrap.addEventListener('keydown', e => {
    if (e.target !== wrap) return;
    const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
    if (k === 'delete' || k === 'backspace') { e.preventDefault(); deleteSelection(); }
    else if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); onUndo && onUndo(); }
    else if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); onRedo && onRedo(); }
    else if (mod && k === 'c') { e.preventDefault(); copy(); }
    else if (mod && k === 'v') { e.preventDefault(); paste(); }
    else if (mod && k === 'a') { e.preventDefault(); select(graph.nodes.map(n => n.id)); }
    else if (k === 'escape') select([]);
    else if (k === 'f' && !mod) fit();
  });

  /* --------------------------------------------------- palette sources */
  function addPaletteSource(el, type, onAdd) {
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      const ghost = el.cloneNode(true); ghost.style.cssText = `position:fixed;z-index:60;pointer-events:none;opacity:.85;width:${el.offsetWidth}px;left:${e.clientX - 20}px;top:${e.clientY - 14}px`;
      document.body.append(ghost);
      const id = e.pointerId;
      try { el.setPointerCapture(id); } catch { /* synthetic */ }
      const mv = ev => { ghost.style.left = ev.clientX - 20 + 'px'; ghost.style.top = ev.clientY - 14 + 'px'; };
      const up = ev => {
        el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up);
        ghost.remove();
        const r = rect();
        const inside = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
        if (inside) { const w = screenToWorld(ev.clientX, ev.clientY); onAdd(type, snap(w.x - NODE_W / 2), snap(w.y - 20)); }
        else if (Math.abs(ev.clientX - e.clientX) + Math.abs(ev.clientY - e.clientY) < 4) { const c = screenToWorld(r.left + r.width / 2, r.top + r.height / 2); onAdd(type, snap(c.x - NODE_W / 2), snap(c.y - 40)); }
      };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
    });
  }

  applyView();
  return {
    render, fit, setView, zoomAt, screenToWorld, worldToScreen, select, deleteSelection, copy, paste, connect, addPaletteSource,
    view, get graph() { return graph; }, get selection() { return { nodes: [...sel.nodes], edge: sel.edge }; },
    zoomBy(f) { const r = rect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, f); }
  };
}
