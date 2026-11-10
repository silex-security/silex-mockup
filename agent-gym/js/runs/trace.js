// Recorded trace events, tool requests, final state and assertions of one execution. Display only.
import { h } from '../components/dom.js';
import { badge } from '../components/ui.js';

const TYPE = {
  tool_call: { label: 'Tool call', tone: 'gray' }, model: { label: 'Model', tone: 'violet' }, decision: { label: 'Decision', tone: 'gray' },
  approval: { label: 'Approval', tone: 'violet' }, policy_block: { label: 'Policy block', tone: 'red' }, note: { label: 'Note', tone: 'gray' },
};
const RESPONSE_TONE = { ok: 'green', timeout: 'amber', denied: 'red', error: 'red' };
const EFFECT_TONE = { none: 'gray', committed: 'violet', deduplicated: 'green', blocked: 'red' };
const isTool = e => e.type === 'tool_call' || e.type === 'policy_block';

const fact = (term, value, tone) => h('span', { class: 'run-fact' }, h('span', { class: 'run-fact__term' }, term), badge({ label: value, tone }));

export const requestFacts = request => {
  const entries = Object.entries(request ?? {});
  return entries.length
    ? h('dl', { class: 'run-req' }, entries.map(([k, v]) => h('div', { class: 'run-req__row' }, h('dt', k), h('dd', { class: 'gym-mono' }, String(v)))))
    : h('p', { class: 'run-req run-req--empty gym-muted' }, 'No input');
};

/** responseState and sideEffectState are two separate facts: a timeout can still have committed the side effect. */
const toolFacts = e => h('div', { class: 'run-ev__facts' },
  fact('Response', e.responseState, RESPONSE_TONE[e.responseState]),
  fact('Side effect', e.sideEffectState, EFFECT_TONE[e.sideEffectState]),
  e.attemptedPolicyViolation && badge({ label: 'Attempted policy violation', tone: 'red', icon: 'shield' }));

function eventItem(e, nodeLabels, { detailed }) {
  const type = TYPE[e.type] ?? TYPE.note;
  return h('li', { class: `run-ev run-ev--${e.type}${e.responseState === 'timeout' ? ' run-ev--timeout' : ''}`, dataset: { runSeq: e.seq } },
    h('span', { class: 'run-ev__seq', 'aria-hidden': 'true' }, e.seq),
    h('div', { class: 'run-ev__body' },
      h('div', { class: 'run-ev__head' },
        badge({ label: type.label, tone: type.tone }),
        h('span', { class: 'run-ev__node' }, e.nodeId ? nodeLabels[e.nodeId] ?? e.nodeId : 'Scenario event'),
        e.tool && h('code', { class: 'run-ev__tool gym-mono' }, e.tool)),
      h('p', { class: 'run-ev__note' }, e.note),
      isTool(e) && toolFacts(e),
      detailed && isTool(e) && requestFacts(e.request)));
}

export const nodeLabelsOf = workflow => Object.fromEntries(workflow.nodes.map(n => [n.id, n.label]));

export function traceList(events, nodeLabels, { scrollKey, detailed = true, label } = {}) {
  return h('ol', { class: 'run-trace', 'aria-label': label, dataset: { scrollKey }, tabIndex: scrollKey ? 0 : null },
    events.map(e => eventItem(e, nodeLabels, { detailed })));
}

/** Marks events shown, current and not yet shown at a replay position, without rebuilding the list. */
export function paintTrace(root, frame) {
  for (const el of root.querySelectorAll('[data-run-seq]')) {
    const seq = Number(el.dataset.runSeq);
    el.dataset.state = seq === frame.position ? 'current' : seq < frame.position ? 'past' : 'future';
    if (seq === frame.position) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current');
  }
}

export function toolRequests(events) {
  const calls = events.filter(isTool);
  return calls.length
    ? h('ol', { class: 'run-calls' }, calls.map(e => h('li', { class: 'run-call' },
      h('div', { class: 'run-ev__head' }, h('span', { class: 'run-ev__seq', 'aria-hidden': 'true' }, e.seq), h('code', { class: 'gym-mono run-ev__tool' }, e.tool)),
      requestFacts(e.request), toolFacts(e))))
    : h('p', { class: 'gym-muted' }, 'No tool calls');
}

const section = (title, count, body) => h('section', { class: 'run-state__part' },
  h('h4', { class: 'run-state__title' }, title, count != null && h('span', { class: 'run-state__count' }, count)), body);
const list = (items, empty) => items.length ? h('ul', { class: 'run-state__list' }, items.map(i => h('li', i))) : h('p', { class: 'gym-muted' }, empty);
const mono = text => h('span', { class: 'gym-mono' }, text);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function finalStateView(fs) {
  const writes = fs.writes ?? [];
  const crm = writes.filter(w => w.capability.startsWith('crm.'));
  const other = writes.filter(w => !w.capability.startsWith('crm.') && w.capability !== 'email.send_email');
  const ledger = Object.entries(fs.ledger ?? {});
  const { requested = [], granted = [] } = fs.approvals ?? {};
  return h('div', { class: 'run-state' },
    section('Outbox', plural(fs.outbox.length, 'email'), list(fs.outbox.map(m => [mono(m.id), ` to ${m.to} · key `, mono(m.idempotencyKey ?? 'none'), m.approved ? ' · approved' : ' · not approved']), 'Nothing sent')),
    section('CRM', plural(crm.length, 'write'), list(crm.map(w => [mono(w.capability), ' → ', mono(w.recordId), w.kind ? ` · ${w.kind}` : '']), fs.crm ? 'No CRM writes' : 'No CRM in this environment')),
    section('Approvals', `${requested.length} requested · ${granted.length} granted`,
      list(granted.map(g => `Granted by a ${g.source === 'scripted_event' ? 'scripted scenario event' : g.source} after ${g.after}`), requested.length ? 'Requested, never granted' : 'None requested')),
    section('Idempotency ledger', plural(ledger.length, 'key'), list(ledger.map(([key, v]) => [mono(key), ' → ', mono(v.recordId), ` · ${v.capability}`]), 'No keys recorded')),
    other.length > 0 && section('Other writes', plural(other.length, 'write'), list(other.map(w => [mono(w.capability), ' → ', mono(w.recordId)]), '')),
    (fs.violations ?? []).length > 0 && section('Violations', plural(fs.violations.length, 'violation'),
      list(fs.violations.map(v => `${v.kind} on ${v.capability}${v.attempted ? ' (attempted)' : ''}`), '')));
}

export function assertionList(results, { failedOnly = false } = {}) {
  const shown = failedOnly ? results.filter(r => !r.pass) : results;
  if (!shown.length) return h('p', { class: 'gym-muted' }, failedOnly ? 'Every assertion held.' : 'No assertions recorded.');
  return h('ul', { class: 'run-asserts' }, shown.map(r => h('li', { class: `run-assert ${r.pass ? 'is-pass' : 'is-fail'}` },
    h('div', { class: 'run-assert__head' }, badge({ status: r.pass ? 'passed' : 'failed' }), h('strong', r.label)),
    h('dl', { class: 'run-assert__facts' },
      h('div', h('dt', 'Expected'), h('dd', { class: 'gym-mono' }, r.expected)),
      h('div', h('dt', 'Observed'), h('dd', { class: 'gym-mono' }, r.observed))))));
}
