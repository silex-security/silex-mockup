// Every count and status the environment screens show, derived from a draft or a revision in one place.
import { deriveCapabilities } from '../fixtures/environments.js';
import { SALES_FOLLOW_UP, behaviourDigest } from './validate.js';
import { draftStatus } from './commands.js';

export const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

const currentReport = draft => draft.validation && draft.validation.digest === behaviourDigest(draft) ? draft.validation : null;

/** 'needs_review' while a behavior assumption about it is pending, 'invalid' while a current report blames it, else 'ready'. */
export function componentStatus(draft, component) {
  if (draft.assumptions.some(a => a.componentId === component.id && a.kind === 'behavior' && a.state === 'pending')) return 'needs_review';
  if (currentReport(draft)?.errors.some(e => e.componentId === component.id)) return 'invalid';
  return 'ready';
}

/** Systems, tools and relationships of any object with components and relations (a draft or a revision). */
export function shapeCounts(env) {
  const systems = env.components.length;
  const tools = env.components.reduce((n, c) => n + c.enabledTools.length, 0);
  const relationships = env.relations.length;
  return { systems, tools, relationships, text: `${plural(systems, 'system')} · ${plural(tools, 'tool')} · ${plural(relationships, 'relationship')}` };
}

export function draftSummary(draft) {
  const rows = draft.components.map(c => ({ id: c.id, name: c.name, app: c.app, toolCount: c.enabledTools.length, status: componentStatus(draft, c) }));
  const pending = draft.assumptions.filter(a => a.kind === 'behavior' && a.state === 'pending');
  const ids = new Set(draft.components.map(c => c.id));
  return {
    ...shapeCounts(draft), rows,
    ready: rows.filter(r => r.status === 'ready').length,
    pending: pending.length, pendingAssumptions: pending,
    status: draftStatus(draft), report: currentReport(draft), staleReport: !!draft.validation && !currentReport(draft),
    brokenRelations: draft.relations.filter(r => !ids.has(r.from) || !ids.has(r.to)),
    canUndo: draft.history.past.length > 0, canRedo: draft.history.future.length > 0,
  };
}

/** Which workflow step needs what, and which component provides it, for the Agent context explanations. */
export function agentContext(draft, req = SALES_FOLLOW_UP) {
  const provided = new Map(draft.components.flatMap(c => deriveCapabilities([c]).map(cap => [cap, c])));
  const needed = [...req.capabilities, ...req.faultCapabilities];
  const fault = new Map(draft.components.filter(c => c.failureBehavior !== 'none').map(c => [`${c.kind}.${c.failureBehavior}`, c]));
  return {
    workflow: req.name,
    dependencies: needed.map(cap => ({ capability: cap, component: (provided.get(cap) ?? fault.get(cap))?.name ?? null })),
    approvals: draft.components.filter(c => c.permission === 'send_requires_approval')
      .flatMap(c => c.tools.filter(t => t.effect === 'write' && c.enabledTools.includes(t.name)).map(t => ({ component: c.name, tool: t.name }))),
    writes: draft.components.flatMap(c => c.tools.filter(t => t.effect === 'write' && c.enabledTools.includes(t.name))
      .map(t => ({ component: c.name, tool: t.name, permission: c.permission, failureBehavior: c.failureBehavior, dedup: c.dedup }))),
  };
}
