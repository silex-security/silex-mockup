// Run list, run detail and results view models (plan 4.5, 8.2, 8.4, 9.1, 9.2; 13.1 items 9 to 11).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedState } from '../../agent-gym/js/fixtures/index.js';
import { advanceAttempt, cancelAttempt, pauseAttempt } from '../../agent-gym/js/simulation/attempts.js';
import { comparisonFor } from '../../agent-gym/js/selectors.js';
import { attemptFacts, planFormula, queuePosition, resolveAttempt } from '../../agent-gym/js/runs/facts.js';
import { defaultExecutionKey, executionKey, findExecution, matrixView, parseExecutionKey } from '../../agent-gym/js/runs/matrix.js';
import { initialCursor, replayFrame, replayReducer } from '../../agent-gym/js/runs/replay.js';
import { defaultPairKey, pairSides, parsePairKey, unresolvedItems, verdictReason } from '../../agent-gym/js/runs/compare.js';

const SALES = 'attempt-002';
const ok = r => { assert.ok(r.state, JSON.stringify(r.error)); return r.state; };
const advance = (s, id, times) => { for (let i = 0; i < times; i++) s = ok(advanceAttempt(s, { attemptId: id })); return s; };
const finish = (s, id) => { while (s.attempts[id].status !== 'completed') s = advance(s, id, 1); return s; };
const QUERY_VALUE = /^[A-Za-z0-9][A-Za-z0-9._@,-]{0,127}$/;

test('the plan formula and attempt facts come from the frozen snapshot', () => {
  const s = seedState();
  assert.equal(planFormula(2, 3, 3), '2 versions × 3 scenarios × 3 repetitions = 18 runs');
  assert.equal(planFormula(1, 1, 1), '1 version × 1 scenario × 1 repetition = 1 run');
  const f = attemptFacts(s, SALES);
  assert.equal(f.formula, '2 versions × 3 scenarios × 3 repetitions = 18 runs');
  assert.equal(f.planSize, 18);
  assert.deepEqual([f.progress.done, f.progress.total], [12, 18]);
  assert.deepEqual([f.environment.name, f.environment.rev, f.scenarioSet.name, f.baselineName, f.variantName], ['Sales operations', '1.2', 'Follow-up resilience', 'Baseline', 'Variant A']);
  assert.equal(f.title, 'Sales follow-up · Variant A', 'the frozen title, not the renamed draft');
  assert.equal(s.experiments['exp-029'].title, 'Experiment 029');
  assert.equal(f.label, 'rev 3 · attempt 1');
  assert.equal(attemptFacts(s, 'attempt-003').formula, '2 versions × 8 scenarios × 3 repetitions = 48 runs');
});

test('a queued attempt knows its place behind the running attempt', () => {
  const s = seedState();
  assert.deepEqual(queuePosition(s, 'attempt-003'), { position: 1, of: 1, behind: 'Sales follow-up · Variant A' });
  assert.equal(queuePosition(s, SALES), null);
});

test('an attempt resolves only under its own experiment', () => {
  const s = seedState();
  assert.equal(resolveAttempt(s, { experimentId: 'exp-029', attemptId: SALES }).kind, 'found');
  assert.equal(resolveAttempt(s, { experimentId: 'exp-029', attemptId: 'attempt-001' }).kind, 'mismatch');
  assert.equal(resolveAttempt(s, { experimentId: 'exp-029', attemptId: 'attempt-999' }).kind, 'missing');
});

test('the matrix at 12 of 18: two scenarios finished, the third waits with its first item running', () => {
  const s = seedState();
  const m = matrixView(s.attempts[SALES], s.executions[SALES]);
  assert.deepEqual(m.versions.map(v => v.label), ['Baseline', 'Variant A']);
  assert.deepEqual(m.rows.map(r => r.title), ['Base case', 'Timeout after send', 'Contact opted out']);
  assert.deepEqual(m.rows.map(r => r.cells.map(c => c.summary)), [
    ['3/3 passed', '3/3 passed'],
    ['0/3 passed', '3/3 passed'],
    ['1 running · 2 pending', '3 pending'],
  ]);
  assert.deepEqual(m.rows[2].cells[0].reps.map(r => [r.repeatIndex, r.state, r.hasExecution]), [[1, 'running', false], [2, 'pending', false], [3, 'pending', false]]);

  const paused = ok(pauseAttempt(s, { attemptId: SALES }));
  assert.equal(matrixView(paused.attempts[SALES], paused.executions[SALES]).rows[2].cells[0].summary, '3 pending', 'a paused runner runs nothing');
  const cancelled = ok(cancelAttempt(s, { attemptId: SALES }));
  const cm = matrixView(cancelled.attempts[SALES], cancelled.executions[SALES]);
  assert.deepEqual(cm.rows.map(r => r.cells.map(c => c.summary)), [['3/3 passed', '3/3 passed'], ['0/3 passed', '3/3 passed'], ['3 cancelled', '3 cancelled']]);
});

test('execution keys are query-safe and round-trip; the default selection is the first failure', () => {
  const s = seedState();
  const execs = s.executions[SALES];
  for (const e of execs) {
    const key = executionKey(e);
    assert.match(key, QUERY_VALUE);
    assert.equal(findExecution(execs, key), e);
  }
  assert.deepEqual(parseExecutionKey('sc-timeout-after-send,2,variant'), { scenarioId: 'sc-timeout-after-send', repeatIndex: 2, versionId: 'variant' });
  assert.equal(parseExecutionKey('sc-x,2,other'), null);
  assert.equal(findExecution(execs, 'sc-contact-opted-out,1,baseline'), null, 'a key for an item that has not run finds nothing');
  assert.equal(defaultExecutionKey(execs), 'sc-timeout-after-send,1,baseline');
  assert.equal(defaultExecutionKey([]), null);
});

test('the replay cursor plays, steps, seeks and replays inside the recorded events', () => {
  const total = 9;
  let c = initialCursor(total);
  assert.deepEqual(c, { position: 9, playing: false }, 'opens on the full trace');
  c = replayReducer(c, { type: 'play' }, total);
  assert.deepEqual(c, { position: 0, playing: true }, 'play at the end starts over');
  c = replayReducer(c, { type: 'tick' }, total);
  c = replayReducer(c, { type: 'tick' }, total);
  assert.deepEqual(c, { position: 2, playing: true });
  c = replayReducer(c, { type: 'pause' }, total);
  assert.deepEqual(replayReducer(c, { type: 'tick' }, total), { position: 3, playing: false }, 'a stray tick after pause does not restart play');
  assert.deepEqual(replayReducer(c, { type: 'step' }, total), { position: 3, playing: false });
  assert.deepEqual(replayReducer(c, { type: 'back' }, total), { position: 1, playing: false });
  assert.deepEqual(replayReducer(c, { type: 'seek', position: 40 }, total), { position: 9, playing: false });
  assert.deepEqual(replayReducer(c, { type: 'seek', position: -3 }, total), { position: 0, playing: false });
  assert.deepEqual(replayReducer({ position: 8, playing: true }, { type: 'tick' }, total), { position: 9, playing: false }, 'play stops at the last event');
  assert.deepEqual(replayReducer(c, { type: 'replay' }, total), { position: 0, playing: true });
  assert.deepEqual(replayReducer(initialCursor(0), { type: 'play' }, 0), { position: 0, playing: false });
});

test('a replay frame of the baseline timeout run walks the blueprint and flags the timeout at Send email', () => {
  const s = finish(seedState(), SALES);
  const e = findExecution(s.executions[SALES], 'sc-timeout-after-send,1,baseline');
  const full = replayFrame(e.events, e.events.length);
  assert.deepEqual(full.path, ['find-opportunity', 'draft-email', 'contact-allowed', 'send-email', 'update-crm']);
  assert.ok(full.edges.has('contact-allowed>send-email') && !full.edges.has('contact-allowed>log-skipped'));
  assert.deepEqual([...full.flags['send-email']], ['timeout']);
  assert.equal(full.activeNodeId, 'update-crm');
  const start = replayFrame(e.events, 1);
  assert.equal(start.current.type, 'approval');
  assert.equal(start.activeNodeId, null, 'the scripted approval belongs to no node');
  assert.equal(start.visited.size, 0);
  assert.equal(replayFrame(e.events, 0).current, null);
});

test('the completed sales attempt compares 6/9 and 9/9 with 3 improved and 0 regressed, and opens the timeout pair', () => {
  const s = finish(seedState(), SALES);
  const a = s.attempts[SALES];
  const c = comparisonFor(s, SALES);
  assert.deepEqual([c.totals.baseline, c.totals.variant, c.completePairs, c.expectedPairs, c.improvedPairs, c.regressedPairs, c.verdict],
    [{ pass: 6, total: 9 }, { pass: 9, total: 9 }, 9, 9, 3, 0, 'pass']);
  assert.equal(verdictReason(a, c, s.executions[SALES]), 'All 9 pairs are complete and none regressed.');
  assert.equal(defaultPairKey(c), 'sc-timeout-after-send,1');
  const pair = pairSides(a, s.executions[SALES], 'sc-timeout-after-send,1', c);
  assert.equal(pair.name, 'Timeout after send · repetition 1');
  assert.equal(pair.baseline.finalState.outbox.length, 2, 'blind retry with a new key sends twice');
  assert.equal(pair.variant.finalState.outbox.length, 1, 'status check with key reuse sends once');
  assert.equal(pair.judged.kind, 'improved');
  assert.equal(pairSides(a, s.executions[SALES], 'sc-timeout-after-send,9', c), null);
  assert.equal(pairSides(a, s.executions[SALES], 'nonsense', c), null);
  assert.deepEqual(parsePairKey('sc-base-case,3'), { scenarioId: 'sc-base-case', repeatIndex: 3 });
  assert.deepEqual(unresolvedItems(a, c, s.executions[SALES]), [], 'every variant pair passes and none is missing');
});

test('a running or cancelled attempt is inconclusive and lists the pairs that never completed', () => {
  const s = seedState();
  const running = comparisonFor(s, SALES);
  assert.equal(running.verdict, 'inconclusive');
  assert.equal(verdictReason(s.attempts[SALES], running, s.executions[SALES]), 'This attempt is still running. 6 of 9 pairs are complete.');

  const half = ok(cancelAttempt(advance(s, SALES, 1), { attemptId: SALES }));
  const c = comparisonFor(half, SALES);
  assert.equal(c.verdict, 'inconclusive');
  assert.equal(half.executions[SALES].length, 13, 'finished executions are kept');
  assert.equal(verdictReason(half.attempts[SALES], c, half.executions[SALES]), 'This attempt was cancelled. 6 of 9 pairs are complete; the rest never ran.');
  const items = unresolvedItems(half.attempts[SALES], c, half.executions[SALES]);
  assert.deepEqual(items.map(i => [i.kind, i.name]), [
    ['missing', 'Contact opted out · repetition 1'], ['missing', 'Contact opted out · repetition 2'], ['missing', 'Contact opted out · repetition 3'],
  ]);
  const pair = pairSides(half.attempts[SALES], half.executions[SALES], 'sc-contact-opted-out,1', c);
  assert.ok(pair.baseline && !pair.variant && !pair.judged, 'a half-run pair shows the side that ran and no judgement');
});
