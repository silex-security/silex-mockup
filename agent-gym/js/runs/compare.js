// Results-page view model over metrics.compareAttempt output. Pure; no number here is typed in.
import { pairId } from '../model.js';
import { versionLabel } from './facts.js';

export const pairKey = ({ scenarioId, repeatIndex }) => `${scenarioId},${repeatIndex}`;

export function parsePairKey(key) {
  const m = /^(.+),(\d+)$/.exec(key ?? '');
  return m ? { scenarioId: m[1], repeatIndex: Number(m[2]) } : null;
}

const fromPairId = id => { const i = id.lastIndexOf('#'); return { scenarioId: id.slice(0, i), repeatIndex: Number(id.slice(i + 1)) }; };
const titleOf = (attempt, scenarioId) => attempt.inputSnapshot.scenarios.find(s => s.id === scenarioId)?.title ?? scenarioId;
const pairName = (attempt, p) => `${titleOf(attempt, p.scenarioId)} · repetition ${p.repeatIndex}`;

/** Both sides of one planned pair, or null when the key names no planned pair. A side that has not run is null. */
export function pairSides(attempt, executions, key, comparison) {
  const want = parsePairKey(key);
  if (!want || !attempt.plan.some(p => pairKey(p) === pairKey(want))) return null;
  const side = versionId => executions.find(e => e.versionId === versionId && pairKey(e) === pairKey(want)) ?? null;
  return {
    ...want, key: pairKey(want), name: pairName(attempt, want),
    baseline: side('baseline'), variant: side('variant'),
    baselineLabel: versionLabel(attempt.inputSnapshot, 'baseline'), variantLabel: versionLabel(attempt.inputSnapshot, 'variant'),
    judged: comparison.pairs.find(p => p.pairId === pairId(want)) ?? null,
  };
}

/** Opens on the most telling pair: a regression, else an improvement, else the first complete pair. */
export function defaultPairKey(comparison) {
  const pick = comparison.pairs.find(p => p.kind === 'regressed') ?? comparison.pairs.find(p => p.kind === 'improved') ?? comparison.pairs[0];
  return pick ? pairKey(pick) : null;
}

export const VERDICT = Object.freeze({
  pass: { label: 'Pass', tone: 'green' },
  fail: { label: 'Fail', tone: 'red' },
  regression: { label: 'Regression', tone: 'red' },
  inconclusive: { label: 'Inconclusive', tone: 'amber' },
});

export function verdictReason(attempt, comparison, executions) {
  const { expectedPairs: all, completePairs: done } = comparison;
  if (comparison.verdict === 'pass') return `All ${all} pairs are complete and none regressed.`;
  if (comparison.verdict === 'fail') {
    const { pass, total } = comparison.totals.variant;
    return `All ${all} pairs are complete and none regressed, but ${total - pass} of ${total} variant runs still fail.`;
  }
  if (comparison.verdict === 'regression') return `${comparison.regressedPairs} of ${all} pairs regressed.`;
  if (attempt.status === 'queued' || attempt.status === 'running') return `This attempt is still ${attempt.status}. ${done} of ${all} pairs are complete.`;
  if (attempt.status === 'failed') return `The simulation could not run this attempt to the end, so it stopped as failed. ${done} of ${all} pairs are complete.`;
  if (attempt.status === 'cancelled') return `This attempt was cancelled. ${done} of ${all} pairs are complete; the rest never ran.`;
  if (executions.some(e => e.terminalState === 'error')) return 'An execution ended in a simulation error, so the comparison cannot pass.';
  return `${done} of ${all} pairs are complete.`;
}

/** Regressed pairs, pairs where the variant still fails, and pairs that never completed. */
export function unresolvedItems(attempt, comparison, executions) {
  const variantFails = p => executions.some(e => e.versionId === 'variant' && pairKey(e) === pairKey(p) && e.terminalState !== 'passed');
  return [
    ...comparison.pairs.filter(p => p.kind === 'regressed')
      .map(p => ({ kind: 'regressed', key: pairKey(p), name: pairName(attempt, p), text: p.deltas.join('; ') || 'Baseline passed and the variant failed' })),
    ...comparison.pairs.filter(p => p.kind === 'same' && variantFails(p))
      .map(p => ({ kind: 'still_failing', key: pairKey(p), name: pairName(attempt, p), text: 'Both versions fail this pair' })),
    ...comparison.missingPairs.map(fromPairId)
      .map(p => ({ kind: 'missing', key: pairKey(p), name: pairName(attempt, p), text: 'No complete baseline and variant pair' })),
  ];
}
