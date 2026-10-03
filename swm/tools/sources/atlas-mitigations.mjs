/* Source module: MITRE ATLAS mitigations (course-of-action + mitigates).
   Plan: logs/2026-10-03_SWM_DOMAIN_GROUNDING_EXEC_PLAN.md (E5), Part A S1, T1.
   Contract: swm/tools/sources/CONTRACT.md — "Node id formats, kinds and placement" row `atlas-mitigations.mjs`.

   Emits ATLAS `course-of-action` objects with >= 1 in-bundle `mitigates` target as L1 `countermeasure`. */

import * as SCHEMA from '../schema.mjs';

const collapse = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const stripTags = s => String(s ?? '').replace(/<[^>]*>/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
const clean = s => stripTags(collapse(s));
const cut = s => { const t = clean(s); return t.length > SCHEMA.ATTR_DEF_MAX ? t.slice(0, SCHEMA.ATTR_DEF_MAX - 1).replace(/[\s,;:.!?]+\S*$/, '') + '…' : t; };
const blobUrl = (manifest, name) => { const e = manifest[name]; if (!e) throw new Error(`atlas-mitigations: ${name} not in manifest`); return `https://github.com/${e.repo}/blob/${e.pin}/${e.path}`; };
const ext = o => ((o.external_references || []).find(r => typeof r.external_id === 'string' && r.external_id.startsWith('AML.')) || {}).external_id;

export function parse(raws, selection) {
  const raw = raws[selection.file];
  if (raw == null) throw new Error(`atlas-mitigations: missing raw ${selection.file}`);
  const objs = JSON.parse(raw).objects;
  const byid = new Map(objs.map(o => [o.id, o]));
  const coas = objs.filter(o => o.type === 'course-of-action' && !o.revoked && !o.x_mitre_deprecated);
  const mitigates = objs.filter(o => o.relationship_type === 'mitigates');
  const nodes = [], links = [], omitted = [];
  for (const coa of coas) {
    const eid = ext(coa);
    if (!eid) continue;
    const targets = mitigates.filter(r => r.source_ref === coa.id).map(r => byid.get(r.target_ref)).filter(Boolean);
    const inBundle = targets.filter(t => ext(t) && selection.inBundle.has(`atlas:${ext(t)}`));
    const outOfBundle = targets.filter(t => ext(t) && !selection.inBundle.has(`atlas:${ext(t)}`));
    if (!inBundle.length) continue;
    const id = `atlas:${eid}`;
    const refs = [...new Set(outOfBundle.map(t => ext(t)))];
    nodes.push({ id, label: coa.name, group: 'policy', layer: 1, kind: 'countermeasure', def: cut(coa.description || coa.name), review: 'published',
      src: [{ sys: 'atlas', id: eid, label: `ATLAS ${eid}`, url: blobUrl(selection.manifest, selection.file) }], refs,
      parentLink: { t: 'grp:policy', pred: 'GROUPED_UNDER', src: 'silex', review: 'curated' } });
    for (const t of inBundle) links.push({ s: id, t: `atlas:${ext(t)}`, pred: 'COUNTERS', src: 'atlas', review: 'published' });
    for (const r of refs) omitted.push({ ref: `${eid} mitigates ${r}`, reason: 'target technique not in bundle' });
  }
  nodes.sort((a, b) => a.id.localeCompare(b.id));
  links.sort((a, b) => `${a.s}|${a.t}|${a.pred}`.localeCompare(`${b.s}|${b.t}|${b.pred}`));
  omitted.sort((a, b) => a.ref.localeCompare(b.ref));
  return { nodes, links, sources: {}, omitted };
}
