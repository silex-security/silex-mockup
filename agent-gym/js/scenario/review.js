// Review and save for the N3 builder. Structural checks for a scenario spec, confirm and edit reducers, and the save
// that writes reviewed Scenario records and a new immutable ScenarioSetRevision.
import { digestOf, refKey } from '../model.js';
import { dataTargetProblem, overrideProblem } from '../simulation/adapters.js';
import { CHECK_OPS, CHECK_PATHS, EXPECTED_OUTCOME } from '../simulation/assertions.js';
import { SCRIPTED_TRIGGERS } from '../simulation/executor.js';
import { LIMITS, cleanSpecPatch, contextOf, editDraft } from './draft.js';
import { NO_SIDE_EFFECT_OUTCOMES, actTarget, requiresSideEffect } from './generate.js';

const fail = (code, message) => ({ error: { code, message } });

const SEND_BEFORE_APPROVAL = ['outbox.countBeforeApproval', 'action.committedBeforeApproval'];

const allowsUnapprovedSend = check => requiresSideEffect(check)
  || (SEND_BEFORE_APPROVAL.includes(check.path) && !((check.op === '==' || check.op === '<=') && Number(check.value) === 0));

/** Whether the workflow's act step waits for approval in this environment, by the same rule the executor applies. */
export function actNeedsApproval(environment, workflow) {
  const target = actTarget(environment, workflow);
  return !!target && (workflow.policySnapshot.approvalRequiredFor.includes(target.capability) || target.component.permission === 'send_requires_approval');
}

/** Why an expectation would let the action go ahead without approval, or null when it keeps the requirement. */
export function approvalDropReason(spec) {
  if (!NO_SIDE_EFFECT_OUTCOMES.includes(spec.expectedBehavior.outcome)) return `"${EXPECTED_OUTCOME[spec.expectedBehavior.outcome]?.label ?? spec.expectedBehavior.outcome}" lets the action go ahead`;
  if (spec.scriptedEvents.some(e => e.type === 'approval_grant')) return 'a scripted approval grant would let it send';
  const check = spec.stateChecks.find(allowsUnapprovedSend);
  if (check) return `the check ${check.path} ${check.op} ${check.value} expects a send`;
  return null;
}

/** Structural problems of a base or variation spec in its environment and workflow. Empty means it can be confirmed. */
export function scenarioProblems(spec, context, meta = {}) {
  const out = [];
  const add = (code, message) => out.push({ code, message });
  if (!(spec.title ?? spec.label)?.trim()) add('title_missing', 'Give the scenario a title.');
  if (!spec.messages.length || spec.messages.some(m => !m.text.trim())) add('prompt_missing', 'Every prompt turn needs text.');
  if (!spec.task?.trim()) add('task_missing', 'Describe the task.');
  if (!spec.initialState.summary.trim()) add('initial_state_missing', 'Describe the initial state.');
  if (!spec.expectedBehavior.summary.trim()) add('expected_missing', 'Describe the expected behavior.');
  for (const c of spec.stateChecks) if (!c.label?.trim()) add('check_label_missing', `Name the check ${c.path}.`);
  return [...out, ...runProblems(spec, context, meta)];
}

/** The problems that change what a run does or how it is judged. The run gate repeats exactly these. */
export function runProblems(spec, { environment, workflow }, { dimension = null, type = null } = {}) {
  const out = [];
  const add = (code, message) => out.push({ code, message });
  if (type === 'multi_turn' && spec.messages.length < 2) add('turns_missing', 'A multi-turn variation needs at least two ordered turns.');
  if (!(spec.expectedBehavior.outcome in EXPECTED_OUTCOME)) add('unknown_outcome', `Unknown expected outcome ${spec.expectedBehavior.outcome}.`);
  for (const c of spec.stateChecks) if (!CHECK_PATHS.includes(c.path) || !CHECK_OPS.includes(c.op)) add('unknown_check_path', `Unsupported check ${c.path} ${c.op}.`);
  for (const [k, v] of Object.entries(spec.initialState.patch)) { const p = dataTargetProblem(environment, k, v); if (p) add('unknown_patch', `Unsupported initial state: ${p}.`); }
  if (dimension === 'prompt' && spec.overrides.length) add('prompt_overrides', 'A prompt variation keeps the environment fixed and carries no overrides.');
  for (const o of spec.overrides) { const p = environment && overrideProblem(environment, o); if (p) add('unknown_override', p); }
  for (const e of spec.scriptedEvents) if (!SCRIPTED_TRIGGERS.includes(e.after) || e.type !== 'approval_grant') add('unknown_scripted_event', 'Unsupported scripted event.');
  if (type === 'instruction_conflict') {
    const reason = approvalDropReason(spec);
    if (!actNeedsApproval(environment, workflow)) add('no_approval_to_keep', `An instruction conflict tests an approval requirement, and ${workflow?.name ?? 'this workflow'} has none here. Deselect it or choose a workflow that asks for approval.`);
    else if (reason) add('drops_approval', `An instruction conflict must keep the approval requirement of ${workflow.name}: ${reason}.`);
  }
  return out;
}

const textOf = messages => messages.map(m => (messages.length > 1 ? `Turn ${m.turn}: ${m.text}` : m.text)).join(' ');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** What a variation changes against the base, in words. */
export function differences(base, item) {
  const out = [];
  if (!same(base.messages, item.messages)) out.push(item.messages.length > 1 ? `${item.messages.length} ordered turns instead of one` : 'Prompt reworded');
  if (base.expectedBehavior.outcome !== item.expectedBehavior.outcome) out.push(`Expected outcome: ${EXPECTED_OUTCOME[item.expectedBehavior.outcome]?.label ?? item.expectedBehavior.outcome}`);
  else if (base.expectedBehavior.summary !== item.expectedBehavior.summary) out.push('Same expected outcome, reworded');
  if (!same(base.initialState, item.initialState)) out.push(`Initial state: ${item.initialState.summary}`);
  if (base.task !== item.task) out.push(`Task: ${item.task}`);
  if (!same(base.stateChecks, item.stateChecks)) out.push('Different state checks');
  for (const o of item.overrides) out.push(`Per-run override: ${o.label}`);
  if (!same(base.scriptedEvents, item.scriptedEvents)) out.push(item.scriptedEvents.length ? `Scripted approval grant after ${item.scriptedEvents.map(e => e.after).join(', ')}` : 'No scripted approval grant');
  return out.length ? out : ['No change'];
}

export const promptText = textOf;

/** Base first, then the selected variations: everything a save would include, with what a reviewer must see. */
export function reviewRows(state, draftId) {
  const draft = state.scenarioDrafts[draftId];
  const ctx = contextOf(state, draft);
  const row = (key, spec, meta) => {
    const problems = scenarioProblems(spec, ctx, meta);
    return {
      key, spec, title: key === 'base' ? spec.title : meta.label, label: meta.label, badge: meta.badge ?? null,
      dimension: meta.dimension ?? null, reviewState: spec.reviewState, reviewNote: meta.reviewNote ?? null,
      source: key === 'base' ? spec.source.label : `Variation of ${draft.base.title}`,
      changes: key === 'base' ? [] : differences(draft.base, spec), problems,
      prompt: textOf(spec.messages), basePrompt: textOf(draft.base.messages),
      outcomeLabel: EXPECTED_OUTCOME[spec.expectedBehavior.outcome]?.label ?? spec.expectedBehavior.outcome,
      needsAction: spec.reviewState !== 'reviewed' || problems.length > 0,
    };
  };
  return [
    row('base', draft.base, { label: 'Base scenario', reviewNote: draft.base.reviewState === 'reviewed' ? null : 'Confirm the base scenario' }),
    ...draft.items.filter(i => i.selected).map(i => row(i.id, i, i)),
  ];
}

/** Whether the draft can be saved as a runnable set, and why not. */
export function saveGate(state, draftId) {
  const rows = reviewRows(state, draftId);
  const blocked = rows.filter(r => r.needsAction);
  const unconfirmed = blocked.filter(r => r.reviewState !== 'reviewed').length;
  const invalid = blocked.filter(r => r.problems.length).length;
  const reasons = [unconfirmed && `${unconfirmed} to confirm`, invalid && `${invalid} with problems`].filter(Boolean);
  return { ok: blocked.length === 0, rows, blocked, reason: reasons.length ? `Review first: ${reasons.join(', ')}.` : null };
}

const markReviewed = spec => ({ ...spec, reviewState: 'reviewed', confirmedBy: 'user', reviewNote: null });

/** A person confirms the base or one variation. Blocked while the spec has problems. */
export const confirmScenario = (state, { draftId, key }) => editDraft(state, draftId, draft => {
  const ctx = contextOf(state, draft);
  if (key === 'base') {
    const problems = scenarioProblems(draft.base, ctx);
    return problems.length ? fail('review_blocked', problems.map(p => p.message).join(' ')) : draft.base.reviewState === 'reviewed' ? draft : { ...draft, base: { ...draft.base, reviewState: 'reviewed' } };
  }
  const item = draft.items.find(i => i.id === key);
  if (!item) return fail('item_missing', `No variation ${key}`);
  const problems = scenarioProblems(item, ctx, item);
  if (problems.length) return fail('review_blocked', problems.map(p => p.message).join(' '));
  return { ...draft, items: draft.items.map(i => (i.id === key ? markReviewed(i) : i)) };
});

/**
 * A person edits one variation and confirms it in the same step. The edited fields stop following the base.
 * Rejected, with nothing changed, when the result has problems.
 */
export const editItem = (state, { draftId, itemId, patch }) => editDraft(state, draftId, draft => {
  const item = draft.items.find(i => i.id === itemId);
  if (!item) return fail('item_missing', `No variation ${itemId}`);
  const clean = cleanSpecPatch(patch);
  if (clean.error) return clean;
  if ('title' in clean) return fail('invalid_field', 'A variation takes its title from its type');
  const owned = new Set(Object.keys(clean).map(k => (k === 'expectedBehavior' ? 'outcome' : k)));
  const next = { ...item, ...clean, inherits: item.inherits.filter(k => !owned.has(k)), edited: true };
  const problems = scenarioProblems(next, contextOf(state, draft), next);
  if (problems.length) return fail('review_blocked', problems.map(p => p.message).join(' '));
  return { ...draft, items: draft.items.map(i => (i.id === itemId ? markReviewed(next) : i)) };
});

const slug = text => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'scenarios';

const toScenario = (spec, extra) => ({
  title: spec.title, source: spec.source, baseId: null, variation: null,
  messages: spec.messages, initialState: spec.initialState, task: spec.task, expectedBehavior: spec.expectedBehavior,
  stateChecks: spec.stateChecks, overrides: spec.overrides, scriptedEvents: spec.scriptedEvents,
  reviewState: 'reviewed', badge: null, ...extra,
});

/**
 * Writes the reviewed base and selected variations as Scenario records and a new ScenarioSetRevision. Never edits an
 * existing record: a second save of the same name gets the next revision and new scenario ids.
 */
export function saveScenarioSet(state, { draftId, name }) {
  const draft = state.scenarioDrafts[draftId];
  if (!draft) return fail('draft_missing', `No scenario draft ${draftId}`);
  const gate = saveGate(state, draftId);
  if (!gate.ok) return fail('set_unreviewed', gate.reason);
  const setName = String(name ?? draft.base.title).trim() || draft.base.title;
  if (setName.length > LIMITS.title) return fail('invalid_name', `Set name must be up to ${LIMITS.title} characters`);

  const id = `set-${slug(setName)}`;
  const rev = String(Object.values(state.scenarioSets).filter(s => s.id === id).length + 1);
  const scenarioId = suffix => `${id}-r${rev}-${suffix}`;
  const baseId = scenarioId('base');
  const typeCount = {};
  const base = { id: baseId, rev: '1', ...toScenario(draft.base, {}) };
  const variations = draft.items.filter(i => i.selected).map((item, n) => {
    typeCount[item.type] = (typeCount[item.type] ?? 0) + 1;
    const title = typeCount[item.type] > 1 ? `${item.label} ${typeCount[item.type]}` : item.label;
    return {
      id: scenarioId(`v${n + 1}`), rev: '1',
      ...toScenario({ ...item, title, source: { kind: draft.base.source.kind, label: `Variation of ${draft.base.title}` } },
        { baseId, variation: { dimension: item.dimension, type: item.type, label: item.label }, badge: item.badge }),
    };
  });
  const scenarios = [base, ...variations];
  const content = { id, rev, name: setName, environmentRef: { ...draft.environmentRef }, workflowRef: { ...draft.workflowRef }, scenarioRefs: scenarios.map(s => ({ id: s.id, rev: s.rev })) };
  const set = { ...content, digest: digestOf({ ...content, scenarios }) };
  const ref = { id, rev };
  return {
    state: {
      ...state,
      scenarios: { ...state.scenarios, ...Object.fromEntries(scenarios.map(s => [refKey(s), s])) },
      scenarioSets: { ...state.scenarioSets, [refKey(ref)]: set },
      scenarioDrafts: { ...state.scenarioDrafts, [draftId]: { ...draft, lastSavedSetRef: ref, savedRevision: draft.revision } },
    },
  };
}
