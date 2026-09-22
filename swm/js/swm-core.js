/* SILEX Security World Model — shared runtime: colour scales, glyphs, tooltip,
   provenance chips, motion/visibility helpers and the lazy panel registry.
   Charts draw on a dark STAGE (#10162b→#26305a); inspectors stay on white PAPER.
   Contrast is measured against #26305a or #ffffff (notes per ramp). CSS copies
   of these tokens live in swm/css/swm.css — keep the two in step. */
(function (global) {
  'use strict';

  var STAGE_BG = ['#10162b', '#26305a'];          /* darkest, lightest stop */

  /* layers on stage, L1 brightest: 10.4 / 7.4 / 5.1 / 4.1 vs #26305a */
  var LAYER_RAMP = ['#ece5ff', '#cdbcff', '#ae96f6', '#9b82ef'];
  /* layers on paper: 9.2 / 5.7 / 4.4 / 3.8 vs #fff */
  var LAYER_RAMP_PAPER = ['#50339c', '#6f50c9', '#8565d6', '#8e70d9'];

  /* coverage on stage, 40/55/70/85/100 %, clamped; low end most saturated (3.6 vs #26305a) */
  var COVERAGE_RAMP = ['#e0569f', '#e57ab5', '#eb9dca', '#f1c0de', '#f8e2ef'];
  /* coverage on paper: 4.6 … 13.8 vs #fff */
  var COVERAGE_RAMP_PAPER = ['#b0529c', '#983f88', '#7c3371', '#61285a', '#471d43'];
  var COVERAGE_DOMAIN = [0.4, 1];

  /* reserved status palette: never themed, never meaning alone */
  var STATUS = {
    critical: { color:'#d03b3b', label:'Critical', icon:'▲' },
    serious:  { color:'#ec835a', label:'Serious',  icon:'◆' },
    warning:  { color:'#fab219', label:'Warning',  icon:'●' },
    good:     { color:'#0ca30c', label:'Healthy',  icon:'✓' }
  };

  /* stage tokens (SVG attributes cannot read CSS vars): ink 11.2, ink2 7.7, ink3 6.0, faint 4.8 (decorative) */
  var INK = {
    ink:'#eef0fb', ink2:'#c3c8e8', ink3:'#a9b0db', faint:'#949cca',
    surface:STAGE_BG[0], soft:'#1b2344', line:'rgba(203,210,255,.18)',
    grid:'rgba(203,210,255,.08)', edge:'rgba(183,163,255,.34)', edgeStrong:'#b7a3ff',
    wash:'rgba(203,210,255,.06)', accent:'#b7a3ff', accentSoft:'rgba(183,163,255,.18)'
  };
  /* paper tokens for white cards */
  var PAPER = {
    ink:'#17191d', ink2:'#4f5864', ink3:'#68707c', faint:'#7b8494',
    surface:'#ffffff', soft:'#f5f6f8', line:'#e3e6ea',
    grid:'rgba(23,25,29,.10)', edge:'rgba(23,25,29,.20)',
    wash:'rgba(23,25,29,.05)', accent:'#50339c', accentSoft:'rgba(111,80,201,.13)'
  };
  /* dark candidate for textOn — not INK.ink, which is now light */
  var DARK_TEXT = '#17191d';

  /* group → d3 symbol, overridden by the bundle's groups[].glyph; groups ride on shape, not hue */
  var GLYPHS = {
    identity: 'symbolCircle', agent: 'symbolSquare', tool: 'symbolDiamond',
    resource: 'symbolTriangle', workflow: 'symbolWye', policy: 'symbolCross',
    threat: 'symbolStar', outcome: 'symbolAsterisk'
  };
  var GLYPH_NAME = { circle:'symbolCircle', square:'symbolSquare', diamond:'symbolDiamond', triangle:'symbolTriangle',
                     wye:'symbolWye', plus:'symbolCross', cross:'symbolCross', star:'symbolStar', asterisk:'symbolAsterisk' };

  var SRC_LABEL = {
    d3fend: 'D3FEND', atlas: 'ATLAS', attack: 'ATT&CK', uco: 'UCO',
    owasp: 'OWASP', silex: 'Silex-authored · illustrative'
  };

  /* fixture IDs that mean something else elsewhere on the site are never shown bare (plan P2) */
  var FIXTURE_IDS = [
    { re: /\bWF-021\b(?! · Customer Refund \(SWM fixture\))/g, to: 'WF-021 · Customer Refund (SWM fixture)' },
    { re: /\bI-1042\b(?! · Refund loop \(SWM fixture\))/g,     to: 'I-1042 · Refund loop (SWM fixture)' }
  ];

  function mm(q) { try { return global.matchMedia && global.matchMedia(q).matches; } catch (e) { return false; } }

  function lcg(seed) {
    var s = (seed >>> 0) || 1;
    return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }

  var SWM = {
    ramps: { layer: LAYER_RAMP, coverage: COVERAGE_RAMP, layerPaper: LAYER_RAMP_PAPER, coveragePaper: COVERAGE_RAMP_PAPER },
    coverageDomain: COVERAGE_DOMAIN,
    stageBg: STAGE_BG,
    status: STATUS,
    ink: INK,          /* stage tokens */
    paper: PAPER,      /* white-surface tokens */
    darkText: DARK_TEXT,
    glyphs: GLYPHS,

    ontology: () => global.SILEX_SWM_ONTOLOGY || null,
    coverage: () => global.SILEX_SWM_COVERAGE || null,
    ready: () => !!(global.SILEX_SWM_ONTOLOGY && global.SILEX_SWM_COVERAGE && global.d3),

    /* surface: 'paper' for white cards, default stage */
    layerColor: function (layer, surface) {
      var r = surface === 'paper' ? LAYER_RAMP_PAPER : LAYER_RAMP;
      return r[Math.max(1, Math.min(4, layer || 1)) - 1];
    },

    /* WCAG relative luminance */
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
    /* whichever of white / DARK_TEXT measures higher on the fill; halo is the opposite */
    textOn: function (fill) {
      return SWM.contrast('#ffffff', fill) >= SWM.contrast(DARK_TEXT, fill) ? '#ffffff' : DARK_TEXT;
    },
    haloOn: function (fill) {
      return SWM.textOn(fill) === '#ffffff' ? 'rgba(14,10,28,.55)' : 'rgba(255,255,255,.92)';
    },

    /* continuous over the 40–100 % display domain, clamped */
    coverageColor: function (v, surface) {
      var ramp = surface === 'paper' ? COVERAGE_RAMP_PAPER : COVERAGE_RAMP;
      if (v == null || isNaN(v)) return surface === 'paper' ? PAPER.faint : INK.faint;
      var t = (Math.max(COVERAGE_DOMAIN[0], Math.min(COVERAGE_DOMAIN[1], +v)) - COVERAGE_DOMAIN[0]) /
              (COVERAGE_DOMAIN[1] - COVERAGE_DOMAIN[0]);
      if (global.d3 && global.d3.interpolateRgbBasis) return global.d3.color(global.d3.interpolateRgbBasis(ramp)(t)).formatHex();
      return ramp[Math.min(ramp.length - 1, Math.round(t * (ramp.length - 1)))];
    },

    coverageStatus: function (v) {
      if (v == null) return 'warning';
      return v < .6 ? 'critical' : v < .75 ? 'serious' : v < .88 ? 'warning' : 'good';
    },

    /* symbolAsterisk/Plus/Times/Triangle2 are stroke-only: colour goes on the stroke */
    glyphName: function (group) {
      var o = SWM.ontology(), name = GLYPHS[group];
      if (o && o.groups) o.groups.forEach(function (g) { if (g.id === group && GLYPH_NAME[g.glyph]) name = GLYPH_NAME[g.glyph]; });
      return name || 'symbolCircle';
    },
    strokeGlyph: (group) => /^symbol(Asterisk|Plus|Times|Triangle2)$/.test(SWM.glyphName(group)),
    paintGlyph: function (sel, groupOf, colorOf, width) {
      sel.each(function (d) {
        var g = groupOf(d), c = colorOf(d), el = global.d3.select(this);
        if (SWM.strokeGlyph(g)) el.attr('fill', 'none').attr('stroke', c).attr('stroke-width', width || 1.8).attr('stroke-linecap', 'round');
        else el.attr('fill', c);
      });
      return sel;
    },
    glyphAttrs: function (group, color) {
      return SWM.strokeGlyph(group) ? 'fill="none" stroke="' + color + '" stroke-width="1.8" stroke-linecap="round"' : 'fill="' + color + '"';
    },
    symbol: (group, size) => global.d3.symbol().type(global.d3[SWM.glyphName(group)]).size(size || 120)(),

    pct: (v) => v == null ? '—' : Math.round(v * 100) + '%',
    num: function (n) {
      if (n == null) return '—';
      return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'K' : String(n);
    },
    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
      });
    },
    /* call before esc() */
    fixtureText: function (s) {
      var out = String(s == null ? '' : s);
      FIXTURE_IDS.forEach((f) => (out = out.replace(f.re, f.to)));
      return out;
    },
    srcLabel: (sys) => SRC_LABEL[sys] || sys,
    statusHtml: function (key) {
      var st = STATUS[key] || STATUS.warning;
      return '<span class="swm-status"><i style="color:' + st.color + '">' + st.icon + '</i>' + st.label + '</span>';
    },
    srcChip: function (s) {
      return '<span class="swm-src ' + SWM.esc(s.sys) + '">' + SWM.esc(SRC_LABEL[s.sys] || s.sys) +
             (s.id && s.sys !== 'silex' ? ' · ' + SWM.esc(s.id) : '') + '</span>';
    },

    reducedMotion: () => !!mm('(prefers-reduced-motion: reduce)'),
    /* 0 under reduced motion, capped at 650 ms */
    dur: (ms) => SWM.reducedMotion() ? 0 : Math.min(650, ms || 0),
    random: lcg,
    /* current subtab, null when the SWM view is hidden */
    activePanel: null,
    _panelSubs: [],
    onPanel: (fn) => SWM._panelSubs.push(fn),
    _panelShown: function (id) {
      SWM.activePanel = id;
      SWM.tip.hide();
      SWM._panelSubs.forEach(function (fn) { try { fn(id); } catch (e) { console.error('[SWM] panel subscriber failed', e); } });
    },
    isShown: (el) => !!(el && el.offsetParent !== null && el.getClientRects().length),

    /* tooltip on <body>: carries its own colours */
    tip: (function () {
      var el = null;
      function node() {
        if (!el) { el = document.createElement('div'); el.className = 'swm-tip'; el.setAttribute('role', 'tooltip'); document.body.appendChild(el); }
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
          var r = el.getBoundingClientRect(), cx = evt.clientX, cy = evt.clientY;
          if (cx == null && evt.target && evt.target.getBoundingClientRect) {   /* keyboard focus */
            var b = evt.target.getBoundingClientRect(); cx = b.right; cy = b.top;
          }
          var x = Math.min(cx + 14, window.innerWidth - r.width - 12);
          var y = cy - r.height - 14;
          if (y < 8) y = cy + 18;
          el.style.left = Math.max(8, x) + 'px';
          el.style.top = y + 'px';
        },
        hide: function () { if (el) el.classList.remove('on'); }
      };
    })(),

    /* legacy copy: 598 nodes, not types (L4 holds instances) */
    syncLegacyCounts: function () {
      var o = SWM.ontology(); if (!o) return;
      var el = document.getElementById('swmLayerTypes');
      if (el) el.textContent = o.nodes.length + ' nodes';
    },

    /* shared abstraction level L1..L4 (Layers and Ontology always agree) */
    level: 1,
    _levelSubs: [],
    setLevel: function (n, origin) {
      n = Math.max(1, Math.min(4, +n || 1));
      if (n === SWM.level) return;
      SWM.level = n;
      SWM._levelSubs.forEach(function (fn) { try { fn(n, origin); } catch (e) { console.error('[SWM] level subscriber failed', e); } });
    },
    onLevel: (fn) => SWM._levelSubs.push(fn),

    _panels: {},
    _booted: {},
    register: (id, init) => (SWM._panels[id] = init),
    boot: function (id) {
      if (SWM._booted[id] || !SWM._panels[id]) return;
      if (!SWM.ready()) { console.warn('[SWM] data or d3 missing; panel', id, 'not booted'); return; }
      try { SWM._panels[id](); SWM._booted[id] = true; SWM.syncLegacyCounts(); }
      catch (err) { console.error('[SWM] panel ' + id + ' failed', err); }
    },
    _resizers: [],
    onResize: (fn) => SWM._resizers.push(fn)

  };

  var rz;
  global.addEventListener('resize', function () {
    clearTimeout(rz);
    rz = setTimeout(function () { SWM._resizers.forEach(function (f) { try { f(); } catch (e) {} }); }, 180);
  });

  if (global.SWM_ACTIVE_PANEL) SWM.activePanel = global.SWM_ACTIVE_PANEL;

  global.SWM = SWM;
})(window);
