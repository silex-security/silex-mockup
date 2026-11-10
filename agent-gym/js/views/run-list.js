// Runs page: the release gate per experiment, regression batches, then every queued, running and finished attempt,
// filtered by status and trigger in the route query (plan 4.5, 9). Route query: status, trigger.
import { h, mountView } from '../components/dom.js';
import { icon } from '../components/icons.js';
import { badge, button, emptyState, pageHeader, panel, progress, select, tabs } from '../components/ui.js';
import { attemptsByStatus, queueCounts } from '../selectors.js';
import { reviewBadge, runsCrumbs, statusBadges } from '../runs/page.js';
import { GATE, VERDICT_LABEL, releaseGateRows } from '../runs/gate.js';
import { CADENCE_LABEL, liveBatch, regressionHistory, regressionOf, regressionPlan, runRegression, setRegressionCadence } from '../runs/regression.js';

const FILTERS = [
  { id: 'all', label: 'All', count: c => c.total },
  { id: 'running', label: 'Running', count: c => c.running },
  { id: 'queued', label: 'Queued', count: c => c.queued },
  { id: 'completed', label: 'Completed', count: c => c.completed },
  { id: 'cancelled', label: 'Cancelled', count: c => c.cancelled },
];
const TRIGGERS = [
  { value: 'all', label: 'All triggers' },
  { value: 'manual', label: 'Manual' },
  { value: 'change', label: 'Change' },
  { value: 'regression', label: 'Regression' },
];
const TRIGGER_TONE = { manual: 'gray', change: 'violet', regression: 'amber' };
const VERDICT_TONE = { pass: 'green', fail: 'red', regression: 'red', inconclusive: 'gray' };
const COLUMNS = ['Experiment', 'Trigger', 'Frozen revision', 'Environment', 'Scenarios', 'Status', 'Progress', 'Review decision', ''];
const GATE_COLUMNS = ['Experiment', 'What changed', 'Saved revision', 'Latest run', 'Verdict', 'Review', 'Gate', ''];
const HISTORY_COLUMNS = ['Batch', 'Experiments', 'Runs', 'Attempts by verdict', ''];

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const cell = (label, ...kids) => h('td', { dataset: { label } }, kids);
const triggerBadge = t => badge({ label: t.kind === 'regression' ? t.label : TRIGGERS.find(x => x.value === t.kind).label, tone: TRIGGER_TONE[t.kind], title: t.label, class: 'run-trigger' });

export function mount(root, ctx) {
  let route = ctx.route;
  const { router, store, announce } = ctx;

  function row(r, state) {
    const params = { experimentId: r.experimentId, attemptId: r.attemptId };
    const detail = router.href('run-detail', params);
    return h('tr', { class: 'run-list__row', dataset: { attempt: r.attemptId, status: r.status }, onClick: e => { if (!e.target.closest('a, button')) router.go('run-detail', params); } },
      cell('Experiment', h('span', { class: 'run-list__exp' }, icon('workflow', { size: 18 }),
        h('a', { href: detail, class: 'run-list__title', dataset: { focusKey: `runs:open:${r.attemptId}` } }, r.title))),
      cell('Trigger', triggerBadge(r.trigger)),
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

  function gateRow(g) {
    const runParams = g.attempt && { experimentId: g.experimentId, attemptId: g.attempt.id };
    const finished = g.attempt && !['queued', 'running'].includes(g.attempt.status);
    return h('tr', { class: 'run-gate__row', dataset: { experiment: g.experimentId, gate: g.gate.state } },
      cell('Experiment', h('a', { class: 'run-list__title', href: router.href('workbench', { experimentId: g.experimentId }), dataset: { focusKey: `gate:wb:${g.experimentId}` } }, g.title)),
      cell('What changed', g.change
        ? h('span', { class: 'run-gate__change' }, h('strong', g.change.steps.join(', ')), h('small', g.change.kind))
        : h('span', { class: 'gym-muted' }, 'No variant')),
      cell('Saved revision', h('span', { class: 'run-gate__rev' },
        h('span', { class: 'gym-mono' }, g.savedRevision == null ? 'Never saved' : `rev ${g.savedRevision}`),
        g.draftChanged && h('small', { class: 'run-gate__drift' }, icon('alert', { size: 13 }), 'Draft changed since this run'))),
      cell('Latest run', g.attempt
        ? h('span', { class: 'run-gate__run' }, h('a', { href: router.href('run-detail', runParams), class: 'gym-mono', dataset: { focusKey: `gate:run:${g.experimentId}` } }, g.attempt.label), statusBadges(g.attempt))
        : h('span', { class: 'gym-muted' }, 'None')),
      cell('Verdict', !g.attempt ? h('span', { class: 'gym-muted' }, '—')
        : finished ? badge({ label: VERDICT_LABEL[g.verdict], tone: VERDICT_TONE[g.verdict] }) : h('span', { class: 'gym-muted' }, 'Pending')),
      cell('Review', g.attempt ? reviewBadge(g.review) : h('span', { class: 'gym-muted' }, '—')),
      cell('Gate', h('span', { class: 'run-gate__state' }, badge({ label: g.gate.label, tone: g.gate.tone, dot: true }), h('small', g.gate.reason))),
      cell('Action', finished
        ? button({ label: 'View results', variant: 'link', size: 'sm', iconRight: 'arrow-right', focusKey: `gate:results:${g.experimentId}`, href: router.href('results', runParams) })
        : button({ label: 'Open workbench', variant: 'link', size: 'sm', iconRight: 'arrow-right', focusKey: `gate:open:${g.experimentId}`, href: router.href('workbench', { experimentId: g.experimentId }) })));
  }

  function gatePanel(state) {
    const rows = releaseGateRows(state);
    const tally = Object.keys(GATE).map(k => [k, rows.filter(r => r.gate.state === k).length]).filter(([, n]) => n);
    return panel({
      class: 'run-gate', icon: 'shield', title: 'Release gate',
      subtitle: 'Each variant is a change. Its latest saved revision needs a completed run, a Pass verdict and a Pass for demo review. Cleared for demo is as far as a simulated run goes.',
      actions: h('div', { class: 'gym-row run-gate__tally' }, tally.map(([k, n]) => badge({ label: `${n} ${GATE[k].label.toLowerCase()}`, tone: GATE[k].tone }))),
      children: h('div', { class: 'run-gate__wrap' }, h('table', { class: 'run-table run-table--compact' },
        h('caption', { class: 'gym-sr' }, 'Release gate per experiment'),
        h('thead', h('tr', GATE_COLUMNS.map(c => h('th', { scope: 'col' }, c || h('span', { class: 'gym-sr' }, 'Action'))))),
        h('tbody', rows.map(gateRow)))),
    });
  }

  function regressionPanel(state) {
    const { cadence } = regressionOf(state);
    const live = liveBatch(state);
    const plan = regressionPlan(state);
    const history = regressionHistory(state);
    const liveRow = live && history.find(b => b.id === live.id);
    const reason = live ? `Regression batch ${live.number} is still running: ${liveRow.finished} of ${liveRow.planned} runs finished`
      : !plan.included.length ? 'No saved experiment can run now; see the skipped list' : null;
    const run = () => {
      const r = store.dispatch(runRegression, {});
      if (!r.ok) { announce(r.error.message); return; }
      const batch = regressionOf(r.state).batches.at(-1);
      announce(`Regression batch ${batch.number} queued: ${plural(batch.attemptIds.length, 'attempt')}.`);
    };
    return panel({
      class: 'run-reg', icon: 'refresh', title: 'Regression',
      subtitle: 'Re-run every saved experiment that passes the run gate, as one batch, and keep the history.',
      actions: [
        select({ value: cadence, ariaLabel: 'Regression cadence', focusKey: 'reg:cadence', class: 'run-reg__cadence',
          options: Object.entries(CADENCE_LABEL).map(([value, label]) => ({ value, label })),
          onChange: v => { const r = store.dispatch(setRegressionCadence, { cadence: v }); if (r.ok) announce(`Cadence set to ${CADENCE_LABEL[v]}. Runs still start only from the button.`); } }),
        button({ label: 'Run regression now', variant: 'primary', icon: 'play', focusKey: 'reg:run', disabled: !!reason, reason, onClick: run }),
      ],
      children: [
        h('p', { class: 'run-reg__note' }, icon('clock', { size: 15 }), `Cadence: ${CADENCE_LABEL[cadence]}. This preview has no timer: the cadence is a setting, and runs start only from Run regression now.`),
        h('div', { class: 'run-reg__plan' },
          h('p', h('strong', 'Next batch: '), plan.included.length
            ? `${plural(plan.included.length, 'experiment')}, ${plural(plan.runs, 'run')}: ${plan.included.map(x => `${x.title} (${x.runs})`).join(', ')}.`
            : 'nothing can run now.'),
          plan.skipped.length > 0 && h('ul', { class: 'run-reg__skipped', 'aria-label': 'Skipped experiments' }, plan.skipped.map(s => h('li', { dataset: { skipped: s.experimentId } },
            h('a', { href: router.href('workbench', { experimentId: s.experimentId }), dataset: { focusKey: `reg:skip:${s.experimentId}` } }, s.title), `: ${s.reason}`)))),
        history.length
          ? h('div', { class: 'run-reg__wrap' }, h('table', { class: 'run-table run-table--compact run-reg__history' },
            h('caption', { class: 'gym-sr' }, 'Regression history, newest batch first'),
            h('thead', h('tr', HISTORY_COLUMNS.map(c => h('th', { scope: 'col' }, c || h('span', { class: 'gym-sr' }, 'Action'))))),
            h('tbody', history.map(b => h('tr', { dataset: { batch: b.id } },
              cell('Batch', h('span', { class: 'run-reg__batch' }, h('strong', `Batch ${b.number}`), h('small', { class: 'gym-mono' }, `queue seq ${b.startedSeq}`))),
              cell('Experiments', h('span', { class: 'run-reg__exps' }, b.experiments.map(e => h('a', { href: router.href('run-detail', { experimentId: e.experimentId, attemptId: e.attemptId }), dataset: { focusKey: `reg:run:${e.attemptId}` } }, e.title)),
                b.skipped.length > 0 && h('small', { class: 'gym-muted' }, `${b.skipped.length} skipped`))),
              cell('Runs', progress({ value: b.finished, max: b.planned, label: `Batch ${b.number} progress`, text: `${b.finished}/${b.planned}`, class: 'run-reg__progress' })),
              cell('Attempts by verdict', h('span', { class: 'gym-row' },
                b.running > 0 && badge({ status: 'running', label: `${b.running} running` }),
                Object.entries(b.verdicts).filter(([, n]) => n).map(([v, n]) => badge({ label: `${n} ${VERDICT_LABEL[v].toLowerCase()}`, tone: VERDICT_TONE[v] })))),
              cell('Action', button({ label: 'Show runs', variant: 'link', size: 'sm', iconRight: 'arrow-right', focusKey: `reg:show:${b.id}`, onClick: () => router.replaceQuery({ trigger: 'regression', status: 'all' }) })))))))
          : h('p', { class: 'run-reg__empty gym-muted' }, 'No regression batch yet.'),
      ],
    });
  }

  const render = state => {
    const status = route.query.status ?? 'all';
    const trigger = route.query.trigger ?? 'all';
    const counts = queueCounts(state);
    const rows = attemptsByStatus(state, status, trigger);
    const filter = FILTERS.find(f => f.id === status);
    const triggerName = trigger === 'all' ? '' : `${TRIGGERS.find(t => t.value === trigger).label.toLowerCase()} `;
    return [
      pageHeader({
        title: 'Runs', subtitle: 'Every simulated experiment attempt, frozen at the revision it ran.',
        breadcrumb: runsCrumbs(router).slice(0, 1).concat({ label: 'Runs' }),
        actions: button({ label: 'Back to experiments', variant: 'outline', icon: 'arrow-left', focusKey: 'runs:workbench', href: router.href('experiment-queue') }),
      }),
      h('div', { class: 'run-panels' }, gatePanel(state), regressionPanel(state)),
      panel({
        class: 'run-list', title: 'Experiment queue',
        subtitle: 'Completed means every planned execution finished. It does not mean every check passed.',
        actions: [
          select({ value: trigger, ariaLabel: 'Filter by trigger', focusKey: 'runs:trigger', class: 'run-list__trigger', options: TRIGGERS,
            onChange: v => router.replaceQuery({ trigger: v === 'all' ? null : v }) }),
          tabs({
            variant: 'segmented', label: 'Filter by status', value: status, focusKey: 'runs:filter', class: 'run-list__filter',
            items: FILTERS.map(f => ({ id: f.id, label: `${f.label} · ${f.count(counts)}`, panelId: 'run-list-table' })),
            onChange: id => router.replaceQuery({ status: id }),
          }),
        ],
        children: rows.length
          ? h('div', { class: 'run-list__wrap', id: 'run-list-table', role: 'tabpanel' }, h('table', { class: 'run-table' },
            h('caption', { class: 'gym-sr' }, `${filter.label} ${triggerName}runs: ${rows.length}`),
            h('thead', h('tr', COLUMNS.map(c => h('th', { scope: 'col' }, c || h('span', { class: 'gym-sr' }, 'Action'))))),
            h('tbody', rows.map(r => row(r, state)))))
          : h('div', { id: 'run-list-table', role: 'tabpanel' }, emptyState({
            icon: 'list', title: `No ${filter.label.toLowerCase()} ${triggerName}runs`,
            text: 'Runs appear here when an experiment is run from the workbench or a regression batch.',
            action: button({ label: 'Show all runs', variant: 'outline', size: 'sm', focusKey: 'runs:show-all', onClick: () => router.replaceQuery({ status: 'all', trigger: null }) }),
          })),
      }),
    ];
  };

  const view = mountView(root, render, store);
  return { update(next) { route = next; view.refresh(); }, destroy: view.destroy };
}
