// The product suite, read from the sidebar markup. The sidebar is the only place that maps products to views:
// <div class="section-label" data-suite="<key>" data-stage data-status data-desc data-caps> opens a group and the
// .nav buttons that follow it are its views. The top-bar lifecycle rail and the home page product map are both
// rendered from that, and every button carries data-jump, which index.html already handles.
// Nothing here touches the DOM at module top level.

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * @typedef {{ type: 'group', text: string, key?: string, stage?: string, status?: string, desc?: string, caps?: string }
 *   | { type: 'view', id: string, label: string }} Entry  sidebar entries in document order
 * @typedef {{ title: string, detail?: string }} Cap  one capability, written "Title" or "Title: detail"
 * @typedef {{ key: string, label: string, short: string, stage: string, status: string, desc: string, caps: Cap[], views: { id: string, label: string }[] }} Group
 */

const readCaps = raw => (raw ?? '').split('|').filter(Boolean).map(c => {
  const i = c.indexOf(': ');
  return i < 0 ? { title: c.trim() } : { title: c.slice(0, i).trim(), detail: c.slice(i + 2).trim() };
});

/** @param {Entry[]} entries @returns {Group[]} the groups that carry a data-suite key, in sidebar order */
export function readSuite(entries) {
  const groups = [];
  let open = null;
  for (const e of entries) {
    if (e.type === 'group') {
      open = e.key ? { key: e.key, label: e.text, short: e.text.replace(/^(SILEX|Agent)\s+/, ''), stage: e.stage ?? '', status: e.status ?? '', desc: e.desc ?? '', caps: readCaps(e.caps), views: [] } : null;
      if (open) groups.push(open);
    } else if (open) open.views.push({ id: e.id, label: e.label });
  }
  return groups;
}

/** The group that owns a nav view id, or undefined. */
export const groupOf = (groups, viewId) => groups.find(g => g.views.some(v => v.id === viewId));

/** Flatten the live sidebar into readSuite's input. */
export function sidebarEntries(sidebar) {
  return [...sidebar.querySelectorAll('.section-label, .nav button[data-view]')].map(el => el.classList.contains('section-label')
    ? { type: 'group', text: el.textContent.trim(), key: el.dataset.suite, stage: el.dataset.stage, status: el.dataset.status, desc: el.dataset.desc, caps: el.dataset.caps }
    : { type: 'view', id: el.dataset.view, label: [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim() });
}

const chip = g => `<span class="rx-stt ${esc(g.status.toLowerCase())}">${esc(g.status)}</span>`;
const jumpButtons = g => g.views.map(v => `<button type="button" class="btn secondary" data-jump="${esc(v.id)}">${esc(v.label)}</button>`).join('');

const capsHtml = g => g.caps.length ? `<ul class="suite-caps">${g.caps.map(c => `<li><b>${esc(c.title)}</b>${c.detail ? ` ${esc(c.detail)}` : ''}</li>`).join('')}</ul>` : '';

export function railHtml(groups, activeKey) {
  return groups.map((g, i) => {
    const sep = i === 0 ? '' : `<span class="suite-sep" aria-hidden="true">${i === 1 ? '·' : '→'}</span>`;
    return `${sep}<button type="button" class="suite-chip" data-suite-chip="${esc(g.key)}" data-jump="${esc(g.views[0]?.id)}" title="${esc(g.label + ' · ' + g.stage)}"${g.key === activeKey ? ' aria-current="true"' : ''}>${esc(g.short)}</button>`;
  }).join('');
}

export function mapHtml(groups) {
  const base = groups.find(g => g.key === 'foundry');
  const cards = groups.filter(g => g !== base);
  const card = g => `<article class="suite-card" data-suite-card="${esc(g.key)}"><div class="suite-kick"><span class="suite-stage">${esc(g.stage)}</span>${chip(g)}</div><h3>${esc(g.label)}</h3><p>${esc(g.desc)}</p>${capsHtml(g)}<div class="suite-views">${jumpButtons(g)}</div>${g === cards.at(-1) ? '' : '<span class="suite-next" aria-hidden="true">→</span>'}</article>`;
  const band = base ? `<article class="suite-band" data-suite-card="foundry"><div class="suite-band-main"><div class="suite-kick"><span class="suite-stage">Common foundation · ${esc(base.stage)}</span>${chip(base)}</div><h3>${esc(base.label)}</h3><p>${esc(base.desc)}</p></div><div class="suite-band-side"><div class="suite-loop">Execution evidence → Validate → Reusable knowledge</div><div class="suite-views">${jumpButtons(base)}</div></div></article>` : '';
  const top = '<div class="suite-top"><div class="suite-test"><span class="suite-pill">Test optimizations<span class="suite-pill-ext"> · Agent Gym ⇄ SILEX Speedrun</span></span></div></div>';
  const span = '<div class="suite-span">Performance improvement spans design, testing, and production</div>';
  return `${top}<div class="suite-row">${cards.map(card).join('')}</div>${span}${band}`;
}

function mount() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  const groups = readSuite(sidebarEntries(sidebar));
  const rail = document.getElementById('suiteRail'), map = document.getElementById('suiteMap');
  const paint = navId => { if (rail) rail.innerHTML = railHtml(groups, groupOf(groups, navId)?.key); };
  if (map) map.innerHTML = mapHtml(groups);
  paint(sidebar.querySelector('.nav button.active')?.dataset.view);
  document.addEventListener('rt:view', e => paint(e.detail.nav));
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
}
