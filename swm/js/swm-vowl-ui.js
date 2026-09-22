/* Network view controls (T2). Factory only: no top-level window.SWM/d3 mutation.
   Loaded before the lazy bundle; instantiated by swm-ontology.js on first Network use. */
window.SWM_VOWL_UI = function (SWM, d3) {
  'use strict';
  var esc = SWM.esc, dur = SWM.dur;
  var LOGMIN = Math.log(0.2), LOGMAX = Math.log(4);
  var mounted = null;

  function el(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }

  function mount(stageEl, host) {
    var engine = host.engine;
    var root = el('<div class="vw-ui" hidden>' +
      '<div class="vw-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" hidden>' +
        '<span style="display:block;font-size:11px;color:var(--swm-ink-2);margin-bottom:6px"></span>' +
        '<span style="display:block;height:8px;background:rgba(203,210,255,.14);overflow:hidden"><i style="display:block;height:100%;width:0;background:var(--swm-accent)"></i></span></div>' +
      '<p class="vw-live" aria-live="polite"></p>' +
      '<div class="vw-row"><div class="vw-bar" role="group" aria-label="Network controls">' +
        '<button type="button" class="vw-btn" data-vw="filter">Filter</button>' +
        '<button type="button" class="vw-btn" data-vw="modes" aria-expanded="false" aria-haspopup="true">Modes ▾</button>' +
        '<button type="button" class="vw-btn" data-vw="reset">Reset</button>' +
        '<button type="button" class="vw-btn" data-vw="pause" aria-pressed="false">Pause</button></div>' +
      '<div class="vw-pop" hidden>' +
        '<button type="button" class="vw-btn" data-vw="pickPin" aria-pressed="true">Pick &amp; pin</button>' +
        '<button type="button" class="vw-btn" data-vw="compact" aria-pressed="false">Compact notation</button></div></div>' +
      '<div class="vw-zoom" role="group" aria-label="Zoom">' +
        '<button type="button" class="vw-btn" data-vw="zin" aria-label="Zoom in">+</button>' +
        '<input type="range" data-vw="zoom" aria-label="Zoom" min="' + LOGMIN.toFixed(4) + '" max="' + LOGMAX.toFixed(4) + '" step="0.001" value="0">' +
        '<button type="button" class="vw-btn" data-vw="zout" aria-label="Zoom out">−</button>' +
        '<button type="button" class="vw-btn" data-vw="fit" aria-label="Fit">Fit</button></div>');
    /* in flow right below the canvas, so the bar can never cover the legend or foot */
    var cv = stageEl.querySelector('.swm-canvas');
    if (cv) cv.insertAdjacentElement('afterend', root); else stageEl.appendChild(root);

    var $ = root.querySelector.bind(root);
    var prog = $('.vw-progress'), pop = $('.vw-pop'), pauseBtn = $('[data-vw="pause"]'), zoomIn = $('[data-vw="zoom"]');
    var curK = 1, tier = 1, progTimer = null;

    function syncModes() {
      var net = host.getNet() || {};
      $('[data-vw="pickPin"]').setAttribute('aria-pressed', net.pickPin !== false ? 'true' : 'false');
      $('[data-vw="compact"]').setAttribute('aria-pressed', (net.compact && net.compact[tier]) ? 'true' : 'false');
    }

    $('[data-vw="filter"]').addEventListener('click', function () { pop.hidden = true; host.openFilters(); });
    $('[data-vw="modes"]').addEventListener('click', function () { pop.hidden = !pop.hidden; this.setAttribute('aria-expanded', pop.hidden ? 'false' : 'true'); });
    $('[data-vw="reset"]').addEventListener('click', function () { engine.reset(); });
    pauseBtn.addEventListener('click', function () { engine.pause(this.getAttribute('aria-pressed') !== 'true'); });
    $('[data-vw="pickPin"]').addEventListener('click', function () {
      var on = this.getAttribute('aria-pressed') !== 'true'; this.setAttribute('aria-pressed', on ? 'true' : 'false'); host.setNet('pickPin', on);
    });
    $('[data-vw="compact"]').addEventListener('click', function () {
      var on = this.getAttribute('aria-pressed') !== 'true'; this.setAttribute('aria-pressed', on ? 'true' : 'false'); host.setNet('compact', on);
    });
    $('[data-vw="zin"]').addEventListener('click', function () { curK = Math.min(4, curK * 1.3); engine.zoom(curK); });
    $('[data-vw="zout"]').addEventListener('click', function () { curK = Math.max(0.2, curK / 1.3); engine.zoom(curK); });
    $('[data-vw="fit"]').addEventListener('click', function () { engine.fit(); });
    zoomIn.addEventListener('input', function () { curK = Math.exp(+this.value); engine.zoom(curK); });

    engine.on('progress', function (pct, text) {
      if (progTimer) { clearTimeout(progTimer); progTimer = null; }
      prog.style.opacity = ''; prog.hidden = false;
      prog.setAttribute('aria-valuenow', Math.max(0, Math.min(100, Math.round(pct))));
      prog.querySelector('i').style.width = Math.max(0, Math.min(100, Math.round(pct))) + '%';
      prog.querySelector('span').textContent = text || ('Laying out … ' + Math.round(pct) + '%');
    });
    engine.on('ready', function (stats) {
      prog.style.opacity = '0';
      progTimer = setTimeout(function () { prog.hidden = true; prog.style.opacity = ''; progTimer = null; }, dur(400));
      if (stats) { tier = stats.tier || 1; $('.vw-live').textContent = 'Layout ready: ' + stats.nodes + ' nodes'; }
      syncModes();
    });
    engine.on('zoom', function (k) { curK = k; var v = Math.log(Math.max(0.2, Math.min(4, k))); if (Math.abs(+zoomIn.value - v) > 0.0005) zoomIn.value = v; });
    engine.on('pause', function (bool) { pauseBtn.setAttribute('aria-pressed', bool ? 'true' : 'false'); pauseBtn.textContent = bool ? 'Resume' : 'Pause'; });

    document.addEventListener('click', function (e) {
      if (pop.hidden) return;
      if (!e.target.closest('.vw-bar') && !e.target.closest('.vw-pop')) { pop.hidden = true; $('[data-vw="modes"]').setAttribute('aria-expanded', 'false'); }
    });

    syncModes();
    mounted = { root: root, pop: pop, modes: $('[data-vw="modes"]') };
  }

  function show(bool) {
    if (!mounted) return;
    mounted.root.hidden = !bool;
    if (!bool) { mounted.pop.hidden = true; mounted.modes.setAttribute('aria-expanded', 'false'); }
  }

  function statsHtml(stats) {
    if (!stats) return '';
    var rows = [['Nodes shown', stats.nodes + ' / ' + stats.tierNodes], ['Relations', stats.relations],
      ['Public source', stats.publicNodes], ['Silex-authored', stats.silexNodes], ['Pinned', stats.pinned]];
    var preds = Object.keys(stats.byPred || {}).sort(function (a, b) { return stats.byPred[b] - stats.byPred[a]; }).slice(0, 6);
    return '<details class="vw-stats" open><summary style="cursor:pointer;list-style:none;font-weight:700;font-size:10px;color:var(--muted)">Statistics</summary>' +
      '<div class="swm-facts">' + rows.map(function (r) { return '<div class="swm-fact"><small>' + r[0] + '</small><b>' + r[1] + '</b></div>'; }).join('') + '</div>' +
      (preds.length ? '<div class="vw-stats-preds">' + preds.map(function (p) { return '<span style="font:600 9.5px ui-monospace,Menlo,monospace;background:var(--soft);padding:4px 6px;color:var(--ink)">' + esc(p) + ' × ' + stats.byPred[p] + '</span>'; }).join('') + '</div>' : '') +
      '</details>';
  }

  return { mount: mount, show: show, statsHtml: statsHtml };
};
