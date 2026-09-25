/* Non-UI logic of the studio (plan §4; signatures in web/CONTRACT.md).
   Ported from the v1 js/app.js: template load, restore and persistence,
   import/export, the scenario-set cache, validation / optimisation / candidate
   jobs bound to store job ids (late results are refused by the store), routing
   state, and test runs bound to a graph snapshot. Pages read the store and call
   these functions; they never mutate the document themselves. */
import { store, bump } from './storeAdapter.js';
import { pending } from './pendingInputs.js';
import { newDocument, revLabel, isDecided } from '../../../js/store.js';
import { clone, applyPatch } from '../../../js/model.js';
import * as engine from '../../../js/engine.js';
import * as monitors from '../../../js/monitors.js';
import * as adversary from '../../../js/adversary.js';
import * as validator from '../../../js/validate.js';
import * as optimizer from '../../../js/optimize.js';
import * as io from '../../../js/io.js';
import { layoutGraph } from '../builder/layout.js';
import manifest from '../../../templates/index.json';

/* Every template file is bundled (plan §3.11); the manifest fixes the order and the
   categories. A file not in the manifest is appended after the listed ones. */
const files = import.meta.glob('../../../templates/*.json', { eager: true, import: 'default' });
const byId = Object.fromEntries(Object.entries(files).filter(([p]) => !p.endsWith('/index.json')).map(([p, tpl]) => [p.split('/').pop().replace(/\.json$/, ''), tpl]));
export const TEMPLATE_IDS = [...manifest.order.filter(id => byId[id]), ...Object.keys(byId).filter(id => !manifest.order.includes(id)).sort()];
export const TEMPLATES = Object.fromEntries(TEMPLATE_IDS.map(id => [id, byId[id]]));
export const CATEGORIES = manifest.categories;
export { revLabel, isDecided };
const tick = () => new Promise(r => setTimeout(r, 0));

/* ------------------------------------------------------------------ route */
const route = { view: 'builder', stage: 'validate', panel: null, decideId: null, toast: null, selected: null, focus: null, gallery: false, traceFocus: null };
export const getRoute = () => route;
export function go(view, stage) { route.view = view; if (stage) route.stage = stage; bump(); }
/* Decision Trace focus ({kind, ref, rev}); openTrace jumps there from Validate / Optimize / Decide. */
export function setTraceFocus(f) { route.traceFocus = f; bump(); }
export function openTrace(kind, ref) { route.traceFocus = kind ? { kind, ref, rev: store.active().rev } : null; route.view = 'trace'; bump(); }
export function setPanel(panel) { route.panel = panel; bump(); }           // null | 'run'
export function setDecideId(id) { route.decideId = id; bump(); }
export function openGallery(open = true) { route.gallery = open; bump(); }
/* Builder selection ({kind:'node'|'edge', id} | null) and focus requests
   (the checklist asks the canvas to centre a node, or to fit the whole flow). */
export function setSelected(sel) { route.selected = sel; if (sel && route.panel === 'run') route.panel = null; bump(); }   // Ask AI stays open while you click around, as in n8n
export function focusNode(id) { route.view = 'builder'; route.selected = id ? { kind: 'node', id } : null; route.focus = { id, at: Date.now() }; if (route.panel === 'run') route.panel = null; bump(); }
let toastTimer = 0;
export function toast(text, kind = 'info') { route.toast = { text, kind, at: Date.now() }; bump(); clearTimeout(toastTimer); toastTimer = setTimeout(() => { route.toast = null; bump(); }, 3200); }
store.on(ev => { if (ev.reason === 'refused' && ev.error && ev.error.code !== 'stale_job') toast(ev.error.message, 'error'); });

/* --------------------------------------------------------------- documents */
function laidOut(tpl) {
  const t = clone(tpl);
  t.graph.direction = 'LR';                                 // new documents flow left to right (plan §3.12)
  const pos = layoutGraph(t.graph);
  for (const n of t.graph.nodes) if (pos[n.id]) { n.x = pos[n.id].x; n.y = pos[n.id].y; }
  return t;
}
export function startFromTemplate(name) {
  if (!TEMPLATES[name]) return toast('Unknown template ' + name, 'error');
  route.gallery = false;
  const tpl = laidOut(TEMPLATES[name]);
  store.load(newDocument({ ...tpl, id: `${tpl.id}-${Date.now().toString(36)}` }));
  resetSession(); route.view = 'builder'; bump();
}
export function startBlank() {
  store.load(newDocument({ id: 'bp-' + Date.now().toString(36), name: 'Untitled workflow', domain: 'General', owner: 'Workflow owner', graph: { nodes: [], edges: [], direction: 'LR' } }));
  resetSession(); route.view = 'builder'; bump();
}
export function boot() {
  if (!store.restore()) startFromTemplate('customer-refund');
  bump();
}
function resetSession() { route.selected = null; route.focus = null; pending.clearAll(); run.current = null; run.view = null; run.history = []; route.panel = null; route.decideId = null; }
/* Opens a document that embed.js has already validated (cutover plan §2.2). */
export function openDocument(doc, rev, view = 'assurance', stage = null) {
  route.gallery = false;
  store.load(doc); resetSession();
  store.dispatch({ type: 'setActive', rev });
  route.view = view; if (stage) route.stage = stage;
  bump();
}
export function setActiveRevision(rev) { const r = store.dispatch({ type: 'setActive', rev }); pending.clearAll(); return r; }
export function newRevision() {
  const r = store.dispatch({ type: 'newRevision', from: store.active().rev });
  if (r.ok) { pending.clearAll(); route.view = 'builder'; toast(`${revLabel(r.value.rev)} · draft`); }
  return r;
}
export function exportText() { return io.exportDocument(store.doc); }
export function importText(text) {
  const r = io.importDocument(text);
  if (!r.ok) { toast('Import failed: ' + r.error.message, 'error'); return r; }
  store.load(r.value); resetSession(); route.view = 'builder'; bump(); toast(`Imported ${r.value.name}`);
  return r;
}

/* ---------------------------------------------------------- validation jobs */
const setCache = new Map();
export function scenarioSetFor(rev, n) {
  const base = rev.origin === 'approve' ? store.revision(rev.parent) : rev;
  const key = base.hash + '|' + n;
  if (!setCache.has(key)) setCache.set(key, adversary.generateScenarioSet(base.graph, { n, baseHash: base.hash }));
  return setCache.get(key);
}
export const compact = res => validator.compactResult(res);
export const jobs = { running: null, done: 0, total: 0 };      // progress for the pages
function progress(kind, done, total) { jobs.running = kind; jobs.done = done; jobs.total = total; bump(); }

export async function runValidation(n = 40) {
  const rev = store.active();
  const key = 'validate:' + rev.rev, job = store.startJob(key);
  const set = scenarioSetFor(rev, n), runs = [];
  progress('validate', 0, set.scenarios.length);
  for (let i = 0; i < set.scenarios.length; i += 20) {
    if (!store.jobCurrent(key, job)) { progress(null, 0, 0); return { ok: false, error: { code: 'stale_job' } }; }
    runs.push(...validator.runScenarios(rev.graph, set.scenarios.slice(i, i + 20)));
    progress('validate', runs.length, set.scenarios.length); await tick();
  }
  const { findings, metrics } = validator.summarize(rev.graph, runs);
  const result = compact({ findings, metrics, lint: validator.lint(rev.graph), potential: validator.potentialPaths(rev.graph), runs });
  progress(null, 0, 0);
  return store.dispatch({ type: 'setValidation', rev: rev.rev, jobId: job, revHash: rev.hash, scenarioSetId: set.id, n, result });
}

let runSeq = 0;
function testCandidate(rev, candidate, set) {
  const res = optimizer.runCandidate(rev.graph, candidate, set, store.meta());
  if (!res.ok) return { candidate, runId: 'run-' + (++runSeq), result: { findings: [], metrics: {}, lint: [{ severity: 'error', code: res.error.code, message: res.error.message }], runs: [], patchedHash: null }, verdict: { eligible: false, reasons: [res.error.message], scorecard: {} } };
  return { candidate, runId: 'run-' + (++runSeq), result: compact(res.value), verdict: optimizer.score({ ...rev.validation.result }, res.value) };
}

export async function runOptimize() {
  const rev = store.active(), v = rev.validation;
  const key = 'optimize:' + rev.rev, job = store.startJob(key);
  const set = scenarioSetFor(rev, v.n);
  const cands = optimizer.generateCandidates(rev.graph, { ...v.result, scenarioSetId: v.scenarioSetId });
  const out = [];
  progress('optimize', 0, cands.length);
  for (const c of cands) {
    if (!store.jobCurrent(key, job)) { progress(null, 0, 0); return { ok: false, error: { code: 'stale_job' } }; }
    out.push(testCandidate(rev, c, set)); progress('optimize', out.length, cands.length); await tick();
  }
  progress(null, 0, 0);
  const r = store.dispatch({ type: 'setOptimization', rev: rev.rev, jobId: job, revHash: rev.hash, scenarioSetId: set.id, candidates: out });
  if (r.ok) route.decideId = recommendedId(store.active());
  return r;
}

export async function modifyCandidate(candidateId, params) {
  const rev = store.active();
  const c = rev.optimization.candidates.find(x => x.candidate.id === candidateId);
  const next = optimizer.reparam(rev.graph, { ...rev.validation.result, scenarioSetId: rev.validation.scenarioSetId }, c.candidate, params);
  const m = store.dispatch({ type: 'modify', rev: rev.rev, candidateId, candidate: next });
  if (!m.ok) return m;
  const key = 'cand:' + rev.rev + ':' + candidateId, job = store.startJob(key);
  await tick();
  const t = testCandidate(rev, next, scenarioSetFor(rev, rev.validation.n));
  return store.dispatch({ type: 'candidateResult', rev: rev.rev, candidateId, jobId: job, paramsVersion: next.paramsVersion, scenarioSetId: rev.optimization.scenarioSetId, revHash: rev.hash, runId: t.runId, result: t.result, verdict: t.verdict });
}

export function recommendedId(rev) {
  const o = rev && rev.optimization; if (!o) return null;
  const scored = o.candidates.filter(c => c.state === 'tested' && c.testedParamsVersion === c.candidate.paramsVersion).map(c => ({ candidate: c.candidate, result: c.result, verdict: c.verdict }));
  const rejected = new Set(o.candidates.filter(c => c.state === 'rejected').map(c => c.candidate.id));
  return optimizer.recommend(scored, rejected);
}
export const approvable = (rev, c) => !isDecided(rev) && c.state === 'tested' && !!c.verdict?.eligible && c.testedParamsVersion === c.candidate.paramsVersion && rev.optimization.scenarioSetId === rev.validation?.scenarioSetId;
export const confirm = () => pending.size ? { ok: false, error: { code: 'pending_input', message: 'Fix or discard the pending inputs first' } } : store.dispatch({ type: 'confirm' });
export const approve = candidateId => store.dispatch({ type: 'approve', rev: store.active().rev, candidateId, at: new Date().toISOString() });
export const reject = candidateId => store.dispatch({ type: 'reject', rev: store.active().rev, candidateId });
export const accept = () => store.dispatch({ type: 'accept', rev: store.active().rev, at: new Date().toISOString() });
export const register = () => store.dispatch({ type: 'register', rev: store.active().rev, at: new Date().toISOString() });
export const patchedGraph = (rev, candidate) => applyPatch(rev.graph, candidate.patch);
export const diffGraphs = io.diffGraphs;
export const policyText = rev => io.policyExport(store.doc, rev);

/* ------------------------------------------------------------- test runs */
export const run = { current: null, view: null, history: [], form: { amount: 2500, eligible: 2500, split: 1, injected: false, replay: false, dup: false, interactive: true } };
const runCtx = () => { const r = store.active(); return { docId: store.doc.id, rev: r.rev, hash: store.hashOf(r), graph: clone(r.graph) }; };
export const sameCtx = c => !!c && !!store.doc && c.docId === store.doc.id && c.rev === store.active().rev && c.hash === store.hashOf(store.active());
store.on(ev => { if (ev.reason !== 'refused' && run.current && !sameCtx(run.current.ctx)) { run.current = null; toast('Test run cancelled: the graph or revision changed'); } });

function scenarioFromForm(f) {
  const r1 = { id: 'r1', customer: 'c1', order: 'o1', amount: Number(f.amount), eligible: Number(f.eligible), channel: 'support_chat', injected: !!f.injected };
  if (Number(f.split) > 1) r1.intent = { split: Number(f.split) };
  const reqs = [r1];
  if (f.replay) reqs.push({ id: 'r2', customer: 'c1', order: 'o2', amount: Number(f.amount), eligible: 0, channel: 'support_chat', intent: { presentApprovalOf: 'r1' } });
  if (f.dup) reqs.push({ ...r1, id: 'r2', intent: undefined });
  return { id: 'manual-' + (run.history.length + 1), template: 'manual', requests: reqs };
}
function snapshotRun() {
  const cur = run.current, res = cur.engine.result(), g = cur.ctx.graph;
  let violations = null;
  if (cur.engine.done) violations = monitors.evaluateMonitors(g, res).filter(m => m.violations.length);
  run.view = { trace: res.trace, activations: res.activations, violations, ctx: cur.ctx, waiting: cur.engine.waiting, done: cur.engine.done };
  if (cur.engine.done) { run.history.unshift({ at: Date.now(), form: { ...run.form }, view: run.view }); run.history.length = Math.min(run.history.length, 10); }
  bump();
}
function drive(stepMode) { const e = run.current.engine; if (stepMode) e.step(); else { let g = 0; while (!e.done && !e.waiting && g++ < 5000) e.step(); } snapshotRun(); }
export function startRun(stepMode = false) {
  const ctx = runCtx();
  run.current = { ctx, stepMode, engine: engine.createRun(ctx.graph, scenarioFromForm(run.form), { interactive: !!run.form.interactive }) };
  drive(stepMode);
}
export function stepRun() { if (run.current && !run.current.engine.done && !run.current.engine.waiting) drive(true); }
export function resolveRun(approveIt) { if (!run.current?.engine.waiting) return; run.current.engine.resolveApproval(approveIt); drive(run.current.stepMode); }
export function clearRun() { run.current = null; run.view = null; bump(); }
export function runHighlights() {
  const v = run.view; if (!v || !sameCtx(v.ctx)) return { nodes: {}, edges: {} };
  const nodes = {}, edges = {};
  for (const st of v.trace) nodes[st.node] = st.status === 'ok' ? 'ok' : st.status === 'waiting' ? 'wait' : st.status === 'error' ? 'err' : (nodes[st.node] || 'skip');
  if (v.waiting) nodes[v.waiting.node] = 'wait';
  const g = v.ctx.graph;
  for (const a of v.activations || []) for (let i = 1; i < a.path.length; i++) { const e = g.edges.find(x => x.kind === 'flow' && x.from.node === a.path[i - 1] && x.to.node === a.path[i]); if (e) edges[e.id] = true; }
  return { nodes, edges };
}
