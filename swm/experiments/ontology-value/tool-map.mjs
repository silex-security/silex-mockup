// tool-map.mjs — X1a (plan logs/2026-10-03_ONTOLOGY_OBSERVABILITY_VALUE_PLAN.md § Shared component).
// Maps every manifest tool to an L1 core action (and, optionally, an L2 action). Two sources:
//   - `binding.json` (Amendment R4-1) supplies {core, action} for every `agentdojo:*` tool (rule id
//     "binding"), authored blind from tool-manifest + snapshot only.
//   - generic keyword rules (no per-tool entries) cover every other source (rule id = rule family).
// Deterministic: same inputs → byte-identical outputs.
//
// Snapshot directions found while inspecting out/snapshot.json (documented per § Isolation "inspect the
// snapshot to learn the actual directions"):
//   SUBCLASS_OF   subclass -> superclass    (L2 action -> L1 core action; L2 effect -> L1 effect; L2 state -> L1 state)
//   MAY_CAUSE     L2 action -> effect       (37 edges, ALL from L2 actions; L1 core actions have NONE)
//   HAZARD_FOR    hazard -> (L2 action | entity)   (never -> an L1 core action)
//   MAY_LEAD_TO   hazard -> (effect | state)       (the "prohibited outcome")
//   GROUPED_UNDER L2 action -> group · PART_OF_DOMAIN L2 action -> domain · USED_IN L2 action -> workflow
//   There is NO action -> entity edge in this snapshot, so "the entity the action is linked to" is empty.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

// --- tokenization: lowercase, split camelCase and snake_case and any non-alphanumeric run into words ---
export function words(s) {
  if (s == null) return [];
  return String(s)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // camelCase split BEFORE lowercasing
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(w => w.length > 0);
}

// A rule's pattern is a RegExp tested against words(`${name} ${description}`).join(' ').
// A verb stem list matches the stem optionally followed by s/es/ing/ed, so "read" also matches
// "reads"/"reading" and "schedule" also matches "scheduled". A noun list matches exactly.
const verbSrc = stems => `(?:${stems.join('|')})(?:s|es|ing|ed)?`;
const nounSrc = stems => `(?:${stems.join('|')})`;
const verb = stems => new RegExp(`\\b${verbSrc(stems)}\\b`);
const noun = stems => new RegExp(`\\b${nounSrc(stems)}\\b`);

// Ordered; first match wins. More specific families come before the generic read/write fall-through.
export const RULES = [
  {
    id: 'approve',
    core: 'core:core-action-approve',
    pattern: verb(['approve', 'authorize', 'authorise', 'accept', 'confirm', 'validate', 'verify', 'sign', 'acknowledge']),
  },
  {
    id: 'delegate',
    core: 'core:core-action-delegate',
    pattern: verb(['delegate', 'assign', 'share', 'invite', 'grant', 'provision', 'entitle', 'onboard', 'permit']),
  },
  {
    id: 'revoke',
    core: 'core:core-action-revoke',
    pattern: verb(['revoke', 'unshare', 'deactivate', 'offboard', 'disable', 'block', 'deny', 'suspend', 'kick', 'mute', 'ban', 'unsubscribe']),
  },
  {
    id: 'read',
    core: 'core:core-action-read',
    pattern: new RegExp(
      `\\b${verbSrc(['get', 'read', 'list', 'search', 'fetch', 'view', 'query', 'show', 'retrieve', 'lookup', 'find', 'describe', 'summarize', 'summarise', 'preview', 'browse', 'check', 'inspect'])}` +
        `\\b|\\b${nounSrc(['detail', 'details', 'status', 'history', 'recent', 'info', 'information', 'balance', 'summary', 'summaries'])}`,
    ),
  },
  {
    id: 'transfer-value',
    core: 'core:core-action-transfer-value',
    pattern: new RegExp(
      `\\b${verbSrc(['transfer', 'pay', 'refund', 'withdraw', 'deposit', 'reimburse', 'remit', 'disburse', 'charge', 'invoice', 'bill'])}` +
        `\\b|\\b${nounSrc(['money', 'payment', 'transaction', 'billing', 'recipient', 'iban', 'amount'])}`,
    ),
  },
  {
    id: 'execute',
    core: 'core:core-action-execute',
    pattern: verb(['execute', 'run', 'invoke', 'launch', 'deploy', 'trigger', 'process']),
  },
  {
    id: 'write',
    core: 'core:core-action-write',
    pattern: verb([
      'write', 'create', 'add', 'set', 'update', 'modify', 'change', 'edit', 'delete', 'remove',
      'insert', 'append', 'post', 'save', 'rename', 'reset', 'send', 'schedule', 'reschedule',
      'book', 'reserve', 'register', 'upload', 'subscribe', 'archive', 'move', 'copy', 'merge', 'transform', 'cancel',
    ]),
  },
];

const L2_STOP = new Set(
  'the a an of to and or for in on by with from at is are be as via into onto up out not no this that these those it its their there here'.split(' ')
);

function contentWords(s) {
  return words(s).filter(w => w.length >= 4 && !L2_STOP.has(w));
}

// L2 action: chosen only by token overlap between the tool's words (name + description) and the L2
// action's label words. Rule (documented, threshold): >= 2 shared content words (length >= 4, not in
// L2_STOP); the action with the highest overlap wins; ties -> lowest node id. With the shipped manifest
// this yields no L2 mapping (generic tool verbs vs domain noun-phrase action labels), which is expected
// and reported in the coverage.
export function mapActionL2(tool, snapshot) {
  const tw = new Set(contentWords(`${tool.name ?? ''} ${tool.description ?? ''}`));
  let best = null;
  let bestScore = 0;
  for (const a of snapshot.nodes) {
    if (a.kind !== 'action' || a.layer !== 2) continue;
    const aw = new Set(contentWords(a.label));
    let overlap = 0;
    for (const w of aw) if (tw.has(w)) overlap++;
    if (overlap > bestScore) { bestScore = overlap; best = a.id; }
    else if (overlap === bestScore && overlap > 0 && best !== null && a.id < best) { best = a.id; }
  }
  return bestScore >= 2 ? best : null;
}

export function mapTool(tool, snapshot) {
  const text = words(`${tool.name ?? ''} ${tool.description ?? ''}`).join(' ');
  for (const r of RULES) {
    if (r.pattern.test(text)) {
      return { core: r.core, action: mapActionL2(tool, snapshot), rule: r.id };
    }
  }
  // Fallback: registry impact, only when no rule matched. Rule id records the fallback.
  if (tool.impact === 'write') return { core: 'core:core-action-write', action: mapActionL2(tool, snapshot), rule: 'fallback-impact' };
  if (tool.impact === 'read') return { core: 'core:core-action-read', action: mapActionL2(tool, snapshot), rule: 'fallback-impact' };
  return { core: null, action: null, rule: 'unmapped' };
}

export function buildToolMap(manifest, snapshot, binding) {
  const b = binding ?? loadBinding();
  const tools = {};
  for (const t of manifest.tools) tools[t.id] = mapToolWithBinding(t, snapshot, b);
  return { version: 1, tools };
}

// Amendment R4-1 onboarding binding (authoring by the blind coder seat, frozen at the code seal).
let _bindingCache = null;
export function loadBinding() {
  if (_bindingCache) return _bindingCache;
  const p = join(HERE, 'binding.json');
  _bindingCache = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : { version: 1, tools: {} };
  return _bindingCache;
}

export function mapToolWithBinding(tool, snapshot, binding) {
  const b = binding ?? loadBinding();
  const entry = b.tools[tool.id];
  if (entry) return { core: entry.core, action: entry.action ?? null, rule: 'binding' };
  return mapTool(tool, snapshot);
}

export function coverage(manifest, snapshot, binding) {
  const map = buildToolMap(manifest, snapshot, binding);
  const by = {};
  for (const t of manifest.tools) {
    const m = map.tools[t.id];
    const b = (by[t.source] ??= { mapped_by_rule: 0, fallback: 0, unmapped: 0, binding: 0, binding_l2_non_null: 0, binding_l2_null: 0, l2_hits: 0 });
    if (m.rule === 'unmapped') b.unmapped++;
    else if (m.rule === 'fallback-impact') b.fallback++;
    else if (m.rule === 'binding') { b.binding++; if (m.action) b.binding_l2_non_null++; else b.binding_l2_null++; }
    else b.mapped_by_rule++;
    if (m.action) b.l2_hits++;
  }
  const totals = { mapped_by_rule: 0, fallback: 0, unmapped: 0, binding: 0, binding_l2_non_null: 0, binding_l2_null: 0, l2_hits: 0, tools: manifest.tools.length };
  for (const s of Object.keys(by).sort()) for (const k of Object.keys(totals)) {
    if (k === 'tools') continue;
    totals[k] += by[s][k];
  }
  return { version: 1, by_source: by, totals };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const manifest = JSON.parse(readFileSync(join(HERE, 'out/tool-manifest.json'), 'utf8'));
  const snapshot = JSON.parse(readFileSync(join(HERE, 'out/snapshot.json'), 'utf8'));
  const map = buildToolMap(manifest, snapshot);
  const cov = coverage(manifest, snapshot);
  writeFileSync(join(HERE, 'out/tool-map.json'), JSON.stringify(map, null, 1) + '\n');
  writeFileSync(join(HERE, 'out/tool-map-coverage.json'), JSON.stringify(cov, null, 1) + '\n');
  console.log(`tool-map: ${manifest.tools.length} tools; rules=${RULES.length}`);
  for (const s of Object.keys(cov.by_source).sort()) console.log(`  ${s}: ${JSON.stringify(cov.by_source[s])}`);
}
