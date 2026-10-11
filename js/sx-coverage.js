// Scenario Expansion ② "Where the rule holds" (logs/2026-10-11_SCENARIO_EXPANSION_PLAN.md, task T2, coder-sol).
// Placeholder from T0: returns an inert handle. No DOM access at module top level.
export function mountCoverage(el, model, opts = {}) {
  el.innerHTML = '<div data-sx="coverage"></div>';
  return { setLogs() {}, destroy() { el.innerHTML = ''; } };
}
