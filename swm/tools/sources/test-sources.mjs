#!/usr/bin/env node
/* Source-module test runner (P0c skeleton). Owner: coder-deepseek.
   Plan: logs/2026-10-03_SWM_DOMAIN_GROUNDING_EXEC_PLAN.md (E5), P0c / B5.
   Contract: swm/tools/sources/CONTRACT.md — "Tests (test-sources.mjs)".

   P0c scope: import every module, call parse({}, {}) and check the return shape.
   The full suite (cached raw files, determinism, one broken input per parser) is
   implemented in P1, after the T0 gate. Exit 1 on any failure. */

import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const MODULES = [
  ['fibo', './fibo.mjs'],
  ['cdm', './cdm.mjs'],
  ['ocsf', './ocsf.mjs'],
  ['nist-800-53', './nist-800-53.mjs'],
  ['atlas-mitigations', './atlas-mitigations.mjs'],
  ['attack-mitigations', './attack-mitigations.mjs'],
  ['atlas-cases', './atlas-cases.mjs'],
  ['attack-campaigns', './attack-campaigns.mjs'],
  ['agentdojo', './agentdojo.mjs'],
  ['tau2', './tau2.mjs'],
  ['banking-kb', './banking-kb.mjs'],
  ['asb', './asb.mjs'],
  ['toolemu', './toolemu.mjs'],
];

const isArray = x => Array.isArray(x);
const isPlainObject = x => x !== null && typeof x === 'object' && !isArray(x);

async function main() {
  const problems = [];
  for (const [name, path] of MODULES) {
    let mod;
    try {
      mod = await import(path);
    } catch (e) {
      problems.push(`${name}: failed to import (${e.message})`);
      continue;
    }
    if (typeof mod.parse !== 'function') {
      problems.push(`${name}: missing export function parse(raws, selection)`);
      continue;
    }
    let out;
    try {
      out = mod.parse({}, {});
    } catch (e) {
      problems.push(`${name}: parse({}, {}) threw (${e.message})`);
      continue;
    }
    if (!isPlainObject(out)) problems.push(`${name}: parse() did not return an object`);
    else {
      if (!isArray(out.nodes)) problems.push(`${name}: nodes is not an array`);
      if (!isArray(out.links)) problems.push(`${name}: links is not an array`);
      if (!isPlainObject(out.sources)) problems.push(`${name}: sources is not an object`);
      if (!isArray(out.omitted)) problems.push(`${name}: omitted is not an array`);
    }
  }

  if (problems.length) {
    console.error(`test-sources: ${problems.length} problem(s):`);
    problems.forEach(p => console.error(`  ✗ ${p}`));
    process.exitCode = 1;
    return;
  }
  console.log(`  ✓ ${MODULES.length} source modules import and return the expected shape`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
