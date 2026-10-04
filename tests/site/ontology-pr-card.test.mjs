#!/usr/bin/env node
// P4: verify the PR card against fetched bytes and the reviewed SOURCE manifest.
// --base verifies deployed assets without any local asset fallback.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, stat, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { browser, until, sleep } from './ontology-card/browser.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--base' || !args[1])) throw Error('usage: ontology-pr-card.test.mjs [--base <url>]');
const BASE = args[1];
const SERVE_ROOT = resolve(process.env.ONTOLOGY_PROBE_ROOT || ROOT);
const localSource = JSON.parse(await readFile(join(ROOT, 'data/onto-pr.SOURCE.json'), 'utf8'));
const badge = { supported: 'Confirmed (pre-registered)', 'not supported': 'Not confirmed', inconclusive: 'Inconclusive' };
const pct = n => n == null ? '—' : `${(100 * n).toFixed(1)} %`;
const artifacts = await mkdtemp(join(tmpdir(), 'ontology-pr-probes-'));
let server, session, origin, passed = 0, failed = 0;
async function check(name, fn) {
  try { await fn(); passed++; console.log('ok ' + name); }
  catch (e) { failed++; console.error(`FAIL ${name}: ${e.message}`); }
}
function verifyHash(hash, servedSource) {
  assert.match(servedSource.sha256, /^[a-f0-9]{64}$/);
  assert.equal(hash, servedSource.sha256, 'fetched PR bytes differ from served SOURCE sha256');
  assert.equal(servedSource.sha256, localSource.sha256, 'served PR SOURCE differs from reviewed local SOURCE');
}
try {
  if (BASE) origin = BASE.replace(/\/$/, '');
  else {
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
    server = createServer(async (req, res) => {
      try {
        let path = resolve(SERVE_ROOT, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
        if (path !== SERVE_ROOT && !path.startsWith(SERVE_ROOT + sep)) { res.writeHead(403).end(); return; }
        if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
        res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(await readFile(path));
      } catch { res.writeHead(404).end(); }
    });
    await new Promise((r, j) => { server.once('error', j); server.listen(0, '127.0.0.1', r); });
    origin = `http://127.0.0.1:${server.address().port}`;
  }
  session = await browser();
  const p = session.page, ev = code => p.ev(code), Q = JSON.stringify;
  await p.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
  await p.send('Page.navigate', { url: origin + '/index.html#view=runtime-observation' });
  await until(() => ev('return document.readyState === "complete" && !!document.querySelector("[data-onto-pr-verdict]")'), 'PR card');
  const pageFetchedData = p.requests.some(u => new URL(u).pathname.endsWith('/data/onto-pr.json'));
  const fetched = await ev(`const response=await fetch('data/onto-pr.json',{cache:'no-store'}); if(!response.ok)throw Error('PR data unavailable'); const bytes=await response.arrayBuffer(); const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join(''); const source=await fetch('data/onto-pr.SOURCE.json',{cache:'no-store'}); if(!source.ok)throw Error('PR SOURCE unavailable'); return {hash,source:await source.json(),data:JSON.parse(new TextDecoder().decode(bytes))};`);
  const data = fetched.data;
  await check('page fetch and PR bytes match served and reviewed SOURCE', async () => {
    assert.ok(pageFetchedData, 'page itself fetched PR data before the probe fetched it');
    verifyHash(fetched.hash, fetched.source);
  });
  await check('PR verdict and badge map exactly as the first card', async () => {
    assert.ok(Object.hasOwn(badge, data.verdict), 'recognized data verdict');
    const actual = await ev(`const v=document.querySelector('[data-onto-pr-verdict]');return {verdict:v.dataset.ontoPrVerdict,badge:v.querySelector('.rt-chip').textContent.trim()};`);
    assert.equal(actual.verdict, data.verdict);
    assert.equal(actual.badge, badge[data.verdict]);
  });
  await check('table shows provenance, typed and untyped observed metrics', async () => {
    const rows = await ev(`return [...document.querySelectorAll('[data-onto-pr] tbody tr')].map(row=>[...row.children].map(cell=>cell.textContent.trim()));`);
    assert.deepEqual(rows, [
      ['prov', 'Provenance only (baseline)'], ['m2s', 'Two-stage, with ontology'], ['untyped', 'Two-stage, without ontology'],
    ].map(([key, label]) => [label, String(data.observed[key].F), pct(data.observed[key].precision), pct(data.observed[key].recall)]));
  });
  await check('five H14 parts use p <= .05; null is not established', async () => {
    const parts = await ev(`return [...document.querySelectorAll('[data-onto-pr-part]')].map(x=>({id:x.dataset.ontoPrPart,ok:x.dataset.ontoPrPartOk,text:x.querySelector('.rt-chip').textContent.trim()}));`);
    assert.deepEqual(parts.map(x => x.id), ['a', 'b', 'c1', 'c2', 'd']);
    for (const part of parts) {
      const held = data.p[part.id] != null && data.p[part.id] <= .05;
      assert.equal(part.ok, String(held));
      assert.equal(part.text, held ? 'held' : 'not established');
    }
  });
  await check('descriptive line labels stage-1 precision and recall', async () => {
    const lines = await ev(`return [...document.querySelectorAll('[data-onto-pr] p')].map(x=>x.textContent);`);
    const descriptive = lines.filter(t => t.includes('Descriptive only'));
    assert.equal(descriptive.length, 1);
    assert.ok(descriptive[0].includes(`${pct(data.stage1_only.precision)} precision at ${pct(data.stage1_only.recall)} recall`));
  });
  for (const width of [1400, 390]) {
    await check(`no JavaScript errors at ${width}px${width === 390 ? '; no page overflow' : ''}`, async () => {
      await p.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width === 390 });
      const views = await ev(`return [...new Set([...document.querySelectorAll('button[data-view]')].map(x=>x.dataset.view))];`);
      assert.ok(views.includes('runtime-observation'));
      for (const view of views) {
        await ev(`document.querySelector('button[data-view='+${Q(Q(view))}+']').click();`);
        await until(() => ev(`return document.getElementById(${Q(view)})?.classList.contains('active');`), view);
        await sleep(300);
      }
      await ev(`document.querySelector('button[data-view="runtime-observation"]').click();`);
      await sleep(500);
      if (width === 390) {
        const size = await ev(`const e=document.querySelector('[data-onto-pr]'),r=e.getBoundingClientRect();return {document:document.documentElement.scrollWidth,body:document.body.scrollWidth,viewport:innerWidth,left:r.left,right:r.right};`);
        assert.ok(size.document <= size.viewport + 1 && size.body <= size.viewport + 1 && size.left >= -1 && size.right <= size.viewport + 1, JSON.stringify(size));
      }
      await ev(`document.querySelector('[data-onto-pr]').scrollIntoView({block:'start'});`);
      const shot = await p.send('Page.captureScreenshot', { format: 'png' });
      await writeFile(join(artifacts, `${width}.png`), Buffer.from(shot.data, 'base64'));
      assert.deepEqual(p.errors.filter(e => !/favicon|fonts\.(googleapis|gstatic)|ERR_CERT_AUTHORITY_INVALID/.test(e)), []);
    });
  }
  await check('negative control: tampered temporary data copy fails the same hash gate', async () => {
    const copy = structuredClone(data);
    copy.observed.m2s.F++;
    const file = join(artifacts, 'tampered-onto-pr.json');
    await writeFile(file, JSON.stringify(copy) + '\n');
    const hash = createHash('sha256').update(await readFile(file)).digest('hex');
    assert.throws(() => verifyHash(hash, fetched.source), /fetched PR bytes differ/);
  });
} catch (e) { failed++; console.error('FAIL setup: ' + e.stack); }
finally { session?.close(); if (server) await new Promise(r => server.close(r)); }
console.log('artifacts: ' + artifacts);
console.log(`${passed}/${passed + failed} PASS ontology-pr-card${BASE ? ' (live read-back)' : ''}`);
process.exitCode = failed ? 1 : 0;
