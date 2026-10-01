/* Coverage Observatory — World Model Coverage panel (T2, 2026-09-21).
   Sunburst + numbered companion list on the dark stage; six dimension bars
   (or radar); critical-first gap list. Angular size = leaf-entity weight;
   colour = authored `coverage` over the 40–100 % display domain (clamped). */
(function (global) {
  'use strict';
  var d3 = global.d3, SWM = global.SWM;

  /* fixture IDs collide with website IDs; append the suffix directly. */
  function dispName(d) {
    var n = d.name || d.id;
    if ((d.id === 'WF-021' || d.id === 'I-1042') && !/\(SWM fixture\)/.test(n)) n += ' (SWM fixture)';
    return n;
  }

  function init() {
    var mount = document.getElementById('swmCoverage');
    if (!mount) return;
    var data = SWM.coverage();
    var onto = SWM.ontology();
    var dims = data.dimensions;
    var kpi = {};
    data.kpis.forEach(function (k) { kpi[k.id] = k; });
    var critical = data.gaps.filter(function (g) { return g.severity === 'critical'; }).length;

    mount.innerHTML =
      '<div class="swm">' +
        '<div style="font:700 10px var(--swm-mono,monospace);letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:0 0 8px">' +
          'Enterprise · authored demo figures · these KPIs stay at enterprise scope when you drill in</div>' +
        '<div class="swm-kpis" id="swmCovKpis"></div>' +
        '<div class="swm-shell coverage">' +
          '<div class="swm-stage" id="swmCovStage" style="display:flex;flex-direction:column">' +
            '<div style="flex:none;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 16px 6px;flex-wrap:wrap">' +
              '<div class="swm-crumbs" id="swmCovCrumbs"></div>' +
              '<div class="swm-views" id="swmCovModes">' +
                '<button data-m="coverage" class="active" aria-pressed="true">◐ Coverage</button>' +
                '<button data-m="gaps" aria-pressed="false">△ Gap weight</button></div></div>' +
            '<div id="swmCovBody" style="flex:1 1 auto;display:flex;flex-wrap:wrap;align-items:stretch;min-height:0">' +
              '<div id="swmCovSun" style="flex:1 1 340px;min-width:340px"><svg id="swmCovSvg"></svg></div>' +
              '<div id="swmCovList" aria-label="Domain coverage list" ' +
                'style="flex:0 0 248px;min-width:220px;padding:16px 14px;border-left:1px solid rgba(203,210,255,.14);color:var(--swm-ink)"></div>' +
            '</div>' +
            '<div style="flex:none;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 16px;border-top:1px solid rgba(203,210,255,.1);flex-wrap:wrap">' +
              '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px">' +
                '<span style="font:700 9.5px var(--swm-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--swm-ink-2)" id="swmCovLegendTitle">Coverage of the relevant environment</span>' +
                '<span class="swm-ramp" id="swmCovRamp"><span id="swmRampLo">40%</span><span class="bar"></span><span id="swmRampHi">100%</span></span>' +
                '<span class="swm-legend-items" id="swmCovStatus"></span>' +
              '</div>' +
              '<div class="swm-caption" id="swmCovProvenance" style="flex:1 1 260px;min-width:240px;text-align:right"></div>' +
            '</div>' +
          '</div>' +
          '<div class="swm-side">' +
            '<div class="swm-card"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px">' +
              '<h4 id="swmRadarTitle">Enterprise</h4>' +
              '<div class="swm-seg" id="swmCovDimsMode"><button data-v="bars" class="active" aria-pressed="true">Bars</button>' +
                '<button data-v="radar" aria-pressed="false">Radar</button></div></div>' +
              '<p class="sub" id="swmRadarSub">Six model-completeness dimensions read at this level (not the Business Harness objectives)</p>' +
              '<div class="swm-radar-wrap" id="swmRadarWrap" hidden><svg class="swm-radar" id="swmRadar" viewBox="0 0 300 260"></svg></div>' +
              '<div id="swmCovBars"></div>' +
              '<div class="swm-facts" id="swmCovFacts" style="margin-top:11px"></div></div>' +
            '<div class="swm-card"><h4>Coverage gaps in scope</h4>' +
              '<p class="sub" id="swmGapSub">Gaps inside the selected part of the world model</p>' +
              '<div class="swm-gaps" id="swmGaps"></div>' +
              '<div id="swmGapMore"></div></div>' +
          '</div>' +
        '</div>' +
        '<details class="swm-more"><summary>Illustrative scope metadata <small>authored fixture figures</small></summary>' +
          '<div class="swm-more-body"><b>' + SWM.esc(kpi.entities ? kpi.entities.value : '—') + '</b> entities understood · ' +
          'typed and linked in the runtime graph. This is a fixture figure, distinct from the <b>' + (onto ? onto.nodes.length : '—') + '-node</b> ontology inventory (which counts nodes, not types).</div></details>' +
        '<details class="swm-more"><summary>Illustrative calibration metadata <small>authored, not a fresh timestamp</small></summary>' +
          '<div class="swm-more-body">Last calibration <b>' + SWM.esc(kpi.calib ? kpi.calib.value : '—') + '</b> · ' +
          SWM.esc(kpi.calib ? (kpi.calib.note + ' · ' + kpi.calib.delta) : '') + '. These are static demo values, not a live measurement.</div></details>' +
      '</div>';

    document.getElementById('swmCovKpis').innerHTML =
      '<div class="swm-kpi"><small>Enterprise coverage</small><b>' + SWM.pct(data.tree.coverage) + '</b>' +
        '<span>Illustrative · authored aggregate</span></div>' +
      '<div class="swm-kpi"><small>Domain packs</small><b>' + data.tree.children.length + '</b>' +
        '<span>From the current coverage bundle</span></div>' +
      '<div class="swm-kpi"><small>Known gaps</small><b>' + data.gaps.length + '</b>' +
        '<span>Illustrative · ' + critical + ' marked critical</span></div>' +
      '<div class="swm-kpi"><small>Nodes / relations</small><b>' + (onto ? onto.nodes.length : '—') + ' / ' + (onto ? onto.links.length : '—') + '</b>' +
        '<span>Bundle counts</span></div>';
    document.getElementById('swmCovStatus').innerHTML = Object.keys(SWM.status).map(function (k) {
      return '<span class="swm-legend-item">' + SWM.statusHtml(k) + '</span>';
    }).join('');

    /* hierarchy */
    var root = d3.hierarchy(data.tree, function (n) { return n.children; })
      .sum(function (n) { return n.children && n.children.length ? 0 : (n.entities || 1); })
      .sort(function (a, b) { return b.value - a.value; });
    root.each(function (n) { n.current = n; });

    var sunEl = document.getElementById('swmCovSun');
    var svg = d3.select('#swmCovSvg'), g = svg.append('g');
    var focus = root, mode = 'coverage', dimMode = 'bars';
    var gapsExpanded = false, forceGap = null;

    function fillOf(n) {
      if (mode === 'gaps') {
        var miss = 1 - (n.data.coverage || 0);
        /* light violet (no gap) → pink (large gap) */
        return d3.interpolateRgb('#9aa4e8', '#f06a9f')(Math.min(1, Math.max(0, miss / .45)));
      }
      return SWM.coverageColor(n.data.coverage);
    }

    var arc, radius;
    function band() { return radius / Math.max(2, root.height + 1 - focus.depth); }

    function layout() {
      var w = sunEl.clientWidth || 480;
      radius = Math.max(120, Math.min((w - 80) / 2, 290));
      var h = radius * 2 + 24;
      svg.attr('viewBox', '0 0 ' + w + ' ' + h).attr('height', h);
      g.attr('transform', 'translate(' + w / 2 + ',' + (radius + 12) + ')');
      d3.partition().size([2 * Math.PI, root.height + 1])(root);
      arc = d3.arc()
        .startAngle(function (n) { return n.x0; }).endAngle(function (n) { return n.x1; })
        .padAngle(function (n) { return Math.min((n.x1 - n.x0) / 2, 0.006); }).padRadius(radius * 1.5)
        .innerRadius(function (n) { return n.y0 * band(); })
        .outerRadius(function (n) { return Math.max(n.y0 * band(), n.y1 * band() - 1.6); });
    }

    function visibleFrame(p) { return p.y1 <= root.height + 1 && p.y0 >= 1 && p.x1 > p.x0; }
    function visible(n) { return visibleFrame(n.current); }

    function numbered(f) { return f.children ? f.children : []; }

    var path, label, centre, centreText;
    function draw() {
      layout();
      g.selectAll('*').remove();

      path = g.append('g').selectAll('path').data(root.descendants().slice(1)).join('path')
        .attr('fill', fillOf).attr('opacity', function (n) { return visible(n) ? 1 : 0; })
        .attr('pointer-events', function (n) { return visible(n) ? 'auto' : 'none'; })
        .attr('stroke', SWM.stageBg[0]).attr('stroke-width', 2).attr('d', function (n) { return arc(n.current); })
        .style('cursor', 'pointer')
        .on('click', function (ev, n) { ev.stopPropagation(); zoomTo(n); })
        .on('mouseenter', function (ev, n) {
          var st = SWM.status[SWM.coverageStatus(n.data.coverage)];
          SWM.tip.show('<b>' + SWM.esc(dispName(n.data)) + '</b><small>' + SWM.esc(n.data.kind) + ' · ' +
            SWM.num(n.data.entities) + ' entities</small><small style="margin-top:4px">Coverage ' +
            SWM.pct(n.data.coverage) + ' · ' + SWM.statusHtml(SWM.coverageStatus(n.data.coverage)) + '</small>' +
            (n.children ? '<small class="more" style="margin-top:5px">click to drill into ' + n.children.length + ' children</small>' : ''), ev);
        })
        .on('mousemove', function (ev) { SWM.tip.move(ev); })
        .on('mouseleave', function () { SWM.tip.hide(); });

      label = g.append('g').attr('pointer-events', 'none').attr('text-anchor', 'middle')
        .selectAll('text').data(root.descendants().slice(1)).join('text')
        .attr('dy', '0.34em').attr('font-size', 10).attr('font-weight', 600)
        .attr('fill', function (n) { return SWM.textOn(fillOf(n)); })
        .attr('paint-order', 'stroke').attr('stroke-linejoin', 'round').attr('stroke-width', 1.7)
        .attr('stroke', function (n) { return SWM.haloOn(fillOf(n)); })
        .attr('opacity', function (n) { return +labelVisible(n.current); })
        .attr('transform', function (n) { return labelTransform(n.current); })
        .text(function (n) { return short(labelOf(n), n); });

      centre = g.append('circle').attr('r', band()).attr('fill', SWM.ink.soft)
        .attr('stroke', SWM.ink.line).style('cursor', 'pointer')
        .on('click', function (ev) { ev.stopPropagation(); zoomTo(focus.parent || root); });
      centreText = g.append('g').attr('pointer-events', 'none').attr('text-anchor', 'middle');
      paintCentre();
    }

    function labelOf(n) {
      if (n.parent === focus && n.depth === focus.depth + 1) return String(numbered(focus).indexOf(n) + 1);
      return dispName(n.data);
    }

    function short(name, n) {
      var w = (n.current.x1 - n.current.x0) * 180 / Math.PI;
      var max = Math.max(6, Math.round(w / 3.4));
      return String(name).length > max ? String(name).slice(0, max - 1) + '…' : String(name);
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
      centreText.append('text').attr('y', -10).attr('fill', SWM.ink.ink).attr('font-size', 26).attr('font-weight', 700)
        .text(SWM.pct(focus.data.coverage));
      centreText.append('text').attr('y', 9).attr('fill', SWM.ink.ink2).attr('font-size', 10)
        .text(dispName(focus.data).length > 20 ? dispName(focus.data).slice(0, 19) + '…' : dispName(focus.data));
      var line = centreText.append('text').attr('y', 25).attr('fill', SWM.ink.ink3).attr('font-size', 9);
      line.append('tspan').attr('fill', st.color).text(st.icon + ' ');
      line.append('tspan').text(st.label + (focus.parent ? ' · back ↑' : ''));
    }

    function zoomTo(p) {
      if (!p) return;
      focus = p;
      gapsExpanded = false; forceGap = null;
      root.each(function (n) {
        n.target = {
          x0: Math.max(0, Math.min(1, (n.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
          x1: Math.max(0, Math.min(1, (n.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
          y0: Math.max(0, n.y0 - p.depth), y1: Math.max(0, n.y1 - p.depth)
        };
      });
      var t = g.transition().duration(SWM.dur(240));
      path.transition(t).tween('data', function (n) {
        var i = d3.interpolate(n.current, n.target);
        return function (tt) { n.current = i(tt); };
      })
        .attrTween('d', function (n) { return function () { return arc(n.current); }; })
        .attr('opacity', function (n) { return visibleFrame(n.target) ? 1 : 0; })
        .attr('pointer-events', function (n) { return visibleFrame(n.target) ? 'auto' : 'none'; });
      label.transition(t)
        .attr('opacity', function (n) { return +labelVisible(n.target); })
        .attrTween('transform', function (n) { return function () { return labelTransform(n.current); }; })
        .text(function (n) { return short(labelOf(n), n); });
      centre.transition().duration(SWM.dur(240)).attr('r', band());
      paintCentre();
      renderContext();
    }

    /* list */
    function renderList() {
      var kids = numbered(focus);
      var el = document.getElementById('swmCovList');
      if (!kids.length) {
        el.innerHTML = '<div class="swm-caption" style="padding:6px 2px"><b>' + SWM.esc(dispName(focus.data)) + '</b>' +
          '<br>Leaf workflow · no children in this bundle.</div>' +
          '<button class="swm-btn accent" data-cov-up="1" style="margin-top:10px">↑ Return to ' + SWM.esc(focus.parent ? focus.parent.data.name : 'Enterprise') + '</button>';
        el.querySelector('[data-cov-up]').addEventListener('click', function () { zoomTo(focus.parent || root); });
        return;
      }
      var head = '<div class="swm-caption" style="padding:2px 2px 8px"><b>' + (focus.parent ? '' : 'Domain coverage ') + '</b>' +
        (focus.parent ? 'children of ' + SWM.esc(focus.data.name) : 'Numbered arcs map to this list') + '</div>';
      el.innerHTML = head + kids.map(function (c, i) {
        var st = SWM.status[SWM.coverageStatus(c.data.coverage)];
        return '<button data-cov-child="' + i + '" style="display:flex;width:100%;gap:8px;align-items:center;' +
          'background:none;border:0;border-bottom:1px solid rgba(203,210,255,.1);padding:7px 4px;cursor:pointer;text-align:left;color:var(--swm-ink);font:inherit;font-size:12px">' +
          '<span style="font:700 11px var(--swm-mono);width:18px;color:var(--swm-ink-2)">' + (i + 1) + '</span>' +
          '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + SWM.esc(dispName(c.data)) + '</span>' +
          '<span aria-hidden="true" style="font-size:10px;color:' + st.color + '">' + st.icon + '</span>' +
          '<span style="font:700 12px var(--swm-mono);color:var(--swm-ink)">' + SWM.pct(c.data.coverage) + '</span></button>';
      }).join('');
      el.querySelectorAll('[data-cov-child]').forEach(function (b) {
        b.addEventListener('click', function () { zoomTo(kids[+b.dataset.covChild]); });
      });
    }

    /* dims */
    function paintDims(node) {
      var d = node.data.dims || {};
      var values = dims.map(function (x) { return d[x.id] != null ? d[x.id] : 0; });
      var bars = document.getElementById('swmCovBars');
      var radarWrap = document.getElementById('swmRadarWrap');
      if (dimMode === 'radar') {
        radarWrap.hidden = false; bars.hidden = true;
        paintRadar(values);
      } else {
        radarWrap.hidden = true; bars.hidden = false;
        bars.innerHTML = dims.map(function (x, i) {
          return '<div style="display:grid;grid-template-columns:150px 1fr 40px;gap:8px;align-items:center;padding:4px 0">' +
            '<span style="font-size:11px;color:var(--swm-p-ink-2)">' + SWM.esc(x.name) + '</span>' +
            '<div class="swm-meter" style="margin:0"><i style="width:' + Math.round(values[i] * 100) + '%;background:' + SWM.coverageColor(values[i], 'paper') + '"></i></div>' +
            '<b style="font-size:11px;text-align:right;font-variant-numeric:tabular-nums;color:var(--swm-p-ink)">' + SWM.pct(values[i]) + '</b></div>';
        }).join('');
      }
    }

    /* radar */
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
    function paintRadar(values) {
      radar.select('.area').transition().duration(SWM.dur(240)).attr('d', radarPath(values));
      var pts = radar.select('#swmRadarPts').selectAll('circle').data(values).join('circle').attr('class', 'pt').attr('r', 3);
      pts.transition().duration(SWM.dur(240))
        .attr('cx', function (v, i) { return CX + Math.cos(angle(i)) * R * v; })
        .attr('cy', function (v, i) { return CY + Math.sin(angle(i)) * R * v; });
      dims.forEach(function (x, i) { document.getElementById('swmDim-' + x.id).textContent = SWM.pct(values[i]); });
    }

    /* companion list */
    function renderContext() {
      var trail = focus.ancestors().reverse();
      var el = document.getElementById('swmCovCrumbs');
      el.innerHTML = trail.map(function (n, i) {
        return (i ? '<i>›</i>' : '') + '<button data-depth="' + i + '">' + SWM.esc(dispName(n.data)) + '</button>';
      }).join('');
      el.querySelectorAll('[data-depth]').forEach(function (b) {
        b.addEventListener('click', function () { zoomTo(trail[+b.dataset.depth]); });
      });

      document.getElementById('swmRadarTitle').textContent = dispName(focus.data);
      document.getElementById('swmRadarSub').textContent =
        'Six model-completeness dimensions read at the ' + (focus.data.kind === 'enterprise' ? 'enterprise' : focus.data.kind) + ' level';
      paintDims(focus);
      renderList();

      var d = focus.data;
      var facts = [
        ['Coverage', SWM.pct(d.coverage)],
        ['Status', SWM.statusHtml(SWM.coverageStatus(d.coverage))],
        ['Entities', SWM.num(d.entities)],
        [d.kind === 'workflow' ? 'Registered' : 'Open incidents',
         d.kind === 'workflow' ? 'Yes' : String(d.incidents != null ? d.incidents : sumIncidents(focus))]
      ];
      if (d.agents) facts.push(['Agents', String(d.agents)], ['Workflows', String(d.workflows)]);
      if (d.pack) facts.push(['Domain pack', SWM.esc(d.pack)], ['Owner', SWM.esc(d.owner)]);
      document.getElementById('swmCovFacts').innerHTML = facts.map(function (f) {
        return '<div class="swm-fact"><small>' + f[0] + '</small><b>' + f[1] + '</b></div>';
      }).join('');

      paintGaps();
    }

    /* gaps */
    var SEV = { critical: 0, serious: 1, warning: 2, good: 3 };
    function inScopeGaps() {
      var list = data.gaps.filter(function (gp) { return gp.scope.indexOf(focus.data.id) >= 0; });
      list.sort(function (a, b) {
        return (SEV[a.severity] - SEV[b.severity]) || (a.id < b.id ? -1 : 1);
      });
      return list;
    }
    function gapAction(gp) {
      if (gp.id === 'g-refund')
        return '<button class="swm-btn" data-swm-cov-focus="WF-021" data-swm-cov-gap="g-refund">Focus Customer Refund (SWM fixture)</button>';
      if (gp.id === 'g-memory')
        return '<button class="swm-btn" data-swm-cov-focus="WF-021" data-swm-cov-gap="g-memory">Inspect memory gap (SWM fixture)</button>';
      if (!gp.action) return '<span class="tbd">No action in this demo</span>';
      return '<button class="swm-btn" ' + attrFor(gp.action) + '>' + SWM.esc(gp.action.label) + '</button>';
    }
    function attrFor(a) {
      return ({ gap: 'data-gap="', libUnregistered: 'data-lib-unregistered="', incident: 'data-open-incident="',
                workflow: 'data-open-workflow="' }[a.kind] || 'data-gap="') + SWM.esc(a.value) + '"';
    }
    function paintGaps() {
      var inScope = inScopeGaps();
      document.getElementById('swmGapSub').textContent = inScope.length
        ? inScope.length + ' gap' + (inScope.length === 1 ? '' : 's') + ' inside ' + dispName(focus.data)
        : 'No open gap recorded inside ' + dispName(focus.data);
      var shown = (gapsExpanded || forceGap) ? inScope : inScope.slice(0, 2);
      document.getElementById('swmGaps').innerHTML = shown.map(function (gp) {
        var s = SWM.status[gp.severity] || SWM.status.warning;
        var hot = forceGap === gp.id ? ' style="border-color:#b7a3ff;box-shadow:0 0 0 2px rgba(183,163,255,.25)"' : '';
        return '<div class="swm-gap"' + hot + '><strong>' + SWM.esc(SWM.fixtureText(gp.title)) + '</strong><small>' +
          SWM.esc(SWM.fixtureText(gp.detail)) + '</small>' +
          '<div class="row"><span class="swm-sev ' + SWM.esc(gp.severity) + '">' + s.icon + ' ' + s.label + '</span>' +
          gapAction(gp) + '</div></div>';
      }).join('') || '<p class="swm-note">No recorded gaps in this demo scope.</p>';

      var more = document.getElementById('swmGapMore');
      if (inScope.length > 2) {
        more.innerHTML = '<button class="swm-btn" id="swmGapToggle">' +
          (gapsExpanded || forceGap ? 'Collapse to 2 gaps' : 'View all ' + inScope.length + ' gaps') + '</button>';
        more.querySelector('#swmGapToggle').addEventListener('click', function () {
          gapsExpanded = !gapsExpanded; forceGap = null; paintGaps();
        });
      } else {
        more.innerHTML = '';
      }
    }
    function sumIncidents(node) {
      if (!node.children) return node.data.incidents || 0;
      return node.children.reduce(function (n, c) { return n + (c.data.incidents || 0); }, 0);
    }

    /* events */
    function setProvenance() {
      document.getElementById('swmCovProvenance').textContent = mode === 'gaps'
        ? 'Arc size = leaf-entity weight · colour = unmodelled share (light violet = represented, pink = missing). Illustrative demo figures, not measured telemetry.'
        : 'Arc size = leaf-entity weight · colour = authored coverage over the 40–100 % display domain (endpoints are clamped bounds). Illustrative demo coverage, not measured telemetry.';
    }
    document.getElementById('swmCovModes').addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      mode = b.dataset.m;
      this.querySelectorAll('button').forEach(function (x) {
        var on = x === b; x.classList.toggle('active', on); x.setAttribute('aria-pressed', on);
      });
      document.getElementById('swmCovLegendTitle').textContent = mode === 'gaps'
        ? 'Unmodelled share of the environment' : 'Coverage of the relevant environment';
      document.getElementById('swmCovRamp').classList.toggle('gaps', mode === 'gaps');
      document.getElementById('swmRampLo').textContent = mode === 'gaps' ? 'none' : '40%';
      document.getElementById('swmRampHi').textContent = mode === 'gaps' ? '45%+ missing' : '100%';
      setProvenance();
      path.transition().duration(SWM.dur(220)).attr('fill', fillOf);
      label.transition().duration(SWM.dur(220))
        .attr('fill', function (n) { return SWM.textOn(fillOf(n)); })
        .attr('stroke', function (n) { return SWM.haloOn(fillOf(n)); });
    });

    document.getElementById('swmCovDimsMode').addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      dimMode = b.dataset.v;
      this.querySelectorAll('button').forEach(function (x) {
        var on = x === b; x.classList.toggle('active', on); x.setAttribute('aria-pressed', on);
      });
      paintDims(focus);
    });

    svg.on('click', function () { zoomTo(focus.parent || root); });
    SWM.onResize(function () { if (SWM.isShown(mount)) { draw(); renderContext(); } });
    /* stop + settle when hidden */
    SWM.onPanel(function (panelId) {
      if (panelId !== 'wm-overview') {
        if (g) g.interrupt().selectAll('*').interrupt();
        radar.interrupt().selectAll('*').interrupt();
        root.each(function (n) { if (n.target) n.current = n.target; });
      } else if (mount.offsetParent && g && g.selectAll('*').size()) {
        draw(); renderContext();
      }
    });

    draw();
    renderContext();
    setProvenance();

    /* cold/warm gap hand-off (index calls SWM.focusCoverage() with no arg) */
    SWM.focusCoverage = function (req) {
      req = req || global.SWM_PENDING_COVERAGE_FOCUS;
      global.SWM_PENDING_COVERAGE_FOCUS = null;
      if (!req) return;
      var leaf = root.descendants().filter(function (n) { return n.data.id === req.leaf; })[0];
      if (!leaf) {
        document.getElementById('swmCovList').innerHTML =
          '<div class="swm-caption" style="padding:10px 2px"><b>Leaf not in this bundle</b><br>' +
          SWM.esc(String(req.leaf)) + ' is not a workflow in the current coverage bundle.</div>';
        return;
      }
      var gp = req.gap ? data.gaps.filter(function (g) { return g.id === req.gap; })[0] : null;
      zoomTo(leaf);                       /* resets gap state */
      if (req.gap && !gp) {
        document.getElementById('swmGapSub').textContent =
          'Gap "' + SWM.esc(String(req.gap)) + '" is not in this bundle — showing the leaf without it.';
        return;
      }
      forceGap = req.gap || null;         /* set AFTER zoomTo, so it survives */
      gapsExpanded = !!forceGap;
      paintGaps();
    };

    /* consume a pending slot */
    SWM.focusCoverage();
  }

  SWM.register('wm-overview', init);
})(window);
