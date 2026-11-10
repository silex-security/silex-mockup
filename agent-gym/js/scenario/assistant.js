// The scripted scenario assistant ("Scripted assistant demo"). No model: a small table of recognised requests, each
// applied through the same reducers the editor uses. It can fill base fields, propose variations and list
// differences. It never confirms an expected behavior: anything it proposes waits for a person in Review & save.
import { VARIATION_COUNT } from '../model.js';
import { PROMPT_TYPE_IDS, typeLabel } from './generate.js';
import { editBase, editDraft, generateBatch, setGenerator } from './draft.js';
import { differences } from './review.js';

export const ASSISTANT_LABEL = 'Scripted assistant demo';
const MAX_INPUT = 300;

const PROMPT_WORDS = [
  [/rephras|reword|paraphras/, 'rephrasing'],
  [/ambigu|vague|unclear/, 'ambiguity'],
  [/noise|noisy|irrelevant/, 'context_noise'],
  [/conflict|skip approval|override/, 'instruction_conflict'],
  [/multi[- ]?turn|cancel|follow-on|two turns/, 'multi_turn'],
];

export const HELP = [
  `I am a ${ASSISTANT_LABEL}: a fixed set of requests, no model. I can:`,
  '· set base fields: "title: …", "task: …", "initial state: …", "expected: …" (you confirm expectations I propose)',
  `· draft prompt variations: "add 2 rephrasings", "add context noise", "more variations" (Count ${VARIATION_COUNT.min} to ${VARIATION_COUNT.max}; types: ${PROMPT_TYPE_IDS.map(t => typeLabel(t)).join(', ')})`,
  '· add one overlay example: "add a timeout", "remove send permission", "contact opted out"',
  '· "show differences" between the base and the selected variations',
].join('\n');

const field = (text, names) => {
  const m = text.match(new RegExp(`^(?:set |change |rename )?(?:the )?(?:${names})\\s*(?:to|:|=)\\s*(.+)$`, 'i'));
  return m ? m[1].trim().replace(/^["“]|["”]$/g, '') : null;
};

/**
 * Reads one request. Returns the steps to run, in order, and the reply when every step succeeds.
 * @returns {{ steps: {run:(state:object)=>object}[], reply: string|((state:object)=>string), by?: string }}
 */
export function interpret(rawText, draftId) {
  const text = rawText.trim();
  const low = text.toLowerCase();
  const base = patch => ({ run: s => editBase(s, { draftId, patch, by: 'assistant' }) });
  const current = s => s.scenarioDrafts[draftId];

  if (!text || /^(help|\?|what can you do)/.test(low)) return { steps: [], reply: HELP };

  const title = field(text, 'title|name');
  if (title) return { steps: [base({ title })], reply: `Base title set to "${title}".` };
  const task = field(text, 'task');
  if (task) return { steps: [base({ task })], reply: `Task set. Variations that follow the base need review again.` };
  const initial = field(text, 'initial state|state');
  if (initial) return { steps: [{ run: s => editBase(s, { draftId, by: 'assistant', patch: { initialState: { ...current(s).base.initialState, summary: initial } } }) }], reply: 'Initial state set. Variations that follow the base need review again.' };
  const expected = field(text, 'expected behaviou?r|expected|expectation');
  if (expected) return {
    steps: [{ run: s => editBase(s, { draftId, by: 'assistant', patch: { expectedBehavior: { ...current(s).base.expectedBehavior, summary: expected } } }) }],
    reply: 'Proposed. I cannot confirm my own expectation: confirm it in Review & save.',
  };

  if (/differen|diff\b|compare|what changed/.test(low)) return {
    steps: [], reply: s => {
      const d = current(s);
      const picked = d.items.filter(i => i.selected);
      if (!picked.length) return 'No variation is selected.';
      return picked.map((i, n) => `${n + 1}. ${i.label}: ${differences(d.base, i).join('; ')}.`).join('\n');
    },
  };

  const overlay = [[/timeout|time out|tool fail/, 'tool_failure'], [/permission|not allowed|denied/, 'permission'], [/opt(ed)?[ -]?out|data|guard/, 'data_state']].find(([re]) => re.test(low));
  const promptTypes = PROMPT_WORDS.filter(([re]) => re.test(low)).map(([, t]) => t);
  if (overlay && !promptTypes.length) return {
    steps: [{ run: s => generateBatch(s, { draftId, dimension: overlay[1], strategy: 'append' }) }],
    reply: s => `Added "${current(s).items.at(-1).label}" with a per-run override. Its expected behavior needs your review.`,
  };

  const number = Number(low.match(/\b(\d{1,3})\b/)?.[1]);
  if (promptTypes.length || /variation|generate|more/.test(low)) {
    const steps = [];
    if (promptTypes.length || number) steps.push({
      run: s => {
        const types = promptTypes.length ? PROMPT_TYPE_IDS.filter(t => promptTypes.includes(t)) : current(s).settings.prompt.types;
        return setGenerator(s, { draftId, dimension: 'prompt', patch: { types, count: number || types.length } });
      },
    });
    steps.push({ run: s => generateBatch(s, { draftId, dimension: 'prompt', strategy: 'append' }) });
    return { steps, reply: s => { const p = current(s).settings.prompt; return `${p.count} prompt variation${p.count === 1 ? '' : 's'} drafted (${p.types.map(t => typeLabel(t)).join(', ')}). Review their expected behaviors.`; } };
  }

  return { steps: [], reply: `I did not recognise that. ${HELP}` };
}

/** One chat turn: the user's text, the steps it maps to, and the assistant's reply or the reason it could not act. */
export const askAssistant = (state, { draftId, text }) => {
  const input = String(text ?? '').slice(0, MAX_INPUT);
  if (!state.scenarioDrafts[draftId]) return { error: { code: 'draft_missing', message: `No scenario draft ${draftId}` } };
  const plan = interpret(input, draftId);
  let next = state, problem = null;
  for (const step of plan.steps) {
    const r = step.run(next);
    if (r.error) { problem = r.error; break; }
    next = r.state;
  }
  if (problem) next = state;
  const reply = problem ? `I could not do that: ${problem.message}` : typeof plan.reply === 'function' ? plan.reply(next) : plan.reply;
  return editDraft(next, draftId, draft => ({ ...draft, chat: [...draft.chat, { role: 'user', text: input }, { role: 'assistant', text: reply }] }));
};
