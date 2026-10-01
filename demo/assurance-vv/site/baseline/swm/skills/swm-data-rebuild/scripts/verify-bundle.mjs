#!/usr/bin/env node
/* Independent check of the built bundles — run it after every rebuild, on any
   host. It re-derives the invariants instead of trusting the build script.

     node swm/skills/swm-data-rebuild/scripts/verify-bundle.mjs [swm/data]    */

import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(process.argv[2] || join(HERE, '..', '..', '..', 'data'));
const problems = [], notes = [];
const fail = m => problems.push(m);

const read = async f => JSON.parse(await readFile(join(DATA, f), 'utf8'));
const onto = await read('ontology.json');
const cov  = await read('coverage.json');

/* ---- the .js twins the page actually loads ------------------------------ */
for (const [file, global] of [['ontology.js', 'SILEX_SWM_ONTOLOGY'], ['coverage.js', 'SILEX_SWM_COVERAGE']]) {
  const text = await readFile(join(DATA, file), 'utf8');
  if (!text.includes(`window.${global} =`)) fail(`${file}: does not assign window.${global} — the page loads this file, not the .json`);
  const payload = JSON.parse(text.slice(text.indexOf('=') + 1).trim().replace(/;\s*$/, ''));
  const json = file === 'ontology.js' ? onto : cov;
  if (JSON.stringify(payload) !== JSON.stringify(json)) fail(`${file} and ${file.replace('.js', '.json')} disagree — rebuild, do not hand-edit`);
  const kb = Math.round((await stat(join(DATA, file))).size / 1024);
  notes.push(`${file} ${kb}KB`);
  if (kb > 700) fail(`${file} is ${kb}KB — over the 700KB budget for a lazily loaded demo bundle`);
}

/* ---- graph integrity ----------------------------------------------------- */
const byId = new Map(onto.nodes.map(n => [n.id, n]));
if (byId.size !== onto.nodes.length) fail('ontology.nodes contains duplicate ids');
const layerCount = {};
for (const n of onto.nodes) {
  layerCount[n.layer] = (layerCount[n.layer] || 0) + 1;
  if (![1, 2, 3, 4].includes(n.layer)) fail(`${n.id}: layer ${n.layer} is outside 1..4`);
  if (!onto.groups.some(g => g.id === n.group)) fail(`${n.id}: unknown group "${n.group}"`);
  if (!Array.isArray(n.src) || !n.src.length) fail(`${n.id}: no src — every node must say where it came from`);
}
for (const l of onto.links) {
  if (!byId.has(l.s)) fail(`link ${l.s} -> ${l.t}: source missing`);
  if (!byId.has(l.t)) fail(`link ${l.s} -> ${l.t}: target missing`);
}

/* ---- the L1 -> L2 -> L3 -> L4 chain, re-derived -------------------------- */
const roots = onto.nodes.filter(n => n.anchor);
if (!roots.length) fail('no anchor nodes: the explorer walks the graph from the group anchors');
for (const n of onto.nodes) {
  if (n.anchor) continue;
  const p = byId.get(n.parent);
  if (!p) { fail(`${n.id} (L${n.layer}): parent "${n.parent}" missing`); continue; }
  if (p.layer !== n.layer && p.layer !== n.layer - 1)
    fail(`${n.id} (L${n.layer}) -> ${p.id} (L${p.layer}) skips a layer`);
}
/* everything must be reachable from an anchor, or it can never be expanded */
const reachable = new Set(roots.map(r => r.id));
let added = true;
while (added) {
  added = false;
  for (const n of onto.nodes)
    if (!reachable.has(n.id) && n.parent && reachable.has(n.parent)) { reachable.add(n.id); added = true; }
}
const unreachable = onto.nodes.filter(n => !reachable.has(n.id));
if (unreachable.length) fail(`${unreachable.length} node(s) unreachable from any anchor, e.g. ${unreachable.slice(0, 3).map(n => n.id).join(', ')}`);

/* ---- chain summary the Layers panel draws -------------------------------- */
if (!onto.chain) fail('ontology.chain missing — the Ontology Layers panel has nothing to draw');
else {
  for (const layer of onto.chain.layers)
    if (layer.count !== (layerCount[layer.id] || 0))
      fail(`chain.layers L${layer.id} says ${layer.count} types, the graph has ${layerCount[layer.id] || 0}`);
  for (const hop of onto.chain.hops) {
    const real = onto.links.filter(l => {
      const a = byId.get(l.s), b = byId.get(l.t);
      return a && b && ((a.layer === hop.from && b.layer === hop.to) || (a.layer === hop.to && b.layer === hop.from));
    }).length;
    if (real !== hop.count) fail(`chain hop L${hop.from}->L${hop.to} says ${hop.count} relations, the graph has ${real}`);
  }
}

/* ---- coverage tree ------------------------------------------------------- */
const treeIds = new Set();
(function walk(n) { treeIds.add(n.id); (n.children || []).forEach(walk); })(cov.tree);
for (const g of cov.gaps)
  for (const s of g.scope)
    if (!treeIds.has(s)) fail(`gap ${g.id}: scope "${s}" is not in the coverage tree`);
for (const d of cov.tree.children)
  if (!byId.has(`dom:${d.id}`)) fail(`coverage domain "${d.id}" has no dom:${d.id} node in the graph`);
if (!cov.kpis?.length) fail('coverage.kpis is empty — the KPI row would render blank');
for (const dim of cov.dimensions)
  if (!(dim.id in cov.tree.dims)) fail(`coverage.tree.dims missing dimension "${dim.id}"`);

/* ---- ids the page cross-links to ----------------------------------------- */
for (const id of ['wf:WF-021', 'rt-inc-1042', 'dom:finance', 'dom:horizontal'])
  if (!byId.has(id)) fail(`${id} is missing — index.html cross-links depend on it`);

/* ---- provenance ---------------------------------------------------------- */
const bySrc = {};
for (const n of onto.nodes) for (const s of n.src) bySrc[s.sys] = (bySrc[s.sys] || 0) + 1;
for (const sys of ['d3fend', 'atlas', 'attack', 'uco', 'owasp'])
  if (!bySrc[sys]) fail(`no nodes carry src "${sys}" — that source did not make it into the bundle`);

/* ---- report -------------------------------------------------------------- */
console.log(`\nBundle: ${DATA}`);
console.log(`  ${onto.nodes.length} nodes (${[1,2,3,4].map(l => `L${l} ${layerCount[l] || 0}`).join(' · ')}) · ${onto.links.length} links`);
console.log(`  by source: ${Object.entries(bySrc).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
if (onto.chain) console.log(`  chain: ${onto.chain.hops.map(h => `L${h.from}→L${h.to} ${h.count}`).join(' · ')}`);
console.log(`  coverage: ${Math.round(cov.tree.coverage * 100)}% weighted · ${cov.tree.entities.toLocaleString()} entities · ${cov.gaps.length} gaps`);
console.log(`  files: ${notes.join(' · ')}`);
if (problems.length) {
  console.log(`\n  ${problems.length} problem(s):`);
  problems.forEach(p => console.log(`    ✗ ${p}`));
  console.log('');
  process.exit(1);
}
console.log('\n  ✓ bundle is internally consistent and matches what the page expects\n');
