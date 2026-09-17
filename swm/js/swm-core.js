/* ============================================================================
   SILEX Security World Model — shared runtime.
   Colour scales, glyphs, tooltip, provenance chips and the lazy panel registry
   used by swm-ontology.js and swm-coverage.js.
   ========================================================================== */
(function (global) {
  'use strict';

  /* ---- validated colour ramps (see swm/css/swm.css header) --------------- */
  var LAYER_RAMP    = ['#2f5c94', '#3d79c4', '#5a9bea', '#9cc6f7'];
  var COVERAGE_RAMP = ['#17705a', '#1f9070', '#37b791', '#6fd7b3', '#aeecd5'];
  var STATUS = {
    critical: { color:'#e66767', label:'Critical', icon:'▲' },
    serious:  { color:'#d95926', label:'Serious',  icon:'◆' },
    warning:  { color:'#c98500', label:'Warning',  icon:'●' },
    good:     { color:'#199e70', label:'Healthy',  icon:'✓' }
  };

  /* Ontology group -> d3 symbol. Eight simultaneous hues cannot clear the
     all-pairs CVD floor in a node-link view, so the group rides on shape. */
  var GLYPHS = {
    identity: 'symbolCircle', agent: 'symbolSquare', tool: 'symbolDiamond',
    resource: 'symbolTriangle', workflow: 'symbolWye', policy: 'symbolCross',
    threat: 'symbolStar', outcome: 'symbolAsterisk'
  };

  var SRC_LABEL = {
    d3fend: 'D3FEND', atlas: 'ATLAS', attack: 'ATT&CK', uco: 'UCO',
    owasp: 'OWASP', silex: 'Silex mock'
  };

  var SWM = {
    ramps: { layer: LAYER_RAMP, coverage: COVERAGE_RAMP },
    status: STATUS,
    glyphs: GLYPHS,

    /* ---- data ----------------------------------------------------------- */
    ontology: function () { return global.SILEX_SWM_ONTOLOGY || null; },
    coverage: function () { return global.SILEX_SWM_COVERAGE || null; },
    ready: function () { return !!(global.SILEX_SWM_ONTOLOGY && global.SILEX_SWM_COVERAGE && global.d3); },

    /* ---- scales --------------------------------------------------------- */
    layerColor: function (layer) { return LAYER_RAMP[Math.max(1, Math.min(4, layer || 1)) - 1]; },

    coverageColor: function (v) {
      if (v == null || isNaN(v)) return '#7c88a8';
      var i = v < .55 ? 0 : v < .7 ? 1 : v < .82 ? 2 : v < .92 ? 3 : 4;
      return COVERAGE_RAMP[i];
    },

    /* coverage -> reserved status slot (always shipped with icon + label) */
    coverageStatus: function (v) {
      if (v == null) return 'warning';
      return v < .6 ? 'critical' : v < .75 ? 'serious' : v < .88 ? 'warning' : 'good';
    },

    symbol: function (group, size) {
      var type = global.d3[GLYPHS[group] || 'symbolCircle'];
      return global.d3.symbol().type(type).size(size || 120)();
    },

    /* ---- formatting ----------------------------------------------------- */
    pct: function (v) { return v == null ? '—' : Math.round(v * 100) + '%'; },
    num: function (n) {
      if (n == null) return '—';
      return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'K' : String(n);
    },
    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
      });
    },
    srcLabel: function (sys) { return SRC_LABEL[sys] || sys; },
    srcChip: function (s) {
      return '<span class="swm-src ' + SWM.esc(s.sys) + '">' + SWM.esc(SRC_LABEL[s.sys] || s.sys) +
             (s.id ? ' · ' + SWM.esc(s.id) : '') + '</span>';
    },

    /* ---- tooltip -------------------------------------------------------- */
    tip: (function () {
      var el = null;
      function node() {
        if (!el) { el = document.createElement('div'); el.className = 'swm-tip'; document.body.appendChild(el); }
        return el;
      }
      return {
        show: function (html, evt) {
          var n = node();
          n.innerHTML = html;
          n.classList.add('on');
          this.move(evt);
        },
        move: function (evt) {
          if (!el || !evt) return;
          var r = el.getBoundingClientRect();
          var x = Math.min(evt.clientX + 14, window.innerWidth - r.width - 12);
          var y = evt.clientY - r.height - 14;
          if (y < 8) y = evt.clientY + 18;
          el.style.left = Math.max(8, x) + 'px';
          el.style.top = y + 'px';
        },
        hide: function () { if (el) el.classList.remove('on'); }
      };
    })(),

    /* keep legacy copy on the page in step with the generated bundle */
    syncLegacyCounts: function () {
      var o = SWM.ontology(); if (!o) return;
      var el = document.getElementById('swmLayerTypes');
      if (el) el.textContent = o.nodes.length + ' types';
    },

    /* ---- lazy panel registry -------------------------------------------- */
    _panels: {},
    _booted: {},
    register: function (id, init) { SWM._panels[id] = init; },
    boot: function (id) {
      if (SWM._booted[id] || !SWM._panels[id]) return;
      if (!SWM.ready()) { console.warn('[SWM] data or d3 missing; panel', id, 'not booted'); return; }
      try { SWM._panels[id](); SWM._booted[id] = true; SWM.syncLegacyCounts(); }
      catch (err) { console.error('[SWM] panel ' + id + ' failed', err); }
    },
    /* re-run layout work when a hidden panel becomes visible */
    _resizers: [],
    onResize: function (fn) { SWM._resizers.push(fn); },

    /* ---- small DOM helpers ---------------------------------------------- */
    el: function (tag, cls, html) {
      var n = document.createElement(tag);
      if (cls) n.className = cls;
      if (html != null) n.innerHTML = html;
      return n;
    },
    /* a legend row of glyphs: identity is never colour-alone */
    glyphLegend: function (groups, color) {
      return groups.map(function (g) {
        return '<span class="swm-legend-item"><svg width="13" height="13" viewBox="-7 -7 14 14">' +
               '<path d="' + SWM.symbol(g.id, 58) + '" fill="' + (color || '#9cc6f7') + '"/></svg>' +
               SWM.esc(g.name) + '</span>';
      }).join('');
    }
  };

  var rz;
  global.addEventListener('resize', function () {
    clearTimeout(rz);
    rz = setTimeout(function () { SWM._resizers.forEach(function (f) { try { f(); } catch (e) {} }); }, 180);
  });

  global.SWM = SWM;
})(window);
