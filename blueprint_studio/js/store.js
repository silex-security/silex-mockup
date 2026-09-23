/* Document store: revisions, the single mutation choke point (dispatch),
   the draft lock, undo/redo, autosave and change events.
   Lifecycle rules: plan §4.8. No DOM access. */

import { SCHEMA, applyPatch, hashGraph, clone, ok, fail } from './model.js';

/* A revision is decided once a human approved a candidate from it, accepted it
   as is, or it was itself created by an approval. Its evidence is then frozen. */
export const isDecided = rev => !!(rev && (rev.decision || rev.origin === 'approve'));

const DOC_KEY = id => 'bs.doc.' + id;
const CURRENT_KEY = 'bs.current';
export const INVENTORY_KEY = 'bs.inventory';

export function newDocument(template) {
  const t = clone(template);
  return {
    schema: SCHEMA, id: t.id, name: t.name, domain: t.domain, owner: t.owner,
    revisions: [{ rev: 0, parent: null, status: 'draft', origin: 'edit', graph: t.graph, hash: null, validation: null, optimization: null, decision: null }],
    activeRev: 0
  };
}

export const revLabel = n => 'v1.' + n;

/* storage: anything with getItem/setItem (localStorage, or a Map-backed stub
   in tests). lint(graph) -> issues[]; confirm is refused while any issue has
   severity 'error'. */
export function createStore({ storage = null, lint = () => [] } = {}) {
  const listeners = new Set();
  const s = { doc: null, undo: [], redo: [], lastMerge: null, jobs: {}, jobSeq: 0, inventory: [] };
  const loadInventory = () => { try { s.inventory = JSON.parse(storage?.getItem(INVENTORY_KEY) || '[]'); } catch { s.inventory = []; } };
  const saveInventory = () => { try { storage?.setItem(INVENTORY_KEY, JSON.stringify(s.inventory)); } catch { /* ignore */ } };
  loadInventory();

  const emit = (reason, detail = {}) => { for (const fn of listeners) fn({ reason, ...detail }); };
  const save = () => {
    if (!storage || !s.doc) return;
    try { storage.setItem(DOC_KEY(s.doc.id), JSON.stringify(s.doc)); storage.setItem(CURRENT_KEY, s.doc.id); } catch { /* quota or private mode: keep working in memory */ }
  };
  const refuse = (code, message) => { const r = fail(code, message); emit('refused', { error: r.error }); return r; };

  const api = {
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    get doc() { return s.doc; },
    active() { return s.doc && s.doc.revisions.find(r => r.rev === s.doc.activeRev); },
    revision(n) { return s.doc && s.doc.revisions.find(r => r.rev === n); },
    draft() { return s.doc && s.doc.revisions.find(r => r.status === 'draft') || null; },
    canUndo() { return s.undo.length > 0 && api.active()?.status === 'draft'; },
    canRedo() { return s.redo.length > 0 && api.active()?.status === 'draft'; },
    hashOf(rev) { return hashGraph(rev.graph, { name: s.doc.name, domain: s.doc.domain }); },
    meta() { return { name: s.doc.name, domain: s.doc.domain }; },
    inventory() { return clone(s.inventory); },
    /* Jobs: long computations register here; a result is accepted only while
       its job is still the current one for that key. Changing the active
       revision cancels every job. */
    startJob(key) { const id = 'job-' + (++s.jobSeq); s.jobs[key] = id; return id; },
    jobCurrent(key, id) { return s.jobs[key] === id; },

    load(doc) { s.doc = clone(doc); s.undo = []; s.redo = []; s.lastMerge = null; s.jobs = {}; save(); emit('load'); return ok(s.doc); },
    restore() {
      if (!storage) return null;
      try {
        const id = storage.getItem(CURRENT_KEY); if (!id) return null;
        const raw = storage.getItem(DOC_KEY(id)); if (!raw) return null;
        const doc = JSON.parse(raw);
        if (doc.schema !== SCHEMA || !Array.isArray(doc.revisions)) return null;
        api.load(doc); return s.doc;
      } catch { return null; }
    },

    /* The only way anything changes. */
    dispatch(cmd) {
      if (!s.doc) return refuse('no_document', 'No document loaded');
      const h = handlers[cmd.type];
      if (!h) return refuse('unknown_command', 'Unknown command ' + cmd.type);
      const r = h(cmd);
      if (r.ok) { save(); emit(cmd.type, { cmd }); } else emit('refused', { error: r.error, cmd });
      return r;
    }
  };

  const requireDraft = () => {
    const a = api.active();
    if (!a || a.status !== 'draft') return fail('locked', `${revLabel(a ? a.rev : 0)} is confirmed and locked. Create a new revision to change it.`);
    return null;
  };

  const handlers = {
    patch(cmd) {
      const locked = requireDraft(); if (locked) return locked;
      const a = api.active();
      const r = applyPatch(a.graph, cmd.ops || []);
      if (!r.ok) return r;
      const before = a.graph;
      a.graph = r.value;
      if (cmd.merge && s.lastMerge === cmd.merge && s.undo.length) s.undo[s.undo.length - 1].after = a.graph;
      else s.undo.push({ label: cmd.label || 'Edit', before, after: a.graph });
      if (s.undo.length > 200) s.undo.shift();
      s.lastMerge = cmd.merge || null; s.redo = [];
      return ok(a.graph);
    },
    undo() {
      const locked = requireDraft(); if (locked) return locked;
      const e = s.undo.pop(); if (!e) return fail('nothing_to_undo', 'Nothing to undo');
      api.active().graph = e.before; s.redo.push(e); s.lastMerge = null; return ok(e.label);
    },
    redo() {
      const locked = requireDraft(); if (locked) return locked;
      const e = s.redo.pop(); if (!e) return fail('nothing_to_redo', 'Nothing to redo');
      api.active().graph = e.after; s.undo.push(e); s.lastMerge = null; return ok(e.label);
    },
    confirm() {
      const locked = requireDraft(); if (locked) return locked;
      const a = api.active();
      const errors = lint(a.graph).filter(i => i.severity === 'error');
      if (errors.length) return fail('lint_errors', `Fix ${errors.length} error(s) before confirming`, { issues: errors });
      a.status = 'confirmed'; a.hash = api.hashOf(a);
      s.undo = []; s.redo = []; s.lastMerge = null;
      return ok(a);
    },
    newRevision(cmd) {
      const existing = api.draft();
      if (existing) { s.doc.activeRev = existing.rev; s.undo = []; s.redo = []; return ok(existing); }
      const from = api.revision(cmd.from ?? s.doc.activeRev);
      if (!from || from.status !== 'confirmed') return fail('bad_parent', 'New revisions start from a confirmed revision');
      const rev = Math.max(...s.doc.revisions.map(r => r.rev)) + 1;
      const r = { rev, parent: from.rev, status: 'draft', origin: 'edit', graph: clone(from.graph), hash: null, validation: null, optimization: null, decision: null };
      s.doc.revisions.push(r); s.doc.activeRev = rev; s.undo = []; s.redo = []; s.lastMerge = null; s.jobs = {};
      return ok(r);
    },
    setActive(cmd) {
      if (!api.revision(cmd.rev)) return fail('unknown_revision', 'No revision ' + cmd.rev);
      s.doc.activeRev = cmd.rev; s.undo = []; s.redo = []; s.lastMerge = null; s.jobs = {};
      return ok(cmd.rev);
    },
    rename(cmd) {
      const locked = requireDraft(); if (locked) return locked;
      if (s.doc.revisions.some(r => r.status === 'confirmed')) return fail('named', 'The name is part of every confirmed revision\'s hash and cannot change after the first confirmation');
      if (cmd.name) s.doc.name = String(cmd.name);
      return ok(s.doc.name);
    }
  };

  /* ---- lifecycle (plan §4.8) ------------------------------------------ */
  const evidenceRev = cmd => {
    const r = api.revision(cmd.rev);
    if (!r) return [null, fail('unknown_revision', 'No revision ' + cmd.rev)];
    if (r.status !== 'confirmed') return [null, fail('not_confirmed', 'Validate a confirmed revision')];
    if (isDecided(r)) return [null, fail('decided', `${revLabel(r.rev)} is decided — create a new revision to re-validate`)];
    return [r, null];
  };
  const staleJob = (key, cmd) => !api.jobCurrent(key, cmd.jobId);

  Object.assign(handlers, {
    setValidation(cmd) {
      const [r, e] = evidenceRev(cmd); if (e) return e;
      if (staleJob('validate:' + r.rev, cmd) || cmd.revHash !== r.hash) return fail('stale_job', 'Discarded a result for a superseded job');
      r.validation = { jobId: cmd.jobId, revHash: r.hash, scenarioSetId: cmd.scenarioSetId, n: cmd.n, result: clone(cmd.result) };
      r.optimization = null;                      // candidates were tested against the old validation
      return ok(r.validation);
    },
    setOptimization(cmd) {
      const [r, e] = evidenceRev(cmd); if (e) return e;
      if (staleJob('optimize:' + r.rev, cmd) || cmd.revHash !== r.hash) return fail('stale_job', 'Discarded a result for a superseded job');
      if (!r.validation || r.validation.scenarioSetId !== cmd.scenarioSetId) return fail('no_validation', 'Optimize runs on the validated scenario set');
      r.optimization = { jobId: cmd.jobId, revHash: r.hash, scenarioSetId: cmd.scenarioSetId,
        candidates: cmd.candidates.map(c => ({ candidate: clone(c.candidate), state: 'tested', runId: c.runId, result: clone(c.result), verdict: clone(c.verdict), testedParamsVersion: c.candidate.paramsVersion })) };
      return ok(r.optimization);
    },
    modify(cmd) {                                  // cmd.candidate: the reparametrised candidate (same id, paramsVersion + 1)
      const [r, e] = evidenceRev(cmd); if (e) return e;
      const c = r.optimization?.candidates.find(x => x.candidate.id === cmd.candidateId);
      if (!c) return fail('unknown_candidate', 'No candidate ' + cmd.candidateId);
      if (c.state === 'rejected') return fail('rejected', 'Rejected candidates cannot be modified');
      if (cmd.candidate.id !== c.candidate.id || cmd.candidate.paramsVersion <= c.candidate.paramsVersion) return fail('bad_candidate', 'Modify must keep the id and raise paramsVersion');
      c.candidate = clone(cmd.candidate); c.state = 'stale'; c.result = null; c.verdict = null; c.runId = null;
      return ok(c);
    },
    candidateResult(cmd) {
      const [r, e] = evidenceRev(cmd); if (e) return e;
      const c = r.optimization?.candidates.find(x => x.candidate.id === cmd.candidateId);
      if (!c) return fail('unknown_candidate', 'No candidate ' + cmd.candidateId);
      if (staleJob('cand:' + r.rev + ':' + c.candidate.id, cmd) || cmd.paramsVersion !== c.candidate.paramsVersion ||
          cmd.scenarioSetId !== r.optimization.scenarioSetId || cmd.revHash !== r.hash || c.state === 'rejected')
        return fail('stale_job', 'Discarded a candidate result for superseded parameters');
      Object.assign(c, { state: 'tested', runId: cmd.runId, result: clone(cmd.result), verdict: clone(cmd.verdict), testedParamsVersion: cmd.paramsVersion });
      return ok(c);
    },
    reject(cmd) {
      const [r, e] = evidenceRev(cmd); if (e) return e;
      const c = r.optimization?.candidates.find(x => x.candidate.id === cmd.candidateId);
      if (!c) return fail('unknown_candidate', 'No candidate ' + cmd.candidateId);
      c.state = 'rejected'; return ok(c);
    },
    approve(cmd) {
      const [r, e] = evidenceRev(cmd); if (e) return e;
      const o = r.optimization;
      const c = o?.candidates.find(x => x.candidate.id === cmd.candidateId);
      if (!c) return fail('unknown_candidate', 'No candidate ' + cmd.candidateId);
      if (c.state !== 'tested' || !c.verdict?.eligible || c.testedParamsVersion !== c.candidate.paramsVersion || o.scenarioSetId !== r.validation?.scenarioSetId)
        return fail('not_approvable', 'Only a tested, eligible, current candidate can be approved');
      const patched = applyPatch(r.graph, c.candidate.patch);
      if (!patched.ok) return patched;
      const childHash = hashGraph(patched.value, api.meta());
      if (childHash !== c.result.patchedHash) return fail('hash_mismatch', 'The patched graph differs from the one that was tested');
      const rev = Math.max(...s.doc.revisions.map(x => x.rev)) + 1;
      const evidence = clone({ findings: c.result.findings, metrics: c.result.metrics, lint: c.result.lint, runs: c.result.runs, scorecard: c.verdict.scorecard, baseline: { findings: r.validation.result.findings, metrics: r.validation.result.metrics } });
      r.decision = { action: 'approve', candidateId: c.candidate.id, label: c.candidate.label, patch: clone(c.candidate.patch), paramsVersion: c.candidate.paramsVersion,
        scenarioSetId: o.scenarioSetId, runId: c.runId, childRev: rev, childHash, evidence, decidedAt: cmd.at || null };
      s.doc.revisions.push({ rev, parent: r.rev, status: 'confirmed', origin: 'approve', graph: patched.value, hash: childHash,
        validation: { jobId: null, revHash: childHash, scenarioSetId: o.scenarioSetId, n: r.validation.n, result: clone({ findings: c.result.findings, metrics: c.result.metrics, lint: c.result.lint, potential: c.result.potential || [], runs: c.result.runs }) },
        optimization: null, decision: null });
      s.doc.activeRev = rev; s.jobs = {};
      return ok(rev);
    },
    accept(cmd) {
      const [r, e] = evidenceRev(cmd); if (e) return e;
      if (!r.validation) return fail('no_validation', 'Validate first');
      if (r.validation.result.findings.length) return fail('has_findings', 'Accept as is is only for a revision with no findings');
      r.decision = { action: 'accept', scenarioSetId: r.validation.scenarioSetId, runId: r.validation.jobId, evidence: clone({ findings: [], metrics: r.validation.result.metrics }), decidedAt: cmd.at || null };
      return ok(r.decision);
    },
    register(cmd) {
      const r = api.revision(cmd.rev);
      if (!r) return fail('unknown_revision', 'No revision ' + cmd.rev);
      const accepted = r.decision?.action === 'accept';
      if (!(r.origin === 'approve' || accepted)) return fail('not_registrable', 'Register an approved revision (or one accepted as is)');
      const parent = r.origin === 'approve' ? api.revision(r.parent) : r;
      const key = `${s.doc.id}|${r.rev}|${r.hash}`;
      const existing = s.inventory.find(x => x.key === key);
      if (existing) return ok(existing);
      const entry = { key, docId: s.doc.id, name: s.doc.name, domain: s.doc.domain, owner: s.doc.owner, rev: r.rev, hash: r.hash,
        decisionRef: { rev: parent.rev, action: parent.decision.action, candidateId: parent.decision.candidateId || null, runId: parent.decision.runId },
        evidence: clone(accepted ? r.decision.evidence : parent.decision.evidence), registeredAt: cmd.at || null, status: 'Registered · not deployed' };
      s.inventory.push(entry); saveInventory();
      return ok(entry);
    }
  });

  api._handlers = handlers;
  api._state = s;
  api._requireDraft = requireDraft;
  return api;
}

/* In-memory storage with the localStorage interface, for tests. */
export function memoryStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), clear: () => m.clear() };
}
