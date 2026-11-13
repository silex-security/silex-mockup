import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { conditionText, evidenceText, criteriaText, ruleForms, summary, failExample, passExample, mountLearnedRules } from '../../js/rt-learned-rules.js';

const DATA = JSON.parse(readFileSync(new URL('../../jev-runtime/demo/data/learned-rules.json', import.meta.url), 'utf8'));
const sortKeys = v => (Array.isArray(v)
  ? v.map(sortKeys)
  : v && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sortKeys(v[k])]))
    : v);
const normal = condition => JSON.stringify(sortKeys(condition));

test('conditionText turns a condition into plain words', () => {
  assert.equal(
    conditionText({ left: { add: [{ fact: 'invoice_paid_to_date_usd' }, { fact: 'amount_usd' }] }, op: 'gt', right: { fact: 'invoice_amount_usd' } }),
    'money already paid on the invoice + this payment > the invoice amount',
  );
  assert.equal(
    conditionText({ all: [{ left: { fact: 'a_fact' }, op: 'ge', right: { const: 0 } }, { left: { fact: 'amount_usd' }, op: 'ne', right: { const: 5 } }] }),
    'a_fact ≥ 0 and this payment ≠ 5',
  );
  assert.equal(
    conditionText({ any: [{ left: { fact: 'amount_usd' }, op: 'lt', right: { const: 10 } }, { left: { fact: 'invoice_amount_usd' }, op: 'eq', right: { const: 0 } }] }),
    'this payment < 10 or the invoice amount = 0',
  );
});

test('evidenceText states both sets', () => {
  assert.equal(
    evidenceText({ dev: { violations: 4, caught: 4, benign: 11, false_flags: 0 }, holdout: { violations: 6, caught: 6, benign: 8, false_flags: 0 } }),
    'Caught 4 of 4 known violations, flagged 0 of 11 normal payments. On the held-back set: 6 of 6, 0 of 8.',
  );
});

test('ruleForms groups equal conditions and orders passing forms first', () => {
  const pass = { kind: 'x', left: { fact: 'a' }, op: 'gt', right: { const: 1 } };
  const reordered = { left: { fact: 'a' }, op: 'gt', right: { const: 1 }, kind: 'x' };
  const reportPass = { verdict: 'PASS', dev: { violations: 2, caught: 2, benign: 4, false_flags: 0 }, holdout: { violations: 2, caught: 2, benign: 3, false_flags: 0 }, failed_criteria: [] };
  const data = {
    rules: [
      { ordinal: 1, condition: { left: { fact: 'paid' }, op: 'ge', right: { fact: 'total' } }, verdict_on_match: 'BLOCK', report: { verdict: 'FAIL', dev: { violations: 2, caught: 0, benign: 4, false_flags: 0 }, holdout: { violations: 2, caught: 1, benign: 3, false_flags: 0 }, failed_criteria: [3, 5] } },
      { ordinal: 2, condition: pass, verdict_on_match: 'BLOCK', report: reportPass },
      { ordinal: 3, condition: reordered, verdict_on_match: 'BLOCK', report: reportPass },
    ],
  };
  const forms = ruleForms(data);
  assert.equal(forms.length, 2);
  assert.equal(forms[0].verdict, 'PASS');
  assert.equal(forms[0].count, 2);
  assert.equal(forms[0].first, 2);
  assert.equal(forms[1].verdict, 'FAIL');
  assert.equal(forms[1].count, 1);
});

test('summary on the real file agrees with the file itself', () => {
  const s = summary(DATA);
  const passed = DATA.rules.filter(r => r.report.verdict === 'PASS').length;
  const failed = DATA.rules.filter(r => r.report.verdict === 'FAIL').length;
  assert.equal(s.passed, passed);
  assert.equal(s.failed, failed);
  assert.equal(s.candidates, DATA.rules.length);
  assert.equal(s.passed + s.failed, s.candidates);
  assert.equal(s.forms, new Set(DATA.rules.map(r => normal(r.condition))).size);
  assert.ok(s.sameWayFailed >= 1 && s.sameWayFailed <= s.failed);
});

test('passExample and failExample name real forms', () => {
  const pass = passExample(DATA);
  const fail = failExample(DATA);
  assert.equal(pass.verdict, 'PASS');
  assert.equal(fail.verdict, 'FAIL');
  const sameEvidence = ruleForms(DATA).filter(f => f.verdict === 'FAIL'
    && JSON.stringify(f.dev) === JSON.stringify(fail.dev)
    && JSON.stringify(f.holdout) === JSON.stringify(fail.holdout)
    && JSON.stringify(f.failed_criteria) === JSON.stringify(fail.failed_criteria));
  assert.equal(fail.count, Math.max(...sameEvidence.map(f => f.count)));
});

test('mountLearnedRules is safe on missing input and renders every form', () => {
  assert.doesNotThrow(() => mountLearnedRules(null, DATA));
  assert.doesNotThrow(() => mountLearnedRules({}, {}));
  const el = { innerHTML: '' };
  mountLearnedRules(el, DATA);
  assert.ok(el.innerHTML.includes('data-rt-rules-note'));
  assert.equal(el.innerHTML.split('data-rt-rules-form').length - 1, ruleForms(DATA).length);
  assert.ok(el.innerHTML.includes('No proposed rule was put into a live policy.'));
});

test('criteriaText returns the listed sentences and nothing else', () => {
  assert.equal(criteriaText(3), 'It catches every violation in the held-back set.');
  assert.equal(criteriaText(9), '');
});
