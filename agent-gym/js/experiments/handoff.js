// Accepting a Speedrun handoff: the reducer behind #/handoff/speedrun/:handoffId.
//
//   handoffExperimentId(handoffId) -> 'exp-<handoffId>'
//   acceptHandoff(state, { handoffId }) -> { state } | { error }
//     Adds the experiment the handoff's template describes, as an unsaved pending draft with a Speedrun source and no
//     attempts. The experiment id comes from the handoff id, so accepting twice returns the same state, and an
//     experiment the visitor has since edited or run is left as it is. An id with no template is a handoff_unknown error.
import { experiment } from '../fixtures/experiment.js';
import { HANDOFFS } from '../fixtures/handoffs.js';

export const handoffExperimentId = handoffId => `exp-${handoffId}`;

export function acceptHandoff(state, { handoffId }) {
  if (typeof handoffId !== 'string' || !Object.hasOwn(HANDOFFS, handoffId)) {
    return { error: { code: 'handoff_unknown', message: 'This handoff does not name an Agent Gym experiment template.' } };
  }
  const id = handoffExperimentId(handoffId);
  if (state.experiments[id]) return { state };
  const number = Math.max(0, ...Object.values(state.experiments).map(e => e.number)) + 1;
  const draft = experiment(id, number, HANDOFFS[handoffId].title, { ...HANDOFFS[handoffId], revision: 1, saved: false });
  return { state: { ...state, experiments: { ...state.experiments, [id]: draft } } };
}
