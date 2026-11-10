// Environment template revisions. Every record is synthetic; "Alex at Acme" is the example contact.
import { capabilityOf, digestOf, refKey } from '../model.js';

const tool = (name, effect, input, output) => ({ name, effect, input, output });

const component = ({ tools, enabledTools = tools.map(t => t.name), permission = 'read_write', failureBehavior = 'none', dedup = 'none', ...rest }) =>
  ({ ...rest, mode: 'simulated', tools, enabledTools, permission, failureBehavior, dedup });

export const deriveCapabilities = components =>
  components.flatMap(c => c.tools.filter(t => c.enabledTools.includes(t.name)).map(t => capabilityOf(c, t.name)));

export const deriveFaultCapabilities = components =>
  components.filter(c => c.failureBehavior !== 'none').map(c => `${c.kind}.${c.failureBehavior}`);

export function buildEnvironmentRevision(spec) {
  const content = { ...spec, capabilities: deriveCapabilities(spec.components), faultCapabilities: deriveFaultCapabilities(spec.components) };
  const digest = digestOf(content);
  return { ...content, validation: { digest, errors: [], warnings: [], pendingAssumptionIds: [], status: 'validated' }, digest };
}

const salesforce = component({
  id: 'salesforce', kind: 'crm', app: 'salesforce', name: 'Salesforce', category: 'CRM', pos: { x: 0, y: 0 },
  description: 'Simulated CRM with opportunities, contacts and activity log.',
  tools: [
    tool('find_opportunity', 'read', { account: 'string' }, { opportunity: 'Opportunity' }),
    tool('get_contact', 'read', { contactId: 'string' }, { contact: 'Contact' }),
    tool('update_opportunity', 'write', { opportunityId: 'string', nextStep: 'string' }, { opportunity: 'Opportunity' }),
    tool('log_activity', 'write', { contactId: 'string', kind: 'string', reason: 'string' }, { activityId: 'string' }),
  ],
});

const gmail = component({
  id: 'gmail', kind: 'email', app: 'gmail', name: 'Gmail', category: 'Email', pos: { x: 1, y: 0 },
  description: 'Simulated mailbox. Sends need a trusted approval grant; dedup by idempotency key.',
  tools: [
    tool('search_messages', 'read', { query: 'string' }, { messages: 'Message[]' }),
    tool('send_email', 'write', { actionId: 'string', idempotencyKey: 'string', to: 'string', subject: 'string' }, { messageId: 'string' }),
    tool('get_send_status', 'read', { actionId: 'string', idempotencyKey: 'string' }, { state: 'string', messageId: 'string' }),
  ],
  permission: 'send_requires_approval', failureBehavior: 'timeout_after_send', dedup: 'idempotency_key',
});

const gcal = component({
  id: 'gcal', kind: 'calendar', app: 'gcal', name: 'Google Calendar', category: 'Calendar', pos: { x: 1, y: 1 },
  description: 'Simulated calendar with events and free slots.',
  tools: [
    tool('find_free_slots', 'read', { attendee: 'string' }, { slots: 'string[]' }),
    tool('list_events', 'read', { attendee: 'string' }, { events: 'Event[]' }),
    tool('create_event', 'write', { actionId: 'string', idempotencyKey: 'string', slot: 'string', attendee: 'string' }, { eventId: 'string' }),
  ],
});

const customdb = component({
  id: 'customdb', kind: 'db', app: 'database', name: 'Custom DB', category: 'Database', pos: { x: 0, y: 1 },
  description: 'Read-only customer database with contact consent and opt-out flags.',
  tools: [
    tool('lookup_contact', 'read', { email: 'string' }, { contact: 'CustomerRecord' }),
    tool('query_accounts', 'read', { segment: 'string' }, { accounts: 'Account[]' }),
  ],
  permission: 'read_only',
});

const sales = buildEnvironmentRevision({
  id: 'env-sales', rev: '1.2', name: 'Sales operations', icon: 'database',
  caps: ['CRM', 'Email', 'Calendar'], notes: ['Shared contacts', 'Permissions', 'Tool behavior'],
  components: [salesforce, gmail, gcal, customdb],
  relations: [
    { id: 'rel-sf-gmail', from: 'salesforce', to: 'gmail', field: 'email' },
    { id: 'rel-sf-db', from: 'salesforce', to: 'customdb', field: 'contact_id' },
    { id: 'rel-db-gcal', from: 'customdb', to: 'gcal', field: 'email' },
    { id: 'rel-gmail-gcal', from: 'gmail', to: 'gcal', field: 'email' },
  ],
  dataSeed: {
    primary: { contact: 'ct-alex', opportunity: 'opp-1042' },
    crm: {
      contacts: [
        { id: 'ct-alex', name: 'Alex Rivera', email: 'alex@acme.example', account: 'Acme' },
        { id: 'ct-jordan', name: 'Jordan Lee', email: 'jordan@birchwood.example', account: 'Birchwood Labs' },
      ],
      opportunities: [{ id: 'opp-1042', contactId: 'ct-alex', account: 'Acme', stage: 'Proposal sent', nextStep: 'Follow up on proposal' }],
      activities: [],
    },
    email: { inbox: [{ id: 'msg-311', from: 'alex@acme.example', subject: 'Re: Acme proposal', receivedAt: '2026-11-03' }] },
    calendar: {
      events: [{ id: 'evt-71', title: 'Acme pipeline review', start: '2026-11-12T15:00', attendees: ['alex@acme.example'] }],
      freeSlots: ['2026-11-13T10:00', '2026-11-13T14:00'],
    },
    db: {
      contacts: [
        { id: 'ct-alex', email: 'alex@acme.example', optOut: false, consentSource: 'Signed proposal' },
        { id: 'ct-jordan', email: 'jordan@birchwood.example', optOut: false, consentSource: 'Webinar sign-up' },
      ],
      accounts: [{ id: 'acct-acme', name: 'Acme', segment: 'Mid-market' }],
    },
  },
});

const support = buildEnvironmentRevision({
  id: 'env-support', rev: '1.2', name: 'Customer support', icon: 'headset',
  caps: ['Tickets', 'Payments', 'Knowledge base'], notes: ['Refund approvals', 'Ticket history', 'Policy articles'],
  components: [
    component({
      id: 'helpdesk', kind: 'tickets', app: 'tickets', name: 'Helpdesk', category: 'Tickets', pos: { x: 0, y: 0 },
      description: 'Simulated ticket queue with replies and tags.',
      tools: [
        tool('get_ticket', 'read', { ticketId: 'string' }, { ticket: 'Ticket' }),
        tool('update_ticket', 'write', { ticketId: 'string', kind: 'string', reason: 'string' }, { ticket: 'Ticket' }),
        tool('reply_to_ticket', 'write', { ticketId: 'string', body: 'string' }, { replyId: 'string' }),
      ],
    }),
    component({
      id: 'payments', kind: 'payments', app: 'payments', name: 'Payments', category: 'Payments', pos: { x: 1, y: 0 },
      description: 'Simulated payment processor. Refunds need a trusted approval grant; dedup by idempotency key.',
      tools: [
        tool('get_charge', 'read', { chargeId: 'string' }, { charge: 'Charge' }),
        tool('issue_refund', 'write', { actionId: 'string', idempotencyKey: 'string', chargeId: 'string' }, { refundId: 'string' }),
        tool('get_refund_status', 'read', { actionId: 'string', idempotencyKey: 'string' }, { state: 'string', refundId: 'string' }),
      ],
      permission: 'send_requires_approval', failureBehavior: 'timeout_after_send', dedup: 'idempotency_key',
    }),
    component({
      id: 'kb', kind: 'kb', app: 'book', name: 'Knowledge base', category: 'Knowledge base', pos: { x: 0, y: 1 },
      description: 'Read-only policy and help articles.',
      tools: [
        tool('search_articles', 'read', { query: 'string' }, { articles: 'Article[]' }),
        tool('get_article', 'read', { articleId: 'string' }, { article: 'Article' }),
      ],
      permission: 'read_only',
    }),
  ],
  relations: [
    { id: 'rel-helpdesk-payments', from: 'helpdesk', to: 'payments', field: 'customer_id' },
    { id: 'rel-helpdesk-kb', from: 'helpdesk', to: 'kb', field: 'topic' },
  ],
  dataSeed: {
    primary: { ticket: 'tkt-5521', charge: 'ch-8830' },
    tickets: { tickets: [{ id: 'tkt-5521', customerId: 'cus-204', subject: 'Charged twice for the November invoice', status: 'open', priority: 'high' }] },
    payments: { charges: [{ id: 'ch-8830', customerId: 'cus-204', amount: 129, currency: 'USD', refundable: true }] },
    kb: { articles: [{ id: 'kb-12', title: 'Refund policy', topic: 'billing' }, { id: 'kb-31', title: 'Duplicate charges', topic: 'billing' }] },
  },
});

const it = buildEnvironmentRevision({
  id: 'env-it', rev: '1.1', name: 'IT operations', icon: 'laptop',
  caps: ['Identity', 'Logs', 'Cloud'], notes: ['Access reviews', 'Audit logs', 'Change windows'],
  components: [
    component({
      id: 'directory', kind: 'identity', app: 'identity', name: 'Directory', category: 'Identity', pos: { x: 0, y: 0 },
      description: 'Simulated identity directory with users and MFA factors.',
      tools: [
        tool('get_user', 'read', { userId: 'string' }, { user: 'User' }),
        tool('disable_user', 'write', { actionId: 'string', idempotencyKey: 'string', userId: 'string' }, { user: 'User' }),
        tool('reset_mfa', 'write', { actionId: 'string', idempotencyKey: 'string', userId: 'string' }, { user: 'User' }),
      ],
      permission: 'send_requires_approval', dedup: 'idempotency_key',
    }),
    component({
      id: 'auditlog', kind: 'logs', app: 'logs', name: 'Audit log', category: 'Logs', pos: { x: 1, y: 0 },
      description: 'Read-only sign-in and change events.',
      tools: [
        tool('search_logs', 'read', { query: 'string' }, { events: 'LogEvent[]' }),
        tool('get_event', 'read', { eventId: 'string' }, { event: 'LogEvent' }),
      ],
      permission: 'read_only',
    }),
    component({
      id: 'cloud', kind: 'cloud', app: 'cloud', name: 'Cloud console', category: 'Cloud', pos: { x: 0, y: 1 },
      description: 'Simulated compute instances and volume snapshots.',
      tools: [
        tool('list_instances', 'read', { project: 'string' }, { instances: 'Instance[]' }),
        tool('stop_instance', 'write', { actionId: 'string', idempotencyKey: 'string', instanceId: 'string' }, { instance: 'Instance' }),
        tool('snapshot_volume', 'write', { actionId: 'string', idempotencyKey: 'string', volumeId: 'string' }, { snapshotId: 'string' }),
      ],
      failureBehavior: 'timeout_after_send', dedup: 'idempotency_key',
    }),
  ],
  relations: [
    { id: 'rel-directory-auditlog', from: 'directory', to: 'auditlog', field: 'user_id' },
    { id: 'rel-auditlog-cloud', from: 'auditlog', to: 'cloud', field: 'resource_id' },
  ],
  dataSeed: {
    primary: { user: 'u-casey', instance: 'i-7f21' },
    identity: { users: [{ id: 'u-casey', name: 'Casey Morgan', email: 'casey@acme.example', status: 'active', mfa: 'totp' }] },
    logs: { events: [{ id: 'log-9001', userId: 'u-casey', type: 'sign_in', location: 'Unrecognized device', at: '2026-11-08T02:14' }] },
    cloud: { instances: [{ id: 'i-7f21', project: 'billing-api', state: 'running' }], snapshots: [] },
  },
});

export const ENVIRONMENTS = Object.freeze([sales, support, it]);
export const environmentsByKey = () => Object.fromEntries(ENVIRONMENTS.map(e => [refKey(e), e]));
