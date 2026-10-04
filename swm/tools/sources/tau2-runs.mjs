/* Source module: τ²-bench retail results (public benchmark runs).
   Plan: logs/2026-10-03_SWM_L4_BENCHMARK_RUNS_PLAN.md (R3), Source R2.
   Contract: swm/tools/sources/CONTRACT.md — "L4 benchmark run modules".

   Reads the pinned result file and emits L4 `published` benchmark agent/tool/run/incident
   nodes. Selection is SEED.BENCHMARK_RUNS.tau2 plus inBundle, manifest, actionsByTool, limit. */

const collapse = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const cut = s => { const t = collapse(s); return t.length > 200 ? t.slice(0, 199).replace(/[\s,;:.!?]+\S*$/, '') + '…' : t; };
const blob = (repo, pin, path) => `https://github.com/${repo}/blob/${pin}/${path}`;

export function parse(raws, selection) {
  const raw = raws[selection.file];
  if (raw == null) throw new Error(`tau2-runs: missing raw ${selection.file}`);
  const entry = selection.manifest[selection.file];
  const repo = entry.repo, pin = entry.pin, path = entry.path;
  if (!repo || !pin || !path) throw new Error(`tau2-runs: result file lacks repo/path/pin in manifest`);

  const sims = JSON.parse(raw).simulations;
  if (!Array.isArray(sims)) throw new Error(`tau2-runs: no simulations array`);

  let failed = 0, refusalRuns = 0;
  const refusalById = new Map(selection.refusals.map(r => [r.text, r.hazard]));
  const mapped = [];
  for (const s of sims) {
    if (s.reward_info?.reward === 0) failed++;
    const refs = [];
    for (const m of s.messages || []) {
      if (m.role !== 'tool') continue;
      const c = String(m.content ?? '');
      for (const r of selection.refusals) if (c.includes(r.text) && !refs.includes(r.text)) refs.push(r.text);
    }
    if (refs.length) { refusalRuns++; mapped.push({ s, refs }); }
  }
  if (sims.length !== selection.expect.runs) throw new Error(`tau2-runs: ${sims.length} runs, expected ${selection.expect.runs}`);
  if (failed !== selection.expect.failed) throw new Error(`tau2-runs: ${failed} failed, expected ${selection.expect.failed}`);
  if (refusalRuns !== selection.expect.refusalRuns) throw new Error(`tau2-runs: ${refusalRuns} refusal runs, expected ${selection.expect.refusalRuns}`);
  if (sims.length > selection.limit) throw new Error(`tau2-runs: ${sims.length} runs exceed limit ${selection.limit}`);

  const nodes = [], links = [];
  const model = selection.model, domain = selection.domain;
  const toolSet = new Map();

  /* agent */
  nodes.push({ id: `bench:agent:tau2:${model}`, label: model, group: 'agent', layer: 4, kind: 'planner',
    def: cut(`Public benchmark agent ${model} (τ²-bench retail).`), review: 'published',
    src: [{ sys: 'tau2', id: model, label: `τ²-bench ${model}`, url: blob(repo, pin, path) }],
    benchmark: { source: 'tau2', model, label: model },
    parentLink: { t: 'ag:planner', pred: 'INSTANCE_OF', src: 'silex', review: 'curated' } });

  /* process each simulation */
  const runRows = [];
  for (const s of sims) {
    const toolResults = new Map();
    for (const m of s.messages || []) if (m.role === 'tool' && m.id) toolResults.set(m.id, m);
    const calls = [];
    const refs = [];
    for (const m of s.messages || []) {
      if (m.role !== 'assistant' || !Array.isArray(m.tool_calls)) continue;
      for (const tc of m.tool_calls) {
        const res = toolResults.get(tc.id);
        const ok = res ? !res.error : false;
        let refusal;
        if (res) for (const r of selection.refusals) if (String(res.content ?? '').includes(r.text)) { refusal = r.text; break; }
        const name = tc.name;
        toolSet.set(name, name);
        calls.push({ name, ok, ...(refusal ? { refusal } : {}) });
        if (refusal && !refs.includes(refusal)) refs.push(refusal);
      }
    }
    const reward = s.reward_info?.reward;
    const outcome = reward === 1 ? selection.outcome.pass : selection.outcome.fail;
    runRows.push({ s, calls, refs, outcome, reward });
  }

  /* tools */
  for (const name of toolSet.keys()) {
    nodes.push({ id: `bench:tool:tau2:retail:${name}`, label: `${name} (retail)`, group: 'tool', layer: 4, kind: 'tool-reg',
      def: cut(`Public benchmark tool ${name} (retail).`), review: 'published',
      src: [{ sys: 'tau2', id: `retail/${name}`, label: `τ²-bench retail tool ${name}`, url: blob(repo, pin, 'src/tau2/domains/retail/tools.py') }],
      benchmark: { source: 'tau2', suite: 'retail', tool: name },
      parentLink: { t: 'ag:tool-reg', pred: 'INSTANCE_OF', src: 'silex', review: 'curated' } });
    for (const act of selection.actionsByTool[`retail/tool/${name}`] || []) {
      if (selection.inBundle.has(act)) links.push({ s: `bench:tool:tau2:retail:${name}`, t: act, pred: 'IMPLEMENTS', src: 'silex', review: 'curated' });
    }
  }

  /* runs and incidents */
  for (const row of runRows) {
    const s = row.s, taskId = s.task_id, trial = s.trial;
    const rid = `bench:run:tau2:${model}:${taskId}:${trial}`;
    const firstUser = (s.messages || []).find(m => m.role === 'user');
    const benchmark = { source: 'tau2', model, suite: 'retail', taskId, trial, simulationId: s.id,
      outcome: row.outcome, reward: row.reward, calls: row.calls, refusals: row.refs };
    nodes.push({ id: rid, label: `${model} · retail · ${taskId} · trial ${trial}`, group: 'workflow', layer: 4, kind: 'trace',
      def: cut(firstUser?.content), review: 'published',
      src: [{ sys: 'tau2', id: rid, label: `τ²-bench run ${rid}`, url: blob(repo, pin, path) + `#simulation=${s.id}` }],
      benchmark, domain, parentLink: { t: 'ag:trace', pred: 'INSTANCE_OF', src: 'silex', review: 'curated' } });
    links.push({ s: rid, t: `bench:agent:tau2:${model}`, pred: 'EXECUTED_BY', src: 'tau2', review: 'published' });
    for (const c of row.calls) {
      const tid = `bench:tool:tau2:retail:${c.name}`;
      if (!links.some(l => l.s === rid && l.t === tid && l.pred === 'INVOKES')) links.push({ s: rid, t: tid, pred: 'INVOKES', src: 'tau2', review: 'published' });
    }
    links.push({ s: rid, t: `dom:${domain}`, pred: 'BELONGS_TO', src: 'silex', review: 'curated' });

    if (!row.refs.length) continue;
    const iid = `bench:inc:${rid.replace(/^bench:run:/, '')}`;
    const hazards = [...new Set(row.refs.map(r => refusalById.get(r)).filter(Boolean))];
    nodes.push({ id: iid, label: `Benchmark incident · attempt refused`, group: 'threat', layer: 4, kind: 'incident',
      def: cut(`Tool refused: ${row.refs.join('; ')}`), review: 'published',
      src: [{ sys: 'tau2', id: iid, label: `τ²-bench incident ${iid}`, url: blob(repo, pin, path) + `#simulation=${s.id}` }],
      benchmark: { source: 'tau2', status: 'attempt-refused', refusals: row.refs }, domain,
      parentLink: { t: rid, pred: 'OCCURRED_IN', src: 'silex', review: 'curated' } });
    links.push({ s: iid, t: `dom:${domain}`, pred: 'BELONGS_TO', src: 'silex', review: 'curated' });
    for (const h of hazards) links.push({ s: iid, t: `hz:${h}`, pred: 'EXHIBITS', src: 'silex', review: 'curated' });
  }

  nodes.sort((a, b) => a.id.localeCompare(b.id));
  links.sort((a, b) => `${a.s}|${a.t}|${a.pred}`.localeCompare(`${b.s}|${b.t}|${b.pred}`));
  return { nodes, links, sources: {}, omitted: [] };
}
