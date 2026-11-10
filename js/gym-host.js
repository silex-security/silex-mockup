/* The four Agent Gym views: one Agent Gym app (agent-gym/, embed mode) in one iframe that all four share.
   Each view is one section of the app (agent-gym/js/sections.js): gym is the workbench, gym-environments,
   gym-scenarios and gym-runs the other three. The frame loads on the first visit to any of them and is never moved
   or reloaded afterwards, because a reload pauses a running simulation. Opening a view sends the app to that
   section's root route, unless the site URL names a route. Navigating inside the app switches the console to the
   view that owns the new route. The app's route is mirrored in the site URL as #view=<view>&path=<route>, with no
   path when it is the section's root, so a reload or a shared link reopens the same screen. */
import { parse } from '../agent-gym/js/router.js';
import { SECTIONS, sectionOf } from '../agent-gym/js/sections.js';

const APP = 'agent-gym/index.html?embed=1';

/** Console view id for each app section id. */
export const VIEWS = Object.freeze({ workbench: 'gym', environments: 'gym-environments', scenarios: 'gym-scenarios', runs: 'gym-runs' });

/** The console view that owns an app route such as '/runs?status=all', or null (the UI kit, not found). */
export const viewOf = path => VIEWS[sectionOf(parse(path).name)?.id] ?? null;

/** The root route of a console Gym view, without the leading '#'. */
export const rootOf = view => SECTIONS.find(s => VIEWS[s.id] === view).root.slice(1);

export const hashFor = (view, path) => '#view=' + view + (path === rootOf(view) ? '' : '&path=' + encodeURIComponent(path));

/** The route a site hash names for this view (#view=<view>&path=/…), or null. */
export function requested(hash, view) {
  const q = new URLSearchParams(hash.replace(/^#/, '')), p = q.get('view') === view ? q.get('path') : null;
  return p?.startsWith('/') ? p : null;
}

function mount() {
  const wrap = document.getElementById('gymFrameWrap');
  const sections = Object.values(VIEWS).map(id => document.getElementById(id));
  let frame = null, loaded = false;

  const activeView = () => sections.find(s => s.classList.contains('active'))?.id ?? null;
  const current = () => frame?.contentWindow.location.hash.slice(1) || null;

  function size() {
    if (wrap.hidden) return;
    wrap.style.height = Math.max(520, window.innerHeight - (wrap.getBoundingClientRect().top + window.scrollY) - 16) + 'px';
  }

  /* After every route change the frame commits (its links, Back and Forward, a route the console set, a change its
     leave guard held and put back): write the site URL with replaceState, because the frame's own navigation already
     added the history entry, then switch the console to the view that owns the route. The rt:view handler then finds
     the URL already naming the frame's route and leaves the frame alone. A change while another console view is
     active can only be Back or Forward through a Gym entry, so it brings the Gym view back. */
  function follow() {
    const path = current();
    if (!path) return;
    const active = activeView(), owner = viewOf(path) ?? active ?? 'gym';
    history.replaceState(history.state, '', hashFor(owner, path));
    for (const a of document.querySelectorAll('[data-gym-full]')) a.href = 'agent-gym/index.html#' + path;
    if (owner !== active) window.__siteShowView(owner);
  }

  function shown(view) {
    wrap.hidden = false;
    requestAnimationFrame(size);
    const path = requested(location.hash, view) ?? rootOf(view);
    if (!frame) {
      frame = document.createElement('iframe');
      frame.id = 'gymFrame'; frame.title = 'Agent Gym'; frame.src = APP + '#' + path;
      frame.addEventListener('load', () => {
        loaded = true;
        const w = frame.contentWindow;
        w.__gym.router.subscribe(follow);
        w.addEventListener('hashchange', follow);
        if (activeView()) follow();
      });
      wrap.replaceChildren(frame);
    } else if (!loaded) frame.src = APP + '#' + path;
    else if (path !== current()) frame.contentWindow.location.hash = path;
  }

  /* index.html's stateHash() asks for the hash that describes the active Gym view. */
  window.__gymHost = { hash: () => { const v = activeView(), p = current(); return p ? hashFor(viewOf(p) ?? v, p) : '#view=' + v; } };
  window.addEventListener('resize', size);
  document.addEventListener('rt:view', e => {
    if (sections.some(s => s.id === e.detail.view)) shown(e.detail.view); else wrap.hidden = true;
  });
  if (activeView()) shown(activeView());
}

if (typeof document !== 'undefined') mount();
