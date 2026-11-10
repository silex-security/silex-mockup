// #/handoff/speedrun/:handoffId. Accepts the handoff once, then swaps this route for the new experiment's workbench so
// Back does not return here. An id with no template renders the not-found panel. Nothing from the URL is shown.
import { acceptHandoff, handoffExperimentId } from '../experiments/handoff.js';
import * as notFound from './not-found.js';

export function mount(root, ctx) {
  const { handoffId } = ctx.route.params;
  if (!ctx.store.dispatch(acceptHandoff, { handoffId }).ok) return notFound.mount(root, ctx);
  let gone = false;
  // The shell is still inside show() for this route, so the swap waits until it has recorded the mounted view.
  queueMicrotask(() => { if (!gone) ctx.router.replace('workbench', { experimentId: handoffExperimentId(handoffId) }); });
  return { update() {}, destroy() { gone = true; } };
}
