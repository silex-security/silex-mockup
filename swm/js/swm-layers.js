/* Ontology Layers — L1→L2→L3→L4 (T4). Ribbon width ∝ cross-tier relation count; the ribbon is adjacency (not s→t); the inspector reads true direction + source. L1–L3 supply Schema, L4 shows illustrative World State instances. */
(function (global) {
  'use strict';
  var d3 = global.d3, SWM = global.SWM;

  function init() {
    var mount = document.getElementById('swmLayers');
    if (!mount) return;
    var data = SWM.ontology(), chain = data.chain;
    if (!chain) { mount.innerHTML = '<div class="swm"><div class="swm-loading">This bundle predates the layer chain — rebuild with swm/tools/build-ontology.mjs</div></div>'; return; }

    var groupName = {};
    data.groups.forEach(function (g) { groupName[g.id] = g.name; });
    var byId = {};
    data.nodes.forEach(function (n) { byId[n.id] = n; });

    /* L4 blurb claims live runtime; show honest fixture wording */
    function layerBlurb(layer) {
      return layer.id === 4 ? 'Simulated runtime instances (illustrative) — not a live customer graph' : layer.blurb;
    }

    /* actual directed links per hop — inspector reads true direction + source */
    var hopLinks = {};
    chain.hops.forEach(function (h) { hopLinks[h.from + ':' + h.to] = { fwd: [], rev: [] }; });
    data.links.forEach(function (l) {
      var s = byId[l.s], t = byId[l.t];
      if (!s || !t || s.layer === t.layer) return;
      var lo = Math.min(s.layer, t.layer), hi = Math.max(s.layer, t.layer);
      var bucket = hopLinks[lo + ':' + hi];
      if (!bucket) return;
      if (s.layer === hi && t.layer === lo) bucket.fwd.push(l);   /* specific → general */
      else bucket.rev.push(l);                                    /* general → specific */
    });

    mount.innerHTML =
      '<div class="swm">' +
        '<div class="swm-shell coverage">' +
          '<div class="swm-stage" id="swmLayersStage">' +
            '<div class="swm-stage-bar">' +
              '<div class="swm-crumbs"><button data-reset="1">One hierarchy, four tiers</button><i>›</i><b id="swmChainFocus">L1 General</b></div>' +
              '<div class="swm-views" id="swmChainAction"><button data-open="1">Open this layer in the Explorer ↗</button></div>' +
            '</div>' +
            '<svg id="swmChainSvg"></svg>' +
            '<div class="swm-legend"><h6>One chain, four tiers</h6>' +
              '<div class="swm-legend-items">' +
                '<span class="swm-legend-item"><span style="width:22px;height:8px;border-radius:3px;background:linear-gradient(90deg,#ece5ff,#9b82ef);display:inline-block"></span>plane = abstraction tier</span>' +
                '<span class="swm-legend-item"><span style="width:22px;height:8px;border-radius:3px;background:#b7a3ff;display:inline-block"></span>ribbon width = relations crossing the hop</span>' +
              '</div>' +
              '<div class="swm-caption" style="margin-top:7px">Plane size is layout only · ribbon width is proportional to the cross-tier relation count · counts are bundle counts, Silex-authored mappings labelled. L1–L3 supply Schema; L4 shows illustrative World State instances. This view does not implement Laws, Objectives or Calibration.</div></div>' +
            '<div class="swm-hint">Click a plane to set the abstraction level · inspect a hop for its true predicate direction</div>' +
          '</div>' +
          '<div class="swm-side">' +
            '<div class="swm-card"><h4 id="swmChainTitle">L1 · General Agent Ontology Graph</h4>' +
              '<p class="sub" id="swmChainBlurb"></p>' +
              '<div class="swm-facts" id="swmChainFacts"></div>' +
              '<h4 style="margin-top:12px">Select a tier</h4>' +
              '<div class="swm-list" id="swmLayerList"></div>' +
              '<div id="swmChainGroups"></div>' +
              '<p class="swm-note">L1–L3 are the shipped Schema; L4 shows illustrative World State instances. Counts are verifiable bundle counts; component mappings are Silex-authored.</p></div>' +
            '<div class="swm-card"><h4>How the tiers relate</h4>' +
              '<p class="sub">Adjacency only — each hop is a boundary, not a direction. Predicate direction and source are read from the underlying links.</p>' +
              '<div class="swm-gaps" id="swmChainHops"></div></div>' +
          '</div>' +
        '</div>' +
      '</div>';

    var stage = document.getElementById('swmLayersStage');
    var svg = d3.select('#swmChainSvg'), g = svg.append('g');
    var focus = SWM.level || 1;

    function dims() {
      var w = stage.clientWidth || 760;
      return { w: w, h: Math.max(520, Math.min(620, w * .68)) };
    }

    var revealed = false;
    var dirty = false;   /* a draw was skipped while hidden — redraw on return */
    function draw() {
      if (!SWM.isShown(mount)) { dirty = true; return; }
      dirty = false;
      var d = dims(), pad = { x: 26, top: 52, bottom: 24 };
      svg.attr('viewBox', '0 0 ' + d.w + ' ' + d.h).attr('height', d.h);
      g.selectAll('*').remove();

      var narrow = d.w < 640;
      var skew = narrow ? 0 : 22;
      var bandH = 64, gap = (d.h - pad.top - pad.bottom - bandH * 4) / 3;
      var maxHop = d3.max(chain.hops, function (h) { return h.count; }) || 1;
      var x0 = pad.x + 8, x1 = d.w - pad.x - 8, mid = (x0 + x1) / 2;
      var ribbonMax = 180;

      chain.hops.forEach(function (hop, i) {
        var yTop = pad.top + (i + 1) * bandH + i * gap;
        var yBot = yTop + gap;
        /* strictly proportional to count — no intercept */
        var wTop = hop.count / maxHop * ribbonMax;
        var wBot = wTop * .86;
        var path = 'M' + (mid - wTop / 2) + ',' + yTop +
                   'C' + (mid - wTop / 2) + ',' + (yTop + gap * .5) + ' ' + (mid - wBot / 2) + ',' + (yBot - gap * .5) + ' ' + (mid - wBot / 2) + ',' + yBot +
                   'L' + (mid + wBot / 2) + ',' + yBot +
                   'C' + (mid + wBot / 2) + ',' + (yBot - gap * .5) + ' ' + (mid + wTop / 2) + ',' + (yTop + gap * .5) + ' ' + (mid + wTop / 2) + ',' + yTop + 'Z';
        var grad = g.append('linearGradient').attr('id', 'swmHop' + i).attr('x1', 0).attr('y1', yTop).attr('x2', 0).attr('y2', yBot).attr('gradientUnits', 'userSpaceOnUse');
        grad.append('stop').attr('offset', '0%').attr('stop-color', SWM.layerColor(hop.from)).attr('stop-opacity', .55);
        grad.append('stop').attr('offset', '100%').attr('stop-color', SWM.layerColor(hop.to)).attr('stop-opacity', .55);
        /* opaque outline carries the width as a >=3:1 mark */
        g.append('path').attr('d', path).attr('fill', 'url(#swmHop' + i + ')')
          .attr('stroke', SWM.ink.edgeStrong).attr('stroke-width', 1.4).style('cursor', 'default')
          .on('mouseenter', function (ev) { SWM.tip.show(hopTip(hop), ev); })
          .on('mousemove', function (ev) { SWM.tip.move(ev); })
          .on('mouseleave', function () { SWM.tip.hide(); });

        var top = Object.keys(hop.preds).sort(function (a, b) { return hop.preds[b] - hop.preds[a]; })[0];
        g.append('text').attr('x', mid + wTop / 2 + 12).attr('y', yTop + gap / 2 - 4)
          .attr('fill', SWM.ink.ink2).attr('font-size', 10).text(hop.count + ' relations');
        g.append('text').attr('x', mid + wTop / 2 + 12).attr('y', yTop + gap / 2 + 10)
          .attr('fill', SWM.ink.ink3).attr('font-size', 9).style('font-family', 'ui-monospace,SFMono-Regular,Menlo,monospace')
          .text(top ? top + ' ×' + hop.preds[top] : '');
        g.append('text').attr('x', mid - wTop / 2 - 12).attr('y', yTop + gap / 2 + 3)
          .attr('text-anchor', 'end').attr('fill', SWM.ink.faint).attr('font-size', 13).text('↕');
      });

      chain.layers.forEach(function (layer, i) {
        var y = pad.top + i * (bandH + gap);
        var sel = layer.id === focus;
        var plane = g.append('g').style('cursor', 'pointer')
          .attr('role', 'button').attr('tabindex', 0)
          .attr('aria-label', 'L' + layer.id + ' · ' + layer.name + ' · ' + layer.count + ' nodes' + (sel ? ' · selected' : ''))
          .on('click', function () { SWM.setLevel(layer.id, 'layers'); })
          .on('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); SWM.setLevel(layer.id, 'layers'); } })
          .on('mouseenter', function (ev) {
            SWM.tip.show('<b>L' + layer.id + ' · ' + SWM.esc(layer.name) + '</b><small>' + SWM.esc(layerBlurb(layer)) +
              '</small><small style="margin-top:5px">' + layer.count + ' nodes · coverage ' + SWM.pct(layer.coverage) +
              ' (illustrative)</small><small class="more" style="margin-top:5px">click to set the abstraction level</small>', ev);
          })
          .on('mousemove', function (ev) { SWM.tip.move(ev); })
          .on('mouseleave', function () { SWM.tip.hide(); });

        var face = 'M' + x0 + ',' + y + ' L' + x1 + ',' + y + ' L' + (x1 - skew) + ',' + (y + bandH) + ' L' + (x0 - skew) + ',' + (y + bandH) + 'Z';
        var depth = 'M' + (x0 - skew) + ',' + (y + bandH) + ' L' + (x1 - skew) + ',' + (y + bandH) + ' L' + (x1 - skew) + ',' + (y + bandH + 6) + ' L' + (x0 - skew) + ',' + (y + bandH + 6) + 'Z';
        plane.append('path').attr('d', depth)
          .attr('fill', sel ? 'rgba(183,163,255,.34)' : 'rgba(16,22,43,.7)').attr('stroke', 'none');
        plane.append('path').attr('d', face)
          .attr('fill', sel ? SWM.ink.accentSoft : SWM.ink.wash)
          .attr('stroke', sel ? SWM.layerColor(layer.id) : SWM.ink.line)
          .attr('stroke-width', sel ? 2 : 1);

        plane.append('rect').attr('x', x0).attr('y', y + 12).attr('width', 5).attr('height', bandH - 24)
          .attr('fill', SWM.layerColor(layer.id)).attr('rx', 2.5);
        plane.append('rect').attr('x', x0 + 14).attr('y', y + 15).attr('width', 27).attr('height', 18).attr('rx', 6)
          .attr('fill', SWM.layerColor(layer.id));
        plane.append('text').attr('x', x0 + 27.5).attr('y', y + 28).attr('text-anchor', 'middle')
          .attr('fill', SWM.textOn(SWM.layerColor(layer.id)))
          .attr('font-size', 11).attr('font-weight', 700).text('L' + layer.id);
        plane.append('text').attr('x', x0 + 52).attr('y', y + 28).attr('fill', SWM.ink.ink).attr('font-size', 13)
          .attr('font-weight', 650).text(clip(layer.name, narrow ? 20 : 60));
        /* narrow stages: the inspector carries the description, so the plane keeps name + counts only */
        if (!narrow) plane.append('text').attr('x', x0 + 52).attr('y', y + 45).attr('fill', SWM.ink.ink3).attr('font-size', 10)
          .text(clip(layerBlurb(layer), Math.max(24, Math.round((x1 - x0 - 260) / 5.6))));
        plane.append('text').attr('x', x1 - 16).attr('y', y + 28).attr('text-anchor', 'end')
          .attr('fill', SWM.ink.ink).attr('font-size', 17).attr('font-weight', 700).text(layer.count);
        plane.append('text').attr('x', x1 - 16).attr('y', y + 43).attr('text-anchor', 'end')
          .attr('fill', SWM.ink.ink3).attr('font-size', 9).text('nodes · illustrative coverage ' + SWM.pct(layer.coverage));

        if (!narrow) {
          var mix = Object.keys(layer.groups).sort(function (a, b) { return layer.groups[b] - layer.groups[a]; }).slice(0, 5);
          var gx = x1 - skew - 22;
          mix.forEach(function (key, k) {
            var gg = plane.append('g').attr('transform', 'translate(' + (gx - k * 44) + ',' + (y + bandH - 12) + ')');
            gg.append('path').attr('d', SWM.symbol(key, 52)).attr('opacity', .9).call(SWM.paintGlyph, () => key, () => SWM.layerColor(layer.id), 1.6);
            gg.append('text').attr('x', 9).attr('y', 4).attr('fill', SWM.ink.ink3).attr('font-size', 9).text(layer.groups[key]);
          });
        }
        if (!revealed) plane.style('opacity', 0).transition().duration(SWM.dur(650)).style('opacity', 1);
      });
      revealed = true;
    }

    function clip(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

    function hopTip(hop) {
      var preds = Object.keys(hop.preds).sort(function (a, b) { return hop.preds[b] - hop.preds[a]; });
      return '<b>L' + hop.from + ' ↔ L' + hop.to + '</b><small>' + hop.count + ' relations cross this hop</small>' +
        '<small style="margin-top:5px">' + preds.map(function (p) { return p + ' ×' + hop.preds[p]; }).join('<br>') + '</small>' +
        '<small class="more" style="margin-top:5px">adjacency only — direction is read from the links</small>';
    }

    function srcTag(src) { return src === 'silex' ? 'Silex-authored' : (src || ''); }

    function directedSample(hop) {
      var bucket = hopLinks[hop.from + ':' + hop.to] || { fwd: [], rev: [] };
      var dirs = [];
      bucket.fwd.slice(0, 1).forEach(function (l) { dirs.push([byId[l.s], byId[l.t], l.pred, l.src, 'specific → general']); });
      bucket.rev.slice(0, 1).forEach(function (l) { dirs.push([byId[l.s], byId[l.t], l.pred, l.src, 'general → specific']); });
      return dirs;
    }

    function renderSide() {
      var layer = chain.layers[focus - 1];
      document.getElementById('swmChainFocus').textContent = 'L' + layer.id + ' ' + layer.name.split(' ')[0];
      document.getElementById('swmChainTitle').textContent = 'L' + layer.id + ' · ' + layer.name;
      document.getElementById('swmChainBlurb').textContent = layerBlurb(layer);

      var up = chain.hops.find(function (h) { return h.to === layer.id; });
      var down = chain.hops.find(function (h) { return h.from === layer.id; });
      document.getElementById('swmChainFacts').innerHTML =
        '<div class="swm-fact"><small>Nodes at this tier</small><b>' + layer.count + '</b></div>' +
        '<div class="swm-fact"><small>Coverage (illustrative)</small><b>' + SWM.pct(layer.coverage) + '</b>' +
          '<div class="swm-meter"><i style="width:' + Math.round(layer.coverage * 100) + '%;background:' + SWM.coverageColor(layer.coverage, 'paper') + '"></i></div></div>' +
        '<div class="swm-fact"><small>Specialises</small><b>' + (up ? 'L' + up.from + ' · ' + up.count + ' links' : '— root tier') + '</b></div>' +
        '<div class="swm-fact"><small>Specialised by</small><b>' + (down ? 'L' + down.to + ' · ' + down.count + ' links' : '— runtime') + '</b></div>';

      document.getElementById('swmLayerList').innerHTML = chain.layers.map(function (l) {
        return '<button data-layer="' + l.id + '"' + (l.id === focus ? ' style="background:#f2edfd;font-weight:650"' : '') + '>' +
          '<span>L' + l.id + ' · ' + SWM.esc(l.name) + '</span><small>' + l.count + ' nodes</small></button>';
      }).join('');
      document.querySelectorAll('#swmLayerList [data-layer]').forEach(function (b) {
        b.addEventListener('click', function () { SWM.setLevel(+b.dataset.layer, 'layers'); });
      });

      document.getElementById('swmChainGroups').innerHTML =
        '<h4 style="margin:12px 0 7px">Groups at this tier</h4><div class="swm-chips">' +
        Object.keys(layer.groups).sort(function (a, b) { return layer.groups[b] - layer.groups[a]; }).map(function (key) {
          return '<span class="swm-chip"><svg width="12" height="12" viewBox="-7 -7 14 14" aria-hidden="true"><path d="' +
            SWM.symbol(key, 52) + '" ' + SWM.glyphAttrs(key, '#68707c') + '/></svg>' + SWM.esc(groupName[key] || key) + ' · ' + layer.groups[key] + '</span>';
        }).join('') + '</div>';

      document.getElementById('swmChainHops').innerHTML = chain.hops.map(function (hop) {
        var on = hop.from === focus || hop.to === focus;
        var preds = Object.keys(hop.preds).sort(function (a, b) { return hop.preds[b] - hop.preds[a]; }).slice(0, 3);
        var dirs = directedSample(hop);
        var ex = dirs.map(function (x) {
          return 'e.g. <b>' + SWM.esc(x[0].label) + ' → ' + SWM.esc(x[1].label) + '</b> ' + x[2] +
            (srcTag(x[3]) ? ' · <span style="opacity:.85">' + SWM.esc(srcTag(x[3])) + '</span>' : '') +
            (x[4] === 'general → specific' ? ' · <span style="opacity:.7">general → specific</span>' : ' · <span style="opacity:.7">specific → general</span>');
        }).join('<br>');
        return '<div class="swm-gap" style="' + (on ? 'border-color:' + SWM.layerColor(hop.to) : '') + '">' +
          '<strong>L' + hop.from + ' ↔ L' + hop.to + ' · ' + hop.count + ' relations</strong>' +
          '<small>' + preds.map(function (p) { return p + ' ×' + hop.preds[p]; }).join(' · ') + '</small>' +
          '<small style="opacity:.9">' + ex + '</small>' +
          '</div>';
      }).join('');
    }

    function setFocus(l) { focus = l; draw(); renderSide(); }

    document.getElementById('swmChainAction').addEventListener('click', function () {
      if (global.selectWmTab) global.selectWmTab('wm-ontology');
      else { var t = document.querySelector('[data-wm-panel="wm-ontology"]'); if (t) t.click(); }
    });
    mount.querySelector('[data-reset]').addEventListener('click', function () { SWM.setLevel(1, 'layers'); });
    SWM.onLevel(function (l) { setFocus(l); });
    SWM.onResize(function () { if (SWM.isShown(mount)) draw(); else dirty = true; });
    SWM.onPanel(function (panelId) {
      if (panelId === 'wm-architecture') { if (dirty) draw(); }
      else if (g) { g.selectAll('*').interrupt(); dirty = true; }
    });

    setFocus(SWM.level || 1);
  }

  SWM.register('wm-architecture', init);
})(window);
