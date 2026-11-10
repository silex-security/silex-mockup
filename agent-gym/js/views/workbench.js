// N1 Experiment workbench: environments, the experiment draft with its blueprint, scenarios, and the queue.
// View state in the route query: version, node, view (blueprint | replay), attempt, scenario, rep, step, dialog.
import { h, mountView } from '../components/dom.js';
import { icon, appIcon } from '../components/icons.js';
import { badge, breadcrumb, button, card, checkbox, emptyState, iconButton, notice, panel, progress, searchField, select, textInput } from '../components/ui.js';
import { MIN_IMPROVED_PAIRS, refKey } from '../model.js';
import { OBJECTIVES } from '../metrics.js';
import { experimentSteps } from '../experiments/steps.js';
import { stepIndicator } from '../components/steps.js';
import { sourceAnchor } from '../components/source-link.js';
import { reviewBadge } from '../runs/page.js';
import { blueprintView, dependencyStatus, environmentCards, experimentSummary, queueCounts, queueRows, scenarioRows, selectedScenarioIds } from '../selectors.js';
import {
  addVariant, clearScenarioSelection, createOrSelectVariant, enqueueAttempt, renameExperiment, saveExperiment, setEnvironment, setExperimentSettings, setWorkflow, toggleScenario,
} from '../simulation/attempts.js';
import { blueprintDiagram } from '../workbench/diagram.js';
import { openCompare, openInspect, openRunSettings } from '../workbench/dialogs.js';
import {
  attemptByKey, changeSet, missingDependencies, nodeDetail, replayView, revisionNote, runKey, scenarioBuilderQuery, selectedNodeId, viewedVersion,
} from '../workbench/derive.js';

const SCENARIO_ENTRIES = [
  { label: 'Production trace', icon: 'database', query: { source: 'trace' } },
  { label: 'Blueprint & policies', icon: 'file', query: { source: 'blueprint' } },
  { label: 'Describe scenario', icon: 'wand', query: { source: 'chat' } },
  { label: 'Generate variations', icon: 'sliders', query: { mode: 'prompt' } },
];
const CAP_KIND = { CRM: 'crm', Email: 'email', Calendar: 'calendar', Tickets: 'tickets', Payments: 'payments', 'Knowledge base': 'kb', Identity: 'identity', Logs: 'logs', Cloud: 'cloud' };
const QUEUE_TONE = { running: 'violet', queued: 'gray', completed: 'green', cancelled: 'gray', failed: 'red' };
const DRAG_OFF = 'Drag to reorder is not enabled in this preview.';

export function mount(root, ctx) {
  const { store, router, announce } = ctx;
  let route = ctx.route;
  const local = { envQuery: '', scQuery: '', expanded: new Set(['sc-contact-opted-out']), flash: null, dialog: null };
  const expId = () => route.params.experimentId;
  const query = () => route.query;
  const setQuery = patch => router.replaceQuery(patch);
  const refresh = () => view.refresh();
  const focusKey = key => { const el = [...root.querySelectorAll('[data-focus-key]')].find(n => n.getAttribute('data-focus-key') === key); el?.scrollIntoView?.({ block: 'nearest' }); el?.focus(); };
  const flash = (tone, text, extra = {}) => { local.flash = { tone, text, where: 'run', ...extra }; announce(text); };

  function dispatch(reducer, command, done) {
    const result = store.dispatch(reducer, { experimentId: expId(), ...command });
    if (!result.ok) { flash('error', result.error.message); refresh(); } else done?.(result.state);
    return result;
  }

  const FIX = {
    'change-environment': () => focusKey('wb:env-search'),
    'change-workflow': () => focusKey('wb:workflow'),
    'change-scenario-set': () => goScenarioSet(),
    'review-scenario': () => goScenarioSet(),
    'select-scenarios': () => focusKey(root.querySelector('.wb-scenario input')?.getAttribute('data-focus-key') ?? 'wb:sc-search'),
    'run-settings': () => setQuery({ dialog: 'settings' }),
    'create-variant': () => chooseVariant(),
    'save-experiment': () => save(),
  };
  function goScenarioSet() {
    const set = store.getState().experiments[expId()].scenarioSetRef;
    router.go('scenario-set', { id: set.id, rev: set.rev });
  }

  function chooseVariant() {
    const state = store.getState();
    const exp = state.experiments[expId()];
    if (exp.variantId && viewedVersion(state, expId(), query()) === 'variant') {
      const result = store.dispatch(addVariant, { experimentId: expId() });
      if (!result.ok) flash('info', `${result.error.message}. Variant A is selected.`, { where: 'versions' });
      refresh();
      return;
    }
    dispatch(createOrSelectVariant, {}, () => { local.flash = null; setQuery({ version: 'variant' }); announce('Viewing Variant A'); });
  }

  function save() {
    const before = store.getState().experiments[expId()];
    const result = dispatch(saveExperiment, {});
    if (result.ok) flash('success', before.savedRevision === before.draftRevision ? `Already saved at rev ${before.draftRevision}.` : `Saved rev ${before.draftRevision}. Saving does not run anything.`);
    refresh();
  }

  function run() {
    const key = runKey(store.getState(), expId());
    const existing = attemptByKey(store.getState(), key);
    const result = store.dispatch(enqueueAttempt, { experimentId: expId(), idempotencyKey: key });
    if (!result.ok) {
      flash('error', 'Run blocked. Fix the items listed above.');
    } else {
      const attempt = attemptByKey(result.state, key);
      flash(existing ? 'info' : 'success', existing
        ? `${attempt.label} is already in the queue for this revision. It can run again once that attempt finishes or is cancelled.`
        : `Queued ${attempt.title} · ${attempt.label}: ${attempt.plan.length} runs.`, { attemptId: attempt.id });
    }
    refresh();
  }

  function syncDialog() {
    const want = store.getState().experiments[expId()] ? query().dialog ?? null : null;
    if (local.dialog?.name === want) return;
    const old = local.dialog;
    local.dialog = null;
    old?.handle.close();
    if (!want) return;
    const state = store.getState();
    const versionId = viewedVersion(state, expId(), query());
    const onClose = () => { if (local.dialog?.name === want) local.dialog = null; if (router.current().query.dialog === want) setQuery({ dialog: null }); };
    const common = { store, experimentId: expId(), onClose, announce };
    const open = {
      settings: () => openRunSettings(common),
      compare: () => (state.experiments[expId()].variantId ? openCompare({ ...common, onInspect: nodeId => setQuery({ dialog: 'inspect', node: nodeId, version: 'variant' }) }) : null),
      inspect: () => openInspect({ ...common, versionId, nodeId: selectedNodeId(state, expId(), query()) }),
    }[want];
    const handle = open?.();
    if (handle) local.dialog = { name: want, handle };
    else setQuery({ dialog: null });
  }

  // In replay the highlighted node is the current step's node, so the address names that node and never a stale one.
  function syncReplayNode() {
    const state = store.getState();
    if (!state.experiments[expId()] || query().view !== 'replay') return;
    const replay = replayView(state, expId(), query(), viewedVersion(state, expId(), query()));
    const node = replay?.currentNodeId ?? null;
    if (replay && (query().node ?? null) !== node) setQuery({ node });
  }

  const header = exp => h('header', { class: 'gym-pagehead wb-head' },
    breadcrumb({ items: [{ label: 'Agent Gym' }, { label: 'Experiment queue', href: router.href('experiment-queue') }, { label: 'Workbench' }], class: 'gym-sr' }),
    h('div', { class: 'gym-pagehead__row' },
      h('div', { class: 'gym-pagehead__titles' },
        h('h1', { class: 'gym-pagehead__title' }, 'Experiment Workbench'),
        h('p', { class: 'gym-pagehead__subtitle' }, 'Assemble an experiment. Test what changes.')),
      h('div', { class: 'gym-pagehead__actions' },
        exp && sourceAnchor(exp.source, { size: 'md', focusKey: 'wb:source' }),
        button({ label: 'View all runs', variant: 'outline', href: router.href('run-list', {}, { status: 'all' }), focusKey: 'wb:runs' }))));

  function envCard(c, state, exp) {
    const env = state.environments[c.key];
    const capKind = cap => env.components.find(x => x.category === cap)?.kind ?? CAP_KIND[cap] ?? 'box';
    const incompatible = c.selected && !dependencyStatus(state, exp.id).matched;
    return card({
      class: 'wb-env', selected: c.selected, focusKey: `wb:env:${c.key}`,
      ariaLabel: `${c.name} v${c.rev}, ${c.caps.join(', ')}, ${c.statusLabel}${c.selected ? ', in this experiment' : ''}${incompatible ? ', not compatible with this workflow' : ''}`,
      onClick: () => {
        if (c.selected) { announce(`${c.name} v${c.rev} is already in this experiment.`); return; }
        dispatch(setEnvironment, { environmentRef: c.ref }, next => {
          const dep = dependencyStatus(next, expId());
          local.flash = null;
          announce(`Environment set to ${c.name} v${c.rev}. ${dep.matched ? 'Dependencies matched.' : `Missing ${dep.missing.join(', ')}. Run is disabled.`}`);
        });
      },
      children: [
        h('span', { class: 'wb-grip', title: `${DRAG_OFF} Choose a card to use it.`, 'aria-hidden': 'true' }, icon('grip', { size: 16 })),
        h('span', { class: 'wb-env__icon' }, icon(c.icon, { size: 28 })),
        h('span', { class: 'wb-env__main' },
          h('span', { class: 'wb-env__top' }, h('strong', { class: 'wb-env__name' }, c.name), c.selected && h('span', { class: 'wb-env__rev' }, `v${c.rev}`)),
          h('span', { class: 'wb-env__caps' }, c.caps.join(' · ')),
          c.selected && h('span', { class: 'wb-env__chips' }, c.caps.map(cap => h('span', { class: 'wb-capchip' }, appIcon(capKind(cap), { size: 17 }), cap))),
          c.selected && h('span', { class: 'wb-env__notes' }, c.notes.join(' · ')),
          h('span', { class: 'wb-env__foot' }, badge({ label: c.statusLabel, tone: c.ready ? 'green' : 'amber' }), !c.selected && h('span', { class: 'wb-env__rev' }, `v${c.rev}`)),
          incompatible && h('span', { class: 'wb-env__warn' }, icon('alert', { size: 14 }), 'Not compatible with this workflow')),
      ],
    });
  }

  function envColumn(state, exp) {
    const cards = environmentCards(state, { query: local.envQuery, selectedRef: exp.environmentRef });
    const shown = cards.filter(c => c.visible);
    const hiddenSelected = cards.find(c => c.selected && !c.visible);
    const builder = extra => router.href('environment-builder', {}, { returnTo: exp.id, ...extra });
    return panel({
      class: 'wb-col wb-col--env', title: 'Environments', subtitle: 'Where the agent works',
      actions: button({ label: 'Create', variant: 'outline', size: 'sm', icon: 'plus', href: builder(), focusKey: 'wb:env-create' }),
      children: h('div', { class: 'wb-stack' },
        searchField({ value: local.envQuery, placeholder: 'Search environments…', focusKey: 'wb:env-search', onInput: v => { local.envQuery = v; refresh(); } }),
        h('a', { class: 'wb-describe', href: builder({ focus: 'describe' }), dataset: { focusKey: 'wb:env-describe' } }, icon('wand', { size: 18 }), h('span', 'Describe an environment…')),
        h('ul', { class: 'wb-envlist', 'aria-label': 'Environment templates' },
          shown.map(c => h('li', envCard(c, state, exp)))),
        !shown.length && h('p', { class: 'wb-empty' }, `No environment matches “${local.envQuery.trim()}”.`),
        hiddenSelected && h('p', { class: 'wb-hint' }, `${hiddenSelected.name} v${hiddenSelected.rev} stays selected; the search only hides it.`),
        h('a', { class: 'wb-browse', href: router.href('environment-library', {}, { returnTo: exp.id }), dataset: { focusKey: 'wb:env-browse' } }, icon('layers', { size: 18 }), 'Browse templates')),
    });
  }

  function titleField(exp) {
    const commit = input => {
      if (input.value.trim() === exp.title) { input.value = exp.title; return; }
      const result = store.dispatch(renameExperiment, { experimentId: exp.id, title: input.value });
      if (!result.ok) { input.value = exp.title; flash('error', result.error.message); refresh(); } else announce(`Renamed to ${result.state.experiments[exp.id].title}`);
    };
    return h('div', { class: 'wb-titlebox' },
      h('h2', { class: 'wb-title' }, h('input', {
        class: 'wb-title__input', value: exp.title, 'aria-label': 'Experiment title', maxlength: 80, size: Math.max(6, exp.title.length - 1), dataset: { focusKey: 'wb:title' },
        onChange: e => commit(e.target),
        onKeydown: e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { e.target.value = exp.title; e.target.blur(); } },
      })),
      iconButton({ icon: 'pencil', label: 'Rename experiment', variant: 'ghost', size: 'sm', focusKey: 'wb:title-edit', onClick: () => { const el = root.querySelector('.wb-title__input'); el.focus(); el.select(); } }));
  }

  function workflowBar(state, exp) {
    const workflow = state.workflows[refKey(exp.workflowRef)];
    return h('label', { class: 'wb-workflow' },
      h('span', { class: 'wb-workflow__label' }, 'Workflow'),
      icon('workflow', { size: 18 }),
      h('span', { class: 'wb-workflow__name' }, workflow.name),
      badge({ label: `${workflow.source.label} · fixture`, tone: 'violet', class: 'wb-workflow__source' }),
      h('span', { class: 'wb-workflow__caret' }, icon('chevron-down', { size: 18 })),
      h('select', {
        class: 'wb-workflow__select', 'aria-label': 'Workflow', value: refKey(exp.workflowRef), dataset: { focusKey: 'wb:workflow' },
        onChange: e => {
          const wf = state.workflows[e.target.value];
          dispatch(setWorkflow, { workflowRef: { id: wf.id, rev: wf.rev } }, () => { local.flash = null; setQuery({ node: null, view: null, step: null }); announce(`Workflow set to ${wf.name}`); });
        },
      }, Object.values(state.workflows).map(w => h('option', { value: refKey(w) }, `${w.name} · ${w.source.label} · fixture`))));
  }

  function versionRow(state, exp, versionId) {
    const variant = exp.variantId ? state.variants[exp.variantId] : null;
    const note = local.flash?.where === 'versions' ? local.flash : null;
    return h('div', { class: 'wb-versions' },
      h('div', { class: 'wb-versions__group', role: 'group', 'aria-label': 'Version shown in the blueprint' },
        button({ label: 'Baseline', size: 'sm', pressed: versionId === 'baseline', focusKey: 'wb:v:baseline', onClick: () => { local.flash = null; setQuery({ version: 'baseline' }); announce('Viewing Baseline'); } }),
        button({
          label: 'Variant A', size: 'sm', icon: 'plus', pressed: versionId === 'variant', focusKey: 'wb:v:variant',
          title: variant ? 'Show Variant A. This demo compares the baseline with one variant.' : 'Create Variant A from the baseline',
          onClick: chooseVariant,
        })),
      h('span', { class: 'wb-versions__rule', 'aria-hidden': 'true' }),
      button({
        label: 'Compare changes', variant: 'ghost', size: 'sm', icon: 'sliders', focusKey: 'wb:compare', class: 'wb-compare-btn',
        disabled: !variant, reason: 'Create Variant A first.', onClick: () => setQuery({ dialog: 'compare' }),
      }),
      note && h('span', { class: 'wb-versions__note', role: 'status' }, note.text));
  }

  function nodeStrip(state, exp, versionId, nodeId) {
    const d = nodeDetail(state, exp.id, versionId, nodeId);
    const deps = d.dependencies.length ? d.dependencies.map(x => `${x.capability} ${x.matched ? '✓' : '(missing)'}`).join(', ') : 'simulated model, no tool';
    const lines = d.change ? [`Change: ${d.change}`]
      : [[`Needs ${deps}`, d.inputs && `In: ${d.inputs}`, d.outputs && `Out: ${d.outputs}`].filter(Boolean).join(' · '),
        d.checks.length ? `Checks: ${[...new Set(d.checks.map(c => c.label))].join('; ')}` : 'No selected check reads this step'];
    return h('div', { class: 'wb-strip', dataset: { node: d.id } },
      h('span', { class: 'wb-strip__icon' }, icon(d.kind === 'model' ? 'wand' : d.kind === 'decision' ? 'branch' : 'database', { size: 18 })),
      h('span', { class: 'wb-strip__text', 'aria-live': 'polite' }, h('strong', d.title), lines.map(line => h('span', { class: 'wb-strip__line', title: line }, line))),
      button({ label: 'Inspect step', variant: 'link', size: 'sm', iconRight: 'arrow-up-right', class: 'wb-u', focusKey: 'wb:inspect', onClick: () => setQuery({ dialog: 'inspect', node: d.id }) }));
  }

  function replayPanel(exp, replay) {
    const pick = (label, value, options, onChange, key) => h('label', { class: 'wb-pick' }, h('span', label),
      h('select', { value, dataset: { focusKey: `wb:rp:${key}` }, onChange: e => onChange(e.target.value) }, options.map(o => h('option', { value: o.value, disabled: o.disabled }, o.label))));
    const ev = replay.events[replay.step - 1];
    return h('div', { class: 'wb-replay' },
      h('div', { class: 'wb-replay__picks' },
        pick('Attempt', replay.attemptId, replay.attempts.map(a => ({ value: a.id, label: `${a.label} (${a.recorded}/${a.planned})` })), v => setQuery({ attempt: v, step: null }), 'attempt'),
        pick('Version', replay.execution.versionId, replay.versions.map(v => ({ value: v.id, label: v.label })), v => setQuery({ version: v, step: null }), 'version'),
        pick('Scenario', replay.execution.scenarioId, replay.scenarios.map(s => ({ value: s.id, label: s.recorded ? s.label : `${s.label} (not run yet)`, disabled: !s.recorded })), v => setQuery({ scenario: v, step: null }), 'scenario'),
        pick('Repetition', String(replay.execution.repeatIndex), replay.reps.map(r => ({ value: String(r), label: `#${r}` })), v => setQuery({ rep: v, step: null }), 'rep')),
      h('div', { class: 'wb-replay__step' },
        iconButton({ icon: 'chevron-left', label: 'Previous event', size: 'sm', focusKey: 'wb:rp:prev', disabled: replay.step <= 1, reason: 'This is the first event.', onClick: () => setQuery({ step: String(replay.step - 1) }) }),
        h('span', { class: 'wb-replay__count', 'aria-live': 'polite' }, `Event ${replay.step} of ${replay.events.length}: ${ev?.note ?? ''}`),
        iconButton({ icon: 'chevron-right', label: 'Next event', size: 'sm', focusKey: 'wb:rp:next', disabled: replay.step >= replay.events.length, reason: 'This is the last event.', onClick: () => setQuery({ step: String(replay.step + 1) }) }),
        h('a', { class: 'wb-replay__link', href: router.href('run-detail', { experimentId: exp.id, attemptId: replay.attemptId }), dataset: { focusKey: 'wb:rp:detail' } }, 'Open run detail', icon('arrow-up-right', { size: 14 }))),
      h('ol', { class: 'wb-trace', 'aria-label': `Trace of ${replay.scenarioTitle}, ${replay.versionLabel}, repetition ${replay.execution.repeatIndex}`, dataset: { scrollKey: 'wb:trace' } },
        replay.events.map((e, i) => h('li', { class: i + 1 === replay.step ? 'is-current' : null },
          h('button', { type: 'button', class: 'wb-trace__item', 'aria-current': i + 1 === replay.step ? 'step' : null, dataset: { focusKey: `wb:rp:ev:${i + 1}` }, onClick: () => setQuery({ step: String(i + 1) }) },
            h('span', { class: 'wb-trace__seq' }, e.seq), h('span', { class: 'wb-trace__type' }, e.type.replace('_', ' ')), h('span', e.note))))));
  }

  function blueprintPanel(state, exp, versionId) {
    const replay = replayView(state, exp.id, query(), versionId);
    const mode = query().view === 'replay' && replay ? 'replay' : 'blueprint';
    const nodeId = selectedNodeId(state, exp.id, query());
    const tab = (id, label, disabled) => h('button', {
      type: 'button', role: 'tab', class: 'gym-tab', 'aria-selected': String(mode === id), 'aria-disabled': disabled ? 'true' : null, tabIndex: mode === id ? 0 : -1,
      title: disabled ? 'Run a simulation first' : null, dataset: { tab: id, focusKey: `wb:mode:${id}` },
      onClick: () => { if (!disabled && mode !== id) setQuery({ view: id === 'replay' ? 'replay' : null, step: null }); },
    }, label);
    const toggle = h('div', {
      class: 'gym-tabs gym-tabs--pill wb-mode', role: 'tablist', 'aria-label': 'Blueprint view',
      onKeydown: e => {
        if (!['ArrowLeft', 'ArrowRight'].includes(e.key) || !replay) return;
        e.preventDefault();
        setQuery({ view: mode === 'replay' ? null : 'replay', step: null });
        requestAnimationFrame(() => focusKey(`wb:mode:${mode === 'replay' ? 'blueprint' : 'replay'}`));
      },
    }, tab('blueprint', 'Blueprint'), tab('replay', 'Run replay', !replay));
    const bp = mode === 'replay' ? replay.blueprint : blueprintView(state, exp.id, versionId);
    return h('section', { class: 'wb-blueprint', 'aria-labelledby': 'wb-blueprint-title' },
      h('header', { class: 'wb-blueprint__head' },
        h('h3', { id: 'wb-blueprint-title' }, mode === 'replay' ? `Run replay · ${replay.scenarioTitle} · ${replay.versionLabel} #${replay.execution.repeatIndex}` : 'Workflow blueprint'),
        toggle, !replay && h('span', { class: 'gym-sr' }, 'Run replay is unavailable: run a simulation first.')),
      blueprintDiagram({
        nodes: bp.nodes, edges: bp.edges, label: `${mode === 'replay' ? 'Replayed steps of' : 'Blueprint of'} ${state.workflows[refKey(exp.workflowRef)].name}`,
        selectedId: mode === 'replay' ? replay.currentNodeId : nodeId,
        visited: mode === 'replay' ? replay.visited : null, currentId: mode === 'replay' ? replay.currentNodeId : null,
        onSelect: id => {
          if (mode !== 'replay') { setQuery({ node: id }); return; }
          const at = replay.events.findIndex(e => e.nodeId === id);
          if (at >= 0) setQuery({ step: String(at + 1) }); else announce('This run did not reach that step.');
        },
      }),
      mode === 'replay' ? replayPanel(exp, replay) : nodeStrip(state, exp, versionId, nodeId));
  }

  function changesStrip(state, exp) {
    const set = changeSet(state, exp.id);
    if (!set) {
      return h('section', { class: 'gym-panel wb-changes wb-changes--none', 'aria-label': 'What changes' },
        h('p', { class: 'wb-changes__empty' }, icon('sliders', { size: 18 }), 'Nothing is being compared yet. Variant A is the change this experiment tests.'),
        button({ label: 'Create Variant A', size: 'sm', icon: 'plus', focusKey: 'wb:changes-create', onClick: chooseVariant }));
    }
    return h('section', { class: 'gym-panel wb-changes', 'aria-labelledby': 'wb-changes-title' },
      h('header', { class: 'wb-changes__head' },
        h('h2', { class: 'wb-changes__title', id: 'wb-changes-title' }, 'What changes: ', h('span', { class: 'wb-changes__versions' }, `${set.baselineLabel} → ${set.variantLabel}`)),
        badge({ label: `${set.changeCount} change${set.changeCount === 1 ? '' : 's'}`, tone: set.changeCount ? 'violet' : 'gray', class: 'wb-changes__count' })),
      h('div', { class: 'wb-changes__wrap' }, h('table', { class: 'wb-changes__table' },
        h('thead', h('tr', ['Step', 'Field', 'Baseline', set.variantLabel].map(c => h('th', { scope: 'col' }, c)))),
        h('tbody', set.rows.map(r => h('tr', { class: r.changed ? 'is-changed' : null, dataset: { field: `${r.nodeId}.${r.field}` } },
          h('th', { scope: 'row' }, r.node), h('td', h('code', r.field)),
          h('td', { class: r.changed ? 'is-changed' : null }, h('code', r.baseline)),
          h('td', { class: r.changed ? 'is-changed' : null }, h('code', r.variant))))))));
  }

  function settingsBlock(state, exp) {
    const commit = (command, input, restore) => {
      const result = store.dispatch(setExperimentSettings, { experimentId: exp.id, ...command });
      if (!result.ok) { restore?.(); flash('error', result.error.message); refresh(); return; }
      local.flash = null;
      announce(`Experiment settings changed. Draft rev ${result.state.experiments[exp.id].draftRevision}.`);
    };
    return h('section', { class: 'gym-panel wb-settings', 'aria-labelledby': 'wb-settings-title' },
      h('header', { class: 'wb-settings__head' },
        h('h3', { id: 'wb-settings-title' }, 'Experiment settings'),
        h('p', 'What this experiment tries to improve, and when its comparison counts as accepted.')),
      h('div', { class: 'wb-settings__grid' },
        select({
          label: 'Objective', value: exp.objective, focusKey: 'wb:objective', hint: OBJECTIVES[exp.objective].hint,
          options: Object.entries(OBJECTIVES).map(([value, o]) => ({ value, label: o.label })), onChange: v => commit({ objective: v }),
        }),
        h('fieldset', { class: 'wb-settings__accept' },
          h('legend', 'Accepted when'),
          checkbox({ checked: exp.acceptance.noRegression, label: 'No pair regresses', focusKey: 'wb:accept-noregression', onChange: on => commit({ noRegression: on }) }),
          textInput({
            label: 'Minimum improved pairs', type: 'number', value: String(exp.acceptance.minImprovedPairs), focusKey: 'wb:accept-min',
            hint: `A whole number from ${MIN_IMPROVED_PAIRS.min} to ${MIN_IMPROVED_PAIRS.max}. Every pair must also finish, and the objective must not get worse.`,
            onChange: (v, e) => commit({ minImprovedPairs: v.trim() === '' ? NaN : Number(v) }, e.target, () => { e.target.value = String(exp.acceptance.minImprovedPairs); }),
          }))));
  }

  function summaryCards(state, exp) {
    const env = state.environments[refKey(exp.environmentRef)];
    const set = state.scenarioSets[refKey(exp.scenarioSetRef)];
    const count = selectedScenarioIds(state, exp.id).length;
    return h('div', { class: 'wb-summary' },
      h('div', { class: 'wb-sumcard', dataset: { summary: 'environment' } },
        h('span', { class: 'wb-sumcard__icon' }, icon(env?.icon ?? 'box', { size: 22 })),
        h('span', { class: 'wb-sumcard__text' }, h('span', { class: 'wb-eyebrow' }, 'Environment'), h('strong', env ? `${env.name} v${env.rev}` : 'Missing environment'), h('span', { class: 'wb-sumcard__sub' }, env?.caps.join(' · ') ?? '')),
        button({ label: 'Change', variant: 'link', size: 'sm', class: 'wb-u', focusKey: 'wb:env-change', onClick: () => focusKey(`wb:env:${refKey(exp.environmentRef)}`) })),
      h('div', { class: 'wb-sumcard', dataset: { summary: 'scenario-set' } },
        h('span', { class: 'wb-sumcard__icon' }, icon('layers', { size: 22 })),
        h('span', { class: 'wb-sumcard__text' }, h('span', { class: 'wb-eyebrow' }, 'Scenario set'), h('strong', set?.name ?? 'Missing scenario set'), h('span', { class: 'wb-sumcard__sub' }, `${count} scenario${count === 1 ? '' : 's'}`)),
        button({ label: 'Manage', variant: 'link', size: 'sm', class: 'wb-u', focusKey: 'wb:set-manage', href: router.href('scenario-set', { id: exp.scenarioSetRef.id, rev: exp.scenarioSetRef.rev }) })));
  }

  function runArea(state, exp) {
    const dep = dependencyStatus(state, exp.id);
    const sum = experimentSummary(state, exp.id);
    const missing = missingDependencies(state, exp.id);
    const msg = local.flash?.where === 'run' ? local.flash : null;
    const errors = dep.errors;
    const blocking = errors.filter(e => e.code !== 'dependency_unmatched' || !missing.length);
    const runReason = errors.length ? `${errors[0].message}.${errors[0].fix ? ` Fix: ${errors[0].fix.label}.` : ''}` : null;
    const env = state.environments[refKey(exp.environmentRef)];
    const depState = dep.matched ? 'matched' : missing.length ? 'missing' : 'unchecked';
    return h('div', { class: 'wb-run' },
      h('div', { class: 'wb-run__meta' },
        h('span', { class: `wb-dep ${dep.matched ? 'is-ok' : 'is-bad'}`, dataset: { dep: depState } },
          icon(dep.matched ? 'check-circle' : 'alert', { size: 16 }),
          { matched: 'Dependencies matched', missing: `Dependencies missing (${missing.length})`, unchecked: 'Dependencies not checked' }[depState]),
        h('span', { class: 'wb-run__rule', 'aria-hidden': 'true' }),
        h('button', { type: 'button', class: 'wb-formula', title: 'Change repetitions and see how runs and pairs are counted', dataset: { focusKey: 'wb:formula' }, onClick: () => setQuery({ dialog: 'settings' }) },
          sum.formula, h('span', { class: 'gym-sr' }, `. ${sum.pairs} pairs. Open run settings.`))),
      depState === 'missing' && notice({
        tone: 'error', class: 'wb-missing', title: `${env.name} v${env.rev} lacks what this experiment needs.`,
        text: `The draft now uses it at rev ${exp.draftRevision}. Nothing else was changed to fit it. Run stays blocked until the items below are resolved or another environment is chosen.`,
        children: [
          missingGroup('Tools the workflow calls', missing.filter(m => m.kind === 'tool')),
          missingGroup('Fault hooks selected scenarios inject', missing.filter(m => m.kind === 'fault')),
        ],
        actions: button({ label: 'Change environment', variant: 'link', size: 'sm', focusKey: 'wb:missing-fix', onClick: FIX['change-environment'] }),
      }),
      blocking.length > 0 && h('ul', { class: 'wb-errors', 'aria-label': 'What blocks Run' }, blocking.map((e, i) => h('li', { dataset: { code: e.code } },
        icon('alert', { size: 14 }), h('span', e.message),
        e.fix && FIX[e.fix.action] && button({ label: e.fix.label, variant: 'link', size: 'sm', focusKey: `wb:fix:${i}`, onClick: () => FIX[e.fix.action](e) })))),
      h('div', { class: 'wb-run__buttons' },
        button({ label: 'Run simulation', variant: 'primary', icon: 'play', class: 'wb-run__go', focusKey: 'wb:run', disabled: errors.length > 0, reason: runReason, onClick: run }),
        button({ label: 'Save experiment', icon: 'save', variant: 'outline', class: 'wb-run__save', focusKey: 'wb:save', disabled: !sum.dirty, reason: `Saved at rev ${sum.savedRevision}. Nothing to save.`, onClick: save })),
      msg && h('p', { class: `wb-flash wb-flash--${msg.tone}`, role: 'status' }, msg.text,
        msg.attemptId && h('a', { href: router.href('run-detail', { experimentId: exp.id, attemptId: msg.attemptId }) }, ' Open run')),
      h('p', { class: 'wb-sandbox' }, h('span', 'Each run starts in an isolated sandbox'), h('span', { class: 'wb-sandbox__sim' }, 'Simulated sandbox · isolated in-memory state')));
  }

  const missingGroup = (label, items) => items.length > 0 && h('div', { class: 'wb-missing__group' },
    h('span', { class: 'wb-missing__label' }, `${label}:`), h('ul', { class: 'wb-missing__list' }, items.map(m => h('li', h('code', m.capability)))));

  function centre(state, exp) {
    const versionId = viewedVersion(state, exp.id, query());
    const sum = experimentSummary(state, exp.id);
    const rev = revisionNote(state, exp.id);
    return h('section', { class: 'gym-panel wb-col wb-col--exp', 'aria-label': 'Experiment draft' },
      h('div', { class: 'wb-exp' },
        h('div', { class: 'wb-exp__head' },
          titleField(exp), badge({ status: 'draft' }),
          h('span', { class: `wb-save-state ${sum.dirty ? 'is-dirty' : 'is-saved'}`, dataset: { save: sum.dirty ? 'dirty' : 'saved' } }, sum.dirty ? `Unsaved changes · rev ${sum.draftRevision}` : `Saved · rev ${sum.savedRevision}`),
          rev.frozen && h('a', { class: 'wb-revnote', href: router.href('run-detail', { experimentId: exp.id, attemptId: rev.attemptId }), title: 'The queue runs a frozen copy. Editing this draft never changes it.', dataset: { focusKey: 'wb:revnote' } }, rev.frozen)),
        workflowBar(state, exp),
        versionRow(state, exp, versionId),
        blueprintPanel(state, exp, versionId),
        summaryCards(state, exp),
        settingsBlock(state, exp),
        runArea(state, exp)));
  }

  function scenarioColumn(state, exp) {
    const ids = selectedScenarioIds(state, exp.id);
    const rows = scenarioRows(state, exp.scenarioSetRef, { selectedIds: ids, query: local.scQuery });
    const shown = rows.filter(r => r.visible);
    const builder = extra => router.href('scenario-builder', {}, scenarioBuilderQuery(state, exp.id, extra));
    return panel({
      class: 'wb-col wb-col--sc', title: 'Scenarios', subtitle: 'Conditions to test',
      actions: button({ label: 'Create', variant: 'outline', size: 'sm', icon: 'plus', href: builder(), focusKey: 'wb:sc-create' }),
      children: h('div', { class: 'wb-stack' },
        h('div', { class: 'wb-entries' }, SCENARIO_ENTRIES.map(e => button({ label: e.label, icon: e.icon, class: 'wb-entry', href: builder(e.query), focusKey: `wb:sc-entry:${e.icon}` }))),
        searchField({ value: local.scQuery, placeholder: 'Search scenarios…', focusKey: 'wb:sc-search', onInput: v => { local.scQuery = v; refresh(); } }),
        h('div', { class: 'wb-selbar' },
          h('span', { class: 'wb-selbar__count', dataset: { selected: String(ids.length) } }, icon('check', { size: 16 }), `${ids.length} selected`),
          button({ label: 'Clear selection', variant: 'link', size: 'sm', focusKey: 'wb:sc-clear', disabled: !ids.length, reason: 'Nothing is selected.', onClick: () => dispatch(clearScenarioSelection, {}, () => announce('Selection cleared. Run needs at least one scenario.')) })),
        ids.length === 0 && h('p', { class: 'wb-hint wb-hint--warn' }, 'Select at least one scenario to run this experiment.'),
        h('ul', { class: 'wb-scenarios', 'aria-label': 'Scenarios in the set' }, shown.map(r => scenarioRow(r))),
        !shown.length && h('p', { class: 'wb-empty' }, rows.length ? `No scenario matches “${local.scQuery.trim()}”. The selection is unchanged.` : 'This scenario set is empty.')),
    });
  }

  function scenarioRow(r) {
    const open = local.expanded.has(r.id);
    const bodyId = `wb-sc-${r.id}`;
    return h('li', { class: `wb-scenario${r.selected ? ' is-selected' : ''}${open ? ' is-open' : ''}`, dataset: { scenario: r.id } },
      h('div', { class: 'wb-scenario__row' },
        h('span', { class: 'wb-grip', title: `${DRAG_OFF} Order follows the scenario set.`, 'aria-hidden': 'true' }, icon('grip', { size: 16 })),
        checkbox({ checked: r.selected, ariaLabel: `Include ${r.title}`, focusKey: `wb:sc:${r.id}`, onChange: () => dispatch(toggleScenario, { scenarioId: r.id }, next => announce(`${r.title} ${r.selected ? 'removed' : 'selected'}. ${experimentSummary(next, expId()).formula}`)) }),
        icon('file', { size: 18 }),
        h('span', { class: 'wb-scenario__title' }, r.title),
        r.badge && badge({ status: r.badge }),
        h('button', {
          type: 'button', class: 'gym-btn gym-btn--ghost gym-btn--sm gym-btn--icon wb-scenario__toggle', 'aria-label': `${open ? 'Collapse' : 'Expand'} ${r.title}`,
          'aria-expanded': String(open), 'aria-controls': open ? bodyId : null, dataset: { focusKey: `wb:sc-x:${r.id}` },
          onClick: () => { open ? local.expanded.delete(r.id) : local.expanded.add(r.id); refresh(); },
        }, icon(open ? 'chevron-up' : 'chevron-down', { size: 18 }))),
      open && h('dl', { class: 'wb-scenario__body', id: bodyId },
        h('div', h('dt', 'Initial state:'), h('dd', r.initialState || '—')),
        h('div', h('dt', 'Expected:'), h('dd', r.expected)),
        r.overrides.length > 0 && h('div', h('dt', 'Injected:'), h('dd', r.overrides.join(', ')))));
  }

  function queue(state) {
    const counts = queueCounts(state);
    const rows = queueRows(state);
    const extra = ['cancelled', 'failed'].filter(s => counts[s] > 0);
    return h('section', { class: 'gym-panel wb-queue', 'aria-labelledby': 'wb-queue-title' },
      h('header', { class: 'wb-queue__head' },
        h('h2', { id: 'wb-queue-title' }, 'Run queue'),
        h('span', { class: 'wb-queue__counts' }, ['running', 'queued', 'completed', ...extra].map(s => badge({ label: `${counts[s]} ${s}`, tone: QUEUE_TONE[s], dot: true, class: 'wb-qcount' })))),
      h('div', { class: 'wb-queue__scroll', dataset: { scrollKey: 'wb:queue' } },
        rows.length ? h('table', { class: 'wb-qtable' },
          h('thead', h('tr', ['Experiment', 'Environment', 'Scenarios', 'Status', 'Result'].map(t => h('th', { scope: 'col' }, t)))),
          h('tbody', rows.map(r => queueRow(r)))) : emptyState({ icon: 'list', title: 'The queue is empty', text: 'Run a simulation to add an attempt.' })));
  }

  function queueRow(r) {
    const detail = router.href('run-detail', { experimentId: r.experimentId, attemptId: r.attemptId });
    const status = r.paused ? 'paused' : r.status;
    const result = r.status === 'running' || (r.paused && r.progress.done > 0)
      ? progress({ value: r.progress.done, max: r.progress.total, label: `${r.title} progress`, text: r.progress.text })
      : r.canViewResults ? h('span', { class: 'wb-qconclusion' },
        r.result && h('span', { class: `wb-qsummary wb-qsummary--${r.result.tone}` }, r.result.text), r.review && reviewBadge(r.review),
        h('a', { class: 'wb-qresult', href: router.href('results', { experimentId: r.experimentId, attemptId: r.attemptId }), dataset: { focusKey: `wb:qr:${r.attemptId}` } }, 'View results', icon('arrow-right', { size: 16 })))
      : h('span', { class: 'wb-qdash', 'aria-label': 'No result yet' }, '–');
    return h('tr', { class: 'wb-qrow', dataset: { attempt: r.attemptId }, onClick: e => { if (!e.target.closest('a')) router.go('run-detail', { experimentId: r.experimentId, attemptId: r.attemptId }); } },
      h('td', h('a', { class: 'wb-qtitle', href: detail, dataset: { focusKey: `wb:q:${r.attemptId}` }, title: `${r.label}. Open the attempt.` }, icon('workflow', { size: 18 }), h('span', r.title), h('span', { class: 'gym-sr' }, `, ${r.label}`))),
      h('td', h('span', { class: 'wb-qenv' }, icon(r.environmentIcon, { size: 18 }), r.environmentName)),
      h('td', { class: 'wb-qnum' }, r.scenarioCount),
      h('td', badge({ status, title: r.status === 'completed' ? 'Every planned run finished. Completed does not mean every check passed.' : null }),
        r.status === 'completed' && h('span', { class: 'gym-sr' }, ', every run finished; open results to see which checks passed')),
      h('td', { class: 'wb-qres' }, result));
  }

  function render(state) {
    const exp = state.experiments[expId()];
    if (!exp) {
      return [header(), panel({ title: 'Experiment not found', children: emptyState({ icon: 'flask', title: `No experiment “${expId()}”`, text: 'It may have been removed by a demo reset.', action: button({ label: 'Back to the experiment queue', variant: 'primary', href: router.href('experiment-queue') }) }) })];
    }
    return h('div', { class: 'wb' },
      header(exp),
      stepIndicator({ steps: experimentSteps(state, exp.id, route), router }),
      changesStrip(state, exp),
      h('div', { class: 'gym-cols wb-cols', style: { '--gym-cols': '24fr 51fr 24fr' } }, envColumn(state, exp), centre(state, exp), scenarioColumn(state, exp)),
      queue(state));
  }

  const view = mountView(root, render, store);
  syncDialog();
  syncReplayNode();
  return {
    update(next) { route = next; view.refresh(); syncDialog(); syncReplayNode(); },
    destroy() { const d = local.dialog; local.dialog = null; d?.handle.close(); view.destroy(); },
  };
}
