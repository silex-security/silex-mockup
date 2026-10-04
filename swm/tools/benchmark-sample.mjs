/* L4 bundle sample of the public benchmark runs (plan logs/2026-10-04_SWM_L4_SAMPLING_PLAN.md).

   Input: one run parser's output ({ nodes, links }) and SEED.BENCHMARK_SAMPLE. Output: the same shape with
   fewer runs, plus a summary. Agents and tools are always kept; a run is kept with its incident, and an
   incident is never kept without its run. Agent nodes gain `benchmark.population` (full counts per suite)
   and `benchmark.shown` (runs in the sample), so the inspector never presents sample counts as rates. */
import { createHash } from 'node:crypto';

const hash = s => createHash('sha256').update(s).digest('hex');
const byHash = (a, b) => (a.h < b.h ? -1 : a.h > b.h ? 1 : 0);

export function sampleBenchmark(out, policy) {
  const nodes = out.nodes || [], links = out.links || [];
  const runs = nodes.filter(n => n.kind === 'trace');
  const incidentOf = new Map(nodes.filter(n => n.kind === 'incident').map(n => [n.parentLink?.t, n]));
  const agentId = r => `bench:agent:${r.benchmark.source}:${r.benchmark.model}`;
  const harmful = r => policy.harmful.includes(r.benchmark.outcome);
  const items = runs.map(r => ({ r, h: hash(r.id), pack: r.domain, inc: incidentOf.has(r.id) }));

  /* always kept (typical examples) */
  const keep = new Set(), why = {};
  const add = (it, reason) => { if (!keep.has(it.r.id)) { keep.add(it.r.id); why[reason] = (why[reason] || 0) + 1; } };
  if (policy.keep.incidentRuns) for (const it of items) if (it.inc) add(it, 'incident');
  for (const rule of policy.keep.agentdojo || [])
    for (const it of items) if (it.r.benchmark.source === 'agentdojo' && it.r.benchmark.suite === rule.suite &&
      +it.r.benchmark.injectionTask === rule.injectionTask) add(it, `${rule.suite} injection task ${rule.injectionTask}`);
  const cells = new Map();
  for (const it of items.filter(i => i.r.benchmark.source === 'agentdojo')) {
    const k = `${it.r.benchmark.model}|${it.r.benchmark.suite}|${it.r.benchmark.injectionTask}`;
    (cells.get(k) || cells.set(k, []).get(k)).push(it);
  }
  for (const cell of cells.values()) {
    const resisted = cell.filter(i => i.r.benchmark.outcome === policy.keep.notExecutedPerCell).sort(byHash);
    if (resisted.length && !resisted.some(i => keep.has(i.r.id))) add(resisted[0], 'resisted attempt per cell');
  }
  for (const outcome of policy.keep.tau2OutcomesPerModel || []) {
    const models = [...new Set(items.filter(i => i.r.benchmark.source === 'tau2').map(i => i.r.benchmark.model))];
    for (const m of models) {
      const c = items.filter(i => i.r.benchmark.source === 'tau2' && i.r.benchmark.model === m && i.r.benchmark.outcome === outcome).sort(byHash);
      if (c.length && !c.some(i => keep.has(i.r.id))) add(c[0], `τ² ${outcome} baseline`);
    }
  }

  /* per-pack quota, filled by stratified largest-remainder allocation */
  const packs = {};
  for (const pack of [...new Set(items.map(i => i.pack))].sort()) {
    const inPack = items.filter(i => i.pack === pack);
    const always = inPack.filter(i => keep.has(i.r.id)).length;
    const quota = Math.max(Math.ceil(inPack.length / policy.ratio), always);
    const rest = inPack.filter(i => !keep.has(i.r.id));
    const strata = new Map();
    for (const it of rest) {
      const k = policy.strata.map(f => it.r.benchmark[f]).join('|');
      (strata.get(k) || strata.set(k, []).get(k)).push(it);
    }
    let fill = quota - always;
    const alloc = [...strata].map(([k, list]) => {
      const exact = rest.length ? (fill * list.length) / rest.length : 0;
      return { k, list: list.sort(byHash), n: Math.floor(exact), frac: exact - Math.floor(exact) };
    });
    let left = fill - alloc.reduce((a, s) => a + s.n, 0);
    for (const s of [...alloc].sort((a, b) => b.frac - a.frac || (a.k < b.k ? -1 : 1))) { if (left <= 0) break; s.n++; left--; }
    for (const s of alloc) for (const it of s.list.slice(0, s.n)) add(it, 'stratified fill');
    packs[pack] = { label: policy.packs[pack] || pack, population: inPack.length, quota, alwaysKept: always,
      kept: inPack.filter(i => keep.has(i.r.id)).length };
  }

  /* agent population (full) and shown (sample) per suite */
  const population = new Map();
  for (const it of items) {
    const a = agentId(it.r), s = it.r.benchmark.suite;
    const p = (population.get(a) || population.set(a, {}).get(a));
    const row = (p[s] ||= { runs: 0, harmful: 0, shown: 0 });
    row.runs++; if (harmful(it.r)) row.harmful++; if (keep.has(it.r.id)) row.shown++;
  }

  const dropped = new Set(runs.filter(r => !keep.has(r.id)).map(r => r.id));
  for (const n of nodes) if (n.kind === 'incident' && dropped.has(n.parentLink?.t)) dropped.add(n.id);
  const outNodes = nodes.filter(n => !dropped.has(n.id)).map(n => {
    if (n.kind !== 'planner' || !population.has(n.id)) return n;
    const pop = population.get(n.id);
    return { ...n, benchmark: { ...n.benchmark,
      population: Object.fromEntries(Object.entries(pop).map(([s, v]) => [s, { runs: v.runs, harmful: v.harmful }])),
      shown: Object.fromEntries(Object.entries(pop).map(([s, v]) => [s, v.shown])) } };
  });
  const outLinks = links.filter(l => !dropped.has(l.s) && !dropped.has(l.t));
  const incidents = nodes.filter(n => n.kind === 'incident');
  return {
    ...out, nodes: outNodes, links: outLinks,
    sample: { runs: { population: runs.length, kept: keep.size }, incidents: { population: incidents.length,
      kept: incidents.filter(n => !dropped.has(n.id)).length }, packs, keptBy: why }
  };
}
