// The experiment queue's view model: one row per experiment, the stage tabs and the summary cards. Pure: every value
// is read from GymState through selectors.js, and nothing here stores a stage or a count.
import { refKey } from '../model.js';
import { OBJECTIVES } from '../metrics.js';
import { STAGES, attemptProgress, experimentOutcome, experimentResultSummary, experimentStage, stageAttempt } from '../selectors.js';
import { queuePosition } from '../runs/facts.js';

export const STAGE_LABEL = Object.freeze({ pending: 'Pending', queued: 'Queued', running: 'Running', needs_review: 'Needs review', done: 'Done' });

// The row button for each stage: its label and the route it opens. Stages whose target is an attempt need one.
const STAGE_ACTION = Object.freeze({
  pending: { label: 'Configure', route: 'workbench' },
  queued: { label: 'View', route: 'workbench' },
  running: { label: 'Open', route: 'run-detail' },
  needs_review: { label: 'Review', route: 'results' },
  done: { label: 'Results', route: 'results' },
});

const actionFor = (stage, experimentId, attempt) => {
  const { label, route } = STAGE_ACTION[stage];
  return { label, route, params: route === 'workbench' ? { experimentId } : { experimentId, attemptId: attempt.id } };
};

// "Last activity" is the newest thing that happened to the experiment. The simulation keeps no wall-clock time, so a
// review shows the date it was recorded and anything else shows the revision or attempt it is at.
const activityOf = (exp, attempt) => attempt?.review ? `Reviewed ${attempt.review.reviewedAt.slice(0, 10)}`
  : attempt ? attempt.label : `Draft rev ${exp.draftRevision}`;

function rowOf(state, exp) {
  const attempt = stageAttempt(state, exp.id);
  const stage = experimentStage(state, exp.id);
  return {
    id: exp.id, number: exp.number, title: exp.title, workflowName: state.workflows[refKey(exp.workflowRef)].name, source: exp.source,
    objective: { id: exp.objective, label: OBJECTIVES[exp.objective].label }, stage, stageLabel: STAGE_LABEL[stage],
    progress: stage === 'running' ? attemptProgress(state, attempt.id) : null,
    waiting: stage === 'queued' ? queuePosition(state, attempt.id) : null,
    result: experimentResultSummary(state, exp.id), outcome: experimentOutcome(state, exp.id),
    activity: activityOf(exp, attempt), action: actionFor(stage, exp.id, attempt),
  };
}

const matches = (row, q) => {
  const needle = q.trim().toLowerCase();
  return !needle || [row.title, row.id, row.workflowName, row.source.label].some(t => t.toLowerCase().includes(needle));
};

/** @param {{ status?: 'all'|string, q?: string }} query  @returns the tabs with whole-queue counts and the rows that pass both filters */
export function queueView(state, { status = 'all', q = '' }) {
  const all = Object.values(state.experiments).sort((a, b) => b.number - a.number).map(exp => rowOf(state, exp));
  const counts = { all: all.length, ...Object.fromEntries(STAGES.map(s => [s, all.filter(r => r.stage === s).length])) };
  return {
    counts,
    tabs: [{ id: 'all', label: 'All', count: counts.all }, ...STAGES.map(id => ({ id, label: STAGE_LABEL[id], count: counts[id] }))],
    rows: all.filter(r => (status === 'all' || r.stage === status) && matches(r, q)),
  };
}

const CARD_DETAIL = {
  pending: (rows, n) => n ? `${n} to configure and run` : 'Nothing waiting to be configured',
  queued: (rows, n) => n ? `Waiting for the runner: ${rows[0].title}${n > 1 ? ` and ${n - 1} more` : ''}` : 'Nothing waiting for the runner',
  running: rows => rows[0] ? `${rows[0].title} · ${rows[0].progress.text} runs` : 'No attempt is running',
  needs_review: (rows, n) => n ? `${rows[0].title}${n > 1 ? ` and ${n - 1} more` : ''} awaiting a decision` : 'No finished attempt awaits a decision',
};

/** The four cards above the table: Pending, Queued, Running and Needs review. */
export function queueSummary(state) {
  const { rows } = queueView(state, {});
  return Object.keys(CARD_DETAIL).map(id => {
    const mine = rows.filter(r => r.stage === id);
    return { id, label: STAGE_LABEL[id], count: mine.length, detail: CARD_DETAIL[id](mine, mine.length) };
  });
}
