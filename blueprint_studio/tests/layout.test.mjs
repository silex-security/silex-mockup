import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { layout } from '../js/layout.js';

const tpl = name => JSON.parse(readFileSync(new URL(`../templates/${name}.json`, import.meta.url)));

test('layout: no overlaps and flow runs left->right', () => {
  for (const name of ['customer-refund', 'vendor-bank-change']) {
    const graph = tpl(name).graph;
    const pos = layout(graph);
    const keys = Object.keys(pos);
    const seen = new Set();
    for (const k of keys) {
      const key = `${pos[k].x},${pos[k].y}`;
      assert.ok(!seen.has(key), `${name}: ${k} overlaps`);
      seen.add(key);
    }
    for (const e of graph.edges.filter(e => e.kind === 'flow')) {
      const a = pos[e.from.node], b = pos[e.to.node];
      assert.ok(a.x < b.x, `${name}: edge ${e.id} runs right-to-left`);
    }
  }
});
