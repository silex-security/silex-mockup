/* Source module: FIBO (EDM Council Financial Industry Business Ontology).
   Plan: logs/2026-10-03_SWM_DOMAIN_GROUNDING_EXEC_PLAN.md (E5), Part A S3.
   Contract: swm/tools/sources/CONTRACT.md — "Node id formats, kinds and placement" row `fibo.mjs`.

   Emits `selection.classes` and their in-file superclasses as L2 `class` nodes. */

import * as SCHEMA from '../schema.mjs';

const collapse = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const stripTags = s => String(s ?? '').replace(/<[^>]*>/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
const decode = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
const clean = s => decode(stripTags(collapse(s)));
const cut = s => { const t = clean(s); return t.length > SCHEMA.ATTR_DEF_MAX ? t.slice(0, SCHEMA.ATTR_DEF_MAX - 1).replace(/[\s,;:.!?]+\S*$/, '') + '…' : t; };
const blobUrl = (manifest, name) => { const e = manifest[name]; if (!e) throw new Error(`fibo: ${name} not in manifest`); return `https://github.com/${e.repo}/blob/${e.pin}/${e.path}`; };

export function parse(raws, selection) {
  const file = selection.files[0];
  const text = raws[file];
  if (text == null) throw new Error(`fibo: missing raw ${file}`);
  const ns = (text.match(/<!ENTITY\s+([A-Za-z0-9-]+)\s+"[^"]*ClientsAndAccounts[^"]*"/) || [])[1];
  if (!ns) throw new Error(`fibo: cannot determine the file namespace in ${file}`);
  const classes = new Map();
  const re = new RegExp(`<owl:Class rdf:about="&${ns};([A-Za-z0-9_]+)">([\\s\\S]*?)</owl:Class>`, 'g');
  let m;
  while ((m = re.exec(text))) {
    const local = m[1], body = m[2];
    const label = (body.match(/<rdfs:label>([^<]*)<\/rdfs:label>/) || [])[1];
    const def = (body.match(/<skos:definition>([\s\S]*?)<\/skos:definition>/) || [])[1];
    const subs = [...body.matchAll(/<rdfs:subClassOf rdf:resource="&([A-Za-z0-9-]+);([A-Za-z0-9_]+)"\/>/g)]
      .filter(x => x[1] === ns).map(x => x[2]);
    classes.set(local, { local, label: label ? collapse(label) : local.replace(/([a-z])([A-Z])/g, '$1 $2'), def: def ? cut(def) : '', subs });
  }
  const nodes = [], links = [], seen = new Set();
  const walk = local => {
    if (seen.has(local)) return;
    seen.add(local);
    const c = classes.get(local);
    if (!c) throw new Error(`fibo: class ${local} not found in ${file}`);
    const domain = selection.domain[local];
    if (!domain) throw new Error(`fibo: no domain for class ${local}`);
    const supers = c.subs.filter(s => classes.has(s));
    for (const s of supers) walk(s);
    const id = `fibo:${local}`;
    let parentLink;
    if (supers.length) {
      parentLink = { t: `fibo:${supers[0]}`, pred: 'SUBCLASS_OF', src: 'fibo', review: 'published' };
      for (const p of supers.slice(1)) links.push({ s: id, t: `fibo:${p}`, pred: 'SUBCLASS_OF', src: 'fibo', review: 'published' });
    } else {
      parentLink = { t: `dom:${domain}`, pred: 'PART_OF_DOMAIN', src: 'silex', review: 'curated' };
    }
    nodes.push({ id, label: c.label, group: 'resource', layer: 2, kind: 'class', def: c.def || `FIBO ${local}.`, review: 'published',
      src: [{ sys: 'fibo', id: local, label: `FIBO ${local}`, url: blobUrl(selection.manifest, file) }], parentLink });
  };
  for (const root of selection.classes) walk(root);
  nodes.sort((a, b) => a.id.localeCompare(b.id));
  links.sort((a, b) => `${a.s}|${a.t}|${a.pred}`.localeCompare(`${b.s}|${b.t}|${b.pred}`));
  return { nodes, links, sources: {}, omitted: [] };
}
