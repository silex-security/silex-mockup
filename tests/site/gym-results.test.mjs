// Results page in headless Chrome (plan 8.2, 8.4, 9.2; 13.1 items 9 and 11; 13.2 paths B and C).
// Drives the page through tools/gym-shot.mjs. Skips with a clear message when no Chrome binary exists (set CHROME).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openGym } from '../../tools/gym-shot.mjs';
import { STORAGE_KEY } from '../../agent-gym/js/model.js';
import { seedState } from '../../agent-gym/js/fixtures/index.js';

const SALES = '#/experiments/exp-029/attempts/attempt-002';
const RESULTS = `${SALES}/results`;
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
const attempt = gym => gym.ev(`const s = window.__gym.store.getState(), a = s.attempts['attempt-002']; return { status: a.status, done: s.executions[a.id].length, review: a.review }`);
const stats = gym => gym.ev(`return Object.fromEntries([...document.querySelectorAll('[data-stat]')].map(el => [el.dataset.stat, el.querySelector('.run-stat__value').textContent]))`);
const verdict = gym => gym.ev('return document.querySelector(".run-verdict__main").innerText.replace(/\\s+/g, " ").trim()');

async function until(predicate, label, ms = 20000) {
  const end = Date.now() + ms;
  for (;;) {
    if (await predicate()) return;
    if (Date.now() > end) throw Error(`timed out waiting for ${label}`);
    await sleep(150);
  }
}

test('a running attempt shows a partial, inconclusive comparison with a link back to run detail and no review', async t => withGym(t, async gym => {
  await fresh(gym, RESULTS);
  assert.equal(await verdict(gym), 'Inconclusive This attempt is still running. 6 of 9 pairs are complete.');
  assert.deepEqual(await stats(gym), { complete: '6/9', baseline: '3/6', variant: '6/6', improved: '3', regressed: '0' });
  const text = await main(gym);
  assert.match(text, /Still running\.\s*This is a partial comparison of 12 of 18 executions/);
  assert.match(text, /Missing pairs \(3\): Contact opted out · repetition 1/);
  assert.equal(await gym.ev('return [...document.querySelectorAll(".run-notice a")].find(a => a.textContent === "Open run detail")?.getAttribute("href")'), SALES);
  assert.equal(await gym.ev('return document.querySelector("[data-focus-key=\'res:submit\']").getAttribute("aria-disabled")'), 'true', 'a running attempt cannot be reviewed');
  assert.equal(await gym.ev('return [...document.querySelectorAll(".gym-main button, .gym-main a")].filter(b => /adopt|deploy|register/i.test(b.textContent)).length'), 0);
  for (const width of [390, 768]) {
    await gym.size(width, 900);
    await gym.ev(frame);
    const { win, doc } = await gym.overflow();
    assert.ok(doc <= win, `results at ${width}px: scrollWidth ${doc} > ${win}`);
  }
}));

test('run to completion: 6/9 against 9/9, 3 improved, 0 regressed, the timeout pair side by side, then Mark reviewed', async t => withGym(t, async gym => {
  await fresh(gym, SALES, { search: '' });
  await until(async () => (await attempt(gym)).status === 'completed', 'attempt-002 completed');
  await gym.ev(`location.hash = ${JSON.stringify(RESULTS)}; ${frame}`);

  assert.deepEqual(await stats(gym), { complete: '9/9', baseline: '6/9', variant: '9/9', improved: '3', regressed: '0' });
  assert.equal(await verdict(gym), 'Pass All 9 pairs are complete and none regressed.');
  const text = await main(gym);
  assert.match(text, /not independent statistical samples/);
  assert.match(text, /do not measure a real change in success rate/);
  assert.ok((text.match(/Simulated evidence · Not deployed/g) ?? []).length >= 4, 'every conclusion carries the evidence tag');
  assert.deepEqual(await gym.ev(`return [...document.querySelectorAll('.run-byscenario tbody tr')].map(tr => [...tr.children].slice(0, 5).map(c => c.textContent))`), [
    ['Base case', '3/3', '3/3', '0', '0'], ['Timeout after send', '0/3', '3/3', '3', '0'], ['Contact opted out', '3/3', '3/3', '0', '0'],
  ]);

  const pair = await gym.ev(`const side = v => document.querySelector('.run-side[data-side="' + v + '"]');
    const outbox = v => [...side(v).querySelectorAll('.run-state__part')].find(p => p.querySelector('h4').textContent.startsWith('Outbox'));
    const calls = v => [...side(v).querySelectorAll('.run-call .run-ev__tool')].map(c => c.textContent);
    return { title: document.querySelector('.run-pair .gym-panel__subtitle').textContent,
      kind: document.querySelector('.run-pair .gym-panel__actions').innerText,
      baseline: { count: outbox('baseline').querySelector('.run-state__count').textContent, items: outbox('baseline').querySelectorAll('li').length, calls: calls('baseline'), why: side('baseline').querySelector('.run-asserts').innerText, trace: side('baseline').querySelector('.run-trace').innerText },
      variant: { count: outbox('variant').querySelector('.run-state__count').textContent, items: outbox('variant').querySelectorAll('li').length, calls: calls('variant'), trace: side('variant').querySelector('.run-trace').innerText } }`);
  assert.equal(pair.title, 'Timeout after send · repetition 1', 'the improved timeout pair opens first');
  assert.match(pair.kind, /Improved/);
  assert.deepEqual([pair.baseline.count, pair.baseline.items], ['2 emails', 2], 'baseline: blind retry with a new key sends twice');
  assert.deepEqual([pair.variant.count, pair.variant.items], ['1 email', 1], 'variant: status check with key reuse sends once');
  assert.deepEqual(pair.baseline.calls, ['crm.find_opportunity', 'db.lookup_contact', 'email.send_email', 'email.send_email', 'crm.update_opportunity']);
  assert.deepEqual(pair.variant.calls, ['crm.find_opportunity', 'db.lookup_contact', 'email.send_email', 'email.get_send_status', 'crm.update_opportunity']);
  assert.match(pair.baseline.trace, /retrying with a new idempotency key/);
  assert.match(pair.variant.trace, /checking the send status before any retry/);
  assert.match(pair.baseline.why, /At most one email for the logical task\s+Expected\s+outbox\.count == 1\s+Observed\s+outbox\.count = 2/);

  await gym.ev(`document.querySelector('[data-pair="sc-base-case,2"]').click(); ${frame}`);
  assert.equal(await gym.ev('return location.hash'), `${RESULTS}?pair=sc-base-case,2`);
  assert.equal(await gym.ev('return document.querySelector(".run-pair .gym-panel__subtitle").textContent'), 'Base case · repetition 2');

  assert.equal(await gym.ev('return document.querySelector("[data-focus-key=\'res:submit\']").getAttribute("aria-disabled")'), 'true', 'needs a decision first');
  await gym.ev(`document.querySelector('input[value="pass_for_demo"]').click(); ${frame}
    const note = document.querySelector('[data-focus-key="res:note"]'); note.focus(); note.value = 'Timeout recovery checked'; note.dispatchEvent(new Event('input', { bubbles: true })); ${frame}`);
  await clickText(gym, '.run-review button', 'Mark reviewed');
  const { review } = await attempt(gym);
  assert.deepEqual([review.decision, review.note, review.deploymentState], ['pass_for_demo', 'Timeout recovery checked', 'not_deployed']);
  const done = await gym.ev('return document.querySelector(".run-review__done").innerText');
  assert.match(done, /Pass for demo[\s\S]*Not deployed[\s\S]*Timeout recovery checked/);
  assert.equal(await gym.ev('return [...document.querySelectorAll(".gym-main button, .gym-main a")].filter(b => /adopt|deploy|register/i.test(b.textContent)).length'), 0);

  await gym.ev(`location.hash = '#/runs?status=all'; ${frame}`);
  assert.equal(await gym.ev('return document.querySelector(\'.run-list__row[data-attempt="attempt-002"] td[data-label="Review decision"]\').innerText.trim()'), 'Pass for demo', 'the review decision is its own column');
}));

test('a cancelled attempt reads Inconclusive, keeps its finished pairs and cannot be passed for demo', async t => withGym(t, async gym => {
  await fresh(gym, SALES, { search: '' });
  await until(async () => (await attempt(gym)).done >= 13, 'one more execution');
  await clickText(gym, '.gym-pagehead button', 'Cancel');
  await clickText(gym, 'dialog.gym-dialog button', 'Cancel attempt');
  const { done, status } = await attempt(gym);
  assert.equal(status, 'cancelled');
  await gym.ev(`location.hash = ${JSON.stringify(RESULTS)}; ${frame}`);
  const v = await verdict(gym);
  assert.match(v, /^Inconclusive This attempt was cancelled\./);
  assert.doesNotMatch(v, /Pass/);
  const s = await stats(gym);
  assert.equal(Number(s.baseline.split('/')[1]) + Number(s.variant.split('/')[1]), done, 'totals count only the executions that ran');
  assert.match(await main(gym), /Incomplete\s+Contact opted out · repetition 3/);
  assert.equal(await gym.ev('return document.querySelector(\'input[value="pass_for_demo"]\').disabled'), true);
  await gym.ev(`document.querySelector('input[value="needs_iteration"]').click(); ${frame}`);
  await clickText(gym, '.run-review button', 'Mark reviewed');
  const { review } = await attempt(gym);
  assert.deepEqual([review?.decision, review?.deploymentState], ['needs_iteration', 'not_deployed']);
}));

test('a complete attempt whose variant still fails reads Fail and cannot be passed for demo', async t => withGym(t, async gym => {
  const s = seedState();
  const failing = { ...s, executions: { ...s.executions, 'attempt-001': s.executions['attempt-001'].map(e => ({ ...e, terminalState: 'failed' })) } };
  await gym.go('#/kit');
  await gym.ev(`localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, ${JSON.stringify(JSON.stringify(failing))})`);
  await gym.go('#/experiments/exp-027/attempts/attempt-001/results');
  assert.equal(await gym.ev('return window.__gym.store.persistence.mode'), 'local', 'the crafted save loads');
  const v = await verdict(gym);
  assert.match(v, /^Fail /);
  const st = await stats(gym);
  assert.deepEqual([st.complete, st.baseline, st.variant, st.regressed], ['6/6', '0/6', '0/6', '0']);
  assert.equal(await gym.ev('return document.querySelector(\'input[value="pass_for_demo"]\').disabled'), true);
}));

test('an unknown attempt renders not found, and a mismatched experiment links to the right results', async t => withGym(t, async gym => {
  await fresh(gym, '#/experiments/exp-029/attempts/attempt-404/results');
  assert.match(await main(gym), /Attempt not found/);
  assert.equal(await gym.ev('return [...document.querySelectorAll(".gym-main a")].find(a => a.textContent === "View all runs")?.getAttribute("href")'), '#/runs?status=all');
  await gym.go('#/experiments/exp-029/attempts/attempt-001/results');
  assert.match(await main(gym), /This attempt belongs to another experiment/);
  assert.equal(await gym.ev('return [...document.querySelectorAll(".gym-main a")].find(a => a.textContent === "Open Meeting scheduling")?.getAttribute("href")'), '#/experiments/exp-027/attempts/attempt-001/results');
}));
