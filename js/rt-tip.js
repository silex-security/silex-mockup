// Runtime Observation · ⓘ hover text (logs/2026-10-07_RUNTIME_SUBTABS_PLAN.md §4).
// A tip is <span class="rt-tip">i<span class="rt-tip-body" hidden>…</span></span>. The body stays in the DOM (so the
// page text, search and the probes still see it) and is shown in one shared, fixed popover that cards and the iframe
// cannot clip. It opens on hover, keyboard focus and tap; a click pins it, a second click, an outside click or Esc closes it.

/** Markup for one tip. `html` is trusted markup built by the caller (escape data first). */
export function tip(html, label = 'i', cls = '') {
  return `<span class="rt-tip${cls ? ' ' + cls : ''}" tabindex="0" role="button" aria-label="More information" aria-expanded="false">${label}<span class="rt-tip-body" hidden>${html}</span></span>`;
}

let pop = null, current = null, pinned = false;

function place(el) {
  const r = el.getBoundingClientRect();
  pop.style.maxWidth = Math.min(380, innerWidth - 24) + 'px';
  const p = pop.getBoundingClientRect();
  const x = Math.min(Math.max(12, r.left + r.width / 2 - p.width / 2), innerWidth - p.width - 12);
  let y = r.bottom + 8;
  if (y + p.height > innerHeight - 8) y = Math.max(8, r.top - p.height - 8);
  pop.style.left = `${x}px`; pop.style.top = `${y}px`;
}
function show(el, pin = false) {
  if (current && current !== el) current.setAttribute('aria-expanded', 'false');
  current = el; pinned = pin;
  pop.innerHTML = el.querySelector(':scope > .rt-tip-body')?.innerHTML ?? '';
  // Copies carry no ids or probe hooks: the body in the page stays the only source.
  for (const n of pop.querySelectorAll('[id]')) n.removeAttribute('id');
  for (const n of pop.querySelectorAll('*')) for (const a of [...n.attributes]) if (a.name.startsWith('data-')) n.removeAttribute(a.name);
  pop.classList.add('on'); el.setAttribute('aria-expanded', 'true');
  place(el);
}
function hide() {
  if (!pop) return;
  pop.classList.remove('on'); current?.setAttribute('aria-expanded', 'false'); current = null; pinned = false;
}

function install() {
  if (pop || typeof document === 'undefined') return;
  pop = document.createElement('div'); pop.id = 'rtTipPop'; pop.setAttribute('role', 'tooltip');
  document.body.appendChild(pop);
  const tipOf = e => e.target.closest?.('.rt-tip');
  document.addEventListener('mouseover', e => { const t = tipOf(e); if (t && !pinned && t !== current) show(t); });
  document.addEventListener('mouseout', e => { const t = tipOf(e); if (t && !pinned && t === current && !t.contains(e.relatedTarget)) hide(); });
  document.addEventListener('focusin', e => { const t = tipOf(e); if (t) show(t); else if (current && !pop.contains(e.target)) hide(); });
  document.addEventListener('click', e => {
    const t = tipOf(e);
    if (t) { e.preventDefault(); e.stopPropagation(); if (pinned && t === current) hide(); else show(t, true); return; }
    if (current && !pop.contains(e.target)) hide();
  }, true);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && current) { const t = current; hide(); t.focus?.(); }
    else if ((e.key === 'Enter' || e.key === ' ') && tipOf(e)) { e.preventDefault(); const t = tipOf(e); if (pinned && t === current) hide(); else show(t, true); }
  });
  addEventListener('scroll', () => { if (current && !pinned) hide(); else if (current) place(current); }, { passive: true, capture: true });
  addEventListener('resize', () => hide());
}
install();
