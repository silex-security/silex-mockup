// Conclusions where people look, in headless Chrome: the acceptance checks and objective on Results, and the result
// line on the Runs list and in the workbench queue. Skips cleanly without Chrome (set CHROME).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openGym } from '../../tools/gym-shot.mjs';

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

const acceptance = gym => gym.ev(`const p = document.querySelector('.run-accept');
  return { badge: p.querySelector('.run-accept__verdict').textContent.trim(), objective: p.querySelector('.run-accept__objective').textContent.replace(/\\s+/g, ' ').trim(),
    checks: [...p.querySelectorAll('.run-accept__check')].map(li => [li.dataset.check, li.dataset.passed, li.textContent.replace(/\\s+/g, ' ').trim()]) }`);

test('Results lists each acceptance check with its detail, and names the objective', async t => withGym(t, async gym => {
  await gym.go('#/experiments/exp-024/attempts/attempt-004/results');
  const pass = await acceptance(gym);
  assert.equal(pass.badge, 'Meets acceptance');
  assert.match(pass.objective, /Objective: Policy violations/);
  assert.match(pass.objective, /Fewer is better/);
  assert.deepEqual(pass.checks.map(c => [c[0], c[1]]), [['complete', 'true'], ['no-regression', 'true'], ['min-improved', 'true'], ['objective', 'true'], ['shared-agents', 'true']]);
  assert.match(pass.checks[3][2], /Policy violations no worse than baseline.*1 → 0/);

  await gym.go('#/experiments/exp-025/attempts/attempt-005/results');
  const fail = await acceptance(gym);
  assert.equal(fail.badge, 'Does not meet acceptance');
  assert.deepEqual(fail.checks.map(c => [c[0], c[1]]), [['complete', 'true'], ['no-regression', 'false'], ['min-improved', 'false'], ['objective', 'false'], ['shared-agents', 'false']]);
  assert.match(fail.checks[1][2], /No regressed pairs.*2 regressed/);
  assert.match(fail.checks[3][2], /Success rate no worse than baseline.*100% → 67%/);
  assert.match(await gym.ev('return document.querySelector(".run-accept").textContent'), /nothing is adopted or deployed/i);
}));

test('a live attempt reads its acceptance as not met yet, because the pairs are not complete', async t => withGym(t, async gym => {
  await gym.go('#/experiments/exp-029/attempts/attempt-002/results');
  const live = await acceptance(gym);
  assert.equal(live.badge, 'Does not meet acceptance');
  assert.deepEqual(live.checks[0].slice(0, 2), ['complete', 'false']);
}));

test('the Runs list and the workbench queue show one result line per finished attempt, and the outcome once it is reviewed', async t => withGym(t, async gym => {
  await gym.go('#/runs?status=completed');
  const rows = await gym.ev(`return [...document.querySelectorAll('.run-list__row')].map(tr => [tr.querySelector('.run-list__title').textContent,
    tr.querySelector('td[data-label="Progress"] .run-list__result')?.textContent.trim() ?? null, tr.querySelector('td[data-label="Review decision"]').textContent.trim()])`);
  assert.deepEqual(rows, [
    ['Invoice review · shared-agent check', 'Success rate 100% → 80% · 0 improved · 1 regressed', 'Not reviewed'],
    ['Sales follow-up · shared-agent check', 'Success rate 67% → 67% · 0 improved · 0 regressed', 'Not reviewed'],
    ['Invoice review · shared-agent check', 'Policy violations 0 → 0 · 0 improved · 0 regressed', 'Not reviewed'],
    ['Support triage v2 · shared-agent check', 'Policy violations 0 → 0 · 0 improved · 0 regressed', 'Not reviewed'],
    ['Refund timeout steps', 'Steps per run 8.5 → 9.0 · 2 improved · 0 regressed', 'Needs iteration'],
    ['Smaller model for refund replies', 'Success rate 100% → 67% · 0 improved · 2 regressed · shared workflows: 1 regressed', 'Reject'],
    ['Duplicate-send guard', 'Policy violations 1 → 0 · 1 improved · 0 regressed', 'Pass for demo'],
    ['Meeting scheduling', 'Success rate 100% → 100% · 0 improved · 0 regressed', 'Not reviewed'],
  ]);
  await gym.go('#/runs?status=running');
  assert.equal(await gym.ev('return document.querySelectorAll(".run-list__result").length'), 0, 'a running attempt has no result line');

  await gym.go('#/workbench/exp-029');
  const queue = await gym.ev(`return [...document.querySelectorAll('.wb-qrow')].map(tr => [tr.querySelector('.wb-qtitle span').textContent, tr.querySelector('.wb-qres').innerText.trim().replace(/\\s+/g, ' ')])`);
  assert.deepEqual(queue.slice(6), [
    ['Refund timeout steps', 'Steps per run 8.5 → 9.0 · 2 improved · 0 regressed Needs iteration View results'],
    ['Smaller model for refund replies', 'Success rate 100% → 67% · 0 improved · 2 regressed · shared workflows: 1 regressed Reject View results'],
    ['Duplicate-send guard', 'Policy violations 1 → 0 · 1 improved · 0 regressed Pass for demo View results'],
    ['Meeting scheduling', 'Success rate 100% → 100% · 0 improved · 0 regressed View results'],
  ]);
}));

test('recording a review updates the queue row for the experiment at once', async t => withGym(t, async gym => {
  await gym.go('#/experiments/exp-027/attempts/attempt-001/results');
  await gym.ev(`document.querySelector('input[value="needs_iteration"]').click(); await new Promise(r => requestAnimationFrame(r));
    [...document.querySelectorAll('.run-review button')].find(b => b.textContent.trim() === 'Mark reviewed').click(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));`);
  await gym.go('#/experiments?status=done');
  const ids = await gym.ev(`return [...document.querySelectorAll('.xq-row')].map(tr => tr.dataset.experiment)`);
  assert.deepEqual(ids, ['exp-027', 'exp-026', 'exp-025', 'exp-024'], 'the reviewed experiment moved from Needs review to Done');
  assert.match(await gym.ev(`return document.querySelector('.xq-row[data-experiment="exp-027"] td[data-label="Progress or result"]').textContent`), /Needs iteration/);
}));
