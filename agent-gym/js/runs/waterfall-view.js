// Renders runWaterfall() as the shared trace-waterfall markup (css/trace-waterfall.css) and paints it at a replay position.
// The replay cursor of the run page drives it, so there is no clock or playback of its own here.
import { panel } from '../components/ui.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const look = b => `data-tone="${b.tone}"${b.fill ? ` data-fill="${b.fill}"` : ''}${b.mark ? ` data-mark="${b.mark}"` : ''}`;
const LEGEND = [
  ['Tool request', { tone: 'blue' }], ['Model', { tone: 'violet' }], ['Decision', { tone: 'grey', fill: 'soft' }], ['Approved', { tone: 'green' }],
  ['Waiting (timeout, approval asked)', { tone: 'amber', fill: 'hatch' }], ['Failed or blocked', { tone: 'red', mark: 'fail' }],
];
const KPIS = [['Step', 'step'], ['Tool requests', 'tools'], ['Timeouts', 'timeouts', 'amber'], ['Failed or blocked', 'failed', 'red'], ['Assertions failed', 'assertionsFailed', 'red']];

function ticks(total) {
  const every = Math.ceil(total / 12);
  const out = [];
  for (let x = 0; x < total; x += every) out.push(x);
  return out;
}

const layouts = new WeakMap();

export function waterfallPanel(w, { run } = {}) {
  const root = document.createElement('div');
  root.className = 'tw run-wf';
  if (!w.total) { root.innerHTML = '<p class="tw-empty">No events recorded.</p>'; return panel({ class: 'run-wf-panel', flush: true, children: root }); }
  const room = w.total * 1.3;
  const pct = v => `${(v / room * 100).toFixed(3)}%`;
  root.dataset.room = String(room);
  root.dataset.total = String(w.total);
  const mark = ticks(w.total);
  root.innerHTML = `
    <div class="tw-top"><b>Run trace</b><span class="tw-run">${esc(run ?? '')}</span><span class="tw-note">Steps in recorded order. Events carry no timestamps, so bar length is not time.</span></div>
    <div class="tw-kpis">${KPIS.map(([l, k, tone]) => `<div><small>${l}</small><span data-kpi="${k}"${tone ? ` data-tone="${tone}"` : ''}></span></div>`).join('')}</div>
    <div class="tw-scroll"><div class="tw-grid">
      <div class="tw-head">Workflow node, then event</div>
      <div class="tw-head tw-axis">${mark.map(x => `<i style="left:${pct(x)}">${x + 1}</i>`).join('')}</div>
      <div class="tw-names">${w.rows.map((r, i) => `<div class="tw-row" data-depth="${r.depth}" data-row="${i}" data-key="${esc(r.key)}"${r.depth === 2 ? ` data-parent="${esc(r.parent)}"` : ''}>
        ${r.depth === 1 ? `<button type="button" class="tw-toggle" data-toggle="${esc(r.key)}" aria-expanded="true" aria-label="Show or hide the events of ${esc(r.name)}"></button>` : ''}
        <span class="tw-name">${esc(r.name)}</span><span class="tw-sub">${esc(r.sub)}</span></div>`).join('')}</div>
      <div class="tw-lanes">${mark.slice(1).map(x => `<span class="tw-tick" style="left:${pct(x)}"></span>`).join('')}
        ${w.rows.map((r, i) => `<div class="tw-lane" data-row="${i}"${r.depth === 2 ? ` data-parent="${esc(r.parent)}"` : ''}>
          ${r.bars.map(b => `<span class="tw-bar" ${look(b)} data-s="${b.start}" data-e="${b.end}" style="left:${pct(b.start)}"></span>`).join('')}
          <span class="tw-label" data-e="${r.end}" style="left:${pct(r.end)}">${esc(r.label)}${(r.badges ?? []).map(b => `<em data-tone="${b.tone}">${esc(b.text)}</em>`).join('')}</span></div>`).join('')}
        <span class="tw-playhead"></span></div>
    </div></div>
    <div class="tw-foot"><div class="tw-legend">${LEGEND.map(([l, b]) => `<span><i ${look(b)}></i>${l}</span>`).join('')}</div></div>`;
  root.addEventListener('click', e => {
    const t = e.target.closest('[data-toggle]');
    if (!t) return;
    const open = t.getAttribute('aria-expanded') !== 'true';
    t.setAttribute('aria-expanded', String(open));
    for (const el of root.querySelectorAll('[data-parent]')) if (el.dataset.parent === t.dataset.toggle) el.hidden = !open;
  });
  layouts.set(root, w);
  return panel({ class: 'run-wf-panel', flush: true, children: root });
}

/** Shows the bars up to `position` (events shown), marks the row being replayed, and updates the counters. */
export function paintWaterfall(host, position) {
  const root = host.querySelector('.run-wf');
  const w = root && layouts.get(root);
  if (!w) return;
  const room = Number(root.dataset.room);
  const pct = v => `${(v / room * 100).toFixed(3)}%`;
  const live = w.rows.filter(r => r.depth === 2 && r.start < position && position < w.total);
  root.querySelectorAll('.tw-lane').forEach((lane, i) => {
    const r = w.rows[i];
    const growing = r.depth === 2 && live.includes(r) && position <= r.end;
    for (const b of lane.querySelectorAll('.tw-bar')) {
      const width = Math.min(Number(b.dataset.e), position) - Number(b.dataset.s);
      b.hidden = width <= 0;
      if (width > 0) b.style.width = pct(width);
      b.classList.toggle('growing', growing && !b.hidden);
    }
    lane.querySelector('.tw-label').hidden = position < r.end;
  });
  root.querySelectorAll('.tw-row').forEach((n, i) => {
    const r = w.rows[i];
    n.classList.toggle('pending', r.start >= position);
    n.classList.toggle('running', r.depth === 2 && r.start < position && position <= r.end && position < w.total);
  });
  const head = root.querySelector('.tw-playhead');
  head.style.left = pct(position);
  head.hidden = position <= 0 || position >= w.total;
  const shown = w.rows.filter(r => r.depth === 2 && r.end <= position);
  const count = key => shown.filter(r => r.flags[key]).length;
  const values = { step: `${position} of ${w.total}`, tools: count('tool'), timeouts: count('timeout'), failed: count('fail'), assertionsFailed: w.counts.assertionsFailed };
  for (const el of root.querySelectorAll('[data-kpi]')) {
    el.textContent = values[el.dataset.kpi];
    if (el.dataset.tone) el.toggleAttribute('data-on', Number(values[el.dataset.kpi]) > 0);
  }
}
