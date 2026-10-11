// Runtime Observation · Agent fleet, block E: the scenario matrix (logs/2026-10-10_AGENT_FLEET_VISUAL_PLAN.md, row E;
// task T3, coder-mimo). The first test is pure — it imports the module under Node (no DOM) and reads the markup
// mountGrid writes into a stub element — so it runs anywhere. The last one drives a headless Chrome page from a local
// static server, like tests/site/rt-fleet.test.mjs: no git and no network, and it skips with a clear message when no
// Chrome binary exists (set CHROME).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fleetModel } from '../../js/rt-fleet.js';
import { mountGrid } from '../../js/rt-fleet-grid.js';
import { browser, until } from './ontology-card/browser.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
// The same symbols and chip kinds the page shows; the expectations below are recomputed from the model, never typed in.
const GLYPH = { ALLOW: '\u2713', HOLD: '\u23F8\uFE0E', BLOCK: '\u26D4\uFE0E', REVIEW: '\u25D4' };
const KIND = { ALLOW: 'ran', HOLD: 'held', BLOCK: 'blocked', REVIEW: 'review' };
const ORDER = [['a', 'off'], ['a', 'on'], ['b', 'off'], ['b', 'on']];
const glyphOf = c => GLYPH[c.decision] ?? (c.stopped ? GLYPH.BLOCK : GLYPH.ALLOW);
const kindOf = c => KIND[c.decision] ?? (c.stopped ? 'blocked' : 'ran');
const labelOf = c => `${c.tool}: ${c.decision}`;
const seqKey = calls => calls.map(c => `${c.tool}:${c.decision}`).join('\u2192');
const cellsOf = row => ORDER.map(([side, runs]) => row[side][runs]);

/** Every call of the matrix in reading order (row → a/trace → a/slice → b/trace → b/slice), with what the cell shows. */
function expectedCalls(model) {
  return model.matrix.flatMap(row => cellsOf(row).flatMap(calls => calls.map(c => ({
    kind: kindOf(c), label: labelOf(c), glyph: glyphOf(c),
  }))));
}

/** The stub element mountGrid writes into: innerHTML plus the two listener methods it touches. */
function stubEl() {
  const listeners = new Map();
  return {
    innerHTML: '', listeners,
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type, fn) { if (listeners.get(type) === fn) listeners.delete(type); },
    contains() { return true; },
  };
}

const CALL_RE = /<span class="rt-fgrid-call[^"]*" data-kind="([a-z]+)"[^>]*aria-label="([^"]*)">([^<]*)<\/span>/g;
const callsIn = html => [...html.matchAll(CALL_RE)].map(m => ({ kind: m[1], label: m[2], glyph: m[3] }));
const countIn = (html, re) => (html.match(re) ?? []).length;

test('mountGrid renders the eleven rows of model.matrix, without touching the DOM at import time', () => {
  // Importing the module is the first contract check: document is undefined here, so any top-level DOM access throws.
  assert.equal(typeof document, 'undefined');
  const bare = mountGrid(null, fleetModel(), {});
  assert.equal(typeof bare.destroy, 'function', 'no element: still returns a handle');

  const model = fleetModel({ seed: 7 });
  assert.equal(model.matrix.length, 11, 'the model carries the eleven rows');

  // Without opts.tip the block still mounts (the site always passes one); with it, every call gets its ⓘ.
  const bare2 = stubEl();
  assert.equal(typeof mountGrid(bare2, model, {}).destroy, 'function', 'mounts without a tip function');
  assert.ok(bare2.innerHTML.includes('data-rt-fgrid'), 'and still renders the matrix');

  const tip = html => `<span class="rt-tip" tabindex="0" role="button"><span class="rt-tip-body">${html}</span></span>`;
  const el = stubEl();
  const handle = mountGrid(el, model, { tip });
  const html = el.innerHTML;

  assert.equal(typeof handle.destroy, 'function', 'destroy() is returned');
  assert.equal(typeof el.listeners.get('click'), 'function', 'one delegated click listener for every ▶');

  // One root in a .card, a header row and eleven rows, four cells each.
  assert.match(html, /<section class="card rt-fgrid[^"]*" data-rt-fgrid>/);
  assert.equal(countIn(html, / data-rt-fgrid-row="/g), 11, 'one row per matrix entry');
  assert.equal(countIn(html, /class="rt-fgrid-cell" role="cell"/g), 11 * 4, 'four cells per row');
  assert.equal(countIn(html, / data-rt-fgrid-play="/g), 11, 'one ▶ per row');
  assert.equal(countIn(html, /<span class="rt-fgrid-cap">/g), 11 * 4, 'every cell can name its column when the row stacks');
  assert.equal(countIn(html, / class="rt-fgrid-head" role="row"/g), 1, 'one header row');

  // The icon sequence, the accessible names and the chip kinds equal the model, cell by cell, in reading order.
  assert.deepEqual(callsIn(html), expectedCalls(model), 'every cell shows the model\'s calls, in order');

  // Every call carries an ⓘ with the rule id and reason, or the words "no rule fired".
  assert.equal(countIn(html, /<span class="rt-tip" /g), expectedCalls(model).length + 1, 'one tip per call, plus the heading tip');
  for (const row of model.matrix) for (const [side, runs] of ORDER) for (const c of row[side][runs]) {
    if (c.rules.length) for (const r of c.rules) assert.ok(html.includes(r), `the tip names the rule ${r}`);
    else assert.match(html, /no rule fired/);
  }

  // ▶ plays the row's own id and says so; the "differs" rows are exactly the rows whose risky result changes.
  assert.deepEqual([...html.matchAll(/data-rt-fgrid-play="([^"]*)"/g)].map(m => m[1]), model.matrix.map(r => r.play));
  assert.equal(countIn(html, /aria-label="Play [^"]* in the Scenarios tab"/g), 11);
  const differing = model.matrix.filter(r => seqKey(r.b.off) !== seqKey(r.b.on));
  assert.equal(countIn(html, / rt-fgrid-differs"/g), differing.length, 'only rows whose b result differs are highlighted');
  assert.equal(countIn(html, />differs</g), differing.length, 'and each of them says so in text');
  for (const r of model.matrix.filter(x => seqKey(x.b.off) === seqKey(x.b.on))) {
    assert.ok(!html.includes(`rt-fgrid-row rt-fgrid-differs" role="row" data-rt-fgrid-row="${r.key}"`), `${r.key} is not flagged`);
  }
  // Counts come from the model: nothing types "eleven" or any decision into the module.
  assert.ok(html.includes(`${model.matrix.length} scenarios, ${2 * model.matrix.length} scripted traces`), 'the visible counts are the model\'s (code review r1)');

  // destroy() removes the listener and empties the block.
  handle.destroy();
  assert.equal(el.innerHTML, '');
  assert.equal(el.listeners.size, 0);
});

test('the scenario matrix plays a row in the Scenarios tab and fits 390 px', { timeout: 240000 }, async (t) => {
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
  const model = fleetModel({ seed: 7 });
  try {
    await new Promise((r, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', r); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const p = session.page;
    // Navigate at a given width and wait for the fleet panel and its matrix.
    const open = async width => {
      await p.send('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: false });
      await p.send('Page.navigate', { url: `${origin}/index.html#view=runtime-observation&tab=fleet&sub=scenarios` });
      await until(() => p.ev('return !!document.querySelector("#rtFleet[data-ready]")'), 'Agent fleet panel', 30000);
      await until(() => p.ev('return document.querySelectorAll("[data-rt-fgrid-row]").length === 11'), 'the eleven matrix rows', 20000);
    };
    await open(1400);

    // The heading, its one tip and the four short column headers.
    const head = await p.ev(`const g=document.querySelector('[data-rt-fgrid]');
      return { tag: g.tagName, inCard: g.classList.contains('card'),
        h3: g.querySelector('h3')?.textContent ?? '',
        chip: g.querySelector('h3 .rt-chip')?.textContent ?? '',
        tips: g.querySelectorAll('h3 .rt-tip').length,
        cols: [...g.querySelectorAll('.rt-fgrid-head [role="columnheader"]')].map(e => e.textContent.trim()),
        hooks: [...g.querySelectorAll('*')].flatMap(e => [...e.attributes].map(a => a.name))
          .filter(n => n.startsWith('data-rt-') && !/^data-rt-fgrid(-[a-z]+)?$/.test(n)) };`);
    assert.equal(head.tag, 'SECTION');
    assert.equal(head.inCard, true, 'the block is a .card');
    assert.match(head.h3, /Every scenario, with and without the slice/);
    assert.equal(head.chip, 'Computed by the engine');
    assert.equal(head.tips, 1, 'exactly one tip in the heading');
    assert.deepEqual(head.cols, ['Scenario', 'a \u00B7 Trace only', 'a \u00B7 With slice', 'b \u00B7 Trace only', 'b \u00B7 With slice', 'Play']);
    assert.deepEqual(head.hooks, [], 'the block uses only its own data-rt-fgrid* hooks');

    // Eleven rows; every cell's icon sequence, chip kind and accessible name equals model.matrix.
    const rows = await p.ev(`return [...document.querySelectorAll('[data-rt-fgrid-row]')].map(r => ({
      key: r.getAttribute('data-rt-fgrid-row'),
      differs: r.classList.contains('rt-fgrid-differs'),
      text: r.textContent,
      agent: r.querySelector('.rt-fgrid-agent')?.textContent.trim() ?? '',
      name: r.querySelector('.rt-fgrid-name')?.textContent.trim() ?? '',
      play: r.querySelector('[data-rt-fgrid-play]')?.getAttribute('data-rt-fgrid-play') ?? null,
      playLabel: r.querySelector('[data-rt-fgrid-play]')?.getAttribute('aria-label') ?? null,
      cells: [...r.querySelectorAll('.rt-fgrid-cell')].map(c => ({
        calls: [...c.querySelectorAll('[data-rt-fgrid-call]')].map(x => x.textContent),
        labels: [...c.querySelectorAll('[data-rt-fgrid-call]')].map(x => x.getAttribute('aria-label')),
        kinds: [...c.querySelectorAll('[data-rt-fgrid-call]')].map(x => x.getAttribute('data-kind')),
        tips: [...c.querySelectorAll('[data-rt-fgrid-call]')].map(x => x.nextElementSibling?.querySelector('.rt-tip-body')?.textContent ?? ''),
      })),
    }));`);
    assert.equal(rows.length, 11, 'eleven rows');
    assert.deepEqual(rows.map(r => r.key), model.matrix.map(r => r.key), 'in the model\'s order');
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i], exp = model.matrix[i], id = exp.key;
      assert.equal(row.name, exp.label, `${id} label`);
      assert.equal(row.agent, String(exp.agent), `${id} agent`);
      assert.equal(row.cells.length, 4, `${id} has four cells`);
      assert.equal(row.play, exp.play, `${id} plays ${exp.play}`);
      assert.equal(row.playLabel, `Play ${exp.play} in the Scenarios tab`, `${id} ▶ is named`);
      const expectDiffers = seqKey(exp.b.off) !== seqKey(exp.b.on);
      assert.equal(row.differs, expectDiffers, `${id} highlight`);
      if (expectDiffers) assert.ok(row.text.includes('differs'), `${id} says "differs" in text`);
      else assert.ok(!row.text.includes('differs'), `${id} does not claim a difference`);
      ORDER.forEach(([side, runs], ci) => {
        const calls = exp[side][runs], cell = row.cells[ci], at = `${id} ${side} ${runs}`;
        assert.deepEqual(cell.calls, calls.map(glyphOf), `${at} icons`);
        assert.deepEqual(cell.labels, calls.map(labelOf), `${at} accessible names`);
        assert.deepEqual(cell.kinds, calls.map(kindOf), `${at} chip kinds`);
        // The tip must carry the rule id and the engine's reason, or the words "no rule fired".
        cell.tips.forEach((text, k) => {
          const call = calls[k];
          assert.ok(text.includes(call.tool), `${at} tip names the tool`);
          if (call.rules.length) {
            for (const rule of call.rules) assert.ok(text.includes(rule), `${at} tip names ${rule}`);
            for (const reason of call.reasons) assert.ok(text.includes(reason), `${at} tip gives the reason`);
          } else assert.match(text, /no rule fired/, `${at} tip says no rule fired`);
        });
      });
    }
    // Ten of the eleven risky rows change with the slice; TR2 is the one that does not.
    assert.deepEqual(rows.filter(r => r.differs).map(r => r.key), model.matrix
      .filter(r => seqKey(r.b.off) !== seqKey(r.b.on)).map(r => r.key));

    // The block welcomes motion, so the rows fade in once; the end state is fully opaque.
    const motion = await p.ev(`const r=document.querySelector('[data-rt-fgrid-row]');const s=getComputedStyle(r);
      return { reduce: matchMedia('(prefers-reduced-motion: reduce)').matches, anim: s.animationName, opacity: s.opacity };`);
    assert.equal(motion.reduce, false, 'the default is motion on');
    assert.match(motion.anim, /rt-fgrid-in/);

    // Narrow screens: each row stacks (caption visible, header row for screen readers only) and the page keeps still.
    await p.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
    const narrow = await until(async () => {
      const r = await p.ev(`const g=document.querySelector('[data-rt-fgrid]');const b=g.getBoundingClientRect();
        return { shown: !g.closest('[hidden]') && b.width > 0, win: innerWidth, doc: document.documentElement.scrollWidth, body: document.body.scrollWidth,
          rows: document.querySelectorAll('[data-rt-fgrid-row]').length, right: b.right,
          gridScroll: g.scrollWidth, gridClient: g.clientWidth,
          cap: getComputedStyle(g.querySelector('.rt-fgrid-cap')).display,
          head: g.querySelector('.rt-fgrid-head').getBoundingClientRect().height,
          cols: [...document.querySelectorAll('[data-rt-fgrid-row]')][0]
            .querySelectorAll('.rt-fgrid-playcell').length };`);
      return r.doc <= r.win + 1 ? r : null;
    }, 'no horizontal page overflow at 390 px', 15000);
    // The matrix sits in the "All scenarios" sub-tab (logs/2026-10-11_RT_SUBTABS_VISUAL_PLAN.md); a hidden block would pass the
    // geometry checks below vacuously.
    assert.equal(narrow.shown, true, 'the matrix is on screen');
    assert.equal(narrow.rows, 11, 'the rows survive the narrow layout');
    assert.ok(narrow.body <= narrow.win + 1, `body width ${narrow.body} at ${narrow.win}`);
    assert.ok(narrow.right <= narrow.win + 1, `the card ends at ${narrow.right}`);
    assert.ok(narrow.gridScroll <= narrow.gridClient + 1, `the grid does not scroll sideways (${narrow.gridScroll}/${narrow.gridClient})`);
    assert.equal(narrow.cap, 'block', 'each stacked cell shows its own column caption');
    assert.ok(narrow.head <= 2, 'the header row is for screen readers only when stacked');
    assert.equal(narrow.cols, 1, 'the ▶ stays in the row');

    // prefers-reduced-motion: reload the block with the media emulated; it must open straight at its end state.
    await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await open(1400);
    const reduced = await p.ev(`const rows=[...document.querySelectorAll('[data-rt-fgrid-row]')];
      return { reduce: matchMedia('(prefers-reduced-motion: reduce)').matches, rows: rows.length,
        anims: rows.map(r => getComputedStyle(r).animationName),
        opacities: [...new Set(rows.map(r => getComputedStyle(r).opacity))],
        button: getComputedStyle(document.querySelector('[data-rt-fgrid-play]')).transitionDuration };`);
    assert.equal(reduced.reduce, true, 'the page sees the emulated media query');
    assert.equal(reduced.rows, 11, 'the matrix still shows every row');
    assert.deepEqual([...new Set(reduced.anims)], ['none'], 'no motion: the entrance is skipped');
    assert.deepEqual(reduced.opacities, ['1'], 'and every row is already at its end state');
    assert.equal(reduced.button, '0s', 'the ▶ transition is dropped too');
    await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });

    // ▶ TR1: the Scenarios tab is selected and focused, and the run really starts (the status is the live state, not
    // the static scenario list).
    await open(1400);
    await until(() => p.ev('return window.__jevRuntime?.ready === true'), 'the host runtime', 30000);
    await p.ev(`document.querySelector('[data-rt-fgrid-play="TR1b"]').click()`);
    const after = await until(() => p.ev(`const o = {
        tab: document.querySelector('[data-rt-tab="scenarios"]')?.getAttribute('aria-selected') ?? null,
        fleet: document.querySelector('[data-rt-tab="fleet"]')?.getAttribute('aria-selected') ?? null,
        focus: document.activeElement?.id ?? null,
        sel: document.getElementById('rtScenarioSelect')?.value ?? null,
        status: document.getElementById('rtStatus')?.textContent.trim() ?? null };
      o.ok = o.tab === 'true' && o.focus === 'rtTab-scenarios' && o.sel === 'TR1b' && /^(Running|Complete)$/.test(o.status ?? '');
      return o;`), 'the TR1 ▶ plays TR1b in the Scenarios tab', 10000);
    assert.equal(after.tab, 'true', 'the Scenarios tab is selected');
    assert.equal(after.fleet, 'false');
    assert.equal(after.focus, 'rtTab-scenarios', 'focus moved to the Scenarios tab');
    assert.equal(after.sel, 'TR1b', 'the picker holds this row\'s own id');
    assert.match(after.status, /^(Running|Complete)$/, 'the run is actually running, not just listed');

    await new Promise(r => setTimeout(r, 300));
    // Same noise filter as the other headless site tests: favicon, web fonts and certificates are not page errors.
    const errors = p.errors.filter(e => !/favicon|fonts\.(googleapis|gstatic)|ERR_CERT|net::ERR_(INTERNET|NAME)/i.test(String(e)));
    assert.deepEqual(errors, [], 'no page exceptions or console errors');
  } finally {
    session.close();
    await new Promise(r => server.close(r));
  }
});

// Code review r1: the count line names scenarios and traces correctly (11 scenarios, 22 traces, each run two ways).
test('the grid caption counts scenarios and traces from the model', async () => {
  const { fleetModel } = await import('../../js/rt-fleet.js');
  const { mountGrid } = await import('../../js/rt-fleet-grid.js');
  const model = fleetModel({ seed: 7 });
  const el = { innerHTML: '', addEventListener() {}, removeEventListener() {}, querySelectorAll() { return []; }, querySelector() { return null; }, classList: { add() {}, remove() {} } };
  mountGrid(el, model, { tip: () => '', run: () => {} });
  const traces = new Set(model.matrix.flatMap(r => [r.a.id, r.b.id])).size;
  assert.equal(traces, 22);
  assert.match(el.innerHTML, new RegExp(`${model.matrix.length} scenarios, ${traces} scripted traces`));
  assert.doesNotMatch(el.innerHTML, /each run four ways/);
});
