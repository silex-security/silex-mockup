// Scenario Expansion ① "Expand one attack" (js/sx-expand.js; logs/2026-10-11_SCENARIO_EXPANSION_PLAN.md, task T1).
// Pure: the timeline lasts 6-9 s and the module mounts without a DOM at import. Headless: every displayed count equals
// the model, each gate strikes exactly its first-violation tiles, every axis shows its tier and operation, the
// animation plays to done, Pause freezes it, Replay restarts it, reduced motion shows the end state at once with no
// running animations, 390 px has no horizontal page overflow, and the page logs no errors. Set SX_SHOT_PREFIX to save
// 1400 px and 390 px screenshots of the done state as <prefix>-1400.png and <prefix>-390.png.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { withPage, until, sleep } from './sx-harness.mjs';
import { sxModel } from '../../js/sx-view.js';
import { timeline } from '../../js/sx-expand.js';

const model = sxModel();
const Q = JSON.stringify;
const ROOT = '#scenario-expansion [data-sx="expand"]';

test('the expansion timeline lasts 6-9 seconds, stages in order', () => {
  const T = timeline(model);
  assert.ok(T.total >= 6000 && T.total <= 9000, `total ${T.total} ms`);
  const order = [T.seed, T.axes, T.wall, ...T.gate, T.classes, T.chain, T.total];
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.equal(T.gate.length, model.CONSTRAINTS.length);
});

test('① Expand one attack: counts, stages, controls, reduced motion and layout', { timeout: 240000 }, async t => {
  await withPage(t, async ({ ev, go, size, reducedMotion, overflow, errors, page }) => {
    const state = () => ev(`return document.querySelector(${Q(ROOT)})?.dataset.state`);
    const progress = () => ev(`const r = document.querySelector(${Q(ROOT)});
      return r.querySelectorAll('.on').length + ' ' + r.querySelectorAll('.sx-ex-tile.x').length`);
    const shot = async name => {
      const prefix = process.env.SX_SHOT_PREFIX;
      if (!prefix) return;
      // A viewport as tall as the page, so sticky and fixed parts are drawn where they sit, not over the panel.
      const w = await ev('return innerWidth');
      await size(w, await ev('return document.documentElement.scrollHeight'));
      const r = await ev(`scrollTo(0, 0); await new Promise(r => setTimeout(r, 200)); const b = document.querySelector(${Q(ROOT)}).getBoundingClientRect();
        return { x: 0, y: Math.max(0, b.top - 16), width: innerWidth, height: b.height + 32 }`);
      const { data } = await page.send('Page.captureScreenshot', { format: 'png', clip: { ...r, scale: 1 } });
      await size(w, w < 600 ? 900 : 1000);
      await writeFile(`${prefix}-${name}.png`, Buffer.from(data, 'base64'));
    };

    // The sub-tab bar plays ① on its first show; it runs and then settles at done.
    await go('#view=scenario-expansion');
    await until(async () => (await state()) === 'playing', 'plays on first show');
    await until(async () => (await state()) === 'done', 'reaches done', 15000);

    // Every displayed count equals the model.
    const want = {
      all: model.all.length, ...model.removedBy, ...model.byClass, valid: model.valid.length,
      labRuns: model.labRuns.length, overlays: model.overlays, derivatives: model.derivatives,
    };
    const shown = await ev(`return [...document.querySelectorAll(${Q(ROOT + ' [data-sx-count]')})].map(e => [e.dataset.sxCount, e.textContent])`);
    assert.deepEqual(Object.fromEntries(shown), Object.fromEntries(Object.entries(want).map(([k, n]) => [k, String(n)])));
    assert.equal(shown.length, Object.keys(want).length, 'each count shown once');

    // Stages, in order; each gate strikes exactly the tiles whose first violation it is; the survivors are classed.
    const stages = await ev(`return [...document.querySelectorAll(${Q(ROOT + ' [data-sx-stage]')})].map(e => e.dataset.sxStage)`);
    assert.deepEqual(stages, ['seed', 'axes', 'wall', 'gates', ...model.CONSTRAINTS.map(c => 'gate-' + c.id), 'classes', 'chain']);
    assert.equal(await ev(`return document.querySelectorAll(${Q(ROOT + ' .sx-ex-tiles .sx-ex-tile')}).length`), model.all.length);
    for (const c of model.CONSTRAINTS) {
      assert.equal(await ev(`return document.querySelectorAll(${Q(ROOT + ` .sx-ex-tile.x[data-by="${c.id}"]`)}).length`), model.removedBy[c.id], c.id);
    }
    assert.equal(await ev(`return document.querySelectorAll(${Q(ROOT + ' .sx-ex-tiles .sx-ex-tile.x')}).length`), model.all.length - model.valid.length);
    for (const [k, n] of Object.entries(model.byClass)) {
      assert.equal(await ev(`return document.querySelectorAll(${Q(ROOT + ` .sx-ex-class[data-cls="${k}"] .sx-ex-tile.on`)}).length`), n, k);
    }

    // The seed and the five axes: tier and operation badges, value hints in tips.
    const seedText = await ev(`return document.querySelector(${Q(ROOT + ' [data-sx-stage="seed"]')}).textContent`);
    for (const s of [model.SEED.title, model.SEED.technique.id, model.SEED.technique.name, 'j.doe', model.SEED.share, String(model.SEED.reads)]) assert.ok(seedText.includes(s), s);
    for (const a of model.AXES) {
      const ax = await ev(`const e = document.querySelector(${Q(ROOT + ` [data-sx-axis="${a.key}"]`)});
        return { tier: e.querySelector('[data-sx-tier]').textContent, op: e.querySelector('[data-sx-op]').firstChild.textContent,
          tips: [...e.querySelectorAll('li .rt-tip-body')].map(b => b.textContent), opTip: e.querySelector('[data-sx-op] .rt-tip-body').textContent }`);
      assert.equal(ax.tier, model.TIERS.find(x => x.id === a.tier).label, a.key);
      assert.equal(ax.op, model.OPS[a.op].label, a.key);
      assert.equal(ax.opTip, model.OPS[a.op].hint);
      assert.deepEqual(ax.tips, a.values.map(x => x.hint));
    }
    const text = await ev(`return document.querySelector(${Q(ROOT)}).textContent`);
    assert.match(text, /pending expert review/);
    assert.match(text, /None of this has run in a lab yet/);
    assert.ok(text.includes(model.GRADE) && text.includes(model.ONTOLOGY_VERSION), 'grade and ontology version shown');
    assert.doesNotMatch(text, /\b(pass|passed|certified|safe|guaranteed)\b/i);
    await shot('1400');

    // Replay restarts from stage 1; Pause freezes; Play resumes to done. The controls are buttons (keyboard reachable).
    await ev(`document.querySelector(${Q(ROOT + ' [data-sx-replay]')}).click()`);
    assert.equal(await state(), 'playing');
    assert.equal(await ev(`return document.querySelector(${Q(ROOT + ' [data-sx-stage="chain"]')}).classList.contains('on')`), false, 'replay starts over');
    await sleep(1200);
    await ev(`document.querySelector(${Q(ROOT + ' [data-sx-play]')}).click()`);
    assert.equal(await state(), 'paused');
    assert.equal(await ev(`return document.querySelector(${Q(ROOT + ' [data-sx-play]')}).textContent`), 'Play');
    const before = await progress();
    await sleep(1100);
    assert.equal(await progress(), before, 'no progress while paused');
    assert.equal(await state(), 'paused');
    await ev(`document.querySelector(${Q(ROOT + ' [data-sx-play]')}).click()`);
    assert.equal(await state(), 'playing');
    await until(async () => (await state()) === 'done', 'resumes to done', 15000);

    // Reduced motion before load: the first show is already done, with no running animations and no timers.
    await reducedMotion(true);
    await go('#view=scenario-expansion');
    assert.equal(await state(), 'done');
    assert.equal(await ev(`const r = document.querySelector(${Q(ROOT)});
      return document.getAnimations().filter(a => a.playState === 'running' && r.contains(a.effect?.target)).length`), 0);
    assert.equal(await ev(`return document.querySelector(${Q(ROOT + ' [data-sx-stage="chain"]')}).classList.contains('on')`), true);
    await reducedMotion(false);

    // 390 px: no horizontal page overflow.
    await size(390, 900);
    await go('#view=scenario-expansion');
    await until(async () => (await state()) === 'done', 'done at 390 px', 15000);
    const o = await overflow();
    assert.ok(o.doc <= o.win, `page ${o.doc}px wide in a ${o.win}px window`);
    await shot('390');

    assert.deepEqual(errors(), [], 'no page exceptions or console errors');
  });
});
