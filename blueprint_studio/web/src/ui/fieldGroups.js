/* Progressive disclosure (plan §3.4): which schema fields of each node type are
   Basic (always shown) and which are Advanced (collapsed), with the English
   label and help line for each. model.js schemas are untouched; the panel still
   honours each field's `when`. Chinese under keys field.<key> / help.<type>.<key>. */
export const FIELD_GROUPS = {
  trigger: { basic: ['channel', 'trust'], advanced: [] },
  agent: { basic: ['candidate', 'capabilities'], advanced: ['canSplit', 'outputCeiling', 'join'] },
  tool: { basic: ['cap', 'sideEffect'], advanced: ['idempotencyKey', 'join'] },
  decision: { basic: ['condition'], advanced: ['join'] },
  control: { basic: ['kind', 'appliesWhen', 'binding', 'action', 'rule', 'redactAbove'], advanced: ['singleUse', 'slaMinutes', 'join'] },
  data: { basic: ['sensitivity'], advanced: [] },
  outcome: { basic: ['success', 'external'], advanced: ['join'] },
  prohibited: { basic: ['monitor', 'severity', 'threshold', 'cap'], advanced: ['scope', 'minApprovers', 'probeRange', 'watches'] }
};
export const FIELD_LABEL = {
  channel: 'Channel', trust: 'Input trust', candidate: 'Implementation', capabilities: 'Can write (capability · limit)', canSplit: 'May split one request into several writes',
  outputCeiling: 'Most sensitive data it may output', join: 'When several paths arrive', cap: 'Capability', sideEffect: 'Side effect', idempotencyKey: 'Refuse a second write for the same order',
  condition: 'Condition', kind: 'Kind', appliesWhen: 'Only when (empty = always)', binding: 'Approval is tied to', singleUse: 'Approval can be used once', slaMinutes: 'Approver response time (minutes)',
  action: 'Gate action', rule: 'Pass when', redactAbove: 'Remove data more sensitive than', sensitivity: 'Sensitivity', success: 'Counts as a successful outcome', external: 'Sent to the requester',
  monitor: 'What must never happen', threshold: 'Approval needed above', scope: 'Add amounts up per', minApprovers: 'Minimum approvers', probeRange: 'Amounts the attack scenarios try', severity: 'Severity', watches: 'Watches'
};
export const FIELD_HELP = {
  trust: 'Untrusted input may carry injected instructions in the simulation.',
  capabilities: 'A write tool checks the last agent on the path for this capability and limit.',
  canSplit: 'In the split scenario this agent divides one request into several smaller writes.',
  outputCeiling: 'Normally it outputs data up to this level; an injected instruction makes it output everything it read.',
  join: '“first” continues on the first arrival; “all” waits for every incoming path (untaken branches count as done).',
  cap: 'The capability a write needs, e.g. refund.issue.', idempotencyKey: 'A second request for the same customer and order is refused.',
  condition: 'Variables: amount, dayTotal, customer, order, channel, trust, eligible.',
  appliesWhen: 'When this is false the request passes without an approval.',
  binding: 'A presented approval is accepted only if these fields match the request.',
  singleUse: 'A used approval cannot be presented again.',
  rule: 'Block gate: the request passes when this is true.',
  threshold: 'The business rule: writes above this total need their own approval.',
  probeRange: 'Adversary scenarios draw amounts from this range. It is not a monitor rule.',
  watches: 'The tools or outcomes this monitor is about.'
};
