// Environment draft commands, undo and redo, as pure reducers over GymState.environmentDrafts.
//
// A draft's editable content is { name, components, relations, dataSeed, assumptions }. Every command is a pure
// (content, payload) -> content | { error } entry in COMMANDS. applyEnvironmentCommand commits one command as one
// undoable step: it snapshots the previous content into history.past, clears history.future and bumps revision.
// Chat and the validation report sit outside the snapshots, so undo never rewrites the transcript, and the draft
// status is derived by comparing the report's digest with the restored content.
import { clone, digestOf } from '../model.js';
import { DEDUP_ASSUMPTION_TEXT, LINK_FIELDS, PERMISSION_LABEL, catalogEntry } from './catalog.js';
import { behaviourDigest, validateEnvironment } from './validate.js';

export const DRAFT_ID = 'draft-sales-ops';
export const HISTORY_LIMIT = 50;

const PERMISSIONS = Object.keys(PERMISSION_LABEL);
const FAILURES = ['none', 'timeout_after_send'];
const DEDUPS = ['none', 'idempotency_key', 'custom_adapter'];
const PATCHABLE = ['name', 'enabledTools', 'permission', 'failureBehavior', 'dedup', 'mode'];

const fail = (code, message) => ({ error: { code, message } });

export const contentOf = d => ({ name: d.name, components: d.components, relations: d.relations, dataSeed: d.dataSeed, assumptions: d.assumptions });

/** 'draft' until a report matches the current content, then the report's status. */
export function draftStatus(draft) {
  const report = draft.validation;
  return report && report.digest === behaviourDigest(draft) ? report.status : 'draft';
}

export const dedupAssumptionId = componentId => `dedup-${componentId}`;

/** A Custom adapter is a behavior claim, so each one carries a pending assumption until someone confirms it. */
function syncDedupAssumptions(content) {
  const custom = content.components.filter(c => c.dedup === 'custom_adapter');
  const isDedup = a => a.id === dedupAssumptionId(a.componentId);
  const kept = content.assumptions.filter(a => !isDedup(a) || custom.some(c => c.id === a.componentId));
  const added = custom.filter(c => !kept.some(a => a.id === dedupAssumptionId(c.id)))
    .map(c => ({ id: dedupAssumptionId(c.id), componentId: c.id, text: DEDUP_ASSUMPTION_TEXT(c.name), kind: 'behavior', state: 'pending' }));
  return added.length || kept.length !== content.assumptions.length ? { ...content, assumptions: [...kept, ...added] } : content;
}

function nextFreePos(components) {
  for (let y = 0; ; y++) for (let x = 0; x < 2; x++) if (!components.some(c => c.pos.x === x && c.pos.y === y)) return { x, y };
}

const findComponent = (content, id) => content.components.find(c => c.id === id);
const mapComponent = (content, id, fn) => ({ ...content, components: content.components.map(c => c.id === id ? fn(c) : c) });
const withSeed = (dataSeed, entry) => ({ ...Object.fromEntries(Object.entries(entry.seed).map(([k, v]) => [k, clone(v)])), ...dataSeed });
const dropUnusedSeed = (dataSeed, components, kind) =>
  components.some(c => c.kind === kind) ? dataSeed : Object.fromEntries(Object.entries(dataSeed).filter(([k]) => k !== kind));

function checkPatch(component, patch) {
  for (const key of Object.keys(patch)) if (!PATCHABLE.includes(key)) return `${key} cannot be edited`;
  if ('mode' in patch && patch.mode !== 'simulated') return 'Only Simulated mode is available in this preview. Live connections are not supported.';
  if ('permission' in patch && !PERMISSIONS.includes(patch.permission)) return `Unknown permission ${patch.permission}`;
  if ('failureBehavior' in patch && !FAILURES.includes(patch.failureBehavior)) return `Unknown failure behavior ${patch.failureBehavior}`;
  if ('dedup' in patch && !DEDUPS.includes(patch.dedup)) return `Unknown deduplication support ${patch.dedup}`;
  if ('name' in patch && !(typeof patch.name === 'string' && patch.name.trim() && patch.name.trim().length <= 60)) return 'Component name must be 1 to 60 characters';
  if ('enabledTools' in patch && !(Array.isArray(patch.enabledTools) && patch.enabledTools.every(t => component.tools.some(s => s.name === t)))) return `Unknown tool for ${component.name}`;
  return null;
}

/** @type {Record<string, (content: object, payload: object) => object>} */
export const COMMANDS = Object.freeze({
  rename(content, { name }) {
    const clean = String(name ?? '').trim();
    if (!clean || clean.length > 80) return fail('invalid_name', 'Environment name must be 1 to 80 characters');
    return { ...content, name: clean };
  },
  updateComponent(content, { componentId, patch }) {
    const component = findComponent(content, componentId);
    if (!component) return fail('component_missing', `No component ${componentId}`);
    const problem = checkPatch(component, patch);
    if (problem) return fail('invalid_patch', problem);
    const clean = { ...patch, ...(patch.name != null && { name: patch.name.trim() }), ...(patch.enabledTools && { enabledTools: component.tools.map(t => t.name).filter(n => patch.enabledTools.includes(n)) }) };
    return mapComponent(content, componentId, c => ({ ...c, ...clean }));
  },
  addComponent(content, { catalogId }) {
    const entry = catalogEntry(catalogId);
    if (!entry) return fail('catalog_missing', `${catalogId} is not a supported simulated component`);
    if (findComponent(content, entry.id)) return fail('component_exists', `${entry.component.name} is already in this environment`);
    const component = { ...clone(entry.component), pos: nextFreePos(content.components) };
    return { ...content, components: [...content.components, component], dataSeed: withSeed(content.dataSeed, entry) };
  },
  replaceComponent(content, { componentId, catalogId }) {
    const old = findComponent(content, componentId);
    const entry = catalogEntry(catalogId);
    if (!old) return fail('component_missing', `No component ${componentId}`);
    if (!entry) return fail('catalog_missing', `${catalogId} is not a supported simulated component`);
    if (entry.id === componentId) return content;
    if (findComponent(content, entry.id)) return fail('component_exists', `${entry.component.name} is already in this environment`);
    const components = content.components.map(c => c.id === componentId ? { ...clone(entry.component), pos: old.pos } : c);
    return {
      ...content, components,
      dataSeed: dropUnusedSeed(withSeed(content.dataSeed, entry), components, old.kind),
      assumptions: content.assumptions.filter(a => a.componentId !== componentId),
    };
  },
  removeComponent(content, { componentId }) {
    const old = findComponent(content, componentId);
    if (!old) return fail('component_missing', `No component ${componentId}`);
    const components = content.components.filter(c => c.id !== componentId);
    // Relations that point at the removed component stay, so validation reports the broken link instead of hiding it.
    return { ...content, components, dataSeed: dropUnusedSeed(content.dataSeed, components, old.kind), assumptions: content.assumptions.filter(a => a.componentId !== componentId) };
  },
  addRelation(content, { from, to, field }) {
    const a = findComponent(content, from), b = findComponent(content, to);
    if (!a || !b) return fail('component_missing', `Both components must be in this environment`);
    if (a.id === b.id) return fail('relation_self', 'A relationship links two different components');
    if (!LINK_FIELDS[a.kind]?.[field] || !LINK_FIELDS[b.kind]?.[field]) return fail('relation_field', `${a.name} and ${b.name} do not both have a ${field} field`);
    if (content.relations.some(r => r.field === field && ((r.from === from && r.to === to) || (r.from === to && r.to === from)))) return fail('relation_exists', `${a.name} and ${b.name} are already linked by ${field}`);
    return { ...content, relations: [...content.relations, { id: `rel-${from}-${to}-${field}`, from, to, field }] };
  },
  removeRelation(content, { relationId }) {
    if (!content.relations.some(r => r.id === relationId)) return fail('relation_missing', `No relationship ${relationId}`);
    return { ...content, relations: content.relations.filter(r => r.id !== relationId) };
  },
  confirmAssumption(content, { assumptionId }) {
    const a = content.assumptions.find(x => x.id === assumptionId);
    if (!a || a.kind !== 'behavior') return fail('assumption_missing', `No behavior assumption ${assumptionId}`);
    return { ...content, assumptions: content.assumptions.map(x => x.id === assumptionId ? { ...x, state: 'confirmed' } : x) };
  },
  importFixture(content, { content: imported }) {
    return clone(imported);
  },
  batch(content, { commands }) {
    let next = content;
    for (const command of commands) {
      next = runCommand(next, command);
      if (next.error) return next;
    }
    return next;
  },
});

/** One command over draft content, normalised. Returns new content or { error }. */
export function runCommand(content, command) {
  const fn = COMMANDS[command?.type];
  if (!fn) return fail('unknown_command', `Unknown command ${command?.type}`);
  const next = fn(content, command);
  return next.error ? next : syncDedupAssumptions(next);
}

const putDraft = (state, draft) => ({ ...state, environmentDrafts: { ...state.environmentDrafts, [draft.id]: draft } });

function lookup(state, draftId, expectedRevision) {
  const draft = state.environmentDrafts[draftId];
  if (!draft) return fail('draft_missing', `No environment draft ${draftId}`);
  if (expectedRevision != null && expectedRevision !== draft.revision) return fail('draft_stale', 'The draft changed since this edit started. Review it and try again.');
  return { draft };
}

/** Commits content as one undoable step. Returns the same draft when nothing changed. */
export function commitContent(draft, content) {
  if (digestOf(content) === digestOf(contentOf(draft))) return draft;
  return { ...draft, ...content, revision: draft.revision + 1, history: { past: [...draft.history.past, contentOf(draft)].slice(-HISTORY_LIMIT), future: [] } };
}

export function applyEnvironmentCommand(state, { draftId, command, expectedRevision }) {
  const { draft, error } = lookup(state, draftId, expectedRevision);
  if (error) return { error };
  const content = runCommand(contentOf(draft), command);
  if (content.error) return content;
  const next = commitContent(draft, content);
  return { state: next === draft ? state : putDraft(state, next) };
}

export function undoEnvironment(state, { draftId }) {
  const { draft, error } = lookup(state, draftId);
  if (error) return { error };
  const past = draft.history.past;
  if (!past.length) return fail('nothing_to_undo', 'Nothing to undo');
  return { state: putDraft(state, { ...draft, ...past.at(-1), revision: draft.revision + 1, history: { past: past.slice(0, -1), future: [contentOf(draft), ...draft.history.future] } }) };
}

export function redoEnvironment(state, { draftId }) {
  const { draft, error } = lookup(state, draftId);
  if (error) return { error };
  const [next, ...rest] = draft.history.future;
  if (!next) return fail('nothing_to_redo', 'Nothing to redo');
  return { state: putDraft(state, { ...draft, ...next, revision: draft.revision + 1, history: { past: [...draft.history.past, contentOf(draft)].slice(-HISTORY_LIMIT), future: rest } }) };
}

export function validateEnvironmentDraft(state, { draftId }) {
  const { draft, error } = lookup(state, draftId);
  if (error) return { error };
  return { state: putDraft(state, { ...draft, validation: validateEnvironment(draft) }) };
}

export function appendChat(state, { draftId, turns }) {
  const { draft, error } = lookup(state, draftId);
  if (error) return { error };
  return { state: putDraft(state, { ...draft, chat: [...draft.chat, ...turns] }) };
}

const SHORT = {
  permission: { read_only: 'read only', read_write: 'read and write', send_requires_approval: 'send requires approval' },
  failureBehavior: { timeout_after_send: 'timeout enabled', none: 'timeout disabled' },
  dedup: { none: 'deduplication off', idempotency_key: 'idempotency key deduplication', custom_adapter: 'custom adapter deduplication' },
};

/** Human-readable field changes between two contents, for the assistant's reply and the undo announcement. */
export function describeChanges(before, after) {
  const out = [];
  if (before.name !== after.name) out.push(`Environment name: ${after.name}`);
  const byId = list => new Map(list.map(c => [c.id, c]));
  const was = byId(before.components), now = byId(after.components);
  for (const [id, c] of was) if (!now.has(id)) out.push(`Removed ${c.name}`);
  for (const [id, c] of now) {
    const old = was.get(id);
    if (!old) { out.push(`Added ${c.name}`); continue; }
    if (old.name !== c.name) out.push(`${old.name}: renamed to ${c.name}`);
    for (const key of ['permission', 'failureBehavior', 'dedup']) if (old[key] !== c[key]) out.push(`${c.name}: ${SHORT[key][c[key]]}`);
    for (const t of c.enabledTools) if (!old.enabledTools.includes(t)) out.push(`${c.name}: ${t} enabled`);
    for (const t of old.enabledTools) if (!c.enabledTools.includes(t)) out.push(`${c.name}: ${t} disabled`);
  }
  const nameOf = id => (now.get(id) ?? was.get(id))?.name ?? id;
  for (const r of before.relations) if (!after.relations.some(x => x.id === r.id)) out.push(`Unlinked ${nameOf(r.from)} and ${nameOf(r.to)} (${r.field})`);
  for (const r of after.relations) if (!before.relations.some(x => x.id === r.id)) out.push(`Linked ${nameOf(r.from)} and ${nameOf(r.to)} by ${r.field}`);
  for (const a of after.assumptions) {
    const old = before.assumptions.find(x => x.id === a.id);
    if (old && old.state !== a.state && a.state === 'confirmed') out.push(`Confirmed: ${a.text}`);
  }
  return out;
}
