/* ============================================================================
   SILEX Security World Model — shared runtime.
   Colour scales, glyphs, tooltip, provenance chips, motion/visibility helpers
   and the lazy panel registry used by every SWM panel.

   2026-09-21 visual upgrade (logs/2026-09-21_SWM_VISUAL_UPGRADE_PLAN.md):
   charts now draw on a midnight-indigo STAGE (#10162b -> #26305a) while
   inspectors and cards stay on white PAPER. Every colour below was measured
   against the lightest stage stop (#26305a) or against white — see the
   contrast notes next to each ramp. CSS copies live in swm/css/swm.css; keep
   the two in step.
   ========================================================================== */
(function (global) {
  'use strict';

  /* ---- stage surface ---------------------------------------------------- */
  var STAGE_BG = ['#10162b', '#26305a'];          /* darkest, lightest stop */

  /* layer depth ramp ON THE STAGE: ordinal, one hue, L1 brightest.
     vs #26305a: 10.42 / 7.40 / 5.14 / 4.13 — every step clears 3:1 */
  var LAYER_RAMP = ['#ece5ff', '#cdbcff', '#ae96f6', '#9b82ef'];
  /* the same ramp for WHITE paper (inspector swatches, chips):
     vs #ffffff: 9.15 / 5.73 / 4.35 / 3.84 */
  var LAYER_RAMP_PAPER = ['#50339c', '#6f50c9', '#8565d6', '#8e70d9'];

  /* coverage ramp ON THE STAGE, low -> high over the explicit 40–100% display
     domain (values outside are clamped and the legend says so). The low end is
     the most saturated mark, so gaps read first; the lowest stop still clears
     3:1 on #26305a (3.63). stops at 40 / 55 / 70 / 85 / 100 % */
  var COVERAGE_RAMP = ['#e0569f', '#e57ab5', '#eb9dca', '#f1c0de', '#f8e2ef'];
  /* the same scale for WHITE paper (meters in inspectors): low -> high,
     vs #ffffff 4.63 … 13.77 */
  var COVERAGE_RAMP_PAPER = ['#b0529c', '#983f88', '#7c3371', '#61285a', '#471d43'];
  var COVERAGE_DOMAIN = [0.4, 1];

  /* reserved status palette — fixed, never themed, never carries meaning alone */
  var STATUS = {
    critical: { color:'#d03b3b', label:'Critical', icon:'▲' },
    serious:  { color:'#ec835a', label:'Serious',  icon:'◆' },
    warning:  { color:'#fab219', label:'Warning',  icon:'●' },
    good:     { color:'#0ca30c', label:'Healthy',  icon:'✓' }
  };

  /* STAGE text + line tokens (SVG attribute values cannot read CSS vars).
     vs #26305a: ink 11.19, ink2 7.71, ink3 6.00 (all body text >= 4.5),
     faint 4.76 (small print / decorative only). */
  var INK = {
    ink:'#eef0fb', ink2:'#c3c8e8', ink3:'#a9b0db', faint:'#949cca',
    surface:STAGE_BG[0], soft:'#1b2344', line:'rgba(203,210,255,.18)',
    grid:'rgba(203,210,255,.08)', edge:'rgba(183,163,255,.34)', edgeStrong:'#b7a3ff',
    wash:'rgba(203,210,255,.06)', accent:'#b7a3ff', accentSoft:'rgba(183,163,255,.18)'
  };
  /* PAPER tokens — the old light theme, for white inspectors and cards */
  var PAPER = {
    ink:'#17191d', ink2:'#4f5864', ink3:'#68707c', faint:'#7b8494',
    surface:'#ffffff', soft:'#f5f6f8', line:'#e3e6ea',
    grid:'rgba(23,25,29,.10)', edge:'rgba(23,25,29,.20)',
    wash:'rgba(23,25,29,.05)', accent:'#50339c', accentSoft:'rgba(111,80,201,.13)'
  };
  /* the dark candidate for text-on-fill. Deliberately NOT INK.ink, which is
     now the light stage text colour. */
  var DARK_TEXT = '#17191d';

  /* Ontology group -> d3 symbol, following the bundle's `groups[].glyph`
     (circle, square, diamond, triangle, wye, plus, star, asterisk). Eight
     simultaneous hues cannot clear the all-pairs CVD floor in a node-link
     view, so the group rides on shape. */
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

  /* Bundle fixture IDs that collide with website IDs of a different meaning.
     Rendered text never shows the bare ID (plan P2 fixture-local rule). */
  var FIXTURE_IDS = [
    { re: /\bWF-021\b(?! · Customer Refund \(SWM fixture\))/g, to: 'WF-021 · Customer Refund (SWM fixture)' },
    { re: /\bI-1042\b(?! · Refund loop \(SWM fixture\))/g,     to: 'I-1042 · Refund loop (SWM fixture)' }
  ];

  function mm(q) { try { return global.matchMedia && global.matchMedia(q).matches; } catch (e) { return false; } }

  /* deterministic PRNG so every layout is identical between renders */
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

    /* ---- data ----------------------------------------------------------- */
    ontology: function () { return global.SILEX_SWM_ONTOLOGY || null; },
    coverage: function () { return global.SILEX_SWM_COVERAGE || null; },
    ready: function () { return !!(global.SILEX_SWM_ONTOLOGY && global.SILEX_SWM_COVERAGE && global.d3); },

    /* ---- scales --------------------------------------------------------- */
    /* layer colour; surface 'paper' for white cards, default = stage */
    layerColor: function (layer, surface) {
      var r = surface === 'paper' ? LAYER_RAMP_PAPER : LAYER_RAMP;
      return r[Math.max(1, Math.min(4, layer || 1)) - 1];
    },
    /* layer hue readable as TEXT on white paper (>= 3:1, all paper steps pass) */
    layerInk: function (layer) { return SWM.layerColor(layer, 'paper'); },

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
    /* readable text colour on a filled mark: whichever of white and the fixed
       DARK_TEXT has the higher measured contrast against that exact fill */
    textOn: function (fill) {
      return SWM.contrast('#ffffff', fill) >= SWM.contrast(DARK_TEXT, fill) ? '#ffffff' : DARK_TEXT;
    },
    /* the opposite colour, used as a halo so a label survives landing on a
       boundary between two differently filled marks */
    haloOn: function (fill) {
      return SWM.textOn(fill) === '#ffffff' ? 'rgba(14,10,28,.55)' : 'rgba(255,255,255,.92)';
    },

    /* coverage -> colour, continuous over the explicit 40–100% display domain
       (clamped). surface 'paper' returns the white-paper ramp. */
    coverageColor: function (v, surface) {
      var ramp = surface === 'paper' ? COVERAGE_RAMP_PAPER : COVERAGE_RAMP;
      if (v == null || isNaN(v)) return surface === 'paper' ? PAPER.faint : INK.faint;
      var t = (Math.max(COVERAGE_DOMAIN[0], Math.min(COVERAGE_DOMAIN[1], +v)) - COVERAGE_DOMAIN[0]) /
              (COVERAGE_DOMAIN[1] - COVERAGE_DOMAIN[0]);
      if (global.d3 && global.d3.interpolateRgbBasis) return global.d3.color(global.d3.interpolateRgbBasis(ramp)(t)).formatHex();
      return ramp[Math.min(ramp.length - 1, Math.round(t * (ramp.length - 1)))];
    },
    /* true when a value sits outside the display domain and was clamped */
    coverageClamped: function (v) { return v != null && (v < COVERAGE_DOMAIN[0] || v > COVERAGE_DOMAIN[1]); },

    /* coverage -> reserved status slot (always shipped with icon + label) */
    coverageStatus: function (v) {
      if (v == null) return 'warning';
      return v < .6 ? 'critical' : v < .75 ? 'serious' : v < .88 ? 'warning' : 'good';
    },

    symbol: function (group, size) {
      var o = SWM.ontology(), name = GLYPHS[group];
      if (o && o.groups) o.groups.forEach(function (g) { if (g.id === group && GLYPH_NAME[g.glyph]) name = GLYPH_NAME[g.glyph]; });
      var type = global.d3[name || 'symbolCircle'];
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
    /* namespace colliding bundle fixture IDs in any display string (plain text,
       escape AFTER calling this) */
    fixtureText: function (s) {
      var out = String(s == null ? '' : s);
      FIXTURE_IDS.forEach(function (f) { out = out.replace(f.re, f.to); });
      return out;
    },
    srcLabel: function (sys) { return SRC_LABEL[sys] || sys; },
    /* status is never colour-alone: a tinted icon plus the word, on ink text */
    statusHtml: function (key) {
      var st = STATUS[key] || STATUS.warning;
      return '<span class="swm-status"><i style="color:' + st.color + '">' + st.icon + '</i>' + st.label + '</span>';
    },
    srcChip: function (s) {
      return '<span class="swm-src ' + SWM.esc(s.sys) + '">' + SWM.esc(SRC_LABEL[s.sys] || s.sys) +
             (s.id && s.sys !== 'silex' ? ' · ' + SWM.esc(s.id) : '') + '</span>';
    },

    /* ---- motion + visibility -------------------------------------------- */
    reducedMotion: function () { return !!mm('(prefers-reduced-motion: reduce)'); },
    /* a transition duration that collapses to 0 under reduced motion; capped at
       the plan's 650 ms ceiling */
    dur: function (ms) { return SWM.reducedMotion() ? 0 : Math.min(650, ms || 0); },
    random: lcg,
    /* which SWM subtab is showing ('wm-ontology', …) and whether the whole
       Security World Model view is on screen */
    activePanel: null,
    _panelSubs: [],
    onPanel: function (fn) { SWM._panelSubs.push(fn); },
    _panelShown: function (id) {
      SWM.activePanel = id;
      SWM.tip.hide();
      SWM._panelSubs.forEach(function (fn) { try { fn(id); } catch (e) { console.error('[SWM] panel subscriber failed', e); } });
    },
    isShown: function (el) { return !!(el && el.offsetParent !== null && el.getClientRects().length); },

    /* ---- tooltip (mounted on <body>, so it carries its own colours) ----- */
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

    /* keep legacy copy on the page in step with the generated bundle.
       598 = nodes (L4 holds instances, not types). */
    syncLegacyCounts: function () {
      var o = SWM.ontology(); if (!o) return;
      var el = document.getElementById('swmLayerTypes');
      if (el) el.textContent = o.nodes.length + ' nodes';
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
        return '<span class="swm-legend-item"><svg width="13" height="13" viewBox="-7 -7 14 14" aria-hidden="true">' +
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

  /* a panel switch that happened before this file loaded */
  if (global.SWM_ACTIVE_PANEL) SWM.activePanel = global.SWM_ACTIVE_PANEL;

  global.SWM = SWM;
})(window);
