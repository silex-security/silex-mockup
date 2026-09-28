// Shared test helpers (not a test file). node --test only runs *.test.js.

import { buildStream, ALL_SCENARIOS, FAULT_SCENARIOS, TENANT } from '../../js/engine/scenarios.js';
import { DEFAULT_POLICY } from '../../js/engine/types.js';
import { runStream } from '../../js/engine/router.js';

export function scenarioTrace(id) {
  return ALL_SCENARIOS.find(t => t.scenario === id);
}

export function runScenario(id, seed = 7, { policy = DEFAULT_POLICY, faults = null } = {}) {
  const t = scenarioTrace(id);
  return runStream(t.spans, { tenant: TENANT, policy, seed, history: [], faults });
}

// Full decision log: background stream + F1 injected (mirrors build-fixture).
export function allEnvelopes(seed = 7) {
  const envelopes = runStream(buildStream(seed), {
    tenant: TENANT, policy: DEFAULT_POLICY, seed, history: [], faults: null,
  });
  for (const t of FAULT_SCENARIOS) {
    envelopes.push(...runStream(t.spans, {
      tenant: TENANT, policy: DEFAULT_POLICY, seed, history: envelopes, faults: null,
    }));
  }
  return envelopes;
}
