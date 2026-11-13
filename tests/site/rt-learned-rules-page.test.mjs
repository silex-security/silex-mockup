// logs/2026-11-12_LEARNED_RULES_PLAN.md §5: the "Rules, tested" sub-tab in the page. Every expected number is counted
// here from the JSON file, not through the module under test. Skips when no Chrome binary exists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { withPage, until, ROOT } from './sx-harness.mjs';

const data = JSON.parse(readFileSync(join(ROOT, 'jev-runtime/demo/data/learned-rules.json'), 'utf8'));
const verdicts = v => data.rules.filter(r => r.report.verdict === v).length;
const canon = v => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])])) : v;
const conditions = new Set(data.rules.map(r => JSON.stringify(canon(r.condition))));
const PANEL = '#rtLearning [data-rt-subpanel="rules"]';
const HEADING = 'How the judge and the rules can improve, and how each was tested';

test('the Rules, tested sub-tab shows the recorded counts, its limits and both cards', { timeout: 180000 }, async t => {
  await withPage(t, async ({ ev, go, size, overflow, errors }) => {
    const text = sel => ev(`return document.querySelector(${JSON.stringify(sel)})?.innerText ?? null`);
    const shown = sel => ev(`const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false;
      const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && !e.closest('[hidden]') && !e.closest('details:not([open])')`);

    for (const width of [1280, 390]) {
      await size(width);
      await go('#view=runtime-observation&tab=learning&sub=rules');
      await until(() => ev(`return !!document.querySelector(${JSON.stringify(PANEL + ' [data-rt-rules-headline]')})`), `${width}: rules rendered`, 15000);

      assert.equal(await ev('return window.__rtSubnav.learning.current()'), 'rules', `${width}: deep link opens the sub-tab`);
      assert.ok(await shown('#rtLearning .rt-intro h2'), `${width}: tab heading visible`);
      assert.match(await text('#rtLearning .rt-intro h2'), new RegExp('^' + HEADING), `${width}: tab heading text`);
      assert.ok(await shown(PANEL + ' [data-rt-rules-headline]'), `${width}: headline visible`);

      const n = await ev(`return Object.fromEntries([...document.querySelectorAll(${JSON.stringify(PANEL + ' [data-rt-rules-n]')})].map(e => [e.dataset.rtRulesN, Number(e.textContent)]))`);
      assert.deepEqual(n, { sessions: data.sessions.total, candidates: data.rules.length, passed: verdicts('PASS'), failed: verdicts('FAIL') }, `${width}: headline numbers`);

      assert.ok(await shown(PANEL + ' [data-rt-rules-note]'), `${width}: limits line visible and outside details`);
      const note = await text(PANEL + ' [data-rt-rules-note]');
      assert.match(note, /After probes found some of them wrong, harder test cases were added/, `${width}: limits line, gate history`);
      assert.match(note, /No proposed rule was put into a live policy/, `${width}: limits line, not live`);
      assert.match(note, new RegExp(`synthetic ${data.gate.corpus.dev + data.gate.corpus.holdout}-item test set`), `${width}: limits line, test set size`);
      assert.match(await text(PANEL + ' .rt-chip'), /^Measured/, `${width}: chip`);

      const pass = data.rules.find(r => r.report.verdict === 'PASS').report;
      assert.equal(await text(PANEL + ' [data-rt-rules-card="pass"] [data-rt-rules-evidence]'),
        `Caught ${pass.dev.caught} of ${pass.dev.violations} known violations, flagged ${pass.dev.false_flags} of ${pass.dev.benign} normal payments. On the held-back set: ${pass.holdout.caught} of ${pass.holdout.violations}, ${pass.holdout.false_flags} of ${pass.holdout.benign}.`, `${width}: passing card evidence`);
      assert.match(await text(PANEL + ' [data-rt-rules-card="fail"] [data-rt-rules-evidence]'), /^Caught \d+ of \d+ known violations/, `${width}: failing card evidence`);
      assert.match(await text(PANEL + ' [data-rt-rules-card="fail"] [data-rt-rules-same]'), new RegExp(`of the ${verdicts('FAIL')} failing rules fail the same way`), `${width}: failing card lead`);

      assert.equal(await ev(`return document.querySelector(${JSON.stringify(PANEL + ' [data-rt-rules-all]')}).open`), false, `${width}: details closed by default`);
      await ev(`document.querySelector(${JSON.stringify(PANEL + ' [data-rt-rules-all]')}).open = true`);
      assert.equal(await ev(`return document.querySelectorAll(${JSON.stringify(PANEL + ' [data-rt-rules-form]')}).length`), conditions.size, `${width}: one row per distinct condition`);
      assert.equal(await ev(`return document.querySelectorAll(${JSON.stringify(PANEL + ' [data-rt-rules-criteria] li')}).length`), 5, `${width}: five criteria`);
      const o = await overflow();
      assert.ok(o.doc <= o.win + 1, `${width}: no horizontal page scroll with the table open (${o.doc} > ${o.win})`);
    }

    for (const sub of ['loop', 'results']) {
      await ev(`window.__rtSubnav.learning.open(${JSON.stringify(sub)})`);
      assert.ok(await shown(`#rtLearning [data-rt-subpanel="${sub}"]`), `${sub} still opens`);
      assert.ok(!(await shown(PANEL)), `rules hidden while ${sub} is open`);
    }
    assert.deepEqual(errors(), [], 'no page errors');
  });
});
