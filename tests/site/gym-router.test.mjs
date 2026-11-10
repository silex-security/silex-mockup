// Agent Gym v2 router (docs/agent-gym-v2-contract.md, "Routes"). Pure Node with a fake window.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, href, createRouter, ROUTES } from '../../agent-gym/js/router.js';

const CONTRACT = [
  ['#/workbench/exp-029', 'workbench', { experimentId: 'exp-029' }, {}],
  ['#/environments', 'environment-library', {}, {}],
  ['#/environments/new?returnTo=exp-029&focus=describe', 'environment-builder', {}, { returnTo: 'exp-029', focus: 'describe' }],
  ['#/environments/env-sales/revisions/1.2', 'environment-revision', { id: 'env-sales', rev: '1.2' }, {}],
  ['#/scenarios/new?environment=env-sales@1.2&workflow=wf-sales-follow-up&source=chat&mode=tool_failure', 'scenario-builder', {}, { environment: 'env-sales@1.2', workflow: 'wf-sales-follow-up', source: 'chat', mode: 'tool_failure' }],
  ['#/scenario-sets/set-follow-up-resilience/revisions/1', 'scenario-set', { id: 'set-follow-up-resilience', rev: '1' }, {}],
  ['#/runs?status=all', 'run-list', {}, { status: 'all' }],
  ['#/experiments/exp-029/attempts/attempt-001', 'run-detail', { experimentId: 'exp-029', attemptId: 'attempt-001' }, {}],
  ['#/experiments/exp-029/attempts/attempt-001/results', 'results', { experimentId: 'exp-029', attemptId: 'attempt-001' }, {}],
];

test('every contract route parses to its name, params and query, and href builds the same hash back', () => {
  for (const [hash, name, params, query] of CONTRACT) {
    assert.deepEqual(parse(hash), { name, params, query }, hash);
    assert.equal(href(name, params, query), hash);
  }
  assert.deepEqual(ROUTES.map(r => r.name).filter(n => n !== 'kit').sort(), CONTRACT.map(c => c[1]).sort());
});

test('an empty hash is the default workbench, and an unknown path is not-found', () => {
  for (const hash of ['', '#', '#/']) assert.deepEqual(parse(hash), { name: 'workbench', params: { experimentId: 'exp-029' }, query: {} });
  for (const hash of ['#/nope', '#view=blueprint', '#/workbench', '#/workbench/exp-029/extra', '#/environments/env-sales', '#/experiments/exp-029/attempts'])
    assert.equal(parse(hash).name, 'not-found', hash);
});

test('ids outside the conservative pattern never reach a view', () => {
  const hostile = ['<script>', 'a b', '..', '.hidden', 'x'.repeat(65), 'exp%2F029', 'javascript:alert(1)', 'a"b', "a'b", 'é'];
  for (const id of hostile) assert.equal(parse(`#/workbench/${encodeURIComponent(id)}`).name, 'not-found', id);
  assert.equal(parse('#/workbench/%E0%A4%A').name, 'not-found', 'a malformed escape');
  for (const id of hostile) assert.throws(() => href('workbench', { experimentId: id }), /valid experimentId/, id);
  assert.throws(() => href('workbench', {}), /valid experimentId/);
  assert.throws(() => href('nowhere'), /Unknown route/);
});

test('returnTo accepts an experiment id and drops anything that could be a URL', () => {
  const urls = ['https://evil.example/x', '//evil.example', 'javascript:alert(1)', '/workbench/exp-029', '#/runs', 'exp-029@1', 'exp 029', '../index.html'];
  for (const url of urls) {
    assert.deepEqual(parse(`#/environments/new?returnTo=${encodeURIComponent(url)}`).query, {}, url);
    assert.deepEqual(parse(`#/environments/new?returnTo=${url}`).query, {}, url);
    assert.equal(href('environment-builder', {}, { returnTo: url }), '#/environments/new', url);
  }
  assert.deepEqual(parse('#/environments/new?returnTo=exp-030').query, { returnTo: 'exp-030' });
  assert.deepEqual(parse('#/workbench/exp-029?returnTo=https%3A%2F%2Fevil.example').query, {}, 'on any route, not only the builder');
});

test('query values outside an enum or the safe pattern are dropped, and the rest survive', () => {
  assert.deepEqual(parse('#/runs?status=exploded').query, {});
  assert.deepEqual(parse('#/scenarios/new?source=email&mode=prompt&environment=nope').query, { mode: 'prompt' });
  assert.deepEqual(parse('#/workbench/exp-029?tab=replay&node=draft-email&x=%3Cimg%20onerror%3D1%3E&bad key=1&sel=s1,s2').query, { tab: 'replay', node: 'draft-email', sel: 's1,s2' });
  assert.equal(href('workbench', { experimentId: 'exp-029' }, { tab: 'replay', gone: null, empty: '', n: 2 }), '#/workbench/exp-029?tab=replay&n=2');
});

function fakeWindow(hash = '') {
  const listeners = new Set();
  const stack = [{ hash, state: null }];
  let at = 0;
  const fire = () => { for (const fn of [...listeners]) fn(); };
  return {
    stack,
    get at() { return at; },
    location: {
      get hash() { return stack[at].hash; },
      set hash(value) { const next = value.startsWith('#') ? value : `#${value}`; if (next === stack[at].hash) return; stack.splice(at + 1, Infinity, { hash: next, state: null }); at++; fire(); },
    },
    history: {
      get state() { return stack[at].state; },
      replaceState(state, _title, url) { stack[at] = { hash: url ?? stack[at].hash, state }; },
      go(n) { const to = at + n; if (n && to >= 0 && to < stack.length) { at = to; fire(); } },
      back() { this.go(-1); },
      forward() { this.go(1); },
    },
    addEventListener(type, fn) { if (type === 'hashchange') listeners.add(fn); },
    removeEventListener(type, fn) { listeners.delete(fn); },
    get listenerCount() { return listeners.size; },
  };
}

test('start puts the default route on an empty hash without adding a history entry', () => {
  const win = fakeWindow('');
  const router = createRouter(win);
  router.start();
  assert.equal(win.location.hash, '#/workbench/exp-029');
  assert.equal(win.stack.length, 1);
  assert.equal(router.current().name, 'workbench');
});

test('a deep link is left exactly as it arrived', () => {
  const win = fakeWindow('#/experiments/exp-029/attempts/attempt-001/results?pair=s1-0');
  const router = createRouter(win);
  router.start();
  assert.equal(win.location.hash, '#/experiments/exp-029/attempts/attempt-001/results?pair=s1-0');
  assert.deepEqual(router.current(), { name: 'results', params: { experimentId: 'exp-029', attemptId: 'attempt-001' }, query: { pair: 's1-0' } });
});

test('go notifies once per navigation, and Back and Forward restore the same object, tab and selection', () => {
  const win = fakeWindow('#/workbench/exp-029');
  const router = createRouter(win);
  const seen = [];
  router.subscribe(route => seen.push(`${route.name}:${JSON.stringify(route.params)}:${JSON.stringify(route.query)}`));
  const stop = router.start();

  router.replaceQuery({ tab: 'replay', node: 'draft-email' });
  router.go('environment-revision', { id: 'env-sales', rev: '1.2' }, { tab: 'tools' });
  router.go('run-list', {}, { status: 'running' });
  assert.equal(seen.length, 3);
  assert.equal(win.stack.length, 3, 'replaceQuery adds no history entry');

  win.history.back();
  assert.deepEqual(router.current(), { name: 'environment-revision', params: { id: 'env-sales', rev: '1.2' }, query: { tab: 'tools' } });
  win.history.back();
  assert.deepEqual(router.current(), { name: 'workbench', params: { experimentId: 'exp-029' }, query: { tab: 'replay', node: 'draft-email' } });
  win.history.forward();
  assert.equal(seen.at(-1), 'environment-revision:{"id":"env-sales","rev":"1.2"}:{"tab":"tools"}');
  assert.equal(seen.length, 6);

  router.go('environment-revision', { id: 'env-sales', rev: '1.2' }, { tab: 'tools' });
  assert.equal(seen.length, 6, 'navigating to the current hash is not a change');

  stop();
  assert.equal(win.listenerCount, 0);
});

test('replaceQuery merges a patch, removes null and empty values, and keeps the params', () => {
  const win = fakeWindow('#/workbench/exp-029?tab=blueprint&node=n1');
  const router = createRouter(win);
  router.start();
  router.replaceQuery({ tab: 'replay' });
  assert.equal(win.location.hash, '#/workbench/exp-029?tab=replay&node=n1');
  router.replaceQuery({ node: null, scenario: 'sc-opt-out' });
  assert.equal(win.location.hash, '#/workbench/exp-029?tab=replay&scenario=sc-opt-out');
  router.replaceQuery({ tab: '', scenario: '' });
  assert.equal(win.location.hash, '#/workbench/exp-029');
});

test('replaceQuery on an unknown route leaves the address alone', () => {
  const win = fakeWindow('#/nope');
  const router = createRouter(win);
  router.start();
  router.replaceQuery({ tab: 'x' });
  assert.equal(win.location.hash, '#/nope');
});

test('a leave guard holds a link away, puts the previous hash back, lets same-view changes through, and proceed finishes the trip', () => {
  const win = fakeWindow('#/workbench/exp-029');
  const router = createRouter(win);
  const seen = [];
  router.subscribe(route => seen.push(route.name));
  router.start();
  router.go('environment-builder', {}, { returnTo: 'exp-029' });
  let held = null;
  router.setLeaveGuard((next, proceed) => { if (next.name === 'environment-builder') return false; held = { name: next.name, proceed }; return true; });

  win.location.hash = '#/runs?status=all';
  assert.equal(win.location.hash, '#/environments/new?returnTo=exp-029', 'the address goes back to the builder');
  assert.deepEqual(seen, ['environment-builder'], 'subscribers never saw the held route');
  assert.equal(held.name, 'run-list');

  router.replaceQuery({ tab: 'tools' });
  assert.deepEqual(seen, ['environment-builder', 'environment-builder'], 'a change inside the view is not held');

  held.proceed();
  assert.equal(win.location.hash, '#/runs?status=all');
  assert.deepEqual(seen.at(-1), 'run-list');
});

test('Back and Forward go through the leave guard, and proceed repeats the same step through history', () => {
  const win = fakeWindow('#/workbench/exp-029');
  const router = createRouter(win);
  const seen = [];
  router.subscribe(route => seen.push(route.name));
  router.start();
  router.go('environment-builder');
  router.go('run-list', {}, { status: 'all' });
  win.history.back();
  assert.deepEqual([win.at, seen.at(-1)], [1, 'environment-builder']);

  let held = null;
  router.setLeaveGuard((next, proceed) => { held = { name: next.name, proceed }; return true; });
  win.history.back();
  assert.deepEqual([win.at, win.location.hash, held.name], [1, '#/environments/new', 'workbench'], 'Back was undone');
  win.history.forward();
  assert.deepEqual([win.at, win.location.hash, held.name], [1, '#/environments/new', 'run-list'], 'Forward was undone');
  assert.equal(seen.at(-1), 'environment-builder');

  held.proceed();
  assert.deepEqual([win.at, win.location.hash, win.stack.length, seen.at(-1)], [2, '#/runs?status=all', 3, 'run-list'], 'proceed steps forward, adding no entry');

  router.setLeaveGuard(null);
  win.history.back();
  assert.equal(seen.at(-1), 'environment-builder', 'without a guard nothing is held');
});
