/* The decision record (plan §3.4): PCP-shaped, derived from the store, never
   stored. The statement is generated from the cited result (§3.4.1). The JSON
   is English by design (like the document JSON); the summary above it is
   localised. */
import { useEffect } from 'react';
import { t } from '../i18n/index.js';
import * as ctl from '../state/controller.js';
import { store } from '../state/storeAdapter.js';
import Icon, { I } from '../ui/Icon.jsx';

export default function DecisionRecord({ trace, onClose }) {
  useEffect(() => { const esc = e => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', esc); return () => document.removeEventListener('keydown', esc); }, [onClose]);
  const text = JSON.stringify(trace.record, null, 2);
  const st = trace.statement;
  const g = store.active().graph, label = id => g.nodes.find(n => n.id === id)?.label || id;
  const copy = async () => { try { await navigator.clipboard.writeText(text); ctl.toast(t('trace.rec.copied', 'Decision record copied')); } catch { ctl.toast(t('menu.copyFailed', 'Copy was refused by the browser'), 'error'); } };
  const download = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = `decision-record-${trace.stamp.revLabel}.json`; document.body.append(a); a.click(); a.remove(); };
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal record" role="dialog" aria-modal="true" aria-labelledby="recTitle" id="recordModal" onClick={e => e.stopPropagation()}>
        <header className="gallery-head">
          <div><h2 id="recTitle">{t('trace.rec.title', 'Decision record')}</h2>
            <p className="muted">{t('trace.rec.sub', 'Derived from this document, never stored. Paths are declared, outcomes simulated; as of ontology {v}, blueprint {rev}. Not a certification.', { v: trace.stamp.ontologyVersion, rev: trace.stamp.revLabel })}</p></div>
          <button className="btn ghost sm" aria-label={t('cp.close', 'Close')} onClick={onClose}><Icon d={I.x} /></button>
        </header>
        {st ? (
          <section className="rec-statement" id="recStatement">
            <h4>{t('trace.rec.statement', 'Statement, generated from {from}', { from: st.generatedFrom })}</h4>
            {st.violationsFound.length ? <ul className="found">{st.violationsFound.map(v => <li key={v.finding}><b>{v.violating} / {v.run}</b> {t('trace.rec.violating', 'violating runs remain')} · <span className="mono">{v.finding}</span></li>)}</ul> : null}
            {st.zeroViolations.length ? <ul className="zero">{st.zeroViolations.map(z => <li key={z.prohibited}>{t('trace.rec.zero', '0 violations in {n} simulated runs', { n: z.runs })} · {z.label || label(z.prohibited)}</li>)}</ul> : null}
            <p className="muted">{t('trace.rec.notSimulated', 'Not simulated')}: {st.notSimulated.join(' · ')}</p>
          </section>) : <p className="muted">{t('trace.rec.noStatement', 'No statement yet: run Validate.')}</p>}
        {trace.rationale ? <p className="rec-rationale"><b>{t('trace.rec.rationale', 'Semantic rationale')}</b> {trace.rationale}</p> : null}
        <pre className="rec-json" id="recJson">{text}</pre>
        <div className="row-actions">
          <button className="btn" id="recCopy" onClick={copy}><Icon d={I.copy} />{t('trace.rec.copy', 'Copy JSON')}</button>
          <button className="btn primary" id="recDownload" onClick={download}><Icon d={I.file} />{t('trace.rec.download', 'Download JSON')}</button>
        </div>
      </div>
    </div>);
}
