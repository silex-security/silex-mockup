/* The node catalog shown in the library and in "+" search (plan §3.3): one
   entry per model type with its icon, colour token, an English label and a
   one-line explanation, and search synonyms. Chinese lives in i18n/zh.js
   under the same keys. */
import { t } from '../i18n/index.js';

export const CATALOG = [
  { type: 'trigger', group: 'inputs', color: 'var(--c-trigger)', icon: 'M5 12h10M11 6l6 6-6 6', label: 'Trigger', desc: 'Where a request enters the workflow: chat, email, API event or ticket.', syn: 'start input entry request event' },
  { type: 'agent', group: 'agents', color: 'var(--c-agent)', icon: 'M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM5 20c0-3.3 3.1-6 7-6s7 2.7 7 6', label: 'Agent role', desc: 'An AI agent that reads data and acts with the capabilities and limits you give it.', syn: 'ai llm assistant worker role' },
  { type: 'tool', group: 'agents', color: 'var(--c-tool)', icon: 'M14 6l4 4-8 8H6v-4zM13 7l4 4', label: 'Tool / API', desc: 'A system call such as a payment or record update. A write checks the calling agent’s capability.', syn: 'api mcp integration action write system' },
  { type: 'decision', group: 'logic', color: 'var(--c-decision)', icon: 'M12 3l8 9-8 9-8-9z', label: 'Condition', desc: 'Sends the request down the yes or no branch by a rule, e.g. amount > 500.', syn: 'if branch rule decision condition threshold' },
  { type: 'control', group: 'logic', color: 'var(--c-control)', icon: 'M12 3l7 3v6c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6z', label: 'Approval / policy gate', desc: 'A human approval, dual approval, or an automatic policy gate that blocks or redacts.', syn: 'approval approve gate policy human review control checkpoint' },
  { type: 'data', group: 'data', color: 'var(--c-data)', icon: 'M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zm0 0v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7', label: 'Data resource', desc: 'Data an agent or tool reads, with its sensitivity (public, internal, secret).', syn: 'database record secret credential knowledge' },
  { type: 'outcome', group: 'outcomes', color: 'var(--c-outcome)', icon: 'M5 12l4 4 10-10', label: 'Outcome', desc: 'Where a request ends: resolved, declined, or notified.', syn: 'end finish result done notify' },
  { type: 'prohibited', group: 'outcomes', color: 'var(--c-prohibited)', icon: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM6 6l12 12', label: 'Monitor (prohibited outcome)', desc: 'An outcome that must never happen, checked in every simulated run.', syn: 'monitor prohibited risk violation forbidden unsafe' }
];
export const GROUPS = [['inputs', 'Inputs'], ['agents', 'Agents & tools'], ['logic', 'Logic & approvals'], ['data', 'Data'], ['outcomes', 'Outcomes & monitors']];
export const MONITORS = [
  { kind: 'unauthorized_write', label: 'Unauthorized write', desc: 'A write above the threshold without its own proper approval.', on: ['tool'] },
  { kind: 'duplicate_effect', label: 'Duplicate effect', desc: 'The same order is paid or changed twice by two requests.', on: ['tool'] },
  { kind: 'secret_exposure', label: 'Secret exposure', desc: 'Secret data reaches a message sent outside.', on: ['outcome'] }
];
export const entry = type => CATALOG.find(c => c.type === type);
export const typeLabel = type => t(`node.${type}.label`, entry(type)?.label || type);
export const typeDesc = type => t(`node.${type}.desc`, entry(type)?.desc || '');
export const typeSyn = type => `${entry(type)?.syn || ''} ${t(`node.${type}.syn`, '')}`;
export const groupLabel = g => t(`group.${g}`, GROUPS.find(x => x[0] === g)?.[1] || g);
export const monitorLabel = k => t(`monitor.${k}.label`, MONITORS.find(m => m.kind === k)?.label || k);
export const monitorDesc = k => t(`monitor.${k}.desc`, MONITORS.find(m => m.kind === k)?.desc || '');
