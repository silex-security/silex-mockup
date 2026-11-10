#!/usr/bin/env node
// Screenshot one Agent Gym v2 route in headless Chrome, and fail on page errors or failed requests.
//
//   node tools/gym-shot.mjs '#/workbench/exp-029' 1585x992 out.png
//
// Serves the repo root from a local static server (no network needed), loads agent-gym/index.html?clock=frozen
// with the given hash, waits for window.__gym.ready and for fonts, then writes a PNG of the viewport.
// Exits 1 when the page threw, logged a console error, or a request failed. Exits 2 when Chrome is missing.
// tests/site/gym-shell.test.mjs imports openGym from here, so the tool and the test drive the page the same way.
import { createServer } from 'node:http';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { dirname, resolve, join, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { browser, until } from '../tests/site/ontology-card/browser.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
// Web fonts and the favicon are not part of the page under test, and fonts are unreachable offline.
const NOISE = /favicon|fonts\.(googleapis|gstatic)|ERR_CERT|net::ERR_(INTERNET|NAME)/i;

async function serveRepo() {
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
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(done => server.close(done)) };
}

/**
 * Open headless Chrome on the Gym page. Throws Error('Chrome not found; set CHROME') when there is no browser.
 * @returns {Promise<{
 *   go(hash?: string, opts?: { search?: string }): Promise<void>,   // load the page and wait for window.__gym.ready
 *   size(width: number, height?: number): Promise<void>,
 *   ev(code: string): Promise<any>,                                // run an async function body in the page
 *   key(key: string, opts?: { shift?: boolean }): Promise<void>,   // a real key press through CDP
 *   shot(file: string): Promise<void>,
 *   overflow(): Promise<{ win: number, doc: number }>,
 *   problems(): string[],                                          // page errors and failed requests so far
 *   page: any, close(): Promise<void>,
 * }>}
 */
export async function openGym() {
  const session = await browser();
  const server = await serveRepo().catch(e => { session.close(); throw e; });
  const p = session.page;
  const failed = [], urls = new Map();
  p.ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.method === 'Network.requestWillBeSent') urls.set(m.params.requestId, m.params.request.url);
    if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) failed.push(`HTTP ${m.params.response.status} ${m.params.response.url}`);
    if (m.method === 'Network.loadingFailed' && !m.params.canceled) failed.push(`${m.params.errorText} ${urls.get(m.params.requestId) || ''}`);
  });
  const KEYS = { Tab: 9, Enter: 13, Escape: 27, ' ': 32, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, End: 35, Home: 36 };
  const api = {
    page: p,
    ev: code => p.ev(code),
    size: (width, height = 1000) => p.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }),
    async go(hash = '', { search = '?clock=frozen' } = {}) {
      await p.send('Page.navigate', { url: 'about:blank' });
      await p.send('Page.navigate', { url: `${server.origin}/agent-gym/index.html${search}${hash}` });
      await until(() => p.ev('return document.readyState === "complete" && window.__gym?.ready === true'), `window.__gym.ready on ${hash || '(no hash)'}; ${api.problems().join(' | ')}`, 20000);
      await p.ev('await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 3000))]); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));');
    },
    async key(key, { shift = false } = {}) {
      const base = { key, code: key === ' ' ? 'Space' : key, windowsVirtualKeyCode: KEYS[key], modifiers: shift ? 8 : 0 };
      // Chrome activates a focused button only on a key press that carries text.
      const text = { Enter: '\r', ' ': ' ' }[key];
      await p.send('Input.dispatchKeyEvent', text ? { type: 'keyDown', text, ...base } : { type: 'rawKeyDown', ...base });
      await p.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
    },
    async shot(file) {
      const { data } = await p.send('Page.captureScreenshot', { format: 'png' });
      await writeFile(file, Buffer.from(data, 'base64'));
    },
    overflow: () => p.ev('return { win: innerWidth, doc: document.documentElement.scrollWidth }'),
    problems: () => [...p.errors, ...failed].map(String).filter(e => !NOISE.test(e)),
    async close() { session.close(); await server.close(); },
  };
  return api;
}

async function main([hash = '#/workbench/exp-029', size = '1585x992', out = 'gym-shot.png']) {
  const [width, height] = size.split('x').map(Number);
  if (!hash.startsWith('#') || !(width > 0) || !(height > 0)) { console.error("usage: node tools/gym-shot.mjs '#/route' WIDTHxHEIGHT out.png"); return 64; }
  let gym;
  try { gym = await openGym(); } catch (e) { console.error(e.message); return /Chrome not found/.test(e.message) ? 2 : 1; }
  try {
    await gym.size(width, height);
    await gym.go(hash);
    await gym.shot(out);
    const { win, doc } = await gym.overflow();
    const problems = gym.problems();
    console.log(`${out}  ${width}x${height}  ${hash}  scrollWidth ${doc}/${win}${doc > win ? '  HORIZONTAL OVERFLOW' : ''}`);
    for (const line of problems) console.error(`problem: ${line}`);
    return problems.length ? 1 : 0;
  } catch (e) {
    console.error(e.message);
    return 1;
  } finally { await gym.close(); }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) process.exitCode = await main(process.argv.slice(2));
