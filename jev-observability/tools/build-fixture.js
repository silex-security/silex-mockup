// Fixture builder (T1). Runs the live stream (background + S1–S6) and injects
// F1, then computes KPIs and writes data/fixture.json (no timestamp, stable key
// order). Byte-identical for the same seed.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildStream, FAULT_SCENARIOS, TENANT } from '../js/engine/scenarios.js';
import { DEFAULT_POLICY, JEV_SIM_VERSION } from '../js/engine/types.js';
import { runStream } from '../js/engine/router.js';
import { computeKpis } from '../js/engine/kpi.js';

export const FIXTURE_SEED = 7;

export function buildFixture({ seed = FIXTURE_SEED, background } = {}) {
  const stream = buildStream(seed, background ? { background } : undefined);
  const envelopes = runStream(stream, {
    tenant: TENANT, policy: DEFAULT_POLICY, seed, history: [], faults: null,
  });

  // F1 is not in the stream; inject it (per plan §5). S1–S6 are already in the
  // stream, so every scenario (S1–S6 + F1) is present.
  for (const t of FAULT_SCENARIOS) {
    envelopes.push(...runStream(t.spans, {
      tenant: TENANT, policy: DEFAULT_POLICY, seed, history: envelopes, faults: null,
    }));
  }

  return {
    seed,
    policy_version: DEFAULT_POLICY.version,
    judge: JEV_SIM_VERSION,
    envelopes,
    kpis: computeKpis(envelopes),
    generated_by: 'jev-observability/tools/build-fixture.js',
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const here = dirname(fileURLToPath(import.meta.url));
  const outPath = join(here, '..', 'data', 'fixture.json');
  writeFileSync(outPath, JSON.stringify(buildFixture()) + '\n');
  process.stdout.write(`wrote ${outPath}\n`);
}
