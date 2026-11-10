// Workbench-only selectors: pure functions over GymState and the route query. No DOM.
import { refKey } from '../model.js';
import { dependencyStatus, selectedScenarioIds } from '../selectors.js';
import { versionModelConfig } from '../simulation/executor.js';

const FAULT_MARKER = { timeout_after_send: 'Timeout injection' };

// Which workflow capability a scenario check observes, so a node lists only the checks that read its effect.
const CHECK_CAPABILITY = {
  'outbox.count': 'email.send_email', 'outbox.countBeforeApproval': 'email.send_email', 'outbox.duplicates': 'email.send_email',
  'crm.updates': 'crm.update_opportunity', 'crm.skipReasons': 'crm.log_activity', 'crm.activities': 'crm.log_activity',
  'calendar.created': 'calendar.create_event', 'payments.refunds': 'payments.issue_refund',
  'tickets.replies': 'tickets.reply_to_ticket', 'tickets.skipReasons': 'tickets.update_ticket',
};

const experimentOf = (state, experimentId) => state.experiments[experimentId];
const workflowOf = (state, exp) => state.workflows[refKey(exp.workflowRef)];
const variantOf = (state, exp) => (exp.variantId ? state.variants[exp.variantId] ?? null : null);

export function selectedScenarios(state, experimentId) {
  const exp = experimentOf(state, experimentId);
  const refs = state.scenarioSets[refKey(exp.scenarioSetRef)]?.scenarioRefs ?? [];
  return selectedScenarioIds(state, experimentId).map(id => state.scenarios[refKey(refs.find(r => r.id === id))]);
}

/** The version the blueprint shows. Variant A by default when it exists, as in N1. */
export function viewedVersion(state, experimentId, query) {
  return variantOf(state, experimentOf(state, experimentId)) && query.version !== 'baseline' ? 'variant' : 'baseline';
}

/** The node the strip describes: the query's node when the workflow has it, else the first changed or model node. */
export function selectedNodeId(state, experimentId, query) {
  const exp = experimentOf(state, experimentId);
  const { nodes } = workflowOf(state, exp);
  if (nodes.some(n => n.id === query.node)) return query.node;
  const changed = variantOf(state, exp)?.changedNodeIds ?? [];
  return (nodes.find(n => changed.includes(n.id)) ?? nodes.find(n => n.kind === 'model') ?? nodes[0]).id;
}

const configText = cfg => (cfg ? [cfg.model, ...Object.entries(cfg.traits ?? {}).map(([k, v]) => `${k}: ${v}`)].join(' · ') : null);

function configRows(baseline, variant) {
  if (!baseline && !variant) return [];
  const keys = [...new Set([...Object.keys(baseline?.traits ?? {}), ...Object.keys(variant?.traits ?? {})])];
  return [
    { key: 'model', baseline: baseline?.model ?? '—', variant: variant?.model ?? '—' },
    ...keys.map(key => ({ key, baseline: baseline?.traits?.[key] ?? '—', variant: variant?.traits?.[key] ?? '—' })),
  ].map(row => ({ ...row, changed: row.baseline !== row.variant }));
}

/** Everything the strip and the Inspect step dialog say about one node, for one version. */
export function nodeDetail(state, experimentId, versionId, nodeId) {
  const exp = experimentOf(state, experimentId);
  const workflow = workflowOf(state, exp);
  const variant = variantOf(state, exp);
  const environment = state.environments[refKey(exp.environmentRef)];
  const node = workflow.nodes.find(n => n.id === nodeId);
  const available = new Set([...(environment?.capabilities ?? []), ...(environment?.faultCapabilities ?? [])]);
  const showVariant = versionId === 'variant' && !!variant;
  const baselineConfig = versionModelConfig({ workflow, variant }, 'baseline')[node.id] ?? null;
  const variantConfig = variant ? versionModelConfig({ workflow, variant }, 'variant')[node.id] ?? null : null;
  const config = showVariant ? variantConfig : baselineConfig;
  const changed = showVariant && variant.changedNodeIds.includes(node.id);
  const scenarios = selectedScenarios(state, experimentId);
  return {
    id: node.id, label: node.label, kind: node.kind, chip: node.chip,
    versionLabel: showVariant ? variant.name : 'Baseline',
    title: `${node.label} · ${showVariant ? variant.name : 'Baseline'}`,
    change: changed ? 'model configuration' : null,
    dependencies: [node.capability, node.statusCapability].filter(Boolean).map(capability => ({ capability, matched: available.has(capability) })),
    environmentLabel: environment ? `${environment.name} v${environment.rev}` : refKey(exp.environmentRef),
    inputs: node.inputs, outputs: node.outputs,
    config, configText: configText(config),
    diff: changed || (variant && node.kind === 'model') ? configRows(baselineConfig, variantConfig) : [],
    checks: scenarios.flatMap(s => s.stateChecks.filter(c => node.capability && CHECK_CAPABILITY[c.path] === node.capability).map(c => ({ scenario: s.title, label: c.label }))),
    faults: scenarios.flatMap(s => s.overrides.filter(o => o.kind === 'fault' && faultCapability(environment, o) === node.capability).map(o => ({ scenario: s.title, label: o.label }))),
  };
}

const faultCapability = (environment, override) => {
  const [componentId, tool] = override.target.split('.');
  const component = environment?.components.find(c => c.id === componentId);
  return component ? `${component.kind}.${tool}` : null;
};

/** Node-level diff of the baseline against the variant, every node listed. */
export function nodeDiff(state, experimentId) {
  const exp = experimentOf(state, experimentId);
  const workflow = workflowOf(state, exp);
  const variant = variantOf(state, exp);
  if (!variant) return null;
  const base = versionModelConfig({ workflow, variant }, 'baseline');
  const next = versionModelConfig({ workflow, variant }, 'variant');
  const rows = workflow.nodes.map(n => ({ id: n.id, label: n.label, chip: n.chip, changed: variant.changedNodeIds.includes(n.id), fields: configRows(base[n.id], next[n.id]) }));
  return { workflowName: workflow.name, variantName: variant.name, rows, changedCount: rows.filter(r => r.changed).length };
}

/** "Editing rev 4" plus the frozen revision the queue is running or holding for this experiment. */
export function revisionNote(state, experimentId) {
  const exp = experimentOf(state, experimentId);
  const live = state.attemptOrder.map(id => state.attempts[id]).filter(a => a.experimentId === experimentId && (a.status === 'running' || a.status === 'queued'));
  const shown = live.find(a => a.status === 'running') ?? live.at(-1);
  return { editing: `Editing rev ${exp.draftRevision}`, frozen: shown ? `${shown.label} is ${shown.status} in the queue` : null, attemptId: shown?.id ?? null };
}

/**
 * The idempotency key for Run. It stays the same while an attempt for this draft revision is queued or running, so a
 * double click enqueues one attempt, and moves on once that attempt is finished or cancelled, so a deliberate re-run
 * enqueues a new one.
 */
export function runKey(state, experimentId) {
  const rev = experimentOf(state, experimentId).draftRevision;
  const finished = Object.values(state.attempts).filter(a => a.experimentId === experimentId
    && a.inputSnapshot.experiment.draftRevision === rev && a.status !== 'queued' && a.status !== 'running').length;
  return `wb-${experimentId}-r${rev}${finished ? `-${finished}` : ''}`;
}
export const attemptByKey = (state, key) => Object.values(state.attempts).find(a => a.idempotencyKey === key) ?? null;

/** Missing dependencies, split into workflow tools and the fault hooks selected scenarios inject. */
export function missingDependencies(state, experimentId) {
  const exp = experimentOf(state, experimentId);
  const required = new Set(workflowOf(state, exp)?.requiredCapabilities ?? []);
  return dependencyStatus(state, experimentId).missing.map(capability => ({ capability, kind: required.has(capability) ? 'tool' : 'fault' }));
}

export function scenarioBuilderQuery(state, experimentId, extra = {}) {
  const exp = experimentOf(state, experimentId);
  return { environment: refKey(exp.environmentRef), workflow: exp.workflowRef.id, ...extra };
}

/** Diagram nodes for a frozen attempt snapshot, so a replay draws the workflow that ran, not today's draft. */
export function snapshotBlueprint(snapshot, versionId, scenarioId) {
  const changed = versionId === 'variant' ? snapshot.variant?.changedNodeIds ?? [] : [];
  const scenario = snapshot.scenarios.find(s => s.id === scenarioId);
  const faults = Object.fromEntries((scenario?.overrides ?? []).filter(o => o.kind === 'fault')
    .map(o => [faultCapability(snapshot.environment, o), FAULT_MARKER[o.value] ?? o.label]));
  return {
    nodes: snapshot.workflow.nodes.map(n => ({ ...n, changed: changed.includes(n.id), faultMarker: (n.capability && faults[n.capability]) ?? null })),
    edges: snapshot.workflow.edges,
  };
}

const clampInt = (text, min, max, fallback) => {
  const n = Number.parseInt(text, 10);
  return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** The recorded execution a replay shows, chosen by attempt, version, scenario and repetition, with safe fallbacks. */
export function replayView(state, experimentId, query, versionId) {
  const attempts = state.attemptOrder.map(id => state.attempts[id])
    .filter(a => a.experimentId === experimentId && (state.executions[a.id] ?? []).length > 0).reverse();
  if (!attempts.length) return null;
  const attempt = attempts.find(a => a.id === query.attempt) ?? attempts[0];
  const executions = state.executions[attempt.id];
  const wanted = { versionId, scenarioId: query.scenario, repeatIndex: clampInt(query.rep, 1, 99, 1) };
  const matches = keys => executions.find(e => keys.every(k => e[k] === wanted[k]));
  const execution = matches(['versionId', 'scenarioId', 'repeatIndex']) ?? matches(['versionId', 'scenarioId']) ?? matches(['scenarioId'])
    ?? matches(['versionId']) ?? executions[0];
  const snapshot = attempt.inputSnapshot;
  const step = clampInt(query.step, 1, execution.events.length, 1);
  const visited = [...new Set(execution.events.map(e => e.nodeId).filter(Boolean))];
  return {
    attempts: attempts.map(a => ({ id: a.id, label: a.label, recorded: state.executions[a.id].length, planned: a.plan.length })),
    attemptId: attempt.id, experimentId,
    versions: ['baseline', 'variant'].filter(v => executions.some(e => e.versionId === v)).map(v => ({ id: v, label: v === 'variant' ? snapshot.variant?.name ?? 'Variant' : 'Baseline' })),
    scenarios: snapshot.scenarios.map(s => ({ id: s.id, label: s.title, recorded: executions.some(e => e.scenarioId === s.id) })),
    reps: [...new Set(executions.filter(e => e.scenarioId === execution.scenarioId && e.versionId === execution.versionId).map(e => e.repeatIndex))],
    execution, events: execution.events, step, visited,
    currentNodeId: execution.events[step - 1]?.nodeId || null,
    scenarioTitle: snapshot.scenarios.find(s => s.id === execution.scenarioId)?.title ?? execution.scenarioId,
    versionLabel: execution.versionId === 'variant' ? snapshot.variant?.name ?? 'Variant' : 'Baseline',
    blueprint: snapshotBlueprint(snapshot, execution.versionId, execution.scenarioId),
  };
}
