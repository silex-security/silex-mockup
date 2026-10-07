#!/usr/bin/env node
// S4: read-only browser checks for the ontology showcase. --base checks a deployed
// page against the reviewed local SOURCE manifest; no local asset fallback.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { browser, until, sleep } from './ontology-card/browser.mjs';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--base' || !args[1])) throw Error('usage: ontology-card.test.mjs [--base <url>]');
const BASE = args[1];
const manifest = JSON.parse(await readFile(join(ROOT, 'data/onto-observability.SOURCE.json'), 'utf8'));
const SERVE_ROOT = resolve(process.env.ONTOLOGY_PROBE_ROOT || ROOT); // negative test: temporary copy only
let server, session, origin, passed = 0, failed = 0;
const shots = await mkdtemp(join(tmpdir(), 'ontology-card-shots-'));
async function check(id, name, fn) {
  try { await fn(); passed++; console.log(`ok ${id} ${name}`); }
  catch (e) { failed++; console.error(`FAIL ${id} ${name}: ${e.message}`); }
}
try {
  if (BASE) origin = BASE.replace(/\/$/, '');
  else {
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
    server = createServer(async (req, res) => {
      try {
        let p = resolve(SERVE_ROOT, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
        if (!p.startsWith(SERVE_ROOT + sep) && p !== SERVE_ROOT) { res.writeHead(403).end(); return; }
        if ((await stat(p)).isDirectory()) p = join(p, 'index.html');
        res.writeHead(200, { 'Content-Type': mime[extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(await readFile(p));
      } catch { res.writeHead(404).end(); }
    });
    await new Promise((r, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', r); });
    origin = `http://127.0.0.1:${server.address().port}`;
  }
  session = await browser();
  const p = session.page, ev = code => p.ev(code), Q = JSON.stringify;
  await p.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
  await p.send('Page.navigate', { url: origin + '/index.html#view=runtime-observation' });
  await until(() => ev('return document.readyState === "complete" && !!document.querySelector("#rtOntology [data-onto-cell-btn]")'), 'ontology card');
  const fetched = await ev(`const r=await fetch('data/onto-observability.json', {cache:'no-store'}); if(!r.ok)throw Error('data unavailable'); const bytes=await r.arrayBuffer(); const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b=>b.toString(16).padStart(2,'0')).join(''); return {hash,data:JSON.parse(new TextDecoder().decode(bytes))};`);
  const data = fetched.data;
  await check('1', 'page data hash equals reviewed SOURCE sha256', async () => {
    assert.equal(fetched.hash, manifest.sha256);
    assert.ok(p.requests.some(u => new URL(u).pathname.endsWith('/data/onto-observability.json')), 'page fetched the generated data');
    const served = await ev(`const r=await fetch('data/onto-observability.SOURCE.json',{cache:'no-store'}); if(!r.ok)throw Error('SOURCE unavailable');return await r.json();`);
    assert.equal(served.sha256, manifest.sha256);
  });
  for (const cell of ['both','saved','lost','miss']) {
    await check('4-' + cell, 'selected run, toggle, flagged call and non-alert reasons', async () => {
      const e = data.examples.find(e => e.cell === cell); assert.ok(e, 'cell exists');
      await ev(`document.querySelector('[data-onto-cell-btn="${cell}"]').click();`);
      for (const [mode, key] of [['onto','otp'],['prov','prov']]) {
        await ev(`document.querySelector('[data-onto-mode-btn="${mode}"]').click();`);
        const actual = await ev(`return {mode:document.querySelector('#rtOntology').dataset.ontoMode,run:document.querySelector('[data-onto-run]')?.dataset.ontoRun,empty:document.querySelector('[data-onto-empty]')?.textContent,flagged:[...document.querySelectorAll('[data-onto-flagged]')].map(c=>Number(c.dataset.ontoCall)),calls:[...document.querySelectorAll('[data-onto-call]')].map(c=>({index:Number(c.dataset.ontoCall),flagged:c.hasAttribute('data-onto-flagged'),reason:c.querySelector('.rt-onto-why')?.textContent.trim()}))};`);
        assert.equal(actual.mode, mode);
        if (e.empty) { assert.match(actual.empty, /no qualifying example/); assert.equal(actual.run, undefined); assert.deepEqual(actual.flagged, []); continue; }
        assert.equal(actual.run, e.run.run_id);
        assert.deepEqual(actual.flagged, e[key].call_index == null ? [] : [e[key].call_index]);
        assert.deepEqual(actual.calls.map(c => c.index), e.run.calls.map(c => c.index));
        for (const call of actual.calls.filter(c => !c.flagged)) { const expected = e.why_not[key][call.index]; assert.ok(expected, 'non-alert reason exists for call ' + call.index); assert.equal(call.reason, expected); }
      }
    });
  }
  await check('5', 'unconfirmed E-AL, E-PR and v1/v2 results are not shown', async () => {
    const text = await ev(`const c=document.querySelector('#rtOntology').cloneNode(true); c.querySelectorAll('[data-onto-s2]').forEach(n=>n.remove()); return c.textContent;`);
    assert.doesNotMatch(text, /Not confirmed|not established|Follow-up test|did not establish|Inconclusive/);
    assert.equal(await ev(`return document.querySelectorAll('[data-onto-verdict],[data-onto-pr],[data-onto-not-established]').length;`), 0);
  });
  await check('6', 'judge note shows both data-derived AUROCs', async () => {
    const text = await ev(`return document.querySelector('#rtJudgeRealNote').textContent;`);
    for (const key of ['real_runs_auroc','e1_split_auroc']) assert.ok(text.includes(Number(data.judge_baseline[key]).toFixed(3)), key);
  });
  for (const width of [1400,390]) {
    await check('7-' + width, 'all views have no JavaScript errors; card fits narrow layout', async () => {
      p.errors = [];
      await p.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width === 390 });
      const views = await ev(`return [...new Set([...document.querySelectorAll('button[data-view]')].map(b=>b.dataset.view))];`);
      assert.ok(views.includes('runtime-observation'));
      for (const view of views) {
        await ev(`document.querySelector('button[data-view='+${Q(Q(view))}+']').click();`);
        await until(() => ev(`return document.getElementById(${Q(view)})?.classList.contains('active');`), view);
        await sleep(300);
      }
      await ev(`document.querySelector('button[data-view="runtime-observation"]').click();`);
      if (width === 390) {
        for (const cell of ['both','saved','lost','miss']) for (const mode of ['onto','prov']) {
          await ev(`document.querySelector('[data-onto-cell-btn="${cell}"]').click(); document.querySelector('[data-onto-mode-btn="${mode}"]').click();`);
          const size = await ev(`const e=document.querySelector('#rtOntology'),r=e.getBoundingClientRect();return {scroll:e.scrollWidth,client:e.clientWidth,left:r.left,right:r.right,width:innerWidth};`);
          assert.ok(size.scroll <= size.client + 1 && size.left >= -1 && size.right <= size.width + 1, `${cell}/${mode} horizontal overflow: ${JSON.stringify(size)}`);
        }
      }
      await sleep(500);
      await ev(`document.querySelector('#rtOntology').scrollIntoView({block:'start'});`);
      const shot = await p.send('Page.captureScreenshot', {format:'png'});
      await writeFile(join(shots, `${width}.png`), Buffer.from(shot.data, 'base64'));
      assert.deepEqual(p.errors.filter(e => !/favicon|fonts\.(googleapis|gstatic)|ERR_CERT_AUTHORITY_INVALID/.test(e)), []);
    });
  }
} catch (e) { failed++; console.error('FAIL setup: ' + e.stack); }
finally { session?.close(); if(server) await new Promise(r=>server.close(r)); }
console.log(`screenshots: ${shots}`);
console.log(`${passed}/${passed+failed} PASS ontology-card${BASE?' (live read-back)':''}`);
process.exitCode = failed ? 1 : 0;
