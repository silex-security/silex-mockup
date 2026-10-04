// test.mjs — synthetic fixtures for X1 + X2b. Fake suite "acme", fake tools, no real AgentDojo data.
// Exits non-zero on any assertion failure.
//   node swm/experiments/ontology-value/fixtures/synthetic/test.mjs
import { words, mapTool, mapActionL2, mapToolWithBinding, buildToolMap, RULES } from '../../tool-map.mjs';
import { contextLine, mayCauseOf, hazardsOf } from '../../export-context.mjs';
import { pOnto, b1, b2, blockedPairs, CLASSES } from '../../e3/predict.mjs';
import { canonicalJSON, buildRequest, serializeRequest, parseResponse } from '../../e3/b3.mjs';
import { scoreFold, scoreAll } from '../../e3/score.mjs';

let failed = 0;
function assert(cond, msg) {
  if (!cond) { failed++; console.error('FAIL: ' + msg); }
}
function eq(a, b, msg) {
  const ja = JSON.stringify(a), jb = JSON.stringify(b);
  if (ja !== jb) { failed++; console.error(`FAIL: ${msg} — got ${ja}, want ${jb}`); }
}

// ---- synthetic snapshot (fake ids; mirrors the real snapshot's directions) ----
const nodes = [
  { id: 'core:core-action-read', label: 'Read Action', kind: 'action', layer: 1 },
  { id: 'core:core-action-write', label: 'Write Action', kind: 'action', layer: 1 },
  { id: 'core:core-action-execute', label: 'Execute Action', kind: 'action', layer: 1 },
  { id: 'core:core-action-transfer-value', label: 'Value Transfer Action', kind: 'action', layer: 1 },
  { id: 'core:core-action-approve', label: 'Approval Action', kind: 'action', layer: 1 },
  { id: 'core:core-action-delegate', label: 'Delegation Action', kind: 'action', layer: 1 },
  { id: 'core:core-action-revoke', label: 'Authority revocation action', kind: 'action', layer: 1 },
  { id: 'act:acme-payment-release', label: 'Payment Release', kind: 'action', layer: 2 },
  { id: 'act:acme-invoice-approve', label: 'Invoice Approval', kind: 'action', layer: 2 },
  { id: 'act:acme-data-export', label: 'Data Export', kind: 'action', layer: 2 },
  { id: 'core:core-effect-data-read', label: 'Data Read Effect', kind: 'effect', layer: 1 },
  { id: 'core:core-effect-data-disclosure', label: 'Data Disclosure Effect', kind: 'effect', layer: 1 },
  { id: 'core:core-effect-record-alteration', label: 'Record Alteration Effect', kind: 'effect', layer: 1 },
  { id: 'core:financial-value-transfer', label: 'Financial-value transfer', kind: 'effect', layer: 1 },
  { id: 'po:acme-unrecoverable-payout', label: 'Unrecoverable Payout', kind: 'effect', layer: 2 },
  { id: 'po:acme-pii-disclosure', label: 'PII Disclosure to Wrong Party', kind: 'effect', layer: 2 },
  { id: 'ent:acme:account', label: 'Account', kind: 'entity', layer: 2 },
  { id: 'ent:acme:customer', label: 'Customer', kind: 'entity', layer: 2 },
  { id: 'haz:acme-payment-ceiling', label: 'Payment Above Ceiling', kind: 'hazard', layer: 2 },
  { id: 'haz:acme-data-leak', label: 'Data Leak', kind: 'hazard', layer: 2 },
];
const links = [
  { s: 'act:acme-payment-release', t: 'core:core-action-transfer-value', pred: 'SUBCLASS_OF' },
  { s: 'act:acme-invoice-approve', t: 'core:core-action-approve', pred: 'SUBCLASS_OF' },
  { s: 'act:acme-data-export', t: 'core:core-action-read', pred: 'SUBCLASS_OF' },
  { s: 'po:acme-unrecoverable-payout', t: 'core:financial-value-transfer', pred: 'SUBCLASS_OF' },
  { s: 'po:acme-pii-disclosure', t: 'core:core-effect-data-disclosure', pred: 'SUBCLASS_OF' },
  { s: 'act:acme-payment-release', t: 'core:financial-value-transfer', pred: 'MAY_CAUSE' },
  { s: 'act:acme-invoice-approve', t: 'core:core-effect-record-alteration', pred: 'MAY_CAUSE' },
  { s: 'act:acme-data-export', t: 'core:core-effect-data-read', pred: 'MAY_CAUSE' },
  { s: 'haz:acme-payment-ceiling', t: 'act:acme-payment-release', pred: 'HAZARD_FOR' },
  { s: 'haz:acme-payment-ceiling', t: 'ent:acme:account', pred: 'HAZARD_FOR' },
  { s: 'haz:acme-data-leak', t: 'act:acme-data-export', pred: 'HAZARD_FOR' },
  { s: 'haz:acme-data-leak', t: 'ent:acme:customer', pred: 'HAZARD_FOR' },
  { s: 'haz:acme-payment-ceiling', t: 'po:acme-unrecoverable-payout', pred: 'MAY_LEAD_TO' },
  { s: 'haz:acme-data-leak', t: 'po:acme-pii-disclosure', pred: 'MAY_LEAD_TO' },
];
const snapshot = { base: 'fake', nodes, links };

const effectClass = {
  'core:core-effect-data-read': 'data disclosure',
  'core:core-effect-data-disclosure': 'data disclosure',
  'core:core-effect-record-alteration': 'record alteration',
  'core:financial-value-transfer': 'value transfer',
  'po:acme-unrecoverable-payout': 'value transfer',
  'po:acme-pii-disclosure': 'data disclosure',
};

const tools = [
  { id: 'agentdojo:acme/release_payment', source: 'agentdojo', suite: 'acme', name: 'release_payment', impact: 'write', description: 'Release a payment to the recipient.' },
  { id: 'agentdojo:acme/payment_release_tool', source: 'agentdojo', suite: 'acme', name: 'payment_release_tool', impact: 'write', description: 'Tool that performs a payment release.' },
  { id: 'agentdojo:acme/get_balance', source: 'agentdojo', suite: 'acme', name: 'get_balance', impact: 'read', description: 'Get the balance of the account.' },
  { id: 'agentdojo:acme/send_money', source: 'agentdojo', suite: 'acme', name: 'send_money', impact: 'write', description: 'Send money to a recipient.' },
  { id: 'agentdojo:acme/update_password', source: 'agentdojo', suite: 'acme', name: 'update_password', impact: 'write', description: 'Update the user password.' },
  { id: 'agentdojo:acme/read_file', source: 'agentdojo', suite: 'acme', name: 'read_file', impact: 'read', description: 'Read the contents of a file.' },
  { id: 'agentdojo:acme/invite_user', source: 'agentdojo', suite: 'acme', name: 'invite_user', impact: 'write', description: 'Invite a user to the workspace.' },
  { id: 'agentdojo:acme/export_customer_data', source: 'agentdojo', suite: 'acme', name: 'export_customer_data', impact: 'write', description: 'Export customer data to a file.' },
];
const manifest = { archive_sha256: 'x', tools };
const toolMap = buildToolMap(manifest, snapshot).tools;
const ctx = { tools, toolMap, snapshot, effectClass };

// ---- words / tokenization ----
eq(words('getUserInfo'), ['get', 'user', 'info'], 'words camelCase');
eq(words('send_money'), ['send', 'money'], 'words snake');
eq(words(null), [], 'words null');

// ---- mapTool ----
eq(mapTool(tools[0], snapshot), { core: 'core:core-action-transfer-value', action: 'act:acme-payment-release', rule: 'transfer-value' }, 'release_payment -> transfer-value + L2');
eq(mapTool(tools[2], snapshot), { core: 'core:core-action-read', action: null, rule: 'read' }, 'get_balance -> read');
eq(mapTool(tools[3], snapshot), { core: 'core:core-action-transfer-value', action: null, rule: 'transfer-value' }, 'send_money -> transfer-value');
eq(mapTool(tools[4], snapshot), { core: 'core:core-action-write', action: null, rule: 'write' }, 'update_password -> write');
eq(mapTool(tools[6], snapshot), { core: 'core:core-action-delegate', action: null, rule: 'delegate' }, 'invite_user -> delegate');
eq(mapTool(tools[7], snapshot).rule, 'fallback-impact', 'export_customer_data -> fallback-impact');
eq(mapTool(tools[7], snapshot).action, 'act:acme-data-export', 'export_customer_data L2 -> Data Export');
eq(mapTool({ id: 'x', name: 'zzyzx', impact: 'read', description: null }, snapshot).rule, 'fallback-impact', 'unmatched name falls back to impact');
eq(mapTool({ id: 'x', name: 'zzyzx', impact: null, description: null }, snapshot).rule, 'unmapped', 'no rule and no impact -> unmapped');

// ---- mapActionL2 threshold ----
eq(mapActionL2(tools[0], snapshot), 'act:acme-payment-release', 'L2 overlap threshold 2 hits');
eq(mapActionL2(tools[2], snapshot), null, 'L2 overlap below threshold -> null');

// ---- R4-1 binding ----
{
  const fakeBinding = { version: 1, tools: { 'agentdojo:acme/get_balance': { action: 'act:acme-data-export', core: 'core:core-action-read', reason: 'reads data' } } };
  eq(mapToolWithBinding(tools[2], snapshot, fakeBinding), { core: 'core:core-action-read', action: 'act:acme-data-export', rule: 'binding' }, 'binding overrides keyword rules');
  eq(mapToolWithBinding(tools[3], snapshot, fakeBinding), mapTool(tools[3], snapshot), 'unbound tool falls back to keyword rules');
  eq(mapToolWithBinding(tools[2], snapshot, { version: 1, tools: {} }), mapTool(tools[2], snapshot), 'empty binding falls back to keyword rules');
}

// ---- contextLine ----
eq(contextLine(tools[0].id, toolMap, snapshot),
  'Payment Release (Value Transfer Action); effects: Financial-value transfer; hazards: Payment Above Ceiling -> Unrecoverable Payout',
  'contextLine L2 tool');
eq(contextLine(tools[2].id, toolMap, snapshot), 'Read Action', 'contextLine core-only tool');
eq(contextLine('nope', toolMap, snapshot), 'no ontology match', 'contextLine unmapped');
eq(contextLine('x', { x: { core: null, action: null } }, snapshot), 'no ontology match', 'contextLine null core');

// ---- overflow: build a tool with many effects and assert <=320 and whole-item dropping ----
{
  const big = { nodes: [...nodes, { id: 'act:big-action', label: 'Big Action', kind: 'action', layer: 2 }], links: [...links, { s: 'act:big-action', t: 'core:core-action-write', pred: 'SUBCLASS_OF' }] };
  for (let i = 0; i < 40; i++) big.nodes.push({ id: `e${i}`, label: `EffectNumber${i}WithALongLabel`, kind: 'effect', layer: 1 });
  for (let i = 0; i < 40; i++) big.links.push({ s: 'act:big-action', t: `e${i}`, pred: 'MAY_CAUSE' });
  const bigClass = {};
  for (let i = 0; i < 40; i++) bigClass[`e${i}`] = 'record alteration';
  const line = contextLine('big-tool', { 'big-tool': { core: 'core:core-action-write', action: 'act:big-action' } }, big);
  assert(line.length <= 320, 'overflow line <= 320 (2nd)');
  assert(!line.includes('EffectNumber39'), 'last item dropped when over budget');
}

// ---- blockedPairs / predictors ----
const fold = { fold_id: 'f1', suite: 'acme', blocked: { calls: [{ function: 'release_payment', args: {} }] } };
eq(blockedPairs(fold, ctx), [{ tool: 'release_payment', class: 'value transfer', effect: 'core:financial-value-transfer' }], 'blockedPairs');

const p = pOnto(fold, ctx);
assert(p.some(x => x.tool === 'payment_release_tool' && x.class === 'value transfer' && x.rank === 1), 'pOnto rank1 predicts the sibling value-transfer tool');
assert(!p.some(x => x.tool === 'release_payment'), 'pOnto drops the blocked pair');
assert(p.length <= 10, 'pOnto <= 10');

eq(b1(fold, ctx), [], 'b1 emptied by the blocked-pair removal');

const b2out = b2(fold, ctx);
assert(b2out.every(x => x.class), 'b2 predictions all have a class');
assert(b2out.every(x => tools.find(t => t.name === x.tool)?.impact === 'write'), 'b2 only write-impact tools');

// ---- scoreFold ----
const harm = {
  f1: { suite: 'acme', pairs: [['release_payment', 'value transfer']] },
  f2: { suite: 'acme', pairs: [['payment_release_tool', 'value transfer']] },
  f3: { suite: 'acme', pairs: [['export_customer_data', 'data disclosure']] },
  f4: { suite: 'other', pairs: [['zzz', 'value transfer']] },
};
const sf = scoreFold('f1', p, harm);
eq(sf.targets, 1, 'scoreFold targets');
eq(sf.matched, 1, 'scoreFold matched');
eq(sf.recall, 1, 'scoreFold recall');
eq(sf.precision, 1, 'scoreFold precision');
const sa = scoreAll({ f1: p, f2: [], f3: [], f4: [] }, harm);
eq(sa.pooled.targets, 2, 'scoreAll pooled targets (f1 and f2 each have one target)');
eq(sa.pooled.matched, 1, 'scoreAll pooled matched (f1 matches, f2 empty)');
eq(sa.pooled.recall, 0.5, 'scoreAll pooled recall');

// ---- b3 ----
eq(canonicalJSON({ b: 1, a: { c: 2, d: [3, { z: 9, y: 8 }] } }), '{"a":{"c":2,"d":[3,{"y":8,"z":9}]},"b":1}', 'canonicalJSON sorts keys');
const req = buildRequest(fold, [tools[2], tools[3]], 'PROMPT');
eq(req.model, 'deepseek-v4-pro', 'buildRequest model');
eq(req.messages[0], { role: 'system', content: 'PROMPT' }, 'buildRequest system');
assert(!serializeRequest(req).includes('\n'), 'serializeRequest has no whitespace');
eq(serializeRequest(req), serializeRequest(buildRequest(fold, [tools[2], tools[3]], 'PROMPT')), 'serializeRequest deterministic');
const parsed = parseResponse('[{"tool":"get_balance","class":"value transfer"},{"tool":"nope","class":"value transfer"},{"tool":"get_balance","class":"bogus"}]', tools);
eq(parsed.predictions, [{ tool: 'get_balance', class: 'value transfer', rank: 1 }], 'parseResponse keeps valid only');
eq(parsed.dropped, { unknown_tool: 1, unknown_class: 1, malformed: 0 }, 'parseResponse dropped counts');

// ---- determinism of the shared outputs (same inputs -> byte-identical) ----
const a1 = JSON.stringify(buildToolMap(manifest, snapshot));
const a2 = JSON.stringify(buildToolMap(manifest, snapshot));
eq(a1, a2, 'buildToolMap deterministic');

console.log(`synthetic test: ${failed === 0 ? 'PASS' : `${failed} FAILURES`}`);
process.exit(failed === 0 ? 0 : 1);
