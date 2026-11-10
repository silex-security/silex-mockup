// Agent Gym v2 shell: header, page frame, routing and the view lifecycle (docs/agent-gym-v2-contract.md).
// Tests and tools/gym-shot.mjs wait for window.__gym.ready.
import { seedState } from './fixtures/index.js';
import { startScheduler } from './simulation/scheduler.js';
import { createStore } from './store.js';
import { createRouter } from './router.js';
import { h } from './components/dom.js';
import { icon, logoMark } from './components/icons.js';
import { notice, popoverMenu, confirmDialog } from './components/ui.js';
import * as workbench from './views/workbench.js';
import * as environmentLibrary from './views/environment-library.js';
import * as environmentBuilder from './views/environment-builder.js';
import * as environmentRevision from './views/environment-revision.js';
import * as scenarioBuilder from './views/scenario-builder.js';
import * as scenarioSet from './views/scenario-set.js';
import * as runList from './views/run-list.js';
import * as runDetail from './views/run-detail.js';
import * as results from './views/results.js';
import * as notFound from './views/not-found.js';
import * as kit from './views/kit.js';

const VIEWS = {
  workbench: { view: workbench, title: 'Workbench' },
  'environment-library': { view: environmentLibrary, title: 'Environments' },
  'environment-builder': { view: environmentBuilder, title: 'Create environment' },
  'environment-revision': { view: environmentRevision, title: 'Environment' },
  'scenario-builder': { view: scenarioBuilder, title: 'Create scenario' },
  'scenario-set': { view: scenarioSet, title: 'Scenario set' },
  'run-list': { view: runList, title: 'Runs' },
  'run-detail': { view: runDetail, title: 'Run' },
  results: { view: results, title: 'Results' },
  'not-found': { view: notFound, title: 'Page not found' },
  kit: { view: kit, title: 'UI kit' },
};

const PREVIEW_MARK = 'Concept preview · Simulated data';
const TICK_MS = 900;

function browserStorage() {
  try { return window.localStorage; } catch { return null; }
}

const store = createStore({ storage: browserStorage(), seed: seedState });
const router = createRouter(window);

const live = h('div', { class: 'gym-sr', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
function announce(text) {
  live.textContent = '';
  // A new text node on the next frame, so the same message twice in a row is still read out.
  requestAnimationFrame(() => { live.textContent = text; });
}

async function resetDemo() {
  const yes = await confirmDialog({
    title: 'Reset demo data?',
    message: 'This restores the Agent Gym examples and removes your drafts, saved templates and runs. Other SILEX pages keep their data.',
    confirmLabel: 'Reset demo data', danger: true,
  });
  if (!yes) return;
  store.reset();
  announce(store.persistence.mode === 'local' ? 'Demo data reset.' : 'Demo data reset for this session only.');
}

const navLink = (label, name, href, current) => h('a', { class: 'gym-nav__link', href, 'aria-label': label, 'aria-current': current && 'page' }, icon(name, { size: 19 }), h('span', label));

const header = h('header', { class: 'gym-header' },
  h('a', { class: 'gym-logo', href: '../index.html', 'aria-label': 'SILEX home' }, logoMark(), h('span', 'SILEX')),
  h('span', { class: 'gym-header__rule', 'aria-hidden': 'true' }),
  h('nav', { class: 'gym-nav', 'aria-label': 'Products' },
    navLink('Agent Studio', 'layers', '../index.html#view=blueprint'),
    navLink('Speedrun', 'bolt', '../index.html#view=speedrun'),
    navLink('Agent Gym', 'gamepad', router.href('workbench', { experimentId: 'exp-029' }), true)),
  h('div', { class: 'gym-header__right' },
    popoverMenu({
      align: 'end', label: 'Workspace',
      trigger: { label: 'Acme workspace', icon: 'building', iconRight: 'chevron-down', class: 'gym-workspace', focusKey: 'shell:workspace' },
      items: [
        { heading: 'Workspace' },
        { label: 'Acme workspace', icon: 'check', description: 'Simulated workspace. Nothing here is a connected account.' },
        { separator: true },
        { label: 'Reset demo data', icon: 'refresh', danger: true, onSelect: resetDemo },
      ],
    })));

const banners = h('div', { class: 'gym-banners' });
const main = h('main', { class: 'gym-main', id: 'gym-main', tabIndex: -1 });
const foot = h('footer', { class: 'gym-foot' }, h('span', { class: 'gym-preview-mark' }, PREVIEW_MARK));

function renderBanners() {
  const { mode, error } = store.persistence;
  banners.replaceChildren();
  if (mode !== 'memory' || !error) return;
  banners.append(notice({
    tone: 'warning', role: 'alert', class: 'gym-persistence', title: 'Not saving.', text: error.message,
    onDismiss: () => store.persistence.dismissError(),
  }));
}

let mounted = null;
function show(route) {
  const entry = VIEWS[route.name];
  document.title = `${entry.title} · Agent Gym · SILEX`;
  if (mounted?.name === route.name) { mounted.handle.update(route); return; }
  const first = !mounted;
  mounted?.handle.destroy();
  main.replaceChildren();
  window.scrollTo(0, 0);
  mounted = { name: route.name, handle: entry.view.mount(main, { store, router, announce, route }) };
  if (!first) { main.focus({ preventScroll: true }); announce(entry.title); }
}

document.body.append(
  h('a', { class: 'gym-skip', href: '#gym-main', onClick: e => { e.preventDefault(); main.focus(); } }, 'Skip to content'),
  header, banners, main, foot, live);

store.subscribe(renderBanners);
renderBanners();
router.subscribe(show);
router.start();
show(router.current());

const stopScheduler = startScheduler(store, { tickMs: TICK_MS, frozen: new URLSearchParams(location.search).get('clock') === 'frozen' });
window.addEventListener('pagehide', () => stopScheduler?.());

window.__gym = { ready: true, store, router };
