/* Register (ported from js/app.js renderRegister; plan §5 Task 3). Adds the
   revision to the local inventory; idempotent; never claims deployment. The
   policy-as-code text is shown in a <pre> with a Copy button (downloads are
   blocked in the demo viewer). Keeps #registerBtn. */
import { useStudio, store } from '../state/storeAdapter.js';
import * as ctl from '../state/controller.js';
import { t } from '../i18n/index.js';
import { Page, Claim, decisionLabel } from './common.jsx';

export default function Register() {
  useStudio();
  const rev = store.active();
  const inv = store.inventory();
  const mine = inv.find(x => x.docId === store.doc.id && x.rev === rev.rev && x.hash === rev.hash);
  const parent = rev.origin === 'approve' ? store.revision(rev.parent) : rev;
  const d = parent.decision;
  const title = t('register.title', 'Register');
  const sub = t('register.sub', 'Registration adds the workflow to the workflow inventory in this browser. It does not deploy it to production.');
  const policy = ctl.policyText(rev.rev);

  const copy = async () => {
    try { await navigator.clipboard.writeText(policy); ctl.toast(t('register.copyOk', 'Policy text copied')); }
    catch { ctl.toast(t('register.copyFailed', 'Copy was refused by the browser'), 'error'); }
  };
  const doRegister = () => { const r = ctl.register(); if (r.ok) ctl.toast(t('register.done', 'Registered · not deployed')); else ctl.toast(r.error.message, 'error'); };

  return (
    <Page title={title} sub={sub}>
      <section className="card">
        <div className="check-row"><b>✓</b>{t('register.confirmed', '{rev} confirmed · hash {hash}…', { rev: ctl.revLabel(rev.rev), hash: rev.hash.slice(0, 16) })}</div>
        <div className="check-row"><b>✓</b>{t('register.evidence', 'Validation evidence: {set} · {n} finding(s) remaining in the tested scenarios', { set: d.scenarioSetId, n: d.evidence.findings.length })}</div>
        <div className="check-row"><b>✓</b>{d.action === 'approve' ? t('register.decision', 'Decision: approved “{label}” on {rev}', { label: decisionLabel(parent), rev: ctl.revLabel(parent.rev) }) : t('register.accepted', 'Decision: accepted as is')}</div>
        <Claim />
      </section>
      <section className="card">
        <div className="card-head">
          <h2>{t('register.policy', 'Policy as code')}</h2>
          <button className="btn sm" id="copyPolicyBtn" onClick={copy}>{t('register.copy', 'Copy')}</button>
        </div>
        <pre className="policy">{policy}</pre>
      </section>
      <section className="card row">
        <p>{mine ? <b>{t('register.notDeployed', 'Registered · not deployed.')}</b> : t('register.approved', 'Approved → Registered')}</p>
        <div className="row-actions">
          <button className="btn primary" id="registerBtn" disabled={!!mine} onClick={doRegister}>{mine ? t('register.registered', 'Registered') : t('register.register', 'Register Workflow')}</button>
        </div>
      </section>
      <section className="card">
        <h2>{t('register.inventory', 'Workflow inventory (this browser)')}</h2>
        {inv.length ? (
          <div className="table-wrap"><table className="tbl">
            <thead><tr>{['Workflow', 'Revision', 'Hash', 'Decision', 'Status'].map(x => <th key={x}>{t('register.col.' + x, x)}</th>)}</tr></thead>
            <tbody>{inv.map(x => (
              <tr key={x.key}>
                <td>{x.name}</td><td>{ctl.revLabel(x.rev)}</td><td className="mono">{x.hash.slice(0, 12)}</td>
                <td>{x.decisionRef.action + (x.decisionRef.candidateId ? ' · ' + x.decisionRef.candidateId : '')}</td><td>{x.status}</td>
              </tr>))}</tbody>
          </table></div>
        ) : <p className="muted">{t('register.nothing', 'Nothing registered yet.')}</p>}
      </section>
    </Page>);
}
