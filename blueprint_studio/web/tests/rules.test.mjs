import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { proposeByRules } from '../src/assist/rules.js';
import { validateProposal } from '../src/assist/validateProposal.js';
import { lint } from '../../js/validate.js';

const graph = JSON.parse(readFileSync(new URL('../../templates/customer-refund.json', import.meta.url))).graph;

/* Run a sentence through the rule proposer and the validator; return the final
   graph's lint errors (empty = lint-clean). */
function apply(text) {
  const p = proposeByRules(text, graph);
  assert.ok(p.ok, JSON.stringify(p.error));
  assert.deepEqual(p.value.unmatched, [], `unmatched: ${p.value.unmatched.join(' | ')}`);
  assert.ok(p.value.ops.length, 'no ops produced');
  const v = validateProposal(graph, { summary: p.value.summary, ops: p.value.ops });
  assert.ok(v.ok, JSON.stringify(v.error));
  return { proposal: p.value, ops: v.value.ops, graph: v.value.graph, errors: lint(v.value.graph).filter(i => i.severity === 'error') };
}
const expectClean = text => assert.equal(apply(text).errors.length, 0, `lint: ${apply(text).errors.map(e => e.code).join(',')}`);
const expectUnmatched = text => { const p = proposeByRules(text, graph); assert.ok(p.ok); assert.equal(p.value.ops.length, 0, `should produce no op for: ${text}`); assert.equal(p.value.unmatched.length, 1); };

test('rules: add a human approval after Refund Eligibility (English) is a clean insert', () => {
  const r = apply('add a human approval after Refund Eligibility');
  assert.equal(r.proposal.ops[0].op, 'insertStep');
  assert.equal(r.proposal.ops[0].type, 'control');
  assert.equal(r.errors.length, 0);
});

test('rules: 在 … 后面加一个人工审批 (中文) is the same insert', () => {
  const r = apply('在 Refund Eligibility 后面加一个人工审批');
  assert.equal(r.proposal.ops[0].op, 'insertStep');
  assert.equal(r.proposal.ops[0].type, 'control');
  assert.equal(r.errors.length, 0);
});

test('rules: delete a node by label (both languages)', () => {
  assert.equal(apply('delete Duplicate Compensation').proposal.ops[0].op, 'removeNode');
  assert.equal(apply('删除 Duplicate Compensation').proposal.ops[0].op, 'removeNode');
});

test('rules: rename a node (both languages)', () => {
  const en = apply('rename Payment API to Stripe Refunds');
  assert.equal(en.proposal.ops[0].op, 'setLabel');
  assert.equal(en.proposal.ops[0].label, 'Stripe Refunds');
  const zh = apply('把 Payment API 改名为 Stripe Refunds');
  assert.equal(zh.proposal.ops[0].op, 'setLabel');
  assert.equal(zh.proposal.ops[0].label, 'Stripe Refunds');
});

test('rules: protect a tool with a monitor (both languages)', () => {
  assert.equal(apply('protect Payment API with unauthorized write').proposal.ops[0].op, 'addMonitor');
  assert.equal(apply('给 Payment API 加上未授权写入监控').proposal.ops[0].op, 'addMonitor');
});

test('rules: add a secret data resource to an agent (both languages)', () => {
  const en = apply("add a secret data resource 'Session Token' to the Request Triage agent");
  assert.equal(en.proposal.ops[0].op, 'addData');
  assert.equal(en.proposal.ops[0].sensitivity, 'secret');
  assert.equal(en.proposal.ops[0].label, 'Session Token');
  const zh = apply('给 Request Triage 添加机密数据资源 Session Token');
  assert.equal(zh.proposal.ops[0].op, 'addData');
  assert.equal(zh.proposal.ops[0].sensitivity, 'secret');
  assert.equal(zh.proposal.ops[0].label, 'Session Token');
});

test('rules: set the approval above an amount (both languages)', () => {
  const en = apply('set the approval above 1000');
  assert.equal(en.proposal.ops[0].op, 'setConfig');
  assert.equal(en.proposal.ops[0].key, 'appliesWhen');
  assert.equal(en.proposal.ops[0].value, 'amount > 1000');
  const zh = apply('金额超过1000才需要审批');
  assert.equal(zh.proposal.ops[0].key, 'appliesWhen');
  assert.equal(zh.proposal.ops[0].value, 'amount > 1000');
});

test('rules: set a field of a node to a value (condition)', () => {
  const r = apply('set the condition of gate to amount > 100');
  assert.equal(r.proposal.ops[0].op, 'setConfig');
  assert.equal(r.proposal.ops[0].key, 'condition');
  assert.equal(r.proposal.ops[0].value, 'amount > 100');
  expectClean('set the threshold of unauth to 800');
});

test('rules: existing nlcompile phrases are reused', () => {
  const r1 = apply('require approval above $500');
  assert.equal(r1.proposal.ops[0].op, 'setConfig');
  assert.equal(r1.proposal.ops[0].key, 'condition');
  assert.equal(r1.proposal.ops[0].value, 'amount > 500');
  const r2 = apply('aggregate per customer per day');
  assert.equal(r2.proposal.ops[0].value, 'dayTotal > 2000');
  const r3 = apply('prevent duplicate refunds');
  assert.ok(r3.proposal.ops.every(o => o.op === 'setConfig' && o.key === 'idempotencyKey'));
});

test('rules: add a data resource to a tool with an explicit sensitivity', () => {
  const r = apply('add an internal data resource Vendor Notes to the Payment API');
  assert.equal(r.proposal.ops[0].op, 'addData');
  assert.equal(r.proposal.ops[0].sensitivity, 'internal');
  assert.equal(r.proposal.ops[0].label, 'Vendor Notes');
  const r2 = apply('add data resource Changelog public to the Payment API');
  assert.equal(r2.proposal.ops[0].sensitivity, 'public');
  assert.equal(r2.proposal.ops[0].label, 'Changelog');
});

/* ---- Codex round-1 defect 4: faithful qualifiers, decimals, thousands ---- */
function newControl(text) {
  const r = apply(text);
  const n = r.graph.nodes.find(x => x.type === 'control' && x.id !== 'approval');
  assert.ok(n, 'a new control was created');
  return n;
}

test('rules: dual approval produces kind dual_approval (not single-person)', () => {
  const r = apply('add a dual approval after Refund Eligibility');
  assert.equal(r.proposal.ops[0].config.kind, 'dual_approval');
  assert.equal(newControl('add a dual approval after Refund Eligibility').config.kind, 'dual_approval');
});

test('rules: approval above/over/at-least map to appliesWhen, exactly', () => {
  assert.equal(newControl('add a human approval above $1,000 after Refund Eligibility').config.appliesWhen, 'amount > 1000');
  assert.equal(newControl('add a manager approval over $500 after Refund Eligibility').config.appliesWhen, 'amount > 500');
  assert.equal(newControl('add an approval at least $250 after Refund Eligibility').config.appliesWhen, 'amount >= 250');
  assert.equal(newControl('add an approval more than 900 after Refund Eligibility').config.appliesWhen, 'amount > 900');
});

test('rules: decimals and thousands parse exactly, both languages', () => {
  assert.equal(newControl('add a human approval above 500.75 after Refund Eligibility').config.appliesWhen, 'amount > 500.75');
  assert.equal(newControl('add a human approval above $1,000 after Refund Eligibility').config.appliesWhen, 'amount > 1000');
  assert.equal(newControl('add a human approval above 1000.5 after Refund Eligibility').config.appliesWhen, 'amount > 1000.5');
  assert.equal(newControl('在 Refund Eligibility 后面加一个金额超过1000的人工审批').config.appliesWhen, 'amount > 1000');
  assert.equal(newControl('在 Refund Eligibility 后面加一个超过 1,000 元的人工审批').config.appliesWhen, 'amount > 1000');
});

test('rules: a decimal amount is not split into two sentences', () => {
  const p = proposeByRules('add a human approval above 500.75 after Refund Eligibility', graph);
  assert.ok(p.ok);
  assert.equal(p.value.ops.length, 1);
  assert.equal(p.value.unmatched.length, 0);
});

/* ---- Codex round-2 defect 2: whole-sentence consumption, no silent drops ---- */
test('rules: an unsupported qualifier leaves the whole sentence unmatched (English)', () => {
  for (const s of [
    'add a human approval after Refund Eligibility unless the customer is VIP',
    'add a human approval above $1,000 and only for international orders after Refund Eligibility',
    'add a human approval within 2 hours after Refund Eligibility',
    'add a human approval for VIP customers after Refund Eligibility',
    'add a human approval except for new customers after Refund Eligibility',
    'add a human approval after Refund Eligiblity'
  ]) expectUnmatched(s);
});

test('rules: an unsupported qualifier leaves the whole sentence unmatched (中文)', () => {
  for (const s of [
    '在 Refund Eligibility 后面加一个人工审批，除非客户是 VIP',
    '在 Refund Eligibility 后面加一个2小时内的人工审批',
    '在 Refund Eligibility 后面加一个仅当是新客户的人工审批'
  ]) expectUnmatched(s);
});

test('rules: sentences it cannot map go to unmatched, never guessed', () => {
  const p = proposeByRules('please do something magical and ineffable', graph);
  assert.ok(p.ok);
  assert.equal(p.value.ops.length, 0);
  assert.equal(p.value.unmatched.length, 1);
});

test('rules: a misspelled node name is not matched', () => {
  expectUnmatched('delete the unicorn step');
  expectUnmatched('delete Duplicat Compensation');
});

test('rules: politeness words are stripped; extra trailing clause is unmatched', () => {
  expectClean('please delete Duplicate Compensation');
  expectUnmatched('delete Duplicate Compensation and also rename Payment API');
});

/* ---- Chinese comma threshold clause (the UI's own suggested phrases) ---- */
function newControlZh(text) {
  const r = apply(text);
  assert.equal(r.proposal.ops[0].op, 'insertStep');
  assert.equal(r.proposal.ops[0].type, 'control');
  const n = r.graph.nodes.find(x => x.type === 'control' && x.id !== 'approval');
  assert.ok(n);
  return n;
}

test('rules: a Chinese comma threshold after the spec maps to appliesWhen', () => {
  for (const [s, want] of [
    ['在 Refund Eligibility 后面加一个人工审批，金额超过 1,000', 'amount > 1000'],
    ['在 Refund Eligibility 后面加一个人工审批，超过 1000 才需要', 'amount > 1000'],
    ['在 Refund Eligibility 后面加一个人工审批，金额超过 1,000 元', 'amount > 1000'],
    ['在 Refund Eligibility 后面加一个人工审批，金额大于 1,000', 'amount > 1000'],
    ['在 Refund Eligibility 后面加一个人工审批，金额高于 1,000', 'amount > 1000'],
    ['在 Refund Eligibility 后面加一个人工审批，金额不少于 1,000', 'amount >= 1000'],
    ['在 Refund Eligibility 后面加一个人工审批，至少 1,000 元', 'amount >= 1000'],
    ['在 Refund Eligibility 后面加一个人工审批，超过 1000 时需要', 'amount > 1000']
  ]) {
    const n = newControlZh(s);
    assert.equal(n.config.kind, 'human_approval', s);
    assert.equal(n.config.appliesWhen, want, s);
  }
});

test('rules: a non-threshold clause after the Chinese comma stays unmatched', () => {
  for (const s of [
    '在 Refund Eligibility 后面加一个人工审批，除非客户是 VIP',
    '在 Refund Eligibility 后面加一个人工审批，仅当是新客户',
    '在 Refund Eligibility 后面加一个人工审批，超过 1000 才需要，并且只限国际订单'
  ]) expectUnmatched(s);
});
