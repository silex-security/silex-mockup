#!/usr/bin/env node
/* Interaction probes for the Security World Model panels (plan
   logs/2026-10-02_SWM_ONTOLOGY_RIGOR_PLAN.md, T6): H1 N1 I1 I2 I3 L1 R1 E1.
   Same headless harness as preview-panels.mjs.

     node swm/skills/swm-data-rebuild/scripts/probe-swm.mjs                 # all probes, this checkout
     node swm/skills/swm-data-rebuild/scripts/probe-swm.mjs --root <dir> --only R1,E1
                                                    # serve another checkout (e.g. BASE) instead

   Requires node >= 22 (global WebSocket) and a Chrome/Chromium binary; set
   CHROME=/path/to/binary if it is somewhere unusual.                        */

import { createServer } from 'node:http';
import { spawn, execSync } from 'node:child_process';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, extname, normalize } from 'node:path';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null };
const ROOT = resolve(opt('--root') || join(HERE, '..', '..', '..', '..'));   /* repo root to serve */
const ONLY = opt('--only') ? new Set(opt('--only').split(',')) : null;
const OUT  = resolve(opt('--out') || join(tmpdir(), 'swm-probe'));
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
const bundle = JSON.parse(await readFile(join(ROOT, 'swm', 'data', 'ontology.json'), 'utf8'));
await mkdir(OUT, { recursive: true });
const shot = async file => { const s = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(join(OUT, file), Buffer.from(s.result.data, 'base64')); };

/* search for a node through the real combobox and pick it */
const pick = id => evaluate(`(async () => {
  const q = document.getElementById('swmQuery'), n = window.SILEX_SWM_ONTOLOGY.nodes.find(x => x.id === ${JSON.stringify(id)});
  q.value = n.label; q.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 500));
  const b = document.querySelector('#swmResults [data-id="' + ${JSON.stringify(id)} + '"]');
  if (!b) return false; b.click(); await new Promise(r => setTimeout(r, 1200)); return true; })()`);

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

ws.close(); proc.kill(); server.close();
if (want('E1')) record('E1', !consoleErrors.length, consoleErrors.length ? [...new Set(consoleErrors)].slice(0, 4).map(e => String(e).split('\n')[0]).join(' | ') : 'no console errors');

console.log(`\n${version.Browser} · serving ${ROOT}`);
for (const r of results) console.log(`  ${r.ok ? '✓' : '✗'} ${r.id.padEnd(3)} ${r.detail}`);
console.log(`  screenshots → ${OUT}\n`);
process.exit(results.every(r => r.ok) ? 0 : 1);
