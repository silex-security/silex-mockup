// Speedrun to Agent Gym: a handoff id names an experiment template, accepting it is idempotent, and the route that
// accepts it lands on the new experiment's workbench. The pure parts run in Node, the route runs in headless Chrome
// (skips without Chrome; set CHROME).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openGym } from '../../tools/gym-shot.mjs';
import { seedState } from '../../agent-gym/js/fixtures/index.js';
import { stateProblems } from '../../agent-gym/js/integrity.js';
import { acceptHandoff, handoffExperimentId } from '../../agent-gym/js/experiments/handoff.js';
import { HANDOFFS } from '../../agent-gym/js/fixtures/handoffs.js';
import { experimentStage } from '../../agent-gym/js/selectors.js';
import { SPEEDRUN_REF } from '../../agent-gym/js/model.js';

const UPSTREAM = resolve(dirname(fileURLToPath(import.meta.url)), '../../speedrun/web/upstream/src/lib');
const read = f => readFileSync(resolve(UPSTREAM, f), 'utf8');
const CHANGES = [...read('types.ts').match(/ChangeType = ([^;]+);/)[1].matchAll(/"([a-z-]+)"/g)].map(m => m[1]);
const TEAMS = [...read('data/fixtures.ts').matchAll(/\n\s+id: "([a-z-]+)",\n\s+unitId: "[a-z-]+",\n\s+name: "[^"]+ Team"/g)].map(m => m[1]);

const ok = r => { if (r.error) throw Error(`${r.error.code}: ${r.error.message}`); return r.state; };
const ID = 'refund-retry-timeout';

test('the registry has a template for every team and every kind of change Speedrun can send', () => {
  assert.equal(TEAMS.length, 6);
  assert.equal(CHANGES.length, 4);
  for (const team of TEAMS) for (const change of CHANGES) assert.ok(Object.hasOwn(HANDOFFS, `${team}-${change}`), `${team}-${change}`);
  assert.equal(Object.keys(HANDOFFS).length, TEAMS.length * CHANGES.length, 'and nothing else');
});

test('every template is a consistent pending experiment over workflows, versions and sets Gym already has', () => {
  let state = seedState();
  for (const id of Object.keys(HANDOFFS)) state = ok(acceptHandoff(state, { handoffId: id }));
  assert.deepEqual(stateProblems(state), []);
  for (const id of Object.keys(HANDOFFS)) {
    const exp = state.experiments[handoffExperimentId(id)];
    assert.equal(experimentStage(state, exp.id), 'pending', id);
    assert.equal(exp.source.kind, 'speedrun');
    assert.match(exp.source.ref, SPEEDRUN_REF);
    assert.ok(exp.selectedScenarioIds.length > 0 && exp.variantId, id);
  }
});

test('accepting a handoff adds one pending experiment that names Speedrun as its source; accepting again changes nothing', () => {
  const before = seedState();
  const once = ok(acceptHandoff(before, { handoffId: ID }));
  const exp = once.experiments[handoffExperimentId(ID)];
  assert.equal(exp.id, 'exp-refund-retry-timeout');
  assert.deepEqual(Object.keys(once.experiments).length, Object.keys(before.experiments).length + 1);
  assert.equal(experimentStage(once, exp.id), 'pending');
  assert.deepEqual(once.attemptOrder, before.attemptOrder, 'no attempt is created');
  assert.equal(exp.number, Math.max(...Object.values(before.experiments).map(e => e.number)) + 1, 'numbered after the newest experiment');
  assert.deepEqual(exp.source, { kind: 'speedrun', label: 'Speedrun trace: Refund Team, retry and timeout', ref: '/speedrun/teams/refund/trace' });
  assert.deepEqual(stateProblems(once), []);
  const twice = acceptHandoff(once, { handoffId: ID });
  assert.equal(twice.state, once, 'the second accept returns the very same state');
});

test('a second accept leaves an experiment the visitor already edited alone', () => {
  const once = ok(acceptHandoff(seedState(), { handoffId: ID }));
  const edited = { ...once, experiments: { ...once.experiments, [handoffExperimentId(ID)]: { ...once.experiments[handoffExperimentId(ID)], title: 'Mine', draftRevision: 4 } } };
  assert.equal(acceptHandoff(edited, { handoffId: ID }).state.experiments[handoffExperimentId(ID)].title, 'Mine');
});

test('an unknown handoff id is a typed error and changes nothing, including names an object would answer to', () => {
  for (const handoffId of ['nope', 'constructor', '__proto__', 'toString', '', undefined]) {
    const r = acceptHandoff(seedState(), { handoffId });
    assert.equal(r.error?.code, 'handoff_unknown', String(handoffId));
    assert.equal(r.state, undefined);
  }
});

async function withGym(t, fn) {
  let gym;
  try { gym = await openGym(); } catch (e) {
    if (/Chrome not found/.test(e.message)) return t.skip('no Chrome binary (set CHROME); headless check skipped');
    throw e;
  }
  try {
    await gym.size(1440, 900);
    await gym.go('#/kit');
    await gym.ev('localStorage.clear()');
    await fn(gym);
    assert.deepEqual(gym.problems(), [], 'no page errors and no failed requests');
  } finally { await gym.close(); }
}
const settle = 'await new Promise(r => setTimeout(r, 150));';

test('the handoff route accepts once and replaces itself with the new workbench; opening it again adds nothing', async t => withGym(t, async gym => {
  const count = () => gym.ev('return Object.keys(window.__gym.store.getState().experiments).length');
  const base = await count();
  await gym.go('#/kit');
  await gym.ev(`location.hash = '#/handoff/speedrun/${ID}'; ` + settle);
  assert.equal(await gym.ev('return location.hash'), '#/workbench/exp-refund-retry-timeout');
  assert.equal(await count(), base + 1);
  const page = await gym.ev(`return { h1: document.querySelector('.gym-main h1').textContent, title: document.querySelector('.wb-title__input').value,
    link: document.querySelector('.wb-head a[data-source-link]')?.getAttribute('href') };`);
  assert.equal(page.h1, 'Experiment Workbench');
  assert.equal(page.title, 'Refund Team · Retry & timeout');
  assert.equal(page.link, '../index.html#view=speedrun&path=%2Fspeedrun%2Fteams%2Frefund%2Ftrace');
  await gym.ev('history.back(); ' + settle);
  assert.equal(await gym.ev('return location.hash'), '#/kit', 'Back skips the handoff route');
  await gym.ev(`location.hash = '#/handoff/speedrun/${ID}'; ` + settle);
  assert.equal(await count(), base + 1, 'the second visit finds the experiment');
  await gym.go('#/experiments');
  const row = await gym.ev(`const tr = document.querySelector('.xq-row[data-experiment="exp-refund-retry-timeout"]');
    return tr && { stage: tr.dataset.stage, source: tr.querySelector('td[data-label="Source"]').innerText.replace(/\\s+/g, ' ').trim() };`);
  assert.deepEqual(row, { stage: 'pending', source: 'Speedrun Speedrun trace: Refund Team, retry and timeout View source in Speedrun' });
}));

test('an unknown or malformed handoff id renders the not-found panel and shows nothing from the URL', async t => withGym(t, async gym => {
  const count = () => gym.ev('return Object.keys(window.__gym.store.getState().experiments).length');
  const base = await count();
  for (const id of ['no-such-handoff', 'a%2Fb', 'x'.repeat(80)]) {
    await gym.go('#/handoff/speedrun/' + id);
    await gym.ev(settle);
    const main = await gym.ev(`return document.querySelector('.gym-main').innerText.replace(/\\s+/g, ' ').trim()`);
    assert.match(main, /^Page not found/, id);
    assert.ok(!main.includes(decodeURIComponent(id).slice(0, 8)), 'the id is not echoed');
  }
  assert.equal(await count(), base);
}));
