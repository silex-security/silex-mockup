/* The builder (plan §3): library | React Flow canvas | config or test-run panel.
   The canvas is a view of store.active().graph; every change goes through
   store.dispatch as one patch (insert.js builds the structural ones). */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, Background, Controls, MiniMap, Panel, MarkerType, applyNodeChanges, useReactFlow, ReactFlowProvider } from '@xyflow/react';
import { useStudio, store } from '../state/storeAdapter.js';
import * as ctl from '../state/controller.js';
import { canConnect, nextId, portsOf } from '../../../js/model.js';
import { lint } from '../../../js/validate.js';
import { t } from '../i18n/index.js';
import Icon, { I } from '../ui/Icon.jsx';
import FlowNode from './nodes/FlowNode.jsx';
import { edgeTypes } from './edges/Edges.jsx';
import NodeSearch from './NodeSearch.jsx';
import ConfigPanel from './ConfigPanel.jsx';
import TestRunPanel from '../run/TestRunPanel.jsx';
import AssistantPanel, { assist } from '../assist/AssistantPanel.jsx';
import { CATALOG, GROUPS, typeLabel, typeDesc, groupLabel, rankType } from './catalog.js';
import { insertOnEdge, addAfter, addStandalone, EDGE_INSERTABLE, PORT_ADDABLE } from './insert.js';
import { layoutOps, sizeOf } from './layout.js';

const nodeTypes = { flow: FlowNode };

function Library({ onAdd, locked }) {
  const [q, setQ] = useState('');
  const match = c => rankType(c.type, q) > 0;
  return (
    <aside className="library" aria-label={t('lib.title', 'Steps')}>
      <div className="lib-search"><Icon d={I.search} /><input id="libSearch" value={q} onChange={e => setQ(e.target.value)} placeholder={t('lib.search', 'Search steps')} /></div>
      {GROUPS.map(([g]) => {
        const items = CATALOG.filter(c => c.group === g && match(c));
        if (!items.length) return null;
        return (
          <section key={g}>
            <h4>{groupLabel(g)}</h4>
            {items.map(c => (
              <button key={c.type} className="lib-item" data-type={c.type} disabled={locked} draggable={!locked}
                onDragStart={e => { e.dataTransfer.setData('application/x-bs-type', c.type); e.dataTransfer.effectAllowed = 'copy'; }}
                onClick={() => onAdd(c.type)} title={typeDesc(c.type)}>
                <span className="si-tile" style={{ '--tc': c.color }}><svg viewBox="0 0 24 24" className="icon"><path d={c.icon} /></svg></span>
                <span className="si-text"><b>{typeLabel(c.type)}</b><small>{typeDesc(c.type)}</small></span>
              </button>))}
          </section>);
      })}
      <p className="lib-help">{t('lib.help', 'Tip: use the + on a connection to insert a step, or the + under a node to add the next one. Drag between handles to connect.')}</p>
    </aside>);
}

function EmptyState() {
  return (
    <div className="empty">
      <h2>{t('empty.title', 'Start a workflow')}</h2>
      <p className="muted">{t('empty.sub', 'Pick a starter, or begin with a trigger and add steps with +.')}</p>
      <div className="empty-actions">
        <button className="btn" id="emptyBrowseBtn" onClick={() => ctl.openGallery(true)}>{t('empty.browse', 'Browse {n} templates', { n: ctl.TEMPLATE_IDS.length })}</button>
        <button className="btn primary" id="startTriggerBtn" onClick={() => { const r = addStandalone(store.active().graph, 'trigger', 0, 0); if (store.dispatch({ type: 'patch', ops: r.value, label: 'Add trigger' }).ok) ctl.setSelected({ kind: 'node', id: r.id }); }}>{t('empty.trigger', 'Start from a trigger')}</button>
      </div>
    </div>);
}

function Canvas() {
  const version = useStudio();
  const route = ctl.getRoute();
  const rev = store.active(), graph = rev.graph, locked = rev.status !== 'draft';
  const rf = useReactFlow();
  const [rfNodes, setRfNodes] = useState([]);
  const [search, setSearch] = useState(null);
  const [flashId, setFlashId] = useState(null);
  const dragKey = useRef(null);
  const wrap = useRef(null);
  const hl = ctl.runHighlights();

  const issuesByNode = useMemo(() => {
    const m = {};
    for (const i of lint(graph)) { const id = i.nodeId || (i.edgeId && graph.edges.find(e => e.id === i.edgeId)?.from.node); if (id) (m[id] ||= []).push(i); }
    return m;
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPlus = useCallback(p => setSearch(p), []);
  const measured = () => Object.fromEntries(rfNodes.filter(n => n.measured?.width).map(n => [n.id, { width: n.measured.width, height: n.measured.height }]));

  /* Rebuild React Flow nodes from the store, keeping measured sizes. */
  useEffect(() => {
    setRfNodes(prev => {
      const old = new Map(prev.map(n => [n.id, n]));
      return graph.nodes.map(n => {
        const outs = portsOf(n).filter(p => p.kind === 'out').map(p => p.id);
        const openPorts = outs.filter(p => !graph.edges.some(e => e.kind === 'flow' && e.from.node === n.id && e.from.port === p));
        const o = old.get(n.id);
        return { id: n.id, type: 'flow', position: { x: n.x, y: n.y }, draggable: !locked, deletable: !locked, connectable: !locked,
          selected: route.selected?.kind === 'node' && route.selected.id === n.id, measured: o?.measured, width: sizeOf(n).width,
          data: { node: n, issues: issuesByNode[n.id] || [], run: hl.nodes[n.id], locked, openPorts, onPlus, flash: flashId === n.id, ai: assist.highlight.includes(n.id) } };
      });
    });
  }, [version, flashId]); // eslint-disable-line react-hooks/exhaustive-deps

  const rfEdges = useMemo(() => {
    const es = graph.edges.map(e => e.kind === 'flow'
      ? { id: e.id, source: e.from.node, sourceHandle: e.from.port, target: e.to.node, targetHandle: e.to.port, type: 'flow', markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#9aa1ab' },
          selected: route.selected?.kind === 'edge' && route.selected.id === e.id, deletable: !locked, data: { onPlus, locked, hot: hl.edges[e.id] } }
      : { id: e.id, source: e.from.node, sourceHandle: 'acc', target: e.to.node, targetHandle: 'acc', type: 'access', deletable: !locked, selected: route.selected?.kind === 'edge' && route.selected.id === e.id });
    for (const n of graph.nodes) if (n.type === 'prohibited') for (const w of n.config.watches || [])
      if (graph.nodes.some(x => x.id === w)) es.push({ id: `watch:${n.id}:${w}`, source: w, sourceHandle: 'w', target: n.id, targetHandle: 'w', type: 'watch', selectable: false, deletable: false, focusable: false });
    return es;
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Focus requests from the checklist: centre a node, or fit the flow. */
  useEffect(() => {
    const f = route.focus; if (!f) return;
    requestAnimationFrame(() => {
      if (f.id) { rf.fitView({ nodes: [{ id: f.id }], duration: 300, maxZoom: 1.1, padding: 0.6 }); setFlashId(f.id); setTimeout(() => setFlashId(null), 1400); }
      else rf.fitView({ duration: 300, padding: 0.15 });
    });
  }, [route.focus?.at]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Fit once per document/revision. */
  const fitted = useRef('');
  useEffect(() => {
    const key = store.doc.id + ':' + rev.rev;
    if (fitted.current !== key && rfNodes.length && rfNodes.every(n => n.measured?.width)) { fitted.current = key; rf.fitView({ padding: 0.15, maxZoom: 1 }); }
  }, [rfNodes]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (ops, label, merge) => store.dispatch({ type: 'patch', ops, label, merge });

  const onNodesChange = useCallback(changes => {
    setRfNodes(ns => applyNodeChanges(changes.filter(c => c.type !== 'remove'), ns));
    const moves = [];
    for (const c of changes) {
      if (c.type === 'position' && c.position && !locked) {
        if (c.dragging && !dragKey.current) dragKey.current = 'drag:' + Date.now();
        moves.push({ op: 'moveNode', id: c.id, x: c.position.x, y: c.position.y });
        if (c.dragging === false) dragKey.current = null;
      }
      if (c.type === 'select' && c.selected) ctl.setSelected({ kind: 'node', id: c.id });
    }
    if (moves.length) patch(moves, 'Move', dragKey.current || 'drag:' + moves[0].id);
  }, [locked]); // eslint-disable-line react-hooks/exhaustive-deps

  const onEdgesChange = useCallback(changes => {
    for (const c of changes) if (c.type === 'select' && c.selected && !c.id.startsWith('watch:')) ctl.setSelected({ kind: 'edge', id: c.id });
  }, []);

  const onDelete = useCallback(({ nodes, edges }) => {
    if (locked) return;
    const ops = [...edges.filter(e => !e.id.startsWith('watch:')).map(e => ({ op: 'removeEdge', id: e.id })), ...nodes.map(n => ({ op: 'removeNode', id: n.id }))];
    const nodeIds = new Set(nodes.map(n => n.id));
    const kept = ops.filter(o => o.op !== 'removeEdge' || !graph.edges.some(e => e.id === o.id && (nodeIds.has(e.from.node) || nodeIds.has(e.to.node))));
    if (kept.length && patch(kept, 'Delete').ok) ctl.setSelected(null);
  }, [locked, version]); // eslint-disable-line react-hooks/exhaustive-deps

  const toModel = c => ({ from: { node: c.source, port: c.sourceHandle }, to: { node: c.target, port: c.targetHandle } });
  const isValidConnection = useCallback(c => !locked && canConnect(store.active().graph, toModel(c).from, toModel(c).to).ok, [locked]);
  const onConnect = useCallback(c => {
    const g = store.active().graph, m = toModel(c), r = canConnect(g, m.from, m.to);
    if (!r.ok) return ctl.toast(t('builder.cannotConnect', 'These two handles cannot be connected'), 'error');
    patch([{ op: 'addEdge', edge: { id: nextId(g.edges.map(e => e.id), r.value.kind === 'access' ? 'a' : 'e'), ...r.value } }], 'Connect');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Keep a newly added step in view at the current zoom (the flow grows downward). */
  const ensureVisible = id => requestAnimationFrame(() => requestAnimationFrame(() => {
    const n = rf.getInternalNode(id), box = wrap.current?.getBoundingClientRect(); if (!n || !box) return;
    const { x, y, zoom } = rf.getViewport(), w = n.measured?.width || 272, h = n.measured?.height || 76;
    const sx = n.internals.positionAbsolute.x * zoom + x, sy = n.internals.positionAbsolute.y * zoom + y;
    if (sx < 40 || sy < 40 || sx + w * zoom > box.width - 40 || sy + h * zoom > box.height - 60)
      rf.setCenter(n.internals.positionAbsolute.x + w / 2, n.internals.positionAbsolute.y + h / 2, { zoom, duration: 250 });
  }));

  const pick = type => {
    const g = store.active().graph, s = search; setSearch(null);
    const r = s.kind === 'edge' ? insertOnEdge(g, s.edgeId, type, measured()) : addAfter(g, s.nodeId, s.port, type, measured());
    if (!r.ok) return ctl.toast(r.error.message, 'error');
    const before = new Set(g.nodes.map(n => n.id));
    if (patch(r.value, s.kind === 'edge' ? 'Insert step' : 'Add step').ok) {
      const added = store.active().graph.nodes.find(n => !before.has(n.id) && n.type === type);
      if (added) { ctl.setSelected({ kind: 'node', id: added.id }); ensureVisible(added.id); }
    }
  };

  const addFromLibrary = (type, screen) => {
    const g = store.active().graph;
    const p = screen ? rf.screenToFlowPosition(screen) : (() => { const b = wrap.current.getBoundingClientRect(); return rf.screenToFlowPosition({ x: b.left + b.width / 2, y: b.top + b.height / 2 }); })();
    const r = addStandalone(g, type, p.x - sizeOf({ type }).width / 2, p.y - 30);
    if (patch(r.value, 'Add ' + type).ok) { ctl.setSelected({ kind: 'node', id: r.id }); ensureVisible(r.id); }
  };

  const arrange = () => { if (patch(layoutOps(store.active().graph, measured()), 'Arrange').ok) setTimeout(() => rf.fitView({ duration: 250, padding: 0.15 }), 30); };

  /* Undo / redo shortcuts while focus is not in a text field. */
  useEffect(() => {
    const onKey = e => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable) return;
      const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
      if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); store.dispatch({ type: 'undo' }); }
      else if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); store.dispatch({ type: 'redo' }); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <Library locked={locked} onAdd={type => addFromLibrary(type)} />
      <div className="canvas" ref={wrap} onDragOver={e => { if (!locked) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }}
        onDrop={e => { const type = e.dataTransfer.getData('application/x-bs-type'); if (type && !locked) { e.preventDefault(); addFromLibrary(type, { x: e.clientX, y: e.clientY }); } }}>
        {graph.nodes.length === 0 ? <EmptyState /> : null}
        <ReactFlow nodes={rfNodes} edges={rfEdges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onDelete={onDelete} onConnect={onConnect} isValidConnection={isValidConnection}
          onPaneClick={() => ctl.setSelected(null)} deleteKeyCode={locked ? null : ['Backspace', 'Delete']} nodesDraggable={!locked} nodesConnectable={!locked}
          minZoom={0.25} maxZoom={1.8} proOptions={{ hideAttribution: true }} fitViewOptions={{ padding: 0.15, maxZoom: 1 }}>
          <Background gap={18} size={1.2} color="#d3d7de" />
          <Controls showInteractive={false} position="bottom-left" />
          <MiniMap pannable zoomable position="bottom-right" nodeColor={n => ({ trigger: '#6b7482', agent: '#536bdb', tool: '#8a63c9', decision: '#d18a2f', control: '#c9771b', data: '#3f86ab', outcome: '#2f7a57', prohibited: '#c54545' }[n.data?.node?.type] || '#999')} />
          <Panel position="top-left" className="canvas-tools">
            {locked ? <div className="locked-note" id="lockNote"><b>{t('builder.locked', '{rev} is confirmed and locked.', { rev: ctl.revLabel(rev.rev) })}</b> {t('builder.lockedSub', 'Edits are refused; start a new revision to change it.')}<button className="btn sm" id="newRevBtn" onClick={() => ctl.newRevision()}>{t('builder.newRevision', 'Edit as new revision')}</button></div>
              : <button className="btn sm" id="arrangeBtn" onClick={arrange}><Icon d={I.layout} />{t('builder.arrange', 'Arrange')}</button>}
          </Panel>
        </ReactFlow>
        {search ? <NodeSearch at={search} allowed={search.kind === 'edge' ? EDGE_INSERTABLE : PORT_ADDABLE}
          title={search.kind === 'edge' ? t('search.insert', 'Insert a step') : t('search.next', 'Add the next step')} onPick={pick} onClose={() => setSearch(null)} /> : null}
      </div>
    </>);
}

export default function Builder() {
  useStudio();
  const route = ctl.getRoute();
  const sel = route.selected;
  return (
    <ReactFlowProvider>
      <main className="builder">
        <Canvas />
        {route.panel === 'assist' ? <AssistantPanel /> : route.panel === 'run' ? <TestRunPanel /> : sel && sel.kind === 'node' && store.active().graph.nodes.some(n => n.id === sel.id) ? <ConfigPanel nodeId={sel.id} /> : null}
      </main>
    </ReactFlowProvider>);
}
