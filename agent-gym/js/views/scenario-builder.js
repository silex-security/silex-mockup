// N3 Create scenario. Reads the builder draft through scenario/selectors.js and writes only through the reducers in
// scenario/*.js. Route query: environment (id@rev), workflow, source, mode, open (expanded variation ids), returnTo.
import { h, mountView } from '../components/dom.js';
import { icon } from '../components/icons.js';
import * as ui from '../components/ui.js';
import { VARIATION_COUNT, parseRef, refKey } from '../model.js';
import { CHECK_OPS, CHECK_PATHS, EXPECTED_OUTCOME } from '../simulation/assertions.js';
import { DATA_TARGETS } from '../simulation/adapters.js';
import { setScenarioSet } from '../simulation/attempts.js';
import { experimentSummary } from '../selectors.js';
import {
  DEFAULT_ENVIRONMENT, DEFAULT_WORKFLOW_ID, LIMITS, applySource, draftIdFor, editBase, ensureDraft, generateBatch, isKept,
  regenerateItem, saveDraft, setDraftWorkflow, setGenerator, toggleItem, toggleType,
} from '../scenario/draft.js';
import { DIMENSIONS, INTENSITIES, TYPES_BY_DIMENSION, generateVariations, typeLabel } from '../scenario/generate.js';
import { confirmScenario, editItem, promptText, saveGate, saveScenarioSet } from '../scenario/review.js';
import { ASSISTANT_LABEL, askAssistant } from '../scenario/assistant.js';
import { SAMPLE_TRACE, baseFromTrace, blueprintRequirements } from '../scenario/sources.js';
import { UPLOAD_FIELDS, UPLOAD_LIMITS, checkFileMeta, parseUpload } from '../scenario/upload.js';
import { dependencyReport, dimensionCounts, outcomeLabel, setTotals } from '../scenario/selectors.js';

const SOURCES = [
  { id: 'trace', title: 'Production trace', subtitle: 'Replay a real case', icon: 'play', tag: 'Sample trace' },
  { id: 'blueprint', title: 'Blueprint & policies', subtitle: 'Test requirements', icon: 'file-text', tag: 'Simulated blueprint' },
  { id: 'upload', title: 'Upload file', subtitle: 'Import test cases', icon: 'upload', tag: 'Local file' },
  { id: 'chat', title: 'Chat with Agent Gym', subtitle: 'Describe a new scenario', icon: 'chat' },
];

const FIXED_TEXT = { prompt: 'Input changes; tool behavior stays the same.', other: 'Environment template fixed · per-run overrides listed' };
const OUTCOME_OPTIONS = Object.entries(EXPECTED_OUTCOME).map(([value, o]) => ({ value, label: o.label }));
const quoted = text => `“${text}”`;
const checkText = c => `${c.path} ${c.op} ${c.value}`;
const listText = (list, empty = 'None') => (list.length ? list.join('; ') : empty);
const dimensionLabel = id => DIMENSIONS.find(d => d.id === id).label;

const envRefOf = route => (route.query.environment ? parseRef(route.query.environment) : { ...DEFAULT_ENVIRONMENT });

// Re-render only when this screen's slice changes, so scheduler ticks elsewhere never touch a field being typed in.
function sliceStore(store, pick) {
  return {
    getState: store.getState,
    subscribe(fn) {
      let last = pick(store.getState());
      return store.subscribe(state => {
        const next = pick(state);
        if (next.some((v, i) => v !== last[i])) { last = next; fn(state); }
      });
    },
  };
}

const fieldRow = (label, control) =>
  h('div', { class: 'sc-field' }, h('span', { class: 'sc-field__label' }, label), h('div', { class: 'sc-field__control' }, control));

function numberInput({ value, min, max, onChange, ariaLabel, focusKey, disabled, reason }) {
  return h('span', { class: `gym-input sc-count${disabled ? ' is-disabled' : ''}`, title: disabled ? reason : null },
    h('input', {
      class: 'gym-input__control', type: 'number', min, max, step: 1, value: String(value), disabled,
      'aria-label': ariaLabel, dataset: { focusKey }, onChange: e => onChange(e.target.value),
    }));
}

/** A rule builder over CHECK_PATHS and CHECK_OPS. Never free text that runs. */
function checksEditor(initial) {
  const rows = initial.map(c => ({ ...c }));
  const box = h('div', { class: 'sc-rules' });
  const valueControl = (row, i) => typeof row.value === 'boolean'
    ? ui.select({ value: String(row.value), ariaLabel: `Check ${i + 1} value`, options: [{ value: 'true' }, { value: 'false' }], onChange: v => { row.value = v === 'true'; } })
    : h('span', { class: 'gym-input sc-rule__value' }, h('input', { class: 'gym-input__control', type: 'number', step: 1, value: String(row.value), 'aria-label': `Check ${i + 1} value`, onInput: e => { row.value = Number(e.target.value); } }));
  const draw = () => box.replaceChildren(
    ...rows.map((row, i) => h('div', { class: 'sc-rule', dataset: { rule: String(i) } },
      ui.textInput({ value: row.label, ariaLabel: `Check ${i + 1} label`, placeholder: 'What must hold', onInput: v => { row.label = v; } }),
      ui.select({ value: row.path, ariaLabel: `Check ${i + 1} path`, options: CHECK_PATHS.map(p => ({ value: p })), onChange: v => { row.path = v; } }),
      ui.select({ value: row.op, ariaLabel: `Check ${i + 1} operator`, options: CHECK_OPS.map(o => ({ value: o })), onChange: v => { row.op = v; } }),
      valueControl(row, i),
      ui.iconButton({ icon: 'trash', label: `Remove check ${i + 1}`, variant: 'ghost', size: 'sm', onClick: () => { rows.splice(i, 1); draw(); } }))),
    ui.button({
      label: 'Add check', icon: 'plus', variant: 'outline', size: 'sm', disabled: rows.length >= LIMITS.checks, reason: `Up to ${LIMITS.checks} checks.`,
      onClick: () => { rows.push({ label: '', path: 'outbox.count', op: '==', value: 0 }); draw(); },
    }));
  draw();
  return { node: box, value: () => rows.map((r, i) => ({ id: r.id || `check-${i + 1}`, label: r.label.trim(), path: r.path, op: r.op, value: r.value })) };
}

function errorSlot() {
  const node = h('div', { class: 'sc-dialog-error' });
  return { node, show(message) { node.replaceChildren(ui.notice({ tone: 'error', role: 'alert', text: message })); } };
}

export function mount(root, ctx) {
  const { store, router, announce } = ctx;
  let route = ctx.route;
  let envRef = envRefOf(route);
  let draftId = draftIdFor(envRef);
  let ensureError = null;
  let chatInput = '';
  let upload = null;

  const pick = s => [s.scenarioDrafts[draftId], s.environments, s.workflows, s.scenarioSets, s.experiments];
  const view = { refresh() {}, destroy() {} };
  const returnTo = () => route.query.returnTo || 'exp-029';
  const draftOf = () => store.getState().scenarioDrafts[draftId];
  const dispatch = (reducer, command, ok) => {
    const r = store.dispatch(reducer, { draftId, ...command });
    if (!r.ok) announce(r.error.message);
    else if (ok) announce(ok);
    return r;
  };

  function ensure() {
    const r = store.dispatch(ensureDraft, { environmentRef: envRef, workflowId: route.query.workflow || DEFAULT_WORKFLOW_ID });
    ensureError = r.ok ? null : r.error;
    const draft = draftOf();
    if (!draft || !route.query.workflow || draft.workflowRef.id === route.query.workflow) return;
    const workflow = Object.values(store.getState().workflows).find(w => w.id === route.query.workflow);
    if (workflow) store.dispatch(setDraftWorkflow, { draftId, workflowRef: { id: workflow.id, rev: workflow.rev } });
  }

  // ---------- dialogs ----------

  function formDialog({ title, description, children, saveLabel = 'Save', save }) {
    const error = errorSlot();
    ui.openDialog({
      title, description, size: 'md', children: [...children, error.node],
      actions: close => [
        ui.button({ label: 'Cancel', onClick: () => close() }),
        ui.button({ label: saveLabel, variant: 'primary', onClick: () => { const r = save(); if (r.ok) close(); else error.show(r.error.message); } }),
      ],
    });
  }

  function confirmReplaceBase(spec) {
    ui.confirmDialog({
      title: 'Replace the base scenario?',
      message: `The base becomes "${spec.title}" from ${spec.source.label}. Variations stay, follow the new base and need review again.`,
      confirmLabel: 'Replace base',
    }).then(yes => {
      if (!yes) return;
      const r = dispatch(applySource, { spec }, `Base scenario replaced from ${spec.source.label}.`);
      if (r.ok) router.replaceQuery({ source: null });
    });
  }

  function openChecksDialog() {
    const editor = checksEditor(draftOf().base.stateChecks);
    formDialog({
      title: 'State checks', saveLabel: 'Save checks', children: [editor.node],
      description: 'Rules over the simulated final state. Each is a supported path, an operator and a value. No code runs.',
      save: () => dispatch(editBase, { patch: { stateChecks: editor.value() } }, 'State checks saved. Variations need review again.'),
    });
  }

  function openExpectedDialog() {
    let { summary, outcome } = draftOf().base.expectedBehavior;
    formDialog({
      title: 'Expected behavior', description: 'The outcome is the rule set every run of this scenario is judged by.',
      children: [
        ui.textInput({ label: 'Summary', value: summary, onInput: v => { summary = v; } }),
        ui.select({ label: 'Outcome', value: outcome, options: OUTCOME_OPTIONS, onChange: v => { outcome = v; } }),
      ],
      save: () => dispatch(editBase, { patch: { expectedBehavior: { summary, outcome } } }, 'Expected behavior saved. Variations need review again.'),
    });
  }

  function openInitialStateDialog() {
    const base = draftOf().base;
    const environment = store.getState().environments[refKey(envRef)];
    let summary = base.initialState.summary;
    const patch = { ...base.initialState.patch };
    const targets = Object.entries(DATA_TARGETS).filter(([, t]) => t.kind in environment.dataSeed);
    formDialog({
      title: 'Initial state', description: 'A summary, plus optional seeded-data changes applied to each run’s private copy of the environment.',
      children: [
        ui.textInput({ label: 'Summary', value: summary, onInput: v => { summary = v; } }),
        h('div', { class: 'gym-stack sc-patch' }, h('span', { class: 'gym-field__label' }, 'Seeded data changes'),
          targets.map(([key, t]) => h('div', { class: 'sc-patch__row' },
            ui.checkbox({ label: key, checked: key in patch, onChange: on => { if (on) patch[key] = t.type === 'boolean' ? true : 0; else delete patch[key]; } }),
            h('span', { class: 'gym-muted' }, t.type === 'boolean' ? 'set to true' : 'set to 0')))),
      ],
      save: () => dispatch(editBase, { patch: { initialState: { summary, patch } } }, 'Initial state saved. Variations need review again.'),
    });
  }

  function openEditItemDialog(itemId) {
    const item = draftOf().items.find(i => i.id === itemId);
    const turns = item.messages.map(m => ({ text: m.text }));
    let { summary, outcome } = item.expectedBehavior;
    const editor = checksEditor(item.stateChecks);
    const turnsBox = h('div', { class: 'gym-stack' });
    const drawTurns = () => turnsBox.replaceChildren(
      ...turns.map((t, i) => h('div', { class: 'sc-turn' },
        ui.textarea({ label: turns.length > 1 ? `Turn ${i + 1}` : 'Prompt', value: t.text, rows: 2, onInput: v => { t.text = v; } }),
        turns.length > 1 && ui.iconButton({ icon: 'trash', label: `Remove turn ${i + 1}`, variant: 'ghost', size: 'sm', onClick: () => { turns.splice(i, 1); drawTurns(); } }))),
      ui.button({
        label: 'Add turn', icon: 'plus', variant: 'outline', size: 'sm', disabled: turns.length >= LIMITS.turns, reason: `Up to ${LIMITS.turns} turns.`,
        onClick: () => { turns.push({ text: '' }); drawTurns(); },
      }));
    drawTurns();
    formDialog({
      title: `Edit ${item.label}`, saveLabel: 'Save and confirm',
      description: 'Saving confirms this variation. Fields you change stop following the base scenario.',
      children: [
        turnsBox,
        ui.textInput({ label: 'Expected behavior', value: summary, onInput: v => { summary = v; } }),
        ui.select({ label: 'Outcome', value: outcome, options: OUTCOME_OPTIONS, onChange: v => { outcome = v; } }),
        h('div', { class: 'gym-stack' }, h('span', { class: 'gym-field__label' }, 'State checks'), editor.node),
        h('p', { class: 'gym-muted' }, `Per-run overrides: ${listText(item.overrides.map(o => o.label))}. They come from the ${dimensionLabel(item.dimension)} generator and are not edited here.`),
      ],
      save: () => dispatch(editItem, { itemId, patch: { messages: turns, expectedBehavior: { summary, outcome }, stateChecks: editor.value() } }, `${item.label} edited and confirmed.`),
    });
  }

  function generate(dimension) {
    const existing = draftOf().items.filter(i => i.dimension === dimension);
    const run = strategy => {
      const r = dispatch(generateBatch, { dimension, strategy });
      if (!r.ok) return;
      const now = draftOf().items.filter(i => i.dimension === dimension).length;
      const added = now - (strategy === 'replace' ? existing.filter(isKept).length : existing.length);
      announce(`${added} variation${added === 1 ? '' : 's'} generated${strategy === 'replace' ? ', replacing untouched items' : ''}.`);
    };
    if (!existing.length) { run('append'); return; }
    const kept = existing.filter(isKept).length;
    ui.openDialog({
      title: 'Replace or append?',
      description: `This list already has ${existing.length} ${dimensionLabel(dimension).toLowerCase()} variation${existing.length === 1 ? '' : 's'}. ${kept ? `The ${kept} you edited or confirmed always stay.` : 'Items you edit or confirm always stay.'}`,
      actions: close => [
        ui.button({ label: 'Cancel', onClick: () => close() }),
        ui.button({ label: 'Append new batch', onClick: () => { close(); run('append'); } }),
        ui.button({ label: 'Replace untouched', variant: 'primary', onClick: () => { close(); run('replace'); } }),
      ],
    });
  }

  function openUseDialog(setRef) {
    const state = store.getState();
    const set = state.scenarioSets[refKey(setRef)];
    const experimentId = returnTo();
    const exp = state.experiments[experimentId];
    const preview = exp && setScenarioSet(state, { experimentId, scenarioSetRef: setRef });
    ui.openDialog({
      title: 'Scenario set saved', size: 'md',
      description: `${set.name} · revision ${set.rev} · ${set.scenarioRefs.length} scenarios · digest ${set.digest}. A saved set never changes.`,
      children: exp
        ? h('div', { class: 'gym-stack sc-use' },
          h('p', `Use it in ${exp.title}? The workbench keeps its current set until you choose.`),
          h('dl', { class: 'sc-use__grid' },
            h('dt', 'Now'), h('dd', experimentSummary(state, experimentId).formula),
            h('dt', 'With this set'), h('dd', { dataset: { useFormula: '' } }, preview.state ? experimentSummary(preview.state, experimentId).formula : preview.error.message)),
          ui.button({ label: 'Open the saved set', variant: 'link', iconRight: 'arrow-right', href: router.href('scenario-set', setRef) }))
        : ui.notice({ tone: 'warning', text: `No experiment ${experimentId} to use it in.` }),
      actions: close => [
        ui.button({ label: 'Keep current set', focusKey: 'sc:keep-set', onClick: () => { close(); announce(exp ? `${exp.title} keeps its current scenario set.` : 'Set saved.'); } }),
        exp && ui.button({
          label: 'Use in experiment', variant: 'primary', focusKey: 'sc:use-set', onClick: () => {
            const r = store.dispatch(setScenarioSet, { experimentId, scenarioSetRef: setRef });
            close();
            if (!r.ok) { announce(r.error.message); return; }
            announce(`${exp.title} now uses ${set.name}.`);
            router.go('workbench', { experimentId });
          },
        }),
      ],
    });
  }

  function reviewCard(row) {
    const s = row.spec;
    const problemText = row.problems.map(p => p.message).join(' ');
    return h('article', { class: `sc-rcard${row.needsAction ? ' needs-action' : ''}`, dataset: { review: row.key } },
      h('header', { class: 'sc-rcard__head' },
        h('strong', row.title),
        row.dimension && ui.badge({ label: dimensionLabel(row.dimension), tone: 'gray' }),
        ui.badge({ status: row.reviewState === 'reviewed' ? 'reviewed' : row.badge === 'review' ? 'review' : 'needs_review' }),
        h('span', { class: 'gym-spacer' }),
        row.key !== 'base' && ui.button({ label: 'Edit', icon: 'pencil', size: 'sm', focusKey: `sc-review:edit:${row.key}`, onClick: () => openEditItemDialog(row.key) }),
        row.reviewState !== 'reviewed' && ui.button({
          label: 'Confirm', icon: 'check', size: 'sm', variant: 'primary', focusKey: `sc-review:confirm:${row.key}`,
          disabled: row.problems.length > 0, reason: problemText,
          onClick: () => dispatch(confirmScenario, { key: row.key }, `${row.title} confirmed.`),
        })),
      row.reviewNote && row.reviewState !== 'reviewed' && h('p', { class: 'sc-rcard__note' }, row.reviewNote),
      h('dl', { class: 'sc-rcard__grid' },
        row.key === 'base'
          ? [h('dt', 'Prompt'), h('dd', quoted(row.prompt))]
          : [h('dt', 'Input change'), h('dd',
            h('span', { class: 'sc-diff__from' }, quoted(row.basePrompt)), h('span', { class: 'sc-diff__arrow' }, ' → '), h('span', { class: 'sc-diff__to' }, quoted(row.prompt)),
            h('small', { class: 'sc-diff__list' }, row.changes.join(' · ')))],
        h('dt', 'Initial state'), h('dd', s.initialState.summary),
        h('dt', 'Expected behavior'), h('dd', `${s.expectedBehavior.summary} `, h('small', { class: 'gym-muted' }, `(${row.outcomeLabel})`)),
        h('dt', 'State checks'), h('dd', h('span', { class: 'gym-mono' }, listText(s.stateChecks.map(checkText)))),
        h('dt', 'Overrides'), h('dd', listText(s.overrides.map(o => `${o.label} (${o.kind} ${o.target} = ${o.value})`), 'None · environment fixed')),
        h('dt', 'Source'), h('dd', row.source)),
      row.problems.length > 0 && ui.notice({ tone: 'error', text: problemText }));
  }

  function openReviewDialog() {
    let name = draftOf().base.title;
    let dialogRef = null;
    const body = h('div', { class: 'sc-review' });
    const reviewView = mountView(body, state => {
      if (!state.scenarioDrafts[draftId]) return '';
      const gate = saveGate(state, draftId);
      return [
        ui.textInput({ label: 'Set name', value: name, focusKey: 'sc-review:name', onInput: v => { name = v; } }),
        h('div', { class: 'sc-review__list', dataset: { scrollKey: 'sc-review:list' } }, gate.rows.map(reviewCard)),
        h('div', { class: 'sc-review__foot' },
          h('span', { class: 'sc-review__status', dataset: { reviewStatus: gate.ok ? 'ok' : 'blocked' } }, gate.ok ? `${gate.rows.length} scenarios ready to save.` : gate.reason),
          h('div', { class: 'gym-row' },
            ui.button({ label: 'Close', focusKey: 'sc-review:close', onClick: () => dialogRef.close() }),
            ui.button({ label: 'Save draft', focusKey: 'sc-review:draft', onClick: () => dispatch(saveDraft, {}, 'Draft saved. It is not a runnable set until every item is reviewed.') }),
            ui.button({
              label: 'Save scenario set', variant: 'primary', focusKey: 'sc-review:save', disabled: !gate.ok, reason: gate.reason,
              onClick: () => {
                const r = store.dispatch(saveScenarioSet, { draftId, name });
                if (!r.ok) { announce(r.error.message); return; }
                const ref = r.state.scenarioDrafts[draftId].lastSavedSetRef;
                dialogRef.close();
                announce(`Scenario set saved as revision ${ref.rev}.`);
                openUseDialog(ref);
              },
            }))),
      ];
    }, sliceStore(store, pick));
    dialogRef = ui.openDialog({
      title: 'Review & save', size: 'lg', class: 'sc-review-dialog',
      description: 'Check what each scenario changes against the base. Items marked Review need your confirmation or an edit. Nothing runs until you use the set in an experiment.',
      children: body, onClose: () => reviewView.destroy(),
    });
  }

  // ---------- page parts ----------

  function sourceCards(source) {
    return h('div', { class: 'sc-sources', role: 'group', 'aria-label': 'Scenario source' }, SOURCES.map(s => ui.card({
      class: 'sc-source', selected: s.id === source, focusKey: `sc:source:${s.id}`, ariaLabel: `${s.title}: ${s.subtitle}${s.tag ? ` (${s.tag})` : ''}`,
      onClick: () => router.replaceQuery({ source: s.id === 'chat' ? null : s.id }),
      children: [
        h('span', { class: 'sc-source__icon' }, icon(s.icon, { size: 22 })),
        h('span', { class: 'sc-source__text' }, h('strong', s.title), h('span', s.subtitle)),
        s.tag && h('span', { class: 'sc-source__tag' }, s.tag),
      ],
    })));
  }

  function contextBar(state, draft) {
    const environment = state.environments[refKey(draft.environmentRef)];
    const shown = environment.components.filter(c => environment.caps.includes(c.category));
    const hidden = environment.components.filter(c => !shown.includes(c));
    return h('div', { class: 'sc-context' },
      h('span', { class: 'sc-context__env' }, icon('layers', { size: 20 }), h('strong', 'Environment:'), h('span', `${environment.name} v${environment.rev}`)),
      h('span', { class: 'sc-context__rule', 'aria-hidden': 'true' }),
      h('span', { class: 'sc-context__apps' }, shown.map(c => ui.appChip({ app: c.app, label: c.name, title: `${c.name} · simulated` })),
        hidden.length > 0 && h('span', { class: 'gym-chip sc-context__more', title: `Also simulated: ${hidden.map(c => c.name).join(', ')}` }, `+${hidden.length}`)),
      h('span', { class: 'sc-context__rule sc-context__rule--end', 'aria-hidden': 'true' }),
      h('span', { class: 'sc-context__wf' }, h('strong', { 'aria-hidden': 'true' }, 'Workflow:'),
        ui.select({
          value: refKey(draft.workflowRef), ariaLabel: 'Workflow', focusKey: 'sc:workflow',
          options: Object.values(state.workflows).map(w => ({ value: refKey(w), label: w.name })),
          onChange: key => {
            const ref = parseRef(key);
            const r = dispatch(setDraftWorkflow, { workflowRef: ref }, `Workflow changed to ${state.workflows[key].name}. The base scenario is kept; review it and the variations again.`);
            if (r.ok) router.replaceQuery({ workflow: ref.id });
          },
        })));
  }

  function chatPanel(draft) {
    const send = () => {
      const text = chatInput.trim();
      if (!text) { announce('Type a request first.'); return; }
      chatInput = '';
      const r = dispatch(askAssistant, { text });
      if (r.ok) announce(r.state.scenarioDrafts[draftId].chat.at(-1).text.split('\n')[0]);
    };
    return ui.panel({
      class: 'sc-col sc-chat', title: 'Chat with Agent Gym', subtitle: 'Scenario assistant', icon: 'chat',
      actions: ui.popoverMenu({
        align: 'end', label: 'Assistant actions',
        trigger: ui.iconButton({ icon: 'more', label: 'Assistant actions', variant: 'ghost', size: 'sm', focusKey: 'sc:chat-menu' }),
        items: [
          { label: 'What can it do?', icon: 'info', description: 'The requests the scripted assistant understands', onSelect: () => dispatch(askAssistant, { text: 'help' }, 'Assistant help added.') },
          { label: 'Show differences', icon: 'list', description: 'Base against the selected variations', onSelect: () => dispatch(askAssistant, { text: 'show differences' }, 'Differences listed.') },
        ],
      }),
      children: [
        h('ol', { class: 'sc-chat__log', dataset: { scrollKey: 'sc:chat' }, 'aria-label': 'Conversation' }, draft.chat.map((m, i) => h('li', { class: `sc-msg sc-msg--${m.role}`, dataset: { msg: String(i) } },
          h('span', { class: 'sc-msg__avatar', 'aria-hidden': 'true' }, icon(m.role === 'user' ? 'user' : 'sparkle', { size: 20 })),
          h('div', { class: 'sc-msg__bubble' },
            h('span', { class: 'gym-sr' }, m.role === 'user' ? 'You: ' : 'Assistant: '),
            m.text.split('\n').map(line => h('p', line)),
            m.chips?.length > 0 && h('div', { class: 'sc-msg__chips' }, m.chips.map(app => ui.appChip({ app, label: app === 'gmail' ? 'Gmail' : app }))))))),
        h('form', { class: 'sc-chat__form', onSubmit: e => { e.preventDefault(); send(); } },
          h('span', { class: 'sc-chat__caption' }, `${ASSISTANT_LABEL} · no model`),
          h('div', { class: 'sc-chat__row' },
            ui.iconButton({ icon: 'paperclip', label: 'Attach test cases (opens Upload file)', variant: 'ghost', size: 'sm', focusKey: 'sc:chat-attach', onClick: () => router.replaceQuery({ source: 'upload' }) }),
            h('input', {
              class: 'sc-chat__input', type: 'text', value: chatInput, maxLength: 300, placeholder: 'Ask for more variations…',
              'aria-label': ASSISTANT_LABEL, dataset: { focusKey: 'sc:chat-input' }, onInput: e => { chatInput = e.target.value; },
            }),
            ui.iconButton({ icon: 'send', label: 'Send to the scripted assistant', variant: 'primary', size: 'sm', type: 'submit', focusKey: 'sc:chat-send' }))),
      ],
    });
  }

  function tracePanel() {
    return ui.panel({
      class: 'sc-col sc-srcpanel', title: 'Production trace', subtitle: `${SAMPLE_TRACE.label} · synthetic, no production data`, icon: 'play',
      children: [
        h('p', { class: 'gym-muted' }, SAMPLE_TRACE.note),
        h('ol', { class: 'sc-trace' }, SAMPLE_TRACE.events.map(e => h('li', h('span', { class: 'sc-trace__type' }, e.type.replace('_', ' ')), h('span', e.text)))),
        ui.button({ label: 'Use as base scenario', variant: 'primary', icon: 'arrow-right', focusKey: 'sc:trace-use', onClick: () => confirmReplaceBase(baseFromTrace(SAMPLE_TRACE)) }),
      ],
    });
  }

  function blueprintPanel(state, draft) {
    const workflow = state.workflows[refKey(draft.workflowRef)];
    return ui.panel({
      class: 'sc-col sc-srcpanel', title: 'Blueprint & policies', subtitle: `Simulated blueprint · ${workflow.name} v${workflow.rev}`, icon: 'file-text',
      children: [
        h('p', { class: 'gym-muted' }, `Read from the workflow’s policy snapshot (${workflow.source.label}, fixture). Pick a requirement to test.`),
        h('ul', { class: 'sc-reqs' }, blueprintRequirements(workflow).map(req => h('li', { class: 'sc-req' },
          h('span', { class: 'sc-req__text' }, h('strong', req.text), h('small', outcomeLabel(req.spec.expectedBehavior.outcome))),
          ui.button({ label: 'Use as base', size: 'sm', focusKey: `sc:req:${req.id}`, onClick: () => confirmReplaceBase(req.spec) })))),
      ],
    });
  }

  async function readUpload(input) {
    const file = input.files?.[0];
    if (!file) return;
    const problem = checkFileMeta({ name: file.name, size: file.size });
    upload = problem
      ? { ok: false, error: problem, rows: [], rejected: [], summary: { fileName: file.name, total: 0, accepted: 0, rejected: 0 } }
      : parseUpload({ name: file.name, size: file.size, text: await file.text() });
    announce(upload.ok ? `${upload.summary.accepted} of ${upload.summary.total} test cases passed the checks.` : upload.error);
    view.refresh();
  }

  function uploadPanel() {
    return ui.panel({
      class: 'sc-col sc-srcpanel', title: 'Upload file', subtitle: 'Local file · read in this browser, never uploaded', icon: 'upload',
      children: [
        h('label', { class: 'sc-file' },
          h('span', { class: 'gym-btn gym-btn--outline' }, icon('upload'), h('span', 'Choose a JSON or CSV file')),
          h('input', { class: 'sc-file__input', type: 'file', accept: UPLOAD_LIMITS.extensions.join(','), dataset: { focusKey: 'sc:upload' }, onChange: e => readUpload(e.target) })),
        h('p', { class: 'gym-muted sc-file__limits' }, `Up to ${UPLOAD_LIMITS.maxBytes / 1024} KB and ${UPLOAD_LIMITS.maxRows} test cases. Fields: ${UPLOAD_FIELDS.join(', ')}. Scripts, markup and links are refused.`),
        upload && h('div', { class: 'sc-parse', dataset: { parse: upload.ok ? 'ok' : 'error' } },
          h('strong', `${upload.summary.fileName} · ${upload.summary.total} test case${upload.summary.total === 1 ? '' : 's'} · ${upload.summary.accepted} accepted · ${upload.summary.rejected} rejected`),
          upload.error && ui.notice({ tone: 'error', text: upload.error }),
          upload.rejected.length > 0 && h('ul', { class: 'sc-parse__rejected' }, upload.rejected.map(r => h('li', r.reason))),
          h('ul', { class: 'sc-reqs' }, upload.rows.map(row => h('li', { class: 'sc-req' },
            h('span', { class: 'sc-req__text' }, h('strong', row.spec.title), h('small', `${quoted(row.spec.messages[0].text)} · ${outcomeLabel(row.spec.expectedBehavior.outcome)}`)),
            ui.button({ label: 'Use as base', size: 'sm', focusKey: `sc:upload-use:${row.line}`, onClick: () => confirmReplaceBase(row.spec) }))))),
      ],
    });
  }

  function basePanel(draft, mode) {
    const base = draft.base;
    const edit = patch => dispatch(editBase, { patch });
    const pencil = () => h('span', { class: 'sc-pencil', 'aria-hidden': 'true' }, icon('pencil', { size: 16 }));
    const editButton = (label, onClick, key) => ui.iconButton({ icon: 'pencil', label, variant: 'ghost', size: 'sm', class: 'sc-trail', focusKey: key, onClick });
    return ui.panel({
      class: 'sc-col sc-base', title: 'Base scenario', icon: 'file-text',
      actions: base.reviewState !== 'reviewed' && ui.badge({ status: 'needs_review', title: 'Confirm the base in Review & save' }),
      children: [
        ui.textInput({ value: base.title, ariaLabel: 'Base scenario title', class: 'sc-title', focusKey: 'sc:base-title', trailing: pencil(), onInput: v => edit({ title: v }) }),
        h('div', { class: 'sc-prompt' },
          h('div', { class: 'sc-prompt__head' }, icon('chat', { size: 20 }), h('strong', 'Original prompt')),
          base.messages.map((m, i) => ui.textarea({
            value: m.text, rows: 2, ariaLabel: base.messages.length > 1 ? `Original prompt turn ${i + 1}` : 'Original prompt', focusKey: `sc:base-prompt:${i}`,
            onInput: v => edit({ messages: base.messages.map((x, j) => ({ text: j === i ? v : x.text })) }),
          }))),
        h('div', { class: 'sc-fields' },
          fieldRow('Initial state', ui.textInput({
            value: base.initialState.summary, ariaLabel: 'Initial state', focusKey: 'sc:base-initial',
            trailing: editButton('Edit initial state data', openInitialStateDialog, 'sc:base-initial-edit'),
            onInput: v => edit({ initialState: { ...base.initialState, summary: v } }),
          })),
          fieldRow('Task', ui.textInput({ value: base.task, ariaLabel: 'Task', focusKey: 'sc:base-task', trailing: pencil(), onInput: v => edit({ task: v }) })),
          fieldRow('Expected behavior', ui.textInput({
            value: base.expectedBehavior.summary, ariaLabel: 'Expected behavior', focusKey: 'sc:base-expected',
            trailing: editButton('Choose the expected outcome', openExpectedDialog, 'sc:base-expected-edit'),
            onInput: v => edit({ expectedBehavior: { ...base.expectedBehavior, summary: v } }),
          })),
          fieldRow('State checks', h('button', {
            class: 'gym-input sc-checks', type: 'button', title: listText(base.stateChecks.map(checkText)),
            'aria-label': `State checks: ${listText(base.stateChecks.map(c => `${c.label} (${checkText(c)})`))}. Edit with the rule builder.`,
            dataset: { focusKey: 'sc:base-checks' }, onClick: openChecksDialog,
          }, h('span', { class: 'sc-checks__text' }, listText(base.stateChecks.map(c => c.label), 'No checks')), icon('pencil', { size: 16 })))),
        h('div', { class: 'sc-fixed', dataset: { fixed: mode === 'prompt' ? 'prompt' : 'overrides' } },
          h('span', { class: 'sc-fixed__lead' }, icon('lock', { size: 20 }), h('strong', 'Environment fixed')),
          h('span', { class: 'sc-fixed__text' }, mode === 'prompt' ? FIXED_TEXT.prompt : FIXED_TEXT.other)),
      ],
    });
  }

  function itemStatus(item) {
    if (item.confirmedBy === 'user') return [ui.badge({ status: 'reviewed' })];
    if (item.badge === 'same_intent') return [ui.badge({ status: 'same_intent' }), item.reviewState !== 'reviewed' && ui.badge({ status: 'needs_review', title: item.reviewNote })];
    return [ui.badge({ status: 'review', title: item.reviewNote ?? 'Confirm or edit the expected behavior' })];
  }

  function variationRow(item, n, open) {
    const toggleOpen = () => {
      const ids = new Set((route.query.open || '').split(',').filter(Boolean));
      if (ids.has(item.id)) ids.delete(item.id); else ids.add(item.id);
      router.replaceQuery({ open: [...ids].join(',') || null });
    };
    const meta = [`Draft revision ${item.rev}`, item.intensity && `${INTENSITIES.find(i => i.id === item.intensity).label.toLowerCase()} intensity`, item.edited && 'edited'].filter(Boolean).join(' · ');
    return h('li', { class: `sc-var${open ? ' is-open' : ''}${item.selected ? '' : ' is-off'}`, dataset: { item: item.id } },
      h('div', { class: 'sc-var__main' },
        ui.checkbox({ checked: item.selected, ariaLabel: `Include ${n}. ${item.label}`, focusKey: `sc:var-check:${item.id}`, onChange: () => dispatch(toggleItem, { itemId: item.id }) }),
        h('div', { class: 'sc-var__body' },
          h('div', { class: 'sc-var__title' }, h('strong', `${n}. ${item.label}`), itemStatus(item)),
          h('p', h('b', 'Prompt: '), quoted(promptText(item.messages))),
          h('p', h('b', 'Expected behavior: '), item.expectedBehavior.summary),
          item.overrides.length > 0 && h('p', h('b', 'Override: '), item.overrides.map(o => o.label).join('; '))),
        h('div', { class: 'sc-var__actions' },
          ui.iconButton({ icon: 'pencil', label: `Edit ${item.label}`, variant: 'ghost', size: 'sm', focusKey: `sc:var-edit:${item.id}`, onClick: () => openEditItemDialog(item.id) }),
          ui.iconButton({ icon: 'refresh', label: `Regenerate ${item.label}`, variant: 'ghost', size: 'sm', focusKey: `sc:var-regen:${item.id}`, onClick: () => dispatch(regenerateItem, { itemId: item.id }, `${item.label} regenerated. It needs review.`) }),
          ui.iconButton({ icon: open ? 'chevron-up' : 'chevron-down', label: `${open ? 'Collapse' : 'Expand'} ${item.label}`, variant: 'ghost', size: 'sm', focusKey: `sc:var-open:${item.id}`, pressed: open, onClick: toggleOpen }))),
      open && h('dl', { class: 'sc-var__detail' },
        h('dt', 'Initial state'), h('dd', item.initialState.summary),
        h('dt', 'State checks'), h('dd', h('span', { class: 'gym-mono' }, listText(item.stateChecks.map(checkText)))),
        h('dt', 'Overrides'), h('dd', listText(item.overrides.map(o => `${o.kind} ${o.target} = ${o.value}`), 'None · environment fixed')),
        h('dt', 'Review'), h('dd', item.reviewState === 'reviewed' ? `Reviewed${item.confirmedBy === 'inherited' ? ' (same intent as the base)' : ''}` : item.reviewNote ?? 'Needs review'),
        h('dt', 'Revision'), h('dd', meta)));
  }

  function variationsPanel(state, draft, mode) {
    const settings = draft.settings[mode];
    const genCtx = { environment: state.environments[refKey(draft.environmentRef)], workflow: state.workflows[refKey(draft.workflowRef)] };
    const isPrompt = mode === 'prompt';
    const preview = generateVariations(draft.base, settings.types, settings.count, settings.intensity, 0, genCtx);
    const items = draft.items.filter(i => i.dimension === mode);
    const openIds = new Set((route.query.open || '').split(','));
    return ui.panel({
      class: 'sc-col sc-gen', title: 'Generate variations', icon: 'layers',
      children: [
        ui.tabs({
          variant: 'solid', label: 'Variation dimension', value: mode, focusKey: 'sc:mode', class: 'sc-tabs',
          items: DIMENSIONS.map(d => ({ id: d.id, label: d.label, icon: d.icon, panelId: 'sc-gen-panel' })),
          onChange: id => router.replaceQuery({ mode: id === 'prompt' ? null : id }),
        }),
        h('div', { id: 'sc-gen-panel', role: 'tabpanel', class: 'sc-gen__controls', 'aria-label': `${dimensionLabel(mode)} variations` },
          h('div', { class: 'sc-gen__types' }, h('span', { class: 'sc-gen__label' }, 'Variation types'),
            h('div', { class: 'sc-gen__chips' }, TYPES_BY_DIMENSION[mode].map(type => ui.checkbox({
              class: 'sc-type', label: typeLabel(type, genCtx), checked: settings.types.includes(type), focusKey: `sc:type:${type}`,
              disabled: !isPrompt, reason: 'This dimension has one example type in this preview.',
              onChange: () => dispatch(toggleType, { dimension: mode, type }),
            })))),
          h('div', { class: 'sc-gen__row' },
            h('label', { class: 'sc-gen__inline' }, h('span', { class: 'sc-gen__label' }, 'Count'),
              numberInput({
                value: settings.count, min: VARIATION_COUNT.min, max: VARIATION_COUNT.max, ariaLabel: `Count, ${VARIATION_COUNT.min} to ${VARIATION_COUNT.max}`, focusKey: 'sc:count',
                disabled: !isPrompt, reason: 'One example per type in this dimension.',
                onChange: v => { if (!dispatch(setGenerator, { dimension: mode, patch: { count: Number(v) } }).ok) view.refresh(); },
              })),
            h('label', { class: 'sc-gen__inline' }, h('span', { class: 'sc-gen__label' }, 'Intensity'),
              ui.select({
                value: settings.intensity, ariaLabel: 'Intensity', focusKey: 'sc:intensity', options: INTENSITIES.map(i => ({ value: i.id, label: i.label })),
                disabled: !isPrompt, reason: 'Intensity changes prompt wording only. Overrides are exact.',
                onChange: v => dispatch(setGenerator, { dimension: mode, patch: { intensity: v } }),
              })),
            ui.button({
              label: 'Generate', variant: 'primary', icon: 'sparkle', class: 'sc-gen__go', focusKey: 'sc:generate',
              disabled: !!preview.problem, reason: preview.problem?.message, onClick: () => generate(mode),
            })),
          preview.problem && ui.notice({ tone: 'warning', class: 'sc-gen__problem', text: preview.problem.message })),
        h('h3', { class: 'sc-gen__count', dataset: { counts: mode } }, dimensionCounts(draft, mode).text),
        items.length
          ? h('ol', { class: 'sc-vars' }, items.map((item, i) => variationRow(item, i + 1, openIds.has(item.id))))
          : ui.emptyState({ icon: DIMENSIONS.find(d => d.id === mode).icon, title: 'Nothing generated yet', text: isPrompt ? 'Check the types and press Generate.' : `Generate adds one reviewable example with a per-run override: ${typeLabel(settings.types[0], genCtx)}.` }),
        h('p', { class: 'sc-gen__hint' }, icon('info', { size: 16 }), isPrompt ? 'Review expected behavior when intent or clarity changes.' : 'Overrides apply to each run’s private copy of the environment and are discarded after the run.'),
      ],
    });
  }

  function notices(state, draft) {
    const report = dependencyReport(state, draft);
    const workflow = state.workflows[refKey(draft.workflowRef)];
    const out = [];
    if (report.missing.length) out.push(ui.notice({ tone: 'error', role: 'alert', title: 'Dependencies missing.', text: `${workflow.name} needs ${report.missing.join(', ')}, which this environment revision does not have.` }));
    if (report.references.length) out.push(ui.notice({ tone: 'warning', title: 'Scenario references to check.', text: `${report.references.join('. ')}.` }));
    return out.length ? h('div', { class: 'sc-notices' }, out) : null;
  }

  function render(state) {
    const draft = state.scenarioDrafts[draftId];
    const crumbs = [{ label: 'Agent Gym', href: router.href('workbench', { experimentId: returnTo() }) }, { label: 'Scenarios' }, { label: 'Create scenario' }];
    if (!draft) return [
      ui.pageHeader({ title: 'Create scenario', subtitle: 'Start from evidence, a blueprint, or a conversation.', breadcrumb: crumbs }),
      ui.emptyState({ icon: 'alert', title: 'Environment revision not found', text: ensureError?.message ?? `No environment ${refKey(envRef)}.`, action: ui.button({ label: 'Open environments', href: router.href('environment-library'), focusKey: 'sc:env-lib' }) }),
    ];
    const source = route.query.source || 'chat';
    const mode = route.query.mode || 'prompt';
    const totals = setTotals(draft);
    const reviewButton = (label, key) => ui.button({ label, variant: 'primary', size: 'lg', focusKey: key, onClick: openReviewDialog });
    const saveDraftButton = key => ui.button({
      label: 'Save draft', size: 'lg', focusKey: key, title: draft.savedRevision === draft.revision ? 'Draft saved' : 'Unsaved changes',
      onClick: () => dispatch(saveDraft, {}, 'Draft saved. It is not a runnable set until every item is reviewed.'),
    });
    const left = { chat: () => chatPanel(draft), trace: tracePanel, blueprint: () => blueprintPanel(state, draft), upload: uploadPanel }[source]();
    return [
      ui.pageHeader({
        class: 'sc-head', title: 'Create scenario', subtitle: 'Start from evidence, a blueprint, or a conversation.', breadcrumb: crumbs,
        actions: [saveDraftButton('sc:save-draft'), reviewButton('Review & save', 'sc:review')],
      }),
      sourceCards(source),
      contextBar(state, draft),
      notices(state, draft),
      ui.columns({ class: 'sc-cols', children: [left, basePanel(draft, mode), variationsPanel(state, draft, mode)] }),
      ui.footerBar({
        class: 'sc-foot',
        lead: h('div', { class: 'sc-foot__lead' }, h('span', { class: 'sc-foot__icon' }, icon('layers', { size: 22 })),
          h('div', h('strong', { class: 'sc-foot__sum', dataset: { totals: '' } }, totals.text), h('p', 'Save as a reusable scenario set'))),
        actions: [saveDraftButton('sc:save-draft-foot'), reviewButton('Review & save set', 'sc:review-foot')],
      }),
    ];
  }

  ensure();
  Object.assign(view, mountView(root, render, sliceStore(store, pick)));

  return {
    update(next) {
      route = next;
      const nextRef = envRefOf(route);
      if (refKey(nextRef) !== refKey(envRef)) { envRef = nextRef; draftId = draftIdFor(envRef); upload = null; }
      ensure();
      view.refresh();
    },
    destroy() { view.destroy(); },
  };
}
