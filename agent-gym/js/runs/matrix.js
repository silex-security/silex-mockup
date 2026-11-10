// Scenario × version matrix for one attempt: every plan item with its state, grouped per cell. Pure.
import { versionLabel } from './facts.js';

/** Execution keys live in the route query, so they use only query-safe characters. */
export const executionKey = ({ scenarioId, repeatIndex, versionId }) => `${scenarioId},${repeatIndex},${versionId}`;

export function parseExecutionKey(key) {
  const m = /^(.+),(\d+),(baseline|variant)$/.exec(key ?? '');
  return m ? { scenarioId: m[1], repeatIndex: Number(m[2]), versionId: m[3] } : null;
}

export const findExecution = (executions, key) => {
  const want = parseExecutionKey(key);
  return want ? executions.find(e => executionKey(e) === executionKey(want)) ?? null : null;
};

const STATES = ['passed', 'failed', 'error', 'cancelled', 'running', 'pending'];

/** A plan item without an execution is cancelled (attempt cancelled), running (the runner's next item) or pending. */
function itemState(attempt, execution, index) {
  if (execution) return execution.terminalState;
  if (attempt.status === 'cancelled') return 'cancelled';
  return index === attempt.cursor && attempt.status === 'running' && attempt.runner === 'active' ? 'running' : 'pending';
}

export function cellSummary(counts) {
  const done = counts.passed + counts.failed + counts.error;
  const total = STATES.reduce((n, s) => n + counts[s], 0);
  if (done === total) return `${counts.passed}/${total} passed`;
  return [['passed', 'passed'], ['failed', 'failed'], ['error', 'error'], ['cancelled', 'cancelled'], ['running', 'running'], ['pending', 'pending']]
    .filter(([s]) => counts[s] > 0).map(([s, word]) => `${counts[s]} ${word}`).join(' · ');
}

export function matrixView(attempt, executions) {
  const snap = attempt.inputSnapshot;
  const byKey = new Map(executions.map(e => [executionKey(e), e]));
  const versions = (snap.variant ? ['baseline', 'variant'] : ['baseline']).map(id => ({ id, label: versionLabel(snap, id) }));
  const items = attempt.plan.map((item, index) => {
    const key = executionKey(item);
    const execution = byKey.get(key) ?? null;
    return { ...item, key, state: itemState(attempt, execution, index), hasExecution: !!execution };
  });
  const rows = snap.scenarios.map(s => ({
    scenarioId: s.id, title: s.title,
    cells: versions.map(v => {
      const reps = items.filter(i => i.scenarioId === s.id && i.versionId === v.id)
        .map(i => ({ key: i.key, repeatIndex: i.repeatIndex, state: i.state, hasExecution: i.hasExecution }));
      const counts = Object.fromEntries(STATES.map(st => [st, reps.filter(r => r.state === st).length]));
      return { versionId: v.id, label: v.label, cellKey: `${s.id},${v.id}`, reps, counts, summary: cellSummary(counts) };
    }),
  }));
  return { versions, rows };
}

/** The execution shown when the query names none: the first failed one, else the first one. Stable while the run grows. */
export function defaultExecutionKey(executions) {
  const pick = executions.find(e => e.terminalState === 'failed' || e.terminalState === 'error') ?? executions[0];
  return pick ? executionKey(pick) : null;
}
