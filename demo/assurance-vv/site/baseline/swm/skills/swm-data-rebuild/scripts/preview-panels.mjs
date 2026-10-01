#!/usr/bin/env node
/* Render the three Security World Model panels in headless Chrome and save a
   screenshot of each, so a rebuild can be checked on a host with no GUI and no
   browser extension. Serves the repo itself, drives Chrome over the DevTools
   protocol with node's built-in WebSocket, reports JS errors, cleans up.

     node swm/skills/swm-data-rebuild/scripts/preview-panels.mjs [outDir]

   Requires node >= 22 (global WebSocket) and a Chrome/Chromium binary; set
   CHROME=/path/to/binary if it is somewhere unusual.                        */

import { createServer } from 'node:http';
import { spawn, execSync } from 'node:child_process';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, extname, normalize } from 'node:path';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..', '..', '..'));      /* repo root */
const OUT  = resolve(process.argv[2] || join(tmpdir(), 'swm-preview'));
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml' };

if (typeof WebSocket !== 'function') {
  console.error('This script needs node >= 22 (global WebSocket). node -v reports ' + process.version);
  process.exit(2);
}

/* ---- a tiny static server over the repo --------------------------------- */
const server = createServer(async (req, res) => {
  const rel = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  const file = join(ROOT, rel === '/' ? 'index.html' : rel);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/index.html`;

/* ---- find and launch Chrome --------------------------------------------- */
function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/snap/bin/chromium'
  ];
  for (const c of candidates) { try { execSync(`test -x ${JSON.stringify(c)}`); return c } catch {} }
  for (const c of ['google-chrome', 'chromium', 'chromium-browser']) {
    try { return execSync(`command -v ${c}`).toString().trim() } catch {}
  }
  return null;
}
const chrome = findChrome();
if (!chrome) {
  console.error('No Chrome/Chromium found. Install one, or set CHROME=/path/to/binary.');
  server.close(); process.exit(2);
}
const port = 9500 + Math.floor(Math.random() * 400);
const profile = join(tmpdir(), `swm-chrome-${port}`);
const proc = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });

async function waitForChrome() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/json/version`); if (r.ok) return await r.json(); } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('Chrome did not expose its debugging port in 15s');
}
const version = await waitForChrome();

/* ---- CDP client ---------------------------------------------------------- */
const target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page');
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0; const pending = new Map(); const consoleErrors = [];
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') consoleErrors.push(m.params.exceptionDetails?.exception?.description || 'exception');
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
    consoleErrors.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' '));
});
await new Promise(r => ws.addEventListener('open', r));
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async expression => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'evaluate failed');
  return r.result?.result?.value;
};

await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1100, deviceScaleFactor: 1, mobile: false });

const PANELS = [
  ['wm-overview',     'World Model Coverage', 'coverage.png',  'document.querySelectorAll("#swmCovSvg path").length'],
  ['wm-ontology',     'Security Ontology',    'ontology.png',  'document.querySelectorAll("#swmSvg g.swm-node").length'],
  ['wm-architecture', 'Ontology Layers',      'layers.png',    'document.querySelectorAll("#swmChainSvg path").length']
];

await mkdir(OUT, { recursive: true });
const results = [];
for (const [panel, title, file, probe] of PANELS) {
  await send('Page.navigate', { url: base });
  await new Promise(r => setTimeout(r, 1500));
  await evaluate(`document.querySelector('.nav button[data-view="security-model"]').click();
                  document.querySelector('[data-wm-panel="${panel}"]').click(); true`);
  await new Promise(r => setTimeout(r, 3000));
  await evaluate('window.scrollTo(0, 300)');
  const marks = await evaluate(probe);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(OUT, file), Buffer.from(shot.result.data, 'base64'));
  results.push({ title, file, marks });
}

ws.close(); proc.kill(); server.close();

console.log(`\n${version.Browser} · ${base}`);
for (const r of results) console.log(`  ${r.title.padEnd(22)} ${String(r.marks).padStart(4)} marks → ${join(OUT, r.file)}`);
if (consoleErrors.length) {
  console.log(`\n  ${consoleErrors.length} console error(s):`);
  [...new Set(consoleErrors)].slice(0, 8).forEach(e => console.log(`    ✗ ${String(e).split('\n')[0]}`));
  process.exit(1);
}
if (results.some(r => !r.marks)) {
  console.log('\n  ✗ a panel rendered no marks — the bundle probably failed to load\n');
  process.exit(1);
}
console.log('\n  ✓ all three panels rendered, no console errors\n');
