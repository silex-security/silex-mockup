/* Rule-based proposer for Ask AI (plan §3.10 rule-based; web/CONTRACT.md
   "Rule-based proposer"). Turns bilingual sentences into a proposal whose ops
   are in the ProposalOp language (validated by validateProposal.js). Anything
   it cannot map goes to `unmatched`, never guessed. Pure: no DOM, no store. */
import { nodeById, flowOut, portsOf, ok } from '../../../js/model.js';
import { compileText } from '../../../js/nlcompile.js';
import { CATALOG, MONITORS } from '../builder/catalog.js';
import zh from '../i18n/zh.js';

/* ------------------------------------------------------------- vocabulary */
/* type word -> node type, English from the catalog label+syn and Chinese from
   zh.js node.<type>.label/syn. Longer words first so "human approval" wins over
   "approval", "data resource" over "data". */
const TYPE_WORDS = {};
function addWord(word, type) { const w = word.trim().toLowerCase(); if (w && !(w in TYPE_WORDS)) TYPE_WORDS[w] = type; }
for (const c of CATALOG) {
  for (const w of c.label.toLowerCase().split(/[^a-z0-9]+/)) addWord(w, c.type);
  for (const w of (c.syn || '').toLowerCase().split(/\s+/)) addWord(w, c.type);
  const zhLabel = (zh[`node.${c.type}.label`] || '').toLowerCase();
  const zhSyn = (zh[`node.${c.type}.syn`] || '').toLowerCase();
  if (zhLabel) addWord(zhLabel, c.type);
  for (const w of zhSyn.split(/\s+/)) addWord(w, c.type);
}
/* Multi-word phrases that must map before their single words. */
const TYPE_PHRASES = [
  ['human approval', 'control'], ['policy gate', 'control'], ['dual approval', 'control'],
  ['data resource', 'data'], ['agent role', 'agent'], ['人工审批', 'control'], ['策略闸门', 'control'],
  ['数据资源', 'data'], ['智能体角色', 'agent'], ['双重审批', 'control'], ['双人审批', 'control']
];
function findType(text) {
  const lower = text.toLowerCase();
  for (const [p, t] of TYPE_PHRASES) if (lower.includes(p)) return t;
  const words = Object.entries(TYPE_WORDS).sort((a, b) => b[0].length - a[0].length);
  for (const [w, t] of words) if (lower.includes(w)) return t;
  return null;
}

/* Monitor kinds, English + Chinese. */
const MONITOR_WORDS = { 'unauthorized write': 'unauthorized_write', '未授权写入': 'unauthorized_write', '未授权写': 'unauthorized_write',
  'duplicate effect': 'duplicate_effect', '重复执行': 'duplicate_effect', '重复': 'duplicate_effect',
  'secret exposure': 'secret_exposure', '机密泄露': 'secret_exposure', '泄露': 'secret_exposure', '机密泄漏': 'secret_exposure' };
for (const m of MONITORS) { addMonitorWord(m.kind); }
function addMonitorWord(kind) {
  const e = MONITORS.find(m => m.kind === kind)?.label; if (e) MONITOR_WORDS[e.toLowerCase()] = kind;
  const z = zh[`monitor.${kind}.label`]; if (z) MONITOR_WORDS[z.toLowerCase()] = kind;
}
function findMonitor(text) {
  const lower = text.toLowerCase();
  for (const [w, k] of Object.entries(MONITOR_WORDS).sort((a, b) => b[0].length - a[0].length)) if (lower.includes(w)) return k;
  return null;
}

const SENS_WORDS = { public: 'public', internal: 'internal', secret: 'secret', '公开': 'public', '内部': 'internal', '机密': 'secret', '敏感': 'secret' };
function findSens(text) {
  const lower = text.toLowerCase();
  for (const [w, s] of Object.entries(SENS_WORDS).sort((a, b) => b[0].length - a[0].length)) if (lower.includes(w)) return s;
  return null;
}

const FIELD_WORDS = { condition: 'condition', '条件': 'condition',
  threshold: 'threshold', '阈值': 'threshold', '门槛': 'threshold',
  'single use': 'singleUse', 'single-use': 'singleUse', '一次性': 'singleUse',
  sla: 'slaMinutes', '审批响应时间': 'slaMinutes', sensitivity: 'sensitivity', '敏感级别': 'sensitivity',
  'min approvers': 'minApprovers', '最少审批人数': 'minApprovers', severity: 'severity', '严重性': 'severity' };
function findField(text) {
  const lower = text.toLowerCase();
  for (const [w, f] of Object.entries(FIELD_WORDS).sort((a, b) => b[0].length - a[0].length)) if (lower.includes(w)) return f;
  return null;
}

/* ------------------------------------------------------------- node lookup */
function resolveNode(graph, text) {
  const lower = text.toLowerCase();
  const byLabel = graph.nodes.slice().sort((a, b) => b.label.length - a.label.length);
  for (const n of byLabel) if (n.label && lower.includes(n.label.toLowerCase())) return n;
  for (const n of graph.nodes) if (lower.includes(n.id.toLowerCase())) return n;
  return null;
}

/* ------------------------------------------------------------- value parse */
function parseValue(text) {
  const t = text.trim();
  if (/^["'](.+)["']$/.test(t)) return t.slice(1, -1);
  if (/^(true|false)$/i.test(t)) return t.toLowerCase() === 'true';
  if (/^[-+]?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (/[<>=!]/.test(t)) return t;            // expression: amount > 500, dayTotal >= 1000
  return t;                                   // plain string
}

/* -------------------------------------------------------------- helpers */
function approvalControl(graph) { return graph.nodes.find(n => n.type === 'control' && n.config.kind !== 'policy_gate') || null; }
function gatingDecision(graph, toolId) {
  // the decision nearest a write tool, as the optimizer does
  let best = null, bestIdx = -1;
  for (const p of pathsTo(graph, toolId)) for (let i = 0; i < p.length; i++) { const n = nodeById(graph, p[i]); if (n && n.type === 'decision' && i > bestIdx) { best = n.id; bestIdx = i; } }
  return best;
}
function pathsTo(graph, target) {
  const flow = graph.edges.filter(e => e.kind === 'flow');
  const adj = {}; for (const e of flow) (adj[e.from.node] = adj[e.from.node] || []).push(e.to.node);
  const res = []; const walk = (n, path) => { if (n === target) { res.push(path.slice()); return; } if (path.length > 40) return; for (const x of adj[n] || []) if (!path.includes(x)) walk(x, path.concat(x)); };
  for (const t of graph.nodes.filter(n => n.type === 'trigger')) walk(t.id, [t.id]);
  return res;
}

/* add <type> after <node>: addNext on the node's single out port, or insertStep
   between the node and its single successor when that port is already wired. */
function addAfterNode(graph, node, type, label, config) {
  if (!nodeById(graph, node.id)) return null;
  const outs = portsOf(node).filter(p => p.kind === 'out');
  if (outs.length !== 1) return null;          // a branching node: "after" is ambiguous
  const port = outs[0].id;
  const edge = flowOut(graph, node.id, port);
  if (edge) return { op: 'insertStep', from: node.id, to: edge.to.node, type, ...(label ? { label } : {}), ...(config ? { config } : {}) };
  return { op: 'addNext', node: node.id, port, type, ...(label ? { label } : {}), ...(config ? { config } : {}) };
}

/* ------------------------------------------------------------ parsers */
/* Each parser returns { summary, ops } or null. */
const parsers = [
  /* delete / remove <node>  ·  删除 <node> */
  {
    re: /^(?:delete|remove)\s+(?:the\s+)?(.+)$/i,
    parse: (m, graph) => { const n = resolveNode(graph, m[1]); return n ? { summary: `delete ${n.label}`, ops: [{ op: 'removeNode', node: n.id }] } : null; }
  },
  { re: /^删除(.+)$|^移除(.+)$/, parse: (m, graph) => { const t = m[1] || m[2]; const n = resolveNode(graph, t); return n ? { summary: `删除 ${n.label}`, ops: [{ op: 'removeNode', node: n.id }] } : null; } },

  /* rename <node> to <name>  ·  把 <node> 改名为 <name> */
  {
    re: /^rename\s+(.+?)\s+to\s+(.+)$/i,
    parse: (m, graph) => { const n = resolveNode(graph, m[1]); return n && m[2].trim() ? { summary: `rename ${n.label} to ${m[2].trim()}`, ops: [{ op: 'setLabel', node: n.id, label: m[2].trim() }] } : null; }
  },
  { re: /^把(.+?)改名为(.+)$|^将(.+?)改名为(.+)$/, parse: (m, graph) => { const a = m[1] || m[3], b = m[2] || m[4]; const n = resolveNode(graph, a); return n && b.trim() ? { summary: `把 ${n.label} 改名为 ${b.trim()}`, ops: [{ op: 'setLabel', node: n.id, label: b.trim() }] } : null; } },

  /* protect <tool/outcome> with <monitor>  ·  给 <node> 加 <monitor> 监控 */
  {
    re: /^protect\s+(.+?)\s+with\s+(?:a\s+|an\s+)?(.+)$/i,
    parse: (m, graph) => { const n = resolveNode(graph, m[1]); const k = findMonitor(m[2]); return n && k ? { summary: `protect ${n.label} with ${k}`, ops: [{ op: 'addMonitor', node: n.id, kind: k }] } : null; }
  },
  { re: /^给(.+?)(?:加上|添加|加)(?:一个|个)?(.+?)(?:监控|监视)?$/i, parse: (m, graph) => { const n = resolveNode(graph, m[1]); const k = findMonitor(m[2]); return n && k ? { summary: `给 ${n.label} 加 ${k} 监控`, ops: [{ op: 'addMonitor', node: n.id, kind: k }] } : null; } },

  /* add [a] <sensitivity> data resource <name> to <node>  (sensitivity in either
     language, before or after the name) ·  给 <node> 添加 <sensitivity> 数据资源 <name> */
  {
    re: /^add\s+(?:a\s+|an\s+)?(.+?)\s+to\s+(.+)$/i,
    parse: (m, graph) => {
      const spec = m[1]; if (!/data|资源/i.test(spec)) return null;      // only the data phrase
      const sens = findSens(spec); if (!sens) return null;
      const name = spec.replace(/data\s+resource|data\s+res|data|resource|资源/gi, ' ')
        .replace(/public|internal|secret|公开|内部|机密|敏感/gi, ' ')
        .replace(/^["'\s]+|["'\s]+$/g, '');
      const n = resolveNode(graph, m[2]);
      return n && name ? { summary: `add ${sens} data to ${n.label}`, ops: [{ op: 'addData', node: n.id, label: name, sensitivity: sens }] } : null;
    }
  },
  { re: /^给(.+?)添加(?:一个|个)?(公开|内部|机密|敏感)(?:的)?数据(?:资源)?(.+)$/i, parse: (m, graph) => { const n = resolveNode(graph, m[1]); const sens = findSens(m[2]); const label = m[3].trim().replace(/^['"]|['"]$/g, ''); return n && sens ? { summary: `给 ${n.label} 添加 ${sens} 数据`, ops: [{ op: 'addData', node: n.id, label, sensitivity: sens }] } : null; } },

  /* insert <type> between <A> and <B>  ·  在 <A> 和 <B> 之间插入 <type> */
  {
    re: /^insert\s+(?:a\s+|an\s+)?(.+?)\s+between\s+(.+?)\s+and\s+(.+)$/i,
    parse: (m, graph) => { const type = findType(m[1]); const A = resolveNode(graph, m[2]); const B = resolveNode(graph, m[3]); if (!type || !A || !B) return null; const e = graph.edges.find(x => x.kind === 'flow' && x.from.node === A.id && x.to.node === B.id); return e ? { summary: `insert ${type} between ${A.label} and ${B.label}`, ops: [{ op: 'insertStep', from: A.id, to: B.id, type }] } : null; }
  },
  { re: /^在(.+?)和(.+?)之间(?:插入|添加|加)(?:一个|个)?(.+)$/i, parse: (m, graph) => { const type = findType(m[3]); const A = resolveNode(graph, m[1]); const B = resolveNode(graph, m[2]); if (!type || !A || !B) return null; const e = graph.edges.find(x => x.kind === 'flow' && x.from.node === A.id && x.to.node === B.id); return e ? { summary: `在 ${A.label} 和 ${B.label} 之间插入 ${type}`, ops: [{ op: 'insertStep', from: A.id, to: B.id, type }] } : null; } },

  /* add <type> after <node>  ·  在 <node> 后面加 <type> */
  {
    re: /^add\s+(?:a\s+|an\s+)?(.+?)\s+after\s+(.+)$/i,
    parse: (m, graph) => { const type = findType(m[1]); const n = resolveNode(graph, m[2]); if (!type || !n) return null; if (type === 'data' || type === 'prohibited') return null; const op = addAfterNode(graph, n, type); return op ? { summary: `add ${type} after ${n.label}`, ops: [op] } : null; }
  },
  { re: /^在(.+?)(?:后面|之后)加(?:一个|个)?(.+)$/i, parse: (m, graph) => { const type = findType(m[2]); const n = resolveNode(graph, m[1]); if (!type || !n) return null; if (type === 'data' || type === 'prohibited') return null; const op = addAfterNode(graph, n, type); return op ? { summary: `在 ${n.label} 后面加 ${type}`, ops: [op] } : null; } },

  /* approval above X on a control  ·  审批超过 X / 金额超过 X 才需要审批 */
  {
    re: /^(?:set\s+(?:the\s+)?)?approval\s+(?:threshold\s+)?above\s+\$?(\d+(?:\.\d+)?)$/i,
    parse: (m, graph) => { if (/require/i.test(m[0])) return null; const c = approvalControl(graph); return c ? { summary: `approval above ${m[1]}`, ops: [{ op: 'setConfig', node: c.id, key: 'appliesWhen', value: `amount > ${m[1]}` }] } : null; }
  },
  { re: /^(?:金额|额度)?(?:超过|大于)(\d+(?:\.\d+)?)(?:才|就)?需要审批$/i, parse: (m, graph) => { const c = approvalControl(graph); return c ? { summary: `超过 ${m[1]} 需要审批`, ops: [{ op: 'setConfig', node: c.id, key: 'appliesWhen', value: `amount > ${m[1]}` }] } : null; } },

  /* set <field> of <node> to <value>  ·  把 <node> 的 <field> 改为 <value> */
  {
    re: /^set\s+(?:the\s+)?(.+?)\s+of\s+(.+?)\s+to\s+(.+)$/i,
    parse: (m, graph) => { const f = findField(m[1]); const n = resolveNode(graph, m[2]); if (!f || !n) return null; const v = parseValue(m[3]); return { summary: `set ${f} of ${n.label}`, ops: [{ op: 'setConfig', node: n.id, key: f, value: v }] }; }
  },
  { re: /^把(.+?)的(.+?)(?:设为|改为|改成)(.+)$/i, parse: (m, graph) => { const f = findField(m[2]); const n = resolveNode(graph, m[1]); if (!f || !n) return null; const v = parseValue(m[3]); return { summary: `把 ${n.label} 的 ${f} 设为 ${m[3].trim()}`, ops: [{ op: 'setConfig', node: n.id, key: f, value: v }] }; } },

  /* condition: amount > X on the gating decision (amount/threshold shorthand) */
  {
    re: /^(?:set\s+)?condition\s+(?:to\s+)?(.+)$/i,
    parse: (m, graph) => { const tool = graph.nodes.find(n => n.type === 'tool' && n.config.sideEffect === 'write'); const g = tool && gatingDecision(graph, tool.id); return g ? { summary: `set condition`, ops: [{ op: 'setConfig', node: g, key: 'condition', value: m[1].trim() }] } : null; }
  }
];

/* nlcompile fallback: the existing policy phrases (require approval above $X,
   aggregate per day, bind approval, single-use, prevent duplicate, …). Its
   primitive ops are translated into the ProposalOp language; a phrase that
   needs a raw addNode is left unmatched. */
function mapNlOps(ops) {
  const out = [];
  for (const o of ops) {
    if (o.op === 'setConfig') out.push({ op: 'setConfig', node: o.id, key: o.key, value: o.value });
    else if (o.op === 'setLabel') out.push({ op: 'setLabel', node: o.id, label: o.label });
    else if (o.op === 'removeNode') out.push({ op: 'removeNode', node: o.id });
    else if (o.op === 'removeEdge') out.push({ op: 'removeEdge', id: o.id });
    else if (o.op === 'addEdge') out.push({ op: 'connect', from: { node: o.edge.from.node, port: o.edge.from.port }, to: { node: o.edge.to.node, port: o.edge.to.port } });
    else if (o.op === 'moveNode') continue;
    else return null;                         // raw addNode: not expressible here
  }
  return out.length ? out : null;
}
function tryNl(sentence, graph) {
  const r = compileText(sentence, graph);
  if (!r.ok) return null;
  const { ops, matched, unmatched } = r.value;
  if (!matched.length || unmatched.length) return null;
  const mapped = mapNlOps(ops);
  return mapped ? { summary: matched.join('; '), ops: mapped } : null;
}

/* ------------------------------------------------------------- the API */
export function proposeByRules(text, graph) {
  const sentences = String(text).split(/[.!?。！？；;]+|\n+/).map(s => s.trim()).filter(Boolean);
  const ops = [], unmatched = [], matched = [];
  for (const sentence of sentences) {
    let hit = false;
    for (const p of parsers) {
      const m = sentence.match(p.re);
      if (!m) continue;
      const r = p.parse(m, graph);
      if (r) { ops.push(...r.ops); matched.push(r.summary); hit = true; break; }
    }
    if (!hit) {
      const nl = tryNl(sentence, graph);
      if (nl) { ops.push(...nl.ops); matched.push(nl.summary); }
      else unmatched.push(sentence);
    }
  }
  return ok({ summary: matched.join('; '), ops, unmatched });
}
