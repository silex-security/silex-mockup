// Experiment queue: every experiment, the stage it is in, and the one next action for that stage. Route query: status, q.
import { h, mountView } from '../components/dom.js';
import { icon } from '../components/icons.js';
import { badge, button, card, emptyState, pageHeader, panel, progress, searchField, tabs } from '../components/ui.js';
import { queueSummary, queueView } from '../experiments/queue.js';
import { reviewBadge } from '../runs/page.js';

const COLUMNS = ['Experiment', 'Source', 'Objective', 'Stage', 'Progress or result', 'Last activity', ''];
const SOURCE_TONE = { manual: 'gray', speedrun: 'violet', studio: 'amber' };
const SOURCE_NAME = { manual: 'Manual', speedrun: 'Speedrun', studio: 'Studio' };

const cell = (label, ...kids) => h('td', { dataset: { label } }, kids);

export function mount(root, ctx) {
  const { router, store } = ctx;
  let route = ctx.route;

  const go = (action) => router.go(action.route, action.params);
  const hrefOf = action => router.href(action.route, action.params);

  function resultCell(r) {
    if (r.progress) return progress({ value: r.progress.done, max: r.progress.total, label: `${r.title} progress`, text: r.progress.text, class: 'xq-progress' });
    if (r.waiting) return h('span', { class: 'xq-wait' }, `Position ${r.waiting.position} of ${r.waiting.of}`, r.waiting.behind && h('small', `Waits for ${r.waiting.behind}`));
    if (r.result) return h('span', { class: 'xq-result' }, h('span', { class: `xq-result__text xq-result__text--${r.result.tone}` }, r.result.text), r.outcome && reviewBadge(r.outcome));
    return h('span', { class: 'gym-muted', 'aria-label': 'No result yet' }, '–');
  }

  function row(r) {
    return h('tr', {
      class: 'xq-row', dataset: { experiment: r.id, stage: r.stage },
      onClick: e => { if (!e.target.closest('a, button')) go(r.action); },
    },
      cell('Experiment', h('span', { class: 'xq-exp' },
        h('span', { class: 'xq-exp__top' }, h('span', { class: 'gym-mono xq-exp__id' }, r.id),
          h('a', { class: 'run-list__title xq-exp__name', href: router.href('workbench', { experimentId: r.id }), dataset: { focusKey: `xq:open:${r.id}` } }, r.title)),
        h('span', { class: 'xq-exp__flow' }, icon('workflow', { size: 14 }), r.workflowName))),
      cell('Source', h('span', { class: 'xq-source' }, badge({ label: SOURCE_NAME[r.source.kind], tone: SOURCE_TONE[r.source.kind] }), h('small', r.source.label))),
      cell('Objective', r.objective.label),
      cell('Stage', badge({ status: r.stage })),
      cell('Progress or result', resultCell(r)),
      cell('Last activity', h('span', { class: 'xq-activity' }, r.activity)),
      cell('Action', button({ label: r.action.label, variant: r.stage === 'needs_review' ? 'primary' : 'outline', size: 'sm', iconRight: 'arrow-right', href: hrefOf(r.action), focusKey: `xq:action:${r.id}`, ariaLabel: `${r.action.label} ${r.title}` })));
  }

  const render = state => {
    const status = route.query.status ?? 'all';
    const q = route.query.q ?? '';
    const view = queueView(state, { status, q });
    const tab = view.tabs.find(t => t.id === status);
    const filtered = status !== 'all' || q.trim() !== '';
    return [
      pageHeader({
        title: 'Experiment queue', subtitle: 'Every experiment, from the change it tests to the decision on how it ended.',
        breadcrumb: [{ label: 'Agent Gym' }, { label: 'Experiment queue' }],
        actions: button({ label: 'View all runs', variant: 'outline', href: router.href('run-list', {}, { status: 'all' }), focusKey: 'xq:runs' }),
      }),
      h('div', { class: 'xq-cards', role: 'group', 'aria-label': 'Experiments by stage' }, queueSummary(state).map(c =>
        card({
          class: 'xq-card', selected: status === c.id, focusKey: `xq:card:${c.id}`, ariaLabel: `${c.label}: ${c.count}. ${c.detail}`,
          onClick: () => router.replaceQuery({ status: status === c.id ? null : c.id }),
          children: [h('span', { class: 'xq-card__label' }, h('span', { class: `xq-card__dot xq-card__dot--${c.id}`, 'aria-hidden': 'true' }), c.label),
            h('strong', { class: 'xq-card__count' }, String(c.count)), h('span', { class: 'xq-card__detail' }, c.detail)],
        }))),
      panel({
        class: 'xq-list', title: 'Experiments', subtitle: `${view.rows.length} of ${view.counts.all} shown`,
        actions: [
          searchField({ value: q, placeholder: 'Search experiments or workflows…', ariaLabel: 'Search experiments by name, workflow or source', focusKey: 'xq:search', class: 'xq-search', maxlength: 64,
            onInput: v => router.replaceQuery({ q: v.trim() ? v : null }) }),
          tabs({ variant: 'segmented', label: 'Filter by stage', value: status, focusKey: 'xq:filter', class: 'xq-filter',
            items: view.tabs.map(t => ({ id: t.id, label: `${t.label} · ${t.count}`, panelId: 'xq-table' })), onChange: id => router.replaceQuery({ status: id === 'all' ? null : id }) }),
        ],
        children: view.rows.length
          ? h('div', { class: 'xq-wrap', id: 'xq-table', role: 'tabpanel' }, h('table', { class: 'run-table xq-table' },
            h('caption', { class: 'gym-sr' }, `${tab.label} experiments: ${view.rows.length}`),
            h('thead', h('tr', COLUMNS.map(c => h('th', { scope: 'col' }, c || h('span', { class: 'gym-sr' }, 'Action'))))),
            h('tbody', view.rows.map(row))))
          : h('div', { id: 'xq-table', role: 'tabpanel' }, emptyState({
            icon: 'flask', title: filtered ? 'No experiment matches' : 'No experiments yet',
            text: filtered ? 'Change the stage tab or the search text.' : 'Experiments appear here when they are created in the workbench.',
            action: filtered && button({ label: 'Show all experiments', variant: 'outline', size: 'sm', focusKey: 'xq:clear', onClick: () => router.replaceQuery({ status: null, q: null }) }),
          })),
      }),
    ];
  };

  const view = mountView(root, render, store);
  return { update(next) { route = next; view.refresh(); }, destroy: view.destroy };
}
