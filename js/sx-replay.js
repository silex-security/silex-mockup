// Scenario Expansion ③ "Replay one variant" (logs/2026-10-11_SCENARIO_EXPANSION_PLAN.md, task T3, coder-opus).
// Placeholder from T0: shows the SEED by default and implements only the select() hook the contract fixes, so
// js/sx-coverage.js can be tested before T3 lands. No DOM access at module top level.
import { variantId } from './sx-model.js';

export function mountReplay(el, model, opts = {}) {
  el.innerHTML = '<div data-sx="replay"></div>';
  const root = el.firstElementChild;
  root.dataset.sxVariant = variantId(model.SEED.values);
  return {
    select(id) { root.dataset.sxVariant = id; },
    play() {}, pause() {},
    destroy() { el.innerHTML = ''; },
  };
}
