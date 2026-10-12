import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withPage, until } from './sx-harness.mjs';

// Rendering diagnostics are emitted through the browser log, beyond runtime exceptions.
async function withGraphPage(t, fn) {
  return withPage(t, async api => {
    const diagnostics = [];
    const listener = event => {
      const message = JSON.parse(event.data);
      if (message.method === 'Log.entryAdded') {
        const entry = message.params.entry;
        if (['warning', 'error'].includes(entry.level) &&
            (entry.source === 'rendering' || /<svg|<g>|attribute.*transform|Expected number/i.test(entry.text))) diagnostics.push(entry.text);
      }
      if (message.method === 'Runtime.consoleAPICalled' && ['warning', 'warn', 'error'].includes(message.params.type)) {
        diagnostics.push(message.params.args.map(a => a.value ?? a.description).join(' '));
      }
    };
    api.page.ws.addEventListener('message', listener);
    await api.page.send('Log.enable');
    try { await fn({ ...api, errors: () => [...new Set([...api.errors(), ...diagnostics])] }); }
    finally { api.page.ws.removeEventListener('message', listener); }
  });
}

export async function mountDirect(ev) {
  return ev(`if (![...document.querySelectorAll('link[rel="stylesheet"]')].some(e => e.href.endsWith('/css/rt-onto-graph.css'))) {
      const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/css/rt-onto-graph.css'; document.head.appendChild(css);
    }
    const { mountOntoGraph } = await import('/js/rt-onto-graph.js');
    const { tip } = await import('/js/rt-tip.js');
    window.graphModel = await (await import('/js/rt-onto-fleet-model.js')).loadFleetOntology();
    const el = document.createElement('div'); el.id = 'graphTest'; document.querySelector('#overview').appendChild(el);
    window.graphHandle = mountOntoGraph(el, window.graphModel, { tip });
    return window.graphModel;`);
}
const q = '#graphTest ';

test('one finger scrolls schema and facts while two fingers zoom on mobile', { timeout: 60000 }, async t => {
  // Each mode starts with a fresh touch session so prior gestures cannot carry over.
  for (const mode of ['schema', 'facts']) await withGraphPage(t, async ({ ev, go, size, page, errors, reducedMotion, overflow }) => {
    await size(390, 844);
    await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
    await reducedMotion(true);
    await go('#view=overview');
    await mountDirect(ev);
    await ev('await window.graphHandle.ensure()');
    const state = () => ev(`const svg = document.querySelector('${q}[data-graph-svg]');
      const z = window.d3.zoomTransform(svg);
      return { y: scrollY, left: svg.closest('.rt-og-stage').scrollLeft, zoom: [z.x, z.y, z.k] }`);
    const settle = () => ev(`const stage = document.querySelector('${q}.rt-og-stage');
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Touch scroll did not settle')), 10000);
        let previous = [scrollY, stage.scrollLeft], stable = 0;
        const frame = () => {
          const current = [scrollY, stage.scrollLeft];
          stable = current.every((v, i) => v === previous[i]) ? stable + 1 : 0;
          previous = current;
          if (stable >= 2) { clearTimeout(timer); resolve(); }
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });`);
    const position = async () => {
      await settle();
      await ev(`const svg = document.querySelector('${q}[data-graph-svg]');
        svg.closest('.rt-og-stage').scrollLeft = 0;
        scrollTo(0, scrollY + svg.getBoundingClientRect().top - 80);`);
      await settle();
      const rect = await ev(`const svg = document.querySelector('${q}[data-graph-svg]');
        const s = svg.getBoundingClientRect(), c = svg.closest('.rt-og-stage').getBoundingClientRect();
        const left = Math.max(0, s.left, c.left), right = Math.min(innerWidth, s.right, c.right);
        const top = Math.max(0, s.top, c.top), bottom = Math.min(innerHeight, s.bottom, c.bottom);
        return { left, right, top, bottom, x: (left + right) / 2, y: (top + bottom) / 2 };`);
      assert.ok(rect.right - rect.left > 240 && rect.bottom - rect.top > 240,
        'touch target has room inside the visible SVG: ' + JSON.stringify(rect));
      return { x: rect.x, y: rect.y };
    };
    await ev(`window.graphHandle.mode('${mode}')`);
    let target = await position();
    const before = await state();
    await page.send('Input.synthesizeScrollGesture', {
      ...target, yDistance: -200, speed: 400, preventFling: true, gestureSourceType: 'touch',
    });
    await settle();
    const after = await state();
    assert.ok(after.y > before.y + 50, mode + ': one finger scrolls the page: ' + JSON.stringify({ before, after }));
    assert.deepEqual(after.zoom, before.zoom, mode + ': scrolling does not pan the graph');
    target = await position();
    const sideways = await state();
    await page.send('Input.synthesizeScrollGesture', {
      ...target, xDistance: -180, speed: 400, preventFling: true, gestureSourceType: 'touch',
    });
    await settle();
    const across = await state();
    assert.ok(across.left > sideways.left + 50, mode + ': one finger scrolls the stage horizontally: ' + JSON.stringify({ sideways, across }));
    assert.deepEqual(across.zoom, sideways.zoom, mode + ': sideways scrolling does not pan the graph');
    target = await position();
    const pinch = await state();
    await page.send('Input.synthesizePinchGesture', {
      ...target, scaleFactor: 1.8, relativeSpeed: 400, gestureSourceType: 'touch',
    });
    await settle();
    await until(async () => (await state()).zoom[2] > pinch.zoom[2] * 1.2, mode + ': two fingers zoom the graph');
    const o = await overflow(); assert.ok(o.doc <= o.win, JSON.stringify(o));
    assert.deepEqual(errors(), []);
  });
});

test('schema, rule highlights, facts, inspector, files and responsive fallback', { timeout: 120000 }, async t => {
  await withGraphPage(t, async ({ ev, go, size, overflow, errors, reducedMotion }) => {
    await reducedMotion(true);
    await go('#view=overview');
    const model = await mountDirect(ev);
    await ev('await window.graphHandle.ensure()');
    const nodes = await ev(`return [...document.querySelectorAll('${q}[data-graph-node]')].map(e => e.dataset.graphNode)`);
    assert.deepEqual(nodes.sort(), model.schema.nodes.map(n => n.id).sort());
    assert.equal(nodes.length, 68);
    const fit = await ev(`const svg = document.querySelector('${q}[data-graph-svg]'), canvas = svg.getBoundingClientRect();
      const bounds = svg.querySelector('.rt-og-layer').getBoundingClientRect();
      return { width: bounds.width / canvas.width, height: bounds.height / canvas.height,
        fonts: [...svg.querySelectorAll('[data-graph-node] text')].map(e => {
          const m = e.getScreenCTM(); return parseFloat(getComputedStyle(e).fontSize) * Math.hypot(m.a, m.b);
        }), edgeLabels: [...svg.querySelectorAll('[data-graph-link] text')].map(e => getComputedStyle(e).visibility) }`);
    assert.ok(fit.width >= .7 || fit.height >= .7, 'initial drawing fills the canvas: ' + JSON.stringify(fit));
    assert.ok(fit.fonts.length && fit.fonts.every(f => f >= 11), 'node labels are at least 11 screen pixels: ' + JSON.stringify(fit.fonts));
    assert.ok(fit.edgeLabels.every(v => v === 'hidden'), 'unselected edge labels stay hidden at the initial fit');
    const linkData = () => ev(`return [...document.querySelectorAll('${q}[data-graph-link]')].map(e => ({ s: e.dataset.s, o: e.dataset.o, p: e.dataset.p, role: e.dataset.role, grade: e.dataset.grade, hi: e.dataset.hi === 'true', complete: e.dataset.complete === 'true' }))`);
    const links = await linkData();
    assert.equal(links.length, model.schema.links.length);
    assert.deepEqual(links.map(l => [l.s, l.p, l.o, l.role, l.grade]), model.schema.links.map(l => [l.s, l.p, l.o, l.role, l.grade ?? '']));
    const positions = await ev(`return [...document.querySelectorAll('${q}[data-graph-node]')].map(e => e.getAttribute('transform'))`);
    await reducedMotion(false);
    await ev('window.graphHandle.mode("schema")');
    assert.deepEqual(await ev(`return [...document.querySelectorAll('${q}[data-graph-node]')].map(e => e.getAttribute('transform'))`), positions);
    await ev(`document.querySelector('${q}[data-graph-anchors]').click()`);
    assert.equal(await ev(`return document.querySelectorAll('${q}[data-graph-node]').length`), nodes.length - model.counts.anchors);
    assert.equal((await linkData()).length, model.schema.links.filter(l => !model.schema.nodes.some(n => n.role === 'anchor' && (n.id === l.s || n.id === l.o))).length);
    await ev(`document.querySelector('${q}[data-graph-anchors]').click()`);
    await ev(`document.querySelector('${q}[data-graph-subclass]').click()`);
    assert.equal((await linkData()).length, model.schema.links.filter(l => l.role !== 'subclass').length);
    await ev(`document.querySelector('${q}[data-graph-subclass]').click()`);
    for (const rule of model.rules) {
      await ev(`window.graphHandle.rule(${JSON.stringify(rule.id)})`);
      const chips = await ev(`return [...document.querySelectorAll('${q}[data-graph-pred]')].map(e => ({ id: e.dataset.graphPred, hi: e.dataset.hi === 'true', complete: e.dataset.complete === 'true' }))`);
      assert.deepEqual(chips.filter(c => c.hi).map(c => c.id).sort(), [...rule.predicates].sort());
      assert.deepEqual(chips.filter(c => c.complete).map(c => c.id).sort(), [...rule.complete].sort());
      for (const l of await linkData()) { assert.equal(l.hi, rule.predicates.includes(l.p)); assert.equal(l.complete, rule.complete.includes(l.p)); }
      const boxes = await ev(`return [...document.querySelectorAll('${q}[data-graph-node][data-role="attribute"]')].map(e => ({ id: e.dataset.graphNode, hi: e.dataset.hi === 'true' }))`);
      for (const b of boxes) assert.equal(b.hi, model.schema.links.some(l => l.o === b.id && rule.predicates.includes(l.p)));
      assert.ok(await ev(`return !!document.querySelector('${q}[data-graph-link][data-hi="true"], ${q}[data-graph-link][data-complete="true"], ${q}[data-role="attribute"][data-hi="true"]')`));
    }
    const anchor = model.schema.nodes.find(n => n.role === 'anchor');
    await ev(`document.querySelectorAll('${q}[data-graph-node]')[${model.schema.nodes.findIndex(n => n.id === anchor.id)}].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`);
    assert.equal(await ev(`return document.querySelector('${q}[data-graph-wm]').dataset.wmRoute`), anchor.wm);
    await ev(`document.querySelector('${q}[data-graph-inspector]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
    assert.equal(await ev(`return !!document.querySelector('${q}[data-graph-wm]')`), false);
    await ev('window.graphHandle.mode("facts")');
    const factSizes = await ev(`return [...document.querySelectorAll('${q}[data-graph-node] circle')].map(e => e.getBoundingClientRect().width)`);
    assert.ok(factSizes.length && factSizes.every(size => size <= 80), 'small facts graphs keep modest node sizes: ' + JSON.stringify(factSizes));
    const defaultTrace = model.traces.find(t => t.id === 'X1Bb');
    assert.equal(await ev(`return document.querySelector('${q}[data-graph-trace]').value`), defaultTrace.id);
    assert.equal(await ev(`return Number(document.querySelector('${q}[data-graph-call]').value)`), defaultTrace.deciding);
    const call = defaultTrace.calls.find(c => c.index === defaultTrace.deciding);
    assert.deepEqual(await ev(`return [...document.querySelectorAll('${q}[data-graph-link]')].map(e => e.dataset.used === 'true')`), call.facts.links.map(l => l.used));
    assert.ok(call.facts.links.some(l => l.used));
    let caption = await ev(`return document.querySelector('${q}[data-graph-caption]').textContent`);
    for (const value of [call.tool, call.as_of, 'with the slice: ' + call.on.decision, 'trace only: ' + call.off.decision]) assert.ok(caption.includes(value));
    assert.equal(await ev(`return document.querySelectorAll('${q}[data-graph-row]').length`), call.facts.nodes.length + call.facts.links.length);
    {
      const captions = [];
      for (const c of model.traces.find(t => t.id === 'SD1b').calls) {
        await ev(`window.graphHandle.trace('SD1b', ${c.index})`);
        caption = await ev(`return document.querySelector('${q}[data-graph-caption]').textContent`);
        assert.ok(caption.includes(c.as_of));
        assert.ok(caption.includes(c.on.decision));
        for (const id of c.on.rules) assert.ok(caption.includes(id));
        captions.push(caption);
      }
      assert.notEqual(captions[0], captions[1]);
      const files = await ev(`return [...document.querySelectorAll('${q}[data-graph-file]')].map(e => e.dataset.graphFile)`);
      assert.equal(files.length, 193);
      assert.deepEqual(files.sort(), model.files.files.map(f => f.path).sort());
      assert.equal(await ev(`return document.querySelectorAll('${q}[data-graph-folder] [data-graph-file]').length`), 180);
      assert.deepEqual(await ev(`return (await Promise.all([...document.querySelectorAll('${q}[data-graph-file] a')].map(async a => ({ path: a.getAttribute('href'), status: (await fetch(a.href)).status })))).filter(x => x.status !== 200)`), []);
    }
    for (const width of [1400, 390]) {
      await size(width, 1000);
      for (const mode of ['schema', 'facts']) {
        await ev(`window.graphHandle.mode('${mode}')`);
        const o = await overflow(); assert.ok(o.doc <= o.win, JSON.stringify(o));
        if (width === 390) {
          const mobile = await ev(`const svg = document.querySelector('${q}[data-graph-svg]'), stage = svg.closest('.rt-og-stage');
            return { scrolls: stage.scrollWidth > stage.clientWidth, fonts: [...svg.querySelectorAll('[data-graph-node] text')].map(e => {
              const m = e.getScreenCTM(); return parseFloat(getComputedStyle(e).fontSize) * Math.hypot(m.a, m.b);
            }) }`);
          assert.equal(mobile.scrolls, true, 'wide graph scrolls inside its own stage');
          assert.ok(mobile.fonts.length && mobile.fonts.every(f => f >= 11), 'mobile node labels remain at least 11 screen pixels: ' + JSON.stringify(mobile.fonts));
        }
      }
    }
    assert.deepEqual(errors(), []);
  });
});

test('library failure leaves chips, table and files usable, and Retry recovers', { timeout: 60000 }, async t => {
  await withGraphPage(t, async ({ ev, go, page, errors }) => {
    await go('#view=overview');
    await page.send('Network.setBlockedURLs', { urls: ['*swm/vendor/d3.v7.min.js*'] });
    const model = await mountDirect(ev);
    assert.equal(await ev('const a = window.graphHandle.ensure(), b = window.graphHandle.ensure(); const same = a === b; await a; return same'), true);
    assert.ok(await ev(`return document.querySelector('${q}[data-graph-status]').textContent.includes('Could not load the graph library')`));
    assert.equal(await ev(`return document.querySelectorAll('${q}[data-graph-pred]').length`), model.predicates.length);
    assert.equal(await ev(`return document.querySelectorAll('${q}[data-graph-row]').length`), model.schema.nodes.length + model.schema.links.length);
    assert.equal(await ev(`return document.querySelectorAll('${q}[data-graph-file]').length`), model.files.files.length);
    await page.send('Network.setBlockedURLs', { urls: [] });
    await ev(`document.querySelector('${q}[data-graph-retry]').click(); await window.graphHandle.ensure()`);
    assert.equal(await ev(`return document.querySelectorAll('${q}[data-graph-node]').length`), model.schema.nodes.length);
    assert.deepEqual(errors(), []);
  });
});

test('cold graph deep links draw identically with reduced motion set before load', { timeout: 60000 }, async t => {
  await withGraphPage(t, async ({ ev, go, reducedMotion, size, overflow, errors }) => {
    let positions;
    for (const reduced of [true, false]) {
      await reducedMotion(reduced);
      await go('#view=runtime-observation&tab=ontology&sub=graph');
      await until(() => ev('return document.querySelectorAll(\'[data-rt-subpanel="graph"] [data-graph-node]\').length === 68'), 'cold graph layout');
      assert.equal(await ev('return window.__rtSubnav.ontology.current()'), 'graph');
      assert.equal(await ev('return document.querySelector(\'[data-rt-subpanel="graph"]\').hidden'), false);
      const actual = await ev('return [...document.querySelectorAll(\'[data-rt-subpanel="graph"] [data-graph-node]\')].map(e => [e.dataset.graphNode, e.getAttribute("transform")])');
      if (positions) assert.deepEqual(actual, positions); else positions = actual;
      assert.ok(await ev('return document.querySelector(\'[data-rt-subpanel="graph"] [data-onto-fleet-grade]\').textContent.includes("Simulated engine")'));
      await size(390, 1000);
      const o = await overflow(); assert.ok(o.doc <= o.win, JSON.stringify(o));
      await size(1400, 1000);
    }
    assert.deepEqual(errors(), []);
  });
});


test('empty call slices keep finite transforms and recover to a populated call', { timeout: 60000 }, async t => {
  await withGraphPage(t, async ({ ev, go, errors }) => {
    await go('#view=overview');
    const model = await mountDirect(ev);
    await ev('await window.graphHandle.ensure(); window.graphHandle.mode("facts")');
    const emptyCalls = model.traces.filter(t => ['TR2a', 'TR2b', 'CR1a'].includes(t.id))
      .flatMap(t => t.calls.map(c => ({ trace: t.id, ...c })));
    assert.equal(emptyCalls.length, 5);
    const finiteState = () => ev(`const svg = document.querySelector('${q}[data-graph-svg]');
      const transforms = [...svg.querySelectorAll('[transform]')].map(e => e.getAttribute('transform'));
      const z = window.d3.zoomTransform(svg);
      return { transforms, zoom: [z.x, z.y, z.k], finite: [z.x, z.y, z.k].every(Number.isFinite) && z.k > 0 &&
        transforms.every(t => !/NaN|Infinity/.test(t) && [...t.matchAll(/[-+]?\\d*\\.?\\d+(?:e[-+]?\\d+)?/gi)].every(m => Number.isFinite(Number(m[0])))) }`);
    for (const call of emptyCalls) {
      assert.equal(call.facts.nodes.length, 0);
      await ev(`window.graphHandle.trace(${JSON.stringify(call.trace)}, ${call.index})`);
      const state = await finiteState();
      assert.equal(state.finite, true, JSON.stringify({ call: call.trace, index: call.index, ...state }));
      assert.equal(await ev(`return document.querySelectorAll('${q}[data-graph-node]').length`), 0);
      assert.equal(await ev(`const e = document.querySelector('${q}[data-graph-empty]'); return !e.hidden && e.getBoundingClientRect().height > 0 && e.textContent === 'No declared facts for this call'`), true);
      const caption = await ev(`return document.querySelector('${q}[data-graph-caption]').textContent`);
      for (const value of [call.tool, 'with the slice: ' + call.on.decision, 'trace only: ' + call.off.decision]) assert.ok(caption.includes(value));
    }
    await ev('window.graphHandle.trace("X1Bb")');
    const trace = model.traces.find(t => t.id === 'X1Bb'), call = trace.calls.find(c => c.index === trace.deciding);
    assert.equal(await ev(`return document.querySelectorAll('${q}[data-graph-node]').length`), call.facts.nodes.length);
    assert.equal(await ev(`return document.querySelector('${q}[data-graph-empty]').hidden`), true);
    assert.equal((await finiteState()).finite, true);
    assert.deepEqual(errors(), []);
  });
});

test('drawing failures are reported separately from library load failures', async t => {
  await withGraphPage(t, async ({ ev, go, errors }) => {
    await go('#view=overview');
    await mountDirect(ev);
    await ev(`await window.graphHandle.ensure();
      const { mountOntoGraph } = await import('/js/rt-onto-graph.js');
      const el = document.createElement('div'); el.id = 'brokenGraph'; document.querySelector('#overview').appendChild(el);
      const library = { ...window.d3, forceSimulation() { throw new Error('Drawing failure control'); } };
      const handle = mountOntoGraph(el, window.graphModel, { loadD3: async () => library });
      await handle.ensure()`);
    assert.equal(await ev('return document.querySelector("#brokenGraph [data-graph-status]").textContent'), 'The graph could not be drawn.');
    assert.equal(await ev('return !!document.querySelector("#brokenGraph [data-graph-retry]")'), false);
    assert.ok(errors().some(e => e.includes('Drawing failure control')), 'drawing error is logged');
    assert.deepEqual(errors().filter(e => !e.includes('Drawing failure control')), []);
  });
});

test('the diagnostic collector catches invalid SVG attribute errors', async t => {
  await withGraphPage(t, async ({ ev, go, errors }) => {
    await go('#view=overview');
    await ev(`const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const g = document.createElementNS(svg.namespaceURI, 'g'); svg.appendChild(g); document.body.appendChild(svg);
      g.setAttribute('transform', 'translate(NaN,NaN)'); svg.remove()`);
    await until(() => errors().some(e => /attribute transform.*Expected number/i.test(e)), 'SVG diagnostic captured');
  });
});
