// Scenario Expansion view host (logs/2026-10-11_SCENARIO_EXPANSION_PLAN.md, view host).
// Mounts the four sub-tabs with js/rt-subnav.js the first time the view is shown, and hands the animated panels'
// handles to the bar's lifecycle. Deep links: #view=scenario-expansion[&sub=expand|coverage|replay|judging]. The
// inline router in index.html shows the view; this module reads the sub-tab from the hash itself, on load and on
// every hashchange, because js/rt-subtabs.js resets window.__rtSubPending on every view= hash.
// No DOM access at module top level beyond the listeners registered in start().
import { mountSubnav } from './rt-subnav.js';
import { tip } from './rt-tip.js';
import { expand, SEED, AXES, TIERS, CONSTRAINTS, RULE, OUTCOMES, CLASSES, OPS, GRADE, ONTOLOGY_VERSION } from './sx-model.js';
import { mountExpand } from './sx-expand.js';
import { mountCoverage } from './sx-coverage.js';
import { mountReplay } from './sx-replay.js';

const VIEW = 'scenario-expansion';
export const SUBS = [
  { key: 'expand', label: 'Expand one attack', hint: 'Five conditions, pruned by the ontology' },
  { key: 'coverage', label: 'Where the rule holds', hint: 'Every variant against one rule' },
  { key: 'replay', label: 'Replay one variant', hint: 'Step through its runtime graph' },
  { key: 'judging', label: 'How results are judged', hint: 'What gets recorded, and by whom' },
];

/** The model every panel reads: the expansion plus the constants it was built from. */
export function sxModel() {
  return { ...expand(), SEED, AXES, TIERS, CONSTRAINTS, RULE, OUTCOMES, CLASSES, OPS, GRADE, ONTOLOGY_VERSION };
}

/** The sub-tab a hash asks for: undefined when the hash is not this view, null when it names no sub-tab. */
export function subFromHash(hash) {
  const h = String(hash ?? '').replace(/^#/, '');
  if (!h.startsWith('view=')) return undefined;
  const q = new URLSearchParams(h);
  if (q.get('view') !== VIEW) return undefined;
  return q.get('sub');
}

function start() {
  const view = document.getElementById(VIEW);
  if (!view) return;
  let api = null, model = null, pending; // undefined: no request; null: the default sub-tab
  const handles = {};

  function mount() {
    if (api) return;
    // On a loaded page the inline router's hashchange listener runs first and shows the view (rt:view) before
    // fromHash below has recorded the sub-tab; read it here so a deep link never starts ① on the way.
    if (pending === undefined) { const sub = subFromHash(location.hash); if (sub !== undefined) pending = sub; }
    model = sxModel();
    const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const el = id => view.querySelector(`[data-sx-mount="${id}"]`);
    handles.expand = mountExpand(el('expand'), model, { tip, reducedMotion });
    handles.coverage = mountCoverage(el('coverage'), model, { tip });
    handles.replay = mountReplay(el('replay'), model, { tip, reducedMotion });
    api = mountSubnav(view.querySelector('[data-sx-subnav]'), {
      tab: 'sx', label: 'Scenario Expansion sections', items: SUBS, panels: view.querySelector('[data-sx-subpanels]'),
    });
    // Open a deep-linked sub-tab before binding, so a handle is never started and paused on the way.
    if (pending !== undefined) { api.open(pending ?? 'expand'); pending = undefined; }
    api.bind('expand', handles.expand);
    api.bind('replay', handles.replay);
  }

  function fromHash() {
    const sub = subFromHash(location.hash);
    if (sub === undefined) return;
    if (api) api.open(sub ?? 'expand'); else pending = sub;
    // The inline router has already shown the view on a cold load; mount now rather than wait for rt:view.
    if (view.classList.contains('active')) mount();
  }

  document.addEventListener('rt:view', e => { if (e.detail?.view === VIEW) mount(); });
  document.addEventListener('sx:replay', e => {
    const id = e.detail?.id;
    if (!id) return;
    mount();
    handles.replay.select(id);
    api.open('replay', { focus: true });
  });
  addEventListener('hashchange', fromHash);
  fromHash();
  if (view.classList.contains('active')) mount();

  window.__sxView = {
    get model() { return model; },
    open(key) { mount(); api.open(key); },
    current: () => api?.current() ?? null,
    initial: SUBS[0].key,
  };
}

if (typeof document !== 'undefined') start();
