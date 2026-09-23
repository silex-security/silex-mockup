/* Optimize (ported from js/app.js renderOptimize + paramControls + scoreBox;
   plan §5 Task 3). Candidate labels and eligibility come from each candidate's
   own run; Modify re-runs through controller.modifyCandidate with the
   paramOptions selects. Keeps #runOptimizeBtn, .cand[data-cand], [data-reject],
   [data-modify], select[data-param]. */
import { useState } from 'react';
import { useStudio, store } from '../state/storeAdapter.js';
import * as ctl from '../state/controller.js';
import { t } from '../i18n/index.js';
import { Page, Claim, MetricsRow, ScoreCard, Progress, describeOp, candLabel } from './common.jsx';

/* Readable option text for the Modify selects (plan §5 Task 3):
   {field, x} -> "amount > 500", {variant} -> the two injection labels. */
const fmtOpt = o => {
  if (!o || typeof o !== 'object') return String(o);
  if ('field' in o && 'x' in o) return `${t('opt.field.' + o.field, o.field)} > ${o.x}`;
  if ('variant' in o) return t('opt.variant.' + o.variant, o.variant === 'a' ? 'move secret read to the tool' : 'redact before external emit');
  return JSON.stringify(o);
};

function tag(rev, c, isRec) {
  if (c.state === 'rejected') return <span className="chip bad tag">{t('status.rejected', 'Rejected')}</span>;
  if (c.state === 'stale') return <span className="chip warn tag">{t('status.stale', 'Stale · re-running')}</span>;
  if (isRec) return <span className="chip ok tag">{t('status.recommended', 'Recommended')}</span>;
  if (c.verdict?.eligible) return <span className="chip tag">{t('status.eligible', 'Eligible')}</span>;
  return <span className="chip warn tag">{t('status.notEligible', 'Not eligible')}</span>;
}

function ParamControls({ rev, c }) {
  const locked = ctl.isDecided(rev);
  const opts = c.candidate.paramOptions || {};
  const keys = Object.keys(opts);
  if (!keys.length) return null;
  const [vals, setVals] = useState(() => Object.fromEntries(keys.map(k => [k, JSON.stringify(c.candidate.params[k])])));
  const disabled = locked || c.state === 'rejected';
  return (
    <div className="params">
      {keys.map(k => (
        <select key={k} data-param={k} disabled={disabled} value={vals[k]}
          onChange={e => setVals(s => ({ ...s, [k]: e.target.value }))}>
          {opts[k].map(o => <option key={JSON.stringify(o)} value={JSON.stringify(o)}>{k}: {fmtOpt(o)}</option>)}
        </select>))}
      <button className="btn sm" data-modify={c.candidate.id} disabled={disabled} onClick={() => {
        const params = { ...c.candidate.params }; for (const k of keys) params[k] = JSON.parse(vals[k]);
        ctl.modifyCandidate(c.candidate.id, params);
      }}>{t('optimize.modify', 'Modify & re-run')}</button>
    </div>);
}

export default function Optimize() {
  useStudio();
  const rev = store.active(), o = rev.optimization, decided = ctl.isDecided(rev);
  const title = t('optimize.title', 'Optimize');
  const sub = t('optimize.sub', 'Candidate fixes generated from the findings, each tested on the frozen scenario set of the validation.');
  if (rev.origin === 'approve') return (
    <Page title={title} sub={sub}>
      <section className="card">
        <h2>{t('optimize.approved', '{rev} was created by approving a fix of {parent}', { rev: ctl.revLabel(rev.rev), parent: ctl.revLabel(rev.parent) })}</h2>
        <p className="muted">{t('optimize.approvedSub', 'Its evidence is the approved candidate’s run. See Decide on the parent revision.')}</p>
      </section>
    </Page>);
  if (ctl.jobs.running === 'optimize') return <Page title={title} sub={sub}><Progress label={t('optimize.running', 'Testing candidates…')} done={ctl.jobs.done} total={ctl.jobs.total} /></Page>;
  if (!o) return (
    <Page title={title} sub={sub}>
      <section className="card row">
        <p className="muted">{t('optimize.none', 'No candidates yet.')}</p>
        <div className="row-actions"><button className="btn primary" id="runOptimizeBtn" disabled={decided} onClick={() => ctl.runOptimize()}>{t('optimize.run', 'Generate and test candidates')}</button></div>
      </section>
    </Page>);
  const rec = ctl.recommendedId(rev);
  const recRec = rec ? o.candidates.find(c => c.candidate.id === rec) : null;
  const sorted = [...o.candidates].sort((a, b) => (b.candidate.id === rec) - (a.candidate.id === rec) || (b.verdict?.eligible ? 1 : 0) - (a.verdict?.eligible ? 1 : 0));
  return (
    <Page title={title} sub={sub}>
      <section className="card">
        <div className="card-head">
          <div>
            <h2>{rec ? t('optimize.recReady', 'Recommendation ready') : t('optimize.noRec', 'No acceptable candidate')}</h2>
            <p className="muted">{t('optimize.eligibility', 'Eligible = lint clean, benign completion within 2 pp of baseline, no monitor worse than baseline, every critical finding at 0 violations in the tested scenarios. Recommended = the eligible candidate with the lowest friction, then lowest added latency, then fewest patch ops.')}</p>
          </div>
          <span className={'chip ' + (rec ? 'ok' : 'bad')}>{rec ? t('optimize.recommended', 'Recommended: {label}', { label: recRec ? candLabel(recRec.candidate) : rec }) : t('optimize.nothing', 'Nothing recommended')}</span>
        </div>
        <div className="muted">{t('optimize.baseline', 'Baseline')}</div>
        <MetricsRow m={rev.validation.result.metrics} />
        <Claim />
      </section>
      <div className="cand-grid">
        {sorted.map(c => {
          const isRec = c.candidate.id === rec;
          return (
            <div className={'cand' + (isRec ? ' recommended' : '') + (c.state === 'rejected' ? ' rejected' : '')} data-cand={c.candidate.id} key={c.candidate.id}>
              {tag(rev, c, isRec)}
              <h3>{candLabel(c.candidate)}</h3>
              <div className="muted">{c.candidate.kind} · {t('optimize.paramsV', 'params v{n}', { n: c.candidate.paramsVersion })}</div>
              <ul>{c.candidate.patch.map((op, i) => <li key={i}>{describeOp(rev.graph, op)}</li>)}</ul>
              {c.verdict ? <ScoreCard sc={c.verdict.scorecard || {}} /> : <p className="muted">{t('optimize.notTested', 'Not tested for these parameters yet.')}</p>}
              {c.verdict && !c.verdict.eligible ? <ul className="reasons">{(c.verdict.reasons || []).map((r, i) => <li key={i}>✗ {r}</li>)}</ul> : null}
              <ParamControls key={c.candidate.id + ':' + c.candidate.paramsVersion} rev={rev} c={c} />
              <div className="acts">
                <button className="btn sm primary" disabled={c.state === 'rejected'} onClick={() => { ctl.setDecideId(c.candidate.id); ctl.go('assurance', 'decide'); }}>{t('optimize.review', 'Review decision →')}</button>
                <button className="btn sm danger" data-reject={c.candidate.id} disabled={c.state === 'rejected' || decided} onClick={() => ctl.reject(c.candidate.id)}>{t('optimize.reject', 'Reject')}</button>
              </div>
            </div>);
        })}
      </div>
    </Page>);
}
