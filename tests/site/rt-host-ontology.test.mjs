// Runtime Observation host: the "Open full page" link keeps the frame's live ontology-slice setting (code review r1,
// jev-runtime-observability logs/2026-10-10_CREATOR_DOMAIN_FLEET_PLAN.md). The demo's switch reloads the frame in place,
// so the iframe's src attribute is stale; the link must follow the frame's current URL, and the full page must then decide
// without the slice. Headless Chrome; skips with a clear message when no Chrome binary exists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { browser, until } from './ontology-card/browser.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CREATOR_RULES = ['latent_ad_path', 'ad_use_eligibility', 'cross_principal_read', 'mcn_payout_scope', 'asset_license',
  'cumulative_limit', 'sensitive_event_push', 'credential_change_verification'];

test('switching the slice off in the frame carries ontology=0 into Open full page, and the full page decides without it', async t => {
  let session;
  try { session = await browser(); } catch (e) {
    if (/Chrome not found/.test(e.message)) return t.skip('no Chrome binary (set CHROME); headless check skipped');
    throw e;
  }
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
  const server = createServer(async (req, res) => {
    try {
      let file = resolve(ROOT, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
      if (file !== ROOT && !file.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(await readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  try {
    await new Promise((r, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', r); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const p = session.page;
    await p.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1100, deviceScaleFactor: 1, mobile: false });
    await p.send('Page.navigate', { url: `${origin}/index.html#view=runtime-observation` });
    await until(() => p.ev('return !!window.__jevRuntime?.ready'), 'host ready', 30000);

    // A creator run puts the creator demo in the frame, slice on.
    const line = await p.ev('return await window.__jevRuntime.run("X1Pb")');
    assert.match(line, /latent_ad_path/);
    const frameDemo = 'const f=document.querySelector("#rtFrameWrap iframe")||document.querySelector("iframe");return f.contentWindow';
    const href = () => p.ev('const a=document.getElementById("rtOpenFull");a.dispatchEvent(new Event("pointerenter"));return a.href');
    assert.equal(new URL(await href()).searchParams.get('ontology'), null, 'slice on: no ontology parameter');

    // Switch the slice off inside the frame; the frame reloads in place.
    await p.ev(`${frameDemo}.document.querySelector('[data-ontology="0"]').click()`);
    await until(() => p.ev(`const w=(()=>{${frameDemo}})();return w.__jevDemo?.ready===true&&w.__jevDemo.ontology===false`), 'frame reloaded with the slice off', 30000);
    const offHref = new URL(await href());
    assert.equal(offHref.searchParams.get('ontology'), '0', 'Open full page keeps ontology=0');
    assert.equal(offHref.searchParams.get('domain'), 'creator');

    // The full page then decides without the slice: X1Pb runs, no creator rule.
    await p.send('Page.navigate', { url: offHref.href });
    await until(() => p.ev('return window.__jevDemo?.ready===true'), 'full page ready', 30000);
    const full = await p.ev(`const d=window.__jevDemo;const envs=d.inject("X1Pb");return {ontology:d.ontology,domain:d.domain,rules:envs.flatMap(e=>(e.rule_hits??[]).map(h=>h.id))}`);
    assert.equal(full.ontology, false);
    assert.equal(full.domain, 'creator');
    assert.ok(!full.rules.some(r => CREATOR_RULES.includes(r)), `no creator rule without the slice: ${full.rules}`);
    assert.deepEqual(p.errors, [], 'no page errors');
  } finally {
    session.close();
    await new Promise(r => server.close(r));
  }
});
