// Block B of logs/2026-10-10_AGENT_FLEET_VISUAL_PLAN.md (task T1): the X1 cascade animation (js/rt-fleet-x1.js).
// The first check is pure (the module imports under Node without a DOM); the second drives a headless Chrome page
// from a local static server, like tests/site/rt-fleet.test.mjs, and skips cleanly when no Chrome binary exists.
// Expected values come from the page's own window.__rtFleet.model(), never from typed decisions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mountX1, x1Facts } from '../../js/rt-fleet-x1.js';
import { fleetModel } from '../../js/rt-fleet.js';
import { browser, until, sleep } from './ontology-card/browser.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('rt-fleet-x1 imports under Node; the slice facts are three unique triples', () => {
  assert.equal(typeof mountX1, 'function');
  assert.deepEqual(Object.keys(mountX1(null, {})).sort(), ['destroy', 'pause', 'play', 'reset']);
  const facts = x1Facts(fleetModel({ seed: 7 }));
  assert.equal(facts.length, 3);
  assert.equal(new Set(facts.map(t => `${t.s} ${t.p} ${t.o}`)).size, 3);
});

test('the X1 cascade plays both modes to the model decisions, with visible claims', { timeout: 180000 }, async (t) => {
  let session;
  try {
    session = await browser();
  } catch (e) {
    if (/Chrome not found/.test(e.message)) return t.skip('no Chrome binary (set CHROME); headless page check skipped');
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
  const p = session.page;
  const size = width => p.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 500 });
  const open = async url => {
    await p.send('Page.navigate', { url });
    await until(() => p.ev('return !!document.querySelector("#rtFleet[data-ready] [data-rt-fx1]")'), 'X1 block', 30000);
  };
  const state = () => p.ev('return document.querySelector("[data-rt-fx1]").dataset.state');
  const click = sel => p.ev(`document.querySelector(${JSON.stringify(sel)}).click(); return true`);
  const setMode = m => click(`[data-rt-fx1-mode="${m}"]`);
  const waitDone = label => until(async () => (await state()) === 'done', label, 20000);
  // Non-zero box, not hidden, and not inside a closed <details> or a tip body.
  const VISIBLE = `const vis = el => { if (!el) return false; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && +cs.opacity > 0 && !el.closest('.rt-tip-body') && !el.closest('details:not([open])'); };`;
  const claims = () => p.ev(`${VISIBLE} const c = [...document.querySelectorAll('[data-rt-fx1-claim]')]; return { n: c.length, visible: c.every(vis) };`);
  const decisions = () => p.ev(`return Object.fromEntries([...document.querySelectorAll('[data-rt-fx1-node]')].map(n =>
    [n.dataset.rtFx1Node, [...n.querySelectorAll('[data-rt-fx1-decision]')].map(d => d.dataset.rtFx1Decision)]));`);
  const overflow = () => p.ev('return document.documentElement.scrollWidth - document.documentElement.clientWidth');

  try {
    await new Promise((r, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', r); });
    const url = `http://127.0.0.1:${server.address().port}/index.html#view=runtime-observation&tab=fleet`;
    await size(1400);
    await open(url);
    const model = await p.ev('return window.__rtFleet.model()');
    const want = side => Object.fromEntries([['ops', []], ['sync', []], ...model.x1.map(x => [x.id, [x[side].decision]])]);

    for (const width of [1400, 390]) {
      await size(width);
      await sleep(200);
      for (const m of ['off', 'on']) {
        await setMode(m);
        assert.equal(await p.ev('return document.querySelector("[data-rt-fx1]").dataset.mode'), m, `${width}px mode ${m}`);
        assert.equal(await state(), 'idle', `${width}px ${m}: mode change returns to idle`);
        assert.deepEqual(await claims(), { n: 2, visible: true }, `${width}px ${m} idle: both claims visible`);
        assert.equal(await p.ev('return document.querySelectorAll("[data-rt-fx1-decision]").length'), 0, `${width}px ${m}: no labels before play`);
        await click('[data-rt-fx1-act="play"]');
        await waitDone(`${width}px ${m} done`);
        assert.deepEqual(await decisions(), want(m), `${width}px ${m}: node decisions equal model.x1 ${m}`);
        assert.deepEqual(await claims(), { n: 2, visible: true }, `${width}px ${m} done: both claims visible`);
        const extra = await p.ev(`${VISIBLE} const o = document.querySelector('[data-rt-fx1-outcome]');
          return { facts: document.querySelectorAll('[data-rt-fx1-fact]').length,
            factsVisible: [...document.querySelectorAll('[data-rt-fx1-fact]')].every(vis),
            outcome: vis(o), scripted: vis(o?.querySelector('.rt-fx1-scripted')) && /scripted outcome/.test(o?.textContent ?? ''),
            queue: vis(document.querySelector('[data-rt-fx1-queue]')) && /routed to owner · simulated/.test(document.querySelector('[data-rt-fx1-queue]')?.textContent ?? ''),
            indep: document.querySelectorAll('.rt-fx1-indep').length,
            live: document.querySelector('[data-rt-fx1-live]').textContent };`);
        if (m === 'off') {
          assert.equal(extra.facts, 0, 'no facts in trace-only mode');
          assert.equal(extra.outcome, true, 'the outcome card is visible at the end of trace only');
          assert.equal(extra.scripted, true, 'the outcome card carries a visible "scripted outcome" marker');
          assert.equal(extra.queue, false, 'nothing is routed in trace only');
        } else {
          assert.equal(extra.facts, 3, 'three facts fly in with the ontology');
          assert.equal(extra.factsVisible, true, 'the facts are visible at the end');
          assert.equal(extra.outcome, false, 'no bad outcome with the ontology');
          assert.equal(extra.queue, true, 'the routing badge says "routed to owner · simulated"');
          const stopAt = model.x1.findIndex(x => x.on.stopped);
          assert.equal(extra.indep, model.x1.length - stopAt - 1, 'every step after the hold is marked an independent check');
          assert.ok(extra.live.length > 0, 'the live region announced the steps');
        }
        const ov = await overflow();
        assert.ok(ov <= 0, `${width}px ${m}: no horizontal page overflow (${ov}px)`);
      }
    }

    // The aria-live region announces the decisive step with its rule id.
    await size(1400);
    await setMode('off'); await setMode('on');
    const hold = model.x1.find(x => x.on.stopped);
    const expect = `${hold.on.decision}, rule ${hold.on.rules[0]}`;
    let said = '';
    for (let i = 0; i < 10 && !said.includes(expect); i++) {
      await click('[data-rt-fx1-act="step"]');
      assert.equal(await state(), 'paused', 'Step leaves the player paused');
      said = await p.ev('return document.querySelector("[data-rt-fx1-live]").textContent');
    }
    assert.ok(said.includes(expect), `live region announces "${expect}": ${said}`);

    // Pause keeps the state paused (no further steps while paused).
    await click('[data-rt-fx1-act="replay"]');
    await sleep(1300);
    assert.equal(await state(), 'playing');
    await click('[data-rt-fx1-act="play"]'); // the same button pauses
    assert.equal(await state(), 'paused');
    const frozen = await p.ev('return document.querySelector("[data-rt-fx1-live]").textContent');
    await sleep(2500);
    assert.equal(await state(), 'paused', 'still paused');
    assert.equal(await p.ev('return document.querySelector("[data-rt-fx1-live]").textContent'), frozen, 'no step ran while paused');
    // A mode change while playing cancels the run.
    await click('[data-rt-fx1-act="play"]');
    await setMode('off');
    assert.equal(await state(), 'idle');
    await sleep(1500);
    assert.equal(await state(), 'idle', 'the cancelled run does not resume');

    // Reduced motion: Play jumps straight to the end state.
    await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await p.send('Page.reload', { ignoreCache: true });
    await until(() => p.ev('return !!document.querySelector("#rtFleet[data-ready] [data-rt-fx1]")'), 'X1 block after reload', 30000);
    for (const m of ['off', 'on']) {
      await setMode(m);
      await click('[data-rt-fx1-act="play"]');
      assert.equal(await state(), 'done', `reduced motion ${m}: done right after Play`);
      assert.deepEqual(await decisions(), want(m), `reduced motion ${m}: decisions`);
    }
    await p.send('Emulation.setEmulatedMedia', { features: [] });

    await sleep(300);
    const errors = p.errors.filter(e => !/favicon|fonts\.g|ERR_CERT|net::ERR_(INTERNET|NAME)/i.test(String(e)));
    assert.deepEqual(errors, [], 'no page errors');
  } finally {
    session.close();
    await new Promise(r => server.close(r));
  }
});
