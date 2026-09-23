/* One custom React Flow node for every model type (plan §3.5): icon tile in the
   type colour, title, one-line summary, labelled handles, and a "+" stub under
   each open out port (plan §3.2). Data and monitors use the compact variant. */
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { portsOf } from '../../../../js/model.js';
import { entry, typeLabel } from '../catalog.js';
import { nodeSummary } from '../summary.js';
import { t } from '../../i18n/index.js';
import { COMPACT } from '../layout.js';

const PORT_LABEL = { true: ['port.yes', 'yes'], false: ['port.no', 'no'], approved: ['port.approved', 'approved'], denied: ['port.denied', 'denied'] };

function FlowNode({ id, data, selected }) {
  const { node, issues = [], run, locked, openPorts = [], onPlus, flash } = data;
  const cat = entry(node.type), compact = COMPACT.has(node.type);
  const outs = portsOf(node).filter(p => p.kind === 'out');
  const hasIn = portsOf(node).some(p => p.kind === 'in');
  const errs = issues.filter(i => i.severity === 'error').length;
  const cls = ['fn', 'fn-' + node.type, compact ? 'compact' : '', selected ? 'sel' : '', run ? 'run-' + run : '', flash ? 'flash' : ''].filter(Boolean).join(' ');
  return (
    <div className={cls} data-node={id} style={{ '--tc': cat?.color }}>
      {hasIn ? <Handle type="target" id="in" position={Position.Top} className="h h-in" /> : null}
      {node.type === 'agent' || node.type === 'tool' ? <Handle type="source" id="acc" position={Position.Top} className="h h-acc" style={{ left: '18%' }} title={t('handle.reads', 'reads data')} /> : null}
      {node.type === 'data' ? <Handle type="target" id="acc" position={Position.Bottom} className="h h-acc" /> : null}
      {node.type === 'tool' || node.type === 'outcome' ? <Handle type="source" id="w" position={Position.Bottom} className="h h-hidden" style={{ left: '88%' }} isConnectable={false} /> : null}
      {node.type === 'prohibited' ? <Handle type="target" id="w" position={Position.Top} className="h h-hidden" isConnectable={false} /> : null}
      <div className="fn-tile" aria-hidden="true"><svg viewBox="0 0 24 24" className="icon"><path d={cat?.icon} /></svg></div>
      <div className="fn-text">
        <div className="fn-kicker">{compact ? t(`kicker.${node.type}`, node.type === 'data' ? 'Data' : 'Monitor') : typeLabel(node.type)}</div>
        <div className="fn-title" title={node.label}>{node.label}</div>
        {compact ? null : <div className="fn-sum" title={nodeSummary(node)}>{nodeSummary(node)}</div>}
      </div>
      {issues.length ? <span className={'fn-badge ' + (errs ? 'err' : 'warn')} title={issues.map(i => i.message).join('\n')}>{issues.length}</span> : null}
      {outs.map((p, i) => {
        const left = outs.length === 1 ? '50%' : `${((i + 1) * 100) / (outs.length + 1)}%`;
        const open = openPorts.includes(p.id);
        return (
          <div key={p.id}>
            <Handle type="source" id={p.id} position={Position.Bottom} className="h h-out" style={{ left }} />
            {PORT_LABEL[p.id] ? <span className="fn-port" style={{ left }}>{t(PORT_LABEL[p.id][0], PORT_LABEL[p.id][1])}</span> : null}
            {open && !locked ? <button className="fn-stub nodrag" style={{ left }} data-stub={`${id}:${p.id}`} title={t('builder.addNext', 'Add the next step')} onClick={e => { e.stopPropagation(); onPlus({ kind: 'port', nodeId: id, port: p.id, x: e.clientX, y: e.clientY }); }}>+</button> : null}
          </div>);
      })}
    </div>);
}
export default memo(FlowNode);
