// Shared-agent impact in the real page: the chip next to the changed step, the impact panel, one press of "Check shared
// workflows", the scheduler finishing the impact runs, and the new acceptance check resolving on Results. Skips cleanly
// without Chrome (set CHROME).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openGym } from '../../tools/gym-shot.mjs';
import { until } from './ontology-card/browser.mjs';

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

const impactRows = gym => gym.ev(`return [...document.querySelectorAll('.wb-impact__table tbody tr')].map(tr => [tr.querySelector('th').textContent, tr.dataset.state])`);
const press = gym => gym.ev(`document.querySelector('[data-focus-key="wb:impact-check"]').click(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));`);
const impactAttempts = gym => gym.ev(`return Object.values(window.__gym.store.getState().attempts).filter(a => a.impactOf?.experimentId === 'exp-029').map(a => [a.inputSnapshot.workflow.name, a.status])`);

test('the strip marks the shared step and the panel lists the other workflows, not run yet', async t => withGym(t, async gym => {
  await gym.go('#/workbench/exp-029');
  assert.equal(await gym.ev(`return document.querySelector('.wb-changes__table tbody tr:first-child th').textContent.trim()`), 'Draft emailShared · 2 other workflows');
  assert.deepEqual((await impactRows(gym)).sort(), [['Invoice review', 'not_run'], ['Support triage v2', 'not_run']]);
  assert.equal(await gym.ev(`return document.querySelector('.wb-impact__count').textContent`), "26 check runs, counted apart from this experiment's 18 runs");
  assert.equal(await gym.ev(`return document.querySelector('.wb-impact__agents').textContent.replace(/\\s+/g, ' ')`), 'Correspondence agent changes model, timeoutRecovery');
}));

test('a seeded finished check shows its result line, and a workflow that cannot take the change says why', async t => withGym(t, async gym => {
  await gym.go('#/workbench/exp-025');
  const rows = await gym.ev(`return [...document.querySelectorAll('.wb-impact__table tbody tr')].map(tr => [tr.querySelector('th').textContent, tr.dataset.state, tr.lastElementChild.textContent.replace(/\\s+/g, ' ').trim()])`);
  assert.deepEqual(rows.find(r => r[0] === 'Invoice review'), ['Invoice review', 'done', '0 improved · 1 regressed of 5 pairsView results']);
  await gym.go('#/workbench/exp-027');
  const cannot = await gym.ev(`return { state: document.querySelector('.wb-impact__table tbody tr').dataset.state, text: document.querySelector('.wb-impact__table tbody tr').lastElementChild.textContent,
    disabled: document.querySelector('[data-focus-key="wb:impact-check"]').getAttribute('aria-disabled'), why: document.querySelector('.wb-impact__why').textContent }`);
  assert.equal(cannot.state, 'not_comparable');
  assert.match(cannot.text, /Schedule payment has no model or timeoutRecovery setting/);
  assert.equal(cannot.disabled, 'true');
  assert.match(cannot.why, /No other workflow can take this change/);
}));

test('Results: a seeded regression fails the shared-agents check and links to the impact runs', async t => withGym(t, async gym => {
  await gym.go('#/experiments/exp-025/attempts/attempt-005/results');
  const check = await gym.ev(`const li = document.querySelector('.run-accept__check[data-check="shared-agents"]');
    return { passed: li.dataset.passed, state: li.dataset.state, text: li.textContent.replace(/\\s+/g, ' ').trim(), links: [...li.querySelectorAll('a')].map(a => [a.textContent, a.getAttribute('href')]) }`);
  assert.deepEqual([check.passed, check.state], ['false', 'failed']);
  assert.match(check.text, /No regression in workflows that share the agent\s*1 regressed pair in 1 workflow/);
  assert.deepEqual(check.links, [['Sales follow-up run', '#/experiments/exp-025/attempts/attempt-009/results'], ['Invoice review run', '#/experiments/exp-025/attempts/attempt-010/results']]);
  await gym.go('#/experiments');
  assert.match(await gym.ev(`return document.querySelector('.xq-row[data-experiment="exp-025"] td[data-label="Progress or result"]').innerText`), /shared workflows: 1 regressed/);
}));

test('Runs: impact attempts say which experiment they belong to', async t => withGym(t, async gym => {
  await gym.go('#/runs?status=all');
  const marked = await gym.ev(`return [...document.querySelectorAll('.run-list__row')].filter(r => r.querySelector('.run-list__impact')).map(r => [r.dataset.attempt, r.querySelector('.run-list__impact').textContent.replace(/\\s+/g, ' ').trim()])`);
  assert.deepEqual(marked.sort(), [['attempt-007', 'Shared check for exp-024'], ['attempt-008', 'Shared check for exp-024'], ['attempt-009', 'Shared check for exp-025'], ['attempt-010', 'Shared check for exp-025']]);
}));

test('Check shared workflows: pressing twice queues once, the scheduler runs the checks, and the acceptance check resolves', async t => withGym(t, async gym => {
  await gym.go('#/workbench/exp-029', { search: '' });
  await gym.ev(`const m = await import('/agent-gym/js/simulation/attempts.js'); window.__gym.store.dispatch(m.cancelAttempt, { attemptId: 'attempt-003' });`);
  await press(gym);
  await press(gym);
  assert.deepEqual((await impactAttempts(gym)).map(a => a[0]).sort(), ['Invoice review', 'Support triage v2'], 'two presses, one check per workflow');
  assert.deepEqual((await impactRows(gym)).map(r => r[1]).sort(), ['queued', 'queued']);
  assert.equal(await gym.ev(`return document.querySelector('[data-focus-key="wb:impact-check"]').getAttribute('aria-disabled')`), 'true', 'the button is held while the check is queued');
  // Polled from here in short calls: one browser call is cut off at 30 s, about what the scheduler needs.
  await until(() => gym.ev(`const a = Object.values(window.__gym.store.getState().attempts); return a.filter(x => x.impactOf).length >= 6 && a.every(x => !['queued', 'running'].includes(x.status))`), 'the scheduler finishes the impact runs', 90000);
  assert.deepEqual((await impactAttempts(gym)).map(a => a[1]), ['completed', 'completed']);
  assert.deepEqual((await impactRows(gym)).map(r => r[1]).sort(), ['done', 'done']);

  await gym.go('#/experiments/exp-029/attempts/attempt-002/results', { search: '' });
  const check = await gym.ev(`const li = document.querySelector('.run-accept__check[data-check="shared-agents"]'); return [li.dataset.state, li.dataset.passed]`);
  assert.deepEqual(check, ['passed', 'true']);
}));

test('the impact panel, the strip chip and the impact rows never scroll the page sideways, standalone and embedded', async t => withGym(t, async gym => {
  const routes = ['#/workbench/exp-029', '#/workbench/exp-027', '#/workbench/exp-025', '#/experiments/exp-025/attempts/attempt-005/results', '#/experiments/exp-025/attempts/attempt-010', '#/runs?status=all'];
  const wide = [];
  for (const search of ['?clock=frozen', '?clock=frozen&embed=1']) for (const width of [320, 768, 1440]) {
    await gym.size(width, 900);
    for (const hash of routes) {
      await gym.go(hash, { search });
      const { win, doc } = await gym.overflow();
      if (doc > win) wide.push(`${search} ${width}px ${hash}: ${doc} > ${win}`);
    }
  }
  assert.deepEqual(wide, []);
}));
