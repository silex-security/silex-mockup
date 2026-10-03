/* Source module: Agent Security Bench (ASB) — all_attack_tools.jsonl.
   Plan: logs/2026-10-03_SWM_DOMAIN_GROUNDING_EXEC_PLAN.md (E5), Part A S7/S14, F5.
   Contract: swm/tools/sources/CONTRACT.md — "sources keys and content" row `asb` (sources only). */

const blobUrl = (manifest, name) => { const e = manifest[name]; if (!e) throw new Error(`asb: ${name} not in manifest`); return `https://github.com/${e.repo}/blob/${e.pin}/${e.path}`; };

export function parse(raws, selection) {
  const raw = raws[selection.file];
  if (raw == null) throw new Error(`asb: missing raw ${selection.file}`);
  const rows = raw.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
  const sources = {};
  for (const key of selection.rows) {
    const slash = key.indexOf('/');
    const agent = key.slice(0, slash), tool = key.slice(slash + 1);
    const row = rows.find(r => r['Corresponding Agent'] === agent && r['Attacker Tool'] === tool);
    if (!row) throw new Error(`asb: row ${key} not found in ${selection.file}`);
    if (row['Aggressive'] !== 'True') throw new Error(`asb: row ${key} has Aggressive ${JSON.stringify(row['Aggressive'])}, expected "True"`);
    sources[key] = { sys: 'asb', id: key, label: `ASB ${agent} · ${tool} (generated scenario)`,
      url: blobUrl(selection.manifest, selection.file), quote: row['Attack goal'] };
  }
  return { nodes: [], links: [], sources, omitted: [] };
}
