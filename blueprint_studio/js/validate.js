/* Structural lint, static potential paths, seeded validation (plan §4.4-4.5, contract §7). */

import { nodeById, portsOf } from './model.js';
import { check } from './expr.js';
import { runScenario } from './engine.js';
import { evaluateMonitors } from './monitors.js';

const CATEGORY = { benign: 'Policy Gap (normal operation)', below_threshold: 'Missing Approval', replay: 'Workflow Logic Risk', split: 'Cross-Agent Risk', duplicate_submit: 'Workflow Logic Risk', injection_exfil: 'Data Exposure' };
const TEMPLATE_ORDER = ['below_threshold', 'split', 'replay', 'duplicate_submit', 'injection_exfil', 'benign'];
const SEV = { critical: 0, high: 1, medium: 2 };

/* --------------------------------------------------------------------- lint */
export function lint(graph) {
  const issues = [];
  const nodes = graph.nodes, edges = graph.edges;
  const byId = n => nodes.find(x => x.id === n);
  const triggers = nodes.filter(n => n.type === 'trigger');
  const flowNodes = nodes.filter(n => n.type !== 'data' && n.type !== 'prohibited');

  if (!triggers.length) issues.push({ severity: 'error', code: 'no_trigger', message: 'A workflow needs a trigger node' });

  // reachability from triggers over flow edges
  const reachable = new Set();
  const queue = triggers.map(t => t.id);
  while (queue.length) {
    const id = queue.shift();
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const e of edges.filter(e => e.kind === 'flow' && e.from.node === id)) queue.push(e.to.node);
  }
  for (const n of flowNodes) if (!reachable.has(n.id)) issues.push({ severity: 'error', code: 'unreachable', message: `Unreachable ${n.type} "${n.label}"`, nodeId: n.id });

  // cycle detection over flow edges
  if (hasCycle(flowNodes.map(n => n.id), edges.filter(e => e.kind === 'flow'))) issues.push({ severity: 'error', code: 'cycle', message: 'The flow has a cycle' });

  // dangling out ports
  for (const n of flowNodes) {
    for (const port of portsOf(n).filter(p => p.kind === 'out')) {
      if (!edges.some(e => e.kind === 'flow' && e.from.node === n.id && e.from.port === port.id)) {
        issues.push({ severity: 'error', code: 'dangling_port', message: `Port ${n.id}.${port.id} has no edge`, nodeId: n.id });
      }
    }
  }

  // success outcome reachable from a trigger
  const successOutcomes = nodes.filter(n => n.type === 'outcome' && n.config.success);
  if (triggers.length && !successOutcomes.some(o => reachable.has(o.id))) {
    issues.push({ severity: 'error', code: 'no_success_outcome', message: 'No success outcome is reachable from a trigger' });
  }

  // unused data
  for (const d of nodes.filter(n => n.type === 'data')) {
    if (!edges.some(e => e.kind === 'access' && e.to.node === d.id)) issues.push({ severity: 'warning', code: 'unused_data', message: `Data "${d.label}" is not read`, nodeId: d.id });
  }

  // prohibited watches
  for (const p of nodes.filter(n => n.type === 'prohibited')) {
    const w = p.config.watches || [];
    if (!w.length) issues.push({ severity: 'error', code: 'no_watches', message: `Prohibited "${p.label}" watches nothing`, nodeId: p.id });
    for (const wid of w) {
      const t = byId(wid);
      if (!t || !['tool', 'outcome'].includes(t.type)) issues.push({ severity: 'error', code: 'bad_watch', message: `Watch target ${wid} is not a tool or outcome`, nodeId: p.id });
    }
  }

  // expressions: a decision condition and a blocking rule are required; appliesWhen is optional
  const exprIssue = (n, what, src) => {
    const r = check(src);
    if (!r.ok) issues.push({ severity: 'error', code: r.error.code === 'expr_unknown_identifier' ? 'expr_unknown_identifier' : 'expr_syntax', message: `Bad ${what} in "${n.label}": ${r.error.message}`, nodeId: n.id });
  };
  const blank = v => v == null || String(v).trim() === '';
  for (const n of nodes) {
    if (n.type === 'decision') {
      if (blank(n.config.condition)) issues.push({ severity: 'error', code: 'missing_config', message: `Decision "${n.label}" has no condition`, nodeId: n.id });
      else exprIssue(n, 'condition', n.config.condition);
    }
    if (n.type === 'control') {
      if (!blank(n.config.appliesWhen)) exprIssue(n, 'appliesWhen', n.config.appliesWhen);
      if (n.config.kind === 'policy_gate' && n.config.action === 'block') {
        if (blank(n.config.rule)) issues.push({ severity: 'error', code: 'missing_config', message: `Blocking gate "${n.label}" has no rule`, nodeId: n.id });
        else exprIssue(n, 'rule', n.config.rule);
      }
    }
    if (n.type === 'prohibited' && n.config.monitor !== 'secret_exposure' && blank(n.config.cap))
      issues.push({ severity: 'error', code: 'missing_config', message: `Prohibited "${n.label}" has no capability`, nodeId: n.id });
  }

  // write tool with empty cap
  for (const t of nodes.filter(n => n.type === 'tool' && n.config.sideEffect === 'write')) {
    if (!t.config.cap) issues.push({ severity: 'error', code: 'missing_config', message: `Write tool "${t.label}" has no capability`, nodeId: t.id });
  }

  return issues;
}

function hasCycle(ids, edges) {
  const adj = {}; for (const id of ids) adj[id] = [];
  for (const e of edges) if (adj[e.from.node]) adj[e.from.node].push(e.to.node);
  const visiting = new Set(), done = new Set();
  const dfs = id => {
    visiting.add(id);
    for (const next of adj[id] || []) {
      if (visiting.has(next)) return true;
      if (!done.has(next) && dfs(next)) return true;
    }
    visiting.delete(id); done.add(id);
    return false;
  };
  for (const id of ids) if (!done.has(id) && dfs(id)) return true;
  return false;
}

/* ------------------------------------------------------------ potential paths */
export function potentialPaths(graph) {
  const out = [];
  const edges = graph.edges.filter(e => e.kind === 'flow');
  const triggers = graph.nodes.filter(n => n.type === 'trigger' && n.config.trust === 'untrusted').sort((a, b) => a.id < b.id ? -1 : 1);
  const prohibited = graph.nodes.filter(n => n.type === 'prohibited').sort((a, b) => a.id < b.id ? -1 : 1);
  for (const trig of triggers) {
    for (const p of prohibited) {
      for (const target of (p.config.watches || [])) {
        const paths = allPaths(trig.id, target, edges);
        for (const path of paths) {
          const guards = path.slice(0, -1).map(id => nodeById(graph, id)).filter(n => n && (n.type === 'decision' || n.type === 'control')).map(n => n.id);
          out.push({ prohibited: p.id, target, path, guards });
        }
      }
    }
  }
  return out;
}

function allPaths(from, to, edges) {
  const adj = {};
  for (const e of edges) { (adj[e.from.node] = adj[e.from.node] || []).push(e.to.node); }
  const results = [];
  const walk = (node, path) => {
    if (node === to) { results.push(path.slice()); return; }
    if (path.length > 50) return;
    for (const next of adj[node] || []) if (!path.includes(next)) walk(next, path.concat(next));
  };
  walk(from, [from]);
  return results;
}

/* --------------------------------------------------------------------- runs */
export function runScenarios(graph, scenarios) {
  return scenarios.map(s => { const session = runScenario(graph, s); return { scenarioId: s.id, template: s.template, session, monitors: evaluateMonitors(graph, session) }; });
}

/* ---------------------------------------------------------------- summarize */
export function summarize(graph, runs) {
  const prohibited = graph.nodes.filter(n => n.type === 'prohibited').sort((a, b) => a.id < b.id ? -1 : 1);
  const findings = [];
  const byMonitor = {};
  for (const p of prohibited) {
    byMonitor[p.id] = { violating: 0, run: runs.length };
    for (const t of TEMPLATE_ORDER) {
      const rts = runs.filter(r => r.template === t);
      if (!rts.length) continue;
      const violating = rts.filter(r => r.monitors.some(m => m.node === p.id && m.violations.length > 0));
      if (violating.length) {
        byMonitor[p.id].violating += violating.length;
        findings.push({
          id: `${p.id}:${t}`, prohibited: p.id, monitor: p.config.monitor, template: t,
          category: CATEGORY[t], severity: p.config.severity,
          violating: violating.length, run: rts.length,
          paths: violatingPaths(violating, p.id),
          grade: 'Declared'
        });
      }
    }
  }
  findings.sort((a, b) => SEV[a.severity] - SEV[b.severity] || (a.prohibited < b.prohibited ? -1 : 1) || (TEMPLATE_ORDER.indexOf(a.template) - TEMPLATE_ORDER.indexOf(b.template)));

  const metrics = summarizeMetrics(runs, prohibited, byMonitor);
  return { findings, metrics };
}

function violatingPaths(violatingRuns, prohibitedId) {
  const counts = {};
  for (const run of violatingRuns) {
    const ms = run.monitors.find(m => m.node === prohibitedId);
    for (const v of (ms ? ms.violations : [])) {
      const act = run.session.activations.find(a => a.id === v.activation);
      const key = JSON.stringify(act ? act.path : []);
      counts[key] = (counts[key] || 0) + 1;
    }
  }
  return Object.entries(counts).map(([k, count]) => ({ nodes: JSON.parse(k), count }));
}

function summarizeMetrics(runs, prohibited, byMonitor) {
  const adversarial = runs.filter(r => r.template !== 'benign');
  const benign = runs.filter(r => r.template === 'benign');
  const violated = r => r.monitors.some(m => m.violations.length > 0);
  const advViolating = adversarial.filter(violated);
  const benViolating = benign.filter(violated);
  const benSuccess = benign.filter(r => r.session.activations.some(a => a.status === 'success'));
  const benFriction = benign.filter(r => r.session.humanApprovals > 0);
  const lats = benign.map(r => r.session.latencyMinutes).sort((a, b) => a - b);
  const median = n => n.length ? (n.length % 2 ? n[Math.floor(n.length / 2)] : (n[n.length / 2 - 1] + n[n.length / 2]) / 2) : null;
  return {
    byMonitor,
    residualReachability: { num: advViolating.length, den: adversarial.length },
    benignCompletion: { num: benSuccess.length, den: benign.length },
    benignPolicyViolations: { num: benViolating.length, den: benign.length },
    friction: { num: benFriction.length, den: benign.length },
    addedLatencyMedian: median(lats)
  };
}

/* ---------------------------------------------------------------- validate */
export function validate(graph, scenarioSet) {
  const lints = lint(graph);
  const potential = potentialPaths(graph);
  const runs = runScenarios(graph, scenarioSet.scenarios);
  const { findings, metrics } = summarize(graph, runs);
  return { scenarioSetId: scenarioSet.id, lint: lints, potential, runs, findings, metrics };
}

/* The stored form of a validation or candidate result (full traces are
   recomputed on demand; the engine is deterministic). */
export function compactResult(res) {
  return { findings: res.findings, metrics: res.metrics, lint: res.lint || [], potential: res.potential || [], patchedHash: res.patchedHash,
    runs: (res.runs || []).map(r => ({ scenarioId: r.scenarioId, template: r.template, violating: r.monitors.some(m => m.violations.length > 0) })) };
}
