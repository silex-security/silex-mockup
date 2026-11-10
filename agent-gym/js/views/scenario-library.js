// Scenario library: every saved scenario set revision, which changed conditions it covers (and which it misses), and
// where the behaviour held the last time it ran. Use in experiment shares the set page's rules. The search is
// ephemeral view state.
import { h, mountView } from '../components/dom.js';
import { icon } from '../components/icons.js';
import * as ui from '../components/ui.js';
import { refKey } from '../model.js';
import { scenarioLibrary } from '../scenario/library.js';
import { VERDICT_LABEL } from '../runs/gate.js';
import { EXPERIMENT_ID, useInExperimentButton } from './scenario-set.js';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const ratio = t => `${t.pass}/${t.total}`;
const tone = t => (t.pass === t.total ? 'green' : t.pass === 0 ? 'red' : 'amber');
const VERDICT_TONE = { pass: 'green', fail: 'red', regression: 'red', inconclusive: 'gray' };

export function mount(root, ctx) {
  const { store, router } = ctx;
  let query = '';

  const builder = (card, extra = {}) => router.href('scenario-builder', {}, { environment: refKey(card.environmentRef), workflow: card.workflowRef.id, ...extra });

  function coverage(card) {
    return h('section', { class: 'sc-lib__coverage', 'aria-label': `Condition coverage of ${card.name}` },
      h('h3', { class: 'sc-lib__label' }, 'Condition coverage'),
      h('ul', { class: 'sc-cov' }, card.coverage.map(d => h('li', { class: `sc-cov__item${d.gap ? ' is-gap' : ''}`, dataset: { dimension: d.dimension, count: String(d.count) } },
        h('span', { class: 'sc-cov__icon' }, icon(d.icon, { size: 16 })),
        h('span', { class: 'sc-cov__text' },
          h('strong', d.label),
          d.gap ? h('span', { class: 'sc-cov__gap' }, d.gapText) : h('span', plural(d.count, 'scenario'))),
        d.gap && h('a', { class: 'sc-cov__add', href: builder(card, { mode: d.dimension }), dataset: { focusKey: `lib:gap:${card.key}:${d.dimension}` }, 'aria-label': `Add a ${d.label.toLowerCase()} variation to ${card.name}` }, icon('plus', { size: 14 }), 'Add')))));
  }

  function evidence(card) {
    const { completed, live } = card.evidence;
    const liveNote = live && h('p', { class: 'sc-lib__live' }, icon('clock', { size: 14 }),
      `${live.title} is ${live.status} (${live.progress}). `,
      h('a', { href: router.href('run-detail', { experimentId: live.experimentId, attemptId: live.attemptId }), dataset: { focusKey: `lib:live:${card.key}` } }, 'Open run'));
    if (!completed) return h('section', { class: 'sc-lib__evidence', 'aria-label': `Where behaviour holds in ${card.name}` },
      h('h3', { class: 'sc-lib__label' }, 'Where behaviour holds'),
      h('p', { class: 'sc-lib__none' }, live ? 'No completed run of this set yet.' : 'Not run yet. Use it in an experiment and run it to see where the behaviour holds.'),
      liveNote);
    const results = router.href('results', { experimentId: completed.experimentId, attemptId: completed.attemptId });
    return h('section', { class: 'sc-lib__evidence', 'aria-label': `Where behaviour holds in ${card.name}` },
      h('div', { class: 'sc-lib__evhead' },
        h('h3', { class: 'sc-lib__label' }, 'Where behaviour holds'),
        ui.badge({ label: `Verdict ${VERDICT_LABEL[completed.verdict]}`, tone: VERDICT_TONE[completed.verdict] }),
        h('a', { class: 'sc-lib__results', href: results, dataset: { focusKey: `lib:results:${card.key}` } }, `${completed.title} · ${completed.label}`, icon('arrow-right', { size: 14 }))),
      h('table', { class: 'sc-ev' },
        h('caption', { class: 'gym-sr' }, `Latest baseline and variant passes per scenario, from ${completed.label}`),
        h('thead', h('tr', h('th', { scope: 'col' }, 'Scenario'), h('th', { scope: 'col' }, 'Baseline'), h('th', { scope: 'col' }, 'Variant'))),
        h('tbody', completed.rows.map(r => h('tr', { dataset: { scenario: r.scenarioId } },
          h('th', { scope: 'row' }, r.title, r.regressed > 0 && ui.badge({ label: `${r.regressed} regressed`, tone: 'red', class: 'sc-ev__flag' })),
          r.inRun
            ? [h('td', h('span', { class: `sc-ev__n is-${tone(r.baseline)}` }, ratio(r.baseline))), h('td', h('span', { class: `sc-ev__n is-${tone(r.variant)}` }, ratio(r.variant)))]
            : h('td', { colspan: 2, class: 'gym-muted' }, 'Not selected in this run'))))),
      liveNote);
  }

  function setCard(state, card) {
    return h('li', { dataset: { set: card.key } }, h('article', { class: 'gym-panel sc-lib__card', 'aria-label': `${card.name} rev ${card.rev}` },
      h('header', { class: 'sc-lib__head' },
        h('span', { class: 'gym-panel__icon' }, icon('layers', { size: 20 })),
        h('div', { class: 'sc-lib__titles' },
          h('h2', h('a', { href: router.href('scenario-set', card.ref), dataset: { focusKey: `lib:open:${card.key}` } }, card.name), ' ', h('span', { class: 'gym-muted' }, `rev ${card.rev}`)),
          h('p', `${card.workflowName} · ${card.environmentName} · ${plural(card.count, 'scenario')}`)),
        h('div', { class: 'sc-lib__badges' },
          card.allReviewed ? ui.badge({ status: 'reviewed', label: `Reviewed ${card.reviewed}/${card.count}` }) : ui.badge({ status: 'needs_review', label: `${card.count - card.reviewed} to review` }),
          card.usedBy.length
            ? card.usedBy.map(u => ui.badge({ label: `Used by ${u.title}`, tone: u.id === EXPERIMENT_ID ? 'violet' : 'gray' }))
            : ui.badge({ label: 'Not used by an experiment', tone: 'gray' }))),
      h('div', { class: 'sc-lib__body' }, coverage(card), evidence(card)),
      h('footer', { class: 'sc-lib__actions' },
        ui.button({ label: 'View set', variant: 'link', size: 'sm', iconRight: 'arrow-right', href: router.href('scenario-set', card.ref), focusKey: `lib:view:${card.key}` }),
        h('span', { class: 'sc-lib__spacer' }),
        ui.button({ label: 'Add variations', variant: 'outline', size: 'sm', icon: 'sliders', href: builder(card), focusKey: `lib:vary:${card.key}` }),
        useInExperimentButton(ctx, state, card.ref, { focusKey: `lib:use:${card.key}`, size: 'sm' }))));
  }

  function render(state) {
    const exp = state.experiments[EXPERIMENT_ID];
    const cards = scenarioLibrary(state, { query, experimentId: EXPERIMENT_ID });
    const visible = cards.filter(c => c.visible);
    const context = { environment: refKey(exp.environmentRef), workflow: exp.workflowRef.id };
    return [
      ui.pageHeader({
        title: 'Scenarios', subtitle: 'Saved scenario sets: under which changed conditions does the behaviour still hold?',
        breadcrumb: [{ label: 'Agent Gym', href: router.href('workbench', { experimentId: EXPERIMENT_ID }) }, { label: 'Scenarios' }],
        actions: [
          ui.button({ label: 'Create scenario', variant: 'outline', icon: 'plus', href: router.href('scenario-builder', {}, context), focusKey: 'lib:create' }),
          ui.button({ label: 'Generate variations', variant: 'primary', icon: 'sliders', href: router.href('scenario-builder', {}, { ...context, mode: 'prompt' }), focusKey: 'lib:generate' }),
        ],
        meta: h('div', { class: 'sc-lib__meta' },
          h('div', { class: 'sc-lib__search' }, ui.searchField({ value: query, placeholder: 'Search sets and scenarios…', ariaLabel: 'Search scenario sets', focusKey: 'lib:search', onInput: v => { query = v; view.refresh(); } })),
          h('p', { class: 'sc-lib__count' }, `${plural(cards.length, 'saved set')} · ${plural(cards.reduce((n, c) => n + c.count, 0), 'scenario')}`),
          h('p', { class: 'sc-lib__truth' }, icon('info', { size: 15 }), 'Generated variations are proposals until an expert reviews them. Only reviewed scenarios run.')),
      }),
      visible.length
        ? h('ul', { class: 'sc-lib', 'aria-label': 'Scenario set revisions' }, visible.map(c => setCard(state, c)))
        : ui.emptyState({ icon: 'search', title: 'No sets match', text: `Nothing matches “${query.trim()}”.`, action: ui.button({ label: 'Clear search', variant: 'outline', size: 'sm', focusKey: 'lib:clear', onClick: () => { query = ''; view.refresh(); } }) }),
    ];
  }

  const view = mountView(root, render, store);
  return { update() { view.refresh(); }, destroy: view.destroy };
}
