// The four parts of Agent Gym and the routes each one owns. The app's section tabs (js/app.js) and the SILEX console's
// four Agent Gym views (js/gym-host.js at the site root) both read this, so a route is never assigned twice.
//
//   SECTIONS                 [{ id, label, root, routes }] in tab order; root is the section's home hash
//   sectionOf(routeName)     the section that owns a route name from router.js, or null (the UI kit, not found)
import { href, DEFAULT_ROUTE } from './router.js';

export const SECTIONS = Object.freeze([
  { id: 'workbench', label: 'Workbench', root: href(DEFAULT_ROUTE.name, DEFAULT_ROUTE.params), routes: ['experiment-queue', 'workbench'] },
  { id: 'environments', label: 'Environments', root: href('environment-library'), routes: ['environment-library', 'environment-builder', 'environment-revision'] },
  { id: 'scenarios', label: 'Scenarios', root: href('scenario-library'), routes: ['scenario-library', 'scenario-builder', 'scenario-set'] },
  { id: 'runs', label: 'Runs & results', root: href('run-list', {}, { status: 'all' }), routes: ['run-list', 'run-detail', 'results'] },
].map(s => Object.freeze({ ...s, routes: Object.freeze(s.routes) })));

export const sectionOf = routeName => SECTIONS.find(s => s.routes.includes(routeName)) ?? null;
