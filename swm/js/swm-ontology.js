/* ============================================================================
   Ontology Explorer — the Security Ontology panel.

   One dataset, three renderings (force graph / radial tree / relation matrix)
   and four abstraction layers. Abstraction depth is encoded twice: radially
   (L1 at the centre, L4 on the outer ring) and by the ordinal blue ramp.
   The ontology group rides on glyph shape, never on colour alone.
   ========================================================================== */
(function (global) {
  'use strict';
  var d3 = global.d3, SWM = global.SWM;

  /* predicates that draw the L1 → L2 → L3 → L4 chain; every node carries its
     own parent in the bundle, so these only control how the edge is styled */
  var HIER = { SUBCLASS_OF:1, SPECIALIZES:1, PART_OF:1, DEFINED_IN:1, INSTANCE_OF:1,
               ACHIEVES:1, DEPLOYED_IN:1, THREATENS:1, OCCURRED_IN:1 };
  /* threat overlay hangs off an agentic component, but only once the viewer
     asks for it — otherwise L4 would drown in 118 published techniques */
  var OVERLAY = { technique:1, risk:1 };
  var MAX_VISIBLE = 240;

  function init() {
    var mount = document.getElementById('swmOntology');
    if (!mount) return;
    var data = SWM.ontology();

    /* ---- index ---------------------------------------------------------- */
    var byId = new Map(), children = new Map(), parentOf = new Map(), rel = new Map();
    data.nodes.forEach(function (n) { byId.set(n.id, n); children.set(n.id, []); rel.set(n.id, []); });
    data.nodes.forEach(function (n) {
      if (n.parent && children.has(n.parent)) { parentOf.set(n.id, n.parent); children.get(n.parent).push(n.id); }
    });
    data.links.forEach(function (l) {
      if (!byId.has(l.s) || !byId.has(l.t)) return;
      rel.get(l.s).push({ pred: l.pred, other: l.t, dir: 'out', src: l.src });
      rel.get(l.t).push({ pred: l.pred, other: l.s, dir: 'in', src: l.src });
    });
    var anchors = data.nodes.filter(function (n) { return n.anchor; });
    var groupName = {}; data.groups.forEach(function (g) { groupName[g.id] = g.name; });

    var state = {
      layer: SWM.level || 1, view: 'graph', colorBy: 'layer', query: '',
      groups: new Set(data.groups.map(function (g) { return g.id; })),
      expanded: new Set(), opened: new Set(), selected: null, trail: []
    };

    /* ---- shell ---------------------------------------------------------- */
    mount.innerHTML =
      '<div class="swm-shell explorer swm">' +
        '<div class="swm-rail">' +
          '<div class="swm-rail-block"><p class="swm-rail-title">Abstraction layer</p><div class="swm-levels" id="swmLevels"></div></div>' +
          '<div class="swm-rail-block"><p class="swm-rail-title">Find a concept</p>' +
            '<input class="swm-search" id="swmQuery" type="search" placeholder="prompt injection, vendor, memory…" autocomplete="off">' +
            '<p class="swm-note" id="swmQueryNote">591 types loaded</p></div>' +
          '<div class="swm-rail-block"><p class="swm-rail-title">Colour by</p><div class="swm-seg" id="swmColorBy">' +
            '<button data-c="layer" class="active">Abstraction layer</button>' +
            '<button data-c="coverage">World-model coverage</button>' +
            '<button data-c="status">Coverage status</button></div></div>' +
          '<div class="swm-rail-block"><p class="swm-rail-title">Ontology groups</p><div class="swm-chips" id="swmGroups"></div></div>' +
        '</div>' +
        '<div class="swm-stage" id="swmStage">' +
          '<div class="swm-stage-bar">' +
            '<div class="swm-crumbs" id="swmCrumbs"></div>' +
            '<div class="swm-views" id="swmViews">' +
              '<button data-v="graph" class="active">◍ Graph</button>' +
              '<button data-v="tree">⋔ Hierarchy</button>' +
              '<button data-v="matrix">▦ Relations</button></div>' +
          '</div>' +
          '<svg id="swmSvg"></svg>' +
          '<div class="swm-legend" id="swmLegend"></div>' +
          '<div class="swm-hint" id="swmHint">Click a node to drill in · scroll to zoom</div>' +
        '</div>' +
        '<div class="swm-inspector" id="swmInspector"></div>' +
      '</div>';

    var svg = d3.select('#swmSvg'), stage = document.getElementById('swmStage');
    var gRoot = svg.append('g'), gLinks = gRoot.append('g'), gNodes = gRoot.append('g'), gRings = gRoot.insert('g', ':first-child');
    var sim = null, zoom = null;

    /* ---- rail ----------------------------------------------------------- */
    document.getElementById('swmLevels').innerHTML = data.layers.map(function (l) {
      return '<button class="swm-level' + (l.id === 1 ? ' active' : '') + '" data-level="' + l.id + '">' +
             '<span class="lv">L' + l.id + '</span><span><b>' + SWM.esc(l.name) + '</b><span>' + SWM.esc(l.blurb) + '</span></span></button>';
    }).join('');
    document.getElementById('swmGroups').innerHTML = data.groups.map(function (g) {
      return '<button class="swm-chip" data-g="' + g.id + '" title="' + SWM.esc(g.blurb) + '">' +
             '<svg width="12" height="12" viewBox="-7 -7 14 14"><path d="' + SWM.symbol(g.id, 52) + '" fill="#68707c"/></svg>' +
             SWM.esc(g.name) + '</button>';
    }).join('');
    document.getElementById('swmQueryNote').textContent = data.nodes.length + ' types · ' + data.links.length + ' typed relations';

    /* ---- visibility ----------------------------------------------------- */
    function defaultExpansion() {
      state.expanded = new Set(anchors.map(function (a) { return a.id; }));
      state.opened = new Set();
      if (state.layer >= 2) data.nodes.forEach(function (n) { if (n.layer < state.layer && n.layer > 1) state.expanded.add(n.id); });
      if (state.layer >= 4) data.nodes.forEach(function (n) { if (n.kind === 'component' || n.kind === 'domain') state.expanded.add(n.id); });
    }

    function visibleNodes() {
      var out = [], seen = new Set();
      function walk(n) {
        if (seen.has(n.id)) return;
        seen.add(n.id); out.push(n);
        if (!state.expanded.has(n.id)) return;
        children.get(n.id).forEach(function (cid) {
          var c = byId.get(cid);
          if (!c || c.layer > state.layer || !state.groups.has(c.group)) return;
          if (OVERLAY[c.kind] && !state.opened.has(n.id)) return;
          walk(c);
        });
      }
      anchors.forEach(function (a) { if (state.groups.has(a.group)) walk(a); });
      if (out.length > MAX_VISIBLE) {
        out.sort(function (a, b) { return (a.layer - b.layer) || (b.instances || 0) - (a.instances || 0); });
        out = out.slice(0, MAX_VISIBLE);
      }
      return out;
    }

    function colorOf(n) {
      if (n.anchor) return '#c9d8f5';
      if (state.colorBy === 'coverage') return SWM.coverageColor(n.coverage);
      if (state.colorBy === 'status') return SWM.status[SWM.coverageStatus(n.coverage)].color;
      return SWM.layerColor(n.layer);
    }
    function radiusOf(n) { return n.anchor ? 190 : 34 + Math.min(4, Math.sqrt(n.instances || 1) / 6) * 14; }
    function sizeOf(n) { return n.anchor ? 300 : 70 + Math.min(180, Math.sqrt(n.instances || 1) * 7); }

    /* ---- render --------------------------------------------------------- */
    function dims() { var w = stage.clientWidth || 860; return { w: w, h: Math.max(560, Math.min(760, w)) }; }

    function render() {
      var d = dims();
      svg.attr('viewBox', '0 0 ' + d.w + ' ' + d.h).attr('height', d.h);
      if (sim) { sim.stop(); sim = null; }
      gLinks.selectAll('*').remove(); gNodes.selectAll('*').remove(); gRings.selectAll('*').remove();
      renderLegend();
      renderCrumbs();
      if (state.view === 'matrix') return renderMatrix(d);
      if (state.view === 'tree') return renderTree(d);
      renderGraph(d);
    }

    function zoomable(d) {
      zoom = d3.zoom().scaleExtent([.35, 4]).on('zoom', function (ev) { gRoot.attr('transform', ev.transform); });
      svg.call(zoom).on('dblclick.zoom', null);
      gRoot.attr('transform', null);
      return d;
    }

    /* --- view 1: force graph, abstraction encoded as concentric rings ----- */
    function renderGraph(d) {
      zoomable(d);
      var nodes = visibleNodes().map(function (n) { return Object.assign({}, n); });
      var ids = new Set(nodes.map(function (n) { return n.id; }));
      var links = data.links.filter(function (l) { return ids.has(l.s) && ids.has(l.t); })
                            .map(function (l) { return { source: l.s, target: l.t, pred: l.pred, src: l.src }; });
      var cx = d.w / 2, cy = d.h / 2 - 14, R = Math.min(d.w, d.h) / 2 - 64;

      /* depth from the group anchor — this, not the raw layer, is what the
         rings encode, so every level fills the canvas instead of the inner quarter */
      var depth = new Map(), maxDepth = 1;
      nodes.forEach(function (n) {
        var d0 = 0, cur = n.id, guard = 0;
        while (parentOf.has(cur) && ids.has(parentOf.get(cur)) && guard++ < 12) { d0++; cur = parentOf.get(cur); }
        depth.set(n.id, d0);
        if (d0 > maxDepth) maxDepth = d0;
      });
      var ringOf = function (n) { return n.anchor ? R * .17 : R * (.17 + .83 * (depth.get(n.id) / maxDepth)); };

      /* the eight groups sit in fixed angular slots, so the rosette is stable
         between renders and each subtree fans out from its own anchor */
      var slot = {};
      data.groups.forEach(function (g, i) { slot[g.id] = (i / data.groups.length) * 2 * Math.PI - Math.PI / 2; });

      gRings.selectAll('circle').data(d3.range(1, maxDepth + 1)).join('circle')
        .attr('cx', cx).attr('cy', cy)
        .attr('r', function (k) { return R * (.17 + .83 * (k / maxDepth)); })
        .attr('fill', 'none').attr('class', 'grid-line');

      var link = gLinks.selectAll('line').data(links).join('line')
        .attr('class', function (l) { return 'swm-link rel-' + l.pred.toLowerCase().split('_')[0]; })
        .attr('stroke-width', function (l) { return l.pred === 'SUBCLASS_OF' ? 1 : 1.4; })
        .attr('stroke-opacity', function (l) { return HIER[l.pred] ? .4 : .75; });

      var node = gNodes.selectAll('g').data(nodes, function (n) { return n.id; }).join('g')
        .attr('class', 'swm-node').on('click', function (ev, n) { ev.stopPropagation(); select(n.id, true); })
        .on('mouseenter', function (ev, n) { SWM.tip.show(tipHtml(n), ev); })
        .on('mousemove', function (ev) { SWM.tip.move(ev); })
        .on('mouseleave', function () { SWM.tip.hide(); })
        .call(d3.drag()
          .on('start', function (ev, n) { if (!ev.active) sim.alphaTarget(.25).restart(); n.fx = n.x; n.fy = n.y; })
          .on('drag', function (ev, n) { n.fx = ev.x; n.fy = ev.y; })
          .on('end', function (ev, n) { if (!ev.active) sim.alphaTarget(0); if (!n.anchor) { n.fx = null; n.fy = null; } }));

      node.append('path').attr('class', 'glyph')
        .attr('d', function (n) { return SWM.symbol(n.group, sizeOf(n)); })
        .attr('fill', colorOf);
      /* a label budget keeps the canvas readable: anchors and structural nodes
         always, then the largest populations until the budget runs out */
      var budget = nodes.length < 60 ? nodes.length : 34;
      var STRUCT = { domain:1, capability:1, component:1, group:1 };
      var labelled = new Set(nodes.filter(function (n) { return n.anchor || STRUCT[n.kind]; }).map(function (n) { return n.id; }));
      nodes.slice().sort(function (a, b) { return (b.instances || 0) - (a.instances || 0); })
        .forEach(function (n) { if (labelled.size < budget) labelled.add(n.id); });
      node.filter(function (n) { return labelled.has(n.id); })
        .append('text').attr('x', 11).attr('y', 4)
        .text(function (n) { return n.label.length > 24 ? n.label.slice(0, 23) + '…' : n.label; });

      /* seed each node near its anchor's slot so the simulation settles fast */
      nodes.forEach(function (n) {
        var a = slot[n.group] != null ? slot[n.group] : 0;
        var jitter = (hashAngle(n.id) - .5) * (n.anchor ? 0 : .5);
        n.x = cx + Math.cos(a + jitter) * ringOf(n);
        n.y = cy + Math.sin(a + jitter) * ringOf(n);
        if (n.anchor) { n.fx = n.x; n.fy = n.y; }
      });

      sim = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(function (n) { return n.id; })
          .distance(function (l) { return HIER[l.pred] ? 46 : 110; })
          .strength(function (l) { return HIER[l.pred] ? .7 : .05; }))
        .force('charge', d3.forceManyBody().strength(function (n) { return n.anchor ? -420 : -110; }))
        .force('collide', d3.forceCollide().radius(function (n) { return n.anchor ? 34 : 17; }).iterations(2))
        .force('radial', d3.forceRadial(ringOf, cx, cy).strength(function (n) { return n.anchor ? 1 : .55; }))
        .on('tick', function () {
          nodes.forEach(function (n) {
            if (n.anchor) return;
            n.x = Math.max(26, Math.min(d.w - 26, n.x));
            n.y = Math.max(34, Math.min(d.h - 74, n.y));
          });
          link.attr('x1', function (l) { return l.source.x; }).attr('y1', function (l) { return l.source.y; })
              .attr('x2', function (l) { return l.target.x; }).attr('y2', function (l) { return l.target.y; });
          node.attr('transform', function (n) { return 'translate(' + n.x + ',' + n.y + ')'; });
        });
      for (var i = 0; i < 140; i++) sim.tick();
      dropCollidingLabels(node);
      applyFilterStyles();
    }

    /* greedy label de-collision: important nodes keep their label, later
       ones lose it rather than overprint */
    function dropCollidingLabels(sel) {
      var boxes = [];
      sel.nodes()
        .map(function (el) { return { el: el, n: d3.select(el).datum() }; })
        .sort(function (a, b) {
          return (b.n.anchor ? 1 : 0) - (a.n.anchor ? 1 : 0) ||
                 (b.n.instances || 0) - (a.n.instances || 0);
        })
        .forEach(function (item) {
          var t = item.el.querySelector('text');
          if (!t) return;
          var box = { x: item.n.x + 9, y: item.n.y - 9, w: t.textContent.length * 5.5 + 8, h: 14 };
          var clash = boxes.some(function (b) {
            return box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y;
          });
          if (clash && !item.n.anchor) t.remove(); else boxes.push(box);
        });
    }

    /* stable pseudo-random angle offset per node id */
    function hashAngle(id) {
      var h = 0x811c9dc5;
      for (var i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 0x01000193); }
      return (h >>> 0) / 0xffffffff;
    }

    /* --- view 2: radial hierarchy ---------------------------------------- */
    function renderTree(d) {
      zoomable(d);
      var visible = new Set(visibleNodes().map(function (n) { return n.id; }));
      var root = d3.hierarchy({ id: '__root', label: 'Security Ontology', anchor: true, layer: 0 }, function (n) {
        if (n.id === '__root') return anchors.filter(function (a) { return visible.has(a.id); });
        return (children.get(n.id) || []).filter(function (c) { return visible.has(c); }).map(function (c) { return byId.get(c); });
      });
      var R = Math.min(d.w, d.h) / 2 - 120;
      d3.cluster().size([2 * Math.PI, R])(root);
      var line = d3.linkRadial().angle(function (n) { return n.x; }).radius(function (n) { return n.y; });
      var g = gNodes.attr('transform', 'translate(' + d.w / 2 + ',' + (d.h / 2 - 12) + ')');
      gLinks.attr('transform', 'translate(' + d.w / 2 + ',' + (d.h / 2 - 12) + ')');

      gLinks.selectAll('path').data(root.links()).join('path')
        .attr('class', 'swm-link').attr('d', line).attr('stroke-width', 1).attr('stroke-opacity', .5);

      var node = g.selectAll('g').data(root.descendants().filter(function (n) { return n.depth > 0; })).join('g')
        .attr('class', 'swm-node')
        .attr('transform', function (n) { return 'rotate(' + (n.x * 180 / Math.PI - 90) + ') translate(' + n.y + ',0)'; })
        .on('click', function (ev, n) { ev.stopPropagation(); select(n.data.id, true); })
        .on('mouseenter', function (ev, n) { SWM.tip.show(tipHtml(n.data), ev); })
        .on('mousemove', function (ev) { SWM.tip.move(ev); })
        .on('mouseleave', function () { SWM.tip.hide(); });
      node.append('path').attr('class', 'glyph')
        .attr('d', function (n) { return SWM.symbol(n.data.group, n.data.anchor ? 200 : 90); })
        .attr('fill', function (n) { return colorOf(n.data); });
      node.append('text')
        .attr('dy', '.32em')
        .attr('x', function (n) { return n.x < Math.PI ? 9 : -9; })
        .attr('text-anchor', function (n) { return n.x < Math.PI ? 'start' : 'end'; })
        .attr('transform', function (n) { return n.x < Math.PI ? null : 'rotate(180)'; })
        .text(function (n) { return n.data.label.length > 18 ? n.data.label.slice(0, 17) + '…' : n.data.label; });
      applyFilterStyles();
    }

    /* --- view 3: group x group relation matrix --------------------------- */
    function renderMatrix(d) {
      gNodes.attr('transform', null); gLinks.attr('transform', null);
      if (zoom) svg.on('.zoom', null);
      var groups = data.groups.filter(function (g) { return state.groups.has(g.id); });
      var idx = {}; groups.forEach(function (g, i) { idx[g.id] = i; });
      var counts = groups.map(function () { return groups.map(function () { return { n: 0, preds: {} }; }); });
      data.links.forEach(function (l) {
        var a = byId.get(l.s), b = byId.get(l.t);
        if (!a || !b || !(a.group in idx) || !(b.group in idx)) return;
        if (a.layer > state.layer || b.layer > state.layer) return;
        var cell = counts[idx[a.group]][idx[b.group]];
        cell.n++; cell.preds[l.pred] = (cell.preds[l.pred] || 0) + 1;
      });
      var max = d3.max(counts.flat(), function (c) { return c.n; }) || 1;
      var scale = d3.scaleQuantize().domain([0, max]).range(SWM.ramps.coverage);
      var pad = { l: 146, t: 92 }, size = Math.min((d.w - pad.l - 40) / groups.length, (d.h - pad.t - 40) / groups.length);
      var g = gNodes.attr('class', 'swm-matrix');

      groups.forEach(function (rowG, r) {
        groups.forEach(function (colG, c) {
          var cell = counts[r][c];
          g.append('rect').attr('class', 'cell')
            .attr('x', pad.l + c * size).attr('y', pad.t + r * size)
            .attr('width', size).attr('height', size).attr('rx', 3)
            .attr('fill', cell.n ? scale(cell.n) : 'rgba(146,170,224,.07)')
            .style('cursor', cell.n ? 'pointer' : 'default')
            .on('mouseenter', function (ev) {
              if (!cell.n) return;
              var preds = Object.keys(cell.preds).sort(function (a, b) { return cell.preds[b] - cell.preds[a]; })
                .slice(0, 4).map(function (p) { return p + ' ×' + cell.preds[p]; }).join('<br>');
              SWM.tip.show('<b>' + SWM.esc(rowG.name) + ' → ' + SWM.esc(colG.name) + '</b><small>' + cell.n +
                ' typed relations</small><small style="margin-top:5px">' + preds + '</small>', ev);
            })
            .on('mousemove', function (ev) { SWM.tip.move(ev); })
            .on('mouseleave', function () { SWM.tip.hide(); });
          if (cell.n) g.append('text').attr('class', 'lbl' + (cell.n > max * .5 ? ' hot' : ''))
            .attr('x', pad.l + c * size + size / 2).attr('y', pad.t + r * size + size / 2 + 3)
            .attr('text-anchor', 'middle').text(cell.n);
        });
        g.append('text').attr('class', 'lbl').attr('x', pad.l - 10).attr('y', pad.t + r * size + size / 2 + 3)
          .attr('text-anchor', 'end').text(rowG.name);
        g.append('text').attr('class', 'lbl')
          .attr('transform', 'translate(' + (pad.l + r * size + size / 2) + ',' + (pad.t - 10) + ') rotate(-42)')
          .attr('text-anchor', 'start').text(rowG.name);
      });
      g.append('text').attr('class', 'lbl').attr('x', pad.l).attr('y', pad.t - 52)
        .text('Rows act on columns · cell = typed relations visible at L1–L' + state.layer);
    }

    /* ---- filters, search, selection ------------------------------------- */
    function applyFilterStyles() {
      var q = state.query.trim().toLowerCase();
      gNodes.selectAll('g.swm-node').each(function (n) {
        var node = n.data || n;
        var hit = !q || (node.label + ' ' + (node.def || '') + ' ' + (node.src || []).map(function (s) { return s.id; }).join(' ')).toLowerCase().indexOf(q) >= 0;
        this.classList.toggle('dim', !!q && !hit);
        this.classList.toggle('match', !!q && hit);
        this.classList.toggle('selected', node.id === state.selected);
      });
      gLinks.selectAll('.swm-link').classed('dim', !!q);
    }

    function tipHtml(n) {
      return '<b>' + SWM.esc(n.label) + '</b>' +
        '<small>' + SWM.esc(groupName[n.group] || n.group) + ' · L' + n.layer + ' ' + SWM.esc(n.kind || '') + '</small>' +
        (n.def ? '<small style="margin-top:5px">' + SWM.esc(n.def.slice(0, 150)) + (n.def.length > 150 ? '…' : '') + '</small>' : '') +
        ((n.src || []).length ? '<span class="src">' + SWM.esc(SWM.srcLabel(n.src[0].sys)) + (n.src[0].id ? ' · ' + SWM.esc(n.src[0].id) : '') + '</span>' : '') +
        (children.get(n.id) && children.get(n.id).length ? '<small style="margin-top:6px;color:#9cc6f7">click to expand ' + children.get(n.id).length + ' children</small>' : '');
    }

    function select(id, drill) {
      var n = byId.get(id);
      if (!n) return;
      state.selected = id;
      if (drill) {
        if (state.expanded.has(id) && (children.get(id) || []).length) { state.expanded.delete(id); state.opened.delete(id); }
        else { state.expanded.add(id); state.opened.add(id); }
        var path = [], cur = id;
        while (cur) { path.unshift(cur); cur = parentOf.get(cur); }
        state.trail = path;
        path.forEach(function (p) { state.expanded.add(p); });
        if ((children.get(id) || []).some(function (c) { return byId.get(c).layer > state.layer; }))
          setLayer(Math.max.apply(null, children.get(id).map(function (c) { return byId.get(c).layer; })), true);
        render();
      } else applyFilterStyles();
      renderInspector(n);
    }

    function renderInspector(n) {
      var box = document.getElementById('swmInspector');
      if (!n) {
        box.innerHTML = '<p class="swm-insp-kicker">Inspector</p><p class="empty">Pick any node to see its definition, where it comes from in the public ontologies, how much of it the world model covers, and what it is related to.</p>';
        return;
      }
      var kids = children.get(n.id) || [];
      var rels = (rel.get(n.id) || []).filter(function (r) { return byId.has(r.other); });
      var st = SWM.status[SWM.coverageStatus(n.coverage)];
      box.innerHTML =
        '<p class="swm-insp-kicker"><span style="width:9px;height:9px;border-radius:3px;background:' + colorOf(n) + ';display:inline-block"></span>' +
          SWM.esc(groupName[n.group] || n.group) + ' · L' + n.layer + '</p>' +
        '<h3>' + SWM.esc(n.label) + '</h3>' +
        '<p class="def">' + SWM.esc(n.def || 'No published definition.') + '</p>' +
        '<div class="swm-srcs">' + (n.src || []).map(function (s) {
            return s.url ? '<a class="swm-src ' + SWM.esc(s.sys) + '" href="' + SWM.esc(s.url) + '" target="_blank" rel="noopener">' +
                   SWM.esc(SWM.srcLabel(s.sys)) + (s.id ? ' · ' + SWM.esc(s.id) : '') + ' ↗</a>' : SWM.srcChip(s);
          }).join('') + '</div>' +
        '<div class="swm-facts">' +
          '<div class="swm-fact"><small>Coverage</small><b>' + SWM.pct(n.coverage) + '</b>' +
            '<div class="swm-meter"><i style="width:' + Math.round((n.coverage || 0) * 100) + '%;background:' + SWM.coverageColor(n.coverage) + '"></i></div></div>' +
          '<div class="swm-fact"><small>Status</small><b style="color:' + st.color + '">' + st.icon + ' ' + st.label + '</b></div>' +
          '<div class="swm-fact"><small>Runtime instances</small><b>' + SWM.num(n.instances) + '</b></div>' +
          '<div class="swm-fact"><small>Children</small><b>' + kids.length + '</b></div>' +
        '</div>' +
        (rels.length ? '<div class="swm-rel"><h6>Typed relations · ' + rels.length + '</h6>' +
          rels.slice(0, 14).map(function (r) {
            var o = byId.get(r.other);
            return '<button data-go="' + SWM.esc(r.other) + '"><span><span class="pred">' +
              (r.dir === 'out' ? '→ ' : '← ') + SWM.esc(r.pred) + '</span>' + SWM.esc(o.label) + '</span>' +
              '<svg width="11" height="11" viewBox="-7 -7 14 14"><path d="' + SWM.symbol(o.group, 46) + '" fill="' + colorOf(o) + '"/></svg></button>';
          }).join('') + (rels.length > 14 ? '<p class="swm-note">+' + (rels.length - 14) + ' more</p>' : '') + '</div>' : '');
      box.querySelectorAll('[data-go]').forEach(function (b) {
        b.addEventListener('click', function () { select(b.dataset.go, true); });
      });
    }

    function renderCrumbs() {
      var el = document.getElementById('swmCrumbs');
      var trail = state.trail.filter(function (id) { return byId.has(id); });
      var html = '<button data-crumb="__root">Security Ontology</button>';
      trail.forEach(function (id) {
        html += '<i>›</i><button data-crumb="' + SWM.esc(id) + '">' + SWM.esc(byId.get(id).label) + '</button>';
      });
      el.innerHTML = html;
      el.querySelectorAll('[data-crumb]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (b.dataset.crumb === '__root') { state.trail = []; state.selected = null; defaultExpansion(); renderInspector(null); }
          else { state.trail = state.trail.slice(0, state.trail.indexOf(b.dataset.crumb) + 1); select(b.dataset.crumb, false); }
          render();
        });
      });
    }

    function renderLegend() {
      var el = document.getElementById('swmLegend');
      if (state.view === 'matrix') {
        el.innerHTML = '<h6>Relation density</h6><div class="swm-ramp"><span>few</span><span class="bar"></span><span>many</span></div>';
        return;
      }
      var scaleHtml = state.colorBy === 'layer'
        ? '<div class="swm-legend-items">' + data.layers.map(function (l) {
            return '<span class="swm-legend-item"><span style="width:11px;height:11px;border-radius:3px;background:' +
                   SWM.layerColor(l.id) + ';display:inline-block"></span>L' + l.id + ' ' + SWM.esc(l.name.split(' ')[0]) + '</span>'; }).join('') + '</div>'
        : state.colorBy === 'coverage'
        ? '<div class="swm-ramp"><span>0%</span><span class="bar"></span><span>100%</span></div>'
        : '<div class="swm-legend-items">' + Object.keys(SWM.status).map(function (k) {
            var s = SWM.status[k];
            return '<span class="swm-legend-item"><span style="color:' + s.color + '">' + s.icon + '</span>' + s.label + '</span>'; }).join('') + '</div>';
      el.innerHTML = '<h6>Colour = ' + (state.colorBy === 'layer' ? 'abstraction layer' : state.colorBy === 'coverage' ? 'world-model coverage' : 'coverage status') +
        ' · shape = ontology group (see the rail)</h6>' + scaleHtml;
    }

    /* ---- events --------------------------------------------------------- */
    function applyLayer(l, quiet) {
      state.layer = l;
      document.querySelectorAll('#swmLevels .swm-level').forEach(function (b) {
        b.classList.toggle('active', +b.dataset.level === l);
      });
      if (!quiet) { defaultExpansion(); state.trail = []; render(); }
    }
    function setLayer(l, quiet) {
      if (quiet) { applyLayer(l, true); SWM.level = l; return; }
      if (l === SWM.level) { applyLayer(l); return; }
      SWM.setLevel(l, 'explorer');   /* the bus calls applyLayer back */
    }
    SWM.onLevel(function (l) { applyLayer(l); });
    document.getElementById('swmLevels').addEventListener('click', function (ev) {
      var b = ev.target.closest('.swm-level'); if (b) setLayer(+b.dataset.level);
    });
    document.getElementById('swmViews').addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      state.view = b.dataset.v;
      this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('active', x === b); });
      document.getElementById('swmHint').textContent = state.view === 'matrix'
        ? 'Hover a cell for the typed relations behind it'
        : state.view === 'tree' ? 'Inheritance as drawn by the source ontologies' : 'Click a node to drill in · scroll to zoom';
      render();
    });
    document.getElementById('swmColorBy').addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      state.colorBy = b.dataset.c;
      this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('active', x === b); });
      gNodes.selectAll('g.swm-node path.glyph').attr('fill', function (n) { return colorOf(n.data || n); });
      renderLegend();
      if (state.selected) renderInspector(byId.get(state.selected));
    });
    document.getElementById('swmGroups').addEventListener('click', function (ev) {
      var b = ev.target.closest('.swm-chip'); if (!b) return;
      var g = b.dataset.g;
      if (state.groups.has(g) && state.groups.size > 1) state.groups.delete(g); else state.groups.add(g);
      b.classList.toggle('off', !state.groups.has(g));
      render();
    });
    var qt;
    document.getElementById('swmQuery').addEventListener('input', function () {
      var v = this.value;
      clearTimeout(qt);
      qt = setTimeout(function () {
        state.query = v;
        var q = v.trim().toLowerCase();
        if (q.length > 2) {
          /* pull matches into view even when they sit inside collapsed branches */
          var hits = data.nodes.filter(function (n) {
            return n.layer <= state.layer && (n.label + ' ' + (n.def || '')).toLowerCase().indexOf(q) >= 0;
          }).slice(0, 40);
          hits.forEach(function (n) { var c = parentOf.get(n.id); while (c) { state.expanded.add(c); c = parentOf.get(c); } });
          document.getElementById('swmQueryNote').textContent = hits.length
            ? hits.length + ' match' + (hits.length === 1 ? '' : 'es') + ' at L1–L' + state.layer
            : 'No match at L1–L' + state.layer + ' — try another layer';
          render();
          if (hits.length === 1) select(hits[0].id, false);
        } else {
          document.getElementById('swmQueryNote').textContent = data.nodes.length + ' types · ' + data.links.length + ' typed relations';
          applyFilterStyles();
        }
      }, 220);
    });
    svg.on('click', function () { state.selected = null; applyFilterStyles(); renderInspector(null); });
    SWM.onResize(function () { if (mount.offsetParent) render(); });

    /* ---- go ------------------------------------------------------------- */
    defaultExpansion();
    applyLayer(state.layer, true);
    renderInspector(null);
    render();
    mount._swmRender = render;
  }

  SWM.register('wm-ontology', init);
})(window);
