// The seeded GymState. fixtureState() holds every revision and draft with an empty queue; seedState() adds the queue.
import { FIXTURE_VERSION, SCHEMA_VERSION, clone, refKey } from '../model.js';
import { AGENTS } from './agents.js';
import { ENVIRONMENTS } from './environments.js';
import { VARIANTS, WORKFLOWS } from './workflows.js';
import { SCENARIOS, SCENARIO_SETS } from './scenarios.js';
import { EXPERIMENTS, buildQueue } from './queue.js';

const byRef = list => Object.fromEntries(list.map(x => [refKey(x), clone(x)]));
const byId = list => Object.fromEntries(list.map(x => [x.id, clone(x)]));

/** @returns {import('../model.js').GymState} */
export function fixtureState() {
  return {
    schemaVersion: SCHEMA_VERSION, fixtureVersion: FIXTURE_VERSION,
    agents: byId(AGENTS), environments: byRef(ENVIRONMENTS), environmentDrafts: {},
    workflows: byRef(WORKFLOWS), variants: byId(VARIANTS),
    scenarios: byRef(SCENARIOS), scenarioDrafts: {}, scenarioSets: byRef(SCENARIO_SETS),
    experiments: byId(EXPERIMENTS),
    attempts: {}, attemptOrder: [], executions: {}, seq: 0,
  };
}

/** @returns {import('../model.js').GymState} */
export const seedState = () => buildQueue(fixtureState());
