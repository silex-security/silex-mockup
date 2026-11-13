// logs/2026-11-12_LEARNED_RULES_PLAN.md §4: what the public learned-rules.json must hold (I1 to I5), and, when
// JEV_UPSTREAM names the pinned upstream checkout, that the generator reproduces the file byte for byte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, serialize } from '../../tools/build-learned-rules.mjs';

const FILE = resolve(dirname(fileURLToPath(import.meta.url)), '../../jev-runtime/demo/data/learned-rules.json');
const text = readFileSync(FILE, 'utf8');
const data = JSON.parse(text);
const SPLITS = ['dev', 'holdout'];

test('I1: every candidate passed the first gate, and the sessions cover them', () => {
  assert.equal(data.first_gate.passed, data.rules.length);
  assert.equal(data.sessions.with_candidate, data.rules.length);
  assert.ok(data.sessions.total >= data.rules.length);
  assert.notEqual(data.first_gate.criteria_version, data.gate.criteria_version);
});

test('I2: the verdict and the failed criteria follow from the counts', () => {
  for (const { ordinal, report: r } of data.rules) {
    const expected = [
      r.holdout.caught < r.holdout.violations && 3,
      (r.dev.false_flags > 0 || r.holdout.false_flags > 0) && 4,
      r.dev.caught < r.dev.violations && 5,
    ].filter(Boolean);
    assert.deepEqual(r.failed_criteria, expected, `rule ${ordinal}: failed criteria`);
    assert.equal(r.verdict, expected.length ? 'FAIL' : 'PASS', `rule ${ordinal}: verdict`);
    for (const s of SPLITS) assert.ok(r[s].violations >= 1 && r[s].benign >= 3, `rule ${ordinal}: ${s} is populated`);
  }
});

test('I3: equal conditions carry equal evidence', () => {
  const seen = new Map();
  for (const { ordinal, condition, verdict_on_match, report } of data.rules) {
    const key = JSON.stringify(condition), value = JSON.stringify({ verdict_on_match, report });
    if (seen.has(key)) assert.equal(value, seen.get(key), `rule ${ordinal}`);
    else seen.set(key, value);
  }
});

test('I4: every report covers the whole test set', () => {
  for (const { ordinal, report } of data.rules)
    for (const s of SPLITS) assert.equal(report[s].violations + report[s].benign, data.gate.corpus[s], `rule ${ordinal}: ${s}`);
});

test('I5: no item id, model name or model text is in the public file', () => {
  const keys = new Set(), strings = [];
  (function walk(v) {
    if (typeof v === 'string') strings.push(v);
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (!Array.isArray(v)) keys.add(k); walk(x); }
  })(data);
  for (const k of ['items', 'description', 'rationale', 'response_text', 'facts', 'proposer', 'model']) assert.ok(!keys.has(k), `key ${k}`);
  for (const s of strings) {
    assert.doesNotMatch(s, /\b(OP-[DH]\d+|[SF]\d+\/pay)/, 'item id');
    assert.doesNotMatch(s, /deepseek|gemini|agy/i, 'model vendor');
  }
});

const upstream = process.env.JEV_UPSTREAM;
test('the generator reproduces the file byte for byte (skipped without JEV_UPSTREAM, so skipped in CI)', { skip: !upstream }, () => {
  assert.equal(serialize(build(resolve(upstream))), text);
});
