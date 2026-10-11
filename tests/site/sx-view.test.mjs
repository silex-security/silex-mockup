// Scenario Expansion view host (js/sx-view.js and the index.html wiring; logs/2026-10-11_SCENARIO_EXPANSION_PLAN.md,
// task T0). Headless: sidebar entry, cold deep links, unknown sub-tabs, keyboard, the visible framing, the static
// "How results are judged" panel, the replay selection hook, the System Validation route, 390 px and console errors.
// Populated-panel assertions live in each panel's own test (T1-T3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPage, until } from './sx-harness.mjs';
import { subFromHash, SUBS } from '../../js/sx-view.js';
import { variantId, SEED } from '../../js/sx-model.js';

test('subFromHash reads only this view', () => {
  assert.equal(subFromHash('#view=scenario-expansion&sub=coverage'), 'coverage');
  assert.equal(subFromHash('#view=scenario-expansion'), null);
  assert.equal(subFromHash('#view=runtime-observation&tab=fleet'), undefined);
  assert.equal(subFromHash('#studio'), undefined);
  assert.deepEqual(SUBS.map(s => s.key), ['expand', 'coverage', 'replay', 'judging']);
});

test('the Scenario Expansion view: routing, sub-tabs, framing and layout', { timeout: 240000 }, async t => {
  await withPage(t, async ({ ev, go, size, overflow, errors }) => {
    const shown = () => ev(`const v = document.getElementById('scenario-expansion'); const b = window.__sxView?.current();
      if (!v.classList.contains('active') || !b) return null;
      const btn = document.getElementById('rtSub-sx-' + b), panel = document.getElementById(btn.getAttribute('aria-controls'));
      return panel.hidden ? null : b`);

    // Cold deep link straight to ②: the view is shown and ② is the visible sub-tab (its placeholder container).
    await go('#view=scenario-expansion&sub=coverage');
    await until(async () => (await shown()) === 'coverage', 'cold &sub=coverage');
    assert.ok(await ev('return !!document.querySelector(\'#scenario-expansion [data-sx="coverage"]\')'), 'coverage container mounted');
    assert.equal(await ev('return document.getElementById("crumb").textContent'), 'Scenario Expansion');
    assert.equal(await ev('return document.querySelector(\'.nav button[data-view="scenario-expansion"]\').classList.contains("active")'), true);

    // Unknown and missing sub-tabs fall back to ①.
    await go('#view=scenario-expansion&sub=nope');
    await until(async () => (await shown()) === 'expand', 'unknown sub falls back to expand');
    await go('#view=scenario-expansion');
    await until(async () => (await shown()) === 'expand', 'no sub opens expand');

    // The sidebar entry opens the view from elsewhere.
    await go('#view=overview');
    await ev('document.querySelector(\'.nav button[data-view="scenario-expansion"]\').click()');
    await until(async () => (await shown()) === 'expand', 'sidebar click');

    // Arrow keys move along the four sub-tabs, and wrap.
    await ev('document.getElementById("rtSub-sx-expand").focus()');
    const key = k => ev(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true }))`);
    for (const want of ['coverage', 'replay', 'judging', 'expand']) { await key('ArrowRight'); assert.equal(await shown(), want); }
    await key('ArrowLeft'); assert.equal(await shown(), 'judging');

    // Visible framing: the lead says nothing has run in a lab, the chip says simulated.
    const lead = await ev('return document.querySelector("#scenario-expansion .sx-lead p").textContent');
    assert.match(lead, /nothing here has run in a lab yet/);
    assert.match(lead, /reproducible and reviewable/);
    assert.match(await ev('return document.querySelector(\'#scenario-expansion .sx-lead .rt-chip[data-kind="sim"]\').textContent'), /Simulated · fictional tenant · not yet run in a lab/);

    // ④ is static method text: three cards and the note; the generator never judges.
    await ev('window.__sxView.open("judging")');
    assert.equal(await ev('return document.querySelectorAll("#scenario-expansion .sx-judge-card").length'), 3);
    assert.match(await ev('return document.querySelector("#scenario-expansion .sx-judge-note").textContent'), /never judges its own output/);
    assert.match(await ev('return document.querySelector("#scenario-expansion .sx-judge-note").textContent'), /review: pending/);

    // ③ defaults to the seed; an sx:replay request selects the variant and opens ③.
    const seed = variantId(SEED.values);
    assert.equal(await ev('return document.querySelector(\'[data-sx="replay"]\').dataset.sxVariant'), seed);
    const other = variantId({ ...SEED.values, logs: 'partial' });
    await ev(`document.dispatchEvent(new CustomEvent('sx:replay', { detail: { id: ${JSON.stringify(other)} } }))`);
    assert.equal(await shown(), 'replay');
    assert.equal(await ev('return document.querySelector(\'[data-sx="replay"]\').dataset.sxVariant'), other);

    // System Validation links here through the site's route handler.
    await go('#view=long-term');
    await ev('document.querySelector(\'#long-term [data-wm-route="#view=scenario-expansion"]\').click()');
    await until(async () => (await shown()) === 'expand', 'System Validation button');
    assert.equal(await ev('return location.hash'), '#view=scenario-expansion');

    // A deep link to a non-default sub-tab is what the state hash writes back.
    await go('#view=scenario-expansion&sub=judging');
    await until(async () => (await shown()) === 'judging', 'cold judging');
    await ev('window.__siteShowView("overview")');
    await ev('document.querySelector(\'.nav button[data-view="scenario-expansion"]\').click()');
    assert.equal(await shown(), 'judging', 'returning keeps the sub-tab');

    // A deep link typed on an already-loaded page, before the view's first show, opens its sub-tab without
    // starting ① on the way (the inline router shows the view before this module reads the hash).
    await go('#view=overview');
    await ev(`location.hash = '#view=scenario-expansion&sub=coverage'`);
    await until(async () => (await shown()) === 'coverage', 'warm &sub=coverage');
    assert.equal(await ev('return document.querySelector(\'[data-sx="expand"]\').dataset.state'), 'idle', '① was never started');

    // ③'s result card carries no judgement word.
    await ev(`document.dispatchEvent(new CustomEvent('sx:replay', { detail: { id: ${JSON.stringify(variantId(SEED.values))} } }))`);
    await until(() => ev('return document.querySelector(\'[data-sx="replay"]\').dataset.state === "done"'), 'seed replay done', 20000);
    assert.doesNotMatch(await ev('return document.querySelector(\'[data-sx="replay"]\').textContent'), /\bverdict\b/i);

    // 390 px: no horizontal page overflow on any sub-tab.
    await size(390, 900);
    await go('#view=scenario-expansion');
    for (const k of SUBS.map(s => s.key)) {
      await ev(`window.__sxView.open(${JSON.stringify(k)})`);
      const o = await overflow();
      assert.ok(o.doc <= o.win, `${k}: page ${o.doc}px wide in a ${o.win}px window`);
    }
    assert.deepEqual(errors(), [], 'no page exceptions or console errors');
  });
});
