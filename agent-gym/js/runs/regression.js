// Regression: one press re-runs every experiment whose saved revision passes the run gate, as one tagged batch.
// Pure reducers and selectors. The cadence is a stored setting only: this preview has no timer, so batches start
// from the button alone. Batches are numbered and placed by the store sequence, never by wall-clock time.
import { CADENCE } from '../integrity.js';
import { validateExperiment } from '../validators.js';
import { enqueueAttempt, experimentAttempts } from '../simulation/attempts.js';
import { comparisonFor } from '../selectors.js';
import { isLive } from './facts.js';

export const CADENCE_LABEL = Object.freeze({ biweekly: 'Every 2 weeks', monthly: 'Monthly', quarterly: 'Quarterly' });
const DEFAULT_REGRESSION = Object.freeze({ cadence: 'monthly', batches: Object.freeze([]) });

/** The regression state. Saved data from before regression existed reads as a monthly cadence with no batches. */
export const regressionOf = state => state.regression ?? DEFAULT_REGRESSION;

const attemptsOf = (state, ids) => ids.map(id => state.attempts[id]);

/** The batch that still has a queued or running attempt, or null. */
export const liveBatch = state => regressionOf(state).batches.find(b => attemptsOf(state, b.attemptIds).some(isLive)) ?? null;

function skipReason(state, exp) {
  if (exp.savedRevision == null) return 'Never saved';
  if (exp.savedRevision !== exp.draftRevision) return `Draft rev ${exp.draftRevision} has unsaved changes; save it in the workbench to include it`;
  const live = experimentAttempts(state, exp.id)
    .find(a => isLive(a) && a.inputSnapshot.experiment.draftRevision === exp.savedRevision);
  if (live) return `${live.label} is already ${live.status}`;
  const { errors } = validateExperiment(state, exp.id);
  return errors.length ? errors[0].message : null;
}

/** Which experiments the next batch includes, with their run counts, and which it skips and why. */
export function regressionPlan(state) {
  const included = [];
  const skipped = [];
  for (const exp of Object.values(state.experiments).sort((a, b) => a.number - b.number)) {
    const reason = skipReason(state, exp);
    if (reason) skipped.push({ experimentId: exp.id, title: exp.title, reason });
    else included.push({ experimentId: exp.id, title: exp.title, runs: validateExperiment(state, exp.id).executionCount });
  }
  return { included, skipped, runs: included.reduce((n, x) => n + x.runs, 0) };
}

/** "Run regression now". While a batch is live it changes nothing, so a second press never enqueues twice. */
export function runRegression(state) {
  if (liveBatch(state)) return { state };
  const plan = regressionPlan(state);
  if (!plan.included.length) return { error: { code: 'regression_empty', message: 'No saved experiment can run now', skipped: plan.skipped } };
  const regression = regressionOf(state);
  const number = regression.batches.length + 1;
  const id = `regression-${number}`;
  const trigger = { kind: 'regression', label: `Regression batch ${number}`, batchId: id };
  let next = state;
  for (const { experimentId } of plan.included) next = enqueueAttempt(next, { experimentId, idempotencyKey: `${id}-${experimentId}`, trigger }).state;
  const attemptIds = next.attemptOrder.slice(state.attemptOrder.length);
  const batch = { id, number, startedSeq: next.attempts[attemptIds[0]].enqueuedSeq, attemptIds, skipped: plan.skipped };
  return { state: { ...next, regression: { ...regression, batches: [...regression.batches, batch] } } };
}

export function setRegressionCadence(state, { cadence }) {
  if (!CADENCE.includes(cadence)) return { error: { code: 'invalid_cadence', message: `Cadence must be one of ${CADENCE.join(', ')}` } };
  const regression = regressionOf(state);
  return { state: cadence === regression.cadence ? state : { ...state, regression: { ...regression, cadence } } };
}

/** History rows, newest batch first. Runs and verdicts come from the batch's attempts and their executions. */
export function regressionHistory(state) {
  return [...regressionOf(state).batches].reverse().map(batch => {
    const attempts = attemptsOf(state, batch.attemptIds);
    const verdicts = { pass: 0, fail: 0, regression: 0, inconclusive: 0 };
    let live = 0;
    for (const a of attempts) if (isLive(a)) live += 1; else verdicts[comparisonFor(state, a.id).verdict] += 1;
    return {
      id: batch.id, number: batch.number, startedSeq: batch.startedSeq, live: live > 0, running: live,
      experiments: attempts.map(a => ({ experimentId: a.experimentId, attemptId: a.id, title: a.title })),
      planned: attempts.reduce((n, a) => n + a.plan.length, 0),
      finished: attempts.reduce((n, a) => n + (state.executions[a.id] ?? []).length, 0),
      verdicts, skipped: batch.skipped,
    };
  });
}
