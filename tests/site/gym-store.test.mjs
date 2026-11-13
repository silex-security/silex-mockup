// Agent Gym v2 store (docs/agent-gym-v2-contract.md, "State and reducers"). Pure Node: a tiny seed and a fake storage;
// tests that reload saved data use the real seed, because the load check reads its references.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, parsePersisted } from '../../agent-gym/js/store.js';
import { SCHEMA_VERSION, FIXTURE_VERSION, STORAGE_KEY } from '../../agent-gym/js/model.js';
import { seedState } from '../../agent-gym/js/fixtures/index.js';
import { renameExperiment } from '../../agent-gym/js/simulation/attempts.js';

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
  assert.deepEqual(store.persistence, { mode: 'local' });
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
  createStore({ storage, seed: seedState }).dispatch(renameExperiment, { experimentId: 'exp-029', title: 'Kept across refresh' });
  const store = createStore({ storage, seed: seedState });
  const { attempts, experiments } = store.getState();
  assert.equal(store.persistence.mode, 'local');
  assert.equal(experiments['exp-029'].title, 'Kept across refresh');
  const order = ['attempt-001', 'attempt-002', 'attempt-003'];
  assert.deepEqual(order.map(id => [attempts[id].status, attempts[id].runner]), [['completed', 'active'], ['running', 'paused'], ['queued', 'active']]);
  assert.equal(saved(storage).attempts['attempt-002'].runner, 'paused');
});

const good = seedState();
const corrupt = {
  'attemptOrder names a missing attempt': s => { s.attemptOrder.push('attempt-999'); },
  'an attempt missing from attemptOrder': s => { s.attemptOrder.pop(); },
  'an attempt without a snapshot': s => { s.attempts['attempt-001'].inputSnapshot = null; },
  'an attempt without a plan': s => { delete s.attempts['attempt-001'].plan; },
  'executions under an unknown attempt': s => { s.executions['attempt-404'] = []; },
  'an execution without the fields the comparison reads': s => { s.executions['attempt-001'][0].finalState = {}; },
  'an execution with an unknown terminal state': s => { s.executions['attempt-001'][0].terminalState = 'maybe'; },
  'an experiment whose environment does not exist': s => { s.environments = {}; },
  'an experiment whose set does not exist': s => { s.experiments['exp-029'].scenarioSetRef = { id: 'set-gone', rev: '1' }; },
  'selected scenario ids that are not a list': s => { s.experiments['exp-029'].selectedScenarioIds = 'sc-base-case'; },
  'a set with a duplicate ref': s => { const set = s.scenarioSets['set-follow-up-resilience@1']; set.scenarioRefs.push(set.scenarioRefs[0]); },
  'a set with a dangling ref': s => { delete s.scenarios['sc-contact-opted-out@1']; },
  'seq behind the attempt ids': s => { s.seq = 0; },
};
const expectReplaced = (text, build) => {
  const storage = fakeStorage({ [STORAGE_KEY]: text, 'bs.other': 'keep' });
  const store = createStore({ storage, seed: build });
  assert.deepEqual(store.persistence, { mode: 'local' });
  assert.deepEqual(store.getState(), build(), 'the session starts from the seed');
  assert.ok(parsePersisted(storage.data.get(STORAGE_KEY)).state, 'the stale blob was overwritten with one the loader accepts');
  assert.equal(storage.data.get('bs.other'), 'keep');
  const again = createStore({ storage, seed: build });
  assert.deepEqual(again.persistence, { mode: 'local' });
  assert.deepEqual(again.getState().experiments, build().experiments, 'a second load reads the repaired blob');
  assert.deepEqual(again.getState().attemptOrder, build().attemptOrder);
  assert.deepEqual([...new Set(storage.writes)], [STORAGE_KEY]);
};

for (const [label, mutate] of Object.entries(corrupt)) {
  test(`saved data that is broken inside is replaced by the seed: ${label}`, () => {
    const data = structuredClone(good);
    mutate(data);
    expectReplaced(JSON.stringify(data), seedState);
  });
}

const bad = {
  storage_corrupt: '{"schemaVersion":',
  'storage_corrupt (not an object)': '[1,2]',
  'storage_version (schema)': JSON.stringify({ ...good, schemaVersion: SCHEMA_VERSION + 1 }),
  'storage_version (fixture)': JSON.stringify({ ...good, fixtureVersion: 'gym-fx-0' }),
  'storage_invalid (missing key)': JSON.stringify({ ...good, attempts: undefined }),
  'storage_invalid (wrong type)': JSON.stringify({ ...good, attemptOrder: {} }),
};
for (const [label, text] of Object.entries(bad)) {
  test(`saved data that fails the load check is replaced by the seed: ${label}`, () => {
    expectReplaced(text, seedState);
    const storage = fakeStorage({ [STORAGE_KEY]: text });
    const store = createStore({ storage, seed: seedState });
    assert.equal(store.dispatch(renameExperiment, { experimentId: 'exp-029', title: 'Saved' }).ok, true);
    assert.equal(saved(storage).experiments['exp-029'].title, 'Saved', 'changes after the repair are saved');
  });
}

test('storage that is missing or throws on read falls back to memory mode', () => {
  for (const storage of [null, undefined, { getItem() { throw new DOMException('denied', 'SecurityError'); }, setItem() {} }]) {
    const store = createStore({ storage, seed });
    assert.deepEqual(store.persistence, { mode: 'memory' });
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
  assert.deepEqual(store.persistence, { mode: 'memory' });
  assert.equal(seenMode, 'memory');
  assert.equal(saved(storage).experiments['exp-1'].title, 'Seeded', 'the last good save is untouched');
});

test('reset re-seeds, rewrites only the Gym key and recovers from unreadable saved data', () => {
  const storage = fakeStorage({ [STORAGE_KEY]: 'not json', 'bs.blueprints': 'old site data' });
  const store = createStore({ storage, seed });
  store.dispatch(rename, { title: 'Scratch' });
  let calls = 0;
  store.subscribe(() => calls++);
  store.reset();
  assert.equal(store.getState().experiments['exp-1'].title, 'Seeded');
  assert.deepEqual(store.persistence, { mode: 'local' });
  assert.equal(saved(storage).experiments['exp-1'].title, 'Seeded');
  assert.equal(storage.data.get('bs.blueprints'), 'old site data');
  assert.deepEqual([...new Set(storage.writes)], [STORAGE_KEY]);
  assert.equal(calls, 1);
  assert.equal(store.dispatch(rename, { title: 'Saved again' }).ok, true);
  assert.equal(saved(storage).experiments['exp-1'].title, 'Saved again');
});

test('reset without storage stays in memory mode', () => {
  const store = createStore({ storage: null, seed });
  store.reset();
  assert.deepEqual(store.persistence, { mode: 'memory' });
});

test('a reducer that returns neither state nor error is a programming error', () => {
  const store = createStore({ storage: fakeStorage(), seed });
  assert.throws(() => store.dispatch(() => ({}), {}), TypeError);
});
