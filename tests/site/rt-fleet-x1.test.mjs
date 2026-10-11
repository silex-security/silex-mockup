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
  // Every element intersects the X1 stage scroller's visible rect (phone widths: the story must not play off-screen).
  const INVIEW = `const sc = document.querySelector('.rt-fx1-scroll').getBoundingClientRect();
    const inView = el => { const r = el.getBoundingClientRect(); return r.right > sc.left + 1 && r.left < sc.right - 1 && r.width > 0; };`;
  const framed = () => p.ev(`${INVIEW} const els = [...document.querySelectorAll('[data-rt-fx1-focus],[data-rt-fx1-queue],[data-rt-fx1-outcome]')];
    return { n: document.querySelectorAll('[data-rt-fx1-focus]').length, out: els.filter(e => !inView(e)).map(e => e.className) };`);
  const overflow = () => p.ev('return document.documentElement.scrollWidth - document.documentElement.clientWidth');

  try {
    await new Promise((r, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', r); });
    const url = `http://127.0.0.1:${server.address().port}/index.html#view=runtime-observation&tab=fleet`;
    await size(1400);
    await open(url);
    const model = await p.ev('return window.__rtFleet.model()');
    const want = side => Object.fromEntries([['ops', []], ['sync', []], ...model.x1.map(x => [x.id, [x[side].decision]])]);

    // T4 guided demo: on first render the block plays Trace only, then switches to With ontology and plays it.
    assert.equal(await p.ev('return document.querySelector("[data-rt-fx1]").dataset.mode'), 'off', 'the demo starts in Trace only');
    assert.equal(await state(), 'playing', 'the demo plays without a click');
    const liveAttr = () => p.ev('return document.querySelector("[data-rt-fx1-live]").getAttribute("aria-live")');
    assert.equal(await liveAttr(), 'off', 'the guided demo does not announce each step');
    await until(async () => (await p.ev('const r=document.querySelector("[data-rt-fx1]");return r.dataset.mode+"/"+r.dataset.state')) === 'on/done', 'the demo ends in With ontology, done', 40000);
    assert.deepEqual(await decisions(), want('on'), 'the demo ends on the model decisions with the slice');
    assert.equal(await liveAttr(), 'polite', 'the live region is polite again after the demo');
    const sum = await p.ev('return document.querySelector("[data-rt-fx1-live]").textContent');
    assert.match(sum, /^Demo finished\./, `one summary line at the end of the demo: ${sum}`);
    for (const x of model.x1) assert.ok(sum.includes(x.on.decision), `summary names ${x.id} ${x.on.decision}`);

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
        // The end-state card pops in with a short CSS animation from opacity 0; a slow runner (CI) can sample it mid-way, so
        // wait until the element is shown and its animations have finished before checking visibility.
        await until(() => p.ev(`${VISIBLE} const e = document.querySelector('${m === 'off' ? '[data-rt-fx1-outcome]' : '[data-rt-fx1-queue]'}');
          return !!e && vis(e) && e.getAnimations({ subtree: true }).every(a => a.playState === 'finished');`), `${width}px ${m}: end-state card settled`, 8000);
        const extra = await p.ev(`${VISIBLE} const o = document.querySelector('[data-rt-fx1-outcome]');
          return { facts: document.querySelectorAll('[data-rt-fx1-fact]').length,
            factsVisible: [...document.querySelectorAll('[data-rt-fx1-fact]')].every(vis),
            outcome: vis(o), scripted: vis(o?.querySelector('.rt-fx1-scripted')) && /scripted outcome/.test(o?.querySelector('.rt-fx1-scripted')?.textContent ?? ''),
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

    // Phone width: after each Step and at done, the step's element and any shown queue badge / outcome card sit inside the
    // stage scroller's visible area (the scroller follows the story; the page does not scroll sideways).
    await size(390);
    await sleep(200);
    for (const m of ['off', 'on']) {
      await setMode(m === 'off' ? 'on' : 'off'); await setMode(m);
      assert.equal(await state(), 'idle');
      for (let i = 0; i < 12 && (await state()) !== 'done'; i++) {
        await click('[data-rt-fx1-act="step"]');
        let f;
        await until(async () => { f = await framed(); return f.n > 0 && f.out.length === 0; }, `390px ${m} step ${i + 1} framed`, 4000)
          .catch(() => assert.fail(`390px ${m} step ${i + 1}: outside the scroller: ${JSON.stringify(f)}`));
      }
      assert.equal(await state(), 'done', `390px ${m}: stepped to done`);
      if (m === 'off') {
        const sc = await p.ev(`${VISIBLE} ${INVIEW} const t = document.querySelector('[data-rt-fx1-outcome] .rt-fx1-scripted'); return vis(t) && inView(t);`);
        assert.equal(sc, true, '390px: the "scripted outcome" marker is visible inside the scroller');
      }
      assert.ok((await overflow()) <= 0, `390px ${m}: no page overflow after stepping`);
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

    // Reduced motion, set before the page loads: the block opens on the guided demo's end state (With ontology, done)
    // without a click; a mode change shows that mode's end state at once; Replay keeps it done. At 1400 and 390 px.
    await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    for (const width of [1400, 390]) {
      await size(width);
      await p.send('Page.reload', { ignoreCache: true });
      await until(() => p.ev('return !!document.querySelector("#rtFleet[data-ready] [data-rt-fx1]")'), `X1 block, reduced motion, ${width}px`, 30000);
      const rs = () => p.ev('const r=document.querySelector("[data-rt-fx1]");return r.dataset.mode+"/"+r.dataset.state');
      assert.equal(await rs(), 'on/done', `${width}px reduced motion: opens With ontology, done, without a click`);
      assert.deepEqual(await decisions(), want('on'), `${width}px reduced motion: HOLD/BLOCK/BLOCK from model.x1`);
      assert.deepEqual(await claims(), { n: 2, visible: true }, `${width}px reduced motion: claims visible`);
      await setMode('off');
      assert.equal(await rs(), 'off/done', `${width}px reduced motion: Trace only shows its end state at once`);
      assert.deepEqual(await decisions(), want('off'), `${width}px reduced motion: ran ✓ ×3`);
      assert.deepEqual(await p.ev(`return [...document.querySelectorAll('[data-rt-fx1-decision]')].map(d => d.textContent)`), model.x1.map(() => 'ran ✓'));
      const card = await p.ev(`${VISIBLE} ${INVIEW} const o = document.querySelector('[data-rt-fx1-outcome]'); const t = o?.querySelector('.rt-fx1-scripted');
        return { card: vis(o), marker: vis(t) && /scripted outcome/.test(t?.textContent ?? ''), inView: !!o && inView(o) && inView(t) };`);
      assert.deepEqual(card, { card: true, marker: true, inView: true }, `${width}px reduced motion: the outcome card and its marker are visible`);
      await click('[data-rt-fx1-act="replay"]');
      assert.equal(await rs(), 'off/done', `${width}px reduced motion: Replay keeps it done`);
      await setMode('on');
      assert.equal(await rs(), 'on/done', `${width}px reduced motion: back to With ontology, done`);
      assert.ok((await overflow()) <= 0, `${width}px reduced motion: no page overflow`);
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
