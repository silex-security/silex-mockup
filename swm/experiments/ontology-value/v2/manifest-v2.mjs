// v2 tool manifest (plan logs/2026-10-04_ONTOLOGY_NULL_DIAGNOSIS_AND_V2_PLAN.md, V0): every AgentDojo tool of the four suites with
// its agent-visible parameters (environment-injected `Depends(...)` arguments excluded) and their docstring descriptions, from the
// pinned archive's tool sources. No task, run or outcome text.
//   node swm/experiments/ontology-value/v2/manifest-v2.mjs  → v2/out/tool-manifest-v2.json
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARCHIVE, SUITES, impactOf, readTarFiles } from '../manifest.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = 'agentdojo-089ed468cf3ed0322acc66b0211f26d9d90dbf60/src/agentdojo/default_suites/v1/';

// Parameters typed with AgentDojo's env-injected aliases (AnnotatedSlack, AnnotatedWeb) or Depends(...) are not agent-visible.
function splitTop(s) {   // split a parameter list on commas outside brackets
  const out = []; let depth = 0, cur = '';
  for (const ch of s) { if ('([{'.includes(ch)) depth++; if (')]}'.includes(ch)) depth--; if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch; }
  if (cur.trim()) out.push(cur);
  return out.map(x => x.trim()).filter(Boolean);
}

export function parseTools(src) {
  const out = new Map();
  const re = /^def (\w+)\(((?:(?!\ndef )[\s\S])*?)\)[^:\n]*:\n\s+"""([\s\S]*?)"""/gm;
  for (let m; (m = re.exec(src));) {
    const doc = m[3].split('\n').map(s => s.trim());
    const summary = doc.filter(s => s && !s.startsWith(':')).join(' ');
    const pdesc = Object.fromEntries(doc.filter(s => s.startsWith(':param ')).map(s => { const [, k, v] = s.match(/^:param (\w+):\s*(.*)$/) ?? []; return [k, v ?? '']; }).filter(([k]) => k));
    const params = splitTop(m[2]).filter(p => !/Depends\(/.test(p) && !/^\*/.test(p) && !/:\s*Annotated\w+/.test(p)).map(p => p.split(/[:=]/)[0].trim()).filter(Boolean)
      .map(name => ({ name, description: pdesc[name] ?? null }));
    out.set(m[1], { summary, params });
  }
  return out;
}

const buf = readFileSync(ARCHIVE);
const files = readTarFiles(buf, n => n.startsWith(ROOT) && (/\/task_suite\.py$/.test(n) || /\/tools\/[a-z_]+\.py$/.test(n)));
const defs = new Map();
for (const [n, src] of files) if (n.includes('/tools/')) for (const [k, v] of parseTools(src)) defs.set(k, v);
const tools = [];
for (const suite of SUITES) {
  const list = files.get(`${ROOT}${suite}/task_suite.py`).match(/^TOOLS = \[([\s\S]*?)^\]/m)[1].split('\n').map(l => l.replace(/#.*$/, '').trim().replace(/,$/, '')).filter(Boolean);
  for (const name of list) {
    const d = defs.get(name); if (!d) throw new Error(`no definition for ${suite}/${name}`);
    tools.push({ id: `agentdojo:${suite}/${name}`, suite, name, impact: impactOf(name), description: d.summary, params: d.params });
  }
}
tools.sort((a, b) => (a.id < b.id ? -1 : 1));
const text = JSON.stringify({ archive_sha256: createHash('sha256').update(buf).digest('hex'), tools }, null, 1) + '\n';
writeFileSync(join(HERE, 'out/tool-manifest-v2.json'), text);
console.log(`tool-manifest-v2: ${tools.length} tools, ${tools.reduce((a, t) => a + t.params.length, 0)} parameters; sha256 ${createHash('sha256').update(text).digest('hex')}`);
