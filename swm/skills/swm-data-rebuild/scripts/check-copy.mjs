#!/usr/bin/env node
/* Check that the current copy states the built bundle's numbers and none of the retired
   claims (plan logs/2026-10-02_SWM_ONTOLOGY_RIGOR_PLAN.md, T6). Every count a page or
   doc prints about the ontology is re-derived from swm/data and compared; every rule must
   match at least once in each file it names, so a reworded line cannot slip past.

     node swm/skills/swm-data-rebuild/scripts/check-copy.mjs [repoRoot]          */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), dataIndex = args.indexOf('--data');
if (dataIndex >= 0 && (!args[dataIndex + 1] || args[dataIndex + 1].startsWith('--'))) throw new Error('--data needs a directory');
const suppliedData = dataIndex >= 0 ? args.splice(dataIndex, 2)[1] : undefined;
if (args.length > 1 || args.some(a => a.startsWith('--'))) throw new Error('usage: check-copy.mjs [repoRoot] [--data directory]');
const ROOT = resolve(args[0] || join(HERE, '..', '..', '..', '..'));
const DATA = resolve(suppliedData || join(ROOT, 'swm/data'));
const onto = JSON.parse(await readFile(join(DATA, 'ontology.json'), 'utf8'));

const nodes = onto.nodes.length, links = onto.links.length;
const isBenchmark = n => Object.hasOwn(n, 'benchmark');
const types = onto.nodes.filter(n => !isBenchmark(n)).length;
const illustrativeL4 = onto.nodes.filter(n => n.layer === 4 && !isBenchmark(n)).length;
const benchmarkL4 = onto.nodes.filter(n => n.layer === 4 && isBenchmark(n)).length;
const layer = Object.fromEntries(onto.chain.layers.map(l => [l.id, l]));
const runtimeCount = id => +id === 4 ? illustrativeL4 : layer[id].count;
const hop = Object.fromEntries(onto.chain.hops.map(h => [h.from, h]));
const predCount = {}; onto.links.forEach(l => { predCount[l.pred] = (predCount[l.pred] || 0) + 1 });
const silex = onto.nodes.filter(n => (n.src || []).every(s => s.sys === 'silex')).length;
const threats = onto.nodes.filter(n => n.layer === 3 && ['technique', 'risk'].includes(n.kind)).length;
const SRC = { 'D3FEND': 'd3fend', 'ATLAS': 'atlas', 'ATT&amp;CK': 'attack', 'UCO': 'uco', 'OWASP': 'owasp' };
const pct = v => Math.round(v * 100);

const HTML = ['index.html', 'assurance.html'];
const MD_ALL = ['SECURITY_WORLD_MODEL.md', 'swm/README.md', 'swm/skills/swm-data-rebuild/SKILL.md'];

/* [name, files, regex (global), (match) => [[got, want, what], …]] */
const RULES = [
  ['kpi delta', HTML, /(\d+) ontology types, typed/g, m => [[+m[1], types, 'non-benchmark types']]],
  ['section totals', HTML, /(\d+) types · (\d+) relations/g, m => [[+m[1], nodes, 'nodes'], [+m[2], links, 'relations']]],
  ['layer rows', HTML, /<b>L(\d) · [^<]+<\/b>[\s\S]{0,260}?width:(\d+)%[\s\S]{0,160}?<div class="pc"><b>(\d+)<\/b> · (\d+)%/g,
    m => [[+m[3], runtimeCount(m[1]), `L${m[1]} illustrative count`], [+m[4], pct(layer[m[1]].coverage), `L${m[1]} coverage`], [+m[2], pct(layer[m[1]].coverage), `L${m[1]} bar width`]]],
  ['source counts', HTML, /<span class="as-src">([^<]+) <b>(\d+)<\/b>/g, m => [[+m[2], onto.stats[SRC[m[1]]], `${m[1]} nodes`]]],
  ['explorer button', HTML, /explorer — (\d+) nodes/g, m => [[+m[1], nodes, 'nodes']]],

  ['md totals', MD_ALL.slice(0, 2), /(\d+) nodes · (\d+) typed relations/g, m => [[+m[1], nodes, 'nodes'], [+m[2], links, 'relations']]],
  ['build output', ['swm/skills/swm-data-rebuild/SKILL.md'],
    /graph {3}: (\d+) nodes \(L1 (\d+) · L2 (\d+) · L3 (\d+) · L4 (\d+)\) · (\d+) links/g,
    m => [[+m[1], nodes, 'nodes'], [+m[2], layer[1].count, 'L1'], [+m[3], layer[2].count, 'L2'], [+m[4], layer[3].count, 'L3'], [+m[5], layer[4].count, 'L4'], [+m[6], links, 'links']]],
  ['build hops', ['swm/skills/swm-data-rebuild/SKILL.md'], /L1↔L2 (\d+) · L2↔L3 (\d+) · L3↔L4 (\d+) · skipping (\d+)/g,
    m => [[+m[1], hop[1].count, 'L1↔L2'], [+m[2], hop[2].count, 'L2↔L3'], [+m[3], hop[3].count, 'L3↔L4'], [+m[4], onto.chain.skips.count, 'skips']]],
  ['build threats', ['swm/skills/swm-data-rebuild/SKILL.md'], /(\d+) countered · (\d+) uncountered/g,
    m => [[+m[1], threats - onto.uncountered.length, 'countered'], [+m[2], onto.uncountered.length, 'uncountered']]],
  ['tier diagram', ['SECURITY_WORLD_MODEL.md'], /^L(\d) [^\n]*?(\d+) nodes · (?:avg coverage )?(\d+)%/gm,
    m => [[+m[2], runtimeCount(m[1]), `L${m[1]} illustrative count`], [+m[3], pct(layer[m[1]].coverage), `L${m[1]} coverage`]]],
  ['tier hops', ['SECURITY_WORLD_MODEL.md'], /(\d+) relations with L(\d)/g, m => [[+m[1], hop[+m[2] - 1].count, `hop into L${m[2]}`]]],
  ['tier skips', ['SECURITY_WORLD_MODEL.md'], /(\d+) relations that skip a tier/g, m => [[+m[1], onto.chain.skips.count, 'skips']]],
  ['silex nodes', ['SECURITY_WORLD_MODEL.md'], /(\d+) of those nodes are Silex-authored/g, m => [[+m[1], silex, 'Silex-authored nodes']]],
  ['README tiers', ['swm/README.md'], /\*\*L(\d) [^*]+\*\*\((\d+)\)/g, m => [[+m[2], runtimeCount(m[1]), `L${m[1]} illustrative count`]]],
  ['README predicates', ['swm/README.md'], /\b(SUBCLASS_OF|GROUPED_UNDER|ACHIEVES|PART_OF_DOMAIN|THREATENS) (\d+)/g,
    m => [[+m[2], predCount[m[1]] || 0, m[1]]]]
];

/* retired claims: the single chain, specialisation across tiers, and BASE totals */
const RETIRED = [
  [HTML, /skips a hop/], [HTML, /specialisation of the domain/], [HTML, /specialises the one above/],
  [HTML, /one chain, L1 → L2 → L3 → L4/], [HTML, /single L1→L2→L3→L4 chain/],
  [[...HTML, ...MD_ALL], /\b598 (?:ontology types|types|nodes)/], [[...HTML, ...MD_ALL], /\b800 (?:typed relations|relations|links)/],
  [MD_ALL, /parent sits more than one layer above/]
];

const problems = [], seen = [];
const text = {};
for (const f of new Set([...HTML, ...MD_ALL])) text[f] = await readFile(join(ROOT, f), 'utf8');
for (const [name, files, re, check] of RULES) for (const f of files) {
  const ms = [...text[f].matchAll(re)];
  if (!ms.length) { problems.push(`${f}: rule "${name}" matched nothing — the copy changed form`); continue }
  for (const m of ms) for (const [got, want, what] of check(m)) {
    seen.push(`${f}: ${name} · ${what} ${got}`);
    if (got !== want) problems.push(`${f}: ${name} · ${what} says ${got}, the bundle has ${want}`);
  }
}
for (const [files, re] of RETIRED) for (const f of files)
  if (re.test(text[f])) problems.push(`${f}: retired claim still present: ${re}`);

/* Benchmark L4 is a separate number, including when markup wraps the counts.
   Keep the old per-file rules above; a changed form still needs an explicit check. */
for (const f of [...HTML, ...MD_ALL]) {
  const plain = text[f].replace(/<[^>]*>/g, '').replace(/\*\*/g, '');
  const matches = [...plain.matchAll(/(\d+) illustrative \+ (\d+) benchmark/g)];
  if (!matches.length) problems.push(`${f}: rule "L4 partition" matched nothing — the two L4 counts are required`);
  for (const m of matches) for (const [got, want, what] of [[+m[1], illustrativeL4, 'illustrative L4'], [+m[2], benchmarkL4, 'benchmark L4']]) {
    seen.push(`${f}: L4 partition · ${what} ${got}`);
    if (got !== want) problems.push(`${f}: L4 partition · ${what} says ${got}, the bundle has ${want}`);
  }
}

console.log(`check-copy · bundle ${nodes} nodes · ${links} relations · ${seen.length} printed numbers compared`);
if (problems.length) { problems.forEach(p => console.log('  ✗ ' + p)); process.exit(1) }
console.log('  ✓ every printed count matches the bundle; no retired claim remains');
