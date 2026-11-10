import { h } from '../components/dom.js';
import { panel, emptyState, button } from '../components/ui.js';

export function mount(root, ctx) {
  root.append(h('div', { style: { maxWidth: '640px', margin: '48px auto' } }, panel({
    children: emptyState({
      icon: 'search', title: 'Page not found',
      text: 'This link does not match an Agent Gym screen, or it names an object that cannot exist.',
      action: button({ label: 'Back to the experiment queue', variant: 'primary', href: ctx.router.href('experiment-queue') }),
    }),
  })));
  return { update() {}, destroy() { root.replaceChildren(); } };
}
