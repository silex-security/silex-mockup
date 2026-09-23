/* Decide (ported from js/app.js renderDecide; plan §5 Task 3). Approve only
   when controller.approvable; Modify re-runs via the Optimize page; Accept as
   is only when there are no findings. Keeps #approveBtn / #rejectBtn /
   #modifyBtn / #acceptBtn / #toRegisterBtn / #decideChip. */
import { useStudio, store } from '../state/storeAdapter.js';
import * as ctl from '../state/controller.js';
import { t } from '../i18n/index.js';
import { Page, Claim, MetricsRow, ScoreCard, DiffList, describeOp, candLabel, decisionLabel } from './common.jsx';

function EvidenceCard({ title, ev }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      <div className="muted">{t('decide.baseline', 'Baseline')}</div>
      {ev.baseline ? <MetricsRow m={ev.baseline.metrics} /> : null}
      <div className="muted">{t('decide.with', 'With the approved change')}</div>
      <MetricsRow m={ev.metrics} />
      <Claim />
    </section>);
}

export default function Decide() {
  useStudio();
  const rev = store.active();
  const title = t('decide.title', 'Decide');
  const sub = t('decide.sub', 'A human decides. Approving creates a new confirmed revision containing exactly the tested patch; nothing is deployed.');
  const extra = t('decide.claimExtra', 'On approval SILEX would open a pull request against your policy-as-code; here it only records the decision and the new revision.');

  if (rev.origin === 'approve') {
    const parent = store.revision(rev.parent), d = parent.decision;
    return (
      <Page title={title} sub={sub}>
        <section className="card row">
          <p><b>{t('decide.approved', '{child} = {parent} + “{label}”.', { child: ctl.revLabel(rev.rev), parent: ctl.revLabel(parent.rev), label: decisionLabel(parent) })}</b> {t('decide.run', 'Approved from run {run} on {set}.', { run: d.runId, set: d.scenarioSetId })}</p>
          <button className="btn primary" id="toRegisterBtn" onClick={() => ctl.go('assurance', 'register')}>{t('nav.toRegister', 'Register →')}</button>
        </section>
        <EvidenceCard title={t('decide.evidence', 'Decision evidence')} ev={d.evidence} />
        <section className="card"><h2>{t('decide.patch', 'The approved patch')}</h2><DiffList diff={ctl.diffGraphs(parent.graph, rev.graph)} a={parent.graph} b={rev.graph} /></section>
      </Page>);
  }

  if (rev.decision) {
    const d = rev.decision;
    return (
      <Page title={title} sub={sub}>
        <section className="card row">
          <p><b>{d.action === 'accept' ? t('decide.accepted', 'Accepted as is.') : t('decide.approvedTo', 'Approved “{label}” → {rev}.', { label: decisionLabel(rev), rev: ctl.revLabel(d.childRev) })}</b> {t('decide.thisDecided', 'This revision is decided.')}</p>
          {d.action === 'approve'
            ? <button className="btn primary" onClick={() => { ctl.setActiveRevision(d.childRev); ctl.go('assurance', 'decide'); }}>{t('decide.open', 'Open {rev} →', { rev: ctl.revLabel(d.childRev) })}</button>
            : <button className="btn primary" id="toRegisterBtn" onClick={() => ctl.go('assurance', 'register')}>{t('nav.toRegister', 'Register →')}</button>}
        </section>
      </Page>);
  }

  const v = rev.validation;
  if (v && !v.result.findings.length) {
    return (
      <Page title={title} sub={sub}>
        <section className="card row">
          <p>{t('decide.noFindings', 'No violations in {n} tested scenarios; no change needed.', { n: v.result.runs.length })}</p>
          <button className="btn primary" id="acceptBtn" onClick={() => { if (ctl.accept().ok) ctl.go('assurance', 'register'); }}>{t('decide.accept', 'Accept as is')}</button>
        </section>
      </Page>);
  }

  const o = rev.optimization;
  const route = ctl.getRoute();
  const id = route.decideId && o && o.candidates.some(c => c.candidate.id === route.decideId) ? route.decideId : ctl.recommendedId(rev);
  const c = id && o ? o.candidates.find(x => x.candidate.id === id) : null;
  if (!c) {
    return (
      <Page title={title} sub={sub}>
        <section className="card row">
          <p>{t('decide.noCandidate', 'No acceptable candidate. Modify a candidate’s parameters, or go back and change the blueprint in a new revision.')}</p>
          <button className="btn" onClick={() => ctl.go('assurance', 'optimize')}>{t('decide.back', '← Candidates')}</button>
        </section>
      </Page>);
  }
  const ok = ctl.approvable(rev, c);
  const chipText = ok
    ? (c.candidate.id === ctl.recommendedId(rev) ? t('decide.chipRecommended', 'Recommended · ready for approval') : t('decide.chipEligible', 'Eligible · ready for approval'))
    : c.state === 'rejected' ? t('status.rejected', 'Rejected')
      : c.state === 'stale' ? t('status.stale', 'Stale — re-running')
        : t('status.notEligible', 'Not eligible');
  const patched = ctl.patchedGraph(rev, c.candidate);
  return (
    <Page title={title} sub={sub}>
      <section className="card">
        <div className="card-head">
          <div><h2>{t('decide.head', 'Decision · {doc} {rev}', { doc: store.doc.name, rev: ctl.revLabel(rev.rev) })}</h2><p className="muted">{candLabel(c.candidate)}</p></div>
          <span className={'chip ' + (ok ? 'ok' : 'warn')} id="decideChip">{chipText}</span>
        </div>
        <ul>{c.candidate.patch.map((op, i) => <li key={i}>{describeOp(rev.graph, op)}</li>)}</ul>
        {c.verdict ? <ScoreCard sc={c.verdict.scorecard || {}} /> : null}
        <div className="muted">{t('decide.baseline', 'Baseline')}</div><MetricsRow m={v.result.metrics} />
        {c.result?.metrics ? <div className="muted">{t('decide.with', 'With this candidate')}</div> : null}
        {c.result?.metrics ? <MetricsRow m={c.result.metrics} /> : null}
        <Claim extra={extra} />
      </section>
      {patched.ok ? <section className="card"><h2>{t('decide.whatChanges', 'What approval changes')}</h2><DiffList diff={ctl.diffGraphs(rev.graph, patched.value)} a={rev.graph} b={patched.value} /></section> : null}
      <section className="card row">
        <p className="muted">{t('decide.explain', 'Approve accepts this tested candidate. Modify changes its parameters and re-runs it. Reject removes it from consideration.')}</p>
        <div className="row-actions">
          <button className="btn danger" id="rejectBtn" disabled={c.state === 'rejected'} onClick={() => { ctl.reject(c.candidate.id); ctl.setDecideId(null); ctl.go('assurance', 'optimize'); }}>{t('optimize.reject', 'Reject')}</button>
          <button className="btn" id="modifyBtn" onClick={() => ctl.go('assurance', 'optimize')}>{t('decide.modify', 'Modify')}</button>
          <button className="btn primary" id="approveBtn" disabled={!ok} onClick={() => { const r = ctl.approve(c.candidate.id); if (r.ok) { ctl.toast(t('decide.approvedToast', 'Approved → {rev} (confirmed)', { rev: ctl.revLabel(r.value) })); ctl.go('assurance', 'register'); } }}>{t('decide.approve', 'Approve')}</button>
        </div>
      </section>
    </Page>);
}
