// logs/2026-10-11_RT_SUBTABS_VISUAL_PLAN.md, shared contract 1 and rule 2: the second-level sub-tabs of Agent fleet, Learning
// loop and Ontology. Deep links (cold, with the ontology data held until the test releases it; unknown keys; rapid hash changes), keyboard
// and Next focus, the bind() lifecycle (play once when really shown, pause on any hide, never replay, never under reduced
// motion), stateHash's &sub=, and the honesty notes that must stay visible on their own sub-tab at 1400 and 390 px.
// Local static server + headless Chrome, like rt-fleet.test.mjs; skips when no Chrome binary exists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { browser, until, sleep } from './ontology-card/browser.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
// Every request the Ontology bar waits for (js/rt-ontology.js mounts it once all of them have settled): the measured
// results, and the fleet ontology (loadFleetOntology fetches the pack and the files list; the vision block reads the pack).
const GATED = ['/data/onto-observability.json', '/data/onto-s1.json', '/swm/data/packs/creator-platform.json', '/data/ontology-files.json'];

// The notes each sub-tab must show as visible text (rule 2); `top` ones belong to the tab, whatever its sub-tab.
const NOTES = {
  learning: {
    top: ['#rtLearning .rt-intro p'],
    loop: ['[data-rt-learn-illus]', '[data-rt-learn-loop-claim]', '[data-rt-learn-future]'],
    results: ['[data-rt-learn-measured]', '[data-rt-learn-claim]', '#rtJudgeRealNote'],
  },
  ontology: {
    top: ['#rtOntology .rt-intro .rt-chip[data-kind="ran"]', '[data-rt-onto-nojudge]'],
    how: ['[data-onto-how-claim]', '[data-onto-how-lost]'],
    s1: ['[data-onto-s1-scope]', '[data-onto-s1-observed]'],
    ex: ['[data-onto-ex-claim]'],
    fleet: ['[data-rt-subpanel="fleet"] [data-onto-fleet-grade]', '[data-rt-subpanel="fleet"] [data-onto-fleet-limits]'],
    graph: ['[data-rt-subpanel="graph"] [data-onto-fleet-grade]', '[data-rt-subpanel="graph"] [data-vision-grade]'],
  },
};
const TEXT = {
  '#rtLearning .rt-intro p': /not yet from customer reviewers/,
  '[data-rt-learn-loop-claim]': /reviewer answers \(steps 1–2\) and Promote are not yet tested/,
  '[data-rt-learn-future]': /Future work/,
  '[data-rt-learn-claim]': /benchmark labels, not yet customer reviewers/,
  '[data-rt-onto-nojudge]': /No judge model/,
  '[data-onto-how-claim]': /No judge model/,
  '[data-onto-s1-scope]': /held-out AgentDojo tasks and these models only/,
  '[data-onto-s1-observed]': /Observed, not a guarantee/,
  '[data-onto-ex-claim]': /including the cases where types lose an alert/,
  '[data-rt-subpanel="fleet"] [data-onto-fleet-grade]': /Simulated engine/,
  '[data-rt-subpanel="graph"] [data-onto-fleet-grade]': /Simulated engine/,
  '[data-rt-subpanel="fleet"] [data-onto-fleet-limits]': /not from linking traces at runtime/,
  '[data-rt-subpanel="graph"] [data-vision-grade]': /not the current build/,
};

test('sub-tabs: deep links, keyboard, Next, lifecycle and visible notes', { timeout: 240000 }, async t => {
  let session;
  try { session = await browser(); } catch (e) {
    if (/Chrome not found/.test(e.message)) return t.skip('no Chrome binary (set CHROME); headless check skipped');
    throw e;
  }
  // The gate holds the Ontology bar's data on the server until the test releases it, so "the bar waits for its data"
  // and "a request arrives before the bar exists" are states the test sets up, not races against a fixed delay.
  const gate = { on: false, held: [] };
  const release = (keep = []) => {
    if (!keep.length) gate.on = false;
    for (const h of gate.held.filter(x => !keep.includes(x.path))) h.release();
    gate.held = gate.held.filter(x => keep.includes(x.path));
  };
  const server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      let file = resolve(ROOT, '.' + path);
      if (file !== ROOT && !file.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      if (gate.on && GATED.includes(path)) await new Promise(r => gate.held.push({ path, release: r }));   // held until the test releases it
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(await readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  const p = session.page;
  const ev = code => p.ev(code);
  const Q = JSON.stringify;
  try {
    await new Promise((r, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', r); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const size = width => p.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 });
    // A fresh document each time (a hash-only navigation would reuse the page).
    const go = async hash => { await p.send('Page.navigate', { url: 'about:blank' }); await p.send('Page.navigate', { url: `${origin}/index.html${hash}` }); // While the gate holds data, the load event waits for it too, so a held page is ready once it is interactive.
      await until(() => ev(`return document.readyState === ${gate.on ? '"interactive" || document.readyState === "complete"' : '"complete"'} && !!window.__rtTabs`), 'page ' + hash, 30000); };
    const subOf = tab => ev(`return window.__rtSubnav?.[${Q(tab)}]?.current() ?? null`);
    const shownPanel = tab => ev(`const b = window.__rtSubnav?.[${Q(tab)}]; if (!b) return null; const k = b.current();
      const btn = document.getElementById('rtSub-${tab}-' + k); const panel = document.getElementById(btn.getAttribute('aria-controls'));
      return panel.hidden ? null : k`);
    const hold = () => { gate.on = true; };
    const allHeld = () => until(() => GATED.every(path => gate.held.some(h => h.path === path)), 'every request the ontology bar waits for is held', 30000);
    const arrived = paths => until(() => ev(`return ${Q(paths)}.every(x => performance.getEntriesByName(location.origin + x).length > 0)`), 'released responses arrived', 15000);
    await size(1400);

    // 1. Cold deep link to an Ontology sub-tab while its data is still on the way; the bar applies it when it mounts.
    hold();
    await go('#view=runtime-observation&tab=ontology&sub=ex');
    await allHeld();
    assert.equal(await subOf('ontology'), null, 'the ontology bar waits for its data');
    // Everything but the fleet ontology's files list arrives: the bar still waits, since it mounts only once all have settled.
    const last = '/data/ontology-files.json';
    release([last]);
    await arrived(GATED.filter(x => x !== last));
    assert.equal(await subOf('ontology'), null, 'the ontology bar also waits for the fleet ontology');
    release();
    await until(async () => (await shownPanel('ontology')) === 'ex', 'cold &sub=ex once its data arrives', 15000);
    // An unknown key falls back to the default sub-tab.
    await go('#view=runtime-observation&tab=ontology&sub=nope');
    await until(async () => (await shownPanel('ontology')) === 'how', 'unknown sub falls back to how', 15000);
    // Rapid hash changes before the bar exists: only the latest applies.
    hold();
    await go('#view=runtime-observation&tab=ontology');
    await allHeld();
    await ev(`location.hash = '#view=runtime-observation&tab=ontology&sub=ex'; location.hash = '#view=runtime-observation&tab=ontology&sub=s1'`);
    assert.equal(await subOf('ontology'), null, 'both links arrive before the bar exists');
    release();
    await until(async () => (await shownPanel('ontology')) === 's1', 'latest of two rapid links wins', 15000);
    // Code review r1 (codex 2): a pending request is dropped by any newer view route, and by a link without &sub=.
    hold();
    await go('#view=runtime-observation&tab=ontology&sub=ex');
    await allHeld();
    await ev(`location.hash = '#view=overview'`);
    release();
    await until(() => ev('return !!window.__rtSubnav?.ontology'), 'ontology bar mounts while away', 15000);
    assert.equal(await subOf('ontology'), 'how', 'a newer #view=overview cancels the pending ex request');
    hold();
    await go('#view=runtime-observation&tab=ontology&sub=ex');
    await allHeld();
    await ev(`location.hash = '#view=runtime-observation&tab=ontology'`);
    release();
    await until(async () => (await shownPanel('ontology')) === 'how', 'a link without &sub= replaces the pending ex', 15000);
    // Leaving during the delayed load and coming back to another sub-tab: the sub-tab the route leaves never plays.
    hold();
    await go('#view=runtime-observation&tab=ontology');
    await allHeld();
    await ev(`location.hash = '#view=overview'`);
    release();
    await until(() => ev('return !!window.__rtSubnav?.ontology'), 'ontology bar mounts while away', 15000);
    await ev(`location.hash = '#view=runtime-observation&tab=ontology&sub=s1'`);
    await until(async () => (await shownPanel('ontology')) === 's1', 're-entry lands on s1', 15000);
    await sleep(300);
    const howState = () => ev(`return document.querySelector('#rtOntoHow[data-state], #rtOntoHow [data-state]')?.dataset.state ?? null`);
    assert.equal(await howState(), 'idle', 'how was never on screen, so it never played');
    assert.notEqual(await ev(`return document.querySelector('#rtOntoS1[data-state], #rtOntoS1 [data-state]')?.dataset.state ?? null`), 'idle', 's1 played on its first real show');
    // Fleet renders on first open: its link is also held until the bar exists. Learning's bar exists from load.
    await go('#view=runtime-observation&tab=fleet&sub=scenarios');
    await until(async () => (await shownPanel('fleet')) === 'scenarios', 'fleet &sub=scenarios', 15000);
    await go('#view=runtime-observation&tab=learning&sub=results');
    await until(async () => (await shownPanel('learning')) === 'results', 'learning &sub=results', 15000);

    // 2. Tablist semantics: unique ids, panels labelled by their tab, hints as descriptions, one selected tab.
    for (const tab of ['learning', 'ontology', 'fleet']) {
      if (tab !== 'learning') { await ev(`window.__rtTabs.open(${Q(tab)})`); await until(() => ev(`return !!window.__rtSubnav?.[${Q(tab)}]`), tab + ' bar'); }
      const sem = await ev(`const nav = document.querySelector('#' + ${Q({ learning: 'rtLearning', ontology: 'rtOntology', fleet: 'rtFleetPanel' }[tab])} + ' [role=tablist].rt-subnav');
        const tabs = [...nav.querySelectorAll('[role=tab]')];
        return { n: tabs.length, ids: new Set(tabs.map(b => b.id)).size, selected: tabs.filter(b => b.getAttribute('aria-selected') === 'true').length,
          labelled: tabs.every(b => { const pnl = document.getElementById(b.getAttribute('aria-controls')); return pnl && pnl.getAttribute('role') === 'tabpanel' && pnl.getAttribute('aria-labelledby') === b.id; }),
          described: tabs.every(b => !b.getAttribute('aria-describedby') || !!document.getElementById(b.getAttribute('aria-describedby'))) }`);
      assert.equal(sem.ids, sem.n, tab + ': unique tab ids');
      assert.equal(sem.selected, 1, tab + ': one selected tab');
      assert.equal(sem.labelled, true, tab + ': each panel is a tabpanel labelled by its tab');
      assert.equal(sem.described, true, tab + ': hints are descriptions');
    }

    // 3. Keyboard and Next, at both widths: arrows move selection and focus; Next moves focus to the next tab before hiding.
    for (const width of [1400, 390]) {
      await size(width);
      await ev(`window.__rtTabs.open('learning'); window.__rtSubnav.learning.open('loop'); document.getElementById('rtSub-learning-loop').focus()`);
      for (const type of ['keyDown', 'keyUp']) await p.send('Input.dispatchKeyEvent', { type, key: 'ArrowRight', code: 'ArrowRight' });
      assert.equal(await ev('return window.__rtSubnav.learning.current() + "|" + document.activeElement.id'), 'results|rtSub-learning-results', width + ': ArrowRight');
      for (const type of ['keyDown', 'keyUp']) await p.send('Input.dispatchKeyEvent', { type, key: 'Home', code: 'Home' });
      assert.equal(await ev('return window.__rtSubnav.learning.current() + "|" + document.activeElement.id'), 'loop|rtSub-learning-loop', width + ': Home');
      await ev(`document.querySelector('#rtLearning [data-rt-subpanel="loop"] [data-rt-sub-next]').click()`);
      assert.equal(await ev('return window.__rtSubnav.learning.current() + "|" + document.activeElement.id'), 'results|rtSub-learning-results', width + ': Next focuses the next tab');
      assert.ok(await ev('return document.documentElement.scrollWidth <= innerWidth + 1'), width + ': no horizontal page scroll with the bar');
    }
    await size(1400);

    // 4. stateHash: leaving through an in-page route records the sub-tab, so Back returns to it.
    await ev(`window.__rtTabs.open('fleet')`); await until(() => ev('return !!window.__rtSubnav?.fleet'), 'fleet bar');
    await ev(`window.__rtSubnav.fleet.open('agents')`);
    await ev(`const a = document.createElement('a'); a.href = '#'; a.dataset.wmRoute = '#view=overview'; document.body.append(a); a.click(); a.remove()`);
    await until(() => ev('return location.hash === "#view=overview"'), 'routed away');
    await ev('history.back()');
    await until(() => ev('return location.hash'), 'back').then(async () => assert.equal(await ev('return location.hash'), '#view=runtime-observation&tab=fleet&sub=agents'));

    // 5. Lifecycle on a standalone bar (outside any view or tab, so "shown" = current): play once, pause on hide, no replay.
    const life = await ev(`const { mountSubnav } = await import('/js/rt-subnav.js');
      const box = document.createElement('div'); box.innerHTML = '<nav></nav><div><div data-rt-subpanel="a"></div><div data-rt-subpanel="b"></div></div>';
      document.body.append(box);
      const log = [];
      const bar = mountSubnav(box.firstChild, { tab: 'probe', label: 'probe', initial: 'a', panels: box.lastChild, items: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }] });
      bar.bind('a', { play: () => log.push('play a'), pause: () => log.push('pause a') });
      bar.bind('b', { play: () => log.push('play b'), pause: () => log.push('pause b') });
      bar.open('b'); bar.open('a'); bar.open('b');
      bar.destroy(); box.remove();
      return log`);
    assert.deepEqual(life, ['play a', 'pause a', 'play b', 'pause b', 'pause a'], 'play once on first show, pause on every hide, never replay');
    // Real bar: leaving the Runtime Observation view (rt:view) stops the fleet's guided demo; coming back does not replay it.
    await go('#view=runtime-observation&tab=fleet');
    await until(() => ev('return document.querySelector("[data-rt-fx1]")?.dataset.state === "playing"'), 'the X1 demo plays on first show');
    await ev(`document.querySelector('button[data-view="overview"]').click()`);
    await sleep(300);
    assert.notEqual(await ev('return document.querySelector("[data-rt-fx1]").dataset.state'), 'playing', 'leaving the view pauses it');
    const before = await ev('return document.querySelector("[data-rt-fx1]").dataset.mode + "/" + document.querySelector("[data-rt-fx1]").dataset.state');
    await ev(`document.querySelector('button[data-view="runtime-observation"]').click()`);
    await sleep(2500);
    assert.equal(await ev('return document.querySelector("[data-rt-fx1]").dataset.mode + "/" + document.querySelector("[data-rt-fx1]").dataset.state'), before, 'coming back does not replay');
    // Reduced motion: bind never calls play.
    await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    const reduced = await ev(`const { mountSubnav } = await import('/js/rt-subnav.js');
      const box = document.createElement('div'); box.innerHTML = '<nav></nav><div><div data-rt-subpanel="a"></div></div>'; document.body.append(box);
      const log = []; const bar = mountSubnav(box.firstChild, { tab: 'probe2', label: 'probe', panels: box.lastChild, items: [{ key: 'a', label: 'A' }] });
      bar.bind('a', { play: () => log.push('play'), pause: () => {} }); bar.destroy(); box.remove(); return log`);
    assert.deepEqual(reduced, [], 'no play under reduced motion');
    await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });

    // 6. Visible notes per sub-tab (rule 2), at 1400 and 390 px.
    await go('#view=runtime-observation&tab=learning');
    await until(() => ev('return !!document.querySelector("#rtJudgeRealNote") && !!window.__rtSubnav?.ontology'), 'learning and ontology rendered', 15000);
    for (const width of [1400, 390]) {
      await size(width);
      for (const [tab, subs] of Object.entries(NOTES)) {
        await ev(`window.__rtTabs.open(${Q(tab)})`);
        for (const [sub, sels] of Object.entries(subs)) {
          if (sub === 'top') continue;
          await ev(`window.__rtSubnav[${Q(tab)}].open(${Q(sub)})`);
          for (const sel of [...subs.top, ...sels]) {
            const r = await ev(`const els = [...document.querySelectorAll(${Q(sel)})];
              return { n: els.length, ok: els.length > 0 && els.every(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && !e.closest('.rt-tip-body') && !e.closest('details:not([open])'); }),
                text: els.map(e => e.innerText).join(' ') }`);
            assert.equal(r.ok, true, `${width}px ${tab}/${sub}: ${sel} visible (${r.n})`);
            if (TEXT[sel]) assert.match(r.text, TEXT[sel], `${width}px ${tab}/${sub}: ${sel} text`);
          }
          if (tab === 'learning' && sub === 'results') {
            const note = await ev('return document.querySelector("#rtJudgeRealNote").innerText');
            assert.match(note, /0\.\d{3}[\s\S]*0\.\d{3}/, 'both AUROCs are on screen');
          }
          assert.ok(await ev('return document.documentElement.scrollWidth <= innerWidth + 1'), `${width}px ${tab}/${sub}: no horizontal page scroll`);
        }
      }
    }
    const errors = p.errors.filter(e => !/favicon|fonts\.(googleapis|gstatic)|ERR_CERT_AUTHORITY_INVALID/.test(e));
    assert.deepEqual(errors, [], 'no page exceptions or console errors');
  } finally {
    session.close();
    await new Promise(r => server.close(r));
  }
});
