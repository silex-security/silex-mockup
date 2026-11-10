// The Configure, Run, Review indicator (js/experiments/steps.js decides each step). A step with a target is a link
// built through the router; a step without one is plain text that says why in its title.
import { h } from './dom.js';
import { icon } from './icons.js';

export function stepIndicator({ steps, router, label = 'Experiment steps' }) {
  return h('nav', { class: 'gym-steps', 'aria-label': label },
    h('ol', { class: 'gym-steps__list' }, steps.map(step => {
      const marker = h('span', { class: 'gym-steps__marker', 'aria-hidden': 'true' }, step.state === 'done' ? icon('check', { size: 14 }) : String(step.position));
      const text = h('span', { class: 'gym-steps__text' }, h('span', { class: 'gym-steps__label' }, step.label), step.detail && h('small', { class: 'gym-steps__detail' }, step.detail));
      const props = { class: 'gym-steps__link', 'aria-current': step.state === 'current' ? 'step' : null, dataset: { focusKey: `step:${step.id}` } };
      return h('li', { class: `gym-steps__item is-${step.state}`, dataset: { step: step.id } },
        step.target
          ? h('a', { ...props, href: router.href(step.target.route, step.target.params) }, marker, text)
          : h('span', { ...props, title: step.reason, 'aria-disabled': 'true', tabIndex: 0 }, marker, text,
            h('span', { class: 'gym-sr' }, `. ${step.reason}`)));
    })));
}
