// DOM helpers for Agent Gym v2. Text always becomes a text node, so fixture and user text is never parsed as HTML.
//
//   h(tag, props?, ...children) -> HTMLElement      s(tag, props?, ...children) -> SVGElement
//     props: class, style (object), dataset (object), onClick/onInput/... (listeners),
//            value/checked/disabled/... (set as properties), anything else is an attribute.
//            null, undefined and false props are skipped. true sets an empty attribute.
//     children: strings, numbers, nodes, arrays of those. null, undefined and false are skipped.
//
//   mountView(root, render, store) -> { refresh(), destroy() }
//     Calls render(state) now and after every store change, and reconciles the result into root's children.
//     A rendered element with the same tag and key as a live one keeps the live element, which takes the new
//     attributes, text, children and listeners. The key is data-focus-key, else the position among siblings with
//     that tag. Anything else is replaced. A render leaves what the user changed alone unless it changes that value
//     itself: the open state of a <details> and the value of the focused field. Focus, caret and scroll survive
//     because the elements do. When an element is replaced, focus returns to the element with the same
//     data-focus-key (caret included), and an element with the same data-scroll-key keeps the scroll position.
//     Listeners must reach the nodes they act on through the event (currentTarget, target, closest): the nodes a
//     render builds are dropped whenever a live element matches them.

const SVG_NS = 'http://www.w3.org/2000/svg';
const AS_PROPERTY = new Set(['value', 'checked', 'disabled', 'selected', 'indeterminate', 'hidden', 'tabIndex', 'htmlFor', 'open', 'readOnly', 'required']);
const HANDLERS = Symbol('handlers');
const RENDERED = Symbol('rendered');

function listen(event) { this[HANDLERS]?.[event.type]?.call(this, event); }

function append(node, child) {
  if (child == null || child === false || child === true) return;
  if (Array.isArray(child)) { for (const c of child) append(node, c); return; }
  node.append(child instanceof Node ? child : document.createTextNode(String(child)));
}

function build(node, props, children) {
  let value;
  for (const [key, val] of Object.entries(props || {})) {
    if (val == null || val === false) continue;
    if (key === 'class') node.setAttribute('class', val);
    else if (key === 'style') for (const [prop, v] of Object.entries(val)) prop.startsWith('--') ? node.style.setProperty(prop, v) : (node.style[prop] = v);
    else if (key === 'dataset') { for (const [k, v] of Object.entries(val)) if (v != null && v !== false) node.dataset[k] = v; }
    else if (key === 'value') value = val;
    else if (/^on[A-Z]/.test(key)) { const type = key.slice(2).toLowerCase(); (node[HANDLERS] ??= {})[type] = val; node.addEventListener(type, listen); }
    else if (AS_PROPERTY.has(key)) node[key] = val;
    else node.setAttribute(key, val === true ? '' : val);
  }
  append(node, children);
  // After the children, because a <select> can only take a value that one of its options has.
  if (value !== undefined) node.value = value;
  node[RENDERED] = { open: !!props?.open, value: value === undefined ? undefined : String(value) };
  return node;
}

const isProps = x => x != null && typeof x === 'object' && !Array.isArray(x) && !(x instanceof Node);

export function h(tag, props, ...children) {
  return isProps(props) ? build(document.createElement(tag), props, children) : build(document.createElement(tag), null, [props, children]);
}

export function s(tag, props, ...children) {
  return isProps(props) ? build(document.createElementNS(SVG_NS, tag), props, children) : build(document.createElementNS(SVG_NS, tag), null, [props, children]);
}

const sameKind = (a, b) => a.nodeType === b.nodeType && a.nodeName === b.nodeName && a.namespaceURI === b.namespaceURI;

function slotKeys(nodes) {
  const seen = new Map();
  return nodes.map(n => {
    const focusKey = n.nodeType === Node.ELEMENT_NODE ? n.getAttribute('data-focus-key') : null;
    const base = focusKey != null ? `key:${focusKey}` : `tag:${n.namespaceURI}:${n.nodeName}`;
    const nth = seen.get(base) ?? 0;
    seen.set(base, nth + 1);
    return `${base}#${nth}`;
  });
}

function patchAttributes(live, next) {
  const userOwnsOpen = live[RENDERED]?.open === next[RENDERED]?.open;
  for (const { name, value } of [...next.attributes]) {
    if (name === 'open' && userOwnsOpen) continue;
    if (live.getAttribute(name) !== value) live.setAttribute(name, value);
  }
  for (const { name } of [...live.attributes]) {
    if (name === 'open' && userOwnsOpen) continue;
    if (!next.hasAttribute(name)) live.removeAttribute(name);
  }
}

function patchFieldState(live, next) {
  if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(live.nodeName) || live.type === 'file') return;
  const editing = live === document.activeElement && live[RENDERED]?.value === next[RENDERED]?.value;
  if (live.value !== next.value && !editing) live.value = next.value;
  if (live.nodeName !== 'INPUT') return;
  if (live.checked !== next.checked) live.checked = next.checked;
  if (live.indeterminate !== next.indeterminate) live.indeterminate = next.indeterminate;
}

function patch(live, next) {
  if (live.nodeType !== Node.ELEMENT_NODE) { if (live.data !== next.data) live.data = next.data; return; }
  patchAttributes(live, next);
  live[HANDLERS] = next[HANDLERS];
  for (const type of Object.keys(next[HANDLERS] ?? {})) live.addEventListener(type, listen);
  patchChildren(live, [...next.childNodes]);
  patchFieldState(live, next);
  live[RENDERED] = next[RENDERED];
}

function patchChildren(parent, fresh) {
  const live = [...parent.childNodes];
  const unmatched = new Map(slotKeys(live).map((key, i) => [key, live[i]]));
  const next = slotKeys(fresh).map((key, i) => {
    const old = unmatched.get(key);
    if (!old || !sameKind(old, fresh[i])) return fresh[i];
    unmatched.delete(key);
    patch(old, fresh[i]);
    return old;
  });
  for (const node of unmatched.values()) node.remove();
  // Only nodes out of place move, so a kept element that holds focus or a pressed pointer is never detached.
  let cursor = parent.firstChild;
  for (const node of next) {
    if (node === cursor) cursor = node.nextSibling;
    else parent.insertBefore(node, cursor);
  }
}

const byKey = (root, attr, key) => [...root.querySelectorAll(`[${attr}]`)].find(el => el.getAttribute(attr) === key);

export function mountView(root, render, store) {
  const refresh = () => {
    const active = document.activeElement;
    const focusKey = active && root.contains(active) ? active.getAttribute('data-focus-key') : null;
    const caret = focusKey && typeof active.selectionStart === 'number' ? [active.selectionStart, active.selectionEnd] : null;
    const scroll = [...root.querySelectorAll('[data-scroll-key]')].map(el => [el, el.getAttribute('data-scroll-key'), el.scrollTop, el.scrollLeft]);
    const fresh = document.createDocumentFragment();
    append(fresh, render(store.getState()));
    patchChildren(root, [...fresh.childNodes]);
    for (const [was, key, top, left] of scroll) {
      const el = byKey(root, 'data-scroll-key', key);
      if (el && el !== was) { el.scrollTop = top; el.scrollLeft = left; }
    }
    if (focusKey && !active.isConnected) {
      const el = byKey(root, 'data-focus-key', focusKey);
      if (el) { el.focus({ preventScroll: true }); if (caret && typeof el.selectionStart === 'number') el.setSelectionRange(caret[0], caret[1]); }
    }
  };
  const unsubscribe = store.subscribe(refresh);
  refresh();
  return { refresh, destroy() { unsubscribe(); root.replaceChildren(); } };
}
