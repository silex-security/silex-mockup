/* Validate (the worked pattern for the Assurance pages; plan §5 Task 0).
   Reads the store through useStudio(), mutates nothing itself: runs go through
   controller.runValidation(), which binds the result to a job id and the
   revision hash so a late or superseded result is refused by the store. */
import { useState } from 'react';
import { useStudio, store } from '../state/storeAdapter.js';
import * as ctl from '../state/controller.js';
import { t } from '../i18n/index.js';
import { Page, MetricsRow, Claim, Progress, pathLabel, nodeLabelIn } from './common.jsx';

export default function Validate() {
  useStudio();
  const rev = store.active(), v = rev.validation, decided = ctl.isDecided(rev);
  const [n, setN] = useState(40);
  const title = t('validate.title', 'Validate');
  const sub = t('validate.sub', 'If this workflow were deployed, which unsafe outcomes could the declared graph reach under the adversary scenarios?');
  if (ctl.jobs.running === 'validate') return <Page title={title} sub={sub}><Progress label={t('validate.running', 'Running scenarios…')} done={ctl.jobs.done} total={ctl.jobs.total} /></Page>;
  if (!v) return (
    <Page title={title} sub={sub}>
      <section className="card row">
        <div><h2>{t('validate.baseline', 'Baseline simulation')}</h2><p className="muted">{t('validate.frozen', 'Scenarios are generated once from this revision’s hash and frozen; every candidate fix is later tested on the same set.')}</p></div>
        <div className="row-actions">
          <select id="nSelect" value={n} onChange={e => setN(Number(e.target.value))}>{[20, 40, 100].map(k => <option key={k} value={k}>{t('validate.perTemplate', '{n} per template ({m} scenarios)', { n: k, m: k * 6 })}</option>)}</select>
          <button className="btn primary" id="runValidationBtn" disabled={decided} onClick={() => ctl.runValidation(n)}>{t('validate.run', 'Run validation')}</button>
        </div>
      </section>
    </Page>);
  const res = v.result;
  return (
    <Page title={title} sub={sub}>
      <section className="card">
        <div className="card-head">
          <div><h2>{t('validate.results', 'Results · {rev}', { rev: ctl.revLabel(rev.rev) })}</h2><p className="muted">{t('validate.summary', 'Scenario set {id} · {runs} scenarios · {f} finding(s)', { id: v.scenarioSetId, runs: res.runs.length, f: res.findings.length })}</p></div>
          <span className={'chip ' + (res.findings.length ? 'bad' : 'ok')}>{res.findings.length ? t('validate.risk', 'Risk identified') : t('validate.clean', 'No violations in tested scenarios')}</span>
        </div>
        <MetricsRow m={res.metrics} />
        <Claim />
      </section>
      <section className="card" id="findingsCard">
        <h2>{t('validate.findings', 'Findings')}</h2>
        <p className="muted">{t('validate.findings.sub', 'A finding is a monitor that fired in at least one scenario of a template. Paths are the executed node sequences of the violating runs. Evidence grade: Declared (from configuration, before deploy).')}</p>
        {res.findings.length === 0 ? <p className="muted">{t('validate.none', 'No violations in the tested scenarios.')}</p> : (
          <div className="table-wrap"><table className="tbl">
            <thead><tr><th>{t('validate.col.outcome', 'Unsafe outcome')}</th><th>{t('validate.col.category', 'Category')}</th><th>{t('validate.col.severity', 'Severity')}</th><th>{t('validate.col.violating', 'Violating / run')}</th><th>{t('validate.col.paths', 'Violating paths (from traces)')}</th></tr></thead>
            <tbody>{res.findings.map(f => (
              <tr key={f.id} data-finding={f.id}>
                <td><b>{nodeLabelIn(rev.graph, f.prohibited)}</b><div className="muted">{t('validate.via', 'via {tpl} scenarios', { tpl: t('template.' + f.template, f.template.replace(/_/g, ' ')) })}</div></td>
                <td>{t('category.' + f.category, f.category)}</td>
                <td><span className={'chip ' + (f.severity === 'critical' ? 'bad' : 'warn')}>{t('severity.' + f.severity, f.severity)}</span></td>
                <td className="mono">{f.violating} / {f.run}<div><button className="linkish" data-trace-link={f.id} onClick={() => ctl.openTrace('finding', f.id)}>{t('trace.link', 'Trace →')}</button></div></td>
                <td>{f.paths.slice(0, 3).map((p, i) => <div className="path" key={i}><span className="grade">{t('grade.declared', 'Declared')}</span><span>{pathLabel(rev.graph, p.nodes)}</span><span className="muted">{t('validate.activations', '{n} activation(s)', { n: p.count })}</span></div>)}
                  {f.paths.length > 3 ? <div className="muted">{t('validate.morePaths', '+{n} more paths', { n: f.paths.length - 3 })}</div> : null}</td>
              </tr>))}</tbody>
          </table></div>)}
      </section>
      <section className="card">
        <h2>{t('validate.potential', 'Potential paths (declared graph)')}</h2>
        <p className="muted">{t('validate.potential.sub', 'Static flow paths from each untrusted trigger to what each monitor watches. Potential, not a violation.')}</p>
        {res.potential.length ? res.potential.map((p, i) => <div className="path" key={i}><span className="grade">{t('grade.potential', 'potential')}</span><span>{pathLabel(rev.graph, p.path)}</span><span className="muted">{p.guards.length ? t('validate.guards', 'guards: {g}', { g: p.guards.map(g => nodeLabelIn(rev.graph, g)).join(', ') }) : t('validate.noGuard', 'no guard on this path')}</span></div>) : <p className="muted">—</p>}
      </section>
      <section className="card row">
        <p className="muted">{decided ? t('validate.decided', 'This revision is decided; its evidence is frozen. Create a new revision to re-validate.') : res.findings.length ? t('validate.next', 'Next: candidate controls are generated from the findings and each is tested on this same scenario set.') : t('validate.nothing', 'Nothing to fix in the tested scenarios.')}</p>
        <div className="row-actions">
          <button className="btn" id="rerunValidationBtn" disabled={decided} onClick={() => ctl.runValidation(v.n)}>{t('validate.rerun', 'Re-run')}</button>
          {rev.origin === 'approve' ? <button className="btn primary" onClick={() => ctl.go('assurance', 'register')}>{t('nav.toRegister', 'Register →')}</button>
            : res.findings.length ? <button className="btn primary" id="toOptimizeBtn" disabled={decided} onClick={() => { ctl.go('assurance', 'optimize'); if (!store.active().optimization) ctl.runOptimize(); }}>{t('validate.toOptimize', 'Generate and test fixes →')}</button>
              : <button className="btn primary" id="toDecideBtn" onClick={() => ctl.go('assurance', 'decide')}>{t('nav.toDecide', 'Review decision →')}</button>}
        </div>
      </section>
    </Page>);
}
