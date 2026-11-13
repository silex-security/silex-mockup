// The Agent Gym v2 store: the only writer of GymState and of localStorage (docs/agent-gym-v2-contract.md).
//
//   createStore({ storage, seed }) -> { getState, subscribe, dispatch, reset, persistence }
//     storage      a localStorage-like object, or null when the browser refuses access. Saved data that fails
//                  parsePersisted is demo data from another version: it is replaced by the seed, never reported.
//     seed         () => GymState, a fresh fixture state on every call
//     getState()   the current state, deep-frozen. A view or reducer that writes to it throws a TypeError.
//     subscribe(fn) -> unsubscribe. fn(state) runs after every state or persistence change.
//     dispatch(reducer, command) -> { ok: true, state } | { ok: false, error }
//     reset()      re-seeds and rewrites only STORAGE_KEY. Returns the new state.
//     persistence  { mode: 'local' | 'memory' }, updated in place. 'memory' means storage cannot be used at all.
import { SCHEMA_VERSION, FIXTURE_VERSION, STORAGE_KEY } from './model.js';
import { stateProblems } from './integrity.js';

const SHAPE = {
  agents: 'object', environments: 'object', environmentDrafts: 'object', workflows: 'object', variants: 'object', scenarios: 'object',
  scenarioDrafts: 'object', scenarioSets: 'object', experiments: 'object', attempts: 'object', executions: 'object',
  attemptOrder: 'array', seq: 'number',
};

const kindOf = v => Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v;

/** @returns {{ state: object } | { error: string }} */
export function parsePersisted(text) {
  let data;
  try { data = JSON.parse(text); } catch { return { error: 'storage_corrupt' }; }
  if (kindOf(data) !== 'object') return { error: 'storage_corrupt' };
  if (data.schemaVersion !== SCHEMA_VERSION || data.fixtureVersion !== FIXTURE_VERSION) return { error: 'storage_version' };
  for (const [key, kind] of Object.entries(SHAPE)) if (kindOf(data[key]) !== kind) return { error: 'storage_invalid' };
  if (stateProblems(data).length) return { error: 'storage_inconsistent' };
  return { state: data };
}

function pauseRunning(state) {
  const attempts = {};
  for (const [id, a] of Object.entries(state.attempts)) attempts[id] = a.status === 'running' && a.runner !== 'paused' ? { ...a, runner: 'paused' } : a;
  return { ...state, attempts };
}

function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const v of Object.values(value)) deepFreeze(v);
  return value;
}

export function createStore({ storage, seed }) {
  const persistence = { mode: 'local' };
  const subscribers = new Set();
  let state;

  function notify() { for (const fn of [...subscribers]) fn(state); }
  function write() {
    try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { persistence.mode = 'memory'; }
  }
  function save() { if (persistence.mode === 'local') write(); }

  function load() {
    let text;
    try { if (!storage) throw Error('no storage'); text = storage.getItem(STORAGE_KEY); } catch { persistence.mode = 'memory'; return seed(); }
    if (text === null) return seed();
    const parsed = parsePersisted(text);
    if (parsed.error) return seed();
    return pauseRunning(parsed.state);
  }

  state = deepFreeze(load());
  save();

  return {
    persistence,
    getState: () => state,
    subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
    dispatch(reducer, command) {
      const result = reducer(state, command);
      if (result?.error) return { ok: false, error: result.error };
      if (!result?.state) throw TypeError('A reducer returns { state } or { error }');
      if (result.state !== state) { state = deepFreeze(result.state); save(); notify(); }
      return { ok: true, state };
    },
    reset() {
      state = deepFreeze(seed());
      persistence.mode = 'local';
      write();
      notify();
      return state;
    },
  };
}
