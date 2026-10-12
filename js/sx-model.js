// Scenario Expansion: the shared model (logs/2026-10-11_SCENARIO_EXPANSION_PLAN.md, shared contract).
// One seed attack (bulk reads on a finance share, ATT&CK T1039) is varied along five business conditions. Ontology
// constraints prune combinations that cannot exist in this enterprise; every surviving variant gets a proposed expected
// outcome (pending expert review), a simulated rule result, and a provenance record that keeps the three kinds of
// operation apart: a lab execution (role, permission, sensitivity), a context overlay (approval, injected, never
// executed) and an observation-removal derivative (log coverage, derived from a recorded run, never re-executed).
// Pure: no DOM, no network, no randomness. Every count the page shows is computed here at load.

export const TENANT = 'Acme Financial';
export const GRADE = 'simulated';
export const ONTOLOGY_VERSION = 'scenario-slice 0.1';

export const SEED = {
  id: 'S0',
  technique: { id: 'T1039', name: 'Data from Network Shared Drive' },
  title: 'Bulk read of files on the finance-close share',
  share: 'finance-close',
  reads: 200,
  windowMin: 8,
  values: { role: 'analyst', approval: 'none', permission: 'standing', sensitivity: 'confidential', logs: 'complete' },
};

const ACTORS = { analyst: 'j.doe', contractor: 'c.ortiz', service: 'svc-close-export' };
/** The fictional account that performs the reads in a variant. */
export function actorOf(values) { return ACTORS[values.role]; }

export const TIERS = [
  { id: 'L1', label: 'L1 · General', types: ['Identity', 'Asset', 'Permission', 'Action'] },
  { id: 'L2', label: 'L2 · Security domain pack', types: ['Role', 'Sensitivity', 'Approval', 'Log source', 'Detection rule'] },
  { id: 'L3', label: 'L3 · Use-case slice', types: ['Quarter-end close process', 'finance-close share', 'Service-account allowlist'] },
  { id: 'L4', label: 'L4 · Runtime graph', types: ['Event', 'State'] },
];

const v = (value, label, hint) => ({ value, label, hint });
export const AXES = [
  { key: 'role', label: 'Account role', tier: 'L2', op: 'lab', values: [
    v('analyst', 'Finance analyst', 'A person on the finance team (j.doe).'),
    v('contractor', 'Contractor', 'An outside contractor account (c.ortiz).'),
    v('service', 'Service account', 'The automated close-export job (svc-close-export), on the rule’s allowlist.'),
  ] },
  { key: 'approval', label: 'Approval', tier: 'L2', op: 'context', values: [
    v('approved', 'Approved ticket', 'A quarter-end export ticket covers this share.'),
    v('none', 'No ticket', 'No approval exists for this access.'),
    v('expired', 'Expired ticket', 'A ticket existed but has lapsed.'),
  ] },
  { key: 'permission', label: 'Permission', tier: 'L1', op: 'lab', values: [
    v('standing', 'Standing grant', 'The account always has read access to the share.'),
    v('jit', 'Just-in-time grant', 'Temporary read access issued against a ticket.'),
    v('none', 'No grant', 'The account has no read access; every read is refused.'),
  ] },
  { key: 'sensitivity', label: 'Data sensitivity', tier: 'L2', op: 'lab', values: [
    v('public', 'Public', 'Files anyone in the company may read.'),
    v('confidential', 'Confidential', 'Finance working files.'),
    v('restricted', 'Restricted', 'Board and payroll material.'),
  ] },
  { key: 'logs', label: 'Log coverage', tier: 'L2', op: 'observation', values: [
    v('complete', 'Complete logs', 'Sign-in and every file access are recorded.'),
    v('partial', 'Partial file logs', 'Only one file-access event in five is kept.'),
    v('no-auth', 'No sign-in logs', 'File access is recorded; sign-in events are missing.'),
  ] },
];
const KEYS = AXES.map(a => a.key);
const LAB_KEYS = AXES.filter(a => a.op === 'lab').map(a => a.key);

export const OPS = {
  lab: { label: 'Lab execution', hint: 'Changes what runs. Each distinct combination is one execution in the lab.' },
  context: { label: 'Context overlay', hint: 'Business context injected by a supplementary component. Never executed; it reuses a lab execution’s record.' },
  observation: { label: 'Observation removal', hint: 'Drops events from a recorded run. Derived from that record; never re-executed.' },
  rule: { label: 'Rule check', hint: 'R1 evaluated on the events the record keeps. Nothing is executed.' },
};

export const CONSTRAINTS = [
  { id: 'C1', text: 'Approvals exist only for confidential or restricted data',
    test: x => x.sensitivity === 'public' && x.approval !== 'none' },
  { id: 'C2', text: 'Just-in-time access is always issued against an approval ticket',
    test: x => x.permission === 'jit' && x.approval === 'none' },
  { id: 'C3', text: 'Service accounts never receive just-in-time grants',
    test: x => x.role === 'service' && x.permission === 'jit' },
  { id: 'C4', text: 'Contractors cannot be approved for restricted data',
    test: x => x.role === 'contractor' && x.sensitivity === 'restricted' && x.approval === 'approved' },
  { id: 'C5', text: 'An approved request is always provisioned with a grant',
    test: x => x.approval === 'approved' && x.permission === 'none' },
];

export const RULE = {
  id: 'R1', threshold: 50, windowMin: 10,
  text: 'Alert when one account successfully reads 50 or more files on a confidential or restricted share within 10 minutes; accounts on the service allowlist are excluded.',
};

export const OUTCOMES = [
  { key: 'caught', label: 'Caught', hint: 'The rule alerts, and the proposed outcome is an alert.' },
  { key: 'missed', label: 'Missed', hint: 'The proposed outcome is an alert; the rule stays quiet.' },
  { key: 'false-alarm', label: 'False alarm', hint: 'The proposed outcome is quiet; the rule alerts.' },
  { key: 'ok', label: 'Quiet, as proposed', hint: 'The proposed outcome is quiet, and the rule stays quiet.' },
  { key: 'surfaced', label: 'Surfaced', hint: 'Alert raised; investigation still required. The evidence is not enough to call it an attack.' },
  { key: 'silent-gap', label: 'Silent gap', hint: 'The evidence is insufficient, so the proposed outcome is “keep investigating”; the rule stays silent.' },
];

export const CLASSES = {
  attack: { label: 'Attack', hint: 'The proposed outcome is an alert.' },
  approved: { label: 'Approved normal', hint: 'An approved business operation; the proposed outcome is quiet.' },
  insufficient: { label: 'Insufficient evidence', hint: 'Logs are missing; the proposed outcome is to ask for more evidence.' },
  benign: { label: 'Benign', hint: 'Public files; the proposed outcome is quiet.' },
};

export const CAUSES = [
  { key: 'denied-not-counted', text: 'The rule counts only successful reads, so refused reads never reach the threshold.' },
  { key: 'service-excluded', text: 'The rule excludes allowlisted service accounts.' },
  { key: 'missing-logs', text: 'With logs missing, the rule sees too few events to act on.' },
  { key: 'approved-alerts', text: 'The rule cannot see the approval ticket.' },
];
const KIND_TEXT = {
  missed: 'an access the proposal says should alert goes unflagged',
  'silent-gap': 'the rule is silent where the proposal says to keep investigating',
  'false-alarm': 'an approved operation raises an alert',
};

/** How each proposed outcome reads in a sentence. */
export const WANT = { alert: 'alert', quiet: 'stay quiet', escalate: 'keep investigating' };

const label = (key, value) => AXES.find(a => a.key === key).values.find(x => x.value === value).label;

/** 'v-analyst-none-standing-confidential-complete', in AXES order. */
export function variantId(values) { return 'v-' + KEYS.map(k => values[k]).join('-'); }

/** Parse an id back into values, or null when it is not a well-formed variant id. */
export function valuesOf(id) {
  const parts = String(id ?? '').replace(/^v-/, '').match(/^(\w+)-(\w+)-(\w+)-(\w+)-(complete|partial|no-auth)$/);
  if (!parts) return null;
  const values = Object.fromEntries(KEYS.map((k, i) => [k, parts[i + 1]]));
  return KEYS.every(k => AXES.find(a => a.key === k).values.some(x => x.value === values[k])) ? values : null;
}

/** Every constraint id the values violate, in CONSTRAINTS order. */
export function violations(values) { return CONSTRAINTS.filter(c => c.test(values)).map(c => c.id); }

/** The proposed expected outcome. A proposal for experts to review, never a verdict. */
export function expected(values) {
  if (values.sensitivity === 'public') return { cls: 'benign', want: 'quiet', why: 'Public files: no alert is expected.' };
  if (values.logs !== 'complete') return { cls: 'insufficient', want: 'escalate', why: 'Logs are missing, so the evidence cannot settle it: keep investigating.' };
  if (values.approval === 'approved') return { cls: 'approved', want: 'quiet', why: 'An approved quarter-end export: no alert is expected.' };
  if (values.permission === 'none') return { cls: 'attack', want: 'alert', why: 'Repeated reads with no grant look like probing: an alert is expected.' };
  return { cls: 'attack', want: 'alert', why: `Bulk reads of ${values.sensitivity} files without a valid approval: an alert is expected.` };
}

/** Synthetic telemetry. It depends only on the lab axes and the log coverage, never on approval. */
export function telemetry(values) {
  const denied = values.permission === 'none';
  const events = [
    { id: 'e-auth', kind: 'auth', dropped: values.logs === 'no-auth' },
    { id: 'e-open', kind: 'share-open', dropped: false },
  ];
  for (let i = 0; i < SEED.reads; i++) {
    events.push({ id: `e-read-${i}`, kind: denied ? 'read-denied' : 'read', dropped: values.logs === 'partial' && i % 5 !== 0 });
  }
  return events;
}

/** R1 on the kept telemetry. The rule sees the share's classification and the allowlist, not the approval. */
export function evaluate(values) {
  const kept = telemetry(values).filter(e => !e.dropped);
  const count = kept.filter(e => e.kind === 'read').length;
  const sensitive = values.sensitivity !== 'public';
  const allowlisted = values.role === 'service';
  const got = sensitive && !allowlisted && count >= RULE.threshold ? 'alert' : 'quiet';
  const why = !sensitive ? 'The share is public, so R1 does not apply.'
    : allowlisted ? 'The account is on the service allowlist, so R1 skips it.'
    : `${count} successful reads in the logs; the threshold is ${RULE.threshold}.`;
  return { got, count, why };
}

/** Rule result against the proposed outcome. */
export function compare(want, got) {
  if (want === 'alert') return got === 'alert' ? 'caught' : 'missed';
  if (want === 'quiet') return got === 'alert' ? 'false-alarm' : 'ok';
  return got === 'alert' ? 'surfaced' : 'silent-gap';
}

/** The lab-execution id: only the axes whose operation is a lab execution. */
export function execId(values) { return LAB_KEYS.map(k => values[k]).join('-'); }

function runOf(values) {
  const ablation = values.logs === 'complete' ? null : values.logs;
  return { exec: execId(values), context: values.approval, ablation, parent: ablation ? variantId({ ...values, logs: 'complete' }) : null };
}

function causeOf(values, outcome) {
  if (!['missed', 'false-alarm', 'silent-gap'].includes(outcome)) return null;
  if (values.permission === 'none') return 'denied-not-counted';
  if (values.role === 'service') return 'service-excluded';
  if (values.logs !== 'complete') return 'missing-logs';
  if (outcome === 'false-alarm' && values.approval === 'approved') return 'approved-alerts';
  return null;
}

/** FNV-1a, 32 bit, as 8 hex digits. */
function fnv1a(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

/** The runtime-graph replay script for one valid variant: nodes, edges, ordered steps and a digest. */
export function trace(values) {
  const bad = violations(values);
  if (bad.length) throw new Error(`${variantId(values)} violates ${bad.join(', ')}`);
  const actor = actorOf(values), exp = expected(values), res = evaluate(values);
  const events = telemetry(values);
  const reads = events.filter(e => e.kind.startsWith('read'));
  const keptReads = reads.filter(e => !e.dropped);
  const nodes = [
    { id: 'account', type: 'Account', label: actor, tier: 'L1' },
    { id: 'role', type: 'Role', label: label('role', values.role), tier: 'L2' },
    { id: 'grant', type: 'Grant', label: label('permission', values.permission), tier: 'L1' },
    { id: 'share', type: 'Share', label: SEED.share, tier: 'L3' },
    { id: 'sensitivity', type: 'Sensitivity', label: label('sensitivity', values.sensitivity), tier: 'L2' },
    { id: 'ticket', type: 'Ticket', label: label('approval', values.approval), tier: 'L2' },
    { id: 'logs', type: 'Log source', label: label('logs', values.logs), tier: 'L2' },
    { id: 'rule', type: 'Rule', label: RULE.id, tier: 'L2' },
  ];
  const edges = [
    { from: 'account', to: 'role', rel: 'HAS_ROLE' },
    { from: 'account', to: 'grant', rel: 'HOLDS' },
    { from: 'grant', to: 'share', rel: 'ON' },
    { from: 'share', to: 'sensitivity', rel: 'CLASSIFIED_AS' },
    { from: 'ticket', to: 'share', rel: 'COVERS' },
    { from: 'logs', to: 'share', rel: 'OBSERVES' },
    { from: 'rule', to: 'logs', rel: 'READS' },
  ];
  const auth = events[0], open = events[1];
  const steps = [
    { kind: 'state', source: 'lab', nodes: ['account', 'role'], text: `${actor} is a ${label('role', values.role).toLowerCase()} account.` },
    { kind: 'state', source: 'lab', nodes: ['grant'], text: `${label('permission', values.permission)} on ${SEED.share}.` },
    { kind: 'state', source: 'lab', nodes: ['share', 'sensitivity'], text: `${SEED.share} holds ${values.sensitivity} files.` },
    { kind: 'state', source: 'context', nodes: ['ticket'], text: `Approval: ${label('approval', values.approval).toLowerCase()} (injected context, not executed).` },
    { kind: 'event', source: auth.dropped ? 'observation' : 'lab', nodes: ['logs'], events: [auth.id], dropped: auth.dropped,
      text: auth.dropped ? `${actor} signs in (not in the logs).` : `${actor} signs in.` },
    { kind: 'event', source: 'lab', nodes: [], events: [open.id], dropped: false, text: `${actor} opens ${SEED.share}.` },
    { kind: 'event', source: keptReads.length < reads.length ? 'observation' : 'lab', nodes: [], events: keptReads.map(e => e.id),
      dropped: keptReads.length < reads.length,
      text: `${reads.length} ${values.permission === 'none' ? 'refused' : 'successful'} reads in ${SEED.windowMin} minutes; ${keptReads.length} in the logs.` },
    { kind: 'check', source: 'rule', nodes: ['rule'], text: `${RULE.id}: ${res.why}` },
    { kind: 'verdict', source: 'rule', nodes: [], text: `Rule ${res.got === 'alert' ? 'alerts' : 'stays quiet'}; proposed: ${WANT[exp.want]}. ${OUTCOMES.find(o => o.key === compare(exp.want, res.got)).label}.` },
  ];
  const digest = fnv1a(JSON.stringify({ values, nodes, edges, steps }));
  return { nodes, edges, steps, digest };
}

/** The ids of the events a variant's record keeps, in order. */
export function keptEvents(values) { return telemetry(values).filter(e => !e.dropped).map(e => e.id); }

/** True when every item of `child` appears in `parent` in the same order. */
export function isSubsequence(child, parent) {
  let j = 0;
  for (const x of child) { while (j < parent.length && parent[j] !== x) j++; if (j === parent.length) return false; j++; }
  return true;
}

/** The two invariant checks shown with a replay. `holds` is null when a check does not apply. */
export function checks(values) {
  const a = trace(values).digest, b = trace(values).digest;
  const run = runOf(values);
  return [
    { id: 'replay', label: 'Replaying the record twice gives the same runtime graph', holds: a === b, detail: `digest ${a} · ${b}` },
    { id: 'subset', label: 'Removing observations only drops events from the parent record', holds: run.parent ? isSubsequence(keptEvents(values), keptEvents(valuesOf(run.parent))) : null,
      detail: run.parent ? `parent ${run.parent}` : 'not an observation-removal derivative' },
  ];
}

function cartesian() {
  let out = [{}];
  for (const a of AXES) out = out.flatMap(o => a.values.map(x => ({ ...o, [a.key]: x.value })));
  return out;
}

/** The whole expansion: every combination, the pruning funnel, the valid variants and the candidate findings. */
export function expand() {
  const all = cartesian().map(values => {
    const violates = violations(values);
    if (violates.length) return { id: variantId(values), values, violates, expected: null, result: null, outcome: null, run: null, review: 'pending' };
    const exp = expected(values), res = evaluate(values);
    return { id: variantId(values), values, violates, expected: exp, result: { ...res, grade: GRADE, ontology: ONTOLOGY_VERSION },
      outcome: compare(exp.want, res.got), run: runOf(values), review: 'pending' };
  });
  const removedBy = Object.fromEntries(CONSTRAINTS.map(c => [c.id, 0]));
  for (const x of all) if (x.violates.length) removedBy[x.violates[0]]++;
  const valid = all.filter(x => !x.violates.length);
  const labRuns = [];
  for (const x of valid) if (!labRuns.some(r => r.exec === x.run.exec)) labRuns.push({ exec: x.run.exec, values: Object.fromEntries(LAB_KEYS.map(k => [k, x.values[k]])) });
  const count = (keys, f) => Object.fromEntries(keys.map(k => [k, valid.filter(x => f(x) === k).length]));
  const findings = [];
  for (const c of CAUSES) for (const o of OUTCOMES) {
    const members = valid.filter(x => x.outcome === o.key && causeOf(x.values, x.outcome) === c.key);
    if (!members.length) continue;
    findings.push({ id: `${o.key}:${c.key}`, kind: o.key, cause: c.key, text: `${c.text} So ${KIND_TEXT[o.key]}.`,
      variants: members.map(x => x.id), example: members[0].id, grade: GRADE, ontology: ONTOLOGY_VERSION, review: 'pending' });
  }
  return {
    all, removedBy, valid, labRuns,
    overlays: valid.filter(x => !x.run.ablation).length,
    derivatives: valid.filter(x => x.run.ablation).length,
    byClass: count(Object.keys(CLASSES), x => x.expected.cls),
    byOutcome: count(OUTCOMES.map(o => o.key), x => x.outcome),
    findings,
  };
}
