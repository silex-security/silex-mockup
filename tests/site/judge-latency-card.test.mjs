#!/usr/bin/env node
// Read-only browser checks for the Runtime Observation judge latency card (Kev vs gpt-4o-mini).
//   node tests/site/judge-latency-card.test.mjs [--base <url>]
// --base checks a deployed page against the local data/judge-latency.json; no local asset fallback.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { browser, until, sleep } from './ontology-card/browser.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--base' || !args[1])) throw Error('usage: judge-latency-card.test.mjs [--base <url>]');
const BASE = args[1];
const local = JSON.parse(await readFile(join(ROOT, 'data/judge-latency.json'), 'utf8'));
const shots = await mkdtemp(join(tmpdir(), 'judge-latency-shots-'));
const ms = x => (x >= 1000 ? `${(x / 1000).toFixed(2)} s` : `${Math.round(x)} ms`);
const pct = x => `${100 * x < 1 && x > 0 ? (100 * x).toFixed(1) : Math.round(100 * x)} %`;
const doneBy = (series, t) => { let s = 0, n = 0; for (const x of series) { if (s + x > t) break; s += x; n++; } return n; };
let server, session, origin, passed = 0, failed = 0;
async function check(name, fn) {
  try { await fn(); passed++; console.log('ok ' + name); }
  catch (e) { failed++; console.error(`FAIL ${name}: ${e.message}`); }
}
try {
  if (BASE) origin = BASE.replace(/\/$/, '');
  else {
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
    server = createServer(async (req, res) => {
      try {
        let p = resolve(ROOT, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
        if (!p.startsWith(ROOT + sep) && p !== ROOT) { res.writeHead(403).end(); return; }
        if ((await stat(p)).isDirectory()) p = join(p, 'index.html');
        res.writeHead(200, { 'Content-Type': mime[extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(await readFile(p));
      } catch { res.writeHead(404).end(); }
    });
    await new Promise((r, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', r); });
    origin = `http://127.0.0.1:${server.address().port}`;
  }
  session = await browser();
  const p = session.page, ev = code => p.ev(code);
  await p.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
  await p.send('Page.navigate', { url: origin + '/index.html#view=runtime-observation' });
  await until(() => ev('return document.readyState === "complete" && !!document.querySelector("#rtLatency [data-lat-judge]")'), 'latency card');
  const served = await ev(`const r=await fetch('data/judge-latency.json',{cache:'no-store'}); if(!r.ok) throw Error('data unavailable'); return await r.json();`);
  const kev = served.judges.find(j => j.label === 'kev-0.8b-ft'), llm = served.judges.find(j => j.label === 'gpt-4o-mini');

  await check('served data equals the committed data', async () => assert.deepEqual(served, local));
  await check('tab starts hidden and opens from its sub-tab', async () => {
    assert.equal(await ev(`return document.querySelector('#rtLatency').hidden`), true);
    await ev(`document.querySelector('[data-rt-tab="latency"]').click()`);
    assert.equal(await ev(`return document.querySelector('#rtLatency').hidden`), false);
    assert.ok(await ev(`return document.querySelector('#rtLatencyBody').getBoundingClientRect().height > 0`));
  });
  await check('p50 and p95 tiles match the data', async () => {
    for (const j of [kev, llm]) {
      const t = await ev(`const e=document.querySelector('[data-lat-judge="${j.label}"]');return {p50:e.querySelector('[data-lat-p50]').textContent,p95:e.querySelector('[data-lat-p95]').textContent}`);
      assert.deepEqual(t, { p50: ms(j.rtt_ms.p50), p95: ms(j.rtt_ms.p95) });
    }
  });
  await check('within-budget shares and the budget marker match the data', async () => {
    const t = await ev(`return document.querySelector('[data-lat-within]').textContent`);
    assert.ok(t.includes(pct(kev.within_budget.share)) && t.includes(pct(llm.within_budget.share)), t);
    assert.equal(await ev(`return document.querySelectorAll('#rtLatency .rt-lat-mark').length`), 4);
    assert.match(await ev(`return document.querySelector('#rtLatency .rt-lat-axis').textContent`), new RegExp(`${kev.within_budget.budget_ms} ms gate budget`));
  });
  await check('replay counts equal the measured series played back for 10 s', async () => {
    await ev(`document.querySelector('#rtLatReplay').click()`);
    await sleep(2000);
    const mid = await ev(`return [...document.querySelectorAll('[data-lat-lane]')].map(e=>Number(e.querySelector('[data-lat-count]').textContent))`);
    assert.ok(mid[0] > 0 && mid[0] < doneBy(kev.rtt_series_ms, 10_000), 'Kev lane is counting in real time: ' + mid);
    await until(() => ev(`return !document.querySelector('#rtLatReplay').disabled`), 'replay ends', 15000);
    const end = await ev(`return [...document.querySelectorAll('[data-lat-lane]')].map(e=>({label:e.dataset.latLane,n:Number(e.querySelector('[data-lat-count]').textContent),dots:e.querySelectorAll('.rt-lat-dots i').length}))`);
    for (const { label, n, dots } of end) {
      const j = served.judges.find(x => x.label === label);
      assert.equal(n, doneBy(j.rtt_series_ms, 10_000), label); assert.equal(dots, n, label + ' dots');
    }
    assert.equal(await ev(`return document.querySelector('#rtLatClock').textContent`), '10.0 s');
  });
  await check('reduced motion shows the final counts at once', async () => {
    await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await ev(`document.querySelector('#rtLatReplay').click()`);
    await sleep(300);
    assert.equal(Number(await ev(`return document.querySelector('[data-lat-lane="kev-0.8b-ft"] [data-lat-count]').textContent`)), doneBy(kev.rtt_series_ms, 10_000));
    await p.send('Emulation.setEmulatedMedia', { features: [] });
  });
  for (const width of [1400, 390]) {
    await check(`no overflow and no JavaScript errors at ${width}px`, async () => {
      p.errors = [];
      await p.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width === 390 });
      await sleep(300);
      const size = await ev(`const e=document.querySelector('#rtLatency'),r=e.getBoundingClientRect();return {scroll:e.scrollWidth,client:e.clientWidth,left:r.left,right:r.right,width:innerWidth}`);
      assert.ok(size.scroll <= size.client + 1 && size.left >= -1 && size.right <= size.width + 1, JSON.stringify(size));
      await ev(`document.querySelector('#rtLatency').scrollIntoView({block:'start'})`);
      await sleep(200);
      const shot = await p.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      await writeFile(join(shots, `${width}.png`), Buffer.from(shot.data, 'base64'));
      assert.deepEqual((p.errors ?? []).filter(e => !/favicon|fonts\.(googleapis|gstatic)|ERR_CERT_AUTHORITY_INVALID/.test(e)), []);
    });
  }
  console.log('screenshots: ' + shots);
} finally {
  session?.close(); server?.close();
}
console.log(`${passed}/${passed + failed} ${failed ? 'FAIL' : 'PASS'} judge-latency-card${BASE ? ' (live read-back)' : ''}`);
process.exitCode = failed ? 1 : 0;
