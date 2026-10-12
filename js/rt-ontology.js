// Runtime Observation · "What the ontology adds" (logs/2026-10-04_ONTOLOGY_OBSERVATION_SHOWCASE_PLAN.md, Part B).
// Three sub-tabs (logs/2026-10-11_RT_SUBTABS_VISUAL_PLAN.md): How types help (one real run, js/rt-onto-visual.js mountOntoHow),
// the pre-registered test (mountOntoS1) and Example runs (js/rt-onto-run.js mountOntoRun, one run per case with the
// case and rule switches kept here). p-values, counts and sources sit behind ⓘ, per-model tables in a closed <details>.
// Everything shown comes from data/onto-s1.json (the Stage-1 test) and data/onto-observability.json (example runs), generated from
// committed experiment outputs. The unconfirmed E-AL and E-PR results moved to silex-security/ontology-typed-alerting.
// Two more sub-tabs (logs/2026-10-11_FLEET_ONTOLOGY_GRAPH_PLAN.md, T3): In the agent fleet (js/rt-onto-fleet.js) and Graph &
// files (js/rt-onto-graph.js), both from one loadFleetOntology() started with the measured fetches. The bar mounts once all
// have settled; a failed fetch empties only its own panels. Amendment v0.4: Graph & files leads with the Vision block
// (js/rt-onto-vision.js, task T5), mounted through mountVision() below, then "What exists today" (the v0.3 graph).
import { tip } from './rt-tip.js';
import { mountSubnav } from './rt-subnav.js';
import { VERDICT, mountOntoHow, mountOntoS1 } from './rt-onto-visual.js';
import { mountOntoRun } from './rt-onto-run.js';
import { loadFleetOntology, PACK_PATH } from './rt-onto-fleet-model.js';
import { mountOntoFleet } from './rt-onto-fleet.js';
import { mountOntoGraph } from './rt-onto-graph.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const CELLS = [
  ['both', 'Caught by both', 'A successful attack that both rules alert on'],
  ['saved', 'Alert saved', 'The untyped rule alerts on a run without a successful attack; the typed rule does not'],
  ['lost', 'Alert lost', 'A successful attack the untyped rule catches and the typed rule misses'],
  ['miss', 'Missed by both', 'A successful attack neither rule alerts on'],
];
const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

let data = null, cell = 'both', mode = 'onto', runView = null;

function render() {
  const input = { ex: data.examples.find(e => e.cell === cell), mode, desc: CELLS.find(c => c[0] === cell)[2] };
  if (runView) runView.update(input); else runView = mountOntoRun($('rtOntoExample'), input, { tip, reducedMotion });
  for (const b of document.querySelectorAll('[data-onto-cell-btn]')) { const on = b.dataset.ontoCellBtn === cell; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); }
  for (const b of document.querySelectorAll('[data-onto-mode-btn]')) { const on = b.dataset.ontoModeBtn === mode; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); }
  $('rtOntology').dataset.ontoMode = mode; $('rtOntology').dataset.ontoCell = cell;
}

const getJson = async url => { const r = await fetch(url); if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`); return r.json(); };
const FLEET_FAIL = '<p class="rt-ref">The fleet ontology could not be loaded.</p>';

/** The Vision block's hook point: mountOntoVision(el, { tip, pack }) from js/rt-onto-vision.js, or null when that module
 *  or the pack is unavailable (the graph panel then starts with "What exists today"). */
async function mountVision(el, pack) {
  if (!el || !pack) return null;
  try {
    const { mountOntoVision } = await import('./rt-onto-vision.js');
    return mountOntoVision?.(el, { tip, pack }) ?? null;
  } catch { return null; }
}

async function init() {
  const root = $('rtOntologyBody');
  if (!root) return;
  const [obs, s1r, fleetR, packR] = await Promise.allSettled([getJson('data/onto-observability.json'), getJson('data/onto-s1.json'), loadFleetOntology(), getJson(PACK_PATH)]);
  data = obs.status === 'fulfilled' ? obs.value : null;
  const s1 = s1r.status === 'fulfilled' ? s1r.value : null;
  const fleet = fleetR.status === 'fulfilled' ? fleetR.value : null;
  const pack = packR.status === 'fulfilled' ? packR.value : null;
  const a = data?.al;
  const badge = v => { const [kind, text] = VERDICT[v] ?? VERDICT.inconclusive; return ` <span class="rt-chip" data-kind="${kind}">${esc(text)}</span>`; };
  root.innerHTML = `<nav data-rt-onto-subnav></nav>
    <div class="rt-onto-subpanels" data-rt-onto-subpanels>
    <div data-rt-subpanel="how">${data ? '<div id="rtOntoHow"></div>' : '<p class="rt-ref">The ontology results could not be loaded.</p>'}</div>
    ${s1 ? '<div data-rt-subpanel="s1" hidden><div id="rtOntoS1"></div></div>' : ''}
    ${data ? `<div data-rt-subpanel="ex" hidden>
    <p class="rt-onto-ex-intro" data-onto-ex-claim>Real held-out runs, one per case, picked by a fixed rule, including the cases where types lose an alert.${tip(`From an earlier held-out cohort: ${a.counts.runs} AgentDojo runs of ${a.models.length} agent models (${a.models.map(esc).join(', ')}). Examples are chosen by a fixed rule (first run by id in each case): <b>caught by both</b>, <b>alert saved</b> (types removed a false alarm), <b>alert lost</b> (types missed an attack) and <b>missed by both</b>. Outcomes are run level, from the benchmark's evaluator. Provenance here means: ${esc(data.provenance_note)}.`)}</p>
    <div class="rt-onto-controls">
      <div class="tabs" role="group" aria-label="Example">${CELLS.map(([id, label]) => `<button type="button" class="tab" data-onto-cell-btn="${id}">${label}</button>`).join('')}</div>
      <div class="tabs" role="group" aria-label="Rule"><button type="button" class="tab" data-onto-mode-btn="prov">Without ontology</button><button type="button" class="tab" data-onto-mode-btn="onto">With ontology</button></div>
    </div>
    <div id="rtOntoExample"></div>
    </div>` : ''}
    <div data-rt-subpanel="fleet" hidden>${fleet ? '<div id="rtOntoFleet"></div>' : FLEET_FAIL}</div>
    <div data-rt-subpanel="graph" hidden><div data-onto-vision-mount></div>
    <h3 class="rt-onto-today">What exists today</h3>${fleet ? '<div id="rtOntoGraph"></div>' : FLEET_FAIL}</div>
    </div>`;
  const how = data ? mountOntoHow($('rtOntoHow'), { examples: data.examples, al: data.al, provenance_note: data.provenance_note }, { tip, reducedMotion }) : null;
  const s1View = s1 ? mountOntoS1($('rtOntoS1'), s1, { tip, reducedMotion }) : null;
  let fleetView = null, graph = null;
  if (fleet) {
    try { fleetView = mountOntoFleet($('rtOntoFleet'), fleet, { tip }); } catch (e) { console.error(e); $('rtOntoFleet').innerHTML = FLEET_FAIL; }
    try { graph = mountOntoGraph($('rtOntoGraph'), fleet, { tip }); } catch (e) { console.error(e); $('rtOntoGraph').innerHTML = FLEET_FAIL; }
  }
  const vision = await mountVision(root.querySelector('[data-onto-vision-mount]'), pack);
  // Graph & files draws when it is first shown (Contract C), whether or not motion is allowed; ensure() is idempotent.
  const ensureGraph = () => { try { Promise.resolve(graph?.ensure?.()).catch(() => {}); } catch {} };
  document.addEventListener('rt:sub', e => { if (e.detail?.tab === 'ontology' && e.detail.sub === 'graph') ensureGraph(); });
  const sub = mountSubnav(root.querySelector('[data-rt-onto-subnav]'), {
    tab: 'ontology', label: 'Ontology sections', initial: 'how', panels: root.querySelector('[data-rt-onto-subpanels]'),
    items: [
      { key: 'how', label: 'How types help', hint: 'One real run, without and with types' },
      ...(s1 ? [{ key: 's1', label: 'Pre-registered test', hint: 'The confirmed result', extra: badge(s1.verdict), attrs: { 'data-onto-seg': 's1' } }] : []),
      ...(data ? [{ key: 'ex', label: 'Example runs', hint: 'Four kinds of real cases', attrs: { 'data-onto-seg': 'ex' } }] : []),
      { key: 'fleet', label: 'In the agent fleet', hint: 'What the ontology does for six agents' },
      { key: 'graph', label: 'Graph & files', hint: 'The vision, today\'s pack, every JSON file' },
    ],
  });
  // A cold deep link to Graph & files opened the sub-tab inside mountSubnav, before the listener above could matter.
  if (sub.current() === 'graph') ensureGraph();
  // The bar plays each picture the first time its sub-tab is on screen (js/rt-subnav.js bind).
  if (how) sub.bind('how', how);
  if (s1View) sub.bind('s1', s1View);
  if (fleetView) sub.bind('fleet', fleetView);
  // One handle for the panel: the vision's switch plays once on first show; the graph draws then too (ensure() is also
  // called on rt:sub above, so it draws under reduced motion, when the bar never calls play()).
  if (vision || graph) sub.bind('graph', { play() { vision?.play?.(); ensureGraph(); }, pause() { vision?.pause?.(); } });
  if (data) {
    root.addEventListener('click', e => {
      const c = e.target.closest('[data-onto-cell-btn]'), m = e.target.closest('[data-onto-mode-btn]');
      if (c) { cell = c.dataset.ontoCellBtn; render(); }
      if (m) { mode = m.dataset.ontoModeBtn; render(); }
    });
    render();
    sub.bind('ex', runView);
  }
}
init();
