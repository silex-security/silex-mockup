/* Source module: τ²-bench banking_knowledge domain (banking policy documents).
   Plan: logs/2026-10-03_SWM_DOMAIN_GROUNDING_EXEC_PLAN.md (E5), Part A S8.
   Contract: swm/tools/sources/CONTRACT.md — "sources keys and content" row `banking-kb` (sources only). */

const collapse = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const blobUrl = (manifest, name) => { const e = manifest[name]; if (!e) throw new Error(`banking-kb: ${name} not in manifest`); return `https://github.com/${e.repo}/blob/${e.pin}/${e.path}`; };

export function parse(raws, selection) {
  const sources = {};
  for (const [docId, sentence] of Object.entries(selection.docs)) {
    const fn = `tau2-bk-${docId}.json`;
    const raw = raws[fn];
    if (raw == null) throw new Error(`banking-kb: missing raw ${fn}`);
    const doc = JSON.parse(raw);
    const content = collapse(doc.content);
    if (!content.includes(collapse(sentence))) throw new Error(`banking-kb: sentence not found in ${docId}: ${sentence}`);
    sources[docId] = { sys: 'tau2', id: docId, label: `τ²-bench banking_knowledge ${docId}`,
      url: blobUrl(selection.manifest, fn), quote: sentence };
  }
  return { nodes: [], links: [], sources, omitted: [] };
}
