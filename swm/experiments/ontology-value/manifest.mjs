// Tool manifest for the blind coder seat (plan § Isolation of authors). Holds tool names, suite-qualified
// ids, registry impact and descriptions only, never decision-state text, task text or outcomes.
//   node swm/experiments/ontology-value/manifest.mjs [--items <jev>/eval/splits/items.jsonl]  → out/tool-manifest.json
// Sources: AgentDojo tool lists (`TOOLS = [...]` in default_suites/v1/<suite>/task_suite.py) and docstrings
// (default_suites/v1/tools/*.py) from the pinned archive; Kev's splits contribute (source, tool, impact)
// parsed from the CANDIDATE ACTION line only.
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ARCHIVE = join(HERE, '../../.cache/agentdojo-repo-089ed468cf3e.tar.gz');
export const ARCHIVE_SHA256_PREFIX = 'd7e0ee02';
const ROOT = 'agentdojo-089ed468cf3ed0322acc66b0211f26d9d90dbf60/src/agentdojo/default_suites/v1/';
export const SUITES = ['banking', 'slack', 'travel', 'workspace'];
// The same regex the Kev converter uses (eval/convert/agentdojo.ts), so impact matches the judge's view.
const IMPACT_WRITE = /(send|update|schedule|add|delete|create|remove|post|transfer|reset|rename|modify|revoke|block|grant|set|remove|rename|delete|unsubscribe|subscribe|share|write|insert|append)/i;
export const impactOf = fn => (IMPACT_WRITE.test(fn) ? 'write' : 'read');

export function readTarFiles(buf, want) {
  const data = gunzipSync(buf);
  const out = new Map();
  let off = 0;
  while (off + 512 <= data.length) {
    const h = data.subarray(off, off + 512);
    if (h.every(b => b === 0)) break;
    const str = (a, b) => h.subarray(a, b).toString('utf8').replace(/\0.*$/s, '');
    let name = str(0, 100);
    const prefix = str(345, 500);
    if (prefix) name = prefix + '/' + name;
    const size = parseInt(str(124, 136).trim() || '0', 8);
    const type = String.fromCharCode(h[156] || 48);
    off += 512;
    if ((type === '0' || type === '\0') && want(name)) out.set(name, data.subarray(off, off + size).toString('utf8'));
    off += Math.ceil(size / 512) * 512;
  }
  return out;
}

function toolList(src) {
  const m = src.match(/^TOOLS = \[([\s\S]*?)^\]/m);
  if (!m) throw new Error('TOOLS list not found');
  return m[1].split('\n').map(l => l.replace(/#.*$/, '').trim().replace(/,$/, '')).filter(Boolean);
}

function docstrings(src) {
  const out = new Map();
  const re = /^def (\w+)\(((?!\ndef )[\s\S])*?\)[^:\n]*:\n\s+"""([\s\S]*?)"""/gm;
  for (let m; (m = re.exec(src));) {
    const doc = m[3].split('\n').map(s => s.trim());
    const summary = doc.filter(s => s && !s.startsWith(':')).join(' ');
    const params = doc.filter(s => s.startsWith(':param ')).map(s => s.replace(/^:param /, ''));
    out.set(m[1], params.length ? `${summary} Parameters: ${params.join('; ')}` : summary);
  }
  return out;
}

export function buildManifest({ archive = ARCHIVE, items } = {}) {
  const buf = readFileSync(archive);
  const sha = createHash('sha256').update(buf).digest('hex');
  if (!sha.startsWith(ARCHIVE_SHA256_PREFIX)) throw new Error(`archive sha256 ${sha} does not match the pin`);
  const files = readTarFiles(buf, n => n.startsWith(ROOT) && (/\/task_suite\.py$/.test(n) || /\/tools\/[a-z_]+\.py$/.test(n)));
  const docs = new Map();
  for (const [n, src] of files) if (n.includes('/tools/')) for (const [k, v] of docstrings(src)) docs.set(k, v);
  const tools = [];
  for (const suite of SUITES) {
    for (const name of toolList(files.get(`${ROOT}${suite}/task_suite.py`))) {
      if (!docs.has(name)) throw new Error(`no docstring for ${suite}/${name}`);
      tools.push({ id: `agentdojo:${suite}/${name}`, source: 'agentdojo', suite, name, impact: impactOf(name), description: docs.get(name) });
    }
  }
  if (items) {
    const seen = new Set(tools.map(t => `${t.source}:${t.name}`));
    for (const line of readFileSync(items, 'utf8').split('\n')) {
      if (!line) continue;
      const it = JSON.parse(line);
      const m = it.state.match(/^CANDIDATE ACTION: (.+?) \(registry impact: (\w+)\)$/m);
      if (!m) continue;
      const key = `${it.source}:${m[1]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // Non-AgentDojo sources carry no tool description in the eval items: name-only (plan § arms, A2).
      tools.push({ id: `${it.source}:${it.family}/${m[1]}`, source: it.source, suite: it.family, name: m[1], impact: m[2], description: null });
    }
  }
  tools.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { archive_sha256: sha, tools };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf('--items');
  const items = i > 0 ? process.argv[i + 1] : join(HERE, '../../../../jev-runtime-observability/eval/splits/items.jsonl');
  const m = buildManifest({ items });
  const text = JSON.stringify(m, null, 1) + '\n';
  writeFileSync(join(HERE, 'out/tool-manifest.json'), text);
  const by = {};
  for (const t of m.tools) by[`${t.source}${t.description ? '' : ' (name only)'}`] = (by[`${t.source}${t.description ? '' : ' (name only)'}`] ?? 0) + 1;
  console.log(`tool-manifest: ${m.tools.length} tools; sha256 ${createHash('sha256').update(text).digest('hex')}`, by);
}
