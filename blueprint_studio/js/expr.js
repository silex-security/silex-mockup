/* Safe expression language (plan §4.2, contract §3).
   Grammar: or := and ('||' and)* ; and := not ('&&' not)* ; not := '!' not | cmp ;
   cmp := primary (('=='|'!='|'<'|'<='|'>'|'>=') primary)? ; primary := number | string
   | true | false | ident('.'ident)* | '(' or ')'.
   No eval, no Function. Returns the Result shape from model.js. */

import { ok, fail } from './model.js';

export const EXPR_VARS = ['amount', 'customer', 'order', 'channel', 'trust', 'eligible', 'dayTotal'];

/* ---------------------------------------------------------------- tokenizer */
function tokenize(src) {
  const toks = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
    if (c === '(') { toks.push({ type: 'lparen', pos: i++ }); continue; }
    if (c === ')') { toks.push({ type: 'rparen', pos: i++ }); continue; }
    if (c === '.') { toks.push({ type: 'dot', pos: i++ }); continue; }
    if (c === '!' && src[i + 1] === '=') { toks.push({ type: 'op', value: '!=', pos: i }); i += 2; continue; }
    if (c === '=' && src[i + 1] === '=') { toks.push({ type: 'op', value: '==', pos: i }); i += 2; continue; }
    if (c === '&' && src[i + 1] === '&') { toks.push({ type: 'op', value: '&&', pos: i }); i += 2; continue; }
    if (c === '|' && src[i + 1] === '|') { toks.push({ type: 'op', value: '||', pos: i }); i += 2; continue; }
    if (c === '!') { toks.push({ type: 'op', value: '!', pos: i++ }); continue; }
    if (c === '<') { toks.push({ type: 'op', value: src[i + 1] === '=' ? '<=' : '<', pos: i }); i += src[i + 1] === '=' ? 2 : 1; continue; }
    if (c === '>') { toks.push({ type: 'op', value: src[i + 1] === '=' ? '>=' : '>', pos: i }); i += src[i + 1] === '=' ? 2 : 1; continue; }
    if (c === '"' || c === "'") {
      const q = c; let j = i + 1; let s = '';
      while (j < src.length && src[j] !== q) { s += src[j]; j++; }
      if (j >= src.length) return fail('expr_syntax', 'Unterminated string', { pos: i });
      toks.push({ type: 'str', value: s, pos: i }); i = j + 1; continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9]/.test(src[j])) j++;
      if (src[j] === '.' && /[0-9]/.test(src[j + 1])) { j++; while (j < src.length && /[0-9]/.test(src[j])) j++; }
      toks.push({ type: 'num', value: parseFloat(src.slice(i, j)), pos: i }); i = j; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      toks.push({ type: 'ident', value: src.slice(i, j), pos: i }); i = j; continue;
    }
    return fail('expr_syntax', 'Unexpected character ' + JSON.stringify(c), { pos: i });
  }
  toks.push({ type: 'eof', pos: i });
  return toks;
}

/* ------------------------------------------------------------------- parser */
class P {
  constructor(toks) { this.t = toks; this.i = 0; }
  peek() { return this.t[this.i]; }
  next() { return this.t[this.i++]; }
}

function parseOr(p) {
  let left = parseAnd(p);
  if (!left.ok) return left;
  while (p.peek().type === 'op' && p.peek().value === '||') {
    p.next();
    const right = parseAnd(p);
    if (!right.ok) return right;
    left = ok({ t: 'or', l: left.value, r: right.value });
  }
  return left;
}
function parseAnd(p) {
  let left = parseNot(p);
  if (!left.ok) return left;
  while (p.peek().type === 'op' && p.peek().value === '&&') {
    p.next();
    const right = parseNot(p);
    if (!right.ok) return right;
    left = ok({ t: 'and', l: left.value, r: right.value });
  }
  return left;
}
function parseNot(p) {
  if (p.peek().type === 'op' && p.peek().value === '!') {
    p.next();
    const e = parseNot(p);
    if (!e.ok) return e;
    return ok({ t: 'not', e: e.value });
  }
  return parseCmp(p);
}
function parseCmp(p) {
  const left = parsePrimary(p);
  if (!left.ok) return left;
  const k = p.peek();
  if (k.type === 'op' && ['==', '!=', '<', '<=', '>', '>='].includes(k.value)) {
    p.next();
    const right = parsePrimary(p);
    if (!right.ok) return right;
    return ok({ t: 'cmp', op: k.value, l: left.value, r: right.value });
  }
  return left;
}
function parsePrimary(p) {
  const k = p.peek();
  if (k.type === 'num') { p.next(); return ok({ t: 'num', v: k.value }); }
  if (k.type === 'str') { p.next(); return ok({ t: 'str', v: k.value }); }
  if (k.type === 'ident') {
    let name = p.next().value;
    if (name === 'true') return ok({ t: 'bool', v: true });
    if (name === 'false') return ok({ t: 'bool', v: false });
    const path = [name];
    while (p.peek().type === 'dot') { p.next(); const seg = p.peek(); if (seg.type !== 'ident') return fail('expr_syntax', 'Expected identifier after "."', { pos: seg.pos }); p.next(); path.push(seg.value); }
    return ok({ t: 'ident', path });
  }
  if (k.type === 'lparen') {
    p.next();
    const e = parseOr(p);
    if (!e.ok) return e;
    if (p.peek().type !== 'rparen') return fail('expr_syntax', 'Expected ")"', { pos: p.peek().pos });
    p.next();
    return e;
  }
  if (k.type === 'eof') return fail('expr_syntax', 'Unexpected end of expression', { pos: k.pos });
  return fail('expr_syntax', 'Unexpected token', { pos: k.pos });
}

export function parse(src) {
  if (typeof src !== 'string') return fail('expr_syntax', 'Expression must be a string');
  if (src.trim() === '') return fail('expr_syntax', 'Empty expression', { pos: 0 });
  const toks = tokenize(src);
  if (!Array.isArray(toks)) return toks; // error result from tokenizer
  const p = new P(toks);
  const ast = parseOr(p);
  if (!ast.ok) return ast;
  if (p.peek().type !== 'eof') return fail('expr_syntax', 'Unexpected trailing input', { pos: p.peek().pos });
  return ast;
}

/* ----------------------------------------------------------------- evaluate */
export function evaluate(ast, vars = {}) {
  if (!ast) return fail('expr_type', 'No expression');
  switch (ast.t) {
    case 'num': return ok(ast.v);
    case 'str': return ok(ast.v);
    case 'bool': return ok(ast.v);
    case 'ident': {
      const full = ast.path.join('.');
      if (full in vars) return ok(vars[full]);
      if (ast.path[0] in vars) {
        let v = vars[ast.path[0]];
        for (let i = 1; i < ast.path.length; i++) {
          if (v == null || typeof v !== 'object' || !(ast.path[i] in v)) return fail('expr_unknown_identifier', 'Unknown identifier ' + ast.path.join('.'), { pos: ast.pos });
          v = v[ast.path[i]];
        }
        return ok(v);
      }
      return fail('expr_unknown_identifier', 'Unknown identifier ' + ast.path.join('.'), { pos: ast.pos });
    }
    case 'not': {
      const e = evaluate(ast.e, vars);
      if (!e.ok) return e;
      if (typeof e.value !== 'boolean') return fail('expr_type', '"!" needs a boolean', { pos: ast.pos });
      return ok(!e.value);
    }
    case 'and': case 'or': {
      const l = evaluate(ast.l, vars);
      if (!l.ok) return l;
      if (typeof l.value !== 'boolean') return fail('expr_type', '"&&"/"||" need booleans', { pos: ast.pos });
      const r = evaluate(ast.r, vars);
      if (!r.ok) return r;
      if (typeof r.value !== 'boolean') return fail('expr_type', '"&&"/"||" need booleans', { pos: ast.pos });
      return ok(ast.t === 'and' ? (l.value && r.value) : (l.value || r.value));
    }
    case 'cmp': {
      const l = evaluate(ast.l, vars);
      if (!l.ok) return l;
      const r = evaluate(ast.r, vars);
      if (!r.ok) return r;
      const a = l.value, b = r.value;
      const bothNum = typeof a === 'number' && typeof b === 'number';
      const bothStr = typeof a === 'string' && typeof b === 'string';
      if (!bothNum && !bothStr) return fail('expr_type', 'Comparison needs two numbers or two strings', { pos: ast.pos });
      switch (ast.op) {
        case '==': return ok(a === b);
        case '!=': return ok(a !== b);
        case '<': return ok(a < b);
        case '<=': return ok(a <= b);
        case '>': return ok(a > b);
        case '>=': return ok(a >= b);
      }
    }
  }
  return fail('expr_type', 'Unknown node ' + ast.t, { pos: ast.pos });
}

/* ------------------------------------------------------------- identifiers */
export function identifiers(ast) {
  const out = new Set();
  const walk = n => {
    if (!n) return;
    if (n.t === 'ident') out.add(n.path[0]);
    if (n.t === 'not') walk(n.e);
    if (n.t === 'and' || n.t === 'or' || n.t === 'cmp') { walk(n.l); walk(n.r); }
  };
  walk(ast);
  return [...out];
}

export function check(src) {
  const ast = parse(src);
  if (!ast.ok) return ast;
  for (const id of identifiers(ast.value)) {
    if (!EXPR_VARS.includes(id)) return fail('expr_unknown_identifier', 'Unknown identifier ' + id, {});
  }
  return ast;
}
