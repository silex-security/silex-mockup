/* Floating host navigation. Iframe documents keep their own input handlers. */
(() => {
  const app = document.querySelector('.app'), sidebar = document.getElementById('sidebar');
  const main = document.getElementById('main'), toggle = document.getElementById('navToggle');
  const pinButton = document.getElementById('navPin'), edge = document.getElementById('navEdge');
  const phone = matchMedia('(max-width:760px)'), reduced = matchMedia('(prefers-reduced-motion:reduce)');
  const KEY = 'silex.nav.pinned';
  let presentedPhone = phone.matches;
  let mode = 'auto', open = false, settled = true, input = 'pointer', pointerType = 'mouse';
  let timer = null, settleTimer = null, resizeTimer = null, resizeListener = null, resizeFrame = null;
  let overEdge = false;
  try { if (localStorage.getItem(KEY) === 'true') mode = 'pinned'; } catch {}
  const modal = () => !!document.querySelector('.modal-backdrop.open');
  const keyboardInside = () => input === 'keyboard' && sidebar.contains(document.activeElement);
  function clearTimer() { clearTimeout(timer); timer = null; }
  function state() { return { mode, open: phone.matches || mode === 'pinned' || open, settled: settled && presentedPhone === phone.matches, desktop: !phone.matches }; }
  function render() {
    presentedPhone = phone.matches;
    app.dataset.navMode = mode; app.dataset.navOpen = String(!phone.matches && open);
    sidebar.inert = !phone.matches && mode === 'auto' && !open;
    toggle.setAttribute('aria-expanded', String(state().open));
    pinButton.setAttribute('aria-pressed', String(mode === 'pinned'));
    const label = mode === 'pinned' ? 'Auto-hide sidebar' : 'Keep sidebar open';
    pinButton.setAttribute('aria-label', label); pinButton.title = label;
    clearTimeout(settleTimer);
    settled = phone.matches || reduced.matches;
    if (!settled) settleTimer = setTimeout(() => { settled = true; }, 220);
  }
  function releaseFocus(reason) {
    if (!sidebar.contains(document.activeElement)) return;
    if (reason === 'escape') toggle.focus({ preventScroll: true });
    else if (reason === 'selection' && input === 'keyboard') main.focus({ preventScroll: true });
    else document.activeElement.blur();
  }
  function close(reason = 'pointer') {
    if (modal()) return;
    clearTimer();
    if (phone.matches || mode === 'pinned' || !open) return;
    releaseFocus(reason); open = false; render();
  }
  function reveal(fromKeyboard = false) {
    if (modal()) return;
    clearTimer();
    if (phone.matches || mode === 'pinned') return;
    open = true; render();
    if (fromKeyboard) (sidebar.querySelector('.nav button.active') || sidebar.querySelector('.nav button'))?.focus({ preventScroll: true });
    else scheduleClose();
  }
  function scheduleClose() {
    if (modal() || phone.matches || mode === 'pinned') return;
    clearTimer();
    if (!open || keyboardInside()) return;
    timer = setTimeout(() => {
      timer = null;
      if (!modal() && !phone.matches && mode === 'auto' && !sidebar.matches(':hover') && !edge.matches(':hover') && !keyboardInside()) close();
    }, 350);
  }
  function cancelResize() {
    clearTimeout(resizeTimer); cancelAnimationFrame(resizeFrame);
    if (resizeListener) main.removeEventListener('transitionend', resizeListener);
    resizeListener = null;
  }
  function notifyResize() {
    cancelResize();
    const done = () => { cancelResize(); window.dispatchEvent(new Event('resize')); };
    if (reduced.matches || phone.matches) { resizeFrame = requestAnimationFrame(done); return; }
    resizeListener = e => { if (e.target === main && e.propertyName === 'margin-left') done(); };
    main.addEventListener('transitionend', resizeListener); resizeTimer = setTimeout(done, 260);
  }
  function pin(on) {
    if (modal() || phone.matches) return;
    clearTimer(); mode = on ? 'pinned' : 'auto';
    try { localStorage.setItem(KEY, String(on)); } catch { mode = 'auto'; }
    open = false;
    if (mode === 'auto') { app.dataset.navMode = mode; releaseFocus('escape'); }
    render(); notifyResize();
  }
  document.addEventListener('keydown', e => {
    input = 'keyboard';
    if (e.key === 'Escape' && !modal()) close('escape');
  });
  document.addEventListener('pointerdown', e => {
    input = 'pointer'; pointerType = e.pointerType;
    if (!sidebar.contains(e.target) && !toggle.contains(e.target)) close();
  }, true);
  toggle.addEventListener('click', () => { if (!modal()) reveal(input === 'keyboard'); });
  pinButton.addEventListener('click', () => pin(mode !== 'pinned'));
  sidebar.addEventListener('click', e => {
    if (!e.target.closest('.nav button[data-view]') || modal()) return;
    clearTimer();
    if (input === 'keyboard' || pointerType === 'touch') close('selection');
  });
  sidebar.addEventListener('pointerenter', () => { if (!modal()) clearTimer(); });
  sidebar.addEventListener('pointerleave', scheduleClose);
  edge.addEventListener('pointerenter', e => {
    overEdge = true;
    if (modal() || phone.matches || mode === 'pinned' || e.pointerType === 'touch') return;
    clearTimer();
    timer = setTimeout(() => { timer = null; if (overEdge && !modal() && !phone.matches && mode === 'auto') reveal(); }, 120);
  });
  edge.addEventListener('pointerleave', () => { overEdge = false; if (!modal()) { clearTimer(); scheduleClose(); } });
  sidebar.addEventListener('focusin', () => { if (input === 'keyboard' && !modal()) clearTimer(); });
  sidebar.addEventListener('focusout', () => {
    setTimeout(() => { if (!sidebar.contains(document.activeElement) && !modal()) close('focus'); }, 0);
  });
  phone.addEventListener('change', () => {
    clearTimer(); cancelResize(); overEdge = false; open = false;
    if (!phone.matches && mode === 'auto') releaseFocus('pointer');
    render();
  });
  // Interaction hooks are available for diagnostics; probes use real input and only read state.
  window.__siteNav = { state, open: reveal, close, pin };
  render();
})();
