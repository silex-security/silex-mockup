/* Plan P3: bounded, seeded ontology views; the Refund neighbourhood uses stored illustrative relations, never a trace. */
(function (global) {
  'use strict';
  var d3 = global.d3, SWM = global.SWM;

  /* predicates that draw a type hierarchy — styled lighter, used for layout */
  var HIER = { SUBCLASS_OF:1, SPECIALIZES:1, PART_OF:1, DEFINED_IN:1, INSTANCE_OF:1,
               ACHIEVES:1, DEPLOYED_IN:1, THREATENS:1, OCCURRED_IN:1 };
  var MAX_VISIBLE = 240;

  /* the documented example neighbourhood (plan P3, exact IDs) */
  var EX_NODES = ['rt-user-csr', 'rt-svc-identity', 'rt-refund-agent', 'rt-tool-refund', 'rt-ledger',
                  'rt-kb-index', 'rt-refund-mem', 'rt-policy-500', 'rt-hitl-t2'];
  var EX_CHAIN = ['rt-user-csr', 'rt-svc-identity', 'rt-refund-agent', 'rt-tool-refund', 'rt-ledger'];
  var EX_LOWER = ['rt-kb-index', 'rt-refund-mem', 'rt-policy-500', 'rt-hitl-t2'];
  var EX_EDGES = 8;
  var EX_MISSING = ['Example unavailable in this bundle', 'A documented runtime node or stored relation is missing, so nothing is shown instead of a substitute.'];

  function init() {
    var mount = document.getElementById('swmOntology');
    if (!mount) return;
    var data = SWM.ontology();

    var byId = new Map(), children = new Map(), parentOf = new Map(), rel = new Map();
    data.nodes.forEach(function (n) { byId.set(n.id, n); children.set(n.id, []); rel.set(n.id, []); });
    data.nodes.forEach(function (n) {
      if (n.parent && children.has(n.parent)) { parentOf.set(n.id, n.parent); children.get(n.parent).push(n.id); }
    });
    children.forEach((list) => list.sort());
    var links = data.links.filter((l) => byId.has(l.s) && byId.has(l.t));
    links.forEach(function (l) {
      rel.get(l.s).push({ link: l, pred: l.pred, other: l.t, dir: 'out' });
      rel.get(l.t).push({ link: l, pred: l.pred, other: l.s, dir: 'in' });
    });
    var groupOrder = data.groups.map((g) => g.id);
    var groupName = {}; data.groups.forEach((g) => (groupName[g.id] = g.name));
    var anchors = data.nodes.filter((n) => n.anchor)
      .sort((a, b) => groupOrder.indexOf(a.group) - groupOrder.indexOf(b.group) || (a.id < b.id ? -1 : 1));
    var anchorOf = {}; anchors.forEach((a) => (anchorOf[a.group] = a));
    var tierCount = [0, 0, 0, 0, 0]; data.nodes.forEach((n) => tierCount[n.layer]++);
    var layerName = {}; data.layers.forEach((l) => (layerName[l.id] = l.name));
    var isSilex = (n) => (n.src || []).every((s) => s.sys === 'silex');
    var silexCount = data.nodes.filter(isSilex).length, publicCount = data.nodes.length - silexCount;
    var srcCounts = {}; data.nodes.forEach(function (n) {
      var seen = {}; (n.src || []).forEach(function (s) { if (s.sys !== 'silex' && !seen[s.sys]) { seen[s.sys] = 1; srcCounts[s.sys] = (srcCounts[s.sys] || 0) + 1; } });
    });

    var state = {
      layer: SWM.level || 1, view: 'graph', colorBy: 'layer', query: '',
      groups: new Set(groupOrder), pinned: new Set(),
      selected: null, edge: null, example: false, saved: null, animate: false, stale: false
    };
    var entering = false;      /* guards our own SWM.setLevel calls */
    var finalTimer = null;     /* snaps the example to its end state */
    var lastDims = null;

    mount.innerHTML =
      '<div class="swm">' +
        '<div class="swm-toolbar">' +
          '<div class="swm-toolbar-title grow"><b id="swmOntTitle">' + data.nodes.length + ' nodes / ' + data.links.length + ' typed relations</b>' +
            '<span id="swmOntScope"></span></div>' +
          '<div class="swm-searchbox"><label class="swm-sr" for="swmQuery">Find a concept in all ' + data.nodes.length + ' nodes</label>' +
            '<input class="swm-search" id="swmQuery" type="search" placeholder="Find a concept… (all ' + data.nodes.length + ' nodes)" autocomplete="off" ' +
            'role="combobox" aria-expanded="false" aria-controls="swmResults" aria-autocomplete="list">' +
            '<div class="swm-results" id="swmResults" role="listbox" hidden></div></div>' +
          '<details class="swm-filters" id="swmFilters"><summary>Filters &amp; colour</summary><div class="body">' +
            '<div><p class="swm-rail-title">Ontology groups (shape)</p><div class="swm-chips" id="swmGroups"></div></div>' +
            '<div><p class="swm-rail-title">Colour by</p><div class="swm-seg" id="swmColorBy">' +
              '<button data-c="layer" aria-pressed="true">Abstraction tier</button>' +
              '<button data-c="coverage" aria-pressed="false">Authored coverage</button>' +
              '<button data-c="status" aria-pressed="false">Coverage status</button></div></div>' +
          '</div></details>' +
          '<button class="swm-btn" id="swmBackBtn" type="button" hidden>← Back to previous view</button>' +
          '<button class="swm-btn accent" id="swmExampleBtn" type="button">Example: Refund workflow →</button>' +
        '</div>' +
        '<div class="swm-shell explorer">' +
          '<div>' +
            '<div class="swm-stage" id="swmStage">' +
              '<div class="swm-stage-kicker" id="swmKicker"></div>' +
              '<div class="swm-stage-bar" style="top:34px">' +
                '<div class="swm-views" id="swmLevels" role="group" aria-label="Ontology tier"></div>' +
                '<div style="display:flex;gap:6px;align-items:flex-start">' +
                  '<div class="swm-views" id="swmZoom" role="group" aria-label="Zoom">' +
                    '<button data-z="in" aria-label="Zoom in">+</button><button data-z="out" aria-label="Zoom out">−</button><button data-z="fit" aria-label="Reset zoom">Fit</button></div>' +
                  '<div class="swm-views" id="swmViews" role="group" aria-label="Rendering">' +
                    '<button data-v="graph" aria-pressed="true">Graph</button>' +
                    '<button data-v="tree" aria-pressed="false">Hierarchy</button>' +
                    '<button data-v="matrix" aria-pressed="false">Relations</button></div>' +
                '</div>' +
              '</div>' +
              '<div class="swm-canvas" id="swmCanvas"><svg id="swmSvg" role="group" aria-label="Security ontology graph"></svg></div>' +
              '<div class="swm-legend" id="swmLegend" style="bottom:54px"></div>' +
              '<div class="swm-stage-foot" id="swmFoot"></div>' +
              '<div class="swm-empty" id="swmEmpty" hidden></div>' +
            '</div>' +
            '<details class="swm-more" id="swmOntList"><summary id="swmOntListSum">Accessible list</summary>' +
              '<div class="swm-more-body"><div class="swm-list" id="swmOntListBody"></div></div></details>' +
          '</div>' +
          '<aside class="swm-inspector" id="swmInspector" aria-live="polite"></aside>' +
        '</div>' +
      '</div>';

    var $ = (id) => document.getElementById(id);
    var svg = d3.select('#swmSvg'), stage = $('swmStage');
    var defs = svg.append('defs');
    [['swmArrow', '#b7a3ff'], ['swmArrowIn', '#8fd3ff'], ['swmArrowDim', 'rgba(183,163,255,.55)'], ['swmArrowHi', '#e2d8ff']].forEach(function (m) {
      defs.append('marker').attr('id', m[0]).attr('viewBox', '0 -5 10 10').attr('refX', 9).attr('refY', 0)
        .attr('markerWidth', 7).attr('markerHeight', 7).attr('orient', 'auto')
        .append('path').attr('d', 'M0,-4.5L10,0L0,4.5Z').attr('fill', m[1]);
    });
    var gRoot = svg.append('g'), gRings = gRoot.append('g'), gLinks = gRoot.append('g'), gLabels = gRoot.append('g'), gNodes = gRoot.append('g');
    var zoom = d3.zoom().scaleExtent([.4, 4]).on('zoom', function (ev) { gRoot.attr('transform', ev.transform); });

    $('swmLevels').innerHTML = data.layers.map(function (l) {
      return '<button data-level="' + l.id + '" aria-pressed="false" title="' + SWM.esc(l.name) + ' · ' + tierCount[l.id] + ' nodes">L' + l.id + ' ' +
             SWM.esc(l.name.split(' ')[0]) + '</button>';
    }).join('');
    $('swmGroups').innerHTML = data.groups.map(function (g) {
      return '<button class="swm-chip" data-g="' + g.id + '" aria-pressed="true" title="' + SWM.esc(g.blurb || '') + '">' +
             '<svg width="12" height="12" viewBox="-7 -7 14 14" aria-hidden="true"><path d="' + SWM.symbol(g.id, 52) + '" ' + SWM.glyphAttrs(g.id, '#4f5864') + '/></svg>' +
             SWM.esc(g.name) + '</button>';
    }).join('');

    function scopeNodes() {
      return data.nodes.filter((n) => n.layer === state.layer && state.groups.has(n.group));
    }
    /* L1: parent-first BFS (group order, then ID), pinned first, capped; L2–L4 fit whole */
    function visibleNodes() {
      var scope = scopeNodes(), inScope = new Set(scope.map((n) => n.id));
      if (scope.length <= MAX_VISIBLE && !state.pinned.size) return scope.slice().sort(bySort);
      var out = [], seen = new Set();
      function add(id) { if (!seen.has(id) && inScope.has(id)) { seen.add(id); out.push(byId.get(id)); } }
      /* a pinned node brings its in-tier ancestors */
      state.pinned.forEach(function (id) {
        var chain = [], cur = id;
        while (cur && byId.has(cur) && byId.get(cur).layer === state.layer) { chain.unshift(cur); cur = parentOf.get(cur); }
        chain.forEach(add);
      });
      var q = anchors.filter((a) => inScope.has(a.id)).map((a) => a.id);
      var roots = scope.filter(function (n) { var p = parentOf.get(n.id); return !n.anchor && !(p && inScope.has(p)); })
                       .map((n) => n.id).sort();
      q = q.concat(roots);
      while (q.length && out.length < MAX_VISIBLE) {
        var id = q.shift();
        if (!seen.has(id)) add(id);
        (children.get(id) || []).forEach(function (c) { if (inScope.has(c)) q.push(c); });
      }
      return out.slice(0, MAX_VISIBLE);
    }
    function bySort(a, b) { return groupOrder.indexOf(a.group) - groupOrder.indexOf(b.group) || (a.anchor ? -1 : b.anchor ? 1 : 0) || (a.id < b.id ? -1 : 1); }

    function colorOf(n) {
      if (state.colorBy === 'coverage') return SWM.coverageColor(n.coverage);
      if (state.colorBy === 'status') return SWM.status[SWM.coverageStatus(n.coverage)].color;
      return SWM.layerColor(n.layer);
    }
    function paperColorOf(n) {
      if (state.colorBy === 'coverage') return SWM.coverageColor(n.coverage, 'paper');
      if (state.colorBy === 'status') return SWM.status[SWM.coverageStatus(n.coverage)].color;
      return SWM.layerColor(n.layer, 'paper');
    }

    var MIN_W = 720;
    function dims() {
      var cw0 = stage.clientWidth || 900, w = Math.max(cw0, MIN_W);
      $('swmCanvas').classList.toggle('scroll-x', w > cw0);
      var h = Math.round(Math.max(560, Math.min(640, (global.innerHeight || 900) - 250, w * .66)));
      return { w: w, h: h };
    }
    function hash(id) { var h = 0x811c9dc5; for (var i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0) / 4294967295; }
    /* two rows of disjoint group circles, radius ∝ sqrt(shown), label room reserved */
    function packCentres(d, nodes, gs) {
      var top = 96, bottom = d.h - 60, left = 24, right = d.w - 24, rows = gs.length > 4 ? 2 : 1;
      var per = Math.ceil(gs.length / rows), rowH = (bottom - top) / rows, c = {};
      var val = (g) => Math.max(3, nodes.filter((n) => n.group === g).length);
      for (var r = 0; r < rows; r++) {
        var row = gs.slice(r * per, (r + 1) * per), sq = row.map((g) => Math.sqrt(val(g)));
        var gap = 22, avail = right - left - gap * (row.length - 1), LABEL = 116;   /* wrapped title / count plates need ~116 px */
        var k = Math.min(avail / (2 * d3.sum(sq)), (rowH - 60) / 2 / d3.max(sq));
        var slot = () => row.map((g, i) => Math.max(2 * Math.max(42, k * sq[i]), LABEL));
        while (d3.sum(slot()) > avail && k > 3) k *= .92;
        var ws = slot(), x = left + Math.max(0, (avail - d3.sum(ws)) / 2);
        row.forEach(function (g, i) {
          var rad = Math.max(42, k * sq[i]);
          c[g] = { x: x + ws[i] / 2, y: top + rowH * r + rowH / 2 + (r === 0 ? 8 : -4), r: rad };
          x += ws[i] + gap;
        });
      }
      return c;
    }
    function layout(nodes, lks, d) {
      var gs = groupOrder.filter((g) => nodes.some((n) => n.group === g));
      var ctr = packCentres(d, nodes, gs);
      nodes.forEach(function (n) {
        var c = ctr[n.group] || { x: d.w / 2, y: d.h / 2 }, a = hash(n.id) * 2 * Math.PI, r = n.anchor ? 0 : 18 + hash(n.id + '#') * 60;
        n.x = c.x + Math.cos(a) * r; n.y = c.y + Math.sin(a) * r;
        if (n.anchor) { n.fx = c.x; n.fy = c.y; }
      });
      var hier = lks.filter((l) => HIER[l.pred] || parentOf.get(l.source) === l.target || parentOf.get(l.target) === l.source);
      var parentLinks = nodes.filter((n) => parentOf.has(n.id) && nodes.some((m) => m.id === parentOf.get(n.id)))
        .map(function (n) { return { source: n.id, target: parentOf.get(n.id) }; });
      var sim = d3.forceSimulation(nodes).randomSource(SWM.random(1729)).stop()
        .force('link', d3.forceLink(parentLinks.concat(hier.map(function (l) { return { source: l.source, target: l.target }; })))
          .id((n) => n.id).distance(nodes.length > 60 ? 22 : 48).strength(.55))
        .force('charge', d3.forceManyBody().strength(nodes.length > 60 ? -9 : -140).distanceMax(nodes.length > 60 ? 60 : 220))
        .force('collide', d3.forceCollide().radius((n) => n.anchor ? 22 : nodes.length > 60 ? 6.2 : 16).iterations(2))
        .force('x', d3.forceX(function (n) { return (ctr[n.group] || { x: d.w / 2 }).x; }).strength(nodes.length > 60 ? .09 : .16))
        .force('y', d3.forceY(function (n) { return (ctr[n.group] || { y: d.h / 2 }).y; }).strength(nodes.length > 60 ? .09 : .16));
      for (var i = 0; i < 260; i++) {
        sim.tick();
        /* members stay inside their group circle */
        nodes.forEach(function (n) {
          var c = ctr[n.group]; if (!c || !c.r || n.anchor) return;
          var dx = n.x - c.x, dy = n.y - c.y, dist = Math.sqrt(dx * dx + dy * dy), lim = Math.max(18, c.r - 8);
          if (dist > lim) { n.x = c.x + dx / dist * lim; n.y = c.y + dy / dist * lim; }
        });
      }
      sim.stop();
      nodes.forEach(function (n) {
        n.x = Math.max(24, Math.min(d.w - 24, n.x)); n.y = Math.max(96, Math.min(d.h - 60, n.y));
      });
      return ctr;
    }

    function render() {
      var d = dims(); lastDims = d.w + 'x' + d.h;
      svg.attr('viewBox', '0 0 ' + d.w + ' ' + d.h).attr('height', d.h).style('width', d.w + 'px').style('min-width', '100%');
      svg.interrupt().selectAll('*').interrupt(); clearTimeout(finalTimer);
      gRoot.attr('transform', null); gRings.selectAll('*').remove(); gLinks.selectAll('*').remove();
      gLabels.selectAll('*').remove(); gNodes.selectAll('*').remove(); gNodes.attr('transform', null).attr('class', null); gLinks.attr('transform', null);
      $('swmEmpty').hidden = true;
      press('#swmLevels button', (b) => +b.dataset.level === state.layer);
      $('swmZoom').style.display = state.view === 'matrix' ? 'none' : '';
      if (state.view === 'matrix') svg.on('.zoom', null); else { svg.call(zoom).on('dblclick.zoom', null); svg.call(zoom.transform, d3.zoomIdentity); }
      if (state.example) renderExample(d);
      else if (state.view === 'matrix') renderMatrix(d);
      else if (state.view === 'tree') renderTree(d);
      else renderGraph(d);
      renderChrome();
      renderInspector();
      renderList();
    }

    var current = { nodes: [], links: [] };
    function renderGraph(d) {
      var vis = visibleNodes();
      if (!vis.length) return showEmpty('Nothing in scope', 'Every ontology group is filtered out. Open “Filters & colour” to bring one back.');
      var nodes = vis.map(function (n) { return Object.assign({}, n); });
      var ids = new Set(nodes.map((n) => n.id));
      var lks = links.filter((l) => ids.has(l.s) && ids.has(l.t))
                     .map(function (l) { return { source: l.s, target: l.t, pred: l.pred, src: l.src, raw: l }; });
      var ctr = layout(nodes, lks, d);
      var pos = new Map(nodes.map((n) => [n.id, n]));
      current = { nodes: nodes, links: lks, pos: pos, ctr: ctr };
      var dense = nodes.length > 60;
      var sel = state.selected && pos.has(state.selected) ? state.selected : null;

      /* cross-group links stay faint until a node is selected */
      var link = gLinks.selectAll('line').data(lks).join('line')
        .attr('class', function (l) {
          var cls = 'swm-link rel-' + l.pred.toLowerCase().split('_')[0];
          if (sel && l.source === sel) cls += ' hl-out'; else if (sel && l.target === sel) cls += ' hl-in';
          return cls;
        })
        .attr('x1', (l) => pos.get(l.source).x).attr('y1', (l) => pos.get(l.source).y)
        .attr('x2', (l) => pos.get(l.target).x).attr('y2', (l) => pos.get(l.target).y)
        .attr('stroke-width', (l) => sel && (l.source === sel || l.target === sel) ? 1.8 : 1)
        .attr('stroke-opacity', function (l) {
          if (sel) return (l.source === sel || l.target === sel) ? .95 : .06;
          var cross = pos.get(l.source).group !== pos.get(l.target).group;
          return cross ? (dense ? .07 : .22) : (dense ? .28 : .5);
        })
        .attr('marker-end', (l) => sel && l.source === sel ? 'url(#swmArrow)' : sel && l.target === sel ? 'url(#swmArrowIn)' : null);
      if (sel) {

        gLinks.selectAll('path.swm-link-hit').data(lks.filter((l) => l.source === sel || l.target === sel)).join('path')
          .attr('class', 'swm-link-hit').attr('d', function (l) { var a = pos.get(l.source), b = pos.get(l.target); return 'M' + a.x + ',' + a.y + 'L' + b.x + ',' + b.y; })
          .on('click', function (ev, l) { ev.stopPropagation(); selectEdge(l.raw); })
          .append('title').text((l) => byId.get(l.source).label + ' ' + l.pred + ' ' + byId.get(l.target).label);
      }

      var node = gNodes.selectAll('g').data(nodes, (n) => n.id).join('g')
        .attr('class', function (n) {
          var c = 'swm-node';
          if (n.id === sel) c += ' selected';
          else if (sel && !lks.some((l) => (l.source === sel && l.target === n.id) || (l.target === sel && l.source === n.id))) c += ' dim';
          return c;
        })
        .attr('transform', (n) => 'translate(' + n.x + ',' + n.y + ')')
        .attr('tabindex', (n) => n.anchor || !dense ? 0 : null)
        .attr('role', 'button')
        .attr('aria-label', (n) => nodeAria(n))
        .on('click', function (ev, n) { ev.stopPropagation(); onNodeClick(n); })
        .on('keydown', function (ev, n) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onNodeClick(n); } })
        .call(tips, (n) => n);

      node.filter((n) => n.anchor).append('circle').attr('r', 17)
        .attr('fill', '#2a2f63').attr('stroke', '#b7a3ff').attr('stroke-width', 1.4);
      node.append('path').attr('class', 'glyph')
        .attr('d', (n) => SWM.symbol(n.group, n.anchor ? 150 : dense ? 42 : 90))
        .attr('stroke', (n) => n.anchor ? 'none' : null)
        .call(SWM.paintGlyph, (n) => n.group, (n) => n.anchor ? '#eef0fb' : colorOf(n), 1.8);

      /* dense tiers label members only on selection, search or hover */
      /* titles above and counts below each cluster, on plates */
      node.filter((n) => n.anchor).each(function (n) {
        var g = d3.select(this), mem = nodes.filter((m) => m.group === n.group);
        var inG = tierGroupCount(n.group), shown = mem.length;
        var c = ctr[n.group] || {}, topY = d3.min(mem, (m) => m.y) - n.y, botY = d3.max(mem, (m) => m.y) - n.y;
        var ty = Math.min(-26, topY - 14, c.r ? -c.r - 4 : 0), by = Math.max(34, botY + 20, c.r ? c.r + 14 : 0);
        var title = groupName[n.group] || n.label, sub = shown < inG ? shown + ' of ' + inG + ' shown' : inG + ' in group';

        var tl = title.length > 12 && title.indexOf(' & ') > 0 ? [title.split(' & ')[0] + ' &', title.split(' & ').slice(1).join(' & ')] : [title];
        var tw = d3.max(tl, (x) => x.length) * 7.2 + 16, th = tl.length * 15 + 7;
        g.append('rect').attr('x', -tw / 2).attr('y', ty - th + 6).attr('width', tw).attr('height', th).attr('rx', 6)
          .attr('fill', 'rgba(16,22,43,.8)').attr('stroke', 'rgba(203,210,255,.16)');
        tl.forEach((line, i) => g.append('text').attr('class', 'grp').attr('text-anchor', 'middle').attr('y', ty - (tl.length - 1 - i) * 15).text(line));
        var sw = sub.length * 5.6 + 14;
        g.append('rect').attr('x', -sw / 2).attr('y', by - 11).attr('width', sw).attr('height', 16).attr('rx', 6)
          .attr('fill', 'rgba(16,22,43,.8)').attr('stroke', 'rgba(203,210,255,.16)');
        g.append('text').attr('class', 'sub').attr('text-anchor', 'middle').attr('y', by).text(sub);
      });
      var labelled = new Set();
      if (!dense) nodes.forEach(function (n) { if (!n.anchor) labelled.add(n.id); });
      if (sel) { labelled.add(sel); lks.forEach(function (l) { if (l.source === sel) labelled.add(l.target); if (l.target === sel) labelled.add(l.source); }); }
      if (state.query) matches().forEach(function (id) { if (pos.has(id)) labelled.add(id); });
      node.filter((n) => !n.anchor && labelled.has(n.id)).append('text').attr('x', 9).attr('y', 4)
        .text(function (n) { var t = SWM.fixtureText(n.label); return t.length > 28 ? t.slice(0, 27) + '…' : t; });
      if (!sel && !state.query) dropCollidingLabels(node);
      applyQueryStyles();
    }
    function tips(sel, nodeOf) {
      return sel.on('mouseenter focus', function (ev, x) { var n = nodeOf(x); if (n) SWM.tip.show(tipHtml(n), ev); })
        .on('mousemove', (ev) => SWM.tip.move(ev)).on('mouseleave blur', () => SWM.tip.hide());
    }
    function tierGroupCount(g) { return data.nodes.filter((n) => n.layer === state.layer && n.group === g).length; }
    function onNodeClick(n) {
      if (n.anchor && state.layer === 1) {
        var all = data.nodes.filter((m) => m.layer === 1 && m.group === n.group);
        var shown = current.nodes.filter((m) => m.group === n.group).length;
        if (shown < all.length) { state.pinned = new Set(all.map((m) => m.id)); }
      }
      select(n.id);
    }
    function dropCollidingLabels(sel) {
      var boxes = [];
      sel.nodes().map(function (el) { return { el: el, n: d3.select(el).datum() }; })
        .sort((a, b) => (b.n.anchor ? 1 : 0) - (a.n.anchor ? 1 : 0) || (b.n.instances || 0) - (a.n.instances || 0))
        .forEach(function (item) {
          var t = item.el.querySelector('text:not(.grp):not(.sub)');
          if (item.n.anchor) { boxes.push({ x: item.n.x - 60, y: item.n.y - 40, w: 120, h: 82 }); return; }
          if (!t) return;
          var box = { x: item.n.x + 8, y: item.n.y - 9, w: t.textContent.length * 5.9 + 8, h: 15 };
          var clash = boxes.some((b) => box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y);
          if (clash) t.remove(); else boxes.push(box);
        });
    }

    function renderTree(d) {
      var vis = visibleNodes();
      if (!vis.length) return showEmpty('Nothing in scope', 'Every ontology group is filtered out.');
      var visible = new Set(vis.map((n) => n.id));
      var groupsIn = groupOrder.filter((g) => vis.some((n) => n.group === g));
      /* root per group: its anchor if in tier, else a label-only heading */
      var root = { id: '__root', label: layerName[state.layer], kids: groupsIn.map(function (g) {
        var a = anchorOf[g];
        if (a && visible.has(a.id)) return { id: a.id, node: a };
        return { id: '__grp:' + g, label: groupName[g], heading: true, group: g };
      }) };
      function kidsOf(x) {
        if (x.kids) return x.kids;
        if (x.heading) return vis.filter(function (n) { var p = parentOf.get(n.id); return n.group === x.group && !(p && visible.has(p)); }).map(function (n) { return { id: n.id, node: n }; });
        return (children.get(x.id) || []).filter((c) => visible.has(c)).map(function (c) { return { id: c, node: byId.get(c) }; });
      }
      var h = d3.hierarchy(root, kidsOf);
      var R = Math.min(d.w, d.h) / 2 - 90;
      d3.cluster().size([2 * Math.PI, R]).separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth)(h);
      var tf = 'translate(' + d.w / 2 + ',' + (d.h / 2 + 6) + ')';
      gLinks.attr('transform', tf); gNodes.attr('transform', tf);
      gLinks.selectAll('path').data(h.links().filter((l) => l.source.depth > 0)).join('path')
        .attr('class', 'swm-link').attr('stroke-width', 1).attr('stroke-opacity', .45)
        .attr('d', d3.linkRadial().angle((n) => n.x).radius((n) => n.y));
      var many = h.descendants().length > 90;
      var node = gNodes.selectAll('g').data(h.descendants().filter((n) => n.depth > 0)).join('g')
        .attr('class', (n) => 'swm-node' + (n.data.id === state.selected ? ' selected' : ''))
        .attr('transform', (n) => 'rotate(' + (n.x * 180 / Math.PI - 90) + ') translate(' + n.y + ',0)')
        .attr('tabindex', (n) => n.depth === 1 ? 0 : null)
        .attr('role', (n) => n.data.heading ? null : 'button')
        .attr('aria-label', (n) => n.data.heading ? null : nodeAria(n.data.node))
        .on('click', function (ev, n) { ev.stopPropagation(); if (!n.data.heading) select(n.data.id); })
        .on('keydown', function (ev, n) { if ((ev.key === 'Enter' || ev.key === ' ') && !n.data.heading) { ev.preventDefault(); select(n.data.id); } })
        .call(tips, (n) => n.data.heading ? null : n.data.node);
      node.filter((n) => !n.data.heading).append('path').attr('class', 'glyph')
        .attr('d', (n) => SWM.symbol(n.data.node.group, n.depth === 1 ? 150 : 46))
        .call(SWM.paintGlyph, (n) => n.data.node.group, (n) => n.depth === 1 ? '#eef0fb' : colorOf(n.data.node), 1.6);
      node.filter((n) => n.depth === 1 || !many || n.data.id === state.selected).append('text')
        .attr('class', (n) => n.depth === 1 ? 'grp' : null)
        .attr('dy', '.32em').attr('x', (n) => n.x < Math.PI ? 10 : -10)
        .attr('text-anchor', (n) => n.x < Math.PI ? 'start' : 'end')
        .attr('transform', (n) => n.x < Math.PI ? null : 'rotate(180)')
        .text(function (n) { var t = SWM.fixtureText(n.data.heading ? n.data.label : n.depth === 1 ? (groupName[n.data.node.group] || n.data.node.label) : n.data.node.label); return t.length > 22 ? t.slice(0, 21) + '…' : t; });
      current = { nodes: vis, links: [] };
      applyQueryStyles();
    }

    function renderMatrix(d) {
      var scope = scopeNodes(), ids = new Set(scope.map((n) => n.id));
      var groups = data.groups.filter((g) => state.groups.has(g.id) && scope.some((n) => n.group === g.id));
      if (!groups.length) return showEmpty('Nothing in scope', 'Every ontology group is filtered out.');
      var idx = {}; groups.forEach((g, i) => (idx[g.id] = i));
      var counts = groups.map(function () { return groups.map(function () { return { n: 0, preds: {} }; }); });
      var total = 0;
      links.forEach(function (l) {
        if (!ids.has(l.s) || !ids.has(l.t)) return;
        var a = byId.get(l.s), b = byId.get(l.t);
        if (!(a.group in idx) || !(b.group in idx)) return;
        var cell = counts[idx[a.group]][idx[b.group]]; cell.n++; total++; cell.preds[l.pred] = (cell.preds[l.pred] || 0) + 1;
      });
      var max = d3.max(counts.flat(), (c) => c.n) || 1;
      var scale = d3.scaleSequential(d3.interpolateRgb('#3b4486', '#e2d8ff')).domain([1, max]);
      var pad = { l: 150, t: 118 }, size = Math.max(22, Math.min((d.w - pad.l - 40) / groups.length, (d.h - pad.t - 70) / groups.length));
      var g = gNodes.attr('class', 'swm-matrix');
      groups.forEach(function (rowG, r) {
        groups.forEach(function (colG, c) {
          var cell = counts[r][c], fill = cell.n ? scale(cell.n) : 'rgba(203,210,255,.05)';
          g.append('rect').attr('class', 'cell').attr('x', pad.l + c * size).attr('y', pad.t + r * size)
            .attr('width', size).attr('height', size).attr('rx', 3).attr('fill', fill)
            .attr('tabindex', cell.n ? 0 : null).attr('role', cell.n ? 'img' : null)
            .attr('aria-label', cell.n ? rowG.name + ' to ' + colG.name + ': ' + cell.n + ' typed relations' : null)
            .on('mouseenter focus', function (ev) {
              if (!cell.n) return;
              var preds = Object.keys(cell.preds).sort((a, b) => cell.preds[b] - cell.preds[a]).slice(0, 4)
                .map((p) => SWM.esc(p) + ' ×' + cell.preds[p]).join('<br>');
              SWM.tip.show('<b>' + SWM.esc(rowG.name) + ' → ' + SWM.esc(colG.name) + '</b><small>' + cell.n + ' typed relations</small><small style="margin-top:5px">' + preds + '</small>', ev);
            })
            .on('mousemove', (ev) => SWM.tip.move(ev)).on('mouseleave blur', () => SWM.tip.hide());
          if (cell.n) g.append('text').attr('class', 'lbl').attr('fill', SWM.textOn(fill)).attr('font-weight', 650)
            .attr('x', pad.l + c * size + size / 2).attr('y', pad.t + r * size + size / 2 + 3.5).attr('text-anchor', 'middle').text(cell.n);
        });
        g.append('text').attr('class', 'lbl').attr('fill', SWM.ink.ink2).attr('x', pad.l - 10).attr('y', pad.t + r * size + size / 2 + 3.5).attr('text-anchor', 'end').text(rowG.name);
        g.append('text').attr('class', 'lbl').attr('fill', SWM.ink.ink2)
          .attr('transform', 'translate(' + (pad.l + r * size + size / 2) + ',' + (pad.t - 10) + ') rotate(-40)').attr('text-anchor', 'start').text(rowG.name);
      });
      current = { nodes: scope, links: [], total: total };
    }

    function exampleData() {
      var nodes = EX_NODES.map((id) => byId.get(id));
      if (nodes.some((n) => !n || n.layer !== 4)) return null;
      var set = new Set(EX_NODES);
      var focusLinks = links.filter((l) => set.has(l.s) && set.has(l.t));
      if (focusLinks.length !== EX_EDGES) return null;

      for (var i = 0; i < EX_CHAIN.length - 1; i++)
        if (!focusLinks.some((l) => l.s === EX_CHAIN[i] && l.t === EX_CHAIN[i + 1])) return null;
      return { nodes: nodes, links: focusLinks, set: set };
    }
    function renderExample(d) {
      var ex = exampleData();
      if (!ex) { state.example = false; return showEmpty(EX_MISSING[0], EX_MISSING[1]); }
      /* all 24 settle, then the 9 move into lanes */
      var all = data.nodes.filter((n) => n.layer === 4).map(function (n) { return Object.assign({}, n); });
      var allIds = new Set(all.map((n) => n.id));
      var l4links = links.filter((l) => allIds.has(l.s) && allIds.has(l.t)).map(function (l) { return { source: l.s, target: l.t, pred: l.pred }; });
      layout(all, l4links, d);
      var start = new Map(all.map(function (n) { return [n.id, { x: n.x, y: n.y }]; }));

      var cw = Math.max(108, Math.min(160, (d.w - 80) / 5 - 18)), ch = 64;
      var x0 = 40 + cw / 2, x1 = d.w - 40 - cw / 2, top = Math.round(d.h * .38), low = Math.round(d.h * .72);
      var lane = new Map();
      EX_CHAIN.forEach(function (id, i) { lane.set(id, { x: x0 + (x1 - x0) * i / 4, y: top }); });
      var lx = lane.get('rt-svc-identity').x, rx = lane.get('rt-ledger').x;
      EX_LOWER.forEach(function (id, i) { lane.set(id, { x: lx - cw * .35 + (rx - lx + cw * .1) * i / 3, y: low }); });
      var ctx = all.filter((n) => !ex.set.has(n.id));
      var ctxIds = new Set(ctx.map((n) => n.id));
      var dur = state.animate ? SWM.dur(600) : 0; state.animate = false;

      /* muted, non-interactive context */
      gRings.append('g').attr('aria-hidden', 'true').selectAll('line')
        .data(l4links.filter((l) => ctxIds.has(l.source) || ctxIds.has(l.target))).join('line')
        .attr('class', 'swm-link ctx')
        .attr('x1', (l) => (lane.get(l.source) || start.get(l.source)).x).attr('y1', (l) => (lane.get(l.source) || start.get(l.source)).y)
        .attr('x2', (l) => (lane.get(l.target) || start.get(l.target)).x).attr('y2', (l) => (lane.get(l.target) || start.get(l.target)).y)
        .attr('stroke-opacity', dur ? 0 : .12).transition().duration(dur).attr('stroke-opacity', .12);
      gRings.append('g').attr('aria-hidden', 'true').selectAll('path').data(ctx).join('path')
        .attr('class', 'glyph').attr('d', (n) => SWM.symbol(n.group, 60))
        .call(SWM.paintGlyph, (n) => n.group, () => SWM.ink.ink2, 1.4)
        .attr('transform', function (n) { var p = start.get(n.id); return 'translate(' + p.x + ',' + p.y + ')'; })
        .attr('opacity', dur ? .5 : .14).transition().duration(dur).attr('opacity', .14);


      function edgePath(l) {
        var a = lane.get(l.s), b = lane.get(l.t);
        if (a.y === b.y) { var dir = b.x > a.x ? 1 : -1; return 'M' + (a.x + dir * cw / 2) + ',' + a.y + 'L' + (b.x - dir * (cw / 2 + 2)) + ',' + b.y; }
        var sy = a.y < b.y ? a.y + ch / 2 : a.y - ch / 2, ty = a.y < b.y ? b.y - ch / 2 - 2 : b.y + ch / 2 + 2;
        var my = (sy + ty) / 2;
        return 'M' + a.x + ',' + sy + 'C' + a.x + ',' + my + ' ' + b.x + ',' + my + ' ' + b.x + ',' + ty;
      }
      function midOf(l) {
        var a = lane.get(l.s), b = lane.get(l.t);
        if (a.y === b.y) return { x: (a.x + b.x) / 2, y: a.y - ch / 2 - 12, anchor: 'middle' };
        var lowN = a.y > b.y ? a : b;   /* the lower-lane end of a vertical relation */
        return { x: lowN.x, y: lowN.y - ch / 2 - 14, anchor: 'middle' };
      }
      var isChain = function (l) { var i = EX_CHAIN.indexOf(l.s); return i >= 0 && EX_CHAIN[i + 1] === l.t; };
      var sel = state.edge;
      var eg = gLinks.selectAll('g').data(ex.links).join('g').attr('opacity', 0);
      eg.append('path').attr('class', (l) => 'swm-link focus' + (isChain(l) ? ' chain' : ''))
        .attr('d', edgePath).attr('marker-end', (l) => isChain(l) ? 'url(#swmArrowHi)' : 'url(#swmArrow)')
        .attr('stroke-width', (l) => sel && sel.s === l.s && sel.t === l.t ? 3.4 : null);
      eg.append('path').attr('class', 'swm-link-hit').attr('d', edgePath)
        .attr('tabindex', 0).attr('role', 'button')
        .attr('aria-label', (l) => 'Relation ' + byId.get(l.s).label + ' ' + l.pred + ' ' + byId.get(l.t).label)
        .on('click', function (ev, l) { ev.stopPropagation(); selectEdge(l); })
        .on('keydown', function (ev, l) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); selectEdge(l); } });
      eg.append('text').attr('class', 'swm-pred').attr('text-anchor', (l) => midOf(l).anchor)
        .attr('x', (l) => midOf(l).x).attr('y', (l) => midOf(l).y)
        .attr('fill', (l) => sel && sel.s === l.s && sel.t === l.t ? '#ffffff' : null).text((l) => l.pred);
      if (dur) eg.transition().delay(dur * .45).duration(dur * .55).attr('opacity', 1); else eg.attr('opacity', 1);

      var card = gNodes.selectAll('g').data(ex.nodes, (n) => n.id).join('g')
        .attr('class', (n) => 'swm-node swm-fcard' + (n.id === state.selected ? ' selected' : ''))
        .attr('tabindex', 0).attr('role', 'button').attr('aria-label', (n) => nodeAria(n))
        .attr('transform', function (n) { var p = dur ? start.get(n.id) : lane.get(n.id); return 'translate(' + p.x + ',' + p.y + ') scale(' + (dur ? .35 : 1) + ')'; })
        .on('click', function (ev, n) { ev.stopPropagation(); state.edge = null; select(n.id); })
        .on('keydown', function (ev, n) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); state.edge = null; select(n.id); } })
        .call(tips, (n) => n);
      card.append('rect').attr('class', 'card').attr('x', -cw / 2).attr('y', -ch / 2).attr('width', cw).attr('height', ch).attr('rx', 10);
      card.append('path').attr('class', 'glyph').attr('transform', 'translate(' + (-cw / 2 + 13) + ',' + (-ch / 2 + 13) + ')')
        .attr('d', (n) => SWM.symbol(n.group, 34)).attr('stroke', 'none')
        .call(SWM.paintGlyph, (n) => n.group, colorOf, 1.5);
      card.append('text').attr('class', 'kind').attr('x', -cw / 2 + 22).attr('y', -ch / 2 + 16).text((n) => (groupName[n.group] || n.group).split(' ')[0].toUpperCase());
      var maxCh = Math.floor((cw - 14) / 7.2);
      card.each(function (n) {
        var g = d3.select(this), t = n.label, parts = [t];
        if (t.length > maxCh) {
          if (t.indexOf(' · ') > 0) parts = t.split(' · ');
          else { var cut = t.lastIndexOf(' ', maxCh); if (cut < 4) cut = t.lastIndexOf('-', maxCh); if (cut > 3) parts = [t.slice(0, cut), t.slice(cut + 1)]; }
        }
        var fit = (x, m) => x.length > m ? x.slice(0, m - 1) + '…' : x;
        if (parts.length > 1) {
          g.append('text').attr('class', 'name').attr('text-anchor', 'middle').attr('y', 1).text(fit(parts[0], maxCh));
          g.append('text').attr('class', 'tag').attr('text-anchor', 'middle').attr('y', 14).attr('fill', '#c3c8e8').text(fit(parts.slice(1).join(' · '), Math.floor((cw - 14) / 5.4)));
        } else g.append('text').attr('class', 'name').attr('text-anchor', 'middle').attr('y', 5).text(fit(t, maxCh));
        g.append('text').attr('class', 'tag').attr('text-anchor', 'middle').attr('y', ch / 2 - 7).text('Illustrative');
      });
      if (dur) card.transition().duration(dur).attr('transform', function (n) { var p = lane.get(n.id); return 'translate(' + p.x + ',' + p.y + ') scale(1)'; });
      if (dur) {
        clearTimeout(finalTimer);
        finalTimer = setTimeout(function () {
          card.interrupt().attr('transform', function (n) { var p = lane.get(n.id); return 'translate(' + p.x + ',' + p.y + ') scale(1)'; });
          eg.interrupt().attr('opacity', 1);
          gRings.selectAll('line').interrupt().attr('stroke-opacity', .12);
          gRings.selectAll('path').interrupt().attr('opacity', .14);
        }, dur + 80);
      }
      current = { nodes: ex.nodes, links: ex.links, ctx: ctx.length, total: all.length };
    }

    function renderChrome() {
      var vis = current.nodes || [], M = scopeNodes().length;
      var kick = state.example ? 'Example focus / L4 runtime' : 'L' + state.layer + ' ' + (layerName[state.layer] || '') +
        (state.view === 'graph' ? ' / grouped by ontology group' : state.view === 'tree' ? ' / hierarchy' : ' / relations between groups');
      $('swmKicker').textContent = kick;
      var scope;
      if (state.example) scope = '9 of ' + (current.total || 24) + ' runtime nodes focused · 8 focus relations · other ' + (current.ctx != null ? current.ctx : 15) + ' dimmed';
      else if (state.view === 'matrix') scope = (current.total || 0) + ' typed relations among the ' + M + ' L' + state.layer + ' nodes in scope · ' + data.nodes.length + ' across all tiers';
      else scope = vis.length + ' shown of ' + M + ' L' + state.layer + ' nodes' + (M < tierCount[state.layer] ? ' (' + tierCount[state.layer] + ' before filters)' : '') +
        ' · ' + data.nodes.length + ' across all tiers' + (vis.length < M ? ' · search or open a group to see the rest' : '');
      $('swmOntScope').textContent = scope;
      $('swmExampleBtn').textContent = state.example ? 'Example active: Refund workflow' : 'Example: Refund workflow →';
      $('swmExampleBtn').disabled = state.example;
      $('swmBackBtn').hidden = !state.saved;

      var lg = $('swmLegend');
      if (state.example || state.view === 'matrix') {
        lg.hidden = state.example;
        if (!state.example) lg.innerHTML = '<h6>Cell = typed relations · rows act on columns</h6><div class="swm-ramp"><span>few</span><span class="bar" style="background:linear-gradient(90deg,#3b4486,#e2d8ff)"></span><span>many</span></div>';
      } else {
        lg.hidden = false;
        var scale = state.colorBy === 'layer'
          ? '<span class="swm-legend-item"><span style="width:11px;height:11px;border-radius:3px;background:' + SWM.layerColor(state.layer) + ';display:inline-block"></span>L' + state.layer + ' ' + SWM.esc((layerName[state.layer] || '').split(' ')[0]) + '</span>'
          : state.colorBy === 'coverage'
          ? '<span class="swm-ramp"><span>≤40%</span><span class="bar"></span><span>100%</span></span><span class="swm-legend-item">authored coverage · ends are clamped bounds</span>'
          : Object.keys(SWM.status).map((k) => '<span class="swm-legend-item">' + SWM.statusHtml(k) + '</span>').join('');
        lg.innerHTML = '<h6>Colour = ' + (state.colorBy === 'layer' ? 'tier' : state.colorBy === 'coverage' ? 'authored coverage' : 'coverage status') + ' · shape = ontology group</h6>' +
          '<div class="swm-legend-items">' + scale + '</div>';
      }
      var foot = state.example
        ? '<span><b style="color:#eef0fb">Illustrative neighbourhood · not an execution trace.</b> Arrow = stored relation direction · glow = selection, never evidence confidence</span>'
        : state.view === 'matrix'
        ? '<span>Counts of stored relations in the bundle. Public identifiers retained; Silex-authored mappings are illustrative.</span>'
        : '<span>Every glyph is an existing node. Groups are spatially arranged; position is not a risk or distance score.</span>' +
          '<span>Click a group to open it · search all ' + data.nodes.length + ' nodes · scroll or +/− to zoom</span>';
      if ($('swmCanvas').classList.contains('scroll-x')) foot += '<span><b style="color:#eef0fb">Scroll sideways</b> to see the whole chart · the accessible list below has every item</span>';
      $('swmFoot').innerHTML = foot;
    }

    function showEmpty(title, sub) {
      var e = $('swmEmpty'); e.hidden = false;
      e.innerHTML = '<div>' + SWM.esc(title) + '<small>' + SWM.esc(sub) + '</small></div>';
      current = { nodes: [], links: [] };
    }

    var hits = [], hitIdx = -1;
    function matchText(n) { return (n.label + ' ' + (n.def || '') + ' ' + n.id + ' ' + (n.src || []).map((s) => s.id || '').join(' ')).toLowerCase(); }
    function matches() {
      var q = state.query.trim().toLowerCase(); if (q.length < 2) return [];
      return data.nodes.filter((n) => matchText(n).indexOf(q) >= 0).map((n) => n.id);
    }
    function applyQueryStyles() {
      var q = state.query.trim().toLowerCase(); if (!q || state.example) return;
      var m = new Set(matches());
      gNodes.selectAll('g.swm-node').each(function (d) {
        var id = d.data ? d.data.id : d.id; if (!id || String(id).indexOf('__') === 0) return;
        this.classList.toggle('dim', !m.has(id)); this.classList.toggle('match', m.has(id));
      });
      gLinks.selectAll('.swm-link').classed('dim', true);
    }
    function renderResults() {
      var box = $('swmResults'), input = $('swmQuery'), q = state.query.trim();
      if (q.length < 2) { box.hidden = true; input.setAttribute('aria-expanded', 'false'); return; }
      var all = matches(); hits = all.slice(0, 12);
      var inTier = all.filter((id) => byId.get(id).layer === state.layer).length;
      box.innerHTML = '<div class="none" style="padding:6px 8px 4px">' + all.length + ' match' + (all.length === 1 ? '' : 'es') + ' across all ' + data.nodes.length + ' nodes · ' + inTier + ' in L' + state.layer + '</div>' +
        (hits.length ? hits.map(function (id, i) {
          var n = byId.get(id);
          return '<button role="option" id="swmHit' + i + '" data-id="' + SWM.esc(id) + '" class="' + (i === hitIdx ? 'on' : '') + '" aria-selected="' + (i === hitIdx) + '">' +
            '<svg width="12" height="12" viewBox="-7 -7 14 14" aria-hidden="true"><path d="' + SWM.symbol(n.group, 50) + '" ' + SWM.glyphAttrs(n.group, SWM.layerColor(n.layer, 'paper')) + '/></svg>' +
            '<span>' + SWM.esc(SWM.fixtureText(n.label)) + '</span><small>L' + n.layer + ' · ' + SWM.esc(groupName[n.group] || n.group) + '</small></button>';
        }).join('') : '<div class="none">No match in the ' + data.nodes.length + ' nodes. Try another term.</div>');
      box.hidden = false; input.setAttribute('aria-expanded', 'true');
      if (hitIdx >= 0) input.setAttribute('aria-activedescendant', 'swmHit' + hitIdx); else input.removeAttribute('aria-activedescendant');
    }
    function goToNode(id) {
      var n = byId.get(id); if (!n) return;
      exitExample(true);
      state.groups.add(n.group); syncGroupChips();
      state.pinned = new Set([id]);
      state.selected = id; state.edge = null;
      $('swmResults').hidden = true; $('swmQuery').setAttribute('aria-expanded', 'false');
      if (n.layer !== state.layer) { entering = true; state.layer = n.layer; SWM.setLevel(n.layer, 'explorer'); entering = false; }
      if (state.view === 'matrix') setView('graph');
      render();
    }

    function select(id) {
      if (!byId.has(id)) return;
      state.selected = id;
      if (!state.example) state.edge = null;
      render();
    }
    function selectEdge(l) { state.edge = { s: l.s, t: l.t, pred: l.pred, src: l.src }; render(); }

    function nodeAria(n) { return SWM.fixtureText(n.label) + ', ' + (groupName[n.group] || n.group) + ', L' + n.layer + (isSilex(n) ? ', Silex-authored, illustrative' : ', public source'); }
    function tipHtml(n) {
      var kids = (children.get(n.id) || []).length;
      return '<b>' + SWM.esc(SWM.fixtureText(n.label)) + '</b><small>' + SWM.esc(groupName[n.group] || n.group) + ' · L' + n.layer + ' ' + SWM.esc(n.kind || '') + '</small>' +
        (n.def ? '<small style="margin-top:5px">' + SWM.esc(SWM.fixtureText(n.def).slice(0, 150)) + (n.def.length > 150 ? '…' : '') + '</small>' : '') +
        ((n.src || []).length ? '<span class="src">' + SWM.esc(SWM.srcLabel(n.src[0].sys)) + (n.src[0].id && n.src[0].sys !== 'silex' ? ' · ' + SWM.esc(n.src[0].id) : '') + '</span>' : '') +
        (kids ? '<small class="more">' + kids + ' child node' + (kids === 1 ? '' : 's') + '</small>' : '');
    }
    function srcProv(src) {
      if (!src) return 'No source recorded for this relationship.';
      var sys = typeof src === 'string' ? src : src.sys;
      return sys === 'silex' ? 'Silex-authored mapping · illustrative' : 'Public source: ' + SWM.srcLabel(sys);
    }

    const row = (k, v) => '<div class="row"><span>' + k + '</span>' + (v == null ? '' : '<b>' + v + '</b>') + '</div>';
    function renderInspector() {
      var box = $('swmInspector'), n = state.selected ? byId.get(state.selected) : null, html = '';
      if (state.example && !n) n = byId.get('rt-refund-agent');
      if (!n) {
        var srcRows = Object.keys(srcCounts).sort((a, b) => srcCounts[b] - srcCounts[a]).map(function (k) {
          return row(SWM.esc(SWM.srcLabel(k)), srcCounts[k]); }).join('');
        html = '<p class="swm-insp-kicker">Model inventory</p><h3>Public semantics. Enterprise context.</h3>' +
          '<p class="big">' + publicCount + ' public-source nodes</p><p class="big">' + silexCount + ' Silex-authored nodes</p>' +
          '<p class="note" style="margin-top:2px">Counts across all four tiers. They are an inventory, not evidence or confidence scores.</p>' +
          '<h4>Nodes carrying each public identifier</h4>' + srcRows +
          '<p class="note">Published IDs remain inspectable. Silex instances, mappings and coverage are illustrative, not measured outcomes.</p>' +
          '<div class="actions"><button class="swm-btn accent" data-act="example">Try the Refund workflow example →</button></div>';
      } else {
        var p = parentOf.get(n.id) ? byId.get(parentOf.get(n.id)) : null;
        var rels = (rel.get(n.id) || []);
        html = '<p class="swm-insp-kicker">Selected node</p><h3>' + SWM.esc(SWM.fixtureText(n.label)) + '</h3>' +
          '<div class="swm-srcs">' + (n.src || []).map(function (s) {
            return s.url ? '<a class="swm-src ' + SWM.esc(s.sys) + '" href="' + SWM.esc(s.url) + '" target="_blank" rel="noopener">' + SWM.esc(SWM.srcLabel(s.sys)) + (s.id ? ' · ' + SWM.esc(s.id) : '') + ' ↗</a>' : SWM.srcChip(s);
          }).join('') + '<span class="swm-src" style="background:#f2edfd;color:#3f2787;border-color:rgba(111,80,201,.3)">L' + n.layer + ' ' + SWM.esc((layerName[n.layer] || '').split(' ')[0]) + '</span></div>' +
          '<p class="def">' + SWM.esc(SWM.fixtureText(n.def || 'No published definition.')) + '</p>' +
          (/WF-021/.test(n.def || '') ? '<p class="note" style="margin-top:-6px">SWM fixture · no linked workflow page in this demo.</p>' : '') +
          '<h4>Record</h4>' + row('ID', '<span style="font:600 11px var(--swm-mono)">' + SWM.esc(n.id) + '</span>') +
          row('Group', SWM.esc(groupName[n.group] || n.group)) +
          (p ? row('Parent', SWM.esc(SWM.fixtureText(p.label))) : '') +
          row('Authored model coverage', SWM.pct(n.coverage)) +
          '<div class="swm-meter"><i style="width:' + Math.round((n.coverage || 0) * 100) + '%;background:' + SWM.coverageColor(n.coverage, 'paper') + '"></i></div>';
        if (state.edge) {
          var a = byId.get(state.edge.s), b = byId.get(state.edge.t);
          html += '<hr><p class="swm-insp-kicker">Selected relation</p><p class="big" style="color:#50339c;font-family:var(--swm-mono);font-size:13px">' + SWM.esc(state.edge.pred) + '</p>' +
            row(SWM.esc(SWM.fixtureText(a.label)) + ' → ' + SWM.esc(SWM.fixtureText(b.label))) +
            row('Provenance', SWM.esc(srcProv(state.edge.src))) +
            '<p class="note">No event timestamp or execution evidence is supplied by this relationship.</p>';
        } else if (state.example) {
          html += '<p class="note">Select a relation to inspect its direction and provenance.</p>';
        }
        if (rels.length && !state.example) {
          html += '<div class="swm-rel" style="margin-top:12px"><h6>Typed relations · ' + rels.length + '</h6>' + rels.slice(0, 12).map(function (r, i) {
            var o = byId.get(r.other);
            return '<button data-rel="' + i + '"><span><span class="pred">' + (r.dir === 'out' ? '→ ' : '← ') + SWM.esc(r.pred) + '</span>' + SWM.esc(SWM.fixtureText(o.label)) + ' <small style="color:#68707c">L' + o.layer + '</small></span>' +
              '<svg width="11" height="11" viewBox="-7 -7 14 14" aria-hidden="true"><path d="' + SWM.symbol(o.group, 46) + '" ' + SWM.glyphAttrs(o.group, paperColorOf(o)) + '/></svg></button>';
          }).join('') + (rels.length > 12 ? '<p class="swm-note">+' + (rels.length - 12) + ' more</p>' : '') + '</div>';
        }
        html += '<div class="actions">' +
          (state.example ? '<button class="swm-btn accent" data-act="reset">Reset focus / show full L4 →</button><button class="swm-btn" data-act="back">← Back to previous view</button>'
                         : '<button class="swm-btn" data-act="clear">Clear selection</button>') + '</div>';
      }
      box.innerHTML = html;
      box.querySelectorAll('[data-rel]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var r = rels[+btn.dataset.rel], o = byId.get(r.other);
          if (o.layer !== state.layer) { goToNode(o.id); return; }
          state.pinned = new Set([o.id]); state.selected = o.id; state.edge = null; render();
        });
      });
      var act = function (name, fn) { var b = box.querySelector('[data-act="' + name + '"]'); if (b) b.addEventListener('click', fn); };
      act('example', enterExample); act('reset', resetExample); act('back', backFromExample);
      act('clear', function () { state.selected = null; state.edge = null; render(); });
    }

    function renderList() {
      var body = $('swmOntListBody'), vis = current.nodes || [];
      $('swmOntListSum').textContent = 'Accessible list · ' + (state.example ? '9 focused nodes and 8 relations' : vis.length + ' node' + (vis.length === 1 ? '' : 's') + ' shown');
      var html = vis.map(function (n) {
        return '<button data-id="' + SWM.esc(n.id) + '"><span>' + SWM.esc(SWM.fixtureText(n.label)) + '</span><small>' + SWM.esc(groupName[n.group] || n.group) + ' · L' + n.layer + '</small></button>';
      }).join('');
      if (state.example) html += (current.links || []).map(function (l, i) {
        return '<button data-edge="' + i + '"><span>' + SWM.esc(byId.get(l.s).label) + ' → ' + SWM.esc(byId.get(l.t).label) + '</span><small>' + SWM.esc(l.pred) + '</small></button>';
      }).join('');
      body.innerHTML = html || '<p class="swm-note">Nothing in scope.</p>';
      body.querySelectorAll('[data-id]').forEach(function (b) { b.addEventListener('click', function () { if (state.example) state.edge = null; select(b.dataset.id); }); });
      body.querySelectorAll('[data-edge]').forEach(function (b) { b.addEventListener('click', () => selectEdge(current.links[+b.dataset.edge])); });
    }

    function snapshot() { return { layer: state.layer, view: state.view, colorBy: state.colorBy, query: state.query,
      groups: new Set(state.groups), pinned: new Set(state.pinned), selected: state.selected, edge: state.edge }; }
    function enterExample() {
      if (!exampleData()) { state.example = false; render(); showEmpty(EX_MISSING[0], EX_MISSING[1]); return; }
      if (!state.example && !state.saved) state.saved = snapshot();
      state.example = true; state.animate = true; state.query = ''; $('swmQuery').value = ''; $('swmResults').hidden = true;
      state.groups = new Set(groupOrder); syncGroupChips(); state.view = 'graph'; syncViewButtons();
      state.selected = 'rt-refund-agent'; state.edge = null;
      if (state.layer !== 4) { entering = true; state.layer = 4; SWM.setLevel(4, 'example'); entering = false; }
      render();
    }
    function exitExample(quiet) { if (!state.example) return; state.example = false; state.edge = null; if (!quiet) render(); }
    /* Reset keeps state.saved so Back still works */
    function resetExample() { state.example = false; state.selected = null; state.edge = null; state.pinned = new Set(); render(); }
    function backFromExample() {
      var s = state.saved; state.example = false;
      if (!s) { render(); return; }
      state.view = s.view; state.colorBy = s.colorBy; state.query = s.query; $('swmQuery').value = s.query;
      state.groups = s.groups; state.pinned = s.pinned; state.selected = s.selected; state.edge = s.edge;
      syncGroupChips(); syncViewButtons(); syncColorButtons();
      if (s.layer !== state.layer) { entering = true; state.layer = s.layer; SWM.setLevel(s.layer, 'back'); entering = false; }
      state.saved = null;
      render();
    }

    function press(sel, isOn, cls) { document.querySelectorAll(sel).forEach(function (b) { var on = isOn(b); b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.classList.toggle(cls || 'active', cls ? !on : on); }); }
    function syncGroupChips() { press('#swmGroups .swm-chip', (b) => state.groups.has(b.dataset.g), 'off'); }
    function syncViewButtons() { press('#swmViews button', (b) => b.dataset.v === state.view); }
    function syncColorButtons() { press('#swmColorBy button', (b) => b.dataset.c === state.colorBy); }
    function setView(v) { state.view = v; syncViewButtons(); }

    /* any tier change exits the example and clears stale state */
    SWM.onLevel(function (l) {
      if (entering) return;
      state.layer = l; state.example = false; state.selected = null; state.edge = null; state.pinned = new Set(); state.saved = null;
      render();
    });
    $('swmLevels').addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      var l = +b.dataset.level;
      if (l === state.layer && !state.example) return;
      if (l === SWM.level) { state.example = false; state.selected = null; state.edge = null; state.pinned = new Set(); render(); }
      else SWM.setLevel(l, 'explorer');
    });
    $('swmViews').addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      exitExample(true); setView(b.dataset.v); render();
    });
    $('swmZoom').addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      var t = SWM.dur(200);
      if (b.dataset.z === 'fit') svg.transition().duration(t).call(zoom.transform, d3.zoomIdentity);
      else svg.transition().duration(t).call(zoom.scaleBy, b.dataset.z === 'in' ? 1.35 : 1 / 1.35);
    });
    $('swmColorBy').addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      state.colorBy = b.dataset.c; syncColorButtons(); render();
    });
    $('swmGroups').addEventListener('click', function (ev) {
      var b = ev.target.closest('.swm-chip'); if (!b) return;
      var g = b.dataset.g;
      if (state.groups.has(g) && state.groups.size > 1) state.groups.delete(g); else state.groups.add(g);
      syncGroupChips(); exitExample(true); state.selected = null; state.edge = null; render();
    });
    $('swmExampleBtn').addEventListener('click', enterExample);
    $('swmBackBtn').addEventListener('click', backFromExample);
    var qt;
    $('swmQuery').addEventListener('input', function () {
      var v = this.value; clearTimeout(qt);
      qt = setTimeout(function () {
        state.query = v; hitIdx = -1;
        if (state.example && v.trim()) exitExample(true);
        renderResults();
        if (!state.example) render();
      }, 180);
    });
    $('swmQuery').addEventListener('keydown', function (ev) {
      if ($('swmResults').hidden) return;
      if (ev.key === 'ArrowDown') { ev.preventDefault(); hitIdx = Math.min(hits.length - 1, hitIdx + 1); renderResults(); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); hitIdx = Math.max(-1, hitIdx - 1); renderResults(); }
      else if (ev.key === 'Enter' && hits.length) { ev.preventDefault(); goToNode(hits[Math.max(0, hitIdx)]); }
      else if (ev.key === 'Escape') { $('swmResults').hidden = true; this.setAttribute('aria-expanded', 'false'); }
    });
    $('swmResults').addEventListener('click', function (ev) { var b = ev.target.closest('[data-id]'); if (b) goToNode(b.dataset.id); });
    document.addEventListener('click', function (ev) { if (!ev.target.closest('.swm-searchbox')) $('swmResults').hidden = true; if (!ev.target.closest('#swmFilters')) $('swmFilters').open = false; });
    svg.on('click', function () {
      if (state.example) { if (state.edge) { state.edge = null; render(); } return; }
      if (state.selected) { state.selected = null; state.edge = null; render(); }
    });

    /* hidden: stop transitions; on return re-render if stale or resized */
    SWM.onPanel(function (id) {
      if (id !== 'wm-ontology') {
        if (!svg.selectAll('*').filter(function () { return d3.active(this); }).empty()) state.stale = true;
        svg.interrupt().selectAll('*').interrupt(); state.animate = false; SWM.tip.hide(); return;
      }
      var d = dims(); if (state.stale || lastDims !== d.w + 'x' + d.h) { state.stale = false; render(); }
    });
    SWM.onResize(function () { if (SWM.isShown(stage)) render(); });

    syncViewButtons(); syncColorButtons(); syncGroupChips();
    render();
    mount._swmState = state;   /* for probes only */
  }

  SWM.register('wm-ontology', init);
})(window);
