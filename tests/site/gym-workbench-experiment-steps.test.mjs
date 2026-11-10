// The step indicator on the run detail and the results, in headless Chrome. Skips cleanly without Chrome (set CHROME).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openGym } from '../../tools/gym-shot.mjs';

const STEPS = `const $ = (s, root = document) => root.querySelector(s);
  return [...document.querySelectorAll('.gym-steps__item')].map(li => [li.dataset.step, li.classList.contains('is-current'), $('a', li)?.getAttribute('href') ?? null, !!$('[aria-disabled]', li)]);`;
const frame = 'await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));';

test('the run detail and the results show the same steps with the current one marked, and each link goes to its screen', async t => {
  let gym;
  try { gym = await openGym(); } catch (e) {
    if (/Chrome not found/.test(e.message)) return t.skip('no Chrome binary (set CHROME); headless check skipped');
    throw e;
  }
  try {
    await gym.size(1585, 992);
    await gym.go('#/kit');
    await gym.ev('localStorage.clear()');
    await gym.go('#/experiments/exp-029/attempts/attempt-002');
    assert.deepEqual(await gym.ev(STEPS), [['configure', false, '#/workbench/exp-029', false], ['run', true, '#/experiments/exp-029/attempts/attempt-002', false], ['review', false, null, true]]);
    await gym.go('#/experiments/exp-024/attempts/attempt-004/results');
    assert.deepEqual(await gym.ev(STEPS), [
      ['configure', false, '#/workbench/exp-024', false], ['run', false, '#/experiments/exp-024/attempts/attempt-004', false],
      ['review', true, '#/experiments/exp-024/attempts/attempt-004/results', false]]);
    await gym.ev(`document.querySelector('.gym-steps__item[data-step=run] a').click(); ${frame}`);
    assert.equal(await gym.ev('return location.hash'), '#/experiments/exp-024/attempts/attempt-004', 'a step link goes through the router');
    await gym.size(320, 900);
    await gym.go('#/workbench/exp-029');
    const { win, doc } = await gym.overflow();
    assert.ok(doc <= win, `the workbench at 320px: scrollWidth ${doc} > ${win}`);
    assert.deepEqual(gym.problems(), [], 'no page errors and no failed requests');
  } finally { await gym.close(); }
});
