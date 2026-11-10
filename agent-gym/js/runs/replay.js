// Run replay cursor over one execution's recorded events. Replay only moves a position; it never re-executes.
// position = number of events shown (0..total). The last shown event is the current step.

const clamp = (n, total) => Math.max(0, Math.min(total, n));

export const initialCursor = total => ({ position: total, playing: false });

/** @param {{position:number, playing:boolean}} cursor  @param {{type:string, position?:number}} action */
export function replayReducer(cursor, action, total) {
  switch (action.type) {
    case 'play': return total ? { position: cursor.position >= total ? 0 : cursor.position, playing: true } : cursor;
    case 'pause': return { ...cursor, playing: false };
    case 'step': return { position: clamp(cursor.position + 1, total), playing: false };
    case 'back': return { position: clamp(cursor.position - 1, total), playing: false };
    case 'seek': return { position: clamp(Math.round(Number(action.position) || 0), total), playing: false };
    case 'replay': return { position: 0, playing: total > 0 };
    case 'tick': {
      const position = clamp(cursor.position + 1, total);
      return { position, playing: cursor.playing && position < total };
    }
    default: return cursor;
  }
}

const FLAG = e => e.type === 'policy_block' ? 'blocked' : e.responseState === 'timeout' ? 'timeout' : null;

/** What the blueprint and trace show at a position: visited nodes, the walked edges, the current node and its flags. */
export function replayFrame(events, position) {
  const shown = events.slice(0, position);
  const path = [];
  const flags = {};
  for (const e of shown) {
    if (!e.nodeId) continue;
    if (path.at(-1) !== e.nodeId) path.push(e.nodeId);
    const flag = FLAG(e);
    if (flag) (flags[e.nodeId] ??= new Set()).add(flag);
  }
  const current = shown.at(-1) ?? null;
  return {
    position, total: events.length, current, path, flags,
    visited: new Set(path),
    activeNodeId: current?.nodeId || null,
    edges: new Set(path.slice(1).map((to, i) => `${path[i]}>${to}`)),
  };
}
