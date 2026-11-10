/* One hash router shared by the Link, useRouter and redirect stand-ins. Routes live in location.hash, so the
   built app has no server and works under any path. */
const listeners = new Set();
let keepScroll = false;

export const router = {
  push(href, opts) { keepScroll = opts?.scroll === false && location.hash !== '#' + href; location.hash = href; },
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
