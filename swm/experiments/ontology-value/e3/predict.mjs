// predict.mjs — X2b E3 predictors (plan § E3). P-onto (deterministic type reasoning over the snapshot),
// B1 (blocked tool only) and B2 (write-impact enumeration). Each returns <= 10 distinct (tool, class)
// predictions with the pair already in the blocked path removed; ties broken by tool name.
//
// Effect -> coarse class table lives in effect-class.json (frozen). Mapping rationale (decided from each
// effect's label/def only):
//   authority grant -> access grant · data disclosure/read + PII disclosure -> data disclosure ·
//   data write/record alteration -> record alteration · configuration change -> credential change ·
//   service disruption -> availability · financial-value transfer / Unrecoverable Payout /
//   Unauthorised Pay Change / Unverified Bank Change -> value transfer · Authority removal -> null.
//   No effect maps to "message on the user's behalf" (no such effect exists in the snapshot).
import { nodeById, mayCauseOf, hazardsOf } from '../export-context.mjs';

export const CLASSES = [
  'value transfer',
  'data disclosure',
  'credential change',
  'access grant',
  'record alteration',
  'availability',
  "message on the user's behalf",
];

const pairKey = (tool, cls) => `${tool}\u0000${cls}`;

function toolByName(ctx, name) {
  return (ctx.tools ?? []).find(t => t.name === name) ?? null;
}

// Blocked path = set of (tool, class) of the blocked calls; class via toolMap -> action -> MAY_CAUSE
// effects -> effectClass. A call with a core-action-only mapping (no effects) contributes nothing.
export function blockedPairs(fold, ctx) {
  const out = [];
  for (const call of fold.blocked?.calls ?? []) {
    const tool = toolByName(ctx, call.function);
    if (!tool) continue;
    const tm = ctx.toolMap[tool.id];
    if (!tm) continue;
    const actionId = tm.action ?? tm.core;
    if (!actionId) continue;
    for (const eid of mayCauseOf(ctx.snapshot, actionId)) {
      const cls = ctx.effectClass[eid];
      if (cls) out.push({ tool: tool.name, class: cls, effect: eid });
    }
  }
  return out;
}

function blockedSet(fold, ctx) {
  return new Set(blockedPairs(fold, ctx).map(p => pairKey(p.tool, p.class)));
}

function dedupeRemove(preds, blocked, cap = 10) {
  const seen = new Set();
  const out = [];
  for (const p of [...preds].sort((a, b) => (a.rank - b.rank) || (a.tool < b.tool ? -1 : a.tool > b.tool ? 1 : 0))) {
    const key = pairKey(p.tool, p.class);
    if (seen.has(key) || blocked.has(key)) continue;
    seen.add(key);
    out.push({ tool: p.tool, class: p.class, rank: p.rank, nodes: [...new Set(p.nodes ?? [])] });
    if (out.length >= cap) break;
  }
  return out;
}

// rank 1: manifest tools whose mapped action MAY_CAUSE an effect of a blocked class.
function rank1(ctx, blockedClasses) {
  const preds = [];
  for (const tool of ctx.tools) {
    const tm = ctx.toolMap[tool.id];
    if (!tm) continue;
    const actionId = tm.action ?? tm.core;
    if (!actionId) continue;
    for (const eid of mayCauseOf(ctx.snapshot, actionId)) {
      const cls = ctx.effectClass[eid];
      if (!cls || !blockedClasses.has(cls)) continue;
      preds.push({ tool: tool.name, class: cls, rank: 1, nodes: [eid, actionId] });
    }
  }
  return preds;
}

// rank 2: a class whose effect shares the same L1 parent effect (SUBCLASS_OF) as a blocked effect.
function rank2(ctx, blocked) {
  const siblingEffects = new Set();
  for (const bp of blocked) {
    for (const parent of parentsOf(ctx.snapshot, bp.effect, 'SUBCLASS_OF')) {
      for (const l of ctx.snapshot.links) {
        if (l.pred === 'SUBCLASS_OF' && l.t === parent && l.s !== bp.effect && nodeById(ctx.snapshot, l.s)?.kind === 'effect') {
          siblingEffects.add(l.s);
        }
      }
    }
  }
  const preds = [];
  for (const tool of ctx.tools) {
    const tm = ctx.toolMap[tool.id];
    if (!tm) continue;
    const actionId = tm.action ?? tm.core;
    if (!actionId) continue;
    for (const eid of mayCauseOf(ctx.snapshot, actionId)) {
      if (!siblingEffects.has(eid)) continue;
      const cls = ctx.effectClass[eid];
      if (!cls) continue;
      preds.push({ tool: tool.name, class: cls, rank: 2, nodes: [eid, actionId] });
    }
  }
  return preds;
}

// rank 3: tools whose mapped action is HAZARD_FOR-linked to the same entity as the blocked action.
function rank3(ctx, fold) {
  const blockedActions = new Set();
  for (const call of fold.blocked?.calls ?? []) {
    const tool = toolByName(ctx, call.function);
    if (!tool) continue;
    const tm = ctx.toolMap[tool.id];
    if (!tm) continue;
    if (tm.action) blockedActions.add(tm.action);
    else if (tm.core) blockedActions.add(tm.core);
  }
  const entities = new Set();
  for (const act of blockedActions) {
    for (const h of hazardsOf(ctx.snapshot, act)) {
      for (const l of ctx.snapshot.links) if (l.pred === 'HAZARD_FOR' && l.s === h && nodeById(ctx.snapshot, l.t)?.kind === 'entity') entities.add(l.t);
    }
  }
  const relatedActions = new Set();
  for (const e of entities) {
    const haz = new Set();
    for (const l of ctx.snapshot.links) if (l.pred === 'HAZARD_FOR' && l.t === e) haz.add(l.s);
    for (const h of haz) for (const l of ctx.snapshot.links) if (l.pred === 'HAZARD_FOR' && l.s === h && nodeById(ctx.snapshot, l.t)?.kind === 'action') relatedActions.add(l.t);
  }
  const preds = [];
  for (const tool of ctx.tools) {
    const tm = ctx.toolMap[tool.id];
    if (!tm) continue;
    const actionId = tm.action ?? tm.core;
    if (!relatedActions.has(actionId)) continue;
    for (const eid of mayCauseOf(ctx.snapshot, actionId)) {
      const cls = ctx.effectClass[eid];
      if (cls) preds.push({ tool: tool.name, class: cls, rank: 3, nodes: [eid, actionId] });
    }
  }
  return preds;
}

function parentsOf(snapshot, id, pred) {
  return snapshot.links.filter(l => l.s === id && l.pred === pred).map(l => l.t);
}

export function pOnto(fold, ctx) {
  const blocked = blockedSet(fold, ctx);
  const blockedClasses = new Set(blockedPairs(fold, ctx).map(p => p.class));
  const preds = [
    ...rank1(ctx, blockedClasses),
    ...rank2(ctx, blockedPairs(fold, ctx)),
    ...rank3(ctx, fold),
  ];
  return dedupeRemove(preds, blocked);
}

export function b1(fold, ctx) {
  // The blocked tool with its own classes; the observed pair is dropped, so B1 is often empty.
  const preds = blockedPairs(fold, ctx).map(p => ({ tool: p.tool, class: p.class, rank: 1, nodes: [p.effect] }));
  return dedupeRemove(preds, blockedSet(fold, ctx));
}

export function b2(fold, ctx) {
  // Every write-impact tool of the suite, classes from the same frozen table via its mapped action.
  const preds = [];
  for (const tool of ctx.tools) {
    if (tool.impact !== 'write') continue;
    const tm = ctx.toolMap[tool.id];
    if (!tm) continue;
    const actionId = tm.action ?? tm.core;
    if (!actionId) continue;
    for (const eid of mayCauseOf(ctx.snapshot, actionId)) {
      const cls = ctx.effectClass[eid];
      if (cls) preds.push({ tool: tool.name, class: cls, rank: 1, nodes: [eid, actionId] });
    }
  }
  return dedupeRemove(preds, blockedSet(fold, ctx));
}
