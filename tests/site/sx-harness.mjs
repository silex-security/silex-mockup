// Shared headless harness for the Scenario Expansion tests (logs/2026-10-11_SCENARIO_EXPANSION_PLAN.md).
// withPage(t, fn) serves the repo from a local static server (no git, no network), opens headless Chrome through
// tests/site/ontology-card/browser.mjs and calls fn with a small page API. It skips the test with a clear message
// when no Chrome binary exists (set CHROME), like the other headless site tests.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { browser, until, sleep } from './ontology-card/browser.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
// Same noise filter as the other headless site tests: favicon, web fonts and certificates are not page errors.
const NOISE = /favicon|fonts\.(googleapis|gstatic)|ERR_CERT|net::ERR_(INTERNET|NAME)/i;

export { until, sleep };

/**
 * @param {import('node:test').TestContext} t
 * @param {(api: {
 *   ev: (code: string) => Promise<any>,            // run an async function body in the page, return its value
 *   go: (hash?: string) => Promise<void>,          // load index.html with a hash and wait for the view host
 *   size: (width: number, height?: number) => Promise<void>,
 *   reducedMotion: (on: boolean) => Promise<void>, // emulate prefers-reduced-motion (set before go())
 *   overflow: () => Promise<{ win: number, doc: number }>, // page width vs scroll width
 *   errors: () => string[],                        // page exceptions and console errors so far, noise removed
 *   page: any,
 * }) => Promise<void>} fn
 */
export async function withPage(t, fn) {
  let session;
  try { session = await browser(); } catch (e) {
    if (/Chrome not found/.test(e.message)) return t.skip('no Chrome binary (set CHROME); headless check skipped');
    throw e;
  }
  const server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      let file = resolve(ROOT, '.' + path);
      if (file !== ROOT && !file.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(await readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  const p = session.page;
  try {
    await new Promise((r, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', r); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const api = {
      page: p,
      ev: code => p.ev(code),
      async go(hash = '#view=scenario-expansion') {
        await p.send('Page.navigate', { url: 'about:blank' });
        await p.send('Page.navigate', { url: `${origin}/index.html${hash}` });
        await until(() => p.ev('return document.readyState === "complete" && !!window.__sxView'), 'page ' + hash, 30000);
      },
      size: (width, height = 1000) => p.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 }),
      reducedMotion: on => p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: on ? 'reduce' : 'no-preference' }] }),
      overflow: () => p.ev('return { win: innerWidth, doc: document.documentElement.scrollWidth }'),
      errors: () => p.errors.filter(e => !NOISE.test(String(e))),
    };
    await api.size(1400);
    await fn(api);
  } finally {
    session.close();
    await new Promise(r => server.close(r));
  }
}
