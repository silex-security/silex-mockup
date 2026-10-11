// logs/2026-10-11_RT_SUBTABS_VISUAL_PLAN.md, shared contract 3: the sub-tab bar and the three picture modules import under
// Node (no DOM at module top level), and every mount returns the full handle even without an element.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mountSubnav, requestSub } from '../../js/rt-subnav.js';
import { mountLoop, mountLearningResults } from '../../js/rt-learning-visual.js';
import { VERDICT, mountOntoHow, mountOntoS1 } from '../../js/rt-onto-visual.js';
import { mountOntoRun } from '../../js/rt-onto-run.js';

const HANDLE = ['play', 'pause', 'reset', 'destroy'];

test('picture modules import without a DOM and return full handles for a missing element', () => {
  assert.equal(typeof mountSubnav, 'function');
  assert.equal(typeof requestSub, 'function');
  assert.doesNotThrow(() => requestSub('fleet', 'routing'));
  for (const h of [mountLoop(null), mountLearningResults(null, { evidence: {} }), mountOntoHow(null, {}), mountOntoS1(null, {})]) {
    for (const k of HANDLE) assert.equal(typeof h[k], 'function', k);
    assert.doesNotThrow(() => { h.play(); h.pause(); h.reset(); h.destroy(); });
  }
  const run = mountOntoRun(null, {});
  for (const k of [...HANDLE, 'update']) assert.equal(typeof run[k], 'function', k);
  assert.deepEqual(Object.keys(VERDICT).sort(), ['inconclusive', 'not supported', 'supported']);
});
