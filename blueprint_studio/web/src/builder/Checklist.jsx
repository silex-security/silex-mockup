/* Checklist (Dify pattern; plan §3.6): three kinds of entry.
   - Pending input: an edit the config panel refused; not in the graph.
   - Node issue: a lint() issue with a node (or edge): select + centre it.
   - Flow issue: a lint() issue with no node: fit the view + fix hint.
   Sentences come from the lint code through i18n, not the engine's text. */
import { useEffect, useRef } from 'react';
import { useStudio, store } from '../state/storeAdapter.js';
import { pending } from '../state/pendingInputs.js';
import * as ctl from '../state/controller.js';
import { lint } from '../../../js/validate.js';
import { t } from '../i18n/index.js';
import { FIELD_LABEL } from '../ui/fieldGroups.js';

const LINT_EN = {
  no_trigger: 'The flow has no trigger. Add one from the library.',
  unreachable: '“{node}” cannot be reached from a trigger. Connect something into it.',
  cycle: 'The flow loops back on itself. Remove one connection in the loop.',
  dangling_port: '“{node}” has an unconnected branch. Use its + to add the next step.',
  no_success_outcome: 'No path reaches a success outcome. Connect a path from the trigger to one.',
  unused_data: '“{node}” is not read by any agent or tool.',
  no_watches: 'Monitor “{node}” watches nothing. Choose what it watches.',
  bad_watch: 'Monitor “{node}” watches something that is not a tool or outcome.',
  expr_syntax: '“{node}” has an expression that cannot be read.',
  expr_unknown_identifier: '“{node}” uses a variable that does not exist.',
  missing_config: '“{node}” is missing a required setting.'
};
export const lintSentence = (issue, graph) => t('lint.' + issue.code, LINT_EN[issue.code] || issue.code, { node: graph.nodes.find(n => n.id === (issue.nodeId || graph.edges.find(e => e.id === issue.edgeId)?.from.node))?.label || '' });
const FLOW_FIX = { no_trigger: 'fix.no_trigger', no_success_outcome: 'fix.no_success_outcome', cycle: 'fix.cycle' };

export default function Checklist({ onClose }) {
  useStudio();
  const ref = useRef(null);
  useEffect(() => {
    const away = e => { if (ref.current && !ref.current.contains(e.target) && !e.target.closest('#checklistBtn')) onClose(); };
    document.addEventListener('pointerdown', away); return () => document.removeEventListener('pointerdown', away);
  }, [onClose]);
  const g = store.active().graph;
  for (const p of pending.list()) if (!g.nodes.some(n => n.id === p.nodeId)) pending.clear(p.nodeId, p.field);
  const issues = lint(g);
  const nodeIssues = issues.filter(i => i.nodeId || i.edgeId), flowIssues = issues.filter(i => !i.nodeId && !i.edgeId);
  const label = id => g.nodes.find(n => n.id === id)?.label || id;
  const nothing = !issues.length && !pending.size;
  return (
    <div className="pop checklist" ref={ref} role="dialog" aria-label={t('top.checklist', 'Checklist')}>
      <header><b>{t('top.checklist', 'Checklist')}</b><span className="muted">{nothing ? t('check.clean', 'Nothing to fix') : t('check.count', '{n} to fix', { n: issues.length + pending.size })}</span></header>
      {pending.size ? <section><h5>{t('check.pending', 'Not applied — fix or discard')}</h5>
        {pending.list().map(p => (
          <div className="ci pending" key={p.nodeId + p.field} data-kind="pending">
            <button className="ci-main" onClick={() => { ctl.focusNode(p.nodeId); onClose(); setTimeout(() => document.getElementById(`f-${p.nodeId}-${p.field}`)?.focus(), 350); }}>
              <b>{label(p.nodeId)} · {t('field.' + p.field, FIELD_LABEL[p.field] || p.field)}</b><span>{p.message}</span></button>
            <button className="btn ghost sm" onClick={() => pending.clear(p.nodeId, p.field)}>{t('pending.discard', 'Discard')}</button>
          </div>))}</section> : null}
      {flowIssues.length ? <section><h5>{t('check.flow', 'Whole flow')}</h5>
        {flowIssues.map((i, k) => <div className={'ci ' + i.severity} key={'f' + k} data-kind="flow" data-code={i.code}>
          <button className="ci-main" onClick={() => { ctl.focusNode(null); }}><b>{lintSentence(i, g)}</b>{FLOW_FIX[i.code] ? null : <span className="muted">{i.message}</span>}</button></div>)}</section> : null}
      {nodeIssues.length ? <section><h5>{t('check.nodes', 'Steps')}</h5>
        {nodeIssues.map((i, k) => { const id = i.nodeId || g.edges.find(e => e.id === i.edgeId)?.from.node; return (
          <div className={'ci ' + i.severity} key={'n' + k} data-kind="node" data-code={i.code} data-node={id}>
            <button className="ci-main" onClick={() => { ctl.focusNode(id); onClose(); }}><b>{lintSentence(i, g)}</b><span className="muted">{i.message}</span></button></div>); })}</section> : null}
      {nothing ? <p className="muted pad">{t('check.allGood', 'The flow is complete: every branch is connected and a success outcome is reachable.')}</p> : null}
    </div>);
}
