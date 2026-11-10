// The N2 starting draft: Sales operations with four simulated components, four field links, and the two-turn
// transcript. The second turn is produced by the scripted assistant itself, so its listed changes are real.
import { clone } from '../model.js';
import { ENVIRONMENTS } from '../fixtures/environments.js';
import { catalogEntry } from './catalog.js';
import { DRAFT_ID, runCommand } from './commands.js';
import { sendAssistantMessage } from './assistant.js';
import { shapeCounts } from './selectors.js';

const salesEnv = ENVIRONMENTS.find(e => e.id === 'env-sales');

export const FIRST_REQUEST = 'Build a sales environment with Salesforce, Gmail, Google Calendar and a customer database. Link contacts by email. Allow CRM updates; require approval before sending.';
export const SECOND_REQUEST = 'Make the customer database read-only and enable Gmail timeout testing.';

/** The draft as the first turn left it: the database still read-write and Gmail without timeout testing. */
function firstTurnContent() {
  const pick = id => clone(catalogEntry(id).component);
  const components = [pick('salesforce'), { ...pick('gmail'), failureBehavior: 'none' }, pick('gcal'), { ...pick('customdb'), permission: 'read_write' }];
  return runCommand({
    name: 'Sales operations', components, relations: clone(salesEnv.relations), dataSeed: clone(salesEnv.dataSeed),
    assumptions: [
      { id: 'info-synthetic-data', componentId: null, text: 'Synthetic customer data', kind: 'info', state: 'pending' },
      { id: 'info-email-approval', componentId: 'gmail', text: 'Email requires approval', kind: 'info', state: 'pending' },
    ],
  }, { type: 'batch', commands: [] });
}

/** @returns {import('../model.js').EnvironmentDraft} */
export function seedDraft() {
  const content = firstTurnContent();
  const draft = {
    id: DRAFT_ID, baseRef: null, revision: 0, ...content, validation: null, history: { past: [], future: [] },
    chat: [
      { role: 'user', kind: 'request', text: FIRST_REQUEST, chips: ['salesforce', 'gmail', 'gcal'] },
      { role: 'assistant', kind: 'apps', text: 'Apps identified', chips: ['salesforce', 'gmail', 'gcal'] },
      { role: 'assistant', kind: 'created', text: `Draft created: ${shapeCounts(content).text.split(' · ').slice(0, 2).join(' · ')}`, changes: content.assumptions.filter(a => a.kind === 'info').map(a => a.text) },
    ],
  };
  const { state, error } = sendAssistantMessage({ environmentDrafts: { [DRAFT_ID]: draft } }, { draftId: DRAFT_ID, text: SECOND_REQUEST });
  if (error) throw Error(`seed draft: ${error.message}`);
  return { ...state.environmentDrafts[DRAFT_ID], revision: 0, history: { past: [], future: [] } };
}

/** Creates the N2 draft when the store has none. A no-op otherwise, so mounting twice never resets edits. */
export function ensureEnvironmentDraft(state, { draftId = DRAFT_ID } = {}) {
  if (state.environmentDrafts[draftId]) return { state };
  return { state: { ...state, environmentDrafts: { ...state.environmentDrafts, [draftId]: seedDraft() } } };
}
