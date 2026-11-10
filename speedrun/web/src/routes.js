/* Turns Next.js App Router file paths into a route table.
   compile(['…/app/speedrun/teams/[teamId]/page.tsx'], 'page.tsx') → match('/speedrun/teams/refund') → { key, params: { teamId: 'refund' } } */
const segments = p => p.split('/').filter(Boolean);

export function compile(files, leaf) {
  return files.map(key => {
    const dir = key.slice(key.lastIndexOf('/app/') + 5, -leaf.length);
    return { key, parts: segments(dir).map(s => /^\[.+\]$/.test(s) ? { param: s.slice(1, -1) } : { literal: s }) };
  });
}

export function match(table, pathname) {
  const segs = segments(pathname);
  for (const { key, parts } of table) {
    if (parts.length !== segs.length) continue;
    const params = {};
    if (parts.every((p, i) => p.literal === undefined ? (params[p.param] = decodeURIComponent(segs[i]), true) : p.literal === segs[i]))
      return { key, params };
  }
  return null;
}

/* Layouts that wrap a page, outermost first: every layout whose folder is a prefix of the page's folder. */
export function layoutsFor(layoutKeys, pageKey) {
  const dir = k => k.slice(0, k.lastIndexOf('/') + 1);
  return layoutKeys.filter(k => dir(pageKey).startsWith(dir(k))).sort((a, b) => a.length - b.length);
}

/* '#/gym?status=done' → { pathname: '/gym', search: { status: 'done' }, href: '/gym?status=done' } */
export function parseHash(hash) {
  const href = hash.replace(/^#/, '') || '/';
  const i = href.indexOf('?');
  return { pathname: i < 0 ? href : href.slice(0, i), search: Object.fromEntries(new URLSearchParams(i < 0 ? '' : href.slice(i + 1))), href };
}
