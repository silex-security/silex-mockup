// Agent Gym v2 store (docs/agent-gym-v2-contract.md, "State and reducers"). Pure Node: a tiny seed and a fake storage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../agent-gym/js/store.js';
import { SCHEMA_VERSION, FIXTURE_VERSION, STORAGE_KEY } from '../../agent-gym/js/model.js';

const attempt = (id, status, runner = 'active') => ({ id, status, runner, cursor: 0 });
const seed = () => ({
  schemaVersion: SCHEMA_VERSION, fixtureVersion: FIXTURE_VERSION,
  environments: {}, environmentDrafts: {}, workflows: {}, variants: {}, scenarios: {}, scenarioDrafts: {}, scenarioSets: {},
  experiments: { 'exp-1': { id: 'exp-1', title: 'Seeded', repetitions: 3 } },
  attempts: { a1: attempt('a1', 'running'), a2: attempt('a2', 'queued'), a3: attempt('a3', 'completed') },
  attemptOrder: ['a1', 'a2', 'a3'], executions: {}, seq: 3,
});

function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data, writes: [],
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem(key, value) { this.writes.push(key); data.set(key, String(value)); },
    removeItem: key => data.delete(key),
    clear() { throw Error('the store must never call localStorage.clear()'); },
  };
}
const saved = storage => JSON.parse(storage.data.get(STORAGE_KEY));
const rename = (state, { title }) => title ? { state: { ...state, experiments: { ...state.experiments, 'exp-1': { ...state.experiments['exp-1'], title } } } } : { error: { code: 'title_required', message: 'Give the experiment a title.' } };

test('a first visit seeds the state, saves it under the Gym key and reports local mode', () => {
  const storage = fakeStorage({ 'bs.other': 'keep' });
  const store = createStore({ storage, seed });
  assert.equal(store.getState().experiments['exp-1'].title, 'Seeded');
  assert.deepEqual({ mode: store.persistence.mode, error: store.persistence.error }, { mode: 'local', error: null });
  assert.equal(saved(storage).seq, 3);
  assert.deepEqual([...new Set(storage.writes)], [STORAGE_KEY]);
  assert.equal(store.getState().attempts.a1.runner, 'active', 'a fresh seed is not a refresh, so nothing is paused');
});

test('a successful dispatch replaces the state, persists it and notifies subscribers once', () => {
  const storage = fakeStorage();
  const store = createStore({ storage, seed });
  const seen = [];
  const unsubscribe = store.subscribe(state => seen.push(state.experiments['exp-1'].title));
  const result = store.dispatch(rename, { title: 'Renamed' });
  assert.equal(result.ok, true);
  assert.equal(result.state, store.getState());
  assert.equal(saved(storage).experiments['exp-1'].title, 'Renamed');
  assert.deepEqual(seen, ['Renamed']);
  unsubscribe();
  store.dispatch(rename, { title: 'Again' });
  assert.deepEqual(seen, ['Renamed'], 'an unsubscribed listener hears nothing more');
});

test('a failed dispatch returns the typed error and changes nothing', () => {
  const storage = fakeStorage();
  const store = createStore({ storage, seed });
  const before = store.getState(), writes = storage.writes.length;
  let calls = 0;
  store.subscribe(() => calls++);
  const result = store.dispatch(rename, { title: '' });
  assert.deepEqual(result, { ok: false, error: { code: 'title_required', message: 'Give the experiment a title.' } });
  assert.equal(store.getState(), before);
  assert.equal(storage.writes.length, writes);
  assert.equal(calls, 0);
});

test('state handed to views and reducers is deep-frozen, so a stray write throws instead of corrupting the store', () => {
  const store = createStore({ storage: fakeStorage(), seed });
  const state = store.getState();
  assert.throws(() => { state.seq = 99; }, TypeError);
  assert.throws(() => { state.experiments['exp-1'].title = 'Hacked'; }, TypeError);
  assert.throws(() => { state.attemptOrder.push('a9'); }, TypeError);
  assert.throws(() => store.dispatch(s => { s.attempts.a1.cursor = 5; return { state: s }; }, {}), TypeError);
  assert.equal(store.getState().experiments['exp-1'].title, 'Seeded');
  assert.equal(store.getState().attempts.a1.cursor, 0);
  store.dispatch(rename, { title: 'Next' });
  assert.throws(() => { store.getState().experiments['exp-1'].title = 'Hacked'; }, TypeError, 'state from a reducer is frozen too');
});

test('a refresh restores saved state and pauses every running attempt, and only those', () => {
  const storage = fakeStorage();
  createStore({ storage, seed }).dispatch(rename, { title: 'Kept across refresh' });
  const store = createStore({ storage, seed });
  const { attempts, experiments } = store.getState();
  assert.equal(experiments['exp-1'].title, 'Kept across refresh');
  assert.deepEqual([attempts.a1.runner, attempts.a2.runner, attempts.a3.runner], ['paused', 'active', 'active']);
  assert.equal(attempts.a1.status, 'running');
  assert.equal(saved(storage).attempts.a1.runner, 'paused');
  assert.equal(store.persistence.mode, 'local');
});

const bad = {
  storage_corrupt: '{"schemaVersion":',
  'storage_corrupt (not an object)': '[1,2]',
  'storage_version (schema)': JSON.stringify({ ...seed(), schemaVersion: SCHEMA_VERSION + 1 }),
  'storage_version (fixture)': JSON.stringify({ ...seed(), fixtureVersion: 'gym-fx-0' }),
  'storage_invalid (missing key)': JSON.stringify({ ...seed(), attempts: undefined }),
  'storage_invalid (wrong type)': JSON.stringify({ ...seed(), attemptOrder: {} }),
};
for (const [label, text] of Object.entries(bad)) {
  test(`saved data that fails the load check falls back to memory mode: ${label}`, () => {
    const storage = fakeStorage({ [STORAGE_KEY]: text });
    const store = createStore({ storage, seed });
    assert.equal(store.persistence.mode, 'memory');
    assert.equal(store.persistence.error.code, label.split(' ')[0]);
    assert.ok(store.persistence.error.message.length > 20);
    assert.equal(store.getState().experiments['exp-1'].title, 'Seeded');
    assert.equal(store.dispatch(rename, { title: 'In memory' }).ok, true);
    assert.equal(storage.data.get(STORAGE_KEY), text, 'memory mode leaves the unreadable data alone');
  });
}

test('storage that is missing or throws on read falls back to memory mode', () => {
  for (const storage of [null, undefined, { getItem() { throw new DOMException('denied', 'SecurityError'); }, setItem() {} }]) {
    const store = createStore({ storage, seed });
    assert.equal(store.persistence.mode, 'memory');
    assert.equal(store.persistence.error.code, 'storage_unavailable');
    assert.equal(store.dispatch(rename, { title: 'Still works' }).ok, true);
    assert.equal(store.getState().experiments['exp-1'].title, 'Still works');
  }
});

test('a quota error on write keeps the new state in memory, switches mode and tells subscribers', () => {
  const storage = fakeStorage();
  const store = createStore({ storage, seed });
  storage.setItem = () => { throw new DOMException('The quota has been exceeded.', 'QuotaExceededError'); };
  let seenMode;
  store.subscribe(() => { seenMode = store.persistence.mode; });
  const result = store.dispatch(rename, { title: 'Too big' });
  assert.equal(result.ok, true);
  assert.equal(store.getState().experiments['exp-1'].title, 'Too big');
  assert.equal(store.persistence.mode, 'memory');
  assert.equal(store.persistence.error.code, 'storage_quota');
  assert.equal(seenMode, 'memory');
  assert.equal(saved(storage).experiments['exp-1'].title, 'Seeded', 'the last good save is untouched');
});

test('dismissError clears the message but stays in memory mode', () => {
  const store = createStore({ storage: null, seed });
  let calls = 0;
  store.subscribe(() => calls++);
  store.persistence.dismissError();
  assert.equal(store.persistence.error, null);
  assert.equal(store.persistence.mode, 'memory');
  assert.equal(calls, 1);
});

test('reset re-seeds, rewrites only the Gym key and recovers from unreadable saved data', () => {
  const storage = fakeStorage({ [STORAGE_KEY]: 'not json', 'bs.blueprints': 'old site data' });
  const store = createStore({ storage, seed });
  store.dispatch(rename, { title: 'Scratch' });
  let calls = 0;
  store.subscribe(() => calls++);
  store.reset();
  assert.equal(store.getState().experiments['exp-1'].title, 'Seeded');
  assert.deepEqual({ mode: store.persistence.mode, error: store.persistence.error }, { mode: 'local', error: null });
  assert.equal(saved(storage).experiments['exp-1'].title, 'Seeded');
  assert.equal(storage.data.get('bs.blueprints'), 'old site data');
  assert.deepEqual([...new Set(storage.writes)], [STORAGE_KEY]);
  assert.equal(calls, 1);
  assert.equal(store.dispatch(rename, { title: 'Saved again' }).ok, true);
  assert.equal(saved(storage).experiments['exp-1'].title, 'Saved again');
});

test('reset without storage stays in memory mode and says so', () => {
  const store = createStore({ storage: null, seed });
  store.persistence.dismissError();
  store.reset();
  assert.equal(store.persistence.mode, 'memory');
  assert.equal(store.persistence.error.code, 'storage_unavailable');
});

test('a reducer that returns neither state nor error is a programming error', () => {
  const store = createStore({ storage: fakeStorage(), seed });
  assert.throws(() => store.dispatch(() => ({}), {}), TypeError);
});
