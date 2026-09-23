/* Edge types: flow edges carry a "+" at their midpoint (plan §3.2); access
   edges are dashed; watch lines (monitor → what it watches) are dotted. */
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from '@xyflow/react';
import { t } from '../../i18n/index.js';

export function FlowEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, data, selected }) {
  const [path, lx, ly] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 10, offset: 18 });
  const cls = 'e-flow' + (data?.hot ? ' hot' : '') + (selected ? ' sel' : '');
  return (<>
    <BaseEdge id={id} path={path} markerEnd={markerEnd} className={cls} />
    {data?.locked ? null : (
      <EdgeLabelRenderer>
        <button className="e-plus nodrag nopan" style={{ transform: `translate(-50%,-50%) translate(${lx}px,${ly}px)` }} data-plus={id}
          title={t('builder.insertHere', 'Insert a step here')} onClick={e => { e.stopPropagation(); data.onPlus({ kind: 'edge', edgeId: id, x: e.clientX, y: e.clientY }); }}>+</button>
      </EdgeLabelRenderer>)}
  </>);
}
export function AccessEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected }) {
  const [path] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 10 });
  return <BaseEdge id={id} path={path} className={'e-access' + (selected ? ' sel' : '')} />;
}
export function WatchEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }) {
  const [path] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 10, offset: 12 });
  return <BaseEdge id={id} path={path} className="e-watch" />;
}
export const edgeTypes = { flow: FlowEdge, access: AccessEdge, watch: WatchEdge };
