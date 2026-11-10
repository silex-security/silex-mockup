// Agent Gym v2 shell: header, section tabs, page frame, routing and the view lifecycle (docs/agent-gym-v2-contract.md).
// Tests and tools/gym-shot.mjs wait for window.__gym.ready.
// ?embed=1 is the SILEX console's frame (js/gym-host.js): the console has the product header, so the app leaves its own
// out and offers Reset demo data from the preview marker at the end of the section tabs.
// A view's mount ctx also carries setLeaveGuard({ pending, apply, discard }): while pending() names something, a route
// change to another view is held and the shell asks Keep editing, Discard and leave or Apply and leave.
import { seedState } from './fixtures/index.js';
import { startScheduler } from './simulation/scheduler.js';
import { createStore } from './store.js';
import { DEFAULT_ROUTE, createRouter } from './router.js';
import { SECTIONS, sectionOf } from './sections.js';
import { h } from './components/dom.js';
import { icon, logoMark } from './components/icons.js';
import { button, notice, popoverMenu, confirmDialog, openDialog } from './components/ui.js';
import * as experimentQueue from './views/experiment-queue.js';
import * as workbench from './views/workbench.js';
import * as handoff from './views/handoff.js';
import * as environmentLibrary from './views/environment-library.js';
import * as environmentBuilder from './views/environment-builder.js';
import * as environmentRevision from './views/environment-revision.js';
import * as scenarioBuilder from './views/scenario-builder.js';
import * as scenarioLibrary from './views/scenario-library.js';
import * as scenarioSet from './views/scenario-set.js';
import * as runList from './views/run-list.js';
import * as runDetail from './views/run-detail.js';
import * as results from './views/results.js';
import * as notFound from './views/not-found.js';
import * as kit from './views/kit.js';

const VIEWS = {
  'experiment-queue': { view: experimentQueue, title: 'Experiment queue' },
  workbench: { view: workbench, title: 'Workbench' },
  handoff: { view: handoff, title: 'Speedrun handoff' },
  'environment-library': { view: environmentLibrary, title: 'Environments' },
  'environment-builder': { view: environmentBuilder, title: 'Create environment' },
  'environment-revision': { view: environmentRevision, title: 'Environment' },
  'scenario-builder': { view: scenarioBuilder, title: 'Create scenario' },
  'scenario-library': { view: scenarioLibrary, title: 'Scenarios' },
  'scenario-set': { view: scenarioSet, title: 'Scenario set' },
  'run-list': { view: runList, title: 'Runs' },
  'run-detail': { view: runDetail, title: 'Run' },
  results: { view: results, title: 'Results' },
  'not-found': { view: notFound, title: 'Page not found' },
  kit: { view: kit, title: 'UI kit' },
};

const PREVIEW_MARK = 'Concept preview · Simulated data';
const TICK_MS = 900;
const EMBED = new URLSearchParams(location.search).get('embed') === '1';
document.body.classList.toggle('gym-embed', EMBED);

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
    navLink('Agent Gym', 'gamepad', router.href(DEFAULT_ROUTE.name, DEFAULT_ROUTE.params), true)),
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

const sectionLinks = SECTIONS.map(s => h('a', { class: 'gym-sections__link', href: s.root, dataset: { section: s.id } }, s.label));
const sectionBar = h('div', { class: 'gym-sections' },
  h('nav', { class: 'gym-sections__nav', 'aria-label': 'Agent Gym' }, sectionLinks),
  EMBED && popoverMenu({
    align: 'end', label: 'Demo data', class: 'gym-sections__menu',
    trigger: { label: PREVIEW_MARK, iconRight: 'chevron-down', size: 'sm', variant: 'ghost', class: 'gym-preview-mark gym-sections__mark', focusKey: 'shell:preview' },
    items: [
      { heading: 'Simulated data' },
      { label: 'Reset demo data', icon: 'refresh', danger: true, description: 'Restores the Agent Gym examples.', onSelect: resetDemo },
    ],
  }));

function markSection(route) {
  const id = sectionOf(route.name)?.id;
  for (const a of sectionLinks) if (a.dataset.section === id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
}

const banners = h('div', { class: 'gym-banners' });
const main = h('main', { class: 'gym-main', id: 'gym-main', tabIndex: -1 });
const notSaving = h('span', { class: 'gym-preview-mark gym-saving-mark', title: 'Changes last until this page reloads. Reset demo data starts saving again.', hidden: true }, 'Not saving · memory only');
const foot = h('footer', { class: 'gym-foot' }, !EMBED && h('span', { class: 'gym-preview-mark' }, PREVIEW_MARK), notSaving);
const FIXES = { reset: resetDemo };

function renderBanners() {
  const { mode, error } = store.persistence;
  notSaving.hidden = mode !== 'memory' || !!error;
  banners.replaceChildren();
  if (mode !== 'memory' || !error) return;
  const fix = error.fix && FIXES[error.fix.action];
  banners.append(notice({
    tone: 'warning', role: 'alert', class: 'gym-persistence', title: 'Not saving.', text: error.message,
    actions: fix && button({ label: error.fix.label, size: 'sm', onClick: fix }),
    onDismiss: () => store.persistence.dismissError(),
  }));
}

let mounted = null;
// The mounted view's { pending() -> name | null, apply() -> boolean, discard() }, consulted before the route leaves it.
let leaveGuard = null, asking = false;

function askToLeave(guard, pending, proceed) {
  asking = true;
  openDialog({
    title: `Leave with unapplied changes to ${pending}?`,
    description: 'They are not part of the draft yet. Apply them as one undoable change, discard them, or keep editing.',
    actions: close => [
      button({ label: 'Keep editing', onClick: () => close(), autofocus: true }),
      button({ label: 'Discard and leave', onClick: () => close('discard') }),
      button({ label: 'Apply and leave', variant: 'primary', onClick: () => close('apply') }),
    ],
    onClose: choice => {
      asking = false;
      if (choice === 'discard') { guard.discard(); proceed(); } else if (choice === 'apply' && guard.apply()) proceed();
    },
  });
}

router.setLeaveGuard((next, proceed) => {
  if (asking) return true;
  const pending = mounted && next.name !== mounted.name ? leaveGuard?.pending() : null;
  if (!pending) return false;
  askToLeave(leaveGuard, pending, proceed);
  return true;
});

function show(route) {
  const entry = VIEWS[route.name];
  document.title = `${entry.title} · Agent Gym · SILEX`;
  markSection(route);
  if (mounted?.name === route.name) { mounted.handle.update(route); return; }
  const first = !mounted;
  mounted?.handle.destroy();
  leaveGuard = null;
  main.replaceChildren();
  window.scrollTo(0, 0);
  const setLeaveGuard = guard => { leaveGuard = guard; };
  mounted = { name: route.name, handle: entry.view.mount(main, { store, router, announce, route, setLeaveGuard }) };
  if (!first) { main.focus({ preventScroll: true }); announce(entry.title); }
}

document.body.append(...[
  h('a', { class: 'gym-skip', href: '#gym-main', onClick: e => { e.preventDefault(); main.focus(); } }, 'Skip to content'),
  !EMBED && header, sectionBar, banners, main, foot, live].filter(Boolean));

store.subscribe(renderBanners);
renderBanners();
router.subscribe(show);
router.start();
show(router.current());

const stopScheduler = startScheduler(store, { tickMs: TICK_MS, frozen: new URLSearchParams(location.search).get('clock') === 'frozen' });
window.addEventListener('pagehide', () => stopScheduler?.());

window.__gym = { ready: true, store, router };
