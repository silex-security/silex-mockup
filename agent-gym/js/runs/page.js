// Page furniture shared by the run list, run detail and results views.
import { h } from '../components/dom.js';
import { badge, button, columns, emptyState, notice, pageHeader, panel } from '../components/ui.js';
import { REVIEW_LABEL } from '../model.js';

export const EVIDENCE = 'Simulated evidence · Not deployed';
export const evidenceTag = () => badge({ label: EVIDENCE, tone: 'gray', icon: 'shield', class: 'run-evidence' });

// ui.columns hands its template to Object.assign(style), which ignores custom properties, so set --gym-cols here.
export function grid(template, children, cls) {
  const el = columns({ template, children, class: cls });
  el.style.setProperty('--gym-cols', template);
  return el;
}

export const runsCrumbs = (router, ...rest) => [
  { label: 'Agent Gym', href: router.href('experiment-queue') },
  { label: 'Runs', href: router.href('run-list', {}, { status: 'all' }) },
  ...rest,
];

const REVIEW_TONE = { pass_for_demo: 'green', needs_iteration: 'amber', reject: 'red' };

export const reviewBadge = review => review
  ? badge({ label: REVIEW_LABEL[review.decision], tone: REVIEW_TONE[review.decision], icon: 'check', class: 'run-review-badge' })
  : h('span', { class: 'gym-muted run-review-none' }, 'Not reviewed');

export function statusBadges({ status, paused }, pausedLabel = 'Paused') {
  return [badge({ status }), paused && badge({ status: 'paused', label: pausedLabel })];
}

/** The not-found state for an unknown attempt id, or for an attempt reached through another experiment's URL. */
export function attemptNotFound(router, { title, routeName, params, resolved }) {
  const mismatch = resolved.kind === 'mismatch';
  return [
    pageHeader({ title, subtitle: `Attempt ${params.attemptId}`, breadcrumb: runsCrumbs(router, { label: params.attemptId }) }),
    h('div', { class: 'run-lost' }, panel({
      children: emptyState({
        icon: 'search',
        title: mismatch ? 'This attempt belongs to another experiment' : 'Attempt not found',
        text: mismatch
          ? `${params.attemptId} is an attempt of ${resolved.attempt.experimentId}, not ${params.experimentId}.`
          : `No attempt called ${params.attemptId} exists in this demo. It may have been removed by Reset demo data.`,
        action: h('div', { class: 'gym-row run-lost__actions' },
          mismatch && button({ label: `Open ${resolved.attempt.title}`, variant: 'primary', focusKey: 'run:lost-open', href: router.href(routeName, { experimentId: resolved.attempt.experimentId, attemptId: resolved.attempt.id }) }),
          button({ label: 'View all runs', variant: mismatch ? 'outline' : 'primary', focusKey: 'run:lost-list', href: router.href('run-list', {}, { status: 'all' }) })),
      }),
    })),
  ];
}

/** On the run detail and results of a shared-agent check: whose check it is, and that its runs are counted apart. */
export const impactNotice = (router, attempt) => attempt.impactOf && notice({
  tone: 'info', class: 'run-notice run-impact-notice', title: `Shared-agent check for ${attempt.impactOf.experimentId}.`,
  text: `This run asks whether the change in ${attempt.impactOf.experimentId} reaches ${attempt.inputSnapshot.workflow.name} through an agent both workflows share. It is not one of that experiment's own runs.`,
  actions: button({ label: 'Open the experiment', size: 'sm', focusKey: 'run:impact-of', href: router.href('workbench', { experimentId: attempt.impactOf.experimentId }) }),
});
