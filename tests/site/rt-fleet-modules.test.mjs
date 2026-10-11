// T0 of logs/2026-10-10_AGENT_FLEET_VISUAL_PLAN.md: the three Agent-fleet modules import under Node (no DOM at module
// top level), and fleetModel's new fields hold the shared contract the three coders build on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fleetModel } from '../../js/rt-fleet.js';
import { mountX1 } from '../../js/rt-fleet-x1.js';
import { mountMap } from '../../js/rt-fleet-map.js';
import { mountGrid } from '../../js/rt-fleet-grid.js';
import { scenarioById } from '../../jev-runtime/demo/js/engine/scenarios.js';

test('the three mount modules import under Node and export their mount functions', () => {
  for (const fn of [mountX1, mountMap, mountGrid]) assert.equal(typeof fn, 'function');
});

test('fleetModel: x1 carries the evidence triples of the rule that fired', () => {
  const m = fleetModel();
  assert.deepEqual(m.x1.map(x => x.id), ['X1Pb', 'X1Cb', 'X1Bb']);
  assert.deepEqual(m.x1.map(x => x.on.decision), ['HOLD', 'BLOCK', 'BLOCK']);
  assert.ok(m.x1.every(x => !x.off.stopped));
  for (const x of m.x1) {
    const preds = x.on.triples.map(t => t.p);
    assert.ok(preds.includes('FEATURES') && preds.includes('EXCLUDES'), `${x.id}: ${preds}`);
    assert.ok(x.on.triples.every(t => ['declared', 'observed', 'inferred'].includes(t.grade)));
  }
  assert.ok(m.x1[0].on.triples.some(t => t.p === 'SYNCS_TO' && t.o === 'pool:ad-candidates'));
});

test('fleetModel: dots match the queues by construction', () => {
  const m = fleetModel();
  assert.equal(m.dots.length, m.queues.on.total);
  const byTeam = {};
  for (const d of m.dots) byTeam[d.team] = (byTeam[d.team] ?? 0) + 1;
  assert.deepEqual(byTeam, m.queues.on.byTeam);
  assert.ok(m.dots.every(d => d.rule && d.scenario.endsWith('b')));
});

test('fleetModel: an 11-row matrix whose ▶ ids exist and whose cells cover all 22 traces', () => {
  const m = fleetModel();
  assert.deepEqual(m.matrix.map(r => r.key), ['TR1', 'TR2', 'CS1', 'CS2', 'CR1', 'CR2', 'SD1', 'SD2', 'X1P', 'X1C', 'X1B']);
  const ids = m.matrix.flatMap(r => [r.a.id, r.b.id]);
  assert.equal(new Set(ids).size, 22);
  for (const r of m.matrix) {
    assert.equal(r.play, r.b.id);
    assert.ok(scenarioById(r.play), `${r.play} is a real scenario`);
    for (const v of [r.a, r.b]) assert.ok(v.on.length >= 1 && v.on.length === v.off.length, r.key);
  }
  assert.deepEqual(m.matrix.find(r => r.key === 'SD2').b.on.map(c => c.decision), ['ALLOW', 'ALLOW', 'HOLD']);
});
