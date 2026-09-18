/* ============================================================================
   SILEX Security World Model — shared runtime.
   Colour scales, glyphs, tooltip, provenance chips and the lazy panel registry
   used by swm-ontology.js and swm-coverage.js.
   ========================================================================== */
(function (global) {
  'use strict';

  /* ---- validated colour ramps (see swm/css/swm.css header) ---------------
     Light theme: both ramps run light -> dark on the white canvas, so the
     deeper the layer and the higher the coverage, the darker the mark. */
  var LAYER_RAMP    = ['#104281', '#256abf', '#3987e5', '#86b6ef'];
  var COVERAGE_RAMP = ['#b8a3ee', '#9578e1', '#6f50c9', '#50339c', '#35206e'];
  /* reserved status palette — fixed, never themed, never carries meaning alone */
  var STATUS = {
    critical: { color:'#d03b3b', label:'Critical', icon:'▲' },
    serious:  { color:'#ec835a', label:'Serious',  icon:'◆' },
    warning:  { color:'#fab219', label:'Warning',  icon:'●' },
    good:     { color:'#0ca30c', label:'Healthy',  icon:'✓' }
  };
  /* text and surface tokens the SVG layers draw with — the CSS custom
     properties cannot reach attribute values, so they live here too */
  var INK = {
    ink:'#17191d', ink2:'#4f5864', ink3:'#68707c', faint:'#7b8494',
    surface:'#ffffff', soft:'#f5f6f8', line:'#e3e6ea',
    grid:'rgba(23,25,29,.10)', edge:'rgba(23,25,29,.20)',
    wash:'rgba(23,25,29,.05)', accent:'#256abf', accentSoft:'rgba(37,106,191,.12)'
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
    ink: INK,
    glyphs: GLYPHS,

    /* ---- data ----------------------------------------------------------- */
    ontology: function () { return global.SILEX_SWM_ONTOLOGY || null; },
    coverage: function () { return global.SILEX_SWM_COVERAGE || null; },
    ready: function () { return !!(global.SILEX_SWM_ONTOLOGY && global.SILEX_SWM_COVERAGE && global.d3); },

    /* ---- scales --------------------------------------------------------- */
    layerColor: function (layer) { return LAYER_RAMP[Math.max(1, Math.min(4, layer || 1)) - 1]; },

    /* the same hue, stepped dark enough to be read as text on the white canvas */
    layerInk: function (layer) {
      var c = SWM.layerColor(layer);
      for (var i = LAYER_RAMP.indexOf(c); i >= 0; i--)
        if (SWM.contrast(LAYER_RAMP[i], '#ffffff') >= 3) return LAYER_RAMP[i];
      return LAYER_RAMP[0];
    },

    /* WCAG relative luminance of a #rrggbb / rgb() colour */
    luminance: function (color) {
      var c = String(color).trim(), r, g, b, m;
      if (c[0] === '#' && c.length === 7) {
        r = parseInt(c.substr(1,2),16); g = parseInt(c.substr(3,2),16); b = parseInt(c.substr(5,2),16);
      } else if ((m = c.match(/rgba?\(([^)]+)\)/))) {
        var parts = m[1].split(',').map(parseFloat); r = parts[0]; g = parts[1]; b = parts[2];
      } else return 1;
      var f = function (x) { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); };
      return .2126 * f(r) + .7152 * f(g) + .0722 * f(b);
    },
    contrast: function (a, b) {
      var l1 = SWM.luminance(a), l2 = SWM.luminance(b);
      return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
    },
    /* readable text colour on a filled mark: whichever of white and ink has the
       higher measured contrast against that exact fill — never a guess about
       "light or dark", and never a barely-passing choice when the other option
       is far better */
    textOn: function (fill) {
      return SWM.contrast('#ffffff', fill) >= SWM.contrast(INK.ink, fill) ? '#ffffff' : INK.ink;
    },
    /* the opposite colour, used as a halo so a label survives landing on a
       boundary between two differently filled marks */
    haloOn: function (fill) {
      return SWM.textOn(fill) === '#ffffff' ? 'rgba(14,10,28,.45)' : 'rgba(255,255,255,.92)';
    },

    coverageColor: function (v) {
      if (v == null || isNaN(v)) return INK.faint;
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
    /* status is never colour-alone: a tinted icon plus the word, on ink text */
    statusHtml: function (key) {
      var st = STATUS[key] || STATUS.warning;
      return '<span class="swm-status"><i style="color:' + st.color + '">' + st.icon + '</i>' + st.label + '</span>';
    },
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

    /* ---- shared abstraction level (L1..L4) -------------------------------
       Every panel that speaks in layers reads and writes this one value, so the
       Ontology Layers tab and the Ontology Explorer always agree. */
    level: 1,
    _levelSubs: [],
    setLevel: function (n, origin) {
      n = Math.max(1, Math.min(4, +n || 1));
      if (n === SWM.level) return;
      SWM.level = n;
      SWM._levelSubs.forEach(function (fn) { try { fn(n, origin); } catch (e) { console.error('[SWM] level subscriber failed', e); } });
    },
    onLevel: function (fn) { SWM._levelSubs.push(fn); },

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
               '<path d="' + SWM.symbol(g.id, 58) + '" fill="' + (color || INK.ink3) + '"/></svg>' +
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
