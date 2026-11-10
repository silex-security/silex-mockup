// Shared-agent impact ("blast radius"). A variant changes how one agent behaves at one step. An agent that also works in
// other workflows takes the change with it, so each such workflow is checked: its current revision against the same
// revision with the experiment's field changes applied to that agent's steps, over that workflow's default scenario set.
// The check runs through the ordinary freeze, plan, execute and compare path as `change` attempts that carry `impactOf`.
// Nothing here is stored except those attempts; the plan and every count are derived. Pure.
import { clone, digestOf, refKey, sameRef } from '../model.js';
import { compareAttempt } from '../metrics.js';
import { validateExperiment } from '../validators.js';
import { buildVariant } from '../fixtures/workflows.js';
import { versionModelConfig } from '../simulation/executor.js';
import { freezeAttempt, queueAttempt } from '../simulation/attempts.js';
import { changeSetOf } from '../workbench/changes.js';

export const IMPACT_REPETITIONS = 1;
const LIVE = ['queued', 'running'];
const KEPT = [...LIVE, 'completed'];
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const names = (state, agentIds) => agentIds.map(id => state.agents[id]?.name ?? id);

const latestRevisions = state => {
  const best = new Map();
  for (const w of Object.values(state.workflows)) if (!best.has(w.id) || Number(w.rev) > Number(best.get(w.id).rev)) best.set(w.id, w);
  return [...best.values()];
};

/** The agents a variant changes, with the fields that differ, in the order the What changes strip lists them. */
export function changedAgents(workflow, variant) {
  const byAgent = new Map();
  for (const row of changeSetOf(workflow, variant)?.rows.filter(r => r.changed) ?? []) {
    const entry = byAgent.get(row.agentId) ?? { agentId: row.agentId, fields: {} };
    entry.fields[row.field] ??= { baseline: row.baseline, variant: row.variant };
    byAgent.set(row.agentId, entry);
  }
  return [...byAgent.values()];
}

const hasField = (config, field) => (field === 'model' ? !!config?.model : config?.traits?.[field] !== undefined);

function workflowPlan(state, other, agents, origin) {
  const touched = agents.map(a => ({ agent: a, steps: other.nodes.filter(n => n.agentId === a.agentId) })).filter(t => t.steps.length);
  if (!touched.length) return null;
  const ref = { id: other.id, rev: other.rev };
  const base = { workflowId: other.id, name: other.name, ref, agentIds: touched.map(t => t.agent.agentId), steps: touched.flatMap(t => t.steps.map(n => n.label)) };
  const notComparable = reason => ({ ...base, comparable: false, reason });

  const config = versionModelConfig({ workflow: other, variant: null }, 'baseline');
  const applied = {};
  const missing = [];
  for (const { agent, steps } of touched) {
    const lacking = Object.keys(agent.fields).filter(field => !steps.some(n => hasField(config[n.id], field)));
    if (lacking.length) missing.push(`${steps.map(n => n.label).join(', ')} ${steps.length === 1 ? 'has' : 'have'} no ${lacking.join(' or ')} setting`);
    for (const [field, change] of Object.entries(agent.fields)) {
      for (const n of steps.filter(step => hasField(config[step.id], field))) {
        const next = applied[n.id] ??= clone(config[n.id]);
        if (field === 'model') next.model = change.variant; else next.traits[field] = change.variant;
      }
    }
  }
  if (missing.length) return notComparable(`${missing.join('; ')}, so the change cannot be applied there`);
  const patch = Object.entries(applied).filter(([id, next]) => digestOf(next) !== digestOf(config[id])).map(([nodeId, next]) => ({ nodeId, model: next.model, traits: next.traits }));
  if (!patch.length) return notComparable(`${base.steps.join(', ')} already use${base.steps.length === 1 ? 's' : ''} these settings`);

  const set = Object.values(state.scenarioSets).find(s => sameRef(s.workflowRef, ref));
  if (!set) return notComparable(`${other.name} has no scenario set to run`);
  const variant = buildVariant(other, { id: `${other.id}-impact-${origin.id}`, name: 'Shared-agent change', patch });
  const experiment = {
    id: `${origin.id}-impact-${other.id}`, number: 0, title: `${other.name} · shared-agent check`, draftRevision: 1, savedRevision: 1,
    workflowRef: ref, variantId: variant.id, environmentRef: { ...set.environmentRef }, scenarioSetRef: { id: set.id, rev: set.rev },
    selectedScenarioIds: set.scenarioRefs.map(r => r.id), repetitions: IMPACT_REPETITIONS, objective: origin.objective,
    acceptance: { noRegression: true, minImprovedPairs: 0, noSharedRegression: false },
    source: { kind: 'manual', label: `Shared-agent check for ${origin.id}`, ref: null },
  };
  const draft = { ...state, experiments: { ...state.experiments, [experiment.id]: experiment }, variants: { ...state.variants, [variant.id]: variant } };
  const { errors, executionCount } = validateExperiment(draft, experiment.id);
  if (errors.length) return notComparable(errors[0].message);
  return { ...base, comparable: true, reason: null, runs: executionCount, set: { id: set.id, rev: set.rev, name: set.name }, variant, experiment };
}

const plans = new WeakMap();

/**
 * The impact of changing `variant` on `workflow`, for the experiment `origin` (an object with id and objective).
 * @returns {{ change: string, agents: object[], workflows: object[] }} `change` identifies the field changes; `workflows` has one entry per other workflow.
 */
export function impactPlan(state, workflow, variant, origin) {
  const key = `${origin.id}|${refKey(workflow)}|${variant?.digest ?? ''}`;
  const cache = plans.get(state) ?? plans.set(state, new Map()).get(state);
  if (cache.has(key)) return cache.get(key);
  const agents = changedAgents(workflow, variant);
  const workflows = latestRevisions(state).filter(w => w.id !== workflow.id).map(w => workflowPlan(state, w, agents, origin)).filter(Boolean);
  const plan = { change: digestOf(agents.map(a => [a.agentId, a.fields])), agents, workflows };
  cache.set(key, plan);
  return plan;
}

const subjectOf = (state, experimentId) => {
  const exp = state.experiments[experimentId];
  return exp && { exp, workflow: state.workflows[refKey(exp.workflowRef)], variant: exp.variantId ? state.variants[exp.variantId] ?? null : null };
};

/**
 * Which other workflows the agents changed by the experiment's variant also work in. Built from the change set the What
 * changes strip shows. An agent that works in no other workflow is left out.
 * @returns {{ agents: { agentId: string, name: string, changedFields: string[], workflows: { workflowId: string, name: string, steps: string[] }[] }[] }}
 */
export function sharedAgentImpact(state, experimentId) {
  const subject = subjectOf(state, experimentId);
  if (!subject?.variant) return { agents: [] };
  const plan = impactPlan(state, subject.workflow, subject.variant, subject.exp);
  const agents = plan.agents.map(a => ({
    agentId: a.agentId, name: state.agents[a.agentId]?.name ?? a.agentId, changedFields: Object.keys(a.fields),
    workflows: latestRevisions(state).filter(w => w.id !== subject.workflow.id).map(w => ({ workflowId: w.id, name: w.name, steps: w.nodes.filter(n => n.agentId === a.agentId).map(n => n.label) })).filter(w => w.steps.length),
  })).filter(a => a.workflows.length);
  return { agents };
}

/** The impact runs filed under an experiment for one change, oldest first. */
const impactAttemptsFor = (state, experimentId, change) =>
  state.attemptOrder.map(id => state.attempts[id]).filter(a => a.impactOf?.experimentId === experimentId && a.impactOf.change === change);

const attemptsOfWorkflow = (attempts, workflowId) => attempts.filter(a => a.inputSnapshot.workflow.id === workflowId);
const currentAttempt = attempts => attempts.filter(a => KEPT.includes(a.status)).at(-1) ?? attempts.at(-1) ?? null;

/** The impact runs for the experiment's current change, one row per other workflow the changed agents work in. */
export function impactRuns(state, experimentId) {
  const subject = subjectOf(state, experimentId);
  if (!subject?.variant) return [];
  const plan = impactPlan(state, subject.workflow, subject.variant, subject.exp);
  const attempts = impactAttemptsFor(state, experimentId, plan.change);
  return plan.workflows.map(w => {
    const row = { workflowId: w.workflowId, name: w.name, steps: w.steps, agentNames: names(state, w.agentIds), reason: w.reason, runs: w.comparable ? w.runs : 0, attemptId: null, status: null };
    if (!w.comparable) return { ...row, state: 'not_comparable' };
    const attempt = currentAttempt(attemptsOfWorkflow(attempts, w.workflowId));
    if (!attempt) return { ...row, state: 'not_run' };
    const done = (state.executions[attempt.id] ?? []).length;
    const progress = { done, total: attempt.plan.length, text: `${done}/${attempt.plan.length}` };
    const base = { ...row, attemptId: attempt.id, status: attempt.status, progress };
    if (attempt.status === 'completed') {
      const cmp = compareAttempt(attempt, state.executions[attempt.id] ?? []);
      return { ...base, state: 'done', improved: cmp.improvedPairs, regressed: cmp.regressedPairs, pairs: cmp.expectedPairs, tone: cmp.regressedPairs > 0 ? 'red' : 'green',
        resultText: `${cmp.improvedPairs} improved · ${cmp.regressedPairs} regressed of ${plural(cmp.expectedPairs, 'pair')}` };
    }
    if (LIVE.includes(attempt.status)) return { ...base, state: attempt.status };
    return { ...base, state: 'not_run', note: `The last check was ${attempt.status}` };
  });
}

/** How many impact runs the check comprises, counted apart from the experiment's own runs. */
export const impactRunCount = (state, experimentId) => impactRuns(state, experimentId).reduce((n, r) => n + r.runs, 0);

/** What the Check shared workflows button can do right now, and why not when it cannot. */
export function impactCheckState(state, experimentId) {
  const subject = subjectOf(state, experimentId);
  if (!subject?.variant) return { canRun: false, reason: 'Create Variant A first. Shared agents are read from what it changes.', toRun: 0 };
  const rows = impactRuns(state, experimentId);
  if (!rows.length) return { canRun: false, reason: 'The agents this variant changes work in no other workflow.', toRun: 0 };
  const comparable = rows.filter(r => r.state !== 'not_comparable');
  if (!comparable.length) return { canRun: false, reason: 'No other workflow can take this change. See the reasons below.', toRun: 0 };
  const toRun = comparable.filter(r => r.state === 'not_run').length;
  if (!toRun) return { canRun: false, reason: comparable.some(r => LIVE.includes(r.state)) ? 'The check is already queued or running.' : 'Already checked for this change.', toRun: 0 };
  return { canRun: true, reason: null, toRun };
}

/**
 * "Check shared workflows". Enqueues one impact run per comparable workflow that has none queued, running or completed
 * for this change. Asking again changes nothing, and a cancelled or failed run can be asked for again.
 */
export function checkSharedImpact(state, { experimentId }) {
  const subject = subjectOf(state, experimentId);
  if (!subject) return { error: { code: 'experiment_missing', message: `No experiment ${experimentId}` } };
  const plan = subject.variant && impactPlan(state, subject.workflow, subject.variant, subject.exp);
  const comparable = plan?.workflows.filter(w => w.comparable) ?? [];
  if (!comparable.length) {
    const why = plan?.workflows.length ? plan.workflows.map(w => `${w.name}: ${w.reason}`).join('; ') : 'No agent this variant changes works in another workflow';
    return { error: { code: 'impact_nothing_to_run', message: why } };
  }
  const trigger = { kind: 'change', label: `Shared agent change from ${experimentId}: ${names(state, plan.agents.map(a => a.agentId)).join(', ')}` };
  let next = state;
  for (const w of comparable) {
    const earlier = attemptsOfWorkflow(impactAttemptsFor(next, experimentId, plan.change), w.workflowId);
    if (earlier.some(a => KEPT.includes(a.status))) continue;
    const key = `impact-${experimentId}-${w.workflowId}@${w.ref.rev}-${plan.change}${earlier.length ? `-${earlier.length}` : ''}`;
    const draft = { ...next, experiments: { ...next.experiments, [w.experiment.id]: w.experiment }, variants: { ...next.variants, [w.variant.id]: w.variant } };
    const frozen = freezeAttempt(draft, w.experiment.id, key, trigger);
    next = queueAttempt(next, { ...frozen, experimentId, title: w.experiment.title, label: `Impact of ${experimentId}`, impactOf: { experimentId, change: plan.change } });
  }
  return { state: next };
}

/**
 * The acceptance check for an attempt's frozen change, read from the impact runs. Null when the rule is off or no
 * changed agent works elsewhere.
 * @returns {null | { id: string, label: string, passed: boolean, state: 'passed'|'failed'|'pending', detail: string, regressedPairs: number, runs: { attemptId: string, name: string }[] }}
 */
export function sharedAcceptance(state, attempt) {
  const { experiment, workflow, variant } = attempt.inputSnapshot;
  if (!experiment.acceptance?.noSharedRegression || !variant) return null;
  const plan = impactPlan(state, workflow, variant, { id: attempt.experimentId, objective: experiment.objective });
  if (!plan.workflows.length) return null;
  const check = (checkState, detail, extra = {}) => ({ id: 'shared-agents', label: 'No regression in workflows that share the agent', passed: checkState === 'passed', state: checkState, detail, regressedPairs: 0, runs: [], ...extra });
  const comparable = plan.workflows.filter(w => w.comparable);
  if (!comparable.length) return check('passed', 'No other workflow can take this change');
  const attempts = impactAttemptsFor(state, attempt.experimentId, plan.change);
  const current = comparable.map(w => currentAttempt(attemptsOfWorkflow(attempts, w.workflowId))).filter(a => a && KEPT.includes(a.status));
  const runs = current.map(a => ({ attemptId: a.id, name: a.inputSnapshot.workflow.name }));
  const finished = current.filter(a => a.status === 'completed');
  if (finished.length < comparable.length) {
    return check('pending', current.length ? `Running: ${finished.length} of ${plural(comparable.length, 'workflow')} finished` : 'Not run yet', { runs });
  }
  const regressed = finished.map(a => compareAttempt(a, state.executions[a.id] ?? []).regressedPairs);
  const total = regressed.reduce((n, r) => n + r, 0);
  const workflows = regressed.filter(r => r > 0).length;
  return total
    ? check('failed', `${plural(total, 'regressed pair')} in ${plural(workflows, 'workflow')}`, { regressedPairs: total, runs })
    : check('passed', `No regressed pair in ${plural(comparable.length, 'other workflow')}`, { runs });
}
