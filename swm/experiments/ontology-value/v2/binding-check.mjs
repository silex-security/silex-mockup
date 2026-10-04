// Independent v2 binding/firewall gate; no predictor imports.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { loadCorpus, scanner } from '../firewall-check.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const keysEqual = (x, keys) => object(x) && JSON.stringify(Object.keys(x).sort()) === JSON.stringify([...keys].sort());
export function parseUnique(raw) {
  const code = 'import json,sys\ndef unique(pairs):\n d={}\n for k,v in pairs:\n  if k in d: raise ValueError("duplicate JSON key")\n  d[k]=v\n return d\ntry: json.loads(sys.stdin.read(),object_pairs_hook=unique)\nexcept ValueError: sys.exit(1)\n';
  const result = spawnSync('python3', ['-c', code], { input: raw, encoding: 'utf8' });
  if (result.error || ![0, 1].includes(result.status)) throw new Error('JSON duplicate-key check could not run');
  if (result.status) throw new Error('invalid JSON or duplicate JSON key');
  return JSON.parse(raw);
}
export function ontology(snapshot) {
  const nodes = new Map(snapshot.nodes.map(n => [n.id, n]));
  const effects = new Set(snapshot.nodes.filter(n => n.layer === 1 && n.kind === 'effect').map(n => n.id));
  const classes = new Set(snapshot.nodes.filter(n => n.kind === 'core').map(n => n.id));
  const parents = new Map();
  for (const l of snapshot.links) if (l.pred === 'SUBCLASS_OF') {
    if (!parents.has(l.s)) parents.set(l.s, []);
    parents.get(l.s).push(l.t);
  }
  const ancestors = id => {
    const seen = new Set([id]), found = new Set(), stack = [...(parents.get(id) ?? [])];
    while (stack.length) { const x = stack.pop(); if (seen.has(x)) continue; seen.add(x); found.add(x); stack.push(...(parents.get(x) ?? [])); }
    return found;
  };
  const hc = new Set();
  for (const l of snapshot.links) if (l.pred === 'HAZARD_FOR' && nodes.get(l.s)?.kind === 'hazard' && nodes.get(l.t)?.kind === 'entity') {
    for (const x of ancestors(l.t)) if (classes.has(x)) hc.add(x);
  }
  return { effects, classes, harm: new Set([...effects].filter(x => x !== 'core:core-effect-data-read')), hc,
    relevant: c => c !== 'none' && (hc.has(c) || [...ancestors(c)].some(x => hc.has(x))) };
}
export function checkBinding(binding, manifest, snapshot) {
  const violations = [], onto = ontology(snapshot), entries = binding?.tools;
  if (onto.effects.size !== 9) violations.push('snapshot must have nine L1 effects');
  if (!keysEqual(binding, ['version', 'tools']) || binding.version !== 2 || !object(entries)) {
    return { violations: [...violations, 'binding must contain only version:2 and tools object'] };
  }
  const ids = manifest.tools.map(t => t.id);
  if (new Set(ids).size !== ids.length) violations.push('duplicate manifest tool id');
  if (!keysEqual(entries, ids)) violations.push('binding tools must exactly match manifest');
  let eligible = 0, params = 0, relevant = 0, write = 0, writeEligible = 0;
  for (const t of manifest.tools) {
    const entry = entries[t.id], names = t.params.map(p => p.name);
    if (new Set(names).size !== names.length) violations.push(`duplicate manifest parameter: ${t.id}`);
    if (!keysEqual(entry, ['effects', 'params', 'reason'])) { violations.push(`invalid entry keys: ${t.id}`); continue; }
    if (!Array.isArray(entry.effects) || entry.effects.some(e => !onto.effects.has(e)) || new Set(entry.effects).size !== entry.effects.length) violations.push(`invalid effect set: ${t.id}`);
    if (!keysEqual(entry.params, names)) violations.push(`parameters must exactly match manifest: ${t.id}`);
    if (typeof entry.reason !== 'string' || !entry.reason.trim()) violations.push(`empty/non-string reason: ${t.id}`);
    if (object(entry.params)) for (const [name, c] of Object.entries(entry.params)) if (c !== 'none' && !onto.classes.has(c)) violations.push(`invalid parameter class: ${t.id}/${name}`);
    const pass = Array.isArray(entry.effects) && entry.effects.some(e => onto.harm.has(e));
    eligible += Number(pass);
    if (t.impact === 'write') { write++; writeEligible += Number(pass); }
    for (const name of names) { params++; relevant += Number(onto.relevant(entry.params?.[name])); }
  }
  return { violations, tools: ids.length, eligible_tools: eligible, eligible_share: ids.length ? eligible / ids.length : 0,
    parameters: params, hazard_relevant_parameters: relevant, hazard_relevant_share: params ? relevant / params : 0,
    write_tools: write, eligible_write_tools: writeEligible, COLLAPSE: writeEligible === write && params > 0 && relevant / params >= .9,
    hazard_classes: [...onto.hc].sort() };
}
export function agreement(a, b, manifest) {
  const fresh = () => ({ effects: { total: 0, agree: 0 }, params: { total: 0, agree: 0 } });
  const overall = fresh(), per_suite = {};
  for (const t of manifest.tools) {
    const s = per_suite[t.suite] ??= fresh();
    const aa = a.tools[t.id], bb = b.tools[t.id];
    const same = aa && bb && JSON.stringify([...aa.effects].sort()) === JSON.stringify([...bb.effects].sort());
    for (const counts of [overall, s]) {
      counts.effects.total++; counts.effects.agree += Number(Boolean(same));
      for (const p of t.params) { counts.params.total++; counts.params.agree += Number(Boolean(aa && bb && aa.params[p.name] === bb.params[p.name])); }
    }
  }
  for (const c of [overall, ...Object.values(per_suite)]) for (const value of Object.values(c)) value.share = value.total ? value.agree / value.total : null;
  return { overall, per_suite };
}
export function checkArtifacts({ directory = HERE, primarySha256, corpus } = {}) {
  const snapshot = parseUnique(readFileSync(resolve(directory, '../out/snapshot.json'), 'utf8'));
  const scan = scanner(corpus ?? loadCorpus()), results = [], bindings = {};
  const manifestRaw = readFileSync(resolve(directory, 'out/tool-manifest-v2.json'), 'utf8');
  const manifest = parseUnique(manifestRaw);
  for (const file of ['out/tool-manifest-v2.json', 'binding-v2.json', 'binding-v2-b.json', 'BINDING-PROMPT.md']) {
    const raw = file === 'out/tool-manifest-v2.json' ? manifestRaw : readFileSync(resolve(directory, file), 'utf8');
    const value = file.endsWith('.json') ? parseUnique(raw) : raw;
    const sha256 = createHash('sha256').update(raw).digest('hex'), violations = scan(value);
    let validation;
    if (file.startsWith('binding-')) {
      validation = checkBinding(value, manifest, snapshot); violations.push(...validation.violations); bindings[file] = value;
      if (file === 'binding-v2.json' && primarySha256 && sha256 !== primarySha256.toLowerCase()) violations.push('primary SHA-256 mismatch');
    }
    results.push({ file, sha256, status: violations.length ? 'FAIL' : 'PASS', violations, ...(validation ? { validation } : {}) });
  }
  return { ok: results.every(r => r.status === 'PASS'), results,
    binding_agreement: results.filter(r => r.file.startsWith('binding-')).every(r => r.status === 'PASS') ? agreement(bindings['binding-v2.json'], bindings['binding-v2-b.json'], manifest) : null };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? fallback : process.argv[i + 1]; };
  try {
    const primarySha256 = arg('primary-sha256');
    if (primarySha256 !== undefined && !/^[a-f\d]{64}$/i.test(primarySha256)) throw new Error('invalid primary SHA-256');
    const result = checkArtifacts({ directory: resolve(arg('dir', HERE)), primarySha256 });
    console.log(JSON.stringify(result, null, 2)); process.exitCode = result.ok ? 0 : 1;
  } catch (e) { console.error(String(e)); process.exitCode = 1; }
}
