/* Source module: NIST SP 800-53 Rev. 5 (OSCAL catalog).
   Plan: logs/2026-10-03_SWM_DOMAIN_GROUNDING_EXEC_PLAN.md (E5), Part A S11.
   Contract: swm/tools/sources/CONTRACT.md — "Node id formats, kinds and placement" row `nist-800-53.mjs`.

   Emits controls in `selection.controls` as L1 `control` nodes. */

import * as SCHEMA from '../schema.mjs';

const collapse = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const stripTags = s => String(s ?? '').replace(/<[^>]*>/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
const clean = s => stripTags(collapse(s));
const cut = s => { const t = clean(s); return t.length > SCHEMA.ATTR_DEF_MAX ? t.slice(0, SCHEMA.ATTR_DEF_MAX - 1).replace(/[\s,;:.!?]+\S*$/, '') + '…' : t; };
const blobUrl = (manifest, name) => { const e = manifest[name]; if (!e) throw new Error(`nist-800-53: ${name} not in manifest`); return `https://github.com/${e.repo}/blob/${e.pin}/${e.path}`; };
const nistId = cid => { const p = cid.split('.'); const base = p[0].toUpperCase(); return p.length > 1 ? `${base}(${p.slice(1).join('')})` : base; };

export function parse(raws, selection) {
  const raw = raws[selection.file];
  if (raw == null) throw new Error(`nist-800-53: missing raw ${selection.file}`);
  const catalog = JSON.parse(raw).catalog;
  const controls = new Map();
  const walk = cs => { for (const c of cs) { controls.set(c.id, c); walk(c.controls || []); } };
  for (const g of catalog.groups || []) walk(g.controls || []);
  const nodes = [];
  for (const cid of selection.controls) {
    const c = controls.get(cid);
    if (!c) throw new Error(`nist-800-53: control ${cid} not found in ${selection.file}`);
    const id = nistId(cid);
    const paramById = new Map((c.params || []).map(p => [p.id, p]));
    const resolveInserts = text => String(text ?? '').replace(
      /\{\{\s*insert:\s*param,\s*([^}\s]+)\s*\}\}/g,
      (_, pid) => {
        const p = paramById.get(pid);
        if (!p) return `[Assignment: ${pid}]`;
        const alts = p.select?.alternatives;
        if (Array.isArray(alts) && alts.length) return `[Selection: ${alts.map(a => (typeof a === 'string' ? a : (a.label || a))).join('; ')}]`;
        return `[Assignment: ${p.label || pid}]`;
      });
    const stmt = (c.parts || []).find(p => p.name === 'statement');
    const prose = stmt ? resolveInserts(stmt.prose) : '';
    const items = ((stmt?.parts) || []).filter(p => p.name === 'item').map(it => {
      const label = (it.props || []).find(p => p.name === 'label')?.value || '';
      const ip = resolveInserts(it.prose);
      return label ? `${label} ${ip}` : ip;
    });
    const full = prose ? (items.length ? `${prose} ${items.join(' ')}` : prose) : items.join(' ');
    nodes.push({ id: `nist:${id}`, label: c.title, group: 'policy', layer: 1, kind: 'control', def: cut(full || c.title), review: 'published',
      src: [{ sys: 'nist-800-53', id, label: `NIST SP 800-53 ${id}`, url: blobUrl(selection.manifest, selection.file) }],
      parentLink: { t: 'grp:policy', pred: 'GROUPED_UNDER', src: 'silex', review: 'curated' } });
  }
  nodes.sort((a, b) => a.id.localeCompare(b.id));
  return { nodes, links: [], sources: {}, omitted: [] };
}
