// Runtime Observation sub-tabs (logs/2026-10-07_RUNTIME_SUBTABS_PLAN.md §3).
// Five tabs: scenarios, plane, learning, ontology, latency. A click or arrow key switches tabs without writing the hash
// (the site's ordinary navigation never does); #view=runtime-observation&tab=<id> opens one. window.__rtTabs.open(id)
// is the hook for "See this run" and "Try the loop".
import './rt-tip.js';

const TABS = ['scenarios', 'plane', 'learning', 'ontology', 'latency'];
const buttons = [...document.querySelectorAll('.rt-tabs [data-rt-tab]')];
const panels = [...document.querySelectorAll('#runtime-observation [data-rt-panel]')];
let currentTab = 'scenarios';

function open(id, { focus = false } = {}) {
  if (!TABS.includes(id)) id = 'scenarios';
  currentTab = id;
  for (const b of buttons) {
    const on = b.dataset.rtTab === id;
    b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
    if (on && focus) b.focus();
  }
  for (const p of panels) { const on = p.dataset.rtPanel === id; p.hidden = !on; p.classList.toggle('active', on); }
  document.dispatchEvent(new CustomEvent('rt:tab', { detail: { tab: id } }));
}

for (const b of buttons) b.addEventListener('click', () => open(b.dataset.rtTab));
document.querySelector('.rt-tabs')?.addEventListener('keydown', e => {
  const i = TABS.indexOf(currentTab);
  const next = { ArrowRight: i + 1, ArrowLeft: i - 1 + TABS.length, Home: 0, End: TABS.length - 1 }[e.key];
  if (next == null) return;
  e.preventDefault(); open(TABS[next % TABS.length], { focus: true });
});

function fromHash() {
  const h = location.hash.slice(1);
  if (!h.startsWith('view=')) return;
  const q = new URLSearchParams(h);
  if (q.get('view') === 'runtime-observation' && q.has('tab')) open(q.get('tab'));
}
addEventListener('hashchange', fromHash);
fromHash();

window.__rtTabs = { open, current: () => currentTab, tabs: TABS };
