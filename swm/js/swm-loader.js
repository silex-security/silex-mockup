/* ============================================================================
   Lazy loader for the Enterprise World Model observatory.
   D3 and the distilled ontology bundle are only fetched the first time a
   visitor opens one of the observatory panels, so the rest of the demo keeps
   its original weight.

   Plan logs/2026-10-02_JEV_LEARNINGS_PLAN.md (B1, B3, A):
   - a failed load can be retried; files that already loaded are kept and only
     the failed and remaining files are requested again;
   - a panel boots only when its mount is visible (SWM.isShown), so a load that
     finishes after the visitor has left does not mount or start anything;
   - SWMLoad(panelId, onReady) calls onReady once the bundle is ready (at once
     for a panel it does not lazy-load), so a caller can never hang;
   - after defining SWMLoad it dispatches 'swm:loader-ready' on window. Only a
     page with a router listens (index.html); elsewhere it is inert.
   ========================================================================== */
(function (global) {
  'use strict';
  var FILES = [
    'swm/vendor/d3.v7.min.js',
    'swm/data/ontology.js',
    'swm/data/coverage.js',
    'swm/js/swm-core.js',
    'swm/js/swm-ontology.js',
    'swm/js/swm-coverage.js',
    'swm/js/swm-layers.js'
  ];
  var PANELS = { 'wm-overview': 'swmCoverage', 'wm-ontology': 'swmOntology', 'wm-architecture': 'swmLayers' };
  var state = 'idle', waiting = [], callbacks = [], loaded = {};

  function mountOf(panelId) { return document.getElementById(PANELS[panelId]); }
    function bootIfShown(panelId) { if (global.SWM.isShown(mountOf(panelId))) global.SWM.boot(panelId); }   /* the one visibility test, SWM.isShown */

  function fail(msg) {
    Object.keys(PANELS).forEach(function (p) {
      var m = mountOf(p);
      if (m && !(global.SWM && global.SWM._booted && global.SWM._booted[p])) m.innerHTML = '<div class="swm"><div class="swm-loading">' +
        'Could not load the visualisation bundle.<br><span style="font-size:10px">' + msg + '</span>' +
        '<br><button class="swm-btn" type="button" data-swm-retry="' + p + '" style="margin-top:10px">Retry</button></div></div>';
    });
  }

  function chain(i, done) {
    if (i >= FILES.length) return done();
    if (loaded[i]) return chain(i + 1, done);           /* never re-execute a file that loaded */
    var s = document.createElement('script');
    s.src = FILES[i];
    s.onload = function () { loaded[i] = true; chain(i + 1, done); };
    s.onerror = function () { s.remove(); done(new Error(FILES[i] + ' failed to load')); };
    document.head.appendChild(s);
  }

  function settle() {
    var cbs = callbacks; callbacks = [];
    cbs.forEach(function (cb) { try { cb(); } catch (e) { console.error('[SWM] onReady failed', e); } });
  }

  global.SWMLoad = function (panelId, onReady) {
    if (!PANELS[panelId]) { if (onReady) onReady(); return; }   /* static panels have nothing to load */
    if (onReady) callbacks.push(onReady);
    if (state === 'ready') { bootIfShown(panelId); settle(); return; }
    if (waiting.indexOf(panelId) < 0) waiting.push(panelId);
    if (state === 'loading') return;
    state = 'loading';
    chain(0, function (err) {
      if (err || !global.SWM) {
        state = 'idle';            /* retryable: callbacks stay queued until a later load succeeds */
        fail(err ? err.message : 'runtime missing');
        return;
      }
      state = 'ready';
      var queued = waiting; waiting = [];
      queued.forEach(bootIfShown);
      settle();
    });
  };

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-swm-retry]');
    if (!b) return;
    var m = mountOf(b.dataset.swmRetry);
    if (m) m.innerHTML = '<div class="swm"><div class="swm-loading"><div class="swm-spinner"></div>Loading…</div></div>';
    global.SWMLoad(b.dataset.swmRetry);
  });

  try { global.dispatchEvent(new Event('swm:loader-ready')); } catch (e) { /* very old browsers: no router hand-off */ }
})(window);
