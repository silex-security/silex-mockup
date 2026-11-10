// The building blocks of an ExperimentDraft: the workflow, variant, environment and scenario set each seeded flow uses,
// and experiment() to assemble one. The queue fixture and the Speedrun handoff templates both read them.
export const SALES = { id: 'env-sales', rev: '1.2' };
export const SUPPORT = { id: 'env-support', rev: '1.2' };
export const FINANCE = { id: 'env-finance', rev: '1.0' };
export const FOLLOW_UP = { workflow: { id: 'wf-sales-follow-up' }, variant: 'variant-a', environment: SALES, set: { id: 'set-follow-up-resilience' } };
export const TRIAGE = { workflow: { id: 'wf-support-triage' }, variant: 'variant-support-a', environment: SUPPORT, set: { id: 'set-refund-triage' } };
export const TRIAGE_V2 = { workflow: { id: 'wf-support-triage', rev: '2' }, variant: 'variant-support-small', environment: SUPPORT, set: { id: 'set-refund-triage-v2' } };
export const MEETING = { workflow: { id: 'wf-meeting-scheduling' }, variant: 'variant-meeting-a', environment: SALES, set: { id: 'set-meeting-scheduling' } };

export const INVOICE = { workflow: { id: 'wf-invoice-review' }, variant: 'variant-invoice-a', environment: FINANCE, set: { id: 'set-invoice-review' } };

export const experiment = (id, number, title, { workflow, variant, environment, set, scenarios, repetitions, revision, objective = 'success', acceptance = { noRegression: true, minImprovedPairs: 1 }, source, saved = true }) => ({
  id, number, title, draftRevision: revision, savedRevision: saved ? revision : null,
  workflowRef: { id: workflow.id, rev: workflow.rev ?? '1' }, variantId: variant, environmentRef: environment, scenarioSetRef: { id: set.id, rev: set.rev ?? '1' },
  selectedScenarioIds: scenarios, repetitions, objective, acceptance: { noSharedRegression: true, ...acceptance }, source,
});
