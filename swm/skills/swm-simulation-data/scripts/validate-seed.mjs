#!/usr/bin/env node
/* Validate swm/tools/silex-seed.mjs — the simulated (Silex-authored) content —
   before running a build. Every check here is an invariant the build, the page
   or the demo's cross-links rely on.

     node swm/skills/swm-simulation-data/scripts/validate-seed.mjs            */

import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SEED = resolve(process.argv[2] || join(HERE, '..', '..', '..', 'tools', 'silex-seed.mjs'));
const S = await import(SEED);

const problems = [], warnings = [];
const fail = m => problems.push(m);
const warn = m => warnings.push(m);
const seen = new Map();
const unique = (id, where) => {
  if (seen.has(id)) fail(`duplicate id "${id}" (${where} and ${seen.get(id)})`);
  else seen.set(id, where);
};

/* ---- groups, layers, dimensions ----------------------------------------- */
const groupIds = new Set(S.GROUPS.map(g => g.id));
if (S.GROUPS.length !== 8) warn(`${S.GROUPS.length} ontology groups; the legend and glyph set assume 8`);
for (const g of S.GROUPS) {
  unique(`grp:${g.id}`, 'GROUPS');
  if (!g.glyph) fail(`group "${g.id}" has no glyph; shape carries the group, not colour`);
}
if (S.LAYERS.map(l => l.id).join() !== '1,2,3,4') fail('LAYERS must be exactly 1..4 — the chain and the level bus assume four');
const dimIds = new Set(S.DIMENSIONS.map(d => d.id));
if (dimIds.size !== 6) warn(`${dimIds.size} radar dimensions; the radar geometry is laid out for 6`);

/* ---- domains, capabilities, workflows ----------------------------------- */
const domainIds = new Set(), capabilityIds = new Set(), workflowIds = new Set();
const pct = (v, where) => {
  if (typeof v !== 'number' || v < 0 || v > 1) fail(`${where}: coverage must be a number in 0..1, got ${v}`);
};
const dimsOk = (dims, where) => {
  if (!dims) return fail(`${where}: no dims — the radar has nothing to read at this level`);
  for (const id of dimIds) if (!(id in dims)) fail(`${where}: dims missing "${id}"`);
  for (const k of Object.keys(dims)) {
    if (!dimIds.has(k)) fail(`${where}: dims has unknown dimension "${k}"`);
    pct(dims[k], `${where}.dims.${k}`);
  }
};

for (const d of S.DOMAINS) {
  unique(`dom:${d.id}`, 'DOMAINS'); domainIds.add(d.id);
  pct(d.coverage, `domain ${d.id}`);
  dimsOk(d.dims, `domain ${d.id}`);
  if (!d.pack || !d.owner) warn(`domain ${d.id}: pack/owner shows in the inspector, leaving it blank looks unfinished`);
  if (!Array.isArray(d.entities) || !d.entities.length) fail(`domain ${d.id}: no entity types`);
  for (const e of d.entities || []) {
    const group = (S.GROUP_HINTS.find(([, re]) => re.test(e)) || ['resource'])[0];
    if (!groupIds.has(group)) fail(`domain ${d.id}: entity "${e}" maps to unknown group "${group}"`);
  }
  for (const c of d.capabilities || []) {
    unique(`cap:${c.id}`, `DOMAINS.${d.id}`); capabilityIds.add(c.id);
    pct(c.coverage, `capability ${c.id}`);
    dimsOk(c.dims, `capability ${c.id}`);
    if (!Number.isFinite(c.entities)) fail(`capability ${c.id}: entities must be a number (it sizes the sunburst)`);
    for (const w of c.workflows || []) {
      unique(`wf:${w.id}`, `DOMAINS.${d.id}.${c.id}`); workflowIds.add(w.id);
      if (!/^WF-\d{3}$/.test(w.id)) fail(`workflow "${w.id}": id must look like WF-021 — the page cross-links on that shape`);
      pct(w.coverage, `workflow ${w.id}`);
      if (!Number.isFinite(w.entities)) fail(`workflow ${w.id}: entities must be a number`);
    }
    if (!c.workflows || !c.workflows.length) warn(`capability ${c.id}: no workflows, so the sunburst stops one ring early here`);
  }
}

/* ---- agentic components (L3) -------------------------------------------- */
const componentIds = new Set();
for (const c of S.AGENTIC_COMPONENTS) {
  unique(`ag:${c.id}`, 'AGENTIC_COMPONENTS'); componentIds.add(c.id);
  if (!groupIds.has(c.group)) fail(`component ${c.id}: unknown group "${c.group}"`);
  pct(c.coverage, `component ${c.id}`);
  if (!c.blurb) warn(`component ${c.id}: no blurb, the inspector will look empty`);
}

/* ---- runtime graph (L4) -------------------------------------------------- */
const runtimeIds = new Set(S.RUNTIME.nodes.map(n => n.id));
for (const n of S.RUNTIME.nodes) {
  unique(n.id, 'RUNTIME.nodes');
  if (!groupIds.has(n.group)) fail(`runtime ${n.id}: unknown group "${n.group}"`);
  if (n.domain && !domainIds.has(n.domain)) fail(`runtime ${n.id}: domain "${n.domain}" is not a domain pack`);
  if (n.parent) {
    if (!runtimeIds.has(n.parent)) fail(`runtime ${n.id}: parent "${n.parent}" is not another runtime node`);
  } else if (!componentIds.has(n.type)) {
    fail(`runtime ${n.id}: type "${n.type}" is not an L3 component and no explicit parent is given — ` +
         `the node would have no place in the L1→L2→L3→L4 chain`);
  }
  if (n.coverage != null) pct(n.coverage, `runtime ${n.id}`);
}
for (const [s, t, pred] of S.RUNTIME.links) {
  if (!runtimeIds.has(s)) fail(`runtime link ${s} -> ${t}: source is not a runtime node`);
  if (!runtimeIds.has(t)) fail(`runtime link ${s} -> ${t}: target is not a runtime node`);
  if (!/^[A-Z][A-Z_]+$/.test(pred)) fail(`runtime link ${s} -> ${t}: predicate "${pred}" should be UPPER_SNAKE`);
}

/* ---- coverage gaps ------------------------------------------------------- */
const SEVERITIES = new Set(['critical', 'serious', 'warning', 'good']);
const ACTIONS = new Set(['gap', 'libUnregistered', 'incident', 'workflow']);
for (const g of S.GAPS) {
  unique(g.id, 'GAPS');
  if (!SEVERITIES.has(g.severity)) fail(`gap ${g.id}: severity "${g.severity}" is not one of ${[...SEVERITIES].join(', ')}`);
  if (!Array.isArray(g.scope) || !g.scope.length) fail(`gap ${g.id}: scope must list the coverage-tree ids it belongs to`);
  for (const s of g.scope || []) {
    const known = s === 'enterprise' || domainIds.has(s) || capabilityIds.has(s) || workflowIds.has(s);
    if (!known) fail(`gap ${g.id}: scope "${s}" matches no node in the coverage tree, so the gap can never be shown`);
  }
  if (g.action) {
    if (!ACTIONS.has(g.action.kind)) fail(`gap ${g.id}: action.kind "${g.action.kind}" is not one of ${[...ACTIONS].join(', ')}`);
    if (g.action.kind === 'workflow' && !workflowIds.has(g.action.value))
      fail(`gap ${g.id}: action opens workflow "${g.action.value}", which is not in the seed`);
    if (!g.action.label) fail(`gap ${g.id}: action has no button label`);
  }
}

/* ---- OWASP catalogues ---------------------------------------------------- */
for (const [id, label, target] of [...S.OWASP_LLM, ...S.OWASP_AGENTIC]) {
  if (!componentIds.has(target)) fail(`OWASP ${id} (${label}): targets "${target}", which is not an L3 component`);
}

/* ---- group hints --------------------------------------------------------- */
for (const [group, re] of S.GROUP_HINTS) {
  if (!groupIds.has(group)) fail(`GROUP_HINTS: "${group}" is not an ontology group`);
  if (!(re instanceof RegExp)) fail(`GROUP_HINTS for "${group}" is not a RegExp`);
}

/* ---- report -------------------------------------------------------------- */
const counts = {
  domains: domainIds.size, capabilities: capabilityIds.size, workflows: workflowIds.size,
  components: componentIds.size, runtimeNodes: runtimeIds.size,
  runtimeLinks: S.RUNTIME.links.length, gaps: S.GAPS.length
};
console.log(`\nSeed: ${SEED}`);
console.log('  ' + Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(' · '));
if (warnings.length) {
  console.log(`\n  ${warnings.length} warning(s):`);
  warnings.forEach(w => console.log(`    - ${w}`));
}
if (problems.length) {
  console.log(`\n  ${problems.length} problem(s):`);
  problems.forEach(p => console.log(`    ✗ ${p}`));
  console.log('\n  Fix these before building: the bundle would be inconsistent with the page.\n');
  process.exit(1);
}
console.log('\n  ✓ seed is internally consistent — safe to run swm/tools/build-ontology.mjs\n');
