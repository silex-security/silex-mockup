/* Source module: τ²-bench retail domain (Sierra Research) — policy rules and tool names.
   Plan: logs/2026-10-03_SWM_DOMAIN_GROUNDING_EXEC_PLAN.md (E5), Part A S5, F6/F7.
   Contract: swm/tools/sources/CONTRACT.md — "sources keys and content" row `tau2` (sources only). */

const blobUrl = (manifest, name) => { const e = manifest[name]; if (!e) throw new Error(`tau2: ${name} not in manifest`); return `https://github.com/${e.repo}/blob/${e.pin}/${e.path}`; };
const lineOf = (text, index) => (text.slice(0, index).match(/\n/g) || []).length + 1;

function sectionsOf(policy) {
  const out = { preamble: '' };
  const parts = policy.split(/^(## [^\n]*)$/m);
  // parts: [preamble, heading1, body1, heading2, body2, ...]
  out.preamble = parts[0];
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const heading = parts[i].replace(/^##\s*/, '').trim();
    out[heading] = parts[i + 1];
  }
  return out;
}

export function parse(raws, selection) {
  const policy = raws[selection.files.policy];
  const tools = raws[selection.files.tools];
  if (policy == null) throw new Error(`tau2: missing raw ${selection.files.policy}`);
  if (tools == null) throw new Error(`tau2: missing raw ${selection.files.tools}`);
  const sections = sectionsOf(policy);
  const sources = {};
  for (const [key, rule] of Object.entries(selection.rules)) {
    const sec = sections[rule.section];
    if (sec === undefined) throw new Error(`tau2: section ${rule.section} not found in policy`);
    const idx = sec.indexOf(rule.sentence);
    if (idx < 0) throw new Error(`tau2: sentence not found in section ${rule.section}: ${rule.sentence}`);
    const absIdx = policy.indexOf(rule.sentence);
    sources[key] = { sys: 'tau2', id: key, label: `τ²-bench retail rule ${rule.section}`,
      url: blobUrl(selection.manifest, selection.files.policy) + `#L${lineOf(policy, absIdx)}`, quote: rule.sentence };
  }
  for (const name of selection.tools) {
    const m = tools.match(new RegExp(`def\\s+${name}\\s*\\(`));
    if (!m) throw new Error(`tau2: tool ${name} not found in tools`);
    const key = `retail/tool/${name}`;
    sources[key] = { sys: 'tau2', id: key, label: `τ²-bench retail tool ${name}`,
      url: blobUrl(selection.manifest, selection.files.tools) + `#L${lineOf(tools, m.index)}` };
  }
  return { nodes: [], links: [], sources, omitted: [] };
}
