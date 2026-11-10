// Agent Gym v2 scheduler (contract "Simulation interface"; plan 4.5, 7.4). A fake store and injected timers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedState } from '../../agent-gym/js/fixtures/index.js';
import { cancelAttempt, pauseAttempt } from '../../agent-gym/js/simulation/attempts.js';
import { startScheduler } from '../../agent-gym/js/simulation/scheduler.js';

function fakeStore(initial) {
  let state = initial;
  const subs = new Set();
  return {
    subs,
    getState: () => state,
    subscribe: fn => { subs.add(fn); return () => subs.delete(fn); },
    dispatch(reducer, command) {
      const r = reducer(state, command);
      if (r.error) return { ok: false, error: r.error };
      state = r.state;
      subs.forEach(fn => fn());
      return { ok: true, state };
    },
  };
}

function fakeTimers() {
  const pending = new Map();
  let next = 0;
  return {
    pending,
    setTimer: fn => { pending.set(++next, fn); return next; },
    clearTimer: id => { pending.delete(id); },
    tick() { const [id, fn] = pending.entries().next().value; pending.delete(id); fn(); },
  };
}

const total = state => Object.values(state.executions).reduce((n, list) => n + list.length, 0);
const byTitle = (state, title) => Object.values(state.attempts).find(a => a.title === title);

test('one execution per tick, in queue order, then the next queued attempt runs', () => {
  const store = fakeStore(seedState());
  const timers = fakeTimers();
  const stop = startScheduler(store, timers);
  assert.equal(timers.pending.size, 1);
  const start = total(store.getState());
  for (let i = 1; i <= 6; i++) {
    timers.tick();
    assert.equal(total(store.getState()), start + i);
    assert.equal(timers.pending.size, 1, 'never more than one timer');
  }
  const sales = byTitle(store.getState(), 'Sales follow-up · Variant A');
  const support = byTitle(store.getState(), 'Support triage comparison');
  assert.deepEqual([sales.status, sales.cursor, support.status], ['completed', 18, 'running']);
  timers.tick();
  assert.equal(store.getState().executions[support.id].length, 1);
  stop();
});

test('frozen never ticks', () => {
  const store = fakeStore(seedState());
  const timers = fakeTimers();
  const before = store.getState();
  startScheduler(store, { ...timers, frozen: true })();
  assert.equal(timers.pending.size, 0);
  assert.equal(store.subs.size, 0);
  assert.equal(store.getState(), before);
});

test('starting twice does not create a second runner', () => {
  const store = fakeStore(seedState());
  const timers = fakeTimers();
  const stop1 = startScheduler(store, timers);
  const stop2 = startScheduler(store, timers);
  assert.equal(stop1, stop2);
  assert.equal(timers.pending.size, 1);
  assert.equal(store.subs.size, 1);
  stop1();
  assert.equal(timers.pending.size, 0, 'stop clears the timer');
  assert.equal(store.subs.size, 0, 'stop removes the subscription');
  const stop3 = startScheduler(store, timers);
  stop2();
  assert.equal(store.subs.size, 1, 'a stale stop does not stop the new runner');
  stop3();
});

test('a paused running attempt holds the slot; cancelling it lets the queue move', () => {
  const store = fakeStore(seedState());
  const timers = fakeTimers();
  const stop = startScheduler(store, timers);
  const sales = byTitle(store.getState(), 'Sales follow-up · Variant A');
  store.dispatch(pauseAttempt, { attemptId: sales.id });
  const before = total(store.getState());
  while (timers.pending.size) timers.tick();
  assert.equal(total(store.getState()), before, 'nothing runs while the running attempt is paused');
  store.dispatch(cancelAttempt, { attemptId: sales.id });
  assert.equal(timers.pending.size, 1, 'the queued attempt becomes runnable');
  timers.tick();
  const support = byTitle(store.getState(), 'Support triage comparison');
  assert.deepEqual([support.status, store.getState().executions[support.id].length], ['running', 1]);
  assert.equal(store.getState().executions[sales.id].length, 12, 'the cancelled attempt keeps its 12 executions');
  stop();
});
