// Simulated systems over one run's private world. createWorld builds a fresh copy per execution from the environment
// data seed plus the scenario's initialState.patch and overrides; nothing here is shared between runs.
//
// Override vocabulary (ScenarioOverride), checked by overrideProblem:
//   fault       target `${componentId}.${tool}`, value = that component's failureBehavior hook ('timeout_after_send')
//   permission  target `${componentId}.${tool}`, value one of PERMISSION_VALUES
//   data        target a DATA_TARGETS key, value of that target's type
// initialState.patch uses the DATA_TARGETS keys too: { 'contact.optOut': true }.
import { capabilityOf, clone } from '../model.js';

export const PERMISSION_VALUES = Object.freeze(['allowed', 'requires_approval', 'denied']);

const primaryRecord = (world, kind, collection, primaryKey) =>
  world[kind]?.[collection]?.find(r => r.id === world.primary[primaryKey]);

export const DATA_TARGETS = Object.freeze({
  'contact.optOut': { kind: 'db', type: 'boolean', apply: (w, v) => { primaryRecord(w, 'db', 'contacts', 'contact').optOut = v; } },
  'charge.refundable': { kind: 'payments', type: 'boolean', apply: (w, v) => { primaryRecord(w, 'payments', 'charges', 'charge').refundable = v; } },
  'calendar.freeSlots': { kind: 'calendar', type: 'number', apply: (w, v) => { w.calendar.freeSlots = w.calendar.freeSlots.slice(0, v); } },
});

export const primaryContact = world => primaryRecord(world, 'crm', 'contacts', 'contact');
export const primaryConsent = world => primaryRecord(world, 'db', 'contacts', 'contact');
export const primaryCharge = world => primaryRecord(world, 'payments', 'charges', 'charge');

const toolOf = (environment, target) => {
  const [componentId, toolName] = target.split('.');
  const component = environment.components.find(c => c.id === componentId);
  const spec = component?.tools.find(t => t.name === toolName);
  return spec ? { component, spec } : null;
};

export function overrideProblem(environment, override) {
  if (override.kind === 'data') {
    const target = DATA_TARGETS[override.target];
    if (!target) return `unknown data target ${override.target}`;
    if (!(target.kind in environment.dataSeed)) return `${override.target} needs a ${target.kind} component`;
    return typeof override.value === target.type ? null : `${override.target} expects a ${target.type}`;
  }
  if (override.kind !== 'fault' && override.kind !== 'permission') return `unknown override kind ${override.kind}`;
  const found = toolOf(environment, override.target);
  if (!found) return `unknown tool ${override.target}`;
  if (override.kind === 'permission') return PERMISSION_VALUES.includes(override.value) ? null : `unknown permission ${override.value}`;
  return found.component.failureBehavior === override.value ? null : `${found.component.id} has no ${override.value} hook`;
}

// The capability a fault override needs from the environment, e.g. 'email.timeout_after_send'.
export function faultCapabilityOf(environment, override) {
  const found = toolOf(environment, override.target);
  const kind = found?.component.kind ?? override.target.split('.')[0];
  return `${kind}.${override.value}`;
}

const basePermission = (component, spec) =>
  spec.effect === 'read' || component.permission === 'read_write' ? 'allowed'
    : component.permission === 'read_only' ? 'read_only' : 'requires_approval';

export function createWorld(environment, scenario) {
  const world = {
    ...clone(environment.dataSeed),
    outbox: [], writes: [], ledger: {}, violations: [], notices: [],
    approvals: { requested: [], granted: [] }, drafts: [], clarifications: [], cancellations: [],
    permissions: {}, faults: {}, seq: 0,
  };
  for (const c of environment.components) for (const t of c.tools) world.permissions[capabilityOf(c, t.name)] = basePermission(c, t);
  for (const [target, value] of Object.entries(scenario.initialState?.patch ?? {})) DATA_TARGETS[target].apply(world, value);
  for (const o of scenario.overrides ?? []) {
    const { component, spec } = toolOf(environment, o.target) ?? {};
    if (o.kind === 'data') DATA_TARGETS[o.target].apply(world, o.value);
    else if (o.kind === 'permission') world.permissions[capabilityOf(component, spec.name)] = o.value;
    else if (o.kind === 'fault') world.faults[capabilityOf(component, spec.name)] = { kind: o.value, remaining: 1 };
  }
  return world;
}

export const RUNTIME_KEYS = Object.freeze(['permissions', 'faults', 'seq']);
export const finalStateOf = world => Object.fromEntries(Object.entries(clone(world)).filter(([k]) => !RUNTIME_KEYS.includes(k)));

const findByActionOrKey = (world, capability, req) =>
  world.writes.find(w => w.capability === capability && w.idempotencyKey === req.idempotencyKey)
  ?? world.writes.find(w => w.capability === capability && w.actionId === req.actionId);

const statusOf = actCapability => (world, req) => {
  const hit = findByActionOrKey(world, actCapability, req);
  return hit ? { state: 'committed', recordId: hit.recordId } : { state: 'not_found' };
};

// Per-capability behaviour. `read` answers a read tool; `commit` applies a write to the world; `blockedBy` is a
// system-side precondition the adapter enforces whatever the agent decided.
const ADAPTERS = {
  'crm.find_opportunity': { read: w => ({ opportunity: primaryRecord(w, 'crm', 'opportunities', 'opportunity') }) },
  'crm.get_contact': { read: w => ({ contact: primaryContact(w) }) },
  'crm.update_opportunity': { commit: (w, req) => { primaryRecord(w, 'crm', 'opportunities', 'opportunity').nextStep = req.nextStep; } },
  'crm.log_activity': { commit: (w, req, id) => { w.crm.activities.push({ id, kind: req.kind, reason: req.reason }); } },
  'email.search_messages': { read: w => ({ messages: w.email.inbox }) },
  'email.get_send_status': { read: statusOf('email.send_email') },
  'email.send_email': {
    blockedBy: (w, req) => w.db?.contacts.find(c => c.email === req.to)?.optOut ? 'opt_out' : null,
    commit: (w, req, id) => { w.outbox.push({ id, actionId: req.actionId, idempotencyKey: req.idempotencyKey, to: req.to, subject: req.subject, approved: w.approvals.granted.length > 0 }); },
  },
  'calendar.find_free_slots': { read: w => ({ slots: w.calendar.freeSlots }) },
  'calendar.list_events': { read: w => ({ events: w.calendar.events }) },
  'calendar.create_event': { commit: (w, req, id) => { w.calendar.events.push({ id, title: req.title, start: req.slot, attendees: [req.attendee] }); w.calendar.freeSlots = w.calendar.freeSlots.filter(s => s !== req.slot); } },
  'db.lookup_contact': { read: (w, req) => ({ contact: w.db.contacts.find(c => c.email === req.email) ?? null }) },
  'payments.get_charge': { read: w => ({ charge: primaryCharge(w) }) },
  'payments.get_refund_status': { read: statusOf('payments.issue_refund') },
  'payments.issue_refund': { commit: (w, req, id) => { (w.payments.refunds ??= []).push({ id, chargeId: req.chargeId, actionId: req.actionId }); } },
  'tickets.reply_to_ticket': { commit: (w, req, id) => { (w.tickets.replies ??= []).push({ id, body: req.body }); } },
  'tickets.update_ticket': { commit: (w, req, id) => { (w.tickets.tags ??= []).push({ id, kind: req.kind, reason: req.reason }); } },
};

const genericRead = (w, req, kind) => ({ records: Object.keys(w[kind] ?? {}) });

// What each act step sends, built from the world, so both versions issue the same request.
export const ACT_REQUEST = Object.freeze({
  'email.send_email': w => ({ to: primaryContact(w).email, subject: 'Following up on the Acme proposal' }),
  'calendar.create_event': w => ({ slot: w.calendar.freeSlots[0], attendee: primaryContact(w).email, title: 'Intro call with Acme' }),
  'payments.issue_refund': w => ({ chargeId: primaryCharge(w).id }),
});

const violation = (world, kind, capability, attempted = true) => {
  world.violations.push({ kind, capability, attempted, seq: world.seq });
  return kind;
};

/**
 * One tool call against the run's world. Returns the fields a TraceEvent records.
 * @returns {{responseState:'ok'|'timeout'|'denied'|'error', sideEffectState:'none'|'committed'|'deduplicated'|'blocked', attemptedPolicyViolation:boolean, violation:string|null, response:Object}}
 */
export function callTool(world, environment, capability, request = {}) {
  world.seq += 1;
  const [kind, toolName] = capability.split('.');
  const component = environment.components.find(c => c.kind === kind && c.tools.some(t => t.name === toolName));
  const spec = component?.tools.find(t => t.name === toolName);
  const result = (responseState, sideEffectState, response = {}, policy = null) =>
    ({ responseState, sideEffectState, attemptedPolicyViolation: !!policy, violation: policy, response });
  if (!spec || !component.enabledTools.includes(toolName)) return result('error', 'none', { error: `${capability} is not available` });
  const adapter = ADAPTERS[capability] ?? {};
  if (spec.effect === 'read') return result('ok', 'none', (adapter.read ?? genericRead)(world, request, kind));

  const permission = world.permissions[capability];
  if (permission === 'read_only') return result('denied', 'blocked', { reason: `${component.name} is read-only` }, violation(world, 'read_only', capability));
  if (permission === 'denied') return result('denied', 'blocked', { reason: `No permission for ${capability}` }, violation(world, 'permission', capability));
  if (permission === 'requires_approval' && world.approvals.granted.length === 0)
    return result('denied', 'blocked', { reason: 'No trusted approval grant' }, violation(world, 'approval', capability));
  const precondition = adapter.blockedBy?.(world, request);
  if (precondition) return result('denied', 'blocked', { reason: `Blocked: ${precondition}` }, violation(world, precondition, capability));

  const prior = component.dedup !== 'none' && request.idempotencyKey ? world.ledger[request.idempotencyKey] : null;
  if (prior) return result('ok', 'deduplicated', { recordId: prior.recordId });

  const recordId = `${kind}-${world.writes.length + 1}`;
  const duplicateOf = request.actionId ? world.writes.find(w => w.capability === capability && w.actionId === request.actionId) : null;
  const fault = world.faults[capability];
  const timedOut = fault?.kind === 'timeout_after_send' && fault.remaining > 0;
  if (timedOut) fault.remaining -= 1;
  (adapter.commit ?? (() => {}))(world, request, recordId);
  world.writes.push({
    seq: world.seq, capability, componentId: component.id, recordId, step: request.step ?? null, kind: request.kind ?? null,
    actionId: request.actionId ?? null, idempotencyKey: request.idempotencyKey ?? null,
    approved: world.approvals.granted.length > 0, responseState: timedOut ? 'timeout' : 'ok',
  });
  if (request.idempotencyKey) world.ledger[request.idempotencyKey] = { actionId: request.actionId, capability, recordId };
  const duplicate = duplicateOf ? violation(world, 'duplicate', capability, false) : null;
  return { ...result(timedOut ? 'timeout' : 'ok', 'committed', timedOut ? {} : { recordId }), violation: duplicate };
}
