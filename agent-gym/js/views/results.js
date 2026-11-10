// Results: completeness, paired baseline/variant comparison, unresolved items, verdict and review (plan 8.2, 8.4, 9.2).
import { h, mountView } from '../components/dom.js';
import { badge, button, emptyState, notice, pageHeader, panel, textarea } from '../components/ui.js';
import { REVIEW_DECISION, REVIEW_LABEL, pairId } from '../model.js';
import { recordReview } from '../simulation/attempts.js';
import { comparisonFor } from '../selectors.js';
import { attemptFacts, resolveAttempt } from '../runs/facts.js';
import { VERDICT, defaultPairKey, pairKey, pairSides, unresolvedItems, verdictReason } from '../runs/compare.js';
import { assertionList, finalStateView, nodeLabelsOf, toolRequests, traceList } from '../runs/trace.js';
import { attemptNotFound, evidenceTag, grid, reviewBadge, runsCrumbs, statusBadges } from '../runs/page.js';

const CAVEAT = 'Repetitions are deterministic replays with the same seed and fixtures, not independent statistical samples. These counts describe behaviour on these scripted scenarios; they do not measure a real change in success rate.';
const DECISION_HINT = {
  pass_for_demo: 'Good enough to show in a demo.',
  needs_iteration: 'Change the variant or the scenarios, then run again.',
  reject: 'Do not use this variant.',
};
const PAIR_KIND = {
  improved: { label: 'Improved', tone: 'green', glyph: ' ↑' },
  regressed: { label: 'Regressed', tone: 'red', glyph: ' ↓' },
  same: { label: 'Same', tone: 'gray', glyph: '' },
  missing: { label: 'Incomplete', tone: 'amber', glyph: ' –' },
};
const UNRESOLVED = { regressed: { label: 'Regressed', tone: 'red' }, still_failing: { label: 'Still failing', tone: 'amber' }, missing: { label: 'Incomplete', tone: 'amber' } };

export function mount(root, ctx) {
  const { router, store } = ctx;
  let route = ctx.route;
  let formFor = null, decision = null, note = '';

  function syncForm(attempt) {
    if (formFor === attempt.id) return;
    formFor = attempt.id;
    decision = attempt.review?.decision ?? null;
    note = attempt.review?.note ?? '';
  }

  const stat = (key, value, caption) => h('div', { class: 'run-stat', dataset: { stat: key } }, h('strong', { class: 'run-stat__value' }, value), h('span', { class: 'run-stat__caption' }, caption));

  function verdictPanel(attempt, comparison, executions, facts) {
    const v = VERDICT[comparison.verdict];
    const { baseline, variant } = comparison.totals;
    return panel({
      class: 'run-verdict', title: 'Verdict', actions: evidenceTag(),
      children: [
        h('div', { class: 'run-verdict__row' },
          h('div', { class: 'run-verdict__main', dataset: { verdict: comparison.verdict } },
            badge({ label: v.label, tone: v.tone, class: 'run-verdict__badge' }),
            h('p', { class: 'run-verdict__reason' }, verdictReason(attempt, comparison, executions))),
          h('div', { class: 'run-stats' },
            stat('complete', `${comparison.completePairs}/${comparison.expectedPairs}`, 'complete pairs'),
            stat('baseline', `${baseline.pass}/${baseline.total}`, `${facts.baselineName} passed`),
            stat('variant', `${variant.pass}/${variant.total}`, `${facts.variantName ?? 'Variant'} passed`),
            stat('improved', String(comparison.improvedPairs), 'improved pairs'),
            stat('regressed', String(comparison.regressedPairs), 'regressed pairs'))),
        comparison.missingPairs.length > 0 && h('p', { class: 'run-verdict__missing' },
          h('strong', `Missing pairs (${comparison.missingPairs.length}): `),
          comparison.missingPairs.map(id => { const s = attempt.inputSnapshot.scenarios.find(x => id.startsWith(`${x.id}#`)); return `${s?.title ?? id} · repetition ${id.split('#').pop()}`; }).join(', ')),
        h('p', { class: 'run-caveat' }, CAVEAT),
      ],
    });
  }

  function scenarioPanel(attempt, comparison, facts, selected) {
    const kindOf = (scenarioId, repeatIndex) => comparison.pairs.find(p => p.pairId === pairId({ scenarioId, repeatIndex }))?.kind ?? 'missing';
    return panel({
      class: 'run-byscenario', title: 'By scenario', subtitle: 'Each repetition pairs one baseline run with one variant run on the same scenario and seed.',
      actions: evidenceTag(),
      children: [h('div', { class: 'run-byscenario__wrap' }, h('table', { class: 'run-table run-table--compact' },
        h('thead', h('tr', ['Scenario', facts.baselineName, facts.variantName ?? 'Variant', 'Improved', 'Regressed', 'Pairs'].map(c => h('th', { scope: 'col' }, c)))),
        h('tbody', comparison.byScenario.map(row => h('tr', { dataset: { scenario: row.scenarioId } },
          h('th', { scope: 'row', dataset: { label: 'Scenario' } }, row.title),
          h('td', { dataset: { label: facts.baselineName } }, `${row.baseline.pass}/${row.baseline.total}`),
          h('td', { dataset: { label: facts.variantName ?? 'Variant' } }, `${row.variant.pass}/${row.variant.total}`),
          h('td', { dataset: { label: 'Improved' } }, String(row.improved)),
          h('td', { dataset: { label: 'Regressed' } }, String(row.regressed)),
          h('td', { dataset: { label: 'Pairs' } }, h('span', { class: 'run-pairs' }, Array.from({ length: attempt.inputSnapshot.repetitions }, (_, i) => {
            const key = pairKey({ scenarioId: row.scenarioId, repeatIndex: i + 1 });
            const k = PAIR_KIND[kindOf(row.scenarioId, i + 1)];
            return h('button', {
              type: 'button', class: `run-pairbtn run-pairbtn--${k.tone}`, 'aria-pressed': String(key === selected), dataset: { focusKey: `res:pair:${key}`, pair: key },
              'aria-label': `${row.title}, repetition ${i + 1}: ${k.label}`, title: `Repetition ${i + 1}: ${k.label}`,
              onClick: () => router.replaceQuery({ pair: key }),
            }, h('span', { 'aria-hidden': 'true' }, `${i + 1}${k.glyph}`));
          })))))))),
      h('p', { class: 'run-pairs__legend gym-muted' }, 'Pick a repetition to compare it. ↑ variant passed where the baseline failed · ↓ regression · – incomplete')],
    });
  }

  function unresolvedPanel(attempt, comparison, executions) {
    const items = unresolvedItems(attempt, comparison, executions);
    return panel({
      class: 'run-unresolved', title: 'Regressions and unresolved', subtitle: items.length ? `${items.length} to look at` : 'Nothing regressed, failed in both versions or went missing.',
      children: items.length
        ? h('ul', { class: 'run-issues' }, items.map(i => h('li', { class: 'run-issue' },
          badge({ label: UNRESOLVED[i.kind].label, tone: UNRESOLVED[i.kind].tone }),
          h('button', { type: 'button', class: 'run-issue__open', dataset: { focusKey: `res:issue:${i.kind}:${i.key}` }, onClick: () => router.replaceQuery({ pair: i.key }) }, i.name),
          h('span', { class: 'run-issue__text gym-muted' }, i.text))))
        : emptyState({ icon: 'check-circle', title: 'No open items', text: 'This only covers the scripted scenarios in this attempt.' }),
    });
  }

  function reviewPanel(attempt, comparison, facts) {
    const live = facts.live;
    const reasonFor = d => d === 'pass_for_demo' && comparison.verdict !== 'pass' ? `Pass for demo needs a Pass verdict. This comparison reads ${VERDICT[comparison.verdict].label}.` : null;
    const blocked = live ? 'Review a finished attempt. This one is still running.' : !decision ? 'Choose a decision first.' : reasonFor(decision);
    const submit = () => {
      const result = store.dispatch(recordReview, { attemptId: attempt.id, decision, note: note.trim() });
      ctx.announce(result.ok ? `Marked reviewed: ${REVIEW_LABEL[decision]}. Not deployed.` : result.error.message);
    };
    const review = attempt.review;
    return panel({
      class: 'run-review', title: 'Mark reviewed', subtitle: 'Record a decision about this simulated evidence. Nothing is adopted, deployed or registered.',
      children: h('div', { class: 'gym-stack' },
        review && h('div', { class: 'run-review__done', dataset: { reviewed: review.decision } },
          h('div', { class: 'gym-row' }, reviewBadge(review), badge({ label: 'Not deployed', tone: 'gray', icon: 'lock' })),
          review.note && h('p', { class: 'run-review__note' }, review.note),
          h('p', { class: 'gym-muted run-review__when' }, `Reviewed ${review.reviewedAt.slice(0, 16).replace('T', ' ')} UTC`)),
        h('fieldset', { class: 'run-decisions', disabled: live },
          h('legend', { class: 'gym-field__label' }, 'Decision'),
          REVIEW_DECISION.map(d => {
            const reason = live ? 'Review a finished attempt.' : reasonFor(d);
            return h('label', { class: `run-decision${reason ? ' is-disabled' : ''}`, title: reason },
              h('input', { type: 'radio', name: 'run-decision', value: d, checked: decision === d, disabled: !!reason, dataset: { focusKey: `res:decision:${d}` }, onChange: () => { decision = d; view.refresh(); } }),
              h('span', { class: 'run-decision__text' }, h('strong', REVIEW_LABEL[d]), h('small', reason ?? DECISION_HINT[d])));
          })),
        textarea({ label: 'Note', value: note, rows: 3, placeholder: 'What did you check? What should change next?', focusKey: 'res:note', disabled: live, reason: 'Review a finished attempt.', onInput: v => { note = v.slice(0, 500); } }),
        h('div', { class: 'gym-row run-review__actions' },
          button({ label: review ? 'Update review' : 'Mark reviewed', variant: 'primary', icon: 'check', focusKey: 'res:submit', disabled: !!blocked, reason: blocked, onClick: submit }),
          evidenceTag())),
    });
  }

  function side(label, execution, nodeLabels) {
    if (!execution) return h('section', { class: 'run-side' }, h('h3', { class: 'run-side__title' }, label), emptyState({ icon: 'clock', title: 'Not run', text: 'This side never produced a terminal result.' }));
    const part = (title, body) => h('div', { class: 'run-side__part' }, h('h4', { class: 'run-side__sub' }, title), body);
    return h('section', { class: 'run-side', dataset: { side: execution.versionId } },
      h('header', { class: 'run-side__head' }, h('h3', { class: 'run-side__title' }, label), badge({ status: execution.terminalState })),
      part(execution.terminalState === 'passed' ? 'Assertions' : 'Why it failed', assertionList(execution.assertionResults, { failedOnly: true })),
      part('Final state', finalStateView(execution.finalState)),
      part('Tool requests', toolRequests(execution.events)),
      part('Trace', traceList(execution.events, nodeLabels, { detailed: false, label: `${label} trace` })));
  }

  function pairPanel(attempt, executions, comparison, key) {
    const pair = key && pairSides(attempt, executions, key, comparison);
    if (!pair) return panel({ class: 'run-pair', title: 'Pair comparison', children: emptyState({ icon: 'sliders', title: 'No pair to compare yet', text: 'A pair appears when its baseline and variant runs have both finished.' }) });
    const kind = PAIR_KIND[pair.judged?.kind ?? 'missing'];
    const nodeLabels = nodeLabelsOf(attempt.inputSnapshot.workflow);
    return panel({
      class: 'run-pair', title: 'Pair comparison', subtitle: pair.name,
      actions: [badge({ label: kind.label, tone: kind.tone }), evidenceTag()],
      children: [
        pair.judged?.deltas.length > 0 && h('ul', { class: 'run-deltas', 'aria-label': 'What changed' }, pair.judged.deltas.map(d => h('li', d))),
        h('div', { class: 'run-pair__sides' }, side(pair.baselineLabel, pair.baseline, nodeLabels), side(pair.variantLabel, pair.variant, nodeLabels)),
      ],
    });
  }

  const render = state => {
    const resolved = resolveAttempt(state, route.params);
    if (resolved.kind !== 'found') return attemptNotFound(router, { title: 'Results', routeName: 'results', params: route.params, resolved });
    const attempt = resolved.attempt;
    syncForm(attempt);
    const executions = state.executions[attempt.id] ?? [];
    const comparison = comparisonFor(state, attempt.id);
    const facts = attemptFacts(state, attempt.id);
    const detail = router.href('run-detail', { experimentId: attempt.experimentId, attemptId: attempt.id });
    const chosen = route.query.pair && pairSides(attempt, executions, route.query.pair, comparison) ? route.query.pair : defaultPairKey(comparison);
    return [
      pageHeader({
        title: 'Results', subtitle: `${facts.title} · ${facts.label}`,
        breadcrumb: runsCrumbs(router, { label: facts.title, href: detail }, { label: 'Results' }),
        actions: [
          button({ label: 'Back to run', variant: 'outline', icon: 'arrow-left', focusKey: 'res:run', href: detail }),
          button({ label: 'Back to workbench', variant: 'outline', focusKey: 'res:workbench', href: router.href('workbench', { experimentId: attempt.experimentId }) }),
        ],
        meta: statusBadges(facts),
      }),
      facts.live && notice({
        tone: 'warning', class: 'run-notice', title: `Still ${facts.status}.`,
        text: `This is a partial comparison of ${facts.progress.done} of ${facts.progress.total} executions. It reads Inconclusive until every pair is complete.`,
        actions: button({ label: 'Open run detail', size: 'sm', focusKey: 'res:open-run', href: detail }),
      }),
      verdictPanel(attempt, comparison, executions, facts),
      grid('62fr 38fr', [h('div', { class: 'gym-stack' }, scenarioPanel(attempt, comparison, facts, chosen), unresolvedPanel(attempt, comparison, executions)), reviewPanel(attempt, comparison, facts)], 'run-cols'),
      pairPanel(attempt, executions, comparison, chosen),
    ];
  };

  const view = mountView(root, render, store);
  return { update(next) { route = next; view.refresh(); }, destroy: view.destroy };
}
