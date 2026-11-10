// Run detail: one frozen attempt, its scenario × version matrix and a replay of one recorded execution (plan 9.1).
// The scheduler appends executions; this view only reads them. Its one timer animates the replay cursor.
import { h, mountView } from '../components/dom.js';
import { icon } from '../components/icons.js';
import { badge, button, confirmDialog, emptyState, iconButton, notice, pageHeader, panel, progress } from '../components/ui.js';
import { cancelAttempt, pauseAttempt, resumeAttempt } from '../simulation/attempts.js';
import { attemptFacts, resolveAttempt, versionLabel } from '../runs/facts.js';
import { defaultExecutionKey, findExecution, matrixView, parseExecutionKey } from '../runs/matrix.js';
import { initialCursor, replayFrame, replayReducer } from '../runs/replay.js';
import { blueprintDiagram, paintBlueprint } from '../runs/blueprint.js';
import { assertionList, finalStateView, nodeLabelsOf, paintTrace, traceList } from '../runs/trace.js';
import { stepIndicator } from '../components/steps.js';
import { experimentSteps } from '../experiments/steps.js';
import { attemptNotFound, evidenceTag, grid, impactNotice, reviewBadge, runsCrumbs, statusBadges } from '../runs/page.js';

const TICK_MS = 650;
const STATE_LABEL = { passed: 'Passed', failed: 'Failed', error: 'Error', cancelled: 'Cancelled', next: 'Next', pending: 'Pending' };
const NOT_RUN = { next: 'Next in line; it has no recorded events yet.', pending: 'Not run yet.', cancelled: 'Never ran: the attempt was cancelled.' };

// The store marks a running attempt paused on load, and the model keeps no pause reason. A paused live attempt that was
// not paused from this page since it loaded was paused by the refresh.
const pausedHere = new Set();

export function mount(root, ctx) {
  const { router, store } = ctx;
  let route = ctx.route;
  const expanded = new Set();
  let cursorKey = null, events = [], cursor = initialCursor(0);
  let timer = null;
  let holding = false, missed = false;

  // While the scrubber is dragged, a re-render would replace it mid-drag, so store updates wait for the release.
  const gated = { getState: store.getState, subscribe: fn => store.subscribe(() => { if (holding) missed = true; else fn(); }) };
  const release = () => {
    if (!holding) return;
    holding = false;
    if (missed) { missed = false; view.refresh(); }
  };

  const stopTimer = () => { if (timer !== null) { clearInterval(timer); timer = null; } };

  // A re-render keeps the live replay panel and drops the one it built, so a paint between renders finds it in root.
  function paint(panelEl = root.querySelector('.run-replay')) {
    if (!panelEl) return;
    const frame = replayFrame(events, cursor.position);
    paintBlueprint(panelEl, frame);
    paintTrace(panelEl, frame);
    const scrub = panelEl.querySelector('.run-scrub__range');
    if (scrub) scrub.value = String(cursor.position);
    const where = panelEl.querySelector('.run-scrub__where');
    if (where) where.textContent = `Event ${cursor.position} of ${events.length}`;
  }

  function move(action, { repaintOnly = false } = {}) {
    const wasPlaying = cursor.playing;
    cursor = replayReducer(cursor, action, events.length);
    if (cursor.playing && timer === null) timer = setInterval(() => move({ type: 'tick' }, { repaintOnly: true }), TICK_MS);
    if (!cursor.playing) stopTimer();
    if (repaintOnly && wasPlaying === cursor.playing) paint(); else view.refresh();
  }

  function syncSelection(executions) {
    const key = parseExecutionKey(route.query.run) ? route.query.run : defaultExecutionKey(executions);
    const execution = key ? findExecution(executions, key) : null;
    const nextEvents = execution?.events ?? [];
    if (key !== cursorKey || nextEvents.length !== events.length) { stopTimer(); cursor = initialCursor(nextEvents.length); }
    cursorKey = key;
    events = nextEvents;
    return { key, execution };
  }

  function control(reducer, attempt, done) {
    const result = store.dispatch(reducer, { attemptId: attempt.id });
    ctx.announce(result.ok ? done : result.error.message);
  }

  async function cancel(attempt, facts) {
    const yes = await confirmDialog({
      title: 'Cancel this attempt?',
      message: `${facts.progress.done} of ${facts.progress.total} executions have finished and are kept. The other ${facts.progress.total - facts.progress.done} never run, and the results read Inconclusive. Running again creates a new attempt.`,
      confirmLabel: 'Cancel attempt', cancelLabel: 'Keep running', danger: true,
    });
    if (yes) control(cancelAttempt, attempt, `${attempt.title} cancelled. Finished executions are kept.`);
  }

  function headerActions(attempt, facts) {
    const pause = facts.paused
      ? button({ label: 'Resume simulation', variant: 'primary', icon: 'play', focusKey: 'run:resume', onClick: () => { pausedHere.delete(attempt.id); control(resumeAttempt, attempt, 'Simulation resumed.'); } })
      : button({
        label: 'Pause simulation', icon: 'pause', focusKey: 'run:pause', disabled: !facts.live, reason: `This attempt is ${facts.status}; there is nothing to pause.`,
        onClick: () => { pausedHere.add(attempt.id); control(pauseAttempt, attempt, 'Simulation paused. Finished executions are kept.'); },
      });
    return [
      button({ label: 'Back to workbench', variant: 'outline', icon: 'arrow-left', focusKey: 'run:workbench', href: router.href('workbench', { experimentId: attempt.experimentId }) }),
      pause,
      button({ label: 'Cancel', variant: 'danger', icon: 'stop', focusKey: 'run:cancel', disabled: !facts.live, reason: `This attempt is ${facts.status}; only a queued or running attempt can be cancelled.`, onClick: () => cancel(attempt, facts) }),
      button({ label: facts.live ? 'View partial results' : 'View results', variant: facts.live ? 'secondary' : 'primary', iconRight: 'arrow-right', focusKey: 'run:results', href: router.href('results', { experimentId: attempt.experimentId, attemptId: attempt.id }) }),
    ];
  }

  const factItem = (term, value, mono) => h('div', { class: 'run-facts__item' }, h('dt', term), h('dd', { class: mono ? 'gym-mono' : null }, value));

  function summary(facts) {
    const { done, total } = facts.progress;
    return panel({
      class: 'run-summary', title: 'Frozen inputs', subtitle: 'Every revision this attempt uses was copied when it was queued. Later draft edits do not change it.',
      actions: evidenceTag(),
      children: h('div', { class: 'run-summary__grid' },
        h('dl', { class: 'run-facts' },
          factItem('Revision', facts.label),
          factItem('Workflow', `${facts.workflow.name} · rev ${facts.workflow.rev}`),
          factItem('Versions', facts.variantName ? `${facts.baselineName} vs ${facts.variantName}` : facts.baselineName),
          factItem('Environment', h('span', { class: 'run-facts__env' }, icon(facts.environment.icon, { size: 16 }), `${facts.environment.name} v${facts.environment.rev}`)),
          factItem('Scenario set', `${facts.scenarioSet.name} · rev ${facts.scenarioSet.rev}`),
          factItem('Input digest', facts.inputDigest, true),
          factItem('Seed', String(facts.seed), true),
          factItem('Fixture version', facts.fixtureVersion, true)),
        h('div', { class: 'run-plan' },
          h('div', { class: 'run-plan__head' }, h('span', { class: 'run-plan__label' }, 'Plan'), h('strong', { class: 'run-plan__size' }, `${facts.planSize} runs`)),
          h('p', { class: 'run-plan__formula' }, facts.formula),
          progress({ value: done, max: total, label: 'Executions finished', text: `${done}/${total}`, class: 'run-plan__bar' }),
          h('p', { class: 'run-plan__caption' }, `${done} of ${total} executions finished`),
          facts.queue && h('p', { class: 'run-plan__queue' }, `Queue position ${facts.queue.position} of ${facts.queue.of}${facts.queue.behind ? ` · waits for ${facts.queue.behind}` : ''}`))),
    });
  }

  function matrixPanel(attempt, executions, selectedKey) {
    const m = matrixView(attempt, executions);
    const cell = c => {
      const open = expanded.has(c.cellKey) || c.reps.some(r => r.key === selectedKey);
      const listId = `run-reps-${c.cellKey.replace(/[^A-Za-z0-9-]/g, '-')}`;
      return h('td', { class: 'run-matrix__cell' },
        h('button', {
          class: 'run-cell', type: 'button', 'aria-expanded': String(open), 'aria-controls': listId, dataset: { focusKey: `run:cell:${c.cellKey}`, cell: c.cellKey },
          onClick: () => { if (open) expanded.delete(c.cellKey); else expanded.add(c.cellKey); if (open && c.reps.some(r => r.key === selectedKey)) router.replaceQuery({ run: null }); view.refresh(); },
        }, h('span', { class: 'run-dots', 'aria-hidden': 'true' }, c.reps.map(r => h('span', { class: 'run-dot', dataset: { state: r.state } }))),
          h('span', { class: 'run-cell__summary' }, c.summary)),
        open && h('ul', { class: 'run-reps', id: listId }, c.reps.map(r => h('li',
          button({
            class: 'run-rep', size: 'sm', variant: r.key === selectedKey ? 'primary' : 'ghost', pressed: r.key === selectedKey, focusKey: `run:rep:${r.key}`,
            label: `Repetition ${r.repeatIndex} · ${STATE_LABEL[r.state]}`, disabled: !r.hasExecution, reason: NOT_RUN[r.state],
            onClick: () => router.replaceQuery({ run: r.key }),
          })))));
    };
    return panel({
      class: 'run-matrix-panel', title: 'Scenario matrix', subtitle: 'Terminal state of each planned run. Open a cell to pick a repetition.',
      children: [
        h('div', { class: 'run-matrix__wrap' }, h('table', { class: 'run-matrix' },
          h('thead', h('tr', h('th', { scope: 'col' }, 'Scenario'), m.versions.map(v => h('th', { scope: 'col' }, v.label)))),
          h('tbody', m.rows.map(r => h('tr', h('th', { scope: 'row', class: 'run-matrix__scenario' }, r.title), r.cells.map(cell)))))),
        h('ul', { class: 'run-legend', 'aria-label': 'Legend' }, ['passed', 'failed', 'next', 'pending', 'cancelled'].map(st =>
          h('li', h('span', { class: 'run-dot', dataset: { state: st }, 'aria-hidden': 'true' }), STATE_LABEL[st]))),
      ],
    });
  }

  function replayPanel(attempt, selectedKey, execution, facts) {
    const snap = attempt.inputSnapshot;
    const want = parseExecutionKey(selectedKey);
    const scenarioTitle = want && snap.scenarios.find(s => s.id === want.scenarioId)?.title;
    const heading = want ? `${scenarioTitle} · ${versionLabel(snap, want.versionId)} · repetition ${want.repeatIndex}` : 'No run selected';
    if (!execution) {
      const text = !selectedKey
        ? (facts.queue ? `This attempt is queued${facts.queue.behind ? ` behind ${facts.queue.behind}` : ''}. Runs appear here as they finish.` : 'No execution has finished yet.')
        : 'This run has no recorded events yet. Pick a finished repetition in the matrix.';
      return panel({ class: 'run-replay', title: 'Run replay', subtitle: heading, children: [blueprintDiagram(snap.workflow, []), emptyState({ icon: 'play', title: 'Nothing to replay yet', text })] });
    }
    const nodeLabels = nodeLabelsOf(snap.workflow);
    const total = events.length;
    const atEnd = cursor.position >= total, atStart = cursor.position <= 0;
    const scrub = h('input', {
      type: 'range', class: 'run-scrub__range', min: 0, max: total, step: 1, value: String(cursor.position), 'aria-label': 'Replay position',
      'aria-valuetext': `Event ${cursor.position} of ${total}`, dataset: { focusKey: 'run:scrub' },
      onPointerdown: () => { holding = true; },
      onInput: e => { cursor = replayReducer(cursor, { type: 'seek', position: e.target.value }, total); stopTimer(); paint(); },
      onChange: () => { release(); view.refresh(); },
    });
    const el = panel({
      class: 'run-replay', title: 'Run replay', subtitle: heading,
      actions: [badge({ status: execution.terminalState }), evidenceTag()],
      children: [
        blueprintDiagram(snap.workflow, events),
        h('div', { class: 'run-scrub', role: 'group', 'aria-label': 'Replay controls' },
          button({ label: 'Replay', icon: 'refresh', size: 'sm', focusKey: 'run:replay', onClick: () => move({ type: 'replay' }) }),
          iconButton({ icon: 'chevron-left', label: 'Step back', size: 'sm', focusKey: 'run:back', disabled: atStart, reason: 'Already at the first event.', onClick: () => move({ type: 'back' }) }),
          cursor.playing
            ? button({ label: 'Pause', icon: 'pause', size: 'sm', variant: 'primary', focusKey: 'run:play', onClick: () => move({ type: 'pause' }) })
            : button({ label: 'Play', icon: 'play', size: 'sm', variant: 'primary', focusKey: 'run:play', onClick: () => move({ type: 'play' }) }),
          iconButton({ icon: 'chevron-right', label: 'Step forward', size: 'sm', focusKey: 'run:step', disabled: atEnd, reason: 'Already at the last event.', onClick: () => move({ type: 'step' }) }),
          scrub,
          h('span', { class: 'run-scrub__where', 'aria-live': 'off' }, `Event ${cursor.position} of ${total}`)),
        h('p', { class: 'run-replay__note gym-muted' }, 'Replay steps through the recorded events. Nothing is executed again.'),
        traceList(events, nodeLabels, { scrollKey: 'run:trace', label: 'Trace events' }),
      ],
    });
    paint(el);
    return el;
  }

  function executionPanels(execution) {
    if (!execution) return panel({ class: 'run-exec', title: 'Execution', children: emptyState({ icon: 'file-text', title: 'No execution selected', text: 'Final state and assertions appear for a finished run.' }) });
    const failed = execution.assertionResults.filter(r => !r.pass).length;
    return h('div', { class: 'gym-stack run-exec' },
      panel({
        title: 'Assertions', subtitle: failed ? `${failed} of ${execution.assertionResults.length} failed` : `All ${execution.assertionResults.length} held`,
        children: assertionList(execution.assertionResults),
      }),
      panel({ title: 'Final state', subtitle: "After the last recorded event, in this run's own sandbox.", children: finalStateView(execution.finalState) }));
  }

  const render = state => {
    const resolved = resolveAttempt(state, route.params);
    if (resolved.kind !== 'found') { stopTimer(); return attemptNotFound(router, { title: 'Run', routeName: 'run-detail', params: route.params, resolved }); }
    const attempt = resolved.attempt;
    const executions = state.executions[attempt.id] ?? [];
    const facts = attemptFacts(state, attempt.id);
    const { key, execution } = syncSelection(executions);
    const afterRefresh = facts.paused && !pausedHere.has(attempt.id);
    const left = facts.progress.total - facts.progress.done;
    return [
      pageHeader({
        title: facts.title, subtitle: `${facts.label} · simulated run`,
        breadcrumb: runsCrumbs(router, { label: facts.title }),
        actions: headerActions(attempt, facts),
        meta: [statusBadges(facts, afterRefresh ? 'Paused after refresh' : 'Paused'), facts.review && reviewBadge(facts.review)],
      }),
      stepIndicator({ steps: experimentSteps(state, attempt.experimentId, route), router }),
      impactNotice(router, attempt),
      afterRefresh && notice({
        tone: 'warning', class: 'run-notice', title: 'Paused after refresh.',
        text: 'The simulation stopped when the page reloaded. Finished executions are kept; nothing runs until you resume.',
        actions: button({ label: 'Resume simulation', size: 'sm', focusKey: 'run:resume-notice', onClick: () => control(resumeAttempt, attempt, 'Simulation resumed.') }),
      }),
      facts.status === 'cancelled' && notice({
        tone: 'info', class: 'run-notice', title: 'Cancelled.',
        text: `${facts.progress.done} finished executions are kept. ${left} planned executions never ran, so the results read Inconclusive.`,
      }),
      summary(facts),
      grid('27fr 45fr 28fr', [matrixPanel(attempt, executions, key), replayPanel(attempt, key, execution, facts), executionPanels(execution)], 'run-cols'),
    ];
  };

  const view = mountView(root, render, gated);
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  return {
    update(next) { route = next; view.refresh(); },
    destroy() {
      stopTimer();
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      view.destroy();
    },
  };
}
