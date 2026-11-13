// The sidebar and the address bar agree: a click on a sidebar view puts that view in the URL, so a reload or a copied
// link reopens what the visitor is looking at, and Back returns to the view they came from.
// Local static server + headless Chrome, like rt-subnav.test.mjs; skips when no Chrome binary exists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { browser, until } from './ontology-card/browser.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

test('a sidebar click writes the view into the URL', { timeout: 120000 }, async t => {
  let session;
  try { session = await browser(); } catch (e) {
    if (/Chrome not found/.test(e.message)) return t.skip('no Chrome binary (set CHROME); headless check skipped');
    throw e;
  }
  const server = createServer(async (req, res) => {
    try {
      let file = resolve(ROOT, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
      if (file !== ROOT && !file.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(await readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const { page: p } = session, ev = p.ev;
  const hash = () => ev('return location.hash');
  const active = () => ev('return document.querySelector(".view.active").id');
  const click = view => ev(`document.querySelector('.nav button[data-view="${view}"]').click()`);
  const open = async h => {
    await p.send('Page.navigate', { url: 'about:blank' });
    await p.send('Page.navigate', { url: base + '/index.html' + h });
    await until(() => ev('return !!window.__siteShowView && !!window.__gymHost'), 'the console script ran');
  };
  const gymReady = () => until(() => ev('return !!document.getElementById("gymFrame")?.contentWindow.__gym'), 'the Agent Gym frame loaded');
  try {
    await open('#view=gym');
    await gymReady();
    const views = await ev('return [...document.querySelectorAll(".nav button[data-view]")].map(b => b.dataset.view)');
    for (const view of views.filter(v => v !== 'gym')) {
      await click(view);
      assert.equal(await active(), view);
      assert.equal(new URLSearchParams((await hash()).slice(1)).get('view'), view, `the URL names ${view} after its sidebar click`);
    }

    await open('#view=gym');
    await gymReady();
    await click('library');
    await click('incidents');
    await ev('history.back()');
    await until(async () => await hash() === '#view=library', 'Back restores the library URL');
    assert.equal(await active(), 'library', 'Back returns to the view the visitor came from');

    await open('');
    await click('library');
    assert.equal(await hash(), '#view=library');
    await ev('history.back()');
    await until(async () => await active() === 'assurance', 'Back from the first click returns to the home view');

    await open('#view=runtime-observation&tab=latency');
    await click('incidents');
    await click('runtime-observation');
    assert.equal(await hash(), '#view=runtime-observation&tab=latency', 'coming back keeps the open tab, and the URL says so');

    await open('#view=library');
    await click('gym-runs');
    await gymReady();
    assert.equal(await hash(), '#view=gym-runs');
    await ev('document.getElementById("gymFrame").contentWindow.location.hash = "/scenarios"');
    await until(async () => await hash() === '#view=gym-scenarios', 'the frame still mirrors its route after a sidebar click');
    assert.equal(await active(), 'gym-scenarios');

    assert.deepEqual(p.errors, [], 'no console errors');
  } finally { server.close(); await session.close(); }
});
