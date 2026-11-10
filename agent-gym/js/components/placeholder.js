// Stand-in for a screen that is not built yet. A real view replaces its views/*.js file and stops importing this.
import { h, mountView } from './dom.js';
import { pageHeader, panel, emptyState, button } from './ui.js';

export function placeholderView({ title, subtitle, crumbs }) {
  return function mount(root, ctx) {
    let route = ctx.route;
    const view = mountView(root, () => [
      pageHeader({
        title, subtitle,
        breadcrumb: [{ label: 'Agent Gym', href: ctx.router.href('workbench', { experimentId: 'exp-029' }) }, ...crumbs.map(label => ({ label }))],
        actions: button({ label: 'View all runs', variant: 'outline', href: ctx.router.href('run-list', {}, { status: 'all' }), focusKey: 'ph:runs' }),
      }),
      panel({
        title: 'Screen under construction', subtitle: `Route "${route.name}"`,
        children: [
          emptyState({ icon: 'flask', title: `${title} is not built yet`, text: 'The shell, the router and the store are live. This placeholder shows what the route received.' }),
          h('dl', { class: 'gym-row', style: { marginTop: '12px' } },
            Object.entries({ ...route.params, ...route.query }).map(([key, value]) => h('div', { class: 'gym-chip' }, h('dt', { class: 'gym-muted' }, key), h('dd', { class: 'gym-mono', style: { margin: '0' } }, value)))),
        ],
      }),
    ], ctx.store);
    return { update(next) { route = next; view.refresh(); }, destroy: view.destroy };
  };
}
