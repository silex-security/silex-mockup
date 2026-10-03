/* Source module: OCSF schema (Open Cybersecurity Schema Framework).
   Plan: logs/2026-10-03_SWM_DOMAIN_GROUNDING_EXEC_PLAN.md (E5), Part A S12.
   Contract: swm/tools/sources/CONTRACT.md — "Node id formats, kinds and placement" row `ocsf.mjs`.

   Emits IAM event classes and the selected objects as L1 `class` nodes with `attrs`. */

import * as SCHEMA from '../schema.mjs';

const collapse = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const stripTags = s => String(s ?? '').replace(/<[^>]*>/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
const clean = s => stripTags(collapse(s));
const cut = s => { const t = clean(s); return t.length > SCHEMA.ATTR_DEF_MAX ? t.slice(0, SCHEMA.ATTR_DEF_MAX - 1).replace(/[\s,;:.!?]+\S*$/, '') + '…' : t; };
const blobUrl = (manifest, name) => { const e = manifest[name]; if (!e) throw new Error(`ocsf: ${name} not in manifest`); return `https://github.com/${e.repo}/blob/${e.pin}/${e.path}`; };

export function parse(raws, selection) {
  const dictRaw = raws['ocsf-dictionary.json'];
  if (dictRaw == null) throw new Error('ocsf: missing raw ocsf-dictionary.json');
  const dictAttrs = JSON.parse(dictRaw).attributes || {};
  const nodes = [];
  const emit = (stem, data, kind) => {
    const caption = data.caption || data.name;
    const group = kind === 'event' ? 'workflow' : (stem === 'user' ? 'identity' : 'resource');
    const attrs = [];
    for (const [aname, adef] of Object.entries(data.attributes || {})) {
      const d = (adef && adef.description) || dictAttrs[aname]?.description || '';
      if (d) attrs.push({ name: aname, def: cut(d) });
    }
    let parentLink;
    if (kind === 'event' && data.extends === 'iam') parentLink = { t: 'ocsf:iam', pred: 'SUBCLASS_OF', src: 'ocsf', review: 'published' };
    else parentLink = { t: `grp:${group}`, pred: 'GROUPED_UNDER', src: 'silex', review: 'curated' };
    const node = { id: `ocsf:${stem}`, label: caption, group, layer: 1, kind: 'class', def: cut(data.description || caption), review: 'published',
      src: [{ sys: 'ocsf', id: stem, label: `OCSF ${caption}`, url: blobUrl(selection.manifest, kind === 'event' ? `ocsf-events-iam-${stem}.json` : `ocsf-objects-${stem}.json`) }],
      attrs, parentLink };
    if (data['@deprecated']) node.deprecated = { message: clean(data['@deprecated'].message), since: data['@deprecated'].since, superseded_by: data['@deprecated'].superseded_by };
    nodes.push(node);
  };
  for (const stem of selection.objects) {
    const name = `ocsf-objects-${stem}.json`;
    if (raws[name] == null) throw new Error(`ocsf: missing raw ${name}`);
    emit(stem, JSON.parse(raws[name]), 'object');
  }
  for (const stem of selection.events) {
    const name = `ocsf-events-iam-${stem}.json`;
    if (raws[name] == null) throw new Error(`ocsf: missing raw ${name}`);
    emit(stem, JSON.parse(raws[name]), 'event');
  }
  nodes.sort((a, b) => a.id.localeCompare(b.id));
  return { nodes, links: [], sources: {}, omitted: [] };
}
