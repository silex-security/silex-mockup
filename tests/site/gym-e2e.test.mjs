// Plan 13.2 path A across all screens in headless Chrome: a new environment template and a new five-scenario set
// are each put on Experiment 029 by an explicit choice, the workbench recounts to 30 runs, and Run freezes exactly
// that input. Skips without Chrome.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openGym } from '../../tools/gym-shot.mjs';

const HELPERS = `
  const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const text = el => el.textContent.replace(/\\s+/g, ' ').trim();
  const state = () => window.__gym.store.getState();
  const press = async (label, scope = document) => {
    const el = [...scope.querySelectorAll('button, a')].find(b => text(b) === label && b.getAttribute('aria-disabled') !== 'true');
    if (!el) throw Error('no enabled control: ' + label);
    el.click(); await frame(); await new Promise(r => setTimeout(r, 60));
  };
  const key = async k => { const el = document.querySelector('[data-focus-key="' + k + '"]'); if (!el) throw Error('no ' + k); el.click(); await frame(); await new Promise(r => setTimeout(r, 60)); };
  const dialog = () => document.querySelector('dialog[open]');
  const main = () => text(document.querySelector('#gym-main'));
`;
const run = (gym, body) => gym.ev(HELPERS + body);

test('a new environment and a new scenario set reach the workbench only by choice, and Run freezes them', async t => {
  let gym;
  try { gym = await openGym(); } catch (e) {
    if (/Chrome not found/.test(e.message)) return t.skip('no Chrome binary (set CHROME); headless check skipped');
    throw e;
  }
  try {
    await gym.size(1585, 992);
    await gym.go('#/kit');
    await gym.ev('localStorage.clear()');
    await gym.go('#/workbench/exp-029');

    const start = await run(gym, 'return main();');
    assert.match(start, /2 versions × 3 scenarios × 3 repetitions = 18 runs/);
    assert.match(start, /Dependencies matched/);
    assert.match(start, /1 running.*1 queued.*1 completed/);

    await run(gym, `await press('Create', document.querySelector('.wb-env, #gym-main'));`);
    assert.match(await gym.ev('return location.hash'), /^#\/environments\/new\?.*returnTo=exp-029/);
    const env = await run(gym, `
      const before = main();
      await press('Confirm behavior');
      await press('Validate environment');
      await press('Save as template');
      const beforeChoice = state().experiments['exp-029'].environmentRef;
      await press('Use in experiment', dialog());
      return { before, beforeChoice, hash: location.hash, ref: state().experiments['exp-029'].environmentRef, page: main() };`);
    assert.match(env.before, /3 components ready/);
    assert.match(env.before, /1 assumption to confirm/);
    assert.deepEqual(env.beforeChoice, { id: 'env-sales', rev: '1.2' }, 'saving a template does not switch the experiment');
    assert.match(env.hash, /^#\/workbench\/exp-029/);
    assert.equal(env.ref.id, 'tpl-sales-operations');
    assert.match(env.page, /Dependencies matched/, 'the new template satisfies the Sales follow-up workflow');
    assert.match(env.page, /= 18 runs/);

    await run(gym, `await press('Generate variations');`);
    assert.match(await gym.ev('return location.hash'), /^#\/scenarios\/new\?/);
    const scenario = await run(gym, `
      const before = main();
      await key('sc:review-foot');
      for (const id of ['v2', 'v3', 'v4']) await key('sc-review:confirm:' + id);
      await key('sc-review:save');
      const beforeChoice = state().experiments['exp-029'].selectedScenarioIds.length;
      await press('Use in experiment', dialog());
      return { before, beforeChoice, hash: location.hash, page: main(), selected: state().experiments['exp-029'].selectedScenarioIds.length };`);
    assert.match(scenario.before, /4 generated · 4 selected/);
    assert.match(scenario.before, /1 base scenario \+ 4 variations = 5 scenarios/);
    assert.equal(scenario.beforeChoice, 3, 'saving a set does not replace the current set');
    assert.match(scenario.hash, /^#\/workbench\/exp-029/);
    assert.equal(scenario.selected, 5);
    assert.match(scenario.page, /2 versions × 5 scenarios × 3 repetitions = 30 runs/);
    assert.match(scenario.page, /5 selected/);
    assert.doesNotMatch(scenario.page, /18 runs/);

    const ran = await run(gym, `
      const before = state().attemptOrder.length;
      const btn = [...document.querySelectorAll('button')].find(b => text(b) === 'Run simulation');
      btn.click(); btn.click(); await frame(); await new Promise(r => setTimeout(r, 120));
      const s = state(); const added = s.attemptOrder.slice(before).map(id => s.attempts[id]);
      return { count: added.length, plan: added[0]?.plan.length, status: added[0]?.status, env: added[0]?.inputSnapshot.environment.id, scenarios: added[0]?.inputSnapshot.scenarios.length, page: main() };`);
    assert.equal(ran.count, 1, 'a double click enqueues one attempt');
    assert.equal(ran.plan, 30);
    assert.equal(ran.status, 'queued');
    assert.equal(ran.env, 'tpl-sales-operations');
    assert.equal(ran.scenarios, 5);
    assert.match(ran.page, /2 queued/);

    await gym.go('#/workbench/exp-029');
    const reloaded = await run(gym, 'return { page: main(), attempts: state().attemptOrder.length };');
    assert.match(reloaded.page, /= 30 runs/, 'the draft survives a refresh');
    assert.equal(reloaded.attempts, 4);

    assert.deepEqual(gym.problems(), [], 'no page errors and no failed requests');
  } finally { await gym.close(); }
});
