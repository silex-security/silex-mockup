// No Agent Gym route scrolls sideways at phone, tablet, small laptop and desktop widths, in headless Chrome.
// Skips with a clear message when no Chrome binary exists (set CHROME).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openGym } from '../../tools/gym-shot.mjs';

const ROUTES = [
  '#/workbench/exp-029', '#/environments', '#/environments/new?returnTo=exp-029', '#/environments/env-sales/revisions/1.2',
  '#/scenarios/new?environment=env-sales@1.2&workflow=wf-sales-follow-up', '#/scenario-sets/set-follow-up-resilience/revisions/1',
  '#/runs?status=all', '#/experiments/exp-029/attempts/attempt-002', '#/experiments/exp-029/attempts/attempt-002/results', '#/kit', '#/nope',
];
const WIDTHS = [320, 800, 1024, 1280];

test('no route scrolls sideways at 320, 800, 1024 and 1280px', async t => {
  let gym;
  try { gym = await openGym(); } catch (e) {
    if (/Chrome not found/.test(e.message)) return t.skip('no Chrome binary (set CHROME); headless check skipped');
    throw e;
  }
  try {
    const wide = [];
    for (const width of WIDTHS) {
      await gym.size(width, 900);
      for (const hash of ROUTES) {
        await gym.go(hash);
        const { win, doc } = await gym.overflow();
        if (doc > win) wide.push(`${hash} at ${width}px: ${doc} > ${win}`);
      }
    }
    assert.deepEqual(wide, []);
    assert.deepEqual(gym.problems(), [], 'no page errors and no failed requests');
  } finally { await gym.close(); }
});

test('the run list shows every column, Review included, without an inner scroll from 770 to 1280px', async t => {
  let gym;
  try { gym = await openGym(); } catch (e) {
    if (/Chrome not found/.test(e.message)) return t.skip('no Chrome binary (set CHROME); headless check skipped');
    throw e;
  }
  try {
    const hidden = [];
    for (const width of [770, 800, 900, 1024, 1100, 1200, 1280]) {
      await gym.size(width, 900);
      await gym.go('#/runs?status=all');
      const out = await gym.ev(`const table = document.querySelector('.run-table');
        const cut = [...table.querySelectorAll('th')].filter(th => th.getBoundingClientRect().right > innerWidth || th.getBoundingClientRect().right > table.parentElement.getBoundingClientRect().right + 1).map(th => th.textContent);
        return { cut, inner: table.parentElement.scrollWidth - table.parentElement.clientWidth };`);
      if (out.cut.length || out.inner > 0) hidden.push(`${width}px: cut ${out.cut.join(', ') || 'none'}, inner scroll ${out.inner}px`);
    }
    assert.deepEqual(hidden, []);
  } finally { await gym.close(); }
});
