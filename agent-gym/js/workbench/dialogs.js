// Workbench dialogs. Each returns { el, close } from openDialog and keeps its body in step with the store while open.
import { h, mountView } from '../components/dom.js';
import { button, openDialog, select, badge } from '../components/ui.js';
import { REPETITIONS } from '../model.js';
import { experimentSummary } from '../selectors.js';
import { setRepetitions } from '../simulation/attempts.js';
import { nodeDetail, nodeDiff } from './derive.js';

function live(store, render, props) {
  const body = h('div', { class: 'wb-dialog' });
  const view = mountView(body, render, store);
  return openDialog({ ...props, children: body, onClose: result => { view.destroy(); props.onClose?.(result); } });
}

const diffTable = (rows, versionName) => h('table', { class: 'wb-diff' },
  h('thead', h('tr', h('th', { scope: 'col' }, 'Setting'), h('th', { scope: 'col' }, 'Baseline'), h('th', { scope: 'col' }, versionName))),
  h('tbody', rows.map(r => h('tr', { class: r.changed ? 'is-changed' : null },
    h('th', { scope: 'row' }, r.key), h('td', r.baseline), h('td', r.variant, r.changed && h('span', { class: 'gym-sr' }, ' (changed)'))))));

const facts = pairs => h('dl', { class: 'wb-facts' }, pairs.filter(Boolean).map(([k, v]) => h('div', h('dt', k), h('dd', v))));

export function openRunSettings({ store, experimentId, onClose, announce }) {
  return live(store, state => {
    const sum = experimentSummary(state, experimentId);
    return [
      select({
        label: 'Repetitions per scenario', value: String(sum.repetitions), focusKey: 'wb:dlg:reps',
        hint: `Each selected scenario runs ${sum.repetitions} time${sum.repetitions === 1 ? '' : 's'} on every version.`,
        options: Array.from({ length: REPETITIONS.max - REPETITIONS.min + 1 }, (_, i) => ({ value: String(i + REPETITIONS.min) })),
        onChange: value => {
          const result = store.dispatch(setRepetitions, { experimentId, repetitions: Number(value) });
          announce(result.ok ? experimentSummary(store.getState(), experimentId).formula : result.error.message);
        },
      }),
      h('p', { class: 'wb-dialog__formula', dataset: { formula: '' } }, sum.formula),
      facts([
        ['Runs', `${sum.runs}: one run is one version on one scenario for one repetition, in its own simulated sandbox.`],
        ['Pairs', `${sum.pairs}: a pair is the baseline and ${sum.versions > 1 ? 'Variant A' : 'the variant'} on the same scenario and repetition. Results compare pairs, so both sides see the same input.`],
      ]),
    ];
  }, {
    title: 'Run settings', description: 'Runs = versions × selected scenarios × repetitions.', size: 'sm', onClose,
    actions: close => [button({ label: 'Done', variant: 'primary', onClick: () => close(), autofocus: true })],
  });
}

export function openCompare({ store, experimentId, onClose, onInspect }) {
  return live(store, state => {
    const diff = nodeDiff(state, experimentId);
    if (!diff) return h('p', 'There is no variant to compare. Create Variant A first.');
    return [
      h('p', { class: 'gym-muted' }, `${diff.workflowName}: ${diff.changedCount} of ${diff.rows.length} steps change in ${diff.variantName}. Variant A changes model configuration only.`),
      h('ul', { class: 'wb-compare' }, diff.rows.map(row => h('li', { class: row.changed ? 'is-changed' : null, dataset: { node: row.id } },
        h('div', { class: 'wb-compare__head' },
          h('strong', row.label), row.chip && h('span', { class: 'wb-node__chip' }, row.chip),
          row.changed ? badge({ status: 'changed' }) : h('span', { class: 'gym-muted' }, 'Unchanged'),
          row.changed && button({ label: 'Inspect step', variant: 'link', size: 'sm', onClick: () => onInspect(row.id) })),
        row.changed && diffTable(row.fields, diff.variantName)))),
    ];
  }, {
    title: 'Compare changes', description: 'Baseline against Variant A, step by step. Simulated model settings, not a real provider.', size: 'md', onClose,
    actions: close => [button({ label: 'Close', onClick: () => close(), autofocus: true })],
  });
}

export function openInspect({ store, experimentId, versionId, nodeId, onClose }) {
  return live(store, state => {
    const d = nodeDetail(state, experimentId, versionId, nodeId);
    return [
      d.change && h('p', { class: 'wb-dialog__change' }, `Change: ${d.change}`),
      d.config && h('div', { class: 'wb-dialog__section' }, h('h3', 'Configuration'),
        d.diff.length ? diffTable(d.diff, 'Variant A') : facts([['Model', d.configText]])),
      h('div', { class: 'wb-dialog__section' }, h('h3', 'Step'),
        facts([
          ['Inputs', d.inputs || '—'], ['Outputs', d.outputs || '—'],
          ['Needs', d.dependencies.length ? d.dependencies.map(x => `${x.capability} (${x.matched ? 'matched' : 'missing'} in ${d.environmentLabel})`).join('; ') : 'No tool; runs on the simulated model'],
          d.faults.length && ['Fault injected', d.faults.map(f => `${f.label} in ${f.scenario}`).join('; ')],
        ])),
      h('div', { class: 'wb-dialog__section' }, h('h3', 'Applicable checks'),
        d.checks.length ? h('ul', { class: 'wb-list' }, d.checks.map(c => h('li', `${c.label} · ${c.scenario}`))) : h('p', { class: 'gym-muted' }, 'No selected scenario checks this step directly.')),
    ];
  }, {
    title: nodeDetail(store.getState(), experimentId, versionId, nodeId).title, description: 'Simulated step configuration. Nothing here calls a real model or system.', size: 'md', onClose,
    actions: close => [button({ label: 'Close', onClick: () => close(), autofocus: true })],
  });
}
