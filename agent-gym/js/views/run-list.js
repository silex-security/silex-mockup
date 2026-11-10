// Run list: every queued, running and finished attempt, filtered by status in the route query (plan 4.5, 9).
import { h, mountView } from '../components/dom.js';
import { icon } from '../components/icons.js';
import { button, emptyState, pageHeader, panel, progress, tabs } from '../components/ui.js';
import { attemptsByStatus, queueCounts } from '../selectors.js';
import { reviewBadge, runsCrumbs, statusBadges } from '../runs/page.js';

const FILTERS = [
  { id: 'all', label: 'All', count: c => c.total },
  { id: 'running', label: 'Running', count: c => c.running },
  { id: 'queued', label: 'Queued', count: c => c.queued },
  { id: 'completed', label: 'Completed', count: c => c.completed },
  { id: 'cancelled', label: 'Cancelled', count: c => c.cancelled },
];
const COLUMNS = ['Experiment', 'Frozen revision', 'Environment', 'Scenarios', 'Status', 'Progress', 'Review decision', ''];

export function mount(root, ctx) {
  let route = ctx.route;
  const { router } = ctx;

  function row(r, state) {
    const params = { experimentId: r.experimentId, attemptId: r.attemptId };
    const detail = router.href('run-detail', params);
    const cell = (label, ...kids) => h('td', { dataset: { label } }, kids);
    return h('tr', { class: 'run-list__row', dataset: { attempt: r.attemptId, status: r.status }, onClick: e => { if (!e.target.closest('a, button')) router.go('run-detail', params); } },
      cell('Experiment', h('span', { class: 'run-list__exp' }, icon('workflow', { size: 18 }),
        h('a', { href: detail, class: 'run-list__title', dataset: { focusKey: `runs:open:${r.attemptId}` } }, r.title))),
      cell('Frozen revision', h('span', { class: 'gym-mono run-list__rev' }, r.label)),
      cell('Environment', h('span', { class: 'run-list__env' }, icon(r.environmentIcon, { size: 18 }), r.environmentName)),
      cell('Scenarios', String(r.scenarioCount)),
      cell('Status', h('span', { class: 'gym-row run-list__status' }, statusBadges(r))),
      cell('Progress', progress({ value: r.progress.done, max: r.progress.total, label: `${r.title} progress`, text: r.progress.text, class: 'run-list__progress' })),
      cell('Review decision', reviewBadge(state.attempts[r.attemptId].review)),
      cell('Action', r.canViewResults
        ? button({ label: 'View results', variant: 'link', iconRight: 'arrow-right', focusKey: `runs:results:${r.attemptId}`, href: router.href('results', params) })
        : button({ label: 'Open run', variant: 'link', iconRight: 'arrow-right', focusKey: `runs:detail:${r.attemptId}`, href: detail })));
  }

  const render = state => {
    const status = route.query.status ?? 'all';
    const counts = queueCounts(state);
    const rows = attemptsByStatus(state, status);
    const filter = FILTERS.find(f => f.id === status);
    return [
      pageHeader({
        title: 'Runs', subtitle: 'Every simulated experiment attempt, frozen at the revision it ran.',
        breadcrumb: runsCrumbs(router).slice(0, 1).concat({ label: 'Runs' }),
        actions: button({ label: 'Back to workbench', variant: 'outline', icon: 'arrow-left', focusKey: 'runs:workbench', href: router.href('workbench', { experimentId: 'exp-029' }) }),
      }),
      panel({
        class: 'run-list', title: 'Experiment queue',
        subtitle: 'Completed means every planned execution finished. It does not mean every check passed.',
        actions: tabs({
          variant: 'segmented', label: 'Filter by status', value: status, focusKey: 'runs:filter', class: 'run-list__filter',
          items: FILTERS.map(f => ({ id: f.id, label: `${f.label} · ${f.count(counts)}`, panelId: 'run-list-table' })),
          onChange: id => router.replaceQuery({ status: id }),
        }),
        children: rows.length
          ? h('div', { class: 'run-list__wrap', id: 'run-list-table', role: 'tabpanel' }, h('table', { class: 'run-table' },
            h('caption', { class: 'gym-sr' }, `${filter.label} runs: ${rows.length}`),
            h('thead', h('tr', COLUMNS.map(c => h('th', { scope: 'col' }, c || h('span', { class: 'gym-sr' }, 'Action'))))),
            h('tbody', rows.map(r => row(r, state)))))
          : h('div', { id: 'run-list-table', role: 'tabpanel' }, emptyState({
            icon: 'list', title: `No ${filter.label.toLowerCase()} runs`,
            text: 'Runs appear here when an experiment is run from the workbench.',
            action: button({ label: 'Show all runs', variant: 'outline', size: 'sm', focusKey: 'runs:show-all', onClick: () => router.replaceQuery({ status: 'all' }) }),
          })),
      }),
    ];
  };

  const view = mountView(root, render, ctx.store);
  return { update(next) { route = next; view.refresh(); }, destroy: view.destroy };
}
