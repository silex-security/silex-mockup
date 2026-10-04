#!/usr/bin/env node
/* Validate swm/tools/silex-seed.mjs — the simulated (Silex-authored) content —
   before running a build. Every check here is an invariant the build, the page
   or the demo's cross-links rely on.

   It also validates the ontology-rigor exports (CORE_L1, ENTITY_ISA,
   COMPONENT_ISA, DOMAIN_ACTIONS, PROHIBITED, DOMAIN_HAZARDS, RECORD_SCHEMAS,
   COUNTER_MAP, INCIDENT_HAZARDS, CANDIDATE_DOMAINS) against the frozen contract
   in swm/tools/schema.mjs, and checks that every public id they reference exists
   in swm/data/ontology.json with a kind allowed by the predicate's signature.

     node swm/skills/swm-simulation-data/scripts/validate-seed.mjs [seed.mjs]   */

import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { readFile } from 'node:fs/promises';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const SEED = resolve(process.argv[2] || join(REPO, 'tools', 'silex-seed.mjs'));
const S = await import(SEED);
const SCHEMA = await import(join(REPO, 'tools', 'schema.mjs'));

const problems = [], warnings = [];
const fail = m => problems.push(m);
const warn = m => warnings.push(m);
const seen = new Map();
const unique = (id, where) => {
  if (seen.has(id)) fail(`duplicate id "${id}" (${where} and ${seen.get(id)})`);
  else seen.set(id, where);
};

/* public bundle, for checking ids and kinds of public references */
let publicById = new Map();
try {
  const bundle = JSON.parse(await readFile(join(REPO, 'data', 'ontology.json'), 'utf8'));
  publicById = new Map(bundle.nodes.map(n => [n.id, n]));
} catch {
  warn('swm/data/ontology.json not readable — public-id and kind checks were skipped');
}
const isPublic = id => publicById.get(id);
const nistId = cid => { const p = cid.split('.'); const base = p[0].toUpperCase(); return p.length > 1 ? `${base}(${p.slice(1).join('')})` : base; };
/* ids the build imports from the grounding source modules, known before the bundle is rebuilt */
const sourceKindById = new Map();
for (const cid of (S.SOURCE_SELECTION['nist-800-53'] || {}).controls || []) sourceKindById.set(`nist:${nistId(cid)}`, 'control');
for (const t of S.SOURCE_SELECTION.attackTechniques || []) sourceKindById.set(`attack:${t}`, 'technique');
for (const o of (S.SOURCE_SELECTION.ocsf || {}).objects || []) sourceKindById.set(`ocsf:${o}`, 'class');
for (const e of (S.SOURCE_SELECTION.ocsf || {}).events || []) sourceKindById.set(`ocsf:${e}`, 'class');
for (const c of (S.SOURCE_SELECTION.fibo || {}).classes || []) sourceKindById.set(`fibo:${c}`, 'class');
for (const k of Object.keys((S.SOURCE_SELECTION.fibo || {}).domain || {})) sourceKindById.set(`fibo:${k}`, 'class');
for (const d of (S.SOURCE_SELECTION.cdm || {}).docs || []) sourceKindById.set(`cdm:${d.entity}`, 'class');
for (const cid of (S.SOURCE_SELECTION['attack-campaigns'] || {}).ids || []) sourceKindById.set(`case:${cid}`, 'case');
for (const cl of S.CASE_LINKS || []) sourceKindById.set(`case:${cl.case}`, 'case');
const isKnown = id => !!publicById.get(id) || sourceKindById.has(id);
const publicKind = id => (publicById.get(id) || {}).kind ?? sourceKindById.get(id);

/* kind-pair signature check from the frozen contract */
const pairOk = (pred, sKind, tKind) => {
  const sig = SCHEMA.PRED_SIGNATURES[pred];
  return !!sig && sig.pairs.some(([s, t]) => s === sKind && t === tKind);
};
const checkPair = (pred, sKind, tKind, where) => {
  const sig = SCHEMA.PRED_SIGNATURES[pred];
  if (!sig) return fail(`${where}: predicate "${pred}" is not in the frozen contract`);
  if (!pairOk(pred, sKind, tKind))
    fail(`${where}: ${pred} cannot join ${sKind} -> ${tKind} per schema.mjs`);
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
const entitiesByDomain = new Map();
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
  entitiesByDomain.set(d.id, new Set(d.entities || []));
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

/* candidate packs: ontology only, no coverage figures */
const candidateIds = new Set();
for (const d of S.CANDIDATE_DOMAINS || []) {
  unique(`dom:${d.id}`, 'CANDIDATE_DOMAINS'); domainIds.add(d.id); candidateIds.add(d.id);
  if (!d.name || !d.code || !d.pack || !d.owner) fail(`candidate ${d.id}: name/code/pack/owner is required`);
  if (!Array.isArray(d.entities) || !d.entities.length) fail(`candidate ${d.id}: no entity types`);
  entitiesByDomain.set(d.id, new Set(d.entities || []));
  let caps = 0, wfs = 0;
  for (const c of d.capabilities || []) {
    caps++; unique(`cap:${c.id}`, `CANDIDATE_DOMAINS.${d.id}`); capabilityIds.add(c.id);
    for (const w of c.workflows || []) {
      wfs++; unique(`wf:${w.id}`, `CANDIDATE_DOMAINS.${d.id}.${c.id}`); workflowIds.add(w.id);
      if (!/^WF-\d{3}$/.test(w.id)) fail(`candidate workflow "${w.id}": id must look like WF-021`);
    }
  }
  if (!caps) fail(`candidate ${d.id}: at least one capability is required`);
  if (!wfs) fail(`candidate ${d.id}: at least one workflow is required`);
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
const runtimeById = new Map(S.RUNTIME.nodes.map(n => [n.id, n]));
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

/* ======================================================================== */
/* Ontology rigour exports (plan 2026-10-02; contract swm/tools/schema.mjs)  */
/* ======================================================================== */

const coreById = new Map();
for (const c of S.CORE_L1 || []) {
  if (coreById.has(c.id)) fail(`CORE_L1: duplicate core id "${c.id}"`);
  coreById.set(c.id, c);
}
const coreKind = id => (coreById.get(id) || {}).kind;

/* ---- CORE_L1 shape, kinds, parent compatibility, cycles ---------------- */
if ((S.CORE_L1 || []).length < 40) warn(`CORE_L1 has ${S.CORE_L1.length} concepts; the plan expects roughly 40+`);
for (const c of S.CORE_L1 || []) {
  if (!SCHEMA.CORE_KINDS.includes(c.kind)) fail(`CORE_L1 ${c.id}: kind "${c.kind}" is not a core kind`);
  if (!c.label || !c.def) fail(`CORE_L1 ${c.id}: label and def are required`);
  if (!groupIds.has(c.group)) fail(`CORE_L1 ${c.id}: unknown group "${c.group}"`);
  if (typeof c.parent !== 'string' || !c.parent) { fail(`CORE_L1 ${c.id}: parent is required`); continue; }
  if (c.parent.startsWith('grp:')) {
    const g = c.parent.slice(4);
    if (!groupIds.has(g)) fail(`CORE_L1 ${c.id}: parent group "${c.parent}" does not exist`);
    checkPair('GROUPED_UNDER', c.kind, 'group', `CORE_L1 ${c.id}`);
  } else {
    const p = coreById.get(c.parent);
    if (!p) fail(`CORE_L1 ${c.id}: parent "${c.parent}" is neither a group nor a core id`);
    else {
      const compat = SCHEMA.SUBCLASS_COMPAT[c.kind] || [];
      if (!compat.includes(p.kind))
        fail(`CORE_L1 ${c.id}: kind ${c.kind} may not specialise ${p.id} (kind ${p.kind}) per SUBCLASS_COMPAT`);
    }
  }
  for (const pid of c.relatedMatch || []) {
    if (!isPublic(pid)) { fail(`CORE_L1 ${c.id}: relatedMatch "${pid}" is not in the bundle`); continue; }
    checkPair('RELATED_MATCH', c.kind, publicKind(pid), `CORE_L1 ${c.id} relatedMatch ${pid}`);
  }
}
/* SUBCLASS_OF acyclicity among core concepts (parent edges only) */
{
  const state = new Map();
  const cyclePath = [];
  const visit = (id, stack) => {
    if (state.get(id) === 'done') return false;
    if (state.get(id) === 'open') { fail(`CORE_L1: SUBCLASS_OF cycle among core concepts: ${[...stack, id].join(' -> ')}`); return true; }
    state.set(id, 'open'); stack.push(id);
    const c = coreById.get(id);
    if (c && c.parent && !c.parent.startsWith('grp:') && coreById.has(c.parent)) visit(c.parent, stack);
    stack.pop(); state.set(id, 'done'); return false;
  };
  for (const id of coreById.keys()) if (visit(id, cyclePath)) break;
}

/* ---- ENTITY_ISA: every entity, all 7 packs ------------------------------ */
for (const [domainId, labels] of entitiesByDomain) {
  const isa = (S.ENTITY_ISA || {})[domainId];
  if (!isa) { fail(`ENTITY_ISA: no mapping for domain "${domainId}"`); continue; }
  for (const label of labels) {
    const target = isa[label];
    if (!target) { fail(`ENTITY_ISA[${domainId}]: entity "${label}" has no core id`); continue; }
    if (coreKind(target) !== 'core') fail(`ENTITY_ISA[${domainId}]["${label}"] -> "${target}" is not a core-kind concept`);
    checkPair('SUBCLASS_OF', 'entity', coreKind(target), `ENTITY_ISA ${domainId}/${label}`);
  }
  for (const key of Object.keys(isa))
    if (!labels.has(key)) fail(`ENTITY_ISA[${domainId}]: "${key}" is not an entity of that pack`);
}
for (const key of Object.keys(S.ENTITY_ISA || {}))
  if (!entitiesByDomain.has(key)) fail(`ENTITY_ISA: "${key}" is not a known domain`);

/* ---- COMPONENT_ISA: all 13 components ----------------------------------- */
for (const c of S.AGENTIC_COMPONENTS) {
  const target = (S.COMPONENT_ISA || {})[c.id];
  if (!target) { fail(`COMPONENT_ISA: component "${c.id}" has no core id`); continue; }
  if (coreKind(target) !== 'core') fail(`COMPONENT_ISA["${c.id}"] -> "${target}" is not a core-kind concept`);
  checkPair('SUBCLASS_OF', 'component', coreKind(target), `COMPONENT_ISA ${c.id}`);
}
for (const key of Object.keys(S.COMPONENT_ISA || {}))
  if (!componentIds.has(key)) fail(`COMPONENT_ISA: "${key}" is not an agentic component`);

/* ---- DOMAIN_ACTIONS ----------------------------------------------------- */
const actionById = new Map();
for (const [domainId, acts] of Object.entries(S.DOMAIN_ACTIONS || {})) {
  if (!domainIds.has(domainId)) fail(`DOMAIN_ACTIONS: unknown domain "${domainId}"`);
  const candidate = candidateIds.has(domainId);
  const lo = candidate ? 3 : 4, hi = candidate ? 5 : 20;
  if (acts.length < lo || acts.length > hi) fail(`DOMAIN_ACTIONS[${domainId}]: ${acts.length} actions, expected ${lo}–${hi}`);
  for (const a of acts) {
    if (actionById.has(a.id)) fail(`DOMAIN_ACTIONS: duplicate action id "${a.id}"`);
    actionById.set(a.id, { domain: domainId, ...a });
    if (!a.label) fail(`DOMAIN_ACTIONS ${a.id}: label is required`);
    if (coreKind(a.isA) !== 'action') fail(`DOMAIN_ACTIONS ${a.id}: isA "${a.isA}" is not a core action`);
    else checkPair('SUBCLASS_OF', 'action', 'action', `DOMAIN_ACTIONS ${a.id}.isA`);
    if (!Array.isArray(a.mayCause) || !a.mayCause.length) fail(`DOMAIN_ACTIONS ${a.id}: mayCause must list at least one effect`);
    for (const e of a.mayCause || []) {
      if (coreKind(e) !== 'effect') fail(`DOMAIN_ACTIONS ${a.id}: mayCause "${e}" is not a core effect`);
      else checkPair('MAY_CAUSE', 'action', 'effect', `DOMAIN_ACTIONS ${a.id}.mayCause`);
    }
    if (a.workflows === undefined) fail(`DOMAIN_ACTIONS ${a.id}: workflows field is required`);
    else if (!Array.isArray(a.workflows)) fail(`DOMAIN_ACTIONS ${a.id}: workflows must be an array`);
    else if (!a.workflows.length && !(typeof a.noWorkflow === 'string' && a.noWorkflow)) fail(`DOMAIN_ACTIONS ${a.id}: empty workflows requires a non-empty noWorkflow reason`);
    for (const w of a.workflows || []) {
      if (!workflowIds.has(w)) fail(`DOMAIN_ACTIONS ${a.id}: workflow "${w}" does not exist`);
      else checkPair('USED_IN', 'action', 'workflow', `DOMAIN_ACTIONS ${a.id}.workflows`);
    }
    for (const rt of a.implementedBy || []) {
      const node = runtimeById.get(rt);
      if (!node) fail(`DOMAIN_ACTIONS ${a.id}: implementedBy "${rt}" is not a runtime node`);
      else if (node.type !== 'tool-reg') fail(`DOMAIN_ACTIONS ${a.id}: implementedBy "${rt}" is type "${node.type}", not tool-reg`);
      else checkPair('IMPLEMENTS', 'tool-reg', 'action', `DOMAIN_ACTIONS ${a.id}.implementedBy`);
    }
  }
}

/* ---- PROHIBITED: the five former "(prohibited)" entities ---------------- */
const PROHIBITED_EXPECTED = [
  'Unrecoverable Payout', 'PII Disclosure to Wrong Party', 'Standing Privilege',
  'Unauthorised Pay Change', 'Unverified Bank Change'
];
const prohibitedById = new Map();
const prohibitedLabels = [];
for (const [domainId, entries] of Object.entries(S.PROHIBITED || {})) {
  if (!domainIds.has(domainId)) fail(`PROHIBITED: unknown domain "${domainId}"`);
  for (const p of entries) {
    if (prohibitedById.has(p.id)) fail(`PROHIBITED: duplicate id "${p.id}"`);
    prohibitedById.set(p.id, { domain: domainId, ...p });
    prohibitedLabels.push(p.label);
    if (p.kind !== 'effect' && p.kind !== 'state') fail(`PROHIBITED ${p.id}: kind "${p.kind}" must be effect or state`);
    if (coreKind(p.isA) !== p.kind) fail(`PROHIBITED ${p.id}: isA "${p.isA}" is not a core ${p.kind}`);
    else checkPair('SUBCLASS_OF', p.kind, p.kind, `PROHIBITED ${p.id}.isA`);
    if (!p.def) fail(`PROHIBITED ${p.id}: def (the retype justification) is required`);
  }
}
/* the five migrated entities must stay retyped, but a re-skin may add more valid outcomes */
for (const label of PROHIBITED_EXPECTED)
  if (!prohibitedLabels.includes(label)) fail(`PROHIBITED: former entity "${label}" was not retyped as effect/state`);
for (const d of S.DOMAINS) for (const e of d.entities || [])
  if (PROHIBITED_EXPECTED.includes(e) || /prohibited/i.test(e))
    fail(`DOMAINS.${d.id}: entity "${e}" still reads as a prohibited outcome — it belongs in PROHIBITED`);

/* ---- DOMAIN_HAZARDS: complete principle-3 chains ------------------------ */
const hazardById = new Map();
const referencedEvidence = new Set();
for (const [domainId, hazards] of Object.entries(S.DOMAIN_HAZARDS || {})) {
  if (!domainIds.has(domainId)) fail(`DOMAIN_HAZARDS: unknown domain "${domainId}"`);
  const candidate = candidateIds.has(domainId);
  const lo = candidate ? 2 : 3, hi = candidate ? 3 : 12;
  if (hazards.length < lo || hazards.length > hi) fail(`DOMAIN_HAZARDS[${domainId}]: ${hazards.length} hazards, expected ${lo}–${hi}`);
  const entities = entitiesByDomain.get(domainId) || new Set();
  for (const h of hazards) {
    if (hazardById.has(h.id)) fail(`DOMAIN_HAZARDS: duplicate hazard id "${h.id}"`);
    hazardById.set(h.id, { domain: domainId, ...h });
    if (!h.def) fail(`DOMAIN_HAZARDS ${h.id}: def is required`);
    if (!Array.isArray(h.hazardFor) || !h.hazardFor.length) fail(`DOMAIN_HAZARDS ${h.id}: hazardFor must not be empty`);
    for (const t of h.hazardFor || []) {
      if (actionById.has(t)) checkPair('HAZARD_FOR', 'hazard', 'action', `DOMAIN_HAZARDS ${h.id}.hazardFor`);
      else if (entities.has(t)) checkPair('HAZARD_FOR', 'hazard', 'entity', `DOMAIN_HAZARDS ${h.id}.hazardFor`);
      else fail(`DOMAIN_HAZARDS ${h.id}: hazardFor "${t}" is not an action id or an entity of ${domainId}`);
    }
    if (!Array.isArray(h.characterizes) || !h.characterizes.length) fail(`DOMAIN_HAZARDS ${h.id}: characterizes must not be empty`);
    for (const t of h.characterizes || []) {
      if (!isKnown(t)) fail(`DOMAIN_HAZARDS ${h.id}: characterizes "${t}" is not in the bundle`);
      else checkPair('CHARACTERIZES', 'hazard', publicKind(t), `DOMAIN_HAZARDS ${h.id}.characterizes`);
    }
    if (!Array.isArray(h.mitigatedBy) || !h.mitigatedBy.length) fail(`DOMAIN_HAZARDS ${h.id}: mitigatedBy must not be empty`);
    for (const c of h.mitigatedBy || []) {
      const ck = coreKind(c) || publicKind(c);
      if (ck === 'control') checkPair('MITIGATED_BY', 'hazard', 'control', `DOMAIN_HAZARDS ${h.id}.mitigatedBy`);
      else if (ck === 'countermeasure') checkPair('MITIGATED_BY', 'hazard', 'countermeasure', `DOMAIN_HAZARDS ${h.id}.mitigatedBy`);
      else fail(`DOMAIN_HAZARDS ${h.id}: mitigatedBy "${c}" is neither a core/nist control nor a countermeasure`);
    }
    if (!Array.isArray(h.requiresEvidence) || !h.requiresEvidence.length) fail(`DOMAIN_HAZARDS ${h.id}: requiresEvidence must not be empty`);
    for (const e of h.requiresEvidence || []) {
      if (coreKind(e) !== 'evidence') fail(`DOMAIN_HAZARDS ${h.id}: requiresEvidence "${e}" is not core evidence`);
      else { checkPair('REQUIRES_EVIDENCE', 'hazard', 'evidence', `DOMAIN_HAZARDS ${h.id}.requiresEvidence`); referencedEvidence.add(e); }
    }
    for (const p of h.mayLeadTo || []) {
      if (!prohibitedById.has(p)) fail(`DOMAIN_HAZARDS ${h.id}: mayLeadTo "${p}" is not a prohibited outcome`);
      else checkPair('MAY_LEAD_TO', 'hazard', prohibitedById.get(p).kind, `DOMAIN_HAZARDS ${h.id}.mayLeadTo`);
    }
    for (const pl of prohibitedLabels) {
      if (h.label && (h.label === pl || h.label.toLowerCase().includes(pl.toLowerCase())))
        fail(`DOMAIN_HAZARDS ${h.id}: hazard label "${h.label}" relabels the prohibited outcome "${pl}"`);
    }
  }
}
for (const p of prohibitedById.values()) {
  const reached = [...hazardById.values()].some(h => (h.mayLeadTo || []).includes(p.id));
  if (!reached) fail(`PROHIBITED ${p.id}: no hazard reaches it via mayLeadTo`);
}

/* ---- RECORD_SCHEMAS: evidence is recorded ------------------------------- */
const recordIds = new Set(), recordedEvidence = new Set();
if (S.RECORD_SCHEMAS.length < 6 || S.RECORD_SCHEMAS.length > 14)
  fail(`RECORD_SCHEMAS: ${S.RECORD_SCHEMAS.length} schemas, expected 6–14`);
for (const r of S.RECORD_SCHEMAS) {
  if (recordIds.has(r.id)) fail(`RECORD_SCHEMAS: duplicate id "${r.id}"`);
  recordIds.add(r.id);
  if (!r.label || !r.def) fail(`RECORD_SCHEMAS ${r.id}: label and def are required`);
  if (!Array.isArray(r.records) || !r.records.length) fail(`RECORD_SCHEMAS ${r.id}: records must not be empty`);
  for (const e of r.records || []) {
    if (coreKind(e) !== 'evidence') fail(`RECORD_SCHEMAS ${r.id}: records "${e}" is not core evidence`);
    else { checkPair('RECORDED_BY', 'evidence', 'record', `RECORD_SCHEMAS ${r.id}.records`); recordedEvidence.add(e); }
  }
}
for (const e of referencedEvidence)
  if (!recordedEvidence.has(e)) fail(`RECORD_SCHEMAS: evidence "${e}" is required by a hazard but no schema records it`);

/* ---- COUNTER_MAP: all 25 OWASP risks ------------------------------------ */
const OWASP_IDS = [...S.OWASP_LLM.map(x => `owasp:${x[0]}`), ...S.OWASP_AGENTIC.map(x => `owaspa:${x[0]}`)];
const countered = new Set();
for (const m of S.COUNTER_MAP || []) {
  if (countered.has(m.threat)) fail(`COUNTER_MAP: duplicate threat "${m.threat}"`);
  countered.add(m.threat);
  if (!isPublic(m.threat)) fail(`COUNTER_MAP: threat "${m.threat}" is not in the bundle`);
  else if (!['technique', 'risk'].includes(publicKind(m.threat)))
    fail(`COUNTER_MAP: threat "${m.threat}" has kind ${publicKind(m.threat)} (expected technique or risk)`);
  if (coreKind(m.control) === 'control') checkPair('COUNTERS', 'control', publicKind(m.threat), `COUNTER_MAP ${m.threat}`);
  else if (publicKind(m.control) === 'countermeasure') checkPair('COUNTERS', 'countermeasure', publicKind(m.threat), `COUNTER_MAP ${m.threat}`);
  else fail(`COUNTER_MAP ${m.threat}: control "${m.control}" is neither a core control nor a d3f countermeasure`);
  if (!m.note) fail(`COUNTER_MAP ${m.threat}: note is required`);
}
for (const id of OWASP_IDS)
  if (!countered.has(id)) fail(`COUNTER_MAP: OWASP risk "${id}" has no mapped control (with a note)`);

/* ---- INCIDENT_HAZARDS --------------------------------------------------- */
for (const ih of S.INCIDENT_HAZARDS || []) {
  const node = runtimeById.get(ih.incident);
  if (!node) fail(`INCIDENT_HAZARDS: incident "${ih.incident}" is not a runtime node`);
  else if (node.type !== 'incident') fail(`INCIDENT_HAZARDS: "${ih.incident}" is type "${node.type}", not incident`);
  if (!hazardById.has(ih.hazard)) fail(`INCIDENT_HAZARDS: hazard "${ih.hazard}" does not exist`);
  else checkPair('EXHIBITS', 'incident', 'hazard', `INCIDENT_HAZARDS ${ih.incident}`);
}

/* ---- domain grounding T0 lists (plan E5) --------------------------------- */
for (const [domainId, rows] of Object.entries(S.DOMAIN_ALIGNMENT || {})) {
  if (!domainIds.has(domainId)) fail(`DOMAIN_ALIGNMENT: unknown domain "${domainId}"`);
  const entities = entitiesByDomain.get(domainId) || new Set();
  for (const r of rows) {
    if (!entities.has(r.entity)) fail(`DOMAIN_ALIGNMENT ${domainId}: entity "${r.entity}" is not in the pack`);
    if (r.unmatched) {
      if (typeof r.unmatched !== 'string' || !r.unmatched) fail(`DOMAIN_ALIGNMENT ${domainId}/${r.entity}: unmatched needs a reason`);
    } else {
      if (!Array.isArray(r.match) || !r.match.length) fail(`DOMAIN_ALIGNMENT ${domainId}/${r.entity}: match must list ids`);
      for (const c of r.match) {
        if (!isKnown(c)) fail(`DOMAIN_ALIGNMENT ${domainId}/${r.entity}: match "${c}" is not a known source id`);
        else checkPair('CLOSE_MATCH', 'entity', publicKind(c), `DOMAIN_ALIGNMENT ${domainId}/${r.entity}`);
      }
    }
  }
}
for (const r of S.RECORD_ALIGNMENT || []) {
  if (!recordIds.has(r.record)) fail(`RECORD_ALIGNMENT: record "${r.record}" is not a RECORD_SCHEMAS id`);
  if (!Array.isArray(r.match) || !r.match.length) fail(`RECORD_ALIGNMENT ${r.record}: match must list ids`);
  for (const c of r.match) {
    if (!isKnown(c)) fail(`RECORD_ALIGNMENT ${r.record}: match "${c}" is not a known source id`);
    else checkPair('CLOSE_MATCH', 'record', publicKind(c), `RECORD_ALIGNMENT ${r.record}`);
  }
}
const RELS = new Set(['derived', 'related']);
for (const [hid, rows] of Object.entries(S.BENCHMARK_HAZARDS || {})) {
  if (!hazardById.has(hid)) fail(`BENCHMARK_HAZARDS: hazard "${hid}" does not exist`);
  for (const r of rows) {
    if (typeof r.key !== 'string' || !r.key) fail(`BENCHMARK_HAZARDS ${hid}: key is required`);
    if (!RELS.has(r.rel)) fail(`BENCHMARK_HAZARDS ${hid}: rel "${r.rel}" is not derived|related`);
  }
}
for (const [aid, keys] of Object.entries(S.BENCHMARK_ACTIONS || {})) {
  if (!actionById.has(aid)) fail(`BENCHMARK_ACTIONS: action "${aid}" does not exist`);
  for (const k of keys) if (typeof k !== 'string' || !k) fail(`BENCHMARK_ACTIONS ${aid}: key is required`);
}
for (const cl of S.CASE_LINKS || []) {
  if (!hazardById.has(cl.hazard)) fail(`CASE_LINKS: hazard "${cl.hazard}" does not exist`);
  else if (!(hazardById.get(cl.hazard).characterizes || []).includes(cl.via)) fail(`CASE_LINKS ${cl.hazard} → ${cl.case}: hazard does not characterize ${cl.via}`);
  if (!/^(AML\.CS\d+|C\d+)$/.test(cl.case || '')) fail(`CASE_LINKS: case "${cl.case}" is not a well-formed case id`);
  if (typeof cl.why !== 'string' || !cl.why) fail(`CASE_LINKS ${cl.hazard} → ${cl.case}: why is required`);
  if (typeof cl.via !== 'string' || !cl.via) fail(`CASE_LINKS ${cl.hazard} → ${cl.case}: via is required`);
}

/* ---- L4 benchmark runs (plan R3): hazards, domains, limits ----------------- */
{
  const BR = S.BENCHMARK_RUNS || {};
  const limit = BR.limit ?? 1000;
  if (typeof limit !== 'number' || limit < 1) fail(`BENCHMARK_RUNS.limit must be a positive number`);
  for (const pred of BR.agentdojo?.predicates || []) {
    if (!hazardById.has(pred.hazard)) fail(`BENCHMARK_RUNS.agentdojo predicate hazard "${pred.hazard}" does not exist`);
    if (typeof pred.call !== 'string' || !pred.call) fail(`BENCHMARK_RUNS.agentdojo predicate for ${pred.hazard} has no call`);
  }
  for (const r of BR.tau2?.refusals || []) {
    if (!hazardById.has(r.hazard)) fail(`BENCHMARK_RUNS.tau2 refusal hazard "${r.hazard}" does not exist`);
    if (typeof r.text !== 'string' || !r.text) fail(`BENCHMARK_RUNS.tau2 refusal has no text`);
  }
  for (const [suite, s] of Object.entries(BR.agentdojo?.suites || {})) {
    if (!domainIds.has(s.domain)) fail(`BENCHMARK_RUNS.agentdojo suite "${suite}" domain "${s.domain}" is not a domain`);
    if (!Array.isArray(s.injectionTasks) || !s.injectionTasks.length) fail(`BENCHMARK_RUNS.agentdojo suite "${suite}" has no injectionTasks`);
  }
  if (BR.tau2 && !domainIds.has(BR.tau2.domain)) fail(`BENCHMARK_RUNS.tau2 domain "${BR.tau2.domain}" is not a domain`);
  const total = (BR.agentdojo?.expect?.runs ?? 0) + (BR.tau2?.expect?.runs ?? 0);
  if (total > limit) fail(`BENCHMARK_RUNS: ${total} runs exceed the limit ${limit}`);
}

/* ---- label collisions (normalized: lowercase, non-alphanumerics removed) -- */
{
  const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  const silexLabels = [];
  for (const c of S.CORE_L1 || []) silexLabels.push({ group:'CORE_L1', id:c.id, label:c.label });
  for (const as of Object.values(S.DOMAIN_ACTIONS || {})) for (const a of as) silexLabels.push({ group:'DOMAIN_ACTIONS', id:a.id, label:a.label });
  for (const ps of Object.values(S.PROHIBITED || {})) for (const p of ps) silexLabels.push({ group:'PROHIBITED', id:p.id, label:p.label });
  for (const hs of Object.values(S.DOMAIN_HAZARDS || {})) for (const h of hs) silexLabels.push({ group:'DOMAIN_HAZARDS', id:h.id, label:h.label });
  for (const r of S.RECORD_SCHEMAS || []) silexLabels.push({ group:'RECORD_SCHEMAS', id:r.id, label:r.label });

  /* (d) any other label in these exports */
  const byNorm = new Map();
  for (const e of silexLabels) {
    const k = norm(e.label);
    if (!byNorm.has(k)) byNorm.set(k, []);
    byNorm.get(k).push(e);
  }
  for (const [k, list] of byNorm)
    if (list.length > 1)
      fail(`label collision "${k}": ${list.map(e => `${e.group}:${e.id} ("${e.label}")`).join(' and ')}`);

  /* (a) public (non-silex) node labels in the bundle */
  /* a Silex node keeps its own src first; benchmark citations appended by the build (C11) do not make it public */
  const isSilexNode = n => ((n.src || [])[0] || {}).sys === 'silex';
  const publicByNorm = new Map();
  for (const n of publicById.values()) {
    if (isSilexNode(n)) continue;
    const k = norm(n.label);
    if (!publicByNorm.has(k)) publicByNorm.set(k, []);
    publicByNorm.get(k).push(n.id);
  }
  /* (b) agentic component names */
  const componentByNorm = new Map();
  for (const c of S.AGENTIC_COMPONENTS) {
    const k = norm(c.name);
    if (!componentByNorm.has(k)) componentByNorm.set(k, []);
    componentByNorm.get(k).push(`ag:${c.id}`);
  }
  /* (c) entity labels — same label in two packs is one entry and is allowed */
  const entityByNorm = new Set();
  for (const labels of entitiesByDomain.values()) for (const e of labels) entityByNorm.add(norm(e));

  for (const e of silexLabels) {
    const k = norm(e.label);
    if (publicByNorm.has(k))
      fail(`label collision: ${e.group}:${e.id} "${e.label}" reads the same as public node(s) ${publicByNorm.get(k).join(', ')}`);
    if (componentByNorm.has(k))
      fail(`label collision: ${e.group}:${e.id} "${e.label}" reads the same as component(s) ${componentByNorm.get(k).join(', ')}`);
    if (entityByNorm.has(k))
      fail(`label collision: ${e.group}:${e.id} "${e.label}" reads the same as an entity label`);
  }
}

/* ---- report -------------------------------------------------------------- */
const coreKinds = {};
for (const c of S.CORE_L1 || []) coreKinds[c.kind] = (coreKinds[c.kind] || 0) + 1;
const counts = {
  domains: domainIds.size, candidates: candidateIds.size, capabilities: capabilityIds.size, workflows: workflowIds.size,
  components: componentIds.size, runtimeNodes: runtimeIds.size,
  runtimeLinks: S.RUNTIME.links.length, gaps: S.GAPS.length,
  core: (S.CORE_L1 || []).length, actions: actionById.size, hazards: hazardById.size,
  prohibited: prohibitedById.size, records: recordIds.size, counters: countered.size
};
console.log(`\nSeed: ${SEED}`);
console.log('  ' + Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(' · '));
console.log('  core kinds: ' + Object.entries(coreKinds).map(([k, v]) => `${k} ${v}`).join(' · '));
console.log(`  public refs checked against ${publicById.size} bundle nodes`);
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
