#!/usr/bin/env node
// Writes jev-runtime/demo/data/learned-rules.json from an upstream jev-runtime-observability checkout
// (logs/2026-11-12_LEARNED_RULES_PLAN.md §3). Only counts and rule conditions leave upstream: the corpus,
// item ids, prompts, model names and model text stay there, so the held-back cases stay private.
//   node tools/build-learned-rules.mjs <upstream checkout> [output file]
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const UPSTREAM = { repo: 'silex-ai-lab/jev-runtime-observability', commit: 'de4ad51e84fc84c1304f2522f1d1f052f4af7b4c' };
const REPORTS = 'runs/rule-regate-2026-11/gate-reports.json';
const SESSIONS = 'runs/rule-proposer-2026-10/sessions';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '../jev-runtime/demo/data/learned-rules.json');

const sha256 = buf => createHash('sha256').update(buf).digest('hex');
const sorted = v => Array.isArray(v) ? v.map(sorted)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sorted(v[k])])) : v;
const fail = msg => { throw new Error(`build-learned-rules: ${msg}`); };
const one = (values, what) => { const s = [...new Set(values.map(v => JSON.stringify(v)))]; if (s.length !== 1) fail(`mixed ${what}: ${s.join(' | ')}`); return JSON.parse(s[0]); };
const counts = t => ({ violations: t.violations, caught: t.caught, benign: t.benign, false_flags: t.false_flags });

export function build(upstream) {
  const head = execFileSync('git', ['-C', upstream, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (head !== UPSTREAM.commit) fail(`upstream HEAD is ${head}, pinned ${UPSTREAM.commit}`);

  const reportsRaw = readFileSync(join(upstream, REPORTS));
  const regated = JSON.parse(reportsRaw).P4;
  const names = readdirSync(join(upstream, SESSIONS)).filter(n => n.endsWith('.json')).sort();
  const manifest = [], sessions = new Map();
  for (const name of names) {
    const raw = readFileSync(join(upstream, SESSIONS, name));
    manifest.push(`${name} ${sha256(raw)}`);
    const s = JSON.parse(raw);
    if (sessions.has(s.ordinal)) fail(`duplicate session ordinal ${s.ordinal}`);
    sessions.set(s.ordinal, s);
  }

  const passed = [...sessions.values()].filter(s => s.outcome === 'passed');
  const firstGate = one(passed.map(s => { const g = s.attempts.at(-1).gate; return { criteria_version: g.criteria_version, corpus_sha256: g.corpus_sha256, verdict: g.verdict }; }), 'first gates');
  if (firstGate.verdict !== 'PASS') fail('a passed session has no first-gate PASS');
  const gate = one(regated.map(e => ({ criteria_version: e.report.criteria_version, corpus_sha256: e.report.corpus_sha256 })), 'gate identities');
  const corpus = one(regated.map(e => ({ dev: e.report.dev.violations + e.report.dev.benign, holdout: e.report.holdout.violations + e.report.holdout.benign })), 'split sizes');
  const failureClass = one(regated.map(e => e.report.failure_class), 'failure classes');
  if (regated.length !== passed.length) fail(`${regated.length} regated rules for ${passed.length} passed sessions`);

  const rules = regated.map(({ ordinal, report }) => {
    const s = sessions.get(ordinal);
    if (s?.outcome !== 'passed') fail(`regated ordinal ${ordinal} is not a passed session`);
    const rule = s.attempts.at(-1).candidate;
    return {
      ordinal, condition: rule.condition, verdict_on_match: rule.verdict,
      report: { verdict: report.verdict, dev: counts(report.dev), holdout: counts(report.holdout),
        failed_criteria: report.failures.map(f => { const n = Number(/^(\d+):/.exec(f)?.[1]); if (!n) fail(`unreadable failure "${f}"`); return n; }) },
    };
  }).sort((a, b) => a.ordinal - b.ordinal);

  return {
    generated_by: 'tools/build-learned-rules.mjs',
    source: { ...UPSTREAM, files: [{ path: REPORTS, sha256: sha256(reportsRaw) }, { path: `${SESSIONS}/`, files: names.length, manifest_sha256: sha256(manifest.join('\n') + '\n') }] },
    failure_class: failureClass,
    sessions: { total: sessions.size, with_candidate: passed.length },
    first_gate: { criteria_version: firstGate.criteria_version, corpus_sha256: firstGate.corpus_sha256, passed: passed.length },
    gate: { ...gate, corpus },
    rules,
  };
}

export const serialize = data => JSON.stringify(sorted(data), null, 2) + '\n';

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [upstream, out = OUT] = process.argv.slice(2);
  if (!upstream) { console.error('usage: node tools/build-learned-rules.mjs <upstream checkout> [output file]'); process.exit(2); }
  writeFileSync(out, serialize(build(resolve(upstream))));
  console.log(`wrote ${out}`);
}
