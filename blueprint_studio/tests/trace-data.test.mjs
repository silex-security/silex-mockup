import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildSlice } from '../tools/ontology-slice.mjs';
import { STEP_CLASS, FAMILIES, publicUrl } from '../web/src/trace/mapping.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const slice = JSON.parse(readFileSync(new URL('../ontology/slice.json', import.meta.url)));
const ontology = JSON.parse(readFileSync(new URL('../../swm/data/ontology.json', import.meta.url)));
const tpl = name => JSON.parse(readFileSync(new URL(`../templates/${name}.json`, import.meta.url)));

test('slice: --check passes and a fresh build is byte-identical', () => {
  execFileSync(process.execPath, [join(HERE, '..', 'tools', 'ontology-slice.mjs'), '--check'], { stdio: 'pipe' });
  assert.deepEqual(buildSlice(ontology), slice);
});

test('slice: 13 classes, all links Silex-authored, version swm-1.0', () => {
  assert.equal(slice.version, 'swm-1.0');
  assert.equal(slice.classes.length, 13);
  assert.ok(slice.classes.every(c => c.layer === 3));
  assert.ok(slice.links.length > 0);
  assert.ok(slice.links.every(l => l.pred === 'THREATENS' && l.src === 'silex'));
  assert.equal(new Set(slice.classes.map(c => c.id)).size, 13);
});

test('mapping: every mapped class id and related threat id exists in the slice', () => {
  const classIds = new Set(slice.classes.map(c => c.id));
  const threatIds = new Set(slice.threats.map(t => t.id));
  for (const node of [
    { type: 'agent', config: {} },
    { type: 'tool', config: { sideEffect: 'write' } },
    { type: 'control', config: { kind: 'human_approval' } },
    { type: 'control', config: { kind: 'policy_gate' } },
    { type: 'outcome', config: {} },
    { type: 'prohibited', config: {} },
  ]) assert.ok(classIds.has(STEP_CLASS(node).classId), `class ${STEP_CLASS(node).classId} in slice`);
  for (const fam of FAMILIES) for (const r of fam.related) assert.ok(threatIds.has(r.threatId), `${r.threatId} in slice`);
});

test('mapping: Customer Refund counterexamples are unmapped', () => {
  const g = tpl('customer-refund').graph;
  const byId = id => g.nodes.find(n => n.id === id);
  for (const id of ['profile', 'credentials']) assert.equal(STEP_CLASS(byId(id)).classId, null, `${id} data unmapped`);
  assert.equal(STEP_CLASS(byId('request')).classId, null, 'trigger unmapped');
  assert.equal(STEP_CLASS(byId('gate')).classId, null, 'decision unmapped');
  assert.equal(STEP_CLASS(byId('payment')).classId, 'ag:tool-reg');
  assert.equal(STEP_CLASS(byId('approval')).classId, 'ag:hitl');
  assert.equal(STEP_CLASS(byId('triage')).classId, 'ag:planner');
});

test('mapping: duplicate_submit has no related threat and AML.T0086 is absent', () => {
  assert.deepEqual(FAMILIES.find(f => f.id === 'duplicate_submit').related, []);
  assert.deepEqual(FAMILIES.find(f => f.id === 'benign').related, []);
  const all = FAMILIES.flatMap(f => f.related.map(r => r.threatId));
  assert.ok(!all.includes('atlas:AML.T0086'));
  assert.equal(new Set(all).size, 6);
});

test('publicUrl: derives the official page from the id', () => {
  assert.equal(publicUrl('atlas:AML.T0051'), 'https://atlas.mitre.org/techniques/AML.T0051');
  assert.equal(publicUrl('owasp:LLM06'), 'https://genai.owasp.org/llm-top-10/');
  assert.equal(publicUrl('owaspa:T2'), 'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/');
  assert.equal(publicUrl('ag:tool-reg'), null);
  assert.equal(publicUrl(null), null);
});
