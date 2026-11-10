// Experiment drafts and the seeded queue. The queue is produced by the real reducers and executor, never typed in.
import { advanceAttempt, changeTrigger, enqueueAttempt, renameExperiment } from '../simulation/attempts.js';

const experiment = (id, number, title, workflowId, variantId, environmentRef, setId, selectedScenarioIds, repetitions, revision) => ({
  id, number, title, draftRevision: revision, savedRevision: revision,
  workflowRef: { id: workflowId, rev: '1' }, variantId, environmentRef, scenarioSetRef: { id: setId, rev: '1' }, selectedScenarioIds, repetitions,
});

const SALES = { id: 'env-sales', rev: '1.2' };
const SUPPORT = { id: 'env-support', rev: '1.2' };

export const EXPERIMENTS = Object.freeze([
  experiment('exp-027', 27, 'Meeting scheduling', 'wf-meeting-scheduling', 'variant-meeting-a', SALES, 'set-meeting-scheduling',
    ['sc-mtg-intro', 'sc-mtg-no-slot', 'sc-mtg-ambiguous', 'sc-mtg-cancel', 'sc-mtg-no-permission', 'sc-mtg-noisy'], 1, 2),
  experiment('exp-028', 28, 'Support triage comparison', 'wf-support-triage', 'variant-support-a', SUPPORT, 'set-refund-triage',
    ['sc-sup-refund-in-window', 'sc-sup-refund-timeout', 'sc-sup-outside-window', 'sc-sup-rephrased', 'sc-sup-ambiguous', 'sc-sup-skip-approval', 'sc-sup-cancel', 'sc-sup-no-permission'], 3, 1),
  experiment('exp-029', 29, 'Sales follow-up · Variant A', 'wf-sales-follow-up', 'variant-a', SALES, 'set-follow-up-resilience',
    ['sc-base-case', 'sc-timeout-after-send', 'sc-contact-opted-out'], 3, 3),
]);

export const SEED_CURSOR = 12;

const must = result => {
  if (result.error) throw new Error(`seed queue: ${result.error.code} ${result.error.message}`);
  return result.state;
};

function advanceWhile(state, attemptId, keepGoing) {
  let next = state;
  while (keepGoing(next.attempts[attemptId])) next = must(advanceAttempt(next, { attemptId }));
  return next;
}

/**
 * Meeting scheduling runs to completion, Sales follow-up runs to 12 of 18, Support triage waits in the queue.
 * exp-029 is then renamed, so its draft is one revision ahead of the frozen revision that is running.
 * Meeting scheduling and Support triage were started by hand; Sales follow-up tests its Variant A as a change.
 */
export function buildQueue(state) {
  let s = must(enqueueAttempt(state, { experimentId: 'exp-027', idempotencyKey: 'seed-exp-027-1' }));
  const meeting = s.attemptOrder.at(-1);
  s = advanceWhile(s, meeting, a => a.status !== 'completed');
  s = must(enqueueAttempt(s, { experimentId: 'exp-029', idempotencyKey: 'seed-exp-029-1', trigger: changeTrigger(s, 'exp-029') }));
  const sales = s.attemptOrder.at(-1);
  s = advanceWhile(s, sales, a => a.cursor < SEED_CURSOR);
  s = must(enqueueAttempt(s, { experimentId: 'exp-028', idempotencyKey: 'seed-exp-028-1' }));
  return must(renameExperiment(s, { experimentId: 'exp-029', title: 'Experiment 029' }));
}
