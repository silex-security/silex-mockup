/* The site side of the Blueprint Studio cutover (plan logs/2026-09-24_STUDIO_CUTOVER_PLAN.md §2.1–2.4,
   js/STUDIO_BRIDGE_CONTRACT.md). It:
   - loads the Studio in an iframe on the first visit only;
   - sends repeatable hash commands (with a nonce);
   - projects bs.summary.v1 and the bs.reg.* registrations into Overview, PCP and the Workflow Library,
     via js/studio-bridge.mjs, which renders text only. */
import * as B from './studio-bridge.js';

const APP = 'blueprint_studio/app/index.html?embed=1';
let frame = null, pendingCmd = null, nonce = Math.floor(Date.now() / 1000) % 1e7;
const store = (() => { try { return window.localStorage; } catch { return null; } })();

function commandHash(cmd, p = {}) {
  const q = new URLSearchParams();
  q.set('cmd', cmd);
  if (cmd === 'open') {
    q.set('doc', String(p.doc)); q.set('rev', String(p.rev)); q.set('hash', String(p.hash));
    q.set('view', p.view || 'assurance'); if (p.stage) q.set('stage', p.stage);
  }
  q.set('n', String(++nonce));
  return q.toString();
}

/* The frame fills the viewport below the host chrome, whatever its height (sidebar collapses on phones). */
function sizeFrame() {
  const wrap = document.getElementById('studioFrameWrap'); if (!wrap || !wrap.offsetParent) return;
  const top = wrap.getBoundingClientRect().top + window.scrollY;
  wrap.style.height = Math.max(420, window.innerHeight - top - 16) + 'px';
}
window.addEventListener('resize', sizeFrame);

/* Called by the site's showView('blueprint'). */
function studioShown() {
  const wrap = document.getElementById('studioFrameWrap'); if (!wrap) return;
  requestAnimationFrame(() => { window.scrollTo(0, 0); sizeFrame(); });
  const h = pendingCmd || commandHash('resume'); pendingCmd = null;
  if (!frame) {
    frame = document.createElement('iframe');
    frame.id = 'studioFrame'; frame.title = 'Blueprint Studio';
    frame.src = APP + '#' + h;
    wrap.textContent = ''; wrap.appendChild(frame);
    return;
  }
  if (h.startsWith('cmd=resume')) return;                    // plain navigation keeps the Studio as it is
  try { frame.contentWindow.location.hash = h; } catch { frame.src = APP + '#' + h; }
}

/* openStudio('resume' | 'new' | 'open', { doc, rev, hash, view, stage }) */
function openStudio(cmd, p) {
  if (cmd !== 'resume' && cmd !== 'new' && cmd !== 'open') return;
  pendingCmd = commandHash(cmd, p || {});
  if (window.__siteShowView) window.__siteShowView('blueprint'); else studioShown();
}

const openCmd = c => openStudio(c.cmd || 'open', c);

function render() {
  if (!store) return;
  const res = B.readSummary(store);
  const summary = res.ok ? res.summary : (res.reason === 'no summary' ? { v: 1, at: null, docs: [] } : null);
  const ov = document.getElementById('ovStudioPending'), pcp = document.getElementById('pcpStudioCards'), lib = document.getElementById('libStudioGroup');
  let awaiting = 0;
  if (!summary) {
    for (const c of [ov, pcp, lib]) if (c) B.renderUnavailable(c, res.reason);
  } else try {
    const pend = B.projectPending(summary, store);
    awaiting = pend.filter(r => !r.stale).length;
    if (ov) B.renderPending(ov, pend, { onOpen: openCmd });
    if (pcp) B.renderPcp(pcp, B.projectPcp(summary, store), { onOpen: openCmd, onTrace: openCmd });
    if (lib) B.renderLibrary(lib, B.projectLibrary(store, summary), { onOpen: openCmd, onTrace: openCmd });
  } catch (e) {                                   // defence in depth: never let stored data break the site
    awaiting = 0;
    for (const c of [ov, pcp, lib]) if (c) B.renderUnavailable(c, 'summary could not be projected');
  }
  window.studioAwaitingCount = awaiting;
  if (window.__siteRefreshPending) window.__siteRefreshPending();
}

/* index.html#studio and #studio=new (§2.6) */
function deepLink() {
  const h = location.hash;
  if (h === '#studio') openStudio('resume');
  else if (h === '#studio=new') openStudio('new');
}

window.studioShown = studioShown;
window.openStudio = openStudio;
window.studioHostReady = () => { render(); deepLink(); };
window.addEventListener('storage', e => { if (!e.key || e.key.startsWith('bs.')) render(); });
window.addEventListener('hashchange', deepLink);
document.addEventListener('click', e => { if (e.target.closest('.nav button, [data-go], [data-jump]')) setTimeout(render, 0); });
if (window.__siteShowView) window.studioHostReady();          // the inline script ran first (module scripts are deferred)
