// Shared Agent Gym v2 widgets. Every export takes one props object and returns a DOM node (styles: css/shell.css).
// `#/kit` renders each one once.
//
// Props every widget accepts: class (extra classes), id, title, focusKey (sets data-focus-key so mountView can
// restore focus after a re-render; give one to every control the user can focus).
// A control with `disabled: true` stays focusable, ignores activation and shows `reason` as its tooltip.
//
// Buttons
//   button({ label, variant = 'secondary', size = 'md', icon, iconRight, onClick, href, disabled, reason, type, pressed, block, ariaLabel, autofocus })
//       variant: 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'danger'      size: 'sm' | 'md' | 'lg'
//       `href` renders a link that looks like a button.
//   iconButton({ icon, label, variant = 'secondary', size, onClick, disabled, reason, pressed })   label is the accessible name
// Status and tags
//   badge({ status, label, tone, dot, icon })
//       status: any key of STATUS (ready, draft, running, queued, completed, review, needs_review, same_intent,
//       changed, paused, cancelled, failed, simulated, validated, invalid, reviewed, passed, error).
//       Or give label and tone ('green' | 'amber' | 'violet' | 'gray' | 'red') yourself.
//   chip({ label, icon, tone = 'neutral', selected, onClick, onRemove })      tone: 'neutral' | 'violet' | 'amber' | 'green'
//   appChip({ app, label, onClick, caret })                                  app: a key of icons.js APP_NAMES
// Choice
//   tabs({ items: [{ id, label, icon, panelId }], value, onChange(id), label, variant = 'segmented' })
//       variant: 'segmented' (lavender active, N2) | 'solid' (filled active buttons, N3) | 'pill' (small toggle, N1)
//   checkbox({ checked, label, onChange(checked), disabled, reason, ariaLabel })
// Form fields. With `label` the control comes wrapped in a labelled field with optional `hint` and `error`.
//   textInput({ value, onInput(value), onChange(value), placeholder, label, hint, error, icon, trailing, type, name, disabled, reason, readOnly, ariaLabel })
//   searchField({ value, onInput(value), placeholder, ariaLabel })
//   select({ value, options: [{ value, label, disabled }], onChange(value), label, hint, error, disabled, reason, ariaLabel })
//   textarea({ value, onInput(value), onChange(value), placeholder, rows = 3, label, hint, error, disabled, reason, ariaLabel })
// Containers
//   panel({ title, subtitle, icon, actions, children, level = 2, flush })     a titled white panel; `flush` drops body padding
//   card({ children, selected, tone, onClick, ariaLabel })                    with onClick the whole card is one button,
//                                                                             so it must not contain other controls
//   columns({ template = '1fr 2fr 1fr', children })                           grid that stacks below 1024px
//   footerBar({ lead, actions })                                              the full-width action bar under N2 and N3
// Page furniture
//   pageHeader({ title, subtitle, breadcrumb: [{ label, href }], actions, meta })
//   breadcrumb({ items: [{ label, href }] })                                  the last item is the current page
//   progress({ value, max = 100, label, text })                               role=progressbar; `text` shows beside the bar
//   notice({ tone = 'info', title, text, children, actions, onDismiss, role })  tone: 'info' | 'warning' | 'error' | 'success'
//   emptyState({ icon, title, text, action })
// Overlays
//   popoverMenu({ trigger, items, align = 'start', label })
//       trigger: button props, or a <button> node. items: { label, icon, description, onSelect, danger, disabled, reason }
//       | { separator: true } | { heading }. Arrow keys move, Escape closes and returns focus to the trigger.
//   dialog({ title, description, children, actions, size = 'sm' }) -> HTMLDialogElement   the node only, not shown
//   openDialog({ ...dialog props, actions: close => [nodes], onClose(result), dismissible = true }) -> { el, close(result) }
//       Modal. Traps Tab, closes on Escape or a backdrop click, restores focus to the opener (by node, then by focusKey).
//   confirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger }) -> Promise<boolean>
import { h } from './dom.js';
import { icon, appIcon } from './icons.js';

const cx = (...parts) => parts.filter(Boolean).join(' ');
const common = p => ({ id: p.id, title: p.title, dataset: { focusKey: p.focusKey } });
let uid = 0;
const nextId = prefix => `gym-${prefix}-${++uid}`;

export function button({ label, variant = 'secondary', size = 'md', icon: lead, iconRight, onClick, href, disabled = false, reason, type = 'button', pressed, block, ariaLabel, autofocus, ...rest }) {
  const cls = cx('gym-btn', `gym-btn--${variant}`, size !== 'md' && `gym-btn--${size}`, block && 'gym-btn--block', rest.class);
  const kids = [lead && icon(lead), label != null && h('span', { class: 'gym-btn__label' }, label), iconRight && icon(iconRight)];
  if (href && !disabled) return h('a', { ...common(rest), class: cls, href, 'aria-label': ariaLabel, onClick }, kids);
  return h('button', {
    ...common(rest), class: cls, type, 'aria-label': ariaLabel, autofocus,
    'aria-disabled': disabled && 'true', 'aria-pressed': pressed == null ? null : String(pressed), title: disabled ? reason : rest.title,
    onClick: e => { if (disabled) e.preventDefault(); else onClick?.(e); },
  }, kids);
}

export function iconButton({ icon: name, label, variant = 'secondary', ...rest }) {
  return button({ ...rest, variant, icon: name, ariaLabel: label, title: rest.title ?? label, class: cx('gym-btn--icon', rest.class) });
}

export const STATUS = Object.freeze({
  ready: { label: 'Ready', tone: 'green', dot: true },
  draft: { label: 'Draft', tone: 'gray', dot: true },
  running: { label: 'Running', tone: 'violet', dot: true },
  queued: { label: 'Queued', tone: 'gray', dot: true },
  completed: { label: 'Completed', tone: 'green', icon: 'check' },
  review: { label: 'Review', tone: 'amber' },
  needs_review: { label: 'Needs review', tone: 'amber', dot: true },
  same_intent: { label: 'Same intent', tone: 'green' },
  changed: { label: 'Changed', tone: 'violet' },
  paused: { label: 'Paused', tone: 'amber', dot: true },
  cancelled: { label: 'Cancelled', tone: 'gray', dot: true },
  failed: { label: 'Failed', tone: 'red', dot: true },
  simulated: { label: 'Simulated', tone: 'green', dot: true },
  validated: { label: 'Validated', tone: 'green', icon: 'check' },
  invalid: { label: 'Invalid', tone: 'red', dot: true },
  reviewed: { label: 'Reviewed', tone: 'green', icon: 'check' },
  passed: { label: 'Passed', tone: 'green', icon: 'check' },
  error: { label: 'Error', tone: 'red', dot: true },
});

export function badge({ status, ...rest }) {
  const spec = { tone: 'gray', ...STATUS[status], ...Object.fromEntries(Object.entries(rest).filter(([, v]) => v != null)) };
  return h('span', { ...common(rest), class: cx('gym-badge', `gym-badge--${spec.tone}`, rest.class), dataset: { status } },
    spec.dot && h('span', { class: 'gym-badge__dot', 'aria-hidden': 'true' }), spec.icon && icon(spec.icon, { size: 13 }), spec.label ?? status);
}

export function chip({ label, icon: lead, tone = 'neutral', selected, onClick, onRemove, ...rest }) {
  const cls = cx('gym-chip', `gym-chip--${tone}`, selected && 'is-selected', rest.class);
  const kids = [typeof lead === 'string' ? icon(lead, { size: 15 }) : lead, h('span', { class: 'gym-chip__label' }, label)];
  if (onClick) return h('button', { ...common(rest), class: cls, type: 'button', 'aria-pressed': selected == null ? null : String(!!selected), onClick }, kids);
  return h('span', { id: rest.id, title: rest.title, class: cls }, kids,
    onRemove && h('button', { class: 'gym-chip__remove', type: 'button', 'aria-label': `Remove ${label}`, dataset: { focusKey: rest.focusKey }, onClick: onRemove }, icon('x', { size: 12 })));
}

export function appChip({ app, label, onClick, caret, ...rest }) {
  const kids = [appIcon(app, { size: 18 }), h('span', { class: 'gym-chip__label' }, label), caret && icon('chevron-down', { size: 14 })];
  const cls = cx('gym-chip gym-chip--app', rest.class);
  return onClick ? h('button', { ...common(rest), class: cls, type: 'button', onClick }, kids) : h('span', { ...common(rest), class: cls }, kids);
}

export function tabs({ items, value, onChange, label, variant = 'segmented', ...rest }) {
  const select = (list, id, focus) => {
    for (const tab of list.children) {
      const on = tab.dataset.tab === id;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      if (on && focus) tab.focus();
    }
    if (id !== value) { value = id; onChange?.(id); }
  };
  const list = h('div', {
    id: rest.id, title: rest.title, class: cx('gym-tabs', `gym-tabs--${variant}`, rest.class), role: 'tablist', 'aria-label': label,
    onKeydown: e => {
      const ids = items.map(i => i.id), at = ids.indexOf(value);
      const to = { ArrowRight: at + 1, ArrowDown: at + 1, ArrowLeft: at - 1, ArrowUp: at - 1, Home: 0, End: ids.length - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      select(list, ids[(to + ids.length) % ids.length], true);
    },
  }, items.map(item => h('button', {
    class: 'gym-tab', type: 'button', role: 'tab', 'aria-selected': String(item.id === value), 'aria-controls': item.panelId,
    tabIndex: item.id === value ? 0 : -1, dataset: { tab: item.id, focusKey: rest.focusKey && `${rest.focusKey}:${item.id}` },
    onClick: () => select(list, item.id, false),
  }, item.icon && icon(item.icon, { size: 16 }), h('span', item.label))));
  return list;
}

export function checkbox({ checked = false, label, onChange, disabled = false, reason, ariaLabel, ...rest }) {
  return h('label', { id: rest.id, class: cx('gym-check', disabled && 'is-disabled', rest.class), title: disabled ? reason : rest.title },
    h('input', { type: 'checkbox', class: 'gym-check__box', checked, disabled, 'aria-label': ariaLabel, dataset: { focusKey: rest.focusKey }, onChange: e => onChange?.(e.target.checked, e) }),
    label != null && h('span', { class: 'gym-check__label' }, label));
}

function field({ label, hint, error, class: extra, id }, control, makeInput) {
  const hintId = hint || error ? nextId('hint') : null;
  const input = makeInput(hintId);
  const box = control(input);
  if (label == null && !hintId) { if (id) box.id = id; if (extra) box.className += ` ${extra}`; return box; }
  return h('label', { id, class: cx('gym-field', error && 'has-error', extra) },
    label != null && h('span', { class: 'gym-field__label' }, label), box,
    hintId && h('span', { id: hintId, class: error ? 'gym-field__error' : 'gym-field__hint' }, error || hint));
}

const inputProps = (p, hintId) => ({
  name: p.name, placeholder: p.placeholder, value: p.value ?? '', disabled: p.disabled, readOnly: p.readOnly,
  title: p.disabled ? p.reason : p.title, 'aria-label': p.ariaLabel, 'aria-describedby': hintId, 'aria-invalid': p.error ? 'true' : null,
  dataset: { focusKey: p.focusKey },
  onInput: p.onInput && (e => p.onInput(e.target.value, e)), onChange: p.onChange && (e => p.onChange(e.target.value, e)),
});

export function textInput(p) {
  return field(p, input => h('span', { class: cx('gym-input', p.disabled && 'is-disabled') }, p.icon && icon(p.icon, { size: 17 }), input, p.trailing),
    hintId => h('input', { ...inputProps(p, hintId), type: p.type || 'text', class: 'gym-input__control' }));
}

export function searchField(p) {
  return textInput({ icon: 'search', type: 'search', ariaLabel: p.placeholder, ...p });
}

export function select(p) {
  return field(p, input => h('span', { class: cx('gym-input gym-input--select', p.disabled && 'is-disabled') }, input, icon('chevron-down', { size: 16 })),
    hintId => h('select', { ...inputProps(p, hintId), placeholder: null, class: 'gym-input__control' },
      p.options.map(o => h('option', { value: o.value, disabled: o.disabled }, o.label ?? o.value))));
}

export function textarea(p) {
  return field(p, input => h('span', { class: cx('gym-input gym-input--area', p.disabled && 'is-disabled') }, input),
    hintId => h('textarea', { ...inputProps(p, hintId), rows: p.rows || 3, class: 'gym-input__control' }));
}

export function panel({ title, subtitle, icon: lead, actions, children, level = 2, flush, ...rest }) {
  const headed = title != null || actions;
  return h('section', { ...common(rest), class: cx('gym-panel', flush && 'gym-panel--flush', rest.class) },
    headed && h('header', { class: 'gym-panel__head' },
      lead && h('span', { class: 'gym-panel__icon' }, typeof lead === 'string' ? icon(lead, { size: 20 }) : lead),
      h('div', { class: 'gym-panel__titles' }, title != null && h(`h${level}`, { class: 'gym-panel__title' }, title), subtitle != null && h('p', { class: 'gym-panel__subtitle' }, subtitle)),
      actions && h('div', { class: 'gym-panel__actions' }, actions)),
    h('div', { class: 'gym-panel__body' }, children));
}

export function card({ children, selected, tone, onClick, ariaLabel, ...rest }) {
  const cls = cx('gym-card', selected && 'is-selected', tone && `gym-card--${tone}`, onClick && 'gym-card--action', rest.class);
  if (!onClick) return h('div', { ...common(rest), class: cls, 'aria-label': ariaLabel }, children);
  return h('button', { ...common(rest), class: cls, type: 'button', 'aria-label': ariaLabel, 'aria-pressed': selected == null ? null : String(!!selected), onClick }, children);
}

export function columns({ template = '1fr 2fr 1fr', children, ...rest }) {
  return h('div', { ...common(rest), class: cx('gym-cols', rest.class), style: { '--gym-cols': template } }, children);
}

export function footerBar({ lead, actions, ...rest }) {
  return h('div', { ...common(rest), class: cx('gym-footerbar', rest.class) }, h('div', { class: 'gym-footerbar__lead' }, lead), h('div', { class: 'gym-footerbar__actions' }, actions));
}

export function breadcrumb({ items, ...rest }) {
  return h('nav', { ...common(rest), class: cx('gym-breadcrumb', rest.class), 'aria-label': 'Breadcrumb' },
    h('ol', items.map((item, i) => h('li', i === items.length - 1
      ? h('span', { 'aria-current': 'page' }, item.label)
      : item.href ? h('a', { href: item.href }, item.label) : h('span', item.label)))));
}

export function pageHeader({ title, subtitle, breadcrumb: crumbs, actions, meta, ...rest }) {
  return h('header', { ...common(rest), class: cx('gym-pagehead', rest.class) },
    crumbs && breadcrumb({ items: crumbs }),
    h('div', { class: 'gym-pagehead__row' },
      h('div', { class: 'gym-pagehead__titles' },
        h('h1', { class: 'gym-pagehead__title' }, title),
        subtitle != null && h('p', { class: 'gym-pagehead__subtitle' }, subtitle)),
      actions && h('div', { class: 'gym-pagehead__actions' }, actions)),
    meta && h('div', { class: 'gym-pagehead__meta' }, meta));
}

export function progress({ value, max = 100, label, text, ...rest }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return h('div', { ...common(rest), class: cx('gym-progress', rest.class) },
    h('div', { class: 'gym-progress__track', role: 'progressbar', 'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': max, 'aria-valuenow': value, 'aria-valuetext': text },
      h('div', { class: 'gym-progress__bar', style: { width: `${pct}%` } })),
    text != null && h('span', { class: 'gym-progress__text', 'aria-hidden': 'true' }, text));
}

const NOTICE_ICON = { info: 'info', warning: 'alert', error: 'alert', success: 'check-circle' };

export function notice({ tone = 'info', title, text, children, actions, onDismiss, role, ...rest }) {
  return h('div', { ...common(rest), class: cx('gym-notice', `gym-notice--${tone}`, rest.class), role },
    icon(NOTICE_ICON[tone], { size: 18 }),
    h('div', { class: 'gym-notice__body' }, title != null && h('strong', { class: 'gym-notice__title' }, title), text != null && h('span', text), children),
    actions && h('div', { class: 'gym-notice__actions' }, actions),
    onDismiss && iconButton({ icon: 'x', label: 'Dismiss', variant: 'ghost', size: 'sm', onClick: onDismiss }));
}

export function emptyState({ icon: lead = 'box', title, text, action, ...rest }) {
  return h('div', { ...common(rest), class: cx('gym-empty', rest.class) },
    h('span', { class: 'gym-empty__icon' }, icon(lead, { size: 22 })),
    h('strong', { class: 'gym-empty__title' }, title), text != null && h('p', { class: 'gym-empty__text' }, text), action);
}

export function popoverMenu({ trigger, items, align = 'start', label, ...rest }) {
  const menuId = nextId('menu');
  const btn = trigger instanceof Node ? trigger : button(trigger);
  const options = () => [...menu.querySelectorAll('[role="menuitem"]')];
  const outside = e => { if (!wrap.isConnected || !wrap.contains(e.target)) close(false); };
  function open(last) {
    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', outside, true);
    options().at(last ? -1 : 0)?.focus();
  }
  function close(refocus) {
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', outside, true);
    if (refocus) btn.focus();
  }
  btn.setAttribute('aria-haspopup', 'menu');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', menuId);
  btn.addEventListener('click', () => { if (btn.getAttribute('aria-disabled') !== 'true') menu.hidden ? open(false) : close(true); });
  btn.addEventListener('keydown', e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(e.key === 'ArrowUp'); } });
  const menu = h('div', {
    id: menuId, class: cx('gym-menu', `gym-menu--${align}`), role: 'menu', 'aria-label': label, hidden: true,
    onKeydown: e => {
      const list = options(), at = list.indexOf(document.activeElement);
      const to = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: list.length - 1 }[e.key];
      if (to !== undefined) { e.preventDefault(); list[(to + list.length) % list.length]?.focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
      else if (e.key === 'Tab') close(false);
    },
  }, items.map(item => item.separator ? h('div', { class: 'gym-menu__sep', role: 'separator' })
    : item.heading != null ? h('div', { class: 'gym-menu__heading', role: 'presentation' }, item.heading)
    : h('button', {
      class: cx('gym-menu__item', item.danger && 'is-danger'), type: 'button', role: 'menuitem', tabIndex: -1,
      'aria-disabled': item.disabled && 'true', title: item.disabled ? item.reason : null,
      onClick: () => { if (item.disabled) return; close(true); item.onSelect?.(); },
    }, item.icon && icon(item.icon, { size: 16 }),
      h('span', { class: 'gym-menu__text' }, h('span', item.label), item.description != null && h('small', item.description)))));
  const wrap = h('div', { id: rest.id, class: cx('gym-menuwrap', rest.class) }, btn, menu);
  return wrap;
}

export function dialog({ title, description, children, actions, size = 'sm', ...rest }) {
  const titleId = nextId('dlg');
  const descId = description != null ? nextId('dlgd') : null;
  return h('dialog', { id: rest.id, class: cx('gym-dialog', `gym-dialog--${size}`, rest.class), 'aria-labelledby': titleId, 'aria-describedby': descId },
    h('div', { class: 'gym-dialog__box' },
      h('h2', { id: titleId, class: 'gym-dialog__title' }, title),
      description != null && h('p', { id: descId, class: 'gym-dialog__desc' }, description),
      children && h('div', { class: 'gym-dialog__body' }, children),
      actions && h('div', { class: 'gym-dialog__actions' }, actions)));
}

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function openDialog({ actions, onClose, dismissible = true, ...props }) {
  const opener = document.activeElement;
  const openerKey = opener?.getAttribute?.('data-focus-key');
  let result;
  const close = value => { result = value; el.close(); };
  const el = dialog({ ...props, actions: actions?.(close) });
  el.addEventListener('cancel', e => { if (!dismissible) e.preventDefault(); });
  el.addEventListener('click', e => { if (e.target === el && dismissible) close(); });
  el.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const list = [...el.querySelectorAll(FOCUSABLE)].filter(n => !n.disabled);
    const edge = e.shiftKey ? list[0] : list.at(-1);
    if (list.length && (document.activeElement === edge || !el.contains(document.activeElement))) { e.preventDefault(); (e.shiftKey ? list.at(-1) : list[0]).focus(); }
  });
  el.addEventListener('close', () => {
    el.remove();
    const back = opener?.isConnected ? opener : openerKey && [...document.querySelectorAll('[data-focus-key]')].find(n => n.getAttribute('data-focus-key') === openerKey);
    back?.focus?.();
    onClose?.(result);
  });
  document.body.append(el);
  el.showModal();
  return { el, close };
}

export function confirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false }) {
  return new Promise(resolve => openDialog({
    title, description: message,
    actions: close => [
      button({ label: cancelLabel, onClick: () => close(false), autofocus: true }),
      button({ label: confirmLabel, variant: danger ? 'danger' : 'primary', onClick: () => close(true) }),
    ],
    onClose: value => resolve(value === true),
  }));
}
