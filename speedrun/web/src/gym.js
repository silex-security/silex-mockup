/* Agent Gym lives in the SILEX console, not in this app. Anything that would open this app's own /gym pages leaves for
   the console's Gym instead: a top-level navigation to a relative URL, so it also works when the app runs on its own.
   A created experiment maps to a Gym handoff (Gym's fixtures/handoffs.js) by its team and kind of change. */
const CHANGES = ['retry-timeout', 'switch-tool', 'switch-model', 'prompt-context'];
const TEAM_ID = /^[a-z0-9-]+$/;

export const GYM_HOME = '../../index.html#view=gym';

export const isGymPath = pathname => pathname === '/gym' || pathname.startsWith('/gym/');

export const gymUrl = handoffId => handoffId ? `${GYM_HOME}&path=${encodeURIComponent(`/handoff/speedrun/${handoffId}`)}` : GYM_HOME;

/* createExperiment() names a variant `<change>-v<id>`. A seeded experiment names its variant freely and maps to nothing. */
export function handoffIdOf(experiment) {
  const change = CHANGES.find(c => experiment?.config?.variantName?.startsWith(`${c}-v`));
  return change && TEAM_ID.test(experiment.teamId ?? '') ? `${experiment.teamId}-${change}` : null;
}

/* The top window is this page's parent in the console and the page itself when the app runs alone. A top page that is
   already the console only needs its hash set, so the console switches view without reloading its frames. */
function openTop(url) {
  try {
    const top = window.top.location;
    if (top.origin === url.origin && (top.pathname === url.pathname || `${top.pathname}index.html` === url.pathname)) { top.hash = url.hash; return; }
  } catch { /* a cross-origin parent cannot be read; fall through to a plain navigation */ }
  window.open(url.href, '_top');
}

/* '/gym/experiments/029' opens the handoff for that experiment when the mock API knows how it was made. */
export async function leaveForGym(href) {
  const pathname = href.split(/[?#]/)[0];
  const id = /^\/gym\/experiments\/([^/]+)$/.exec(pathname)?.[1];
  let handoff = null;
  if (id) {
    try {
      const res = await fetch(`/api/gym/experiments/${encodeURIComponent(id)}`);
      if (res.ok) handoff = handoffIdOf((await res.json()).data);
    } catch { /* the lookup is best effort: without it the visitor still lands in the Gym queue */ }
  }
  openTop(new URL(gymUrl(handoff), location.href));
}
