// Second-level sub-tabs inside a Runtime Observation tab (logs/2026-10-11_RT_SUBTABS_VISUAL_PLAN.md, shared contract 1).
// A tablist of numbered buttons over [data-rt-subpanel] panels, each panel but the last ending in a "Next: …" button.
// The bar owns its panels' animation lifecycle: bind(key, handle) plays the handle once, the first time that sub-tab is
// really shown (Runtime Observation view active, this tab current, this sub-tab current), and pauses it whenever it stops
// being shown; coming back never replays. #view=runtime-observation&tab=<tab>&sub=<key> opens one (js/rt-subtabs.js calls
// requestSub); clicks never write the hash, like the rest of the site. No DOM access at module top level.

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const BADGE = ['①', '②', '③', '④', '⑤', '⑥'];
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * @param {HTMLElement} navEl  the element to render the tablist into
 * @param {{ tab: string, label: string, items: {key: string, label: string, hint?: string, extra?: string, attrs?: Record<string,string>}[], panels: HTMLElement, initial?: string }} cfg
 */
export function mountSubnav(navEl, { tab, label, items, panels, initial }) {
  const keys = items.map(i => i.key);
  const init = keys.includes(initial) ? initial : keys[0];
  const id = k => `rtSub-${tab}-${k}`;
  const attrs = a => Object.entries(a ?? {}).map(([k, v]) => ` ${esc(k)}="${esc(v)}"`).join('');
  navEl.classList.add('rt-subnav');
  navEl.setAttribute('role', 'tablist');
  navEl.setAttribute('aria-label', label);
  navEl.innerHTML = items.map((it, i) => `<button type="button" role="tab" id="${id(it.key)}" data-rt-sub="${esc(it.key)}"${attrs(it.attrs)}
    aria-selected="false" tabindex="-1"${it.hint ? ` aria-describedby="${id(it.key)}-hint"` : ''}><span class="rt-subnav-n" aria-hidden="true">${BADGE[i] ?? i + 1}</span><span class="rt-subnav-t"><b>${esc(it.label)}${it.extra ?? ''}</b>${it.hint ? `<small id="${id(it.key)}-hint">${esc(it.hint)}</small>` : ''}</span></button>`).join('');
  const buttons = [...navEl.querySelectorAll('[data-rt-sub]')];
  const panelOf = k => [...panels.children].find(p => p.dataset.rtSubpanel === k) ?? null;
  items.forEach((it, i) => {
    const p = panelOf(it.key);
    if (!p) return;
    p.setAttribute('role', 'tabpanel');
    p.id ||= `${id(it.key)}-panel`;
    p.setAttribute('aria-labelledby', id(it.key));
    buttons[i].setAttribute('aria-controls', p.id);
    const nxt = items[i + 1];
    if (nxt && !p.querySelector(':scope > .rt-subnav-next')) {
      p.insertAdjacentHTML('beforeend', `<div class="rt-subnav-next"><button type="button" class="btn secondary" data-rt-sub-next="${esc(nxt.key)}">Next: ${esc(nxt.label)} →</button></div>`);
    }
  });

  // Lifecycle (contract 1): one handle per key; played once on first real show, paused on every hide.
  const bound = new Map(), played = new Set();
  let cur = null, shownKey = null;
  const viewActive = () => { const v = navEl.closest('.view'); return !v || v.classList.contains('active'); };
  const tabActive = () => { const p = navEl.closest('[data-rt-panel]'); return !p || (!p.hidden && (window.__rtTabs?.current?.() ?? tab) === tab); };
  const isShown = key => key === cur && viewActive() && tabActive();
  function sync() {
    const now = isShown(cur) ? cur : null;
    if (shownKey && shownKey !== now) bound.get(shownKey)?.pause?.();
    shownKey = now;
    if (now && !played.has(now) && bound.has(now)) { played.add(now); if (!reduced()) bound.get(now).play?.(); }
  }

  function open(key, { focus = false } = {}) {
    if (!keys.includes(key)) key = init;
    cur = key;
    // Focus moves to the new tab before the old panel hides, so focus never sits in a hidden panel.
    for (const b of buttons) {
      const on = b.dataset.rtSub === key;
      b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    }
    for (const it of items) { const p = panelOf(it.key); if (p) p.hidden = it.key !== key; }
    document.dispatchEvent(new CustomEvent('rt:sub', { detail: { tab, sub: key } }));
    sync();
  }
  const onClick = e => {
    const b = e.target.closest('[data-rt-sub]');
    if (b && navEl.contains(b)) open(b.dataset.rtSub);
  };
  const onKey = e => {
    const i = keys.indexOf(cur);
    const n = { ArrowRight: i + 1, ArrowLeft: i - 1 + keys.length, Home: 0, End: keys.length - 1 }[e.key];
    if (n == null) return;
    e.preventDefault(); open(keys[n % keys.length], { focus: true });
  };
  const onNext = e => {
    const b = e.target.closest('[data-rt-sub-next]');
    if (!b || !panels.contains(b)) return;
    open(b.dataset.rtSubNext, { focus: true });
    navEl.scrollIntoView?.({ block: 'nearest' });
  };
  // A tab change or a view change can show or hide this bar without a sub-tab change (index.html showView fires rt:view).
  const onOuter = () => sync();
  // At phone widths the bar scrolls inside itself; keep the focused tab in view.
  const onFocus = e => { const b = e.target.closest?.('[data-rt-sub]'); if (b) b.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); };
  navEl.addEventListener('click', onClick);
  navEl.addEventListener('keydown', onKey);
  navEl.addEventListener('focusin', onFocus);
  panels.addEventListener('click', onNext);
  document.addEventListener('rt:tab', onOuter);
  document.addEventListener('rt:view', onOuter);

  const api = {
    open, current: () => cur, initial: init, isShown,
    /** Attach a panel's animation handle ({ play, pause, … }); plays now if its sub-tab is already shown and unplayed. */
    bind(key, handle) { if (!handle || !keys.includes(key)) return; bound.set(key, handle); if (shownKey === key) shownKey = null; sync(); },
    destroy() {
      navEl.removeEventListener('click', onClick); navEl.removeEventListener('keydown', onKey); navEl.removeEventListener('focusin', onFocus); panels.removeEventListener('click', onNext);
      document.removeEventListener('rt:tab', onOuter); document.removeEventListener('rt:view', onOuter);
      bound.clear();
      if (window.__rtSubnav?.[tab] === api) delete window.__rtSubnav[tab];
    },
  };
  (window.__rtSubnav ||= {})[tab] = api;
  // A deep link that arrived before this bar existed (fleet renders on first open; ontology waits for its data) applies now.
  const pending = window.__rtSubPending?.[tab];
  if (pending != null) delete window.__rtSubPending[tab];
  open(pending ?? init);
  return api;
}

/** Open a sub-tab now if its bar exists, otherwise when it mounts; a later request replaces an unconsumed one. */
export function requestSub(tab, key) {
  if (typeof window === 'undefined') return;
  const api = window.__rtSubnav?.[tab];
  if (api) api.open(key);
  else (window.__rtSubPending ||= {})[tab] = key;
}
