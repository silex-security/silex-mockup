/* Test run (Dify's run panel; plan §3.7). Runs the engine on one request
   against a snapshot of the current graph; node status rings on the canvas come
   from controller.runHighlights(). Any edit cancels a pending run. */
import { useState } from 'react';
import { useStudio } from '../state/storeAdapter.js';
import * as ctl from '../state/controller.js';
import { t } from '../i18n/index.js';
import Icon, { I } from '../ui/Icon.jsx';

const EFFECT_EN = { data_read: 'read data', write: 'write', write_denied: 'write refused', approval_issued: 'approval given', approval_denied: 'approval denied', approval_reused: 'approval reused', approval_consumed: 'approval used', redact: 'redacted', emit: 'sent', error: 'error' };
const effectName = e => t('effect.' + e.type, EFFECT_EN[e.type] || e.type);
const STATUS_EN = { ok: 'ok', skip: 'skipped', waiting: 'waiting', error: 'error' };

function effectDetail(e, label) {
  switch (e.type) {
    case 'data_read': return `${label(e.data)} (${t('sens.' + e.sensitivity, e.sensitivity)})`;
    case 'write': return `${e.cap} $${e.amount}${e.approvalId ? ' · ' + e.approvalId : ''}`;
    case 'write_denied': return `${e.cap} $${e.amount} · ${t('deny.' + e.reason, e.reason.replace(/_/g, ' '))}`;
    case 'approval_issued': case 'approval_reused': case 'approval_consumed': return e.id;
    case 'emit': return e.labels.length ? e.labels.map(l => label(l.data)).join(', ') : t('run.noData', 'no sensitive data');
    case 'redact': return e.removed.map(l => label(l.data)).join(', ') || '—';
    case 'error': return e.message;
    default: return '';
  }
}

export default function TestRunPanel() {
  useStudio();
  const f = ctl.run.form, v = ctl.run.view, cur = ctl.run.current;
  const [open, setOpen] = useState(null);
  const set = (k, val) => { f[k] = val; ctl.clearRun(); };
  const g = v?.ctx.graph;
  const label = id => g?.nodes.find(n => n.id === id)?.label || id;
  const num = (k, lab) => <label className="rf"><span>{lab}</span><input id={'run-' + k} type="number" value={f[k]} onChange={e => set(k, e.target.value)} /></label>;
  const chk = (k, lab) => <label className="rf check"><input id={'run-' + k} type="checkbox" checked={!!f[k]} onChange={e => set(k, e.target.checked)} />{lab}</label>;
  const busy = cur && !cur.engine.done;
  return (
    <aside className="config run-panel" aria-label={t('run.title', 'Test run')}>
      <header className="cp-head"><span className="si-tile" style={{ '--tc': 'var(--blue)' }}><svg viewBox="0 0 24 24" className="icon"><path d={I.play} /></svg></span>
        <div className="cp-title"><b>{t('run.title', 'Test run')}</b><small>{t('run.sub', 'Runs this graph on one request, step by step.')}</small></div>
        <button className="btn ghost sm" aria-label={t('cp.close', 'Close')} onClick={() => ctl.setPanel(null)}><Icon d={I.x} /></button></header>
      <section className="cp-section run-form">
        <div className="rf-grid">{num('amount', t('run.amount', 'Amount $'))}{num('eligible', t('run.eligible', 'Eligible $'))}{num('split', t('run.split', 'Split into'))}</div>
        {chk('injected', t('run.injected', 'Input carries an injected instruction'))}
        {chk('replay', t('run.replay', 'A second request replays the first approval'))}
        {chk('dup', t('run.dup', 'The same order is submitted twice'))}
        {chk('interactive', t('run.interactive', 'I decide approvals myself'))}
        <div className="ref-actions">
          <button className="btn primary" id="runBtn" onClick={() => ctl.startRun(false)}><Icon d={I.play} />{t('run.run', 'Run')}</button>
          <button className="btn" id="stepBtn" onClick={() => (busy && !cur.engine.waiting ? ctl.stepRun() : ctl.startRun(true))}><Icon d={I.step} />{busy && !cur?.engine.waiting ? t('run.next', 'Next step') : t('run.step', 'Step through')}</button>
          {v ? <button className="btn ghost" onClick={() => ctl.clearRun()}>{t('run.clear', 'Clear')}</button> : null}
        </div>
      </section>
      {v?.waiting && cur ? (
        <section className="approve-card" id="approvalCard">
          <b>{t('run.waiting', 'Waiting for your approval')}</b>
          <p>{t('run.waitingAt', '{node} · request {act} · ${amt}', { node: label(v.waiting.node), act: v.waiting.activation, amt: f.amount })}</p>
          <div className="ref-actions"><button className="btn primary sm" id="approveRunBtn" onClick={() => ctl.resolveRun(true)}>{t('run.approve', 'Approve')}</button><button className="btn danger sm" id="denyRunBtn" onClick={() => ctl.resolveRun(false)}>{t('run.deny', 'Deny')}</button></div>
        </section>) : null}
      {v ? (
        <section className="cp-section run-result">
          {!ctl.sameCtx(v.ctx) ? <p className="help">{t('run.stale', 'Recorded on {rev}; the graph has changed since.', { rev: ctl.revLabel(v.ctx.rev) })}</p> : null}
          <div className="run-summary" id="runSummary">
            {v.activations.map(a => <span key={a.id} className={'chip ' + (a.status === 'success' ? 'ok' : a.status === 'failure' ? 'warn' : 'bad')}>{a.id}: {t('act.' + a.status, a.status)} · {label(a.end)}</span>)}
            {v.done ? (v.violations && v.violations.length ? v.violations.map(m => <span key={m.node} className="chip bad">{t('run.violation', 'Monitor fired: {m}', { m: label(m.node) })}</span>) : <span className="chip ok">{t('run.noViolation', 'No monitor fired')}</span>) : null}
          </div>
          <ol className="trace" id="traceList">
            {v.trace.map((st, i) => (
              <li key={i} className={'st st-' + st.status}>
                <button className="st-head" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                  <span className="st-dot" /><span className="st-node">{label(st.node)}</span><span className="st-act mono">{st.activation}</span>
                  <span className="st-port">{st.out?.port ? '→ ' + t('port.' + st.out.port, st.out.port) : t('status.' + st.status, STATUS_EN[st.status] || st.status)}</span>
                </button>
                {st.effects.length ? <div className="st-effects">{st.effects.map((e, k) => <span key={k} className={'eff eff-' + e.type}>{effectName(e)} <span className="muted">{effectDetail(e, label)}</span></span>)}</div> : null}
                {open === i ? <pre className="json">{JSON.stringify({ in: st.in, out: st.out, effects: st.effects }, null, 1)}</pre> : null}
              </li>))}
          </ol>
        </section>) : <p className="help pad">{t('run.hint', 'Set a request above and press Run. Approvals pause here for you to decide.')}</p>}
    </aside>);
}
