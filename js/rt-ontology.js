// Runtime Observation · "What the ontology adds" (logs/2026-10-04_ONTOLOGY_OBSERVATION_SHOWCASE_PLAN.md, Part B).
// Three sub-tabs (logs/2026-10-11_RT_SUBTABS_VISUAL_PLAN.md): How types help (one real run, js/rt-onto-visual.js mountOntoHow),
// the pre-registered test (mountOntoS1) and Example runs (js/rt-onto-run.js mountOntoRun, one run per case with the
// case and rule switches kept here). p-values, counts and sources sit behind ⓘ, per-model tables in a closed <details>.
// Everything shown comes from data/onto-s1.json (the Stage-1 test) and data/onto-observability.json (example runs), generated from
// committed experiment outputs. The unconfirmed E-AL and E-PR results moved to silex-security/ontology-typed-alerting.
import { tip } from './rt-tip.js';
import { mountSubnav } from './rt-subnav.js';
import { VERDICT, mountOntoHow, mountOntoS1 } from './rt-onto-visual.js';
import { mountOntoRun } from './rt-onto-run.js';

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

async function init() {
  const root = $('rtOntologyBody');
  if (!root) return;
  try {
    const r = await fetch('data/onto-observability.json');
    if (!r.ok) throw new Error('unavailable');
    data = await r.json();
    let s1 = null;
    try { const rs = await fetch('data/onto-s1.json'); if (rs.ok) s1 = await rs.json(); } catch {}
    const a = data.al;
    const badge = v => { const [kind, text] = VERDICT[v] ?? VERDICT.inconclusive; return ` <span class="rt-chip" data-kind="${kind}">${esc(text)}</span>`; };
    root.innerHTML = `<nav data-rt-onto-subnav></nav>
      <div class="rt-onto-subpanels" data-rt-onto-subpanels>
      <div data-rt-subpanel="how"><div id="rtOntoHow"></div></div>
      ${s1 ? '<div data-rt-subpanel="s1" hidden><div id="rtOntoS1"></div></div>' : ''}
      <div data-rt-subpanel="ex" hidden>
      <p class="rt-onto-ex-intro" data-onto-ex-claim>Real held-out runs, one per case, picked by a fixed rule, including the cases where types lose an alert.${tip(`From an earlier held-out cohort: ${a.counts.runs} AgentDojo runs of ${a.models.length} agent models (${a.models.map(esc).join(', ')}). Examples are chosen by a fixed rule (first run by id in each case): <b>caught by both</b>, <b>alert saved</b> (types removed a false alarm), <b>alert lost</b> (types missed an attack) and <b>missed by both</b>. Outcomes are run level, from the benchmark's evaluator. Provenance here means: ${esc(data.provenance_note)}.`)}</p>
      <div class="rt-onto-controls">
        <div class="tabs" role="group" aria-label="Example">${CELLS.map(([id, label]) => `<button type="button" class="tab" data-onto-cell-btn="${id}">${label}</button>`).join('')}</div>
        <div class="tabs" role="group" aria-label="Rule"><button type="button" class="tab" data-onto-mode-btn="prov">Without ontology</button><button type="button" class="tab" data-onto-mode-btn="onto">With ontology</button></div>
      </div>
      <div id="rtOntoExample"></div>
      </div>
      </div>`;
    const how = mountOntoHow($('rtOntoHow'), { examples: data.examples, al: data.al, provenance_note: data.provenance_note }, { tip, reducedMotion });
    const s1View = s1 ? mountOntoS1($('rtOntoS1'), s1, { tip, reducedMotion }) : null;
    const sub = mountSubnav(root.querySelector('[data-rt-onto-subnav]'), {
      tab: 'ontology', label: 'Ontology sections', initial: 'how', panels: root.querySelector('[data-rt-onto-subpanels]'),
      items: [
        { key: 'how', label: 'How types help', hint: 'One real run, without and with types' },
        ...(s1 ? [{ key: 's1', label: 'Pre-registered test', hint: 'The confirmed result', extra: badge(s1.verdict), attrs: { 'data-onto-seg': 's1' } }] : []),
        { key: 'ex', label: 'Example runs', hint: 'Four kinds of real cases', attrs: { 'data-onto-seg': 'ex' } },
      ],
    });
    // The bar plays each picture the first time its sub-tab is on screen (js/rt-subnav.js bind).
    sub.bind('how', how);
    if (s1View) sub.bind('s1', s1View);
    root.addEventListener('click', e => {
      const c = e.target.closest('[data-onto-cell-btn]'), m = e.target.closest('[data-onto-mode-btn]');
      if (c) { cell = c.dataset.ontoCellBtn; render(); }
      if (m) { mode = m.dataset.ontoModeBtn; render(); }
    });
    render();
  } catch {
    root.innerHTML = '<p class="rt-ref">The ontology results could not be loaded.</p>';
  }
}
init();
