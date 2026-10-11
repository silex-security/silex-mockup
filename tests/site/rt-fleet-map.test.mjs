import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mountMap } from '../../js/rt-fleet-map.js';
import { browser, until } from './ontology-card/browser.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
test('map module imports without a DOM', () => {
  assert.equal(typeof mountMap, 'function');
  assert.doesNotThrow(() => mountMap(null, {}).destroy());
});

test('fleet map and routing agree with the engine model, including motion and mobile', { timeout: 120000 }, async t => {
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
    const p = session.page;
    await p.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1100, deviceScaleFactor: 1, mobile: false });
    await p.send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/index.html#view=runtime-observation&tab=fleet&sub=routing` });
    await until(() => p.ev('return !!document.querySelector("#rtFleet[data-ready]")'), 'fleet ready', 30000);
    // The routing block sits in its own sub-tab and plays once when first shown (logs/2026-10-11_RT_SUBTABS_VISUAL_PLAN.md).
    await until(() => p.ev(`return document.querySelector('[data-rt-froute]').dataset.state==='done'`), 'routing autoplay done', 10000);
    const check = async () => {
      const result = await p.ev(`
        const m=window.__rtFleet.model();
        const cards=[...document.querySelectorAll('[data-rt-fmap-agent]')];
        const dots=[...document.querySelectorAll('[data-rt-fdot]')];
        const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&!e.closest('details:not([open]),.rt-tip-body')};
        return {
          cards: cards.map(e=>e.dataset.rtFmapAgent), expectedCards:m.fleet.map(e=>e.agent),
          tools:cards.every((card,i)=>{const chips=[...card.querySelectorAll('.rt-fmap-tool')];return chips.length===m.fleet[i].tools.length&&chips.every((chip,j)=>chip.textContent.includes(m.fleet[i].tools[j].name)&&chip.querySelector('b').textContent===m.fleet[i].tools[j].impact)}),
          count:dots.length, expectedCount:m.queues.on.total,
          buckets:[...document.querySelectorAll('.rt-froute-bucket')].map(e=>({team:e.querySelector('h5')?.firstChild.textContent.trim(),count:Number(e.querySelector('strong')?.textContent),dots:e.querySelectorAll('[data-rt-fdot]').length})),
          expectedBuckets:m.queues.on.byTeam,
          on:document.querySelector('[data-rt-froute-total-on]').textContent, expectedOn:String(m.queues.on.total),
          off:document.querySelector('[data-rt-froute-total-off]').textContent, expectedOff:String(m.queues.off.total),
          empty:m.queues.off.total!==0||document.querySelector('.rt-froute-empty').textContent==='Nothing stopped, so nothing to route',
          labels:dots.every(e=>{const d=m.dots[Number(e.dataset.rtFdot)];return e.tabIndex===0&&e.getAttribute('aria-label')===[d.scenario,d.tool,d.decision+' by '+d.rule+' → '+d.team].join(' · ')}),
          visible:visible(document.querySelector('[data-rt-froute-claim]'))&&visible(document.querySelector('.rt-froute-count-chip')),
          claim:document.querySelector('[data-rt-froute-claim]').textContent,
          chip:document.querySelector('.rt-froute-count-chip').textContent,
          overflow:document.documentElement.scrollWidth>innerWidth,
          static:dots.every(e=>!e.style.transform)
        };`);
      assert.equal(result.cards.length, 6);
      assert.deepEqual(result.cards, result.expectedCards);
      assert.equal(result.tools, true);
      assert.equal(result.count, result.expectedCount);
      for (const bucket of result.buckets) {
        assert.equal(bucket.count, result.expectedBuckets[bucket.team]);
        assert.equal(bucket.dots, bucket.count);
      }
      assert.equal(result.on, result.expectedOn);
      assert.equal(result.off, result.expectedOff);
      assert.equal(result.empty, true);
      assert.equal(result.labels, true);
      assert.equal(result.visible, true);
      assert.equal(result.claim, 'Routed to the team that owns that kind of action · simulated, no tickets are created');
      assert.equal(result.chip, 'Scenario counts, computed by the engine, not measurements');
      assert.equal(result.overflow, false);
      assert.equal(result.static, true);
      return result;
    };
    const initial = await check();
    await p.ev(`document.querySelector('.rt-froute-play').click()`);
    assert.equal(await p.ev(`return document.querySelector('[data-rt-froute]').dataset.state`), 'playing');
    await p.ev(`document.querySelector('.rt-froute-play').click()`);
    assert.equal(await p.ev(`return document.querySelector('[data-rt-froute]').dataset.state`), 'paused');
    await p.ev(`document.querySelector('.rt-froute-play').click()`);
    await until(() => p.ev(`return document.querySelector('[data-rt-froute]').dataset.state==='done'`), 'routing done', 10000);
    assert.deepEqual(await check(), initial, 'end state preserves the complete static model');
    await p.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
    await check();
    await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await p.ev('window.__rtFleet.render()');
    assert.equal(await p.ev(`return document.querySelector('[data-rt-froute]').dataset.state`), 'done');
    await p.ev(`document.querySelector('.rt-froute-replay').click()`);
    assert.equal(await p.ev(`return document.querySelector('[data-rt-froute]').dataset.state`), 'done');
    await check();
    // Actual keyboard focus and destroy/tab cancellation, without invoking the engine.
    assert.equal(await p.ev(`const d=document.querySelector('[data-rt-fdot]');d.focus();return document.activeElement===d`), true);
    await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await p.ev(`window.__rtFleet.render();document.querySelector('.rt-froute-play').click();document.dispatchEvent(new CustomEvent('rt:tab',{detail:{tab:'scenarios'}}))`);
    assert.equal(await p.ev(`return document.querySelector('[data-rt-froute]').dataset.state`), 'idle');
    assert.deepEqual(p.errors.filter(e => !/favicon|fonts\.g|ERR_CERT|net::ERR_(INTERNET|NAME)/i.test(String(e))), [], 'no page errors');
  } finally {
    session.close();
    await new Promise(r => server.close(r));
  }
});
