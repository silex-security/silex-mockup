// Scenario library in headless Chrome: the seeded sets with condition coverage, gaps and run evidence, the search,
// a set saved from the builder appearing in the library, and Use in experiment. Skips without Chrome (set CHROME).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openGym } from '../../tools/gym-shot.mjs';

const frame = 'await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));';
const byKey = key => `[data-focus-key="${key}"]`;

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
    await gym.go('#/scenarios');
    await fn(gym);
    assert.deepEqual(gym.problems(), [], 'no page errors and no failed requests');
  } finally { await gym.close(); }
}

const click = (gym, selector) => gym.ev(`const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw Error('missing ' + ${JSON.stringify(selector)}); el.click(); ${frame}`);
const cards = gym => gym.ev(`return [...document.querySelectorAll('.sc-lib__card')].map(c => ({
  name: c.querySelector('h2 a').textContent,
  meta: c.querySelector('.sc-lib__titles p').textContent,
  coverage: Object.fromEntries([...c.querySelectorAll('.sc-cov__item')].map(li => [li.dataset.dimension, li.querySelector('.sc-cov__text span').textContent])),
  gaps: [...c.querySelectorAll('.sc-cov__item.is-gap a')].map(a => a.getAttribute('href')),
  evidence: c.querySelector('.sc-lib__evidence').innerText.replace(/\\s+/g, ' ').trim(),
  use: [c.querySelector('[data-focus-key^="lib:use:"]').getAttribute('aria-disabled'), c.querySelector('[data-focus-key^="lib:use:"]').title] }))`);

test('the library lists the seeded sets with condition coverage, named gaps and where behaviour held', async t => withGym(t, async gym => {
  const page = await gym.ev(`return { h1: document.querySelector('h1').textContent, crumbs: [...document.querySelectorAll('.gym-breadcrumb li')].map(li => li.textContent),
    actions: [...document.querySelectorAll('.gym-pagehead__actions a')].map(a => [a.textContent, a.getAttribute('href')]),
    truth: document.querySelector('.sc-lib__truth').textContent, count: document.querySelector('.sc-lib__count').textContent }`);
  assert.equal(page.h1, 'Scenarios');
  assert.deepEqual(page.crumbs, ['Agent Gym', 'Scenarios']);
  assert.deepEqual(page.actions, [
    ['Create scenario', '#/scenarios/new?environment=env-sales@1.2&workflow=wf-sales-follow-up'],
    ['Generate variations', '#/scenarios/new?environment=env-sales@1.2&workflow=wf-sales-follow-up&mode=prompt'],
  ]);
  assert.equal(page.truth, 'Generated variations are proposals until an expert reviews them. Only reviewed scenarios run.');
  assert.equal(page.count, '5 saved sets · 30 scenarios');

  const [followUp, invoice, meeting, refundV2, refund] = await cards(gym);
  assert.deepEqual([followUp.name, invoice.name, meeting.name, refundV2.name, refund.name], ['Follow-up resilience', 'Invoice review', 'Meeting scheduling', 'Refund triage v2', 'Refund triage']);
  assert.equal(followUp.meta, 'Sales follow-up · Sales operations v1.2 · 3 scenarios');
  assert.deepEqual(followUp.coverage, { prompt: 'No prompt scenario', tool_failure: '1 scenario', permission: 'No permission scenario', data_state: '1 scenario' });
  assert.deepEqual(followUp.gaps, [
    '#/scenarios/new?environment=env-sales@1.2&workflow=wf-sales-follow-up&mode=prompt',
    '#/scenarios/new?environment=env-sales@1.2&workflow=wf-sales-follow-up&mode=permission',
  ]);
  assert.match(followUp.evidence, /Verdict Pass Duplicate-send guard · rev 2 · attempt 1 .*Timeout after send 0\/1 1\/1.*Sales follow-up · Variant A is running \(12\/18\)\. Open run/, 'the finished Duplicate-send guard run and the live Sales follow-up run');
  assert.deepEqual(followUp.use, ['true', 'Experiment 029 already uses this set.']);
  assert.deepEqual(meeting.coverage, { prompt: '3 scenarios', tool_failure: 'No tool failure scenario', permission: '1 scenario', data_state: '1 scenario' });
  assert.match(meeting.evidence, /Verdict Pass Meeting scheduling · rev 2 · attempt 1 .*Scenario Baseline Variant Book intro call 1\/1 1\/1 No free slot 1\/1 1\/1/);
  assert.equal(await gym.ev('return document.querySelector(\'[data-set="set-meeting-scheduling@1"] .sc-lib__results\').getAttribute("href")'), '#/experiments/exp-027/attempts/attempt-001/results');
  assert.deepEqual(refund.coverage, { prompt: '4 scenarios', tool_failure: '1 scenario', permission: '1 scenario', data_state: '1 scenario' });
  assert.deepEqual(refund.gaps, []);

  await gym.ev(`const input = document.querySelector('${byKey('lib:search')}'); input.focus(); input.value = 'refund'; input.dispatchEvent(new Event('input', { bubbles: true })); ${frame}`);
  assert.deepEqual((await cards(gym)).map(c => c.name), ['Refund triage v2', 'Refund triage']);
  assert.equal(await gym.ev('return document.activeElement.dataset.focusKey'), 'lib:search', 'typing keeps focus in the search');

  for (const width of [320, 390, 768]) {
    await gym.size(width, 900);
    await gym.ev(frame);
    const { win, doc } = await gym.overflow();
    assert.ok(doc <= win, `#/scenarios at ${width}px: scrollWidth ${doc} > ${win}`);
  }
}));

test('a set saved from the builder appears in the library with its coverage, and Use in experiment moves the workbench onto it', async t => withGym(t, async gym => {
  await gym.go('#/scenarios/new?environment=env-sales@1.2&workflow=wf-sales-follow-up');
  await click(gym, byKey('sc:review'));
  for (const id of ['v2', 'v3', 'v4']) await click(gym, byKey(`sc-review:confirm:${id}`));
  await click(gym, byKey('sc-review:save'));
  await gym.ev(`[...document.querySelectorAll('dialog[open] button')].find(b => b.textContent.trim() === 'Keep current set').click(); ${frame}`);

  await gym.go('#/scenarios');
  const saved = (await cards(gym)).find(c => c.name === 'Sales follow-up with approval');
  assert.ok(saved, 'the saved set is listed');
  assert.equal(saved.meta, 'Sales follow-up · Sales operations v1.2 · 5 scenarios');
  assert.deepEqual(saved.coverage, { prompt: '4 scenarios', tool_failure: 'No tool failure scenario', permission: 'No permission scenario', data_state: 'No data or state scenario' });
  assert.match(saved.evidence, /Not run yet/);
  assert.equal(saved.use[0], null, 'Use in experiment is available');
  assert.match(saved.use[1], /2 versions × 5 scenarios × 3 repetitions = 30 runs/);

  await click(gym, byKey('lib:use:set-sales-follow-up-with-approval@1'));
  const after = await gym.ev('return [location.hash, window.__gym.store.getState().experiments["exp-029"].scenarioSetRef.id]');
  assert.deepEqual(after, ['#/workbench/exp-029', 'set-sales-follow-up-with-approval']);
}));
