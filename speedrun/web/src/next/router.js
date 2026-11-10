/* One hash router shared by the Link, useRouter and redirect stand-ins. Routes live in location.hash, so the
   built app has no server and works under any path. */
import { isGymPath, leaveForGym } from '../gym.js';

const listeners = new Set();
let keepScroll = false;

export const router = {
  /* Agent Gym is the console's, so a push to its pages leaves this app. The current page is rebuilt afterwards, so it is
     fresh when the visitor comes back (the Create variant form would otherwise stay on "Sending…"). */
  push(href, opts) {
    if (isGymPath(href.split(/[?#]/)[0])) { leaveForGym(href).then(() => listeners.forEach(fn => fn({ remount: true }))); return; }
    keepScroll = opts?.scroll === false && location.hash !== '#' + href; location.hash = href;
  },
  replace(href) { keepScroll = true; location.replace('#' + href); },
  refresh() { listeners.forEach(fn => fn({ refresh: true })); },
  back() { history.back(); }
};

export function subscribe(fn) {
  const onHash = () => { fn({ keepScroll }); keepScroll = false; };
  listeners.add(fn);
  window.addEventListener('hashchange', onHash);
  return () => { listeners.delete(fn); window.removeEventListener('hashchange', onHash); };
}
