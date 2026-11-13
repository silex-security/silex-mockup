// Read-only detail of one immutable EnvironmentRevision: components, tools, relations, permissions, fault hooks,
// validation report and digest. Route params: id, rev. Query: returnTo (experiment id, default exp-029).
import { h, mountView } from '../components/dom.js';
import { appIcon } from '../components/icons.js';
import * as ui from '../components/ui.js';
import { refKey, sameRef } from '../model.js';
import { DEDUP_LABEL, FAILURE_LABEL, LINK_FIELDS, PERMISSION_LABEL, matchRuleOf } from '../environment/catalog.js';
import { plural, shapeCounts } from '../environment/selectors.js';
import { useEnvironmentInExperiment } from '../environment/templates.js';

const DEFAULT_EXPERIMENT = 'exp-029';
const signature = schema => Object.entries(schema).map(([k, v]) => `${k}: ${v}`).join(', ');
const th = label => h('th', { scope: 'col' }, label);

export function mount(root, ctx) {
  const { store, router, announce } = ctx;
  let route = ctx.route;
  let result = null;

  const experimentId = () => (route.query.returnTo && store.getState().experiments[route.query.returnTo] ? route.query.returnTo : DEFAULT_EXPERIMENT);

  function use(env, exp) {
    const r = store.dispatch(useEnvironmentInExperiment, { experimentId: exp.id, environmentRef: { id: env.id, rev: env.rev } });
    result = { key: refKey(env), ok: r.ok, text: r.ok ? `Dependencies matched. ${exp.title} now uses ${env.name} v${env.rev}.` : `Dependencies not matched: ${r.error.message}. ${exp.title} keeps its current environment.` };
    view.refresh();
    announce(result.text);
  }

  function missing() {
    return [
      ui.pageHeader({
        title: 'Revision not found', subtitle: `No saved environment ${route.params.id} v${route.params.rev}.`,
        breadcrumb: [{ label: 'Agent Gym', href: router.href('workbench', { experimentId: DEFAULT_EXPERIMENT }) }, { label: 'Environments', href: router.href('environment-library') }, { label: 'Not found' }],
      }),
      ui.panel({ children: ui.emptyState({ icon: 'database', title: 'This revision does not exist in this browser', text: 'Saved templates live in this demo session. Reset demo data removes them.', action: ui.button({ label: 'All environments', href: router.href('environment-library'), focusKey: 'rev:library' }) }) }),
    ];
  }

  function render(state) {
    const env = state.environments[`${route.params.id}@${route.params.rev}`];
    if (!env) return missing();
    const exp = state.experiments[experimentId()];
    const inUse = sameRef(exp.environmentRef, env);
    const report = env.validation;
    const current = report?.digest === env.digest;
    const byId = new Map(env.components.map(c => [c.id, c]));
    return [
      ui.pageHeader({
        title: env.name, subtitle: `Revision ${env.rev} · immutable · ${shapeCounts(env).text}`,
        breadcrumb: [{ label: 'Agent Gym', href: router.href('workbench', { experimentId: exp.id }) }, { label: 'Environments', href: router.href('environment-library', {}, { returnTo: route.query.returnTo }) }, { label: `${env.name} v${env.rev}` }],
        actions: [
          ui.button({ label: 'All environments', href: router.href('environment-library', {}, { returnTo: route.query.returnTo }), focusKey: 'rev:library' }),
          ui.button({ label: 'Use in experiment', variant: 'primary', disabled: inUse, reason: `${exp.title} already uses this revision`, focusKey: 'rev:use', onClick: () => use(env, exp) }),
        ],
        meta: [
          ui.badge({ status: 'simulated' }),
          ui.badge({ status: report?.status === 'validated' && current ? 'validated' : 'needs_review' }),
          inUse && ui.badge({ label: `In use by ${exp.title}`, tone: 'violet' }),
          h('span', { class: 'gym-muted' }, 'Digest ', h('code', { class: 'gym-mono' }, env.digest)),
          result?.key === refKey(env) && h('span', { class: `env-lib__result ${result.ok ? 'is-ok' : 'is-bad'}`, role: 'status' }, result.text),
        ],
      }),
      h('div', { class: 'env-rev' },
        h('div', { class: 'env-rev__stack' },
          ui.panel({
            title: 'Components', level: 2, children: h('div', { class: 'env-scroll-x' }, h('table', { class: 'dt env-table' },
              h('thead', h('tr', ['Component', 'Mode', 'Permission', 'Failure behavior', 'Deduplication', 'Tools'].map(th))),
              h('tbody', env.components.map(c => h('tr',
                h('th', { scope: 'row' }, h('span', { class: 'gym-row' }, appIcon(c.app, { size: 20 }), c.name, h('span', { class: 'gym-muted' }, c.category))),
                h('td', 'Simulated'), h('td', PERMISSION_LABEL[c.permission] ?? c.permission), h('td', FAILURE_LABEL[c.failureBehavior] ?? c.failureBehavior),
                h('td', DEDUP_LABEL[c.dedup] ?? c.dedup), h('td', `${c.enabledTools.length} of ${c.tools.length}`)))))),
          }),
          ui.panel({
            title: 'Tools', subtitle: 'Schemas the agent sees. Disabled tools are listed but not callable.',
            children: h('div', { class: 'env-tab-list', style: { maxHeight: 'none' } }, env.components.map(c => h('section', { class: 'env-tools' },
              h('h3', { class: 'gym-row' }, appIcon(c.app, { size: 18 }), c.name),
              h('ul', c.tools.map(t => h('li', { class: `env-tool${c.enabledTools.includes(t.name) ? '' : ' is-off'}` },
                h('code', t.name), ui.badge({ label: t.effect === 'write' ? 'Write' : 'Read', tone: t.effect === 'write' ? 'violet' : 'gray' }),
                h('span', { class: 'env-tool__sig' }, `${signature(t.input)} → ${signature(t.output)}`))))))),
          }),
          ui.panel({
            title: 'Relationships', subtitle: 'Field links between components. Not an execution order and not a data sync.',
            children: env.relations.length ? h('div', { class: 'env-scroll-x' }, h('table', { class: 'dt env-table' },
              h('thead', h('tr', ['From', 'To', 'Match rule'].map(th))),
              h('tbody', env.relations.map(r => {
                const [a, b] = [byId.get(r.from), byId.get(r.to)];
                return h('tr', h('td', `${a?.name ?? r.from} · `, h('code', (a && LINK_FIELDS[a.kind]?.[r.field]) ?? r.field)), h('td', `${b?.name ?? r.to} · `, h('code', (b && LINK_FIELDS[b.kind]?.[r.field]) ?? r.field)), h('td', matchRuleOf(r.field)));
              })))) : h('p', { class: 'gym-muted' }, 'No relationships.'),
          })),
        h('div', { class: 'env-rev__stack' },
          ui.panel({
            title: 'Capabilities', children: h('div', { class: 'gym-stack' },
              h('div', h('h3', { class: 'gym-field__label' }, `Tool capabilities (${env.capabilities.length})`), h('div', { class: 'env-caps' }, env.capabilities.map(c => h('code', c)))),
              h('div', h('h3', { class: 'gym-field__label' }, `Fault capabilities (${env.faultCapabilities.length})`),
                env.faultCapabilities.length ? h('div', { class: 'env-caps' }, env.faultCapabilities.map(c => h('code', c))) : h('p', { class: 'gym-muted' }, 'None. Scenarios cannot inject faults here.')),
              h('div', h('h3', { class: 'gym-field__label' }, 'Approval required'),
                h('p', env.components.filter(c => c.permission === 'send_requires_approval').map(c => c.name).join(', ') || 'No component requires approval.'))),
          }),
          ui.panel({
            title: 'Validation report', children: h('dl', { class: 'env-dl' },
              h('dt', 'Status'), h('dd', ui.badge({ status: report?.status === 'validated' && current ? 'validated' : report?.status ?? 'draft' })),
              h('dt', 'Report digest'), h('dd', h('code', report?.digest ?? 'none'), current ? ' matches this revision' : ' does not match this revision'),
              h('dt', 'Errors'), h('dd', report?.errors.length ? h('ul', { class: 'env-list' }, report.errors.map(e => h('li', e.message))) : 'None'),
              h('dt', 'Warnings'), h('dd', report?.warnings.length ? h('ul', { class: 'env-list' }, report.warnings.map(w => h('li', w.message))) : 'None'),
              h('dt', 'Assumptions'), h('dd', report?.pendingAssumptionIds.length ? `${plural(report.pendingAssumptionIds.length, 'pending assumption')}` : 'All confirmed')),
          }),
          ui.panel({
            title: 'Synthetic data seed', children: h('ul', { class: 'env-list' }, Object.entries(env.dataSeed).filter(([k]) => k !== 'primary')
              .flatMap(([kind, cols]) => Object.entries(cols).map(([name, v]) => h('li', `${kind}.${name}: ${plural(Array.isArray(v) ? v.length : 0, 'record')}`)))),
          }))),
    ];
  }

  const view = mountView(root, render, store);
  return { update(next) { if (next.params.id !== route.params.id || next.params.rev !== route.params.rev) result = null; route = next; view.refresh(); }, destroy: view.destroy };
}
