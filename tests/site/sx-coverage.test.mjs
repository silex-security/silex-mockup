import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPage } from './sx-harness.mjs';
import { AXES, expand, OUTCOMES, CONSTRAINTS, RULE, GRADE, ONTOLOGY_VERSION, WANT } from '../../js/sx-model.js';

test('coverage matches the model and replays candidate findings', { timeout: 120000 }, async t => {
  await withPage(t, async ({ ev, go, size, overflow, errors }) => {
    await go('#view=scenario-expansion&sub=coverage');
    const model = expand();
    const count = AXES.filter(a => a.key !== 'logs').reduce((n, a) => n * a.values.length, 1);
    assert.equal(await ev('return document.querySelector(\'[data-sx="coverage"]\').dataset.logs'), 'complete');
    assert.equal(await ev('return document.querySelectorAll(\'[data-sx="coverage"] [role="radiogroup"] input\').length'), AXES.find(a => a.key === 'logs').values.length);
    for (const level of AXES.find(a => a.key === 'logs').values) {
      await ev(`document.querySelector('[data-sx="coverage"] input[value="${level.value}"]').click()`);
      const cells = await ev(`return [...document.querySelectorAll('[data-sx-cell]')].map(e => ({ id: e.dataset.sxCell, outcome: e.dataset.outcome, violates: e.dataset.violates, name: e.getAttribute('aria-label') }))`);
      const expected = model.all.filter(x => x.values.logs === level.value);
      assert.equal(cells.length, count);
      assert.deepEqual(cells.map(x => x.id).sort(), expected.map(x => x.id).sort());
      for (const x of expected) {
        const cell = cells.find(c => c.id === x.id);
        assert.ok(cell.name);
        for (const a of AXES) assert.ok(cell.name.includes(a.values.find(v => v.value === x.values[a.key]).label));
        if (x.violates.length) {
          assert.equal(cell.violates, x.violates.join(' '));
          for (const id of x.violates) assert.ok(cell.name.includes(CONSTRAINTS.find(c => c.id === id).text));
        } else {
          assert.equal(cell.outcome, x.outcome);
          assert.ok(cell.name.includes(OUTCOMES.find(o => o.key === x.outcome).label));
          assert.ok(cell.name.includes('proposed: ' + WANT[x.expected.want]));
        }
      }
      const summary = await ev('return document.querySelector(".sx-coverage-summary").textContent');
      const valid = expected.filter(x => !x.violates.length);
      assert.ok(summary.includes(valid.length + ' valid variants'));
      for (const o of OUTCOMES) assert.ok(summary.includes(o.label + ': ' + valid.filter(x => x.outcome === o.key).length));
    }
    const legend = await ev('return document.querySelector(".sx-coverage-legend").textContent');
    for (const o of OUTCOMES) { assert.ok(legend.includes(o.label)); assert.ok(legend.includes(o.hint)); }
    assert.ok(legend.includes('pending expert review'));
    assert.ok(legend.includes(GRADE));
    assert.ok(legend.includes(ONTOLOGY_VERSION));
    for (const c of CONSTRAINTS) assert.ok(legend.includes(c.text));
    assert.ok(await ev(`return document.querySelector('.sx-coverage-head').textContent.includes(${JSON.stringify(RULE.text)})`));
    const findings = await ev(`return [...document.querySelectorAll('[data-sx-finding]')].map(e => ({ id: e.dataset.sxFinding, text: e.textContent }))`);
    assert.equal(findings.length, model.findings.length);
    for (const [i, f] of model.findings.entries()) {
      assert.equal(findings[i].id, f.id);
      for (const text of [f.text, OUTCOMES.find(o => o.key === f.kind).label, f.variants.length + ' variants', f.grade, f.ontology, 'review: pending']) assert.ok(findings[i].text.includes(text));
      await ev(`window.__sxView.open('coverage'); document.querySelectorAll('[data-sx-finding] button')[${i}].click()`);
      assert.equal(await ev('return window.__sxView.current()'), 'replay');
      assert.equal(await ev('return document.querySelector(\'[data-sx="replay"]\').dataset.sxVariant'), f.example);
    }
    await ev(`window.__sxView.open('coverage'); document.querySelector('[data-sx-cell][data-outcome]').click()`);
    assert.equal(await ev('return window.__sxView.current()'), 'replay');
    await ev(`window.__sxView.open('coverage')`);
    await size(390, 900);
    const widths = await overflow();
    assert.ok(widths.doc <= widths.win, JSON.stringify(widths));
    assert.ok(await ev('const e = document.querySelector(".sx-coverage-scroll"); return e.scrollWidth > e.clientWidth'));
    assert.deepEqual(errors(), []);
  });
});

test('setLogs updates controls and destroy removes the panel', async t => {
  await withPage(t, async ({ go, ev }) => {
    await go('#view=scenario-expansion&sub=coverage');
    assert.equal(await ev(`const { mountCoverage } = await import('./js/sx-coverage.js');
      const el = document.createElement('div');
      const handle = mountCoverage(el, window.__sxView.model);
      handle.setLogs('partial');
      const selected = el.querySelector('input:checked').value;
      handle.setLogs('unknown');
      const unchanged = el.querySelector('input:checked').value === selected;
      handle.destroy();
      handle.setLogs('complete');
      return selected === 'partial' && unchanged && el.innerHTML === ''`), true);
  });
});
