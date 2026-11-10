// The "View source in Speedrun" anchor shared by the experiment queue and the workbench header.
//   sourceAnchor(source, { size, focusKey, class }) -> <a> | null
// It opens the console's Speedrun view at the experiment's source route. target="_top" makes the console, not this frame,
// follow the link.
import { h } from './dom.js';
import { icon } from './icons.js';
import { sourceLink } from '../experiments/source.js';

export function sourceAnchor(source, { size = 'sm', focusKey, ...rest } = {}) {
  const link = sourceLink(source);
  return link && h('a', {
    class: ['gym-btn', 'gym-btn--outline', size !== 'md' && `gym-btn--${size}`, rest.class].filter(Boolean).join(' '),
    href: link.href, target: '_top', dataset: { focusKey, sourceLink: 'speedrun' },
  }, h('span', { class: 'gym-btn__label' }, link.label), icon('arrow-up-right'));
}
