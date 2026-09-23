/* Document store: revisions, the single mutation choke point (dispatch),
   the draft lock, undo/redo, autosave and change events.
   Lifecycle rules: plan §4.8. No DOM access. */

import { SCHEMA, applyPatch, hashGraph, clone, ok, fail } from './model.js';

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
  const s = { doc: null, undo: [], redo: [], lastMerge: null };

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

    load(doc) { s.doc = clone(doc); s.undo = []; s.redo = []; s.lastMerge = null; save(); emit('load'); return ok(s.doc); },
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
      s.doc.revisions.push(r); s.doc.activeRev = rev; s.undo = []; s.redo = []; s.lastMerge = null;
      return ok(r);
    },
    setActive(cmd) {
      if (!api.revision(cmd.rev)) return fail('unknown_revision', 'No revision ' + cmd.rev);
      s.doc.activeRev = cmd.rev; s.undo = []; s.redo = []; s.lastMerge = null;
      return ok(cmd.rev);
    },
    rename(cmd) {
      const locked = requireDraft(); if (locked) return locked;
      if (cmd.name) s.doc.name = String(cmd.name);
      return ok(s.doc.name);
    }
  };

  api._handlers = handlers;       // lifecycle commands are registered by app code (Task 6)
  api._state = s;
  api._requireDraft = requireDraft;
  return api;
}

/* In-memory storage with the localStorage interface, for tests. */
export function memoryStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), clear: () => m.clear() };
}
