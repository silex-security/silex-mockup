/* The spine (plan §3.1): the Enterprise World Model's named layers, each with
   its rung, its grade or provenance, and what this revision supplies. Layers
   are named, never numbered (C2). */
import { t } from '../i18n/index.js';
import { store } from '../state/storeAdapter.js';
import { tr } from './tr.js';

function Row({ id, name, rung, grade, gradeCls = '', summary, open, setOpen, children, empty }) {
  const isOpen = open === id;
  return (
    <section className={'layer' + (isOpen ? ' open' : '') + (empty ? ' is-empty' : '')} data-layer={id}>
      <button className="layer-head" onClick={() => setOpen(isOpen ? null : id)} aria-expanded={isOpen}>
        <span className="layer-name">{name}</span>
        {rung ? <span className="rung" title={t('trace.rung.title', 'Ladder of causation: 1 association · 2 intervention · 3 counterfactual')}>{t('trace.rung', 'rung {n}', { n: rung })}</span> : null}
        <span className={'chip ' + gradeCls}>{grade}</span>
        <span className="layer-sum">{summary}</span>
      </button>
      {isOpen ? <div className="layer-body">{children}</div> : null}
    </section>);
}

export default function Spine({ trace, open, setOpen, onFocus, focus }) {
  const S = trace.schema, L = trace.laws, W = trace.worldState, sim = trace.simulation, O = trace.objectives, cs = trace.candidates, d = trace.decision;
  const g = store.active().graph, label = id => g.nodes.find(n => n.id === id)?.label || id;
  const pending = t('trace.pending.validate', 'Run Validate to fill this layer.');
  const isFocus = (k, r) => focus && focus.kind === k && focus.ref === r;
  return (
    <aside className="spine" id="traceSpine" aria-label={t('trace.spine', 'Enterprise World Model layers')}>
      <h3 className="spine-title">{t('trace.spine', 'Enterprise World Model layers')}</h3>
      <p className="spine-note muted">{t('trace.spine.note', 'These are the world model\'s reasoning layers. The Ontology Graph\'s L1–L4 tiers are a different axis; Schema draws on L1–L3.')}</p>

      <Row id="schema" name={t('trace.layer.schema', 'Schema')} rung={1} grade={t('trace.prov.mapping', 'Silex mapping')} open={open} setOpen={setOpen}
        summary={t('trace.schema.sum', '{m} of {n} steps → {c} classes · {a} associated threats', { m: S.mappedCount, n: S.steps.length, c: S.classes.length, a: S.counts.associated })}>
        <p className="muted">{t('trace.schema.note', 'A step is typed to an ontology class only where its declaration meets the class definition. Threat links come from the Silex ontology bundle: the ids are public, the links are Silex-authored and illustrative.')}</p>
        <table className="tbl mini"><tbody>{S.steps.map(s => (
          <tr key={s.id} data-step={s.id} className={isFocus('step', s.id) ? 'focus' : ''} onClick={() => onFocus({ kind: 'step', ref: s.id })}>
            <td>{s.label}</td><td>{s.classId ? <span className="mono">{s.classId}</span> : <span className="muted" data-unmapped={s.id}>{t('trace.unmappedShort', 'unmapped')} — {tr('unmapped', s.type, s.reason)}</span>}</td></tr>))}</tbody></table>
        <p className="muted">{t('trace.schema.counts', '{r} associated threats are related to a simulated family; {w} have no related family; {o} more related ids sit on classes this declaration does not instantiate.', { r: S.counts.relatedInstantiated, w: S.counts.withoutRelatedFamily, o: S.counts.relatedOutside })}</p>
        <details className="assoc"><summary>{t('trace.schema.assocList', 'Associated with this workflow\'s classes, with no related scenario family ({n})', { n: S.counts.withoutRelatedFamily })}</summary>
          {S.classes.map(c => { const xs = S.associated.filter(a => (a.classIds || [a.classId]).includes(c.id) && !S.related.some(r => r.threatId === a.threatId)); return xs.length ? <div key={c.id}><b>{c.label}</b> <span className="muted">({xs.length})</span><div className="assoc-ids">{xs.map(a => a.url ? <a key={a.threatId} href={a.url} target="_blank" rel="noreferrer" title={a.label}>{a.threatId}</a> : <span key={a.threatId} title={a.label}>{a.threatId}</span>)}</div></div> : null; })}
        </details>
      </Row>

      <Row id="laws" name={t('trace.layer.laws', 'Laws')} rung={2} grade={t('trace.laws.grade', 'declared adversary model · uncalibrated')} open={open} setOpen={setOpen} empty={!L}
        summary={L ? t('trace.laws.sum', '{n} scenario families · 4 laws', { n: L.families.length }) : pending}>
        {L ? L.families.map(f => (
          <div className="fam" key={f.id} data-family={f.id}>
            <div><b>{t('template.' + f.id, f.id)}</b>{f.law ? <> · {tr('law', f.law)}</> : null} <span className="mono muted">{f.violatingRuns}/{f.runs}</span></div>
            <div className="muted">{tr('sampling', f.id, f.sampling)}</div>
            {f.related.length ? f.related.map(r => <div key={r.threatId} className="rel"><span className="mono">{r.threatId}</span> <span className="muted">{tr('limit', `${f.id}.${r.threatId}`, r.limit)}</span></div>) : (f.id === 'benign' ? null : <div className="rel muted">{t('trace.inspect.noThreat', 'No public threat id (a business-outcome failure)')}</div>)}
          </div>)) : <p className="muted">{pending}</p>}
      </Row>

      <Row id="world" name={t('trace.layer.world', 'World State')} rung={1} grade={t('grade.declared', 'declared')} open={open} setOpen={setOpen}
        summary={t('trace.world.sum', 'this declaration · {n} paths from untrusted input to a protected target', { n: W.paths.length })}>
        {W.paths.map((p, i) => <div className="path" key={i}><span className="grade">{t('grade.declared', 'declared')}</span><span>{p.path.map(label).join(' → ')}</span><span className="muted">{p.guards.length ? t('validate.guards', 'guards: {g}', { g: p.guards.map(label).join(', ') }) : t('validate.noGuard', 'no guard on this path')}</span></div>)}
      </Row>

      <Row id="simulation" name={t('trace.layer.simulation', 'Simulation')} rung={2} grade={t('grade.simulated', 'simulated')} open={open} setOpen={setOpen} empty={!sim}
        summary={sim ? t('trace.sim.sum', '{r} runs · {f} findings', { r: sim.runs, f: sim.findings.length }) : pending}>
        {sim ? sim.findings.map(f => (
          <button key={f.id} className={'row-link' + (isFocus('finding', f.id) ? ' focus' : '')} data-trace-finding={f.id} onClick={() => onFocus({ kind: 'finding', ref: f.id })}>
            <span className={'chip ' + (f.severity === 'critical' ? 'bad' : 'warn')}>{t('severity.' + f.severity, f.severity)}</span> {label(f.prohibited)} <span className="muted">· {t('template.' + f.family, f.family)}</span> <span className="mono muted">{f.violating}/{f.run}</span></button>)) : <p className="muted">{pending}</p>}
      </Row>

      <Row id="objectives" name={t('trace.layer.objectives', 'Objectives')} rung={2} grade={t('trace.obj.grade', 'declared rule · uncalibrated')} open={open} setOpen={setOpen}
        summary={t('trace.obj.sum', 'eligibility gates, then rank by friction → latency → patch size')}>
        <h4>{t('trace.obj.elig', 'Eligible only if')}</h4>
        <ul>{O.eligibility.map((e, i) => <li key={i}>{tr('elig', String(i), e)}</li>)}</ul>
        <h4>{t('trace.obj.rank', 'Then ranked by')}</h4>
        <ol>{O.rank.map(r => <li key={r}>{tr('rank', r)}</li>)}</ol>
        <p className="muted">{t('trace.obj.approx', 'Approximated: {a}. Not modelled: {n}.', { a: O.approximated.map(x => tr('obj', x)).join(', '), n: O.notModelled.map(x => tr('obj', x)).join(', ') })}</p>
      </Row>

      <Row id="calibration" name={t('trace.layer.calibration', 'Calibration')} rung={3} grade={t('trace.notAvailable', 'not available')} open={open} setOpen={setOpen} empty
        summary={t('trace.cal.sum', 'needs production outcome records')}>
        <p className="muted">{t('trace.cal.body', 'Calibration compares what was predicted with production outcome records, and attributes a miss to a layer. At design time there are no outcome records, so this layer stays empty; nothing here is estimated.')}</p>
      </Row>

      <Row id="decision" name={t('trace.layer.decision', 'Decision')} grade={d ? t('trace.dec.made', 'decided by a person') : t('trace.dec.none', 'no decision yet')} gradeCls={d ? 'ok' : ''} open={open} setOpen={setOpen}
        summary={cs ? t('trace.dec.sum', '{n} candidates · recommended by the objectives rule: {r}', { n: cs.length, r: cs.find(c => c.id === trace.recommended)?.label || '—' }) : t('trace.pending.optimize', 'Run Optimize to test candidate fixes.')}>
        <div className="ladder" id="promotionLadder">
          {trace.stage.validated ? <span className="chip ok">{t('trace.ladder.simulation', 'Simulation')} ✓</span> : <span className="chip">{t('trace.ladder.simulation', 'Simulation')} · {t('trace.notRun', 'not run')}</span>}→<span className="chip">{t('trace.ladder.shadow', 'Shadow')} · {t('trace.notRun', 'not run')}</span>→<span className="chip">{t('trace.ladder.canary', 'Canary')} · {t('trace.notRun', 'not run')}</span>→<span className="chip">{t('trace.ladder.production', 'Production')} · {t('trace.notRun', 'not run')}</span>
        </div>
        <p className="muted">{t('trace.ladder.note', 'Simulation is a filter, not a verdict. Shadow, canary and production are outside this demo.')}</p>
        {cs ? cs.map(c => (
          <button key={c.id} className={'row-link cand-row ' + c.state + (isFocus('candidate', c.id) ? ' focus' : '')} data-trace-cand={c.id} onClick={() => onFocus({ kind: 'candidate', ref: c.id })}>
            <span className={'chip ' + ({ eligible: 'ok', approved: 'ok', ineligible: 'bad', stale: '', rejected: 'warn' }[c.state])}>{t('trace.state.' + c.state, c.state)}</span> {c.label}{c.id === trace.recommended ? <span className="chip blue">{t('trace.recommended', 'recommended')}</span> : null}</button>)) : null}
      </Row>
    </aside>);
}
