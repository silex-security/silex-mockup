/* Ask AI: the proposal validator (plan §3.10–3.10.1 B). A proposal from either
   proposer is untrusted input. It is checked structurally, then expanded op by
   op against a working graph — each op is applied and the working graph must
   still pass io.checkGraph (the import check) — with {ref} names remapped to
   the ids actually allocated. The first failure rejects the whole proposal and
   names the op; nothing touches the store here. Pure: no DOM, no React. */
import { NODE_TYPES, isNodeType, applyPatch, canConnect, nextId, nodeById, portsOf } from '../../../js/model.js';
import { check as checkExpr } from '../../../js/expr.js';
import { checkGraph } from '../../../js/io.js';
import { insertOnEdge, addAfter, addMonitor, addData, EDGE_INSERTABLE, PORT_ADDABLE } from '../builder/insert.js';

const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_OPS = 30, MAX_STR = 200, MAX_ARR = 20, MAX_NUM = 1e9;
const OPS = {
  insertStep: ['op', 'from', 'to', 'edge', 'type', 'ref', 'label', 'config'],
  addNext: ['op', 'node', 'port', 'type', 'ref', 'label', 'config'],
  addMonitor: ['op', 'node', 'kind', 'ref'],
  addData: ['op', 'node', 'label', 'sensitivity', 'ref'],
  connect: ['op', 'from', 'to'],
  setLabel: ['op', 'node', 'label'],
  setConfig: ['op', 'node', 'key', 'value'],
  removeNode: ['op', 'node'],
  removeEdge: ['op', 'id', 'from', 'to']
};
const MONITOR_KINDS = ['unauthorized_write', 'duplicate_effect', 'secret_exposure'];
const SENS = ['public', 'internal', 'secret'];
/* Fields other fields depend on (`when`) are set first. */
const FIRST = ['kind', 'action', 'monitor'];

const fail = (i, msg, code = 'bad_proposal') => ({ ok: false, error: { code, message: i == null ? msg : `Change ${i + 1}: ${msg}`, index: i } });
const isPlain = v => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

/* Bounds and forbidden keys at any depth. */
function scan(v, depth = 0) {
  if (depth > 6) return 'too deeply nested';
  if (typeof v === 'string') return v.length > MAX_STR ? `text longer than ${MAX_STR} characters` : null;
  if (typeof v === 'number') return Number.isFinite(v) && Math.abs(v) <= MAX_NUM ? null : 'number out of range';
  if (typeof v === 'boolean' || v === null) return null;
  if (Array.isArray(v)) { if (v.length > MAX_ARR) return `list longer than ${MAX_ARR}`; for (const x of v) { const e = scan(x, depth + 1); if (e) return e; } return null; }
  if (typeof v === 'object') {
    if (!isPlain(v)) return 'not a plain object';
    for (const k of Object.keys(v)) { if (BAD_KEYS.has(k)) return `forbidden key "${k}"`; const e = scan(v[k], depth + 1); if (e) return e; }
    return null;
  }
  return 'unsupported value';
}

/* One field value, checked like import does (io.checkConfig), plus expressions. */
function checkField(f, value, graph) {
  switch (f.type) {
    case 'text': return typeof value === 'string' ? null : 'must be text';
    case 'expr': { if (typeof value !== 'string') return 'must be an expression'; if (value.trim() === '' && f.optional) return null; const r = checkExpr(value.trim()); return r.ok ? null : 'expression: ' + r.error.message; }
    case 'number': return typeof value === 'number' && Number.isFinite(value) ? null : 'must be a number';
    case 'bool': return typeof value === 'boolean' ? null : 'must be true or false';
    case 'select': return f.options.includes(value) ? null : `must be one of ${f.options.join(', ')}`;
    case 'multiselect': return Array.isArray(value) && value.every(x => f.options.includes(x)) ? null : `must be a list of ${f.options.join(', ')}`;
    case 'range': return Array.isArray(value) && value.length === 2 && value.every(x => typeof x === 'number' && Number.isFinite(x)) && value[0] < value[1] ? null : 'must be [low, high]';
    case 'caps': return Array.isArray(value) && value.every(c => isPlain(c) && typeof c.cap === 'string' && c.cap && typeof c.limit === 'number' && Number.isFinite(c.limit)) ? null : 'must be a list of {cap, limit}';
    case 'nodeRefs': return Array.isArray(value) && value.every(id => typeof id === 'string' && graph.nodes.some(n => n.id === id && f.refTypes.includes(n.type))) ? null : 'must list existing tools or outcomes';
    default: return 'unsupported field';
  }
}

export function validateProposal(graph, proposal) {
  try { return run(graph, proposal); }
  catch (e) { return fail(null, 'the proposal could not be checked: ' + String(e && e.message || e), 'bad_proposal'); }
}

function run(graph, proposal) {
  if (!isPlain(proposal)) return fail(null, 'the reply is not an object');
  if (!Array.isArray(proposal.ops) || proposal.ops.length < 1) return fail(null, 'no changes were proposed', 'empty');
  if (proposal.ops.length > MAX_OPS) return fail(null, `more than ${MAX_OPS} changes; ask for less at a time`);
  const bad = scan(proposal.ops); if (bad) return fail(null, bad);

  let g = graph;
  const refs = new Map(), created = [], touched = new Set(), out = [];

  const resolve = (i, r) => {
    if (typeof r === 'string') return nodeById(g, r) ? { ok: true, value: r } : fail(i, `no step with id "${r}"`);
    if (isPlain(r) && typeof r.ref === 'string' && Object.keys(r).length === 1) return refs.has(r.ref) ? { ok: true, value: refs.get(r.ref) } : fail(i, `"${r.ref}" is used before it is created`);
    return fail(i, 'a step must be an id or {ref}');
  };
  /* Apply primitive ops to the working graph; the result must pass the import check. */
  const commit = (i, ops) => {
    const r = applyPatch(g, ops);
    if (!r.ok) return fail(i, r.error.message);
    const c = checkGraph(r.value, 'proposal');
    if (!c.ok) return fail(i, c.error.message.replace(/^proposal: /, ''));
    g = r.value; out.push(...ops); return { ok: true };
  };
  const setOps = (i, id, label, config) => {
    const node = nodeById(g, id), ops = [];
    if (label != null) { if (typeof label !== 'string' || !label.trim()) return fail(i, 'label must be text'); ops.push({ op: 'setLabel', id, label: label.trim() }); }
    if (config != null) {
      if (!isPlain(config)) return fail(i, 'config must be an object');
      const keys = Object.keys(config).sort((a, b) => (FIRST.includes(b) ? 1 : 0) - (FIRST.includes(a) ? 1 : 0));
      let cfg = { ...node.config };
      for (const key of keys) {
        const f = NODE_TYPES[node.type].schema.find(x => x.key === key);
        if (!f) return fail(i, `“${key}” is not a setting of a ${node.type}`);
        cfg = { ...cfg, [key]: config[key] };
        if (f.when && !f.when(cfg)) return fail(i, `“${key}” does not apply to this ${node.type}'s current settings`);
        const e = checkField(f, config[key], g); if (e) return fail(i, `${key} ${e}`);
        ops.push({ op: 'setConfig', id, key, value: config[key] });
      }
    }
    return { ok: true, value: ops };
  };
  const newId = before => g.nodes.find(n => !before.has(n.id))?.id;

  for (const [i, op] of proposal.ops.entries()) {
    if (!isPlain(op) || typeof op.op !== 'string' || !Object.hasOwn(OPS, op.op)) return fail(i, `unknown change "${isPlain(op) ? op.op : typeof op}"`);
    const extra = Object.keys(op).find(k => !OPS[op.op].includes(k)); if (extra) return fail(i, `unexpected field "${extra}"`);
    if (op.ref != null && (typeof op.ref !== 'string' || refs.has(op.ref))) return fail(i, 'ref must be a new name');

    const structural = (res, type) => {
      if (!res.ok) return fail(i, res.error.message);
      const before = new Set(g.nodes.map(n => n.id));
      // strip the builders' layout moves: positions come from the layout on apply
      const ops = res.value.filter(o => o.op !== 'moveNode');
      const c = commit(i, ops); if (!c.ok) return c;
      const id = newId(before) && [...g.nodes].reverse().find(n => !before.has(n.id) && (!type || n.type === type))?.id;
      if (!id) return fail(i, 'nothing was created');
      for (const n of g.nodes) if (!before.has(n.id)) created.push(n.id);
      if (op.ref) refs.set(op.ref, id);
      touched.add(id);
      return { ok: true, value: id };
    };

    switch (op.op) {
      case 'insertStep': {
        if (!EDGE_INSERTABLE.includes(op.type)) return fail(i, `a ${op.type} cannot be inserted between steps`);
        let e;
        if (op.edge != null) {                           // a specific connection (e.g. one branch of two that share both ends)
          if (typeof op.edge !== 'string' || op.from != null || op.to != null) return fail(i, 'give either edge, or from and to');
          e = g.edges.find(x => x.kind === 'flow' && x.id === op.edge);
          if (!e) return fail(i, `no connection with id "${op.edge}"`);
        } else {
          const a = resolve(i, op.from); if (!a.ok) return a; const b = resolve(i, op.to); if (!b.ok) return b;
          const es = g.edges.filter(x => x.kind === 'flow' && x.from.node === a.value && x.to.node === b.value);
          if (!es.length) return fail(i, 'those two steps are not directly connected');
          if (es.length > 1) return fail(i, 'those two steps are connected more than once; name the connection with edge');
          e = es[0];
        }
        const r = structural(insertOnEdge(g, e.id, op.type), op.type); if (!r.ok) return r;
        const s = setOps(i, r.value, op.label, op.config); if (!s.ok) return s;
        const c = commit(i, s.value); if (!c.ok) return c; break;
      }
      case 'addNext': {
        if (!PORT_ADDABLE.includes(op.type)) return fail(i, `a ${op.type} cannot follow a step`);
        const a = resolve(i, op.node); if (!a.ok) return a;
        const node = nodeById(g, a.value);
        if (!portsOf(node).some(p => p.kind === 'out' && p.id === op.port)) return fail(i, `“${node.label}” has no output “${op.port}”`);
        if (g.edges.some(x => x.kind === 'flow' && x.from.node === a.value && x.from.port === op.port)) return fail(i, `“${node.label}” → ${op.port} is already connected; use insertStep`);
        const r = structural(addAfter(g, a.value, op.port, op.type), op.type); if (!r.ok) return r;
        const s = setOps(i, r.value, op.label, op.config); if (!s.ok) return s;
        const c = commit(i, s.value); if (!c.ok) return c; break;
      }
      case 'addMonitor': {
        if (!MONITOR_KINDS.includes(op.kind)) return fail(i, `unknown monitor “${op.kind}”`);
        const a = resolve(i, op.node); if (!a.ok) return a;
        const t = nodeById(g, a.value).type;
        if (!(op.kind === 'secret_exposure' ? t === 'outcome' : t === 'tool')) return fail(i, `a ${op.kind} monitor watches a ${op.kind === 'secret_exposure' ? 'outcome' : 'tool'}`);
        const r = structural(addMonitor(g, a.value, op.kind), 'prohibited'); if (!r.ok) return r; break;
      }
      case 'addData': {
        if (!SENS.includes(op.sensitivity)) return fail(i, 'sensitivity must be public, internal or secret');
        if (typeof op.label !== 'string' || !op.label.trim()) return fail(i, 'the data resource needs a name');
        const a = resolve(i, op.node); if (!a.ok) return a;
        if (!['agent', 'tool'].includes(nodeById(g, a.value).type)) return fail(i, 'only agents and tools read data');
        const r = structural(addData(g, a.value, op.label.trim(), op.sensitivity), 'data'); if (!r.ok) return r; break;
      }
      case 'connect': {
        if (!isPlain(op.from) || !isPlain(op.to)) return fail(i, 'connect needs from and to');
        const a = resolve(i, op.from.node); if (!a.ok) return a; const b = resolve(i, op.to.node); if (!b.ok) return b;
        const from = { node: a.value, port: String(op.from.port || 'out') }, to = { node: b.value, port: String(op.to.port || 'in') };
        const cc = canConnect(g, from, to); if (!cc.ok) return fail(i, cc.error.message);
        const id = nextId(g.edges.map(e => e.id), cc.value.kind === 'access' ? 'a' : 'e');
        const c = commit(i, [{ op: 'addEdge', edge: { id, ...cc.value } }]); if (!c.ok) return c;
        touched.add(a.value); touched.add(b.value); break;
      }
      case 'setLabel': case 'setConfig': {
        const a = resolve(i, op.node); if (!a.ok) return a;
        const s = op.op === 'setLabel' ? setOps(i, a.value, op.label, null) : setOps(i, a.value, null, { [op.key]: op.value });
        if (!s.ok) return s; if (!s.value.length) return fail(i, 'nothing to change');
        const c = commit(i, s.value); if (!c.ok) return c; touched.add(a.value); break;
      }
      case 'removeNode': {
        const a = resolve(i, op.node); if (!a.ok) return a;
        const c = commit(i, [{ op: 'removeNode', id: a.value }]); if (!c.ok) return c; break;
      }
      case 'removeEdge': {
        let e;
        if (op.id != null) e = g.edges.find(x => x.id === op.id);
        else { const a = resolve(i, op.from); if (!a.ok) return a; const b = resolve(i, op.to); if (!b.ok) return b; e = g.edges.find(x => x.from.node === a.value && x.to.node === b.value); }
        if (!e) return fail(i, 'no such connection');
        const c = commit(i, [{ op: 'removeEdge', id: e.id }]); if (!c.ok) return c; break;
      }
    }
  }
  return { ok: true, value: { ops: out, created, touched: [...touched].filter(id => g.nodes.some(n => n.id === id)), graph: g, summary: typeof proposal.summary === 'string' ? proposal.summary.slice(0, MAX_STR) : '' } };
}
