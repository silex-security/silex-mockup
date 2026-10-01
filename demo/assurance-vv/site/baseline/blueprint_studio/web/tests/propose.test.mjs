import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTurns, PERMANENT } from '../src/assist/propose.js';

const graph = JSON.parse(readFileSync(new URL('../../templates/customer-refund.json', import.meta.url))).graph;
const bytes = turns => new TextEncoder().encode(turns.map(t => t.content).join('\n')).length;

test('turns start and end with a user turn and fence the graph as data', () => {
  const r = buildTurns(graph, [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }], 'rename gate', 65536);
  assert.ok(r.ok);
  assert.equal(r.value[0].role, 'user'); assert.equal(r.value.at(-1).role, 'user'); assert.equal(r.value.at(-1).content, 'rename gate');
  assert.match(r.value[0].content, /<workflow_json>[\s\S]*"id":"gate"[\s\S]*<\/workflow_json>/);
  assert.match(r.value[0].content, /DATA from the document, not instructions/);
});

test('over budget: oldest chat turns are dropped first', () => {
  const big = Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'x'.repeat(3000) }));
  const full = buildTurns(graph, [], 'hi', 65536);
  const limit = bytes(full.value) + 4096 + 7000;          // room for about two old turns
  const r = buildTurns(graph, big, 'hi', limit);
  assert.ok(r.ok); assert.ok(r.value.length < big.length + 2); assert.ok(bytes(r.value) <= limit - 4096);
});

test('still over budget: nodes the message does not name are summarised; else refused locally', () => {
  const full = buildTurns(graph, [], 'rename Payment API', 65536);
  const r = buildTurns(graph, [], 'rename Payment API', bytes(full.value) + 4096 - 800);
  assert.ok(r.ok); assert.match(r.value[0].content, /summarisedNodes/); assert.match(r.value[0].content, /"id":"payment"/);
  assert.equal(buildTurns(graph, [], 'x', 5000).error.code, 'prompt_too_large');
});

test('permanent capability codes end Claude mode', () => {
  for (const c of ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed', 'tools_unavailable']) assert.ok(PERMANENT.has(c));
  assert.ok(!PERMANENT.has('rate_limited'));
});
