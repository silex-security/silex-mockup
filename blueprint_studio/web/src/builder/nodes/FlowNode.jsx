/* One custom React Flow node for every model type (plan §3.5): icon tile in the
   type colour, title, one-line summary, labelled handles, and a "+" stub under
   each open out port (plan §3.2). Data and monitors use the compact variant.
   Handles rotate with the graph's direction (plan §3.12): in TB the flow enters
   at the top and leaves at the bottom, in LR it enters left and leaves right.
   Only positions change; handle ids stay the same. */
import { memo, useEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react';
import { portsOf } from '../../../../js/model.js';
import { entry, typeLabel } from '../catalog.js';
import { nodeSummary } from '../summary.js';
import { t } from '../../i18n/index.js';
import { COMPACT } from '../layout.js';

/* TB side -> LR side; `along` is the offset along that side (left in TB, top in LR). */
const SIDE = { TB: { start: Position.Top, end: Position.Bottom }, LR: { start: Position.Left, end: Position.Right } };
const along = (dir, v) => (dir === 'LR' ? { top: v } : { left: v });

const PORT_LABEL = { true: ['port.yes', 'yes'], false: ['port.no', 'no'], approved: ['port.approved', 'approved'], denied: ['port.denied', 'denied'] };

function FlowNode({ id, data, selected }) {
  const { node, issues = [], run, locked, openPorts = [], onPlus, flash, ai, dir = 'TB' } = data;
  const side = SIDE[dir];
  const updateInternals = useUpdateNodeInternals();
  useEffect(() => { updateInternals(id); }, [dir]); // eslint-disable-line react-hooks/exhaustive-deps -- React Flow caches handle bounds; re-measure when they move
  const cat = entry(node.type), compact = COMPACT.has(node.type);
  const outs = portsOf(node).filter(p => p.kind === 'out');
  const hasIn = portsOf(node).some(p => p.kind === 'in');
  const errs = issues.filter(i => i.severity === 'error').length;
  const cls = ['fn', 'fn-' + node.type, compact ? 'compact' : '', dir === 'LR' ? 'lr' : '', selected ? 'sel' : '', run ? 'run-' + run : '', flash ? 'flash' : '', ai ? 'ai' : ''].filter(Boolean).join(' ');
  const label = (p, style) => (PORT_LABEL[p.id] ? <span className="fn-port" style={style}>{t(PORT_LABEL[p.id][0], PORT_LABEL[p.id][1])}</span> : null);
  const stub = (p, open, style) => (open && !locked ? <button className="fn-stub nodrag" style={style} data-stub={`${id}:${p.id}`} title={t('builder.addNext', 'Add the next step')} onClick={e => { e.stopPropagation(); onPlus({ kind: 'port', nodeId: id, port: p.id, x: e.clientX, y: e.clientY }); }}>+</button> : null);
  return (
    <div className={cls} data-node={id} style={{ '--tc': cat?.color }}>
      {hasIn ? <Handle type="target" id="in" position={side.start} className="h h-in" /> : null}
      {node.type === 'agent' || node.type === 'tool' ? <Handle type="source" id="acc" position={side.start} className="h h-acc" style={along(dir, '18%')} title={t('handle.reads', 'reads data')} /> : null}
      {node.type === 'data' ? <Handle type="target" id="acc" position={side.end} className="h h-acc" /> : null}
      {node.type === 'tool' || node.type === 'outcome' ? <Handle type="source" id="w" position={side.end} className="h h-hidden" style={along(dir, '88%')} isConnectable={false} /> : null}
      {node.type === 'prohibited' ? <Handle type="target" id="w" position={side.start} className="h h-hidden" isConnectable={false} /> : null}
      <div className="fn-tile" aria-hidden="true"><svg viewBox="0 0 24 24" className="icon"><path d={cat?.icon} /></svg></div>
      <div className="fn-text">
        <div className="fn-kicker">{compact ? t(`kicker.${node.type}`, node.type === 'data' ? 'Data' : 'Monitor') : typeLabel(node.type)}</div>
        <div className="fn-title" title={node.label}>{node.label}</div>
        {compact ? null : <div className="fn-sum" title={nodeSummary(node)}>{nodeSummary(node)}</div>}
      </div>
      {issues.length ? <span className={'fn-badge ' + (errs ? 'err' : 'warn')} title={issues.map(i => i.message).join('\n')}>{issues.length}</span> : null}
      {outs.map((p, i) => {
        const at = along(dir, outs.length === 1 ? '50%' : `${((i + 1) * 100) / (outs.length + 1)}%`);
        const open = openPorts.includes(p.id);
        return (
          <div key={p.id}>
            <Handle type="source" id={p.id} position={side.end} className="h h-out" style={at} />
            {dir === 'LR'                                 // LR: label and stub in one row beside the port, so they never overlap
              ? <div className="fn-out" style={at}>{label(p)}{stub(p, open)}</div>
              : <>{label(p, at)}{stub(p, open, at)}</>}
          </div>);
      })}
    </div>);
}
export default memo(FlowNode);
