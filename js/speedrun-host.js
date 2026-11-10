/* The Speedrun view: the upstream SILEX Speedrun app (speedrun/app/, built by tools/sync-speedrun.mjs) in an iframe.
   It loads on the first visit and keeps its place afterwards. The app opens in the dark theme of the product
   design; its own header toggle switches it and the choice is remembered. */
const APP = 'speedrun/app/index.html?theme=dark#/speedrun';
const wrap = document.getElementById('speedrunFrameWrap');

/* The frame fills the viewport below the host chrome and the view's title row. */
function size() {
  if (!wrap.offsetParent) return;
  wrap.style.height = Math.max(520, window.innerHeight - (wrap.getBoundingClientRect().top + window.scrollY) - 16) + 'px';
}

function shown() {
  requestAnimationFrame(size);
  if (wrap.querySelector('iframe')) return;
  const frame = document.createElement('iframe');
  frame.id = 'speedrunFrame'; frame.title = 'SILEX Speedrun'; frame.src = APP;
  wrap.replaceChildren(frame);
}

window.addEventListener('resize', size);
document.addEventListener('rt:view', e => { if (e.detail.view === 'speedrun') shown(); });
if (document.getElementById('speedrun').classList.contains('active')) shown();
