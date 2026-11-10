// The one simulation runner. It advances the runnable attempt by one execution per tick, and keeps a timer only
// while there is runnable work. A second start on the same store returns the first runner's stop. An advance that
// throws fails only that attempt and is reported through onFault; the queue moves on.
import { advanceAttempt, failAttempt, runnableAttemptId } from './attempts.js';

const runners = new WeakMap();

export function startScheduler(store, { tickMs = 600, frozen = false, setTimer = globalThis.setTimeout, clearTimer = globalThis.clearTimeout, onFault = e => console.error(e) } = {}) {
  if (frozen) return () => {};
  if (runners.has(store)) return runners.get(store);

  let timer = null;
  const schedule = () => {
    if (timer === null && runnableAttemptId(store.getState())) timer = setTimer(tick, tickMs);
  };
  const tick = () => {
    timer = null;
    const attemptId = runnableAttemptId(store.getState());
    if (attemptId) {
      try { store.dispatch(advanceAttempt, { attemptId }); } catch (e) { onFault(e); store.dispatch(failAttempt, { attemptId }); }
    }
    schedule();
  };
  const unsubscribe = store.subscribe(schedule);
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (timer !== null) clearTimer(timer);
    timer = null;
    unsubscribe();
    if (runners.get(store) === stop) runners.delete(store);
  };
  runners.set(store, stop);
  schedule();
  return stop;
}
