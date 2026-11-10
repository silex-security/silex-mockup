// The frozen workflow blueprint of an attempt, drawn on a fixed grid, with replay highlighting applied by paintBlueprint.
import { h, s } from '../components/dom.js';
import { icon } from '../components/icons.js';

const COL_W = 196, ROW_H = 80, NODE_W = 172, NODE_H = 50, PAD = 10;
const CHIP_ICON = { CRM: 'database', Email: 'mail', Calendar: 'calendar', Tickets: 'ticket', Payments: 'card', Model: 'wand' };
const FLAG_LABEL = { timeout: 'Timeout', blocked: 'Policy block' };
const FLAG_OF = e => e.type === 'policy_block' ? 'blocked' : e.responseState === 'timeout' ? 'timeout' : null;

const place = n => ({ x: PAD + n.pos.col * COL_W + (COL_W - NODE_W) / 2, y: PAD + n.pos.row * ROW_H });

function edgePath(from, to) {
  const a = place(from), b = place(to);
  const sx = a.x + NODE_W / 2, sy = a.y + NODE_H, tx = b.x + NODE_W / 2, ty = b.y;
  if (sx === tx) return { d: `M${sx} ${sy}V${ty - 2}`, lx: sx, ly: (sy + ty) / 2 };
  const my = (sy + ty) / 2;
  return { d: `M${sx} ${sy}V${my}H${tx}V${ty - 2}`, lx: (sx + tx) / 2, ly: my };
}

const arrow = id => s('marker', { id, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
  s('path', { d: 'M0 0L10 5L0 10z', class: id }));

/** @param {import('../model.js').WorkflowRevision} workflow  @param {import('../model.js').TraceEvent[]} events all recorded events */
export function blueprintDiagram(workflow, events) {
  const byId = Object.fromEntries(workflow.nodes.map(n => [n.id, n]));
  const cols = Math.max(...workflow.nodes.map(n => n.pos.col)) + 1;
  const rows = Math.max(...workflow.nodes.map(n => n.pos.row)) + 1;
  const width = PAD * 2 + cols * COL_W, height = PAD * 2 + (rows - 1) * ROW_H + NODE_H;
  const flagsAt = id => [...new Set(events.filter(e => e.nodeId === id).map(FLAG_OF).filter(Boolean))];

  const svg = s('svg', { class: 'run-bp__edges', width, height, viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true', focusable: 'false' },
    s('defs', arrow('run-arrow'), arrow('run-arrow-on')),
    workflow.edges.map(e => {
      const p = edgePath(byId[e.from], byId[e.to]);
      return s('g', { class: 'run-edge', dataset: { runEdge: `${e.from}>${e.to}` } },
        s('path', { d: p.d, 'marker-end': 'url(#run-arrow)' }),
        e.label && s('text', { x: p.lx, y: p.ly + 4, 'text-anchor': 'middle', class: 'run-edge__label' }, e.label));
    }));

  const nodes = workflow.nodes.map(n => {
    const { x, y } = place(n);
    return h('div', { class: `run-node run-node--${n.kind}`, dataset: { runNode: n.id }, style: { left: `${x}px`, top: `${y}px`, width: `${NODE_W}px`, height: `${NODE_H}px` } },
      h('span', { class: 'run-node__icon' }, icon(n.kind === 'decision' ? 'branch' : CHIP_ICON[n.chip] ?? 'box', { size: 16 })),
      h('span', { class: 'run-node__text' }, h('strong', n.label), n.chip && h('span', { class: 'run-node__chip' }, n.chip)),
      flagsAt(n.id).map(f => h('span', { class: `run-node__flag run-node__flag--${f}`, dataset: { flag: f }, hidden: true }, FLAG_LABEL[f])),
      h('span', { class: 'gym-sr run-node__state' }));
  });

  return h('div', { class: 'run-bp gym-scroll-x', dataset: { scrollKey: 'run:bp' }, role: 'img', 'aria-label': `${workflow.name} blueprint, revision ${workflow.rev}` },
    h('div', { class: 'run-bp__canvas', style: { width: `${width}px`, height: `${height}px` } }, svg, nodes));
}

/** Applies a replay frame (runs/replay.js) to a rendered blueprint without rebuilding it. */
export function paintBlueprint(root, frame) {
  for (const el of root.querySelectorAll('[data-run-node]')) {
    const id = el.dataset.runNode;
    const state = frame.activeNodeId === id ? 'current' : frame.visited.has(id) ? 'visited' : 'idle';
    el.dataset.state = state;
    el.querySelector('.run-node__state').textContent = { current: 'current step', visited: 'visited', idle: 'not visited yet' }[state];
    for (const flag of el.querySelectorAll('[data-flag]')) flag.hidden = !frame.flags[id]?.has(flag.dataset.flag);
  }
  for (const el of root.querySelectorAll('[data-run-edge]')) {
    const on = frame.edges.has(el.dataset.runEdge);
    el.classList.toggle('is-walked', on);
    el.querySelector('path').setAttribute('marker-end', on ? 'url(#run-arrow-on)' : 'url(#run-arrow)');
  }
}
