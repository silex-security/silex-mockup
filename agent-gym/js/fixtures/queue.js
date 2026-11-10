// Experiment drafts and the seeded queue. The queue is produced by the real reducers and executor, never typed in.
import { advanceAttempt, changeTrigger, enqueueAttempt, pauseAttempt, recordReview, renameExperiment, resumeAttempt } from '../simulation/attempts.js';

const experiment = (id, number, title, { workflow, variant, environment, set, scenarios, repetitions, revision, objective = 'success', acceptance = { noRegression: true, minImprovedPairs: 1 }, source, saved = true }) => ({
  id, number, title, draftRevision: revision, savedRevision: saved ? revision : null,
  workflowRef: { id: workflow.id, rev: workflow.rev ?? '1' }, variantId: variant, environmentRef: environment, scenarioSetRef: { id: set.id, rev: set.rev ?? '1' },
  selectedScenarioIds: scenarios, repetitions, objective, acceptance, source,
});

const SALES = { id: 'env-sales', rev: '1.2' };
const SUPPORT = { id: 'env-support', rev: '1.2' };
const FOLLOW_UP = { workflow: { id: 'wf-sales-follow-up' }, variant: 'variant-a', environment: SALES, set: { id: 'set-follow-up-resilience' } };
const TRIAGE = { workflow: { id: 'wf-support-triage' }, variant: 'variant-support-a', environment: SUPPORT, set: { id: 'set-refund-triage' } };
const TRIAGE_V2 = { workflow: { id: 'wf-support-triage', rev: '2' }, variant: 'variant-support-small', environment: SUPPORT, set: { id: 'set-refund-triage-v2' } };
const MEETING = { workflow: { id: 'wf-meeting-scheduling' }, variant: 'variant-meeting-a', environment: SALES, set: { id: 'set-meeting-scheduling' } };

const speedrun = label => ({ kind: 'speedrun', label });
const studio = label => ({ kind: 'studio', label });
const manual = { kind: 'manual', label: 'Created in the workbench' };

export const EXPERIMENTS = Object.freeze([
  experiment('exp-024', 24, 'Duplicate-send guard', {
    ...FOLLOW_UP, scenarios: ['sc-base-case', 'sc-timeout-after-send', 'sc-contact-opted-out'], repetitions: 1, revision: 2,
    objective: 'policy_violations', source: speedrun('Speedrun trace: duplicate follow-up emails'),
  }),
  experiment('exp-025', 25, 'Smaller model for refund replies', {
    ...TRIAGE_V2, scenarios: ['sc-sup-refund-in-window', 'sc-sup-refund-timeout', 'sc-sup-outside-window'], repetitions: 2, revision: 1,
    source: studio('Agent Studio: Support agent draft 3'),
  }),
  experiment('exp-026', 26, 'Refund timeout steps', {
    ...TRIAGE, scenarios: ['sc-sup-refund-in-window', 'sc-sup-refund-timeout'], repetitions: 2, revision: 1,
    objective: 'steps', source: manual,
  }),
  experiment('exp-027', 27, 'Meeting scheduling', {
    ...MEETING, scenarios: ['sc-mtg-intro', 'sc-mtg-no-slot', 'sc-mtg-ambiguous', 'sc-mtg-cancel', 'sc-mtg-no-permission', 'sc-mtg-noisy'], repetitions: 1, revision: 2,
    acceptance: { noRegression: true, minImprovedPairs: 0 }, source: speedrun('Speedrun trace: intro-call booking'),
  }),
  experiment('exp-028', 28, 'Support triage comparison', {
    ...TRIAGE, scenarios: ['sc-sup-refund-in-window', 'sc-sup-refund-timeout', 'sc-sup-outside-window', 'sc-sup-rephrased', 'sc-sup-ambiguous', 'sc-sup-skip-approval', 'sc-sup-cancel', 'sc-sup-no-permission'],
    repetitions: 3, revision: 1, source: manual,
  }),
  experiment('exp-029', 29, 'Sales follow-up · Variant A', {
    ...FOLLOW_UP, scenarios: ['sc-base-case', 'sc-timeout-after-send', 'sc-contact-opted-out'], repetitions: 3, revision: 3, source: studio('Agent Studio: Sales agent draft 5'),
  }),
  experiment('exp-030', 30, 'Opt-out wording check', {
    ...FOLLOW_UP, scenarios: ['sc-base-case', 'sc-contact-opted-out'], repetitions: 2, revision: 1,
    acceptance: { noRegression: true, minImprovedPairs: 0 }, source: speedrun('Speedrun trace: opt-out complaints'), saved: false,
  }),
  experiment('exp-031', 31, 'Meeting no-slot handling', {
    ...MEETING, scenarios: ['sc-mtg-intro', 'sc-mtg-no-slot'], repetitions: 2, revision: 1, objective: 'steps',
    source: studio('Agent Studio: Scheduling agent draft 2'), saved: false,
  }),
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

const REVIEWED_AT = '2026-11-08T15:30:00Z';

/** Enqueues and runs one attempt to completion, optionally recording its review. Returns the new state. */
function finished(state, experimentId, review) {
  let s = must(enqueueAttempt(state, { experimentId, idempotencyKey: `seed-${experimentId}-1` }));
  const attemptId = s.attemptOrder.at(-1);
  s = advanceWhile(s, attemptId, a => a.status !== 'completed');
  return review ? must(recordReview(s, { attemptId, ...review, reviewedAt: REVIEWED_AT })) : s;
}

/**
 * Meeting scheduling runs to completion and awaits review; Sales follow-up runs to 12 of 18; Support triage waits.
 * Their attempts are numbered 1 to 3. The experiments that finished and were reviewed are enqueued while the other two are
 * held (paused), then the queue order is set to run order, so the scheduler's one slot stays honest: only Sales follow-up
 * is running at the end, and it is the latest of the attempts on its scenario set.
 * exp-029 is then renamed, so its draft is one revision ahead of the frozen revision that is running.
 */
export function buildQueue(state) {
  let s = finished(state, 'exp-027');
  s = must(enqueueAttempt(s, { experimentId: 'exp-029', idempotencyKey: 'seed-exp-029-1', trigger: changeTrigger(s, 'exp-029') }));
  const sales = s.attemptOrder.at(-1);
  s = must(enqueueAttempt(s, { experimentId: 'exp-028', idempotencyKey: 'seed-exp-028-1' }));
  const support = s.attemptOrder.at(-1);
  s = must(pauseAttempt(must(pauseAttempt(s, { attemptId: sales })), { attemptId: support }));

  s = finished(s, 'exp-024', { decision: 'pass_for_demo', note: 'The status check removed the duplicate send. Safe to show.' });
  s = finished(s, 'exp-025', { decision: 'reject', note: 'The smaller model stops after a timeout and drops the refund reply. Not adopted.' });
  s = finished(s, 'exp-026', { decision: 'needs_iteration', note: 'Fewer duplicates, but the status check adds steps. Try a cheaper check.' });

  s = must(resumeAttempt(must(resumeAttempt(s, { attemptId: sales })), { attemptId: support }));
  const held = [sales, support];
  s = { ...s, attemptOrder: [...s.attemptOrder.filter(id => !held.includes(id)), ...held] };
  s = advanceWhile(s, sales, a => a.cursor < SEED_CURSOR);
  return must(renameExperiment(s, { experimentId: 'exp-029', title: 'Experiment 029' }));
}
