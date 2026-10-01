/* Confirm (ported from js/app.js renderConfirm; plan §5 Task 3).
   Reads the store; the actual confirm goes through controller.confirm(), which
   refuses while any pending input exists. Keeps #confirmAck / #confirmBtn /
   #toValidateBtn for the probes. */
import { useState } from 'react';
import { useStudio, store } from '../state/storeAdapter.js';
import { pending } from '../state/pendingInputs.js';
import * as ctl from '../state/controller.js';
import { t } from '../i18n/index.js';
import { lint } from '../../../js/validate.js';
import { nodeSummary } from '../builder/summary.js';
import { Page, DiffList } from './common.jsx';

export default function Confirm() {
  useStudio();
  const rev = store.active(), g = rev.graph;
  const issues = lint(g), errs = issues.filter(i => i.severity === 'error');
  const pendingCount = pending.size;
  const [ack, setAck] = useState(false);
  const title = t('confirm.title', 'Confirm');
  const sub = t('confirm.sub', 'Confirming locks this revision. Only a confirmed revision can be validated; later edits start a new revision.');
  const count = type => g.nodes.filter(n => n.type === type).length;
  const ready = ack && !errs.length && !pendingCount;

  const doConfirm = () => {
    const r = ctl.confirm();
    if (r.ok) { ctl.toast(t('confirm.confirmedToast', '{rev} confirmed', { rev: ctl.revLabel(rev.rev) })); }
    else ctl.toast(r.error.message, 'error');
  };

  return (
    <Page title={title} sub={sub}>
      <section className="card">
        <div className="card-head">
          <div>
            <h2>{store.doc.name} · {ctl.revLabel(rev.rev)}</h2>
            <p className="muted">{t('confirm.statement', '“This graph accurately represents the workflow that the enterprise intends to deploy.”')}</p>
          </div>
          <span className={'chip ' + (rev.status === 'draft' ? 'warn' : 'ok')}>{rev.status === 'draft' ? t('status.draft', 'draft') : t('status.confirmed', 'confirmed')}</span>
        </div>
        <div className="check-row"><b>✓</b>{t('confirm.counts', '{nodes} nodes · {flow} flow edges · {access} access edges · {controls} control points · {monitors} monitors', { nodes: g.nodes.length, flow: g.edges.filter(e => e.kind === 'flow').length, access: g.edges.filter(e => e.kind === 'access').length, controls: count('control'), monitors: count('prohibited') })}</div>
        {g.nodes.filter(n => n.type === 'prohibited').map(n => <div className="check-row" key={n.id}><b>◆</b>{n.label}: {nodeSummary(n)}</div>)}
        <div className="check-row"><b>✓</b>{t('confirm.owner', 'Owner: {owner} · Domain: {domain}', { owner: store.doc.owner, domain: store.doc.domain })}</div>
        <div className={'check-row' + (errs.length ? ' no' : '')}>
          <b>{errs.length ? '✗' : '✓'}</b>
          {errs.length ? t('confirm.lintErrors', '{n} lint error(s) must be fixed first: {list}', { n: errs.length, list: errs.map(i => i.message).join(' · ') }) : t('confirm.lintOk', 'Lint: no errors{extra}', { extra: issues.length ? ' (' + t('confirm.warnings', '{n} warning(s)', { n: issues.length }) + ')' : '' })}
        </div>
        {pendingCount ? <div className="check-row no"><b>✗</b>{t('confirm.pending', '{n} edit(s) not applied yet — fix or discard them before confirming.', { n: pendingCount })}</div> : null}
      </section>
      {rev.parent != null ? <section className="card"><h2>{t('confirm.changes', 'Changes from {rev}', { rev: ctl.revLabel(rev.parent) })}</h2><DiffList diff={ctl.diffGraphs(store.revision(rev.parent).graph, g)} a={store.revision(rev.parent).graph} b={g} /></section> : null}
      {rev.status === 'draft' ? (
        <section className="card row">
          <label className="check-row"><input type="checkbox" id="confirmAck" checked={ack} onChange={e => setAck(e.target.checked)} />{t('confirm.ack', ' I confirm this is the workflow we intend to deploy')}</label>
          <div className="row-actions">
            <button className="btn" onClick={() => ctl.go('builder')}>{t('confirm.back', '← Back to edit')}</button>
            <button className="btn primary" id="confirmBtn" disabled={!ready} onClick={doConfirm}>{t('confirm.confirm', 'Confirm Blueprint')}</button>
          </div>
        </section>
      ) : (
        <section className="card row">
          <p><b>{t('confirm.confirmed', '{rev} confirmed.', { rev: ctl.revLabel(rev.rev) })}</b> <span className="mono">{t('confirm.hash', 'hash')} {rev.hash.slice(0, 16)}…</span></p>
          <div className="row-actions">
            <button className="btn" onClick={() => ctl.newRevision()}>{t('confirm.newRevision', 'Edit as new revision')}</button>
            <button className="btn primary" id="toValidateBtn" onClick={() => ctl.go('assurance', 'validate')}>{t('confirm.toValidate', 'Validate →')}</button>
          </div>
        </section>
      )}
    </Page>
  );
}
