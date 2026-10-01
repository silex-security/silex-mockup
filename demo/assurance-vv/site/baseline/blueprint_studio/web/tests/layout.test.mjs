/* layoutGraph follows graph.direction (plan §3.12): every flow edge advances
   along x in LR and along y in TB, for every template; boxes never overlap. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyPatch } from '../../js/model.js';
import { layoutGraph, directionOps, dirOf, sizeOf } from '../src/builder/layout.js';

const index = JSON.parse(readFileSync(new URL('../../templates/index.json', import.meta.url)));
const tpl = id => JSON.parse(readFileSync(new URL(`../../templates/${id}.json`, import.meta.url)));

test('dirOf: LR only when stated; anything else is TB', () => {
  assert.equal(dirOf({ direction: 'LR' }), 'LR');
  for (const g of [{}, { direction: 'TB' }, { direction: 'x' }, null]) assert.equal(dirOf(g), 'TB');
});

for (const dir of ['LR', 'TB']) test(`layoutGraph ${dir}: flow advances along the main axis, no overlap, every template`, () => {
  for (const id of index.order) {
    const g = { ...tpl(id).graph, direction: dir }, pos = layoutGraph(g);
    const box = n => ({ ...pos[n.id], ...sizeOf(n) });
    for (const e of g.edges.filter(e => e.kind === 'flow')) {
      const a = box(g.nodes.find(n => n.id === e.from.node)), b = box(g.nodes.find(n => n.id === e.to.node));
      if (dir === 'LR') assert.ok(b.x >= a.x + a.width, `${id} ${e.id}: ${b.x} < ${a.x + a.width}`);
      else assert.ok(b.y >= a.y + a.height, `${id} ${e.id}: ${b.y} < ${a.y + a.height}`);
    }
    const bs = g.nodes.map(box);
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const p = bs[i], q = bs[j];
      assert.ok(p.x + p.width <= q.x || q.x + q.width <= p.x || p.y + p.height <= q.y || q.y + q.height <= p.y, `${id}: ${g.nodes[i].id} overlaps ${g.nodes[j].id}`);
    }
  }
});

test('directionOps: one patch switches direction and lays out in it', () => {
  const g = { ...tpl('customer-refund').graph, direction: 'LR' };
  const ops = directionOps(g, 'TB');
  assert.equal(ops[0].op, 'setDirection'); assert.ok(ops.slice(1).every(o => o.op === 'moveNode'));
  const r = applyPatch(g, ops); assert.ok(r.ok);
  assert.equal(r.value.direction, 'TB');
  const tb = layoutGraph({ ...g, direction: 'TB' });
  for (const n of r.value.nodes) assert.deepEqual({ x: n.x, y: n.y }, tb[n.id]);
});
