/* Blueprint model: node-type registry, port compatibility, pure graph
   operations, patch application, canonical JSON and a synchronous SHA-256.
   No DOM access; runs in the browser and under `node --test`.
   Semantics of every config field: logs/2026-09-22_BLUEPRINT_STUDIO_PLAN.md §4. */

export const SCHEMA = 'silex.blueprint/v1';

export const SENSITIVITY = ['public', 'internal', 'secret'];
export const BINDING_FIELDS = ['customer', 'order', 'amount'];
const JOIN = { key: 'join', label: 'Join', type: 'select', options: ['first', 'all'] };

/* Port kinds: 'in' (flow-in), 'out' (flow-out), 'acc' (access). */
export const NODE_TYPES = {
  trigger: {
    label: 'Trigger', category: 'Inputs', css: 'trigger',
    ports: [{ id: 'out', kind: 'out', label: '' }],
    defaults: { channel: 'support_chat', trust: 'untrusted' },
    schema: [
      { key: 'channel', label: 'Channel', type: 'select', options: ['support_chat', 'email', 'api_event', 'support_ticket'] },
      { key: 'trust', label: 'Input trust', type: 'select', options: ['untrusted', 'internal'] }
    ]
  },
  agent: {
    label: 'Agent role', category: 'Agents & tools', css: 'agent',
    ports: [{ id: 'in', kind: 'in', label: '' }, { id: 'out', kind: 'out', label: '' }, { id: 'acc', kind: 'acc', label: 'access' }],
    defaults: { candidate: 'Internal Agent', capabilities: [], canSplit: false, outputCeiling: 'internal', join: 'first' },
    schema: [
      { key: 'candidate', label: 'Implementation candidate', type: 'text' },
      { key: 'capabilities', label: 'Capabilities (cap · limit)', type: 'caps' },
      { key: 'canSplit', label: 'Can split one request into several writes', type: 'bool' },
      { key: 'outputCeiling', label: 'Output sensitivity ceiling', type: 'select', options: SENSITIVITY },
      JOIN
    ]
  },
  tool: {
    label: 'Tool / MCP', category: 'Agents & tools', css: 'tool',
    ports: [{ id: 'in', kind: 'in', label: '' }, { id: 'out', kind: 'out', label: '' }, { id: 'acc', kind: 'acc', label: 'access' }],
    defaults: { cap: 'refund.issue', sideEffect: 'write', idempotencyKey: false, join: 'first' },
    schema: [
      { key: 'cap', label: 'Capability', type: 'text' },
      { key: 'sideEffect', label: 'Side effect', type: 'select', options: ['none', 'write'] },
      { key: 'idempotencyKey', label: 'Idempotency key (customer · order)', type: 'bool' },
      JOIN
    ]
  },
  decision: {
    label: 'Decision', category: 'Logic & controls', css: 'decision',
    ports: [{ id: 'in', kind: 'in', label: '' }, { id: 'true', kind: 'out', label: 'yes' }, { id: 'false', kind: 'out', label: 'no' }],
    defaults: { condition: 'amount > 500', join: 'first' },
    schema: [{ key: 'condition', label: 'Condition', type: 'expr' }, JOIN]
  },
  control: {
    label: 'Control point', category: 'Logic & controls', css: 'control',
    ports: [{ id: 'in', kind: 'in', label: '' }, { id: 'approved', kind: 'out', label: 'approved' }, { id: 'denied', kind: 'out', label: 'denied' }],
    defaults: { kind: 'human_approval', appliesWhen: '', binding: ['customer'], singleUse: false, slaMinutes: 15, rule: '', action: 'block', redactAbove: 'internal', join: 'first' },
    schema: [
      { key: 'kind', label: 'Kind', type: 'select', options: ['human_approval', 'dual_approval', 'policy_gate'] },
      { key: 'appliesWhen', label: 'Applies when (empty = always)', type: 'expr', optional: true },
      { key: 'binding', label: 'Approval bound to', type: 'multiselect', options: BINDING_FIELDS, when: c => c.kind !== 'policy_gate' },
      { key: 'singleUse', label: 'Single-use approval', type: 'bool', when: c => c.kind !== 'policy_gate' },
      { key: 'slaMinutes', label: 'Approver SLA (minutes)', type: 'number', when: c => c.kind !== 'policy_gate' },
      { key: 'action', label: 'Gate action', type: 'select', options: ['block', 'redact'], when: c => c.kind === 'policy_gate' },
      { key: 'rule', label: 'Rule (block: pass when true)', type: 'expr', when: c => c.kind === 'policy_gate' && c.action === 'block' },
      { key: 'redactAbove', label: 'Redact labels above', type: 'select', options: ['public', 'internal'], when: c => c.kind === 'policy_gate' && c.action === 'redact' },
      JOIN
    ]
  },
  data: {
    label: 'Data resource', category: 'Data', css: 'data',
    ports: [{ id: 'acc', kind: 'acc', label: '' }],
    defaults: { sensitivity: 'internal' },
    schema: [{ key: 'sensitivity', label: 'Sensitivity', type: 'select', options: SENSITIVITY }]
  },
  outcome: {
    label: 'Outcome', category: 'Outcomes', css: 'outcome',
    ports: [{ id: 'in', kind: 'in', label: '' }],
    defaults: { success: true, external: true, join: 'first' },
    schema: [
      { key: 'success', label: 'Legitimate success outcome', type: 'bool' },
      { key: 'external', label: 'Emits to the requester', type: 'bool' },
      JOIN
    ]
  },
  prohibited: {
    label: 'Prohibited outcome', category: 'Outcomes', css: 'prohibited',
    ports: [],
    defaults: { monitor: 'unauthorized_write', cap: 'refund.issue', threshold: 500, scope: 'request', minApprovers: 1, probeRange: [500, 2000], severity: 'critical', watches: [] },
    schema: [
      { key: 'monitor', label: 'Monitor', type: 'select', options: ['unauthorized_write', 'duplicate_effect', 'secret_exposure'] },
      { key: 'cap', label: 'Capability', type: 'text', when: c => c.monitor !== 'secret_exposure' },
      { key: 'threshold', label: 'Approval threshold', type: 'number', when: c => c.monitor === 'unauthorized_write' },
      { key: 'scope', label: 'Scope', type: 'select', options: ['write', 'request', 'customer_day'], when: c => c.monitor === 'unauthorized_write' },
      { key: 'minApprovers', label: 'Minimum approvers', type: 'number', when: c => c.monitor === 'unauthorized_write' },
      { key: 'probeRange', label: 'Adversary amount range [lo, hi]', type: 'range', when: c => c.monitor === 'unauthorized_write' },
      { key: 'severity', label: 'Severity', type: 'select', options: ['critical', 'high', 'medium'] },
      { key: 'watches', label: 'Watches (tools / outcomes)', type: 'nodeRefs', refTypes: ['tool', 'outcome'] }
    ]
  }
};

export const CATEGORIES = ['Inputs', 'Agents & tools', 'Logic & controls', 'Data', 'Outcomes'];

export const isNodeType = t => typeof t === 'string' && Object.hasOwn(NODE_TYPES, t);

export function portsOf(node) { return isNodeType(node.type) ? NODE_TYPES[node.type].ports : []; }
export function portDef(node, portId) { return portsOf(node).find(p => p.id === portId) || null; }
export function nodeById(graph, id) { return graph.nodes.find(n => n.id === id) || null; }

/* ---------------------------------------------------------------- results */
export const ok = value => ({ ok: true, value });
export const fail = (code, message, extra = {}) => ({ ok: false, error: { code, message, ...extra } });

/* ------------------------------------------------------- port compatibility */
/* A flow edge joins an 'out' port to an 'in' port; an access edge joins an
   agent/tool 'acc' port to a data 'acc' port. One edge per 'out' port. */
export function canConnect(graph, from, to) {
  const a = nodeById(graph, from.node), b = nodeById(graph, to.node);
  if (!a || !b) return fail('unknown_node', 'Unknown node');
  if (a.id === b.id) return fail('self_edge', 'A node cannot connect to itself');
  const pa = portDef(a, from.port), pb = portDef(b, to.port);
  if (!pa || !pb) return fail('unknown_port', 'Unknown port');
  if (pa.kind === 'out' && pb.kind === 'in') {
    if (graph.edges.some(e => e.kind === 'flow' && e.from.node === a.id && e.from.port === pa.id))
      return fail('port_taken', 'That output already has an edge');
    /* Two branches of one node (true/false, approved/denied) may rejoin the same step,
       so a duplicate is the same source *port* to the same target port. */
    if (graph.edges.some(e => e.kind === 'flow' && e.from.node === a.id && e.from.port === pa.id && e.to.node === b.id && e.to.port === pb.id))
      return fail('duplicate_edge', 'Edge already exists');
    return ok({ kind: 'flow', from: { node: a.id, port: pa.id }, to: { node: b.id, port: pb.id } });
  }
  if (pa.kind === 'acc' && pb.kind === 'acc') {
    const [actor, data] = a.type === 'data' ? [b, a] : [a, b];
    if (data.type !== 'data' || !['agent', 'tool'].includes(actor.type))
      return fail('bad_access', 'Access edges join an agent or tool to a data resource');
    if (graph.edges.some(e => e.kind === 'access' && e.from.node === actor.id && e.to.node === data.id))
      return fail('duplicate_edge', 'Access edge already exists');
    return ok({ kind: 'access', mode: 'read', from: { node: actor.id, port: 'acc' }, to: { node: data.id, port: 'acc' } });
  }
  return fail('incompatible_ports', `Cannot connect ${pa.kind} to ${pb.kind}`);
}

/* ------------------------------------------------------------------ ids */
export function nextId(taken, prefix) {
  let k = 1;
  const set = taken instanceof Set ? taken : new Set(taken);
  while (set.has(`${prefix}-${k}`)) k++;
  return `${prefix}-${k}`;
}

export function clone(v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }

export function makeNode(type, id, { x = 0, y = 0, label, config } = {}) {
  const def = NODE_TYPES[type];
  if (!isNodeType(type)) throw new Error('Unknown node type ' + type);
  return { id, type, label: label || def.label, x: Math.round(x), y: Math.round(y), config: { ...clone(def.defaults), ...clone(config || {}) } };
}

/* ---------------------------------------------------------- patch ops
   Every mutation of a graph, from the editor, the optimizer or the NL
   compiler, is a list of these ops. applyPatch is pure and all-or-nothing.
     {op:'addNode', node}                       node is a full node object
     {op:'removeNode', id}                      also drops its edges and watch refs
     {op:'moveNode', id, x, y}
     {op:'setLabel', id, label}
     {op:'setConfig', id, key, value}
     {op:'addEdge', edge}                       edge is a full edge object (with id)
     {op:'removeEdge', id}                                                      */
export function applyPatch(graph, ops) {
  const g = clone(graph);
  for (const o of ops) {
    const r = applyOp(g, o);
    if (!r.ok) return r;
  }
  return ok(g);
}

function applyOp(g, o) {
  switch (o.op) {
    case 'addNode': {
      if (!o.node || !isNodeType(o.node.type)) return fail('bad_op', 'addNode needs a typed node');
      if (nodeById(g, o.node.id)) return fail('duplicate_id', 'Node id exists: ' + o.node.id);
      g.nodes.push(clone(o.node)); return ok();
    }
    case 'removeNode': {
      if (!nodeById(g, o.id)) return fail('unknown_node', 'No node ' + o.id, { nodeId: o.id });
      g.nodes = g.nodes.filter(n => n.id !== o.id);
      g.edges = g.edges.filter(e => e.from.node !== o.id && e.to.node !== o.id);
      for (const n of g.nodes) if (n.type === 'prohibited' && Array.isArray(n.config.watches))
        n.config.watches = n.config.watches.filter(w => w !== o.id);
      return ok();
    }
    case 'moveNode': {
      const n = nodeById(g, o.id); if (!n) return fail('unknown_node', 'No node ' + o.id, { nodeId: o.id });
      n.x = Math.round(o.x); n.y = Math.round(o.y); return ok();
    }
    case 'setLabel': {
      const n = nodeById(g, o.id); if (!n) return fail('unknown_node', 'No node ' + o.id, { nodeId: o.id });
      n.label = String(o.label); return ok();
    }
    case 'setConfig': {
      const n = nodeById(g, o.id); if (!n) return fail('unknown_node', 'No node ' + o.id, { nodeId: o.id });
      n.config[o.key] = clone(o.value); return ok();
    }
    case 'addEdge': {
      const e = o.edge;
      if (!e || !e.id || g.edges.some(x => x.id === e.id)) return fail('bad_op', 'addEdge needs a unique id');
      const r = canConnect(g, e.from, e.to);
      if (!r.ok) return r;
      g.edges.push(clone({ ...r.value, ...e, kind: r.value.kind, from: r.value.from, to: r.value.to })); return ok();
    }
    case 'removeEdge': {
      if (!g.edges.some(e => e.id === o.id)) return fail('unknown_edge', 'No edge ' + o.id);
      g.edges = g.edges.filter(e => e.id !== o.id); return ok();
    }
    default: return fail('bad_op', 'Unknown op ' + o.op);
  }
}

/* -------------------------------------------------------- canonical JSON */
export function canonical(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
}

/* Semantic content of a revision: positions are view state and excluded. */
export function semanticGraph(graph, meta = {}) {
  return {
    name: meta.name ?? null, domain: meta.domain ?? null,
    nodes: [...graph.nodes].sort((a, b) => a.id < b.id ? -1 : 1).map(({ x, y, ...n }) => n),
    edges: [...graph.edges].sort((a, b) => a.id < b.id ? -1 : 1)
  };
}

export function hashGraph(graph, meta = {}) { return sha256Hex(canonical(semanticGraph(graph, meta))); }

/* ------------------------------------------------------------ SHA-256 */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);

export function sha256Hex(str) {
  const bytes = new TextEncoder().encode(str);
  const len = bytes.length, total = ((len + 9 + 63) >> 6) << 6;
  const buf = new Uint8Array(total); buf.set(bytes); buf[len] = 0x80;
  const dv = new DataView(buf.buffer);
  dv.setUint32(total - 8, Math.floor(len / 0x20000000)); dv.setUint32(total - 4, (len << 3) >>> 0);
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const W = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  return [...H].map(x => x.toString(16).padStart(8, '0')).join('');
}

/* ------------------------------------------------------- graph queries */
export function flowOut(graph, nodeId, portId) {
  return graph.edges.find(e => e.kind === 'flow' && e.from.node === nodeId && (portId == null || e.from.port === portId)) || null;
}
export function flowIn(graph, nodeId) { return graph.edges.filter(e => e.kind === 'flow' && e.to.node === nodeId); }
export function accessOf(graph, nodeId) {
  return graph.edges.filter(e => e.kind === 'access' && e.from.node === nodeId).map(e => nodeById(graph, e.to.node)).filter(Boolean);
}
