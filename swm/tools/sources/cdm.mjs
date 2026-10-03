/* Source module: Microsoft Common Data Model (CDM).
   Plan: logs/2026-10-03_SWM_DOMAIN_GROUNDING_EXEC_PLAN.md (E5), Part A S6/S9.
   Contract: swm/tools/sources/CONTRACT.md — "Node id formats, kinds and placement" row `cdm.mjs`.

   Emits entities in `selection.docs` as L2 `class` nodes with `attrs`. */

import * as SCHEMA from '../schema.mjs';

const collapse = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const stripTags = s => String(s ?? '').replace(/<[^>]*>/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
const clean = s => stripTags(collapse(s));
const cut = s => { const t = clean(s); return t.length > SCHEMA.ATTR_DEF_MAX ? t.slice(0, SCHEMA.ATTR_DEF_MAX - 1).replace(/[\s,;:.!?]+\S*$/, '') + '…' : t; };
const blobUrl = (manifest, name) => { const e = manifest[name]; if (!e) throw new Error(`cdm: ${name} not in manifest`); return `https://github.com/${e.repo}/blob/${e.pin}/${e.path}`; };
const localized = cv => { if (!Array.isArray(cv)) return ''; const en = cv.find(x => Array.isArray(x) && x[0] === 'en'); return en ? en[1] : (cv[0]?.[1] ?? ''); };
const descFrom = def => { for (const t of def.exhibitsTraits || []) if (t.traitReference === 'is.localized.describedAs') return localized(t.arguments?.[0]?.entityReference?.constantValues) || ''; return ''; };

export function parse(raws, selection) {
  const nodes = [];
  for (const doc of selection.docs) {
    const raw = raws[doc.file];
    if (raw == null) throw new Error(`cdm: missing raw ${doc.file}`);
    const data = JSON.parse(raw);
    const def = (data.definitions || []).find(d => d.entityName === doc.entity);
    if (!def) throw new Error(`cdm: entity ${doc.entity} not in ${doc.file}`);
    let label = doc.entity;
    for (const t of def.exhibitsTraits || []) if (t.traitReference === 'is.localized.displayedAs') { const l = localized(t.arguments?.[0]?.entityReference?.constantValues); if (l) label = l; }
    const attrs = [];
    for (const grp of def.hasAttributes || []) {
      if (!grp.attributeGroupReference) continue;
      for (const member of grp.attributeGroupReference.members || []) {
        let d = '';
        for (const t of member.appliedTraits || []) if (t.traitReference === 'is.localized.describedAs') { d = localized(t.arguments?.[0]?.entityReference?.constantValues) || ''; }
        if (d) attrs.push({ name: member.name, def: cut(d) });
      }
    }
    const id = `cdm:${doc.entity}`;
    nodes.push({ id, label, group: 'resource', layer: 2, kind: 'class', def: cut(descFrom(def) || `${doc.entity} (CDM).`), review: 'published',
      src: [{ sys: 'cdm', id: doc.entity, label: `CDM ${doc.entity}`, url: blobUrl(selection.manifest, doc.file) }], attrs,
      parentLink: { t: `dom:${doc.domain}`, pred: 'PART_OF_DOMAIN', src: 'silex', review: 'curated' } });
  }
  nodes.sort((a, b) => a.id.localeCompare(b.id));
  return { nodes, links: [], sources: {}, omitted: [] };
}
