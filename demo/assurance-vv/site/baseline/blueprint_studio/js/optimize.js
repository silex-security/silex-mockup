/* Candidate generation, patch application, eligibility gates and the
   recommendation rule (plan §4.7, contract §8). */

import { applyPatch, hashGraph, nodeById, makeNode, nextId, ok, fail, flowIn, flowOut } from './model.js';
import { validate, potentialPaths } from './validate.js';

/* ------------------------------------------------------------------- helpers */
function unauthNode(graph) { return graph.nodes.filter(n => n.type === 'prohibited' && n.config.monitor === 'unauthorized_write').sort((a, b) => a.id < b.id ? -1 : 1)[0]; }
function exposureNode(graph) { return graph.nodes.filter(n => n.type === 'prohibited' && n.config.monitor === 'secret_exposure').sort((a, b) => a.id < b.id ? -1 : 1)[0]; }
function dupNode(graph) { return graph.nodes.filter(n => n.type === 'prohibited' && n.config.monitor === 'duplicate_effect').sort((a, b) => a.id < b.id ? -1 : 1)[0]; }

function toolFor(graph, node) {
  const w = (node && node.config.watches) || [];
  return graph.nodes.find(n => n.type === 'tool' && w.includes(n.id)) || (w.length ? nodeById(graph, w[0]) : null);
}

function potentialOf(graph) { return potentialPaths(graph); }

/* the decision nearest the watched tool on its potential path(s) */
function gatingDecision(graph, potential, toolId) {
  let best = null, bestIdx = -1;
  for (const p of potential) {
    if (p.target !== toolId) continue;
    for (let i = 0; i < p.path.length; i++) {
      const n = nodeById(graph, p.path[i]);
      if (n && n.type === 'decision' && i > bestIdx) { best = n.id; bestIdx = i; }
    }
  }
  return best;
}

/* the first human/dual approval control on a potential path to the tool */
function approvalControl(graph, potential, toolId) {
  for (const p of potential) {
    if (p.target !== toolId) continue;
    for (const id of p.path) {
      const n = nodeById(graph, id);
      if (n && n.type === 'control' && n.config.kind !== 'policy_gate') return n.id;
    }
  }
  return null;
}

function takenIds(graph) {
  return { nodes: new Set(graph.nodes.map(n => n.id)), edges: new Set(graph.edges.map(e => e.id)) };
}
function alloc(set, prefix) { const id = nextId(set, prefix); set.add(id); return id; }

function downstreamTool(graph, agentId) {
  const seen = new Set([agentId]);
  const queue = [agentId];
  while (queue.length) {
    const id = queue.shift();
    for (const e of graph.edges) if (e.kind === 'flow' && e.from.node === id && !seen.has(e.to.node)) {
      const n = nodeById(graph, e.to.node);
      if (n.type === 'tool') return n.id;
      seen.add(e.to.node); queue.push(e.to.node);
    }
  }
  return null;
}

/* ---------------------------------------------------------------- generators */
export function generateCandidates(graph, validation) {
  const findings = validation.findings || [];
  /* A finding's class comes from its monitor and template together (plan §4.7):
     an unauthorized write is fixed by the threshold gate unless it came from a
     replayed approval (binding); duplicates by idempotency; exposure by the
     secret-flow patch. */
  const uw = f => f.monitor === 'unauthorized_write';
  const present = {
    threshold: findings.some(f => uw(f) && f.template !== 'replay'),
    binding: findings.some(f => uw(f) && f.template === 'replay'),
    idem: findings.some(f => f.monitor === 'duplicate_effect'),
    injection: findings.some(f => f.monitor === 'secret_exposure')
  };
  const candidates = [];
  const potential = potentialOf(graph);
  const un = unauthNode(graph);
  const toolId = un ? toolFor(graph, un)?.id : null;
  const t = un ? un.config.threshold : 0;
  const hi = un && Array.isArray(un.config.probeRange) ? un.config.probeRange[1] : 1000;
  const xs = t > 0 ? [t, 2 * t] : [0, hi / 2];                       // plan §4.7: t = 0 -> {0, hi/2}
  const thOptions = present.threshold ? ['amount', 'dayTotal'].flatMap(field => xs.map(x => ({ field, x }))) : [];
  const injOptions = present.injection ? [{ variant: 'a' }, { variant: 'b' }] : [];
  const optionsFor = classes => {
    const o = {};
    if (classes.includes('threshold')) o.threshold = thOptions;
    if (classes.includes('injection')) o.injection = injOptions;
    return o;
  };

  const singles = [];
  if (present.threshold && toolId) {
    for (const field of ['amount', 'dayTotal']) for (const x of xs) {
      singles.push({ id: `threshold:${field}:${x}`, classes: ['threshold'], params: { threshold: { field, x } } });
    }
  }
  if (present.binding) singles.push({ id: 'binding', classes: ['binding'], params: {} });
  if (present.idem && toolId) singles.push({ id: 'idem', classes: ['idem'], params: {} });
  if (present.injection) singles.push({ id: 'inj:a', classes: ['injection'], params: { injection: { variant: 'a' } } }, { id: 'inj:b', classes: ['injection'], params: { injection: { variant: 'b' } } });

  for (const s of singles) {
    candidates.push({ id: s.id, label: labelOf(s.classes, s.params), kind: 'single', classes: s.classes, params: s.params, paramOptions: optionsFor(s.classes), paramsVersion: 1, patch: buildPatch(graph, s.classes, s.params, potential, toolId) });
  }

  // composites: all parameter-free classes + one alternative per parameterised class
  const freeClasses = [present.binding ? 'binding' : null, present.idem ? 'idem' : null].filter(Boolean);
  const thXs = present.threshold ? xs : [];
  const injAlts = present.injection ? ['a', 'b'] : [null];
  const combos = [];
  if (present.threshold && present.injection) {
    for (const field of ['amount', 'dayTotal']) for (const x of thXs) for (const v of injAlts) combos.push({ threshold: { field, x }, injection: { variant: v } });
  } else if (present.threshold) {
    for (const field of ['amount', 'dayTotal']) for (const x of thXs) combos.push({ threshold: { field, x } });
  } else if (present.injection) {
    for (const v of injAlts) combos.push({ injection: { variant: v } });
  } else if (freeClasses.length) {
    combos.push({});
  }

  for (const combo of combos) {
    const classes = [...freeClasses];
    const params = { ...combo };
    if (combo.threshold) classes.push('threshold');
    if (combo.injection) classes.push('injection');
    const id = buildId(classes, params);
    candidates.push({ id, label: labelOf(classes, params), kind: 'composite', classes, params, paramOptions: optionsFor(classes), paramsVersion: 1, patch: buildPatch(graph, classes, params, potential, toolId) });
  }
  return candidates;
}

function buildId(classes, params) {
  const parts = [];
  if (classes.includes('threshold')) parts.push(`threshold:${params.threshold.field}:${params.threshold.x}`);
  if (classes.includes('binding')) parts.push('binding');
  if (classes.includes('idem')) parts.push('idem');
  if (classes.includes('injection')) parts.push(`inj:${params.injection.variant}`);
  return parts.join('+');
}

function labelOf(classes, params) {
  const parts = [];
  if (classes.includes('threshold')) parts.push(params.threshold.field === 'amount' ? `require approval above $${params.threshold.x}` : `aggregate daily total above $${params.threshold.x}`);
  if (classes.includes('binding')) parts.push('bind approval to customer, order, amount (single-use)');
  if (classes.includes('idem')) parts.push('idempotency key on the write');
  if (classes.includes('injection')) parts.push(params.injection.variant === 'a' ? 'move the secret read to the tool' : 'redact secrets before external emit');
  return parts.join(' · ') || 'no change';
}

/* ------------------------------------------------------------------- patches */
function buildPatch(graph, classes, params, potential, toolId) {
  const ops = [];
  if (classes.includes('binding')) ops.push(...bindingPatch(graph, potential, toolId));
  if (classes.includes('idem')) ops.push(...idemPatch(toolId));
  if (classes.includes('threshold')) ops.push(...thresholdPatch(graph, params.threshold.field, params.threshold.x, potential, toolId));
  if (classes.includes('injection')) ops.push(...injectionPatch(graph, params.injection.variant));
  return ops;
}

function bindingPatch(graph, potential, toolId) {
  const controlId = approvalControl(graph, potential, toolId);
  if (!controlId) return [];
  return [{ op: 'setConfig', id: controlId, key: 'binding', value: ['customer', 'order', 'amount'] }, { op: 'setConfig', id: controlId, key: 'singleUse', value: true }];
}

function idemPatch(toolId) {
  if (!toolId) return [];
  return [{ op: 'setConfig', id: toolId, key: 'idempotencyKey', value: true }];
}

function thresholdPatch(graph, field, x, potential, toolId) {
  if (!toolId) return [];
  const gate = gatingDecision(graph, potential, toolId);
  if (gate) return [{ op: 'setConfig', id: gate, key: 'condition', value: `${field} > ${x}` }];
  // no decision on the path: insert a decision + human control before the tool
  const ids = takenIds(graph);
  const inEdge = flowIn(graph, toolId).find(e => e.kind === 'flow');
  if (!inEdge) return [];
  const dec = nextId(ids.nodes, 'gate'), ctl = nextId(ids.nodes, 'approval');
  ids.nodes.add(dec); ids.nodes.add(ctl);
  const ops = [
    { op: 'removeEdge', id: inEdge.id },
    { op: 'addNode', node: makeNode('decision', dec, { label: `Gate ${field} > ${x}`, config: { condition: `${field} > ${x}` } }) },
    { op: 'addNode', node: makeNode('control', ctl, { label: 'Approval', config: { kind: 'human_approval', binding: ['customer'], slaMinutes: 15 } }) },
    { op: 'addEdge', edge: { id: alloc(ids.edges, 'e'), kind: 'flow', from: { node: inEdge.from.node, port: inEdge.from.port }, to: { node: dec, port: 'in' } } },
    { op: 'addEdge', edge: { id: alloc(ids.edges, 'e'), kind: 'flow', from: { node: dec, port: 'true' }, to: { node: ctl, port: 'in' } } },
    { op: 'addEdge', edge: { id: alloc(ids.edges, 'e'), kind: 'flow', from: { node: ctl, port: 'approved' }, to: { node: toolId, port: 'in' } } },
    { op: 'addEdge', edge: { id: alloc(ids.edges, 'e'), kind: 'flow', from: { node: dec, port: 'false' }, to: { node: toolId, port: 'in' } } }
  ];
  const failOutcome = graph.nodes.filter(n => n.type === 'outcome' && !n.config.success).sort((a, b) => a.id < b.id ? -1 : 1)[0];
  if (failOutcome) ops.push({ op: 'addEdge', edge: { id: alloc(ids.edges, 'e'), kind: 'flow', from: { node: ctl, port: 'denied' }, to: { node: failOutcome.id, port: 'in' } } });
  return ops;
}

function injectionPatch(graph, variant) {
  if (variant === 'a') {
    const ops = [];
    const secrets = graph.nodes.filter(n => n.type === 'data' && n.config.sensitivity === 'secret');
    const ids = takenIds(graph);
    for (const secret of secrets) {
      const accEdge = graph.edges.find(e => e.kind === 'access' && e.to.node === secret.id && nodeById(graph, e.from.node)?.type === 'agent');
      if (!accEdge) continue;
      const tool = downstreamTool(graph, accEdge.from.node);
      if (!tool) continue;
      ops.push({ op: 'removeEdge', id: accEdge.id });
      ops.push({ op: 'addEdge', edge: { id: alloc(ids.edges, 'a'), kind: 'access', mode: 'read', from: { node: tool, port: 'acc' }, to: { node: secret.id, port: 'acc' } } });
    }
    return ops;
  }
  // variant b: insert a redact gate before each external success outcome
  const ops = [];
  const ids = takenIds(graph);
  const failOutcome = graph.nodes.filter(n => n.type === 'outcome' && !n.config.success).sort((a, b) => a.id < b.id ? -1 : 1)[0];
  const successOutcomes = graph.nodes.filter(n => n.type === 'outcome' && n.config.success && n.config.external).sort((a, b) => a.id < b.id ? -1 : 1);
  for (const o of successOutcomes) {
    const inEdges = flowIn(graph, o.id).filter(e => e.kind === 'flow');
    for (const e of inEdges) {
      const gate = nextId(ids.nodes, 'redact');
      ids.nodes.add(gate);
      ops.push({ op: 'removeEdge', id: e.id });
      ops.push({ op: 'addNode', node: makeNode('control', gate, { label: 'Redact secrets', config: { kind: 'policy_gate', action: 'redact', redactAbove: 'internal', appliesWhen: '' } }) });
      ops.push({ op: 'addEdge', edge: { id: alloc(ids.edges, 'e'), kind: 'flow', from: { node: e.from.node, port: e.from.port }, to: { node: gate, port: 'in' } } });
      ops.push({ op: 'addEdge', edge: { id: alloc(ids.edges, 'e'), kind: 'flow', from: { node: gate, port: 'approved' }, to: { node: o.id, port: 'in' } } });
      if (failOutcome && failOutcome.id !== o.id) ops.push({ op: 'addEdge', edge: { id: alloc(ids.edges, 'e'), kind: 'flow', from: { node: gate, port: 'denied' }, to: { node: failOutcome.id, port: 'in' } } });
    }
  }
  return ops;
}

/* -------------------------------------------------------------------- run */
export function runCandidate(graph, candidate, scenarioSet, meta = {}) {
  const r = applyPatch(graph, candidate.patch);
  if (!r.ok) return r;
  const patchedGraph = r.value;
  const v = validate(patchedGraph, scenarioSet);
  return ok({ patchedGraph, patchedHash: hashGraph(patchedGraph, meta), lint: v.lint, potential: v.potential, runs: v.runs, findings: v.findings, metrics: v.metrics, patchOps: candidate.patch.length });
}

/* ------------------------------------------------------------------- score */
const frac = m => (m && m.den ? m.num / m.den : 0);

export function score(baseline, candResult) {
  const reasons = [];
  const lintErrors = (candResult.lint || []).filter(i => i.severity === 'error');
  if (lintErrors.length) reasons.push(`structural lint: ${lintErrors[0].code} (${lintErrors.length} errors)`);

  const bBenign = frac(baseline.metrics.benignCompletion);
  const cBenign = frac(candResult.metrics.benignCompletion);
  if (cBenign < bBenign - 0.02) reasons.push('benign completion dropped below baseline − 2pp');

  const baselineCount = id => (baseline.findings.find(f => f.id === id)?.violating) || 0;
  for (const f of candResult.findings) if (f.violating > baselineCount(f.id)) reasons.push(`${f.id} violations increased (${baselineCount(f.id)} → ${f.violating})`);
  for (const f of candResult.findings) if (f.severity === 'critical' && f.violating > 0) reasons.push(`critical ${f.id} still has ${f.violating} violations`);

  const closed = baseline.findings.filter(bf => !candResult.findings.some(cf => cf.id === bf.id && cf.violating > 0));
  const scorecard = {
    violationsClosed: { num: closed.length, den: baseline.findings.length },
    residualReachability: candResult.metrics.residualReachability,
    benignCompletion: candResult.metrics.benignCompletion,
    friction: candResult.metrics.friction,
    addedLatencyMedian: candResult.metrics.addedLatencyMedian,
    patchOps: candResult.patchOps || 0
  };
  return { eligible: reasons.length === 0, reasons, scorecard };
}

export function recommend(scored, rejectedIds = new Set()) {
  const eligible = scored.filter(s => s.verdict.eligible && !rejectedIds.has(s.candidate.id));
  if (!eligible.length) return null;
  eligible.sort((a, b) => {
    const fa = frac(a.verdict.scorecard.friction), fb = frac(b.verdict.scorecard.friction);
    if (fa !== fb) return fa - fb;
    const la = a.verdict.scorecard.addedLatencyMedian ?? 0, lb = b.verdict.scorecard.addedLatencyMedian ?? 0;
    if (la !== lb) return la - lb;
    return a.verdict.scorecard.patchOps - b.verdict.scorecard.patchOps;
  });
  return eligible[0].candidate.id;
}

/* ---------------------------------------------------------------- reparam */
export function reparam(graph, validation, candidate, params) {
  const next = { ...candidate.params, ...params };
  const potential = potentialOf(graph);
  const un = unauthNode(graph);
  const toolId = un ? toolFor(graph, un)?.id : null;
  return { ...candidate, params: next, paramsVersion: candidate.paramsVersion + 1, label: labelOf(candidate.classes, next), patch: buildPatch(graph, candidate.classes, next, potential, toolId) };
}

/* --------------------------------------------------------------- optimize */
export function optimize(graph, validation, scenarioSet, meta = {}) {
  const cands = generateCandidates(graph, validation);
  const scored = [];
  for (const cand of cands) {
    const r = runCandidate(graph, cand, scenarioSet, meta);
    if (!r.ok) continue;
    const verdict = score(validation, r.value);
    scored.push({ candidate: cand, result: r.value, verdict });
  }
  const recommended = recommend(scored, new Set());
  return { candidates: scored, recommended };
}
