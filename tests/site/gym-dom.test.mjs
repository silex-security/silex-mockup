// mountView reconciles each render into the live DOM in headless Chrome: identity, handlers, user-owned state and
// widgets that keep working after a store notification. Skips with a clear message when no Chrome binary exists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openGym } from '../../tools/gym-shot.mjs';

async function withGym(t, fn, { width = 1440, height = 1000 } = {}) {
  let gym;
  try { gym = await openGym(); } catch (e) {
    if (/Chrome not found/.test(e.message)) return t.skip('no Chrome binary (set CHROME); headless check skipped');
    throw e;
  }
  try {
    await gym.size(width, height);
    await gym.go('#/kit');
    await gym.ev('localStorage.clear()');
    await fn(gym);
    assert.deepEqual(gym.problems(), [], 'no page errors and no failed requests');
  } finally { await gym.close(); }
}

const BUMP = 'window.__gym.store.dispatch(state => ({ state: { ...state, seq: state.seq + 1 } }), {});';
const PROBE = `
  const { h, mountView } = await import('./js/components/dom.js');
  const root = document.createElement('div'); document.querySelector('.gym-main').append(root);
  const bump = () => { ${BUMP} };
`;

test('a re-render keeps each matching element, updates its text and attributes, and the new handler is the one that fires', async t => withGym(t, async gym => {
  const out = await gym.ev(`${PROBE}
    const fired = [];
    const view = mountView(root, state => h('div', { class: 'probe seq-' + state.seq },
      h('button', { dataset: { focusKey: 'probe:go' }, onClick: () => fired.push(state.seq) }, 'Go ' + state.seq),
      h('span', 'plain ' + state.seq)), window.__gym.store);
    const box = root.firstChild, btn = root.querySelector('button'), span = root.querySelector('span');
    const seq0 = window.__gym.store.getState().seq;
    bump();
    const same = [box === root.firstChild, btn === root.querySelector('button'), span === root.querySelector('span')];
    btn.click();
    const result = { same, text: [btn.textContent, span.textContent], cls: box.className, fired, seq0 };
    view.destroy();
    return result;`);
  assert.deepEqual(out.same, [true, true, true], 'the container, the keyed button and the unkeyed span survive');
  assert.deepEqual(out.text, [`Go ${out.seq0 + 1}`, `plain ${out.seq0 + 1}`]);
  assert.equal(out.cls, `probe seq-${out.seq0 + 1}`);
  assert.deepEqual(out.fired, [out.seq0 + 1], 'the click runs the handler from the latest render, once');
}));

test('a <details> the user opened stays open across a store notification, and a render that changes open still wins', async t => withGym(t, async gym => {
  const out = await gym.ev(`${PROBE}
    let forced = null;
    const view = mountView(root, () => h('details', { open: forced ?? false }, h('summary', 'More'), h('p', 'body')), window.__gym.store);
    const d = root.querySelector('details');
    d.open = true;
    bump();
    const kept = [d === root.querySelector('details'), d.open];
    forced = false; bump();
    const stillOpen = d.open;
    forced = true; bump(); forced = false; bump();
    const closedByRender = d.open;
    view.destroy();
    return { kept, stillOpen, closedByRender };`);
  assert.deepEqual(out.kept, [true, true], 'the same element, still open');
  assert.equal(out.stillOpen, true, 'a render that keeps open=false does not close it');
  assert.equal(out.closedByRender, false, 'a render that moves open from true to false closes it');
}));

test('a typed value in the focused field survives a re-render that did not change it; unfocused fields follow the render', async t => withGym(t, async gym => {
  const out = await gym.ev(`${PROBE}
    let stored = 'saved';
    const view = mountView(root, () => [
      h('input', { value: stored, dataset: { focusKey: 'probe:a' } }),
      h('input', { value: stored, dataset: { focusKey: 'probe:b' } })], window.__gym.store);
    const [a, b] = root.querySelectorAll('input');
    a.focus(); a.value = 'typed here'; a.setSelectionRange(3, 5);
    b.value = 'stray';
    bump();
    const kept = { same: a === root.querySelector('input'), value: a.value, caret: [a.selectionStart, a.selectionEnd], focused: document.activeElement === a, other: b.value };
    stored = 'from store'; bump();
    const changed = a.value;
    view.destroy();
    return { kept, changed };`);
  assert.deepEqual(out.kept, { same: true, value: 'typed here', caret: [3, 5], focused: true, other: 'saved' });
  assert.equal(out.changed, 'from store', 'a render that changes the value replaces what was typed');
}));

test('a mouse press held across a store notification still clicks the workbench control it started on', async t => withGym(t, async gym => {
  await gym.size(1585, 992);
  await gym.go('#/workbench/exp-029');
  const key = 'wb:sc-x:sc-base-case';
  const [x, y] = await gym.ev(`const b = document.querySelector('[data-focus-key="${key}"]'); b.scrollIntoView({ block: 'center' });
    window.__before = b; const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2];`);
  await gym.page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await gym.page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await gym.ev(BUMP);
  await gym.page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  const out = await gym.ev(`await new Promise(r => requestAnimationFrame(r)); const b = document.querySelector('[data-focus-key="${key}"]');
    return { same: b === window.__before, expanded: b.getAttribute('aria-expanded') };`);
  assert.deepEqual(out, { same: true, expanded: 'true' }, 'the toggle survived the re-render and the release clicked it');
}));

test('widgets keep working after a re-render: tabs move with the arrow keys and a popover menu stays open across a tick', async t => withGym(t, async gym => {
  await gym.size(1568, 1003);
  await gym.go('#/environments/new?returnTo=exp-029');
  await gym.ev(`${BUMP} document.querySelector('[data-focus-key="env:tab:topology"]').focus();`);
  await gym.key('ArrowRight');
  const tabs = await gym.ev(`await new Promise(r => requestAnimationFrame(r));
    return { focused: document.activeElement.dataset.focusKey, selected: document.querySelector('.env-tabs [aria-selected="true"]').dataset.tab, query: window.__gym.router.current().query.tab };`);
  assert.deepEqual(tabs, { focused: 'env:tab:tools', selected: 'tools', query: 'tools' });

  await gym.go('#/scenarios/new?environment=env-sales@1.2&workflow=wf-sales-follow-up');
  await gym.ev(`${BUMP} document.querySelector('[data-focus-key="sc:chat-menu"]').focus();`);
  await gym.key('ArrowDown');
  await gym.ev(BUMP);
  await gym.key('ArrowDown');
  const menu = await gym.ev(`const m = document.querySelector('.sc-chat [role="menu"]');
    return { open: !m.hidden, expanded: document.querySelector('[data-focus-key="sc:chat-menu"]').getAttribute('aria-expanded'), focused: document.activeElement.textContent };`);
  assert.deepEqual(menu, { open: true, expanded: 'true', focused: 'Show differencesBase against the selected variations' });
  await gym.key('Escape');
  assert.deepEqual(await gym.ev(`return [document.querySelector('.sc-chat [role="menu"]').hidden, document.activeElement.dataset.focusKey]`), [true, 'sc:chat-menu']);
}));

test('with the live clock, workbench controls keep their identity across three ticks while the queue progress updates', async t => withGym(t, async gym => {
  await gym.size(1585, 992);
  await gym.go('#/workbench/exp-029', { search: '' });
  const out = await gym.ev(`
    const progress = () => document.querySelector('.wb-qrow .gym-progress__text')?.textContent;
    const controls = [...document.querySelectorAll('.gym-main button, .gym-main input, .gym-main select, .gym-main a')];
    const done = () => window.__gym.store.getState().executions['attempt-002'].length;
    const start = done(), seen = [progress()];
    const deadline = Date.now() + 6000;
    while (done() - start < 3 && Date.now() < deadline) { await new Promise(r => setTimeout(r, 100)); if (progress() !== seen.at(-1)) seen.push(progress()); }
    return { ticks: done() - start, seen, total: controls.length, lost: controls.filter(el => !el.isConnected).length };`);
  assert.ok(out.ticks >= 3, `the scheduler ticked three times (${out.ticks})`);
  assert.ok(out.seen.length >= 4, `the progress text changed on each tick: ${out.seen.join(' → ')}`);
  assert.ok(out.total > 40, 'the probe saw the workbench controls');
  assert.equal(out.lost, 0, 'no control was replaced by a tick');
}));
