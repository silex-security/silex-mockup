// Gym to Speedrun: a Speedrun-sourced experiment carries the Speedrun route it came from and links back to it.
// The pure parts run in Node. The page parts drive the real app in headless Chrome and skip without it (set CHROME).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openGym } from '../../tools/gym-shot.mjs';
import { seedState } from '../../agent-gym/js/fixtures/index.js';
import { stateProblems } from '../../agent-gym/js/integrity.js';
import { consoleHref } from '../../agent-gym/js/experiments/source.js';
import { compile, match } from '../../speedrun/web/src/routes.js';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '../../speedrun/web/upstream/src/app');
const pageFiles = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? pageFiles(join(dir, e.name)) : e.name === 'page.tsx' ? [join(dir, e.name)] : []);
const speedrunRoutes = compile(pageFiles(APP), 'page.tsx');

test('consoleHref builds a relative console URL with the route encoded', () => {
  assert.equal(consoleHref('speedrun', '/speedrun/teams/refund/trace'), '../index.html#view=speedrun&path=%2Fspeedrun%2Fteams%2Frefund%2Ftrace');
});

test('every seeded Speedrun experiment carries a ref that is a real route of the built Speedrun app, and no other source does', () => {
  const sources = Object.values(seedState().experiments).map(e => [e.id, e.source.kind, e.source.ref]);
  const speedrun = sources.filter(([, kind]) => kind === 'speedrun');
  assert.ok(speedrun.length >= 3);
  for (const [id, , ref] of speedrun) assert.ok(typeof ref === 'string' && match(speedrunRoutes, ref), `${id} ref ${ref} is a Speedrun route`);
  for (const [id, kind, ref] of sources.filter(([, kind]) => kind !== 'speedrun')) assert.equal(ref, null, `${id} (${kind}) has no ref`);
});

test('the integrity check accepts a null ref and a /speedrun/ route, and rejects anything else', () => {
  const withRef = ref => { const s = seedState(); s.experiments['exp-024'].source.ref = ref; return stateProblems(s); };
  assert.deepEqual(withRef(null), []);
  assert.deepEqual(withRef('/speedrun/teams/refund/trace'), []);
  for (const bad of ['https://example.com/speedrun/x', '//speedrun/x', '/gym/experiments', '/speedrun', '/speedrun/', '/speedrun/a b', '/speedrun/../x', '/speedrun/x?y=1', 'javascript:alert(1)', undefined, 7]) {
    assert.match(withRef(bad).join('\n'), /exp-024: source ref/, `rejects ${String(bad)}`);
  }
});

async function withGym(t, fn) {
  let gym;
  try { gym = await openGym(); } catch (e) {
    if (/Chrome not found/.test(e.message)) return t.skip('no Chrome binary (set CHROME); headless check skipped');
    throw e;
  }
  try {
    await gym.size(1440, 900);
    await gym.go('#/kit');
    await gym.ev('localStorage.clear()');
    await fn(gym);
    assert.deepEqual(gym.problems(), [], 'no page errors and no failed requests');
  } finally { await gym.close(); }
}

const LINK = 'View source in Speedrun';

test('the queue shows View source in Speedrun on Speedrun rows only, as a real top-level link', async t => withGym(t, async gym => {
  await gym.go('#/experiments');
  const rows = await gym.ev(`return [...document.querySelectorAll('.xq-row')].map(tr => {
    const a = [...tr.querySelectorAll('td[data-label="Source"] a')];
    return [tr.dataset.experiment, a.map(x => [x.textContent.trim(), x.getAttribute('href'), x.getAttribute('target')])]; })`);
  const byId = Object.fromEntries(rows);
  const links = Object.entries(byId).filter(([, a]) => a.length).map(([id]) => id).sort();
  assert.deepEqual(links, ['exp-024', 'exp-027', 'exp-030'], 'only the three Speedrun experiments link back');
  const [[text, href, target]] = byId['exp-024'];
  assert.equal(text, LINK);
  assert.match(href, /^\.\.\/index\.html#view=speedrun&path=%2Fspeedrun%2Fteams%2F[a-z-]+%2Ftrace$/);
  assert.equal(target, '_top');
}));

test('the workbench of a Speedrun experiment links back; studio and manual workbenches do not', async t => withGym(t, async gym => {
  const link = id => gym.go('#/workbench/' + id).then(() => gym.ev(`return [...document.querySelectorAll('.wb-head a')].filter(a => a.textContent.includes(${JSON.stringify(LINK)})).map(a => [a.getAttribute('href'), a.getAttribute('target')])`));
  const seeded = seedState().experiments;
  const expected = '../index.html#view=speedrun&path=' + encodeURIComponent(seeded['exp-030'].source.ref);
  assert.deepEqual(await link('exp-030'), [[expected, '_top']]);
  assert.deepEqual(await link('exp-029'), [], 'a Studio experiment has no link');
  assert.deepEqual(await link('exp-028'), [], 'a manual experiment has no link');
}));
