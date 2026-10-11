// Scenario Expansion model (js/sx-model.js; logs/2026-10-11_SCENARIO_EXPANSION_PLAN.md, tests and acceptance).
// Pure: imports the module under Node. Expectations are recomputed from the model's own constants or written as named
// cases from the plan, never as typed-in totals.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  expand, expected, evaluate, compare, telemetry, trace, checks, keptEvents, isSubsequence, variantId, valuesOf, violations,
  execId, SEED, AXES, CONSTRAINTS, OUTCOMES, CLASSES, CAUSES, GRADE, ONTOLOGY_VERSION,
} from '../../js/sx-model.js';

const m = expand();
const byId = new Map(m.all.map(x => [x.id, x]));
const V = (role, approval, permission, sensitivity, logs) => byId.get(variantId({ role, approval, permission, sensitivity, logs }));

test('the funnel: every combination, pruned constraint by constraint', () => {
  assert.equal(m.all.length, AXES.reduce((n, a) => n * a.values.length, 1));
  assert.equal(new Set(m.all.map(x => x.id)).size, m.all.length, 'ids are unique');
  assert.deepEqual(Object.keys(m.removedBy), CONSTRAINTS.map(c => c.id));
  for (const c of CONSTRAINTS) assert.ok(m.removedBy[c.id] > 0, `${c.id} removes something`);
  assert.equal(Object.values(m.removedBy).reduce((a, b) => a + b, 0) + m.valid.length, m.all.length);
  for (const x of m.all) {
    assert.deepEqual(x.violates, violations(x.values));
    assert.equal(x.review, 'pending');
    if (x.violates.length) for (const f of ['expected', 'result', 'outcome', 'run']) assert.equal(x[f], null, `${x.id}.${f}`);
  }
  assert.ok(m.valid.every(x => x.violates.length === 0));
  assert.equal(m.valid.length, m.all.filter(x => !x.violates.length).length);
});

test('named cases from the plan', () => {
  const seed = byId.get(variantId(SEED.values));
  assert.equal(seed.outcome, 'caught', 'the seed is caught');
  const approved = V('analyst', 'approved', 'standing', 'confidential', 'complete');
  assert.equal(approved.expected.cls, 'approved');
  assert.equal(approved.outcome, 'false-alarm');
  const approvedNoAuth = V('analyst', 'approved', 'standing', 'confidential', 'no-auth');
  assert.equal(approvedNoAuth.outcome, 'surfaced', 'an alert under missing evidence is surfaced, not caught');
  assert.equal(approvedNoAuth.run.parent, approved.id);
  const svc = V('service', 'none', 'standing', 'confidential', 'complete');
  assert.equal(svc.outcome, 'missed');
  const denied = V('analyst', 'none', 'none', 'confidential', 'complete');
  assert.equal(denied.outcome, 'missed');
  const partial = V('analyst', 'none', 'standing', 'confidential', 'partial');
  assert.equal(partial.outcome, 'silent-gap');
  for (const s of ['public', 'confidential', 'restricted']) {
    assert.ok(V('analyst', 'approved', 'none', s, 'complete').violates.length, `approved with no grant is pruned (${s})`);
  }
  assert.deepEqual(V('analyst', 'approved', 'none', 'confidential', 'complete').violates, ['C5']);
  const finding = id => m.findings.find(f => f.variants.includes(id));
  assert.equal(finding(svc.id).cause, 'service-excluded');
  assert.equal(finding(denied.id).cause, 'denied-not-counted');
  assert.equal(finding(partial.id).cause, 'missing-logs');
  assert.equal(finding(approved.id).cause, 'approved-alerts');
  assert.equal(finding(approvedNoAuth.id), undefined, 'surfaced variants are not findings');
});

test('compare() covers all six outcomes and keeps the rule result apart', () => {
  const seen = new Set();
  for (const want of ['alert', 'quiet', 'escalate']) for (const got of ['alert', 'quiet']) seen.add(compare(want, got));
  assert.deepEqual([...seen].sort(), OUTCOMES.map(o => o.key).sort());
  for (const x of m.valid) {
    assert.equal(x.result.got, evaluate(x.values).got);
    assert.equal(x.outcome, compare(x.expected.want, x.result.got));
  }
  assert.deepEqual(Object.keys(m.byOutcome), OUTCOMES.map(o => o.key));
  assert.equal(Object.values(m.byOutcome).reduce((a, b) => a + b, 0), m.valid.length);
  assert.deepEqual(Object.keys(m.byClass), Object.keys(CLASSES));
  assert.equal(Object.values(m.byClass).reduce((a, b) => a + b, 0), m.valid.length);
  for (const x of m.valid) assert.deepEqual(x.expected, expected(x.values));
});

test('provenance: lab executions, context overlays and observation removal stay apart', () => {
  const execs = new Set(m.valid.map(x => execId(x.values)));
  assert.equal(m.labRuns.length, execs.size, 'one lab execution per distinct lab combination');
  assert.deepEqual(m.labRuns.map(r => r.exec), [...execs]);
  assert.equal(m.overlays + m.derivatives, m.valid.length);
  assert.equal(m.overlays, m.valid.filter(x => x.values.logs === 'complete').length);
  for (const x of m.valid) {
    assert.equal(x.run.exec, execId(x.values));
    assert.equal(x.run.context, x.values.approval);
    assert.equal(x.run.ablation, x.values.logs === 'complete' ? null : x.values.logs);
    if (x.run.ablation) {
      const parent = byId.get(x.run.parent);
      assert.ok(parent && !parent.violates.length, `${x.id} has a valid parent`);
      assert.equal(parent.values.logs, 'complete');
      assert.equal(parent.run.exec, x.run.exec);
      assert.equal(parent.run.context, x.run.context);
    } else assert.equal(x.run.parent, null);
  }
  // A context overlay reuses its execution's record: same lab combination and logs → identical telemetry.
  for (const x of m.valid) for (const y of m.valid) {
    if (x.run.exec === y.run.exec && x.values.logs === y.values.logs) assert.deepEqual(telemetry(x.values), telemetry(y.values));
  }
});

test('every result and finding carries its evidence grade and ontology version', () => {
  assert.equal(GRADE, 'simulated');
  for (const x of m.valid) {
    assert.equal(x.result.grade, GRADE);
    assert.equal(x.result.ontology, ONTOLOGY_VERSION);
    assert.equal(x.review, 'pending');
  }
  for (const f of m.findings) { assert.equal(f.grade, GRADE); assert.equal(f.ontology, ONTOLOGY_VERSION); assert.equal(f.review, 'pending'); }
});

test('findings: keyed by (kind, cause), covering every missed, false-alarm and silent-gap variant once', () => {
  const flagged = m.valid.filter(x => ['missed', 'false-alarm', 'silent-gap'].includes(x.outcome)).map(x => x.id);
  const members = m.findings.flatMap(f => f.variants);
  assert.equal(new Set(members).size, members.length, 'no variant in two findings');
  assert.deepEqual([...members].sort(), [...flagged].sort());
  assert.equal(new Set(m.findings.map(f => f.id)).size, m.findings.length);
  const causeOrder = CAUSES.map(c => c.key), kindOrder = OUTCOMES.map(o => o.key);
  const rank = f => causeOrder.indexOf(f.cause) * 100 + kindOrder.indexOf(f.kind);
  assert.deepEqual(m.findings.map(rank), [...m.findings.map(rank)].sort((a, b) => a - b), 'cause order, then outcome order');
  const order = new Map(m.all.map((x, i) => [x.id, i]));
  for (const f of m.findings) {
    for (const id of f.variants) assert.equal(byId.get(id).outcome, f.kind, `${id} outcome = ${f.kind}`);
    assert.equal(f.example, [...f.variants].sort((a, b) => order.get(a) - order.get(b))[0], 'example is the first in AXES order');
  }
  // The attribution order: refused reads, then the allowlist, then missing logs, then the approval the rule cannot see.
  for (const f of m.findings) for (const id of f.variants) {
    const x = byId.get(id).values;
    const want = x.permission === 'none' ? 'denied-not-counted' : x.role === 'service' ? 'service-excluded' : x.logs !== 'complete' ? 'missing-logs' : 'approved-alerts';
    assert.equal(f.cause, want, id);
  }
});

test('replay: a record replays to the same graph; removal only drops events from the parent', () => {
  for (const x of m.valid) {
    const a = trace(x.values), b = trace(x.values);
    assert.equal(a.digest, b.digest);
    assert.match(a.digest, /^[0-9a-f]{8}$/);
    const [replay, subset] = checks(x.values);
    assert.equal(replay.holds, true);
    if (x.run.parent) {
      assert.equal(subset.holds, true);
      assert.ok(isSubsequence(keptEvents(x.values), keptEvents(byId.get(x.run.parent).values)));
    } else assert.equal(subset.holds, null);
  }
  assert.equal(isSubsequence(['b', 'a'], ['a', 'b']), false, 'the subsequence check can fail');
  assert.throws(() => trace(V('analyst', 'approved', 'none', 'confidential', 'complete').values), /C5/);
  const steps = trace(SEED.values).steps;
  assert.deepEqual(steps.map(s => s.kind), ['state', 'state', 'state', 'state', 'event', 'event', 'event', 'check', 'verdict']);
  assert.equal(steps.find(s => s.nodes.includes('ticket')).source, 'context', 'approval is injected context');
});

test('ids round-trip', () => {
  for (const x of m.all) assert.deepEqual(valuesOf(x.id), x.values);
  assert.equal(valuesOf('v-nope'), null);
  assert.equal(valuesOf('v-analyst-none-standing-confidential-bogus'), null);
});
