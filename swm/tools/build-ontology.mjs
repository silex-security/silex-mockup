#!/usr/bin/env node
/* ============================================================================
   Build the Enterprise World Model data bundle.

     node swm/tools/build-ontology.mjs [--offline] [--out <dir>]

   Fetches four public security ontologies, distils them into a compact graph,
   merges Silex's own L2/L3/L4 seed content and writes:

     swm/data/ontology.json / ontology.js     (graph: nodes + links + meta)
     swm/data/coverage.json / coverage.js     (coverage tree + gaps + KPIs)
     swm/data/SOURCES.md                      (provenance + licences)

   The .js twins assign window globals so the page works over file:// too.
   Raw source data is cached in swm/.cache (git-ignored) and never committed.
   Every input is listed in swm/tools/sources/MANIFEST.json with its pinned URL
   and sha256; a cached or fetched file whose bytes differ is refused.
   ========================================================================== */

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as SEED from './silex-seed.mjs';
import * as SCHEMA from './schema.mjs';

/* domain grounding source modules (swm/tools/sources/CONTRACT.md); each reads pinned raw files */
const SOURCE_MODULES = ['fibo', 'cdm', 'ocsf', 'nist-800-53', 'atlas-mitigations', 'attack-mitigations',
  'atlas-cases', 'attack-campaigns', 'agentdojo', 'tau2', 'banking-kb', 'asb', 'toolemu',
  /* L4 public benchmark runs (plan 2026-10-03 L4, R3) */
  'agentdojo-runs', 'tau2-runs'];
const PARSERS = Object.fromEntries(await Promise.all(SOURCE_MODULES.map(async m =>
  [m, (await import(`./sources/${m}.mjs`)).parse])));

const ROOT   = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE  = join(ROOT, '.cache');
const argOut = process.argv.indexOf('--out');
const OUT    = argOut > 0 ? process.argv[argOut + 1] : join(ROOT, 'data');
const OFFLINE = process.argv.includes('--offline');
const MANIFEST = JSON.parse(await readFile(join(ROOT, 'tools', 'sources', 'MANIFEST.json'), 'utf8')).inputs;
const pinned = name => { const e = MANIFEST.find(m => m.name === name); if (!e) throw new Error(`${name} is not in MANIFEST.json`); return e };

const SOURCES = {
  d3fend: { name:'MITRE D3FEND', url:'https://d3fend.mitre.org/ontologies/d3fend/1.6.0/d3fend.json',
            home:'https://d3fend.mitre.org/', licence:'MITRE D3FEND Terms of Use (free, attribution)' },
  atlas:  { name:'MITRE ATLAS', url:'https://raw.githubusercontent.com/mitre-atlas/atlas-navigator-data/6f66878fc7571c3ae2bb129cfd160568688b4a0c/dist/stix-atlas.json',
            home:'https://atlas.mitre.org/', licence:'Apache-2.0 / MITRE ATLAS Terms of Use' },
  attack: { name:'MITRE ATT&CK Enterprise', url:'https://raw.githubusercontent.com/mitre-attack/attack-stix-data/6cda5ad8462c79e14fbb872f4e09059b18e0cfc4/enterprise-attack/enterprise-attack.json',
            home:'https://attack.mitre.org/', licence:'MITRE ATT&CK Terms of Use (free, attribution)' },
  uco:    { name:'Unified Cyber Ontology (UCO)', url:'https://github.com/ucoProject/UCO/tree/7ebb3957e9e9a2e1bb9c66cd1ede8c912a726344',
            home:'https://unifiedcyberontology.org/', licence:'Apache-2.0' },
  owasp:  { name:'OWASP GenAI Security Project', url:'https://genai.owasp.org/llm-top-10/',
            home:'https://genai.owasp.org/', licence:'CC BY-SA 4.0' },
  /* domain grounding (plan 2026-10-03, E5): every url is a pinned commit; files in MANIFEST.json */
  'atlas-cs':        { name:'MITRE ATLAS case studies (ATLAS 5.6.0)', url:'https://github.com/mitre-atlas/atlas-data/blob/3259f388d19cbcca11bacf12a0ef97f4198f711b/dist/ATLAS.yaml',
                       home:'https://atlas.mitre.org/studies', licence:'Apache-2.0' },
  'attack-campaign': { name:'MITRE ATT&CK campaigns and mitigations (Enterprise 19.2)', url:'https://github.com/mitre-attack/attack-stix-data/tree/6cda5ad8462c79e14fbb872f4e09059b18e0cfc4',
                       home:'https://attack.mitre.org/campaigns/', licence:'MITRE ATT&CK Terms of Use (free, attribution)' },
  fibo:              { name:'EDM Council FIBO', url:'https://github.com/edmcouncil/fibo/tree/9a7b90ccc64e',
                       home:'https://spec.edmcouncil.org/fibo/', licence:'MIT' },
  cdm:               { name:'Microsoft Common Data Model', url:'https://github.com/microsoft/CDM/tree/dd21d715e05e',
                       home:'https://github.com/microsoft/CDM', licence:'CC-BY-4.0 (extracted and truncated)' },
  ocsf:              { name:'Open Cybersecurity Schema Framework 1.9.0', url:'https://github.com/ocsf/ocsf-schema/tree/1.9.0',
                       home:'https://schema.ocsf.io/', licence:'Apache-2.0 (with NOTICE)' },
  'nist-800-53':     { name:'NIST SP 800-53 Rev. 5 (OSCAL catalog 5.2.0)', url:'https://github.com/usnistgov/oscal-content/tree/78650f02ad93',
                       home:'https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final', licence:'US public domain + CC0 1.0' },
  agentdojo:         { name:'AgentDojo (banking, slack, workspace)', url:'https://github.com/ethz-spylab/agentdojo/tree/089ed468cf3e',
                       home:'https://agentdojo.spylab.ai/', licence:'MIT' },
  tau2:              { name:'τ²-bench (retail, banking_knowledge)', url:'https://github.com/sierra-research/tau2-bench/tree/5bfa7e37b366',
                       home:'https://github.com/sierra-research/tau2-bench', licence:'MIT' },
  asb:               { name:'Agent Security Bench (ASB)', url:'https://github.com/agiresearch/ASB/tree/544540ff0788',
                       home:'https://github.com/agiresearch/ASB', licence:'MIT' },
  toolemu:           { name:'ToolEmu', url:'https://github.com/ryoungj/ToolEmu/tree/ac4a7ab7ed8c',
                       home:'https://toolemu.com/', licence:'Apache-2.0' }
};
const UCO_MODULES = ['core','action','identity','observable','tool','pattern'];

/* ---- helpers ------------------------------------------------------------- */
const log = (...a) => console.log(...a);
async function exists(p){ try { await stat(p); return true } catch { return false } }

/* every input comes from MANIFEST.json by name; its bytes must match the pinned sha256 */
const sha256 = buf => createHash('sha256').update(buf).digest('hex');
async function grab(name){
  const entry = pinned(name), file = join(CACHE, name);
  let buf;
  if (await exists(file)) buf = await readFile(file);
  else {
    if (OFFLINE) throw new Error(`--offline but ${name} is not cached`);
    log(`  fetch  ${entry.url}`);
    const res = await fetch(entry.url);
    if (!res.ok) throw new Error(`${entry.url} -> HTTP ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
    if (sha256(buf) !== entry.sha256) throw new Error(`${name}: fetched bytes do not match MANIFEST.json sha256`);
    await mkdir(CACHE,{recursive:true});
    await writeFile(file, buf);
  }
  if (sha256(buf) !== entry.sha256) throw new Error(`${name}: cached bytes do not match MANIFEST.json sha256 (pin ${entry.pin})`);
  /* C21: binary inputs (the AgentDojo archive) stay bytes; the hash above covers the compressed bytes */
  return entry.binary ? buf : buf.toString('utf8');
}

/* deterministic hash so rebuilds are byte-stable */
function hash(str){ let h = 0x811c9dc5; for (let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) } return (h>>>0)/0xffffffff }
const pick = (id, lo, hi) => +(lo + hash(id)*(hi-lo)).toFixed(3);
const groupFor = (text, fallback='resource') => (SEED.GROUP_HINTS.find(([,re]) => re.test(text)) || [fallback])[0];
const clean = s => String(s||'').replace(/\s+/g,' ').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').trim();
const trim  = (s,n=210) => { s = clean(s); return s.length>n ? s.slice(0,n-1).replace(/[\s,;:.]+\S*$/,'')+'…' : s };

/* ---- parsers ------------------------------------------------------------- */
function parseD3fend(raw, { artifactCap=170, techniqueCap=54 }){
  const graph = JSON.parse(raw)['@graph'];
  const byId = new Map();
  for (const n of graph){
    const id = n['@id'];
    if (typeof id !== 'string' || !id.startsWith('d3f:')) continue;
    const types = [].concat(n['@type']||[]);
    if (!types.includes('owl:Class')) continue;
    const parents = [].concat(n['rdfs:subClassOf']||[])
      .map(p => typeof p === 'string' ? p : p && p['@id'])
      .filter(p => typeof p === 'string' && p.startsWith('d3f:'));
    byId.set(id, { id, label: clean(n['rdfs:label']) || id.slice(4).replace(/([a-z])([A-Z])/g,'$1 $2'),
      def: trim(n['d3f:definition']), parents, d3id: n['d3f:d3fend-id'] || null });
  }
  const kids = new Map();
  for (const n of byId.values()) for (const p of n.parents){ if (!kids.has(p)) kids.set(p,[]); kids.get(p).push(n) }

  /* breadth-first walk of a subtree, preferring documented classes, capped */
  function subtree(rootId, cap, maxDepth){
    const out = [], seen = new Set([rootId]);
    let frontier = [[rootId, 0]];
    const root = byId.get(rootId);
    if (root) out.push({ ...root, depth:0 });
    while (frontier.length && out.length < cap){
      const next = [];
      for (const [id, d] of frontier){
        if (d >= maxDepth) continue;
        const children = (kids.get(id)||[]).slice()
          .sort((a,b) => (b.def?1:0)-(a.def?1:0) || (kids.get(b.id)?.length||0)-(kids.get(a.id)?.length||0) || a.label.localeCompare(b.label));
        for (const c of children.slice(0, d === 0 ? 12 : 6)){
          if (seen.has(c.id) || out.length >= cap) continue;
          seen.add(c.id); out.push({ ...c, depth:d+1, parent:id }); next.push([c.id, d+1]);
        }
      }
      frontier = next;
    }
    return out;
  }

  const artifacts  = subtree('d3f:DigitalArtifact', artifactCap, 4);
  const techniques = subtree('d3f:DefensiveTechnique', techniqueCap, 3)
    .filter(n => n.id === 'd3f:DefensiveTechnique' || n.d3id || n.depth <= 2);
  return { artifacts, techniques };
}

function parseStix(raw, { system, tacticSrc, techniqueFilter, cap }){
  const objs = JSON.parse(raw).objects || [];
  const ref = o => (o.external_references||[]).find(r => r.source_name === tacticSrc) || {};
  const tactics = objs.filter(o => o.type === 'x-mitre-tactic' && !o.revoked && !o.x_mitre_deprecated)
    .map(o => ({ id: ref(o).external_id, shortname: o.x_mitre_shortname, label: o.name, def: trim(o.description), url: ref(o).url }))
    .filter(t => t.id);
  let techniques = objs.filter(o => o.type === 'attack-pattern' && !o.revoked && !o.x_mitre_deprecated)
    .map(o => ({ id: ref(o).external_id, label: o.name, def: trim(o.description), url: ref(o).url,
                 sub: !!o.x_mitre_is_subtechnique,
                 phases: (o.kill_chain_phases||[]).map(p => p.phase_name) }))
    .filter(t => t.id);
  if (techniqueFilter) techniques = techniques.filter(techniqueFilter);
  techniques.sort((a,b) => a.id.localeCompare(b.id, undefined, { numeric:true }));
  if (cap) techniques = techniques.slice(0, cap);
  return { system, tactics, techniques };
}

function parseUco(modules, cap = 56){
  const out = [];
  for (const [mod, text] of modules){
    for (const chunk of text.split(/\n(?=[a-z][\w-]*:[A-Za-z])/)){
      if (!/\ba\s*[\s\S]{0,40}owl:Class/.test(chunk)) continue;
      const subject = (chunk.match(/^([a-z][\w-]*:[A-Za-z][\w-]*)\s*$/m)||[])[1];
      if (!subject) continue;
      const label = (chunk.match(/rdfs:label\s+"([^"]+)"/)||[])[1] || subject.split(':')[1];
      const def = (chunk.match(/rdfs:comment\s+"((?:[^"\\]|\\.)*)"/)||[])[1] || '';
      const parents = [...chunk.matchAll(/rdfs:subClassOf\s+([a-z][\w-]*:[A-Za-z][\w-]*)/g)].map(m => m[1]);
      out.push({ id: subject, module: mod, label: clean(label).replace(/([a-z])([A-Z])/g,'$1 $2'),
                 def: trim(def.replace(/\\"/g,'"')), parents: [...new Set(parents)].filter(x => x !== subject) });
    }
  }
  const seen = new Set();
  const prio = m => ['core','identity','action','tool','pattern','observable'].indexOf(m);
  return out.filter(n => !seen.has(n.id) && seen.add(n.id))
            .sort((a,b) => prio(a.module)-prio(b.module) || (b.def?1:0)-(a.def?1:0) || a.label.localeCompare(b.label))
            .slice(0, cap);
}

/* ---- assembly ------------------------------------------------------------ */
/* Layers are presentation groups, not taxonomic ranks (plan 2026-10-02). Every node
   keeps one display `parent` for the Hierarchy view, reached by a `parentPred` from
   SCHEMA.TREE_PREDS; only SUBCLASS_OF asserts subsumption. Every node and link
   carries a `review` grade, and every link must fit SCHEMA.PRED_SIGNATURES. */
function assemble({ d3fend, atlas, attack, uco, grounding }){
  const nodes = [], links = [], index = new Map(), seenLink = new Set(), problems = [];
  const add = n => { if (index.has(n.id)) return index.get(n.id); index.set(n.id, n); nodes.push(n); return n };
  const link = (s, t, pred, src, review) => {
    if (!index.has(s) || !index.has(t) || s === t) { problems.push(`${pred}: ${s} → ${t} does not resolve`); return }
    const key = `${s}|${t}|${pred}`;
    if (seenLink.has(key)) return;
    seenLink.add(key); links.push({ s, t, pred, src, review });
  };
  const setParent = (child, parent, pred, src, review) => {
    link(child, parent, pred, src, review);
    const c = index.get(child);
    if (c && index.has(parent) && !c.parent) { c.parent = parent; c.parentPred = pred }
  };
  const SILEX = (id, label) => [{ sys:'silex', id, label }];

  /* seed references are bare Silex ids; resolve them against the namespaces a field may point into */
  const resolve = (ref, spaces, where) => {
    if (index.has(ref)) return ref;
    for (const ns of spaces) if (index.has(`${ns}${ref}`)) return `${ns}${ref}`;
    problems.push(`${where}: "${ref}" does not resolve (tried ${spaces.join(', ') || 'bundle ids'})`);
    return null;
  };
  const entitySlug = (domain, label) => `ent:${domain}:${label.replace(/\W+/g,'-').toLowerCase()}`;

  /* --- L1 group anchors (Silex's eight semantic groups) ------------------- */
  for (const g of SEED.GROUPS)
    add({ id:`grp:${g.id}`, label:g.name, group:g.id, layer:1, kind:'group', def:g.blurb, review:'curated',
          src:SILEX('SILEX-L1', 'Silex L1 anchor'), instances:0, coverage:null, anchor:true, parent:null });

  /* --- L1 from UCO -------------------------------------------------------- */
  for (const n of uco){
    const group = groupFor(`${n.label} ${n.def} ${n.module}`, 'resource');
    add({ id:`uco:${n.id}`, label:n.label, group, layer:1, kind:'class', def:n.def || `UCO ${n.module} class.`, review:'published',
          src:[{ sys:'uco', id:n.id, label:`UCO ${n.module}`, url:`https://ontology.unifiedcyberontology.org/uco/${n.module}/${n.id.split(':')[1]}` }],
          instances:Math.round(pick(n.id,0,900)), coverage:pick(n.id,.55,.97) });
  }
  for (const n of uco){
    const id = `uco:${n.id}`;
    const parent = n.parents.map(p => `uco:${p}`).find(p => index.has(p));
    if (parent) setParent(id, parent, 'SUBCLASS_OF', 'uco', 'published');
    else setParent(id, `grp:${index.get(id).group}`, 'GROUPED_UNDER', 'silex', 'curated');
  }

  /* --- L1 from D3FEND digital artifacts (the deep inheritance tree) ------- */
  for (const n of d3fend.artifacts){
    const group = groupFor(`${n.label} ${n.def}`, 'resource');
    add({ id:`d3f:${n.id}`, label:n.label, group, layer:1, kind:'class', def:n.def || 'D3FEND digital artifact.', review:'published',
          src:[{ sys:'d3fend', id:n.d3id || n.id.slice(4), label:'D3FEND artifact', url:`https://d3fend.mitre.org/dao/artifact/${n.id.replace(':','/')}/` }],
          instances:Math.round(pick(n.id,0,1400)), coverage:pick(n.id,.5,.96), depth:n.depth });
  }
  for (const n of d3fend.artifacts){
    const id = `d3f:${n.id}`;
    if (n.parent && index.has(`d3f:${n.parent}`)) setParent(id, `d3f:${n.parent}`, 'SUBCLASS_OF', 'd3fend', 'published');
    else setParent(id, `grp:${index.get(id).group}`, 'GROUPED_UNDER', 'silex', 'curated');
  }

  /* --- L1 defensive techniques (policy & control semantics) --------------- */
  for (const n of d3fend.techniques){
    add({ id:`d3f:${n.id}`, label:n.label, group:'policy', layer:1, kind:'countermeasure', review:'published',
          def:n.def || 'D3FEND defensive technique.',
          src:[{ sys:'d3fend', id:n.d3id || n.id.slice(4), label:'D3FEND technique', url:`https://d3fend.mitre.org/technique/${n.id.replace(':','/')}/` }],
          instances:Math.round(pick(n.id,0,140)), coverage:pick(n.id,.45,.95), depth:n.depth });
  }
  for (const n of d3fend.techniques){
    if (n.parent && index.has(`d3f:${n.parent}`)) setParent(`d3f:${n.id}`, `d3f:${n.parent}`, 'SUBCLASS_OF', 'd3fend', 'published');
    else setParent(`d3f:${n.id}`, 'grp:policy', 'GROUPED_UNDER', 'silex', 'curated');
  }

  /* --- L1 threat semantics: ATT&CK enterprise + ATLAS AI tactics ---------- */
  for (const t of attack.tactics){
    /* Impact is about what the business loses, so it anchors the outcome group */
    const group = /^impact$/i.test(t.label) ? 'outcome' : 'threat';
    add({ id:`attack:${t.id}`, label:t.label, group, layer:1, kind:'tactic', def:t.def, review:'published',
          src:[{ sys:'attack', id:t.id, label:'ATT&CK tactic', url:t.url }],
          instances:Math.round(pick(t.id,0,60)), coverage:pick(t.id,.6,.95) });
    setParent(`attack:${t.id}`, `grp:${group}`, 'GROUPED_UNDER', 'silex', 'curated');
  }
  for (const t of attack.techniques){
    add({ id:`attack:${t.id}`, label:t.label, group:'threat', layer:1, kind:'technique', def:t.def, review:'published',
          src:[{ sys:'attack', id:t.id, label:'ATT&CK technique', url:t.url }],
          instances:Math.round(pick(t.id,0,40)), coverage:pick(t.id,.4,.93) });
    const tac = attack.tactics.find(x => t.phases.includes(x.shortname));
    if (tac) setParent(`attack:${t.id}`, `attack:${tac.id}`, 'ACHIEVES', 'attack', 'published');
    else setParent(`attack:${t.id}`, 'grp:threat', 'GROUPED_UNDER', 'silex', 'curated');
  }
  for (const t of atlas.tactics){
    add({ id:`atlas:${t.id}`, label:t.label, group:'threat', layer:1, kind:'tactic', def:t.def, review:'published',
          src:[{ sys:'atlas', id:t.id, label:'ATLAS tactic', url:t.url }],
          instances:Math.round(pick(t.id,0,22)), coverage:pick(t.id,.5,.9) });
    setParent(`atlas:${t.id}`, 'grp:threat', 'GROUPED_UNDER', 'silex', 'curated');
  }

  /* --- L1 Silex core concepts (curated) ----------------------------------- */
  for (const c of SEED.CORE_L1)
    add({ id:`core:${c.id}`, label:c.label, group:c.group, layer:1, kind:c.kind, def:c.def, review:'curated',
          src:SILEX(c.id, 'Silex core concept'), instances:0, coverage:null });
  for (const c of SEED.CORE_L1){
    const id = `core:${c.id}`;
    if (String(c.parent).startsWith('grp:')) setParent(id, c.parent, 'GROUPED_UNDER', 'silex', 'curated');
    else { const p = resolve(c.parent, ['core:'], `CORE_L1 ${c.id}.parent`); if (p) setParent(id, p, 'SUBCLASS_OF', 'silex', 'curated') }
  }

  /* --- L2 domain packs: anchors of their own (membership is not subsumption) */
  const packs = [...SEED.DOMAINS.map(d => ({ ...d, candidate:false })),
                 ...SEED.CANDIDATE_DOMAINS.map(d => ({ ...d, candidate:true }))];
  const prohibitedLabels = new Set(Object.values(SEED.PROHIBITED).flat().map(p => p.label));
  for (const d of packs){
    add({ id:`dom:${d.id}`, label:d.name, group:'workflow', layer:2, kind:'domain', review:'curated',
          def: d.candidate ? `Candidate domain pack · ${d.pack} · ${d.owner}. Ontology only; not part of the coverage figures.` : `${d.pack} · ${d.owner}`,
          src:SILEX(d.pack, d.candidate ? 'Silex candidate domain pack' : 'Silex domain pack'),
          instances: d.candidate ? 0 : d.workflows, coverage: d.candidate ? null : d.coverage, dims: d.candidate ? undefined : d.dims,
          candidate: d.candidate || undefined, anchor:true, parent:null });
    for (const c of d.capabilities){
      add({ id:`cap:${c.id}`, label:c.name, group:'workflow', layer:2, kind:'capability', review:'curated',
            def: d.candidate ? `${d.name} capability (candidate pack)` : `${d.name} capability · ${c.entities.toLocaleString()} runtime entities`,
            src:SILEX(c.id, 'Silex capability'), instances: d.candidate ? 0 : c.entities,
            coverage: d.candidate ? null : c.coverage, dims: d.candidate ? undefined : c.dims });
      setParent(`cap:${c.id}`, `dom:${d.id}`, 'PART_OF', 'silex', 'curated');
      for (const w of c.workflows){
        add({ id:`wf:${w.id}`, label:`${w.id} ${w.name}`, group:'workflow', layer:2, kind:'workflow', review:'illustrative',
              def:`Registered workflow in ${d.name} · ${c.name}`,
              src:SILEX(w.id, 'Silex workflow'), instances: d.candidate ? 0 : w.entities, coverage: d.candidate ? null : w.coverage });
        setParent(`wf:${w.id}`, `cap:${c.id}`, 'PART_OF', 'silex', 'illustrative');
      }
    }
    for (const e of d.entities){
      if (prohibitedLabels.has(e)) continue;   // retyped as a prohibited effect or state below
      const id = entitySlug(d.id, e), group = groupFor(e, 'resource');
      add({ id, label:e, group, layer:2, kind:'entity', def:`${d.name} domain entity type.`, review:'curated',
            src:SILEX(d.pack, d.candidate ? 'Silex candidate domain pack' : 'Silex domain pack'),
            instances: d.candidate ? 0 : Math.round(pick(id,120,4200)),
            coverage: d.candidate ? null : pick(id, d.coverage-.18, Math.min(.99,d.coverage+.1)) });
      setParent(id, `dom:${d.id}`, 'PART_OF_DOMAIN', 'silex', 'curated');
      const isa = (SEED.ENTITY_ISA[d.id] || {})[e];
      if (isa) { const p = resolve(isa, ['core:'], `ENTITY_ISA ${d.id}/${e}`); if (p) link(id, p, 'SUBCLASS_OF', 'silex', 'curated') }
      else problems.push(`ENTITY_ISA ${d.id}/${e}: missing`);
      link(id, `grp:${group}`, 'GROUPED_UNDER', 'silex', 'curated');
    }
    for (const p of SEED.PROHIBITED[d.id] || []){
      add({ id:`po:${p.id}`, label:p.label, group:'outcome', layer:2, kind:p.kind, prohibited:true, def:p.def, review:'curated',
            src:SILEX(p.id, 'Silex prohibited outcome'), instances:0, coverage:null });
      setParent(`po:${p.id}`, `dom:${d.id}`, 'PART_OF_DOMAIN', 'silex', 'curated');
    }
    for (const a of SEED.DOMAIN_ACTIONS[d.id] || []){
      add({ id:`act:${a.id}`, label:a.label, group:'tool', layer:2, kind:'action', def:a.def || `${d.name} action.`, review:'curated',
            src:SILEX(a.id, 'Silex domain action'), instances:0, coverage:null, noWorkflow:a.noWorkflow });
      setParent(`act:${a.id}`, `dom:${d.id}`, 'PART_OF_DOMAIN', 'silex', 'curated');
    }
    for (const h of SEED.DOMAIN_HAZARDS[d.id] || []){
      add({ id:`hz:${h.id}`, label:h.label, group:'threat', layer:2, kind:'hazard', def:h.def, review:'curated',
            src:SILEX(h.id, 'Silex domain hazard'), instances:0, coverage:null });
      setParent(`hz:${h.id}`, `dom:${d.id}`, 'PART_OF_DOMAIN', 'silex', 'curated');
    }
  }

  /* --- L3 agentic-system components: a kind of an L1 core class ----------- */
  const runtimeDomains = new Map();
  for (const n of SEED.RUNTIME.nodes){
    if (!n.type || !n.domain) continue;
    if (!runtimeDomains.has(n.type)) runtimeDomains.set(n.type, new Set());
    runtimeDomains.get(n.type).add(n.domain);
  }
  for (const c of SEED.AGENTIC_COMPONENTS){
    const doms = [...(runtimeDomains.get(c.id) || [])].sort();
    add({ id:`ag:${c.id}`, label:c.name, group:c.group, layer:3, kind:'component', def:c.blurb, review:'curated',
          src:SILEX('SILEX-L3', 'Silex agentic ontology'), instances:c.instances, coverage:c.coverage,
          deployment: doms.length ? undefined : 'unobserved' });
    const isa = SEED.COMPONENT_ISA[c.id];
    if (isa) { const p = resolve(isa, ['core:'], `COMPONENT_ISA ${c.id}`); if (p) setParent(`ag:${c.id}`, p, 'SUBCLASS_OF', 'silex', 'curated') }
    else problems.push(`COMPONENT_ISA ${c.id}: missing`);
    /* deployment is claimed only where the (illustrative) runtime graph shows an instance */
    doms.forEach(dm => link(`ag:${c.id}`, `dom:${dm}`, 'DEPLOYED_IN', 'silex', 'illustrative'));
  }

  /* --- L3 telemetry record schemas, part of Trace & Telemetry -------------- */
  for (const r of SEED.RECORD_SCHEMAS){
    add({ id:`rec:${r.id}`, label:r.label, group:'workflow', layer:3, kind:'record', def:r.def, review:'curated',
          src:SILEX(r.id, 'Silex record schema'), instances:0, coverage:null });
    setParent(`rec:${r.id}`, 'ag:trace', 'PART_OF', 'silex', 'curated');
  }

  /* --- L3 threat overlay: ATLAS techniques + OWASP catalogues ------------- */
  for (const t of atlas.techniques){
    add({ id:`atlas:${t.id}`, label:t.label, group:'threat', layer:3, kind:'technique', def:t.def, review:'published',
          src:[{ sys:'atlas', id:t.id, label:'ATLAS technique', url:t.url }],
          instances:Math.round(pick(t.id,0,14)), coverage:pick(t.id,.35,.88) });
    const tac = atlas.tactics.find(x => t.phases.includes(x.shortname));
    if (tac) setParent(`atlas:${t.id}`, `atlas:${tac.id}`, 'ACHIEVES', 'atlas', 'published');
    else setParent(`atlas:${t.id}`, 'grp:threat', 'GROUPED_UNDER', 'silex', 'curated');
    /* which agentic component this technique lands on — a keyword heuristic, graded as one */
    link(`atlas:${t.id}`, `ag:${mapThreatToComponent(`${t.label} ${t.def}`)}`, 'THREATENS', 'silex', 'heuristic');
  }
  for (const [id, label, target] of SEED.OWASP_LLM){
    add({ id:`owasp:${id}`, label, group:'threat', layer:3, kind:'risk', def:`OWASP Top 10 for LLM Applications 2025 · ${id}`, review:'published',
          src:[{ sys:'owasp', id, label:'OWASP LLM Top 10 (2025)', url:'https://genai.owasp.org/llm-top-10/' }],
          instances:Math.round(pick(id,1,26)), coverage:pick(id,.45,.92) });
    setParent(`owasp:${id}`, 'grp:threat', 'GROUPED_UNDER', 'silex', 'curated');
    link(`owasp:${id}`, `ag:${target}`, 'THREATENS', 'silex', 'curated');
  }
  for (const [id, label, target] of SEED.OWASP_AGENTIC){
    add({ id:`owaspa:${id}`, label, group:'threat', layer:3, kind:'risk', def:`OWASP Agentic AI — Threats and Mitigations · ${id}`, review:'published',
          src:[{ sys:'owasp', id:`Agentic ${id}`, label:'OWASP Agentic AI threats', url:'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/' }],
          instances:Math.round(pick(id+label,1,19)), coverage:pick(id+label,.4,.9) });
    setParent(`owaspa:${id}`, 'grp:threat', 'GROUPED_UNDER', 'silex', 'curated');
    link(`owaspa:${id}`, `ag:${target}`, 'THREATENS', 'silex', 'curated');
  }

  /* --- domain grounding: public classes, controls, mitigations and cases -- */
  /* Modules see the bundle as it stands here (all L1–L3 public threat nodes exist), so the
     endpoint rule (plan B4) can link only exact ids that are present. */
  const inBundle = new Set(index.keys());
  const sourceRefs = {}, omitted = [];
  const emitted = [];
  for (const name of SOURCE_MODULES){
    const out = grounding(name, inBundle);
    for (const n of out.nodes || []){ const { parentLink, ...node } = n; add(node); emitted.push([node.id, parentLink, name]) }
    for (const [k, v] of Object.entries(out.sources || {})){
      if (sourceRefs[k]) problems.push(`source key ${k} is emitted by two modules`);
      sourceRefs[k] = v;
    }
    omitted.push(...(out.omitted || []).map(o => ({ module:name, ...o })));
    emitted.push(...(out.links || []).map(l => [null, l, name]));
  }
  for (const [id, pl, name] of emitted){
    if (!pl) { problems.push(`${name}: ${id} has no parentLink`); continue }
    if (id) setParent(id, pl.t, pl.pred, pl.src, pl.review);
    else link(pl.s, pl.t, pl.pred, pl.src, pl.review);
  }

  /* --- L4 runtime graph, instantiating the agentic layer ------------------ */
  for (const n of SEED.RUNTIME.nodes){
    add({ id:n.id, label:n.name, group:n.group, layer:4, kind:n.type, def:n.blurb, domain:n.domain, review:'illustrative',
          severity:n.severity, outcome:n.outcome,
          src:SILEX('RUNTIME', 'Silex runtime graph'), instances:1, coverage:n.coverage });
  }
  for (const n of SEED.RUNTIME.nodes){
    if (n.parent && index.has(n.parent)) setParent(n.id, n.parent, 'OCCURRED_IN', 'silex', 'illustrative');
    else if (index.has(`ag:${n.type}`)) setParent(n.id, `ag:${n.type}`, 'INSTANCE_OF', 'silex', 'illustrative');
    if (n.domain && index.has(`dom:${n.domain}`)) link(n.id, `dom:${n.domain}`, 'BELONGS_TO', 'silex', 'illustrative');
    if (/^rt-wf-(\d+)$/.test(n.id)){
      const wf = `wf:WF-${n.id.slice(6)}`;
      if (index.has(wf)) link(n.id, wf, 'REALISES', 'silex', 'illustrative');
    }
  }
  for (const [s,t,pred] of SEED.RUNTIME.links) link(s, t, pred, 'silex', 'illustrative');

  /* --- action, hazard and evidence chain (all nodes exist by now) ---------- */
  const hazardRoot = SEED.CORE_L1.find(c => c.kind === 'hazard');
  for (const d of packs){
    const ent = r => index.has(r) ? r : (index.has(entitySlug(d.id, r)) ? entitySlug(d.id, r) : null);
    for (const p of SEED.PROHIBITED[d.id] || []){
      const isa = resolve(p.isA, ['core:'], `PROHIBITED ${p.id}.isA`); if (isa) link(`po:${p.id}`, isa, 'SUBCLASS_OF', 'silex', 'curated');
    }
    for (const a of SEED.DOMAIN_ACTIONS[d.id] || []){
      const id = `act:${a.id}`;
      const isa = resolve(a.isA, ['core:'], `DOMAIN_ACTIONS ${a.id}.isA`); if (isa) link(id, isa, 'SUBCLASS_OF', 'silex', 'curated');
      for (const e of a.mayCause || []) { const t = resolve(e, ['core:'], `DOMAIN_ACTIONS ${a.id}.mayCause`); if (t) link(id, t, 'MAY_CAUSE', 'silex', 'curated') }
      for (const w of a.workflows || []) { const t = resolve(w, ['wf:'], `DOMAIN_ACTIONS ${a.id}.workflows`); if (t) link(id, t, 'USED_IN', 'silex', 'curated') }
      for (const r of a.implementedBy || []) { const t = resolve(r, [], `DOMAIN_ACTIONS ${a.id}.implementedBy`); if (t) link(t, id, 'IMPLEMENTS', 'silex', 'illustrative') }
      link(id, 'grp:tool', 'GROUPED_UNDER', 'silex', 'curated');
    }
    for (const h of SEED.DOMAIN_HAZARDS[d.id] || []){
      const id = `hz:${h.id}`;
      if (hazardRoot) link(id, `core:${hazardRoot.id}`, 'SUBCLASS_OF', 'silex', 'curated');
      for (const r of h.hazardFor || []){
        const t = index.has(`act:${r}`) ? `act:${r}` : ent(r);
        if (t) link(id, t, 'HAZARD_FOR', 'silex', 'curated'); else problems.push(`DOMAIN_HAZARDS ${h.id}.hazardFor: "${r}" does not resolve`);
      }
      for (const r of h.mayLeadTo || []) { const t = resolve(r, ['po:'], `DOMAIN_HAZARDS ${h.id}.mayLeadTo`); if (t) link(id, t, 'MAY_LEAD_TO', 'silex', 'curated') }
      for (const r of h.characterizes || []) { const t = resolve(r, [], `DOMAIN_HAZARDS ${h.id}.characterizes`); if (t) link(id, t, 'CHARACTERIZES', 'silex', 'curated') }
      for (const r of h.mitigatedBy || []) { const t = resolve(r, ['core:'], `DOMAIN_HAZARDS ${h.id}.mitigatedBy`); if (t) link(id, t, 'MITIGATED_BY', 'silex', 'curated') }
      for (const r of h.requiresEvidence || []) { const t = resolve(r, ['core:'], `DOMAIN_HAZARDS ${h.id}.requiresEvidence`); if (t) link(id, t, 'REQUIRES_EVIDENCE', 'silex', 'curated') }
    }
  }
  for (const c of SEED.CORE_L1)
    for (const r of c.relatedMatch || []) { const t = resolve(r, [], `CORE_L1 ${c.id}.relatedMatch`); if (t) link(`core:${c.id}`, t, 'RELATED_MATCH', 'silex', 'curated') }
  for (const r of SEED.RECORD_SCHEMAS)
    for (const e of r.records || []) { const s = resolve(e, ['core:'], `RECORD_SCHEMAS ${r.id}.records`); if (s) link(s, `rec:${r.id}`, 'RECORDED_BY', 'silex', 'curated') }
  for (const m of SEED.COUNTER_MAP){
    const th = resolve(m.threat, [], `COUNTER_MAP threat`), ct = resolve(m.control, ['core:'], `COUNTER_MAP ${m.threat}.control`);
    if (th && ct) link(ct, th, 'COUNTERS', 'silex', 'curated');
  }
  for (const m of SEED.INCIDENT_HAZARDS){
    const h = resolve(m.hazard, ['hz:'], `INCIDENT_HAZARDS ${m.incident}`);
    if (h) link(m.incident, h, 'EXHIBITS', 'silex', 'illustrative');
  }

  /* --- domain grounding: alignment, case links and public sources (T0 lists) */
  for (const [dom, rows] of Object.entries(SEED.DOMAIN_ALIGNMENT)){
    for (const r of rows){
      const id = entitySlug(dom, r.entity);
      if (!index.has(id)) { problems.push(`DOMAIN_ALIGNMENT ${dom}/${r.entity}: no such entity`); continue }
      if (r.unmatched) { index.get(id).unmatched = r.unmatched; continue }
      for (const c of r.match) link(id, c, 'CLOSE_MATCH', 'silex', 'curated');
      index.get(id).alignment = r.why;
    }
  }
  for (const r of SEED.RECORD_ALIGNMENT){
    for (const c of r.match) link(`rec:${r.record}`, c, 'CLOSE_MATCH', 'silex', 'curated');
    if (index.has(`rec:${r.record}`)) index.get(`rec:${r.record}`).alignment = r.why;
  }
  /* EXEMPLIFIED_BY only for reviewed pairs that share a technique both sides assert (plan A4) */
  for (const c of SEED.CASE_LINKS){
    const h = `hz:${c.hazard}`, k = `case:${c.case}`;
    const shares = links.some(l => l.s === h && l.t === c.via && l.pred === 'CHARACTERIZES') &&
                   links.some(l => l.s === k && l.t === c.via && l.pred === 'DEMONSTRATES');
    if (!shares) { problems.push(`CASE_LINKS ${c.hazard} → ${c.case}: no shared technique ${c.via}`); continue }
    link(h, k, 'EXEMPLIFIED_BY', 'silex', 'curated');
    (index.get(h).caseWhy ||= {})[k] = c.why;
  }
  /* public sources join the src list of the Silex hazard or action they support (C11) */
  const enrich = (id, key, rel) => {
    const s = sourceRefs[key];
    if (!index.has(id)) { problems.push(`enrich: ${id} does not exist`); return }
    if (!s) { problems.push(`enrich ${id}: source key ${key} was not emitted by any module`); return }
    index.get(id).src.push(rel ? { ...s, rel } : { ...s });
  };
  for (const [h, rows] of Object.entries(SEED.BENCHMARK_HAZARDS)) for (const r of rows) enrich(`hz:${h}`, r.key, r.rel);
  for (const [a, keys] of Object.entries(SEED.BENCHMARK_ACTIONS)) for (const k of keys) enrich(`act:${a}`, k, 'derived');

  /* --- contract checks ---------------------------------------------------- */
  const kindOf = id => index.get(id).kind;
  for (const n of nodes){
    if (!SCHEMA.KINDS.includes(n.kind)) problems.push(`${n.id}: kind "${n.kind}" is not in the contract`);
    if (!SCHEMA.REVIEW.includes(n.review)) problems.push(`${n.id}: review "${n.review}" is not a grade`);
    if (n.anchor) continue;
    if (!n.parent) { problems.push(`${n.id} (L${n.layer}) has no display parent`); continue }
    if (!SCHEMA.TREE_PREDS.includes(n.parentPred)) problems.push(`${n.id}: parentPred ${n.parentPred} is not a tree predicate`);
    if (index.get(n.parent).layer > n.layer) problems.push(`${n.id} (L${n.layer}) hangs under ${n.parent} (L${index.get(n.parent).layer}), a lower layer`);
  }
  for (const l of links){
    const sig = SCHEMA.PRED_SIGNATURES[l.pred];
    if (!sig) { problems.push(`${l.pred} is not in the contract (${l.s} → ${l.t})`); continue }
    if (!sig.pairs.some(([a,b]) => a === kindOf(l.s) && b === kindOf(l.t)))
      problems.push(`${l.pred}: ${l.s} (${kindOf(l.s)}) → ${l.t} (${kindOf(l.t)}) breaks its signature`);
    if (!sig.review.includes(l.review)) problems.push(`${l.pred}: review "${l.review}" not allowed (${l.s} → ${l.t})`);
    /* C18: grades beyond illustrative on runtime predicates belong to the benchmark partition only */
    if (SCHEMA.BENCH_ONLY_GRADES[l.pred] === l.review && !SCHEMA.isBenchmark(index.get(l.s)))
      problems.push(`${l.pred}: grade "${l.review}" is reserved for benchmark nodes (${l.s})`);
  }
  for (const n of nodes) if (n.layer === 4){
    if (SCHEMA.isBenchmark(n) ? n.review !== 'published' : n.review !== 'illustrative')
      problems.push(`${n.id}: L4 ${SCHEMA.isBenchmark(n) ? 'benchmark node must be published' : 'node must be illustrative'} (C17)`);
  }
  const cycles = (edges, what) => {
    const out = new Map(); edges.forEach(([a,b]) => { if (!out.has(a)) out.set(a, []); out.get(a).push(b) });
    const state = new Map();
    const visit = v => {
      state.set(v, 1);
      for (const w of out.get(v) || []){
        if (state.get(w) === 1) { problems.push(`${what} cycle through ${v} → ${w}`); continue }
        if (!state.get(w)) visit(w);
      }
      state.set(v, 2);
    };
    [...out.keys()].forEach(v => { if (!state.get(v)) visit(v) });
  };
  cycles(nodes.filter(n => n.parent).map(n => [n.id, n.parent]), 'display-parent');
  cycles(links.filter(l => l.pred === 'SUBCLASS_OF').map(l => [l.s, l.t]), 'SUBCLASS_OF');
  const degree = new Map(); links.forEach(l => { degree.set(l.s, (degree.get(l.s)||0)+1); degree.set(l.t, (degree.get(l.t)||0)+1) });
  nodes.filter(n => !n.anchor && !degree.get(n.id)).forEach(n => problems.push(`${n.id}: orphan, no relation at all`));

  const threats = nodes.filter(SCHEMA.isThreat).map(n => n.id);
  const countered = new Set(links.filter(l => l.pred === 'COUNTERS').map(l => l.t));
  const uncountered = threats.filter(id => !countered.has(id));

  return { nodes, links, problems, uncountered, omitted };
}

/* per-hop summary the Ontology Layers panel draws: node counts, group mix and
   every typed relation between adjacent layers, plus the relations that skip one */
function summariseChain(graph){
  const byId = new Map(graph.nodes.map(n => [n.id, n]));
  const layers = SEED.LAYERS.map(l => {
    const members = graph.nodes.filter(n => n.layer === l.id);
    const groups = {};
    members.forEach(n => { groups[n.group] = (groups[n.group] || 0) + 1; });
    return { id:l.id, key:l.key, name:l.name, blurb:l.blurb, count:members.length, groups,
             coverage:+(members.reduce((s,n) => s + (n.coverage || 0), 0) / (members.filter(n => n.coverage != null).length || 1)).toFixed(3) };
  });
  const hops = [1,2,3].map(from => {
    const to = from + 1;
    const preds = {}, examples = [];
    let count = 0;
    graph.links.forEach(l => {
      const a = byId.get(l.s), b = byId.get(l.t);
      if (!a || !b) return;
      const crosses = (a.layer === to && b.layer === from) || (a.layer === from && b.layer === to);
      if (!crosses) return;
      count++;
      preds[l.pred] = (preds[l.pred] || 0) + 1;
      if (examples.length < 60) {
        const lower = a.layer === from ? a : b, upper = a.layer === from ? b : a;
        examples.push({ pred:l.pred, from:lower.id, fromLabel:lower.label, to:upper.id, toLabel:upper.label });
      }
    });
    return { from, to, count, preds, examples };
  });
  /* relations joining layers that are not adjacent (e.g. an L3 component SUBCLASS_OF an L1 core class) */
  const skips = { count:0, preds:{}, pairs:{} };
  graph.links.forEach(l => {
    const a = byId.get(l.s), b = byId.get(l.t);
    if (!a || !b || Math.abs(a.layer - b.layer) < 2) return;
    skips.count++;
    skips.preds[l.pred] = (skips.preds[l.pred] || 0) + 1;
    const k = `L${Math.min(a.layer,b.layer)}–L${Math.max(a.layer,b.layer)}`;
    skips.pairs[k] = (skips.pairs[k] || 0) + 1;
  });
  return { layers, hops, skips };
}

function mapThreatToComponent(text){
  const t = text.toLowerCase();
  if (/memory|persistence|poison.*data|backdoor/.test(t)) return 'memory-lt';
  if (/rag|retriev|embedding|vector|index|search/.test(t)) return 'retriever';
  if (/prompt|jailbreak|instruct|system prompt/.test(t)) return 'planner';
  if (/tool|api|plugin|function|command|execut|code/.test(t)) return 'tool-reg';
  if (/credential|identity|account|access|privileg|token/.test(t)) return 'cred-store';
  if (/supply chain|model file|artifact|dependen/.test(t)) return 'mcp';
  if (/cost|resource|denial|flood|consum/.test(t)) return 'exec-ctx';
  if (/human|social|phish|manipulat/.test(t)) return 'hitl';
  if (/log|audit|trace|evade|evasion|detect/.test(t)) return 'trace';
  return 'planner';
}

/* ---- coverage bundle ----------------------------------------------------- */
function buildCoverage(graph){
  const weigh = rows => {
    const total = rows.reduce((s,r) => s + r.entities, 0) || 1;
    return +(rows.reduce((s,r) => s + r.coverage * r.entities, 0) / total).toFixed(4);
  };
  const domains = SEED.DOMAINS.map(d => {
    const caps = d.capabilities.map(c => ({
      id:c.id, name:c.name, kind:'capability', coverage:c.coverage, entities:c.entities, dims:c.dims, incidents:c.incidents,
      children: c.workflows.map(w => ({ id:w.id, name:`${w.id} · ${w.name}`, kind:'workflow', coverage:w.coverage,
        entities:w.entities, dims:scaleDims(c.dims, w.coverage - c.coverage), children:[] }))
    }));
    return { id:d.id, name:d.name, code:d.code, kind:'domain', coverage:d.coverage,
             entities: caps.reduce((s,c) => s + c.entities, 0), dims:d.dims, incidents:d.incidents,
             agents:d.agents, workflows:d.workflows, pack:d.pack, owner:d.owner, children:caps };
  });
  const entities = domains.reduce((s,d) => s + d.entities, 0);
  const tree = { id:'enterprise', name:'Enterprise', kind:'enterprise', coverage:weigh(domains), entities,
                 dims:mergeDims(domains), children:domains };
  const kpis = [
    { id:'weighted', label:'Weighted coverage', value:`${Math.round(tree.coverage*100)}%`, note:'Entity-weighted across 5 domain packs', delta:'+4 pts vs last calibration', dir:'up' },
    { id:'entities', label:'Entities understood', value:`${(entities/1000).toFixed(1)}K`, note:'Typed and linked in the runtime graph', delta:`${graph.nodes.filter(n => !SCHEMA.isBenchmark(n)).length} ontology types`, dir:'flat' },
    { id:'blind',    label:'Known blind spots', value:String(SEED.GAPS.length), note:'Open coverage gaps across all domains', delta:`${SEED.GAPS.filter(g=>g.severity==='critical').length} critical`, dir:'down' },
    { id:'calib',    label:'Last calibration', value:'6h ago', note:'Simulation vs observed behaviour agreement 94%', delta:'drift 1.2%', dir:'flat' }
  ];
  return { generated:new Date().toISOString(), dimensions:SEED.DIMENSIONS, tree, gaps:SEED.GAPS, kpis,
           ontologyCompleteness: structuralCompleteness(graph) };
}

/* Structural completeness, not observed coverage: per domain pack, the share of its L2
   hazards whose principle-3 chain is closed (a characterized threat, a mitigating
   control, required evidence, and a record schema for every piece of that evidence). */
function structuralCompleteness(graph){
  const out = (id, pred) => graph.links.filter(l => l.s === id && l.pred === pred).map(l => l.t);
  const domains = {};
  for (const d of graph.nodes.filter(n => n.kind === 'domain')){
    const hazards = graph.nodes.filter(n => n.kind === 'hazard' && n.parent === d.id);
    const complete = hazards.filter(h => out(h.id,'CHARACTERIZES').length && out(h.id,'MITIGATED_BY').length &&
      out(h.id,'REQUIRES_EVIDENCE').length && out(h.id,'REQUIRES_EVIDENCE').every(e => out(e,'RECORDED_BY').length));
    domains[d.id.slice(4)] = { hazards:hazards.length, complete:complete.length,
      share: hazards.length ? +(complete.length / hazards.length).toFixed(3) : null, candidate: !!d.candidate };
  }
  return { label:'Structural completeness', note:'Share of each pack\'s hazards whose threat, control, evidence and record-schema chain is closed in the ontology. Not observed coverage.', domains };
}
const scaleDims = (dims, delta) => Object.fromEntries(Object.entries(dims).map(([k,v]) => [k, +Math.max(.25, Math.min(.99, v + delta)).toFixed(3)]));
function mergeDims(rows){
  const out = {};
  for (const d of SEED.DIMENSIONS){
    const total = rows.reduce((s,r) => s + r.entities, 0) || 1;
    out[d.id] = +(rows.reduce((s,r) => s + (r.dims[d.id]||0) * r.entities, 0) / total).toFixed(3);
  }
  return out;
}

/* ---- writers ------------------------------------------------------------- */
async function writeBundle(name, global, payload){
  await mkdir(OUT,{recursive:true});
  const json = JSON.stringify(payload);
  await writeFile(join(OUT, `${name}.json`), JSON.stringify(payload, null, 1));
  await writeFile(join(OUT, `${name}.js`),
    `/* Generated by swm/tools/build-ontology.mjs — do not edit by hand. */\nwindow.${global} = ${json};\n`);
  return json.length;
}

/* licence and attribution notices for every redistributed extract (plan E5 B4/T6, C4) */
const NOTICE_GROUPS = [
  ['MITRE ATT&CK (techniques, mitigations, campaigns)', ['attack-LICENSE.txt'], 'Copyright © The MITRE Corporation. ATT&CK® is a registered trademark of The MITRE Corporation. This bundle reproduces extracts under the licence below; it is not endorsed by MITRE.'],
  ['MITRE ATLAS (techniques, mitigations)', ['atlas-navigator-LICENSE'], null],
  ['MITRE ATLAS case studies', ['atlas-data-LICENSE'], null],
  ['Unified Cyber Ontology (UCO)', ['uco-LICENSE'], null],
  ['EDM Council FIBO', ['fibo-LICENSE'], null],
  ['Microsoft Common Data Model', ['cdm-LICENSE'], 'Entity names, descriptions and attribute descriptions from the Common Data Model, © Microsoft Corporation, licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Modified: extracted from the pinned schema documents and truncated to 200 characters per description.'],
  ['Open Cybersecurity Schema Framework (OCSF)', ['ocsf-NOTICE', 'ocsf-LICENSE'], 'The OCSF NOTICE file is reproduced verbatim, as Apache-2.0 section 4(d) requires.'],
  ['NIST SP 800-53 Rev. 5 (OSCAL content)', ['nist-LICENSE.md'], 'Control text from NIST SP 800-53 Rev. 5, a work of the US government. NIST does not endorse this product.'],
  ['AgentDojo', ['agentdojo-LICENSE'], null],
  ['τ²-bench', ['tau2-LICENSE'], null],
  ['Agent Security Bench (ASB)', ['asb-LICENSE'], null],
  ['ToolEmu', ['toolemu-LICENSE'], null]
];
async function writeNotices(){
  const parts = [];
  for (const [title, files, note] of NOTICE_GROUPS){
    parts.push(`## ${title}\n`);
    if (note) parts.push(`${note}\n`);
    for (const f of files){
      const e = pinned(f);
      parts.push(`Source: \`${e.url}\`\n\n\`\`\`text\n${(await grab(f)).replace(/^\uFEFF/, '').trimEnd()}\n\`\`\`\n`);
    }
  }
  await writeFile(join(OUT,'NOTICES.md'), `# Enterprise World Model — notices

Generated ${new Date().toISOString().slice(0,10)} by \`swm/tools/build-ontology.mjs\` from the licence files pinned in
\`swm/tools/sources/MANIFEST.json\`. The bundle redistributes extracts (names, definitions, task goals,
policy sentences) from the sources below.

Pre-existing inclusions not changed by the 2026-10-03 grounding work: MITRE D3FEND (D3FEND Terms of Use,
attribution: © The MITRE Corporation) and the OWASP GenAI Security Project lists (CC BY-SA 4.0,
https://genai.owasp.org/, © OWASP Foundation). Their attribution is given here; their share-alike terms
apply to the 25 OWASP risk names and identifiers only.

${parts.join('\n')}`);
}

async function writeSources(stats){
  const rows = Object.entries(SOURCES).map(([k,s]) =>
    `| [${s.name}](${s.home}) | \`${s.url}\` | ${s.licence} | ${stats[k] ?? '—'} |`).join('\n');
  await writeFile(join(OUT,'SOURCES.md'), `# Enterprise World Model — data sources

Generated ${new Date().toISOString().slice(0,10)} by \`swm/tools/build-ontology.mjs\`.
Raw downloads are cached in \`swm/.cache/\` (git-ignored); only the distilled bundles are committed.

| Source | Fetched from | Licence / terms | Nodes kept |
|---|---|---|---|
${rows}

## How the distillation works

- **D3FEND** — the \`d3f:DigitalArtifact\` subclass tree (breadth-first, documented classes first,
  capped) supplies the L1 inheritance backbone; \`d3f:DefensiveTechnique\` supplies policy/control semantics.
- **ATLAS** — the tactics join L1 as general agentic threat semantics; each technique sits at L3,
  attached to the agentic component it targets.
- **ATT&CK Enterprise** — the 14 tactics plus agent-relevant techniques (identity, credential, data,
  API, execution, exfiltration keywords) become L1 threat semantics.
- **UCO** — \`core\`, \`action\`, \`identity\`, \`observable\`, \`tool\` and \`pattern\` modules are parsed for
  \`owl:Class\` declarations with labels and definitions; they seed the L1 upper classes.
- **OWASP** — the LLM Top 10 (2025) and the Agentic AI threat taxonomy (T1–T15) are carried as
  published lists and attached to the agentic components they target.

## Domain grounding (Finance, Customer Service, Identity & IT)

Plan \`logs/2026-10-03_SWM_DOMAIN_GROUNDING_EXEC_PLAN.md\`. Every input below is pinned to a commit or a
versioned URL in \`swm/tools/sources/MANIFEST.json\` with its sha256; the build refuses changed bytes.
Licence texts and attributions are in \`NOTICES.md\`.

- **Domain standards.** Finance entities are **aligned to** FIBO and the Common Data Model, Customer
  Service entities to the Common Data Model, Identity & IT entities to OCSF, with \`CLOSE_MATCH\`
  (skos:closeMatch: similar meaning, no subclass claim). Entities with no equivalent public class are
  listed as unmatched with the reason, not hidden.
- **Benchmarks.** Hazards and actions cite AgentDojo injection tasks, τ²-bench policy rules and
  documents, Agent Security Bench scenarios and ToolEmu cases. Each citation is graded **derived** (the
  source describes the harmful behaviour) or **related** (a neighbouring rule or behaviour; the
  mechanism is Silex-modelled). Benchmarks are research environments, not observed enterprise
  behaviour. ASB scenarios are generated descriptions without an executable check; ToolEmu cases are
  potential failure scenarios for LLM-emulated tools.
- **Public cases.** ATLAS case studies (incidents and exercises, typed as such) and a reviewed set of
  ATT&CK campaigns are L3 \`case\` nodes that \`DEMONSTRATES\` the techniques they used. They are events
  elsewhere: never L4, never counted in coverage. A hazard is \`EXEMPLIFIED_BY\` a case only for a
  reviewed pair with a written rationale.
- **Published mitigations.** ATLAS and ATT&CK mitigations enter as L1 countermeasures with the
  publisher's own \`COUNTERS\` edges, graded published. NIST SP 800-53 controls enter as L1 controls;
  which hazard a control mitigates is a curated mapping, not a compliance claim.
- **Endpoint rule.** A published case or mitigation edge is linked only to a technique id that is in
  the bundle; other references stay on the node as \`refs\`.

## Layers, the display tree and subsumption

L1 general → L2 domain pack → L3 agentic system → L4 runtime instance are **presentation groups, not
taxonomic ranks**. Only \`SUBCLASS_OF\` asserts subsumption. Domain membership is \`PART_OF_DOMAIN\`,
deployment is \`DEPLOYED_IN\` and the eight L1 groups are navigation (\`GROUPED_UNDER\`). Every node
keeps one display \`parent\` (its \`parentPred\` is a tree predicate) for the Hierarchy view. The build
refuses to write a bundle if a link breaks its predicate signature or review grades
(\`swm/tools/schema.mjs\`), if the display tree or the \`SUBCLASS_OF\` graph has a cycle, or if a
display parent sits in a lower layer. \`ontology.json\` ships a \`chain\` summary with per-layer counts,
the relations between adjacent layers and the relations that skip a layer.

## Honesty note

Every node and link carries a \`review\` grade:

- \`published\`: structure from a public source; the node keeps its real identifier.
- \`curated\`: a Silex-authored semantic assertion. This covers the core L1 concepts, domain packs,
  actions, hazards, prohibited outcomes, record schemas, countermeasure mappings and OWASP targets.
- \`heuristic\`: keyword-mapped, i.e. which component an ATLAS technique threatens.
- \`illustrative\`: mock content. This covers registered workflows, the whole L4 runtime graph,
  everything derived from it (deployment, instances, incidents) and every coverage percentage.

CRM and Legal are candidate packs. They are ontology only and not part of the coverage figures.
`);
}

/* ---- main ---------------------------------------------------------------- */
const t0 = Date.now();
log('SILEX Enterprise World Model — building data bundle');

const [d3fendRaw, atlasRaw, attackRaw] = await Promise.all([
  grab('d3fend.json'), grab('atlas-stix.json'), grab('attack-enterprise.json')
]);
/* every UCO module is required (a missing module used to be skipped silently) */
const ucoRaw = [];
for (const m of UCO_MODULES) ucoRaw.push([m, await grab(`uco-${m}.ttl`)]);

const d3fend = parseD3fend(d3fendRaw, { artifactCap:170, techniqueCap:54 });
const atlas  = parseStix(atlasRaw,  { system:'atlas',  tacticSrc:'mitre-atlas', cap:80,
  techniqueFilter: t => !t.sub && t.id.split('.').length <= 2 });
const attack = parseStix(attackRaw, { system:'attack', tacticSrc:'mitre-attack', cap:46,
  techniqueFilter: t => !t.sub && /account|credential|token|identit|api|cloud|data|exfiltrat|command|script|service|permission|valid|session|email|file|repositor|automat/i.test(`${t.label} ${t.def}`) });
const uco    = parseUco(ucoRaw, 72);
/* D13: ATT&CK techniques missing only because the import keeps the first 46 filtered ids */
{
  const have = new Set(attack.techniques.map(t => t.id));
  const extra = parseStix(attackRaw, { system:'attack', tacticSrc:'mitre-attack' }).techniques
    .filter(t => SEED.SOURCE_SELECTION.attackTechniques.includes(t.id) && !have.has(t.id));
  const missing = SEED.SOURCE_SELECTION.attackTechniques.filter(id => !have.has(id) && !extra.some(t => t.id === id));
  if (missing.length) throw new Error(`D13 techniques not found in ATT&CK: ${missing.join(', ')}`);
  attack.techniques.push(...extra);
}

/* raw files for the grounding modules, all through the manifest */
const groundingFiles = MANIFEST.filter(m => !['d3fend','atlas','attack','uco'].includes(m.source) ||
  ['atlas-stix.json','attack-enterprise.json'].includes(m.name));
const RAWS = Object.fromEntries(await Promise.all(groundingFiles.map(async m => [m.name, await grab(m.name)])));
const MANIFEST_BY_NAME = Object.fromEntries(MANIFEST.map(m => [m.name, { url:m.url, repo:m.repo, path:m.path, pin:m.pin }]));
const groundingStats = {};
/* tool key (e.g. `banking/tool/send_money`) → L2 action id, from SEED.BENCHMARK_ACTIONS read backwards */
const ACTIONS_BY_TOOL = {};
for (const [act, keys] of Object.entries(SEED.BENCHMARK_ACTIONS)) for (const k of keys) (ACTIONS_BY_TOOL[k] ||= []).push(`act:${act}`);
const RUN_SELECTION = { 'agentdojo-runs': SEED.BENCHMARK_RUNS.agentdojo, 'tau2-runs': SEED.BENCHMARK_RUNS.tau2 };
const grounding = (name, inBundle) => {
  const base = RUN_SELECTION[name] ? { ...RUN_SELECTION[name], actionsByTool: ACTIONS_BY_TOOL, limit: SEED.BENCHMARK_RUNS.limit }
                                   : (SEED.SOURCE_SELECTION[name] || {});
  const out = PARSERS[name](RAWS, { ...base, inBundle, manifest:MANIFEST_BY_NAME });
  groundingStats[name] = (out.nodes || []).length + Object.keys(out.sources || {}).length;
  return out;
};

const graph = assemble({ d3fend, atlas, attack, uco, grounding });
const chain = summariseChain(graph);
const coverage = buildCoverage(graph);

const stats = {
  d3fend: d3fend.artifacts.length + d3fend.techniques.length,
  atlas:  atlas.tactics.length + atlas.techniques.length + (groundingStats['atlas-mitigations'] ?? 0),
  attack: attack.tactics.length + attack.techniques.length + (groundingStats['attack-mitigations'] ?? 0),
  uco:    uco.length,
  owasp:  SEED.OWASP_LLM.length + SEED.OWASP_AGENTIC.length,
  ...Object.fromEntries(Object.entries({ 'atlas-cs':'atlas-cases', fibo:'fibo', cdm:'cdm', ocsf:'ocsf', 'nist-800-53':'nist-800-53',
    agentdojo:'agentdojo', tau2:'tau2', asb:'asb', toolemu:'toolemu' }).map(([k, m]) => [k, groundingStats[m] ?? 0])),
  'attack-campaign': groundingStats['attack-campaigns'] ?? 0
};

const ontology = {
  generated:new Date().toISOString(),
  version:'swm-2.0',
  groups:SEED.GROUPS, layers:SEED.LAYERS, sources:SOURCES, stats, chain,
  schema:SCHEMA.compactSchema(), uncountered:graph.uncountered,
  nodes:graph.nodes, links:graph.links
};

/* a bundle that breaks the contract is never written */
if (graph.problems.length){
  log(`\n  ✗ ${graph.problems.length} contract violations — nothing written:`);
  graph.problems.slice(0, +(process.env.SWM_MAX_PROBLEMS || 40)).forEach(p => log(`      ${p}`));
  if (graph.problems.length > 40) log(`      … ${graph.problems.length - 40} more`);
  process.exit(1);
}
const a = await writeBundle('ontology', 'SILEX_SWM_ONTOLOGY', ontology);
const b = await writeBundle('coverage', 'SILEX_SWM_COVERAGE', coverage);
await writeSources(stats);
await writeNotices();

const byLayer = [1,2,3,4].map(l => `L${l} ${graph.nodes.filter(n=>n.layer===l).length}`).join(' · ');
log(`\n  sources : ${Object.entries(stats).map(([k,v])=>`${k} ${v}`).join(' · ')}`);
log(`  graph   : ${graph.nodes.length} nodes (${byLayer}) · ${graph.links.length} links`);
log(`  bundles : ontology ${(a/1024).toFixed(0)}KB · coverage ${(b/1024).toFixed(0)}KB`);
log(`  layers  : ${chain.hops.map(h => `L${h.from}↔L${h.to} ${h.count}`).join(' · ')} · skipping ${chain.skips.count}`);
{
  const bench = graph.nodes.filter(SCHEMA.isBenchmark);
  log(`  L4 bench: ${bench.filter(n => n.kind === 'trace').length} runs · ${bench.filter(n => n.kind === 'incident').length} incidents · ${bench.filter(n => n.kind === 'planner').length} agents · ${bench.filter(n => n.kind === 'tool-reg').length} tools (public benchmark runs, not this enterprise)`);
}
log(`  threats : ${graph.nodes.filter(SCHEMA.isThreat).length - graph.uncountered.length} countered · ${graph.uncountered.length} uncountered`);
log('  contract: signatures, review grades, display tree and SUBCLASS_OF acyclicity verified');
log(`  done in ${((Date.now()-t0)/1000).toFixed(1)}s\n`);
