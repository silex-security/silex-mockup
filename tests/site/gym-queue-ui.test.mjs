// The experiment queue in headless Chrome: cards, counted tabs, search and the stage-dependent action, with status and
// text in the route query. Skips without Chrome (set CHROME).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openGym } from '../../tools/gym-shot.mjs';

const frame = 'await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));';

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

const rows = gym => gym.ev(`return [...document.querySelectorAll('.xq-row')].map(tr => ({ id: tr.dataset.experiment, stage: tr.dataset.stage,
  cells: Object.fromEntries([...tr.cells].map(td => [td.dataset.label, td.innerText.trim().replace(/\\s+/g, ' ')])),
  action: tr.querySelector('td[data-label="Action"] a').getAttribute('href') }))`);
const type = (gym, value) => gym.ev(`const input = document.querySelector('[data-focus-key="xq:search"]'); input.focus(); input.value = ${JSON.stringify(value)}; input.dispatchEvent(new Event('input', { bubbles: true })); ${frame}`);

test('the app opens on the experiment queue: four cards, counted tabs, and one row per experiment with its stage action', async t => withGym(t, async gym => {
  await gym.go('');
  assert.equal(await gym.ev('return location.hash'), '#/experiments');
  const page = await gym.ev(`return { h1: document.querySelector('.gym-main h1').textContent,
    cards: [...document.querySelectorAll('.xq-card')].map(c => c.innerText.replace(/\\s+/g, ' ').trim()),
    tabs: [...document.querySelectorAll('.xq-filter [role=tab]')].map(b => [b.textContent, b.getAttribute('aria-selected')]),
    head: [...document.querySelectorAll('.xq-table thead th')].map(th => th.textContent),
    section: document.querySelector('.gym-sections__link[aria-current=page]').textContent };`);
  assert.equal(page.h1, 'Experiment queue');
  assert.equal(page.section, 'Workbench');
  assert.deepEqual(page.cards, [
    'Pending 2 2 to configure and run', 'Queued 1 Waiting for the runner: Support triage comparison',
    'Running 1 Experiment 029 · 12/18 runs', 'Needs review 1 Meeting scheduling awaiting a decision']);
  assert.deepEqual(page.tabs, [['All · 8', 'true'], ['Pending · 2', 'false'], ['Queued · 1', 'false'], ['Running · 1', 'false'], ['Needs review · 1', 'false'], ['Done · 3', 'false']]);
  assert.deepEqual(page.head, ['Experiment', 'Source', 'Objective', 'Stage', 'Progress or result', 'Last activity', 'Action']);

  const all = await rows(gym);
  assert.deepEqual(all.map(r => [r.id, r.stage, r.cells.Action]), [
    ['exp-031', 'pending', 'Configure'], ['exp-030', 'pending', 'Configure'], ['exp-029', 'running', 'Open'], ['exp-028', 'queued', 'View'],
    ['exp-027', 'needs_review', 'Review'], ['exp-026', 'done', 'Results'], ['exp-025', 'done', 'Results'], ['exp-024', 'done', 'Results']]);
  const byId = Object.fromEntries(all.map(r => [r.id, r]));
  assert.equal(byId['exp-030'].action, '#/workbench/exp-030');
  assert.equal(byId['exp-028'].action, '#/workbench/exp-028');
  assert.equal(byId['exp-029'].action, '#/experiments/exp-029/attempts/attempt-002');
  assert.equal(byId['exp-027'].action, '#/experiments/exp-027/attempts/attempt-001/results');
  assert.equal(byId['exp-024'].action, '#/experiments/exp-024/attempts/attempt-004/results');
  assert.match(byId['exp-029'].cells['Progress or result'], /12\/18/);
  assert.match(byId['exp-025'].cells['Progress or result'], /Success rate 100% → 67% · 0 improved · 2 regressed Reject/);
  assert.match(byId['exp-024'].cells['Progress or result'], /Policy violations 1 → 0 · 1 improved · 0 regressed Pass for demo/);
  assert.match(byId['exp-024'].cells.Source, /Speedrun Speedrun trace: duplicate follow-up emails/);
  assert.match(byId['exp-031'].cells.Experiment, /Meeting scheduling/, 'the workflow sits under the name');
}));

test('a stage tab and the search live in the route query, survive a refresh, and combine', async t => withGym(t, async gym => {
  await gym.go('#/experiments');
  await gym.ev(`[...document.querySelectorAll('.xq-filter [role=tab]')].find(b => b.textContent === 'Done · 3').click(); ${frame}`);
  assert.equal(await gym.ev('return location.hash'), '#/experiments?status=done');
  assert.deepEqual((await rows(gym)).map(r => r.id), ['exp-026', 'exp-025', 'exp-024']);

  await type(gym, 'support');
  assert.equal(await gym.ev('return location.hash'), '#/experiments?status=done&q=support');
  assert.deepEqual((await rows(gym)).map(r => r.id), ['exp-026', 'exp-025'], 'workflow name');
  assert.equal(await gym.ev('return document.activeElement.dataset.focusKey'), 'xq:search', 'typing keeps focus in the search');
  assert.equal(await gym.ev('return document.querySelector(".xq-list .gym-panel__subtitle").textContent'), '2 of 8 shown');

  await gym.go('#/experiments?status=done&q=support');
  assert.deepEqual((await rows(gym)).map(r => r.id), ['exp-026', 'exp-025'], 'a reload reads both back');
  assert.equal(await gym.ev('return document.querySelector("[data-focus-key=\\"xq:search\\"]").value'), 'support');
  assert.equal(await gym.ev('return document.querySelector(".xq-filter [aria-selected=true]").textContent'), 'Done · 3');

  await type(gym, 'zzz');
  assert.match(await gym.ev('return document.querySelector(".xq-list").innerText'), /No experiment matches/);
  await gym.ev(`document.querySelector('[data-focus-key="xq:clear"]').click(); ${frame}`);
  assert.equal(await gym.ev('return location.hash'), '#/experiments');
  assert.equal((await rows(gym)).length, 8);
}));

test('a card filters to its stage and a second press clears it; a row click follows the stage action', async t => withGym(t, async gym => {
  await gym.go('#/experiments');
  await gym.ev(`document.querySelector('[data-focus-key="xq:card:needs_review"]').click(); ${frame}`);
  assert.equal(await gym.ev('return location.hash'), '#/experiments?status=needs_review');
  assert.deepEqual((await rows(gym)).map(r => r.id), ['exp-027']);
  assert.equal(await gym.ev('return document.querySelector("[data-focus-key=\\"xq:card:needs_review\\"]").getAttribute("aria-pressed")'), 'true');
  await gym.ev(`document.querySelector('[data-focus-key="xq:card:needs_review"]').click(); ${frame}`);
  assert.equal(await gym.ev('return location.hash'), '#/experiments');

  await gym.ev(`document.querySelector('.xq-row[data-experiment="exp-029"] td[data-label="Objective"]').click(); ${frame}`);
  assert.equal(await gym.ev('return location.hash'), '#/experiments/exp-029/attempts/attempt-002', 'running opens the run');
}));

test('the queue fits at 320, 390, 768 and 1440px without sideways page scroll, and in the embedded console frame', async t => withGym(t, async gym => {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await gym.size(width, 900);
    await gym.go('#/experiments');
    const { win, doc } = await gym.overflow();
    assert.ok(doc <= win, `#/experiments at ${width}px: scrollWidth ${doc} > ${win}`);
  }
  await gym.size(1440, 900);
  await gym.go('#/experiments', { search: '?embed=1&clock=frozen' });
  const { win, doc } = await gym.overflow();
  assert.ok(doc <= win, `embedded: scrollWidth ${doc} > ${win}`);
  assert.equal(await gym.ev('return document.querySelectorAll(".gym-header").length'), 0, 'embed mode leaves out the product header');
}));
