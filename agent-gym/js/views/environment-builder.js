// N2 Create environment: chat, environment preview and component settings over one EnvironmentDraft.
// Route query: tab (topology|tools|data|permissions), ctab (behavior|tools), select (node.<id> | edge.<relationId> | none),
// returnTo (experiment id), focus=describe. Every count comes from environment/selectors.js.
import { h, s, mountView } from '../components/dom.js';
import { icon, appIcon } from '../components/icons.js';
import * as ui from '../components/ui.js';
import { digestOf } from '../model.js';
import {
  CATALOG, DEDUP_CONTRACT, DEDUP_LABEL, FAILURE_LABEL, LINK_FIELDS, PERMISSION_LABEL, catalogEntry, matchRuleOf,
} from '../environment/catalog.js';
import {
  DRAFT_ID, applyEnvironmentCommand, contentOf, dedupAssumptionId, describeChanges, draftStatus, redoEnvironment, undoEnvironment, validateEnvironmentDraft,
} from '../environment/commands.js';
import { MAX_MESSAGE, sendAssistantMessage } from '../environment/assistant.js';
import { ensureEnvironmentDraft, seedDraft } from '../environment/seed.js';
import { agentContext, draftSummary, plural } from '../environment/selectors.js';
import { SALES_FOLLOW_UP } from '../environment/validate.js';
import { saveEnvironmentTemplate, templateRefFor, useEnvironmentInExperiment } from '../environment/templates.js';
import { FIXTURE_LIMITS, parseEnvironmentFixture } from '../environment/fixture-file.js';

const TABS = [{ id: 'topology', label: 'Topology' }, { id: 'tools', label: 'Tools' }, { id: 'data', label: 'Data' }, { id: 'permissions', label: 'Permissions' }];
const CTABS = [{ id: 'behavior', label: 'Behavior' }, { id: 'tools', label: 'Tools' }];
const DEFAULT_EXPERIMENT = 'exp-029';
const NODE = { w: 232, h: 98, gx: 126, gy: 80, px: 30, py: 6 };
const FIELDS = ['name', 'enabledTools', 'permission', 'failureBehavior', 'dedup'];

const pickFields = c => Object.fromEntries(FIELDS.map(k => [k, k === 'enabledTools' ? [...c.enabledTools] : c[k]]));
const sameFields = (a, b) => digestOf(a) === digestOf(b);
const options = labels => Object.entries(labels).map(([value, label]) => ({ value, label }));
const statusLabel = status => ui.STATUS[status]?.label ?? status;
const closeButton = close => [ui.button({ label: 'Close', onClick: () => close(), autofocus: true })];

export function mount(root, ctx) {
  const { store, router, announce } = ctx;
  let route = ctx.route;
  let message = '';
  let working = null;
  let savedAt = null;
  let lastSelect = route.query.select;

  const draftNow = () => store.getState().environmentDrafts[DRAFT_ID];
  const send = (reducer, cmd) => {
    const result = store.dispatch(reducer, cmd);
    if (!result.ok) announce(result.error.message);
    return result;
  };
  const command = cmd => send(applyEnvironmentCommand, { draftId: DRAFT_ID, command: cmd });
  const experimentId = () => {
    const id = route.query.returnTo;
    return id && store.getState().experiments[id] ? id : DEFAULT_EXPERIMENT;
  };
  const select = value => { lastSelect = value ?? undefined; router.replaceQuery({ select: value }); };

  store.dispatch(ensureEnvironmentDraft, { draftId: DRAFT_ID });
  // Reset demo data empties the drafts; recreate ours after the store has finished notifying.
  const unsubscribe = store.subscribe(state => { if (!state.environmentDrafts[DRAFT_ID]) queueMicrotask(() => store.dispatch(ensureEnvironmentDraft, { draftId: DRAFT_ID })); });

  function selectionOf(draft, value = route.query.select) {
    if (value === 'none') return { kind: 'none' };
    if (value?.startsWith('edge.') && draft.relations.some(r => r.id === value.slice(5))) return { kind: 'edge', id: value.slice(5) };
    if (value?.startsWith('node.') && draft.components.some(c => c.id === value.slice(5))) return { kind: 'node', id: value.slice(5) };
    const fallback = draft.components.find(c => c.id === 'gmail') ?? draft.components[0];
    return fallback ? { kind: 'node', id: fallback.id } : { kind: 'none' };
  }

  function workingFor(component) {
    const fresh = () => ({ componentId: component.id, base: pickFields(component), fields: pickFields(component) });
    if (!working || working.componentId !== component.id) working = fresh();
    else if (sameFields(working.fields, working.base) && !sameFields(working.base, pickFields(component))) working = fresh();
    return working;
  }
  const isDirty = component => !!working && working.componentId === component.id && !sameFields(working.fields, pickFields(component));

  function applyWorking(component) {
    const current = pickFields(component);
    const patch = Object.fromEntries(FIELDS.filter(k => digestOf(working.fields[k]) !== digestOf(current[k])).map(k => [k, working.fields[k]]));
    const before = contentOf(draftNow());
    if (!command({ type: 'updateComponent', componentId: component.id, patch }).ok) return false;
    working = null;
    const changes = describeChanges(before, contentOf(draftNow()));
    announce(changes.length ? `Applied: ${changes.join('; ')}.` : 'No changes to apply.');
    return true;
  }

  function askUnapplied(component) {
    return new Promise(resolve => ui.openDialog({
      title: `Unapplied changes to ${component.name}`,
      description: 'Apply them as one undoable change, discard them, or keep editing.',
      actions: close => [
        ui.button({ label: 'Keep editing', onClick: () => close(null), autofocus: true }),
        ui.button({ label: 'Discard changes', onClick: () => close('discard') }),
        ui.button({ label: 'Apply changes', variant: 'primary', onClick: () => close('apply') }),
      ],
      onClose: choice => resolve(choice ?? null),
    }));
  }

  /** Resolves unapplied edits on the component being left. False when the user keeps editing. */
  async function leaveComponent(draft, fromValue, toValue) {
    const from = selectionOf(draft, fromValue);
    const component = from.kind === 'node' && draft.components.find(c => c.id === from.id);
    const to = selectionOf(draft, toValue);
    if (!component || !isDirty(component) || (to.kind === 'node' && to.id === component.id)) return true;
    const choice = await askUnapplied(component);
    if (!choice) return false;
    if (choice === 'apply' && !applyWorking(draftNow().components.find(c => c.id === component.id))) return false;
    working = null;
    return true;
  }

  async function changeSelection(value) {
    if (await leaveComponent(draftNow(), route.query.select, value)) select(value);
  }

  function undoRedo(reducer, verb) {
    const before = contentOf(draftNow());
    if (!send(reducer, { draftId: DRAFT_ID }).ok) return;
    const changes = describeChanges(before, contentOf(draftNow()));
    announce(`${verb}${changes.length ? `: ${changes.join('; ')}` : ''}. Status: ${statusLabel(draftStatus(draftNow()))}.`);
  }

  function sendMessage(text) {
    const clean = String(text ?? '').trim();
    if (!clean) { announce('Describe a change first.'); return; }
    const keep = message;
    message = '';
    if (!send(sendAssistantMessage, { draftId: DRAFT_ID, text: clean }).ok) { message = keep; view.refresh(); return; }
    const log = root.querySelector('.env-chat__log');
    if (log) log.scrollTop = log.scrollHeight;
    const reply = draftNow().chat.at(-1);
    announce([reply.text, ...(reply.changes ?? [])].join(' '));
  }

  function validateNow() {
    if (!send(validateEnvironmentDraft, { draftId: DRAFT_ID }).ok) return;
    const draft = draftNow();
    const report = draft.validation;
    const unapplied = draft.components.some(isDirty) ? ' Unapplied component edits were not included.' : '';
    const detail = report.status === 'invalid' ? `${plural(report.errors.length, 'error')} to fix.`
      : report.status === 'needs_review' ? `${plural(report.pendingAssumptionIds.length, 'assumption')} to confirm.` : 'Ready to save as a template.';
    announce(`Validation: ${statusLabel(report.status)}. ${detail}${unapplied}`);
  }

  function saveDraft() {
    savedAt = draftNow().revision;
    view.refresh();
    announce('Draft saved.');
  }

  function commitName(value) {
    if (value.trim() === draftNow().name) { view.refresh(); return; }
    if (command({ type: 'rename', name: value }).ok) announce(`Environment renamed to ${draftNow().name}.`);
    else view.refresh();
  }

  function saveTemplate() {
    const draft = draftNow();
    const ref = templateRefFor(store.getState(), DRAFT_ID);
    if (!send(saveEnvironmentTemplate, { draftId: DRAFT_ID, validationDigest: draft.validation?.digest }).ok) return;
    const state = store.getState();
    const revision = state.environments[`${ref.id}@${ref.rev}`];
    const exp = state.experiments[experimentId()];
    const current = state.environments[`${exp.environmentRef.id}@${exp.environmentRef.rev}`];
    announce(`Saved ${revision.name} v${revision.rev} as a template.`);
    ui.openDialog({
      title: 'Template saved',
      description: `${revision.name} v${revision.rev} is saved as an immutable revision (digest ${revision.digest}). ${exp.title} still uses ${current?.name ?? 'its environment'} v${exp.environmentRef.rev} until you choose.`,
      children: h('p', h('a', { href: router.href('environment-revision', ref), class: 'env-link' }, `View ${revision.name} v${revision.rev}`)),
      actions: close => [
        ui.button({ label: 'Keep current environment', onClick: () => close('keep'), autofocus: true }),
        ui.button({ label: 'Use in experiment', variant: 'primary', onClick: () => close('use') }),
      ],
      onClose: choice => { if (choice === 'use') useInExperiment(ref); else if (choice === 'keep') announce(`${exp.title} keeps its current environment.`); },
    });
  }

  function useInExperiment(ref) {
    const id = experimentId();
    const result = store.dispatch(useEnvironmentInExperiment, { experimentId: id, environmentRef: ref });
    if (!result.ok) {
      announce('Dependencies not matched. The experiment keeps its current environment.');
      ui.openDialog({ title: 'Dependencies not matched', description: 'The experiment keeps its current environment.', children: h('ul', { class: 'env-list' }, (result.error.errors ?? [result.error]).map(e => h('li', e.message))), actions: closeButton });
      return;
    }
    const env = store.getState().environments[`${ref.id}@${ref.rev}`];
    announce(`${store.getState().experiments[id].title} now uses ${env.name} v${env.rev}. Dependencies matched.`);
    router.go('workbench', { experimentId: id });
  }

  function addComponentDialog() {
    const draft = draftNow();
    const dlg = ui.openDialog({
      title: 'Add component', size: 'md',
      description: 'The local catalogue of simulated components. Adding one connects nothing; it gives the agent simulated tools.',
      children: h('ul', { class: 'env-catalog' }, CATALOG.map(entry => {
        const c = entry.component;
        const present = draft.components.some(x => x.id === entry.id);
        return h('li', { class: 'env-catalog__item' },
          appIcon(c.app, { size: 28 }),
          h('div', { class: 'env-catalog__text' }, h('strong', c.name), h('span', `${c.category} · ${plural(c.tools.length, 'tool')}`), h('small', c.description)),
          ui.button({
            label: present ? 'Added' : 'Add', size: 'sm', variant: present ? 'secondary' : 'outline', disabled: present, reason: `${c.name} is already in this environment`,
            ariaLabel: present ? `${c.name} is already added` : `Add ${c.name}`,
            onClick: () => {
              dlg.close();
              if (command({ type: 'addComponent', catalogId: entry.id }).ok) { announce(`Added ${c.name}. You can undo.`); changeSelection(`node.${entry.id}`); }
            },
          }));
      })),
      actions: closeButton,
    });
  }

  async function removeComponent(component) {
    const draft = draftNow();
    const links = draft.relations.filter(r => r.from === component.id || r.to === component.id);
    const still = new Set(draft.components.filter(c => c.id !== component.id).flatMap(c => c.tools.filter(t => c.enabledTools.includes(t.name)).map(t => `${c.kind}.${t.name}`)));
    const lost = SALES_FOLLOW_UP.capabilities.filter(cap => !still.has(cap));
    const warnings = [
      links.length && `${plural(links.length, 'relationship')} will point at a missing component.`,
      lost.length && `${SALES_FOLLOW_UP.name} needs ${lost.join(', ')}.`,
    ].filter(Boolean);
    const yes = await ui.confirmDialog({
      title: `Remove ${component.name}?`,
      message: warnings.length ? `${warnings.join(' ')} Validation will fail until this is fixed. You can undo.` : 'Nothing else depends on it. You can undo.',
      confirmLabel: 'Remove component', danger: true,
    });
    if (!yes || !command({ type: 'removeComponent', componentId: component.id }).ok) return;
    working = null;
    announce(`Removed ${component.name}.${warnings.length ? ` ${warnings.join(' ')}` : ''}`);
    select('none');
  }

  async function onFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const isJson = /\.json$/i.test(file.name) && (!file.type || /json/.test(file.type));
    const parsed = !isJson ? { ok: false, errors: ['Only a local .json fixture file can be attached'] }
      : file.size > FIXTURE_LIMITS.bytes ? parseEnvironmentFixture('', file.size) : parseEnvironmentFixture(await file.text(), file.size);
    if (!parsed.ok) {
      ui.openDialog({
        title: 'Fixture not imported', description: `${file.name} was read in this browser only and did not change the draft.`,
        children: h('ul', { class: 'env-list' }, parsed.errors.map(e => h('li', e))), actions: closeButton,
      });
      return;
    }
    const sum = parsed.summary;
    ui.openDialog({
      title: 'Import local fixture?',
      description: `${file.name} was read in this browser only. Nothing was uploaded. Importing replaces the draft's components, relationships and data seed as one undoable change.`,
      children: h('dl', { class: 'env-dl' },
        h('dt', 'Name'), h('dd', sum.name),
        h('dt', 'Contents'), h('dd', `${plural(sum.systems, 'system')} · ${plural(sum.tools, 'tool')} · ${plural(sum.relationships, 'relationship')}`),
        h('dt', 'Assumptions'), h('dd', String(sum.assumptions)),
        h('dt', 'Mode'), h('dd', 'Simulated')),
      actions: close => [ui.button({ label: 'Cancel', onClick: () => close(), autofocus: true }), ui.button({ label: 'Import fixture', variant: 'primary', onClick: () => close('import') })],
      onClose: choice => {
        if (choice !== 'import' || !command({ type: 'importFixture', content: parsed.content }).ok) return;
        working = null;
        announce(`Imported ${sum.name}. You can undo.`);
        select(null);
      },
    });
  }

  const fileInput = h('input', { type: 'file', accept: '.json,application/json', class: 'env-file', tabIndex: -1, 'aria-hidden': 'true', onChange: onFile });

  function contextDialog(kind) {
    const info = agentContext(draftNow());
    const [title, description, items] = {
      dependencies: ['Tool dependencies', `What ${info.workflow} calls, and which simulated component provides it.`,
        info.dependencies.map(d => h('li', h('code', d.capability), ' ', d.component ? `· ${d.component}` : h('strong', { class: 'env-bad' }, '· missing')))],
      approvals: ['Approval requirement', 'Tools that wait for a trusted approval grant. A prompt that says "approved" or "skip approval" never creates one.',
        info.approvals.length ? info.approvals.map(a => h('li', `${a.component} · `, h('code', a.tool), ' waits for an approval grant'))
          : [h('li', `No tool requires approval. ${info.workflow} needs approval before ${SALES_FOLLOW_UP.approvalRequiredFor.join(', ')}.`)]],
      writes: ['Write side effects', 'Every enabled tool that changes simulated state.',
        info.writes.map(w => h('li', `${w.component} · `, h('code', w.tool), ` · ${PERMISSION_LABEL[w.permission]}`,
          w.failureBehavior === 'timeout_after_send' ? ' · Timeout after send: the simulated write commits, then the response times out, so a blind retry is not safe' : '',
          w.dedup !== 'none' ? ` · ${DEDUP_LABEL[w.dedup]}` : ''))],
    }[kind];
    ui.openDialog({ title, description, size: 'md', children: h('ul', { class: 'env-list' }, items), actions: closeButton });
  }

  function render(state) {
    const draft = state.environmentDrafts[DRAFT_ID] ?? seedDraft();
    const summary = draftSummary(draft);
    const sel = selectionOf(draft);
    return [
      header(draft, summary),
      ui.columns({ class: 'env-cols', children: [chatPanel(draft), previewPanel(draft, summary, sel), sidePanel(draft, sel)] }),
      footer(summary),
    ];
  }

  function header(draft, summary) {
    return ui.pageHeader({
      class: 'env-head', title: 'Create environment', subtitle: 'Describe it. Refine it. Save a reusable template.',
      breadcrumb: [
        { label: 'Agent Gym', href: router.href('workbench', { experimentId: experimentId() }) },
        { label: 'Environments', href: router.href('environment-library', {}, { returnTo: route.query.returnTo }) },
        { label: 'Create environment' },
      ],
      actions: [
        ui.button({ label: 'Save draft', onClick: saveDraft, focusKey: 'env:save-draft' }),
        ui.button({ label: 'Validate environment', variant: 'primary', onClick: validateNow, focusKey: 'env:validate-head' }),
      ],
      meta: [
        ui.textInput({ value: draft.name, icon: 'pencil', ariaLabel: 'Environment name', class: 'env-name', focusKey: 'env:name', onChange: commitName }),
        ui.badge({ status: summary.status, class: 'env-status' }),
        savedAt === draft.revision && h('span', { class: 'env-saved' }, icon('check', { size: 14 }), 'Draft saved'),
      ],
    });
  }

  function textWithChips(text, chips = []) {
    const names = chips.map(id => catalogEntry(id)?.component.name).filter(Boolean).sort((a, b) => b.length - a.length);
    if (!names.length) return text;
    return text.split(new RegExp(`(${names.join('|')})`)).map(part => {
      const entry = names.includes(part) && CATALOG.find(e => e.component.name === part);
      return entry ? ui.appChip({ app: entry.component.app, label: part, class: 'env-inline-chip' }) : part;
    });
  }

  // A chip that shows the full app name, over a transparent native select that keeps keyboard and screen-reader use.
  function appSelect(draft, component) {
    const used = new Set(draft.components.map(c => c.id));
    return h('label', { class: 'env-appselect', title: `Change ${component.name}` },
      appIcon(component.app, { size: 16 }), h('span', { class: 'env-appselect__label' }, component.name), icon('chevron-down', { size: 12 }),
      h('select', {
        class: 'env-appselect__native', value: component.id, 'aria-label': `Change ${component.name}`, dataset: { focusKey: `env:app:${component.id}` },
        onChange: e => {
          const id = e.target.value;
          if (!command({ type: 'replaceComponent', componentId: component.id, catalogId: id }).ok) return;
          const broken = draftSummary(draftNow()).brokenRelations.length;
          announce(`Replaced ${component.name} with ${catalogEntry(id).component.name}.${broken ? ` ${plural(broken, 'relationship')} now point at a missing component.` : ''} You can undo.`);
        },
      },
      CATALOG.filter(e => e.origin === 'app').map(e => h('option', { value: e.id, disabled: used.has(e.id) && e.id !== component.id }, e.component.name)),
      h('option', { value: 'other', disabled: true }, 'Other apps: not simulated in this preview')));
  }

  function turnBody(draft, turn, index) {
    switch (turn.kind) {
      case 'apps':
        return [h('strong', { class: 'env-turn__title' }, turn.text),
          h('div', { class: 'env-apps' }, draft.components.filter(c => catalogEntry(c.id)?.origin === 'app').map(c => appSelect(draft, c))),
          h('p', { class: 'env-turn__hint' }, 'Change an app if needed')];
      case 'created':
        return [h('p', turn.text), h('div', { class: 'env-assume' }, h('strong', 'Assumptions to review'),
          h('ul', (turn.changes ?? []).map(text => h('li', icon('alert', { size: 15 }), text))))];
      case 'update':
        return [h('p', turn.text), h('ul', { class: 'env-changes' }, (turn.changes ?? []).map(text => h('li', icon('check', { size: 15 }), text)))];
      case 'help':
        return [h('p', turn.text), h('div', { class: 'env-options', role: 'group', 'aria-label': 'Try one of these' },
          (turn.chips ?? []).map((option, i) => ui.chip({ label: option, tone: 'violet', onClick: () => sendMessage(option), focusKey: `env:option:${index}:${i}` })))];
      default:
        return h('p', turn.role === 'user' ? textWithChips(turn.text, turn.chips) : turn.text);
    }
  }

  function chatPanel(draft) {
    return ui.panel({
      title: 'Build with natural language', subtitle: 'Describe systems, data and access.', class: 'env-chat',
      children: [
        h('ol', { class: 'env-chat__log', dataset: { scrollKey: 'env:chat' }, 'aria-label': 'Conversation with the scripted assistant demo' },
          draft.chat.map((turn, i) => h('li', { class: `env-turn env-turn--${turn.role}${turn.kind ? ` env-turn--${turn.kind}` : ''}` },
            h('span', { class: 'env-turn__avatar', 'aria-hidden': 'true' }, icon(turn.role === 'user' ? 'user' : 'sparkle', { size: 18 })),
            h('div', { class: 'env-turn__bubble' }, h('span', { class: 'gym-sr' }, turn.role === 'user' ? 'You: ' : 'Assistant: '), turnBody(draft, turn, i))))),
        h('form', { class: 'env-composer', onSubmit: e => { e.preventDefault(); sendMessage(message); } },
          h('fieldset', { class: 'env-composer__row' },
            h('legend', { class: 'env-demo-tag' }, 'Scripted assistant demo'),
            h('input', {
              class: 'env-composer__input', type: 'text', value: message, maxLength: MAX_MESSAGE, placeholder: 'Describe another change...',
              'aria-label': 'Describe another change (scripted assistant demo)', autocomplete: 'off', dataset: { focusKey: 'env:message' },
              onInput: e => { message = e.target.value; },
            }),
            ui.iconButton({ icon: 'paperclip', label: 'Attach a local JSON fixture file', variant: 'ghost', size: 'sm', focusKey: 'env:attach', onClick: () => fileInput.click() }),
            ui.iconButton({ icon: 'send', label: 'Send', variant: 'primary', size: 'sm', type: 'submit', focusKey: 'env:send' }),
            fileInput),
          h('p', { class: 'env-composer__hint' }, 'Changes appear in the preview. Undo anytime.')),
      ],
    });
  }

  const boxOf = c => ({ x: NODE.px + c.pos.x * (NODE.w + NODE.gx), y: NODE.py + c.pos.y * (NODE.h + NODE.gy) });

  function anchors(a, b) {
    const A = boxOf(a), B = boxOf(b);
    const ac = { x: A.x + NODE.w / 2, y: A.y + NODE.h / 2 }, bc = { x: B.x + NODE.w / 2, y: B.y + NODE.h / 2 };
    const dx = bc.x - ac.x, dy = bc.y - ac.y;
    if (Math.abs(dx) * NODE.h > Math.abs(dy) * NODE.w) {
      const sx = Math.sign(dx) * NODE.w / 2;
      return [{ x: ac.x + sx, y: ac.y }, { x: bc.x - sx, y: bc.y }];
    }
    const sy = Math.sign(dy) * NODE.h / 2;
    return [{ x: ac.x, y: ac.y + sy }, { x: bc.x, y: bc.y - sy }];
  }

  function topology(draft, sel) {
    const cols = Math.max(2, ...draft.components.map(c => c.pos.x + 1));
    const rows = Math.max(1, ...draft.components.map(c => c.pos.y + 1));
    const width = NODE.px * 2 + cols * NODE.w + (cols - 1) * NODE.gx;
    const height = NODE.py * 2 + rows * NODE.h + (rows - 1) * NODE.gy;
    const byId = new Map(draft.components.map(c => [c.id, c]));
    const seen = new Map();
    const edges = draft.relations.filter(r => byId.has(r.from) && byId.has(r.to) && r.from !== r.to).map(r => {
      const [p, q] = anchors(byId.get(r.from), byId.get(r.to));
      const pair = [r.from, r.to].sort().join('|');
      const nth = seen.get(pair) ?? 0;
      seen.set(pair, nth + 1);
      const horizontal = Math.abs(q.x - p.x) > Math.abs(q.y - p.y);
      return { r, p, q, mid: { x: (p.x + q.x) / 2 + (horizontal ? 0 : nth * 34), y: (p.y + q.y) / 2 + (horizontal ? nth * 30 : 0) }, on: sel.kind === 'edge' && sel.id === r.id };
    });
    const svg = s('svg', { class: 'env-topo__wires', width, height, viewBox: `0 0 ${width} ${height}`, 'aria-hidden': 'true' },
      edges.map(e => s('g', { class: `env-wire${e.on ? ' is-selected' : ''}` },
        s('line', { x1: e.p.x, y1: e.p.y, x2: e.q.x, y2: e.q.y }),
        s('circle', { cx: e.p.x, cy: e.p.y, r: 3.5 }), s('circle', { cx: e.q.x, cy: e.q.y, r: 3.5 }))));
    return h('div', { class: 'env-topo-scroll', dataset: { scrollKey: 'env:topo' } },
      h('div', { class: 'env-topo', style: { width: `${width}px`, height: `${height}px` }, role: 'group', 'aria-label': 'Topology. Select a component or a relationship.' },
        svg,
        edges.map(e => h('button', {
          type: 'button', class: `env-edge${e.on ? ' is-selected' : ''}`, style: { left: `${e.mid.x}px`, top: `${e.mid.y}px` }, 'aria-pressed': String(e.on),
          'aria-label': `${e.r.field} relationship between ${byId.get(e.r.from).name} and ${byId.get(e.r.to).name}`, dataset: { focusKey: `env:edge:${e.r.id}` },
          onClick: () => changeSelection(`edge.${e.r.id}`),
        }, e.r.field)),
        draft.components.map(c => {
          const on = sel.kind === 'node' && sel.id === c.id;
          const box = boxOf(c);
          return h('button', {
            type: 'button', class: `env-node${on ? ' is-selected' : ''}`, 'aria-pressed': String(on), dataset: { focusKey: `env:node:${c.id}`, component: c.id },
            style: { left: `${box.x}px`, top: `${box.y}px`, width: `${NODE.w}px`, height: `${NODE.h}px` },
            onClick: () => changeSelection(`node.${c.id}`),
          }, h('span', { class: 'env-node__icon' }, appIcon(c.app, { size: 40 })),
          h('span', { class: 'env-node__text' },
            h('strong', { class: 'env-node__name' }, c.name),
            h('span', { class: 'env-node__meta' }, c.category),
            h('span', { class: 'env-node__meta' }, `${c.description}${c.permission === 'read_only' ? ' (read-only)' : ''}`),
            ui.badge({ status: 'simulated', class: 'env-node__badge' })));
        })));
  }

  const signature = schema => Object.entries(schema).map(([k, v]) => `${k}: ${v}`).join(', ');
  const effectBadge = t => ui.badge({ label: t.effect === 'write' ? 'Write' : 'Read', tone: t.effect === 'write' ? 'violet' : 'gray' });

  function toolsTab(draft, sel) {
    return h('div', { class: 'env-tab-list' }, draft.components.map(c => {
      const on = sel.kind === 'node' && sel.id === c.id;
      return h('section', { class: 'env-tools' },
        h('button', { type: 'button', class: `env-tools__head${on ? ' is-selected' : ''}`, 'aria-pressed': String(on), dataset: { focusKey: `env:tools:${c.id}` }, onClick: () => changeSelection(`node.${c.id}`) },
          appIcon(c.app, { size: 20 }), h('strong', c.name), h('span', { class: 'gym-muted' }, `${c.enabledTools.length} of ${plural(c.tools.length, 'tool')} enabled`)),
        h('ul', c.tools.map(t => h('li', { class: `env-tool${c.enabledTools.includes(t.name) ? '' : ' is-off'}` },
          h('code', t.name), effectBadge(t), h('span', { class: 'env-tool__sig' }, `${signature(t.input)} → ${signature(t.output)}`),
          !c.enabledTools.includes(t.name) && h('span', { class: 'gym-muted' }, 'disabled')))));
    }));
  }

  function dataTab(draft) {
    return h('div', { class: 'env-tab-list' },
      h('p', { class: 'gym-muted' }, 'Synthetic records each run starts from. No production data.'),
      Object.entries(draft.dataSeed).filter(([k]) => k !== 'primary').map(([kind, collections]) => {
        const owners = draft.components.filter(c => c.kind === kind).map(c => c.name);
        return h('section', { class: 'env-data' },
          h('h4', owners.length ? owners.join(', ') : `${kind} (no component)`),
          h('ul', Object.entries(collections).map(([name, value]) => {
            const list = Array.isArray(value) ? value : [];
            return h('li', h('strong', name), ` · ${plural(list.length, 'record')}`,
              list[0] && h('span', { class: 'env-data__sample' }, Object.entries(list[0]).slice(0, 4).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · ')));
          })));
      }));
  }

  function permissionsTab(draft) {
    return h('div', { class: 'env-tab-list' }, h('table', { class: 'env-table' },
      h('thead', h('tr', ['Component', 'Permission', 'Enabled write tools', 'Approval'].map(label => h('th', { scope: 'col' }, label)))),
      h('tbody', draft.components.map(c => {
        const writes = c.tools.filter(t => t.effect === 'write' && c.enabledTools.includes(t.name)).map(t => t.name);
        return h('tr', h('th', { scope: 'row' }, c.name), h('td', PERMISSION_LABEL[c.permission]), h('td', writes.length ? writes.join(', ') : 'None'),
          h('td', c.permission === 'send_requires_approval' ? 'Before every write' : c.permission === 'read_only' ? 'Not applicable' : 'Not required'));
      }))));
  }

  function reportNotice(summary) {
    if (summary.staleReport) return ui.notice({ tone: 'info', class: 'env-notice', text: 'The draft changed after the last validation. Validate again before saving.' });
    const report = summary.report;
    if (report?.status === 'invalid') return ui.notice({ tone: 'error', class: 'env-notice', title: `Invalid: ${plural(report.errors.length, 'error')}.`, children: h('ul', { class: 'env-list' }, report.errors.slice(0, 6).map(e => h('li', e.message))) });
    if (report?.status === 'validated') return ui.notice({ tone: 'success', class: 'env-notice', title: 'Validated.', text: `Report digest ${report.digest}.${report.warnings.length ? ` ${plural(report.warnings.length, 'warning')}: ${report.warnings.map(w => w.message).join(' ')}` : ' No warnings.'}` });
    return null;
  }

  function previewPanel(draft, summary, sel) {
    const tab = TABS.some(t => t.id === route.query.tab) ? route.query.tab : 'topology';
    const pendingComponent = summary.pendingAssumptions[0]?.componentId;
    const broken = summary.brokenRelations;
    const body = { topology: () => topology(draft, sel), tools: () => toolsTab(draft, sel), data: () => dataTab(draft), permissions: () => permissionsTab(draft) }[tab]();
    return ui.panel({
      title: 'Environment preview', class: 'env-preview',
      actions: [
        ui.iconButton({ icon: 'undo', label: 'Undo', disabled: !summary.canUndo, reason: 'Nothing to undo', focusKey: 'env:undo', onClick: () => undoRedo(undoEnvironment, 'Undone') }),
        ui.iconButton({ icon: 'redo', label: 'Redo', disabled: !summary.canRedo, reason: 'Nothing to redo', focusKey: 'env:redo', onClick: () => undoRedo(redoEnvironment, 'Redone') }),
        ui.button({ label: 'Add component', icon: 'plus', variant: 'outline', size: 'sm', focusKey: 'env:add', onClick: addComponentDialog }),
      ],
      children: [
        ui.tabs({ items: TABS.map(t => ({ ...t, panelId: 'env-tabpanel' })), value: tab, label: 'Preview views', focusKey: 'env:tab', class: 'env-tabs', onChange: id => router.replaceQuery({ tab: id }) }),
        h('div', { id: 'env-tabpanel', role: 'tabpanel', class: 'env-tabpanel', 'aria-label': TABS.find(t => t.id === tab).label }, body),
        h('p', { class: 'env-counts' }, summary.text),
        h('section', { class: 'env-gen', 'aria-label': 'Generated components' },
          h('h3', { class: 'env-gen__title' }, 'Generated components'),
          h('ul', { class: 'env-gen__rows' }, summary.rows.map(r => {
            const on = sel.kind === 'node' && sel.id === r.id;
            return h('li', h('button', { type: 'button', class: `env-gen__row${on ? ' is-selected' : ''}`, 'aria-pressed': String(on), dataset: { focusKey: `env:row:${r.id}` }, onClick: () => changeSelection(`node.${r.id}`) },
              appIcon(r.app, { size: 20 }), h('span', { class: 'env-gen__name' }, r.name), h('span', { class: 'env-gen__tools' }, plural(r.toolCount, 'tool')), h('span', { class: 'env-gen__status' }, ui.badge({ status: r.status }))));
          }))),
        broken.length > 0 && ui.notice({
          tone: 'error', class: 'env-notice', text: `${plural(broken.length, 'relationship')} point${broken.length === 1 ? 's' : ''} at a missing component: ${broken.map(r => `${r.field} (${r.from} to ${r.to})`).join(', ')}.`,
          actions: ui.button({ label: 'Remove broken links', size: 'sm', variant: 'outline', focusKey: 'env:fix-links',
            onClick: () => { if (command({ type: 'batch', commands: broken.map(r => ({ type: 'removeRelation', relationId: r.id })) }).ok) announce('Removed the broken relationships. You can undo.'); } }),
        }),
        summary.pending > 0 && ui.notice({
          tone: 'warning', class: 'env-notice env-notice--pending', text: `${plural(summary.pending, 'behavior assumption')} need${summary.pending === 1 ? 's' : ''} confirmation`,
          actions: pendingComponent && ui.button({ label: 'Review', variant: 'link', size: 'sm', focusKey: 'env:review', onClick: () => changeSelection(`node.${pendingComponent}`) }),
        }),
        reportNotice(summary),
        h('div', { class: 'env-context' },
          h('span', { class: 'env-context__label' }, icon('info', { size: 16 }), 'Agent context'),
          ui.chip({ label: 'Tool dependencies', onClick: () => contextDialog('dependencies'), focusKey: 'env:ctx:deps' }),
          ui.chip({ label: 'Approval requirement', onClick: () => contextDialog('approvals'), focusKey: 'env:ctx:approval' }),
          ui.chip({ label: 'Write side effects', onClick: () => contextDialog('writes'), focusKey: 'env:ctx:writes' })),
        h('p', { class: 'env-hint' }, 'Select a component or relationship to edit.'),
      ],
    });
  }

  function behaviorForm(draft, component, w) {
    const set = patch => { Object.assign(w.fields, patch); view.refresh(); };
    const readOnly = w.fields.permission === 'read_only';
    const assumption = draft.assumptions.find(a => a.id === dedupAssumptionId(component.id));
    return h('div', { class: 'env-form' },
      ui.textInput({ label: 'Name', value: w.fields.name, focusKey: 'env:f:name', onInput: v => set({ name: v }) }),
      ui.select({
        label: 'Mode', value: 'simulated', focusKey: 'env:f:mode', onChange: () => {},
        options: [{ value: 'simulated', label: 'Simulated' }, { value: 'live', label: 'Live (not available: this preview only runs simulated components)', disabled: true }],
      }),
      h('fieldset', { class: 'env-fieldset' }, h('legend', { class: 'gym-field__label' }, 'Available tools'),
        component.tools.map(t => ui.checkbox({
          label: t.name, checked: w.fields.enabledTools.includes(t.name), focusKey: `env:f:tool:${t.name}`,
          disabled: readOnly && t.effect === 'write', reason: 'A read-only component cannot enable write tools',
          onChange: on => set({ enabledTools: component.tools.map(x => x.name).filter(n => n === t.name ? on : w.fields.enabledTools.includes(n)) }),
        }))),
      ui.select({
        label: 'Permissions', value: w.fields.permission, options: options(PERMISSION_LABEL), focusKey: 'env:f:permission',
        onChange: v => set({ permission: v, ...(v === 'read_only' && { enabledTools: w.fields.enabledTools.filter(n => component.tools.find(t => t.name === n)?.effect === 'read') }) }),
      }),
      ui.select({
        label: 'Failure behavior', value: w.fields.failureBehavior, options: options(FAILURE_LABEL), focusKey: 'env:f:failure',
        hint: w.fields.failureBehavior === 'timeout_after_send' ? 'Available for scenario injection. The send commits, then the response times out. Not safe to retry.' : 'No fault hook. Scenarios cannot inject a timeout here.',
        onChange: v => set({ failureBehavior: v }),
      }),
      ui.select({
        label: 'Deduplication support', value: w.fields.dedup, options: options(DEDUP_LABEL), focusKey: 'env:f:dedup',
        hint: w.fields.dedup === 'custom_adapter' ? 'Confirm behavior against your tool contract.' : w.fields.dedup === 'idempotency_key' ? 'Writes with the same idempotency key commit once.' : 'Retries can repeat a write.',
        onChange: v => set({ dedup: v }),
      }),
      w.fields.dedup === 'custom_adapter' && h('div', { class: 'env-contract' },
        !assumption ? h('span', { class: 'gym-muted' }, 'Apply changes to add this assumption for review.')
          : assumption.state === 'confirmed' ? ui.badge({ label: 'Behavior confirmed', tone: 'green', icon: 'check' })
          : ui.button({
            label: 'Confirm behavior', size: 'sm', variant: 'outline', icon: 'check', focusKey: 'env:confirm',
            onClick: () => { if (command({ type: 'confirmAssumption', assumptionId: assumption.id }).ok) announce(`Confirmed the ${component.name} adapter contract. Validate again to update the report.`); },
          }),
        h('details', h('summary', { dataset: { focusKey: 'env:contract' } }, 'View contract'), h('ul', DEDUP_CONTRACT.map(line => h('li', line))))));
  }

  function toolsForm(component) {
    return h('div', { class: 'env-form' },
      h('ul', { class: 'env-side-tools' }, component.tools.map(t => h('li',
        h('div', h('code', t.name), ' ', effectBadge(t), !component.enabledTools.includes(t.name) && h('span', { class: 'gym-muted' }, ' disabled')),
        h('small', { class: 'env-tool__sig' }, `in { ${signature(t.input)} }`),
        h('small', { class: 'env-tool__sig' }, `out { ${signature(t.output)} }`)))),
      ui.button({ label: 'Remove component', variant: 'danger', size: 'sm', icon: 'trash', focusKey: 'env:remove', onClick: () => removeComponent(component) }));
  }

  function sidePanel(draft, sel) {
    const close = ui.iconButton({ icon: 'x', label: 'Close settings', variant: 'ghost', focusKey: 'env:close', onClick: () => changeSelection('none') });
    if (sel.kind === 'edge') {
      const r = draft.relations.find(x => x.id === sel.id);
      const [a, b] = [r.from, r.to].map(id => draft.components.find(c => c.id === id));
      return ui.panel({
        title: `${r.field} relationship`, subtitle: 'Field link', icon: 'branch', actions: close, class: 'env-side',
        children: h('div', { class: 'env-form' },
          h('dl', { class: 'env-dl' },
            h('dt', 'From'), h('dd', `${a.name} · `, h('code', LINK_FIELDS[a.kind]?.[r.field] ?? r.field)),
            h('dt', 'To'), h('dd', `${b.name} · `, h('code', LINK_FIELDS[b.kind]?.[r.field] ?? r.field)),
            h('dt', 'Match rule'), h('dd', matchRuleOf(r.field))),
          ui.notice({ tone: 'info', text: 'This is a field link: records with matching values refer to the same entity. It is not an execution order and not a data sync. Nothing is copied between systems.' }),
          ui.button({
            label: 'Remove relationship', variant: 'outline', icon: 'trash', size: 'sm', focusKey: 'env:remove-rel',
            onClick: () => { if (command({ type: 'removeRelation', relationId: r.id }).ok) { announce(`Removed the ${r.field} relationship between ${a.name} and ${b.name}. You can undo.`); select('none'); } },
          })),
      });
    }
    if (sel.kind === 'none') {
      return ui.panel({ title: 'Settings', class: 'env-side', children: ui.emptyState({ icon: 'sliders', title: 'Select a component or relationship to edit.', text: 'Choose a node, a relationship label or a generated component row.' }) });
    }
    const component = draft.components.find(c => c.id === sel.id);
    const w = workingFor(component);
    const dirty = isDirty(component);
    const ctab = CTABS.some(t => t.id === route.query.ctab) ? route.query.ctab : 'behavior';
    return ui.panel({
      title: component.name, subtitle: 'Component settings', icon: appIcon(component.app, { size: 30 }), actions: close, class: 'env-side env-settings',
      children: [
        ui.tabs({ items: CTABS.map(t => ({ ...t, panelId: 'env-sidepanel' })), value: ctab, label: 'Component settings', focusKey: 'env:ctab', class: 'env-ctabs', onChange: id => router.replaceQuery({ ctab: id }) }),
        h('div', { id: 'env-sidepanel', role: 'tabpanel', 'aria-label': ctab === 'behavior' ? 'Behavior' : 'Tools' }, ctab === 'behavior' ? behaviorForm(draft, component, w) : toolsForm(component)),
        h('div', { class: 'env-side__actions' },
          ui.button({ label: 'Reset changes', disabled: !dirty, reason: 'No unapplied changes', focusKey: 'env:reset', onClick: () => { working = null; view.refresh(); announce('Unapplied changes dropped.'); } }),
          ui.button({ label: 'Apply changes', variant: 'primary', disabled: !dirty, reason: 'No unapplied changes', focusKey: 'env:apply', onClick: () => applyWorking(component) })),
        dirty && h('p', { class: 'env-unapplied' }, 'Unapplied changes. Apply commits them as one undoable change.'),
      ],
    });
  }

  function footer(summary) {
    const report = summary.report;
    const reason = summary.staleReport ? 'The draft changed after the last validation. Validate again.'
      : !report ? 'Validate the environment first.'
      : summary.status === 'invalid' ? `Fix ${plural(report.errors.length, 'validation error')} first.`
      : summary.status === 'needs_review' ? 'Confirm the pending assumption, then validate again.' : null;
    return ui.footerBar({
      class: 'env-footer',
      lead: [
        h('div', { class: 'env-footer__stats' },
          h('span', { class: 'env-ready' }, icon('check-circle', { size: 20 }), `${plural(summary.ready, 'component')} ready`),
          h('span', { class: 'env-footer__rule', 'aria-hidden': 'true' }),
          summary.pending > 0 ? ui.chip({ label: `${plural(summary.pending, 'assumption')} to confirm`, tone: 'amber', icon: 'alert', class: 'env-pending' })
            : h('span', { class: 'env-ready env-ready--muted' }, 'No assumptions to confirm')),
        h('p', { class: 'env-footer__hint' }, 'Validate tool schemas, relationships and state behavior.'),
      ],
      actions: [
        ui.button({ label: 'Save as template', disabled: summary.status !== 'validated', reason, focusKey: 'env:save-template', onClick: saveTemplate }),
        ui.button({ label: 'Validate environment', variant: 'primary', focusKey: 'env:validate', onClick: validateNow }),
      ],
    });
  }

  const view = mountView(root, render, store);
  const dirtyComponent = () => (working ? draftNow()?.components.find(c => c.id === working.componentId && isDirty(c)) : null);
  ctx.setLeaveGuard({
    pending: () => dirtyComponent()?.name ?? null,
    apply: () => { const c = dirtyComponent(); return !c || applyWorking(c); },
    discard: () => { working = null; },
  });
  // On an in-app navigation the shell has just focused the main region (root) to announce the new page; that wins.
  if (route.query.focus === 'describe') queueMicrotask(() => { if (document.activeElement !== root) root.querySelector('[data-focus-key="env:message"]')?.focus(); });

  return {
    async update(next) {
      const from = lastSelect;
      route = next;
      if (next.query.select !== from) {
        lastSelect = next.query.select;
        const draft = draftNow();
        if (draft && !(await leaveComponent(draft, from, next.query.select))) { select(from ?? null); return; }
      }
      view.refresh();
    },
    destroy() { unsubscribe(); view.destroy(); },
  };
}
