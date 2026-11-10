// Run gate for an experiment draft. Every blocking error carries the fix the workbench offers.
import { REPETITIONS, executionCount, pairCount, refKey, sameRef, uniqueIds } from './model.js';
import { faultCapabilityOf, overrideProblem } from './simulation/adapters.js';
import { CHECK_PATHS, EXPECTED_OUTCOME } from './simulation/assertions.js';
import { SCRIPTED_TRIGGERS } from './simulation/executor.js';

export const FIX_ACTIONS = Object.freeze(['change-environment', 'change-workflow', 'change-scenario-set', 'select-scenarios', 'review-scenario', 'run-settings', 'create-variant', 'save-experiment']);

const err = (code, message, label, action, extra = {}) => ({ code, message, fix: { label, action }, ...extra });

function scenarioErrors(scenario, environment) {
  const id = { scenarioId: scenario.id };
  const errors = [];
  if (scenario.reviewState !== 'reviewed') errors.push(err('scenario_unreviewed', `${scenario.title} is not reviewed`, 'Review scenario', 'review-scenario', id));
  for (const o of scenario.overrides) {
    const problem = environment && overrideProblem(environment, o);
    if (problem) errors.push(err('unknown_override', `${scenario.title}: ${problem}`, 'Review scenario', 'review-scenario', id));
  }
  if (!(scenario.expectedBehavior.outcome in EXPECTED_OUTCOME))
    errors.push(err('unknown_outcome', `${scenario.title}: unknown expected outcome ${scenario.expectedBehavior.outcome}`, 'Review scenario', 'review-scenario', id));
  for (const c of scenario.stateChecks) if (!CHECK_PATHS.includes(c.path))
    errors.push(err('unknown_check_path', `${scenario.title}: unsupported check ${c.path}`, 'Review scenario', 'review-scenario', id));
  for (const e of scenario.scriptedEvents) if (!SCRIPTED_TRIGGERS.includes(e.after) || e.type !== 'approval_grant')
    errors.push(err('unknown_scripted_event', `${scenario.title}: unsupported scripted event`, 'Review scenario', 'review-scenario', id));
  return errors;
}

/** @returns {{errors:GymError[], warnings:GymError[], dependencyReport:{matched:boolean, missing:string[]}, executionCount:number, pairCount:number}} */
export function validateExperiment(state, experimentId) {
  const exp = state.experiments[experimentId];
  if (!exp) return { errors: [err('experiment_missing', `No experiment ${experimentId}`, 'Back to workbench', 'change-workflow')], warnings: [], dependencyReport: { matched: false, missing: [] }, executionCount: 0, pairCount: 0 };

  const errors = [];
  const warnings = [];
  const environment = state.environments[refKey(exp.environmentRef)];
  const workflow = state.workflows[refKey(exp.workflowRef)];
  const variant = exp.variantId ? state.variants[exp.variantId] : null;
  const set = state.scenarioSets[refKey(exp.scenarioSetRef)];
  const setRefs = set?.scenarioRefs ?? [];
  const selectedIds = uniqueIds(exp.selectedScenarioIds);
  const scenarios = selectedIds.map(id => setRefs.find(r => r.id === id)).filter(Boolean).map(r => state.scenarios[refKey(r)]).filter(Boolean);

  if (!environment) errors.push(err('environment_missing', `Environment revision ${refKey(exp.environmentRef)} does not exist`, 'Choose an environment', 'change-environment'));
  else if (environment.validation?.status !== 'validated' || environment.validation.digest !== environment.digest)
    errors.push(err('environment_not_validated', `${environment.name} v${environment.rev} has no current validation`, 'Choose a validated environment', 'change-environment'));
  if (!workflow) errors.push(err('baseline_missing', `Workflow revision ${refKey(exp.workflowRef)} does not exist`, 'Choose a workflow', 'change-workflow'));
  if (!variant) errors.push(err('variant_missing', 'No variant to compare against the baseline', 'Create Variant A', 'create-variant'));
  else if (!sameRef(variant.workflowRef, exp.workflowRef)) errors.push(err('variant_mismatch', `${variant.name} belongs to another workflow`, 'Create Variant A', 'create-variant'));
  else if (workflow && variant.baseDigest !== workflow.digest) errors.push(err('variant_stale', `${variant.name} was made from another baseline`, 'Create Variant A', 'create-variant'));
  if (!set) errors.push(err('scenario_set_missing', `Scenario set ${refKey(exp.scenarioSetRef)} does not exist`, 'Choose a scenario set', 'change-scenario-set'));
  const strays = selectedIds.filter(id => !setRefs.some(r => r.id === id));
  if (set && strays.length) errors.push(err('scenario_not_in_set', `Selected scenarios not in ${set.name}: ${strays.join(', ')}`, 'Fix selection', 'select-scenarios'));
  if (scenarios.length === 0) errors.push(err('no_scenarios_selected', 'Select at least one scenario', 'Select scenarios', 'select-scenarios'));
  if (!Number.isInteger(exp.repetitions) || exp.repetitions < REPETITIONS.min || exp.repetitions > REPETITIONS.max)
    errors.push(err('repetitions_out_of_range', `Repetitions must be ${REPETITIONS.min} to ${REPETITIONS.max}`, 'Adjust run settings', 'run-settings'));
  for (const s of scenarios) errors.push(...scenarioErrors(s, environment));

  const authoredFor = set && state.environments[refKey(set.environmentRef)];
  const faultNeed = o => faultCapabilityOf(environment, o) ?? faultCapabilityOf(authoredFor, o) ?? `${o.target}.${o.value}`;
  const required = uniqueIds([
    ...(workflow?.requiredCapabilities ?? []),
    ...(environment ? scenarios.flatMap(s => s.overrides.filter(o => o.kind === 'fault').map(o => faultNeed(o))) : []),
  ]);
  const available = new Set([...(environment?.capabilities ?? []), ...(environment?.faultCapabilities ?? [])]);
  const missing = environment ? required.filter(c => !available.has(c)) : [];
  if (missing.length) errors.push(err('dependency_unmatched', `${environment.name} v${environment.rev} is missing ${missing.join(', ')}`, 'Change environment', 'change-environment', { missing }));

  if (set && !sameRef(set.environmentRef, exp.environmentRef)) warnings.push(err('set_environment_differs', `${set.name} was authored for ${refKey(set.environmentRef)}`, 'Change scenario set', 'change-scenario-set'));
  if (exp.savedRevision !== exp.draftRevision) warnings.push(err('draft_unsaved', 'The draft has unsaved changes; Run saves them first', 'Save experiment', 'save-experiment'));

  const versions = variant ? 2 : 1;
  return {
    errors, warnings,
    dependencyReport: { matched: !!environment && !!workflow && missing.length === 0, missing },
    executionCount: executionCount(versions, scenarios.length, exp.repetitions),
    pairCount: variant ? pairCount(scenarios.length, exp.repetitions) : 0,
  };
}
