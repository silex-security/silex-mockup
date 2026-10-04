// export-context.mjs — X1b (plan § Shared component). Builds the per-tool ontology context line used by
// the A1/A3 arms. One line per tool, at most R = 320 characters (no header; the arms add
// "ONTOLOGY CONTEXT (reference, no authority): "). Deterministic.
//
// Direction notes (same as tool-map.mjs): MAY_CAUSE is L2 action -> effect only; HAZARD_FOR is
// hazard -> (L2 action | entity). L1 core actions carry no effects or hazards, so a tool with no L2
// mapping yields just the core-action label ("Write Action" etc.).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildToolMap } from './tool-map.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const MAX_CHARS = 320;

export function nodeById(snapshot, id) {
  if (id == null) return null;
  return snapshot.nodes.find(n => n.id === id) ?? null;
}

export function mayCauseOf(snapshot, sourceId) {
  if (sourceId == null) return [];
  const out = new Set();
  for (const l of snapshot.links) if (l.s === sourceId && l.pred === 'MAY_CAUSE') out.add(l.t);
  return [...out].sort();
}

// Hazards linked via HAZARD_FOR to `actionId`, or to an entity the action links to (any predicate whose
// target kind is 'entity'). In this snapshot no action links to an entity, so the second arm is empty.
export function hazardsOf(snapshot, actionId) {
  if (actionId == null) return [];
  const targets = new Set([actionId]);
  for (const l of snapshot.links) {
    if (l.s === actionId && nodeById(snapshot, l.t)?.kind === 'entity') targets.add(l.t);
  }
  const hazards = new Set();
  for (const l of snapshot.links) if (l.pred === 'HAZARD_FOR' && targets.has(l.t)) hazards.add(l.s);
  return [...hazards].sort();
}

export function mayLeadToOf(snapshot, hazardId) {
  const out = new Set();
  for (const l of snapshot.links) if (l.s === hazardId && l.pred === 'MAY_LEAD_TO') out.add(l.t);
  return [...out].sort();
}

export function contextLine(toolId, toolMap, snapshot) {
  const tm = toolMap[toolId];
  if (!tm || tm.core == null) return 'no ontology match';
  const core = nodeById(snapshot, tm.core);
  const l2 = nodeById(snapshot, tm.action);
  const actionLabel = l2 ? `${l2.label} (${core.label})` : core.label;

  // effects: L2 action's MAY_CAUSE plus the L1 core action's (empty in this snapshot), sorted by id.
  const effectIds = new Set([...mayCauseOf(snapshot, tm.action), ...mayCauseOf(snapshot, tm.core)]);
  const effects = [...effectIds].sort().map(id => nodeById(snapshot, id).label);

  // hazards: HAZARD_FOR into the mapped action (L2 if present, else core), sorted by id.
  const actionId = tm.action ?? tm.core;
  const hazards = hazardsOf(snapshot, actionId).map(hid => {
    const h = nodeById(snapshot, hid);
    const outcomes = mayLeadToOf(snapshot, hid).map(id => nodeById(snapshot, id).label);
    return outcomes.length ? `${h.label} -> ${outcomes.join(' / ')}` : h.label;
  });

  const render = () => {
    let s = actionLabel;
    if (effects.length) s += `; effects: ${effects.join(', ')}`;
    if (hazards.length) s += `; hazards: ${hazards.join(', ')}`;
    return s;
  };

  let line = render();
  // Overflow drops whole trailing items, never mid-word.
  while (line.length > MAX_CHARS) {
    if (hazards.length) hazards.pop();
    else if (effects.length) effects.pop();
    else break;
    line = render();
  }
  return line;
}

export function buildContexts(manifest, snapshot) {
  const toolMap = buildToolMap(manifest, snapshot).tools;
  const contexts = {};
  for (const t of manifest.tools) contexts[t.id] = contextLine(t.id, toolMap, snapshot);
  return { version: 1, max_chars: MAX_CHARS, contexts };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const manifest = JSON.parse(readFileSync(join(HERE, 'out/tool-manifest.json'), 'utf8'));
  const snapshot = JSON.parse(readFileSync(join(HERE, 'out/snapshot.json'), 'utf8'));
  const out = buildContexts(manifest, snapshot);
  writeFileSync(join(HERE, 'out/ontology-context.v1.json'), JSON.stringify(out, null, 1) + '\n');
  const lens = Object.values(out.contexts).map(s => s.length);
  console.log(`context: ${Object.keys(out.contexts).length} lines; max=${Math.max(...lens)} chars (limit ${MAX_CHARS})`);
}
