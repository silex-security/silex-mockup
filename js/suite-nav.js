// The product suite, read from the sidebar markup. The sidebar is the only place that maps products to views:
// <div class="section-label" data-suite="<key>" data-stage data-desc data-caps> opens a group and the
// .nav buttons that follow it are its views. The top-bar lifecycle rail and the home page product map are both
// rendered from that, and every button carries data-jump, which index.html already handles.
// Nothing here touches the DOM at module top level.

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * @typedef {{ type: 'group', text: string, key?: string, stage?: string, desc?: string, caps?: string }
 *   | { type: 'view', id: string, label: string }} Entry  sidebar entries in document order
 * @typedef {{ icon?: string, title: string, detail?: string }} Cap  one capability, written "icon~Title: detail"; the icon prefix and the detail are optional
 * @typedef {{ key: string, label: string, short: string, stage: string, desc: string, caps: Cap[], views: { id: string, label: string }[] }} Group
 */

export const readCaps = raw => (raw ?? '').split('|').filter(Boolean).map(c => {
  const [, icon, rest] = c.match(/^([a-z-]+)~(.*)$/s) ?? [, undefined, c];
  const i = rest.indexOf(': ');
  return { ...(icon && { icon }), ...(i < 0 ? { title: rest.trim() } : { title: rest.slice(0, i).trim(), detail: rest.slice(i + 2).trim() }) };
});

const svg = body => `<svg class="suite-cap-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

/** Line icons by name, drawn in front of a capability. A capability without one, or with an unknown name, keeps the dot. */
export const CAP_ICONS = {
  'check-circle': svg('<circle cx="12" cy="12" r="9"/><path d="m8 12.5 3 3 5-6"/>'),
  layers: svg('<path d="M12 2.5 3 7l9 4.5L21 7l-9-4.5z"/><path d="m3 12 9 4.5 9-4.5"/><path d="m3 17 9 4.5 9-4.5"/>'),
  tree: svg('<rect x="9" y="3" width="6" height="5" rx="1"/><rect x="3" y="16" width="6" height="5" rx="1"/><rect x="15" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M6 16v-4h12v4"/>'),
  'screen-play': svg('<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M10 8v5l4.5-2.5L10 8z"/><path d="M8 21h8M12 17v4"/>'),
  flask: svg('<path d="M9 3h6M10 3v6l-5.5 10a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9V3"/><path d="M7.5 15h9"/>'),
  replay: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  warning: svg('<path d="M12 3 2.5 20h19L12 3z"/><path d="M12 10v4M12 17h.01"/>'),
  eye: svg('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  target: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
  coins: svg('<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>'),
  path: svg('<circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="6" r="2.5"/><path d="M7.5 18H14a3.5 3.5 0 0 0 0-7h-4a3.5 3.5 0 0 1 0-7h6.5"/>'),
};

/** @param {Entry[]} entries @returns {Group[]} the groups that carry a data-suite key, in sidebar order */
export function readSuite(entries) {
  const groups = [];
  let open = null;
  for (const e of entries) {
    if (e.type === 'group') {
      open = e.key ? { key: e.key, label: e.text, short: e.text.replace(/^(SILEX|Agent)\s+/, ''), stage: e.stage ?? '', desc: e.desc ?? '', caps: readCaps(e.caps), views: [] } : null;
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
    ? { type: 'group', text: el.textContent.trim(), key: el.dataset.suite, stage: el.dataset.stage, desc: el.dataset.desc, caps: el.dataset.caps }
    : { type: 'view', id: el.dataset.view, label: [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim() });
}

const jumpButtons = g => g.views.map(v => `<button type="button" class="btn secondary" data-jump="${esc(v.id)}">${esc(v.label)}</button>`).join('');

const capsHtml = g => g.caps.length ? `<ul class="suite-caps">${g.caps.map(c => `<li${CAP_ICONS[c.icon] ? ' class="has-ico"' : ''}>${CAP_ICONS[c.icon] ?? ''}<b>${esc(c.title)}</b>${c.detail ? ` ${esc(c.detail)}` : ''}</li>`).join('')}</ul>` : '';

export function railHtml(groups, activeKey) {
  return groups.map((g, i) => {
    const sep = i === 0 ? '' : `<span class="suite-sep" aria-hidden="true">${i === 1 ? '·' : '→'}</span>`;
    return `${sep}<button type="button" class="suite-chip" data-suite-chip="${esc(g.key)}" data-jump="${esc(g.views[0]?.id)}" title="${esc(g.label + ' · ' + g.stage)}"${g.key === activeKey ? ' aria-current="true"' : ''}>${esc(g.short)}</button>`;
  }).join('');
}

export function mapHtml(groups) {
  const base = groups.find(g => g.key === 'foundry');
  const cards = groups.filter(g => g !== base);
  const card = g => `<article class="suite-card" data-suite-card="${esc(g.key)}"><div class="suite-kick"><span class="suite-stage">${esc(g.stage)}</span></div><h3>${esc(g.label)}</h3><p>${esc(g.desc)}</p>${capsHtml(g)}<div class="suite-views">${jumpButtons(g)}</div>${g === cards.at(-1) ? '' : '<span class="suite-next" aria-hidden="true">→</span>'}</article>`;
  const band = base ? `<article class="suite-band" data-suite-card="foundry"><div class="suite-band-main"><div class="suite-kick"><span class="suite-stage">Common foundation · ${esc(base.stage)}</span></div><h3>${esc(base.label)}</h3><p>${esc(base.desc)}</p></div><div class="suite-band-side"><div class="suite-loop">Execution evidence → Validate → Reusable knowledge</div><div class="suite-views">${jumpButtons(base)}</div></div></article>` : '';
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
