import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { runScenario } from '../js/engine.js';
import { evaluateMonitors } from '../js/monitors.js';

const dir = new URL('./fixtures/semantics/', import.meta.url);
const fixtures = readdirSync(dir).filter(f => f.endsWith('.json')).sort()
  .map(f => JSON.parse(readFileSync(new URL(f, dir))));

for (const fx of fixtures) {
  test(`monitors: ${fx.name}`, () => {
    const session = runScenario(fx.graph, fx.scenario);
    const results = evaluateMonitors(fx.graph, session);
    const violations = {};
    for (const r of results) violations[r.node] = r.violations.map(v => v.activation);
    assert.deepEqual(violations, fx.expect.violations, `${fx.name}: violations`);
  });
}

test('monitors: one result per prohibited node, ordered by id', () => {
  const fx = fixtures.find(f => f.name === 'split-no-approval');
  const session = runScenario(fx.graph, fx.scenario);
  const results = evaluateMonitors(fx.graph, session);
  const ids = results.map(r => r.node);
  assert.deepEqual(ids, ids.slice().sort());
  assert.deepEqual(results.map(r => r.monitor), ['unauthorized_write', 'duplicate_effect']);
});
