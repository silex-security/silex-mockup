// Experiment draft edits, attempt freezing and the attempt lifecycle, as pure reducers:
// (state, command) -> { state } | { error }. Attempt status: queued -> running -> completed | cancelled | failed.
// `failed` is a runner or data fault (an 'error' execution, or a dispatch the scheduler caught), never a failed check.
// `runner` ('active' | 'paused') is a separate control: a paused running attempt still holds the one slot.
import { DEMO_SEED, FIXTURE_VERSION, REPETITIONS, REVIEW_DECISION, clone, digestOf, refKey, sameRef } from '../model.js';
import { validateExperiment } from '../validators.js';
import { buildVariant, defaultVariantPatch } from '../fixtures/workflows.js';
import { planExecutions, runExecution } from './executor.js';
import { compareAttempt } from '../metrics.js';
import { setRefsProblem } from '../integrity.js';

const fail = (code, message, fix) => ({ error: fix ? { code, message, fix } : { code, message } });

const deepFreeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(deepFreeze); }
  return value;
};

const ordered = state => state.attemptOrder.map(id => state.attempts[id]);
const LIVE = ['queued', 'running'];

export const MANUAL_TRIGGER = Object.freeze({ kind: 'manual', label: 'Manual run' });

/** Why an attempt was enqueued. Attempts saved before triggers existed read as manual runs. */
export const triggerOf = attempt => attempt.trigger ?? MANUAL_TRIGGER;

/** What a variant changes against its baseline: the changed steps and the kind of change. v1 variants patch model configuration only. */
export function variantChange(workflow, variant) {
  if (!variant) return null;
  const steps = variant.changedNodeIds.map(id => workflow?.nodes.find(n => n.id === id)?.label ?? id);
  const kind = 'Model configuration';
  return { steps, kind, text: `${kind} change on ${steps.join(', ')}` };
}

/** The trigger for a run that tests the experiment's variant as a change. */
export function changeTrigger(state, experimentId) {
  const exp = state.experiments[experimentId];
  const change = variantChange(state.workflows[refKey(exp.workflowRef)], exp.variantId ? state.variants[exp.variantId] : null);
  return change ? { kind: 'change', label: change.text } : MANUAL_TRIGGER;
}

/** The attempt the scheduler should advance next, or null. One running attempt at most, fixed queue order. */
export function runnableAttemptId(state) {
  const running = ordered(state).find(a => a.status === 'running');
  if (running) return running.runner === 'active' ? running.id : null;
  return ordered(state).find(a => a.status === 'queued' && a.runner === 'active')?.id ?? null;
}

const putAttempt = (state, attempt) => ({ ...state, attempts: { ...state.attempts, [attempt.id]: attempt } });

function releaseSlot(state) {
  if (ordered(state).some(a => a.status === 'running')) return state;
  const next = ordered(state).find(a => a.status === 'queued' && a.runner === 'active');
  return next ? putAttempt(state, { ...next, status: 'running' }) : state;
}

/** Deep-copies every revision the experiment uses into an immutable snapshot. */
export function freezeAttempt(state, experimentId, idempotencyKey, trigger = MANUAL_TRIGGER) {
  const exp = state.experiments[experimentId];
  const set = state.scenarioSets[refKey(exp.scenarioSetRef)];
  const snapshot = deepFreeze(clone({
    experiment: exp,
    workflow: state.workflows[refKey(exp.workflowRef)],
    variant: exp.variantId ? state.variants[exp.variantId] : null,
    environment: state.environments[refKey(exp.environmentRef)],
    scenarioSet: set,
    scenarios: set.scenarioRefs.filter(r => exp.selectedScenarioIds.includes(r.id)).map(r => state.scenarios[refKey(r)]),
    repetitions: exp.repetitions,
  }));
  const idOf = n => `attempt-${String(n).padStart(3, '0')}`;
  let seq = state.seq + 1;
  while (state.attempts[idOf(seq)]) seq += 1;
  const attemptNo = Object.values(state.attempts).filter(a => a.experimentId === experimentId).length + 1;
  return {
    id: idOf(seq), experimentId, title: exp.title,
    label: `rev ${exp.draftRevision} · attempt ${attemptNo}`, idempotencyKey,
    inputSnapshot: snapshot, inputDigest: digestOf(snapshot), seed: DEMO_SEED, fixtureVersion: FIXTURE_VERSION,
    plan: deepFreeze(planExecutions(snapshot)), cursor: 0, status: 'queued', runner: 'active', enqueuedSeq: seq, review: null,
    trigger: { ...trigger },
  };
}

function editDraft(state, experimentId, edit) {
  const exp = state.experiments[experimentId];
  if (!exp) return fail('experiment_missing', `No experiment ${experimentId}`);
  const next = edit(exp);
  if (next.error) return next;
  if (next === exp) return { state };
  return { state: { ...state, experiments: { ...state.experiments, [experimentId]: { ...next, draftRevision: exp.draftRevision + 1 } } } };
}

export function saveExperiment(state, { experimentId }) {
  const exp = state.experiments[experimentId];
  if (!exp) return fail('experiment_missing', `No experiment ${experimentId}`);
  if (exp.savedRevision === exp.draftRevision) return { state };
  return { state: { ...state, experiments: { ...state.experiments, [experimentId]: { ...exp, savedRevision: exp.draftRevision } } } };
}

export const renameExperiment = (state, { experimentId, title }) => editDraft(state, experimentId, exp => {
  const clean = String(title ?? '').trim();
  if (!clean || clean.length > 80) return fail('invalid_title', 'Title must be 1 to 80 characters');
  return clean === exp.title ? exp : { ...exp, title: clean };
});

export const setEnvironment = (state, { experimentId, environmentRef }) => editDraft(state, experimentId, exp => {
  if (!state.environments[refKey(environmentRef)]) return fail('environment_missing', `No environment ${refKey(environmentRef)}`);
  return sameRef(exp.environmentRef, environmentRef) ? exp : { ...exp, environmentRef: { ...environmentRef } };
});

export const setWorkflow = (state, { experimentId, workflowRef }) => editDraft(state, experimentId, exp => {
  if (!state.workflows[refKey(workflowRef)]) return fail('workflow_missing', `No workflow ${refKey(workflowRef)}`);
  if (sameRef(exp.workflowRef, workflowRef)) return exp;
  const variant = Object.values(state.variants).find(v => sameRef(v.workflowRef, workflowRef));
  return { ...exp, workflowRef: { ...workflowRef }, variantId: variant?.id ?? null };
});

export const setScenarioSet = (state, { experimentId, scenarioSetRef }) => editDraft(state, experimentId, exp => {
  const set = state.scenarioSets[refKey(scenarioSetRef)];
  if (!set) return fail('scenario_set_missing', `No scenario set ${refKey(scenarioSetRef)}`);
  const problem = setRefsProblem(state.scenarios, set.scenarioRefs);
  if (problem) return fail('scenario_set_invalid', `${set.name}: ${problem}`);
  return sameRef(exp.scenarioSetRef, scenarioSetRef) ? exp : { ...exp, scenarioSetRef: { ...scenarioSetRef }, selectedScenarioIds: set.scenarioRefs.map(r => r.id) };
});

export const toggleScenario = (state, { experimentId, scenarioId }) => editDraft(state, experimentId, exp => {
  const set = state.scenarioSets[refKey(exp.scenarioSetRef)];
  if (!set?.scenarioRefs.some(r => r.id === scenarioId)) return fail('scenario_not_in_set', `${scenarioId} is not in the current set`);
  const on = exp.selectedScenarioIds.includes(scenarioId);
  const selected = on ? exp.selectedScenarioIds.filter(id => id !== scenarioId) : set.scenarioRefs.map(r => r.id).filter(id => id === scenarioId || exp.selectedScenarioIds.includes(id));
  return { ...exp, selectedScenarioIds: selected };
});

export const clearScenarioSelection = (state, { experimentId }) =>
  editDraft(state, experimentId, exp => exp.selectedScenarioIds.length ? { ...exp, selectedScenarioIds: [] } : exp);

export const setRepetitions = (state, { experimentId, repetitions }) => editDraft(state, experimentId, exp => {
  if (!Number.isInteger(repetitions) || repetitions < REPETITIONS.min || repetitions > REPETITIONS.max)
    return fail('repetitions_out_of_range', `Repetitions must be ${REPETITIONS.min} to ${REPETITIONS.max}`);
  return repetitions === exp.repetitions ? exp : { ...exp, repetitions };
});

const variantOf = (state, workflowRef) => Object.values(state.variants).find(v => sameRef(v.workflowRef, workflowRef));

function withNewVariant(state, experimentId) {
  const exp = state.experiments[experimentId];
  const workflow = state.workflows[refKey(exp.workflowRef)];
  if (!workflow) return fail('workflow_missing', `No workflow ${refKey(exp.workflowRef)}`);
  const variant = buildVariant(workflow, { id: `${workflow.id}-variant-a`, name: 'Variant A', patch: defaultVariantPatch(workflow) });
  return editDraft({ ...state, variants: { ...state.variants, [variant.id]: variant } }, experimentId, e => ({ ...e, variantId: variant.id }));
}

/** "+ Variant A": selects the workflow's variant when one exists, creates it otherwise. */
export function createOrSelectVariant(state, { experimentId }) {
  const exp = state.experiments[experimentId];
  if (!exp) return fail('experiment_missing', `No experiment ${experimentId}`);
  const existing = variantOf(state, exp.workflowRef);
  return existing ? editDraft(state, experimentId, e => e.variantId === existing.id ? e : { ...e, variantId: existing.id }) : withNewVariant(state, experimentId);
}

/** Adding a second variant is the demo limit: a typed error, never a duplicate. */
export function addVariant(state, { experimentId }) {
  const exp = state.experiments[experimentId];
  if (!exp) return fail('experiment_missing', `No experiment ${experimentId}`);
  if (variantOf(state, exp.workflowRef)) return fail('variant_limit', 'This demo compares the baseline with one variant', { label: 'Select Variant A', action: 'create-variant' });
  return withNewVariant(state, experimentId);
}

export function enqueueAttempt(state, { experimentId, idempotencyKey, trigger = MANUAL_TRIGGER }) {
  if (!idempotencyKey) return fail('idempotency_key_required', 'Run needs an idempotency key');
  if (Object.values(state.attempts).some(a => a.experimentId === experimentId && a.idempotencyKey === idempotencyKey)) return { state };
  const report = validateExperiment(state, experimentId);
  if (report.errors.length) return { error: { code: 'experiment_invalid', message: report.errors.map(e => e.message).join('; '), fix: report.errors[0].fix, errors: report.errors } };
  const saved = saveExperiment(state, { experimentId }).state;
  const attempt = freezeAttempt(saved, experimentId, idempotencyKey, trigger);
  return { state: { ...putAttempt(saved, attempt), attemptOrder: [...saved.attemptOrder, attempt.id], executions: { ...saved.executions, [attempt.id]: [] }, seq: attempt.enqueuedSeq } };
}

function lookup(state, attemptId) {
  const attempt = state.attempts[attemptId];
  return attempt ? { attempt } : fail('attempt_missing', `No attempt ${attemptId}`);
}

export function advanceAttempt(state, { attemptId }) {
  const { attempt, error } = lookup(state, attemptId);
  if (error) return { error };
  if (!LIVE.includes(attempt.status)) return fail('attempt_finished', `${attempt.title} is ${attempt.status}`);
  if (attempt.runner === 'paused') return fail('attempt_paused', `${attempt.title} is paused`, { label: 'Resume simulation', action: 'resume' });
  if (runnableAttemptId(state) !== attemptId) return ordered(state).some(a => a.status === 'running')
    ? fail('slot_busy', 'Another attempt is running')
    : fail('queue_order', 'An earlier queued attempt runs first');
  const item = attempt.plan[attempt.cursor];
  const execution = { ...runExecution(attempt.inputSnapshot, item, attempt.seed), id: `${attempt.id}/${item.id}`, attemptId: attempt.id };
  const cursor = attempt.cursor + 1;
  const status = execution.terminalState === 'error' ? 'failed' : cursor === attempt.plan.length ? 'completed' : 'running';
  const next = {
    ...putAttempt(state, { ...attempt, cursor, status }),
    executions: { ...state.executions, [attempt.id]: [...(state.executions[attempt.id] ?? []), execution] },
  };
  return { state: status === 'running' ? next : releaseSlot(next) };
}

/** The scheduler's verdict on an attempt whose advance threw: it stops as failed and gives up the slot. */
export function failAttempt(state, { attemptId }) {
  const { attempt, error } = lookup(state, attemptId);
  if (error) return { error };
  if (!LIVE.includes(attempt.status)) return { state };
  return { state: releaseSlot(putAttempt(state, { ...attempt, status: 'failed' })) };
}

const setRunner = runner => (state, { attemptId }) => {
  const { attempt, error } = lookup(state, attemptId);
  if (error) return { error };
  if (!LIVE.includes(attempt.status)) return fail('attempt_finished', `${attempt.title} is ${attempt.status}`);
  return { state: attempt.runner === runner ? state : putAttempt(state, { ...attempt, runner }) };
};

export const pauseAttempt = setRunner('paused');
export const resumeAttempt = setRunner('active');

/** Keeps finished executions; the remaining plan items never run. */
export function cancelAttempt(state, { attemptId }) {
  const { attempt, error } = lookup(state, attemptId);
  if (error) return { error };
  if (attempt.status === 'cancelled') return { state };
  if (!LIVE.includes(attempt.status)) return fail('attempt_finished', `${attempt.title} is ${attempt.status}`);
  return { state: releaseSlot(putAttempt(state, { ...attempt, status: 'cancelled' })) };
}

export function recordReview(state, { attemptId, decision, note = '', reviewedAt }) {
  const { attempt, error } = lookup(state, attemptId);
  if (error) return { error };
  if (LIVE.includes(attempt.status)) return fail('attempt_not_finished', 'Review a finished attempt');
  if (!REVIEW_DECISION.includes(decision)) return fail('invalid_decision', `Decision must be one of ${REVIEW_DECISION.join(', ')}`);
  const { verdict } = compareAttempt(attempt, state.executions[attemptId] ?? []);
  if (decision === 'pass_for_demo' && verdict !== 'pass')
    return fail('review_needs_pass', `Pass for demo needs a Pass verdict; this comparison reads ${verdict}`, { label: 'Choose another decision', action: 'review' });
  const review = { decision, note: String(note).slice(0, 500), reviewedAt: reviewedAt ?? new Date().toISOString(), deploymentState: 'not_deployed' };
  return { state: putAttempt(state, { ...attempt, review }) };
}
