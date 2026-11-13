// The workbench's shared-agent panel: which other workflows the changed agents also work in, the state of each one's
// impact run, and the one button that runs the check. Every value comes from runs/impact.js and selectors.js.
import { h } from '../components/dom.js';
import { badge, button } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { impactCheckState, impactRunCount, impactRuns, sharedAgentImpact } from '../runs/impact.js';
import { experimentSummary } from '../selectors.js';

const STATE = {
  not_run: { label: 'Not run', tone: 'gray' },
  queued: { label: 'Queued', tone: 'gray' },
  running: { label: 'Running', tone: 'violet' },
  done: { label: 'Done', tone: 'green' },
  not_comparable: { label: 'Not comparable', tone: 'amber' },
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The chip next to a changed step in the What changes strip, or null when its agent works nowhere else. */
export function sharedChip(state, experimentId, agentId) {
  const agent = sharedAgentImpact(state, experimentId).agents.find(a => a.agentId === agentId);
  return agent && badge({
    label: `Shared · ${plural(agent.workflows.length, 'other workflow')}`, tone: 'violet', class: 'wb-chip-shared',
    title: `${agent.name} also works in ${agent.workflows.map(w => w.name).join(', ')}`,
  });
}

function resultCell(row, router, experimentId) {
  if (row.state === 'not_comparable') return h('span', { class: 'wb-impact__reason' }, row.reason);
  if (row.state === 'done') {
    return h('span', { class: 'wb-impact__result' }, h('span', { class: `wb-impact__line wb-impact__line--${row.tone}` }, row.resultText),
      h('a', { href: router.href('results', { experimentId, attemptId: row.attemptId }), dataset: { focusKey: `wb:impact:results:${row.workflowId}` } }, 'View results'));
  }
  if (row.state === 'queued' || row.state === 'running') {
    return h('span', { class: 'wb-impact__result' }, h('span', { class: 'wb-impact__line' }, `${row.progress.text} runs`),
      h('a', { href: router.href('run-detail', { experimentId, attemptId: row.attemptId }), dataset: { focusKey: `wb:impact:run:${row.workflowId}` } }, 'Open run'));
  }
  return h('span', { class: 'gym-muted' }, row.note ?? 'No check yet');
}

export function impactPanel({ state, exp, router, onCheck, flash }) {
  if (!exp.variantId) return null;
  const { agents } = sharedAgentImpact(state, exp.id);
  if (!agents.length) {
    return h('section', { class: 'gym-panel wb-impact wb-impact--none', 'aria-label': 'Shared agents' },
      h('p', { class: 'wb-impact__empty' }, icon('check-circle', { size: 18 }), 'No shared agent: the agents this variant changes work in no other workflow.'));
  }
  const rows = impactRuns(state, exp.id);
  const check = impactCheckState(state, exp.id);
  const own = experimentSummary(state, exp.id).runs;
  return h('section', { class: 'gym-panel wb-impact', 'aria-labelledby': 'wb-impact-title' },
    h('header', { class: 'wb-impact__head' },
      h('h2', { class: 'wb-impact__title', id: 'wb-impact-title' }, 'Shared agents'),
      badge({ label: plural(rows.length, 'other workflow'), tone: 'violet' })),
    h('p', { class: 'wb-impact__lead' }, 'A change to an agent reaches every workflow it works in. The check runs each of those workflows with the same field changes, over its own scenarios, and compares it with itself.'),
    h('ul', { class: 'wb-impact__agents', 'aria-label': 'Changed agents' }, agents.map(a => h('li', { dataset: { agent: a.agentId } },
      h('strong', a.name), ' changes ', a.changedFields.map((f, i) => [i > 0 && ', ', h('code', f)])))),
    h('div', { class: 'wb-impact__wrap' }, h('table', { class: 'dt wb-impact__table' },
      h('thead', h('tr', ['Workflow', 'Agent and steps', 'Check', 'Result'].map(c => h('th', { scope: 'col' }, c)))),
      h('tbody', rows.map(row => h('tr', { dataset: { workflow: row.workflowId, state: row.state } },
        h('th', { scope: 'row' }, row.name),
        h('td', h('span', { class: 'wb-impact__steps' }, `${row.agentNames.join(', ')}: ${row.steps.join(', ')}`)),
        h('td', badge({ label: STATE[row.state].label, tone: row.state === 'done' && row.tone === 'red' ? 'red' : STATE[row.state].tone, dot: true })),
        h('td', resultCell(row, router, exp.id))))))),
    h('div', { class: 'wb-impact__foot' },
      button({ label: 'Check shared workflows', variant: 'primary', icon: 'shield', focusKey: 'wb:impact-check', class: 'wb-impact__go', disabled: !check.canRun, reason: check.reason, onClick: onCheck }),
      h('span', { class: 'wb-impact__count', dataset: { impactRuns: String(impactRunCount(state, exp.id)) } },
        `${plural(impactRunCount(state, exp.id), 'check run')}, counted apart from this experiment's ${plural(own, 'run')}`),
      !check.canRun && check.reason && h('span', { class: 'wb-impact__why' }, check.reason),
      // "Queued N checks" stops being true once they finish; the rows then carry the result.
      flash && (flash.tone !== 'success' || rows.some(r => r.state === 'queued' || r.state === 'running')) && h('p', { class: `wb-flash wb-flash--${flash.tone}`, role: 'status' }, flash.text)));
}
