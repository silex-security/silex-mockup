// Workflow revisions and their variants. A node's `step` tells the executor what the node does; decision nodes name a
// `guard`; act nodes may name a `statusCapability` the agent can use to recover from a timeout.
import { digestOf } from '../model.js';

const node = (id, label, kind, chip, capability, step, pos, extra = {}) =>
  ({ id, label, kind, chip, capability, step, inputs: extra.inputs ?? '', outputs: extra.outputs ?? '', pos, ...extra });

export const requiredCapabilitiesOf = nodes =>
  [...new Set(nodes.flatMap(n => [n.capability, n.statusCapability]).filter(Boolean))];

function buildWorkflow(spec) {
  const content = { ...spec, source: { label: 'From Speedrun', fixture: true }, requiredCapabilities: requiredCapabilitiesOf(spec.nodes) };
  return { ...content, digest: digestOf(content) };
}

function buildVariant(workflow, { id, name, patch }) {
  const content = { id, name, workflowRef: { id: workflow.id, rev: workflow.rev }, baseDigest: workflow.digest, patch, changedNodeIds: patch.map(p => p.nodeId) };
  return { ...content, digest: digestOf(content) };
}

const baselineTraits = { timeoutRecovery: 'retry_new_key', tone: 'concise' };
const variantTraits = { timeoutRecovery: 'check_status_reuse_key', tone: 'concise' };
const smallModelTraits = { timeoutRecovery: 'stop', tone: 'concise' };

const salesFollowUp = buildWorkflow({
  id: 'wf-sales-follow-up', rev: '1', name: 'Sales follow-up',
  nodes: [
    node('find-opportunity', 'Find opportunity', 'tool', 'CRM', 'crm.find_opportunity', 'fetch', { col: 1, row: 0 }, { inputs: 'Account name', outputs: 'Opportunity, contact' }),
    node('draft-email', 'Draft email', 'model', 'Model', null, 'compose', { col: 1, row: 1 }, { inputs: 'Opportunity, contact', outputs: 'Email draft' }),
    node('contact-allowed', 'Contact allowed?', 'decision', '', 'db.lookup_contact', 'guard', { col: 1, row: 2 }, { guard: 'contact_allowed', inputs: 'Contact email', outputs: 'Yes / No' }),
    node('send-email', 'Send email', 'tool', 'Email', 'email.send_email', 'act', { col: 0, row: 3 }, { statusCapability: 'email.get_send_status', inputs: 'Email draft, approval', outputs: 'Message id' }),
    node('update-crm', 'Update CRM', 'tool', 'CRM', 'crm.update_opportunity', 'follow_up', { col: 0, row: 4 }, { inputs: 'Message id', outputs: 'Opportunity next step' }),
    node('log-skipped', 'Log skipped contact', 'tool', 'CRM', 'crm.log_activity', 'skip', { col: 2, row: 3 }, { inputs: 'Skip reason', outputs: 'Activity' }),
  ],
  edges: [
    { from: 'find-opportunity', to: 'draft-email' },
    { from: 'draft-email', to: 'contact-allowed' },
    { from: 'contact-allowed', to: 'send-email', label: 'Yes' },
    { from: 'contact-allowed', to: 'log-skipped', label: 'No' },
    { from: 'send-email', to: 'update-crm' },
  ],
  policySnapshot: { approvalRequiredFor: ['email.send_email'], optOutGuard: true },
  modelConfig: { 'draft-email': { model: 'simulated-model-baseline', traits: baselineTraits } },
});

const supportTriage = buildWorkflow({
  id: 'wf-support-triage', rev: '1', name: 'Support triage',
  nodes: [
    node('read-ticket', 'Read ticket', 'tool', 'Tickets', 'tickets.get_ticket', 'fetch', { col: 1, row: 0 }, { inputs: 'Ticket id', outputs: 'Ticket' }),
    node('draft-reply', 'Draft reply', 'model', 'Model', null, 'compose', { col: 1, row: 1 }, { inputs: 'Ticket', outputs: 'Reply draft' }),
    node('refund-eligible', 'Refund eligible?', 'decision', '', 'payments.get_charge', 'guard', { col: 1, row: 2 }, { guard: 'refund_eligible', inputs: 'Charge', outputs: 'Yes / No' }),
    node('issue-refund', 'Issue refund', 'tool', 'Payments', 'payments.issue_refund', 'act', { col: 0, row: 3 }, { statusCapability: 'payments.get_refund_status', inputs: 'Charge, approval', outputs: 'Refund id' }),
    node('reply-customer', 'Reply to customer', 'tool', 'Tickets', 'tickets.reply_to_ticket', 'follow_up', { col: 0, row: 4 }, { inputs: 'Refund id', outputs: 'Reply' }),
    node('tag-ineligible', 'Tag not eligible', 'tool', 'Tickets', 'tickets.update_ticket', 'skip', { col: 2, row: 3 }, { inputs: 'Reason', outputs: 'Ticket tag' }),
  ],
  edges: [
    { from: 'read-ticket', to: 'draft-reply' },
    { from: 'draft-reply', to: 'refund-eligible' },
    { from: 'refund-eligible', to: 'issue-refund', label: 'Yes' },
    { from: 'refund-eligible', to: 'tag-ineligible', label: 'No' },
    { from: 'issue-refund', to: 'reply-customer' },
  ],
  policySnapshot: { approvalRequiredFor: ['payments.issue_refund'], optOutGuard: false },
  modelConfig: { 'draft-reply': { model: 'simulated-model-baseline', traits: baselineTraits } },
});

const { digest: _digest, ...supportTriageSpec } = supportTriage;
const supportTriageV2 = buildWorkflow({
  ...supportTriageSpec, id: 'wf-support-triage', rev: '2', name: 'Support triage v2',
  modelConfig: { 'draft-reply': { model: 'simulated-model-baseline', traits: variantTraits } },
});

const meetingScheduling = buildWorkflow({
  id: 'wf-meeting-scheduling', rev: '1', name: 'Meeting scheduling',
  nodes: [
    node('find-contact', 'Find contact', 'tool', 'CRM', 'crm.get_contact', 'fetch', { col: 1, row: 0 }, { inputs: 'Contact id', outputs: 'Contact' }),
    node('propose-times', 'Propose times', 'model', 'Model', null, 'compose', { col: 1, row: 1 }, { inputs: 'Contact', outputs: 'Invitation draft' }),
    node('slot-available', 'Slot available?', 'decision', '', 'calendar.find_free_slots', 'guard', { col: 1, row: 2 }, { guard: 'slot_available', inputs: 'Free slots', outputs: 'Yes / No' }),
    node('create-event', 'Create event', 'tool', 'Calendar', 'calendar.create_event', 'act', { col: 0, row: 3 }, { inputs: 'Slot, attendee', outputs: 'Event id' }),
    node('log-meeting', 'Log meeting', 'tool', 'CRM', 'crm.log_activity', 'follow_up', { col: 0, row: 4 }, { inputs: 'Event id', outputs: 'Activity' }),
    node('log-no-slot', 'Log no availability', 'tool', 'CRM', 'crm.log_activity', 'skip', { col: 2, row: 3 }, { inputs: 'Reason', outputs: 'Activity' }),
  ],
  edges: [
    { from: 'find-contact', to: 'propose-times' },
    { from: 'propose-times', to: 'slot-available' },
    { from: 'slot-available', to: 'create-event', label: 'Yes' },
    { from: 'slot-available', to: 'log-no-slot', label: 'No' },
    { from: 'create-event', to: 'log-meeting' },
  ],
  policySnapshot: { approvalRequiredFor: [], optOutGuard: false },
  modelConfig: { 'propose-times': { model: 'simulated-model-baseline', traits: baselineTraits } },
});

export const WORKFLOWS = Object.freeze([salesFollowUp, supportTriage, supportTriageV2, meetingScheduling]);

export const VARIANTS = Object.freeze([
  buildVariant(salesFollowUp, { id: 'variant-a', name: 'Variant A', patch: [{ nodeId: 'draft-email', model: 'simulated-model-variant-a', traits: variantTraits }] }),
  buildVariant(supportTriage, { id: 'variant-support-a', name: 'Variant A', patch: [{ nodeId: 'draft-reply', model: 'simulated-model-variant-a', traits: variantTraits }] }),
  buildVariant(supportTriageV2, { id: 'variant-support-small', name: 'Small model', patch: [{ nodeId: 'draft-reply', model: 'simulated-model-small', traits: smallModelTraits }] }),
  buildVariant(meetingScheduling, { id: 'variant-meeting-a', name: 'Variant A', patch: [{ nodeId: 'propose-times', model: 'simulated-model-variant-a', traits: variantTraits }] }),
]);

/** The default Variant A for a workflow: every model node moves to the variant model and its traits. */
export const defaultVariantPatch = workflow =>
  workflow.nodes.filter(n => n.kind === 'model').map(n => ({ nodeId: n.id, model: 'simulated-model-variant-a', traits: variantTraits }));

export { buildVariant };
