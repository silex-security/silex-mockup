/* ============================================================================
   Coverage Observatory — the World Model Coverage panel.

   A zoomable sunburst over Enterprise → Domain → Capability → Workflow, with a
   radar that re-reads the six semantic dimensions AT THE FOCUSED LEVEL. The
   same six axes give different answers depending on how far you have drilled
   in — that is the multi-layer abstraction claim, made visible.
   ========================================================================== */
(function (global) {
  'use strict';
  var d3 = global.d3, SWM = global.SWM;

  function init() {
    var mount = document.getElementById('swmCoverage');
    if (!mount) return;
    var data = SWM.coverage();
    var dims = data.dimensions;

    mount.innerHTML =
      '<div class="swm">' +
        '<div class="swm-kpis" id="swmKpis"></div>' +
        '<div class="swm-shell coverage">' +
          '<div class="swm-stage" id="swmCovStage">' +
            '<div class="swm-stage-bar"><div class="swm-crumbs" id="swmCovCrumbs"></div>' +
              '<div class="swm-views" id="swmCovModes">' +
                '<button data-m="coverage" class="active">◐ Coverage</button>' +
                '<button data-m="gaps">△ Gap weight</button></div></div>' +
            '<svg id="swmCovSvg"></svg>' +
            '<div class="swm-legend"><h6 id="swmCovLegendTitle">Coverage of the relevant environment</h6>' +
              '<div class="swm-ramp" id="swmCovRamp"><span id="swmRampLo">40%</span><span class="bar"></span><span id="swmRampHi">100%</span></div>' +
              '<div class="swm-legend-items" style="margin-top:6px" id="swmCovStatus"></div></div>' +
            '<div class="swm-hint">Click a ring to drill in · click the centre to go back up</div>' +
          '</div>' +
          '<div class="swm-side">' +
            '<div class="swm-card"><h4 id="swmRadarTitle">Enterprise</h4>' +
              '<p class="sub" id="swmRadarSub">Completeness by semantic dimension at this level</p>' +
              '<div class="swm-radar-wrap"><svg class="swm-radar" id="swmRadar" viewBox="0 0 300 260"></svg></div>' +
              '<div class="swm-facts" id="swmCovFacts" style="margin-top:11px"></div></div>' +
            '<div class="swm-card"><h4>Coverage gaps in scope</h4>' +
              '<p class="sub" id="swmGapSub">Gaps that fall inside the selected part of the world model</p>' +
              '<div class="swm-gaps" id="swmGaps"></div></div>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.getElementById('swmKpis').innerHTML = data.kpis.map(function (k) {
      return '<div class="swm-kpi"><small>' + SWM.esc(k.label) + '</small><b>' + SWM.esc(k.value) + '</b>' +
        '<span>' + SWM.esc(k.note) + '</span><br><span class="delta ' + SWM.esc(k.dir) + '">' + SWM.esc(k.delta) + '</span></div>';
    }).join('');
    document.getElementById('swmCovStatus').innerHTML = Object.keys(SWM.status).map(function (k) {
      var s = SWM.status[k];
      return '<span class="swm-legend-item"><span style="color:' + s.color + '">' + s.icon + '</span>' + s.label + '</span>';
    }).join('');

    /* ---- hierarchy ------------------------------------------------------- */
    var root = d3.hierarchy(data.tree, function (n) { return n.children; })
      .sum(function (n) { return n.children && n.children.length ? 0 : (n.entities || 1); })
      .sort(function (a, b) { return b.value - a.value; });
    root.each(function (n) { n.current = n; });

    var stage = document.getElementById('swmCovStage');
    var svg = d3.select('#swmCovSvg'), g = svg.append('g');
    var focus = root, mode = 'coverage';

    function fillOf(n) {
      if (mode === 'gaps') {
        var miss = 1 - (n.data.coverage || 0);
        return d3.interpolateRgb('#2a3350', '#e66767')(Math.min(1, miss / .45));
      }
      return SWM.coverageColor(n.data.coverage);
    }

    function size() {
      var w = stage.clientWidth || 720;
      return { w: w, h: Math.max(460, Math.min(600, w * .74)) };
    }

    var arc, radius;
    /* ring width grows as you drill in, so a two-ring view still fills the canvas */
    function band() { return radius / Math.max(2, root.height + 1 - focus.depth); }

    function layout() {
      var s = size();
      /* the legend sits bottom-left and the hint bottom-right: keep the ring clear of both */
      radius = Math.max(150, Math.min(s.w - 120, s.h - 132) / 2);
      /* size the canvas to the ring plus the legend strip, so no dead space is left below */
      var h = radius * 2 + 118;
      svg.attr('viewBox', '0 0 ' + s.w + ' ' + h).attr('height', h);
      g.attr('transform', 'translate(' + s.w / 2 + ',' + (radius + 26) + ')');
      d3.partition().size([2 * Math.PI, root.height + 1])(root);
      arc = d3.arc()
        .startAngle(function (n) { return n.x0; }).endAngle(function (n) { return n.x1; })
        .padAngle(function (n) { return Math.min((n.x1 - n.x0) / 2, 0.006); }).padRadius(radius * 1.5)
        .innerRadius(function (n) { return n.y0 * band(); })
        .outerRadius(function (n) { return Math.max(n.y0 * band(), n.y1 * band() - 1.6); });
    }

    function visibleFrame(p) { return p.y1 <= root.height + 1 && p.y0 >= 1 && p.x1 > p.x0; }
    function visible(n) { return visibleFrame(n.current); }

    var path, label, centre, centreText;
    function draw() {
      layout();
      g.selectAll('*').remove();

      path = g.append('g').selectAll('path').data(root.descendants().slice(1)).join('path')
        .attr('fill', fillOf).attr('fill-opacity', function (n) { return visible(n) ? (n.children ? .92 : .74) : 0; })
        .attr('pointer-events', function (n) { return visible(n) ? 'auto' : 'none'; })
        .attr('stroke', '#131a30').attr('stroke-width', 2).attr('d', function (n) { return arc(n.current); })
        .style('cursor', 'pointer')
        .on('click', function (ev, n) { ev.stopPropagation(); zoomTo(n); })
        .on('mouseenter', function (ev, n) {
          var st = SWM.status[SWM.coverageStatus(n.data.coverage)];
          SWM.tip.show('<b>' + SWM.esc(n.data.name) + '</b><small>' + SWM.esc(n.data.kind) + ' · ' +
            SWM.num(n.data.entities) + ' entities</small><small style="margin-top:4px">Coverage ' +
            SWM.pct(n.data.coverage) + ' · <span style="color:' + st.color + '">' + st.icon + ' ' + st.label + '</span></small>' +
            (n.children ? '<small style="margin-top:5px;color:#9cc6f7">click to drill into ' + n.children.length + ' children</small>' : ''), ev);
        })
        .on('mousemove', function (ev) { SWM.tip.move(ev); })
        .on('mouseleave', function () { SWM.tip.hide(); });

      label = g.append('g').attr('pointer-events', 'none').attr('text-anchor', 'middle')
        .selectAll('text').data(root.descendants().slice(1)).join('text')
        .attr('dy', '0.34em').attr('fill', '#eef2fb').attr('font-size', 10)
        .attr('fill-opacity', function (n) { return +labelVisible(n.current); })
        .attr('transform', function (n) { return labelTransform(n.current); })
        .text(function (n) { return short(labelOf(n.data), n); });

      centre = g.append('circle').attr('r', band()).attr('fill', '#0e1428')
        .attr('stroke', 'rgba(146,170,224,.28)').style('cursor', 'pointer')
        .on('click', function (ev) { ev.stopPropagation(); zoomTo(focus.parent || root); });
      centreText = g.append('g').attr('pointer-events', 'none').attr('text-anchor', 'middle');
      paintCentre();
    }

    function labelOf(d) { return d.kind === 'workflow' ? d.id : d.name; }

    function short(name, n) {
      var w = (n.current.x1 - n.current.x0) * 180 / Math.PI;
      var max = Math.max(6, Math.round(w / 3.4));
      return name.length > max ? name.slice(0, max - 1) + '…' : name;
    }
    function labelVisible(p) { return p.y1 <= root.height + 1 && p.y0 >= 1 && (p.y1 - p.y0) * (p.x1 - p.x0) > 0.085; }
    function labelTransform(p) {
      var x = (p.x0 + p.x1) / 2 * 180 / Math.PI;
      var y = (p.y0 + p.y1) / 2 * band();
      return 'rotate(' + (x - 90) + ') translate(' + y + ',0) rotate(' + (x < 180 ? 0 : 180) + ')';
    }

    function paintCentre() {
      var st = SWM.status[SWM.coverageStatus(focus.data.coverage)];
      centreText.selectAll('*').remove();
      centreText.append('text').attr('y', -10).attr('fill', '#eef2fb').attr('font-size', 26).attr('font-weight', 700)
        .text(SWM.pct(focus.data.coverage));
      centreText.append('text').attr('y', 9).attr('fill', '#aab6d4').attr('font-size', 10)
        .text(focus.data.name.length > 20 ? focus.data.name.slice(0, 19) + '…' : focus.data.name);
      centreText.append('text').attr('y', 25).attr('fill', st.color).attr('font-size', 9)
        .text(st.icon + ' ' + st.label + (focus.parent ? ' · back ↑' : ''));
    }

    function zoomTo(p) {
      if (!p) return;
      focus = p;
      root.each(function (n) {
        n.target = {
          x0: Math.max(0, Math.min(1, (n.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
          x1: Math.max(0, Math.min(1, (n.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
          y0: Math.max(0, n.y0 - p.depth), y1: Math.max(0, n.y1 - p.depth)
        };
      });
      var t = g.transition().duration(680);
      path.transition(t).tween('data', function (n) {
        var i = d3.interpolate(n.current, n.target);
        return function (tt) { n.current = i(tt); };
      })
        .attrTween('d', function (n) { return function () { return arc(n.current); }; })
        /* opacity follows the TARGET frame: reading n.current here would freeze
           an arc at whatever it looked like before the transition started */
        .attr('fill-opacity', function (n) { return visibleFrame(n.target) ? (n.children ? .92 : .74) : 0; })
        .attr('pointer-events', function (n) { return visibleFrame(n.target) ? 'auto' : 'none'; });
      label.transition(t)
        .attr('fill-opacity', function (n) { return +labelVisible(n.target); })
        .attrTween('transform', function (n) { return function () { return labelTransform(n.current); }; })
        .text(function (n) { return short(labelOf(n.data), n); });
      centre.transition().duration(680).attr('r', band());
      paintCentre();
      renderContext();
    }

    /* ---- radar ----------------------------------------------------------- */
    var R = 86, CX = 150, CY = 122;
    var radar = d3.select('#swmRadar');
    (function radarFrame() {
      [.25, .5, .75, 1].forEach(function (r) {
        radar.append('circle').attr('class', 'ring').attr('cx', CX).attr('cy', CY).attr('r', R * r);
      });
      dims.forEach(function (d, i) {
        var a = angle(i);
        radar.append('line').attr('class', 'axis').attr('x1', CX).attr('y1', CY)
          .attr('x2', CX + Math.cos(a) * R).attr('y2', CY + Math.sin(a) * R);
        var lx = CX + Math.cos(a) * (R + 22), ly = CY + Math.sin(a) * (R + 22);
        radar.append('text').attr('x', lx).attr('y', ly)
          .attr('text-anchor', Math.abs(Math.cos(a)) < .3 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end'))
          .attr('dy', Math.sin(a) > .5 ? 9 : Math.sin(a) < -.5 ? -3 : 3)
          .text(d.name.split(' ')[0]);
        radar.append('text').attr('class', 'val').attr('x', lx).attr('y', ly + (Math.sin(a) > .5 ? 20 : Math.sin(a) < -.5 ? 8 : 14))
          .attr('text-anchor', Math.abs(Math.cos(a)) < .3 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end'))
          .attr('id', 'swmDim-' + d.id).text('—');
      });
      radar.append('path').attr('class', 'area').attr('d', 'M0,0');
      radar.append('g').attr('id', 'swmRadarPts');
    })();
    function angle(i) { return (Math.PI * 2 * i / dims.length) - Math.PI / 2; }
    function radarPath(values) {
      return values.map(function (v, i) {
        var a = angle(i);
        return (i ? 'L' : 'M') + (CX + Math.cos(a) * R * v).toFixed(1) + ',' + (CY + Math.sin(a) * R * v).toFixed(1);
      }).join('') + 'Z';
    }
    function paintRadar(node) {
      var d = node.data.dims || inheritDims(node);
      var values = dims.map(function (x) { return d[x.id] || 0; });
      radar.select('.area').transition().duration(560).attr('d', radarPath(values));
      var pts = radar.select('#swmRadarPts').selectAll('circle').data(values).join('circle').attr('class', 'pt').attr('r', 3);
      pts.transition().duration(560)
        .attr('cx', function (v, i) { return CX + Math.cos(angle(i)) * R * v; })
        .attr('cy', function (v, i) { return CY + Math.sin(angle(i)) * R * v; });
      dims.forEach(function (x, i) { document.getElementById('swmDim-' + x.id).textContent = SWM.pct(values[i]); });
    }
    function inheritDims(node) {
      var p = node;
      while (p && !p.data.dims) p = p.parent;
      if (!p) return {};
      var delta = (node.data.coverage || 0) - (p.data.coverage || 0);
      var out = {};
      Object.keys(p.data.dims).forEach(function (k) { out[k] = Math.max(.2, Math.min(.99, p.data.dims[k] + delta)); });
      return out;
    }

    /* ---- context: crumbs, facts, gaps ------------------------------------ */
    function renderContext() {
      var trail = focus.ancestors().reverse();
      var el = document.getElementById('swmCovCrumbs');
      el.innerHTML = trail.map(function (n, i) {
        return (i ? '<i>›</i>' : '') + '<button data-depth="' + i + '">' + SWM.esc(n.data.name) + '</button>';
      }).join('');
      el.querySelectorAll('[data-depth]').forEach(function (b) {
        b.addEventListener('click', function () { zoomTo(trail[+b.dataset.depth]); });
      });

      document.getElementById('swmRadarTitle').textContent = focus.data.name;
      document.getElementById('swmRadarSub').textContent =
        'Six semantic dimensions read at the ' + (focus.data.kind === 'enterprise' ? 'enterprise' : focus.data.kind) + ' level';
      paintRadar(focus);

      var d = focus.data, st = SWM.status[SWM.coverageStatus(d.coverage)];
      var facts = [
        ['Coverage', SWM.pct(d.coverage)],
        ['Status', '<span style="color:' + st.color + '">' + st.icon + ' ' + st.label + '</span>'],
        ['Entities', SWM.num(d.entities)],
        [d.kind === 'workflow' ? 'Registered' : 'Open incidents',
         d.kind === 'workflow' ? 'Yes' : String(d.incidents != null ? d.incidents : sumIncidents(focus))]
      ];
      if (d.agents) facts.push(['Agents', String(d.agents)], ['Workflows', String(d.workflows)]);
      if (d.pack) facts.push(['Domain pack', SWM.esc(d.pack)], ['Owner', SWM.esc(d.owner)]);
      document.getElementById('swmCovFacts').innerHTML = facts.map(function (f) {
        return '<div class="swm-fact"><small>' + f[0] + '</small><b>' + f[1] + '</b></div>';
      }).join('');

      /* a gap is in scope only when the focused node is on its recorded path */
      var inScope = data.gaps.filter(function (gp) { return gp.scope.indexOf(focus.data.id) >= 0; });
      document.getElementById('swmGapSub').textContent = inScope.length
        ? inScope.length + ' gap' + (inScope.length === 1 ? '' : 's') + ' inside ' + focus.data.name
        : 'No open gap recorded inside ' + focus.data.name;
      document.getElementById('swmGaps').innerHTML = inScope.map(function (gp) {
        var s = SWM.status[gp.severity] || SWM.status.warning;
        var act = gp.action ? '<button class="btn secondary" style="padding:5px 9px;font-size:10px" ' +
          attrFor(gp.action) + '>' + SWM.esc(gp.action.label) + '</button>' : '<span class="tbd">Later</span>';
        return '<div class="swm-gap"><strong>' + SWM.esc(gp.title) + '</strong><small>' + SWM.esc(gp.detail) + '</small>' +
          '<div class="row"><span class="swm-sev ' + SWM.esc(gp.severity) + '">' + s.icon + ' ' + s.label + '</span>' + act + '</div></div>';
      }).join('') || '<p class="swm-note">Everything in scope is inside the model. Drill into another branch to compare.</p>';
    }
    function attrFor(a) {
      return ({ gap: 'data-gap="', libUnregistered: 'data-lib-unregistered="', incident: 'data-open-incident="',
                workflow: 'data-open-workflow="' }[a.kind] || 'data-gap="') + SWM.esc(a.value) + '"';
    }
    /* incidents are recorded on both domains and capabilities — sum one level only */
    function sumIncidents(node) {
      if (!node.children) return node.data.incidents || 0;
      return node.children.reduce(function (n, c) { return n + (c.data.incidents || 0); }, 0);
    }

    /* ---- events ---------------------------------------------------------- */
    document.getElementById('swmCovModes').addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      mode = b.dataset.m;
      this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('active', x === b); });
      document.getElementById('swmCovLegendTitle').textContent = mode === 'gaps'
        ? 'Unmodelled share of the environment' : 'Coverage of the relevant environment';
      document.getElementById('swmCovRamp').classList.toggle('gaps', mode === 'gaps');
      document.getElementById('swmRampLo').textContent = mode === 'gaps' ? 'none' : '40%';
      document.getElementById('swmRampHi').textContent = mode === 'gaps' ? '45%+ missing' : '100%';
      path.transition().duration(380).attr('fill', fillOf);
    });
    svg.on('click', function () { zoomTo(focus.parent || root); });
    SWM.onResize(function () { if (mount.offsetParent) { draw(); zoomTo(focus); } });

    draw();
    renderContext();
  }

  SWM.register('wm-overview', init);
})(window);
