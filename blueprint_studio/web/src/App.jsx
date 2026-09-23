/* App shell: top bar, Builder | Assurance views, stage stepper (guards ported
   from v1 js/app.js stageEnabled), toast. */
import { useRef, useState } from 'react';
import { useStudio, store } from './state/storeAdapter.js';
import { pending } from './state/pendingInputs.js';
import * as ctl from './state/controller.js';
import { t, getLang, setLang } from './i18n/index.js';
import Icon, { I } from './ui/Icon.jsx';
import Builder from './builder/Builder.jsx';
import Checklist from './builder/Checklist.jsx';
import Confirm from './assurance/Confirm.jsx';
import Validate from './assurance/Validate.jsx';
import Optimize from './assurance/Optimize.jsx';
import Decide from './assurance/Decide.jsx';
import Register from './assurance/Register.jsx';
import { lint } from '../../js/validate.js';

const STAGES = ['confirm', 'validate', 'optimize', 'decide', 'register'];
export function stageEnabled(st) {
  const r = store.active(), v = r.validation, conf = r.status === 'confirmed';
  switch (st) {
    case 'confirm': return true;
    case 'validate': return conf;
    case 'optimize': return conf && !!v && (v.result.findings.length > 0 || r.origin === 'approve');
    case 'decide': return conf && (!!r.optimization || !!r.decision || r.origin === 'approve' || (!!v && v.result.findings.length === 0));
    case 'register': return r.origin === 'approve' || r.decision?.action === 'accept';
    default: return false;
  }
}
function stageDone(st) {
  const r = store.active();
  return { confirm: r.status === 'confirmed', validate: !!r.validation, optimize: !!r.optimization || r.origin === 'approve', decide: ctl.isDecided(r), register: store.inventory().some(x => x.docId === store.doc.id && x.rev === r.rev) }[st];
}
const PAGES = { confirm: Confirm, validate: Validate, optimize: Optimize, decide: Decide, register: Register };

function About({ onClose }) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="aboutTitle" onClick={e => e.stopPropagation()}>
        <h2 id="aboutTitle">{t('about.title', 'About Agentic Blueprint Studio')}</h2>
        <p>{t('about.what', 'Draw an agentic workflow, confirm it, then test it against scripted attack scenarios, compare candidate fixes, approve one and register it.')}</p>
        <h3>{t('about.realTitle', 'What is real')}</h3>
        <p>{t('about.real', 'The editor, the engine that runs your graph node by node, the monitors, and every number: each comes from runs of the graph on screen. The same graph and scenario set always give the same results.')}</p>
        <h3>{t('about.simTitle', 'What is simulated')}</h3>
        <p>{t('about.sim', 'There are no real agents, tools or AI models. Agents behave according to a declared adversary model: they follow instructions injected into untrusted input, may split requests if allowed, and reuse approvals when the binding lets them. “0 violations in the tested scenarios” is a sample, not a proof. Nothing is ever deployed.')}</p>
        <h3>{t('about.viewerTitle', 'In this viewer')}</h3>
        <p>{t('about.viewer', 'Work is saved in this browser only. Some viewers block file downloads: use File → Copy JSON instead. Import works everywhere.')}</p>
        <p className="muted">{t('about.built', 'Canvas: React Flow (MIT). Layout: dagre (MIT). Search: cmdk (MIT).')}</p>
        <div className="row-actions"><button className="btn primary" autoFocus onClick={onClose}>{t('about.close', 'Close')}</button></div>
      </div>
    </div>);
}

function DocMenu({ onClose, onAbout }) {
  const file = useRef(null);
  const copy = async () => { const txt = ctl.exportText(); try { await navigator.clipboard.writeText(txt); ctl.toast(t('menu.copied', 'Document JSON copied')); } catch { ctl.toast(t('menu.copyFailed', 'Copy was refused by the browser'), 'error'); } onClose(); };
  const download = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ctl.exportText()], { type: 'application/json' })); a.download = (store.doc.name || 'blueprint').replace(/[^\w.\- ]+/g, '_') + '.json'; document.body.append(a); a.click(); a.remove(); onClose(); };
  return (
    <div className="menu" role="menu">
      <div className="menu-label">{t('menu.new', 'New from template')}</div>
      <button role="menuitem" onClick={() => { ctl.startFromTemplate('customer-refund'); onClose(); }}>{t('tpl.refund', 'Customer Refund')}</button>
      <button role="menuitem" onClick={() => { ctl.startFromTemplate('vendor-bank-change'); onClose(); }}>{t('tpl.vendor', 'Vendor Bank-Detail Change')}</button>
      <button role="menuitem" onClick={() => { ctl.startBlank(); onClose(); }}>{t('tpl.blank', 'Blank workflow')}</button>
      <div className="menu-sep" />
      <button role="menuitem" onClick={() => file.current.click()}><Icon d={I.upload} />{t('menu.import', 'Import JSON…')}</button>
      <button role="menuitem" onClick={download}><Icon d={I.file} />{t('menu.export', 'Download JSON')}</button>
      <button role="menuitem" id="copyJsonBtn" onClick={copy}><Icon d={I.copy} />{t('menu.copy', 'Copy JSON')}</button>
      <input ref={file} type="file" accept="application/json,.json" hidden onChange={async e => { const f = e.target.files[0]; e.target.value = ''; if (f) ctl.importText(await f.text()); onClose(); }} />
      <div className="menu-sep" />
      <button role="menuitem" id="aboutBtn" onClick={() => { onClose(); onAbout(); }}><Icon d={I.info} />{t('menu.about', 'About this demo')}</button>
      <p className="menu-note">{t('menu.note', 'Everything runs in this browser and is saved here only. Some viewers block downloads; use Copy JSON there.')}</p>
    </div>);
}

export default function App() {
  useStudio();
  const [menu, setMenu] = useState(false);
  const [check, setCheck] = useState(false);
  const [about, setAbout] = useState(false);
  const route = ctl.getRoute(), doc = store.doc;
  if (!doc) return null;
  const rev = store.active();
  const issues = lint(rev.graph), errs = issues.filter(i => i.severity === 'error').length, total = issues.length + pending.size;
  const Page = PAGES[route.stage] || Validate;
  const stage = route.view === 'assurance' && !stageEnabled(route.stage) ? 'confirm' : route.stage;
  const StagePage = PAGES[stage] || Page;
  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="https://silex-mockup.vercel.app/" title="SILEX"><span className="logo" />SILEX</a>
        <div className="doc">
          <strong className="doc-name" title={doc.name}>{doc.name}</strong>
          <select id="revSelect" aria-label={t('top.revision', 'Revision')} value={rev.rev} onChange={e => ctl.setActiveRevision(Number(e.target.value))}>
            {doc.revisions.map(r => <option key={r.rev} value={r.rev}>{ctl.revLabel(r.rev)} · {r.status === 'draft' ? t('status.draft', 'draft') : t('status.confirmed', 'confirmed')}{r.origin === 'approve' ? ' · ' + t('status.approved', 'approved fix') : ''}</option>)}
          </select>
          <span className={'chip ' + (rev.status === 'draft' ? 'warn' : 'ok')} id="revChip">{rev.status === 'draft' ? t('status.draft', 'draft') : t('status.locked', 'confirmed · locked')}</span>
        </div>
        <nav className="seg" aria-label={t('top.views', 'Views')}>
          <button className={route.view === 'builder' ? 'on' : ''} id="navBuilder" onClick={() => ctl.go('builder')}>{t('top.builder', 'Builder')}</button>
          <button className={route.view === 'assurance' ? 'on' : ''} id="navAssurance" onClick={() => ctl.go('assurance', stage)}><Icon d={I.shield} />{t('top.assurance', 'Assurance')}</button>
        </nav>
        <div className="top-actions">
          {route.view === 'builder' ? <>
            <button className="btn ghost sm" id="undoBtn" title={t('top.undo', 'Undo')} disabled={!store.canUndo()} onClick={() => store.dispatch({ type: 'undo' })}><Icon d={I.undo} /></button>
            <button className="btn ghost sm" id="redoBtn" title={t('top.redo', 'Redo')} disabled={!store.canRedo()} onClick={() => store.dispatch({ type: 'redo' })}><Icon d={I.redo} /></button>
            <div className="pop-anchor">
              <button className={'btn sm ' + (errs || pending.size ? 'danger' : '')} id="checklistBtn" onClick={() => setCheck(c => !c)}><Icon d={I.list} />{t('top.checklist', 'Checklist')}<span className="count">{total}</span></button>
              {check ? <Checklist onClose={() => setCheck(false)} /> : null}
            </div>
            <button className={'btn sm ' + (route.panel === 'assist' ? 'primary' : '')} id="askAiBtn" onClick={() => ctl.setPanel(route.panel === 'assist' ? null : 'assist')}><Icon d={I.spark} />{t('top.askAi', 'Ask AI')}</button>
            <button className="btn primary sm" id="testRunBtn" onClick={() => ctl.setPanel(route.panel === 'run' ? null : 'run')}><Icon d={I.play} />{t('top.testRun', 'Test run')}</button>
          </> : null}
          <button className="btn ghost sm" id="langBtn" onClick={() => setLang(getLang() === 'zh' ? 'en' : 'zh')} title="中文 / English"><Icon d={I.globe} />{t('app.lang', '中文')}</button>
          <div className="pop-anchor"><button className="btn sm" id="docMenuBtn" onClick={() => setMenu(m => !m)}>{t('top.file', 'File')}</button>{menu ? <DocMenu onClose={() => setMenu(false)} onAbout={() => setAbout(true)} /> : null}</div>
        </div>
      </header>
      {route.view === 'builder' ? <Builder /> : (
        <main className="assurance">
          <nav className="stages" aria-label={t('top.stages', 'Assurance stages')}>
            {STAGES.map((s, i) => (
              <button key={s} data-stage={s} className={'stage' + (s === stage ? ' on' : '') + (stageDone(s) && s !== stage ? ' done' : '')} disabled={!stageEnabled(s)} onClick={() => ctl.go('assurance', s)}>
                <b>{stageDone(s) && s !== stage ? '✓' : i + 1}</b>{t('stage.' + s, s[0].toUpperCase() + s.slice(1))}
              </button>))}
            <span className="stage-note">{t('stage.note', 'Simulated against a declared adversary model · no real agents or tools are run')}</span>
          </nav>
          <div className="assurance-body"><StagePage /></div>
        </main>)}
      {about ? <About onClose={() => setAbout(false)} /> : null}
      {route.toast ? <div className={'toast ' + route.toast.kind} role="status">{route.toast.text}</div> : null}
    </div>);
}
