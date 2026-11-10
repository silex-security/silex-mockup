// Environment library: every saved revision as a card, with Use in experiment behind the run gate's dependency check.
// Route query: returnTo (experiment id, default exp-029).
import { h, mountView } from '../components/dom.js';
import { icon } from '../components/icons.js';
import * as ui from '../components/ui.js';
import { refKey, sameRef } from '../model.js';
import { shapeCounts } from '../environment/selectors.js';
import { useEnvironmentInExperiment } from '../environment/templates.js';

const DEFAULT_EXPERIMENT = 'exp-029';

export function mount(root, ctx) {
  const { store, router, announce } = ctx;
  let route = ctx.route;
  const results = new Map();

  const experimentId = () => (route.query.returnTo && store.getState().experiments[route.query.returnTo] ? route.query.returnTo : DEFAULT_EXPERIMENT);

  function use(env) {
    const exp = store.getState().experiments[experimentId()];
    const result = store.dispatch(useEnvironmentInExperiment, { experimentId: exp.id, environmentRef: { id: env.id, rev: env.rev } });
    const text = result.ok ? `Dependencies matched. ${exp.title} now uses ${env.name} v${env.rev}.` : `Dependencies not matched: ${result.error.message}. ${exp.title} keeps its current environment.`;
    results.set(refKey(env), { ok: result.ok, text });
    view.refresh();
    announce(text);
  }

  function card(state, env, exp) {
    const key = refKey(env);
    const inUse = sameRef(exp.environmentRef, env);
    const result = results.get(key);
    const validated = env.validation?.status === 'validated' && env.validation.digest === env.digest;
    return h('li', h('article', { class: `env-lib__card${inUse ? ' is-current' : ''}`, 'aria-label': `${env.name} v${env.rev}` },
      h('div', { class: 'env-lib__top' },
        h('span', { class: 'gym-panel__icon' }, icon(env.icon, { size: 20 })),
        h('div', { class: 'env-lib__titles' }, h('h2', `${env.name} `, h('span', { class: 'gym-muted' }, `v${env.rev}`)), h('p', env.caps.join(' · ')))),
      h('p', { class: 'env-counts' }, shapeCounts(env).text),
      h('div', { class: 'env-lib__badges' },
        inUse && ui.badge({ label: `In use by ${exp.title}`, tone: 'violet' }),
        ui.badge({ status: 'simulated' }),
        ui.badge({ status: validated ? 'validated' : 'needs_review' }),
        ui.badge({ label: env.id.startsWith('tpl-') ? 'Saved template' : 'Demo fixture', tone: 'gray' }),
        h('code', { class: 'gym-mono gym-muted', title: 'Revision digest' }, env.digest)),
      result && h('p', { class: `env-lib__result ${result.ok ? 'is-ok' : 'is-bad'}`, role: 'status' }, result.text),
      h('div', { class: 'env-lib__actions' },
        ui.button({
          label: 'Use in experiment', variant: 'outline', size: 'sm', focusKey: `lib:use:${key}`,
          disabled: inUse, reason: `${exp.title} already uses this revision`, onClick: () => use(env),
        }),
        ui.button({ label: 'View revision', variant: 'link', size: 'sm', iconRight: 'arrow-right', href: router.href('environment-revision', { id: env.id, rev: env.rev }), focusKey: `lib:view:${key}` }),
        result?.ok && ui.button({ label: 'Back to workbench', variant: 'link', size: 'sm', href: router.href('workbench', { experimentId: exp.id }), focusKey: `lib:back:${key}` }))));
  }

  function render(state) {
    const exp = state.experiments[experimentId()];
    const current = state.environments[refKey(exp.environmentRef)];
    const envs = Object.values(state.environments).sort((a, b) => Number(a.id.startsWith('tpl-')) - Number(b.id.startsWith('tpl-')) || a.name.localeCompare(b.name) || Number(a.rev) - Number(b.rev));
    return [
      ui.pageHeader({
        title: 'Environments', subtitle: 'Saved environment templates. Every revision is immutable and simulated.',
        breadcrumb: [{ label: 'Agent Gym', href: router.href('workbench', { experimentId: exp.id }) }, { label: 'Environments' }],
        actions: ui.button({ label: 'Create environment', variant: 'primary', icon: 'plus', href: router.href('environment-builder', {}, { returnTo: exp.id, focus: 'describe' }), focusKey: 'lib:create' }),
        meta: h('p', { class: 'gym-muted' }, `Use in experiment applies to ${exp.title}, which uses ${current ? `${current.name} v${current.rev}` : 'a missing environment'}.`),
      }),
      h('ul', { class: 'env-lib', 'aria-label': 'Environment revisions' }, envs.map(env => card(state, env, exp))),
    ];
  }

  const view = mountView(root, render, store);
  return { update(next) { route = next; view.refresh(); }, destroy: view.destroy };
}
