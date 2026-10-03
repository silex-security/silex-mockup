/* Source module: ToolEmu (ICLR 2024) — all_cases.json / all_toolkits.json.
   Plan: logs/2026-10-03_SWM_DOMAIN_GROUNDING_EXEC_PLAN.md (E5), Part A S15, C16.
   Contract: swm/tools/sources/CONTRACT.md — "sources keys and content" row `toolemu` (sources only). */

const blobUrl = (manifest, name) => { const e = manifest[name]; if (!e) throw new Error(`toolemu: ${name} not in manifest`); return `https://github.com/${e.repo}/blob/${e.pin}/${e.path}`; };

export function parse(raws, selection) {
  const casesRaw = raws[selection.files.cases];
  const toolkitsRaw = raws[selection.files.toolkits];
  if (casesRaw == null) throw new Error(`toolemu: missing raw ${selection.files.cases}`);
  if (toolkitsRaw == null) throw new Error(`toolemu: missing raw ${selection.files.toolkits}`);
  const cases = JSON.parse(casesRaw);
  const toolkits = JSON.parse(toolkitsRaw);
  const sources = {};
  for (const [name, quote] of Object.entries(selection.cases)) {
    const c = cases.find(x => x.name === name);
    if (!c) throw new Error(`toolemu: case ${name} not found`);
    const strings = [...(c['Potential Risky Outcomes'] || []), ...(c['Potential Risky Actions'] || [])];
    if (!strings.some(s => s.includes(quote))) throw new Error(`toolemu: quote not found in case ${name}: ${quote}`);
    sources[name] = { sys: 'toolemu', id: name, label: `ToolEmu case ${name}`,
      url: blobUrl(selection.manifest, selection.files.cases), quote };
  }
  for (const toolKey of selection.tools) {
    const slash = toolKey.indexOf('/');
    const toolkit = toolKey.slice(0, slash), toolName = toolKey.slice(slash + 1);
    const tk = toolkits.find(t => t.toolkit === toolkit);
    if (!tk) throw new Error(`toolemu: toolkit ${toolkit} not found`);
    if (!(tk.tools || []).some(x => x.name === toolName)) throw new Error(`toolemu: tool ${toolName} not in toolkit ${toolkit}`);
    sources[toolKey] = { sys: 'toolemu', id: toolKey, label: `ToolEmu ${toolkit}/${toolName}`,
      url: blobUrl(selection.manifest, selection.files.toolkits) };
  }
  return { nodes: [], links: [], sources, omitted: [] };
}
