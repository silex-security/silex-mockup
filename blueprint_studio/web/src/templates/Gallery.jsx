/* Template gallery, after n8n's template browser (plan §3.11–3.11.2): category
   tabs, bilingual search, cards with the n8n pattern each template is modelled
   on, its integrations, what `amount` means, and the step mix. Templates are our
   own typed graphs; integrations are steps, not live connections. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStudio } from '../state/storeAdapter.js';
import * as ctl from '../state/controller.js';
import { t, getLang } from '../i18n/index.js';
import zh from '../i18n/zh.js';
import Icon, { I } from '../ui/Icon.jsx';
import { entry } from '../builder/catalog.js';

const tx = (id, key, fallback) => t(`tpl.${id}.${key}`, fallback || '');
const MODELLED = /\s*Modelled on a common n8n pattern; integrations are represented as steps, not live connections\.\s*/;

function TypeStrip({ graph }) {
  const counts = graph.nodes.reduce((m, n) => ({ ...m, [n.type]: (m[n.type] || 0) + 1 }), {});
  const order = ['trigger', 'agent', 'tool', 'decision', 'control', 'data', 'outcome', 'prohibited'];
  return (
    <div className="type-strip" aria-label={t('gallery.mix', 'Step mix')}>
      {order.filter(k => counts[k]).map(k => (
        <span key={k} className="ts" style={{ '--tc': entry(k)?.color }} title={t(`node.${k}.label`, entry(k)?.label)}>
          <svg viewBox="0 0 24 24" className="icon"><path d={entry(k)?.icon} /></svg>{counts[k]}
        </span>))}
    </div>);
}

export default function Gallery() {
  useStudio();
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const box = useRef(null);
  useEffect(() => {
    const esc = e => { if (e.key === 'Escape') ctl.openGallery(false); };
    document.addEventListener('keydown', esc);
    box.current?.querySelector('input')?.focus();
    return () => document.removeEventListener('keydown', esc);
  }, []);
  const all = ctl.TEMPLATE_IDS.map(id => ({ id, tpl: ctl.TEMPLATES[id] }));
  const text = ({ id, tpl }) => [tpl.name, tpl.description, tpl.n8nPattern, tpl.category, ...(tpl.integrations || []),
    zh[`tpl.${id}.name`], zh[`tpl.${id}.desc`], zh[`tpl.${id}.pattern`], zh[`gallery.cat.${tpl.category}`]].filter(Boolean).join(' ').toLowerCase();
  const shown = useMemo(() => all.filter(x => (cat === 'All' || x.tpl.category === cat) && (!q.trim() || text(x).includes(q.trim().toLowerCase()))), [cat, q, getLang()]); // eslint-disable-line react-hooks/exhaustive-deps
  const count = c => all.filter(x => c === 'All' || x.tpl.category === c).length;
  return (
    <div className="modal-back" onClick={() => ctl.openGallery(false)}>
      <div className="modal gallery" role="dialog" aria-modal="true" aria-labelledby="galleryTitle" ref={box} onClick={e => e.stopPropagation()}>
        <header className="gallery-head">
          <div><h2 id="galleryTitle">{t('gallery.title', 'Workflow templates')}</h2>
            <p className="muted">{t('gallery.sub', 'Modelled on common n8n templates, as Silex security graphs you can test. Integrations are steps, not live connections.')}</p></div>
          <button className="btn ghost sm" aria-label={t('cp.close', 'Close')} onClick={() => ctl.openGallery(false)}><Icon d={I.x} /></button>
        </header>
        <div className="gallery-tools">
          <div className="lib-search"><Icon d={I.search} /><input id="gallerySearch" value={q} onChange={e => setQ(e.target.value)} placeholder={t('gallery.search', 'Search templates — e.g. invoice, 发票, Slack')} /></div>
          <nav className="cat-tabs" role="tablist" aria-label={t('gallery.categories', 'Categories')}>
            {['All', ...ctl.CATEGORIES].map(c => (
              <button key={c} role="tab" aria-selected={cat === c} className={cat === c ? 'on' : ''} data-cat={c} onClick={() => setCat(c)}>
                {c === 'All' ? t('gallery.all', 'All') : t(`gallery.cat.${c}`, c)} <span className="count">{count(c)}</span></button>))}
          </nav>
        </div>
        <div className="gallery-grid" id="galleryGrid">
          {shown.map(({ id, tpl }) => (
            <article className="tpl-card" key={id} data-template={id}>
              <div className="tpl-top"><span className="chip blue">{t(`gallery.cat.${tpl.category}`, tpl.category)}</span><span className="muted mono">{t('gallery.steps', '{n} steps', { n: tpl.graph.nodes.length })}</span></div>
              <h3>{tx(id, 'name', tpl.name)}</h3>
              <p className="tpl-desc">{tx(id, 'desc', (tpl.description || '').replace(MODELLED, ' ').trim())}</p>
              {tpl.n8nPattern ? <p className="tpl-pattern"><b>{t('gallery.pattern', 'n8n pattern')}</b> {tx(id, 'pattern', tpl.n8nPattern)}</p> : null}
              {tpl.integrations?.length ? <div className="chips">{tpl.integrations.map(i => <span key={i} className="chip">{i}</span>)}</div> : null}
              {tpl.amountMeaning ? <p className="tpl-amount"><span className="mono">amount</span> = {tx(id, 'amount', tpl.amountMeaning)}</p> : null}
              <TypeStrip graph={tpl.graph} />
              <button className="btn primary sm" data-use={id} onClick={() => ctl.startFromTemplate(id)}>{t('gallery.use', 'Use template')}</button>
            </article>))}
          {shown.length === 0 ? <p className="muted pad">{t('gallery.none', 'No template matches.')}</p> : null}
        </div>
        <details className="gallery-note">
          <summary>{t('gallery.howTitle', 'How the simulated requests are drawn')}</summary>
          <p>{t('gallery.how', 'Every template is tested with the same six scenario types. Amounts are dollars, rounded to cents, drawn from the first unauthorized-write monitor’s threshold t and probe range [lo, hi] (without such a monitor: t = 500, lo = 0, hi = 1000; t′ = t if t > 0, else hi):')}</p>
          <ul className="mono">
            <li>below_threshold: [lo, hi), eligible 0</li>
            <li>split: [hi, 2·hi), pieces ⌈amount / 0.96·t′⌉ (2–10)</li>
            <li>replay: [hi, 2·hi), second request eligible 0</li>
            <li>duplicate_submit, injection_exfil: [0, t′)</li>
            <li>benign: log-uniform [20, 3000)</li>
          </ul>
        </details>
      </div>
    </div>);
}
