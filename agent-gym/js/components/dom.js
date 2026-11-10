// DOM helpers for Agent Gym v2. Text always becomes a text node, so fixture and user text is never parsed as HTML.
//
//   h(tag, props?, ...children) -> HTMLElement      s(tag, props?, ...children) -> SVGElement
//     props: class, style (object), dataset (object), onClick/onInput/... (listeners), ref (fn called with the node),
//            value/checked/disabled/... (set as properties), anything else is an attribute.
//            null, undefined and false props are skipped. true sets an empty attribute.
//     children: strings, numbers, nodes, arrays of those. null, undefined and false are skipped.
//
//   mountView(root, render, store) -> { refresh(), destroy() }
//     Calls render(state) now and after every store change, and replaces root's children with the result.
//     Focus returns to the element with the same data-focus-key (caret included). Elements with a
//     data-scroll-key keep their scroll position. A control without a focus key loses focus on re-render.

const SVG_NS = 'http://www.w3.org/2000/svg';
const AS_PROPERTY = new Set(['value', 'checked', 'disabled', 'selected', 'indeterminate', 'hidden', 'tabIndex', 'htmlFor', 'open', 'readOnly', 'required']);

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
    else if (key === 'ref') continue;
    else if (key === 'value') value = val;
    else if (/^on[A-Z]/.test(key)) node.addEventListener(key.slice(2).toLowerCase(), val);
    else if (AS_PROPERTY.has(key)) node[key] = val;
    else node.setAttribute(key, val === true ? '' : val);
  }
  append(node, children);
  // After the children, because a <select> can only take a value that one of its options has.
  if (value !== undefined) node.value = value;
  props?.ref?.(node);
  return node;
}

const isProps = x => x != null && typeof x === 'object' && !Array.isArray(x) && !(x instanceof Node);

export function h(tag, props, ...children) {
  return isProps(props) ? build(document.createElement(tag), props, children) : build(document.createElement(tag), null, [props, children]);
}

export function s(tag, props, ...children) {
  return isProps(props) ? build(document.createElementNS(SVG_NS, tag), props, children) : build(document.createElementNS(SVG_NS, tag), null, [props, children]);
}

const byKey = (root, attr, key) => [...root.querySelectorAll(`[${attr}]`)].find(el => el.getAttribute(attr) === key);

export function mountView(root, render, store) {
  const refresh = () => {
    const active = document.activeElement;
    const focusKey = active && root.contains(active) ? active.getAttribute('data-focus-key') : null;
    const caret = focusKey && typeof active.selectionStart === 'number' ? [active.selectionStart, active.selectionEnd] : null;
    const scroll = [...root.querySelectorAll('[data-scroll-key]')].map(el => [el.getAttribute('data-scroll-key'), el.scrollTop, el.scrollLeft]);
    root.replaceChildren();
    append(root, render(store.getState()));
    for (const [key, top, left] of scroll) { const el = byKey(root, 'data-scroll-key', key); if (el) { el.scrollTop = top; el.scrollLeft = left; } }
    if (focusKey) {
      const el = byKey(root, 'data-focus-key', focusKey);
      if (el) { el.focus({ preventScroll: true }); if (caret && typeof el.selectionStart === 'number') el.setSelectionRange(caret[0], caret[1]); }
    }
  };
  const unsubscribe = store.subscribe(refresh);
  refresh();
  return { refresh, destroy() { unsubscribe(); root.replaceChildren(); } };
}
