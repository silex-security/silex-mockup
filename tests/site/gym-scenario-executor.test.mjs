// Every scenario the N3 builder can produce runs through the scripted executor for both versions (plan 8.3, 13.1
// item 4). A run must end in a terminal state with its assertions evaluated. The base and the four default prompt
// variations expect "draft and ask", "clarify", "keep approval" and "cancel", so they pass on both versions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TERMINAL_STATE, refKey } from '../../agent-gym/js/model.js';
import { seedState } from '../../agent-gym/js/fixtures/index.js';
import { runExecution } from '../../agent-gym/js/simulation/executor.js';
import { DEFAULT_ENVIRONMENT, contextOf, draftIdFor, ensureDraft } from '../../agent-gym/js/scenario/draft.js';
import { INTENSITIES, PROMPT_TYPE_IDS, TYPES_BY_DIMENSION, generateVariations } from '../../agent-gym/js/scenario/generate.js';
import { confirmScenario, saveScenarioSet } from '../../agent-gym/js/scenario/review.js';
import { SAMPLE_TRACE, baseFromTrace, blueprintRequirements } from '../../agent-gym/js/scenario/sources.js';

const ID = draftIdFor(DEFAULT_ENVIRONMENT);
const must = r => { if (r.error) throw Error(`${r.error.code}: ${r.error.message}`); return r.state; };

function runBoth(state, environmentRef, workflowRef, scenario) {
  const workflow = state.workflows[refKey(workflowRef)];
  const variant = Object.values(state.variants).find(v => v.workflowRef.id === workflow.id);
  const snapshot = { workflow, variant, environment: state.environments[refKey(environmentRef)], scenarios: [scenario], repetitions: 1 };
  return ['baseline', 'variant'].map(versionId => runExecution(snapshot, { id: `${scenario.id}#1:${versionId}`, versionId, scenarioId: scenario.id, repeatIndex: 1 }, 29));
}

const asScenario = (spec, id) => ({ id, rev: '1', title: spec.title ?? spec.label, source: spec.source ?? { kind: 'chat', label: 'test' }, baseId: null, variation: spec.dimension ? { dimension: spec.dimension, type: spec.type, label: spec.label } : null, reviewState: 'reviewed', badge: spec.badge ?? null, ...spec });

function assertRan(executions, label) {
  for (const e of executions) {
    assert.ok(TERMINAL_STATE.includes(e.terminalState) && e.terminalState !== 'error', `${label} ${e.versionId}: ${e.terminalState} ${JSON.stringify(e.events.at(-1))}`);
    assert.ok(e.assertionResults.length > 0, `${label} ${e.versionId}: assertions evaluated`);
    assert.ok(e.assertionResults.some(a => a.id === 'expected-outcome'), `${label} ${e.versionId}: expected outcome evaluated`);
  }
}

test('the saved five-scenario set passes on both versions', () => {
  let s = must(ensureDraft(seedState(), { environmentRef: DEFAULT_ENVIRONMENT }));
  for (const item of s.scenarioDrafts[ID].items.filter(i => i.badge === 'review')) s = must(confirmScenario(s, { draftId: ID, key: item.id }));
  s = must(saveScenarioSet(s, { draftId: ID }));
  const set = s.scenarioSets[refKey(s.scenarioDrafts[ID].lastSavedSetRef)];
  assert.equal(set.scenarioRefs.length, 5);
  for (const ref of set.scenarioRefs) {
    const scenario = s.scenarios[refKey(ref)];
    const runs = runBoth(s, set.environmentRef, set.workflowRef, scenario);
    assertRan(runs, scenario.title);
    for (const e of runs) assert.equal(e.terminalState, 'passed', `${scenario.title} ${e.versionId}: ${e.assertionResults.filter(a => !a.pass).map(a => a.observed).join('; ')}`);
  }
});

test('every prompt type, intensity and example the generator can give runs to a terminal state, and prompt items pass', () => {
  const s = must(ensureDraft(seedState(), { environmentRef: DEFAULT_ENVIRONMENT }));
  const draft = s.scenarioDrafts[ID];
  let runs = 0;
  for (const { id: intensity } of INTENSITIES) for (const type of PROMPT_TYPE_IDS) {
    const { items, problem } = generateVariations(draft.base, [type], 20, intensity, 0, contextOf(s, draft));
    assert.equal(problem, null);
    items.forEach((item, n) => {
      const executions = runBoth(s, draft.environmentRef, draft.workflowRef, asScenario(item, `${type}-${intensity}-${n}`));
      assertRan(executions, `${type} ${intensity} #${n}`);
      for (const e of executions) assert.equal(e.terminalState, 'passed', `${type} ${intensity} #${n} ${e.versionId}`);
      runs += 2;
    });
  }
  assert.equal(runs, INTENSITIES.length * PROMPT_TYPE_IDS.length * 20 * 2);
});

test('each overlay example runs on every workflow and environment it supports', () => {
  const s = seedState();
  const pairs = [[{ id: 'env-sales', rev: '1.2' }, 'wf-sales-follow-up'], [{ id: 'env-sales', rev: '1.2' }, 'wf-meeting-scheduling'], [{ id: 'env-support', rev: '1.2' }, 'wf-support-triage']];
  let ran = 0;
  for (const [environmentRef, workflowId] of pairs) {
    const workflowRef = { id: workflowId, rev: '1' };
    const ctx = { environment: s.environments[refKey(environmentRef)], workflow: s.workflows[refKey(workflowRef)] };
    const requirements = blueprintRequirements(ctx.workflow);
    for (const req of requirements) assertRan(runBoth(s, environmentRef, workflowRef, asScenario({ ...req.spec, overrides: [] }, req.id)), `${workflowId} blueprint ${req.id}`);
    // Overlays vary a base whose guard still says Yes; a guard requirement already skips the act step.
    for (const req of requirements.filter(r => !r.id.startsWith('guard:'))) {
      const base = { ...req.spec, overrides: [] };
      for (const dimension of ['tool_failure', 'permission', 'data_state']) {
        const { items, problem } = generateVariations(base, TYPES_BY_DIMENSION[dimension], 1, 'moderate', 0, ctx);
        if (problem) { assert.match(problem.message, /no timeout_after_send hook/, `${workflowId} ${dimension}: ${problem.message}`); continue; }
        const executions = runBoth(s, environmentRef, workflowRef, asScenario(items[0], `${req.id}-${dimension}`));
        assertRan(executions, `${workflowId} ${dimension}`);
        ran += 1;
        if (dimension !== 'tool_failure') for (const e of executions) assert.equal(e.terminalState, 'passed', `${workflowId} ${dimension} ${e.versionId}: ${e.assertionResults.filter(a => !a.pass).map(a => a.observed).join('; ')}`);
      }
    }
  }
  assert.ok(ran >= 7, `${ran} overlay examples ran`);
});

test('the sample trace base runs and passes on both versions', () => {
  const s = seedState();
  const runs = runBoth(s, DEFAULT_ENVIRONMENT, { id: 'wf-sales-follow-up', rev: '1' }, asScenario({ ...baseFromTrace(SAMPLE_TRACE), overrides: [] }, 'trace'));
  assertRan(runs, 'trace');
  for (const e of runs) assert.equal(e.terminalState, 'passed');
});
