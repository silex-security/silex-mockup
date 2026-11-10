// The Configure, Run, Review steps an experiment moves through. The current step comes from the route, because each step
// has its own screen. Whether the other steps have somewhere to go comes from the attempt that decides the experiment's
// stage (selectors.js stageAttempt), unless the route names one of the experiment's own attempts.
import { REVIEW_LABEL } from '../model.js';
import { attemptProgress, stageAttempt } from '../selectors.js';

export const STEPS = Object.freeze([{ id: 'configure', label: 'Configure' }, { id: 'run', label: 'Run' }, { id: 'review', label: 'Review' }]);

const STEP_OF_ROUTE = Object.freeze({ workbench: 'configure', 'run-detail': 'run', results: 'review' });

/** The attempt the steps point at: the one in the route when it is this experiment's, else the stage attempt. */
function targetAttempt(state, experimentId, route) {
  const named = state.attempts[route.params.attemptId];
  return named?.experimentId === experimentId && !named.impactOf ? named : stageAttempt(state, experimentId);
}

/**
 * @returns {{ id: string, label: string, position: number, state: 'done'|'current'|'upcoming', target: { route: string, params: object } | null,
 *             reason: string | null, detail: string | null }[]}
 */
export function experimentSteps(state, experimentId, route) {
  const attempt = targetAttempt(state, experimentId, route);
  const params = attempt && { experimentId, attemptId: attempt.id };
  const live = attempt && (attempt.status === 'queued' || attempt.status === 'running');
  const progress = attempt && attemptProgress(state, attempt.id);
  const placement = {
    configure: { target: { route: 'workbench', params: { experimentId } }, reason: null, detail: null },
    run: {
      target: attempt ? { route: 'run-detail', params } : null,
      reason: attempt ? null : 'Nothing has run yet. Run the simulation from the workbench first.',
      detail: attempt?.status === 'running' ? `${progress.done} of ${progress.total} done` : attempt?.status === 'queued' ? 'Queued' : null,
    },
    review: {
      target: attempt && !live ? { route: 'results', params } : null,
      reason: !attempt ? 'Nothing has run yet, so there is nothing to review.'
        : attempt.status === 'queued' ? 'Waiting in the queue. Review opens when the run has finished.'
          : live ? `The run is still going: ${progress.done} of ${progress.total} executions finished. Review opens when it has.` : null,
      detail: attempt?.review ? REVIEW_LABEL[attempt.review.decision] : null,
    },
  };
  const current = STEPS.findIndex(s => s.id === STEP_OF_ROUTE[route.name]);
  return STEPS.map((step, i) => ({ ...step, position: i + 1, state: i < current ? 'done' : i === current ? 'current' : 'upcoming', ...placement[step.id] }));
}
