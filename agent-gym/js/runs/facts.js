// Attempt facts for the run list, run detail and results headers. Pure: every value comes from GymState.
import { executionCount } from '../model.js';
import { attemptProgress } from '../selectors.js';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const planFormula = (versions, scenarios, repetitions) =>
  `${plural(versions, 'version')} × ${plural(scenarios, 'scenario')} × ${plural(repetitions, 'repetition')} = ${plural(executionCount(versions, scenarios, repetitions), 'run')}`;

export const isLive = attempt => attempt.status === 'queued' || attempt.status === 'running';

export const REVIEW_LABEL = Object.freeze({ pass_for_demo: 'Pass for demo', needs_iteration: 'Needs iteration', reject: 'Reject' });

export const versionLabel = (snapshot, versionId) => versionId === 'variant' ? snapshot.variant?.name ?? 'Variant' : 'Baseline';

/** The attempt behind a run-detail or results URL. An attempt reached through another experiment's URL is a mismatch. */
export function resolveAttempt(state, { experimentId, attemptId }) {
  const attempt = state.attempts[attemptId];
  if (!attempt) return { kind: 'missing', attempt: null };
  return { kind: attempt.experimentId === experimentId ? 'found' : 'mismatch', attempt };
}

/** Where a queued attempt waits: 1-based among queued attempts, and the running attempt it waits behind. */
export function queuePosition(state, attemptId) {
  if (state.attempts[attemptId].status !== 'queued') return null;
  const ordered = state.attemptOrder.map(id => state.attempts[id]);
  const queued = ordered.filter(a => a.status === 'queued');
  return { position: queued.findIndex(a => a.id === attemptId) + 1, of: queued.length, behind: ordered.find(a => a.status === 'running')?.title ?? null };
}

export function attemptFacts(state, attemptId) {
  const attempt = state.attempts[attemptId];
  const snap = attempt.inputSnapshot;
  const versions = snap.variant ? 2 : 1;
  return {
    id: attempt.id, experimentId: attempt.experimentId, title: attempt.title, label: attempt.label,
    inputDigest: attempt.inputDigest, seed: attempt.seed, fixtureVersion: attempt.fixtureVersion,
    status: attempt.status, paused: isLive(attempt) && attempt.runner === 'paused', live: isLive(attempt),
    workflow: { name: snap.workflow.name, rev: snap.workflow.rev },
    environment: { name: snap.environment.name, rev: snap.environment.rev, icon: snap.environment.icon },
    scenarioSet: { name: snap.scenarioSet.name, rev: snap.scenarioSet.rev },
    baselineName: versionLabel(snap, 'baseline'), variantName: snap.variant ? versionLabel(snap, 'variant') : null,
    versions, scenarios: snap.scenarios.length, repetitions: snap.repetitions, planSize: attempt.plan.length,
    formula: planFormula(versions, snap.scenarios.length, snap.repetitions),
    progress: attemptProgress(state, attemptId), queue: queuePosition(state, attemptId), review: attempt.review,
  };
}
