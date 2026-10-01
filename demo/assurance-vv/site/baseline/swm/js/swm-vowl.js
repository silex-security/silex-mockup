/* Network view engine (plan v0.2 §3–4, logs/swm-vowl-2026-09-21/CONTRACT.md).
   Notation adapted from VOWL; interaction inspired by WebVOWL (MIT). A separate D3 v7 implementation. */
window.SWM_VOWL = function (SWM, d3) {
  'use strict';
  var SUB = { SUBCLASS_OF: 1, SPECIALIZES: 1 }, REVEAL = .12, WATCHDOG = 6000;
  var ev = {}, gen = 0, phase = null, prev = null, ctx = null, sim = null, timers = [], wd = null, cache = new Map();
  var nodes = [], props = [], links = [], selN, selL, selP, gFocus, root, paused = false, hidden = false, dragging = false, k = 1, pending = null;
  var api = { _ticks: 0 };

  function emit(e) { var a = [].slice.call(arguments, 1); (ev[e] || []).forEach((f) => f.apply(null, a)); }
  function later(fn, ms) { var g = gen; timers.push(setTimeout(function () { if (g === gen) fn(); }, ms)); }
  function setPhase(p) { phase = p; emit('phase', p); }
  var rm = () => SWM.reducedMotion();
  var isSilex = (n) => (n.src || []).every((s) => s.sys === 'silex');
  var same = (l, e) => e && l.s === e.s && l.t === e.t && l.pred === e.pred;
  var predText = (p) => p === 'SUBCLASS_OF' ? 'subclass of' : p.toLowerCase().replace(/_/g, ' ');

  function filter(ns, ls, net) {
    var ids = new Set(ns.map((n) => n.id)), deg = new Map(ns.map((n) => [n.id, 0]));
    var l1 = ls.filter((l) => ids.has(l.s) && ids.has(l.t) && (net.subclass || !SUB[l.pred]));
    l1.forEach(function (l) { deg.set(l.s, deg.get(l.s) + 1); deg.set(l.t, deg.get(l.t) + 1); });
    var keep = ns.filter((n) => deg.get(n.id) >= (net.minDegree || 0)), kid = new Set(keep.map((n) => n.id));
    return { nodes: keep, links: l1.filter((l) => kid.has(l.s) && kid.has(l.t)), deg: deg };
  }

  function defs(svg) {
    var d = svg.select('defs');
    [['vwArrow', 1, '#9aa4e8'], ['vwArrowHi', 1, '#e2d8ff'], ['vwTri', 0, '#9aa4e8'], ['vwTriHi', 0, '#e2d8ff']].forEach(function (m) {
      if (!d.select('#' + m[0]).empty()) return;
      d.append('marker').attr('id', m[0]).attr('viewBox', '0 -5 10 10').attr('refX', 10).attr('markerWidth', m[1] ? 7 : 9)
        .attr('markerHeight', m[1] ? 7 : 9).attr('orient', 'auto').append('path').attr('d', 'M0,-4.5L10,0L0,4.5Z')
        .attr('fill', m[1] ? m[2] : '#1b2247').attr('stroke', m[1] ? 'none' : m[2]).attr('stroke-width', 1.2);
    });
  }
  function lines(t, r) {
    var m = Math.max(4, Math.floor(r * 1.9 / 4.4)), out = [], cur = '';
    t.split(/\s+/).forEach(function (w) { if (!cur) cur = w; else if ((cur + ' ' + w).length <= m) cur += ' ' + w; else { out.push(cur); cur = w; } });
    if (cur) out.push(cur);
    if (out.length > 2) { out = out.slice(0, 2); out[1] += '…'; }
    return out.map((s) => s.length > m ? s.slice(0, m - 1) + '…' : s);
  }

  function teardown() {
    gen++; timers.forEach(clearTimeout); timers = []; clearTimeout(wd); dragging = false; pending = null;
    if (sim) sim.stop().on('tick', null).on('end', null);
    if (ctx) ctx.svg.interrupt();
    if (root) root.selectAll('.vw-halo').remove();
  }
  function save() {
    if (!ctx) return;
    cache.set(ctx.scopeKey, { n: new Map(nodes.map((d) => [d.id, [d.x, d.y]])), p: props.map((p) => [p.x, p.y]) });
  }

  function render(c) {
    teardown(); ctx = c; root = c.layer; paused = false; hidden = false; emit('pause', false);
    root.selectAll('*').remove(); defs(c.svg);
    var byId = new Map(), W = c.dims.w, H = c.dims.h, rnd = d3.randomLcg(1729), hit = cache.get(c.scopeKey);
    nodes = c.nodes.map(function (n) {
      var o = { id: n.id, n: n, r: n.anchor ? 30 : Math.min(26, 10 + 4 * Math.sqrt(c.deg.get(n.id) || 0)) }, s = hit && hit.n.get(n.id);
      o.x = s ? s[0] : W / 2 + (rnd() - .5) * 400; o.y = s ? s[1] : H / 2 + (rnd() - .5) * 300;
      if (c.net.pins.has(n.id)) { o.fx = o.x; o.fy = o.y; }
      byId.set(n.id, o); return o;
    });
    links = c.links.map((l) => ({ raw: l, source: byId.get(l.s), target: byId.get(l.t), sub: !!SUB[l.pred] }));
    var compact = c.net.compact[c.tier], parts;
    props = compact ? [] : links.map(function (l, i) {
      var t = predText(l.raw.pred), s = hit && hit.p[i];
      return (l.p = { prop: 1, l: l, t: t, w: Math.min(110, t.length * 5.2 + 12),
        x: s ? s[0] : (l.source.x + l.target.x) / 2 + rnd() - .5, y: s ? s[1] : (l.source.y + l.target.y) / 2 + rnd() - .5 });
    });
    parts = compact ? links.map((l) => ({ source: l.source, target: l.target, d: 90 + l.source.r }))
      : [].concat.apply([], links.map((l) => [{ source: l.source, target: l.p, d: 55 + l.source.r }, { source: l.p, target: l.target, d: 55 + l.target.r }]));
    sim = d3.forceSimulation(nodes.concat(props)).randomSource(d3.randomLcg(7)).alphaMin(.001).stop()
      .force('link', d3.forceLink(parts).distance((p) => p.d).strength(.9))
      .force('charge', d3.forceManyBody().strength((n) => n.prop ? -120 : -420).theta(.9).distanceMax(420))
      .force('x', d3.forceX(W / 2).strength(.025)).force('y', d3.forceY(H / 2).strength(.035))
      .force('collide', d3.forceCollide((n) => n.prop ? n.w / 2 : n.r + 3).iterations(1))
      .on('tick', function () { api._ticks++; pos(); }).on('end', rest);
    draw();
    if (hit) { sim.alpha(0); return done(true); }
    /* rendered while the panel is hidden (e.g. a tier change from Layers): lay out on show() */
    if (!SWM.isShown(c.svg.node())) { prev = 'prelayout'; hidden = true; return setPhase('hidden'); }
    if (rm()) { toRest(); return done(true); }
    prelayout();
  }
  function done(settled) {
    pos(); fit(0); root.classed('vw-hidden', false); ready();
    if (settled) rest();
  }
  function prelayout() {
    setPhase('prelayout'); root.classed('vw-hidden', true);
    var total = Math.log(REVEAL), text = 'Laying out ' + nodes.length + (ctx.tier === 4 ? ' illustrative runtime instances' : ' nodes') + ' · ' + links.length + ' relations …';
    (function chunk() {
      var t = performance.now();
      while (sim.alpha() > REVEAL && performance.now() - t < 12) sim.tick();
      emit('progress', Math.round(100 * Math.min(1, Math.log(sim.alpha()) / total)), text);
      if (sim.alpha() > REVEAL) return later(chunk, 0);
      setPhase('settling'); done(false); sim.restart(); arm();   /* phase first, so ready() can flush a deferred locate */
    })();
  }
  function toRest() { sim.stop().alphaTarget(0); for (var i = 0; i < 1500 && sim.alpha() >= sim.alphaMin(); i++) sim.tick(); pos(); }
  /* watchdog: only for a visible, running, current layout (plan §4) */
  function arm() {
    clearTimeout(wd); var g = gen;
    wd = setTimeout(function () { if (g === gen && phase === 'settling' && !paused && !hidden && !dragging) { toRest(); rest(); } }, WATCHDOG);
  }
  function rest() { clearTimeout(wd); if (sim) sim.stop(); setPhase(paused ? 'paused' : 'rest'); save(); emit('rest'); }
  function ready() {
    emit('ready', stats());
    if (pending) { var id = pending; pending = null; locate(id); }
  }

  function draw() {
    var c = ctx;
    selL = root.append('g').attr('class', 'vw-links').selectAll('path').data(links).join('path')
      .attr('class', (l) => 'vw-link' + (l.sub ? ' sub' : ''));
    selP = root.append('g').attr('class', 'vw-props').selectAll('g').data(props).join('g').attr('class', 'vw-prop')
      .on('click', function (e, p) { e.stopPropagation(); c.onSelectEdge(p.l.raw); });
    prop(selP);
    selP.append('title').text((p) => c.byId.get(p.l.raw.s).label + ' ' + p.t + ' ' + c.byId.get(p.l.raw.t).label);
    gFocus = root.append('g').attr('class', 'vw-props');
    selN = root.append('g').attr('class', 'vw-nodes').selectAll('g').data(nodes).join('g')
      .attr('class', (d) => 'vw-node' + (d.n.anchor ? ' anchor' : ''))
      .attr('tabindex', (d) => d.n.anchor || nodes.length <= 60 ? 0 : null).attr('role', 'button').attr('aria-label', (d) => c.aria(d.n))
      .on('click', function (e, d) { e.stopPropagation(); c.onSelectNode(d.id); })
      .on('keydown', function (e, d) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); c.onSelectNode(d.id); } })
      .on('mouseenter focus', function (e, d) { styles(d.id); SWM.tip.show(c.tipHtml(d.n), e); })
      .on('mousemove', (e) => SWM.tip.move(e)).on('mouseleave blur', function () { styles(); SWM.tip.hide(); })
      .call(d3.drag().on('start', dragStart).on('drag', dragMove).on('end', dragEnd));
    selN.append('circle').attr('class', 'vw-body').attr('r', (d) => d.r);
    selN.append('path').attr('class', 'glyph').attr('d', (d) => SWM.symbol(d.n.group, d.r > 16 ? 44 : 26))
      .attr('transform', (d) => 'translate(0,' + (-d.r * .45).toFixed(1) + ')');
    selN.append('text').attr('class', 'vw-lab').attr('text-anchor', 'middle').attr('font-size', (d) => d.n.anchor ? 10 : 8)
      .each(function (d) {
        var ls = lines(SWM.fixtureText(d.n.label), d.r), t = d3.select(this);
        ls.forEach((s, i) => t.append('tspan').attr('x', 0).attr('y', (d.r * .12 + 3 + (i - (ls.length - 1) / 2) * 9).toFixed(1)).text(s));
      });
    recolor(); pins(); styles(); labels();
  }
  function prop(sel) {
    sel.append('rect').attr('x', (p) => -p.w / 2).attr('y', -6).attr('width', (p) => p.w).attr('height', 12).attr('rx', 2);
    sel.append('text').attr('text-anchor', 'middle').attr('y', 3).attr('font-size', 8).text((p) => p.t);
  }
  function recolor() {
    selN.each(function (d) {
      var f = d.fill = ctx.colorOf(d.n), g = d3.select(this);
      g.select('circle').attr('fill', f); g.select('text').attr('fill', SWM.textOn(f));
    });
    selN.select('path.glyph').call(SWM.paintGlyph, (d) => d.n.group, (d) => SWM.textOn(d.fill), 1.2);
  }
  function labels() { if (selN) selN.select('text.vw-lab').attr('display', (d) => d.r * k >= 12 ? null : 'none'); }
  function pins() {
    selN.classed('pinned', (d) => ctx.net.pins.has(d.id)).selectAll('.vw-pin').remove();
    selN.filter((d) => ctx.net.pins.has(d.id)).append('g').attr('class', 'vw-pin')
      .attr('transform', (d) => 'translate(' + (d.r * .72).toFixed(1) + ',' + (-d.r * .72).toFixed(1) + ')')
      .attr('role', 'button').attr('aria-label', 'Unpin').on('click', unpin)
      .call((g) => { g.append('circle').attr('r', 5); g.append('path').attr('d', 'M0,-2.5V2.5M-2.5,0H2.5'); })
      .append('title').text('Pinned · click to release');
  }
  function unpin(e, d) {
    e.stopPropagation(); ctx.net.pins.delete(d.id); d.fx = d.fy = null; pins();
    if (!paused && !rm() && phase !== 'prelayout') { sim.alpha(Math.max(sim.alpha(), .1)).restart(); setPhase('settling'); arm(); }
    ctx.onPinsChanged(); emit('pin', stats());
  }

  function dragStart(e, d) {
    SWM.tip.hide(); dragging = true; d.fx = d.x; d.fy = d.y;
    if (!e.active && !paused && !rm() && phase !== 'prelayout') { sim.alphaTarget(.3).restart(); setPhase('settling'); }
  }
  function dragMove(e, d) {
    d.fx = e.x; d.fy = e.y;
    if (paused || rm()) { d.x = e.x; d.y = e.y; pos(); }
  }
  function dragEnd(e, d) {
    dragging = false;
    if (!e.active && phase === 'settling') { sim.alphaTarget(0); arm(); }
    if (ctx.net.pickPin) ctx.net.pins.add(d.id); else d.fx = d.fy = null;
    pins(); ctx.onPinsChanged(); emit('pin', stats());
  }

  function pos() {
    if (!selN) return;
    selL.attr('d', function (l) {
      var a = l.source, b = l.target, p = l.p, cx = p ? 2 * p.x - (a.x + b.x) / 2 : a.x, cy = p ? 2 * p.y - (a.y + b.y) / 2 : a.y;
      var dx = b.x - cx, dy = b.y - cy, dd = Math.sqrt(dx * dx + dy * dy) || 1, tx = b.x - dx / dd * (b.r + 1), ty = b.y - dy / dd * (b.r + 1);
      return 'M' + a.x.toFixed(1) + ',' + a.y.toFixed(1) + (p ? 'Q' + cx.toFixed(1) + ',' + cy.toFixed(1) + ' ' : 'L') + tx.toFixed(1) + ',' + ty.toFixed(1);
    });
    selP.attr('transform', (p) => 'translate(' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ')');
    gFocus.selectAll('g').attr('transform', (l) => 'translate(' + ((l.source.x + l.target.x) / 2).toFixed(1) + ',' + ((l.source.y + l.target.y) / 2).toFixed(1) + ')');
    selN.attr('transform', (d) => 'translate(' + d.x.toFixed(1) + ',' + d.y.toFixed(1) + ')');
  }

  /* hover > selection > edge > search; restyle only */
  function styles(hov) {
    if (!selN) return;
    var f = hov || ctx.selected, e = ctx.edge, nb = new Set(), q = (ctx.query || '').trim().length > 1 && ctx.matches;
    var inc = (l) => f && (l.raw.s === f || l.raw.t === f), on = (l) => inc(l) || same(l.raw, e), any = f || e;
    links.forEach(function (l) { if (on(l)) { nb.add(l.raw.s); nb.add(l.raw.t); } });
    if (f) nb.add(f);
    selN.classed('sel', (d) => d.id === ctx.selected).classed('hl', (d) => any && nb.has(d.id) && d.id !== ctx.selected)
      .classed('match', (d) => q && q.has(d.id)).classed('dim', (d) => any ? !nb.has(d.id) : !!q && !q.has(d.id));
    selL.classed('hl', inc).classed('sel', (l) => same(l.raw, e)).classed('dim', (l) => any ? !on(l) : !!q)
      .attr('marker-end', (l) => 'url(#vw' + (l.sub ? 'Tri' : 'Arrow') + (on(l) ? 'Hi' : '') + ')');
    selP.classed('hl', (p) => inc(p.l)).classed('sel', (p) => same(p.l.raw, e)).classed('dim', (p) => any ? !on(p.l) : !!q);
    /* compact notation: predicates appear only for the focused relations */
    var fl = gFocus.selectAll('g').data(props.length ? [] : links.filter(on)).join((en) => {
      var g = en.append('g').attr('class', 'vw-prop hl').each(function (l) { l.t = predText(l.raw.pred); l.w = Math.min(110, l.t.length * 5.2 + 12); });
      prop(g); return g;
    });
    fl.classed('sel', (l) => same(l.raw, e));
    pos();
  }

  function fit(ms) {
    if (!ctx || !nodes.length) return;
    var all = nodes.concat(props), W = ctx.dims.w, H = ctx.dims.h;
    var x0 = d3.min(all, (n) => n.x - (n.r || 40)), x1 = d3.max(all, (n) => n.x + (n.r || 40));
    var y0 = d3.min(all, (n) => n.y - (n.r || 8)), y1 = d3.max(all, (n) => n.y + (n.r || 8));
    var s = Math.max(.2, Math.min(2, .94 * Math.min(W / (x1 - x0), (H - 70) / (y1 - y0))));
    var t = d3.zoomIdentity.translate(W / 2, (H + 30) / 2).scale(s).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    ms = SWM.dur(ms || 0);
    if (ms) ctx.svg.transition().duration(ms).call(ctx.zoom.transform, t); else ctx.svg.call(ctx.zoom.transform, t);
  }
  function locate(id) {
    if (!ctx) return;
    if (phase === 'prelayout') { pending = id; return; }
    var d = nodes.find((n) => n.id === id); if (!d) return;
    var s = Math.max(k, 1.4), W = ctx.dims.w, H = ctx.dims.h, t = d3.zoomIdentity.translate(W / 2, H / 2).scale(s).translate(-d.x, -d.y), ms = SWM.dur(650);
    if (ms) ctx.svg.transition().duration(ms).call(ctx.zoom.transform, t); else ctx.svg.call(ctx.zoom.transform, t);
    if (rm()) return;
    root.selectAll('.vw-halo').remove();
    selN.filter((n) => n.id === id).insert('circle', ':first-child').attr('class', 'vw-halo').attr('r', d.r + 6);
    later(() => root.selectAll('.vw-halo').remove(), 2400);
  }

  function stats() {
    var by = {}, pub = 0;
    links.forEach((l) => (by[l.raw.pred] = (by[l.raw.pred] || 0) + 1));
    nodes.forEach((d) => { if (!isSilex(d.n)) pub++; });
    return { tier: ctx ? ctx.tier : null, nodes: nodes.length, tierNodes: ctx ? ctx.tierNodes : 0, relations: links.length, byPred: by,
      publicNodes: pub, silexNodes: nodes.length - pub, pinned: ctx ? nodes.filter((d) => ctx.net.pins.has(d.id)).length : 0 };
  }

  Object.assign(api, {
    filter: filter, render: render, stats: stats, fit: fit, locate: locate,
    key: () => ctx ? ctx.scopeKey : null,
    scope: () => ctx ? { nodes: ctx.nodes, links: ctx.links } : null,
    phase: () => phase,
    on: function (e, f) { (ev[e] = ev[e] || []).push(f); },
    update: function (s) { if (!ctx) return; Object.assign(ctx, s); recolor(); styles(); },
    zoom: function (s) { if (ctx) ctx.svg.transition().duration(SWM.dur(150)).call(ctx.zoom.scaleTo, s); },
    zoomed: function (s) { k = s; labels(); emit('zoom', s); },
    resize: function (dm) { if (ctx) { ctx.dims = dm; fit(0); } },
    pause: function (b) {
      if (!ctx || phase === 'prelayout' || hidden || b === paused) return;
      paused = b;
      if (b) { clearTimeout(wd); sim.stop(); setPhase('paused'); }
      else { sim.alpha(.3).restart(); setPhase('settling'); arm(); }
      emit('pause', b);
    },
    reset: function () {
      if (!ctx) return;
      ctx.net.pins.clear(); cache.delete(ctx.scopeKey); render(ctx); ctx.onPinsChanged(); emit('pin', stats());
    },
    hide: function () {
      if (!ctx || hidden) return;
      prev = phase; teardown(); hidden = true; setPhase('hidden');
    },
    show: function () {
      if (!hidden) return;
      hidden = false; if (!ctx) return;
      if (prev === 'prelayout' || prev === 'settling') { toRest(); if (prev === 'prelayout') done(true); else rest(); }
      else setPhase(prev);
    },
    destroy: function () { teardown(); if (root) root.selectAll('*').remove(); ctx = null; selN = null; hidden = false; paused = false; setPhase(null); }
  });
  return api;
};
