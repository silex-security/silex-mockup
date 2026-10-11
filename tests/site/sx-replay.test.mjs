// Scenario Expansion ③ "Replay one variant" (js/sx-replay.js; logs/2026-10-11_SCENARIO_EXPANSION_PLAN.md, task T3).
// Headless: the default is the seed; the step count equals the trace for the seed and for an observation-removal
// variant; provenance shows the execution, context and removal, and the parent button selects the parent; a pruned
// combination picked in the selects shows its constraints and never plays; select() stops, restarts at step 0 and
// reaches done; the verdict and both checks match the model; a finding's Replay ▶ in ② lands here and plays; reduced
// motion renders done with no running animations; 390 px has no page overflow; no console errors. Set SX_SHOT_PREFIX
// to save 1400 px and 390 px screenshots of an observation-removal variant as <prefix>-1400.png and <prefix>-390.png.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { withPage, until, sleep } from './sx-harness.mjs';
import { sxModel } from '../../js/sx-view.js';
import { trace, checks, variantId, violations, WANT } from '../../js/sx-model.js';

const model = sxModel();
const Q = JSON.stringify;
const ROOT = '#scenario-expansion [data-sx="replay"]';
const SEED_ID = variantId(model.SEED.values);
const ABLATED = { ...model.SEED.values, logs: 'partial' };
const ABLATED_ID = variantId(ABLATED);
const byId = id => model.all.find(x => x.id === id);

test('③ Replay one variant: picker, provenance, graph, steps, verdict and layout', { timeout: 240000 }, async t => {
  await withPage(t, async ({ ev, go, size, reducedMotion, overflow, errors, page }) => {
    const q = (sel, expr = 'e => e') => ev(`const e = document.querySelector(${Q(ROOT + ' ' + sel)}); return (${expr})(e)`);
    const state = () => ev(`return document.querySelector(${Q(ROOT)})?.dataset.state`);
    const variant = () => ev(`return document.querySelector(${Q(ROOT)})?.dataset.sxVariant`);
    const stepCount = () => ev(`return document.querySelectorAll(${Q(ROOT + ' [data-sx-step]')}).length`);
    const lit = () => ev(`return document.querySelectorAll(${Q(ROOT + ' [data-sx-step].on')}).length`);
    const pick = (key, value) => ev(`const s = document.querySelector(${Q(ROOT + ` [data-sx-pick="${key}"]`)});
      s.value = ${Q(value)}; s.dispatchEvent(new Event('change', { bubbles: true }))`);
    const replay = id => ev(`document.dispatchEvent(new CustomEvent('sx:replay', { detail: { id: ${Q(id)} } }))`);
    const shot = async name => {
      const prefix = process.env.SX_SHOT_PREFIX;
      if (!prefix) return;
      const w = await ev('return innerWidth');
      await size(w, await ev('return document.documentElement.scrollHeight'));
      const r = await ev(`scrollTo(0, 0); await new Promise(r => setTimeout(r, 200)); const b = document.querySelector(${Q(ROOT)}).getBoundingClientRect();
        return { x: 0, y: Math.max(0, b.top - 16), width: innerWidth, height: b.height + 32 }`);
      const { data } = await page.send('Page.captureScreenshot', { format: 'png', clip: { ...r, scale: 1 } });
      await writeFile(`${prefix}-${name}.png`, Buffer.from(data, 'base64'));
      await size(w, w < 600 ? 900 : 1000);
    };
    // The verdict and the checks for the shown variant equal the model.
    const verdictMatches = async id => {
      const x = byId(id), v = x.values;
      const got = await q('[data-sx-verdict]', `e => ({ hidden: e.hidden, got: e.querySelector('[data-sx-got]').textContent,
        want: e.querySelector('[data-sx-want]').textContent, outcome: e.querySelector('[data-sx-outcome]').firstChild.textContent.trim(),
        grade: e.querySelector('[data-sx-grade]').textContent, ontology: e.querySelector('[data-sx-ontology]').textContent,
        review: e.querySelector('[data-sx-review]').textContent,
        checks: [...e.querySelectorAll('[data-sx-check]')].map(c => [c.dataset.sxCheck, c.dataset.holds, c.querySelector('b').textContent]) })`);
      assert.equal(got.hidden, false, 'verdict shown at the end');
      assert.equal(got.got, x.result.got);
      assert.equal(got.want, WANT[x.expected.want]);
      assert.equal(got.outcome, model.OUTCOMES.find(o => o.key === x.outcome).label);
      assert.equal(got.grade, x.result.grade);
      assert.equal(got.ontology, x.result.ontology);
      assert.equal(got.review, 'review: pending');
      const words = { true: 'holds', false: 'does not hold', null: 'does not apply' };
      assert.deepEqual(got.checks, checks(v).map(c => [c.id, String(c.holds), words[String(c.holds)]]));
    };

    // Default: the seed, played by the sub-tab bar on first show, to done.
    await go('#view=scenario-expansion&sub=replay');
    assert.equal(await variant(), SEED_ID);
    for (const a of model.AXES) assert.equal(await q(`[data-sx-pick="${a.key}"]`, 'e => e.value'), model.SEED.values[a.key], a.key);
    assert.equal(await q(`[data-sx-pick="role"]`, 'e => e.closest("label").textContent.trim().split("\\n")[0]'), model.AXES[0].label);
    await until(async () => (await state()) === 'playing', 'seed plays on first show');
    await until(async () => (await state()) === 'done', 'seed reaches done', 15000);
    assert.equal(await stepCount(), trace(model.SEED.values).steps.length);
    assert.equal(await lit(), trace(model.SEED.values).steps.length);
    const seedRun = byId(SEED_ID).run;
    assert.equal(await q('[data-sx-prov="lab"] code', 'e => e.textContent'), seedRun.exec);
    assert.equal(await q('[data-sx-prov="context"] code', 'e => e.textContent'), seedRun.context);
    assert.equal(await q('[data-sx-prov="observation"]'), null, 'the seed is not a derivative');
    assert.equal(await q('[data-sx-prov="lab"] .rt-tip-body', 'e => e.textContent'), model.OPS.lab.hint);
    // Graph: every node with type, label and tier; every edge labelled; all lit at the end.
    const tr = trace(model.SEED.values);
    for (const n of tr.nodes) {
      assert.equal(await q(`[data-node="${n.id}"]`, 'e => e.textContent.replace(/\\s+/g, " ").trim()'), `${n.type} · ${n.tier} ${n.label}`, n.id);
    }
    assert.deepEqual(await ev(`return [...document.querySelectorAll(${Q(ROOT + ' .sx-rp-edge text')})].map(e => e.textContent)`), tr.edges.map(e => e.rel));
    assert.equal(await ev(`return document.querySelectorAll(${Q(ROOT + ' .sx-rp-node:not(.on)')}).length`), 0);
    await verdictMatches(SEED_ID);

    // An observation-removal variant chosen in the selects: steps, dropped events, provenance and its parent.
    await pick('logs', 'partial');
    assert.equal(await variant(), ABLATED_ID);
    await until(async () => (await state()) === 'done', 'derivative reaches done', 15000);
    const atr = trace(ABLATED);
    assert.equal(await stepCount(), atr.steps.length);
    assert.equal(await ev(`return document.querySelectorAll(${Q(ROOT + ' [data-sx-step].dropped')}).length`), atr.steps.filter(s => s.dropped).length);
    assert.match(await q('[data-sx-step].dropped', 'e => e.textContent'), /not in the logs/);
    const run = byId(ABLATED_ID).run;
    assert.equal(await q('[data-sx-prov="observation"] code', 'e => e.textContent'), run.ablation);
    assert.equal(await q('[data-sx-step="3"] .sx-rp-src', 'e => e.textContent'), model.OPS[atr.steps[3].source].label);
    await verdictMatches(ABLATED_ID);
    await size(1400);
    await shot('1400');
    await q('[data-sx-parent]', 'e => e.click()');
    assert.equal(await variant(), run.parent, 'parent button selects the parent');
    assert.equal(await q('[data-sx-pick="logs"]', 'e => e.value'), 'complete');

    // A pruned combination picked in the selects: its constraints, no steps, never plays.
    await pick('permission', 'jit');
    const prunedValues = { ...byId(run.parent).values, permission: 'jit' };
    assert.equal(await variant(), variantId(prunedValues));
    assert.deepEqual(await ev(`return [...document.querySelectorAll(${Q(ROOT + ' [data-sx-violates]')})].map(e => e.dataset.sxViolates)`), violations(prunedValues));
    assert.ok(violations(prunedValues).length > 0);
    assert.equal(await stepCount(), 0);
    assert.equal(await state(), 'idle');
    await sleep(800);
    assert.equal(await state(), 'idle', 'a pruned combination never plays');

    // select() mid-play stops, restarts at step 0 and reaches done.
    await replay(SEED_ID);
    await sleep(1500);
    assert.equal(await state(), 'playing');
    assert.ok((await lit()) > 0);
    await replay(ABLATED_ID);
    assert.equal(await variant(), ABLATED_ID, 'written synchronously');
    assert.equal(await state(), 'playing');
    assert.equal(await lit(), 0, 'restarted at step 0');
    await until(async () => (await state()) === 'done', 'select reaches done', 15000);
    // An invalid id is ignored.
    await replay('v-nope');
    assert.equal(await variant(), ABLATED_ID);

    // Controls: Pause freezes, Step advances one, Restart starts over.
    await q('[data-sx-btn="restart"]', 'e => e.click()');
    await sleep(1200);
    await q('[data-sx-btn="play"]', 'e => e.click()');
    assert.equal(await state(), 'paused');
    const frozen = await lit();
    await sleep(1000);
    assert.equal(await lit(), frozen, 'no progress while paused');
    await q('[data-sx-btn="step"]', 'e => e.click()');
    assert.equal(await lit(), frozen + 1);
    await q('[data-sx-btn="play"]', 'e => e.click()');
    await until(async () => (await state()) === 'done', 'resumes to done', 15000);

    // ② → Replay ▶ on a finding: ③ shown, its example selected and played.
    const f = model.findings[0];
    await ev('window.__sxView.open("coverage")');
    await ev(`document.querySelector('#scenario-expansion [data-sx-finding="${f.id}"] [data-sx-replay]').click()`);
    await until(async () => (await ev('return window.__sxView.current()')) === 'replay', '③ shown');
    assert.equal(await variant(), f.example);
    await until(async () => (await state()) === 'done', 'finding replay reaches done', 15000);

    // Reduced motion before load: done at once, no running animations.
    await reducedMotion(true);
    await go('#view=scenario-expansion&sub=replay');
    assert.equal(await state(), 'done');
    assert.equal(await lit(), trace(model.SEED.values).steps.length);
    assert.equal(await ev(`const r = document.querySelector(${Q(ROOT)});
      return document.getAnimations().filter(a => a.playState === 'running' && r.contains(a.effect?.target)).length`), 0);
    await replay(ABLATED_ID);
    assert.equal(await state(), 'done', 'select under reduced motion shows the final state');
    await reducedMotion(false);

    // 390 px: no horizontal page overflow on an observation-removal variant.
    await size(390, 900);
    await go('#view=scenario-expansion&sub=replay');
    await replay(ABLATED_ID);
    await until(async () => (await state()) === 'done', 'done at 390 px', 15000);
    const o = await overflow();
    assert.ok(o.doc <= o.win, `page ${o.doc}px wide in a ${o.win}px window`);
    await shot('390');

    assert.deepEqual(errors(), [], 'no page exceptions or console errors');
  });
});
