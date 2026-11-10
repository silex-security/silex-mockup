// The local catalogue of simulated components the environment builder can use, and the labels and field tables
// the builder, the validator and the assistant share. Component specs come from fixtures/environments.js.
import { clone } from '../model.js';
import { ENVIRONMENTS } from '../fixtures/environments.js';

// N2 shows these four with shorter taglines, Gmail with the Custom adapter, and the database as "Customer DB".
const N2_OVERRIDES = {
  salesforce: { description: 'Customer relationship management' },
  gmail: { description: 'Email sending and message management', dedup: 'custom_adapter' },
  gcal: { description: 'Scheduling and meetings' },
  customdb: { name: 'Customer DB', app: 'customdb', description: 'Customer and contact data' },
};

/** @type {ReadonlyArray<{ id: string, origin: 'app'|'custom', component: import('../model.js').Component, seed: Object }>} */
export const CATALOG = Object.freeze(ENVIRONMENTS.flatMap(env => env.components.map(c => Object.freeze({
  id: c.id,
  origin: c.id === 'customdb' ? 'custom' : 'app',
  component: Object.freeze({ ...clone(c), ...N2_OVERRIDES[c.id] }),
  seed: Object.freeze({ [c.kind]: clone(env.dataSeed[c.kind] ?? {}) }),
}))));

export const catalogEntry = id => CATALOG.find(e => e.id === id) ?? null;

export const PERMISSION_LABEL = Object.freeze({ read_write: 'Read and write', read_only: 'Read only', send_requires_approval: 'Send requires approval' });
export const FAILURE_LABEL = Object.freeze({ none: 'None', timeout_after_send: 'Timeout after send' });
export const DEDUP_LABEL = Object.freeze({ none: 'None', idempotency_key: 'Idempotency key', custom_adapter: 'Custom adapter' });

// The fields each kind of component can be linked by, where the value lives, and how two values match.
export const LINK_FIELDS = Object.freeze({
  crm: { email: 'Contact.email', contact_id: 'Contact.id', account: 'Opportunity.account' },
  email: { email: 'Message.from / Message.to' },
  calendar: { email: 'Event.attendees[]' },
  db: { email: 'CustomerRecord.email', contact_id: 'CustomerRecord.id', segment: 'Account.segment' },
  tickets: { customer_id: 'Ticket.customerId', topic: 'Ticket.topic', email: 'Ticket.requesterEmail' },
  payments: { customer_id: 'Charge.customerId' },
  kb: { topic: 'Article.topic' },
  identity: { user_id: 'User.id', email: 'User.email' },
  logs: { user_id: 'LogEvent.userId', resource_id: 'LogEvent.resourceId' },
  cloud: { resource_id: 'Instance.id' },
  erp: { invoice_id: 'Invoice.id', vendor: 'Invoice.vendor' },
  payables: { invoice_id: 'Payment.invoiceId' },
});

export const MATCH_RULE = Object.freeze({
  email: 'Exact match after trimming and lower-casing the address',
  contact_id: 'Exact match on the contact ID',
  customer_id: 'Exact match on the customer ID',
  user_id: 'Exact match on the user ID',
  resource_id: 'Exact match on the resource ID',
});
export const matchRuleOf = field => MATCH_RULE[field] ?? 'Exact match on the field value';

export const DEDUP_CONTRACT = Object.freeze([
  'send_email takes a logical action ID and an idempotency key.',
  'The same key returns the same commit and never writes the outbox twice.',
  'get_send_status returns the committed state for an action ID and key.',
  'A client that retries with a new key can still send twice, so behavior tests require checking the original action and reusing its key.',
  'This contract is a demo fixture setting, not a guarantee of any vendor API.',
]);

export const DEDUP_ASSUMPTION_TEXT = name => `${name} custom adapter deduplicates by idempotency key`;
