// Agent Gym v2 shell in headless Chrome: header, routing, persistence banner, reset dialog, UI kit, responsive frame.
// Drives the page through tools/gym-shot.mjs. Skips with a clear message when no Chrome binary exists (set CHROME).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openGym } from '../../tools/gym-shot.mjs';
import { STORAGE_KEY } from '../../agent-gym/js/model.js';

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
      live: document.querySelector('[aria-live="polite"]') !== null, banner: document.querySelector('.gym-persistence') !== null,
      h1: document.querySelectorAll('h1').length, title: document.title, mode: window.__gym.store.persistence.mode,
      api: [typeof window.__gym.router.go, typeof window.__gym.store.dispatch], bodyClass: document.body.className,
      font: getComputedStyle(document.body).fontFamily.split(',')[0] };`);
  assert.equal(page.hash, '#/workbench/exp-029');
  assert.deepEqual(page.links, [['Agent Studio', '../index.html#view=blueprint', null], ['Speedrun', '../index.html#view=speedrun', null], ['Agent Gym', '#/workbench/exp-029', 'page']]);
  assert.equal(page.logo, 'SILEX');
  assert.equal(page.workspace, 'Acme workspace');
  assert.equal(page.mark, 'Concept preview · Simulated data');
  assert.deepEqual([page.live, page.banner, page.h1, page.mode], [true, false, 1, 'local']);
  assert.match(page.title, /Agent Gym/);
  assert.deepEqual(page.api, ['function', 'function']);
  assert.equal(page.bodyClass, 'gym-app');
  assert.equal(page.font, 'Inter');
}));

test('every route mounts a view with the marker, and refresh, Back and Forward restore the same route and query', async t => withGym(t, async gym => {
  const routes = ['#/workbench/exp-029', '#/environments', '#/environments/new?returnTo=exp-029&focus=describe', '#/environments/env-sales/revisions/1.2',
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
  assert.equal(await gym.ev('return location.hash + " | " + document.querySelector(".gym-main h1").textContent'), `${routes[7]} | Run`);
  await gym.ev(`history.forward(); ${frame} await new Promise(r => setTimeout(r, 150));`);
  assert.equal(await gym.ev('return document.querySelector(".gym-main h1").textContent'), 'Results');

  await gym.go('#/environments/new?returnTo=https%3A%2F%2Fevil.example&focus=describe');
  assert.deepEqual(await gym.ev('return window.__gym.router.current().query'), { focus: 'describe' });
  assert.doesNotMatch(await gym.ev('return document.querySelector(".gym-main").textContent'), /evil/);

  await gym.go('#/workbench/%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E');
  const lost = await gym.ev('return { text: document.querySelector(".gym-main").textContent, back: document.querySelector(".gym-main a").getAttribute("href"), imgs: document.querySelectorAll("img").length }');
  assert.match(lost.text, /Page not found/);
  assert.equal(lost.back, '#/workbench/exp-029');
  assert.equal(lost.imgs, 0);
}));

test('unreadable saved data shows a dismissible memory-mode banner, and Reset demo data repairs only the Gym key', async t => withGym(t, async gym => {
  await gym.ev(`localStorage.setItem(${KEY}, '{broken'); localStorage.setItem('bs.other', 'keep me');`);
  await gym.go('#/kit');
  const banner = await gym.ev(`const el = document.querySelector('.gym-persistence'); return { text: el?.textContent, role: el?.getAttribute('role'), mode: window.__gym.store.persistence.mode, code: window.__gym.store.persistence.error?.code }`);
  assert.match(banner.text, /Not saving\..*not being saved/);
  assert.deepEqual([banner.role, banner.mode, banner.code], ['alert', 'memory', 'storage_corrupt']);
  await gym.ev(`document.querySelector('.gym-persistence [aria-label="Dismiss"]').click()`);
  assert.equal(await gym.ev('return document.querySelector(".gym-persistence") === null && window.__gym.store.persistence.mode'), 'memory');

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
  const closed = await gym.ev(`return { dialogs: document.querySelectorAll('dialog').length, focus: document.activeElement.className, raw: localStorage.getItem(${KEY}), mode: window.__gym.store.persistence.mode }`);
  assert.equal(closed.dialogs, 0);
  assert.match(closed.focus, /gym-workspace/, 'focus returns to the control that opened the menu');
  assert.deepEqual([closed.raw, closed.mode], ['{broken', 'memory'], 'Escape resets nothing');

  const done = await gym.ev(`${openReset} [...document.querySelectorAll('dialog.gym-dialog button')].find(b => b.textContent === 'Reset demo data').click(); ${frame}
    const saved = JSON.parse(localStorage.getItem(${KEY}));
    return { dialogs: document.querySelectorAll('dialog').length, schema: saved.schemaVersion, other: localStorage.getItem('bs.other'), keys: localStorage.length,
      mode: window.__gym.store.persistence.mode, error: window.__gym.store.persistence.error, banner: document.querySelector('.gym-persistence') !== null, live: document.querySelector('[aria-live="polite"]').textContent }`);
  assert.deepEqual(done, { dialogs: 0, schema: 2, other: 'keep me', keys: 2, mode: 'local', error: null, banner: false, live: 'Demo data reset.' });
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
