// F1 (plan logs/2026-10-03_ONTOLOGY_OBSERVABILITY_VALUE_PLAN.md): the predictor graph is the pre-import
// ontology at 350362a (before any AgentDojo, τ², ASB or benchmark-run import), projected to layers 1–2.
//   node swm/experiments/ontology-value/snapshot.mjs  → out/snapshot.json
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PRE_IMPORT_COMMIT = '350362a';
const HERE = dirname(fileURLToPath(import.meta.url));

export function project(bundle) {
  const nodes = bundle.nodes
    .filter(n => n.layer === 1 || n.layer === 2)
    .map(n => ({ id: n.id, label: n.label, kind: n.kind, layer: n.layer, def: n.def ?? null }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const keep = new Set(nodes.map(n => n.id));
  const seen = new Set();
  const links = [];
  for (const l of bundle.links) {
    if (!keep.has(l.s) || !keep.has(l.t)) continue;
    const k = `${l.s}\u0000${l.pred}\u0000${l.t}`;
    if (seen.has(k)) continue;
    seen.add(k);
    links.push({ s: l.s, t: l.t, pred: l.pred });
  }
  links.sort((a, b) => (a.s + '\u0000' + a.pred + '\u0000' + a.t < b.s + '\u0000' + b.pred + '\u0000' + b.t ? -1 : 1));
  return { base: PRE_IMPORT_COMMIT, nodes, links };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const repo = join(HERE, '../../..');
  const raw = execFileSync('git', ['-C', repo, 'show', `${PRE_IMPORT_COMMIT}:swm/data/ontology.json`], { maxBuffer: 1 << 28 }).toString('utf8');
  const snap = project(JSON.parse(raw));
  const text = JSON.stringify(snap, null, 1) + '\n';
  writeFileSync(join(HERE, 'out/snapshot.json'), text);
  const kinds = {};
  for (const n of snap.nodes) kinds[`L${n.layer}:${n.kind}`] = (kinds[`L${n.layer}:${n.kind}`] ?? 0) + 1;
  console.log(`snapshot: ${snap.nodes.length} nodes, ${snap.links.length} links from ${PRE_IMPORT_COMMIT}; sha256 ${createHash('sha256').update(text).digest('hex')}`);
  console.log(kinds);
}
