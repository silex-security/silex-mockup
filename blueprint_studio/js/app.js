/* Blueprint Studio app: bootstrap, lifecycle stages, run panel, I/O.
   All state changes go through store.dispatch (plan §4.8). Computation is
   done by the pure modules; long runs are chunked and bound to a job id so a
   superseded result is discarded by the store. */
import { NODE_TYPES, CATEGORIES, makeNode, nextId, applyPatch, clone } from './model.js';
import { createStore, newDocument, revLabel, isDecided } from './store.js';
import { createCanvas, nodeMeta } from './canvas.js';
import { createInspector } from './inspector.js';
import * as expr from './expr.js';
import * as engine from './engine.js';
import * as monitors from './monitors.js';
import * as adversary from './adversary.js';
import * as validator from './validate.js';
import * as optimizer from './optimize.js';
import * as layouter from './layout.js';
import * as io from './io.js';
import * as nl from './nlcompile.js';

const $ = id => document.getElementById(id);
const h = (tag, props = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c);
  return el;
};
const tick = () => new Promise(r => setTimeout(r, 0));
const pct = f => (f && f.den ? (100 * f.num / f.den).toFixed(1) + '%' : 'n/a');
const frac = f => (f && f.den ? `${f.num} / ${f.den}` : 'n/a');
const fmtParam = v => (v && typeof v === 'object' ? ('field' in v && 'x' in v ? `${v.field} > ${v.x}` : 'variant' in v ? ({ a: 'move secret read to the tool', b: 'redact before external emit' }[v.variant] || v.variant) : JSON.stringify(v)) : String(v));
const CLAIM = 'Simulated against a declared adversary model: the graph you confirmed, run with scripted adversary scenarios. No real agents or tools were run. Zero violations in the tested scenarios does not prove a path impossible.';

const storage = (() => { try { localStorage.setItem('bs.t', '1'); localStorage.removeItem('bs.t'); return localStorage; } catch { return null; } })();
const store = createStore({ storage, lint: g => validator.lint(g) });
const ui = { stage: 'build', sel: { nodes: [], edge: null }, running: null, progress: null, decideId: null, runs: [], run: null, runView: null, stepSel: null };
const setCache = new Map();

/* --------------------------------------------------------------- toasts */
let toastT = 0;
function toast(msg, err = false) { const t = $('toast'); t.textContent = msg; t.className = 'toast show' + (err ? ' err' : ''); clearTimeout(toastT); toastT = setTimeout(() => { t.className = 'toast'; }, 2600); }
store.on(ev => { if (ev.reason === 'refused' && ev.error && ev.error.code !== 'stale_job') toast(ev.error.message, true); });

/* --------------------------------------------------------------- canvas */
const patch = (ops, label, merge) => store.dispatch({ type: 'patch', ops, label, merge });
const canvas = createCanvas({
  wrap: $('canvasWrap'), viewport: $('viewport'), nodesEl: $('nodes'), edgesEl: $('edges'), minimap: $('minimap'),
  onPatch: patch, onSelect: s => { ui.sel = s; renderInspector(); },
  onUndo: () => store.dispatch({ type: 'undo' }), onRedo: () => store.dispatch({ type: 'redo' }),
  onZoom: k => { const z = $('zoomInd'); if (z) z.textContent = Math.round(k * 100) + '%'; }
});
const inspector = createInspector($('inspector'), {
  onPatch: patch, exprCheck: src => expr.check(src),
  onSelectNode: id => canvas.select([id]), extraPanel: nlHelp
});

function addNode(type, x, y) {
  const g = store.active().graph;
  const node = makeNode(type, nextId(g.nodes.map(n => n.id), type), { x, y });
  const r = patch([{ op: 'addNode', node }], 'Add ' + NODE_TYPES[type].label);
  if (r.ok) canvas.select([node.id]);
  return r;
}

function buildPalette() {
  const p = $('palette'); p.textContent = '';
  for (const cat of CATEGORIES) {
    p.append(h('h4', { text: cat }));
    for (const [type, def] of Object.entries(NODE_TYPES)) if (def.category === cat) {
      const item = h('div', { class: 'pal-item', 'data-type': type, title: 'Drag onto the canvas, or click to add in the centre' }, h('i', { style: `background:var(--c-${type})` }), def.label);
      canvas.addPaletteSource(item, type, addNode);
      p.append(item);
    }
  }
  p.append(h('div', { class: 'pal-help' }, 'Drag from a node’s right port to an input to connect. Blue square ports connect agents and tools to data. Shift-drag to select several; wheel to zoom; drag the background to pan. ⌘Z / ⌘⇧Z undo and redo.'));
}

function buildToolbar() {
  const t = $('toolbar'); t.textContent = '';
  const nlIn = h('input', { type: 'text', id: 'nlInput', placeholder: 'Describe a change, e.g. “Require approval above $500. Prevent duplicate refunds.”' });
  const apply = () => {
    const r = nl.compileText(nlIn.value, store.active().graph);
    if (!r.ok) return toast(r.error.message, true);
    const { ops, matched, unmatched } = r.value;
    if (!ops.length) return toast(unmatched.length ? 'No rule matched: ' + unmatched.join(' · ') : 'Nothing to change', true);
    const res = patch(ops, 'Rule-based edit');
    if (res.ok) toast(`Applied ${matched.length} rule(s)` + (unmatched.length ? ` · not understood: ${unmatched.join(' · ')}` : ''));
  };
  nlIn.addEventListener('keydown', e => { if (e.key === 'Enter') apply(); });
  t.append(
    h('button', { class: 'tool-btn', id: 'undoBtn', text: '↶ Undo', onclick: () => store.dispatch({ type: 'undo' }) }),
    h('button', { class: 'tool-btn', id: 'redoBtn', text: '↷ Redo', onclick: () => store.dispatch({ type: 'redo' }) }),
    h('span', { class: 'sep' }),
    h('button', { class: 'tool-btn', id: 'layoutBtn', text: 'Auto layout', onclick: autoLayout }),
    h('button', { class: 'tool-btn', id: 'fitBtn', text: 'Fit', onclick: () => canvas.fit() }),
    h('button', { class: 'tool-btn', text: '−', onclick: () => canvas.zoomBy(1 / 1.2) }),
    h('span', { class: 'zoom-ind', id: 'zoomInd', text: '100%' }),
    h('button', { class: 'tool-btn', text: '＋', onclick: () => canvas.zoomBy(1.2) }),
    h('span', { class: 'sep' }),
    h('div', { class: 'nl-row' }, nlIn, h('button', { class: 'tool-btn', id: 'nlApply', text: 'Apply', onclick: apply }), h('span', { class: 'lc', text: 'rule-based · no AI' })),
    h('span', { class: 'spacer' }),
    h('span', { class: 'lc', id: 'lintChip' })
  );
}

function autoLayout() {
  const g = store.active().graph;
  const pos = layouter.layout(g);
  const ops = Object.entries(pos).map(([id, p]) => ({ op: 'moveNode', id, x: p.x, y: p.y }));
  const r = patch(ops, 'Auto layout');
  if (r.ok) requestAnimationFrame(() => canvas.fit());
}

function nlHelp() {
  return h('div', { class: 'issues' }, h('div', { class: 'type', text: 'Rule-based phrases (no AI)' }),
    (nl.PHRASES || []).map(p => h('div', { class: 'hint', text: `“${p.example}” → ${p.produces}` })));
}

/* ------------------------------------------------------------- rendering */
function lintIssues(graph) { try { return validator.lint(graph); } catch (e) { return [{ severity: 'error', code: 'lint_crash', message: String(e.message || e) }]; } }

function renderAll() {
  const doc = store.doc, rev = store.active();
  $('docName').textContent = doc.name;
  $('revChip').textContent = `${revLabel(rev.rev)} · ${rev.status === 'draft' ? 'Draft' : rev.origin === 'approve' ? 'Confirmed · from approval' : 'Confirmed'}`;
  $('revChip').className = 'lc' + (rev.status === 'draft' ? ' warn' : ' ok');
  const rs = $('revSelect'); rs.textContent = '';
  for (const r of doc.revisions) rs.append(h('option', { value: r.rev, text: `${revLabel(r.rev)} · ${r.status}${r.origin === 'approve' ? ' · approved patch' : ''}${r.decision ? ' · decided' : ''}`, selected: r.rev === rev.rev }));
  renderBuild(); renderStages(); renderStagePanel();
  document.title = `SILEX · Blueprint Studio · ${doc.name} ${revLabel(rev.rev)}`;
}

function renderBuild() {
  const rev = store.active(), locked = rev.status !== 'draft';
  const issues = lintIssues(rev.graph);
  const byNode = {};
  for (const i of issues) if (i.nodeId) (byNode[i.nodeId] ||= []).push(i);
  canvas.render(rev.graph, { issues: byNode, run: runHighlights(), locked });
  const ln = $('lockNote');
  ln.hidden = !locked; ln.textContent = '';
  if (locked) ln.append(h('span', {}, h('strong', { text: `${revLabel(rev.rev)} is confirmed and locked.` }), ' Edits are refused; create a revision to change the workflow.'),
    h('button', { class: 'btn sm', id: 'newRevBtn', text: 'Edit as new revision', onclick: newRevision }));
  $('undoBtn').disabled = !store.canUndo(); $('redoBtn').disabled = !store.canRedo();
  const errs = issues.filter(i => i.severity === 'error').length;
  const chip = $('lintChip'); chip.textContent = errs ? `${errs} error(s)` : issues.length ? `${issues.length} warning(s)` : 'Lint clean'; chip.className = 'lc ' + (errs ? 'bad' : issues.length ? 'warn' : 'ok');
  renderInspector(issues);
  renderRunPanel();
}

function renderInspector(issues) {
  const rev = store.active();
  inspector.render({ graph: rev.graph, selection: ui.sel, locked: rev.status !== 'draft', issues: issues || lintIssues(rev.graph), docPanel });
}

function docPanel() {
  const doc = store.doc, rev = store.active();
  const box = h('div', {});
  const named = doc.revisions.some(r => r.status === 'confirmed');
  const name = h('input', { type: 'text', value: doc.name, disabled: named || rev.status !== 'draft' });
  name.addEventListener('change', () => store.dispatch({ type: 'rename', name: name.value.trim() }));
  box.append(h('div', { class: 'type', text: 'Blueprint' }), h('h3', { text: doc.name }),
    h('div', { class: 'field' }, h('label', { text: 'Name' }), name, named ? h('div', { class: 'hint', text: 'Fixed after the first confirmation: it is part of every revision’s hash.' }) : null),
    h('div', { class: 'hint', text: `${doc.domain} · owner ${doc.owner}` }),
    h('div', { class: 'hint', text: `${rev.graph.nodes.length} nodes · ${rev.graph.edges.length} edges · ${revLabel(rev.rev)}${rev.parent != null ? ' (parent ' + revLabel(rev.parent) + ')' : ''}${rev.hash ? ' · ' + rev.hash.slice(0, 12) : ''}` }));
  if (rev.parent != null) box.append(diffView(store.revision(rev.parent).graph, rev.graph, `Changes from ${revLabel(rev.parent)}`));
  return box;
}

const lbl = (g, id) => g.nodes.find(n => n.id === id)?.label || id;
function diffView(a, b, title) {
  const d = io.diffGraphs(a, b);
  const rows = [
    ...d.addedNodes.map(n => h('div', { class: 'add', text: '+ node ' + (n.label || n.id || n) })),
    ...d.removedNodes.map(n => h('div', { class: 'del', text: '− node ' + (n.label || n.id || n) })),
    ...d.changedNodes.map(c => { const n = b.nodes.find(x => x.id === c.id); return h('div', { class: 'chg', text: `~ ${n?.label || c.id}: ` + (c.fields || []).map(f => f.startsWith('config.') ? `${f.slice(7)} → ${JSON.stringify(n?.config[f.slice(7)])}` : f).join(', ') }); }),
    ...d.addedEdges.map(e => h('div', { class: 'add', text: `+ ${e.kind} edge ${lbl(b, e.from.node)} → ${lbl(b, e.to.node)}` })),
    ...d.removedEdges.map(e => h('div', { class: 'del', text: `− ${e.kind} edge ${lbl(a, e.from.node)} → ${lbl(a, e.to.node)}` }))];
  return h('div', { class: 'issues' }, h('div', { class: 'type', text: title }), h('div', { class: 'diff' }, rows.length ? rows : h('div', { class: 'hint', text: 'No semantic changes.' })));
}

/* ---------------------------------------------------------------- stages */
const STAGES = ['build', 'confirm', 'validate', 'optimize', 'decide', 'register'];
function stageEnabled(st) {
  const r = store.active(), v = r.validation, conf = r.status === 'confirmed';
  switch (st) {
    case 'build': case 'confirm': return true;
    case 'validate': return conf;
    case 'optimize': return conf && !!v && (v.result.findings.length > 0 || r.origin === 'approve');
    case 'decide': return conf && (!!r.optimization || !!r.decision || r.origin === 'approve' || (!!v && v.result.findings.length === 0));
    case 'register': return r.origin === 'approve' || r.decision?.action === 'accept';
  }
}
function stageDone(st) {
  const r = store.active();
  return { build: true, confirm: r.status === 'confirmed', validate: !!r.validation, optimize: !!r.optimization || r.origin === 'approve', decide: isDecided(r), register: store.inventory().some(x => x.docId === store.doc.id && x.rev === r.rev) }[st];
}
function renderStages() {
  for (const b of document.querySelectorAll('.stage')) {
    const st = b.dataset.stage;
    b.disabled = !stageEnabled(st); b.classList.toggle('active', st === ui.stage); b.classList.toggle('done', st !== ui.stage && stageDone(st) && st !== 'build');
  }
}
function go(stage) {
  if (!stageEnabled(stage)) return toast('Not available yet for ' + revLabel(store.active().rev), true);
  ui.stage = stage;
  for (const p of document.querySelectorAll('.stage-panel')) p.classList.toggle('active', p.id === 'stage-' + stage);
  renderStages(); renderStagePanel();
  if (stage === 'build') requestAnimationFrame(() => renderBuild());
}
function renderStagePanel() {
  if (!stageEnabled(ui.stage)) { ui.stage = 'build'; for (const p of document.querySelectorAll('.stage-panel')) p.classList.toggle('active', p.id === 'stage-build'); renderStages(); }
  ({ confirm: renderConfirm, validate: renderValidate, optimize: renderOptimize, decide: renderDecide, register: renderRegister }[ui.stage] || (() => {}))();
}

function newRevision() {
  const r = store.dispatch({ type: 'newRevision', from: store.active().rev });
  if (r.ok) { go('build'); toast(`Editing ${revLabel(r.value.rev)} (from ${revLabel(r.value.parent)})`); }
}

/* ---- Confirm */
function renderConfirm() {
  const root = $('stage-confirm'); root.textContent = '';
  const rev = store.active(), g = rev.graph;
  const issues = lintIssues(g), errs = issues.filter(i => i.severity === 'error');
  const count = t => g.nodes.filter(n => n.type === t).length;
  const page = h('div', { class: 'page' }, h('h1', { text: 'Confirm Blueprint' }),
    h('p', { class: 'sub', text: 'Confirming locks this revision. Only a confirmed revision can be validated; later edits create a new revision.' }));
  const facts = h('div', { class: 'card' },
    h('div', { class: 'card-head' }, h('div', {}, h('h2', { text: `${store.doc.name} · ${revLabel(rev.rev)}` }), h('p', { class: 'sub', text: '“This graph accurately represents the workflow that the enterprise intends to deploy.”' })),
      h('span', { class: 'lc ' + (rev.status === 'draft' ? 'warn' : 'ok'), text: rev.status === 'draft' ? 'Draft' : 'Confirmed' })),
    h('div', { class: 'check-row' }, h('b', { text: '✓' }), `${g.nodes.length} typed nodes · ${g.edges.filter(e => e.kind === 'flow').length} flow edges · ${g.edges.filter(e => e.kind === 'access').length} access edges · ${count('control')} control points · ${count('prohibited')} prohibited outcomes`),
    ...g.nodes.filter(n => n.type === 'prohibited').map(n => h('div', { class: 'check-row' }, h('b', { text: '◆' }), `${n.label}: ${nodeMeta(n)}`)),
    h('div', { class: 'check-row' }, h('b', { text: '✓' }), `Owner: ${store.doc.owner} · Domain: ${store.doc.domain}`),
    h('div', { class: 'check-row ' + (errs.length ? 'no' : '') }, h('b', { text: errs.length ? '✗' : '✓' }), errs.length ? `${errs.length} lint error(s) must be fixed first: ${errs.map(i => i.message).join(' · ')}` : `Lint: no errors${issues.length ? ` (${issues.length} warning(s))` : ''}`));
  page.append(facts);
  if (rev.parent != null) page.append(h('div', { class: 'card' }, diffView(store.revision(rev.parent).graph, g, `Changes from ${revLabel(rev.parent)}`)));
  if (rev.status === 'draft') {
    const ack = h('input', { type: 'checkbox', id: 'confirmAck' });
    const btn = h('button', { class: 'btn primary', id: 'confirmBtn', text: 'Confirm Blueprint', disabled: true, onclick: () => { const r = store.dispatch({ type: 'confirm' }); if (r.ok) { toast(`${revLabel(rev.rev)} confirmed`); go('confirm'); } } });
    ack.addEventListener('change', () => { btn.disabled = !ack.checked || errs.length > 0; });
    page.append(h('div', { class: 'card row-actions' }, h('label', { class: 'check-row' }, ack, ' I confirm this is the workflow we intend to deploy'),
      h('div', {}, h('button', { class: 'btn', text: '← Back to edit', onclick: () => go('build') }), ' ', btn)));
  } else {
    page.append(h('div', { class: 'card row-actions' }, h('p', {}, h('b', { text: `${revLabel(rev.rev)} confirmed.` }), ` Hash ${rev.hash.slice(0, 16)}…`),
      h('div', {}, h('button', { class: 'btn', text: 'Edit as new revision', onclick: newRevision }), ' ', h('button', { class: 'btn blue', id: 'toValidateBtn', text: 'Validate →', onclick: () => go('validate') }))));
  }
  root.append(page);
}

/* ---- scenario sets and jobs */
function scenarioSetFor(rev, n) {
  const base = rev.origin === 'approve' ? store.revision(rev.parent) : rev;
  const key = base.hash + '|' + n;
  if (!setCache.has(key)) setCache.set(key, adversary.generateScenarioSet(base.graph, { n, baseHash: base.hash }));
  return setCache.get(key);
}
function compact(res) {
  return { findings: res.findings, metrics: res.metrics, lint: res.lint || [], potential: res.potential || [], patchedHash: res.patchedHash,
    runs: (res.runs || []).map(r => ({ scenarioId: r.scenarioId, template: r.template, violating: r.monitors.some(m => m.violations.length > 0) })) };
}
function progress(label, done, total) { ui.progress = { label, done, total }; const bar = document.querySelector('#jobProgress i'); if (bar) bar.style.width = (100 * done / total) + '%'; const t = $('jobLabel'); if (t) t.textContent = `${label} · ${done} / ${total}`; }

async function runValidation(n = 40) {
  const rev = store.active();
  const job = store.startJob('validate:' + rev.rev);
  ui.running = 'validate'; renderStagePanel();
  const set = scenarioSetFor(rev, n);
  const runs = [];
  for (let i = 0; i < set.scenarios.length; i += 20) {
    if (!store.jobCurrent('validate:' + rev.rev, job)) { ui.running = null; return { ok: false, error: { code: 'stale_job' } }; }
    runs.push(...validator.runScenarios(rev.graph, set.scenarios.slice(i, i + 20)));
    progress('Running scenarios', runs.length, set.scenarios.length); await tick();
  }
  const { findings, metrics } = validator.summarize(rev.graph, runs);
  const result = compact({ findings, metrics, lint: validator.lint(rev.graph), potential: validator.potentialPaths(rev.graph), runs });
  ui.running = null;
  const r = store.dispatch({ type: 'setValidation', rev: rev.rev, jobId: job, revHash: rev.hash, scenarioSetId: set.id, n, result });
  if (!r.ok) renderStagePanel();
  return r;
}

async function runOptimize() {
  const rev = store.active(), v = rev.validation;
  const job = store.startJob('optimize:' + rev.rev);
  ui.running = 'optimize'; renderStagePanel();
  const set = scenarioSetFor(rev, v.n);
  const cands = optimizer.generateCandidates(rev.graph, { ...v.result, scenarioSetId: v.scenarioSetId });
  const out = [];
  for (const c of cands) {
    if (!store.jobCurrent('optimize:' + rev.rev, job)) { ui.running = null; return { ok: false, error: { code: 'stale_job' } }; }
    out.push(await testCandidate(rev, c, set));
    progress('Testing candidates', out.length, cands.length); await tick();
  }
  ui.running = null;
  const r = store.dispatch({ type: 'setOptimization', rev: rev.rev, jobId: job, revHash: rev.hash, scenarioSetId: set.id, candidates: out });
  if (r.ok) ui.decideId = recommendedId(store.active());
  else renderStagePanel();
  return r;
}

let runSeq = 0;
async function testCandidate(rev, candidate, set) {
  const res = optimizer.runCandidate(rev.graph, candidate, set, store.meta());
  if (!res.ok) return { candidate, runId: 'run-' + (++runSeq), result: { findings: [], metrics: {}, lint: [{ severity: 'error', code: res.error.code, message: res.error.message }], runs: [], patchedHash: null }, verdict: { eligible: false, reasons: [res.error.message], scorecard: {} } };
  const verdict = optimizer.score({ ...rev.validation.result }, res.value);
  return { candidate, runId: 'run-' + (++runSeq), result: compact(res.value), verdict };
}

function recommendedId(rev) {
  const o = rev.optimization; if (!o) return null;
  const scored = o.candidates.filter(c => c.state === 'tested' && c.testedParamsVersion === c.candidate.paramsVersion).map(c => ({ candidate: c.candidate, result: c.result, verdict: c.verdict }));
  const rejected = new Set(o.candidates.filter(c => c.state === 'rejected').map(c => c.candidate.id));
  return optimizer.recommend(scored, rejected);
}
const approvable = (rev, c) => !isDecided(rev) && c.state === 'tested' && !!c.verdict?.eligible && c.testedParamsVersion === c.candidate.paramsVersion && rev.optimization.scenarioSetId === rev.validation?.scenarioSetId;

async function modifyCandidate(candidateId, params) {
  const rev = store.active();
  const c = rev.optimization.candidates.find(x => x.candidate.id === candidateId);
  const next = optimizer.reparam(rev.graph, { ...rev.validation.result, scenarioSetId: rev.validation.scenarioSetId }, c.candidate, params);
  const m = store.dispatch({ type: 'modify', rev: rev.rev, candidateId, candidate: next });
  if (!m.ok) return m;
  const key = 'cand:' + rev.rev + ':' + candidateId, job = store.startJob(key);
  renderStagePanel(); await tick();
  const t = await testCandidate(rev, next, scenarioSetFor(rev, rev.validation.n));
  const r = store.dispatch({ type: 'candidateResult', rev: rev.rev, candidateId, jobId: job, paramsVersion: next.paramsVersion, scenarioSetId: rev.optimization.scenarioSetId, revHash: rev.hash, runId: t.runId, result: t.result, verdict: t.verdict });
  return r;
}

/* ---- Validate */
function metricsRow(m, prefix = '') {
  const M = (label, value, formula) => h('div', { class: 'metric' }, h('small', { text: label }), h('b', { text: value }), h('div', { class: 'f', text: formula }));
  return h('div', { class: 'metric-row' },
    M(prefix + 'Residual reachability', pct(m.residualReachability), `adversarial scenarios with ≥1 violation / adversarial run = ${frac(m.residualReachability)}`),
    M(prefix + 'Benign policy violations', pct(m.benignPolicyViolations), `benign scenarios with ≥1 violation / benign run = ${frac(m.benignPolicyViolations)}`),
    M(prefix + 'Benign completion', pct(m.benignCompletion), `benign ending at a success outcome / benign run = ${frac(m.benignCompletion)}`),
    M(prefix + 'Friction', pct(m.friction), `benign needing a human approval / benign run = ${frac(m.friction)}`),
    M(prefix + 'Added approval latency', m.addedLatencyMedian == null ? 'n/a' : m.addedLatencyMedian + ' min', 'median approval minutes over benign scenarios'));
}
function pathLabel(graph, ids) { const by = new Map(graph.nodes.map(n => [n.id, n.label])); return ids.map(i => by.get(i) || i).join(' → '); }
function findingsTable(graph, findings) {
  if (!findings.length) return h('p', { class: 'empty', text: 'No violations in the tested scenarios.' });
  const tb = h('tbody', {});
  for (const f of findings) {
    const prohibited = graph.nodes.find(n => n.id === f.prohibited);
    tb.append(h('tr', { 'data-finding': f.id }, h('td', {}, h('b', { text: prohibited?.label || f.prohibited }), h('div', { class: 'hint', text: `via ${f.template.replace('_', ' ')} scenarios` })),
      h('td', { text: f.category }), h('td', {}, h('span', { class: 'lc ' + (f.severity === 'critical' ? 'bad' : 'warn'), text: f.severity })),
      h('td', { class: 'mono', text: `${f.violating} / ${f.run}` }),
      h('td', {}, f.paths.slice(0, 4).map(p => h('div', { class: 'path' }, h('span', { class: 'grade', text: f.grade }), pathLabel(graph, p.nodes), h('span', { class: 'hint', text: `${p.count} activation${p.count === 1 ? '' : 's'}` }))), f.paths.length > 4 ? h('div', { class: 'hint', text: `+${f.paths.length - 4} more paths` }) : null)));
  }
  return h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['Unsafe outcome', 'Category', 'Severity', 'Violating / run', 'Violating paths (from traces)'].map(t => h('th', { text: t })))), tb);
}

function renderValidate() {
  const root = $('stage-validate'); root.textContent = '';
  const rev = store.active(), v = rev.validation, decided = isDecided(rev);
  const page = h('div', { class: 'page' }, h('h1', { text: 'Validate' }), h('p', { class: 'sub', text: 'If this workflow were deployed, which unsafe outcomes could the declared graph reach under the adversary scenarios?' }));
  if (ui.running === 'validate') { page.append(h('div', { class: 'card' }, h('h2', { id: 'jobLabel', text: 'Running scenarios…' }), h('div', { class: 'progress', id: 'jobProgress' }, h('i', {})))); root.append(page); return; }
  if (!v) {
    const nSel = h('select', { id: 'nSelect' }, [20, 40, 100].map(n => h('option', { value: n, text: `${n} per template (${n * 6} scenarios)`, selected: n === 40 })));
    page.append(h('div', { class: 'card row-actions' }, h('div', {}, h('h2', { text: 'Baseline simulation' }), h('p', { class: 'sub', text: 'Scenarios are generated once from this revision’s hash and frozen; every candidate is later tested on the same set.' })),
      h('div', {}, nSel, ' ', h('button', { class: 'btn blue', id: 'runValidationBtn', text: 'Run validation', disabled: decided, onclick: () => runValidation(Number(nSel.value)) }))));
    root.append(page); return;
  }
  const res = v.result;
  page.append(h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('div', {}, h('h2', { text: `Results · ${revLabel(rev.rev)}` }), h('p', { class: 'sub', text: `Scenario set ${v.scenarioSetId} · ${res.runs.length} scenarios · ${res.findings.length} finding(s)` })),
    h('span', { class: 'lc ' + (res.findings.length ? 'bad' : 'ok'), text: res.findings.length ? 'Risk identified' : 'No violations in tested scenarios' })), metricsRow(res.metrics), h('p', { class: 'claim', text: CLAIM })));
  page.append(h('div', { class: 'card', id: 'findingsCard' }, h('h2', { text: 'Findings' }), h('p', { class: 'sub', text: 'Each finding is a monitor that fired in at least one scenario of a template. Paths are the executed node sequences of the violating runs. Evidence grade: Declared (from configuration, before deploy).' }), findingsTable(rev.graph, res.findings)));
  page.append(h('div', { class: 'card' }, h('h2', { text: 'Potential paths (declared graph)' }), h('p', { class: 'sub', text: 'Static flow paths from each untrusted trigger to what each prohibited outcome watches. Potential, not a violation: the guards listed may or may not stop a given scenario.' }),
    res.potential.length ? res.potential.map(p => h('div', { class: 'path' }, h('span', { class: 'grade', text: 'potential' }), pathLabel(rev.graph, p.path), h('span', { class: 'hint', text: p.guards.length ? 'guards: ' + p.guards.map(g => rev.graph.nodes.find(n => n.id === g)?.label || g).join(', ') : 'no guard on this path' }))) : h('p', { class: 'empty', text: 'None.' })));
  const next = rev.origin === 'approve'
    ? h('button', { class: 'btn blue', text: 'Register →', onclick: () => go('register') })
    : res.findings.length ? h('button', { class: 'btn blue', id: 'toOptimizeBtn', text: 'Generate and test policy candidates →', disabled: decided, onclick: () => { go('optimize'); if (!store.active().optimization) runOptimize(); } })
      : h('button', { class: 'btn blue', id: 'toDecideBtn', text: 'Review decision →', onclick: () => go('decide') });
  page.append(h('div', { class: 'card row-actions' }, h('p', { text: decided ? 'This revision is decided; its evidence is frozen. Create a new revision to re-validate.' : res.findings.length ? 'Next: candidate controls are generated from the finding classes and each is tested on this same scenario set.' : 'Nothing to fix in the tested scenarios.' }),
    h('div', {}, h('button', { class: 'btn', id: 'rerunValidationBtn', text: 'Re-run', disabled: decided, onclick: () => runValidation(v.n) }), ' ', next)));
  root.append(page);
}

/* ---- Optimize */
function describeOp(graph, o) {
  const lbl = id => graph.nodes.find(n => n.id === id)?.label || id;
  switch (o.op) {
    case 'setConfig': return `${lbl(o.id)}: ${o.key} = ${JSON.stringify(o.value)}`;
    case 'addNode': return `add ${NODE_TYPES[o.node.type].label.toLowerCase()} “${o.node.label}”`;
    case 'removeNode': return `remove ${lbl(o.id)}`;
    case 'addEdge': return `connect ${lbl(o.edge.from.node)} → ${lbl(o.edge.to.node)}${o.edge.kind === 'access' ? ' (read)' : ''}`;
    case 'removeEdge': { const e = graph.edges.find(x => x.id === o.id); return e ? `remove ${e.kind} edge ${lbl(e.from.node)} → ${lbl(e.to.node)}` : `remove edge ${o.id}`; }
    default: return o.op;
  }
}
function scoreBox(sc) {
  const S = (v, l) => h('div', {}, h('b', { text: v }), h('span', { text: l }));
  return h('div', { class: 'sc' }, S(sc.violationsClosed ? frac(sc.violationsClosed) : 'n/a', 'violations closed'), S(pct(sc.residualReachability), 'residual reach.'), S(pct(sc.benignCompletion), 'benign completion'),
    S(pct(sc.friction), 'friction'), S(sc.addedLatencyMedian == null ? 'n/a' : sc.addedLatencyMedian + ' min', 'added latency'), S(String(sc.patchOps ?? '—'), 'patch ops'));
}
function paramControls(rev, c) {
  const opts = c.candidate.paramOptions || {};
  const keys = Object.keys(opts);
  if (!keys.length) return null;
  const sels = {};
  const row = h('div', { class: 'params' }, keys.map(k => { sels[k] = h('select', { 'data-param': k, disabled: isDecided(rev) || c.state === 'rejected' }, opts[k].map(o => h('option', { value: JSON.stringify(o), text: `${k}: ${fmtParam(o)}`, selected: JSON.stringify(o) === JSON.stringify(c.candidate.params[k]) }))); return sels[k]; }));
  row.append(h('button', { class: 'btn sm', text: 'Modify & re-run', 'data-modify': c.candidate.id, disabled: isDecided(rev) || c.state === 'rejected', onclick: () => {
    const params = { ...c.candidate.params }; for (const k of keys) params[k] = JSON.parse(sels[k].value);
    modifyCandidate(c.candidate.id, params);
  } }));
  return row;
}
function renderOptimize() {
  const root = $('stage-optimize'); root.textContent = '';
  const rev = store.active(), o = rev.optimization;
  const page = h('div', { class: 'page' }, h('h1', { text: 'Optimize' }), h('p', { class: 'sub', text: 'Candidate controls generated from the finding classes, each tested on the frozen scenario set of the validation.' }));
  if (rev.origin === 'approve') { page.append(h('div', { class: 'card' }, h('h2', { text: `${revLabel(rev.rev)} was created by approving a candidate of ${revLabel(rev.parent)}` }), h('p', { class: 'sub', text: 'Its evidence is the approved candidate’s run. See Decide on the parent revision.' }))); root.append(page); return; }
  if (ui.running === 'optimize') { page.append(h('div', { class: 'card' }, h('h2', { id: 'jobLabel', text: 'Testing candidates…' }), h('div', { class: 'progress', id: 'jobProgress' }, h('i', {})))); root.append(page); return; }
  if (!o) { page.append(h('div', { class: 'card row-actions' }, h('p', { text: 'No candidates yet.' }), h('button', { class: 'btn blue', id: 'runOptimizeBtn', disabled: isDecided(rev), text: 'Generate and test candidates', onclick: runOptimize }))); root.append(page); return; }
  const rec = recommendedId(rev);
  page.append(h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('div', {}, h('h2', { text: rec ? 'Recommendation ready' : 'No acceptable candidate' }),
    h('p', { class: 'sub', text: 'Eligible = lint clean, benign completion within 2 pp of baseline, no monitor worse than baseline, every critical finding at 0 violations in the tested scenarios. Recommended = the eligible candidate with the lowest friction, then lowest added latency, then fewest patch ops.' })),
    h('span', { class: 'lc ' + (rec ? 'ok' : 'bad'), text: rec ? 'Recommended: ' + o.candidates.find(c => c.candidate.id === rec).candidate.label : 'Nothing recommended' })),
    h('div', { class: 'hint', text: 'Baseline' }), metricsRow(rev.validation.result.metrics), h('p', { class: 'claim', text: CLAIM })));
  const grid = h('div', { class: 'cand-grid' });
  const sorted = [...o.candidates].sort((a, b) => (b.candidate.id === rec) - (a.candidate.id === rec) || (b.verdict?.eligible ? 1 : 0) - (a.verdict?.eligible ? 1 : 0));
  for (const c of sorted) {
    const isRec = c.candidate.id === rec;
    const tag = c.state === 'rejected' ? h('span', { class: 'lc bad tag', text: 'Rejected' }) : c.state === 'stale' ? h('span', { class: 'lc warn tag', text: 'Stale · re-running' })
      : isRec ? h('span', { class: 'lc ok tag', text: 'Recommended' }) : c.verdict?.eligible ? h('span', { class: 'lc tag', text: 'Eligible' }) : h('span', { class: 'lc warn tag', text: 'Not eligible' });
    grid.append(h('div', { class: 'cand' + (isRec ? ' recommended' : '') + (c.state === 'rejected' ? ' rejected' : ''), 'data-cand': c.candidate.id },
      tag, h('h3', { text: c.candidate.label }), h('div', { class: 'hint', text: `${c.candidate.kind} · params v${c.candidate.paramsVersion}` }),
      h('ul', {}, c.candidate.patch.map(op => h('li', { text: describeOp(rev.graph, op) }))),
      c.verdict ? scoreBox(c.verdict.scorecard || {}) : h('p', { class: 'empty', text: 'Not tested for these parameters yet.' }),
      c.verdict && !c.verdict.eligible ? h('ul', {}, (c.verdict.reasons || []).map(r => h('li', { text: '✗ ' + r }))) : null,
      paramControls(rev, c),
      h('div', { class: 'acts' },
        h('button', { class: 'btn sm blue', text: 'Review decision →', disabled: c.state === 'rejected', onclick: () => { ui.decideId = c.candidate.id; go('decide'); } }),
        h('button', { class: 'btn sm danger', text: 'Reject', 'data-reject': c.candidate.id, disabled: c.state === 'rejected' || isDecided(rev), onclick: () => store.dispatch({ type: 'reject', rev: rev.rev, candidateId: c.candidate.id }) }))));
  }
  page.append(grid);
  root.append(page);
}

/* ---- Decide */
function renderDecide() {
  const root = $('stage-decide'); root.textContent = '';
  const rev = store.active();
  const page = h('div', { class: 'page' }, h('h1', { text: 'Decide' }), h('p', { class: 'sub', text: 'A human decides. Approving creates a new confirmed revision containing exactly the tested patch; nothing is deployed.' }));
  root.append(page);
  const evidenceCard = (title, ev) => h('div', { class: 'card' }, h('h2', { text: title }), h('div', { class: 'hint', text: 'Baseline' }), ev.baseline ? metricsRow(ev.baseline.metrics) : null, h('div', { class: 'hint', text: 'With the approved change' }), metricsRow(ev.metrics), h('p', { class: 'claim', text: CLAIM }));
  if (rev.origin === 'approve') {
    const parent = store.revision(rev.parent), d = parent.decision;
    page.append(h('div', { class: 'card row-actions' }, h('p', {}, h('b', { text: `${revLabel(rev.rev)} = ${revLabel(parent.rev)} + “${d.label}”.` }), ` Approved from run ${d.runId} on ${d.scenarioSetId}.`), h('button', { class: 'btn blue', id: 'toRegisterBtn', text: 'Register →', onclick: () => go('register') })),
      evidenceCard('Decision evidence', d.evidence), h('div', { class: 'card' }, diffView(parent.graph, rev.graph, 'The approved patch')));
    return;
  }
  if (rev.decision) {
    const d = rev.decision;
    page.append(h('div', { class: 'card row-actions' }, h('p', {}, h('b', { text: d.action === 'accept' ? 'Accepted as is.' : `Approved “${d.label}” → ${revLabel(d.childRev)}.` }), ' This revision is decided.'),
      d.action === 'approve' ? h('button', { class: 'btn blue', text: `Open ${revLabel(d.childRev)} →`, onclick: () => { store.dispatch({ type: 'setActive', rev: d.childRev }); go('decide'); } }) : h('button', { class: 'btn blue', text: 'Register →', onclick: () => go('register') })));
    return;
  }
  const v = rev.validation;
  if (v && !v.result.findings.length) {
    page.append(h('div', { class: 'card row-actions' }, h('p', { text: `No violations in ${v.result.runs.length} tested scenarios; no change needed.` }),
      h('button', { class: 'btn blue', id: 'acceptBtn', text: 'Accept as is', onclick: () => { const r = store.dispatch({ type: 'accept', rev: rev.rev }); if (r.ok) go('register'); } })));
    return;
  }
  const o = rev.optimization;
  const id = ui.decideId && o.candidates.some(c => c.candidate.id === ui.decideId) ? ui.decideId : recommendedId(rev);
  const c = id && o.candidates.find(x => x.candidate.id === id);
  if (!c) { page.append(h('div', { class: 'card row-actions' }, h('p', { text: 'No acceptable candidate. Modify a candidate’s parameters, or go back and change the blueprint in a new revision.' }), h('button', { class: 'btn', text: '← Candidates', onclick: () => go('optimize') }))); return; }
  const ok = approvable(rev, c);
  const patched = applyPatch(rev.graph, c.candidate.patch);
  page.append(h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('div', {}, h('h2', { text: `Decision · ${store.doc.name} ${revLabel(rev.rev)}` }), h('p', { class: 'sub', text: c.candidate.label })),
    h('span', { class: 'lc ' + (ok ? 'ok' : 'warn'), id: 'decideChip', text: ok ? (c.candidate.id === recommendedId(rev) ? 'Recommended · ready for approval' : 'Eligible · ready for approval') : c.state === 'rejected' ? 'Rejected' : c.state === 'stale' ? 'Stale — re-running' : 'Not eligible' })),
    h('ul', {}, c.candidate.patch.map(op => h('li', { text: describeOp(rev.graph, op) }))),
    c.verdict ? scoreBox(c.verdict.scorecard || {}) : null,
    h('div', { class: 'hint', text: 'Baseline' }), metricsRow(v.result.metrics), c.result?.metrics ? h('div', { class: 'hint', text: 'With this candidate' }) : null, c.result?.metrics ? metricsRow(c.result.metrics) : null,
    h('p', { class: 'claim', text: CLAIM + ' On approval SILEX would open a pull request against your policy-as-code; here it only records the decision and the new revision.' })));
  if (patched.ok) page.append(h('div', { class: 'card' }, diffView(rev.graph, patched.value, 'What approval changes')));
  page.append(h('div', { class: 'card row-actions' }, h('p', { text: 'Approve accepts this tested candidate. Modify changes its parameters and re-runs it. Reject removes it from consideration.' }),
    h('div', {}, h('button', { class: 'btn danger', id: 'rejectBtn', text: 'Reject', disabled: c.state === 'rejected', onclick: () => { store.dispatch({ type: 'reject', rev: rev.rev, candidateId: c.candidate.id }); ui.decideId = null; go('optimize'); } }), ' ',
      h('button', { class: 'btn', id: 'modifyBtn', text: 'Modify', onclick: () => go('optimize') }), ' ',
      h('button', { class: 'btn blue', id: 'approveBtn', text: 'Approve', disabled: !ok, onclick: () => { const r = store.dispatch({ type: 'approve', rev: rev.rev, candidateId: c.candidate.id }); if (r.ok) { toast(`Approved → ${revLabel(r.value)} (confirmed)`); go('register'); } } }))));
}

/* ---- Register */
function renderRegister() {
  const root = $('stage-register'); root.textContent = '';
  const rev = store.active();
  const inv = store.inventory();
  const mine = inv.find(x => x.docId === store.doc.id && x.rev === rev.rev && x.hash === rev.hash);
  const parent = rev.origin === 'approve' ? store.revision(rev.parent) : rev;
  const d = parent.decision;
  const page = h('div', { class: 'page' }, h('h1', { text: 'Register Workflow' }), h('p', { class: 'sub', text: 'Registration adds the workflow to the enterprise inventory. It does not deploy it to production.' }),
    h('div', { class: 'card' },
      h('div', { class: 'check-row' }, h('b', { text: '✓' }), `${revLabel(rev.rev)} confirmed · hash ${rev.hash.slice(0, 16)}…`),
      h('div', { class: 'check-row' }, h('b', { text: '✓' }), `Validation evidence: ${d.scenarioSetId} · ${d.evidence.findings.length} finding(s) remaining in the tested scenarios`),
      h('div', { class: 'check-row' }, h('b', { text: '✓' }), d.action === 'approve' ? `Decision: approved “${d.label}” on ${revLabel(parent.rev)}` : 'Decision: accepted as is'),
      h('p', { class: 'claim', text: CLAIM })),
    h('div', { class: 'card row-actions' }, h('p', {}, mine ? h('b', { text: 'Registered · not deployed.' }) : 'Approved → Registered'),
      h('div', {}, h('button', { class: 'btn', text: 'Download policy-as-code', onclick: () => download(`${store.doc.name}-${revLabel(rev.rev)}-policy.txt`, io.policyExport(store.doc, rev.rev), 'text/plain') }), ' ',
        h('button', { class: 'btn primary', id: 'registerBtn', text: mine ? 'Registered' : 'Register Workflow', disabled: !!mine, onclick: () => { const r = store.dispatch({ type: 'register', rev: rev.rev, at: new Date().toISOString() }); if (r.ok) toast('Registered · not deployed'); } }))));
  page.append(h('div', { class: 'card' }, h('h2', { text: 'Workflow inventory (this browser)' }), inv.length ? h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, ['Workflow', 'Revision', 'Hash', 'Decision', 'Status'].map(t => h('th', { text: t })))),
    h('tbody', {}, inv.map(x => h('tr', {}, h('td', { text: x.name }), h('td', { text: revLabel(x.rev) }), h('td', { class: 'mono', text: x.hash.slice(0, 12) }), h('td', { text: x.decisionRef.action + (x.decisionRef.candidateId ? ' · ' + x.decisionRef.candidateId : '') }), h('td', { text: x.status }))))) : h('p', { class: 'empty', text: 'Nothing registered yet.' })));
  root.append(page);
}

/* ------------------------------------------------------------- run panel */
function runHighlights() {
  const v = ui.runView; if (!v) return {};
  const out = {};
  for (const st of v.trace) out[st.node] = st.status === 'ok' ? 'ok' : st.status === 'waiting' ? 'wait' : st.status === 'error' ? 'err' : (out[st.node] || 'skip');
  const g = store.active().graph;
  for (const a of v.activations || []) for (let i = 1; i < a.path.length; i++) { const e = g.edges.find(x => x.kind === 'flow' && x.from.node === a.path[i - 1] && x.to.node === a.path[i]); if (e) out['edge:' + e.id] = true; }
  return out;
}
function manualScenario(f) {
  const r1 = { id: 'r1', customer: 'c1', order: 'o1', amount: f.amount, eligible: f.eligible, channel: 'support_chat', injected: f.injected };
  if (f.split > 1) r1.intent = { split: f.split };
  const reqs = [r1];
  if (f.replay) reqs.push({ id: 'r2', customer: 'c1', order: 'o2', amount: f.amount, eligible: 0, channel: 'support_chat', intent: { presentApprovalOf: 'r1' } });
  if (f.dup) reqs.push({ ...r1, id: 'r2', intent: undefined });
  return { id: 'manual-' + (ui.runs.length + 1), template: 'manual', requests: reqs };
}
function renderRunPanel() {
  const p = $('runpanel'); p.textContent = '';
  const f = ui.form ||= { amount: 1500, eligible: 1500, injected: false, split: 1, replay: false, dup: false, interactive: true };
  const num = (k, label) => { const i = h('input', { type: 'number', value: f[k], 'data-run': k }); i.addEventListener('change', () => { f[k] = Number(i.value); }); return h('label', {}, label, i); };
  const chk = (k, label) => { const i = h('input', { type: 'checkbox', checked: f[k], 'data-run': k }); i.addEventListener('change', () => { f[k] = i.checked; }); return h('label', {}, i, label); };
  const run = ui.run;
  const head = h('div', { class: 'run-head' }, h('b', { text: 'Test run' }), num('amount', 'amount $'), num('eligible', 'eligible $'), num('split', 'split into'), chk('injected', 'injected instruction'), chk('replay', 'r2 replays r1’s approval'), chk('dup', 'r2 resubmits the order'), chk('interactive', 'I approve'),
    h('button', { class: 'btn sm blue', id: 'runBtn', text: '▶ Run', onclick: () => startRun(false) }),
    h('button', { class: 'btn sm', id: 'stepBtn', text: run && !run.done ? 'Step ⏭' : 'Step mode', onclick: () => (run && !run.done ? stepRun() : startRun(true)) }),
    run?.waiting ? h('span', {}, h('b', { text: ` Waiting at ${nodeLabel(run.waiting.node)} (${run.waiting.activation}) ` }), h('button', { class: 'btn sm blue', id: 'approveRunBtn', text: 'Approve', onclick: () => resolveRun(true) }), ' ', h('button', { class: 'btn sm danger', id: 'denyRunBtn', text: 'Deny', onclick: () => resolveRun(false) })) : null,
    ui.runView ? h('button', { class: 'btn sm', text: 'Clear', onclick: () => { ui.run = null; ui.runView = null; ui.stepSel = null; renderBuild(); } }) : null,
    ui.runs.length ? h('select', { id: 'runHistory', onchange: e => { const r = ui.runs[Number(e.target.value)]; ui.run = null; ui.runView = r.view; ui.stepSel = null; renderBuild(); } }, h('option', { text: `History (${ui.runs.length})`, value: '' }), ui.runs.map((r, i) => h('option', { value: i, text: r.label }))) : null);
  p.append(head);
  const v = ui.runView;
  if (!v) return;
  const body = h('div', { class: 'run-body' });
  const list = h('div', { class: 'trace', id: 'traceList' }, v.trace.map((st, i) => h('div', { class: 'st' + (ui.stepSel === i ? ' on' : ''), 'data-step': i, onclick: () => { ui.stepSel = i; renderRunPanel(); } },
    h('span', { text: String(st.seq).padStart(2, '0') }), h('span', { text: st.activation }), h('span', { class: 's-' + st.status, text: st.status }), h('span', { text: nodeLabel(st.node) }), h('span', { text: st.out?.port ? '→ ' + st.out.port : '' }),
    h('span', { text: (st.effects || []).map(e => e.type).join(', ') }))));
  const sel = v.trace[ui.stepSel ?? v.trace.length - 1];
  const summary = h('div', {}, h('div', { class: 'hint', text: (v.activations || []).map(a => `${a.id}: ${a.status} at ${nodeLabel(a.end)}`).join(' · ') + (v.violations ? ' · violations: ' + v.violations : '') }),
    h('pre', { class: 'json', id: 'stepJson', text: sel ? JSON.stringify({ node: sel.node, status: sel.status, in: sel.in, out: sel.out, effects: sel.effects }, null, 1) : '' }));
  body.append(list, summary); p.append(body);
}
const nodeLabel = id => store.active().graph.nodes.find(n => n.id === id)?.label || id;
function finishRun() {
  const run = ui.run, res = run.result(), g = store.active().graph;
  let violations = '';
  if (run.done) {
    const mons = monitors.evaluateMonitors(g, res).filter(m => m.violations.length);
    violations = mons.length ? mons.map(m => `${nodeLabel(m.node)} (${m.violations.map(v => v.activation).join(', ')})`).join('; ') : 'none';
  }
  ui.runView = { trace: res.trace, activations: res.activations, effects: res.effects, violations };
  if (run.done) ui.runs.unshift({ label: `${ui.runs.length + 1}. $${ui.form.amount}${ui.form.split > 1 ? ' ÷' + ui.form.split : ''}${ui.form.injected ? ' inj' : ''}${ui.form.replay ? ' replay' : ''}${ui.form.dup ? ' dup' : ''} → ${res.activations.map(a => a.status).join('/')}`, view: ui.runView });
  if (ui.runs.length > 10) ui.runs.pop();
}
function startRun(stepMode) {
  const scenario = manualScenario(ui.form);
  ui.run = engine.createRun(store.active().graph, scenario, { interactive: ui.form.interactive });
  ui.stepSel = null;
  if (!stepMode) { let guard = 0; while (!ui.run.done && !ui.run.waiting && guard++ < 5000) ui.run.step(); }
  else ui.run.step();
  finishRun(); renderBuild();
}
function stepRun() { if (!ui.run || ui.run.done || ui.run.waiting) return; ui.run.step(); finishRun(); renderBuild(); }
function resolveRun(approve) {
  ui.run.resolveApproval(approve);
  const stepMode = document.getElementById('stepBtn')?.textContent.startsWith('Step ⏭');
  if (!stepMode) { let guard = 0; while (!ui.run.done && !ui.run.waiting && guard++ < 5000) ui.run.step(); }
  finishRun(); renderBuild();
}

/* ------------------------------------------------------------------- I/O */
function download(name, text, type = 'application/json') {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name.replace(/[^\w.\- ]+/g, '_');
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function importText(text) {
  const r = io.importDocument(text);
  if (!r.ok) { toast('Import failed: ' + r.error.message, true); return r; }
  store.load(r.value); ui.run = null; ui.runView = null; go('build'); requestAnimationFrame(() => canvas.fit()); toast(`Imported ${r.value.name}`);
  return r;
}
async function loadTemplate(name) {
  const res = await fetch(`templates/${name}.json`);
  if (!res.ok) throw new Error('Template not found: ' + name);
  return res.json();
}
async function startFromTemplate(name) {
  const tpl = await loadTemplate(name);
  const doc = newDocument({ ...tpl, id: `${tpl.id}-${Date.now().toString(36)}` });
  store.load(doc); ui.run = null; ui.runView = null; ui.sel = { nodes: [], edge: null }; go('build'); requestAnimationFrame(() => canvas.fit());
  toast(`New ${tpl.name} blueprint (the previous one stays saved in this browser)`);
}

/* ------------------------------------------------------------------ boot */
async function boot() {
  buildPalette(); buildToolbar();
  for (const b of document.querySelectorAll('.stage')) b.addEventListener('click', () => go(b.dataset.stage));
  $('revSelect').addEventListener('change', e => { store.dispatch({ type: 'setActive', rev: Number(e.target.value) }); ui.run = null; ui.runView = null; });
  $('templateSelect').addEventListener('change', e => { const v = e.target.value; e.target.value = ''; if (v) startFromTemplate(v); });
  $('exportBtn').addEventListener('click', () => download(`${store.doc.name}-${revLabel(store.active().rev)}.json`, io.exportDocument(store.doc)));
  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (f) importText(await f.text()); });
  if (!store.restore()) store.load(newDocument(await loadTemplate('customer-refund')));
  store.on(ev => { if (ev.reason !== 'refused') renderAll(); else renderBuild(); });
  renderAll();
  requestAnimationFrame(() => { canvas.fit(); renderBuild(); });
  window.__bs = { store, canvas, ui, go, runValidation, runOptimize, modifyCandidate, recommendedId, approvable, importText, startFromTemplate, autoLayout, addNode, modules: { expr, engine, adversary, validator, optimizer, layouter, io, nl } };
  document.documentElement.dataset.ready = '1';
}
boot().catch(err => { console.error(err); toast(String(err.message || err), true); });
