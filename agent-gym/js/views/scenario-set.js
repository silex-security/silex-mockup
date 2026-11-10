// Read-only detail of one saved ScenarioSetRevision: every scenario with its messages, initial state, expected
// behavior, checks, overrides and review state. "Use in experiment" is the only write.
import { h, mountView } from '../components/dom.js';
import * as ui from '../components/ui.js';
import { refKey, sameRef } from '../model.js';
import { setScenarioSet } from '../simulation/attempts.js';
import { experimentSummary } from '../selectors.js';
import { outcomeLabel, scenarioSetDetail } from '../scenario/selectors.js';

export const EXPERIMENT_ID = 'exp-029';

/** "Use in experiment" for one saved set revision. The set page and the scenario library share these rules. */
export function useInExperimentButton({ store, router, announce }, state, ref, { focusKey, variant = 'primary', size } = {}) {
  const exp = state.experiments[EXPERIMENT_ID];
  if (!exp) return null;
  const set = state.scenarioSets[refKey(ref)];
  const inUse = sameRef(exp.scenarioSetRef, ref);
  const preview = inUse ? null : setScenarioSet(state, { experimentId: EXPERIMENT_ID, scenarioSetRef: ref });
  return ui.button({
    label: 'Use in experiment', variant, size, focusKey, disabled: inUse || !!preview?.error,
    reason: inUse ? `${exp.title} already uses this set.` : preview?.error?.message,
    title: preview?.state ? experimentSummary(preview.state, EXPERIMENT_ID).formula : null,
    onClick: () => {
      const r = store.dispatch(setScenarioSet, { experimentId: EXPERIMENT_ID, scenarioSetRef: ref });
      if (!r.ok) { announce(r.error.message); return; }
      announce(`${exp.title} now uses ${set.name}.`);
      router.go('workbench', { experimentId: EXPERIMENT_ID });
    },
  });
}
const listText = (list, empty) => (list.length ? list.join('; ') : empty);

function scenarioCard(s, n) {
  const kind = s.variation ? s.variation.label : 'Base scenario';
  return h('div', { dataset: { scenario: s.id } }, ui.panel({
    class: 'sc-setcard', level: 3, title: `${n}. ${s.title}`, subtitle: `${kind} · ${s.source.label} · ${s.id} rev ${s.rev}`,
    actions: [s.badge === 'same_intent' && ui.badge({ status: 'same_intent' }), ui.badge({ status: s.reviewState === 'reviewed' ? 'reviewed' : 'needs_review' })],
    children: h('dl', { class: 'sc-rcard__grid' },
      h('dt', s.messages.length > 1 ? 'Messages' : 'Message'),
      h('dd', h('ol', { class: 'sc-setcard__messages' }, s.messages.map(m => h('li', s.messages.length > 1 ? `Turn ${m.turn}: ${m.text}` : m.text)))),
      h('dt', 'Initial state'), h('dd', `${s.initialState.summary}${Object.keys(s.initialState.patch).length ? ` (${Object.entries(s.initialState.patch).map(([k, v]) => `${k} = ${v}`).join(', ')})` : ''}`),
      h('dt', 'Task'), h('dd', s.task),
      h('dt', 'Expected behavior'), h('dd', `${s.expectedBehavior.summary} `, h('small', { class: 'gym-muted' }, `(${outcomeLabel(s.expectedBehavior.outcome)})`)),
      h('dt', 'State checks'), h('dd', h('span', { class: 'gym-mono' }, listText(s.stateChecks.map(c => `${c.path} ${c.op} ${c.value}`), 'None'))),
      h('dt', 'Overrides'), h('dd', listText(s.overrides.map(o => `${o.label} (${o.kind} ${o.target} = ${o.value})`), 'None · environment fixed')),
      h('dt', 'Scripted events'), h('dd', listText(s.scriptedEvents.map(e => `approval grant after ${e.after}`), 'None'))),
  }));
}

export function mount(root, ctx) {
  const { store, router } = ctx;
  let route = ctx.route;

  const render = state => {
    const ref = { id: route.params.id, rev: route.params.rev };
    const detail = scenarioSetDetail(state, ref);
    const crumbs = [{ label: 'Agent Gym', href: router.href('workbench', { experimentId: EXPERIMENT_ID }) }, { label: 'Scenarios', href: router.href('scenario-library') }, { label: detail?.set.name ?? 'Scenario set' }];
    if (!detail) return [
      ui.pageHeader({ title: 'Scenario set', breadcrumb: crumbs }),
      ui.emptyState({ icon: 'alert', title: 'Scenario set not found', text: `No saved revision ${refKey(ref)}.`, action: ui.button({ label: 'Create scenario', href: router.href('scenario-builder'), focusKey: 'set:create' }) }),
    ];
    const exp = state.experiments[EXPERIMENT_ID];
    const inUse = detail.usedBy.includes(EXPERIMENT_ID);
    return [
      ui.pageHeader({
        title: detail.set.name, breadcrumb: crumbs,
        subtitle: `Scenario set revision ${detail.set.rev}. Saved revisions are read-only.`,
        actions: [
          ui.button({ label: 'Create scenario', variant: 'outline', icon: 'plus', href: router.href('scenario-builder', {}, { environment: refKey(detail.set.environmentRef), workflow: detail.set.workflowRef.id }), focusKey: 'set:create' }),
          useInExperimentButton(ctx, state, ref, { focusKey: 'set:use' }),
        ],
        meta: h('div', { class: 'sc-setmeta' },
          ui.chip({ label: `Environment: ${detail.environmentName}`, icon: 'layers' }),
          ui.chip({ label: `Workflow: ${detail.workflowName}`, icon: 'workflow' }),
          ui.chip({ label: `${detail.scenarios.length} scenarios`, icon: 'list' }),
          ui.chip({ label: `Digest ${detail.set.digest}`, icon: 'lock', title: 'A version-consistency fingerprint, not a security proof' }),
          inUse && ui.badge({ label: `Used by ${exp.title}`, tone: 'green', icon: 'check' })),
      }),
      h('div', { class: 'sc-setlist' }, detail.scenarios.map((s, i) => scenarioCard(s, i + 1))),
    ];
  };

  const view = mountView(root, render, store);
  return { update(next) { route = next; view.refresh(); }, destroy: view.destroy };
}
