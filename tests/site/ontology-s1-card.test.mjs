#!/usr/bin/env node
// S3: verify the S1 card against fetched bytes and the reviewed SOURCE manifest.
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
if (args.length && (args.length !== 2 || args[0] !== '--base' || !args[1])) throw Error('usage: ontology-s1-card.test.mjs [--base <url>]');
const BASE = args[1];
const SERVE_ROOT = resolve(process.env.ONTOLOGY_S1OBE_ROOT || ROOT);
const localSource = JSON.parse(await readFile(join(ROOT, 'data/onto-s1.SOURCE.json'), 'utf8'));
const badge = { supported: 'Confirmed (pre-registered)', 'not supported': 'Not confirmed', inconclusive: 'Inconclusive' };
const pct = n => n == null ? '—' : `${(100 * n).toFixed(1)} %`;
const artifacts = await mkdtemp(join(tmpdir(), 'ontology-s1-probes-'));
let server, session, origin, passed = 0, failed = 0;
async function check(name, fn) {
  try { await fn(); passed++; console.log('ok ' + name); }
  catch (e) { failed++; console.error(`FAIL ${name}: ${e.message}`); }
}
function verifyHash(hash, servedSource) {
  assert.match(servedSource.sha256, /^[a-f0-9]{64}$/);
  assert.equal(hash, servedSource.sha256, 'fetched S1 bytes differ from served SOURCE sha256');
  assert.equal(servedSource.sha256, localSource.sha256, 'served S1 SOURCE differs from reviewed local SOURCE');
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
  await until(() => ev('return document.readyState === "complete" && !!document.querySelector("[data-onto-s1-verdict]")'), 'S1 card');
  const pageFetchedData = p.requests.some(u => new URL(u).pathname.endsWith('/data/onto-s1.json'));
  const fetched = await ev(`const response=await fetch('data/onto-s1.json',{cache:'no-store'}); if(!response.ok)throw Error('S1 data unavailable'); const bytes=await response.arrayBuffer(); const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join(''); const source=await fetch('data/onto-s1.SOURCE.json',{cache:'no-store'}); if(!source.ok)throw Error('S1 SOURCE unavailable'); return {hash,source:await source.json(),data:JSON.parse(new TextDecoder().decode(bytes))};`);
  const data = fetched.data;
  await check('page fetch and S1 bytes match served and reviewed SOURCE', async () => {
    assert.ok(pageFetchedData, 'page itself fetched S1 data before the probe fetched it');
    verifyHash(fetched.hash, fetched.source);
  });
  await check('S1 verdict and badge map exactly as the first card', async () => {
    assert.ok(Object.hasOwn(badge, data.verdict), 'recognized data verdict');
    const actual = await ev(`const v=document.querySelector('[data-onto-s1-verdict]');return {verdict:v.dataset.ontoS1Verdict,badge:v.querySelector('.rt-chip').textContent.trim(),kind:v.querySelector('.rt-chip').dataset.kind};`);
    assert.equal(actual.verdict, data.verdict);
    assert.equal(actual.badge, badge[data.verdict]);
    assert.equal(actual.kind, {supported:'ran', 'not supported':'blocked', inconclusive:'review'}[data.verdict]);
  });
  await check('alert tiles equal observed run counts', async () => {
    for (const key of ['prov', 's1']) {
      const text = await ev(`return document.querySelector('[data-onto-s1-num="${key}-F"]').textContent.trim();`);
      assert.equal(text, String(data.observed[key].F));
    }
  });
  await check('H15 parts use precision p-values and the observed recall constraint', async () => {
    const parts = await ev(`return [...document.querySelectorAll('[data-onto-s1-part]')].map(x=>({id:x.dataset.ontoS1Part,ok:x.dataset.ontoS1PartOk,text:x.querySelector('.rt-chip').textContent.trim()}));`);
    assert.deepEqual(parts.map(x => x.id), ['a', 'b', 'c']);
    for (const part of parts) {
      const held = part.id === 'b' ? data.constraint.holds === true : data.p[part.id] != null && data.p[part.id] <= .05;
      assert.equal(part.ok, String(held));
      assert.equal(part.text, held ? 'held' : 'not established');
    }
  });
  await check('one table row per base model with exact displayed metrics', async () => {
    const rows = await ev(`return [...document.querySelectorAll('[data-onto-s1] tbody tr')].map(row=>[...row.children].map(cell=>cell.textContent.trim()));`);
    assert.deepEqual(rows, Object.entries(data.per_base).map(([name, x]) => [
      name, String(x.s1.Pos), `${x.prov.F} → ${x.s1.F}`,
      `${pct(x.prov.precision)} → ${pct(x.s1.precision)}`,
      `${pct(x.prov.recall)} → ${pct(x.s1.recall)}`,
    ]));
  });
  await check('report and plan links resolve with HTTP 200', async () => {
    const links = await ev(`return [...document.querySelectorAll('[data-onto-s1] a')].map(x=>({label:x.textContent.trim(),path:x.getAttribute('href'),url:x.href}));`);
    assert.deepEqual(links.map(x => [x.label, x.path]), [
      ['Report', 'logs/2026-10-04_ONTOLOGY_S1_REPORT.md'],
      ['plan', 'logs/2026-10-04_ONTOLOGY_STAGE1_PLAN.md'],
    ]);
    for (const link of links) {
      const status = await ev(`return (await fetch(${Q(link.url)}, {cache:'no-store'})).status;`);
      assert.equal(status, 200, link.url);
    }
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
      await ev(`document.querySelector('button[data-view="runtime-observation"]').click(); document.querySelector('[data-rt-tab="ontology"]').click(); document.querySelector('[data-onto-seg="s1"]').click();`);
      await sleep(500);
      if (width === 390) {
        const size = await ev(`const e=document.querySelector('[data-onto-s1]'),r=e.getBoundingClientRect();return {document:document.documentElement.scrollWidth,body:document.body.scrollWidth,viewport:innerWidth,left:r.left,right:r.right};`);
        assert.ok(size.document <= size.viewport + 1 && size.body <= size.viewport + 1 && size.left >= -1 && size.right <= size.viewport + 1, JSON.stringify(size));
      }
      await ev(`document.querySelector('[data-onto-s1]').scrollIntoView({block:'start'});`);
      const shot = await p.send('Page.captureScreenshot', { format: 'png' });
      await writeFile(join(artifacts, `${width}.png`), Buffer.from(shot.data, 'base64'));
      assert.deepEqual(p.errors.filter(e => !/favicon|fonts\.(googleapis|gstatic)|ERR_CERT_AUTHORITY_INVALID/.test(e)), []);
    });
  }
  await check('negative control: tampered temporary data copy fails the same hash gate', async () => {
    const copy = structuredClone(data);
    copy.observed.s1.F++;
    const file = join(artifacts, 'tampered-onto-s1.json');
    await writeFile(file, JSON.stringify(copy) + '\n');
    const hash = createHash('sha256').update(await readFile(file)).digest('hex');
    assert.throws(() => verifyHash(hash, fetched.source), /fetched S1 bytes differ/);
  });
} catch (e) { failed++; console.error('FAIL setup: ' + e.stack); }
finally { session?.close(); if (server) await new Promise(r => server.close(r)); }
console.log('artifacts: ' + artifacts);
console.log(`${passed}/${passed + failed} PASS ontology-s1-card${BASE ? ' (live read-back)' : ''}`);
process.exitCode = failed ? 1 : 0;
