/* Inspector: a form generated from the selected node type's config schema
   (model.js NODE_TYPES[type].schema). Every edit is a patch op sent through
   onPatch; expressions are checked before they are applied. */
import { NODE_TYPES, nodeById } from './model.js';

const h = (tag, props = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null) el.append(c);
  return el;
};

export function createInspector(root, { onPatch, exprCheck, onSelectNode, extraPanel }) {
  let last = null;

  function field(label, input, err, hint) {
    return h('div', { class: 'field' }, h('label', { text: label }), input, err ? h('div', { class: 'err', text: err }) : null, hint ? h('div', { class: 'hint', text: hint }) : null);
  }

  function setConfig(node, key, value, merge) { return onPatch([{ op: 'setConfig', id: node.id, key, value }], `Edit ${key}`, merge); }

  function renderField(node, f, locked) {
    const c = node.config, v = c[f.key], dis = locked;
    switch (f.type) {
      case 'text': {
        const i = h('input', { type: 'text', value: v ?? '', disabled: dis });
        i.addEventListener('change', () => setConfig(node, f.key, i.value.trim()));
        return field(f.label, i);
      }
      case 'number': {
        const i = h('input', { type: 'number', value: v ?? 0, disabled: dis, step: 'any' });
        i.addEventListener('change', () => { const n = Number(i.value); if (Number.isFinite(n)) setConfig(node, f.key, n); });
        return field(f.label, i);
      }
      case 'select': {
        const s = h('select', { disabled: dis }, f.options.map(o => h('option', { value: o, text: o, selected: o === v })));
        s.addEventListener('change', () => setConfig(node, f.key, s.value));
        return field(f.label, s);
      }
      case 'bool': {
        const i = h('input', { type: 'checkbox', checked: !!v, disabled: dis });
        i.addEventListener('change', () => setConfig(node, f.key, i.checked));
        return h('div', { class: 'field' }, h('label', { class: 'chk' }, i, f.label));
      }
      case 'expr': {
        const i = h('input', { type: 'text', class: 'mono', value: v ?? '', disabled: dis, spellcheck: 'false', 'data-expr': f.key });
        const errEl = h('div', { class: 'err' }); errEl.hidden = true;
        i.addEventListener('change', () => {
          const src = i.value.trim();
          if (f.optional && src === '') { errEl.hidden = true; return setConfig(node, f.key, ''); }
          const r = exprCheck(src);
          if (!r.ok) { errEl.hidden = false; errEl.textContent = r.error.message + (r.error.pos != null ? ` (at ${r.error.pos})` : ''); return; }
          errEl.hidden = true; setConfig(node, f.key, src);
        });
        return h('div', { class: 'field' }, h('label', { text: f.label }), i, errEl,
          h('div', { class: 'hint', text: 'Variables: amount, dayTotal, customer, order, channel, trust, eligible. Operators: && || ! == != < <= > >=' }));
      }
      case 'multiselect': {
        const set = new Set(v || []);
        return h('div', { class: 'field' }, h('label', { text: f.label }), f.options.map(o => {
          const i = h('input', { type: 'checkbox', checked: set.has(o), disabled: dis });
          i.addEventListener('change', () => { i.checked ? set.add(o) : set.delete(o); setConfig(node, f.key, f.options.filter(x => set.has(x))); });
          return h('label', { class: 'chk' }, i, o);
        }));
      }
      case 'range': {
        const [lo, hi] = Array.isArray(v) ? v : [0, 0];
        const a = h('input', { type: 'number', value: lo, disabled: dis }), b = h('input', { type: 'number', value: hi, disabled: dis });
        const commit = () => { const x = Number(a.value), y = Number(b.value); if (Number.isFinite(x) && Number.isFinite(y) && y > x) setConfig(node, f.key, [x, y]); };
        a.addEventListener('change', commit); b.addEventListener('change', commit);
        return field(f.label, h('div', { class: 'caps-row' }, a, b), null, 'Amounts the adversary scenarios draw from (not a monitor rule).');
      }
      case 'caps': {
        const caps = (v || []).map(x => ({ ...x }));
        const commit = () => setConfig(node, f.key, caps.filter(x => x.cap).map(x => ({ cap: x.cap, limit: Number(x.limit) || 0 })));
        const rows = caps.map((x, i) => {
          const cap = h('input', { type: 'text', value: x.cap, disabled: dis, placeholder: 'capability' });
          const lim = h('input', { type: 'number', value: x.limit, disabled: dis, placeholder: 'limit' });
          cap.addEventListener('change', () => { caps[i].cap = cap.value.trim(); commit(); });
          lim.addEventListener('change', () => { caps[i].limit = Number(lim.value); commit(); });
          return h('div', { class: 'caps-row' }, cap, lim, h('button', { class: 'tool-btn', text: '×', disabled: dis, title: 'Remove', onclick: () => { caps.splice(i, 1); commit(); } }));
        });
        return h('div', { class: 'field' }, h('label', { text: f.label }), rows,
          h('button', { class: 'tool-btn', text: '＋ capability', disabled: dis, onclick: () => { caps.push({ cap: 'refund.issue', limit: 1000 }); commit(); } }),
          h('div', { class: 'hint', text: 'A write tool checks the last agent on the path for its capability and limit.' }));
      }
      case 'nodeRefs': {
        const set = new Set(v || []);
        const opts = last.graph.nodes.filter(n => f.refTypes.includes(n.type));
        return h('div', { class: 'field' }, h('label', { text: f.label }), opts.length ? opts.map(o => {
          const i = h('input', { type: 'checkbox', checked: set.has(o.id), disabled: dis });
          i.addEventListener('change', () => { i.checked ? set.add(o.id) : set.delete(o.id); setConfig(node, f.key, opts.filter(x => set.has(x.id)).map(x => x.id)); });
          return h('label', { class: 'chk' }, i, o.label);
        }) : h('div', { class: 'hint', text: 'Add a tool or outcome to watch.' }));
      }
      default: return null;
    }
  }

  function render({ graph, selection, locked, issues, docPanel }) {
    last = { graph };
    root.textContent = '';
    const nodeId = selection.nodes.length === 1 ? selection.nodes[0] : null;
    const node = nodeId && nodeById(graph, nodeId);
    if (node) {
      const def = NODE_TYPES[node.type];
      const label = h('input', { type: 'text', value: node.label, disabled: locked, 'data-field': 'label' });
      label.addEventListener('change', () => onPatch([{ op: 'setLabel', id: node.id, label: label.value.trim() || def.label }], 'Rename'));
      root.append(h('div', { class: 'type', text: def.label + ' · ' + node.id }), h('h3', { text: node.label }), field('Label', label));
      for (const f of def.schema) if (!f.when || f.when(node.config)) { const el = renderField(node, f, locked); if (el) root.append(el); }
      const mine = issues.filter(i => i.nodeId === node.id);
      if (mine.length) root.append(h('div', { class: 'issues' }, mine.map(i => h('div', { class: 'issue ' + i.severity, text: i.message }))));
      root.append(h('div', { class: 'field' }, h('button', { class: 'btn danger sm', text: 'Delete node', disabled: locked, onclick: () => onPatch([{ op: 'removeNode', id: node.id }], 'Delete') })));
      return;
    }
    if (selection.edge) {
      const e = graph.edges.find(x => x.id === selection.edge);
      if (e) {
        const a = nodeById(graph, e.from.node), b = nodeById(graph, e.to.node);
        root.append(h('div', { class: 'type', text: (e.kind === 'flow' ? 'Flow edge' : 'Access edge (read)') + ' · ' + e.id }),
          h('h3', { text: `${a?.label} → ${b?.label}` }),
          h('div', { class: 'hint', text: e.kind === 'flow' ? `From port “${e.from.port}” to “${e.to.port}”.` : 'The agent or tool reads this data resource. Agents may carry what they read into their output (plan §4.3).' }),
          h('div', { class: 'field' }, h('button', { class: 'btn danger sm', text: 'Delete edge', disabled: locked, onclick: () => onPatch([{ op: 'removeEdge', id: e.id }], 'Delete edge') })));
        return;
      }
    }
    if (selection.nodes.length > 1) {
      root.append(h('div', { class: 'type', text: 'Selection' }), h('h3', { text: selection.nodes.length + ' nodes selected' }),
        h('div', { class: 'hint', text: 'Drag to move them together. ⌘C / ⌘V copies them with their internal edges. Delete removes them.' }));
      return;
    }
    if (docPanel) root.append(docPanel());
    const all = issues;
    root.append(h('div', { class: 'issues' }, h('div', { class: 'type', text: all.length ? `${all.length} lint issue(s)` : 'Lint: no issues' }),
      all.map(i => h('div', { class: 'issue ' + i.severity, text: i.message, onclick: () => i.nodeId && onSelectNode(i.nodeId) }))));
    if (extraPanel) root.append(extraPanel());
  }

  return { render };
}
