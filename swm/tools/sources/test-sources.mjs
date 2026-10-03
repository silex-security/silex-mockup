#!/usr/bin/env node
/* Source-module test runner. Owner: coder-deepseek.
   Plan: logs/2026-10-03_SWM_DOMAIN_GROUNDING_EXEC_PLAN.md (E5), B5.
   Contract: swm/tools/sources/CONTRACT.md — "Tests (test-sources.mjs)".

   Runs every module against the cached raw files and the real SOURCE_SELECTION, and checks:
   shape, determinism, every seed key present, and one deliberately broken input per module that
   must throw. Exit 1 on any failure. */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const CACHE = join(REPO, 'swm', '.cache');
const MANIFEST = JSON.parse(await readFile(join(HERE, 'MANIFEST.json'), 'utf8')).inputs;
const SEED = await import(join(REPO, 'swm', 'tools', 'silex-seed.mjs'));

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
const isPlain = x => x !== null && typeof x === 'object' && !isArray(x);

/* the raw files the build hands to the modules (same filter as build-ontology.mjs groundingFiles) */
const groundingFiles = MANIFEST.filter(m => !['d3fend', 'atlas', 'attack', 'uco'].includes(m.source) ||
  ['atlas-stix.json', 'attack-enterprise.json'].includes(m.name));
const RAWS = {};
for (const m of groundingFiles) RAWS[m.name] = await readFile(join(CACHE, m.name), 'utf8');
const manifest = Object.fromEntries(MANIFEST.map(m => [m.name, { url: m.url, repo: m.repo, path: m.path, pin: m.pin }]));

/* the bundle node ids (endpoint rule), including the D13 techniques the build adds before the modules run */
const bundle = JSON.parse(await readFile(join(REPO, 'swm', 'data', 'ontology.json'), 'utf8'));
const inBundle = new Set(bundle.nodes.map(n => n.id));
for (const t of SEED.SOURCE_SELECTION.attackTechniques || []) inBundle.add(`attack:${t}`);

const problems = [];
const fail = m => problems.push(m);

async function main() {
  const imported = {};
  for (const [name, path] of MODULES) {
    try { imported[name] = (await import(path)).parse; }
    catch (e) { fail(`${name}: import failed (${e.message})`); }
  }

  /* every key the seed asks the modules to emit */
  const needed = new Set();
  for (const rows of Object.values(SEED.BENCHMARK_HAZARDS || {})) for (const r of rows) needed.add(r.key);
  for (const keys of Object.values(SEED.BENCHMARK_ACTIONS || {})) for (const k of keys) needed.add(k);

  const allSources = {};
  for (const [name] of MODULES) {
    const parse = imported[name];
    if (typeof parse !== 'function') continue;
    const selection = { ...(SEED.SOURCE_SELECTION[name] || {}), inBundle, manifest };

    let a, b;
    try { a = parse(RAWS, selection); b = parse(RAWS, selection); }
    catch (e) { fail(`${name}: parse threw on real inputs (${e.message})`); continue; }

    for (const [label, out] of [['first', a], ['second', b]]) {
      if (!isPlain(out)) { fail(`${name}: ${label} run did not return an object`); continue; }
      if (!isArray(out.nodes)) fail(`${name}: nodes not an array`);
      if (!isArray(out.links)) fail(`${name}: links not an array`);
      if (!isPlain(out.sources)) fail(`${name}: sources not an object`);
      if (!isArray(out.omitted)) fail(`${name}: omitted not an array`);
      for (const n of out.nodes || []) {
        for (const f of ['id', 'label', 'group', 'layer', 'kind', 'def', 'review', 'src']) if (n[f] === undefined) fail(`${name}: node ${n.id} missing ${f}`);
        if (!n.parentLink) fail(`${name}: node ${n.id} has no parentLink`);
        for (const s of n.src || []) for (const f of ['sys', 'id', 'label', 'url']) if (s[f] === undefined) fail(`${name}: node ${n.id} src missing ${f}`);
      }
    }
    if (JSON.stringify(a) !== JSON.stringify(b)) fail(`${name}: not deterministic`);
    for (const [k, v] of Object.entries(a.sources || {})) {
      allSources[k] = v;
      if (v.sys === undefined || v.id === undefined || v.label === undefined || v.url === undefined) fail(`${name}: source ${k} missing fields`);
    }
  }

  for (const k of needed) if (!allSources[k]) fail(`seed key ${k} was not emitted by any module`);

  /* one deliberately broken input per module that must throw */
  const broken = {
    'fibo': () => imported['fibo'](RAWS, { ...SEED.SOURCE_SELECTION.fibo, classes: ['NoSuchClass'], inBundle, manifest }),
    'cdm': () => imported['cdm'](RAWS, { ...SEED.SOURCE_SELECTION.cdm, docs: [{ file: 'cdm-Invoice.cdm.json', entity: 'NoSuchEntity', domain: 'finance' }], inBundle, manifest }),
    'ocsf': () => imported['ocsf']({ 'ocsf-dictionary.json': RAWS['ocsf-dictionary.json'] }, { ...SEED.SOURCE_SELECTION.ocsf, objects: ['no_such_object'], events: [], inBundle, manifest }),
    'nist-800-53': () => imported['nist-800-53'](RAWS, { ...SEED.SOURCE_SELECTION['nist-800-53'], controls: ['no-such-control'], inBundle, manifest }),
    'atlas-mitigations': () => imported['atlas-mitigations']({ 'atlas-stix.json': 'not json' }, { ...SEED.SOURCE_SELECTION['atlas-mitigations'], inBundle, manifest }),
    'attack-mitigations': () => imported['attack-mitigations']({ 'attack-enterprise.json': 'not json' }, { ...SEED.SOURCE_SELECTION['attack-mitigations'], inBundle, manifest }),
    'atlas-cases': () => imported['atlas-cases']({ 'atlas-data-ATLAS.yaml': 'no case-studies here' }, { ...SEED.SOURCE_SELECTION['atlas-cases'], inBundle, manifest }),
    'attack-campaigns': () => imported['attack-campaigns'](RAWS, { ...SEED.SOURCE_SELECTION['attack-campaigns'], ids: ['C9999'], inBundle, manifest }),
    'agentdojo': () => imported['agentdojo'](RAWS, { ...SEED.SOURCE_SELECTION.agentdojo, tasks: { banking: [999], slack: [], workspace: [] }, inBundle, manifest }),
    'tau2': () => imported['tau2'](RAWS, { ...SEED.SOURCE_SELECTION.tau2, rules: { 'retail/rule/authenticate': { section: 'preamble', sentence: 'a sentence that is not in the policy.' } }, inBundle, manifest }),
    'banking-kb': () => imported['banking-kb'](RAWS, { ...SEED.SOURCE_SELECTION['banking-kb'], docs: { doc_credit_cards_credit_card_replacements_001: 'a sentence that is not in the doc.' }, inBundle, manifest }),
    'asb': () => imported['asb'](RAWS, { ...SEED.SOURCE_SELECTION.asb, rows: ['financial_analyst_agent/NoSuchTool'], inBundle, manifest }),
    'toolemu': () => imported['toolemu'](RAWS, { ...SEED.SOURCE_SELECTION.toolemu, cases: { no_such_case: 'x' }, inBundle, manifest }),
  };
  for (const [name, fn] of Object.entries(broken)) {
    if (typeof imported[name] !== 'function') continue;
    let threw = false;
    try { fn(); } catch { threw = true; }
    if (!threw) fail(`${name}: broken input did not throw`);
  }

  if (problems.length) {
    console.error(`test-sources: ${problems.length} problem(s):`);
    problems.forEach(p => console.error(`  ✗ ${p}`));
    process.exitCode = 1;
    return;
  }
  const counts = Object.entries(allSources).length;
  console.log(`  ✓ ${MODULES.length} modules pass on real inputs (shape, determinism, ${counts} sources, ${needed.size} seed keys, broken-input throws)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
