/* The Speedrun view: the SILEX Speedrun app (speedrun/app/, built by tools/build-speedrun.mjs) in an iframe.
   It loads on the first visit and keeps its place afterwards. The app opens in its light theme, to match
   the console around it.
   The app's route (its own hash, e.g. #/speedrun/teams/refund) is mirrored in the site URL as
   #view=speedrun&path=<route>, so a reload or a shared link reopens the same screen. */
const APP = 'speedrun/app/index.html?theme=light', HOME = '/speedrun';
const wrap = document.getElementById('speedrunFrameWrap');
const view = document.getElementById('speedrun');
let frame = null;

const current = () => frame?.contentWindow.location.hash.slice(1) || HOME;
const hashFor = path => '#view=speedrun' + (path === HOME ? '' : '&path=' + encodeURIComponent(path));

/* The route a #view=speedrun&path=… link names, or null. */
function requested() {
  const q = new URLSearchParams(location.hash.slice(1)), p = q.get('view') === 'speedrun' ? q.get('path') : null;
  return p?.startsWith('/') ? p : null;
}

/* The frame fills the viewport below the host chrome and the view's title row. */
function size() {
  if (!wrap.offsetParent) return;
  wrap.style.height = Math.max(520, window.innerHeight - (wrap.getBoundingClientRect().top + window.scrollY) - 16) + 'px';
}

/* replaceState, not a new entry: the frame's own navigation already added one to the browser history. */
function mirror() {
  if (view.classList.contains('active')) history.replaceState(null, '', hashFor(current()));
}

function shown() {
  requestAnimationFrame(size);
  const path = requested();
  if (frame) { if (path && path !== current()) frame.contentWindow.location.hash = path; return; }
  frame = document.createElement('iframe');
  frame.id = 'speedrunFrame'; frame.title = 'SILEX Speedrun'; frame.src = APP + '#' + (path || HOME);
  frame.addEventListener('load', () => frame.contentWindow.addEventListener('hashchange', mirror));
  wrap.replaceChildren(frame);
}

/* index.html's stateHash() asks for the hash that describes this view. */
window.__speedrun = { hash: () => hashFor(current()) };
window.addEventListener('resize', size);
document.addEventListener('rt:view', e => { if (e.detail.view === 'speedrun') shown(); });
if (view.classList.contains('active')) shown();
