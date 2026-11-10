import { createElement, Fragment, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import './app.css';
import { compile, layoutsFor, match, parseHash } from './routes.js';
import { router, subscribe } from './next/router.js';
import { NotFound, Redirect } from './next/navigation.js';

const pages = import.meta.glob('../upstream/src/app/**/page.tsx', { eager: true });
const layouts = import.meta.glob(['../upstream/src/app/**/layout.tsx', '!../upstream/src/app/layout.tsx'], { eager: true });
const apis = import.meta.glob('../upstream/src/app/api/**/route.ts', { eager: true });
const pageTable = compile(Object.keys(pages), 'page.tsx');
const apiTable = compile(Object.keys(apis), 'route.ts');

/* The upstream pages are async server components. Here each one is called as a function and its element rendered. */
async function resolve({ pathname, search }) {
  const hit = match(pageTable, pathname);
  if (!hit) throw new NotFound();
  const page = await pages[hit.key].default({ params: Promise.resolve(hit.params), searchParams: Promise.resolve(search) });
  return layoutsFor(Object.keys(layouts), hit.key).reduceRight((child, k) => createElement(layouts[k].default, null, child), page);
}

/* The upstream client components POST to the mock API. The route handlers run in the page instead of on a server,
   so what they create lasts until the page reloads. */
const realFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url, 'http://speedrun.local');
  const hit = typeof input === 'string' && input.startsWith('/api/') && match(apiTable, url.pathname);
  if (!hit) return realFetch(input, init);
  const handler = apis[hit.key][(init?.method || 'GET').toUpperCase()];
  return handler ? handler(new Request(url, init), { params: Promise.resolve(hit.params) }) : new Response(null, { status: 405 });
};

function App() {
  const [view, setView] = useState(null);
  useEffect(() => {
    let last = null, gen = 0;
    const show = async ({ keepScroll } = {}) => {
      const loc = parseHash(location.hash), mine = ++gen;
      let el;
      try { el = await resolve(loc); }
      catch (e) {
        if (e instanceof Redirect) return router.replace(e.to);
        if (!(e instanceof NotFound)) console.error(e);
        el = <main className="p-8 text-mut">{e instanceof NotFound ? 'Not found' : 'This screen failed to load'}: {loc.href}. <a className="text-acc-text underline" href="#/speedrun">Back to Speedrun</a></main>;
      }
      if (mine !== gen) return;
      /* Keyed by the full route, so a page's inputs and client state reset when the route or query changes, as in Next. */
      setView(<Fragment key={loc.href}>{el}</Fragment>);
      if (last !== null && last !== loc.href && !keepScroll) window.scrollTo(0, 0);
      last = loc.href;
    };
    show();
    return subscribe(show);
  }, []);
  return view;
}

/* Plain GET forms (search boxes) navigate like links. */
window.addEventListener('submit', e => {
  const f = e.target, action = f.getAttribute('action');
  if (e.defaultPrevented || !action?.startsWith('/') || f.method !== 'get') return;
  e.preventDefault();
  const q = new URLSearchParams([...new FormData(f)].filter(([, v]) => v !== '')).toString();
  router.push(action + (q ? '?' + q : ''), { scroll: false });
});

/* An anchor with data-host-hash opens a screen of the demo site that embeds this app: the value is the site's hash.
   Outside the site there is nothing to open, so app.css hides these anchors until data-embedded is set. */
if (window.parent !== window) document.documentElement.dataset.embedded = '';
window.addEventListener('click', e => {
  const a = e.target.closest?.('a[data-host-hash]');
  if (!a) return;
  e.preventDefault();
  window.parent.location.hash = a.dataset.hostHash;
});

createRoot(document.getElementById('root')).render(<App />);
