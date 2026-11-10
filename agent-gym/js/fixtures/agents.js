// The agent registry. Every workflow step names the agent that performs it; an agent that appears in more than one
// workflow is shared, and a change to it reaches all of them.
export const AGENTS = Object.freeze([
  { id: 'agent-records', name: 'Records agent' },
  { id: 'agent-correspondence', name: 'Correspondence agent' },
  { id: 'agent-scheduling', name: 'Scheduling agent' },
  { id: 'agent-policy', name: 'Policy guard agent' },
  { id: 'agent-crm', name: 'CRM clerk' },
  { id: 'agent-outbound', name: 'Outbound sender' },
  { id: 'agent-refunds', name: 'Refund agent' },
  { id: 'agent-ledger', name: 'Ledger clerk' },
].map(Object.freeze));
