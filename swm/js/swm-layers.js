/* ============================================================================
   Ontology Layers — the chain, drawn from the data.

   L1 general → L2 domain packs → L3 agentic-system → L4 runtime graph.
   Each band reports what the bundle actually holds at that layer; each ribbon
   between two bands is as thick as the number of typed relations that really
   cross that hop. Clicking a band sets the shared abstraction level, so the
   Security Ontology tab opens where you left off.
   ========================================================================== */
(function (global) {
  'use strict';
  var d3 = global.d3, SWM = global.SWM;

  function init() {
    var mount = document.getElementById('swmLayers');
    if (!mount) return;
    var data = SWM.ontology(), chain = data.chain;
    if (!chain) { mount.innerHTML = '<div class="swm"><div class="swm-loading">This bundle predates the layer chain — rebuild with swm/tools/build-ontology.mjs</div></div>'; return; }

    var groupName = {}, groupOf = {};
    data.groups.forEach(function (g) { groupName[g.id] = g.name; groupOf[g.id] = g; });

    mount.innerHTML =
      '<div class="swm">' +
        '<div class="swm-shell coverage">' +
          '<div class="swm-stage" id="swmLayersStage">' +
            '<div class="swm-stage-bar">' +
              '<div class="swm-crumbs"><button data-reset="1">Ontology chain</button><i>›</i><b id="swmChainFocus" style="color:#17191d;font-weight:640">L1 General</b></div>' +
              '<div class="swm-views" id="swmChainAction"><button data-open="1">Open this layer in the Explorer ↗</button></div>' +
            '</div>' +
            '<svg id="swmChainSvg"></svg>' +
            '<div class="swm-legend"><h6>One chain, four layers</h6>' +
              '<div class="swm-legend-items">' +
                '<span class="swm-legend-item"><span style="width:22px;height:8px;border-radius:3px;background:linear-gradient(90deg,#50339c,#b8a3ee);display:inline-block"></span>band colour = abstraction layer</span>' +
                '<span class="swm-legend-item"><span style="width:22px;height:8px;border-radius:3px;background:rgba(111,80,201,.3);display:inline-block"></span>ribbon width = typed relations crossing the hop</span>' +
              '</div></div>' +
            '<div class="swm-hint">Click a band to set the abstraction level · hover a ribbon for its predicates</div>' +
          '</div>' +
          '<div class="swm-side">' +
            '<div class="swm-card"><h4 id="swmChainTitle">L1 · General Agent Security Ontology</h4>' +
              '<p class="sub" id="swmChainBlurb"></p>' +
              '<div class="swm-facts" id="swmChainFacts"></div>' +
              '<div id="swmChainGroups"></div></div>' +
            '<div class="swm-card"><h4>How the layers relate</h4>' +
              '<p class="sub">Each layer specialises the one above it; nothing skips a hop, and the build refuses to publish a bundle that does.</p>' +
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

    var revealed = false;   // one-time L1→L4 build animation on first open (screen-recordable)
    function draw() {
      var d = dims(), pad = { x: 26, top: 46, bottom: 104 };
      svg.attr('viewBox', '0 0 ' + d.w + ' ' + d.h).attr('height', d.h);
      g.selectAll('*').remove();

      var bandH = 66, gap = (d.h - pad.top - pad.bottom - bandH * 4) / 3;
      var maxHop = d3.max(chain.hops, function (h) { return h.count; }) || 1;
      var x0 = pad.x + 8, x1 = d.w - pad.x - 8, mid = (x0 + x1) / 2;

      /* ribbons first, so the bands sit on top of them */
      chain.hops.forEach(function (hop, i) {
        var yTop = pad.top + (i + 1) * bandH + i * gap;
        var yBot = yTop + gap;
        var wTop = 34 + 150 * (hop.count / maxHop);
        var wBot = wTop * .86;
        var path = 'M' + (mid - wTop / 2) + ',' + yTop +
                   'C' + (mid - wTop / 2) + ',' + (yTop + gap * .5) + ' ' + (mid - wBot / 2) + ',' + (yBot - gap * .5) + ' ' + (mid - wBot / 2) + ',' + yBot +
                   'L' + (mid + wBot / 2) + ',' + yBot +
                   'C' + (mid + wBot / 2) + ',' + (yBot - gap * .5) + ' ' + (mid + wTop / 2) + ',' + (yTop + gap * .5) + ' ' + (mid + wTop / 2) + ',' + yTop + 'Z';
        var grad = g.append('linearGradient').attr('id', 'swmHop' + i).attr('x1', 0).attr('y1', yTop).attr('x2', 0).attr('y2', yBot).attr('gradientUnits', 'userSpaceOnUse');
        grad.append('stop').attr('offset', '0%').attr('stop-color', SWM.layerColor(hop.from)).attr('stop-opacity', .42);
        grad.append('stop').attr('offset', '100%').attr('stop-color', SWM.layerColor(hop.to)).attr('stop-opacity', .42);
        g.append('path').attr('d', path).attr('fill', 'url(#swmHop' + i + ')')
          .attr('stroke', 'rgba(111,80,201,.25)').style('cursor', 'default')
          .on('mouseenter', function (ev) { SWM.tip.show(hopTip(hop), ev); })
          .on('mousemove', function (ev) { SWM.tip.move(ev); })
          .on('mouseleave', function () { SWM.tip.hide(); });

        var top = Object.keys(hop.preds).sort(function (a, b) { return hop.preds[b] - hop.preds[a]; })[0];
        g.append('text').attr('x', mid + wTop / 2 + 14).attr('y', yTop + gap / 2 - 4)
          .attr('fill', SWM.ink.ink2).attr('font-size', 10).text(hop.count + ' typed relations');
        g.append('text').attr('x', mid + wTop / 2 + 14).attr('y', yTop + gap / 2 + 10)
          .attr('fill', SWM.ink.ink3).attr('font-size', 9).style('font-family', 'ui-monospace,SFMono-Regular,Menlo,monospace')
          .text(top ? top + ' ×' + hop.preds[top] : '');
        g.append('text').attr('x', mid - wTop / 2 - 14).attr('y', yTop + gap / 2 + 3)
          .attr('text-anchor', 'end').attr('fill', SWM.ink.faint).attr('font-size', 18).text('↓');
      });

      /* bands */
      chain.layers.forEach(function (layer, i) {
        var y = pad.top + i * (bandH + gap);
        var sel = layer.id === focus;
        var band = g.append('g').style('cursor', 'pointer')
          .on('click', function () { SWM.setLevel(layer.id, 'layers'); })
          .on('mouseenter', function (ev) {
            SWM.tip.show('<b>L' + layer.id + ' · ' + SWM.esc(layer.name) + '</b><small>' + SWM.esc(layer.blurb) +
              '</small><small style="margin-top:5px">' + layer.count + ' types · average coverage ' + SWM.pct(layer.coverage) +
              '</small><small class="more" style="margin-top:5px">click to set the abstraction level</small>', ev);
          })
          .on('mousemove', function (ev) { SWM.tip.move(ev); })
          .on('mouseleave', function () { SWM.tip.hide(); });

        band.append('rect').attr('x', x0).attr('y', y).attr('width', x1 - x0).attr('height', bandH).attr('rx', 13)
          .attr('fill', sel ? SWM.ink.accentSoft : SWM.ink.wash)
          .attr('stroke', sel ? SWM.layerColor(layer.id) : SWM.ink.line)
          .attr('stroke-width', sel ? 2 : 1);
        band.append('rect').attr('x', x0).attr('y', y).attr('width', 6).attr('height', bandH)
          .attr('fill', SWM.layerColor(layer.id)).attr('rx', 3);
        /* the layer number rides on a filled pill in the true layer colour, so a
           pale step never has to carry text on the white canvas */
        band.append('rect').attr('x', x0 + 14).attr('y', y + 14).attr('width', 26).attr('height', 18).attr('rx', 6)
          .attr('fill', SWM.layerColor(layer.id));
        band.append('text').attr('x', x0 + 27).attr('y', y + 27).attr('text-anchor', 'middle')
          .attr('fill', SWM.textOn(SWM.layerColor(layer.id)))
          .attr('font-size', 11).attr('font-weight', 700).text('L' + layer.id);
        band.append('text').attr('x', x0 + 50).attr('y', y + 27).attr('fill', SWM.ink.ink).attr('font-size', 13)
          .attr('font-weight', 650).text(layer.name);
        band.append('text').attr('x', x0 + 50).attr('y', y + 45).attr('fill', SWM.ink.ink3).attr('font-size', 10)
          .text(clip(layer.blurb, Math.max(24, Math.round((x1 - x0 - 260) / 5.4))));
        band.append('text').attr('x', x1 - 18).attr('y', y + 27).attr('text-anchor', 'end')
          .attr('fill', SWM.ink.ink).attr('font-size', 17).attr('font-weight', 700).text(layer.count);
        band.append('text').attr('x', x1 - 18).attr('y', y + 42).attr('text-anchor', 'end')
          .attr('fill', SWM.ink.ink3).attr('font-size', 9).text('types · coverage ' + SWM.pct(layer.coverage));

        /* group mix: shape carries the group, so the glyphs do the work */
        var mix = Object.keys(layer.groups).sort(function (a, b) { return layer.groups[b] - layer.groups[a]; }).slice(0, 5);
        var gx = x1 - 22;
        mix.forEach(function (key, k) {
          var gg = band.append('g').attr('transform', 'translate(' + (gx - k * 42) + ',' + (y + bandH - 13) + ')');
          gg.append('path').attr('d', SWM.symbol(key, 52)).attr('fill', SWM.layerColor(layer.id)).attr('opacity', .9);
          gg.append('text').attr('x', 9).attr('y', 4).attr('fill', SWM.ink.ink3).attr('font-size', 9).text(layer.groups[key]);
        });
        if (!revealed) band.style('opacity', 0).transition().duration(520).delay(260 + i * 240).style('opacity', 1);
      });
      revealed = true;
    }

    function clip(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

    function hopTip(hop) {
      var preds = Object.keys(hop.preds).sort(function (a, b) { return hop.preds[b] - hop.preds[a]; });
      return '<b>L' + hop.from + ' → L' + hop.to + '</b><small>' + hop.count + ' typed relations cross this hop</small>' +
        '<small style="margin-top:5px">' + preds.map(function (p) { return p + ' ×' + hop.preds[p]; }).join('<br>') + '</small>';
    }

    function renderSide() {
      var layer = chain.layers[focus - 1];
      document.getElementById('swmChainFocus').textContent = 'L' + layer.id + ' ' + layer.name.split(' ')[0];
      document.getElementById('swmChainTitle').textContent = 'L' + layer.id + ' · ' + layer.name;
      document.getElementById('swmChainBlurb').textContent = layer.blurb;

      var up = chain.hops.find(function (h) { return h.to === layer.id; });
      var down = chain.hops.find(function (h) { return h.from === layer.id; });
      document.getElementById('swmChainFacts').innerHTML =
        '<div class="swm-fact"><small>Types at this layer</small><b>' + layer.count + '</b></div>' +
        '<div class="swm-fact"><small>Average coverage</small><b>' + SWM.pct(layer.coverage) + '</b>' +
          '<div class="swm-meter"><i style="width:' + Math.round(layer.coverage * 100) + '%;background:' + SWM.coverageColor(layer.coverage) + '"></i></div></div>' +
        '<div class="swm-fact"><small>Specialises</small><b>' + (up ? 'L' + up.from + ' · ' + up.count + ' links' : '— root layer') + '</b></div>' +
        '<div class="swm-fact"><small>Specialised by</small><b>' + (down ? 'L' + down.to + ' · ' + down.count + ' links' : '— runtime') + '</b></div>';

      document.getElementById('swmChainGroups').innerHTML =
        '<p class="swm-rail-title" style="margin:12px 0 7px">Ontology groups at this layer</p><div class="swm-chips">' +
        Object.keys(layer.groups).sort(function (a, b) { return layer.groups[b] - layer.groups[a]; }).map(function (key) {
          return '<span class="swm-chip"><svg width="12" height="12" viewBox="-7 -7 14 14"><path d="' +
            SWM.symbol(key, 52) + '" fill="#68707c"/></svg>' + SWM.esc(groupName[key] || key) + ' · ' + layer.groups[key] + '</span>';
        }).join('') + '</div>';

      document.getElementById('swmChainHops').innerHTML = chain.hops.map(function (hop) {
        var on = hop.from === focus || hop.to === focus;
        var preds = Object.keys(hop.preds).sort(function (a, b) { return hop.preds[b] - hop.preds[a]; }).slice(0, 3);
        var sample = hop.examples[0];
        return '<div class="swm-gap" style="' + (on ? 'border-color:' + SWM.layerColor(hop.to) : '') + '">' +
          '<strong>L' + hop.from + ' → L' + hop.to + ' · ' + hop.count + ' relations</strong>' +
          '<small>' + preds.map(function (p) { return p + ' ×' + hop.preds[p]; }).join(' · ') + '</small>' +
          (sample ? '<small style="opacity:.8">e.g. ' + SWM.esc(sample.fromLabel) + ' ' + sample.pred + ' ' + SWM.esc(sample.toLabel) + '</small>' : '') +
          '</div>';
      }).join('');
    }

    function setFocus(l) { focus = l; draw(); renderSide(); }

    document.getElementById('swmChainAction').addEventListener('click', function () {
      var tab = document.querySelector('[data-wm-panel="wm-ontology"]');
      if (tab) tab.click();
    });
    mount.querySelector('[data-reset]').addEventListener('click', function () { SWM.setLevel(1, 'layers'); });
    SWM.onLevel(function (l) { setFocus(l); });
    SWM.onResize(function () { if (mount.offsetParent) draw(); });

    setFocus(SWM.level || 1);
  }

  SWM.register('wm-architecture', init);
})(window);
