// index.html#view=blueprint opens Blueprint Studio on a fresh load, in headless Chrome.
// Skips with a clear message when no Chrome binary exists (set CHROME).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { browser, until } from './ontology-card/browser.mjs';
import { serveRepo } from '../../tools/gym-shot.mjs';

test('a fresh load of #view=blueprint mounts the Studio frame', async t => {
  let session;
  try { session = await browser(); } catch (e) {
    if (/Chrome not found/.test(e.message)) return t.skip('no Chrome binary (set CHROME); headless check skipped');
    throw e;
  }
  const server = await serveRepo();
  try {
    await session.page.send('Page.navigate', { url: `${server.origin}/index.html#view=blueprint` });
    await until(() => session.page.ev('return document.readyState === "complete"'), 'page load');
    const src = await until(() => session.page.ev('return document.getElementById("studioFrame")?.getAttribute("src")'), 'the Studio frame', 5000).catch(() => null);
    assert.match(String(src), /^blueprint_studio\/app\/index\.html\?embed=1#cmd=resume/);
  } finally { session.close(); await server.close(); }
});
