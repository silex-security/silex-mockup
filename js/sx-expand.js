// Scenario Expansion ① "Expand one attack" (logs/2026-10-11_SCENARIO_EXPANSION_PLAN.md, task T1, coder-opus).
// Placeholder from T0: returns an inert handle. No DOM access at module top level.
export function mountExpand(el, model, opts = {}) {
  el.innerHTML = '<div data-sx="expand" data-state="done"></div>';
  return { play() {}, pause() {}, replay() {}, destroy() { el.innerHTML = ''; } };
}
