#!/usr/bin/env node
/* ============================================================================
   Build the Security World Model data bundle.

     node swm/tools/build-ontology.mjs [--offline]

   Fetches four public security ontologies, distils them into a compact graph,
   merges Silex's own L2/L3/L4 seed content and writes:

     swm/data/ontology.json / ontology.js     (graph: nodes + links + meta)
     swm/data/coverage.json / coverage.js     (coverage tree + gaps + KPIs)
     swm/data/SOURCES.md                      (provenance + licences)

   The .js twins assign window globals so the page works over file:// too.
   Raw source data is cached in swm/.cache (git-ignored) and never committed.
   ========================================================================== */

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as SEED from './silex-seed.mjs';

const ROOT   = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE  = join(ROOT, '.cache');
const OUT    = join(ROOT, 'data');
const OFFLINE = process.argv.includes('--offline');

const SOURCES = {
  d3fend: { name:'MITRE D3FEND', url:'https://d3fend.mitre.org/ontologies/d3fend.json',
            home:'https://d3fend.mitre.org/', licence:'MITRE D3FEND Terms of Use (free, attribution)' },
  atlas:  { name:'MITRE ATLAS', url:'https://raw.githubusercontent.com/mitre-atlas/atlas-navigator-data/main/dist/stix-atlas.json',
            home:'https://atlas.mitre.org/', licence:'Apache-2.0 / MITRE ATLAS Terms of Use' },
  attack: { name:'MITRE ATT&CK Enterprise', url:'https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json',
            home:'https://attack.mitre.org/', licence:'MITRE ATT&CK Terms of Use (free, attribution)' },
  uco:    { name:'Unified Cyber Ontology (UCO)', url:'https://github.com/ucoProject/UCO',
            home:'https://unifiedcyberontology.org/', licence:'Apache-2.0' },
  owasp:  { name:'OWASP GenAI Security Project', url:'https://genai.owasp.org/llm-top-10/',
            home:'https://genai.owasp.org/', licence:'CC BY-SA 4.0' }
};
const UCO_MODULES = ['core','action','identity','observable','tool','pattern'];
const ucoUrl = m => `https://raw.githubusercontent.com/ucoProject/UCO/master/ontology/uco/${m}/${m}.ttl`;

/* ---- helpers ------------------------------------------------------------- */
const log = (...a) => console.log(...a);
async function exists(p){ try { await stat(p); return true } catch { return false } }

async function grab(name, url){
  const file = join(CACHE, name);
  if (await exists(file)) { log(`  cache  ${name}`); return readFile(file,'utf8'); }
  if (OFFLINE) throw new Error(`--offline but ${name} is not cached`);
  log(`  fetch  ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const text = await res.text();
  await mkdir(CACHE,{recursive:true});
  await writeFile(file, text);
  return text;
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
function assemble({ d3fend, atlas, attack, uco }){
  const nodes = [], links = [], index = new Map();
  const add = n => { if (index.has(n.id)) return index.get(n.id); index.set(n.id, n); nodes.push(n); return n };
  const link = (s, t, pred, src='silex') => { if (index.has(s) && index.has(t) && s !== t) links.push({ s, t, pred, src }) };

  /* --- L1 group anchors (Silex's eight semantic groups) ------------------- */
  for (const g of SEED.GROUPS)
    add({ id:`grp:${g.id}`, label:g.name, group:g.id, layer:1, kind:'group', def:g.blurb,
          src:[{ sys:'silex', id:'SILEX-L1', label:'Silex L1 anchor' }], instances:0, coverage:null, anchor:true });

  /* --- L1 from UCO -------------------------------------------------------- */
  for (const n of uco){
    const group = groupFor(`${n.label} ${n.def} ${n.module}`, 'resource');
    add({ id:`uco:${n.id}`, label:n.label, group, layer:1, kind:'class', def:n.def || `UCO ${n.module} class.`,
          src:[{ sys:'uco', id:n.id, label:`UCO ${n.module}`, url:`https://ontology.unifiedcyberontology.org/uco/${n.module}/${n.id.split(':')[1]}` }],
          instances:Math.round(pick(n.id,0,900)), coverage:pick(n.id,.55,.97) });
  }
  for (const n of uco) for (const p of n.parents) link(`uco:${n.id}`, `uco:${p}`, 'SUBCLASS_OF', 'uco');
  for (const n of uco) if (!n.parents.some(p => index.has(`uco:${p}`))) link(`uco:${n.id}`, `grp:${index.get(`uco:${n.id}`).group}`, 'SPECIALIZES');

  /* --- L1 from D3FEND digital artifacts (the deep inheritance tree) ------- */
  for (const n of d3fend.artifacts){
    const group = groupFor(`${n.label} ${n.def}`, 'resource');
    add({ id:`d3f:${n.id}`, label:n.label, group, layer:1, kind:'class', def:n.def || 'D3FEND digital artifact.',
          src:[{ sys:'d3fend', id:n.d3id || n.id.slice(4), label:'D3FEND artifact', url:`https://d3fend.mitre.org/dao/artifact/${n.id.replace(':','/')}/` }],
          instances:Math.round(pick(n.id,0,1400)), coverage:pick(n.id,.5,.96), depth:n.depth });
  }
  for (const n of d3fend.artifacts){
    if (n.parent && index.has(`d3f:${n.parent}`)) link(`d3f:${n.id}`, `d3f:${n.parent}`, 'SUBCLASS_OF', 'd3fend');
    else link(`d3f:${n.id}`, `grp:${index.get(`d3f:${n.id}`).group}`, 'SPECIALIZES');
  }

  /* --- L1 defensive techniques (policy & control semantics) --------------- */
  for (const n of d3fend.techniques){
    add({ id:`d3f:${n.id}`, label:n.label, group:'policy', layer:1, kind:'countermeasure',
          def:n.def || 'D3FEND defensive technique.',
          src:[{ sys:'d3fend', id:n.d3id || n.id.slice(4), label:'D3FEND technique', url:`https://d3fend.mitre.org/technique/${n.id.replace(':','/')}/` }],
          instances:Math.round(pick(n.id,0,140)), coverage:pick(n.id,.45,.95), depth:n.depth });
  }
  for (const n of d3fend.techniques)
    if (n.parent && index.has(`d3f:${n.parent}`)) link(`d3f:${n.id}`, `d3f:${n.parent}`, 'SUBCLASS_OF', 'd3fend');
    else link(`d3f:${n.id}`, 'grp:policy', 'SPECIALIZES');

  /* --- L1 ATT&CK: enterprise threat semantics ----------------------------- */
  for (const t of attack.tactics)
    add({ id:`attack:${t.id}`, label:t.label, group:'threat', layer:1, kind:'tactic', def:t.def,
          src:[{ sys:'attack', id:t.id, label:'ATT&CK tactic', url:t.url }],
          instances:Math.round(pick(t.id,0,60)), coverage:pick(t.id,.6,.95) });
  for (const t of attack.tactics) link(`attack:${t.id}`, 'grp:threat', 'SPECIALIZES');
  for (const t of attack.techniques){
    add({ id:`attack:${t.id}`, label:t.label, group:'threat', layer:1, kind:'technique', def:t.def,
          src:[{ sys:'attack', id:t.id, label:'ATT&CK technique', url:t.url }],
          instances:Math.round(pick(t.id,0,40)), coverage:pick(t.id,.4,.93) });
    const tac = attack.tactics.find(x => t.phases.includes(x.shortname));
    if (tac) link(`attack:${t.id}`, `attack:${tac.id}`, 'ACHIEVES', 'attack');
    else link(`attack:${t.id}`, 'grp:threat', 'SPECIALIZES');
  }

  /* --- L2 domain packs ---------------------------------------------------- */
  for (const d of SEED.DOMAINS){
    add({ id:`dom:${d.id}`, label:d.name, group:'workflow', layer:2, kind:'domain', def:`${d.pack} · ${d.owner}`,
          src:[{ sys:'silex', id:d.pack, label:'Silex domain pack' }],
          instances:d.workflows, coverage:d.coverage, dims:d.dims });
    link(`dom:${d.id}`, 'grp:workflow', 'SPECIALIZES');
    for (const c of d.capabilities){
      add({ id:`cap:${c.id}`, label:c.name, group:'workflow', layer:2, kind:'capability',
            def:`${d.name} capability · ${c.entities.toLocaleString()} runtime entities`,
            src:[{ sys:'silex', id:c.id, label:'Silex capability' }], instances:c.entities, coverage:c.coverage, dims:c.dims });
      link(`cap:${c.id}`, `dom:${d.id}`, 'PART_OF');
      for (const w of c.workflows){
        add({ id:`wf:${w.id}`, label:`${w.id} ${w.name}`, group:'workflow', layer:2, kind:'workflow',
              def:`Registered workflow in ${d.name} · ${c.name}`,
              src:[{ sys:'silex', id:w.id, label:'Silex workflow' }], instances:w.entities, coverage:w.coverage });
        link(`wf:${w.id}`, `cap:${c.id}`, 'PART_OF');
      }
    }
    for (const e of d.entities){
      const id = `ent:${d.id}:${e.replace(/\W+/g,'-').toLowerCase()}`;
      const group = groupFor(e, 'resource');
      add({ id, label:e, group, layer:2, kind:'entity', def:`${d.name} domain entity type.`,
            src:[{ sys:'silex', id:d.pack, label:'Silex domain pack' }],
            instances:Math.round(pick(id,120,4200)), coverage:pick(id, d.coverage-.18, Math.min(.99,d.coverage+.1)) });
      link(id, `dom:${d.id}`, 'DEFINED_IN');
      link(id, `grp:${group}`, 'SPECIALIZES');
    }
  }

  /* --- L3 agentic-system ontology ---------------------------------------- */
  for (const c of SEED.AGENTIC_COMPONENTS){
    add({ id:`ag:${c.id}`, label:c.name, group:c.group, layer:3, kind:'component', def:c.blurb,
          src:[{ sys:'silex', id:'SILEX-L3', label:'Silex agentic ontology' }], instances:c.instances, coverage:c.coverage });
    link(`ag:${c.id}`, `grp:${c.group}`, 'SPECIALIZES');
  }

  /* --- L3 threats: ATLAS + OWASP ----------------------------------------- */
  for (const t of atlas.tactics)
    add({ id:`atlas:${t.id}`, label:t.label, group:'threat', layer:3, kind:'tactic', def:t.def,
          src:[{ sys:'atlas', id:t.id, label:'ATLAS tactic', url:t.url }],
          instances:Math.round(pick(t.id,0,22)), coverage:pick(t.id,.5,.9) });
  for (const t of atlas.techniques){
    add({ id:`atlas:${t.id}`, label:t.label, group:'threat', layer:3, kind:'technique', def:t.def,
          src:[{ sys:'atlas', id:t.id, label:'ATLAS technique', url:t.url }],
          instances:Math.round(pick(t.id,0,14)), coverage:pick(t.id,.35,.88) });
    const tac = atlas.tactics.find(x => t.phases.includes(x.shortname));
    if (tac) link(`atlas:${t.id}`, `atlas:${tac.id}`, 'ACHIEVES', 'atlas');
    /* which agentic component this technique lands on — Silex-authored mapping */
    const target = mapThreatToComponent(`${t.label} ${t.def}`);
    if (target) link(`atlas:${t.id}`, `ag:${target}`, 'THREATENS');
  }
  for (const [id, label, target] of SEED.OWASP_LLM){
    add({ id:`owasp:${id}`, label, group:'threat', layer:3, kind:'risk', def:`OWASP Top 10 for LLM Applications 2025 · ${id}`,
          src:[{ sys:'owasp', id, label:'OWASP LLM Top 10 (2025)', url:'https://genai.owasp.org/llm-top-10/' }],
          instances:Math.round(pick(id,1,26)), coverage:pick(id,.45,.92) });
    link(`owasp:${id}`, `ag:${target}`, 'THREATENS');
  }
  for (const [id, label, target] of SEED.OWASP_AGENTIC){
    add({ id:`owaspa:${id}`, label, group:'threat', layer:3, kind:'risk', def:`OWASP Agentic AI — Threats and Mitigations · ${id}`,
          src:[{ sys:'owasp', id:`Agentic ${id}`, label:'OWASP Agentic AI threats', url:'https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/' }],
          instances:Math.round(pick(id+label,1,19)), coverage:pick(id+label,.4,.9) });
    link(`owaspa:${id}`, `ag:${target}`, 'THREATENS');
  }
  /* countermeasure coverage: D3FEND technique ↔ threat, keyword-matched (Silex mapping) */
  const counters = d3fend.techniques.filter(t => t.d3id);
  for (const th of nodes.filter(n => n.layer === 3 && n.group === 'threat')){
    const words = th.label.toLowerCase().split(/\W+/).filter(w => w.length > 4);
    const hit = counters.find(c => words.some(w => c.label.toLowerCase().includes(w)));
    if (hit) link(`d3f:${hit.id}`, th.id, 'COUNTERS');
  }

  /* --- L4 runtime graph --------------------------------------------------- */
  for (const n of SEED.RUNTIME.nodes){
    add({ id:n.id, label:n.name, group:n.group, layer:4, kind:n.type, def:n.blurb, domain:n.domain, severity:n.severity,
          src:[{ sys:'silex', id:'RUNTIME', label:'Silex runtime graph' }],
          instances:1, coverage:n.coverage });
    if (index.has(`ag:${n.type}`)) link(n.id, `ag:${n.type}`, 'INSTANCE_OF');
    else link(n.id, `grp:${n.group}`, 'SPECIALIZES');
    if (n.domain && index.has(`dom:${n.domain}`)) link(n.id, `dom:${n.domain}`, 'BELONGS_TO');
    if (/^rt-wf-(\d+)$/.test(n.id)){
      const wf = `wf:WF-${n.id.slice(6)}`;
      if (index.has(wf)) link(n.id, wf, 'REALISES');
    }
  }
  for (const [s,t,pred] of SEED.RUNTIME.links) link(s, t, pred);

  return { nodes, links };
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
    { id:'entities', label:'Entities understood', value:`${(entities/1000).toFixed(1)}K`, note:'Typed and linked in the runtime graph', delta:`${graph.nodes.length} ontology types`, dir:'flat' },
    { id:'blind',    label:'Known blind spots', value:String(SEED.GAPS.length), note:'Open coverage gaps across all domains', delta:`${SEED.GAPS.filter(g=>g.severity==='critical').length} critical`, dir:'down' },
    { id:'calib',    label:'Last calibration', value:'6h ago', note:'Simulation vs observed behaviour agreement 94%', delta:'drift 1.2%', dir:'flat' }
  ];
  return { generated:new Date().toISOString(), dimensions:SEED.DIMENSIONS, tree, gaps:SEED.GAPS, kpis };
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

async function writeSources(stats){
  const rows = Object.entries(SOURCES).map(([k,s]) =>
    `| [${s.name}](${s.home}) | \`${s.url}\` | ${s.licence} | ${stats[k] ?? '—'} |`).join('\n');
  await writeFile(join(OUT,'SOURCES.md'), `# Security World Model — data sources

Generated ${new Date().toISOString().slice(0,10)} by \`swm/tools/build-ontology.mjs\`.
Raw downloads are cached in \`swm/.cache/\` (git-ignored); only the distilled bundles are committed.

| Source | Fetched from | Licence / terms | Nodes kept |
|---|---|---|---|
${rows}

## How the distillation works

- **D3FEND** — the \`d3f:DigitalArtifact\` subclass tree (breadth-first, documented classes first,
  capped) supplies the L1 inheritance backbone; \`d3f:DefensiveTechnique\` supplies policy/control semantics.
- **ATLAS** — every tactic plus its techniques become L3 agentic threat semantics, attached to the
  agentic component they target.
- **ATT&CK Enterprise** — the 14 tactics plus agent-relevant techniques (identity, credential, data,
  API, execution, exfiltration keywords) become L1 threat semantics.
- **UCO** — \`core\`, \`action\`, \`identity\`, \`observable\`, \`tool\` and \`pattern\` modules are parsed for
  \`owl:Class\` declarations with labels and definitions; they seed the L1 upper classes.
- **OWASP** — the LLM Top 10 (2025) and the Agentic AI threat taxonomy (T1–T15) are carried as
  published lists and attached to the agentic components they target.

## Honesty note

Nodes carry a \`src\` array naming where each one came from. Anything marked \`silex\` — the L2 domain
packs, the L3 component list, the whole L4 runtime graph, coverage percentages, and the
threat → component and countermeasure → threat mappings — is **illustrative mockup content**, not
published data. Public-ontology nodes keep their real identifiers so they can be checked.
`);
}

/* ---- main ---------------------------------------------------------------- */
const t0 = Date.now();
log('SILEX Security World Model — building data bundle');

const [d3fendRaw, atlasRaw, attackRaw] = await Promise.all([
  grab('d3fend.json', SOURCES.d3fend.url),
  grab('atlas-stix.json', SOURCES.atlas.url),
  grab('attack-enterprise.json', SOURCES.attack.url)
]);
const ucoRaw = [];
for (const m of UCO_MODULES){
  try { ucoRaw.push([m, await grab(`uco-${m}.ttl`, ucoUrl(m))]) }
  catch (e) { log(`  skip   uco/${m}: ${e.message}`) }
}

const d3fend = parseD3fend(d3fendRaw, { artifactCap:170, techniqueCap:54 });
const atlas  = parseStix(atlasRaw,  { system:'atlas',  tacticSrc:'mitre-atlas', cap:80,
  techniqueFilter: t => !t.sub && t.id.split('.').length <= 2 });
const attack = parseStix(attackRaw, { system:'attack', tacticSrc:'mitre-attack', cap:46,
  techniqueFilter: t => !t.sub && /account|credential|token|identit|api|cloud|data|exfiltrat|command|script|service|permission|valid|session|email|file|repositor|automat/i.test(`${t.label} ${t.def}`) });
const uco    = parseUco(ucoRaw, 72);

const graph = assemble({ d3fend, atlas, attack, uco });
const coverage = buildCoverage(graph);

const stats = {
  d3fend: d3fend.artifacts.length + d3fend.techniques.length,
  atlas:  atlas.tactics.length + atlas.techniques.length,
  attack: attack.tactics.length + attack.techniques.length,
  uco:    uco.length,
  owasp:  SEED.OWASP_LLM.length + SEED.OWASP_AGENTIC.length
};

const ontology = {
  generated:new Date().toISOString(),
  version:'swm-1.0',
  groups:SEED.GROUPS, layers:SEED.LAYERS, sources:SOURCES, stats,
  nodes:graph.nodes, links:graph.links
};

const a = await writeBundle('ontology', 'SILEX_SWM_ONTOLOGY', ontology);
const b = await writeBundle('coverage', 'SILEX_SWM_COVERAGE', coverage);
await writeSources(stats);

const byLayer = [1,2,3,4].map(l => `L${l} ${graph.nodes.filter(n=>n.layer===l).length}`).join(' · ');
log(`\n  sources : ${Object.entries(stats).map(([k,v])=>`${k} ${v}`).join(' · ')}`);
log(`  graph   : ${graph.nodes.length} nodes (${byLayer}) · ${graph.links.length} links`);
log(`  bundles : ontology ${(a/1024).toFixed(0)}KB · coverage ${(b/1024).toFixed(0)}KB`);
log(`  done in ${((Date.now()-t0)/1000).toFixed(1)}s\n`);
