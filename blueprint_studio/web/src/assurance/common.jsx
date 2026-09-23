/* Shared building blocks for the Assurance pages (Task 0 pattern; used by
   Validate.jsx and the ported Confirm / Optimize / Decide / Register pages).
   Claim discipline (plan §6): every number shows its formula; results are
   "0 violations in M tested scenarios", never "closed" or "impossible". */
import { t } from '../i18n/index.js';

export const pct = f => (f && f.den ? (100 * f.num / f.den).toFixed(1) + '%' : 'n/a');
export const frac = f => (f && f.den ? `${f.num} / ${f.den}` : 'n/a');

export function Claim({ extra }) {
  return <p className="claim">{t('claim.simulated', 'Simulated against a declared adversary model: the confirmed graph, run with scripted adversary scenarios. No real agents or tools were run. Zero violations in the tested scenarios does not prove a path impossible.')}{extra ? ' ' + extra : ''}</p>;
}

export function MetricsRow({ m, compact }) {
  const M = (key, label, value, formula) => (
    <div className="metric" key={key} title={formula}>
      <span className="metric-label">{label}</span>
      <b className="metric-value">{value}</b>
      {compact ? null : <span className="metric-formula">{formula}</span>}
    </div>);
  return (
    <div className="metrics">
      {M('rr', t('metric.residual', 'Residual reachability'), pct(m.residualReachability), t('metric.residual.f', 'adversarial scenarios with ≥1 violation / adversarial run = {v}', { v: frac(m.residualReachability) }))}
      {M('bpv', t('metric.benignViol', 'Benign policy violations'), pct(m.benignPolicyViolations), t('metric.benignViol.f', 'benign scenarios with ≥1 violation / benign run = {v}', { v: frac(m.benignPolicyViolations) }))}
      {M('bc', t('metric.completion', 'Benign completion'), pct(m.benignCompletion), t('metric.completion.f', 'benign scenarios ending at a success outcome / benign run = {v}', { v: frac(m.benignCompletion) }))}
      {M('fr', t('metric.friction', 'Friction'), pct(m.friction), t('metric.friction.f', 'benign scenarios needing a human approval / benign run = {v}', { v: frac(m.friction) }))}
      {M('lat', t('metric.latency', 'Median approval latency'), m.addedLatencyMedian == null ? 'n/a' : m.addedLatencyMedian + ' min', t('metric.latency.f', 'median approval minutes over benign scenarios'))}
    </div>);
}

export function ScoreCard({ sc }) {
  const S = (key, v, l, f) => <div key={key} title={f}><b>{v}</b><span>{l}</span></div>;
  return (
    <div className="scorecard">
      {S('vc', sc.violationsClosed ? frac(sc.violationsClosed) : 'n/a', t('score.findingsZero', 'baseline findings at 0 violations in tested scenarios'), t('score.findingsZero.f', 'baseline findings with no violating scenario in this candidate’s run / baseline findings (same frozen scenario set; a sample, not a proof)'))}
      {S('rr', pct(sc.residualReachability), t('metric.residual', 'Residual reachability'), t('metric.residual.short', 'adversarial scenarios with ≥1 violation / adversarial run'))}
      {S('bc', pct(sc.benignCompletion), t('metric.completion', 'Benign completion'), t('metric.completion.short', 'benign scenarios ending at a success outcome / benign run'))}
      {S('fr', pct(sc.friction), t('metric.friction', 'Friction'), t('metric.friction.short', 'benign scenarios needing a human approval / benign run'))}
      {S('lat', sc.addedLatencyMedian == null ? 'n/a' : sc.addedLatencyMedian + ' min', t('metric.latency', 'Median approval latency'), t('metric.latency.f', 'median approval minutes over benign scenarios'))}
      {S('ops', String(sc.patchOps ?? '—'), t('score.patchOps', 'patch ops'), t('score.patchOps.f', 'number of graph operations in the patch'))}
    </div>);
}

/* A candidate's label, rendered from its classes and params so it is translated
   (the engine's own label is English). */
export function candLabel(cand) {
  if (!cand || !Array.isArray(cand.classes)) return cand?.label || '';
  const p = cand.params || {}, parts = [];
  if (cand.classes.includes('threshold')) parts.push(p.threshold?.field === 'dayTotal' ? t('cand.dayTotal', 'aggregate daily total above ${x}', { x: p.threshold.x }) : t('cand.amount', 'require approval above ${x}', { x: p.threshold?.x }));
  if (cand.classes.includes('binding')) parts.push(t('cand.binding', 'bind approval to customer, order, amount (single-use)'));
  if (cand.classes.includes('idem')) parts.push(t('cand.idem', 'idempotency key on the write'));
  if (cand.classes.includes('injection')) parts.push(p.injection?.variant === 'a' ? t('cand.injA', 'move the secret read to the tool') : t('cand.injB', 'redact secrets before external emit'));
  return parts.join(' · ') || t('cand.none', 'no change');
}
/* The label of the candidate a decision refers to, found on its parent revision. */
export function decisionLabel(parentRev) {
  const d = parentRev?.decision; if (!d) return '';
  const c = parentRev.optimization?.candidates.find(x => x.candidate.id === d.candidateId);
  return c ? candLabel(c.candidate) : d.label;
}
export const nodeLabelIn = (graph, id) => graph.nodes.find(n => n.id === id)?.label || id;
export const pathLabel = (graph, ids) => ids.map(i => nodeLabelIn(graph, i)).join(' → ');

/* Human-readable patch op, used by Optimize and Decide. */
export function describeOp(graph, o) {
  const lbl = id => nodeLabelIn(graph, id);
  switch (o.op) {
    case 'setConfig': return `${lbl(o.id)} · ${o.key} = ${JSON.stringify(o.value)}`;
    case 'addNode': return t('op.addNode', 'add “{label}”', { label: o.node.label });
    case 'removeNode': return t('op.removeNode', 'remove {label}', { label: lbl(o.id) });
    case 'addEdge': return t('op.addEdge', 'connect {a} → {b}', { a: lbl(o.edge.from.node), b: o.edge.to.node === o.edge.from.node ? '' : lbl(o.edge.to.node) });
    case 'removeEdge': { const e = graph.edges.find(x => x.id === o.id); return e ? t('op.removeEdge', 'disconnect {a} → {b}', { a: lbl(e.from.node), b: lbl(e.to.node) }) : o.id; }
    default: return o.op;
  }
}

/* Structural diff between two graphs, as rows. */
export function DiffList({ diff, a, b }) {
  const lbl = (g, id) => nodeLabelIn(g, id);
  const rows = [
    ...diff.addedNodes.map(n => ['add', t('diff.addNode', '+ node {x}', { x: n.label })]),
    ...diff.removedNodes.map(n => ['del', t('diff.removeNode', '− node {x}', { x: n.label })]),
    ...diff.changedNodes.map(c => ['chg', `~ ${lbl(b, c.id)}: ` + c.fields.map(f => f.startsWith('config.') ? `${f.slice(7)} → ${JSON.stringify(b.nodes.find(n => n.id === c.id)?.config[f.slice(7)])}` : f).join(', ')]),
    ...diff.addedEdges.map(e => ['add', `+ ${lbl(b, e.from.node)} → ${lbl(b, e.to.node)}`]),
    ...diff.removedEdges.map(e => ['del', `− ${lbl(a, e.from.node)} → ${lbl(a, e.to.node)}`])];
  if (!rows.length) return <p className="muted">{t('diff.none', 'No semantic changes.')}</p>;
  return <ul className="diff">{rows.map(([k, s], i) => <li key={i} className={k}>{s}</li>)}</ul>;
}

export function Page({ title, sub, children }) {
  return <div className="page"><header className="page-head"><h1>{title}</h1>{sub ? <p className="muted">{sub}</p> : null}</header>{children}</div>;
}
export function Progress({ label, done, total }) {
  return <div className="card"><h2>{label}</h2><div className="progress"><i style={{ width: total ? `${(100 * done / total).toFixed(0)}%` : '0%' }} /></div><p className="muted mono">{done} / {total}</p></div>;
}
