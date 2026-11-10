// Every number and list the screens show, derived from GymState in one place.
import { ATTEMPT_STATUS, REVIEW_LABEL, refKey, sameRef, uniqueIds } from './model.js';
import { compareAttempt, objectiveComparison } from './metrics.js';
import { validateExperiment } from './validators.js';
import { versionModelConfig } from './simulation/executor.js';
import { experimentAttempts, triggerOf } from './simulation/attempts.js';
import { sharedAcceptance } from './runs/impact.js';

const STATUS_RANK = { running: 0, queued: 1 };
const FAULT_MARKER = { timeout_after_send: 'Timeout injection' };

export const attemptProgress = (state, attemptId) => {
  const attempt = state.attempts[attemptId];
  const done = (state.executions[attemptId] ?? []).length;
  const total = attempt.plan.length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0, text: `${done}/${total}` };
};

/** Queue rows: running first, then queued in queue order, then finished attempts newest first. */
export function queueRows(state) {
  const rows = state.attemptOrder.map((id, index) => {
    const a = state.attempts[id];
    const { environment, scenarios } = a.inputSnapshot;
    return {
      attemptId: id, experimentId: a.experimentId, title: a.title, label: a.label,
      environmentName: environment.name, environmentIcon: environment.icon, scenarioCount: scenarios.length,
      trigger: triggerOf(a), impactOf: a.impactOf ?? null, status: a.status, runner: a.runner, paused: a.runner === 'paused' && (a.status === 'queued' || a.status === 'running'),
      progress: attemptProgress(state, id), result: attemptResultSummary(state, id), review: a.review, canViewResults: a.status === 'completed' || a.status === 'cancelled' || a.status === 'failed', index,
    };
  });
  return rows.sort((x, y) => (STATUS_RANK[x.status] ?? 2) - (STATUS_RANK[y.status] ?? 2)
    || ((STATUS_RANK[x.status] ?? 2) === 2 ? y.index - x.index : x.index - y.index));
}

export function queueCounts(state) {
  const counts = Object.fromEntries(ATTEMPT_STATUS.map(s => [s, 0]));
  for (const id of state.attemptOrder) counts[state.attempts[id].status] += 1;
  return { ...counts, total: state.attemptOrder.length };
}

export const attemptsByStatus = (state, status = 'all', trigger = 'all') =>
  queueRows(state).filter(r => (status === 'all' || r.status === status) && (trigger === 'all' || r.trigger.kind === trigger));

export function experimentSummary(state, experimentId) {
  const exp = state.experiments[experimentId];
  const report = validateExperiment(state, experimentId);
  const versions = exp.variantId ? 2 : 1;
  const scenarios = selectedScenarioIds(state, experimentId).length;
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  return {
    title: exp.title, number: exp.number, draftRevision: exp.draftRevision, savedRevision: exp.savedRevision,
    dirty: exp.savedRevision !== exp.draftRevision,
    versions, selectedScenarioCount: scenarios, repetitions: exp.repetitions,
    runs: report.executionCount, pairs: report.pairCount,
    formula: `${plural(versions, 'version')} × ${plural(scenarios, 'scenario')} × ${plural(exp.repetitions, 'repetition')} = ${plural(report.executionCount, 'run')}`,
  };
}

/** The selected ids that belong to the current set, in set order. One source for "3 selected" and "3 scenarios". */
export function selectedScenarioIds(state, experimentId) {
  const exp = state.experiments[experimentId];
  const set = state.scenarioSets[refKey(exp.scenarioSetRef)];
  const chosen = new Set(uniqueIds(exp.selectedScenarioIds));
  return (set?.scenarioRefs ?? []).map(r => r.id).filter(id => chosen.has(id));
}

export function dependencyStatus(state, experimentId) {
  const report = validateExperiment(state, experimentId);
  return {
    matched: report.dependencyReport.matched, missing: report.dependencyReport.missing,
    label: report.dependencyReport.matched ? 'Dependencies matched' : report.dependencyReport.missing.length ? `Missing: ${report.dependencyReport.missing.join(', ')}` : 'Dependencies not checked',
    canRun: report.errors.length === 0, errors: report.errors, warnings: report.warnings,
  };
}

export function environmentCards(state, { query = '', selectedRef = null } = {}) {
  const q = query.trim().toLowerCase();
  return Object.values(state.environments).map(e => ({
    key: refKey(e), ref: { id: e.id, rev: e.rev }, name: e.name, rev: e.rev, icon: e.icon, caps: e.caps, notes: e.notes,
    ready: e.validation.status === 'validated', statusLabel: e.validation.status === 'validated' ? 'Ready' : 'Needs review',
    selected: !!selectedRef && sameRef(selectedRef, e),
    visible: !q || [e.name, ...e.caps].some(t => t.toLowerCase().includes(q)),
  }));
}

export function scenarioRows(state, setRef, { selectedIds = [], query = '' } = {}) {
  const set = state.scenarioSets[refKey(setRef)];
  const q = query.trim().toLowerCase();
  return (set?.scenarioRefs ?? []).map(r => {
    const s = state.scenarios[refKey(r)];
    return {
      id: s.id, rev: s.rev, title: s.title, selected: selectedIds.includes(s.id), visible: !q || s.title.toLowerCase().includes(q),
      initialState: s.initialState.summary, expected: s.expectedBehavior.summary, reviewState: s.reviewState, badge: s.badge,
      overrides: s.overrides.map(o => o.label),
    };
  });
}

/** The blueprint for one version: which nodes the variant changed and which carry a fault marker for the selection. */
export function blueprintView(state, experimentId, versionId) {
  const exp = state.experiments[experimentId];
  const workflow = state.workflows[refKey(exp.workflowRef)];
  const variant = exp.variantId ? state.variants[exp.variantId] : null;
  const showVariant = versionId === 'variant' && !!variant;
  const config = versionModelConfig({ workflow, variant }, showVariant ? 'variant' : 'baseline');
  const setRefs = state.scenarioSets[refKey(exp.scenarioSetRef)]?.scenarioRefs ?? [];
  const selected = selectedScenarioIds(state, experimentId).map(id => state.scenarios[refKey(setRefs.find(r => r.id === id))]);
  const environment = state.environments[refKey(exp.environmentRef)];
  const faultsByCapability = {};
  for (const s of selected) for (const o of s.overrides.filter(x => x.kind === 'fault')) {
    const component = environment?.components.find(c => c.id === o.target.split('.')[0]);
    if (component) faultsByCapability[`${component.kind}.${o.target.split('.')[1]}`] = FAULT_MARKER[o.value] ?? o.label;
  }
  return {
    workflowName: workflow.name, source: workflow.source, versionId: showVariant ? 'variant' : 'baseline',
    versionLabel: showVariant ? variant.name : 'Baseline', changedNodeIds: showVariant ? variant.changedNodeIds : [],
    nodes: workflow.nodes.map(n => ({
      ...n, changed: showVariant && variant.changedNodeIds.includes(n.id),
      faultMarker: (n.capability && faultsByCapability[n.capability]) ?? null,
      model: config[n.id]?.model ?? null, traits: config[n.id]?.traits ?? null,
    })),
    edges: workflow.edges,
  };
}

export const comparisonFor = (state, attemptId) => compareAttempt(state.attempts[attemptId], state.executions[attemptId] ?? []);

export const STAGES = Object.freeze(['pending', 'queued', 'running', 'needs_review', 'done']);

// Cancelled and failed attempts are abandoned work: they never decide a stage, so an experiment with nothing else behind
// it reads pending and offers Configure again.
const STAGE_ATTEMPT = ['queued', 'running', 'completed'];

/** The attempt that decides an experiment's stage: its latest queued, running or completed one, or null. */
export const stageAttempt = (state, experimentId) => experimentAttempts(state, experimentId)
  .filter(a => STAGE_ATTEMPT.includes(a.status)).at(-1) ?? null;

// Read top to bottom; the first rule that holds decides the stage. `a` is the stage attempt.
const STAGE_RULES = [
  [a => !a, 'pending'],
  [a => a.status === 'queued', 'queued'],
  [a => a.status === 'running', 'running'],
  [a => !a.review, 'needs_review'],
  [() => true, 'done'],
];

/** @returns {'pending'|'queued'|'running'|'needs_review'|'done'} */
export const experimentStage = (state, experimentId) => {
  const attempt = stageAttempt(state, experimentId);
  return STAGE_RULES.find(([holds]) => holds(attempt))[1];
};

/** The recorded review of the stage attempt, or null. */
export function experimentOutcome(state, experimentId) {
  const review = stageAttempt(state, experimentId)?.review;
  return review ? { decision: review.decision, label: REVIEW_LABEL[review.decision] } : null;
}

/** @returns {{ passed: boolean, checks: { id: string, label: string, passed: boolean, detail: string }[] }}  the shared-agents check also carries `state` and `runs` */
export function acceptanceVerdict(state, attemptId) {
  const attempt = state.attempts[attemptId];
  const { acceptance } = attempt.inputSnapshot.experiment;
  const cmp = comparisonFor(state, attemptId);
  const objective = objectiveComparison(attempt, state.executions[attemptId] ?? []);
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const checks = [
    { id: 'complete', label: 'Every pair finished', passed: cmp.verdict !== 'inconclusive', detail: `${cmp.completePairs} of ${plural(cmp.expectedPairs, 'pair')} complete` },
    acceptance.noRegression && { id: 'no-regression', label: 'No regressed pairs', passed: cmp.regressedPairs === 0, detail: `${cmp.regressedPairs} regressed` },
    acceptance.minImprovedPairs > 0 && { id: 'min-improved', label: `At least ${plural(acceptance.minImprovedPairs, 'improved pair')}`, passed: cmp.improvedPairs >= acceptance.minImprovedPairs, detail: `${cmp.improvedPairs} improved` },
    { id: 'objective', label: `${objective.label} no worse than baseline`, passed: objective.met, detail: `${objective.baselineText} → ${objective.variantText}` },
    sharedAcceptance(state, attempt),
  ].filter(Boolean);
  return { passed: checks.every(c => c.passed), checks };
}

/** One line on how a completed attempt turned out, or null while it has no finished comparison. */
export function attemptResultSummary(state, attemptId) {
  const attempt = state.attempts[attemptId];
  if (attempt.status !== 'completed') return null;
  const cmp = comparisonFor(state, attemptId);
  const objective = objectiveComparison(attempt, state.executions[attemptId] ?? []);
  const verdict = acceptanceVerdict(state, attemptId);
  const shared = verdict.checks.find(c => c.id === 'shared-agents' && c.state === 'failed');
  return {
    text: `${objective.label} ${objective.baselineText} → ${objective.variantText} · ${cmp.improvedPairs} improved · ${cmp.regressedPairs} regressed${shared ? ` · shared workflows: ${shared.regressedPairs} regressed` : ''}`,
    tone: verdict.passed ? 'green' : cmp.regressedPairs > 0 || shared ? 'red' : 'amber',
  };
}

/** The result line of the attempt that decides the experiment's stage, or null. */
export function experimentResultSummary(state, experimentId) {
  const attempt = stageAttempt(state, experimentId);
  return attempt && attemptResultSummary(state, attempt.id);
}
