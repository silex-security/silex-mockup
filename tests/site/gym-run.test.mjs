// Run list and run detail in headless Chrome (plan 4.5, 7.4, 9.1; 13.2 paths B and C).
// Drives the page through tools/gym-shot.mjs. Skips with a clear message when no Chrome binary exists (set CHROME).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openGym } from '../../tools/gym-shot.mjs';

const SALES = '#/experiments/exp-029/attempts/attempt-002';
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

const fresh = async (gym, hash, opts) => { await gym.ev('localStorage.clear()'); await gym.go(hash, opts); };
const main = gym => gym.ev('return document.querySelector(".gym-main").innerText');
const clickText = (gym, selector, text) => gym.ev(`const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find(n => n.textContent.trim() === ${JSON.stringify(text)});
  if (!el) throw Error('no ${selector} with text ${text}'); el.click(); ${frame}`);
const attempt = (gym, id = 'attempt-002') => gym.ev(`const a = window.__gym.store.getState().attempts[${JSON.stringify(id)}];
  return { status: a.status, runner: a.runner, cursor: a.cursor, done: window.__gym.store.getState().executions[a.id].length, review: a.review }`);

async function until(gym, predicate, label, ms = 20000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = await predicate();
    if (value) return value;
    if (Date.now() > end) throw Error(`timed out waiting for ${label}`);
    await sleep(150);
  }
}

async function noOverflow(gym, hash) {
  for (const width of [390, 768]) {
    await gym.size(width, 900);
    await gym.ev(frame);
    const { win, doc } = await gym.overflow();
    assert.ok(doc <= win, `${hash} at ${width}px: scrollWidth ${doc} > ${win}`);
  }
  await gym.size(1585, 992);
}

test('the run list shows every attempt with counts from the queue and filters by status in the route query', async t => withGym(t, async gym => {
  await fresh(gym, '#/runs?status=all');
  const page = await gym.ev(`return {
    h1: document.querySelector('.gym-main h1').textContent,
    tabs: [...document.querySelectorAll('.run-list [role="tab"]')].map(b => [b.textContent, b.getAttribute('aria-selected')]),
    head: [...document.querySelectorAll('.run-list .run-table thead th')].map(th => th.textContent),
    rows: [...document.querySelectorAll('.run-list__row')].map(tr => [...tr.cells].map(td => td.innerText.trim().replace(/\\s+/g, ' '))),
    results: [...document.querySelectorAll('.run-list__row a')].filter(a => a.textContent === 'View results').map(a => a.getAttribute('href')) }`);
  assert.equal(page.h1, 'Runs');
  assert.deepEqual(page.tabs, [['All · 3', 'true'], ['Running · 1', 'false'], ['Queued · 1', 'false'], ['Completed · 1', 'false'], ['Cancelled · 0', 'false']]);
  assert.deepEqual(page.head, ['Experiment', 'Trigger', 'Frozen revision', 'Environment', 'Scenarios', 'Status', 'Progress', 'Review decision', 'Action']);
  assert.deepEqual(page.rows.map(r => r.slice(0, 8)), [
    ['Sales follow-up · Variant A', 'Change', 'rev 3 · attempt 1', 'Sales operations', '3', 'Running', '12/18', 'Not reviewed'],
    ['Support triage comparison', 'Manual', 'rev 1 · attempt 1', 'Customer support', '8', 'Queued', '0/48', 'Not reviewed'],
    ['Meeting scheduling', 'Manual', 'rev 2 · attempt 1', 'Sales operations', '6', 'Completed', '12/12', 'Not reviewed'],
  ]);
  assert.ok(page.rows.every(r => !/pass/i.test(r[5])), 'Completed is a status, never shown as passed');
  assert.deepEqual(page.results, ['#/experiments/exp-027/attempts/attempt-001/results'], 'only the completed row links to results');

  await clickText(gym, '.run-list [role="tab"]', 'Completed · 1');
  assert.equal(await gym.ev('return location.hash'), '#/runs?status=completed');
  assert.deepEqual(await gym.ev('return [...document.querySelectorAll(".run-list__row .run-list__title")].map(a => a.textContent)'), ['Meeting scheduling']);
  await clickText(gym, '.run-list [role="tab"]', 'Cancelled · 0');
  assert.match(await main(gym), /No cancelled runs/);
  await gym.go('#/runs?status=running');
  assert.deepEqual(await gym.ev('return [...document.querySelectorAll(".run-list__row .run-list__title")].map(a => a.textContent)'), ['Sales follow-up · Variant A'], 'the filter survives a refresh');
  await noOverflow(gym, '#/runs?status=all');

  await gym.go('#/runs?status=all');
  await gym.ev(`document.querySelector('.run-list__row[data-attempt="attempt-003"] td[data-label="Scenarios"]').click(); ${frame}`);
  assert.equal(await gym.ev('return location.hash'), '#/experiments/exp-028/attempts/attempt-003', 'a row opens run detail');
  assert.match(await main(gym), /Queue position 1 of 1 · waits for Sales follow-up · Variant A/);
  assert.match(await main(gym), /2 versions × 8 scenarios × 3 repetitions = 48 runs/);
}));

test('run detail on the frozen clock shows 12 of 18, the frozen inputs, the matrix and a replay of the timeout run', async t => withGym(t, async gym => {
  await fresh(gym, SALES);
  const store = await gym.ev(`const a = window.__gym.store.getState().attempts['attempt-002']; return { digest: a.inputDigest, draft: window.__gym.store.getState().experiments['exp-029'].title }`);
  const page = await gym.ev(`const bar = document.querySelector('.run-plan [role="progressbar"]'); return {
    h1: document.querySelector('.gym-main h1').textContent,
    text: document.querySelector('.gym-main').innerText,
    bar: [bar.getAttribute('aria-valuenow'), bar.getAttribute('aria-valuemax')],
    cells: [...document.querySelectorAll('.run-matrix tbody tr')].map(tr => [tr.querySelector('th').textContent, ...[...tr.querySelectorAll('.run-cell__summary')].map(s => s.textContent)]),
    replay: document.querySelector('.run-replay .gym-panel__subtitle').textContent,
    flag: [...document.querySelectorAll('[data-run-node="send-email"] [data-flag]')].filter(f => !f.hidden).map(f => f.textContent),
    idle: document.querySelector('[data-run-node="log-skipped"]').dataset.state }`);
  assert.equal(page.h1, 'Sales follow-up · Variant A', 'the frozen title, not the renamed draft');
  assert.equal(store.draft, 'Experiment 029');
  assert.match(page.text, /12 of 18 executions finished/);
  assert.deepEqual(page.bar, ['12', '18']);
  for (const fact of ['rev 3 · attempt 1', 'Sales operations v1.2', 'Follow-up resilience · rev 1', 'Baseline vs Variant A', store.digest, 'gym-fx-1', '2 versions × 3 scenarios × 3 repetitions = 18 runs'])
    assert.ok(page.text.includes(fact), `shows ${fact}`);
  assert.match(page.text, /SEED\s+29/);
  assert.deepEqual(page.cells, [
    ['Base case', '3/3 passed', '3/3 passed'],
    ['Timeout after send', '0/3 passed', '3/3 passed'],
    ['Contact opted out', '1 next · 2 pending', '3 pending'],
  ], 'the active runner names its next item; nothing claims to be running');
  assert.equal(page.replay, 'Timeout after send · Baseline · repetition 1', 'opens on the first failed run');
  assert.deepEqual(page.flag, ['Timeout']);
  assert.equal(page.idle, 'idle', 'the skip branch was never visited');

  const timeout = await gym.ev(`const ev = [...document.querySelectorAll('.run-replay .run-ev')].find(li => li.querySelector('.run-ev__tool')?.textContent === 'email.send_email');
    return [...ev.querySelectorAll('.run-fact')].map(f => f.innerText.replace(/\\s+/g, ' '))`);
  assert.deepEqual(timeout, ['Response timeout', 'Side effect committed'], 'response and side effect are two separate facts');
  assert.match(await main(gym), /Outbox\s+2 emails/);
  assert.match(await main(gym), /Expected\s+outbox\.count == 1\s+Observed\s+outbox\.count = 2/);

  await gym.ev(`window.__live = new Set(); const set = window.setInterval.bind(window), clear = window.clearInterval.bind(window);
    window.setInterval = (fn, ms) => { const id = set(fn, ms); window.__live.add(id); return id; };
    window.clearInterval = id => { window.__live.delete(id); clear(id); };`);
  await clickText(gym, '.run-scrub button', 'Replay');
  const started = await gym.ev('return { where: document.querySelector(".run-scrub__where").textContent, timers: window.__live.size, play: document.querySelector("[data-focus-key=\'run:play\']").textContent }');
  assert.deepEqual(started, { where: 'Event 0 of 9', timers: 1, play: 'Pause' });
  await sleep(1500);
  const playing = await gym.ev('return { at: Number(document.querySelector(".run-scrub__range").value), current: document.querySelector(".run-ev[aria-current=\'step\']")?.dataset.runSeq }');
  assert.ok(playing.at >= 1 && playing.at < 9, `the replay advanced to ${playing.at}`);
  assert.equal(playing.current, String(playing.at));
  await clickText(gym, '.run-scrub button', 'Pause');
  assert.equal(await gym.ev('return window.__live.size'), 0, 'pause clears the replay timer');
  await clickText(gym, '.run-scrub button', 'Play');
  await gym.ev(`location.hash = '#/runs?status=all'; ${frame}`);
  assert.equal(await gym.ev('return window.__live.size'), 0, 'leaving the view clears the replay timer');
  assert.equal((await attempt(gym)).done, 12, 'replay never re-executes anything');

  await gym.go(SALES);
  await gym.ev(`document.querySelector('[data-cell="sc-base-case,variant"]').click(); ${frame}`);
  await clickText(gym, '.run-reps button', 'Repetition 2 · Passed');
  assert.equal(await gym.ev('return location.hash'), `${SALES}?run=sc-base-case,2,variant`);
  assert.equal(await gym.ev('return document.querySelector(".run-replay .gym-panel__subtitle").textContent'), 'Base case · Variant A · repetition 2');
  assert.match(await main(gym), /Outbox\s+1 email/);
  assert.match(await main(gym), /Approvals\s+1 requested · 1 granted/);
  await gym.go(`${SALES}?run=sc-base-case,2,variant`);
  assert.equal(await gym.ev('return document.querySelector(".run-replay .gym-panel__subtitle").textContent'), 'Base case · Variant A · repetition 2', 'the selection survives a refresh');
  await noOverflow(gym, SALES);

  await gym.go('#/experiments/exp-029/attempts/attempt-999');
  const lost = await gym.ev('return { text: document.querySelector(".gym-main").innerText, link: [...document.querySelectorAll(".gym-main a")].find(a => a.textContent === "View all runs")?.getAttribute("href") }');
  assert.match(lost.text, /Attempt not found/);
  assert.equal(lost.link, '#/runs?status=all');
}));

test('with a live clock the sales attempt reaches 18 of 18 and Completed while run detail is open', async t => withGym(t, async gym => {
  await fresh(gym, SALES, { search: '' });
  await until(gym, async () => (await attempt(gym)).status === 'completed', 'attempt-002 completed');
  await gym.ev(frame);
  const page = await gym.ev(`return { text: document.querySelector('.gym-main').innerText, status: document.querySelector('.gym-pagehead__meta [data-status]').textContent,
    cells: [...document.querySelectorAll('.run-matrix tbody tr')].map(tr => [...tr.querySelectorAll('.run-cell__summary')].map(s => s.textContent)) }`);
  assert.match(page.text, /18 of 18 executions finished/);
  assert.equal(page.status, 'Completed');
  assert.deepEqual(page.cells, [['3/3 passed', '3/3 passed'], ['0/3 passed', '3/3 passed'], ['3/3 passed', '3/3 passed']]);
  assert.equal((await attempt(gym, 'attempt-003')).status, 'running', 'the slot passes to the queued attempt');
}));

test('pause stops progress and resume continues; a refresh pauses the running attempt until Resume', async t => withGym(t, async gym => {
  await fresh(gym, SALES, { search: '' });
  await clickText(gym, '.gym-pagehead button', 'Pause simulation');
  const paused = await attempt(gym);
  assert.equal(paused.runner, 'paused');
  assert.match(await gym.ev('return document.querySelector(".gym-pagehead__meta").innerText'), /Paused/);
  assert.doesNotMatch(await main(gym), /Paused after refresh/, 'a pause from this page is not a refresh pause');
  await sleep(2200);
  assert.equal((await attempt(gym)).done, paused.done, 'nothing runs while paused');
  await clickText(gym, '.gym-pagehead button', 'Resume simulation');
  await until(gym, async () => (await attempt(gym)).done > paused.done, 'progress after resume');

  await gym.go(SALES, { search: '' });
  const reloaded = await attempt(gym);
  assert.equal(reloaded.runner, 'paused', 'the store pauses a running attempt on load');
  assert.match(await gym.ev('return document.querySelector(".gym-pagehead__meta").innerText'), /Paused after refresh/);
  assert.match(await main(gym), /Paused after refresh\.\s*The simulation stopped when the page reloaded/);
  await sleep(1500);
  assert.equal((await attempt(gym)).done, reloaded.done);
  await clickText(gym, '.run-notice button', 'Resume simulation');
  await until(gym, async () => (await attempt(gym)).done > reloaded.done, 'progress after resuming a refresh pause');
}));

test('cancel mid-run asks first, keeps finished executions and stops the plan', async t => withGym(t, async gym => {
  await fresh(gym, SALES, { search: '' });
  await until(gym, async () => (await attempt(gym)).done >= 13, 'one more execution');
  await clickText(gym, '.gym-pagehead button', 'Cancel');
  assert.match(await gym.ev('return document.querySelector("dialog.gym-dialog").innerText'), /Cancel this attempt\?[\s\S]*are kept/);
  await clickText(gym, 'dialog.gym-dialog button', 'Keep running');
  assert.notEqual((await attempt(gym)).status, 'cancelled', 'Keep running cancels nothing');
  await clickText(gym, '.gym-pagehead button', 'Cancel');
  await clickText(gym, 'dialog.gym-dialog button', 'Cancel attempt');
  const cancelled = await attempt(gym);
  assert.equal(cancelled.status, 'cancelled');
  assert.ok(cancelled.done >= 13 && cancelled.done < 18, `finished executions are kept (${cancelled.done})`);
  await sleep(2000);
  assert.equal((await attempt(gym)).done, cancelled.done, 'no execution after cancel');
  const text = await main(gym);
  assert.match(text, /Cancelled\.\s*\d+ finished executions are kept/);
  assert.match(text, /\d cancelled/, 'unrun plan items show as cancelled in the matrix');
  assert.equal(await gym.ev('return document.querySelector("[data-focus-key=\'run:cancel\']").getAttribute("aria-disabled")'), 'true');
}));
