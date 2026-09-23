/* Rule-based proposer for Ask AI (plan §3.10 rule-based; web/CONTRACT.md
   "Rule-based proposer"). Turns bilingual sentences into a proposal whose ops
   are in the ProposalOp language (validated by validateProposal.js).

   Grammar discipline (Codex round-2): every rule is anchored to the WHOLE
   sentence (after trimming trailing punctuation and a short list of politeness
   words). Qualifiers and thresholds come from closed lists; a node reference
   must match an existing label or id EXACTLY (case-insensitive, whole span —
   an optional leading article and a trailing type word are allowed, but nothing
   else). Any character not consumed by a rule means the WHOLE sentence goes to
   `unmatched` and produces no op — never a weaker or silently-different policy.
   Pure: no DOM, no store. */
import { nodeById, flowOut, portsOf, ok } from '../../../js/model.js';
import { CATALOG, MONITORS } from '../builder/catalog.js';
import zh from '../i18n/zh.js';

/* ------------------------------------------------------------- vocabulary */
const TYPE_WORDS = { agent: 'agent', role: 'agent', tool: 'tool', api: 'tool', decision: 'decision', condition: 'decision', branch: 'decision', control: 'control', approval: 'control', gate: 'control', checkpoint: 'control', outcome: 'outcome', result: 'outcome', trigger: 'trigger' };
const TRAILING_TYPE = new Set(['agent', 'role', 'tool', 'api', 'decision', 'condition', 'branch', 'control', 'approval', 'gate', 'checkpoint', 'outcome', 'result', 'step', 'node', 'monitor', 'prohibited', 'resource', '智能体', '工具', '条件', '结果', '审批', '闸门', '监控', '节点', '资源']);
const MONITOR_WORDS = { 'unauthorized write': 'unauthorized_write', '未授权写入': 'unauthorized_write', 'duplicate effect': 'duplicate_effect', '重复执行': 'duplicate_effect', 'secret exposure': 'secret_exposure', '机密泄露': 'secret_exposure' };
for (const m of MONITORS) { if (m.label) MONITOR_WORDS[m.label.toLowerCase()] = m.kind; const z = zh[`monitor.${m.kind}.label`]; if (z) MONITOR_WORDS[z.toLowerCase()] = m.kind; }
const SENS_WORDS = { public: 'public', internal: 'internal', secret: 'secret', '公开': 'public', '内部': 'internal', '机密': 'secret' };
const FIELD_WORDS = { condition: 'condition', '条件': 'condition', threshold: 'threshold', '阈值': 'threshold', 'single use': 'singleUse', 'single-use': 'singleUse', '一次性': 'singleUse', sla: 'slaMinutes', '审批响应时间': 'slaMinutes', sensitivity: 'sensitivity', '敏感级别': 'sensitivity', 'min approvers': 'minApprovers', '最少审批人数': 'minApprovers', severity: 'severity', '严重性': 'severity' };

/* ------------------------------------------------------------- sentences */
function splitSentences(text) {
  const out = []; let cur = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const decimal = c === '.' && i > 0 && i + 1 < text.length && /\d/.test(text[i - 1]) && /\d/.test(text[i + 1]);
    if (('!?。！？；;'.includes(c) || (c === '.' && !decimal)) || c === '\n') { if (cur.trim()) out.push(cur.trim()); cur = ''; } else cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
const POLITENESS = /^(?:please|pls|kindly|请|帮我|请帮我|麻烦|麻烦帮我|麻烦你)[，,\s]*/i;
function normalize(s) { return s.trim().replace(/[.!?。！？；;，,\s]+$/, '').replace(POLITENESS, '').trim(); }

/* ------------------------------------------------------- number parsing */
function parseNumber(text) {
  const t = String(text).trim().replace(/^[\$￥¥]/, '').replace(/[,，]/g, '');
  return /^[-+]?\d+(?:\.\d+)?$/.test(t) ? Number(t) : null;
}

/* ------------------------------------------------------ node matching */
function exactNode(graph, t) { return graph.nodes.find(x => x.label.toLowerCase() === t || x.id.toLowerCase() === t) || null; }
/* Match a node reference given as free text (regex rules): strip an optional
   leading article and one trailing type word, then require an exact label/id. */
function matchNodeRef(graph, text) {
  let t = text.trim().toLowerCase().replace(/^(?:the|a|an)\s+/, '');
  let n = exactNode(graph, t); if (n) return n;
  const words = t.split(/\s+/);
  if (words.length > 1 && TRAILING_TYPE.has(words[words.length - 1])) { n = exactNode(graph, words.slice(0, -1).join(' ')); if (n) return n; }
  return null;
}
/* Match a node reference in English word tokens: optional leading article and
   one trailing type word, then an exact label word-sequence or id. */
function matchNodeWords(graph, words, i) {
  let j = i;
  if (words[j] === 'the' || words[j] === 'a' || words[j] === 'an') j++;
  const byLabel = graph.nodes.slice().sort((a, b) => b.label.split(/\s+/).length - a.label.split(/\s+/).length);
  for (const n of byLabel) {
    const lw = n.label.toLowerCase().split(/\s+/).filter(Boolean);
    if (lw.length && lw.length <= words.length - j && lw.every((w, k) => words[j + k] === w)) {
      if (words[j + lw.length] && TRAILING_TYPE.has(words[j + lw.length])) return { node: n, next: j + lw.length + 1 };
      return { node: n, next: j + lw.length };
    }
  }
  const w = words[j]; if (w) { const n = graph.nodes.find(x => x.id.toLowerCase() === w); if (n) return { node: n, next: j + 1 }; }
  return null;
}

/* ------------------------------------------------- threshold (English words) */
function matchThresholdWords(words, i) {
  let j = i, op;
  if (words[j] === 'above' || words[j] === 'over') { op = '>'; j++; }
  else if (words[j] === 'more' && words[j + 1] === 'than') { op = '>'; j += 2; }
  else if (words[j] === 'greater' && words[j + 1] === 'than') { op = '>'; j += 2; }
  else if (words[j] === 'at' && words[j + 1] === 'least') { op = '>='; j += 2; }
  else return null;
  const n = parseNumber(words[j]); if (n == null) return null;
  return { appliesWhen: `amount ${op} ${n}`, next: j + 1 };
}

/* ------------------------------------------------- control spec (English) */
function parseControlWords(words, i) {
  let kind = 'human_approval', j = i;
  if (words[j] === 'human' || words[j] === 'manager') { kind = 'human_approval'; j++; }
  else if (words[j] === 'dual' || words[j] === 'double') { kind = 'dual_approval'; j++; }
  else if (words[j] === 'policy' && words[j + 1] === 'gate') { kind = 'policy_gate'; j += 2; }
  const tw = words[j];
  if (tw !== 'approval' && tw !== 'gate' && tw !== 'control') return null;
  return { type: 'control', kind, next: j + 1 };
}

/* ------------------------------------------------------------ add / insert */
function parseAddLike(text, graph) {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length || (words[0] !== 'add' && words[0] !== 'insert')) return null;
  const insert = words[0] === 'insert';
  let i = 1;
  if (words[i] === 'a' || words[i] === 'an') i++;
  let type, kind = 'human_approval';
  const ctl = parseControlWords(words, i);
  if (ctl) { type = 'control'; kind = ctl.kind; i = ctl.next; }
  else { type = TYPE_WORDS[words[i]]; if (!type || type === 'trigger') return null; i++; }
  let config = (type === 'control' && kind !== 'human_approval') ? { kind } : undefined;
  let threshold = null;
  const th = matchThresholdWords(words, i); if (th) { threshold = th.appliesWhen; i = th.next; }
  let anchor = null;
  if (!insert && words[i] === 'after') { i++; const nm = matchNodeWords(graph, words, i); if (!nm) return null; anchor = { kind: 'after', node: nm.node }; i = nm.next; }
  else if (insert && words[i] === 'between') { i++; const a = matchNodeWords(graph, words, i); if (!a) return null; i = a.next; if (words[i] !== 'and') return null; i++; const b = matchNodeWords(graph, words, i); if (!b) return null; i = b.next; anchor = { kind: 'between', a: a.node, b: b.node }; }
  else return null;
  if (threshold == null) { const th2 = matchThresholdWords(words, i); if (th2) { threshold = th2.appliesWhen; i = th2.next; } }
  if (i !== words.length) return null;
  if (threshold) { if (type !== 'control' || kind === 'policy_gate') return null; config = { ...(kind !== 'human_approval' ? { kind } : {}), appliesWhen: threshold }; }
  if (anchor.kind === 'after') {
    const node = anchor.node, outs = portsOf(node).filter(p => p.kind === 'out');
    if (outs.length !== 1) return null;
    const edge = flowOut(graph, node.id, outs[0].id);
    const op = edge ? { op: 'insertStep', from: node.id, to: edge.to.node, type, ...(config ? { config } : {}) } : { op: 'addNext', node: node.id, port: outs[0].id, type, ...(config ? { config } : {}) };
    return { summary: `add ${type} after ${node.label}`, ops: [op] };
  }
  const e = graph.edges.find(x => x.kind === 'flow' && x.from.node === anchor.a.id && x.to.node === anchor.b.id);
  if (!e) return null;
  return { summary: `insert ${type} between ${anchor.a.label} and ${anchor.b.label}`, ops: [{ op: 'insertStep', from: anchor.a.id, to: anchor.b.id, type, ...(config ? { config } : {}) }] };
}

/* ------------------------------------------------------ Chinese add/insert */
const NUM = '([\\d][\\d,]*(?:\\.\\d+)?)';
function parseSpecZh(spec) {
  let s = spec.trim().replace(/^(?:一个|个|一名|名)/, '').trim();
  let threshold = null, op = null, m;
  if ((m = s.match(new RegExp('(?:金额)?(?:超过|大于|高于)\\s*[\\$￥¥]?\\s*' + NUM + '(?:\\s*元)?')))) { threshold = parseNumber(m[1]); op = '>'; s = s.replace(m[0], ''); }
  else if ((m = s.match(new RegExp('(?:不少于|至少)\\s*[\\$￥¥]?\\s*' + NUM + '(?:\\s*元)?')))) { threshold = parseNumber(m[1]); op = '>='; s = s.replace(m[0], ''); }
  let type = null, kind = 'human_approval';
  if (/策略闸门|策略/.test(s)) { kind = 'policy_gate'; s = s.replace(/策略闸门|策略/, ''); }
  else if (/双人|双重/.test(s)) { kind = 'dual_approval'; s = s.replace(/双人|双重/, ''); }
  else if (/人工|经理/.test(s)) { s = s.replace(/人工|经理/, ''); }
  // type word, extracted independently of the kind
  if (/审批|批准|闸门/.test(s)) { type = 'control'; s = s.replace(/审批|批准|闸门/, ''); }
  else if (/智能体|助手/.test(s)) { type = 'agent'; s = s.replace(/智能体|助手/, ''); }
  else if (/工具|接口/.test(s)) { type = 'tool'; s = s.replace(/工具|接口/, ''); }
  else if (/条件|判断|分支/.test(s)) { type = 'decision'; s = s.replace(/条件|判断|分支/, ''); }
  else if (/结果|结局|终点/.test(s)) { type = 'outcome'; s = s.replace(/结果|结局|终点/, ''); }
  if (!type) return null;
  s = s.replace(/的/g, '');
  if (s.trim() !== '') return null;
  if (type === 'control') {
    if (threshold != null && kind === 'policy_gate') return null;
    const config = {};
    if (kind !== 'human_approval') config.kind = kind;
    if (threshold != null) config.appliesWhen = `amount ${op} ${threshold}`;
    return { type: 'control', config: Object.keys(config).length ? config : undefined };
  }
  if (threshold != null) return null;
  return { type, config: undefined };
}
/* A threshold clause after the Chinese comma: 金额超过/超过/大于/高于 X [元]
   (optionally ending in 才需要/时需要) or 不少于/至少 X. Anchored to the whole
   clause — anything else returns null (the whole sentence stays unmatched). */
function parseThresholdClause(clause) {
  const s = clause.trim();
  let m = s.match(new RegExp('^(?:金额)?(?:超过|大于|高于)\\s*[\\$￥¥]?\\s*' + NUM + '(?:\\s*元)?(?:\\s*(?:才需要|时需要))?$'));
  if (m) { const n = parseNumber(m[1]); return n != null ? `amount > ${n}` : null; }
  m = s.match(new RegExp('^(?:金额)?(?:不少于|至少)\\s*[\\$￥¥]?\\s*' + NUM + '(?:\\s*元)?(?:\\s*(?:才需要|时需要))?$'));
  if (m) { const n = parseNumber(m[1]); return n != null ? `amount >= ${n}` : null; }
  return null;
}
function parseAddZh(text, graph) {
  let m = text.match(/^在(.+?)(?:后面|之后)加(.*)$/);
  if (m) {
    const node = matchNodeRef(graph, m[1]); if (!node) return null;
    const parts = m[2].split('，');
    if (parts.length > 2) return null;
    let spec = parseSpecZh(parts[0]); if (!spec) return null;
    if (parts.length === 2) {
      const thr = parseThresholdClause(parts[1]);
      if (!thr || spec.type !== 'control' || spec.config?.kind === 'policy_gate') return null;
      spec = { type: spec.type, config: { ...(spec.config || {}), appliesWhen: thr } };
    }
    const outs = portsOf(node).filter(p => p.kind === 'out');
    if (outs.length !== 1) return null;
    const edge = flowOut(graph, node.id, outs[0].id);
    const op = edge ? { op: 'insertStep', from: node.id, to: edge.to.node, type: spec.type, ...(spec.config ? { config: spec.config } : {}) } : { op: 'addNext', node: node.id, port: outs[0].id, type: spec.type, ...(spec.config ? { config: spec.config } : {}) };
    return { summary: `在 ${node.label} 后面加 ${spec.type}`, ops: [op] };
  }
  m = text.match(/^在(.+?)和(.+?)之间(?:插入|添加|加)(.*)$/);
  if (m) {
    const A = matchNodeRef(graph, m[1]); if (!A) return null;
    const B = matchNodeRef(graph, m[2]); if (!B) return null;
    const spec = parseSpecZh(m[3]); if (!spec) return null;
    const e = graph.edges.find(x => x.kind === 'flow' && x.from.node === A.id && x.to.node === B.id);
    if (!e) return null;
    return { summary: `在 ${A.label} 和 ${B.label} 之间插入 ${spec.type}`, ops: [{ op: 'insertStep', from: A.id, to: B.id, type: spec.type, ...(spec.config ? { config: spec.config } : {}) }] };
  }
  return null;
}

/* ------------------------------------------------------------ delete */
function parseDelete(text, graph) {
  let m = text.match(/^(?:delete|remove)\s+(?:the\s+)?(.+)$/i);
  if (m) { const n = matchNodeRef(graph, m[1]); return n ? { summary: `delete ${n.label}`, ops: [{ op: 'removeNode', node: n.id }] } : null; }
  m = text.match(/^(?:删除|移除)(.+)$/);
  if (m) { const n = matchNodeRef(graph, m[1]); return n ? { summary: `删除 ${n.label}`, ops: [{ op: 'removeNode', node: n.id }] } : null; }
  return null;
}

/* ------------------------------------------------------------ rename */
function parseRename(text, graph) {
  let m = text.match(/^rename\s+(.+?)\s+to\s+(.+)$/i);
  if (m) { const n = matchNodeRef(graph, m[1]); return n && m[2].trim() ? { summary: `rename ${n.label} to ${m[2].trim()}`, ops: [{ op: 'setLabel', node: n.id, label: m[2].trim() }] } : null; }
  m = text.match(/^(?:把|将)(.+?)改名为(.+)$/);
  if (m) { const n = matchNodeRef(graph, m[1]); return n && m[2].trim() ? { summary: `把 ${n.label} 改名为 ${m[2].trim()}`, ops: [{ op: 'setLabel', node: n.id, label: m[2].trim() }] } : null; }
  return null;
}

/* ------------------------------------------------------------ protect */
function parseProtect(text, graph) {
  let m = text.match(/^protect\s+(.+?)\s+with\s+(?:a\s+|an\s+)?(.+)$/i);
  if (m) { const n = matchNodeRef(graph, m[1]); const k = MONITOR_WORDS[m[2].trim().toLowerCase()]; return n && k ? { summary: `protect ${n.label} with ${k}`, ops: [{ op: 'addMonitor', node: n.id, kind: k }] } : null; }
  m = text.match(/^给(.+?)(?:加上|添加|加)(?:一个|个)?(.+?)(?:监控|监视)?$/);
  if (m) { const n = matchNodeRef(graph, m[1]); const k = MONITOR_WORDS[m[2].trim().toLowerCase()]; return n && k ? { summary: `给 ${n.label} 加 ${k} 监控`, ops: [{ op: 'addMonitor', node: n.id, kind: k }] } : null; }
  return null;
}

/* ------------------------------------------------------------ data */
function parseData(text, graph) {
  let m = text.match(/^add\s+(?:a\s+|an\s+)?(public|internal|secret)\s+data\s+(?:resource\s+)?['"]?(.+?)['"]?\s+to\s+(.+)$/i);
  if (m) { const n = matchNodeRef(graph, m[3]); const sens = SENS_WORDS[m[1].toLowerCase()]; return n && sens ? { summary: `add ${sens} data to ${n.label}`, ops: [{ op: 'addData', node: n.id, label: m[2].trim(), sensitivity: sens }] } : null; }
  m = text.match(/^add\s+(?:a\s+|an\s+)?data\s+(?:resource\s+)?['"]?(.+?)['"]?\s+(public|internal|secret)\s+to\s+(.+)$/i);
  if (m) { const n = matchNodeRef(graph, m[3]); const sens = SENS_WORDS[m[2].toLowerCase()]; return n && sens ? { summary: `add ${sens} data to ${n.label}`, ops: [{ op: 'addData', node: n.id, label: m[1].trim(), sensitivity: sens }] } : null; }
  m = text.match(/^给(.+?)添加(?:一个|个)?(公开|内部|机密)(?:的)?数据(?:资源)?(.+)$/);
  if (m) { const n = matchNodeRef(graph, m[1]); const sens = SENS_WORDS[m[2]]; return n && sens ? { summary: `给 ${n.label} 添加 ${sens} 数据`, ops: [{ op: 'addData', node: n.id, label: m[3].trim(), sensitivity: sens }] } : null; }
  return null;
}

/* ------------------------------------------------------------ set field */
function parseValue(text) {
  const t = text.trim();
  if (/^["'](.+)["']$/.test(t)) return t.slice(1, -1);
  if (/^(true|false)$/i.test(t)) return t.toLowerCase() === 'true';
  const n = parseNumber(t); if (n != null) return n;
  if (/[<>=!]/.test(t)) return t;
  return t;
}
function parseSet(text, graph) {
  let m = text.match(/^set\s+(?:the\s+)?(.+?)\s+of\s+(.+?)\s+to\s+(.+)$/i);
  if (m) { const f = FIELD_WORDS[m[1].trim().toLowerCase()]; const n = matchNodeRef(graph, m[2]); return f && n ? { summary: `set ${f} of ${n.label}`, ops: [{ op: 'setConfig', node: n.id, key: f, value: parseValue(m[3]) }] } : null; }
  m = text.match(/^(?:把|将)(.+?)的(.+?)(?:设为|改为|改成)(.+)$/);
  if (m) { const f = FIELD_WORDS[m[2].trim().toLowerCase()]; const n = matchNodeRef(graph, m[1]); return f && n ? { summary: `把 ${n.label} 的 ${f} 设为 ${m[3].trim()}`, ops: [{ op: 'setConfig', node: n.id, key: f, value: parseValue(m[3]) }] } : null; }
  return null;
}

/* ------------------------------------------------- existing-control threshold */
function approvalControl(graph) { return graph.nodes.find(n => n.type === 'control' && n.config.kind !== 'policy_gate') || null; }
function parseApprovalAbove(text, graph) {
  let m = text.match(/^(?:set\s+(?:the\s+)?)?approval\s+(?:threshold\s+)?(?:above|over|more\s+than|greater\s+than)\s+[\$￥¥]?([\d][\d,]*(?:\.\d+)?)$/i);
  if (m) { const n = parseNumber(m[1]); const c = approvalControl(graph); return n != null && c ? { summary: `approval above ${n}`, ops: [{ op: 'setConfig', node: c.id, key: 'appliesWhen', value: `amount > ${n}` }] } : null; }
  m = text.match(/^(?:金额|额度)?(?:超过|大于|高于)([\d][\d,]*(?:\.\d+)?)(?:元|块|美元)?(?:才|就)?需要审批$/);
  if (m) { const n = parseNumber(m[1]); const c = approvalControl(graph); return n != null && c ? { summary: `超过 ${n} 需要审批`, ops: [{ op: 'setConfig', node: c.id, key: 'appliesWhen', value: `amount > ${n}` }] } : null; }
  return null;
}

/* ------------------------------------------------------------ nlcompile fallback */
/* The legacy policy phrases (js/nlcompile.js PHRASES) are reimplemented here as
   anchored whole-sentence rules — never the unanchored compiler, which would
   drop a trailing clause and read "1,000" as "1". Each resolves the gating
   decision / approval control / write tool the same way nlcompile does. */
function writeTool(graph) { return graph.nodes.filter(n => n.type === 'tool' && n.config.sideEffect === 'write').sort((a, b) => a.id < b.id ? -1 : 1)[0] || null; }
function pathsToNode(graph, targetId) {
  const adj = {}; for (const e of graph.edges) if (e.kind === 'flow') (adj[e.from.node] = adj[e.from.node] || []).push(e.to.node);
  const paths = [];
  const walk = (n, path) => { if (n === targetId) { paths.push(path.slice()); return; } if (path.length > 40) return; for (const x of adj[n] || []) if (!path.includes(x)) walk(x, path.concat(x)); };
  for (const t of graph.nodes.filter(n => n.type === 'trigger')) walk(t.id, [t.id]);
  return paths;
}
function gatingDecision(graph, toolId) {
  let best = null, bestIdx = -1;
  for (const p of pathsToNode(graph, toolId)) for (let i = 0; i < p.length; i++) { const n = nodeById(graph, p[i]); if (n && n.type === 'decision' && i > bestIdx) { best = n.id; bestIdx = i; } }
  return best;
}
function approvalControlOnPath(graph, toolId) {
  for (const p of pathsToNode(graph, toolId)) for (const id of p) { const n = nodeById(graph, id); if (n && n.type === 'control' && n.config.kind !== 'policy_gate') return n.id; }
  return null;
}

function parseRequireApproval(text, graph) {
  let m = text.match(/^require\s+(?:(?:manager|human)\s+)?approval\s+(?:threshold\s+)?above\s+[\$￥¥]?\s*([\d][\d,]*(?:\.\d+)?)$/i);
  if (!m) m = text.match(/^超过\s*[\$￥¥]?\s*([\d][\d,]*(?:\.\d+)?)(?:元)?需要审批$/);
  if (m) {
    const x = parseNumber(m[1]); if (x == null) return null;
    const tool = writeTool(graph); if (!tool) return null;
    const gate = gatingDecision(graph, tool.id); if (!gate) return null;
    return { summary: `require approval above ${x}`, ops: [{ op: 'setConfig', node: gate, key: 'condition', value: `amount > ${x}` }] };
  }
  return null;
}
function parseAggregate(text, graph) {
  if (!/^aggregate\s+(?:(?:per\s+customer|by\s+customer)\s+)?(?:per\s+day|daily)$/i.test(text) && !/^(?:按客户)?每日汇总$/.test(text)) return null;
  const tool = writeTool(graph); if (!tool) return null;
  const gate = gatingDecision(graph, tool.id); if (!gate) return null;
  const cur = nodeById(graph, gate).config.condition || '';
  const xm = /amount\s*>\s*([\d][\d,]*(?:\.\d+)?)/.exec(cur);
  const x = xm ? parseNumber(xm[1]) ?? 0 : 0;
  return { summary: `aggregate per day`, ops: [{ op: 'setConfig', node: gate, key: 'condition', value: `dayTotal > ${x}` }] };
}
function parseBind(text, graph) {
  let m = text.match(/^bind\s+(?:the\s+)?approval\s+to\s+(?:the\s+)?(customer|order|amount)(?:(?:\s*,\s*|\s+and\s+|\s+)(customer|order|amount))*$/i);
  let fields = m ? text.toLowerCase().match(/\b(customer|order|amount)\b/g) : null;
  if (!m) { m = text.match(/^把审批绑定到(客户|订单|金额)(?:[、,和]?(?:客户|订单|金额))*$/); fields = m ? text.match(/客户|订单|金额/g) : null; }
  if (m) {
    const tool = writeTool(graph); if (!tool) return null;
    const ctl = approvalControlOnPath(graph, tool.id); if (!ctl) return null;
    const map = { customer: 'customer', order: 'order', amount: 'amount', '客户': 'customer', '订单': 'order', '金额': 'amount' };
    const binding = [...new Set(fields.map(f => map[f.toLowerCase()] || f))];
    return { summary: `bind approval to ${binding.join(', ')}`, ops: [{ op: 'setConfig', node: ctl, key: 'binding', value: binding }] };
  }
  return null;
}
function parseSingleUse(text, graph) {
  if (!/^single-?use\s+approvals?$/i.test(text) && !/^(?:一次性|单次使用)审批$/.test(text)) return null;
  const tool = writeTool(graph); if (!tool) return null;
  const ctl = approvalControlOnPath(graph, tool.id); if (!ctl) return null;
  return { summary: `single-use approval`, ops: [{ op: 'setConfig', node: ctl, key: 'singleUse', value: true }] };
}
function parsePreventDuplicate(text, graph) {
  if (!/^prevent\s+duplicate(?:\s+(?:refunds?|compensation|payments?|writes?|changes?|submissions?))?$/i.test(text) && !/^防止重复(?:退款|补偿|支付|写入|更改|提交)?$/.test(text)) return null;
  const tools = graph.nodes.filter(n => n.type === 'tool' && n.config.sideEffect === 'write');
  if (!tools.length) return null;
  return { summary: `prevent duplicate`, ops: tools.map(t => ({ op: 'setConfig', node: t.id, key: 'idempotencyKey', value: true })) };
}
function parseRedact(text, graph) {
  if (!/^never\s+(?:send|expose|leak)\s+(?:credentials?|secrets?|data)$/i.test(text) && !/^redact\s+secrets?$/i.test(text) && !/^不要(?:泄露|发送|暴露)机密$/.test(text) && !/^脱敏机密$/.test(text)) return null;
  const outcomes = graph.nodes.filter(n => n.type === 'outcome' && n.config.success && n.config.external).sort((a, b) => a.id < b.id ? -1 : 1);
  const ops = [];
  for (const o of outcomes) {
    for (const e of graph.edges) {
      if (e.kind !== 'flow' || e.to.node !== o.id) continue;
      // name the specific edge, so two branches sharing both endpoints are each protected
      ops.push({ op: 'insertStep', edge: e.id, type: 'control', config: { kind: 'policy_gate', action: 'redact', redactAbove: 'internal' } });
    }
  }
  return { summary: `redact secrets`, ops };
}
function parseNotify(text, graph) {
  if (!/^notify\s+the\s+customer$/i.test(text) && !/^通知客户$/.test(text)) return null;
  if (graph.nodes.some(n => n.type === 'outcome' && n.config.success && n.config.external)) return { summary: `notify the customer`, ops: [] };
  return null;
}

/* A leading negation that reverses a supported phrase (do not / don't / 不要 …)
   is never a weaker change: the whole sentence is unmatched. "never expose/send"
   and "不要泄露/发送/暴露" are the redact phrase itself, not a negation. */
function isNegated(s) {
  if (/^never\s+(?:send|expose|leak)/i.test(s) || /^不要(?:泄露|发送|暴露)/.test(s)) return false;
  return /^(?:do\s+not|don'?t|not|no|never)\s+/i.test(s) || /^(?:不要|别|勿|禁止)/.test(s);
}

/* ------------------------------------------------------------- the API */
export function proposeByRules(text, graph) {
  const sentences = splitSentences(text);
  const ops = [], unmatched = [], matched = [];
  const RULES = [parseDelete, parseRename, parseProtect, parseData, parseAddLike, parseAddZh, parseSet, parseApprovalAbove, parseRequireApproval, parseAggregate, parseBind, parseSingleUse, parsePreventDuplicate, parseRedact, parseNotify];
  for (const sentence of sentences) {
    const s = normalize(sentence);
    if (!s) continue;
    if (isNegated(s)) { unmatched.push(sentence); continue; }
    let hit = null;
    for (const rule of RULES) { hit = rule(s, graph); if (hit) break; }
    if (hit) { ops.push(...hit.ops); matched.push(hit.summary); }
    else unmatched.push(sentence);
  }
  return ok({ summary: matched.join('; '), ops, unmatched });
}
