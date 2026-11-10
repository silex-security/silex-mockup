// The Configure, Run, Review steps: which one is current for a route, and which have a target for an experiment's stage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedState } from '../../agent-gym/js/fixtures/index.js';
import { experimentSteps } from '../../agent-gym/js/experiments/steps.js';

const here = (name, params = {}) => ({ name, params, query: {} });
const brief = steps => steps.map(s => [s.id, s.state, s.target?.route ?? null]);

test('a pending experiment on its workbench: Configure is current, Run and Review have no target and say why', () => {
  const steps = experimentSteps(seedState(), 'exp-030', here('workbench', { experimentId: 'exp-030' }));
  assert.deepEqual(brief(steps), [['configure', 'current', 'workbench'], ['run', 'upcoming', null], ['review', 'upcoming', null]]);
  assert.match(steps[1].reason, /Run the simulation from the workbench first/);
  assert.match(steps[2].reason, /Nothing has run yet/);
  assert.equal(steps[0].reason, null);
});

test('on the run detail of a running attempt: Run is current, Configure is done, and Review waits for the run to finish', () => {
  const steps = experimentSteps(seedState(), 'exp-029', here('run-detail', { experimentId: 'exp-029', attemptId: 'attempt-002' }));
  assert.deepEqual(brief(steps), [['configure', 'done', 'workbench'], ['run', 'current', 'run-detail'], ['review', 'upcoming', null]]);
  assert.equal(steps[1].detail, '12 of 18 done');
  assert.match(steps[2].reason, /12 of 18 executions finished/);
});

test('on the results of a reviewed experiment: Review is current with the recorded decision, and both earlier steps link', () => {
  const steps = experimentSteps(seedState(), 'exp-025', here('results', { experimentId: 'exp-025', attemptId: 'attempt-005' }));
  assert.deepEqual(brief(steps), [['configure', 'done', 'workbench'], ['run', 'done', 'run-detail'], ['review', 'current', 'results']]);
  assert.equal(steps[2].detail, 'Reject');
  assert.deepEqual(steps[1].target.params, { experimentId: 'exp-025', attemptId: 'attempt-005' });
});

test('from the workbench of a finished experiment, Run and Review link to its latest attempt', () => {
  const steps = experimentSteps(seedState(), 'exp-027', here('workbench', { experimentId: 'exp-027' }));
  assert.deepEqual(brief(steps), [['configure', 'current', 'workbench'], ['run', 'upcoming', 'run-detail'], ['review', 'upcoming', 'results']]);
  assert.equal(steps[2].detail, null, 'not decided yet');
});

test('a queued attempt can be opened but not reviewed', () => {
  const steps = experimentSteps(seedState(), 'exp-028', here('workbench', { experimentId: 'exp-028' }));
  assert.deepEqual(brief(steps), [['configure', 'current', 'workbench'], ['run', 'upcoming', 'run-detail'], ['review', 'upcoming', null]]);
  assert.match(steps[2].reason, /queue/);
});
