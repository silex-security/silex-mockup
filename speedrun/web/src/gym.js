/* Agent Gym lives in the SILEX console, not in this app. Anything that would open this app's own /gym pages leaves for
   the console's Gym instead: a top-level navigation to a relative URL, so it also works when the app runs on its own.
   A handoff id is a team and a kind of change (Gym's fixtures/handoffs.js). */
const CHANGES = ['retry-timeout', 'switch-tool', 'switch-model', 'prompt-context'];

export const GYM_HOME = '../../index.html#view=gym';

export const isGymPath = pathname => pathname === '/gym' || pathname.startsWith('/gym/');

export const gymUrl = handoffId => handoffId ? `${GYM_HOME}&path=${encodeURIComponent(`/handoff/speedrun/${handoffId}`)}` : GYM_HOME;

/* The variant form builds `/gym/handoff/<team>-<change>` from the team and kind of change it already knows. Any other
   Gym path opens the Gym queue. */
const HANDOFF_PATH = new RegExp(`^/gym/handoff/([a-z0-9-]+-(?:${CHANGES.join('|')}))$`);

export const handoffIdFromPath = pathname => HANDOFF_PATH.exec(pathname)?.[1] ?? null;

/* The top window is this page's parent in the console and the page itself when the app runs alone. A top page that is
   already the console only needs its hash set, so the console switches view without reloading its frames. */
function openTop(url) {
  try {
    const top = window.top.location;
    if (top.origin === url.origin && (top.pathname === url.pathname || `${top.pathname}index.html` === url.pathname)) { top.hash = url.hash; return; }
  } catch { /* a cross-origin parent cannot be read; fall through to a plain navigation */ }
  window.open(url.href, '_top');
}

export async function leaveForGym(href) {
  openTop(new URL(gymUrl(handoffIdFromPath(href.split(/[?#]/)[0])), location.href));
}
