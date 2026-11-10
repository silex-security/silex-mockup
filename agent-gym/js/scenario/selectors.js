// Read models for the scenario screens. Every count the builder shows comes from here.
import { refKey } from '../model.js';
import { EXPECTED_OUTCOME } from '../simulation/assertions.js';
import { faultCapabilityOf } from '../simulation/adapters.js';
import { contextOf } from './draft.js';
import { promptText } from './review.js';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "1 base scenario + 4 variations = 5 scenarios", from the selected variations across every dimension. */
export function setTotals(draft) {
  const variations = draft.items.filter(i => i.selected).length;
  return { variations, scenarios: variations + 1, text: `1 base scenario + ${plural(variations, 'variation')} = ${plural(variations + 1, 'scenario')}` };
}

/** "4 generated · 4 selected" for one dimension. Generated and selected are separate numbers. */
export function dimensionCounts(draft, dimension) {
  const items = draft.items.filter(i => i.dimension === dimension);
  const selected = items.filter(i => i.selected).length;
  return { generated: items.length, selected, text: `${items.length} generated · ${selected} selected` };
}

/** Workflow dependencies against the environment, and override references the workflow never reaches. */
export function dependencyReport(state, draft) {
  const { environment, workflow } = contextOf(state, draft);
  const available = new Set([...(environment?.capabilities ?? []), ...(environment?.faultCapabilities ?? [])]);
  const missing = (workflow?.requiredCapabilities ?? []).filter(c => !available.has(c));
  const used = new Set(workflow?.requiredCapabilities ?? []);
  const references = [];
  const capabilityOfTarget = target => {
    const [componentId, tool] = target.split('.');
    const component = environment?.components.find(c => c.id === componentId);
    return component ? `${component.kind}.${tool}` : null;
  };
  for (const item of draft.items) for (const o of item.overrides) {
    if (o.kind === 'data') continue;
    const capability = capabilityOfTarget(o.target);
    if (!capability || !used.has(capability)) references.push(`${item.label} targets ${o.target}, which ${workflow?.name ?? 'the workflow'} never calls`);
    else if (o.kind === 'fault' && !available.has(faultCapabilityOf(environment, o))) references.push(`${item.label} needs ${faultCapabilityOf(environment, o)}`);
  }
  return { matched: missing.length === 0 && references.length === 0, missing, references };
}

export const outcomeLabel = key => EXPECTED_OUTCOME[key]?.label ?? key;
export { promptText };

/** Detail for the read-only scenario set page. */
export function scenarioSetDetail(state, ref) {
  const set = state.scenarioSets[refKey(ref)];
  if (!set) return null;
  const environment = state.environments[refKey(set.environmentRef)];
  const workflow = state.workflows[refKey(set.workflowRef)];
  return {
    set, environmentName: environment ? `${environment.name} v${environment.rev}` : refKey(set.environmentRef),
    workflowName: workflow ? workflow.name : refKey(set.workflowRef),
    scenarios: set.scenarioRefs.map(r => state.scenarios[refKey(r)]).filter(Boolean),
    usedBy: Object.values(state.experiments).filter(e => refKey(e.scenarioSetRef) === refKey(ref)).map(e => e.id),
  };
}
