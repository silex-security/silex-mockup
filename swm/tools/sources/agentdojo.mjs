/* Source module: AgentDojo (ETH Zürich) — banking, slack and workspace suites.
   Plan: logs/2026-10-03_SWM_DOMAIN_GROUNDING_EXEC_PLAN.md (E5), Part A S4/S13, F1.
   Contract: swm/tools/sources/CONTRACT.md — "sources keys and content" row `agentdojo` (sources only).

   Emits `sources` for injection-task goals (resolved to the definition in effect at v1.2.2)
   and tool names. */

const blobUrl = (manifest, name) => { const e = manifest[name]; if (!e) throw new Error(`agentdojo: ${name} not in manifest`); return `https://github.com/${e.repo}/blob/${e.pin}/${e.path}`; };
const lineOf = (text, index) => (text.slice(0, index).match(/\n/g) || []).length + 1;
const verStr = t => `${t[0]}.${t[1]}.${t[2]}`;
const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
const TARGET = [1, 2, 2];

function fileVersion(text) {
  const m = text.match(/_NEW_BENCHMARK_VERSION\s*=\s*\((\d+),\s*(\d+),\s*(\d+)\)/);
  return m ? [+m[1], +m[2], +m[3]] : null;
}

function decoratorVersion(method, args, fv) {
  if (method === 'register_injection_task') return [1, 0, 0];
  const inner = args ? args.slice(1, -1) : '';
  const tuple = inner.match(/\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (tuple) return [+tuple[1], +tuple[2], +tuple[3]];
  if (inner.includes('_NEW_BENCHMARK_VERSION')) {
    if (!fv) throw new Error('agentdojo: _NEW_BENCHMARK_VERSION used but not defined in file');
    return fv;
  }
  throw new Error(`agentdojo: cannot resolve version from ${args}`);
}

function extractGoal(body, taskN, file) {
  const gi = body.indexOf('GOAL');
  if (gi < 0) throw new Error(`agentdojo: no GOAL in InjectionTask${taskN} (${file})`);
  let s = body.slice(gi + 4);
  const eq = s.indexOf('=');
  if (eq < 0) throw new Error(`agentdojo: GOAL has no '=' in InjectionTask${taskN} (${file})`);
  s = s.slice(eq + 1).trim();
  const parts = [];
  if (s.startsWith('(')) {
    const re = /\bf"((?:[^"\\]|\\.)*)"/g;
    let m;
    while ((m = re.exec(s))) parts.push(m[1]);
    if (!parts.length) throw new Error(`agentdojo: no f-string in GOAL for InjectionTask${taskN} (${file})`);
    return parts.join('');
  }
  const m = s.match(/^\bf"((?:[^"\\]|\\.)*)"/);
  if (!m) throw new Error(`agentdojo: GOAL not a single f-string in InjectionTask${taskN} (${file})`);
  return m[1];
}

export function parse(raws, selection) {
  const sources = {};
  const suites = ['banking', 'slack', 'workspace'];
  const defs = { banking: {}, slack: {}, workspace: {} };

  for (const suite of suites) {
    const fileNames = selection.files[suite];
    for (const fn of fileNames) {
      const text = raws[fn];
      if (text == null) throw new Error(`agentdojo: missing raw ${fn}`);
      const fv = fileVersion(text);
      const re = /@task_suite\.(register_injection_task|update_injection_task)\s*(\([^\n]*\))?\s*\nclass\s+InjectionTask(\d+)/g;
      let m;
      while ((m = re.exec(text))) {
        const method = m[1], args = m[2], taskN = +m[3];
        const version = decoratorVersion(method, args, fv);
        const classStart = text.indexOf(`class InjectionTask${taskN}`, m.index);
        const nextClass = text.indexOf('\nclass ', classStart + 1);
        const body = text.slice(classStart, nextClass === -1 ? text.length : nextClass);
        const goal = extractGoal(body, taskN, fn);
        defs[suite][taskN] = defs[suite][taskN] || {};
        defs[suite][taskN][verStr(version)] = { goal, file: fn, line: lineOf(text, classStart) };
      }
    }
    for (const taskN of selection.tasks[suite]) {
      const versions = defs[suite][taskN];
      if (!versions) throw new Error(`agentdojo: ${suite} task ${taskN} not found in listed files`);
      const tuples = Object.keys(versions).map(k => k.split('.').map(Number));
      const eligible = tuples.filter(t => cmp(t, TARGET) <= 0);
      if (!eligible.length) throw new Error(`agentdojo: ${suite} task ${taskN} has no version <= 1.2.2`);
      eligible.sort(cmp);
      const best = eligible[eligible.length - 1];
      const def = versions[verStr(best)];
      const key = `${suite}/injection_task_${taskN}`;
      sources[key] = { sys: 'agentdojo', id: key, ver: verStr(best), label: `AgentDojo ${suite} injection task ${taskN}`,
        url: blobUrl(selection.manifest, def.file) + `#L${def.line}`, quote: def.goal };
    }
  }

  for (const suite of Object.keys(selection.tools)) {
    const toolNames = selection.tools[suite];
    const toolFiles = selection.files.tools;
    for (const name of toolNames) {
      let hit = null;
      for (const fn of toolFiles) {
        const text = raws[fn];
        if (text == null) continue;
        const m = text.match(new RegExp(`def\\s+${name}\\s*\\(`));
        if (m) { hit = { file: fn, line: lineOf(text, m.index) }; break; }
      }
      if (!hit) throw new Error(`agentdojo: tool ${name} not found in tool files`);
      const key = `${suite}/tool/${name}`;
      sources[key] = { sys: 'agentdojo', id: key, ver: '1.0.0', label: `AgentDojo ${suite} tool ${name}`,
        url: blobUrl(selection.manifest, hit.file) + `#L${hit.line}` };
    }
  }

  return { nodes: [], links: [], sources, omitted: [] };
}
