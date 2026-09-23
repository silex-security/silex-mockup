/* Deterministic rule-based NL -> graph patch (plan §3.9, contract §9).
   Labelled "rule-based, no AI". No LLM. Case-insensitive, one phrase per sentence.
   Anything unrecognised goes to `unmatched`, never guessed. */

import { nodeById, flowIn, nextId, makeNode, ok } from './model.js';
import { potentialPaths } from './validate.js';

export const PHRASES = [
  { pattern: 'require approval above $X', example: 'require approval above $500', produces: 'sets the gating decision to `amount > X`' },
  { pattern: 'aggregate per customer per day', example: 'aggregate per customer per day', produces: 'switches the gating decision to `dayTotal`' },
  { pattern: 'bind the approval to customer, order, amount', example: 'bind the approval to customer, order and amount', produces: 'sets the approval binding' },
  { pattern: 'single-use approvals', example: 'single-use approval', produces: 'sets single-use on the approval' },
  { pattern: 'prevent duplicate compensation', example: 'prevent duplicate refunds', produces: 'adds an idempotency key to write tools' },
  { pattern: 'never expose credentials', example: 'redact secrets', produces: 'inserts a redact gate before external outcomes' },
  { pattern: 'notify the customer', example: 'notify the customer', produces: 'ensures an external success outcome exists' }
];

const writeTool = graph => graph.nodes.filter(n => n.type === 'tool' && n.config.sideEffect === 'write').sort((a, b) => a.id < b.id ? -1 : 1)[0];
const gatingDecision = (graph, toolId) => {
  const potential = potentialPaths(graph);
  let best = null, bestIdx = -1;
  for (const p of potential) {
    if (p.target !== toolId) continue;
    for (let i = 0; i < p.path.length; i++) { const n = nodeById(graph, p.path[i]); if (n && n.type === 'decision' && i > bestIdx) { best = n.id; bestIdx = i; } }
  }
  return best;
};
const approvalControl = (graph, toolId) => {
  for (const p of potentialPaths(graph)) {
    if (p.target !== toolId) continue;
    for (const id of p.path) { const n = nodeById(graph, id); if (n && n.type === 'control' && n.config.kind !== 'policy_gate') return n.id; }
  }
  return null;
};
const alloc = (set, prefix) => { const id = nextId(set, prefix); set.add(id); return id; };

const handlers = [
  {
    re: /require\s+(?:(?:manager|human)\s+)?approval\s+above\s+\$?(\d+(?:\.\d+)?)/i,
    produce: (graph, m) => {
      const x = Number(m[1]);
      const tool = writeTool(graph);
      if (!tool) return [];
      const gate = gatingDecision(graph, tool.id);
      if (gate) return [{ op: 'setConfig', id: gate, key: 'condition', value: `amount > ${x}` }];
      const ids = { nodes: new Set(graph.nodes.map(n => n.id)), edges: new Set(graph.edges.map(e => e.id)) };
      const inEdge = flowIn(graph, tool.id)[0]; if (!inEdge) return [];
      const dec = alloc(ids.nodes, 'gate'), ctl = alloc(ids.nodes, 'approval');
      const fail = graph.nodes.filter(n => n.type === 'outcome' && !n.config.success).sort((a, b) => a.id < b.id ? -1 : 1)[0];
      return [
        { op: 'removeEdge', id: inEdge.id },
        { op: 'addNode', node: makeNode('decision', dec, { label: `Gate amount > ${x}`, config: { condition: `amount > ${x}` } }) },
        { op: 'addNode', node: makeNode('control', ctl, { label: 'Approval', config: { kind: 'human_approval', binding: ['customer'], slaMinutes: 15 } }) },
        { op: 'addEdge', edge: { id: alloc(ids.edges, 'e'), kind: 'flow', from: inEdge.from, to: { node: dec, port: 'in' } } },
        { op: 'addEdge', edge: { id: alloc(ids.edges, 'e'), kind: 'flow', from: { node: dec, port: 'true' }, to: { node: ctl, port: 'in' } } },
        { op: 'addEdge', edge: { id: alloc(ids.edges, 'e'), kind: 'flow', from: { node: ctl, port: 'approved' }, to: { node: tool.id, port: 'in' } } },
        { op: 'addEdge', edge: { id: alloc(ids.edges, 'e'), kind: 'flow', from: { node: dec, port: 'false' }, to: { node: tool.id, port: 'in' } } },
        ...(fail ? [{ op: 'addEdge', edge: { id: alloc(ids.edges, 'e'), kind: 'flow', from: { node: ctl, port: 'denied' }, to: { node: fail.id, port: 'in' } } }] : [])
      ];
    }
  },
  {
    re: /aggregate\s+(?:(?:per\s+customer|by\s+customer)\s+)?(?:per\s+day|daily)/i,
    produce: (graph) => {
      const tool = writeTool(graph); if (!tool) return [];
      const gate = gatingDecision(graph, tool.id); if (!gate) return [];
      const d = nodeById(graph, gate);
      const m = /amount\s*>\s*(\d+(?:\.\d+)?)/.exec(d.config.condition || '');
      const x = m ? m[1] : 0;
      return [{ op: 'setConfig', id: gate, key: 'condition', value: `dayTotal > ${x}` }];
    }
  },
  {
    re: /bind\s+(?:the\s+)?approval\s+to\s+(?:the\s+)?(customer|order|amount)(?:(?:\s*,\s*|\s+(?:and|,?)\s+)(customer|order|amount))*/i,
    produce: (graph, m) => {
      const fields = m[0].match(/\b(customer|order|amount)\b/g);
      const tool = writeTool(graph); if (!tool) return [];
      const ctl = approvalControl(graph, tool.id); if (!ctl) return [];
      const uniq = [...new Set(fields)];
      return [{ op: 'setConfig', id: ctl, key: 'binding', value: uniq }];
    }
  },
  {
    re: /single-?use\s+approvals?/i,
    produce: (graph) => {
      const tool = writeTool(graph); if (!tool) return [];
      const ctl = approvalControl(graph, tool.id); if (!ctl) return [];
      return [{ op: 'setConfig', id: ctl, key: 'singleUse', value: true }];
    }
  },
  {
    re: /prevent\s+duplicate/i,
    produce: (graph) => graph.nodes.filter(n => n.type === 'tool' && n.config.sideEffect === 'write').map(t => ({ op: 'setConfig', id: t.id, key: 'idempotencyKey', value: true }))
  },
  {
    re: /(?:never\s+(?:send|expose)|redact\s+secret)/i,
    produce: (graph) => {
      const ops = [];
      const ids = { nodes: new Set(graph.nodes.map(n => n.id)), edges: new Set(graph.edges.map(e => e.id)) };
      const fail = graph.nodes.filter(n => n.type === 'outcome' && !n.config.success).sort((a, b) => a.id < b.id ? -1 : 1)[0];
      for (const o of graph.nodes.filter(n => n.type === 'outcome' && n.config.success && n.config.external).sort((a, b) => a.id < b.id ? -1 : 1)) {
        for (const e of flowIn(graph, o.id)) {
          const gate = alloc(ids.nodes, 'redact');
          ops.push({ op: 'removeEdge', id: e.id });
          ops.push({ op: 'addNode', node: makeNode('control', gate, { label: 'Redact secrets', config: { kind: 'policy_gate', action: 'redact', redactAbove: 'internal', appliesWhen: '' } }) });
          ops.push({ op: 'addEdge', edge: { id: alloc(ids.edges, 'e'), kind: 'flow', from: e.from, to: { node: gate, port: 'in' } } });
          ops.push({ op: 'addEdge', edge: { id: alloc(ids.edges, 'e'), kind: 'flow', from: { node: gate, port: 'approved' }, to: { node: o.id, port: 'in' } } });
          if (fail) ops.push({ op: 'addEdge', edge: { id: alloc(ids.edges, 'e'), kind: 'flow', from: { node: gate, port: 'denied' }, to: { node: fail.id, port: 'in' } } });
        }
      }
      return ops;
    }
  },
  {
    re: /notify\s+the\s+customer/i,
    produce: (graph) => {
      if (graph.nodes.some(n => n.type === 'outcome' && n.config.success && n.config.external)) return [];
      const ids = new Set(graph.nodes.map(n => n.id));
      const id = alloc(ids, 'outcome');
      return [{ op: 'addNode', node: makeNode('outcome', id, { label: 'Customer Notified', config: { success: true, external: true } }) }];
    }
  }
];

export function compileText(text, graph) {
  const sentences = String(text).split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  const ops = [];
  const matched = [];
  const unmatched = [];
  for (const s of sentences) {
    let hit = false;
    for (const h of handlers) {
      const m = h.re.exec(s);
      if (m) { ops.push(...h.produce(graph, m)); matched.push(s); hit = true; break; }
    }
    if (!hit) unmatched.push(s);
  }
  return ok({ ops, matched, unmatched });
}
