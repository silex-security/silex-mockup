import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse, evaluate, identifiers, check, EXPR_VARS } from '../js/expr.js';

test('expr: parses the documented grammar', () => {
  for (const s of ['amount > 500 && channel == "email"', '!a.b', 'a.b.c > 1', '(amount > 5 || eligible < 3) && trust == "untrusted"', 'dayTotal >= 1000', 'x != "y"']) {
    const r = parse(s);
    assert.ok(r.ok, `${s}: ${JSON.stringify(r.error)}`);
  }
});

test('expr: evaluates comparisons and logic', () => {
  const ast = parse('amount > 500 && channel == "email"').value;
  assert.equal(evaluate(ast, { amount: 900, channel: 'email' }).value, true);
  assert.equal(evaluate(ast, { amount: 100, channel: 'email' }).value, false);
  assert.equal(evaluate(ast, { amount: 900, channel: 'chat' }).value, false);
});

test('expr: rejects syntax and type errors with positions', () => {
  assert.equal(parse('').error.code, 'expr_syntax');
  assert.equal(parse('amount >').error.code, 'expr_syntax');
  assert.equal(parse('1 + 2').error.code, 'expr_syntax'); // no '+'
  const cmp = parse('amount > "x"').value;
  assert.equal(evaluate(cmp, { amount: 5 }).error.code, 'expr_type');
  assert.equal(evaluate(parse('amount && 5').value, { amount: true }).error.code, 'expr_type');
});

test('expr: identifiers returns root identifiers; check enforces EXPR_VARS', () => {
  assert.deepEqual(identifiers(parse('a.b > 1 && c == 2').value), ['a', 'c']);
  assert.equal(check('amount > 5').ok, true);
  assert.equal(check('amount > 5 && nope').error.code, 'expr_unknown_identifier');
  assert.equal(check('amount > 5 && dayTotal < 10').ok, true);
});

test('expr: no eval / Function in source', () => {
  const src = readExprSource();
  assert.ok(!/\beval\s*\(/.test(src), 'no eval(');
  assert.ok(!/\bnew\s+Function\s*\(/.test(src), 'no new Function(');
  assert.ok(!/Function\s*\(/.test(src), 'no Function(');
});

function readExprSource() {
  return readFileSync(new URL('../js/expr.js', import.meta.url), 'utf8');
}
