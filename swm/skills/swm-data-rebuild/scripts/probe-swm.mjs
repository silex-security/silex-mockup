#!/usr/bin/env node
/* Interaction probes for the Security World Model panels (plan
   logs/2026-10-02_SWM_ONTOLOGY_RIGOR_PLAN.md, T6): H1 N1 I1 I2 I3 L1 R1 E1,
   plus D1 (2026-10-02: Ontology Layers is the first, default World Model sub-tab).
   Same headless harness as preview-panels.mjs.

     node swm/skills/swm-data-rebuild/scripts/probe-swm.mjs                 # all probes, this checkout
     node swm/skills/swm-data-rebuild/scripts/probe-swm.mjs --only COLD --data <bundle-dir>
     node swm/skills/swm-data-rebuild/scripts/probe-swm.mjs --only COLD --delay-bundle 6000 # must exit 1
     node swm/skills/swm-data-rebuild/scripts/probe-swm.mjs --root <dir> --only R1,E1
                                                    # serve another checkout (e.g. BASE) instead

   Requires node >= 22 (global WebSocket) and a Chrome/Chromium binary; set
   CHROME=/path/to/binary if it is somewhere unusual.                        */

import { createServer } from 'node:http';
import { spawn, execSync } from 'node:child_process';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, extname, normalize } from 'node:path';
import { tmpdir, hostname, platform, arch, cpus } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null };
const ROOT = resolve(opt('--root') || join(HERE, '..', '..', '..', '..'));   /* repo root to serve */
const ONLY = opt('--only') ? new Set(opt('--only').split(',')) : null;
const DATA = resolve(opt('--data') || join(ROOT, 'swm', 'data'));
const requestedBundleDelay = Number(opt('--delay-bundle') || 0);
if (!Number.isFinite(requestedBundleDelay) || requestedBundleDelay < 0 || requestedBundleDelay > 60000) throw new Error('--delay-bundle needs 0..60000 milliseconds');
let bundleDelayMs = 0, delayedBundles = 0;
const OUT  = resolve(opt('--out') || join(tmpdir(), 'swm-probe'));
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml' };

if (typeof WebSocket !== 'function') {
  console.error('This script needs node >= 22 (global WebSocket). node -v reports ' + process.version);
  process.exit(2);
}

/* ---- a tiny static server over the repo --------------------------------- */
const server = createServer(async (req, res) => {
  const rel = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  const bundleName = rel.replace(/^\//, '').match(/^swm\/data\/(ontology|coverage)\.(js|json)$/);
  const file = bundleName ? join(DATA, bundleName[1] + '.' + bundleName[2]) : join(ROOT, rel === '/' ? 'index.html' : rel);
  try {
    const body = await readFile(file);
    if (bundleName && bundleDelayMs) { delayedBundles++; await new Promise(r => setTimeout(r, bundleDelayMs)); }
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
process.on('exit', () => { proc.kill(); server.close(); });
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


const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const want = id => !ONLY || ONLY.has(id);
const record = (id, ok, detail) => results.push({ id, ok: !!ok, detail });
async function openPanel(panel){
  await send('Page.navigate', { url: base });
  await sleep(1500);
  await evaluate(`document.querySelector('.nav button[data-view="security-model"]').click();
                  document.querySelector('[data-wm-panel="${panel}"]').click(); true`);
  await sleep(3000);
}
const bundle = JSON.parse(await readFile(join(DATA, 'ontology.json'), 'utf8'));
await mkdir(OUT, { recursive: true });
const shot = async file => { const s = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(join(OUT, file), Buffer.from(s.result.data, 'base64')); };

/* search for a node through the real combobox and pick it */
const pick = id => evaluate(`(async () => {
  const q = document.getElementById('swmQuery'), n = window.SILEX_SWM_ONTOLOGY.nodes.find(x => x.id === ${JSON.stringify(id)});
  q.value = n.label; q.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 500));
  const b = document.querySelector('#swmResults [data-id="' + ${JSON.stringify(id)} + '"]');
  if (!b) return false; b.click(); await new Promise(r => setTimeout(r, 1200)); return true; })()`);

/* E5 D6: an isolated context and pre-navigation listener for each cold view. */
let browserSocket, browserCall;
async function browserCommand(method, params = {}) {
  if (!browserCall) {
    browserSocket = new WebSocket(version.webSocketDebuggerUrl);
    const pending = new Map(); let sequence = 0;
    browserSocket.addEventListener('message', event => {
      const m = JSON.parse(event.data);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    });
    await new Promise((r, reject) => { browserSocket.addEventListener('open', r); browserSocket.addEventListener('error', reject); });
    browserCall = (method, params) => new Promise((r, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('Browser CDP timeout: ' + method)); }, 10000);
      pending.set(id, m => { clearTimeout(timer); if (m.error) reject(new Error(m.error.message)); else r(m); });
      browserSocket.send(JSON.stringify({ id, method, params }));
    });
  }
  return browserCall(method, params);
}
async function coldLoad(panel, delay = 0) {
  const context = await browserCommand('Target.createBrowserContext');
  const contextId = context.result?.browserContextId;
  if (!contextId) throw new Error('Chrome failed to create a fresh browser context');
  let coldSocket;
  const errors = [];
  const limit = panel === 'wm-architecture' ? 3000 : 5000;
  bundleDelayMs = delay;
  const previousDelayed = delayedBundles;
  try {
    const targetResult = await browserCommand('Target.createTarget', { url: 'about:blank', browserContextId: contextId });
    const targetId = targetResult.result?.targetId;
    const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const target = pages.find(p => p.id === targetId);
    if (!target) throw new Error('Fresh Chrome target not found');
    coldSocket = new WebSocket(target.webSocketDebuggerUrl);
    const pendingCold = new Map(); let sequence = 0;
    coldSocket.addEventListener('message', e => {
      const m = JSON.parse(e.data);
      if (m.id && pendingCold.has(m.id)) { pendingCold.get(m.id)(m); pendingCold.delete(m.id); }
      if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails?.exception?.description || 'exception');
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' '));
    });
    await new Promise((r, reject) => { coldSocket.addEventListener('open', r); coldSocket.addEventListener('error', reject); });
    const call = (method, params = {}) => new Promise((r, reject) => {
      const id = ++sequence;
      const timeout = setTimeout(() => { pendingCold.delete(id); reject(new Error('CDP timeout: ' + method)); }, 10000);
      pendingCold.set(id, result => { clearTimeout(timeout); if (result.error) reject(new Error(result.error.message)); else r(result.result); });
      coldSocket.send(JSON.stringify({ id, method, params }));
    });
    await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
    await call('Network.setCacheDisabled', { cacheDisabled: true });
    await call('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1100, deviceScaleFactor: 1, mobile: false });
    await call('Page.addScriptToEvaluateOnNewDocument', { source:
      "window.__swmColdReady = false; window.addEventListener('swm:loader-ready', () => { window.__swmColdReady = true; });" });
    const start = performance.now();
    await call('Page.navigate', { url: base + '#view=security-model&tab=' + panel });
    let state;
    do {
      const r = await call('Runtime.evaluate', { returnByValue: true, expression: `(() => {
        const panel = document.getElementById(${JSON.stringify(panel)});
        const selector = ${JSON.stringify(panel === 'wm-architecture' ? '#swmChainSvg g[role="button"]' : '#swmSvg g.swm-node, #swmSvg g.vw-node')};
        const visible = element => !!element && element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0 && getComputedStyle(element).visibility !== 'hidden';
        return { event: window.__swmColdReady === true, content: !!panel && panel.classList.contains('active') &&
          [...panel.querySelectorAll(selector)].some(visible) && ![...panel.querySelectorAll('.swm-loading')].some(visible) };
      })()` });
      if (r?.exceptionDetails) throw new Error('Cold readiness evaluation failed: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
      state = r?.result?.value || {};
      if (state.event && state.content) break;
      await sleep(25);
    } while (performance.now() - start < limit);
    const elapsed = performance.now() - start;
    return { ok: state.event && state.content && elapsed <= limit && !errors.length,
      elapsed: Math.round(elapsed), limit, event: !!state.event, content: !!state.content,
      delayedRequests: delayedBundles - previousDelayed, errors, reason: errors.length ? 'browser exception' : (state.event && state.content ? 'ready' : 'readiness deadline exceeded') };
  } finally {
    bundleDelayMs = 0;
    coldSocket?.close();
    await browserCommand('Target.disposeBrowserContext', { browserContextId: contextId });
  }
}
if (want('COLD')) {
  console.log('Cold-load machine: ' + JSON.stringify({ chrome: version.Browser, host: hostname(), platform: platform(), arch: arch(), cpu: cpus()[0]?.model, logicalCPUs: cpus().length, data: DATA }));
  for (const panel of ['wm-architecture', 'wm-ontology']) {
    const r = await coldLoad(panel, requestedBundleDelay);
    record(panel === 'wm-architecture' ? 'COLD-L' : 'COLD-G', r.ok, JSON.stringify(r));
  }
  // The fixture is accepted only because the real timed probe rejects an actual delayed response.
  const delayed = await coldLoad('wm-ontology', 6000);
  record('COLD-6', !delayed.ok && delayed.delayedRequests > 0 && delayed.reason === 'readiness deadline exceeded',
    '6 s delayed-bundle negative: ' + JSON.stringify(delayed));
}

if (want('D1')) {
  /* entering Enterprise World Model lands on Ontology Layers, the first sub-tab, rendered */
  await send('Page.navigate', { url: base }); await sleep(1500);
  await evaluate(`document.querySelector('.nav button[data-view="security-model"]').click(); true`); await sleep(3000);
  const res = await evaluate(`({ tabs: [...document.querySelectorAll('#security-model .wm-tab')].map(t => t.textContent.trim()),
    active: document.querySelector('#security-model .wm-tab.active').id,
    panel: (document.querySelector('#security-model .wm-panel.active') || {}).id,
    bands: document.querySelectorAll('#swmChainSvg path').length,
    subtitle: document.getElementById('swmSubtitle').textContent })`);
  record('D1', res.tabs[0] === 'Ontology Layers' && res.tabs[1] === 'Ontology Graph' && res.active === 'wmtab-architecture' && res.panel === 'wm-architecture' && res.bands > 0 && /four ontology tiers/.test(res.subtitle),
    `tabs ${JSON.stringify(res.tabs.slice(0, 3))} · active ${res.active} · panel ${res.panel} · ${res.bands} marks`);
  await shot('probe-default-tab.png');
}

if (want('I1') || want('I2') || want('I3') || want('N1')) {
  await openPanel('wm-ontology');
  if (want('N1')) {
    /* network view, L1, minimum degree 0, every group on: the toggle may hide SUBCLASS_OF and nothing else */
    const before = await evaluate(`(() => { const ls = d3.selectAll('#swmSvg path.vw-link').data();
      return { all: ls.length, sub: ls.filter(l => l.sub).length, subOk: ls.every(l => (l.raw.pred === 'SUBCLASS_OF') === !!l.sub),
               deg: +document.getElementById('swmMinDeg').value }; })()`);
    await evaluate(`document.getElementById('swmSubcl').click(); true`);
    await sleep(2500);
    const after = await evaluate(`(() => { const ls = d3.selectAll('#swmSvg path.vw-link').data();
      return { all: ls.length, sub: ls.filter(l => l.sub).length, nonSub: ls.filter(l => l.raw.pred !== 'SUBCLASS_OF').length }; })()`);
    record('N1', before.deg === 0 && before.subOk && after.sub === 0 && after.all === before.all - before.sub && after.nonSub === before.all - before.sub,
      `minDegree ${before.deg} · before ${before.all} (${before.sub} SUBCLASS_OF, flags match preds: ${before.subOk}) · after ${after.all} (non-subclass ${after.nonSub})`);
    await evaluate(`document.getElementById('swmSubcl').click(); true`); await sleep(1500);
  }
  if (want('I1') || want('I3')) {
    const ok = await pick('ag:exec-ctx');
    const txt = await evaluate(`document.getElementById('swmInspector').innerText`);
    const grade = await evaluate(`(document.querySelector('#swmInspector .swm-review') || {}).textContent || ''`);
    if (want('I1')) record('I1', ok && /Curated/.test(grade), `selected ag:exec-ctx · review chip "${grade}"`);
    if (want('I3')) record('I3', ok && /No runtime instance in the illustrative graph/.test(txt), 'ag:exec-ctx deployment text present: ' + /No runtime instance/.test(txt));
    await shot('probe-inspector-node.png');
  }
  if (want('I2')) {
    const ok = await pick('ag:planner');
    const res = await evaluate(`(async () => {
      const b = document.querySelector('#swmOntListBody [data-edge]'); if (!b) return { edge: false };
      b.click(); await new Promise(r => setTimeout(r, 1000));
      const box = document.getElementById('swmInspector');
      const kick = [...box.querySelectorAll('.swm-insp-kicker')].map(k => k.textContent);
      return { edge: kick.includes('Selected relation'), grade: [...box.querySelectorAll('.swm-review')].map(x => x.textContent) }; })()`);
    record('I2', ok && res.edge && res.grade.length === 2, `relation selected: ${res.edge} · review chips ${JSON.stringify(res.grade)}`);
    await shot('probe-inspector-edge.png');
  }
}

if (want('H1')) {
  await openPanel('wm-ontology');
  await evaluate(`SWM.setLevel(2); true`); await sleep(1200);
  await evaluate(`document.querySelector('#swmViews [data-v="tree"]').click(); true`); await sleep(2000);
  const domains = bundle.nodes.filter(n => n.kind === 'domain');
  const res = await evaluate(`(() => { const lab = [...document.querySelectorAll('#swmSvg g.swm-node')].map(g => g.getAttribute('aria-label') || '');
    return ${JSON.stringify(domains.map(d => ({ id: d.id, label: d.label, candidate: !!d.candidate })))}
      .map(d => ({ id: d.id, shown: lab.some(a => a.startsWith(d.label + (d.candidate ? ', candidate domain pack' : ', '))) })); })()`);
  const missing = res.filter(r => !r.shown).map(r => r.id);
  record('H1', domains.length === 7 && domains.filter(d => d.candidate).length === 2 && !missing.length,
    `${domains.length} domain anchors (${domains.filter(d => d.candidate).length} candidate) · missing from Hierarchy: ${missing.join(', ') || 'none'}`);
  await shot('probe-hierarchy-l2.png');
}

if (want('L1')) {
  await openPanel('wm-architecture');
  const txt = await evaluate(`(document.getElementById('swmChainSkips') || {}).textContent || ''`);
  const n = bundle.chain && bundle.chain.skips ? bundle.chain.skips.count : null;
  record('L1', n != null && txt.startsWith(n + ' further relations skip a tier'), `bundle chain.skips ${n} · caption "${txt.slice(0, 90)}"`);
  await shot('probe-layers.png');
}

if (want('R1')) {
  await openPanel('wm-ontology');
  await evaluate(`document.getElementById('swmExampleBtn').click(); true`); await sleep(4000);
  const res = await evaluate(`({ nodes: document.querySelectorAll('#swmSvg g.swm-fcard').length,
    ids: [...document.querySelectorAll('#swmSvg g.swm-fcard')].map(g => (d3.select(g).datum() || {}).id).sort(),
    rels: document.querySelectorAll('#swmSvg text.swm-pred').length,
    preds: [...document.querySelectorAll('#swmSvg text.swm-pred')].map(t => t.textContent).sort() })`);
  /* exactly what BASE 74ed19a shows (probe run against a BASE worktree, recorded in the plan log) */
  const BASE_IDS = ['rt-hitl-t2','rt-kb-index','rt-ledger','rt-policy-500','rt-refund-agent','rt-refund-mem','rt-svc-identity','rt-tool-refund','rt-user-csr'];
  const BASE_PREDS = ['AUTHORIZES','CALLS','DELEGATES_AUTHORITY','GATES','GOVERNS','MUTATES','READS_WRITES','RETRIEVES_FROM'];
  record('R1', res.nodes === 9 && res.rels === 8 && JSON.stringify(res.ids) === JSON.stringify(BASE_IDS) && JSON.stringify(res.preds) === JSON.stringify(BASE_PREDS), `${res.nodes} nodes · ${res.rels} relations · ${JSON.stringify(res.preds)} · ${JSON.stringify(res.ids)}`);
  await shot('probe-refund-example.png');
}

/* ---- P probes: plan item F for the World Model panels (T2, logs/2026-10-02_JEV_LEARNINGS_PLAN.md item F).
   Each runs alone with --only P1..P5. */
const pFetch = [], pReq = new Map();
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Fetch.requestPaused') pFetch.push(m.params);
  if (m.method === 'Network.requestWillBeSent') { const u = m.params.request.url; pReq.set(u, (pReq.get(u) || 0) + 1); }
});
const pWaitPaused = async (match, timeout = 10000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const i = pFetch.findIndex(p => p.request.url.includes(match)); if (i >= 0) return pFetch.splice(i, 1)[0]; await sleep(50); }
  return null;
};
const LAZY = ['swm/vendor/d3.v7.min.js', 'swm/data/ontology.js', 'swm/data/coverage.js', 'swm/js/swm-core.js',
  'swm/js/swm-ontology.js', 'swm/js/swm-coverage.js', 'swm/js/swm-layers.js'];
const pCounts = () => Object.fromEntries(LAZY.map(f => [f, [...pReq.entries()].filter(([u]) => u.includes(f)).reduce((n, [, c]) => n + c, 0)]));

if (want('P1')) {
  /* 390px: no horizontal overflow on each of the three lazily-loaded panels */
  const bad = [];
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: false });
  for (const p of ['wm-overview', 'wm-ontology', 'wm-architecture']) {
    await openPanel(p);
    const r = await evaluate(`(() => { const panel = document.querySelector('#security-model .wm-panel.active'); if (!panel) return null;
      const b = panel.getBoundingClientRect();
      return { id: panel.id, ps: panel.scrollWidth, pc: panel.clientWidth, right: b.right, win: innerWidth, doc: document.documentElement.scrollWidth }; })()`);
    if (!r || r.ps > r.pc + 1 || r.right > r.win + 1 || r.doc > r.win + 1) bad.push(p + ' ' + JSON.stringify(r));
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1100, deviceScaleFactor: 1, mobile: false });
  record('P1', bad.length === 0, bad.length ? bad.join(' | ') : 'three panels fit 390px (panel, document and right edge)');
  await shot('probe-390.png');
}

if (want('P2')) {
  /* keyboard: type a query, arrow down, Enter selects through the real combobox */
  await openPanel('wm-ontology');
  const id = 'ag:exec-ctx';
  const res = await evaluate(`(async () => {
    const q = document.getElementById('swmQuery');
    const n = window.SILEX_SWM_ONTOLOGY.nodes.find(x => x.id === ${JSON.stringify(id)});
    q.focus(); q.value = n.label.slice(0, 6); q.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 700));
    const first = document.querySelector('#swmResults [data-id]');
    const expected = first ? first.getAttribute('data-id') : null;
    q.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    q.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await new Promise(r => setTimeout(r, 1500));
    return { expected, boxHidden: document.getElementById('swmResults').hidden,
             inspector: document.getElementById('swmInspector').innerText,
             current: (window.SWM && typeof SWM.currentNode === 'function') ? SWM.currentNode() : null }; })()`);
  record('P2', !!res.expected && res.boxHidden && (res.current === res.expected || res.inspector.includes(res.expected)),
    `keyboard picked ${res.expected} · results hidden ${res.boxHidden} · inspector has the id ${res.inspector.includes(res.expected)}`);
  await shot('probe-keyboard-select.png');
}

if (want('P3')) {
  /* B2: focusNode clears the Network minimum-degree and subclass filters and reports rendered */
  await openPanel('wm-ontology');
  const id = 'ag:exec-ctx';
  const res = await evaluate(`(async () => {
    const range = document.getElementById('swmMinDeg');
    range.value = '100'; range.dispatchEvent(new Event('input', { bubbles: true }));
    const sub = document.getElementById('swmSubcl');
    if (sub.getAttribute('aria-pressed') === 'true') sub.click();
    await new Promise(r => setTimeout(r, 1300));
    const before = { deg: range.value, sub: sub.getAttribute('aria-pressed'), nodes: document.querySelectorAll('#swmSvg g.swm-node').length };
    const ok = (window.SWM && typeof SWM.focusNode === 'function') ? SWM.focusNode(${JSON.stringify(id)}) : null;
    await new Promise(r => setTimeout(r, 1500));
    return { before, ok, deg: range.value, sub: sub.getAttribute('aria-pressed'),
             current: (window.SWM && typeof SWM.currentNode === 'function') ? SWM.currentNode() : null,
             inspector: document.getElementById('swmInspector').innerText }; })()`);
  record('P3', res.ok === true && res.deg === '0' && res.sub === 'true' && (res.current === id || res.inspector.includes(id)),
    `before ${JSON.stringify(res.before)} · focusNode ${res.ok} · after minDegree ${res.deg} subclass ${res.sub} current ${res.current}`);
  await shot('probe-focus-filter.png');
}

if (want('P4')) {
  /* B1: block one lazy file once, assert the Retry button appears and only failed/remaining files re-load */
  pReq.clear();
  await send('Fetch.enable', { patterns: [{ urlPattern: '*swm/js/swm-layers.js*', requestStage: 'Request' }] });
  let failed = false;
  const onPause = async e => {
    const m = JSON.parse(e.data); if (m.method !== 'Fetch.requestPaused') return;
    try {
      if (!failed && m.params.request.url.includes('swm-layers.js')) { failed = true; await send('Fetch.failRequest', { requestId: m.params.requestId, errorReason: 'Failed' }); }
      else await send('Fetch.continueRequest', { requestId: m.params.requestId });
    } catch {}
  };
  ws.addEventListener('message', onPause);
  try {
    await send('Page.navigate', { url: base }); await sleep(1500);
    await evaluate(`document.querySelector('.nav button[data-view="security-model"]').click(); true`);
    await sleep(3000);
    const hasRetry = await evaluate(`!!document.querySelector('[data-swm-retry]')`);
    const before = pCounts();
    if (hasRetry) { await evaluate(`document.querySelector('[data-swm-retry]').click(); true`); await sleep(3500); }
    const after = pCounts();
    const reloaded = LAZY.filter(f => !f.includes('swm-layers.js') && (after[f] || 0) > 1);
    const layers = after['swm/js/swm-layers.js'] || 0;
    record('P4', hasRetry && layers === 2 && reloaded.length === 0,
      `retry button ${hasRetry} · swm-layers requests ${layers} (expect 2) · re-requested non-failed: ${reloaded.join(', ') || 'none'} · before ${JSON.stringify(before)} · after ${JSON.stringify(after)}`);
  } finally { ws.removeEventListener('message', onPause); try { await send('Fetch.disable'); } catch {} consoleErrors.length = 0; }
}

if (want('P5')) {
  /* B3: a load that finishes after leaving the panel neither mounts the panel nor ticks the simulation */
  await send('Fetch.enable', { patterns: [{ urlPattern: '*swm/data/ontology.js*', requestStage: 'Request' }] });
  let held = null;
  const onPause = e => { const m = JSON.parse(e.data); if (m.method === 'Fetch.requestPaused' && !held) held = m.params; };
  ws.addEventListener('message', onPause);
  try {
    await send('Page.navigate', { url: base }); await sleep(1500);
    await evaluate(`document.querySelector('.nav button[data-view="security-model"]').click();
                    document.querySelector('[data-wm-panel="wm-ontology"]').click(); true`);
    const t0 = Date.now(); while (!held && Date.now() - t0 < 9000) await sleep(50);
    await evaluate(`document.querySelector('.nav button[data-view="overview"]').click(); true`);
    await sleep(300);
    if (held) await send('Fetch.continueRequest', { requestId: held.requestId });
    await sleep(3500);
    const res = await evaluate(`({ booted: !!(window.SWM && SWM._booted && SWM._booted['wm-ontology']),
      view: (document.querySelector('.view.active') || {}).id, vowl: !!(window.SWM && SWM.vowl) })`);
    await sleep(800);
    const ticks = await evaluate(`(window.SWM && SWM.vowl) ? SWM.vowl._ticks : null`);
    record('P5', !!held && res.view === 'overview' && !res.booted && !res.vowl,
      `held ${!!held} · view ${res.view} · wm-ontology mounted ${res.booted} · vowl ${res.vowl} · ticks ${ticks}`);
  } finally { ws.removeEventListener('message', onPause); try { await send('Fetch.disable'); } catch {} consoleErrors.length = 0; }
}

if (want('P6')) {
  /* E: every chain line is a complete, correctly directed assertion with data-s/data-p/data-t.
     Ids are read from the bundle (bundle above): rt-refund-agent INSTANCE_OF ag:planner,
     THREATENS into ag:planner, atlas:AML.T0051 countered by core:core-control-policy-gate,
     and rt-inc-1042 EXHIBITS hz:haz-support-refund-loop. */
  await openPanel('wm-ontology');
  const focus = id => evaluate(`(window.SWM && typeof SWM.focusNode === 'function') ? SWM.focusNode(${JSON.stringify(id)}) : null`);
  const asserts = () => evaluate(`(() => { const c = document.querySelector('#swmInspector .swm-chain'); if (!c) return null;
    return [...c.querySelectorAll('.swm-assert')].map(a => ({ s: a.getAttribute('data-s'), p: a.getAttribute('data-p'), t: a.getAttribute('data-t') })); })()`);
  const okAgent = await focus('rt-refund-agent'); await sleep(1300);
  const a1 = await asserts();
  const okInc = await focus('rt-inc-1042'); await sleep(1300);
  const a2 = await asserts();
  const has = (arr, s, p, t) => !!arr && arr.some(x => (s == null || x.s === s) && x.p === p && x.t === t);
  const countersTo = (arr, t) => (arr || []).filter(x => x.p === 'COUNTERS' && x.t === t);
  const counterSources = t => bundle.links.filter(l => l.pred === 'COUNTERS' && l.t === t).map(l => l.s);
  // The inspector shows at most six threats, countered first. New published
  // mitigations can change that subset; validate every rendered COUNTERS edge.
  const displayedThreats = (a1 || []).filter(x => x.p === 'THREATENS' && x.t === 'ag:planner').map(x => x.s);
  const displayedCounters = (a1 || []).filter(x => x.p === 'COUNTERS');
  const countersOk = displayedCounters.length > 0 && displayedCounters.every(x =>
    displayedThreats.includes(x.t) && counterSources(x.t).includes(x.s) &&
    ['control', 'countermeasure'].includes(bundle.nodes.find(n => n.id === x.s)?.kind));
  const amlStored = counterSources('atlas:AML.T0051').includes('core:core-control-policy-gate');
  const reversed = countersTo(a1, 'ag:planner').length > 0;
  record('P6', okAgent === true && okInc === true
      && has(a1, 'rt-refund-agent', 'INSTANCE_OF', 'ag:planner')
      && has(a1, null, 'THREATENS', 'ag:planner')
      && countersOk && amlStored && !reversed
      && has(a2, 'rt-inc-1042', 'EXHIBITS', 'hz:haz-support-refund-loop'),
    `agent ${JSON.stringify(a1)} · incident ${JSON.stringify(a2)} · rendered counters valid ${countersOk} · stored AML.T0051 control ${amlStored} · reversed ${reversed}`);
  await shot('probe-chain-asserts.png');
}

browserSocket?.close(); ws.close(); proc.kill(); server.close();
if (want('E1')) record('E1', !consoleErrors.length, consoleErrors.length ? [...new Set(consoleErrors)].slice(0, 4).map(e => String(e).split('\n')[0]).join(' | ') : 'no console errors');

console.log(`\n${version.Browser} · serving ${ROOT}`);
for (const r of results) console.log(`  ${r.ok ? '✓' : '✗'} ${r.id.padEnd(3)} ${r.detail}`);
await writeFile(join(OUT, 'results.json'), JSON.stringify({ chrome: version.Browser, root: ROOT, data: DATA, results }, null, 2));
console.log(`  screenshots and results → ${OUT}\n`);
process.exit(results.every(r => r.ok) ? 0 : 1);
