/* Source module: MITRE ATT&CK campaigns (campaign + uses).
   Plan: logs/2026-10-03_SWM_DOMAIN_GROUNDING_EXEC_PLAN.md (E5), Part A S10, D15.
   Contract: swm/tools/sources/CONTRACT.md — "Node id formats, kinds and placement" row `attack-campaigns.mjs`.

   Emits campaigns in `selection.ids` as L3 `case` nodes (`caseType: 'campaign'`). */

import * as SCHEMA from '../schema.mjs';

const collapse = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const stripTags = s => String(s ?? '').replace(/<[^>]*>/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
const clean = s => stripTags(collapse(s));
const cut = s => { const t = clean(s); return t.length > SCHEMA.ATTR_DEF_MAX ? t.slice(0, SCHEMA.ATTR_DEF_MAX - 1).replace(/[\s,;:.!?]+\S*$/, '') + '…' : t; };
const blobUrl = (manifest, name) => { const e = manifest[name]; if (!e) throw new Error(`attack-campaigns: ${name} not in manifest`); return `https://github.com/${e.repo}/blob/${e.pin}/${e.path}`; };
const ext = o => ((o.external_references || []).find(r => r.source_name === 'mitre-attack') || {}).external_id;

export function parse(raws, selection) {
  const raw = raws[selection.file];
  if (raw == null) throw new Error(`attack-campaigns: missing raw ${selection.file}`);
  const objs = JSON.parse(raw).objects.filter(o => !o.revoked && !o.x_mitre_deprecated);
  const byid = new Map(objs.map(o => [o.id, o]));
  const uses = objs.filter(o => o.relationship_type === 'uses' && o.source_ref && byid.get(o.source_ref)?.type === 'campaign');
  const nodes = [], links = [], omitted = [];
  for (const cid of selection.ids) {
    const camp = objs.find(o => o.type === 'campaign' && ext(o) === cid);
    if (!camp) throw new Error(`attack-campaigns: campaign ${cid} not found in ${selection.file}`);
    const targets = uses.filter(r => r.source_ref === camp.id).map(r => byid.get(r.target_ref)).filter(Boolean);
    const inBundle = targets.filter(t => ext(t) && selection.inBundle.has(`attack:${ext(t)}`));
    const outOfBundle = targets.filter(t => ext(t) && !selection.inBundle.has(`attack:${ext(t)}`));
    const refs = [...new Set(outOfBundle.map(t => ext(t)))];
    nodes.push({ id: `case:${cid}`, label: camp.name, group: 'threat', layer: 3, kind: 'case', caseType: 'campaign', def: cut(camp.description || camp.name), review: 'published',
      src: [{ sys: 'attack-campaign', id: cid, label: 'ATT&CK campaign', url: blobUrl(selection.manifest, selection.file) }], refs,
      parentLink: { t: 'grp:threat', pred: 'GROUPED_UNDER', src: 'silex', review: 'curated' } });
    for (const t of inBundle) links.push({ s: `case:${cid}`, t: `attack:${ext(t)}`, pred: 'DEMONSTRATES', src: 'attack-campaign', review: 'published' });
    for (const r of refs) omitted.push({ ref: `${cid} uses ${r}`, reason: 'technique not in bundle' });
  }
  nodes.sort((a, b) => a.id.localeCompare(b.id));
  links.sort((a, b) => `${a.s}|${a.t}|${a.pred}`.localeCompare(`${b.s}|${b.t}|${b.pred}`));
  omitted.sort((a, b) => a.ref.localeCompare(b.ref));
  return { nodes, links, sources: {}, omitted };
}
