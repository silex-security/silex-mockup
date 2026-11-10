// One experiment as a line from the queue to a decision, in headless Chrome: Configure from the queue, Run from the
// workbench, and the queue showing the new stage; then Review from the queue and the decision moving the row to Done.
// Skips without Chrome (set CHROME).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openGym } from '../../tools/gym-shot.mjs';

const frame = 'await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));';
const settle = `${frame} await new Promise(r => setTimeout(r, 80));`;

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

const tabs = gym => gym.ev(`return Object.fromEntries([...document.querySelectorAll('.xq-filter [role=tab]')].map(b => b.textContent.split(' · ')))`);
const row = (gym, id) => gym.ev(`const tr = document.querySelector('.xq-row[data-experiment="${id}"]'); return tr && { stage: tr.dataset.stage, action: tr.querySelector('td[data-label="Action"]').textContent.trim() }`);

test('queue, Configure, workbench, Run, queue: a pending experiment is queued and its row and counts follow', async t => withGym(t, async gym => {
  await gym.go('#/experiments');
  assert.deepEqual(await row(gym, 'exp-030'), { stage: 'pending', action: 'Configure' });
  const before = await tabs(gym);
  assert.deepEqual([before.Pending, before.Queued], ['3', '1']);

  await gym.ev(`document.querySelector('[data-focus-key="xq:action:exp-030"]').click(); ${settle}`);
  assert.equal(await gym.ev('return location.hash'), '#/workbench/exp-030', 'Configure opens the workbench of that experiment');
  assert.match(await gym.ev('return document.querySelector(".wb-title__input").value'), /Opt-out wording check/);
  assert.equal(await gym.ev('return document.querySelector(".gym-steps__item.is-current").dataset.step'), 'configure');
  assert.equal(await gym.ev('return document.querySelector(".gym-steps__item[data-step=run] [aria-disabled]") !== null'), true, 'Run has no target before anything ran');

  await gym.ev(`document.querySelector('.wb-run__go').click(); ${settle}`);
  const queued = await gym.ev(`const s = window.__gym.store.getState(); const a = Object.values(s.attempts).filter(a => a.experimentId === 'exp-030');
    return { attempts: a.length, status: a[0]?.status, saved: s.experiments['exp-030'].savedRevision === s.experiments['exp-030'].draftRevision,
      run: document.querySelector('.gym-steps__item[data-step=run] a')?.getAttribute('href') };`);
  assert.deepEqual(queued, { attempts: 1, status: 'queued', saved: true, run: `#/experiments/exp-030/attempts/${await gym.ev("return Object.values(window.__gym.store.getState().attempts).find(a => a.experimentId === 'exp-030').id")}` });

  await gym.ev(`window.__gym.router.go('experiment-queue'); ${settle}`);
  assert.deepEqual(await row(gym, 'exp-030'), { stage: 'queued', action: 'View' });
  const after = await tabs(gym);
  assert.deepEqual([after.Pending, after.Queued, after.All], ['2', '2', '9']);
  assert.match(await gym.ev('return document.querySelector(".xq-card[data-focus-key=\\"xq:card:queued\\"]").textContent'), /Queued2/);
  assert.match(await gym.ev('return document.querySelector(".xq-row[data-experiment=\\"exp-030\\"] td[data-label=\\"Progress or result\\"]").innerText'), /Position 2 of 2/);
}));

test('queue, Review, results, Mark reviewed, queue: a finished experiment moves to Done with its outcome', async t => withGym(t, async gym => {
  await gym.go('#/experiments');
  assert.deepEqual(await row(gym, 'exp-027'), { stage: 'needs_review', action: 'Review' });

  await gym.ev(`document.querySelector('[data-focus-key="xq:action:exp-027"]').click(); ${settle}`);
  assert.equal(await gym.ev('return location.hash'), '#/experiments/exp-027/attempts/attempt-001/results');
  assert.equal(await gym.ev('return document.querySelector(".gym-steps__item.is-current").dataset.step'), 'review');
  assert.match(await gym.ev('return document.querySelector(".run-accept__verdict").textContent'), /Meets acceptance/);

  await gym.ev(`document.querySelector('input[value="pass_for_demo"]').click(); ${frame}
    [...document.querySelectorAll('.run-review button')].find(b => b.textContent.trim() === 'Mark reviewed').click(); ${settle}`);
  await gym.ev(`window.__gym.router.go('experiment-queue', {}, { status: 'done' }); ${settle}`);
  const done = await gym.ev(`return [...document.querySelectorAll('.xq-row')].map(tr => [tr.dataset.experiment, tr.dataset.stage])`);
  assert.deepEqual(done[0], ['exp-027', 'done']);
  assert.match(await gym.ev('return document.querySelector(".xq-row[data-experiment=\\"exp-027\\"] td[data-label=\\"Progress or result\\"]").innerText'), /Pass for demo/);
  assert.deepEqual(await row(gym, 'exp-027'), { stage: 'done', action: 'Results' });
  const t2 = await tabs(gym);
  assert.deepEqual([t2['Needs review'], t2.Done], ['0', '4']);
}));
