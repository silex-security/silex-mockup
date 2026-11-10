// The experiment-level parts of the workbench in headless Chrome: the what-changes strip, the objective and acceptance
// settings, and the Configure, Run, Review steps. Skips cleanly without Chrome (set CHROME).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openGym } from '../../tools/gym-shot.mjs';

const P = `
  const $ = (s, root = document) => root.querySelector(s), $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const txt = el => (el ? el.textContent.replace(/\\s+/g, ' ').trim() : '');
  const S = () => window.__gym.store.getState(), E = () => S().experiments['exp-029'];
  const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const change = async (el, value) => { el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); await frame(); };
`;

async function withGym(t, fn) {
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
    await fn(code => gym.ev(P + code), gym);
    assert.deepEqual(gym.problems(), [], 'no page errors and no failed requests');
  } finally { await gym.close(); }
}

test('a what-changes strip names the two versions and shows the differing fields from the version data', async t => withGym(t, async page => {
  const v = await page(`
    return { title: txt($('.wb-changes__versions')), count: txt($('.wb-changes__count')),
      rows: $$('.wb-changes tbody tr').map(tr => [...tr.cells].map(txt)),
      marked: $$('.wb-changes tbody tr').map(tr => [...tr.cells].filter(td => td.classList.contains('is-changed')).length),
      aboveBlueprint: !!($('.wb-changes').compareDocumentPosition($('.wb-blueprint')) & Node.DOCUMENT_POSITION_FOLLOWING) };`);
  assert.equal(v.title, 'Sales follow-up · rev 1 → Variant A');
  assert.equal(v.count, '2 changes');
  assert.deepEqual(v.rows, [
    ['Draft emailShared · 2 other workflows', 'model', 'simulated-model-baseline', 'simulated-model-variant-a'],
    ['Draft email', 'timeoutRecovery', 'retry_new_key', 'check_status_reuse_key'],
    ['Draft email', 'tone', 'concise', 'concise'],
  ]);
  assert.deepEqual(v.marked, [2, 2, 0], 'both value cells of a differing field are highlighted, an equal field is not');
  assert.equal(v.aboveBlueprint, true);

  await page(`await change($('.wb-workflow__select'), 'wf-meeting-scheduling@1');`);
  assert.equal(await page(`return txt($('.wb-changes__versions'))`), 'Meeting scheduling · rev 1 → Variant A', 'the strip follows the workflow');
}));

test('experiment settings: the objective and acceptance rules are draft edits that save and freeze like the rest of the draft', async t => withGym(t, async page => {
  const before = await page(`return { objective: $('[data-focus-key="wb:objective"]').value, noRegression: $('[data-focus-key="wb:accept-noregression"]').checked,
    min: $('[data-focus-key="wb:accept-min"]').value, rev: E().draftRevision, options: $$('[data-focus-key="wb:objective"] option').map(o => o.textContent) };`);
  assert.deepEqual([before.objective, before.noRegression, before.min], ['success', true, '1']);
  assert.deepEqual(before.options, ['Success rate', 'Policy violations', 'Steps per run']);

  await page(`await change($('[data-focus-key="wb:objective"]'), 'steps');`);
  await page(`$('[data-focus-key="wb:accept-noregression"]').click(); await frame();`);
  await page(`await change($('[data-focus-key="wb:accept-min"]'), '3');`);
  const after = await page(`return { exp: [E().objective, E().acceptance], rev: E().draftRevision, dirty: txt($('.wb-save-state')) };`);
  assert.deepEqual(after.exp, ['steps', { noRegression: false, minImprovedPairs: 3, noSharedRegression: true }]);
  assert.equal(after.rev, before.rev + 3, 'each edit is a draft revision');
  assert.match(after.dirty, /^Unsaved changes/);

  await page(`await change($('[data-focus-key="wb:accept-min"]'), '-2');`);
  const refused = await page(`return { min: E().acceptance.minImprovedPairs, shown: $('[data-focus-key="wb:accept-min"]').value, flash: txt($('.wb-flash')) };`);
  assert.equal(refused.min, 3, 'a value outside the model is refused');
  assert.equal(refused.shown, '3', 'the field shows what the draft holds');
  assert.match(refused.flash, /whole number from 0 to 99/);

  await page(`$('.wb-run__save').click(); await frame();`);
  assert.equal(await page(`return E().savedRevision === E().draftRevision`), true);
  await page(`$('.wb-run__go').click(); await frame();`);
  const frozen = await page(`const a = Object.values(S().attempts).at(-1); return [a.inputSnapshot.experiment.objective, a.inputSnapshot.experiment.acceptance.minImprovedPairs]`);
  assert.deepEqual(frozen, ['steps', 3], 'Run freezes the settings with the rest of the draft');
}));

test('the step indicator shows Configure as current, links Run to the attempt in the queue, and explains the step that has no target', async t => withGym(t, async page => {
  const v = await page(`return $$('.gym-steps__item').map(li => [li.dataset.step, li.classList.contains('is-current'), $('a', li)?.getAttribute('href') ?? null, $('[aria-disabled]', li)?.title ?? null, txt(li)]);`);
  assert.deepEqual(v.map(r => r.slice(0, 3)), [['configure', true, '#/workbench/exp-029'], ['run', false, '#/experiments/exp-029/attempts/attempt-002'], ['review', false, null]]);
  assert.match(v[2][3], /12 of 18 executions finished/);
  assert.match(v[1][4], /^2Run12 of 18 done$/, 'number, label and progress detail');
}));
