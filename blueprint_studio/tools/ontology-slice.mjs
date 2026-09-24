/* Build the Decision Trace ontology slice (plan §4, §6 row 1).
   Reads swm/data/ontology.json and writes blueprint_studio/ontology/slice.json:
   the 13 L3 ag:* component classes, every threat the bundle associates with them
   through THREATENS (with each link's src kept), and those THREATENS links.
   `node ontology-slice.mjs` writes the slice; `--check` exits 1 if the slice on
   disk differs from a fresh build. Deterministic: `generated` is copied from the
   source, never Date.now(), and everything is sorted. */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ONTOLOGY = join(HERE, '..', '..', 'swm', 'data', 'ontology.json');
const SLICE = join(HERE, '..', 'ontology', 'slice.json');

export function buildSlice(ontology) {
  const classes = ontology.nodes
    .filter(n => n.layer === 3 && n.kind === 'component')
    .map(n => ({ id: n.id, label: n.label, def: n.def, layer: 3, src: n.src }))
    .sort((a, b) => (a.id < b.id ? -1 : 1));

  const classIds = new Set(classes.map(c => c.id));
  const byId = new Map(ontology.nodes.map(n => [n.id, n]));

  const links = ontology.links
    .filter(l => l.pred === 'THREATENS' && classIds.has(l.t))
    .map(l => ({ s: l.s, t: l.t, pred: 'THREATENS', src: l.src }))
    .sort((a, b) => (a.s < b.s ? -1 : a.s > b.s ? 1 : a.t < b.t ? -1 : a.t > b.t ? 1 : 0));

  // Every threat that THREATENS an ag:* class, plus (defensively) the ids a
  // scenario family relates to, so a related id is present even with no link.
  const threatIds = new Set(links.map(l => l.s));
  for (const id of ['owasp:LLM06', 'owaspa:T2', 'owaspa:T3', 'atlas:AML.T0051', 'atlas:AML.T0086', 'owasp:LLM01', 'owasp:LLM02']) threatIds.add(id);

  const threats = [...threatIds]
    .map(id => byId.get(id))
    .filter(Boolean)
    .map(n => ({ id: n.id, label: n.label, def: n.def, group: 'threat', src: n.src }))
    .sort((a, b) => (a.id < b.id ? -1 : 1));

  return { version: ontology.version, generated: ontology.generated, source: 'swm/data/ontology.json', classes, threats, links };
}

const serialize = slice => JSON.stringify(slice, null, 2) + '\n';

export function main(argv = process.argv.slice(2)) {
  const ontology = JSON.parse(readFileSync(ONTOLOGY, 'utf8'));
  const slice = buildSlice(ontology);
  const text = serialize(slice);
  const check = argv.includes('--check');
  if (check) {
    let onDisk = null;
    try { onDisk = readFileSync(SLICE, 'utf8'); } catch { onDisk = null; }
    if (onDisk !== text) {
      console.error('ontology/slice.json is stale: rebuild with `node tools/ontology-slice.mjs`');
      process.exit(1);
    }
    console.log(`slice up to date (${slice.classes.length} classes, ${slice.threats.length} threats, ${slice.links.length} links)`);
    return;
  }
  writeFileSync(SLICE, text);
  console.log(`wrote ontology/slice.json (${slice.classes.length} classes, ${slice.threats.length} threats, ${slice.links.length} links)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
