// Read models for the scenario library: every saved set revision, which changed conditions it covers, and where the
// behaviour held when it last ran. Pure.
import { VARIATION_DIMENSION, refKey, sameRef } from '../model.js';
import { attemptProgress, comparisonFor } from '../selectors.js';
import { DIMENSIONS } from './generate.js';
import { scenarioSetDetail } from './selectors.js';

const OVERRIDE_DIMENSION = { fault: 'tool_failure', permission: 'permission', data: 'data_state' };
const GAP_NOUN = { prompt: 'prompt', tool_failure: 'tool failure', permission: 'permission', data_state: 'data or state' };
const LIVE = ['queued', 'running'];

/**
 * The condition dimensions one scenario varies: its generated variation, the kind of each override, and a patched
 * initial state. A fixture scenario without a variation still counts through its overrides or patch.
 */
export const scenarioDimensions = s => VARIATION_DIMENSION.filter(d => s.variation?.dimension === d
  || s.overrides.some(o => OVERRIDE_DIMENSION[o.kind] === d)
  || (d === 'data_state' && Object.keys(s.initialState.patch ?? {}).length > 0));

/** Per dimension, how many scenarios of the set vary it. A dimension no scenario varies is a gap. */
export function setCoverage(scenarios) {
  const dims = scenarios.map(scenarioDimensions);
  return VARIATION_DIMENSION.map(dimension => {
    const scenarioIds = scenarios.filter((_, i) => dims[i].includes(dimension)).map(s => s.id);
    return {
      dimension, label: DIMENSIONS.find(d => d.id === dimension).label, icon: DIMENSIONS.find(d => d.id === dimension).icon,
      count: scenarioIds.length, scenarioIds, gap: scenarioIds.length === 0, gapText: `No ${GAP_NOUN[dimension]} scenario`,
    };
  });
}

/**
 * Evidence for one set revision from the attempts that froze it. `completed` is the latest completed attempt with
 * per-scenario baseline and variant pass counts; `live` is a queued or running attempt still producing evidence.
 */
export function setEvidence(state, ref, scenarios) {
  const runs = state.attemptOrder.map(id => state.attempts[id]).filter(a => sameRef(a.inputSnapshot.scenarioSet, ref));
  const done = runs.filter(a => a.status === 'completed').at(-1);
  const live = runs.find(a => LIVE.includes(a.status));
  const comparison = done && comparisonFor(state, done.id);
  return {
    completed: done ? {
      attemptId: done.id, experimentId: done.experimentId, title: done.title, label: done.label, verdict: comparison.verdict,
      rows: scenarios.map(s => {
        const row = comparison.byScenario.find(r => r.scenarioId === s.id);
        return row ? { scenarioId: s.id, title: s.title, inRun: true, baseline: row.baseline, variant: row.variant, regressed: row.regressed, improved: row.improved }
          : { scenarioId: s.id, title: s.title, inRun: false };
      }),
    } : null,
    live: live ? { attemptId: live.id, experimentId: live.experimentId, title: live.title, status: live.status, progress: attemptProgress(state, live.id).text } : null,
  };
}

/** Library cards: sets the given experiment uses come first, then the rest newest first. */
export function scenarioLibrary(state, { query = '', experimentId } = {}) {
  const q = query.trim().toLowerCase();
  const cards = Object.values(state.scenarioSets).reverse().map(set => {
    const ref = { id: set.id, rev: set.rev };
    const detail = scenarioSetDetail(state, ref);
    const reviewed = detail.scenarios.filter(s => s.reviewState === 'reviewed').length;
    return {
      key: refKey(ref), ref, name: set.name, rev: set.rev, digest: set.digest,
      environmentRef: set.environmentRef, workflowRef: set.workflowRef, environmentName: detail.environmentName, workflowName: detail.workflowName,
      count: detail.scenarios.length, reviewed, allReviewed: reviewed === detail.scenarios.length,
      usedBy: detail.usedBy.map(id => ({ id, title: state.experiments[id].title })),
      coverage: setCoverage(detail.scenarios), evidence: setEvidence(state, ref, detail.scenarios),
      visible: !q || [set.name, detail.environmentName, detail.workflowName, ...detail.scenarios.map(s => s.title)].some(t => t.toLowerCase().includes(q)),
    };
  });
  return [...cards.filter(c => c.usedBy.some(u => u.id === experimentId)), ...cards.filter(c => !c.usedBy.some(u => u.id === experimentId))];
}
