// Release gate: an experiment's variant is a change, and the gate asks whether the latest saved revision has
// simulated evidence behind it. Pure. "Cleared for demo" is the strongest state; nothing here is released or deployed.
import { REVIEW_LABEL, refKey } from '../model.js';
import { attemptProgress, comparisonFor } from '../selectors.js';
import { variantChange } from '../simulation/attempts.js';
import { isLive } from './facts.js';

export const GATE = Object.freeze({
  not_run: { label: 'Not run', tone: 'gray' },
  running: { label: 'Running', tone: 'violet' },
  needs_review: { label: 'Needs review', tone: 'amber' },
  blocked: { label: 'Blocked', tone: 'red' },
  cleared: { label: 'Cleared for demo', tone: 'green' },
});

export const VERDICT_LABEL = Object.freeze({ pass: 'Pass', fail: 'Fail', regression: 'Regression', inconclusive: 'Inconclusive' });
const BLOCKING_REVIEW = ['needs_iteration', 'reject'];

// Read top to bottom; the first rule that holds decides the state. `f` is { savedRevision, attempt, progress, verdict, review }.
const RULES = [
  [f => !f.attempt, 'not_run', f => (f.savedRevision == null ? 'Never saved' : `No run of rev ${f.savedRevision} yet`)],
  [f => isLive(f.attempt), 'running', f => (f.attempt.status === 'queued' ? 'Queued' : `${f.progress} executions finished`)],
  [f => BLOCKING_REVIEW.includes(f.review?.decision), 'blocked', f => `Reviewed ${REVIEW_LABEL[f.review.decision]}`],
  [f => f.verdict !== 'pass', 'blocked', f => (f.attempt.status === 'completed' ? `Verdict ${VERDICT_LABEL[f.verdict]}` : `Run ${f.attempt.status}; verdict ${VERDICT_LABEL[f.verdict]}`)],
  [f => !f.review, 'needs_review', () => 'Pass verdict; not reviewed yet'],
  [() => true, 'cleared', () => 'Pass verdict; reviewed Pass for demo'],
];

/** @returns {{ state: keyof GATE, label: string, tone: string, reason: string }} */
export function gateState(facts) {
  const [, state, reason] = RULES.find(([holds]) => holds(facts));
  return { state, ...GATE[state], reason: reason(facts) };
}

/** The latest attempt frozen from the experiment's saved revision, or null. */
export function latestSavedAttempt(state, experimentId) {
  const exp = state.experiments[experimentId];
  if (exp.savedRevision == null) return null;
  return state.attemptOrder.map(id => state.attempts[id])
    .filter(a => a.experimentId === experimentId && a.inputSnapshot.experiment.draftRevision === exp.savedRevision).at(-1) ?? null;
}

/** One gate row per experiment, newest experiment first. */
export function releaseGateRows(state) {
  return Object.values(state.experiments).sort((a, b) => b.number - a.number).map(exp => {
    const attempt = latestSavedAttempt(state, exp.id);
    const source = attempt ? attempt.inputSnapshot : { workflow: state.workflows[refKey(exp.workflowRef)], variant: exp.variantId ? state.variants[exp.variantId] : null };
    const verdict = attempt ? comparisonFor(state, attempt.id).verdict : null;
    const progress = attempt ? attemptProgress(state, attempt.id).text : null;
    return {
      experimentId: exp.id, title: exp.title, number: exp.number, savedRevision: exp.savedRevision, draftRevision: exp.draftRevision,
      change: variantChange(source.workflow, source.variant),
      attempt: attempt && { id: attempt.id, label: attempt.label, status: attempt.status, paused: isLive(attempt) && attempt.runner === 'paused', progress },
      verdict, review: attempt?.review ?? null,
      draftChanged: !!attempt && exp.draftRevision !== attempt.inputSnapshot.experiment.draftRevision,
      gate: gateState({ savedRevision: exp.savedRevision, attempt, progress, verdict, review: attempt?.review ?? null }),
    };
  });
}
