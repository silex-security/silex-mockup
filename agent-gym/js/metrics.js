// Baseline/variant comparison, computed only from executions that match the attempt's plan, one per plan item.
// Only a completed attempt can read pass, fail or regression; queued, running, cancelled and failed are inconclusive.
import { pairId, uniqueIds } from './model.js';

const SCORED = ['passed', 'failed'];
const GUARDED_VIOLATIONS = ['approval', 'opt_out', 'duplicate'];

const violationCounts = execution => Object.fromEntries(GUARDED_VIOLATIONS.map(k =>
  [k, execution.finalState.violations.filter(v => v.kind === k).length]));

function judgePair(baseline, variant) {
  const bPass = baseline.terminalState === 'passed';
  const vPass = variant.terminalState === 'passed';
  const bViolations = violationCounts(baseline);
  const vViolations = violationCounts(variant);
  const newViolations = GUARDED_VIOLATIONS.filter(k => vViolations[k] > bViolations[k]);
  const deltas = [
    ...variant.assertionResults.filter(a => a.pass !== baseline.assertionResults.find(b => b.id === a.id)?.pass)
      .map(a => `${a.label}: ${a.pass ? 'fail → pass' : 'pass → fail'}`),
    ...newViolations.map(k => `new ${k} violation`),
  ];
  const kind = (bPass && !vPass) || newViolations.length ? 'regressed' : !bPass && vPass ? 'improved' : 'same';
  return { kind, deltas };
}

const tally = list => ({ pass: list.filter(e => e.terminalState === 'passed').length, total: list.length });

/** @returns {import('./model.js').Comparison} */
export function compareAttempt(attempt, executions) {
  const same = (a, b) => a.versionId === b.versionId && a.scenarioId === b.scenarioId && a.repeatIndex === b.repeatIndex;
  const counted = attempt.plan.map(item => executions.find(e => same(e, item))).filter(Boolean);
  const scored = counted.filter(e => SCORED.includes(e.terminalState));
  const find = (item, versionId) => scored.find(e => e.versionId === versionId && pairId(e) === pairId(item));
  const planned = uniqueIds(attempt.plan.map(pairId)).map(id => attempt.plan.find(p => pairId(p) === id));

  const pairs = [];
  const missingPairs = [];
  for (const item of planned) {
    const baseline = find(item, 'baseline');
    const variant = find(item, 'variant');
    if (!baseline || !variant) { missingPairs.push(pairId(item)); continue; }
    pairs.push({ pairId: pairId(item), scenarioId: item.scenarioId, repeatIndex: item.repeatIndex, ...judgePair(baseline, variant) });
  }

  const byVersion = versionId => scored.filter(e => e.versionId === versionId);
  const scenarioIds = uniqueIds(attempt.plan.map(p => p.scenarioId));
  const byScenario = scenarioIds.map(scenarioId => {
    const mine = pairs.filter(p => p.scenarioId === scenarioId);
    return {
      scenarioId,
      title: attempt.inputSnapshot.scenarios.find(s => s.id === scenarioId)?.title ?? scenarioId,
      baseline: tally(byVersion('baseline').filter(e => e.scenarioId === scenarioId)),
      variant: tally(byVersion('variant').filter(e => e.scenarioId === scenarioId)),
      improved: mine.filter(p => p.kind === 'improved').length,
      regressed: mine.filter(p => p.kind === 'regressed').length,
    };
  });

  const improvedPairs = pairs.filter(p => p.kind === 'improved').length;
  const regressedPairs = pairs.filter(p => p.kind === 'regressed').length;
  const complete = missingPairs.length === 0 && attempt.status === 'completed' && !counted.some(e => e.terminalState === 'error');
  const variantTotals = tally(byVersion('variant'));
  return {
    expectedPairs: planned.length,
    completePairs: pairs.length,
    missingPairs,
    totals: { baseline: tally(byVersion('baseline')), variant: variantTotals },
    byScenario,
    pairs,
    improvedPairs,
    regressedPairs,
    verdict: !complete ? 'inconclusive' : regressedPairs > 0 ? 'regression' : variantTotals.pass < variantTotals.total ? 'fail' : 'pass',
  };
}
