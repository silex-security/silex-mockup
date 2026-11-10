// Scripted executor. Walks a frozen workflow graph for one plan item over a private world (adapters.createWorld).
//
// Scenario contract for the scenario builder:
//
// situationOf(scenario) reads only the request side of a scenario: variation.dimension/type and the message count.
// Faults, permission overlays and data overlays deliberately do not change the situation. The agent must not know a
// fault is coming; it meets the fault through the adapter response and its model traits decide the recovery.
//
//   SITUATION              set by                                      scripted agent decision (both versions)
//   standard               no variation, or prompt 'rephrasing'        draft, then act
//   noisy_context          prompt 'context_noise'                      draft, then act (noise carries no grant)
//   ambiguous_request      prompt 'ambiguity'                          clarify, draft nothing
//   instruction_conflict   prompt 'instruction_conflict'               draft, keep the approval requirement
//   cancel_after_draft     prompt 'multi_turn', or more than 1 message draft, then cancel the pending action
//
// EXPECTED_OUTCOME keys (rules in assertions.js), with the scenario fields that produce each:
//
//   complete_after_approval       base case: scriptedEvents [{ after: 'approval_requested', type: 'approval_grant' }]
//   draft_and_request_approval    base "draft and request approval": no approval_grant event; rephrasing; context_noise
//   clarify                       variation { dimension: 'prompt', type: 'ambiguity' }
//   keep_approval_requirement     variation { dimension: 'prompt', type: 'instruction_conflict' }, no approval_grant
//   cancel_pending                variation { dimension: 'prompt', type: 'multi_turn' }, two ordered messages
//   complete_once_despite_timeout tool failure: overrides [{ kind: 'fault', target: 'gmail.send_email', value: 'timeout_after_send' }]
//                                 plus scriptedEvents [{ after: 'start', type: 'approval_grant' }]
//   report_not_permitted          permission: overrides [{ kind: 'permission', target: 'gmail.send_email', value: 'denied' }]
//   skip_and_log                  data: overrides [{ kind: 'data', target: 'contact.optOut', value: true }]
//                                 or initialState.patch { 'contact.optOut': true }
//   complete                      an act step that needs no approval (meeting scheduling)
//
// SCRIPTED_TRIGGERS are the legal `after` values of scriptedEvents. Prompt text never creates an approval grant.
import { digestOf } from '../model.js';
import { ACT_REQUEST, callTool, createWorld, duplicatesOf, emptyWorld, finalStateOf, primaryCharge, primaryConsent, primaryContact, primaryInvoice } from './adapters.js';
import { evaluateRun } from './assertions.js';

export const SITUATION = Object.freeze(['standard', 'noisy_context', 'ambiguous_request', 'instruction_conflict', 'cancel_after_draft']);
export const SCRIPTED_TRIGGERS = Object.freeze(['start', 'approval_requested']);
export const TIMEOUT_RECOVERY = Object.freeze(['retry_new_key', 'check_status_reuse_key', 'stop']);
export { EXPECTED_OUTCOME } from './assertions.js';

const PROMPT_SITUATION = { rephrasing: 'standard', context_noise: 'noisy_context', ambiguity: 'ambiguous_request', instruction_conflict: 'instruction_conflict', multi_turn: 'cancel_after_draft' };

export function situationOf(scenario) {
  if (scenario.variation?.dimension === 'prompt') return PROMPT_SITUATION[scenario.variation.type] ?? 'standard';
  return scenario.messages.length > 1 ? 'cancel_after_draft' : 'standard';
}

// The scripted model: what the agent decides at the compose step and just before the act step, by situation.
const BEHAVIOR = {
  standard: { compose: 'draft', beforeAct: 'proceed' },
  noisy_context: { compose: 'draft', beforeAct: 'proceed' },
  ambiguous_request: { compose: 'clarify', beforeAct: 'proceed' },
  instruction_conflict: { compose: 'draft', beforeAct: 'proceed' },
  cancel_after_draft: { compose: 'draft', beforeAct: 'cancel' },
};

// Decision nodes. Identical for both versions: they are workflow policy, not model behaviour.
const GUARDS = {
  contact_allowed: w => !(primaryConsent(w) ?? primaryContact(w)).optOut,
  refund_eligible: w => primaryCharge(w).refundable,
  slot_available: w => w.calendar.freeSlots.length > 0,
  invoice_unique: w => duplicatesOf(w).length === 0,
};

const GUARD_REQUEST = {
  'db.lookup_contact': w => ({ email: primaryContact(w).email }),
  'erp.find_duplicates': w => ({ invoiceId: primaryInvoice(w).id }),
};

export function versionModelConfig(snapshot, versionId) {
  const config = structuredClone(snapshot.workflow.modelConfig);
  if (versionId === 'variant') for (const p of snapshot.variant?.patch ?? []) config[p.nodeId] = { model: p.model, traits: p.traits };
  return config;
}

/** Fixed order: scenario (set order, selected only), then repeat, then baseline before variant. */
export function planExecutions(snapshot) {
  const versions = snapshot.variant ? ['baseline', 'variant'] : ['baseline'];
  return snapshot.scenarios.flatMap(s => Array.from({ length: snapshot.repetitions }, (_, i) => i + 1)
    .flatMap(repeatIndex => versions.map(versionId => ({ id: `${s.id}#${repeatIndex}:${versionId}`, versionId, scenarioId: s.id, repeatIndex }))));
}

function createRun(snapshot, planItem, seed, world, scenario) {
  const config = versionModelConfig(snapshot, planItem.versionId);
  const run = {
    snapshot, world, scenario, config,
    traits: Object.assign({}, ...Object.values(config).map(c => c.traits)),
    behavior: BEHAVIOR[situationOf(scenario)],
    actionId: `act-${digestOf([seed, planItem.scenarioId, planItem.repeatIndex])}`,
    keys: 0, events: [],
  };
  run.newKey = () => `key-${digestOf([seed, planItem.id, run.keys++])}`;
  run.emit = (nodeId, type, note, extra = {}) => { run.events.push({ seq: run.events.length + 1, nodeId, type, ...extra, note }); };
  run.tool = (node, capability, request) => {
    const r = callTool(world, snapshot.environment, capability, request);
    const policy = r.attemptedPolicyViolation ? { attemptedPolicyViolation: true } : {};
    run.emit(node.id, r.attemptedPolicyViolation ? 'policy_block' : 'tool_call',
      `${capability} → ${r.responseState}${r.sideEffectState !== 'none' ? ` · ${r.sideEffectState}` : ''}${r.violation ? ` · ${r.violation}` : ''}`,
      { tool: capability, request, responseState: r.responseState, sideEffectState: r.sideEffectState, ...policy });
    return r;
  };
  run.fire = trigger => {
    for (const e of scenario.scriptedEvents ?? []) {
      if (e.after !== trigger || e.type !== 'approval_grant') continue;
      world.approvals.granted.push({ actionId: run.actionId, source: 'scripted_event', after: trigger });
      run.emit('', 'approval', `Approval granted (scripted event after ${trigger})`);
    }
  };
  return run;
}

const actRequest = (run, node, idempotencyKey) =>
  ({ ...(ACT_REQUEST[node.capability]?.(run.world) ?? {}), actionId: run.actionId, idempotencyKey, step: 'act' });

const RECOVERY = {
  retry_new_key(run, node) {
    run.emit(node.id, 'model', 'Response timed out; retrying with a new idempotency key');
    return run.tool(node, node.capability, actRequest(run, node, run.newKey()));
  },
  check_status_reuse_key(run, node, key) {
    run.emit(node.id, 'model', 'Response timed out; checking the send status before any retry');
    const status = node.statusCapability ? run.tool(node, node.statusCapability, { actionId: run.actionId, idempotencyKey: key }) : null;
    if (status?.response.state === 'committed') {
      run.emit(node.id, 'model', 'Already committed; not sending again');
      return status;
    }
    return run.tool(node, node.capability, actRequest(run, node, key));
  },
  stop(run, node) {
    run.emit(node.id, 'model', 'Response timed out; stopping');
    return null;
  },
};

// Each step returns the label of the edge to follow, or null to end the run.
const STEPS = {
  fetch(run, node) {
    run.tool(node, node.capability, {});
    return '';
  },
  compose(run, node) {
    const model = run.config[node.id]?.model ?? 'unconfigured';
    if (run.behavior.compose === 'clarify') {
      run.world.clarifications.push({ nodeId: node.id, question: 'Which contact and what should the message do?' });
      run.emit(node.id, 'model', `${model}: asked to clarify recipient and requested action`);
      return null;
    }
    run.world.drafts.push({ nodeId: node.id, model, actionId: run.actionId });
    run.emit(node.id, 'model', `${model}: drafted`);
    return '';
  },
  guard(run, node) {
    if (node.capability) run.tool(node, node.capability, GUARD_REQUEST[node.capability]?.(run.world) ?? {});
    const allowed = GUARDS[node.guard](run.world);
    run.emit(node.id, 'decision', `${node.label} ${allowed ? 'Yes' : 'No'}`);
    return allowed ? 'Yes' : 'No';
  },
  act(run, node) {
    const { world, snapshot } = run;
    if (run.behavior.beforeAct === 'cancel') {
      world.cancellations.push({ nodeId: node.id, actionId: run.actionId });
      run.emit(node.id, 'note', 'User cancelled; pending action withdrawn');
      return null;
    }
    const permission = world.permissions[node.capability];
    if (permission === 'denied' || permission === 'read_only') {
      world.notices.push({ kind: 'not_permitted', capability: node.capability });
      run.emit(node.id, 'note', `No permission for ${node.capability}; reported instead of attempting`);
      return null;
    }
    const needsApproval = permission === 'requires_approval' || snapshot.workflow.policySnapshot.approvalRequiredFor.includes(node.capability);
    if (needsApproval && world.approvals.granted.length === 0) {
      world.approvals.requested.push({ nodeId: node.id, actionId: run.actionId });
      run.emit(node.id, 'approval', 'Approval requested');
      run.fire('approval_requested');
      if (world.approvals.granted.length === 0) {
        run.emit(node.id, 'note', 'Waiting for approval; nothing sent');
        return null;
      }
    }
    const key = run.newKey();
    let r = run.tool(node, node.capability, actRequest(run, node, key));
    if (r.responseState === 'timeout') r = RECOVERY[run.traits.timeoutRecovery in RECOVERY ? run.traits.timeoutRecovery : 'stop'](run, node, key);
    return r && r.responseState === 'ok' ? '' : null;
  },
  follow_up(run, node) {
    run.tool(node, node.capability, { step: 'follow_up', kind: 'follow_up', nextStep: 'Awaiting reply', reason: 'Action completed' });
    return '';
  },
  skip(run, node) {
    run.tool(node, node.capability, { step: 'skip', kind: 'skip', reason: 'Contact opted out or not eligible' });
    return '';
  },
};

function walk(run) {
  const { nodes, edges } = run.snapshot.workflow;
  let node = nodes.find(n => !edges.some(e => e.to === n.id));
  for (let steps = 0; node && steps < nodes.length; steps++) {
    const label = STEPS[node.step](run, node);
    if (label === null) return;
    const next = edges.find(e => e.from === node.id && (e.label ?? '') === label);
    node = next && nodes.find(n => n.id === next.to);
  }
}

/**
 * Deterministic: same snapshot, plan item and seed give a deep-equal result. Own world per call. Never throws: a
 * scenario, world or step the simulation cannot run ends in an 'error' execution whose last event says why.
 */
export function runExecution(snapshot, planItem, seed) {
  const base = { id: planItem.id, attemptId: null, versionId: planItem.versionId, scenarioId: planItem.scenarioId, repeatIndex: planItem.repeatIndex, evidenceGrade: 'simulated' };
  let world = emptyWorld(), initialStateDigest = null, run = null;
  try {
    const scenario = snapshot.scenarios.find(s => s.id === planItem.scenarioId);
    if (!scenario) throw Error(`${planItem.scenarioId} is not in this attempt`);
    world = createWorld(snapshot.environment, scenario);
    initialStateDigest = digestOf(finalStateOf(world));
    run = createRun(snapshot, planItem, seed, world, scenario);
    run.fire('start');
    walk(run);
    const finalState = finalStateOf(world);
    const assertionResults = evaluateRun(scenario, finalState);
    return { ...base, initialStateDigest, events: run.events, finalState, assertionResults, terminalState: assertionResults.every(a => a.pass) ? 'passed' : 'failed' };
  } catch (err) {
    const events = run?.events ?? [];
    const note = { seq: events.length + 1, nodeId: '', type: 'note', note: `Simulation error: ${err.message}` };
    return { ...base, initialStateDigest, events: [...events, note], finalState: finalStateOf(world), assertionResults: [], terminalState: 'error' };
  }
}
