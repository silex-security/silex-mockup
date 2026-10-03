/* Source module: MITRE ATLAS case studies (ATLAS.yaml).
   Plan: logs/2026-10-03_SWM_DOMAIN_GROUNDING_EXEC_PLAN.md (E5), Part A S2, T2.
   Contract: swm/tools/sources/CONTRACT.md — "Node id formats, kinds and placement" row `atlas-cases.mjs`.

   Emits all 57 case studies as L3 `case` nodes with `DEMONSTRATES` edges to in-bundle techniques. */

import * as SCHEMA from '../schema.mjs';

const collapse = s => String(s ?? '').replace(/\s+/g, ' ').trim();
/* also drops ATLAS reference-style citations such as `[\[1\]][1]` (planner fix at P2) */
const stripTags = s => String(s ?? '').replace(/<[^>]*>/g, '').replace(/\s*\[\\\[\d+\\\]\]\[\d+\]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
const clean = s => stripTags(collapse(s));
const cut = s => { const t = clean(s); return t.length > SCHEMA.ATTR_DEF_MAX ? t.slice(0, SCHEMA.ATTR_DEF_MAX - 1).replace(/[\s,;:.!?]+\S*$/, '') + '…' : t; };
const blobUrl = (manifest, name) => { const e = manifest[name]; if (!e) throw new Error(`atlas-cases: ${name} not in manifest`); return `https://github.com/${e.repo}/blob/${e.pin}/${e.path}`; };

function summaryOf(block) {
  const m1 = block.match(/summary:\s*'((?:[^']|'')*)'/s);
  if (m1) return m1[1].replace(/''/g, "'");
  const m2 = block.match(/summary:\s*"((?:[^"\\]|\\.)*)"/s);
  if (m2) return m2[1];
  const m3 = block.match(/summary:\s*(.+?)\n\s{2}[a-z][a-z-]*:/s);
  return m3 ? m3[1] : '';
}

export function parse(raws, selection) {
  const raw = raws[selection.file];
  if (raw == null) throw new Error(`atlas-cases: missing raw ${selection.file}`);
  const idx = raw.indexOf('case-studies:');
  if (idx < 0) throw new Error(`atlas-cases: no case-studies section in ${selection.file}`);
  const blocks = raw.slice(idx).split(/\n- id: /).slice(1);
  if (!blocks.length) throw new Error(`atlas-cases: no case studies found`);
  const nodes = [], links = [], omitted = [];
  for (const block of blocks) {
    const idm = block.match(/^(AML\.CS\d+)/);
    if (!idm) throw new Error(`atlas-cases: block has no id`);
    const id = idm[1];
    const name = collapse((block.match(/name: ([^\n]+)/) || [])[1] || id);
    const ctype = (block.match(/case-study-type:\s*(\w+)/) || [])[1];
    if (!ctype) throw new Error(`atlas-cases: ${id} has no case-study-type`);
    const techs = [...new Set([...block.matchAll(/technique:\s*(AML\.T\d{4}(?:\.\d{3})?)/g)].map(x => x[1]))];
    const inBundle = techs.filter(t => selection.inBundle.has(`atlas:${t}`));
    const outOfBundle = techs.filter(t => !selection.inBundle.has(`atlas:${t}`));
    nodes.push({ id: `case:${id}`, label: name, group: 'threat', layer: 3, kind: 'case', caseType: ctype, def: cut(summaryOf(block) || name), review: 'published',
      src: [{ sys: 'atlas-cs', id, label: 'ATLAS case study', url: blobUrl(selection.manifest, selection.file) }], refs: outOfBundle,
      parentLink: { t: 'grp:threat', pred: 'GROUPED_UNDER', src: 'silex', review: 'curated' } });
    for (const t of inBundle) links.push({ s: `case:${id}`, t: `atlas:${t}`, pred: 'DEMONSTRATES', src: 'atlas-cs', review: 'published' });
    for (const t of outOfBundle) omitted.push({ ref: `${id} technique ${t}`, reason: 'technique not in bundle' });
  }
  nodes.sort((a, b) => a.id.localeCompare(b.id));
  links.sort((a, b) => `${a.s}|${a.t}|${a.pred}`.localeCompare(`${b.s}|${b.t}|${b.pred}`));
  omitted.sort((a, b) => a.ref.localeCompare(b.ref));
  return { nodes, links, sources: {}, omitted };
}
