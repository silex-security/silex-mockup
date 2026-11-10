// Hash router for Agent Gym v2. The route table below is the one in docs/agent-gym-v2-contract.md.
//
//   parse(hash) -> { name, params, query }     pure. An unknown path or an invalid id gives { name: 'not-found' }.
//   href(name, params?, query?) -> '#/...'     pure. Throws on an unknown name or an invalid id (a caller bug).
//   createRouter(win?) -> {
//     current()                                the route for the present hash
//     href(name, params, query)
//     go(name, params, query)                  navigate, adding a history entry
//     replaceQuery(patch)                      merge view state (tab, selection) into the query, no history entry;
//                                              a null or '' value removes the key
//     subscribe(fn) -> unsubscribe             fn(route) after every change, Back and Forward included
//     start() -> stop                          listen for hashchange and put the default route on an empty hash
//   }
//
// Query values are view state, so they are kept only when they match a conservative pattern. `returnTo` is an
// experiment id and nothing else. A URL can never pass, because ids have no ':' or '/'.

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const QUERY_KEY = /^[A-Za-z][A-Za-z0-9]{0,31}$/;
const QUERY_VALUE = /^[A-Za-z0-9][A-Za-z0-9._@,-]{0,127}$/;

export const DEFAULT_ROUTE = Object.freeze({ name: 'workbench', params: Object.freeze({ experimentId: 'exp-029' }), query: Object.freeze({}) });

const oneOf = (...values) => v => values.includes(v);
const isId = v => ID.test(v);
const isRef = v => { const i = v.lastIndexOf('@'); return i > 0 && isId(v.slice(0, i)) && isId(v.slice(i + 1)); };

export const ROUTES = Object.freeze([
  { name: 'workbench', path: '/workbench/:experimentId' },
  { name: 'environment-library', path: '/environments' },
  { name: 'environment-builder', path: '/environments/new', query: { returnTo: isId, focus: oneOf('describe') } },
  { name: 'environment-revision', path: '/environments/:id/revisions/:rev' },
  { name: 'scenario-builder', path: '/scenarios/new', query: { environment: isRef, workflow: isId, returnTo: isId, source: oneOf('chat', 'trace', 'blueprint', 'upload'), mode: oneOf('prompt', 'tool_failure', 'permission', 'data_state') } },
  { name: 'scenario-set', path: '/scenario-sets/:id/revisions/:rev' },
  { name: 'run-list', path: '/runs', query: { status: oneOf('all', 'running', 'queued', 'completed', 'cancelled') } },
  { name: 'run-detail', path: '/experiments/:experimentId/attempts/:attemptId' },
  { name: 'results', path: '/experiments/:experimentId/attempts/:attemptId/results' },
  { name: 'kit', path: '/kit' },
].map(r => Object.freeze({ query: {}, ...r, segments: r.path.split('/').slice(1) })));

const NOT_FOUND = Object.freeze({ name: 'not-found', params: Object.freeze({}), query: Object.freeze({}) });

function cleanQuery(route, entries) {
  const query = {};
  for (const [key, value] of entries) {
    if (value == null || value === '') continue;
    const text = String(value);
    if (!QUERY_KEY.test(key) || !QUERY_VALUE.test(text)) continue;
    if (key === 'returnTo' && !isId(text)) continue;
    if (route.query[key] && !route.query[key](text)) continue;
    query[key] = text;
  }
  return query;
}

function matchPath(route, parts) {
  if (parts.length !== route.segments.length) return null;
  const params = {};
  for (let i = 0; i < parts.length; i++) {
    const seg = route.segments[i];
    if (!seg.startsWith(':')) { if (seg !== parts[i]) return null; continue; }
    if (!isId(parts[i])) return null;
    params[seg.slice(1)] = parts[i];
  }
  return params;
}

export function parse(hash) {
  const text = String(hash || '').replace(/^#/, '');
  if (text === '' || text === '/') return DEFAULT_ROUTE;
  const cut = text.indexOf('?');
  const path = cut < 0 ? text : text.slice(0, cut);
  if (!path.startsWith('/')) return NOT_FOUND;
  let parts;
  try { parts = path.slice(1).split('/').map(decodeURIComponent); } catch { return NOT_FOUND; }
  // Static segments win over params, so /environments/new is the builder and never an environment called "new".
  const candidates = ROUTES.filter(r => matchPath(r, parts)).sort((a, b) => a.segments.filter(s => s[0] === ':').length - b.segments.filter(s => s[0] === ':').length);
  const route = candidates[0];
  if (!route) return NOT_FOUND;
  return { name: route.name, params: matchPath(route, parts), query: cleanQuery(route, new URLSearchParams(cut < 0 ? '' : text.slice(cut + 1))) };
}

export function href(name, params = {}, query = {}) {
  const route = ROUTES.find(r => r.name === name);
  if (!route) throw Error(`Unknown route "${name}"`);
  const path = route.segments.map(seg => {
    if (!seg.startsWith(':')) return seg;
    const value = String(params[seg.slice(1)] ?? '');
    if (!isId(value)) throw Error(`Route "${name}" needs a valid ${seg.slice(1)}, got "${value}"`);
    return value;
  }).join('/');
  const search = Object.entries(cleanQuery(route, Object.entries(query))).map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%40/g, '@').replace(/%2C/g, ',')}`).join('&');
  return `#/${path}${search ? `?${search}` : ''}`;
}

export function createRouter(win = globalThis.window) {
  const subscribers = new Set();
  let seen = null;
  const current = () => parse(win.location.hash);
  const sync = () => {
    if (win.location.hash === seen) return;
    seen = win.location.hash;
    const route = current();
    for (const fn of [...subscribers]) fn(route);
  };
  const replace = hash => { win.history.replaceState(null, '', hash); sync(); };
  return {
    current, href,
    go(name, params, query) { win.location.hash = href(name, params, query); sync(); },
    replaceQuery(patch) {
      const route = current();
      if (route.name === 'not-found') return;
      replace(href(route.name, route.params, { ...route.query, ...patch }));
    },
    subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
    start() {
      if (/^#?\/?$/.test(win.location.hash)) win.history.replaceState(null, '', href(DEFAULT_ROUTE.name, DEFAULT_ROUTE.params));
      seen = win.location.hash;
      win.addEventListener('hashchange', sync);
      return () => win.removeEventListener('hashchange', sync);
    },
  };
}
