// logs/2026-10-11_FLEET_ONTOLOGY_GRAPH_PLAN.md, amendment v0.4/v0.5, task T5: the Vision block at the top of Graph & files
// (js/rt-onto-vision.js). Pure: today/vision statuses are decided against the pack, and the trace fields come from the
// engine's X1Bb call. Headless via tests/site/sx-harness.mjs: grade line visible; today nodes name pack classes or teams
// (at least six); every edge endpoint is a node; every today edge is a pack edge (at least four), and every edge whose
// predicate is not a pack predicate is vision; the trace-only fields are the X1Bb call's arguments; rendered labels are
// at least 11 px at 1400 and 390 px; it switches once to the ontology view on first show; switch A hides and shows ring 1;
// switch B fades ring 2 and not ring 1; reduced motion before a cold deep link shows the ontology view with nothing
// running; at 390 px the sketch scrolls inside its card and the page never scrolls sideways; no page errors.
// Set ONTO_VISION_SHOT_PREFIX to save <prefix>-1400.png and <prefix>-390.png (ontology view, focus "This decision").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { withPage, until, ROOT } from './sx-harness.mjs';
import { visionGraph, traceCall, NODES, EDGES, GRADE } from '../../js/rt-onto-vision.js';
import { scenarioById } from '../../jev-runtime/demo/js/engine/scenarios.js';
import { PACK_PATH } from '../../js/rt-onto-fleet-model.js';

const Q = JSON.stringify;
const pack = JSON.parse(readFileSync(join(ROOT, PACK_PATH), 'utf8'));
const packIds = new Set([...pack.classes.map(c => c.id), ...pack.teams.map(t => t.id)]);
const packEdges = new Set(pack.edges.map(e => `${e.s}|${e.p}|${e.o}`));
const ROOT_SEL = '#rtOntology [data-rt-subpanel="graph"] [data-onto-vision]';
const X1BB = scenarioById('X1Bb').spans.find(sp => sp.boundary === 'pre_tool');

test('vision statuses come from the pack; the trace call is the engine\'s X1Bb call', () => {
  const g = visionGraph(pack);
  const by = new Map(g.nodes.map(n => [n.id, n]));
  for (const n of g.nodes) assert.equal(n.status === 'today', !!n.pack && packIds.has(n.pack), n.id);
  for (const e of g.edges) {
    const triple = `${by.get(e.s).pack}|${e.p}|${by.get(e.o).pack}`;
    assert.equal(e.status === 'today', packEdges.has(triple), `${e.s} ${e.p} ${e.o}`);
  }
  assert.deepEqual(g.edges.filter(e => e.status === 'today').map(e => e.p).sort(), ['EXCLUDES', 'FEATURES', 'LICENSED_UNDER', 'OWNED_BY_TEAM', 'SYNCS_TO']);
  for (const p of ['USES', 'CHARGES', 'DELEGATES_AUTHORITY', 'GATES', 'COVERS']) {
    assert.ok(g.edges.filter(e => e.p === p).every(e => e.status === 'vision'), `${p} is vision`);
  }
  assert.equal(by.get('refunds').status, 'today');
  assert.equal(by.get('payroll').status, 'vision');
  assert.equal(new Set(NODES.map(n => n.id)).size, NODES.length);
  for (const e of EDGES) assert.ok(by.has(e.s) && by.has(e.o));
  // Without a pack, nothing is today.
  assert.ok(visionGraph(null).nodes.every(n => n.status === 'vision'));
  assert.deepEqual(traceCall(), { tool: X1BB.tool.name, agent: X1BB.agent, args: X1BB.tool.args });
  // Labels the engine or the pack can give are built from them, not typed.
  const label = id => g.nodes.find(n => n.id === id).label;
  assert.equal(label('video'), `Video ${X1BB.tool.args.video_id}`);
  assert.equal(label('action'), `Ad Buyer · ${pack.classes.find(c => c.id === 'pack:ActionLaunchCampaign').label.replace(/^./, c => c.toLowerCase())}`);
  assert.equal(label('team'), pack.teams.find(t => t.id === 'team:trust-safety').label);
});

test('Graph & files · the vision block in the page', { timeout: 240000 }, async t => {
  await withPage(t, async ({ ev, go, size, reducedMotion, overflow, errors, page }) => {
    const q = (sel, expr) => ev(`const r = document.querySelector(${Q(ROOT_SEL)}); return (${expr})(r, r?.querySelectorAll(${Q(sel)}))`);
    const view = () => ev(`return document.querySelector(${Q(ROOT_SEL)})?.dataset.view ?? null`);
    const click = sel => ev(`document.querySelector(${Q(ROOT_SEL + ' ' + sel)}).click()`);
    const style = (sel, prop) => ev(`return [...document.querySelectorAll(${Q(ROOT_SEL + ' ' + sel)})].map(e => getComputedStyle(e)[${Q(prop)}])`);
    const labelsPx = () => ev(`const svg = document.querySelector(${Q(ROOT_SEL + ' svg')}); const k = svg.getScreenCTM().a;
      return [...svg.querySelectorAll('text')].map(t => ({ t: t.textContent, px: parseFloat(getComputedStyle(t).fontSize) * k }))`);
    const shot = async name => {
      const prefix = process.env.ONTO_VISION_SHOT_PREFIX;
      if (!prefix) return;
      const w = await ev('return innerWidth');
      await size(w, await ev('return document.documentElement.scrollHeight'));
      const r = await ev(`scrollTo(0, 0); await new Promise(r => setTimeout(r, 700)); const b = document.querySelector(${Q(ROOT_SEL)}).getBoundingClientRect();
        return { x: 0, y: Math.max(0, b.top - 16), width: innerWidth, height: b.height + 32 }`);
      const { data } = await page.send('Page.captureScreenshot', { format: 'png', clip: { ...r, scale: 1 } });
      writeFileSync(`${prefix}-${name}.png`, Buffer.from(data, 'base64'));
      await size(w, 1000);
    };

    // Waits for a condition on computed styles (transitions finish in their own time under load) instead of sleeping.
    const settle = (sel, prop, ok, label) => until(async () => { const v = await style(sel, prop); return v.length > 0 && v.every(ok); }, label, 15000);

    // Every change of the block's data-view, recorded from the start of each page load, so the one-time switch is
    // observed rather than raced: each entry is the value before the change and when it changed.
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__vzLog = [];
      new MutationObserver(ms => { for (const m of ms) if (m.target.matches?.('[data-onto-vision]')) window.__vzLog.push({ old: m.oldValue, at: performance.now() }); })
        .observe(document, { subtree: true, attributes: true, attributeFilter: ['data-view'], attributeOldValue: true });` });
    /** The sequence of views the block showed (consecutive repeats merged) and the times each was set. */
    const viewLog = () => ev(`const log = window.__vzLog, now = document.querySelector(${Q(ROOT_SEL)})?.dataset.view;
      const seq = log.map((e, i) => ({ v: i + 1 < log.length ? log[i + 1].old : now, at: e.at }));
      return { first: log[0]?.old ?? null, seq: seq.filter((e, i) => i === 0 || e.v !== seq[i - 1].v) }`);

    // Cold deep link: the block is the first thing in Graph & files; it opens on the trace view, then switches once.
    await go('#view=runtime-observation&tab=ontology&sub=graph');
    await until(() => ev(`return !!document.querySelector(${Q(ROOT_SEL)})`), 'vision mounted', 15000);
    assert.equal(await ev('return document.querySelector(\'#rtOntology [data-rt-subpanel="graph"]\').firstElementChild.matches("[data-onto-vision-mount]")'), true);
    await until(async () => (await view()) === 'onto', 'switches once to the ontology view', 15000);
    const log = await viewLog();
    assert.equal(log.first, 'trace', 'the block is rendered on the trace view');
    assert.deepEqual(log.seq.map(e => e.v), ['trace', 'onto'], 'trace, then the ontology view, exactly once');
    assert.ok(log.seq[1].at - log.seq[0].at >= 1000, `the trace view stayed on screen before the switch (${Math.round(log.seq[1].at - log.seq[0].at)} ms)`);

    // Grade line.
    const grade = await q('[data-vision-grade]', r => { const g = r.querySelector('[data-vision-grade]'); const b = g.getBoundingClientRect(); return { text: g.innerText, shown: b.width > 0 && b.height > 0, chip: g.querySelector('.rt-chip[data-kind="sim"]')?.textContent }; });
    assert.ok(grade.shown);
    assert.match(grade.text, /not the current build/);
    assert.ok(grade.text.includes(GRADE));
    assert.equal(grade.chip, 'Illustration');

    // Nodes and edges against the pack.
    const nodes = await ev(`return [...document.querySelectorAll(${Q(ROOT_SEL + ' [data-vision-node]')})].map(e => ({ id: e.dataset.visionNode, status: e.dataset.status, ring: e.dataset.ring, pack: e.dataset.packId ?? null }))`);
    const today = nodes.filter(n => n.status === 'today');
    assert.ok(today.length >= 6, `${today.length} today nodes`);
    for (const n of today) assert.ok(packIds.has(n.pack), `${n.id}: ${n.pack} is a pack class or team`);
    for (const n of nodes.filter(x => x.status === 'vision')) assert.equal(n.pack, null, `${n.id} has no pack id`);
    assert.deepEqual([...new Set(nodes.map(n => n.ring))].sort(), ['0', '1', '2']);
    const byId = new Map(nodes.map(n => [n.id, n]));
    const edges = await ev(`return [...document.querySelectorAll(${Q(ROOT_SEL + ' [data-vision-edge]')})].map(e => ({ s: e.dataset.s, o: e.dataset.o, p: e.dataset.p, status: e.dataset.status }))`);
    const preds = new Set(Object.keys(pack.predicates));
    for (const e of edges) {
      assert.ok(byId.has(e.s) && byId.has(e.o), `${e.s} ${e.p} ${e.o}: endpoints are nodes`);
      if (e.status === 'today') assert.ok(packEdges.has(`${byId.get(e.s).pack}|${e.p}|${byId.get(e.o).pack}`), `${e.s} ${e.p} ${e.o} is a pack edge`);
      if (!preds.has(e.p)) assert.equal(e.status, 'vision', `${e.p} is not a pack predicate`);
    }
    assert.ok(edges.filter(e => e.status === 'today').length >= 4);

    // The trace-only fields are the X1Bb call's arguments.
    const fields = await ev(`return [...document.querySelectorAll(${Q(ROOT_SEL + ' [data-vision-field]')})].map(e => [e.dataset.visionField, e.textContent])`);
    assert.deepEqual(fields.map(f => f[0]), Object.keys(X1BB.tool.args));
    for (const [k, text] of fields) assert.equal(text, `${k}: ${X1BB.tool.args[k]}`);

    // Switch A: the trace view hides ring 1 and shows the questions; the ontology view brings ring 1 back.
    await click('button[data-vision-view="trace"]');
    await settle('.rt-vz-node[data-ring="1"]', 'visibility', v => v === 'hidden', 'trace: ring 1 hidden');
    await settle('[data-vision-question]', 'visibility', v => v === 'visible', 'trace: questions shown');
    assert.equal(await ev(`return document.querySelectorAll(${Q(ROOT_SEL + ' [data-vision-question]')}).length`), 4);
    await click('button[data-vision-view="onto"]');
    await settle('.rt-vz-node[data-ring="1"]', 'visibility', v => v === 'visible', 'onto: ring 1 visible');
    await settle('.rt-vz-node[data-ring="1"]', 'opacity', v => Number(v) === 1, 'onto: ring 1 opaque');
    await settle('[data-vision-question]', 'visibility', v => v === 'hidden', 'onto: questions hidden');
    assert.equal(await ev(`return document.querySelector(${Q(ROOT_SEL + ' button[data-vision-view="onto"]')}).getAttribute('aria-pressed')`), 'true');

    // Switch B: this decision fades ring 2, not ring 1; the caption is on screen.
    await click('button[data-vision-focus="local"]');
    await settle('.rt-vz-node[data-ring="2"]', 'opacity', v => Number(v) < 0.3, 'local: ring 2 faded');
    assert.ok((await style('.rt-vz-node[data-ring="1"]', 'opacity')).every(v => Number(v) === 1), 'local: ring 1 kept');
    assert.match(await ev(`return document.querySelector(${Q(ROOT_SEL + ' [data-vision-caption]')}).innerText`), /Not deleting the world; choosing the context this one step needs\./);
    await click('button[data-vision-focus="all"]');
    await settle('.rt-vz-node[data-ring="2"]', 'opacity', v => Number(v) === 1, 'all: ring 2 at full weight');

    // The four steps, each tagged.
    const steps = await ev(`return [...document.querySelectorAll(${Q(ROOT_SEL + ' [data-vision-step]')})].map(e => ({ status: e.dataset.status, tag: e.querySelector('.rt-vz-tag').textContent }))`);
    assert.equal(steps.length, 4);
    for (const s of steps) assert.match(s.tag, s.status === 'today' ? /^today · simulated on this site/ : /^vision$/);
    assert.doesNotMatch(await ev(`return document.querySelector(${Q(ROOT_SEL + ' .rt-vz-steps')}).innerText.replace(/^\\d+$/gm, '')`), /\d/, 'no numbers in the steps beyond their order');

    // Labels at least 11 px as rendered, at 1400 px.
    for (const l of await labelsPx()) assert.ok(l.px >= 11, `1400 px: "${l.t}" at ${l.px.toFixed(1)} px`);
    let o = await overflow();
    assert.ok(o.doc <= o.win, `1400 px: page ${o.doc}px wide`);
    await click('button[data-vision-focus="local"]');
    await shot('1400');

    // 390 px: the page never scrolls sideways; the sketch scrolls inside its card; labels stay readable.
    await size(390, 1000);
    await go('#view=runtime-observation&tab=ontology&sub=graph');
    await until(async () => (await view()) === 'onto', 'ontology view at 390 px', 15000);
    o = await overflow();
    assert.ok(o.doc <= 390 && o.win <= 390, `390 px: page ${o.doc}px wide in a ${o.win}px window`);
    const sc = await ev(`const s = document.querySelector(${Q(ROOT_SEL + ' .rt-vz-scroll')}); return { sw: s.scrollWidth, cw: s.clientWidth }`);
    assert.ok(sc.sw > sc.cw, `the sketch scrolls inside its card (${sc.sw} > ${sc.cw})`);
    for (const l of await labelsPx()) assert.ok(l.px >= 11, `390 px: "${l.t}" at ${l.px.toFixed(1)} px`);
    await click('button[data-vision-focus="local"]');
    await shot('390');

    // Leaving Graph & files before the automatic switch settles it on the ontology view, so a return never finds the trace
    // view. The probe runs in the page from the bar's first rt:sub, on a zero-delay timer queued before the bar binds and
    // plays the block, so the 1.4 s switch is always still pending when it leaves.
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `if ((() => { try { return sessionStorage.getItem('vzPauseProbe'); } catch { return null; } })()) {   // about:blank has no storage
      sessionStorage.removeItem('vzPauseProbe');
      document.addEventListener('rt:sub', function once(e) {
        if (e.detail?.tab !== 'ontology') return; document.removeEventListener('rt:sub', once);
        setTimeout(() => { const r = document.querySelector(${Q(ROOT_SEL)}), bar = window.__rtSubnav.ontology;
          const before = r.dataset.view; bar.open('fleet'); const away = r.dataset.view; bar.open('graph');
          window.__vzPause = { before, away, back: r.dataset.view }; }, 0);
      });
    }` });
    await ev(`sessionStorage.setItem('vzPauseProbe', '1')`);
    await go('#view=runtime-observation&tab=ontology&sub=graph');
    const paused = await until(() => ev('return window.__vzPause ?? null'), 'pause probe ran', 15000);
    assert.deepEqual(paused, { before: 'trace', away: 'onto', back: 'onto' }, 'leaving mid-way settles the switch on the ontology view');
    assert.deepEqual((await viewLog()).seq.map(e => e.v), ['trace', 'onto'], 'and it switches exactly once');
    // A view the visitor picked by hand is kept across leaving and coming back.
    await click('button[data-vision-view="trace"]');
    await ev(`window.__rtSubnav.ontology.open('fleet'); window.__rtSubnav.ontology.open('graph')`);
    assert.equal(await view(), 'trace', 'a hand-picked view survives leaving the sub-tab');

    // Reduced motion before a cold deep link: the ontology view at once, nothing running.
    await size(1400);
    await reducedMotion(true);
    await go('#view=runtime-observation&tab=ontology&sub=graph');
    await until(() => ev(`return !!document.querySelector(${Q(ROOT_SEL)})`), 'vision mounted under reduced motion', 15000);
    assert.equal(await view(), 'onto');
    assert.equal(await ev(`const r = document.querySelector(${Q(ROOT_SEL)});
      return document.getAnimations().filter(a => a.playState === 'running' && r.contains(a.effect?.target)).length`), 0);
    await click('button[data-vision-focus="local"]');
    assert.equal(await ev(`const r = document.querySelector(${Q(ROOT_SEL)});
      return document.getAnimations().filter(a => a.playState === 'running' && r.contains(a.effect?.target)).length`), 0, 'no transitions under reduced motion');
    await reducedMotion(false);

    assert.deepEqual(errors(), [], 'no page exceptions or console errors');
  });
});
