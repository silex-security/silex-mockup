// Independent F3 check. Never imports the snapshot builder or predictor code.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
export const canonicalJSON = value => JSON.stringify(value, (_key, x) => x && typeof x === 'object' && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x);
export function projection(repo = ROOT) {
  const blob = JSON.parse(execFileSync('git', ['-C', repo, 'show', '350362a:swm/data/ontology.json'], { encoding: 'utf8' }));
  const nodes = blob.nodes.filter(n => [1, 2].includes(n.layer)).map(n => ({ id: n.id, label: n.label, kind: n.kind, layer: n.layer, def: n.def ?? null })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const ids = new Set(nodes.map(n => n.id));
  const links = [...new Map(blob.links.filter(l => ids.has(l.s) && ids.has(l.t)).map(l => {
    const x = { s: l.s, t: l.t, pred: l.pred }; return [`${x.s}\0${x.pred}\0${x.t}`, x];
  })).entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, l]) => l);
  return { base: '350362a', nodes, links };
}

export function loadCorpus(repo = ROOT) {
  // ast only: do not import/execute benchmark code. Resolve literal constants and f-string fragments.
  const script = String.raw`import ast,tarfile,json,sys,re
repo=sys.argv[1]; goals=[]; identifiers=set(); tools=set()
t=tarfile.open(repo+'/swm/.cache/agentdojo-repo-089ed468cf3e.tar.gz')
files={m.name:t.extractfile(m).read().decode() for m in t if m.isfile() and re.search(r'/default_suites/v1(?:_[0-9]+)*/(?:banking|slack|travel|workspace)/injection_tasks.py$',m.name)}
def value(n,env):
 if isinstance(n,ast.Constant): return n.value
 if isinstance(n,ast.Name): return env.get(n.id,'{'+n.id+'}')
 if isinstance(n,ast.JoinedStr): return ''.join(str(value(v,env)) for v in n.values)
 if isinstance(n,ast.FormattedValue): return value(n.value,env)
 if isinstance(n,ast.BinOp) and isinstance(n.op,ast.Add):
  a,b=value(n.left,env),value(n.right,env)
  return a+b if isinstance(a,str) and isinstance(b,str) else ''
 return ''
for path,source in files.items():
 tree=ast.parse(source); env={}
 for node in ast.walk(tree):
  if isinstance(node,ast.Assign):
   for target in node.targets:
    if isinstance(target,ast.Name) and isinstance(node.value,ast.Constant): env[target.id]=node.value.value
 for node in ast.walk(tree):
  if isinstance(node,(ast.Assign,ast.AnnAssign)):
   targets=node.targets if isinstance(node,ast.Assign) else [node.target]
   for target in targets:
    if isinstance(target,ast.Name):
     v=value(node.value,env)
     if target.id=='GOAL' and isinstance(v,str): goals.append(v)
     if 'ATTACKER' in target.id and isinstance(v,str) and v: identifiers.add(v)
# The published dump supplies resolved goals and literal ground-truth args.
dump=json.load(open(repo+'/../jev-runtime-observability/eval/convert/fixtures/agentdojo.json'))
for suite,s in dump.items():
 for task in s.get('injection_tasks',[]):
  goal=task.get('goal',''); goals.append(goal)
  for call in task.get('calls',[]):
   tools.add(call['function'])
   for key,v in call.get('args',{}).items():
    for item in v if isinstance(v,list) else [v]:
     if isinstance(item,str) and item and not item.isdecimal():
      if key in ['password','username','user','user_email','recipient','recipients','email','url'] : identifiers.add(item)
for goal in goals:
 identifiers.update(re.findall(r'\b[A-Z]{2}\d{2}[A-Z0-9]{10,}\b',goal,re.I))
 identifiers.update(re.findall(r'[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}',goal))
 identifiers.update(re.findall(r'https?://[^\s<>"\)]+',goal))
 identifiers.update(re.findall(r'\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:/[^\s<>"\)]*)?',goal,re.I))
identifiers={x for x in identifiers if x not in tools and len(x)>1 and not x.startswith('{')}
print(json.dumps({'goals':sorted(set(goals)), 'identifiers':sorted(identifiers), 'files':len(files)}))`;
  const result = spawnSync('python3', ['-c', script, repo], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`goal corpus extraction failed: ${result.stderr}`);
  return JSON.parse(result.stdout);
}
const words = text => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/u).filter(Boolean);
function strings(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => [k, ...strings(v)]);
  return [];
}
export function scanner(corpus) {
  const spans = new Set();
  for (const goal of corpus.goals) { const tokens = words(goal); for (let i = 0; i + 6 <= tokens.length; i++) spans.add(tokens.slice(i, i + 6).join(' ')); }
  const identifiers = corpus.identifiers.map(x => new RegExp('(?<![\\p{L}\\p{N}_])' + [...x].map(c => '.*+?^${}()|[]\\'.includes(c) ? '\\' + c : c).join('') + '(?![\\p{L}\\p{N}_])', 'iu'));
  return value => {
    const violations = [];
    for (const text of strings(value)) {
      const tokens = words(text);
      if (tokens.some((_, i) => i + 6 <= tokens.length && spans.has(tokens.slice(i, i + 6).join(' ')))) violations.push('injection-goal span');
      if (identifiers.some(pattern => pattern.test(text))) violations.push('attacker identifier');
    }
    return [...new Set(violations)]; // Never print the target text or identifiers.
  };
}
export function checkBinding(binding, manifest, snapshot) {
  const violations = [], null_counts = {};
  const tools = manifest.tools.filter(t => t.source === 'agentdojo');
  const expected = new Set(tools.map(t => t.id));
  const entries = binding?.tools;
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    return { violations: ['binding.tools must be an object'], null_counts, actions: {} };
  }
  const nodes = new Map(snapshot.nodes.map(n => [n.id, n]));
  const parents = new Map();
  for (const link of snapshot.links) if (link.pred === 'SUBCLASS_OF') {
    if (!parents.has(link.s)) parents.set(link.s, []);
    parents.get(link.s).push(link.t);
  }
  for (const id of Object.keys(entries)) if (!expected.has(id)) violations.push(`unexpected binding tool: ${id}`);
  const actions = {};
  for (const tool of tools) {
    null_counts[tool.suite] ??= 0;
    if (!Object.hasOwn(entries, tool.id)) { violations.push(`missing binding tool: ${tool.id}`); continue; }
    const entry = entries[tool.id];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) { violations.push(`invalid binding entry: ${tool.id}`); continue; }
    const core = nodes.get(entry.core);
    if (!core || core.kind !== 'action' || core.layer !== 1) violations.push(`core is not an L1 action: ${tool.id}`);
    if (entry.action === null) { null_counts[tool.suite]++; actions[tool.id] = null; continue; }
    const action = nodes.get(entry.action);
    if (!action || action.kind !== 'action' || action.layer !== 2) { violations.push(`action is not an L2 action: ${tool.id}`); continue; }
    const direct = parents.get(entry.action) ?? [];
    if (direct.length !== 1 || direct[0] !== entry.core) violations.push(`core is not the action's SUBCLASS_OF parent: ${tool.id}`);
    actions[tool.id] = entry.action;
  }
  return { violations, null_counts, actions };
}
export function bindingAgreement(first, second, manifest) {
  const overall = { total: 0, agree: 0 }, per_suite = {};
  for (const tool of manifest.tools.filter(t => t.source === 'agentdojo')) {
    const counts = per_suite[tool.suite] ??= { total: 0, agree: 0 };
    counts.total++; overall.total++;
    if (Object.hasOwn(first.actions, tool.id) && Object.hasOwn(second.actions, tool.id)
      && first.actions[tool.id] === second.actions[tool.id]) { counts.agree++; overall.agree++; }
  }
  return { overall, per_suite }; // Null/null is an exact L2 agreement.
}
function hasDuplicateKeys(raw) {
  // JSON.parse discards duplicate keys; reject them before treating an object as one binding per tool.
  const script = 'import json,sys\ndef unique(pairs):\n d={}\n for k,v in pairs:\n  if k in d: raise ValueError("duplicate key")\n  d[k]=v\n return d\ntry: json.loads(sys.stdin.read(),object_pairs_hook=unique)\nexcept ValueError: sys.exit(1)\n';
  const result = spawnSync('python3', ['-c', script], { input: raw, encoding: 'utf8' });
  if (result.error || ![0, 1].includes(result.status)) throw new Error('duplicate-key check could not run');
  return result.status === 1;
}
export function checkArtifacts({ repo = ROOT, directory = resolve(repo, 'swm/experiments/ontology-value'), requireAll = false, corpus = loadCorpus(repo) } = {}) {
  const scan = scanner(corpus), results = [], bindings = {};
  let manifest;
  for (const file of ['out/snapshot.json', 'out/tool-manifest.json', 'out/tool-map.json', 'out/ontology-context.v1.json', 'e3/effect-class.json', 'e3/b3-prompt.txt', 'binding.json', 'binding-2.json']) {
    const path = resolve(directory, file);
    if (!existsSync(path)) { results.push({ file, status: 'MISSING', violations: requireAll ? ['required file missing'] : [] }); continue; }
    const raw = readFileSync(path, 'utf8'), value = file.endsWith('.json') ? JSON.parse(raw) : raw;
    const violations = scan(value);
    if (file === 'out/snapshot.json' && !isDeepStrictEqual(value, projection(repo))) violations.push('snapshot differs from independent git projection');
    let binding;
    if (file === 'binding.json' || file === 'binding-2.json') {
      if (hasDuplicateKeys(raw)) violations.push('duplicate JSON key in binding');
      const manifestPath = resolve(directory, 'out/tool-manifest.json'), snapshotPath = resolve(directory, 'out/snapshot.json');
      if (!existsSync(manifestPath) || !existsSync(snapshotPath)) violations.push('binding validation requires manifest and snapshot');
      else {
        manifest ??= JSON.parse(readFileSync(manifestPath, 'utf8'));
        binding = checkBinding(value, manifest, JSON.parse(readFileSync(snapshotPath, 'utf8')));
        violations.push(...binding.violations);
        bindings[file] = binding;
      }
    }
    results.push({ file, status: violations.length ? 'FAIL' : 'PASS', sha256: createHash('sha256').update(raw).digest('hex'), violations,
      ...(binding ? { null_counts: binding.null_counts } : {}) });
  }
  const agreement = bindings['binding.json'] && bindings['binding-2.json'] ? bindingAgreement(bindings['binding.json'], bindings['binding-2.json'], manifest) : null;
  return { ok: results.every(x => !x.violations.length), goal_files: corpus.files, results, binding_agreement: agreement };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? fallback : process.argv[i + 1]; };
  try { const result = checkArtifacts({ repo: arg('repo', ROOT), directory: arg('dir', resolve(ROOT, 'swm/experiments/ontology-value')), requireAll: process.argv.includes('--require-all') }); console.log(JSON.stringify(result, null, 2)); process.exitCode = result.ok ? 0 : 1; }
  catch (error) { console.error(String(error)); process.exitCode = 1; }
}
