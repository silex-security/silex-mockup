// The workflow blueprint as DOM: one button per node, edges as positioned lines, laid out on the N1 grid.
//
//   blueprintDiagram({ nodes, edges, selectedId, visited, currentId, onSelect, label }) -> HTMLElement
//     nodes     WorkflowNode plus { changed, faultMarker }, positioned by pos.col (0..2) and pos.row (0..4)
//     visited   node ids a replay passed through; when given, the other nodes are dimmed
import { h, s } from '../components/dom.js';
import { icon } from '../components/icons.js';

const ROW_TOP = [6, 73, 135, 210, 272];
const HEIGHT = 320;
const BOX_H = 46;
const DIAMOND = { w: 168, h: 76 };
const CHIP_ICON = { CRM: 'database', Email: 'mail', Calendar: 'calendar', Model: 'wand', Tickets: 'ticket', Payments: 'card' };

const colPct = col => 50 + (col - 1) * 25;
const top = node => ROW_TOP[node.pos.row] ?? node.pos.row * 64;
const height = node => (node.kind === 'decision' ? DIAMOND.h : BOX_H);
const halfWidth = node => (node.kind === 'decision' ? DIAMOND.w / 2 : 0);

const at = (pct, px) => `calc(${pct}% + ${px}px)`;

function vline(pct, y1, y2, arrow) {
  return h('span', { class: `wb-edge wb-edge--v${arrow ? ' has-arrow' : ''}`, style: { left: at(pct, -0.75), top: `${y1}px`, height: `${Math.max(0, y2 - y1)}px` } });
}

function hline(l, r, y) {
  return h('span', { class: 'wb-edge wb-edge--h', style: { left: at(l.pct, l.px), width: at(r.pct - l.pct, r.px - l.px), top: `${y - 0.75}px` } });
}

function edgeParts(from, to, label) {
  const fx = colPct(from.pos.col), tx = colPct(to.pos.col);
  const fBottom = top(from) + height(from), tTop = top(to);
  if (from.pos.col === to.pos.col) return [vline(fx, fBottom, tTop, true)];
  const toLeft = to.pos.col < from.pos.col;
  if (from.kind === 'decision') {
    const y = top(from) + DIAMOND.h / 2;
    const tip = { pct: fx, px: toLeft ? -halfWidth(from) : halfWidth(from) };
    const mid = { pct: (fx + tx) / 2, px: (toLeft ? -halfWidth(from) : halfWidth(from)) / 2 };
    return [
      toLeft ? hline({ pct: tx, px: 0 }, tip, y) : hline(tip, { pct: tx, px: 0 }, y), vline(tx, y, tTop, true),
      label && h('span', { class: 'wb-edge__label', style: { left: at(mid.pct, mid.px), top: `${y}px` } }, label),
    ];
  }
  const y = (fBottom + tTop) / 2;
  return [vline(fx, fBottom, y, false), hline({ pct: Math.min(fx, tx), px: 0 }, { pct: Math.max(fx, tx), px: 0 }, y), vline(tx, y, tTop, true)];
}

function nodeButton(node, { selectedId, visited, currentId, onSelect }) {
  const dim = visited && !visited.includes(node.id);
  const cls = ['wb-node', `wb-node--${node.kind}`, node.id === selectedId && 'is-selected', node.changed && 'is-changed',
    visited?.includes(node.id) && 'is-visited', node.id === currentId && 'is-current', dim && 'is-dim'].filter(Boolean).join(' ');
  const tag = node.changed ? h('span', { class: 'wb-node__tag wb-node__tag--changed' }, 'Changed')
    : node.faultMarker ? h('span', { class: 'wb-node__tag wb-node__tag--fault' }, node.faultMarker) : null;
  const described = [node.label, node.chip && `${node.chip} step`, node.changed && 'changed in this version', node.faultMarker,
    visited && (visited.includes(node.id) ? 'visited in this run' : 'not visited in this run')].filter(Boolean).join(', ');
  const style = { left: `${colPct(node.pos.col)}%`, top: `${top(node)}px` };
  if (node.kind === 'decision') {
    return h('button', { type: 'button', class: cls, style, 'aria-pressed': String(node.id === selectedId), 'aria-label': described, dataset: { node: node.id, focusKey: `wb:node:${node.id}` }, onClick: () => onSelect(node.id) },
      s('svg', { class: 'wb-node__diamond', viewBox: `0 0 ${DIAMOND.w} ${DIAMOND.h}`, 'aria-hidden': 'true', focusable: 'false', preserveAspectRatio: 'none' },
        s('polygon', { points: `${DIAMOND.w / 2},1 ${DIAMOND.w - 1},${DIAMOND.h / 2} ${DIAMOND.w / 2},${DIAMOND.h - 1} 1,${DIAMOND.h / 2}` })),
      h('span', { class: 'wb-node__body' }, icon('branch', { size: 16 }), h('span', { class: 'wb-node__label' }, node.label)));
  }
  return h('button', { type: 'button', class: cls, style, 'aria-pressed': String(node.id === selectedId), 'aria-label': described, dataset: { node: node.id, col: String(node.pos.col), focusKey: `wb:node:${node.id}` }, onClick: () => onSelect(node.id) },
    h('span', { class: 'wb-node__icon' }, icon(CHIP_ICON[node.chip] ?? 'box', { size: 20 })),
    h('span', { class: 'wb-node__text' }, h('span', { class: 'wb-node__label' }, node.label), node.chip && h('span', { class: 'wb-node__chip' }, node.chip)),
    tag);
}

export function blueprintDiagram({ nodes, edges, selectedId, visited = null, currentId = null, onSelect, label }) {
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  return h('div', { class: 'wb-diagram-scroll', dataset: { scrollKey: 'wb:diagram' } },
    h('div', { class: `wb-diagram${visited ? ' is-replay' : ''}`, role: 'group', 'aria-label': label, style: { height: `${HEIGHT}px` } },
      h('div', { class: 'wb-edges', 'aria-hidden': 'true' }, edges.flatMap(e => (byId[e.from] && byId[e.to] ? edgeParts(byId[e.from], byId[e.to], e.label) : []))),
      nodes.map(n => nodeButton(n, { selectedId, visited, currentId, onSelect }))));
}
