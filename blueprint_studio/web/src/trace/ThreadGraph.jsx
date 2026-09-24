/* The thread graph (plan §3.2): seven columns, step → class → related threat →
   family → finding → candidate → decision, read-only. Nodes are placed by
   column (derive.js assigns it); a focused thread is highlighted and the
   rest dimmed. Edge styles carry grade or provenance (CONTRACT.md). */
import { memo, useEffect, useMemo } from 'react';
import { ReactFlow, ReactFlowProvider, Background, Controls, Handle, Position, MarkerType, useReactFlow } from '@xyflow/react';
import { t } from '../i18n/index.js';

const COLS = ['step', 'class', 'threat', 'family', 'finding', 'candidate', 'decision'];
const COL_W = 184, ROW_H = 58, NODE_W = 164;
const keyOf = n => `${n.kind}:${n.ref}`;

/* Keys (`kind:ref`) on the focused thread. */
export function focusSet(trace, focus) {
  const set = new Set();
  if (!focus) return set;
  const sim = trace.simulation, cs = trace.candidates || [], S = trace.schema;
  const classOf = id => S.steps.find(s => s.id === id)?.classId;
  const addFinding = f => {
    set.add('finding:' + f.id); set.add('family:' + f.family);
    for (const s of [...f.attributed, ...f.declaredWatch]) { set.add('step:' + s); const c = classOf(s); if (c) set.add('class:' + c); }
    for (const id of f.related) set.add('threat:' + id);
  };
  const addCand = c => {
    set.add('candidate:' + c.id);
    for (const x of c.changes) if (x.stepId) { set.add('step:' + x.stepId); const k = x.classId || classOf(x.stepId); if (k) set.add('class:' + k); }
    if (c.state === 'approved' && trace.decision?.childRevLabel) set.add('decision:' + trace.decision.childRevLabel);
  };
  const findings = sim ? sim.findings : [];
  if (focus.kind === 'finding') {
    const f = findings.find(x => x.id === focus.ref); if (f) addFinding(f);
    for (const c of cs) if (c.closes.includes(focus.ref)) addCand(c);
  } else if (focus.kind === 'candidate' || focus.kind === 'decision') {
    const id = focus.kind === 'decision' ? trace.decision?.candidateId : focus.ref;
    const c = cs.find(x => x.id === id);
    if (c) { addCand(c); for (const id of c.closes) { const f = findings.find(x => x.id === id); if (f) addFinding(f); } }
  } else if (focus.kind === 'step') {
    set.add('step:' + focus.ref); const c = classOf(focus.ref); if (c) set.add('class:' + c);
    for (const f of findings) if (f.attributed.includes(focus.ref) || f.declaredWatch.includes(focus.ref)) addFinding(f);
  } else if (focus.kind === 'family') {
    for (const f of findings) if (f.family === focus.ref) addFinding(f);
    set.add('family:' + focus.ref);
  } else if (focus.kind === 'threat') {
    set.add('threat:' + focus.ref);
    for (const f of findings) if (f.related.includes(focus.ref)) addFinding(f);
  } else if (focus.kind === 'class') {
    set.add('class:' + focus.ref);
    for (const s of S.steps) if (s.classId === focus.ref) set.add('step:' + s.id);
  }
  return set;
}

const TNode = memo(function TNode({ data }) {
  const { node, hot, dim, isFocus } = data;
  if (node.kind === 'header') return <div className="tn-head">{node.label}</div>;
  return (
    <div className={'tn tn-' + node.kind + (hot ? ' hot' : '') + (dim ? ' dim' : '') + (isFocus ? ' focus' : '') + (node.state ? ' st-' + node.state : '')} data-thread={keyOf(node)} title={node.label}>
      <Handle type="target" position={Position.Left} className="tn-h" isConnectable={false} />
      <div className="tn-kind">{t('trace.kind.' + node.kind, node.kind)}{node.state ? ' · ' + t('trace.state.' + node.state, node.state) : ''}</div>
      <div className="tn-label">{node.label}</div>
      {node.sub ? <div className="tn-sub mono">{node.sub}</div> : null}
      <Handle type="source" position={Position.Right} className="tn-h" isConnectable={false} />
    </div>);
});
const nodeTypes = { tnode: TNode };

function Graph({ trace, focus, hot, onFocus }) {
  const { nodes, edges } = useMemo(() => {
    const th = trace.thread, byCol = COLS.map(() => []);
    for (const n of th.nodes) byCol[n.column]?.push(n);
    // candidates: what supports the decision first, then the rest (plan §3.4.2 states)
    const RANK = { approved: 0, eligible: 1, ineligible: 2, stale: 3, rejected: 4 };
    byCol[5].sort((a, b) => (RANK[a.state] ?? 9) - (RANK[b.state] ?? 9) || (a.ref === trace.recommended ? -1 : b.ref === trace.recommended ? 1 : 0));
    const any = hot.size > 0;
    const fk = focus ? `${focus.kind}:${focus.ref}` : null;
    const ns = [];
    byCol.forEach((col, ci) => {
      const top = 0;                                        // top-aligned: the thread reads along the first rows
      ns.push({ id: 'h:' + ci, type: 'tnode', position: { x: ci * COL_W, y: -56 }, draggable: false, selectable: false, data: { node: { kind: 'header', label: t('trace.col.' + COLS[ci], COLS[ci]) } } });
      col.forEach((n, ri) => {
        const k = keyOf(n);
        ns.push({ id: n.id, type: 'tnode', position: { x: ci * COL_W, y: top + ri * ROW_H }, width: NODE_W, draggable: false, connectable: false,
          data: { node: n, hot: any && hot.has(k), dim: any && !hot.has(k), isFocus: k === fk } });
      });
    });
    const hotId = new Set(th.nodes.filter(n => hot.has(keyOf(n))).map(n => n.id));
    const es = th.edges.map(e => ({ id: e.id, source: e.from, target: e.to, type: 'default', selectable: false, focusable: false,
      className: 'te te-' + e.style + (any ? (hotId.has(e.from) && hotId.has(e.to) ? ' hot' : ' dim') : ''),
      markerEnd: e.style === 'simulated' ? { type: MarkerType.ArrowClosed, width: 12, height: 12, color: '#7b8494' } : undefined }));   // limits are shown in the inspector and Laws, not on edges
    return { nodes: ns, edges: es };
  }, [trace, focus?.kind, focus?.ref, hot]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Zoom to the focused thread: every column stays in view, rows limited to the hot ones. */
  const rf = useReactFlow();
  useEffect(() => {
    const hotNodes = nodes.filter(n => n.data.hot);
    if (!hotNodes.length) return;
    const ys = hotNodes.map(n => n.position.y), y0 = Math.min(...ys) - 70, y1 = Math.max(...ys) + ROW_H;
    const id = requestAnimationFrame(() => rf.fitBounds({ x: -12, y: Math.min(y0, -70), width: COLS.length * COL_W, height: y1 - Math.min(y0, -70) }, { padding: 0.04, duration: 250 }));
    return () => cancelAnimationFrame(id);
  }, [focus?.kind, focus?.ref, trace]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="thread" id="threadGraph">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.08 }} minZoom={0.2} maxZoom={1.5}
        nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} proOptions={{ hideAttribution: true }}
        onNodeClick={(_, n) => { const x = n.data.node; if (x.kind !== 'header') onFocus({ kind: x.kind, ref: x.ref }); }}>
        <Background gap={18} size={1.2} color="#e3e6eb" />
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>
      {trace.thread.nodes.length === 0 ? <p className="thread-empty muted">{t('trace.thread.empty', 'Validate this revision to see its findings and their threads.')}</p> : null}
    </div>);
}

export default function ThreadGraph(props) {
  return <ReactFlowProvider><Graph {...props} /></ReactFlowProvider>;
}
