// T3 (logs/2026-10-11_RT_SUBTABS_VISUAL_PLAN.md): the Ontology "Example runs" timeline agrees with
// data/onto-observability.json in all four cases and both rules (same checks as ontology-card.test.mjs item 4), keeps
// the plan's hooks, shows the explanation chain only where the data explains something, fits 390 px, shows the whole
// picture under reduced motion and raises no console errors. It skips cleanly when no Chrome binary is found.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mountOntoRun } from '../../js/rt-onto-run.js';
import { browser, until } from './ontology-card/browser.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CELLS = ['both', 'saved', 'lost', 'miss'];
const RULES = [['onto', 'otp'], ['prov', 'prov']];

test('onto-run module imports without a DOM and returns a full handle without an element', () => {
  assert.equal(typeof mountOntoRun, 'function');
  const h = mountOntoRun(null, { ex: undefined, mode: 'onto', desc: 'x' });
  for (const k of ['play', 'pause', 'reset', 'update', 'destroy']) assert.equal(typeof h[k], 'function', k);
  assert.doesNotThrow(() => { h.play(); h.pause(); h.reset(); h.update({}); h.destroy(); });
});

test('example-run timeline matches the data, at both widths, in motion and under reduced motion', { timeout: 120000 }, async t => {
  let session;
  try { session = await browser(); } catch (e) {
    if (/Chrome not found/.test(e.message)) return t.skip('no Chrome binary (set CHROME); headless check skipped');
    throw e;
  }
  const data = JSON.parse(await readFile(join(ROOT, 'data/onto-observability.json'), 'utf8'));
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
    const url = `http://127.0.0.1:${server.address().port}/index.html#view=runtime-observation&tab=ontology&sub=ex`;
    await p.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1100, deviceScaleFactor: 1, mobile: false });
    await p.send('Page.navigate', { url });
    await until(() => p.ev(`return !!document.querySelector('[data-onto-run],[data-onto-empty]')`), 'example run rendered', 30000);
    // The host binds this handle to the "ex" sub-tab (js/rt-subnav.js), which plays it once on first show; so the page shows
    // that one play, and a fresh mount on its own element must stay idle (it never starts motion by itself).
    assert.ok(['playing', 'done'].includes(await p.ev(`return document.querySelector('[data-onto-run]')?.dataset.state`)), 'the sub-tab plays the timeline once on first show');
    assert.equal(await p.ev(`const { mountOntoRun } = await import('/js/rt-onto-run.js'); const host = document.createElement('div'); document.body.append(host);
      const ex = (await (await fetch('/data/onto-observability.json')).json()).examples.find(e => e.cell === 'both');
      const saved = window.__rtOntoRun; const h = mountOntoRun(host, { ex, mode: 'onto', desc: 'probe' }, {}); const st = host.querySelector('[data-onto-run]').dataset.state;
      h.destroy(); host.remove(); window.__rtOntoRun = saved; return st`), 'idle', 'mount renders the idle state and never starts motion by itself');
    await until(() => p.ev(`return document.querySelector('[data-onto-run]').dataset.state === 'done'`), 'first-show play finished', 10000);
    await p.ev(`window.__rtOntoRun.reset()`);

    const read = () => p.ev(`return {
      state: document.querySelector('[data-onto-run]')?.dataset.state ?? null,
      run: document.querySelector('[data-onto-run]')?.dataset.ontoRun ?? null,
      empty: document.querySelector('[data-onto-empty]')?.textContent ?? null,
      calls: [...document.querySelectorAll('[data-onto-call]')].map(c => ({
        index: Number(c.dataset.ontoCall),
        flagged: c.hasAttribute('data-onto-flagged'),
        reason: c.querySelector('.rt-onto-why')?.textContent.trim() ?? null,
        verdict: c.querySelector('.rt-chip')?.textContent ?? null,
        kind: c.querySelector('.rt-chip')?.dataset.kind ?? null,
        io: c.querySelector('.rt-onto-io-ic')?.getAttribute('aria-label') ?? null,
        labelled: [...c.querySelectorAll('svg[role="img"]')].every(s => !!s.getAttribute('aria-label')),
      })),
      typed: [...document.querySelectorAll('[data-onto-chain]')].map(ch => ch.textContent.replace(/\\s+/g, ' ').trim()),
      generic: [...document.querySelectorAll('.rt-onto-chain:not([data-onto-chain])')].map(ch => ch.textContent.replace(/\\s+/g, ' ').trim()),
      marks: [...document.querySelectorAll('.rt-onto-src mark')].map(m => m.textContent),
    };`);
    const pick = async (cell, mode) => {
      await p.ev(`document.querySelector('[data-onto-cell-btn="${cell}"]').click(); document.querySelector('[data-onto-mode-btn="${mode}"]').click();`);
      return read();
    };

    // 1 · every case × both rules: call order, the flagged call, the verdict and the verbatim "why not" text.
    for (const cell of CELLS) {
      const e = data.examples.find(x => x.cell === cell);
      assert.ok(e, 'cell exists: ' + cell);
      for (const [mode, key] of RULES) {
        const dom = await pick(cell, mode);
        const at = `${cell}/${mode}`;
        if (e.empty) {
          assert.match(dom.empty ?? '', /no qualifying example/, at);
          assert.equal(dom.run, null, at);
          assert.deepEqual(dom.calls, [], at);
          continue;
        }
        assert.equal(dom.run, e.run.run_id, `${at}: run id`);
        assert.deepEqual(dom.calls.map(c => c.index), e.run.calls.map(c => c.index), `${at}: call order`);
        const flagged = e[key].call_index == null ? [] : [e[key].call_index];
        assert.deepEqual(dom.calls.filter(c => c.flagged).map(c => c.index), flagged, `${at}: flagged call`);
        for (const c of dom.calls) {
          const call = e.run.calls.find(x => x.index === c.index);
          const isFlagged = flagged.includes(c.index);
          assert.equal(c.verdict, isFlagged ? 'Alert' : 'No alert', `${at} call ${c.index}: verdict text`);
          assert.equal(c.kind, isFlagged ? 'blocked' : 'ran', `${at} call ${c.index}: chip kind`);
          assert.equal(c.labelled, true, `${at} call ${c.index}: every SVG figure is labelled`);
          assert.equal(c.io, `${call.impact} call: ${call.tool}`, `${at} call ${c.index}: read/write icon`);
          assert.equal(c.reason, isFlagged ? null : e.why_not[key][c.index], `${at} call ${c.index}: why not, verbatim`);
        }
        // 2 · the chain appears only where the data explains something: the typed chain in the ontology mode
        //     (the only one carrying data-onto-chain), the generic rule's three sentences in the untyped mode.
        const exp = e[key].explanation;
        if (exp) {
          if (mode === 'onto') {
            assert.equal(dom.typed.length, 1, `${at}: one typed chain, the one carrying data-onto-chain`);
            assert.ok(dom.typed[0].includes(exp.class), `${at}: the typed chain names the class`);
            for (const fx of exp.effects) assert.ok(dom.typed[0].includes(fx), `${at}: the typed chain names effect ${fx}`);
            assert.ok(dom.typed[0].includes(exp.arg) && dom.typed[0].includes(exp.value), `${at}: typed chain names arg and value`);
            assert.deepEqual(dom.generic, [], `${at}: the untyped rule's sentences never appear in the ontology mode`);
          } else {
            assert.equal(dom.generic.length, 1, `${at}: one generic chain`);
            assert.match(dom.generic[0], /is a write call/, at);
            assert.ok(dom.generic[0].includes(exp.arg) && dom.generic[0].includes(exp.value), `${at}: generic chain names arg and value`);
            assert.deepEqual(dom.typed, [], `${at}: data-onto-chain belongs to the typed rule only`);
          }
          assert.deepEqual(dom.marks, [exp.value], `${at}: the excerpt highlights the value`);
        } else {
          assert.deepEqual(dom.typed, [], `${at}: no typed chain without an explanation`);
          assert.deepEqual(dom.generic, [], `${at}: no generic chain without an explanation`);
          assert.deepEqual(dom.marks, [], `${at}: no excerpt without an explanation`);
        }
      }
    }

    // 3 · 390 px: the page and the panel keep their width for every case and rule.
    await p.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
    for (const cell of CELLS) for (const [mode] of RULES) {
      await pick(cell, mode);
      const size = await p.ev(`const e=document.querySelector('#rtOntology'),r=e.getBoundingClientRect();return {doc:document.documentElement.scrollWidth,win:innerWidth,scroll:e.scrollWidth,client:e.clientWidth,left:r.left,right:r.right};`);
      assert.ok(size.doc <= size.win + 1 && size.scroll <= size.client + 1 && size.left >= -1 && size.right <= size.win + 1, `${cell}/${mode} horizontal overflow: ${JSON.stringify(size)}`);
    }
    const narrow = await p.ev(`return {tasks:document.querySelectorAll('.rt-onto-task').length,calls:document.querySelectorAll('.rt-onto-call').length};`);
    assert.equal(narrow.tasks, 1, 'the user task sits in a bubble at the start of the timeline');
    assert.ok(narrow.calls > 0, 'calls are drawn at 390 px');

    // 4 · reduced motion: the whole run is on screen, with nothing left to animate.
    await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await p.send('Page.reload');
    await until(() => p.ev(`const r=document.querySelector('[data-onto-run]');return !!r&&r.dataset.state==='done'`), 'reduced-motion end state', 30000);
    const rm = await p.ev(`return {calls:document.querySelectorAll('[data-onto-call]').length,flagged:document.querySelectorAll('[data-onto-flagged]').length,animated:[...document.querySelectorAll('.rt-onto-call,.rt-onto-chain li')].some(n=>getComputedStyle(n).animationName!=='none')};`);
    assert.equal(rm.calls, data.examples.find(x => x.cell === 'both').run.calls.length, 'reduced motion keeps the whole run visible');
    assert.equal(rm.flagged, 1, 'reduced motion still marks the flagged call');
    assert.equal(rm.animated, false, 'nothing animates under reduced motion');

    // 5 · lifecycle: idle at mount, play once to done, pause, reset, and a keyboard-operable Replay button.
    await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await p.send('Page.reload');
    await until(() => p.ev(`return !!document.querySelector('[data-onto-run]')`), 'timeline back', 30000);
    // The sub-tab's first-show play (host bind) runs to done; reset() returns the block to idle for the checks below.
    await until(() => p.ev(`return document.querySelector('[data-onto-run]').dataset.state === 'done'`), 'first-show play finished', 10000);
    await p.ev(`window.__rtOntoRun.reset()`);
    assert.equal(await p.ev(`return document.querySelector('[data-onto-run]').dataset.state`), 'idle');
    assert.equal(await p.ev(`const b=document.querySelector('.rt-onto-run-replay');return !!b&&b.tagName==='BUTTON'`), true, 'Replay is a real button');
    await p.ev(`window.__rtOntoRun.play()`);
    assert.equal(await p.ev(`return document.querySelector('[data-onto-run]').dataset.state`), 'playing');
    await p.ev(`window.__rtOntoRun.pause()`);
    assert.equal(await p.ev(`return document.querySelector('[data-onto-run]').dataset.state`), 'paused');
    await p.ev(`window.__rtOntoRun.play()`);
    await until(() => p.ev(`return document.querySelector('[data-onto-run]').dataset.state==='done'`), 'timeline motion done', 10000);
    await p.ev(`window.__rtOntoRun.reset()`);
    assert.equal(await p.ev(`return document.querySelector('[data-onto-run]').dataset.state`), 'idle');
    assert.equal(await p.ev(`document.querySelector('.rt-onto-run-replay').click();return document.querySelector('[data-onto-run]').dataset.state==='playing'`), true, 'Replay restarts the motion');

    // 6 · update(): a rule change replays only the chain, and keeps the timeline block; a case change redraws.
    //     The rule change is driven through the host's own button, so the input (ex, mode, desc) is exactly what
    //     js/rt-ontology.js passes; the block only survives if the module treats it as the same case.
    const both = data.examples.find(x => x.cell === 'both');
    await p.ev(`document.querySelector('[data-onto-run]').dataset.marker='kept'`);
    await p.ev(`document.querySelector('[data-onto-cell-btn="both"]').click()`);
    assert.equal(await p.ev(`return document.querySelector('[data-onto-run]').dataset.marker??null`), 'kept', 're-selecting the case on screen is a no-op (cell is both)');
    await p.ev(`document.querySelector('[data-onto-mode-btn="prov"]').click()`);
    const upd = await p.ev(`return {marker:document.querySelector('[data-onto-run]').dataset.marker??null,run:document.querySelector('[data-onto-run]').dataset.ontoRun,state:document.querySelector('[data-onto-run]').dataset.state,flagged:[...document.querySelectorAll('[data-onto-flagged]')].map(c=>Number(c.dataset.ontoCall)),typed:document.querySelectorAll('[data-onto-chain]').length,generic:document.querySelectorAll('.rt-onto-chain:not([data-onto-chain])').length,reason:document.querySelector('[data-onto-call="0"] .rt-onto-why')?.textContent.trim()??null};`);
    assert.equal(upd.marker, 'kept', 'a rule-only update keeps the timeline block in place');
    assert.equal(upd.run, both.run.run_id, 'the same run stays on screen');
    assert.deepEqual(upd.flagged, both.prov.call_index == null ? [] : [both.prov.call_index], 'the cards are re-decided for the other rule');
    assert.equal(upd.typed, 0, 'the untyped rule shows no data-onto-chain');
    assert.equal(upd.generic, 1, 'the untyped rule shows the generic chain');
    assert.equal(upd.reason, both.why_not.prov['0'], 'the reason text follows the rule');
    assert.equal(upd.state, 'playing', 'a rule-only update replays the chain');
    await until(() => p.ev(`return document.querySelector('[data-onto-run]').dataset.state==='done'`), 'chain replay done', 10000);
    await p.ev(`document.querySelector('[data-onto-cell-btn="lost"]').click()`);
    assert.equal(await p.ev(`return document.querySelector('[data-onto-run]').dataset.marker??null`), null, 'a case change redraws the block');
    assert.equal(await p.ev(`return document.querySelector('[data-onto-run]').dataset.ontoRun`), data.examples.find(x => x.cell === 'lost').run.run_id);

    // 7 · destroy clears the panel and the handle.
    await p.ev(`window.__rtOntoRun.destroy()`);
    assert.equal(await p.ev(`return document.querySelectorAll('[data-onto-run],[data-onto-empty]').length`), 0, 'destroy empties the panel');

    assert.deepEqual(p.errors.filter(e => !/favicon|fonts\.g|ERR_CERT|net::ERR_(INTERNET|NAME)/i.test(String(e))), [], 'no page errors');
  } finally {
    session.close();
    await new Promise(r => server.close(r));
  }
});
