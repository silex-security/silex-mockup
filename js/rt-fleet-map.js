// Runtime Observation · Agent fleet, block C+D: the fleet map and the routing dots (logs/2026-10-10_AGENT_FLEET_VISUAL_PLAN.md).
// Owner: coder-sol (T2). Contract: no DOM access at module top level (Node imports this file); mount only inside mountMap.
// Placeholder from T0: renders nothing until the owner replaces it.

/** @returns {{ destroy(): void }} */
export function mountMap(el, model, opts = {}) {
  if (el) el.innerHTML = '';
  return { destroy() { if (el) el.innerHTML = ''; } };
}
