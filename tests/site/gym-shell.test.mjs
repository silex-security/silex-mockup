// Agent Gym v2 shell in headless Chrome: header, routing, no storage warnings, reset dialog, UI kit, responsive frame.
// Drives the page through tools/gym-shot.mjs. Skips with a clear message when no Chrome binary exists (set CHROME).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openGym } from '../../tools/gym-shot.mjs';
import { STORAGE_KEY } from '../../agent-gym/js/model.js';
import { trail } from '../../agent-gym/js/components/ui.js';

const GYM = resolve(dirname(fileURLToPath(import.meta.url)), '../../agent-gym');
const KEY = JSON.stringify(STORAGE_KEY);

async function withGym(t, fn) {
  let gym;
  try { gym = await openGym(); } catch (e) {
    if (/Chrome not found/.test(e.message)) return t.skip('no Chrome binary (set CHROME); headless check skipped');
    throw e;
  }
  try {
    await gym.size(1440, 1000);
    await gym.go('#/kit');
    await gym.ev('localStorage.clear()');
    await fn(gym);
    assert.deepEqual(gym.problems(), [], 'no page errors and no failed requests');
  } finally { await gym.close(); }
}
const frame = 'await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));';

test('shell and shared CSS is scoped under .gym-app, and all six stylesheets exist', () => {
  for (const file of ['tokens.css', 'shell.css', 'workbench.css', 'environment.css', 'scenario.css', 'run-results.css']) {
    const css = readFileSync(join(GYM, 'css', file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/url\("[^"]*"\)/g, 'url()');
    const selectors = [...css.matchAll(/(^|[{}])\s*([^{}@]+?)\s*\{/g)].flatMap(m => m[2].split(',')).map(s => s.trim()).filter(Boolean);
    for (const selector of selectors) assert.match(selector, /^\.gym-app(?![\w-])/, `${file}: "${selector}"`);
    if (file === 'shell.css') assert.ok(selectors.length > 150, 'the selector scan found the widget rules');
  }
});

test('index.html links the six stylesheets and the app module, and no script assigns innerHTML', () => {
  const html = readFileSync(join(GYM, 'index.html'), 'utf8');
  for (const file of ['tokens', 'shell', 'workbench', 'environment', 'scenario', 'run-results']) assert.ok(html.includes(`href="css/${file}.css"`), file);
  assert.match(html, /<script type="module" src="js\/app\.js">/);
  assert.match(html, /<body class="gym-app">/);
  const scripts = ['', 'components', 'views'].flatMap(dir => readdirSync(join(GYM, 'js', dir)).filter(f => f.endsWith('.js')).map(f => join(GYM, 'js', dir, f)));
  assert.ok(scripts.length >= 18);
  for (const file of scripts) assert.doesNotMatch(readFileSync(file, 'utf8').replace(/^\s*\/\/.*$/gm, ''), /innerHTML|outerHTML|insertAdjacentHTML|document\.write/, file);
});

test('the header, the preview marker and the default route', async t => withGym(t, async gym => {
  await gym.go('');
  const page = await gym.ev(`
    const links = [...document.querySelectorAll('.gym-nav__link')].map(a => [a.textContent, a.getAttribute('href'), a.getAttribute('aria-current')]);
    return { hash: location.hash, links, logo: document.querySelector('.gym-logo').textContent,
      workspace: document.querySelector('.gym-workspace').textContent, mark: document.querySelector('.gym-preview-mark').textContent,
      live: document.querySelector('[aria-live="polite"]') !== null,
      h1: document.querySelectorAll('h1').length, title: document.title, mode: window.__gym.store.persistence.mode,
      api: [typeof window.__gym.router.go, typeof window.__gym.store.dispatch], bodyClass: document.body.className,
      font: getComputedStyle(document.body).fontFamily.split(',')[0] };`);
  assert.equal(page.hash, '#/experiments');
  assert.deepEqual(page.links, [['Agent Studio', '../index.html#view=blueprint', null], ['Speedrun', '../index.html#view=speedrun', null], ['Agent Gym', '#/experiments', 'page']]);
  assert.equal(page.logo, 'SILEX');
  assert.equal(page.workspace, 'Acme workspace');
  assert.equal(page.mark, 'Concept preview · Simulated data');
  assert.deepEqual([page.live, page.h1, page.mode], [true, 1, 'local']);
  assert.match(page.title, /Agent Gym/);
  assert.deepEqual(page.api, ['function', 'function']);
  assert.equal(page.bodyClass, 'gym-app');
  assert.equal(page.font, 'Inter');
}));

test('every route mounts a view with the marker, and refresh, Back and Forward restore the same route and query', async t => withGym(t, async gym => {
  const routes = ['#/experiments?status=all', '#/workbench/exp-029', '#/environments', '#/environments/new?returnTo=exp-029&focus=describe', '#/environments/env-sales/revisions/1.2',
    '#/scenarios/new?environment=env-sales@1.2&workflow=wf-sales-follow-up&source=chat&mode=prompt', '#/scenario-sets/set-follow-up-resilience/revisions/1',
    '#/runs?status=all', '#/experiments/exp-029/attempts/attempt-001', '#/experiments/exp-029/attempts/attempt-001/results'];
  const seen = [];
  for (const hash of routes) {
    await gym.ev(`location.hash = ${JSON.stringify(hash)}; ${frame}`);
    seen.push(await gym.ev(`return { hash: location.hash, h1: document.querySelector('.gym-main h1')?.textContent || '', mark: !!document.querySelector('.gym-preview-mark'), crumb: !!document.querySelector('.gym-main [aria-label="Breadcrumb"]'), focus: document.activeElement.id }`));
  }
  assert.deepEqual(seen.map(s => s.hash), routes);
  assert.equal(new Set(seen.map(s => s.h1)).size, routes.length, `each route has its own title: ${seen.map(s => s.h1)}`);
  assert.ok(seen.every(s => s.mark && s.crumb && s.h1));
  assert.ok(seen.slice(1).every(s => s.focus === 'gym-main'), 'focus moves to the main region on navigation');

  await gym.ev(`history.back(); ${frame} await new Promise(r => setTimeout(r, 150));`);
  assert.equal(await gym.ev('return location.hash + " | " + document.querySelector(".gym-main h1").textContent'), `${routes[8]} | Run`);
  await gym.ev(`history.forward(); ${frame} await new Promise(r => setTimeout(r, 150));`);
  assert.equal(await gym.ev('return document.querySelector(".gym-main h1").textContent'), 'Results');

  await gym.go('#/environments/new?returnTo=https%3A%2F%2Fevil.example&focus=describe');
  assert.deepEqual(await gym.ev('return window.__gym.router.current().query'), { focus: 'describe' });
  assert.doesNotMatch(await gym.ev('return document.querySelector(".gym-main").textContent'), /evil/);

  await gym.go('#/workbench/%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E');
  const lost = await gym.ev('return { text: document.querySelector(".gym-main").textContent, back: document.querySelector(".gym-main a").getAttribute("href"), imgs: document.querySelectorAll("img").length }');
  assert.match(lost.text, /Page not found/);
  assert.equal(lost.back, '#/experiments');
  assert.equal(lost.imgs, 0);
}));

const WARNING = /not being saved|Not saving|different version/i;
const STALE = { corrupt: '{broken', 'an old fixture version': '{"schemaVersion":1,"fixtureVersion":"gym-fx-0"}' };
for (const [label, blob] of Object.entries(STALE)) {
  test(`saved data that is ${label} is replaced without a warning`, async t => withGym(t, async gym => {
    await gym.ev(`localStorage.setItem(${KEY}, ${JSON.stringify(blob)}); localStorage.setItem('bs.other', 'keep me');`);
    await gym.go('#/workbench/exp-029');
    const page = await gym.ev(`const saved = JSON.parse(localStorage.getItem(${KEY}));
      return { banner: document.querySelector('.gym-persistence') !== null, warning: ${WARNING}.test(document.body.textContent), mode: window.__gym.store.persistence.mode,
        schema: saved.schemaVersion, fixture: saved.fixtureVersion, other: localStorage.getItem('bs.other') }`);
    assert.deepEqual(page, { banner: false, warning: false, mode: 'local', schema: 2, fixture: await gym.ev('return window.__gym.store.getState().fixtureVersion'), other: 'keep me' });
    await gym.go('#/workbench/exp-029');
    assert.equal(await gym.ev(`return ${WARNING}.test(document.body.textContent) || document.querySelector('.gym-persistence') !== null`), false, 'a second load is clean too');
  }));
}

test('Reset demo data repairs only the Gym key', async t => withGym(t, async gym => {
  await gym.ev(`localStorage.setItem('bs.other', 'keep me');`);
  await gym.go('#/kit');
  const rename = `window.__gym.store.dispatch(s => ({ state: { ...s, experiments: { ...s.experiments, 'exp-029': { ...s.experiments['exp-029'], title: 'Scratch' } } } }), {});`;
  await gym.ev(rename);
  const title = `JSON.parse(localStorage.getItem(${KEY})).experiments['exp-029'].title`;
  assert.equal(await gym.ev(`return ${title}`), 'Scratch');

  const openReset = `document.querySelector('.gym-workspace').focus(); document.querySelector('.gym-workspace').click();
    const item = [...document.querySelectorAll('.gym-header [role="menuitem"]')].find(b => b.textContent.includes('Reset demo data'));
    const menuOpen = !document.querySelector('.gym-header [role="menu"]').hidden; item.click(); ${frame}`;
  const opened = await gym.ev(`${openReset} const d = document.querySelector('dialog.gym-dialog');
    return { menuOpen, menuClosed: document.querySelector('.gym-header [role="menu"]').hidden, open: d?.open, modal: d?.matches(':modal'), inside: d?.contains(document.activeElement), focus: document.activeElement.textContent, title: d?.querySelector('h2').textContent, labelled: d?.getAttribute('aria-labelledby') === d?.querySelector('h2').id }`);
  assert.deepEqual(opened, { menuOpen: true, menuClosed: true, open: true, modal: true, inside: true, focus: 'Cancel', title: 'Reset demo data?', labelled: true });

  const trail = [];
  for (const shift of [false, false, false, true, true]) {
    await gym.key('Tab', { shift });
    trail.push(await gym.ev('const d = document.querySelector("dialog.gym-dialog"); return d.contains(document.activeElement) ? document.activeElement.textContent : "ESCAPED"'));
  }
  assert.deepEqual(trail, ['Reset demo data', 'Cancel', 'Reset demo data', 'Cancel', 'Reset demo data'], 'Tab and Shift+Tab stay inside the dialog');

  await gym.key('Escape');
  await gym.ev(frame);
  const closed = await gym.ev(`return { dialogs: document.querySelectorAll('dialog').length, focus: document.activeElement.className, title: ${title}, mode: window.__gym.store.persistence.mode }`);
  assert.equal(closed.dialogs, 0);
  assert.match(closed.focus, /gym-workspace/, 'focus returns to the control that opened the menu');
  assert.deepEqual([closed.title, closed.mode], ['Scratch', 'local'], 'Escape resets nothing');

  const done = await gym.ev(`${openReset} [...document.querySelectorAll('dialog.gym-dialog button')].find(b => b.textContent === 'Reset demo data').click(); ${frame}
    const saved = JSON.parse(localStorage.getItem(${KEY}));
    return { dialogs: document.querySelectorAll('dialog').length, title: ${title}, other: localStorage.getItem('bs.other'), keys: localStorage.length,
      mode: window.__gym.store.persistence.mode, banner: document.querySelector('.gym-persistence') !== null, live: document.querySelector('[aria-live="polite"]').textContent }`);
  assert.deepEqual(done, { dialogs: 0, title: 'Experiment 029', other: 'keep me', keys: 2, mode: 'local', banner: false, live: 'Demo data reset.' });
}));

test('the kit page renders every shared widget, and tabs, menus and disabled controls work from the keyboard', async t => withGym(t, async gym => {
  await gym.go('#/kit');
  const classes = ['gym-btn--primary', 'gym-btn--secondary', 'gym-btn--outline', 'gym-btn--ghost', 'gym-btn--link', 'gym-btn--danger', 'gym-btn--icon', 'gym-badge', 'gym-chip', 'gym-chip--app', 'gym-appicon',
    'gym-tabs--segmented', 'gym-tabs--solid', 'gym-tabs--pill', 'gym-check', 'gym-input', 'gym-input--select', 'gym-input--area', 'gym-field', 'gym-panel', 'gym-card', 'gym-progress', 'gym-breadcrumb',
    'gym-menuwrap', 'gym-notice--info', 'gym-notice--warning', 'gym-notice--error', 'gym-notice--success', 'gym-empty', 'gym-cols', 'gym-footerbar', 'gym-pagehead'];
  const kit = await gym.ev(`
    const main = document.querySelector('.gym-main');
    const bar = main.querySelector('[role="progressbar"]');
    const off = [...main.querySelectorAll('.gym-btn[aria-disabled="true"]')];
    return { missing: ${JSON.stringify(classes)}.filter(c => !main.querySelector('.' + c)),
      badges: [...main.querySelectorAll('.gym-badge[data-status]')].map(b => b.textContent),
      bar: [bar.getAttribute('aria-valuenow'), bar.getAttribute('aria-valuemax'), bar.getAttribute('aria-valuetext'), bar.getAttribute('aria-label')],
      barWidth: Math.round(bar.firstChild.getBoundingClientRect().width / bar.getBoundingClientRect().width * 100),
      offReasons: off.map(b => b.title).every(Boolean) && off.length >= 3, nativeDisabled: off.some(b => b.disabled),
      unnamed: [...main.querySelectorAll('button, a, input, select, textarea')].filter(el => !(el.textContent.trim() || el.getAttribute('aria-label') || el.closest('label')?.textContent.trim())).map(el => el.outerHTML.slice(0, 80)),
      svgs: main.querySelectorAll('svg path').length, cols: getComputedStyle(main.querySelector('.gym-cols')).gridTemplateColumns.split(' ').length };`);
  assert.deepEqual(kit.missing, []);
  for (const label of ['Ready', 'Draft', 'Running', 'Queued', 'Completed', 'Review', 'Needs review', 'Same intent', 'Changed']) assert.ok(kit.badges.includes(label), label);
  assert.deepEqual(kit.bar, ['12', '18', '12/18', 'Sales follow-up · Variant A']);
  assert.equal(kit.barWidth, 67);
  assert.deepEqual([kit.offReasons, kit.nativeDisabled], [true, false], 'a disabled button stays focusable and carries its reason');
  assert.deepEqual(kit.unnamed, [], 'every control has an accessible name');
  assert.ok(kit.svgs > 100);
  assert.equal(kit.cols, 3);

  await gym.ev(`document.querySelector('[data-focus-key="kit:segmented:topology"]').focus()`);
  await gym.key('ArrowRight');
  await gym.key('ArrowRight');
  const tabs = await gym.ev(`const list = document.querySelector('.gym-tabs--segmented'); return { selected: list.querySelector('[aria-selected="true"]').textContent, focused: document.activeElement.textContent, stops: list.querySelectorAll('[tabindex="0"]').length, hash: location.hash, role: list.getAttribute('role') }`);
  assert.deepEqual(tabs, { selected: 'Data', focused: 'Data', stops: 1, hash: '#/kit?segmented=data', role: 'tablist' });
  await gym.go('#/kit?segmented=data');
  assert.equal(await gym.ev(`return document.querySelector('.gym-tabs--segmented [aria-selected="true"]').textContent`), 'Data', 'a refresh restores the tab from the route query');

  await gym.ev(`document.querySelector('[data-focus-key="kit:menu"]').focus()`);
  await gym.key('ArrowDown');
  const first = await gym.ev(`const m = document.querySelector('.gym-main [role="menu"]'); return [m.hidden, document.activeElement.textContent, document.querySelector('[data-focus-key="kit:menu"]').getAttribute('aria-expanded')]`);
  assert.deepEqual(first, [false, 'Duplicate', 'true']);
  await gym.key('ArrowDown');
  await gym.key('ArrowDown');
  assert.equal(await gym.ev('return document.activeElement.textContent'), 'Remove');
  await gym.key('Escape');
  assert.deepEqual(await gym.ev(`const m = document.querySelector('.gym-main [role="menu"]'); return [m.hidden, document.activeElement.dataset.focusKey]`), [true, 'kit:menu']);
  await gym.key('Enter');
  await gym.key('Enter');
  await gym.ev(frame);
  assert.deepEqual(await gym.ev(`return [document.querySelector('[data-kit-out]').textContent, document.querySelector('[aria-live="polite"]').textContent, document.activeElement.dataset.focusKey]`), ['Duplicate chosen', 'Duplicate chosen', 'kit:menu']);

  await gym.ev(`const b = [...document.querySelectorAll('.gym-main .gym-btn')].find(b => b.textContent === 'Save as template'); b.focus(); window.__focused = document.activeElement === b; b.click();`);
  assert.deepEqual(await gym.ev(`return [window.__focused, document.querySelector('[data-kit-out]').textContent]`), [true, 'Duplicate chosen'], 'a disabled button takes focus and ignores activation');

  await gym.ev(`document.querySelector('[data-focus-key="kit:dialog"]').focus()`);
  await gym.key('Enter');
  await gym.ev(frame);
  assert.equal(await gym.ev('return document.querySelector("dialog.gym-dialog")?.open'), true);
  await gym.key('Escape');
  await gym.ev(frame);
  assert.deepEqual(await gym.ev(`return [document.querySelectorAll('dialog').length, document.activeElement.dataset.focusKey, document.querySelector('[data-kit-out]').textContent]`), [0, 'kit:dialog', 'Dialog cancelled']);
}));

test('mountView restores focus, caret and scroll by key when a re-render replaces the elements', async t => withGym(t, async gym => {
  const out = await gym.ev(`
    const { h, mountView } = await import('./js/components/dom.js');
    const root = document.createElement('div'); document.querySelector('.gym-main').append(root);
    let renders = 0;
    const view = mountView(root, state => { renders++; return h(state.seq % 2 ? 'section' : 'div',
      h('input', { value: 'seq ' + state.seq + ' typed', dataset: { focusKey: 'probe:input' } }),
      h('div', { dataset: { scrollKey: 'probe:list' }, style: { height: '40px', overflow: 'auto' } }, h('div', { style: { height: '400px' } }, 'tall'))); }, window.__gym.store);
    const input = root.querySelector('input'); input.focus(); input.setSelectionRange(2, 4);
    root.querySelector('[data-scroll-key]').scrollTop = 120;
    window.__gym.store.dispatch(state => ({ state: { ...state, seq: state.seq + 1 } }), {});
    const next = root.querySelector('input');
    const result = { replaced: next !== input, focused: document.activeElement === next, caret: [next.selectionStart, next.selectionEnd], scroll: root.querySelector('[data-scroll-key]').scrollTop, renders, value: next.value };
    view.destroy();
    window.__gym.store.dispatch(state => ({ state: { ...state, seq: state.seq + 1 } }), {});
    return { ...result, afterDestroy: renders, emptied: root.childNodes.length };`);
  assert.equal(out.replaced, true);
  assert.deepEqual([out.focused, out.caret, out.scroll], [true, [2, 4], 120]);
  assert.match(out.value, /^seq \d+ typed$/);
  assert.deepEqual([out.renders, out.afterDestroy, out.emptied], [2, 2, 0], 'destroy unsubscribes and empties the root');
}));

test('a dialog returns focus to its opener by focus key when a re-render replaced the opener while it was open', async t => withGym(t, async gym => {
  const out = await gym.ev(`
    const { h, mountView } = await import('./js/components/dom.js');
    const { openDialog, button } = await import('./js/components/ui.js');
    const root = document.createElement('div'); document.querySelector('.gym-main').append(root);
    const view = mountView(root, state => h(state.seq % 2 ? 'section' : 'div', button({ label: 'Opener', focusKey: 'probe:opener' })), window.__gym.store);
    const before = root.querySelector('button'); before.focus();
    const dlg = openDialog({ title: 'Probe', actions: close => [button({ label: 'Done', onClick: () => close('done') })] });
    window.__gym.store.dispatch(state => ({ state: { ...state, seq: state.seq + 1 } }), {});
    const stillOpen = dlg.el.open && before.isConnected === false;
    dlg.close('done');
    ${frame}
    const after = root.querySelector('button');
    const result = { stillOpen, replaced: after !== before, focused: document.activeElement === after, dialogs: document.querySelectorAll('dialog').length };
    view.destroy();
    return result;`);
  assert.deepEqual(out, { stillOpen: true, replaced: true, focused: true, dialogs: 0 });
}));

test('no horizontal page scroll at 390, 768 and 1440px, and three columns stack below 1024px', async t => withGym(t, async gym => {
  for (const [width, columns] of [[390, 1], [768, 1], [1023, 1], [1024, 3], [1440, 3]]) {
    await gym.size(width, 900);
    for (const hash of ['#/kit', '#/workbench/exp-029', '#/nope']) {
      await gym.go(hash);
      const { win, doc } = await gym.overflow();
      assert.ok(doc <= win, `${hash} at ${width}px scrolls sideways: ${doc} > ${win}`);
    }
    await gym.go('#/kit');
    const frameInfo = await gym.ev(`return { cols: getComputedStyle(document.querySelector('.gym-cols')).gridTemplateColumns.split(' ').length, header: Math.round(document.querySelector('.gym-header').getBoundingClientRect().right), active: document.querySelector('.gym-nav__link[aria-current]').getBoundingClientRect().width > 40, workspace: document.querySelector('.gym-workspace').getBoundingClientRect().right }`);
    assert.equal(frameInfo.cols, columns, `${width}px`);
    assert.ok(frameInfo.header <= width && frameInfo.workspace <= width, `the header fits at ${width}px`);
    assert.ok(frameInfo.active);
  }
}));

test('prefers-reduced-motion turns shell transitions off', async t => withGym(t, async gym => {
  const duration = `return getComputedStyle(document.querySelector('.gym-btn')).transitionDuration`;
  await gym.go('#/kit');
  assert.notEqual(await gym.ev(duration), '0s');
  await gym.page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  assert.equal(await gym.ev(duration), '0s');
}));

test('the section tabs link the four parts of Agent Gym and mark the one that owns the route', async t => withGym(t, async gym => {
  const owners = [['#/experiments', 'Workbench'], ['#/workbench/exp-029', 'Workbench'], ['#/environments', 'Environments'], ['#/environments/new?returnTo=exp-029', 'Environments'],
    ['#/environments/env-sales/revisions/1.2', 'Environments'], ['#/scenarios', 'Scenarios'], ['#/scenarios/new?environment=env-sales@1.2&workflow=wf-sales-follow-up', 'Scenarios'],
    ['#/scenario-sets/set-follow-up-resilience/revisions/1', 'Scenarios'], ['#/runs?status=all', 'Runs & results'], ['#/experiments/exp-029/attempts/attempt-001', 'Runs & results'],
    ['#/experiments/exp-029/attempts/attempt-001/results', 'Runs & results'], ['#/kit', null], ['#/nope', null]];
  await gym.go('#/workbench/exp-029');
  const bar = await gym.ev(`const nav = document.querySelector('nav.gym-sections__nav');
    return { label: nav.getAttribute('aria-label'), links: [...nav.querySelectorAll('a')].map(a => [a.textContent, a.getAttribute('href')]),
      below: Math.round(nav.getBoundingClientRect().top) >= Math.round(document.querySelector('.gym-header').getBoundingClientRect().bottom) };`);
  assert.deepEqual(bar, { label: 'Agent Gym', below: true, links: [['Workbench', '#/experiments'], ['Environments', '#/environments'], ['Scenarios', '#/scenarios'], ['Runs & results', '#/runs?status=all']] });
  const marked = [];
  for (const [hash] of owners) {
    await gym.ev(`location.hash = ${JSON.stringify(hash)}; ${frame}`);
    marked.push([hash, await gym.ev(`const on = [...document.querySelectorAll('.gym-sections__link[aria-current="page"]')]; return on.length > 1 ? 'several' : on[0]?.textContent ?? null`)]);
  }
  assert.deepEqual(marked, owners);
  await gym.ev(`[...document.querySelectorAll('.gym-sections__link')].find(a => a.textContent === 'Scenarios').click(); ${frame}`);
  assert.deepEqual(await gym.ev('return [location.hash, document.querySelector(".gym-main h1").textContent]'), ['#/scenarios', 'Scenarios']);
}));

test('embed mode drops the product header, keeps the section tabs, and offers Reset demo data from the preview marker', async t => withGym(t, async gym => {
  await gym.go('#/runs?status=all', { search: '?clock=frozen&embed=1' });
  const page = await gym.ev(`const marks = [...document.querySelectorAll('.gym-preview-mark')].filter(el => el.checkVisibility()).map(el => el.textContent);
    return { header: !!document.querySelector('.gym-header, .gym-nav, .gym-workspace, .gym-logo'), top: Math.round(document.querySelector('.gym-sections').getBoundingClientRect().top),
      current: document.querySelector('.gym-sections__link[aria-current="page"]').textContent, marks, h1: document.querySelector('.gym-main h1').textContent };`);
  assert.deepEqual(page, { header: false, top: 0, current: 'Runs & results', marks: ['Concept preview · Simulated data'], h1: 'Runs' });
  await gym.ev(`localStorage.setItem(${KEY}, '{broken');`);
  await gym.go('#/workbench/exp-029', { search: '?clock=frozen&embed=1' });
  assert.equal(await gym.ev('return window.__gym.store.persistence.mode'), 'local');
  const opened = await gym.ev(`const trigger = document.querySelector('.gym-sections__mark'); trigger.focus(); trigger.click();
    const items = [...document.querySelectorAll('.gym-sections [role="menuitem"]')].map(b => b.textContent);
    [...document.querySelectorAll('.gym-sections [role="menuitem"]')].find(b => b.textContent.includes('Reset demo data')).click(); ${frame}
    return { items, dialog: document.querySelector('dialog.gym-dialog h2')?.textContent };`);
  assert.deepEqual(opened, { items: ['Open full pageAgent Gym on its own page, in a new tab.', 'Reset demo dataRestores the Agent Gym examples.'], dialog: 'Reset demo data?' });
  await gym.ev(`[...document.querySelectorAll('dialog.gym-dialog button')].find(b => b.textContent === 'Reset demo data').click(); ${frame}`);
  assert.deepEqual(await gym.ev(`return [window.__gym.store.persistence.mode, JSON.parse(localStorage.getItem(${KEY})).schemaVersion, document.querySelector('body > .gym-sr').textContent]`), ['local', 2, 'Demo data reset.']);
}));

test('the trail drops the root crumb when embedded, and a lone crumb that repeats the page title', () => {
  const root = { label: 'Agent Gym', href: '#/experiments' }, queue = { label: 'Experiment queue', href: '#/experiments' }, exp = { label: 'Experiment 029' };
  assert.deepEqual(trail([root, queue], true), [], 'one crumb left');
  assert.deepEqual(trail([root, queue, exp], true), [queue, exp], 'a deeper page keeps its trail without the root');
  assert.deepEqual(trail([root, queue, exp], false), [root, queue, exp], 'standalone is unchanged');
  assert.deepEqual(trail([root, queue], false), [root, queue]);
});

test('embedded landing pages show no breadcrumb and no Agent Gym, a deeper page keeps its trail; Open full page opens the same route standalone', async t => withGym(t, async gym => {
  const crumbs = () => gym.ev(`return [...document.querySelectorAll('.gym-main .gym-breadcrumb:not(.gym-sr) li')].map(li => li.textContent)`);
  const search = '?clock=frozen&embed=1';
  for (const hash of ['#/experiments', '#/environments', '#/scenarios', '#/runs?status=all']) {
    await gym.go(hash, { search });
    assert.deepEqual(await crumbs(), [], hash);
    assert.ok(!(await gym.ev(`return document.querySelector('.gym-main').textContent.includes('Agent Gym')`)), `${hash} has no Agent Gym in the page`);
  }
  await gym.go('#/experiments/exp-029/attempts/attempt-001', { search });
  const deep = await crumbs();
  assert.equal(deep.length, 2, 'Runs and the attempt');
  assert.equal(deep[0], 'Runs');
  await gym.go('#/runs?status=all', { search });
  const opened = await gym.ev(`const calls = []; window.open = (...a) => calls.push(a);
    document.querySelector('.gym-sections__mark').click();
    [...document.querySelectorAll('.gym-sections [role="menuitem"]')].find(b => b.textContent.startsWith('Open full page')).click();
    return calls;`);
  assert.deepEqual(opened, [[(await gym.ev('return location.pathname')) + '#/runs?status=all', '_blank', 'noopener']]);
  assert.doesNotMatch(opened[0][0], /embed/);
  await gym.go('#/runs?status=all');
  assert.deepEqual(await gym.ev(`return [...document.querySelectorAll('.gym-main .gym-breadcrumb li')].map(li => li.textContent)`), ['Agent Gym', 'Runs'], 'standalone keeps the full trail');
}));
