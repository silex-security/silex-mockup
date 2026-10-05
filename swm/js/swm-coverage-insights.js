/* SILEX Enterprise World Model — coverage "why is coverage low" insights.
   Deterministic, derived only from the coverage bundle (swm/data/coverage.js);
   no DOM access at load time, no imports, ES5 IIFE on window.SWM (loaded
   between swm-core.js and swm-coverage.js). See plan
   logs/2026-10-04_WM_COVERAGE_PALETTE_INSIGHTS_PLAN.md §B + T1 contract. */
(function (global) {
  'use strict';
  var SWM = global.SWM;
  if (!SWM) return;

  var HEALTHY = 'good';                 /* SWM.coverageStatus(...) === 'good' (≥ 88 %) */
  var THRESHOLD = 0.88;                 /* drivers measure shortfall to the healthy floor */

  /* severity order for gap sorting: critical < serious < warning < good */
  var SEV = { critical: 0, serious: 1, warning: 2, good: 3 };

  /* dimension → suggested step, one line per dim (plan §B.5) */
  var PLAYBOOK = {
    identity: 'Bind agent identities and delegated authority to the identity provider',
    agent: 'Inventory the agents and tools these workflows call',
    workflow: 'Register the missing workflow branches and trace them end to end',
    policy: 'Map controls and approval rules onto the workflow steps',
    resource: 'Connect the system of record so data access is observed at the source',
    outcome: 'Define the intended and prohibited business outcomes'
  };

  function pct(v) {
    if (SWM && typeof SWM.pct === 'function') return SWM.pct(v);
    return v == null ? '—' : Math.round(v * 100) + '%';
  }
  function esc(s) { return SWM.esc(s); }
  /* bundle text that may name a fixture ID colliding with a site ID gets the "(SWM fixture)" suffix */
  function fixtureTitle(s) {
    if (SWM && typeof SWM.fixtureText === 'function') return SWM.esc(SWM.fixtureText(s));
    return SWM.esc(s);
  }

  /* a node name: suffixed by id when the id is a fixture that collides with a site id (as dispName in
     swm-coverage.js); fixtureText on the full name would repeat the name */
  function nodeName(name, id) {
    var n = String(name == null ? id : name);
    if (SWM && typeof SWM.fixtureText === 'function' && id != null && SWM.fixtureText(id) !== String(id) &&
        !/\(SWM fixture\)/.test(n)) n += ' (SWM fixture)';
    return SWM.esc(n);
  }

  /* the authored bundle action, verbatim */
  function gapPlanLabel(gp) {
    if (gp.action && gp.action.label) return gp.action.label;
    return null;
  }

  /* node: a d3 hierarchy node (node.data, node.parent, node.children).
     ctx: { dimensions: [{id,name}], gaps: [{id,title,severity,scope,action}] }. */
  function coverageInsights(node, ctx) {
    var data = (node && node.data) ? node.data : {};
    var coverage = data.coverage;
    var status = SWM.coverageStatus(coverage);
    var dimensions = (ctx && ctx.dimensions) || [];
    var allGaps = (ctx && ctx.gaps) || [];

    /* weakest dimensions: the two lowest of the six dims (a missing dim is skipped, never read as 0 %) */
    var dims = data.dims;
    var weakDims = [];
    if (dims && typeof dims === 'object') {
      var ranked = [];
      for (var i = 0; i < dimensions.length; i++) {
        var d = dimensions[i];
        if (dims[d.id] != null && !isNaN(dims[d.id])) ranked.push({ id: d.id, name: d.name, value: +dims[d.id] });
      }
      ranked.sort(function (a, b) { return a.value - b.value; });
      weakDims = ranked.slice(0, 2);
    }

    /* delta in signed integer points vs parent's same dim (root: vs own mean) */
    var parent = node.parent;
    var parentDims = (parent && parent.data) ? parent.data.dims : null;
    var rootMean = null;
    if (!parent && dims && typeof dims === 'object') {
      var sum = 0, n = 0;
      for (var k in dims) {
        if (Object.prototype.hasOwnProperty.call(dims, k) && dims[k] != null) { sum += dims[k]; n++; }
      }
      rootMean = n ? sum / n : null;
    }
    for (var w = 0; w < weakDims.length; w++) {
      var wd = weakDims[w];
      var vs, vsName;
      if (!parent) {
        vs = rootMean;
        vsName = 'enterprise mean';
      } else {
        vs = (parentDims && parentDims[wd.id] != null) ? parentDims[wd.id] : null;   /* no comparison, no delta */
        vsName = (parent.data && parent.data.name != null) ? parent.data.name : '';
      }
      wd.delta = vs == null ? null : Math.round((wd.value - vs) * 100);
      wd.vsName = vsName;
    }

    /* headline */
    var headline;
    if (!weakDims.length) {
      headline = 'Coverage ' + pct(coverage);
    } else if (status === HEALTHY) {
      headline = 'Healthy — weakest dimension is ' + weakDims[0].name + ' (' + pct(weakDims[0].value) + ')';
    } else {
      headline = 'Why ' + pct(coverage) + ': lowest in ' + weakDims[0].name + ' (' + pct(weakDims[0].value) + ')';
    }

    /* drivers: direct children only, entity-weighted shortfall to the floor, positive only, max 2 */
    var drivers = [];
    var children = node.children;
    var nEnt = data.entities;
    if (children && children.length) {
      var scored = [];
      for (var c = 0; c < children.length; c++) {
        var child = children[c];
        var cd = (child && child.data) ? child.data : {};
        if (cd.coverage == null || isNaN(cd.coverage)) continue;
        var shortfall = THRESHOLD - cd.coverage;
        if (shortfall <= 0) continue;
        scored.push({ node: child, score: shortfall * (cd.entities || 0) / (nEnt || 1) });
      }
      scored.sort(function (a, b) { return b.score - a.score; });
      drivers = scored.slice(0, 2).map(function (s) {
        var cd = s.node.data;
        return { id: cd.id, name: cd.name, coverage: cd.coverage, entities: cd.entities };
      });
    }

    /* recorded gaps: in scope, severity then id, max 2 + rest count */
    var inScope = [];
    for (var g = 0; g < allGaps.length; g++) {
      var gp = allGaps[g];
      if (gp && gp.scope && gp.scope.indexOf(data.id) >= 0) inScope.push(gp);
    }
    inScope.sort(function (a, b) {
      var sa = SEV[a.severity] != null ? SEV[a.severity] : 3;
      var sb = SEV[b.severity] != null ? SEV[b.severity] : 3;
      return (sa - sb) || (a.id < b.id ? -1 : (a.id > b.id ? 1 : 0));
    });
    var gaps = inScope.slice(0, 2).map(function (gp) {
      return { id: gp.id, title: gp.title, severity: gp.severity };
    });
    var moreGaps = Math.max(0, inScope.length - 2);

    /* plan: gap action labels first (sorted order), then playbook for weak dims; dedupe; max 3 */
    var plan = [];
    for (var p1 = 0; p1 < inScope.length; p1++) {
      var label = gapPlanLabel(inScope[p1]);
      if (label) plan.push(label);
    }
    for (var p2 = 0; p2 < weakDims.length; p2++) {
      var play = PLAYBOOK[weakDims[p2].id];
      if (play) plan.push(play);
    }
    var seen = {};
    var deduped = [];
    for (var p3 = 0; p3 < plan.length; p3++) {
      if (!seen[plan[p3]]) { seen[plan[p3]] = true; deduped.push(plan[p3]); }
    }
    plan = deduped.slice(0, 3);

    return {
      status: status,
      headline: headline,
      weakDims: weakDims,
      drivers: drivers,
      gaps: gaps,
      moreGaps: moreGaps,
      plan: plan
    };
  }

  /* ins: the result of coverageInsights(); opts: { compact: bool }.
     Compact = same content, tighter styling hook; nothing is omitted. */
  function coverageInsightHtml(ins, opts) {
    opts = opts || {};
    ins = ins || {};
    var out = [];
    var i;

    function sec(t) { return '<small class="swm-ins-sec">' + t + '</small>'; }

    out.push('<span class="swm-ins' + (opts.compact ? ' swm-ins-compact' : '') + '">');

    out.push('<b class="swm-ins-headline">' + esc(ins.headline) + '</b>');
    if (ins.status) out.push('<small class="swm-ins-status">' + SWM.statusHtml(ins.status) + '</small>');

    if (ins.weakDims && ins.weakDims.length) {
      out.push(sec('Weakest dimensions'));
      for (i = 0; i < ins.weakDims.length; i++) {
        var w = ins.weakDims[i];
        var delta = w.delta == null ? '' : '<span class="swm-ins-delta">' + (w.delta > 0 ? '+' + w.delta : String(w.delta)) +
          ' pts vs ' + esc(w.vsName) + '</span>';   /* a parent: never a fixture leaf */
        out.push('<small class="swm-ins-row"><span class="swm-ins-dim">' + esc(w.name) + '</span> ' +
          '<span class="swm-ins-val">' + pct(w.value) + '</span> ' + delta + '</small>');
      }
    }

    if (ins.drivers && ins.drivers.length) {
      out.push(sec('What pulls it down'));
      for (i = 0; i < ins.drivers.length; i++) {
        var dr = ins.drivers[i];
        out.push('<small class="swm-ins-row">' + nodeName(dr.name, dr.id) + ' ' + pct(dr.coverage) + ' · ' +
          esc(SWM.num ? SWM.num(dr.entities) : dr.entities) + ' entities</small>');
      }
    }

    if (ins.gaps && ins.gaps.length) {
      out.push(sec('Recorded gaps'));
      for (i = 0; i < ins.gaps.length; i++) {
        var gap = ins.gaps[i];
        out.push('<small class="swm-ins-row">' + SWM.statusHtml(gap.severity) + ' ' + fixtureTitle(gap.title) + '</small>');
      }
      if (ins.moreGaps > 0) {
        out.push('<small class="swm-ins-more">+' + ins.moreGaps + ' more in the gap list</small>');
      }
    }

    if (ins.plan && ins.plan.length) {
      out.push(sec('Suggested plan'));
      out.push('<ol class="swm-ins-plan">');
      for (i = 0; i < ins.plan.length; i++) {
        out.push('<li>' + fixtureTitle(ins.plan[i]) + '</li>');
      }
      out.push('</ol>');
    }

    out.push('<small class="swm-ins-footer">Derived from authored demo figures · suggested steps are illustrative</small>');

    out.push('</span>');
    return out.join('');
  }

  SWM.coverageInsights = coverageInsights;
  SWM.coverageInsightHtml = coverageInsightHtml;
})(window);
