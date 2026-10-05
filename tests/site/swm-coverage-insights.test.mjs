// T1 of logs/2026-10-04_WM_COVERAGE_PALETTE_INSIGHTS_PLAN.md: the coverage-insight rules.
// Loads the generated bundle and the ES5 IIFE in a node:vm context with a minimal SWM stub
// (no d3, no DOM) so the rules are exercised against real authored data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createContext, runInContext } from 'node:vm';
import { readFileSync } from 'node:fs';

const COV_SRC = readFileSync(new URL('../../swm/data/coverage.js', import.meta.url), 'utf8');
const INS_SRC = readFileSync(new URL('../../swm/js/swm-coverage-insights.js', import.meta.url), 'utf8');

/* minimal SWM stub: the symbols swm-coverage-insights.js reads, with swm-core.js semantics. */
const STATUS = {
  critical: { color: '#d03b3b', label: 'Critical', icon: '▲' },
  serious: { color: '#ec835a', label: 'Serious', icon: '◆' },
  warning: { color: '#fab219', label: 'Warning', icon: '●' },
  good: { color: '#0ca30c', label: 'Healthy', icon: '✓' }
};
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const stub = {
  esc,
  fixtureText: s => String(s == null ? '' : s),
  pct: v => (v == null ? '—' : Math.round(v * 100) + '%'),
  coverageStatus: v => (v == null ? 'warning' : v < .6 ? 'critical' : v < .75 ? 'serious' : v < .88 ? 'warning' : 'good'),
  status: STATUS,
  statusHtml: key => {
    const st = STATUS[key] || STATUS.warning;
    return '<span class="swm-status"><i style="color:' + st.color + '">' + st.icon + '</i>' + st.label + '</span>';
  }
};

const windowObj = {};
const sandbox = { window: windowObj, console };
createContext(sandbox);
windowObj.SWM = stub;
runInContext(COV_SRC, sandbox);
runInContext(INS_SRC, sandbox);

const bundle = windowObj.SILEX_SWM_COVERAGE;
const SWM = windowObj.SWM;
const ctx = { dimensions: bundle.dimensions, gaps: bundle.gaps };

/* hand-written d3-hierarchy shim: { data, parent, children } only */
function shim(data, parent) {
  const node = { data, parent: parent || null, children: null };
  node.children = (data.children || []).map(c => shim(c, node));
  return node;
}
function find(node, id) {
  if (!node) return null;
  if (node.data && node.data.id === id) return node;
  for (const c of node.children || []) { const r = find(c, id); if (r) return r; }
  return null;
}
const root = shim(bundle.tree);
const ins = id => SWM.coverageInsights(find(root, id), ctx);

test('WF-055 headline names Resource & Data 47% and plan step 1 is Connect data', () => {
  const r = ins('WF-055');
  assert.match(r.headline, /Resource & Data/);
  assert.match(r.headline, /47%/);
  assert.equal(r.plan[0], 'Connect data');
});

test('Procurement first driver is its direct child po-p2p · Purchase to Pay', () => {
  const r = ins('procurement');
  assert.equal(r.drivers[0].id, 'po-p2p');
  assert.equal(r.drivers[0].name, 'Purchase to Pay');
});

test('po-p2p first driver is WF-055 · Vendor Master Change', () => {
  const r = ins('po-p2p');
  assert.equal(r.drivers[0].id, 'WF-055');
});

test('enterprise gaps are critical-first and moreGaps is computed from the bundle', () => {
  const r = ins('enterprise');
  const inScope = bundle.gaps.filter(g => g.scope.includes('enterprise'));
  const sev = { critical: 0, serious: 1, warning: 2, good: 3 };
  const byId = id => bundle.gaps.find(g => g.id === id);
  const expected = inScope.map(g => g.id).sort((a, b) =>
    (sev[byId(a).severity] - sev[byId(b).severity]) || (a < b ? -1 : a > b ? 1 : 0));
  assert.equal(r.gaps.length, 2);
  assert.equal(r.gaps[0].severity, 'critical');
  assert.equal(r.gaps[1].severity, 'critical');
  assert.equal(r.moreGaps, inScope.length - 2);
  assert.deepEqual(r.gaps.map(g => g.id), expected.slice(0, 2));
});

test('Identity & IT (91%) gets the Healthy headline', () => {
  const r = ins('identity-it');
  assert.equal(r.status, 'good');
  assert.match(r.headline, /^Healthy — weakest dimension is /);
});

test('a hostile gap title is escaped in the HTML', () => {
  const hostile = '<img src=x onerror=alert(1)>';
  const gaps = [{ id: 'g-x', title: hostile, severity: 'critical', scope: ['enterprise', 'x'], action: { label: 'Do thing' } }];
  const node = { data: { id: 'x', name: 'X', coverage: 0.5, dims: { identity: 0.5 }, entities: 10 }, parent: null, children: [] };
  const r = SWM.coverageInsights(node, { dimensions: bundle.dimensions, gaps });
  const html = SWM.coverageInsightHtml(r, {});
  assert.ok(!html.includes('<img'), 'raw <img must not appear');
  assert.ok(html.includes('&lt;img'), 'escaped &lt;img must appear');
});

test('a hostile node name is escaped in the HTML', () => {
  const hostile = '<img src=x onerror=alert(1)>';
  const child = { data: { id: 'c1', name: hostile, coverage: 0.5, entities: 5 }, parent: null, children: [] };
  const node = { data: { id: 'p', name: 'Parent', coverage: 0.6, entities: 10 }, parent: null, children: [child] };
  child.parent = node;
  const r = SWM.coverageInsights(node, ctx);
  assert.equal(r.drivers[0].name, hostile);
  const html = SWM.coverageInsightHtml(r, {});
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;img'));
});

test('a node without dims does not throw and falls back to a Coverage headline', () => {
  const node = { data: { id: 'n', name: 'No dims', coverage: 0.5, entities: 5 }, parent: null, children: [] };
  let r;
  assert.doesNotThrow(() => { r = SWM.coverageInsights(node, ctx); });
  assert.equal(r.weakDims.length, 0);
  assert.equal(r.headline, 'Coverage 50%');
});

test('gap actions are the authored bundle labels, verbatim; fixture IDs pass through fixtureText', () => {
  const r = ins('WF-021');
  const labels = bundle.gaps.filter(g => g.scope.includes('WF-021') && g.action).map(g => g.action.label);
  assert.ok(labels.length >= 2);
  for (const l of labels) assert.ok(r.plan.includes(l), 'plan carries bundle label ' + l);
  const seen = [];
  const prev = SWM.fixtureText;
  /* the swm-core.js rule, verbatim */
  const FIX = [{ re: /\bWF-021\b(?! · Customer Refund \(SWM fixture\))/g, to: 'WF-021 · Customer Refund (SWM fixture)' },
    { re: /\bI-1042\b(?! · Refund loop \(SWM fixture\))/g, to: 'I-1042 · Refund loop (SWM fixture)' }];
  SWM.fixtureText = s => { seen.push(String(s)); let o = String(s); FIX.forEach(f => (o = o.replace(f.re, f.to))); return o; };
  try {
    const html = SWM.coverageInsightHtml(r, {});
    assert.ok(html.includes('Open WF-021 · Customer Refund (SWM fixture)'), 'plan step suffixed');
    assert.ok(html.includes('Open incident I-1042 · Refund loop (SWM fixture)'), 'incident step suffixed');
    const cx = SWM.coverageInsightHtml(ins('cx-rf'), {});
    assert.ok(cx.includes('WF-021 · Customer Refund (SWM fixture) 68%'), 'driver name suffixed once');
    assert.ok(!/Customer Refund[^<]*Customer Refund/.test(cx), 'name not repeated');
  } finally { SWM.fixtureText = prev; }
});
