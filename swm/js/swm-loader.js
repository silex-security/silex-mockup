/* ============================================================================
   Lazy loader for the Security World Model observatory.
   D3 and the distilled ontology bundle (~300KB) are only fetched the first
   time a visitor opens one of the two observatory panels, so the rest of the
   demo keeps its original weight.
   ========================================================================== */
(function (global) {
  'use strict';
  var FILES = [
    'swm/vendor/d3.v7.min.js',
    'swm/data/ontology.js',
    'swm/data/coverage.js',
    'swm/js/swm-core.js',
    'swm/js/swm-ontology.js',
    'swm/js/swm-coverage.js'
  ];
  var PANELS = { 'wm-overview': 'swmCoverage', 'wm-ontology': 'swmOntology' };
  var state = 'idle', waiting = [];

  function fail(msg) {
    Object.keys(PANELS).forEach(function (p) {
      var m = document.getElementById(PANELS[p]);
      if (m) m.innerHTML = '<div class="swm"><div class="swm-loading">' +
        'Could not load the visualisation bundle.<br><span style="font-size:10px">' + msg + '</span></div></div>';
    });
  }

  function chain(i, done) {
    if (i >= FILES.length) return done();
    var s = document.createElement('script');
    s.src = FILES[i];
    s.onload = function () { chain(i + 1, done); };
    s.onerror = function () { done(new Error(FILES[i] + ' failed to load')); };
    document.head.appendChild(s);
  }

  global.SWMLoad = function (panelId) {
    if (!PANELS[panelId]) return;
    if (state === 'ready') { global.SWM.boot(panelId); return; }
    waiting.push(panelId);
    if (state === 'loading') return;
    state = 'loading';
    chain(0, function (err) {
      if (err || !global.SWM) { state = 'error'; fail(err ? err.message : 'runtime missing'); return; }
      state = 'ready';
      waiting.forEach(function (p) { global.SWM.boot(p); });
      waiting = [];
    });
  };
})(window);
