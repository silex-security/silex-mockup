// Referential integrity of a whole GymState. Pure. The store runs it on saved data before trusting it, and the
// reducers that write scenario-set refs share setRefsProblem, so a state that fails here is never produced inside.
// Attempt triggers and regression state came later: saved data without them is valid and reads as their defaults.
import { TERMINAL_STATE, refKey } from './model.js';

export const TRIGGER_KIND = Object.freeze(['manual', 'change', 'regression']);
export const CADENCE = Object.freeze(['biweekly', 'monthly', 'quarterly']);

const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const attemptNumber = id => { const m = /^attempt-(\d+)$/.exec(id); return m ? Number(m[1]) : 0; };

/** Why a list of scenario refs cannot be a set over `scenarios`, or null. Refs are unique by id and must resolve. */
export function setRefsProblem(scenarios, refs) {
  if (!Array.isArray(refs) || !refs.length) return 'a scenario set lists at least one scenario';
  const ids = refs.map(r => r?.id);
  const dup = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dup) return `${dup} is listed twice`;
  const missing = refs.find(r => !scenarios[refKey(r)]);
  return missing ? `${refKey(missing)} does not exist` : null;
}

function triggerProblem(trigger, batchIds) {
  if (trigger === undefined) return null;
  if (!isObject(trigger) || !TRIGGER_KIND.includes(trigger.kind) || typeof trigger.label !== 'string') return 'has an unknown trigger';
  return trigger.kind === 'regression' && !batchIds.has(trigger.batchId) ? `names regression batch ${trigger.batchId}, which does not exist` : null;
}

function regressionProblems(regression, attempts) {
  if (regression === undefined) return [];
  if (!isObject(regression) || !CADENCE.includes(regression.cadence) || !Array.isArray(regression.batches)) return ['regression state is malformed'];
  return regression.batches.flatMap(b => !isObject(b) || typeof b.id !== 'string' || !Array.isArray(b.attemptIds) || !Array.isArray(b.skipped)
    ? ['a regression batch is malformed']
    : b.attemptIds.filter(id => !attempts[id]).map(id => `${b.id}: attempt ${id} does not exist`));
}

const SNAPSHOT_PARTS = ['experiment', 'workflow', 'environment', 'scenarioSet'];
const executionProblem = (e, attemptId) => {
  if (!isObject(e) || e.attemptId !== attemptId) return 'belongs to another attempt';
  if (!['baseline', 'variant'].includes(e.versionId) || typeof e.scenarioId !== 'string' || !Number.isInteger(e.repeatIndex)) return 'has no plan coordinates';
  if (!TERMINAL_STATE.includes(e.terminalState)) return `has terminal state ${e.terminalState}`;
  if (!Array.isArray(e.finalState?.violations) || !Array.isArray(e.assertionResults)) return 'has no final state or assertion results';
  return null;
};

/** Every broken reference in `state`, as sentences. Empty means the state is safe to load. */
export function stateProblems(state) {
  const out = [];
  for (const [id, exp] of Object.entries(state.experiments)) {
    if (!state.environments[refKey(exp.environmentRef ?? {})]) out.push(`${id}: environment does not exist`);
    if (!state.workflows[refKey(exp.workflowRef ?? {})]) out.push(`${id}: workflow does not exist`);
    if (!state.scenarioSets[refKey(exp.scenarioSetRef ?? {})]) out.push(`${id}: scenario set does not exist`);
    if (exp.variantId != null && !state.variants[exp.variantId]) out.push(`${id}: variant does not exist`);
    if (!Array.isArray(exp.selectedScenarioIds)) out.push(`${id}: selected scenarios are not a list`);
  }
  for (const [key, set] of Object.entries(state.scenarioSets)) {
    const problem = setRefsProblem(state.scenarios, set.scenarioRefs);
    if (problem) out.push(`${key}: ${problem}`);
  }
  out.push(...regressionProblems(state.regression, state.attempts));
  const batchIds = new Set(Array.isArray(state.regression?.batches) ? state.regression.batches.map(b => b?.id) : []);
  const order = state.attemptOrder;
  const ids = Object.keys(state.attempts);
  if (new Set(order).size !== order.length || order.length !== ids.length || order.some(id => !state.attempts[id])) out.push('attemptOrder and attempts disagree');
  for (const [id, a] of Object.entries(state.attempts)) {
    if (a.id !== id) out.push(`${id}: stored under another id`);
    if (!state.experiments[a.experimentId]) out.push(`${id}: experiment does not exist`);
    if (!isObject(a.inputSnapshot) || SNAPSHOT_PARTS.some(k => !isObject(a.inputSnapshot[k])) || !Array.isArray(a.inputSnapshot.scenarios)) out.push(`${id}: no input snapshot`);
    if (!Array.isArray(a.plan)) out.push(`${id}: no plan`);
    if (!Array.isArray(state.executions[id])) out.push(`${id}: no execution list`);
    if (attemptNumber(id) > state.seq || a.enqueuedSeq > state.seq) out.push(`${id}: seq ${state.seq} is behind it`);
    const trigger = triggerProblem(a.trigger, batchIds);
    if (trigger) out.push(`${id} ${trigger}`);
  }
  for (const [id, list] of Object.entries(state.executions)) {
    if (!state.attempts[id]) { out.push(`executions for unknown attempt ${id}`); continue; }
    if (!Array.isArray(list)) { out.push(`${id}: executions are not a list`); continue; }
    list.forEach((e, i) => { const p = executionProblem(e, id); if (p) out.push(`${id} execution ${i + 1} ${p}`); });
  }
  return out;
}
