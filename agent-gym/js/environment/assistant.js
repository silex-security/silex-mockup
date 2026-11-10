// The scripted assistant demo: a fixed intent table that turns a message into the same commands the editor uses.
// No model is called. interpret() is pure; sendAssistantMessage() is the reducer the chat input dispatches.
//
//   interpret(content, text) -> { ok: true, command } | { ok: false, reply, options }
//   sendAssistantMessage(state, { draftId, text }) -> { state } | { error }
// An applied message appends a user turn and an assistant turn listing the real field changes. Anything else
// appends a help turn with the supported range and clickable options, and changes nothing.
import { CATALOG, LINK_FIELDS } from './catalog.js';
import { appendChat, commitContent, contentOf, describeChanges, runCommand } from './commands.js';

export const SUPPORTED_RANGE = 'This scripted assistant demo understands: make a component read-only or read-write, enable or disable timeout testing, require or drop approval before sending, add or remove a supported component, rename the environment, and link two components by a field.';
export const MAX_MESSAGE = 500;

const ALIASES = {
  salesforce: ['crm'],
  gmail: ['email', 'mail', 'e-mail', 'mailbox'],
  gcal: ['calendar', 'gcal'],
  customdb: ['customer database', 'customer db', 'custom db', 'database', 'db'],
  helpdesk: ['help desk', 'tickets', 'ticketing'],
  payments: ['payment'],
  kb: ['kb'],
  directory: ['identity'],
  auditlog: ['logs'],
  cloud: ['cloud'],
};

const aliasesOf = entry => [entry.component.name.toLowerCase(), entry.id, ...(ALIASES[entry.id] ?? [])];
const strip = phrase => phrase.toLowerCase().replace(/^(the|a|an|my|our)\s+/, '').replace(/\s+(component|app|system|simulator|testing)$/, '').trim();

/** The catalogue entry a phrase names, matching a whole alias first and then the longest alias inside the phrase. */
export function resolveComponent(phrase) {
  const clean = strip(phrase);
  const exact = CATALOG.find(e => aliasesOf(e).includes(clean));
  if (exact) return exact;
  const hits = CATALOG.flatMap(e => aliasesOf(e).filter(a => new RegExp(`\\b${a.replace(/[-]/g, '\\-')}\\b`).test(clean)).map(a => [a.length, e]));
  return hits.sort((x, y) => y[0] - x[0])[0]?.[1] ?? null;
}

const VERBS = 'make|set|mark|allow|enable|disable|turn|require|drop|skip|stop|remove|delete|add|rename|call|link';
const CLAUSE_SPLIT = new RegExp(`(?:[.;!]\\s*|,\\s*(?:and\\s+|then\\s+)?|\\s+(?:and|then)\\s+)(?=(?:${VERBS})\\b)`, 'i');
export const clausesOf = text => text.trim().replace(/[.!\s]+$/, '').split(CLAUSE_SPLIT).map(s => s.trim()).filter(Boolean);

const update = (componentId, patch) => ({ type: 'updateComponent', componentId, patch });
const inDraft = (content, phrase) => {
  const entry = phrase ? resolveComponent(phrase) : null;
  const component = entry && content.components.find(c => c.id === entry.id);
  if (component) return { component };
  if (entry) return { problem: `${entry.component.name} is not in this environment.` };
  return { problem: phrase ? `"${phrase}" is not a component of this environment.` : 'Name a component.' };
};
const emailComponent = (content, phrase) => phrase ? inDraft(content, phrase)
  : content.components.find(c => c.kind === 'email') ? { component: content.components.find(c => c.kind === 'email') } : { problem: 'This environment has no email component.' };
const unsupported = phrase => `${phrase.trim()} is not simulated in this preview. Supported components: ${CATALOG.map(e => e.component.name).join(', ')}.`;

const INTENTS = [
  { re: /^(?:make|set|mark)\s+(.+?)\s+(?:to\s+)?read[- ]?only$/i, build: (c, m) => {
    const { component, problem } = inDraft(c, m[1]);
    return problem ?? update(component.id, { permission: 'read_only', enabledTools: component.tools.filter(t => t.effect === 'read' && component.enabledTools.includes(t.name)).map(t => t.name) });
  } },
  { re: /^(?:make|set|mark)\s+(.+?)\s+(?:to\s+)?read[- ]?(?:and[- ]|\/)?write$|^allow\s+(.+?)\s+(?:updates|writes)$/i, build: (c, m) => {
    const { component, problem } = inDraft(c, m[1] ?? m[2]);
    return problem ?? update(component.id, { permission: 'read_write', enabledTools: component.tools.map(t => t.name) });
  } },
  { re: /^(?:disable|turn\s+off|remove|drop|stop)\s+(?:(.+?)\s+)?timeouts?(?:\s+(?:testing|injection|after\s+send))?(?:\s+(?:on|for)\s+(.+))?$/i, build: (c, m) => {
    const { component, problem } = emailComponent(c, m[1] ?? m[2]);
    return problem ?? update(component.id, { failureBehavior: 'none' });
  } },
  { re: /^(?:enable|turn\s+on|add|allow)\s+(?:(.+?)\s+)?timeouts?(?:\s+(?:testing|injection|after\s+send))?(?:\s+(?:on|for)\s+(.+))?$/i, build: (c, m) => {
    const { component, problem } = emailComponent(c, m[1] ?? m[2]);
    return problem ?? update(component.id, { failureBehavior: 'timeout_after_send' });
  } },
  { re: /^require\s+(?:an?\s+)?approval(?:\s+before\s+(?:sending|sends?))?(?:\s+(?:on|for|in)\s+(.+))?$/i, build: (c, m) => {
    const { component, problem } = emailComponent(c, m[1]);
    return problem ?? update(component.id, { permission: 'send_requires_approval' });
  } },
  { re: /^(?:drop|remove|skip|disable|stop\s+requiring)\s+(?:the\s+)?approvals?(?:\s+(?:step|before\s+sending|before\s+sends?))?(?:\s+(?:on|for|in)\s+(.+))?$/i, build: (c, m) => {
    const { component, problem } = emailComponent(c, m[1]);
    return problem ?? update(component.id, { permission: 'read_write' });
  } },
  { re: /^(?:rename|call)\s+(?:the\s+)?(?:environment\s+)?(?:to\s+|as\s+)?["“']?(.+?)["”']?$/i, build: (c, m) => ({ type: 'rename', name: m[1] }) },
  { re: /^link\s+(.+?)\s+(?:and|to|with)\s+(.+?)\s+(?:by|on|using)\s+(?:the\s+)?([a-z][a-z_ ]*?)(?:\s+field)?$/i, build: (c, m) => {
    const a = inDraft(c, m[1]), b = inDraft(c, m[2]);
    if (a.problem || b.problem) return a.problem ?? b.problem;
    const field = m[3].trim().toLowerCase().replace(/\s+/g, '_');
    if (!LINK_FIELDS[a.component.kind]?.[field] || !LINK_FIELDS[b.component.kind]?.[field]) return `${a.component.name} and ${b.component.name} do not both have a ${field} field.`;
    return { type: 'addRelation', from: a.component.id, to: b.component.id, field };
  } },
  { re: /^add\s+(?:a\s+|an\s+|the\s+)?(.+?)$/i, build: (c, m) => {
    const entry = resolveComponent(m[1]);
    if (!entry) return unsupported(m[1]);
    return c.components.some(x => x.id === entry.id) ? { noop: `${entry.component.name} is already in this environment.` } : { type: 'addComponent', catalogId: entry.id };
  } },
  { re: /^(?:remove|delete)\s+(?:the\s+)?(.+?)$/i, build: (c, m) => {
    const { component, problem } = inDraft(c, m[1]);
    return problem ?? { type: 'removeComponent', componentId: component.id };
  } },
];

/** Example messages the help reply offers, phrased for the components this draft has. */
export function suggestions(content) {
  const has = id => content.components.find(c => c.id === id);
  const db = content.components.find(c => c.kind === 'db');
  const email = content.components.find(c => c.kind === 'email');
  const missing = CATALOG.find(e => e.origin === 'app' && !has(e.id));
  const linkable = has('salesforce') && has('gcal') && !content.relations.some(r => [r.from, r.to].includes('salesforce') && [r.from, r.to].includes('gcal'));
  return [
    db && `Make ${db.name} ${db.permission === 'read_only' ? 'read-write' : 'read-only'}`,
    email && `${email.failureBehavior === 'none' ? 'Enable' : 'Disable'} ${email.name} timeout testing`,
    email && (email.permission === 'send_requires_approval' ? 'Drop approval before sending' : 'Require approval before sending'),
    missing && `Add ${missing.component.name}`,
    linkable && 'Link Salesforce and Google Calendar by email',
    'Rename the environment to Sales sandbox',
  ].filter(Boolean);
}

/** Each clause is built against the content the earlier clauses produced, so "add X and link X and Y" works. */
export function interpret(content, text) {
  const clauses = clausesOf(String(text ?? ''));
  const help = reply => ({ ok: false, reply, options: suggestions(content) });
  if (!clauses.length) return help(SUPPORTED_RANGE);
  const commands = [], changes = [], noops = [];
  let current = content;
  for (const clause of clauses) {
    const intent = INTENTS.find(i => i.re.test(clause));
    if (!intent) return help(`I could not apply "${clause}". ${SUPPORTED_RANGE}`);
    const built = intent.build(current, clause.match(intent.re));
    if (typeof built === 'string') return help(`${built} Nothing was changed.`);
    if (built.noop) { noops.push(built.noop); continue; }
    const next = runCommand(current, built);
    if (next.error) return help(`${next.error.message}. Nothing was changed.`);
    commands.push(built);
    changes.push(...describeChanges(current, next));
    current = next;
  }
  return { ok: true, command: { type: 'batch', commands }, content: current, changes, noops };
}

const chipsIn = text => CATALOG.filter(e => text.toLowerCase().includes(e.component.name.toLowerCase())).map(e => e.id);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function sendAssistantMessage(state, { draftId, text }) {
  const draft = state.environmentDrafts[draftId];
  if (!draft) return { error: { code: 'draft_missing', message: `No environment draft ${draftId}` } };
  const clean = String(text ?? '').trim().slice(0, MAX_MESSAGE);
  if (!clean) return { error: { code: 'empty_message', message: 'Describe a change first' } };
  const user = { role: 'user', text: clean, chips: chipsIn(clean) };
  const helpTurn = (reply, options) => appendChat(state, { draftId, turns: [user, { role: 'assistant', kind: 'help', text: reply, chips: options }] });

  const result = interpret(contentOf(draft), clean);
  if (!result.ok) return helpTurn(result.reply, result.options);
  const { content, changes } = result;
  if (!changes.length) return appendChat(state, { draftId, turns: [user, { role: 'assistant', kind: 'noop', text: `No change needed. ${result.noops.join(' ') || 'The draft already matches.'}` }] });
  const committed = { ...commitContent(draft, content), chat: [...draft.chat, user, { role: 'assistant', kind: 'update', text: `Updated ${plural(changes.length, 'setting')}.`, changes }] };
  return { state: { ...state, environmentDrafts: { ...state.environmentDrafts, [draftId]: committed } } };
}
