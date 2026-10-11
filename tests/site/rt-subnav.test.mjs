// logs/2026-10-11_RT_SUBTABS_VISUAL_PLAN.md, shared contract 1 and rule 2: the second-level sub-tabs of Agent fleet, Learning
// loop and Ontology. Deep links (cold, with the ontology data held back 1.5 s; unknown keys; rapid hash changes), keyboard
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
const SLOW = '/data/onto-observability.json';

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
};

test('sub-tabs: deep links, keyboard, Next, lifecycle and visible notes', { timeout: 240000 }, async t => {
  let session;
  try { session = await browser(); } catch (e) {
    if (/Chrome not found/.test(e.message)) return t.skip('no Chrome binary (set CHROME); headless check skipped');
    throw e;
  }
  const server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      let file = resolve(ROOT, '.' + path);
      if (file !== ROOT && !file.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      if (path === SLOW) await sleep(1500);   // the ontology bar mounts only after this arrives
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
    const go = async hash => { await p.send('Page.navigate', { url: 'about:blank' }); await p.send('Page.navigate', { url: `${origin}/index.html${hash}` }); await until(() => ev('return document.readyState === "complete" && !!window.__rtTabs'), 'page ' + hash, 30000); };
    const subOf = tab => ev(`return window.__rtSubnav?.[${Q(tab)}]?.current() ?? null`);
    const shownPanel = tab => ev(`const b = window.__rtSubnav?.[${Q(tab)}]; if (!b) return null; const k = b.current();
      const btn = document.getElementById('rtSub-${tab}-' + k); const panel = document.getElementById(btn.getAttribute('aria-controls'));
      return panel.hidden ? null : k`);
    await size(1400);

    // 1. Cold deep link to an Ontology sub-tab while its data is still on the way; the bar applies it when it mounts.
    await go('#view=runtime-observation&tab=ontology&sub=ex');
    assert.equal(await subOf('ontology'), null, 'the ontology bar waits for its data');
    await until(async () => (await shownPanel('ontology')) === 'ex', 'cold &sub=ex after the delayed fetch', 15000);
    // An unknown key falls back to the default sub-tab.
    await go('#view=runtime-observation&tab=ontology&sub=nope');
    await until(async () => (await shownPanel('ontology')) === 'how', 'unknown sub falls back to how', 15000);
    // Rapid hash changes before the bar exists: only the latest applies.
    await go('#view=runtime-observation&tab=ontology');
    await ev(`location.hash = '#view=runtime-observation&tab=ontology&sub=ex'; location.hash = '#view=runtime-observation&tab=ontology&sub=s1'`);
    await until(async () => (await shownPanel('ontology')) === 's1', 'latest of two rapid links wins', 15000);
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
