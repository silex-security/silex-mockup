/* Config panel (Dify layering + progressive disclosure; plan §3.4–3.5).
   Basic fields always, Advanced collapsed. Every accepted edit is one patch.
   A refused edit (invalid expression, non-number) stays as a local draft and is
   registered as a pending input for the checklist; it never reaches the graph. */
import { useEffect, useState } from 'react';
import { useStudio, store } from '../state/storeAdapter.js';
import { pending } from '../state/pendingInputs.js';
import * as ctl from '../state/controller.js';
import { NODE_TYPES, BINDING_FIELDS, nodeById } from '../../../js/model.js';
import { check } from '../../../js/expr.js';
import { t } from '../i18n/index.js';
import Icon, { I } from '../ui/Icon.jsx';
import { FIELD_GROUPS, FIELD_LABEL, FIELD_HELP } from '../ui/fieldGroups.js';
import { entry, typeLabel, typeDesc, MONITORS, monitorLabel, monitorDesc } from './catalog.js';
import { addMonitor, addData, attachData } from './insert.js';

const patch = (ops, label) => store.dispatch({ type: 'patch', ops, label });
const setConfig = (id, key, value) => patch([{ op: 'setConfig', id, key, value }], 'Edit ' + key);
const optLabel = (key, o) => t(`opt.${key}.${o}`, String(o).replace(/_/g, ' '));

function Field({ node, f, locked }) {
  const v = node.config[f.key];
  const label = t('field.' + f.key, FIELD_LABEL[f.key] || f.label);
  const help = FIELD_HELP[f.key] ? t(`help.${f.key}`, FIELD_HELP[f.key]) : null;
  const id = `f-${node.id}-${f.key}`;
  const pend = pending.get(node.id, f.key);
  const [draft, setDraft] = useState(pend ? pend.draft : v ?? '');
  useEffect(() => { const p = pending.get(node.id, f.key); setDraft(p ? p.draft : v ?? ''); }, [node.id, f.key, v]);
  const wrap = (control, extra) => <div className={'field' + (pend ? ' has-pending' : '')}><label htmlFor={id}>{label}</label>{control}{extra}{help ? <p className="help">{help}</p> : null}</div>;
  const commitExpr = raw => {
    const src = raw.trim();
    if (src === '' && f.optional) { pending.clear(node.id, f.key); if (v !== '') setConfig(node.id, f.key, ''); return; }
    const r = check(src);
    if (!r.ok) { pending.set(node.id, f.key, raw, r.error.message + (r.error.pos != null ? ` (${t('field.at', 'at')} ${r.error.pos})` : '')); return; }
    pending.clear(node.id, f.key); if (src !== v) setConfig(node.id, f.key, src);
  };
  switch (f.type) {
    case 'text': return wrap(<input id={id} type="text" disabled={locked} value={draft} onChange={e => setDraft(e.target.value)} onBlur={() => { if (draft.trim() !== v) setConfig(node.id, f.key, draft.trim()); }} />);
    case 'number': return wrap(<input id={id} type="number" disabled={locked} value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={() => { const n = Number(draft); if (draft === '' || !Number.isFinite(n)) pending.set(node.id, f.key, draft, t('field.needNumber', 'Enter a number')); else { pending.clear(node.id, f.key); if (n !== v) setConfig(node.id, f.key, n); } }} />,
      pend ? <p className="err">{pend.message}</p> : null);
    case 'select': return wrap(<select id={id} disabled={locked} value={v} onChange={e => setConfig(node.id, f.key, e.target.value)}>{f.options.map(o => <option key={o} value={o}>{optLabel(f.key, o)}</option>)}</select>);
    case 'bool': return <div className="field check"><label><input id={id} type="checkbox" disabled={locked} checked={!!v} onChange={e => setConfig(node.id, f.key, e.target.checked)} />{label}</label>{help ? <p className="help">{help}</p> : null}</div>;
    case 'expr': return wrap(
      <input id={id} data-expr={f.key} className="mono" type="text" spellCheck="false" disabled={locked} value={draft} placeholder={f.optional ? t('field.always', 'always') : 'amount > 500'}
        onChange={e => { setDraft(e.target.value); const r = e.target.value.trim() === '' && f.optional ? { ok: true } : check(e.target.value.trim()); if (r.ok) pending.clear(node.id, f.key); }}
        onBlur={e => commitExpr(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') commitExpr(e.currentTarget.value); }} />,
      pend ? <p className="err" role="alert">{pend.message} <button className="link" onClick={() => { pending.clear(node.id, f.key); setDraft(v ?? ''); }}>{t('pending.discard', 'Discard')}</button></p> : null);
    case 'multiselect': return wrap(<div className="chips" id={id}>{f.options.map(o => { const on = (v || []).includes(o); return <button key={o} className={'chip-toggle' + (on ? ' on' : '')} disabled={locked} aria-pressed={on} onClick={() => setConfig(node.id, f.key, f.options.filter(x => x === o ? !on : (v || []).includes(x)))}>{optLabel(f.key, o)}</button>; })}</div>);
    case 'range': { const [lo, hi] = Array.isArray(v) ? v : [0, 0]; return wrap(<div className="pair"><input id={id} type="number" disabled={locked} defaultValue={lo} onBlur={e => { const x = Number(e.target.value); if (Number.isFinite(x) && x < hi) setConfig(node.id, f.key, [x, hi]); }} /><span>–</span><input type="number" disabled={locked} defaultValue={hi} onBlur={e => { const y = Number(e.target.value); if (Number.isFinite(y) && y > lo) setConfig(node.id, f.key, [lo, y]); }} /></div>); }
    case 'caps': { const caps = v || []; const set = next => setConfig(node.id, f.key, next.filter(c => c.cap).map(c => ({ cap: c.cap, limit: Number(c.limit) || 0 })));
      return wrap(<div className="caps" id={id}>{caps.map((c, i) => (
        <div className="pair" key={i}><input type="text" disabled={locked} defaultValue={c.cap} aria-label={t('field.capName', 'capability')} onBlur={e => set(caps.map((x, j) => j === i ? { ...x, cap: e.target.value.trim() } : x))} />
          <input type="number" disabled={locked} defaultValue={c.limit} aria-label={t('field.capLimit', 'limit')} onBlur={e => set(caps.map((x, j) => j === i ? { ...x, limit: Number(e.target.value) } : x))} />
          <button className="btn ghost sm" disabled={locked} aria-label={t('field.remove', 'Remove')} onClick={() => set(caps.filter((_, j) => j !== i))}><Icon d={I.x} /></button></div>))}
        <button className="btn sm" id="addCapBtn" disabled={locked} onClick={() => set([...caps, { cap: 'refund.issue', limit: 1000 }])}><Icon d={I.plus} />{t('field.addCap', 'Add capability')}</button></div>); }
    case 'nodeRefs': { const g = store.active().graph, opts = g.nodes.filter(n => f.refTypes.includes(n.type)); const cur = new Set(v || []);
      return wrap(<div className="chips" id={id}>{opts.map(o => <button key={o.id} className={'chip-toggle' + (cur.has(o.id) ? ' on' : '')} disabled={locked} aria-pressed={cur.has(o.id)} onClick={() => setConfig(node.id, f.key, opts.filter(x => x.id === o.id ? !cur.has(o.id) : cur.has(x.id)).map(x => x.id))}>{o.label}</button>)}</div>); }
    default: return null;
  }
}

function ReadsData({ node, locked }) {
  const g = store.active().graph;
  const reads = g.edges.filter(e => e.kind === 'access' && e.from.node === node.id).map(e => ({ e, d: nodeById(g, e.to.node) }));
  const others = g.nodes.filter(n => n.type === 'data' && !reads.some(r => r.d?.id === n.id));
  const [form, setForm] = useState(null);
  return (
    <section className="cp-section" id="readsData">
      <h4>{t('cp.reads', 'Reads data')}</h4>
      {reads.length ? reads.map(({ e, d }) => <div className="ref-row" key={e.id}><button className="link" onClick={() => ctl.setSelected({ kind: 'node', id: d.id })}>{d.label}</button><span className="chip">{t('sens.' + d.config.sensitivity, d.config.sensitivity)}</span>{locked ? null : <button className="btn ghost sm" aria-label={t('cp.detach', 'Stop reading')} onClick={() => patch([{ op: 'removeEdge', id: e.id }], 'Detach data')}><Icon d={I.x} /></button>}</div>) : <p className="help">{t('cp.readsNone', 'Reads no data resource.')}</p>}
      {locked ? null : <div className="ref-actions">
        {others.length ? <select aria-label={t('cp.attach', 'Attach existing data')} value="" onChange={e => { const r = attachData(g, node.id, e.target.value); if (r.ok) patch(r.value, 'Attach data'); }}><option value="">{t('cp.attach', 'Attach existing data')}…</option>{others.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}</select> : null}
        {form ? <div className="mini-form"><input autoFocus id="newDataName" placeholder={t('cp.dataName', 'Name, e.g. Payment credentials')} value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} />
          <select id="newDataSens" value={form.sensitivity} onChange={e => setForm({ ...form, sensitivity: e.target.value })}>{['public', 'internal', 'secret'].map(s => <option key={s} value={s}>{t('sens.' + s, s)}</option>)}</select>
          <button className="btn sm primary" id="newDataAdd" disabled={!form.label.trim()} onClick={() => { const r = addData(store.active().graph, node.id, form.label.trim(), form.sensitivity); if (r.ok && patch(r.value, 'Add data').ok) setForm(null); }}>{t('cp.add', 'Add')}</button>
          <button className="btn sm ghost" onClick={() => setForm(null)}>{t('cp.cancel', 'Cancel')}</button></div>
          : <button className="btn sm" id="newDataBtn" onClick={() => setForm({ label: '', sensitivity: 'internal' })}><Icon d={I.plus} />{t('cp.newData', 'New data resource')}</button>}
      </div>}
    </section>);
}

function Protect({ node, locked }) {
  const g = store.active().graph;
  const mons = g.nodes.filter(n => n.type === 'prohibited' && (n.config.watches || []).includes(node.id));
  const kinds = MONITORS.filter(m => m.on.includes(node.type));
  return (
    <section className="cp-section" id="protect">
      <h4><Icon d={I.shield} />{t('cp.protect', 'Protect with a monitor')}</h4>
      {mons.map(m => <div className="ref-row" key={m.id}><button className="link" onClick={() => ctl.setSelected({ kind: 'node', id: m.id })}>{m.label}</button><span className="chip bad">{t('severity.' + m.config.severity, m.config.severity)}</span></div>)}
      {locked ? null : <div className="monitor-picks">{kinds.map(k => (
        <button key={k.kind} className="pick" data-monitor={k.kind} onClick={() => { const r = addMonitor(store.active().graph, node.id, k.kind); if (r.ok) patch(r.value, 'Add monitor'); }}>
          <b>{monitorLabel(k.kind)}</b><small>{monitorDesc(k.kind)}</small></button>))}</div>}
    </section>);
}

export default function ConfigPanel({ nodeId }) {
  useStudio();
  const rev = store.active(), node = nodeById(rev.graph, nodeId), locked = rev.status !== 'draft';
  const [adv, setAdv] = useState(false);
  if (!node) return null;
  const def = NODE_TYPES[node.type], groups = FIELD_GROUPS[node.type];
  const fieldsOf = keys => keys.map(k => def.schema.find(f => f.key === k)).filter(f => f && (!f.when || f.when(node.config)));
  const basic = fieldsOf(groups.basic), advanced = fieldsOf(groups.advanced);
  return (
    <aside className="config" aria-label={t('cp.title', 'Step settings')} key={node.id}>
      <header className="cp-head">
        <span className="si-tile" style={{ '--tc': entry(node.type)?.color }}><svg viewBox="0 0 24 24" className="icon"><path d={entry(node.type)?.icon} /></svg></span>
        <div className="cp-title">
          <input id="nodeLabel" aria-label={t('cp.name', 'Name')} disabled={locked} defaultValue={node.label} key={node.label} onBlur={e => { const l = e.target.value.trim(); if (l && l !== node.label) patch([{ op: 'setLabel', id: node.id, label: l }], 'Rename'); }} />
          <small>{typeLabel(node.type)} · <span className="mono">{node.id}</span></small>
        </div>
        <button className="btn ghost sm" aria-label={t('cp.close', 'Close')} onClick={() => ctl.setSelected(null)}><Icon d={I.x} /></button>
      </header>
      <p className="cp-desc">{typeDesc(node.type)}</p>
      {locked ? <p className="cp-locked">{t('cp.locked', 'This revision is locked. Settings are read-only.')}</p> : null}
      <section className="cp-section">{basic.map(f => <Field key={f.key} node={node} f={f} locked={locked} />)}</section>
      {advanced.length ? <section className="cp-section adv">
        <button className="adv-toggle" id="advToggle" aria-expanded={adv} onClick={() => setAdv(a => !a)}><Icon d={I.chevron} className={'icon' + (adv ? ' rot' : '')} />{t('cp.advanced', 'Advanced')} <span className="muted">({advanced.length})</span></button>
        {adv ? advanced.map(f => <Field key={f.key} node={node} f={f} locked={locked} />) : null}
      </section> : null}
      {node.type === 'agent' || node.type === 'tool' ? <ReadsData node={node} locked={locked} /> : null}
      {node.type === 'tool' || node.type === 'outcome' ? <Protect node={node} locked={locked} /> : null}
      {locked ? null : <footer className="cp-foot"><button className="btn danger sm" id="deleteNodeBtn" onClick={() => { if (patch([{ op: 'removeNode', id: node.id }], 'Delete').ok) ctl.setSelected(null); }}><Icon d={I.trash} />{t('cp.delete', 'Delete step')}</button></footer>}
    </aside>);
}
