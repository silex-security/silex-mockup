/* Decision Trace (plan logs/2026-09-24_DECISION_TRACE_PROPOSAL.md §3): the
   spine of world-model layers, the computed funnel, the thread graph, an
   inspector and the decision record. Everything shown comes from derive.js
   (CONTRACT.md); nothing here computes evidence. */
import { useEffect, useMemo, useState } from 'react';
import { useStudio, store } from '../state/storeAdapter.js';
import * as ctl from '../state/controller.js';
import { t } from '../i18n/index.js';
import { deriveTrace } from './derive.js';
import slice from '../../../ontology/slice.json';
import Spine from './Spine.jsx';
import ThreadGraph, { focusSet } from './ThreadGraph.jsx';
import DecisionRecord from './DecisionRecord.jsx';
import { tr } from './tr.js';

const short = h => (h ? '#' + h.slice(0, 8) : '—');

/* The default question: why was this approved (or recommended)? */
function defaultFocus(trace) {
  const cs = trace.candidates || [];
  const c = cs.find(x => x.state === 'approved') || cs.find(x => x.id === trace.recommended);
  if (c) return { kind: 'candidate', ref: c.id };
  const f = trace.simulation?.findings?.[0];
  return f ? { kind: 'finding', ref: f.id } : null;
}

function Funnel({ f, onOpen }) {
  const cell = (key, n, label, row, sub) => (
    <button className="fun-cell" data-funnel={key} onClick={() => onOpen(row)} title={sub || ''}>
      <b>{n == null ? '—' : n}</b><span>{label}</span>{sub ? <small>{sub}</small> : null}
    </button>);
  const arrow = <span className="fun-arrow" aria-hidden="true">→</span>;
  return (
    <div className="funnel" id="traceFunnel">
      {cell('mapped', `${f.mapped}/${f.steps}`, t('trace.fun.mapped', 'steps mapped'), 'schema', t('trace.fun.classes', '{n} classes · {u} unmapped', { n: f.classes, u: f.unmapped }))}{arrow}
      {cell('associated', f.associated, t('trace.fun.associated', 'associated threat classes'), 'schema', t('trace.fun.related', '{r} related to a simulated family · {w} without', { r: f.relatedInstantiated, w: f.withoutRelatedFamily }))}{arrow}
      {cell('paths', f.paths, t('trace.fun.paths', 'declared paths'), 'world')}{arrow}
      {cell('runs', f.runs, t('trace.fun.runs', 'simulated runs'), 'simulation', f.adversarial ? t('trace.fun.violate', '{a}/{b} adversarial · {c}/{d} benign violate', { a: f.adversarial.num, b: f.adversarial.den, c: f.benign.num, d: f.benign.den }) : '')}{arrow}
      {cell('findings', f.findings, t('trace.fun.findings', 'findings'), 'simulation')}{arrow}
      {cell('candidates', f.candidates, t('trace.fun.candidates', 'candidates'), 'decision', f.candidates == null ? '' : t('trace.fun.cands', '{e} eligible · {i} ineligible · {s} untested · {r} rejected by a person', { e: f.eligible, i: f.ineligible, s: f.stale, r: f.rejectedByPerson }))}{arrow}
      {cell('decision', f.approved ? '✓' : '—', t('trace.fun.decision', 'decision by a person'), 'decision')}
    </div>);
}

function Inspector({ trace, focus, graph }) {
  if (!focus) return <aside className="tr-inspect"><p className="muted">{t('trace.inspect.empty', 'Click a finding, a candidate or a step to follow its thread.')}</p></aside>;
  const S = trace.schema, sim = trace.simulation;
  const label = id => graph.nodes.find(n => n.id === id)?.label || id;
  const threat = id => S.related.find(r => r.threatId === id) || S.associated.find(a => a.threatId === id);
  const link = (id, name) => { const x = threat(id); return x?.url ? <a href={x.url} target="_blank" rel="noreferrer" className="mono">{id}</a> : <span className="mono">{id}</span>; };
  let body = null;
  if (focus.kind === 'finding') {
    const f = sim?.findings.find(x => x.id === focus.ref); if (!f) return null;
    body = <>
      <div className="tr-kicker">{t('trace.kind.finding', 'Finding')} · <span className="chip">{t('grade.simulated', 'simulated')}</span></div>
      <h3>{label(f.prohibited)}</h3>
      <p className="mono muted">{f.id} · {f.violating} / {f.run}</p>
      <p>{t('trace.inspect.family', 'Scenario family')}: <b>{t('template.' + f.family, f.family)}</b> · {t('trace.inspect.law', 'law')}: <b>{tr('law', f.law)}</b></p>
      <h4>{f.attributed.length > 1 ? t('trace.inspect.attributedMany', 'One of these produced it (steps on the violating paths that can produce this effect)') : t('trace.inspect.attributed', 'Produced at (from the violating paths)')}</h4>
      <ul>{f.attributed.map(s => <li key={s}>{label(s)} <span className="muted mono">{s}</span></li>)}</ul>
      <p className="muted">{t('trace.inspect.watch', 'Declared watch')}: {f.declaredWatch.map(label).join(', ') || '—'}{f.attributionDiffers ? <b className="warn-text"> · {t('trace.inspect.differsPossible', 'differs from the possible producers above')}</b> : null}</p>
      <h4>{t('trace.inspect.related', 'Related public threats (related, not tested)')}</h4>
      <ul>{f.related.map(id => { const r = S.related.find(x => x.threatId === id && x.family === f.family); return <li key={id}>{link(id)} {threat(id)?.label} <div className="muted">{tr('limit', `${f.family}.${id}`, r?.limit)}</div></li>; })}{f.related.length ? null : <li className="muted">{t('trace.inspect.noThreat', 'No public threat id (a business-outcome failure)')}</li>}</ul>
      <h4>{t('trace.inspect.paths', 'Violating paths')}</h4>
      {f.paths.slice(0, 4).map((p, i) => <div className="path" key={i}><span className="grade">{t('grade.simulated', 'simulated')}</span><span>{p.nodes.map(label).join(' → ')}</span><span className="muted">×{p.count}</span></div>)}
    </>;
  } else if (focus.kind === 'candidate') {
    const c = trace.candidates?.find(x => x.id === focus.ref); if (!c) return null;
    body = <>
      <div className="tr-kicker">{t('trace.kind.candidate', 'Candidate fix')} · <span className={'chip ' + ({ eligible: 'ok', approved: 'ok', ineligible: 'bad', stale: '', rejected: 'warn' }[c.state])} data-cand-state={c.state}>{t('trace.state.' + c.state, c.state)}</span></div>
      <h3>{c.label}</h3>
      <p className="mono muted">{c.id} · v{c.paramsVersion}{c.runId ? ' · ' + c.runId : ''}</p>
      <h4>{t('trace.inspect.changes', 'What it changes (from its patch)')}</h4>
      <ul>{c.changes.map((x, i) => <li key={i}>{x.text}{x.classId ? <span className="chip">{x.classId}</span> : null}</li>)}</ul>
      {c.state === 'ineligible' ? <><h4>{t('trace.inspect.reasons', 'Why the objectives rule rejects it')}</h4><ul className="mono">{c.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul></> : null}
      {c.state === 'rejected' ? <p className="muted">{t('trace.inspect.personRejected', 'Rejected by a person. The optimizer verdict below is history, not the reason.')}</p> : null}
      {c.state === 'stale' ? <p className="muted">{t('trace.inspect.stale', 'Modified after testing — retest it before it can support a decision.')}</p> : null}
      {c.closes.length ? <><h4>{t('trace.inspect.closes', 'Findings it closes in the simulated runs')}</h4><ul>{c.closes.map(id => <li key={id} className="mono">{id}</li>)}</ul></> : null}
      {c.scorecard ? <p className="muted mono">{t('trace.inspect.score', 'friction {f} · added latency {l} · patch ops {p}', { f: c.scorecard.friction ? `${c.scorecard.friction.num}/${c.scorecard.friction.den}` : '—', l: c.scorecard.addedLatencyMedian ?? '—', p: c.scorecard.patchOps ?? '—' })}</p> : null}
    </>;
  } else if (focus.kind === 'step') {
    const s = S.steps.find(x => x.id === focus.ref); if (!s) return null;
    body = <>
      <div className="tr-kicker">{t('trace.kind.step', 'Blueprint step')} · <span className="chip">{t('grade.declared', 'declared')}</span></div>
      <h3>{s.label}</h3>
      {s.classId ? <p>{t('trace.inspect.class', 'Ontology class')}: <b>{s.classId}</b> <span className="chip">{t('trace.prov.mapping', 'Silex mapping')}</span><br /><span className="muted">{tr('crit', s.classId, s.criterion)}</span></p>
        : <p>{t('trace.inspect.unmapped', 'Unmapped')}: <span className="muted">{tr('unmapped', s.type, s.reason)}</span></p>}
    </>;
  } else if (focus.kind === 'threat') {
    const x = threat(focus.ref);
    body = <>
      <div className="tr-kicker">{t('trace.kind.threat', 'Related public threat')} · <span className="chip">{t('trace.prov.association', 'Silex association · illustrative')}</span></div>
      <h3>{x?.label || focus.ref}</h3><p>{link(focus.ref)}</p>
      <p className="muted">{t('trace.inspect.relatedNote', 'The id and its definition are public. Its link to a component class and to a scenario family is Silex-authored. Related means a narrow instance of its mechanism is simulated — never that the threat was tested.')}</p>
    </>;
  } else {
    body = <><div className="tr-kicker">{t('trace.kind.' + focus.kind, focus.kind)}</div><h3 className="mono">{focus.ref}</h3></>;
  }
  return <aside className="tr-inspect" id="traceInspector">{body}</aside>;
}

/* Mini blueprint: the revision graph at its own positions; the focused
   finding's violating path nodes (or a candidate's closed findings') highlighted. */
function MiniBlueprint({ graph, hot }) {
  if (!graph.nodes.length) return null;
  const xs = graph.nodes.map(n => n.x), ys = graph.nodes.map(n => n.y);
  const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0 + 280, h = Math.max(...ys) - y0 + 80;
  const at = id => graph.nodes.find(n => n.id === id);
  return (
    <svg className="mini-bp" id="miniBlueprint" viewBox={`${x0 - 20} ${y0 - 20} ${w + 40} ${h + 40}`} role="img" aria-label={t('trace.mini', 'Blueprint, with the focused path highlighted')}>
      {graph.edges.filter(e => e.kind === 'flow').map(e => { const a = at(e.from.node), b = at(e.to.node); return a && b ? <line key={e.id} x1={a.x + 136} y1={a.y + 38} x2={b.x + 136} y2={b.y + 38} className={hot.has(e.from.node) && hot.has(e.to.node) ? 'hot' : ''} /> : null; })}
      {graph.nodes.map(n => <rect key={n.id} data-mini={n.id} x={n.x} y={n.y} width={n.type === 'data' || n.type === 'prohibited' ? 208 : 272} height={n.type === 'data' || n.type === 'prohibited' ? 52 : 76} rx="12" className={'t-' + n.type + (hot.has(n.id) ? ' hot' : '')} />)}
    </svg>);
}

export default function TraceView() {
  const version = useStudio();
  const rev = store.active(), route = ctl.getRoute();
  const trace = useMemo(() => deriveTrace({ doc: store.doc, revNo: rev.rev, slice, meta: store.meta() }), [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const [open, setOpen] = useState(null);
  const [record, setRecord] = useState(false);
  const focus = route.traceFocus && route.traceFocus.rev === rev.rev ? route.traceFocus : defaultFocus(trace);
  const setFocus = f => ctl.setTraceFocus(f ? { ...f, rev: rev.rev } : null);
  const hot = useMemo(() => focusSet(trace, focus), [trace, focus?.kind, focus?.ref]); // eslint-disable-line react-hooks/exhaustive-deps
  const hotSteps = useMemo(() => new Set([...hot].filter(k => k.startsWith('step:')).map(k => k.slice(5)).concat(focus?.kind === 'finding' ? (trace.simulation?.findings.find(f => f.id === focus.ref)?.paths || []).flatMap(p => p.nodes) : [])), [hot]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) document.querySelector(`[data-layer="${open}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [open]);
  const b = trace.binding, st = trace.stamp;
  return (
    <main className="trace" id="traceView">
      <div className="tr-stamp" id="traceStamp">
        <span className="chip blue">{t('trace.stamp.ontology', 'ontology {v}', { v: st.ontologyVersion })}</span>
        <span className="chip">{t('trace.stamp.blueprint', 'blueprint {rev} {hash}', { rev: st.revLabel, hash: short(st.hash) })}</span>
        <span className="chip">{st.scenarioSetId ? t('trace.stamp.set', 'scenario set {id}', { id: st.scenarioSetId }) : t('trace.stamp.noSet', 'not validated yet')}</span>
        <span className="chip">{t('trace.stamp.grades', 'grades: declared paths · simulated outcomes')}</span>
        {b.kind === 'approvedChild' ? <span className="chip warn" id="traceChildNote">{t('trace.stamp.child', 'Approved from {rev} — the numbers are the candidate run on {rev}', { rev: b.parent?.revLabel })} <button className="linkish" onClick={() => ctl.setActiveRevision(store.doc.revisions.find(r => ctl.revLabel(r.rev) === b.parent?.revLabel)?.rev)}>{t('trace.stamp.open', 'open')}</button></span> : null}
        <span className="grow" />
        <span className="legend"><i className="lg declared" />{t('trace.legend.declared', 'declared')}<i className="lg simulated" />{t('trace.legend.simulated', 'simulated')}<i className="lg association" />{t('trace.legend.association', 'Silex mapping / association')}<i className="lg untested" />{t('trace.legend.untested', 'untested')}</span>
        <button className="btn sm" id="recordBtn" onClick={() => setRecord(true)}>{t('trace.record', 'Decision record')}</button>
      </div>
      <div className="tr-body">
        <Spine trace={trace} open={open} setOpen={setOpen} onFocus={setFocus} focus={focus} />
        <section className="tr-center">
          <Funnel f={trace.funnel} onOpen={setOpen} />
          <ThreadGraph trace={trace} focus={focus} hot={hot} onFocus={setFocus} />
          <p className="tr-foot muted">{t('trace.foot', 'Sampled, not pruned: every scenario family runs on every graph, with seeded requests drawn from disclosed ranges. A family with 0 violations is evidence from its samples, not an exhaustive check. As of the ontology version and revision above; not a certification.')}</p>
        </section>
        <div className="tr-right">
          <MiniBlueprint graph={rev.graph} hot={hotSteps} />
          <Inspector trace={trace} focus={focus} graph={rev.graph} />
        </div>
      </div>
      {record ? <DecisionRecord trace={trace} onClose={() => setRecord(false)} /> : null}
    </main>);
}
