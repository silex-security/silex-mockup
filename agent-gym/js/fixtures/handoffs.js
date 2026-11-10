// The experiment templates a Speedrun "Send to Agent Gym" can name, keyed by handoff id `<team>-<change>`.
// Speedrun sends a team and one of four kinds of change. Agent Gym has no model of Speedrun teams, so each team is
// mapped to the Gym workflow closest to the work it does, and each kind of change to the Gym variant that is closest.
// Gym v1 variants patch model configuration only, so a tool or prompt change maps to the default model-configuration
// variant, and latency and cost both read as the one measure the executor records for every run, steps.
import { FOLLOW_UP, TRIAGE, TRIAGE_V2 } from './experiment.js';

const TEAMS = Object.freeze({
  refund: { name: 'Refund Team', flow: TRIAGE },
  'order-support': { name: 'Order Support Team', flow: TRIAGE },
  escalation: { name: 'Escalation Team', flow: TRIAGE },
  invoice: { name: 'Invoice Team', flow: FOLLOW_UP },
  'expense-review': { name: 'Expense Review Team', flow: FOLLOW_UP },
  reconciliation: { name: 'Reconciliation Team', flow: FOLLOW_UP },
});

const TIMEOUT = { [TRIAGE.set.id]: ['sc-sup-refund-in-window', 'sc-sup-refund-timeout'], [FOLLOW_UP.set.id]: ['sc-base-case', 'sc-timeout-after-send'] };
const ALL = { [TRIAGE.set.id]: ['sc-sup-refund-in-window', 'sc-sup-refund-timeout', 'sc-sup-outside-window'], [FOLLOW_UP.set.id]: ['sc-base-case', 'sc-timeout-after-send', 'sc-contact-opted-out'] };

const CHANGES = Object.freeze({
  'retry-timeout': { title: 'Retry & timeout', phrase: 'retry and timeout', flow: flow => flow, scenarios: TIMEOUT },
  'switch-tool': { title: 'Switch tool', phrase: 'switch tool', flow: flow => flow, scenarios: ALL },
  'switch-model': { title: 'Switch model', phrase: 'switch model', flow: flow => flow === TRIAGE ? TRIAGE_V2 : flow, scenarios: ALL },
  'prompt-context': { title: 'Prompt & context', phrase: 'prompt and context', flow: flow => flow, scenarios: ALL },
});

/** @type {Readonly<Record<string, object>>} handoff id -> the fields experiment() takes, minus id, number and revision */
export const HANDOFFS = Object.freeze(Object.fromEntries(Object.entries(TEAMS).flatMap(([teamId, team]) =>
  Object.entries(CHANGES).map(([changeId, change]) => {
    const flow = change.flow(team.flow);
    return [`${teamId}-${changeId}`, Object.freeze({
      title: `${team.name} · ${change.title}`, ...flow, scenarios: change.scenarios[team.flow.set.id],
      repetitions: 2, objective: 'steps', acceptance: { noRegression: true, minImprovedPairs: 1 },
      source: { kind: 'speedrun', label: `Speedrun trace: ${team.name}, ${change.phrase}`, ref: `/speedrun/teams/${teamId}/trace` },
    })];
  }))));
