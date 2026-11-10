// Runs page panels in headless Chrome: the release gate on the frozen and live clocks, regression batches and their
// history, and the trigger column and filter. Skips without Chrome (set CHROME).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openGym } from '../../tools/gym-shot.mjs';

const frame = 'await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));';
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
    await fn(gym);
    assert.deepEqual(gym.problems(), [], 'no page errors and no failed requests');
  } finally { await gym.close(); }
}

async function until(predicate, label, ms = 30000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await predicate();
    if (value) return value;
    if (Date.now() > end) throw Error(`timed out waiting for ${label}`);
    await sleep(150);
  }
}

const gateRow = (gym, experimentId) => gym.ev(`const tr = document.querySelector('.run-gate__row[data-experiment="${experimentId}"]');
  return { gate: tr.dataset.gate, cells: Object.fromEntries([...tr.cells].map(td => [td.dataset.label, td.innerText.trim().replace(/\\s+/g, ' ')])) }`);
const click = (gym, selector) => gym.ev(`const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw Error('missing ' + ${JSON.stringify(selector)}); el.click(); ${frame}`);
const queueTitles = gym => gym.ev('return [...document.querySelectorAll(".run-list__row .run-list__title")].map(a => a.textContent)');

test('the Runs page reads header, Release gate, Regression, then the queue; the frozen sales run reads Running with a changed draft', async t => withGym(t, async gym => {
  await gym.go('#/runs?status=all');
  const order = await gym.ev('return [...document.querySelector(".gym-main").children].flatMap(el => el.matches(".run-panels") ? [...el.children] : [el]).map(el => el.querySelector("h1, h2")?.textContent)');
  assert.deepEqual(order, ['Runs', 'Release gate', 'Regression', 'All runs']);
  const sales = await gateRow(gym, 'exp-029');
  assert.equal(sales.gate, 'running');
  assert.deepEqual(sales.cells, {
    Experiment: 'Experiment 029', 'What changed': 'Draft email Model configuration', 'Saved revision': 'rev 3 Draft changed since this run',
    'Latest run': 'rev 3 · attempt 1 Running', Verdict: 'Pending', Review: 'Not reviewed', Gate: 'Running 12/18 executions finished', Action: 'Open workbench',
  });
  assert.equal((await gateRow(gym, 'exp-027')).cells.Gate, 'Needs review Pass verdict; not reviewed yet');
  const text = await gym.ev('return document.querySelector(".run-gate").innerText + document.querySelector(".run-reg").innerText');
  assert.doesNotMatch(text, /\b(released|deployed|production[- ]safe)\b/i, 'the wording stays inside the simulation');

  await gym.ev(`const s = document.querySelector('[data-focus-key="runs:trigger"]'); s.value = 'change'; s.dispatchEvent(new Event('change', { bubbles: true })); ${frame}`);
  assert.equal(await gym.ev('return location.hash'), '#/runs?status=all&trigger=change');
  assert.deepEqual(await queueTitles(gym), ['Sales follow-up · Variant A']);
  await gym.go('#/runs?status=all&trigger=manual');
  assert.deepEqual(await queueTitles(gym), ['Support triage comparison', 'Refund timeout steps', 'Smaller model for refund replies', 'Duplicate-send guard', 'Meeting scheduling'], 'the trigger filter survives a refresh');

  for (const width of [390, 768, 1024]) {
    await gym.size(width, 900);
    await gym.ev(frame);
    const { win, doc } = await gym.overflow();
    assert.ok(doc <= win, `#/runs at ${width}px: scrollWidth ${doc} > ${win}`);
  }
}));

test('with a live clock the sales run completes into Needs review, and a Pass for demo review clears it for demo', async t => withGym(t, async gym => {
  await gym.go('#/runs?status=all', { search: '' });
  await until(async () => (await gateRow(gym, 'exp-029')).gate === 'needs_review', 'the sales gate to need review');
  const done = await gateRow(gym, 'exp-029');
  assert.deepEqual([done.cells.Verdict, done.cells.Gate], ['Pass', 'Needs review Pass verdict; not reviewed yet']);

  await gym.go('#/experiments/exp-029/attempts/attempt-002/results', { search: '' });
  await gym.ev(`document.querySelector('input[value="pass_for_demo"]').click(); ${frame}`);
  await gym.ev(`[...document.querySelectorAll('.run-review button')].find(b => b.textContent.trim() === 'Mark reviewed').click(); ${frame}`);
  await gym.go('#/runs?status=all', { search: '' });
  const cleared = await gateRow(gym, 'exp-029');
  assert.equal(cleared.gate, 'cleared');
  assert.deepEqual([cleared.cells.Review, cleared.cells.Gate], ['Pass for demo', 'Cleared for demo Pass verdict; reviewed Pass for demo']);
  assert.match(cleared.cells['Saved revision'], /Draft changed since this run/);
}));

test('Run regression now adds the batch\'s attempts and a history row, and is held while the batch is live', async t => withGym(t, async gym => {
  await gym.go('#/runs?status=all');
  assert.match(await gym.ev('return document.querySelector(".run-reg").innerText'), /No regression batch yet\./);
  const skipped = await gym.ev('return [...document.querySelectorAll(".run-reg__skipped li")].map(li => li.textContent)');
  assert.deepEqual(skipped, ['Support triage comparison: rev 1 · attempt 1 is already queued', 'Experiment 029: Draft rev 4 has unsaved changes; save it in the workbench to include it',
    'Opt-out wording check: Never saved', 'Meeting no-slot handling: Never saved']);

  const before = await gym.ev('return window.__gym.store.getState().attemptOrder.length');
  await click(gym, '[data-focus-key="reg:run"]');
  await click(gym, '[data-focus-key="reg:run"]');
  const state = await gym.ev(`const s = window.__gym.store.getState(); return { count: s.attemptOrder.length, last: s.attempts[s.attemptOrder.at(-1)].trigger, batches: s.regression.batches.length }`);
  assert.deepEqual(state, { count: before + 4, last: { kind: 'regression', label: 'Regression batch 1', batchId: 'regression-1' }, batches: 1 }, 'the second press enqueues nothing');
  const run = await gym.ev('const b = document.querySelector("[data-focus-key=\'reg:run\']"); return [b.getAttribute("aria-disabled"), b.title]');
  assert.deepEqual(run, ['true', 'Regression batch 1 is still running: 0 of 38 runs finished']);
  const history = await gym.ev(`return [...document.querySelectorAll('.run-reg__history tbody tr')].map(tr => [...tr.cells].map(td => td.innerText.trim().replace(/\\s+/g, ' ')))`);
  assert.deepEqual(history, [['Batch 1 queue seq 7', 'Duplicate-send guard Smaller model for refund replies Refund timeout steps Meeting scheduling 4 skipped', '0/38', '4 running', 'Show runs']]);

  const row = await gym.ev(`const tr = [...document.querySelectorAll('.run-list__row')].find(r => r.querySelector('td[data-label="Trigger"]').innerText.trim() === 'Regression batch 1'); return tr && tr.querySelector('.run-list__title').textContent`);
  assert.equal(row, 'Duplicate-send guard', 'the first queued attempt of the batch, found by its trigger label');
  await click(gym, '[data-focus-key="reg:show:regression-1"]');
  assert.equal(await gym.ev('return location.hash'), '#/runs?status=all&trigger=regression');
  assert.deepEqual(await queueTitles(gym), ['Duplicate-send guard', 'Smaller model for refund replies', 'Refund timeout steps', 'Meeting scheduling'], 'queued in batch order');

  await gym.ev(`const s = document.querySelector('[data-focus-key="reg:cadence"]'); s.value = 'quarterly'; s.dispatchEvent(new Event('change', { bubbles: true })); ${frame}`);
  assert.equal(await gym.ev('return window.__gym.store.getState().regression.cadence'), 'quarterly');
  assert.match(await gym.ev('return document.querySelector(".run-reg__note").textContent'), /^Cadence: Quarterly\. This preview has no timer/);
}));
