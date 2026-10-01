/* Decision Trace derivation (plan §3.1–§3.4.2, §6 row 2; contract in web/src/trace/CONTRACT.md).
   Pure: no React, no store import, no DOM, no i18n. Reads a store document (read-only)
   plus the ontology slice and returns the Trace data structure the UI renders. Every
   count comes from the stored results or the slice; nothing is fabricated. */
import { potentialPaths } from '../../../js/validate.js';
import { recommend } from '../../../js/optimize.js';
import { revLabel } from '../../../js/store.js';
import { STEP_CLASS, FAMILIES, describePatch, publicUrl } from './mapping.js';

const sameSet = (a, b) => {
  const A = [...a].sort(), B = [...b].sort();
  return A.length === B.length && A.every((x, i) => x === B[i]);
};

function revisionOf(doc, revNo) { return doc.revisions.find(r => r.rev === revNo) || null; }

/* ------------------------------------------------------------------ schema */
function buildSchema(graph, slice) {
  const classById = new Map(slice.classes.map(c => [c.id, c]));
  const threatById = new Map(slice.threats.map(t => [t.id, t]));
  const threatsByClass = new Map();            // classId -> [{ threatId, label, src }]
  const threatClass = new Map();               // threatId -> classId (first THREATENS target)
  for (const l of slice.links) {
    if (l.pred !== 'THREATENS') continue;
    if (!threatsByClass.has(l.t)) threatsByClass.set(l.t, []);
    threatsByClass.get(l.t).push({ threatId: l.s, label: threatById.get(l.s)?.label || l.s, src: l.src });
    if (!threatClass.has(l.s)) threatClass.set(l.s, l.t);
  }

  const steps = graph.nodes.map(n => {
    const m = STEP_CLASS(n);
    return { id: n.id, label: n.label, type: n.type, classId: m.classId, criterion: m.criterion, reason: m.reason };
  });
  const mappedCount = steps.filter(s => s.classId).length;

  const instantiatedIds = [...new Set(steps.filter(s => s.classId).map(s => s.classId))];
  const classes = instantiatedIds.map(id => ({
    id, label: classById.get(id)?.label || id, def: classById.get(id)?.def || '',
    stepIds: steps.filter(s => s.classId === id).map(s => s.id),
  }));

  const associated = [];
  for (const classId of instantiatedIds) {
    for (const t of threatsByClass.get(classId) || []) {
      const existing = associated.find(a => a.threatId === t.threatId);
      if (existing) { existing.classIds.push(classId); continue; }
      associated.push({ threatId: t.threatId, label: t.label, classId, classIds: [classId], url: publicUrl(t.threatId), src: t.src });
    }
  }

  const related = [];
  for (const fam of FAMILIES) {
    for (const r of fam.related) {
      if (related.some(x => x.threatId === r.threatId && x.family === fam.id)) continue;   // one entry per (family, threat): each has its own limit
      const cls = threatClass.get(r.threatId) || null;
      related.push({
        threatId: r.threatId, label: threatById.get(r.threatId)?.label || r.threatId,
        family: fam.id, limit: r.limit, url: publicUrl(r.threatId),
        instantiated: cls ? instantiatedIds.includes(cls) : false, classId: cls,
      });
    }
  }

  const uniq = xs => new Set(xs.map(r => r.threatId)).size;           // counts are over distinct threat ids
  const relatedInstantiated = uniq(related.filter(r => r.instantiated));
  const counts = {
    associated: associated.length,
    relatedInstantiated,
    withoutRelatedFamily: associated.length - relatedInstantiated,
    relatedOutside: uniq(related.filter(r => !r.instantiated)),
  };

  return { steps, mappedCount, unmappedCount: steps.length - mappedCount, classes, associated, related, counts };
}

/* -------------------------------------------------------------------- laws */
function buildLaws(result) {
  if (!result || !Array.isArray(result.runs)) return null;
  const families = FAMILIES.map(fam => {
    const famRuns = result.runs.filter(r => r.template === fam.id);
    return {
      id: fam.id, law: fam.law, related: fam.related.map(r => ({ threatId: r.threatId, limit: r.limit })), sampling: fam.sampling,
      runs: famRuns.length, violatingRuns: famRuns.filter(r => r.violating).length,
    };
  });
  return { families };
}

/* --------------------------------------------------------------- world state */
function buildWorldState(rev, graph) {
  const potential = (rev.validation && rev.validation.result && Array.isArray(rev.validation.result.potential))
    ? rev.validation.result.potential : potentialPaths(graph);
  return { paths: potential.map(p => ({ prohibited: p.prohibited, target: p.target, path: p.path, guards: p.guards })) };
}

/* -------------------------------------------------------------- attribution */
function attribute(graph, finding) {
  const prohibited = graph.nodes.find(n => n.id === finding.prohibited);
  const isExposure = finding.monitor === 'secret_exposure';
  const cap = prohibited ? prohibited.config.cap : null;
  const steps = new Set();
  for (const p of finding.paths || []) {
    for (const nid of p.nodes || []) {
      const node = graph.nodes.find(n => n.id === nid);
      if (!node) continue;
      if (isExposure) { if (node.type === 'outcome' && node.config.external) steps.add(node.id); }
      else if (node.type === 'tool' && node.config.sideEffect === 'write' && node.config.cap === cap) steps.add(node.id);
    }
  }
  return [...steps];
}

/* --------------------------------------------------------------- simulation */
function buildSimulation(rev, graph) {
  if (!rev.validation || !rev.validation.result) return null;
  const result = rev.validation.result;
  const findings = (result.findings || []).map(f => {
    const fam = FAMILIES.find(x => x.id === f.template);
    const prohibited = graph.nodes.find(n => n.id === f.prohibited);
    const attributed = attribute(graph, f);
    const declaredWatch = (prohibited && Array.isArray(prohibited.config.watches)) ? prohibited.config.watches : [];
    return {
      id: f.id, prohibited: f.prohibited, monitor: f.monitor, family: f.template, severity: f.severity,
      violating: f.violating, run: f.run, paths: f.paths || [],
      attributed, declaredWatch, attributionDiffers: !sameSet(attributed, declaredWatch),
      law: fam ? fam.law : null, related: fam ? fam.related.map(r => r.threatId) : [],
    };
  });
  return {
    runs: (result.runs || []).length,
    adversarial: result.metrics?.residualReachability || { num: 0, den: 0 },
    benign: result.metrics?.benignPolicyViolations || { num: 0, den: 0 },
    findings,
  };
}

/* --------------------------------------------------------------- candidates */
function closesFindings(baselineFindings, candResult) {
  if (!baselineFindings || !candResult || !Array.isArray(candResult.findings)) return [];
  const candIds = new Set(candResult.findings.filter(f => f.violating > 0).map(f => f.id));
  return baselineFindings.filter(f => !candIds.has(f.id)).map(f => f.id);
}

function buildCandidates(rev, graph, baselineFindings) {
  const o = rev.optimization;
  if (!o) return { candidates: null, recommended: null };
  const approvedId = (rev.decision && rev.decision.action === 'approve') ? rev.decision.candidateId : null;

  const candidates = o.candidates.map(c => {
    const cand = c.candidate;
    const currentTested = c.state === 'tested' && c.testedParamsVersion === cand.paramsVersion;
    let state, eligible = null, reasons = [], scorecard = null, closes = [];
    if (c.state === 'rejected') {
      state = 'rejected';
      eligible = c.verdict ? c.verdict.eligible : null;      // historical verdict, shown as history
      reasons = c.verdict ? (c.verdict.reasons || []) : [];
      scorecard = c.verdict ? (c.verdict.scorecard || null) : null;
    } else if (c.state === 'stale' || c.testedParamsVersion !== cand.paramsVersion) {
      state = 'stale';
    } else {
      state = approvedId === cand.id ? 'approved' : (c.verdict.eligible ? 'eligible' : 'ineligible');
      eligible = c.verdict.eligible;
      reasons = c.verdict.reasons || [];
      scorecard = c.verdict.scorecard || null;
      closes = closesFindings(baselineFindings, c.result);
    }
    return {
      id: cand.id, label: cand.label, state,
      paramsVersion: cand.paramsVersion, testedParamsVersion: c.testedParamsVersion, runId: c.runId,
      eligible, reasons, scorecard,
      changes: describePatch(graph, cand.patch),
      closes,
    };
  });

  const recommended = recommend(
    o.candidates.filter(c => c.state === 'tested' && c.testedParamsVersion === c.candidate.paramsVersion)
      .map(c => ({ candidate: c.candidate, result: c.result, verdict: c.verdict })),
    new Set(o.candidates.filter(c => c.state === 'rejected').map(c => c.candidate.id)),
  );

  return { candidates, recommended };
}

/* ----------------------------------------------------------------- decision */
function buildDecision(rev, doc) {
  const decisionRev = rev.origin === 'approve' ? (revisionOf(doc, rev.parent) || rev) : rev;
  const d = decisionRev.decision;
  if (!d) return null;
  if (d.action === 'approve')
    return { action: 'approve', candidateId: d.candidateId, childRevLabel: revLabel(d.childRev), childHash: d.childHash, decidedAt: d.decidedAt };
  return { action: 'accept', candidateId: null, childRevLabel: null, childHash: null, decidedAt: d.decidedAt };
}

function buildBinding(rev, doc) {
  if (rev.origin === 'approve') {
    const parent = revisionOf(doc, rev.parent);
    return { kind: 'approvedChild', parent: parent ? { revLabel: revLabel(parent.rev), hash: parent.hash } : null, child: null };
  }
  const child = (rev.decision && rev.decision.action === 'approve')
    ? { revLabel: revLabel(rev.decision.childRev), hash: rev.decision.childHash } : null;
  if (rev.validation || rev.optimization || rev.decision) return { kind: 'evaluated', parent: null, child };
  if (rev.status === 'confirmed') return { kind: 'confirmed', parent: null, child: null };
  return { kind: 'draft', parent: null, child: null };
}

/* -------------------------------------------------------------- statement */
function citedResult(rev, doc) {
  if (rev.origin === 'approve') {
    const r = rev.validation && rev.validation.result ? rev.validation.result : null;
    if (!r) return null;
    return { findings: r.findings || [], metrics: r.metrics || {}, generatedFrom: `the candidate run on ${revLabel(rev.parent)}` };
  }
  const d = rev.decision;
  if (!d) return null;
  if (d.action === 'approve') {
    const cand = rev.optimization?.candidates.find(x => x.candidate.id === d.candidateId);
    if (!cand || !cand.result) return null;
    return { findings: cand.result.findings || [], metrics: cand.result.metrics || {}, generatedFrom: `candidate run ${cand.runId || ''}`.trim() };
  }
  if (d.action === 'accept') {
    if (!rev.validation || !rev.validation.result) return null;
    return { findings: rev.validation.result.findings || [], metrics: rev.validation.result.metrics || {}, generatedFrom: `validation ${rev.validation.jobId || ''}`.trim() };
  }
  return null;
}

function statementText(violationsFound, zeroViolations, version, generatedFrom) {
  const clauses = [];
  if (violationsFound.length) {
    clauses.push(violationsFound.map(v => `${v.violating} violations in ${v.run} simulated runs (${v.label})`).join('; '));
  } else {
    clauses.push('No violations in the simulated runs');
  }
  for (const z of zeroViolations) clauses.push(`0 in ${z.runs} runs for ${z.label}`);
  return `Under ${generatedFrom}: ${clauses.join('; ')}. As of ontology ${version}, from this declaration. Not a certification.`;
}

function buildStatement(rev, doc, slice, schema) {
  const cited = citedResult(rev, doc);
  if (!cited) return null;
  const graph = rev.graph;
  const prohibited = graph.nodes.filter(n => n.type === 'prohibited');
  const findings = cited.findings;
  const violationsFound = findings.filter(f => f.violating > 0).map(f => {
    const p = prohibited.find(x => x.id === f.prohibited);
    return { finding: f.id, label: p ? p.label : f.prohibited, violating: f.violating, run: f.run };
  });
  const zeroViolations = prohibited
    .filter(p => !findings.some(f => f.prohibited === p.id && f.violating > 0))
    .map(p => ({ prohibited: p.id, label: p.label, runs: cited.metrics?.byMonitor?.[p.id]?.run ?? 0 }));
  const notSimulated = [
    `${schema.counts.withoutRelatedFamily} associated threat classes have no related family`,
    'Calibration',
  ];
  return {
    generatedFrom: cited.generatedFrom, violationsFound, zeroViolations, notSimulated,
    text: statementText(violationsFound, zeroViolations, slice.version, cited.generatedFrom),
  };
}

/* --------------------------------------------------------------- rationale */
function buildRationale(graph, simulation) {
  // Assembled only from declarations on the finding's most frequent violating path (plan §3.4.1, C5):
  // the trigger's declared trust, the last agent before the effect and its declared capability, and any
  // approval on that path. Ambiguity (several possible producers) is said, not resolved.
  if (!simulation || !simulation.findings.length) return null;
  const f = simulation.findings[0];
  const byId = id => graph.nodes.find(n => n.id === id);
  const top = [...(f.paths || [])].sort((a, b) => b.count - a.count)[0];
  const path = (top ? top.nodes : []).map(byId).filter(Boolean);
  if (!path.length) return null;
  const names = xs => xs.map(n => n.label).join(', ');
  const trig = path.find(n => n.type === 'trigger');
  const trust = trig && trig.config ? trig.config.trust : null;
  const from = trig ? `${trust === 'untrusted' ? 'an untrusted' : trust ? `a ${trust}` : 'a'} trigger (${trig.label})` : "the path's entry";
  const effect = (f.attributed || []).map(byId).filter(n => n && path.includes(n));
  if (f.monitor === 'secret_exposure') {
    const outs = effect.filter(n => n.type === 'outcome');
    const where = outs.length > 1 ? `one of the external outcomes (${names(outs)})` : outs.length ? `an external outcome (${outs[0].label})` : 'an external outcome';
    return `On its most frequent violating path, a secret-labelled read reaches ${where}, starting from ${from}.`;
  }
  const tools = effect.filter(n => n.type === 'tool').sort((x, y) => path.indexOf(x) - path.indexOf(y));
  const what = tools.length > 1 ? `one of the write tools (${names(tools)})` : tools.length ? `a write tool (${tools[0].label})` : 'a monitored write';
  // Context is stated only for the path prefix before the FIRST possible write, and says so (Codex r2).
  const first = tools[0] || null;
  const before = path.slice(0, first ? path.indexOf(first) : path.length);
  const target = tools.length > 1 ? `the first of them (${first.label})` : 'it';
  const agent = [...before].reverse().find(n => n.type === 'agent');
  const cap = first ? first.config.cap : null;
  const decl = agent && cap ? (agent.config.capabilities || []).find(c => c.cap === cap) : null;
  const via = agent ? `; the last agent before ${target} is ${agent.label}${decl ? `, which declares ${cap}${decl.limit != null ? ` ≤ $${decl.limit}` : ''}` : ''}` : '';
  const approval = [...before].reverse().find(n => n.type === 'control' && n.config.kind !== 'policy_gate');
  const appr = !first ? ''
    : approval ? `; ${approval.label} precedes ${tools.length > 1 ? 'that write' : 'the write'}, bound to ${(approval.config.binding || []).join(', ') || 'no field'} and ${approval.config.singleUse ? 'single-use' : 'reusable'}`
    : `; no approval step precedes ${tools.length > 1 ? 'that write' : 'the write'}`;
  return `On its most frequent violating path, ${what} is reached from ${from}${via}${appr}.`;
}

/* ------------------------------------------------------------------ thread */
function buildThread(graph, simulation, candidates, decision, slice) {
  const sliceThreat = new Map(slice.threats.map(t => [t.id, t]));
  const sliceClass = new Map(slice.classes.map(c => [c.id, c]));
  const threatClass = new Map();
  for (const l of slice.links) if (l.pred === 'THREATENS' && !threatClass.has(l.s)) threatClass.set(l.s, l.t);
  const familyById = new Map(FAMILIES.map(f => [f.id, f]));

  const nodes = [];
  const edges = [];
  const seen = new Set();
  const add = (id, column, kind, label, ref, state) => {
    const key = `${column}:${id}`;
    if (seen.has(key)) return key;
    seen.add(key);
    nodes.push({ id: key, column, kind, label, ref, ...(state !== undefined ? { state } : {}) });
    return key;
  };
  const link = (from, to, style, label) => edges.push({ id: `e:${from}>${to}:${edges.length}`, from, to, style, ...(label ? { label } : {}) });

  const stepIds = new Set();
  for (const f of simulation?.findings || []) for (const s of f.attributed || []) stepIds.add(s);
  for (const c of candidates || []) for (const ch of c.changes || []) if (ch.stepId) stepIds.add(ch.stepId);

  for (const sid of stepIds) {
    const node = graph.nodes.find(n => n.id === sid);
    if (!node) continue;
    const stepKey = add(sid, 0, 'step', node.label, sid);
    const cls = STEP_CLASS(node).classId;
    if (cls) link(stepKey, add(cls, 1, 'class', sliceClass.get(cls)?.label || cls, cls), 'association');
  }

  const findingById = new Map();
  for (const f of simulation?.findings || []) {
    const fKey = add(f.id, 4, 'finding', f.id, f.id);
    findingById.set(f.id, fKey);
    const fam = familyById.get(f.family);
    if (fam) {
      const famKey = add(fam.id, 3, 'family', fam.id, fam.id);
      link(famKey, fKey, 'simulated');
      for (const r of fam.related) {
        const tKey = add(r.threatId, 2, 'threat', sliceThreat.get(r.threatId)?.label || r.threatId, r.threatId);
        link(tKey, famKey, 'association', r.limit);
        const cls = threatClass.get(r.threatId);
        if (cls && seen.has(`1:${cls}`)) link(`1:${cls}`, tKey, 'association');
      }
    }
    for (const w of f.declaredWatch || []) {
      link(fKey, add(w, 0, 'step', graph.nodes.find(n => n.id === w)?.label || w, w), 'declared');
    }
  }

  const candidateById = new Map();
  for (const c of candidates || []) {
    const cKey = add(c.id, 5, 'candidate', c.label, c.id, c.state);
    candidateById.set(c.id, cKey);
    for (const fId of c.closes || []) {
      const fKey = findingById.get(fId);
      if (fKey) link(fKey, cKey, 'simulated');
    }
  }

  if (decision && decision.action === 'approve' && decision.candidateId) {
    const dKey = add('decision', 6, 'decision', decision.childRevLabel || 'approved', decision.childRevLabel);
    const cKey = candidateById.get(decision.candidateId);
    if (cKey) link(cKey, dKey, 'simulated');
  }

  return { nodes, edges };
}

/* ------------------------------------------------------------------ funnel */
function buildFunnel(schema, worldState, simulation, candidates) {
  const stateCount = s => (candidates || []).filter(c => c.state === s).length;
  const eligible = stateCount('eligible'), ineligible = stateCount('ineligible'), approved = stateCount('approved');
  return {
    steps: schema.steps.length, mapped: schema.mappedCount, unmapped: schema.unmappedCount,
    classes: schema.classes.length,
    associated: schema.counts.associated, relatedInstantiated: schema.counts.relatedInstantiated,
    withoutRelatedFamily: schema.counts.withoutRelatedFamily, relatedOutside: schema.counts.relatedOutside,
    paths: worldState.paths.length,
    runs: simulation ? simulation.runs : null,
    adversarial: simulation ? simulation.adversarial : null,
    benign: simulation ? simulation.benign : null,
    findings: simulation ? simulation.findings.length : null,
    candidates: candidates ? candidates.length : null,
    tested: candidates ? eligible + ineligible + approved : null,
    eligible: eligible + approved,                        // an approved candidate was tested eligible (it still counts as eligible)
    ineligible, stale: stateCount('stale'), rejectedByPerson: stateCount('rejected'), approved,
  };
}

/* ------------------------------------------------------------------ record */
function buildRecord(doc, rev, schema, worldState, simulation, candidates, recommended, decision, statement, rationale, slice) {
  const evaluated = rev.origin === 'approve' ? (revisionOf(doc, rev.parent) || rev) : rev;
  const approvedChild = (evaluated.decision && evaluated.decision.action === 'approve')
    ? { rev: revLabel(evaluated.decision.childRev), hash: evaluated.decision.childHash } : null;
  const d = decision;
  const evalCand = (evaluated.optimization?.candidates || []).find(x => x.candidate.id === d?.candidateId) || null;
  const approvedCand = evalCand
    ? { runId: evalCand.runId, paramsVersion: evalCand.candidate.paramsVersion, testedParamsVersion: evalCand.testedParamsVersion }
    : null;
  const gaps = (simulation?.findings || []).map(f => {
    const prohibited = rev.graph.nodes.find(n => n.id === f.prohibited);
    const cls = schema.steps.find(s => s.id === (f.attributed[0] || ''))?.classId || null;
    return {
      finding: f.id, watches: f.declaredWatch, class: cls ? { id: cls, provenance: 'silex-mapping' } : null,
      relatedThreats: f.related.map(tid => ({ id: tid, provenance: 'silex-association', limit: FAMILIES.find(x => x.id === f.family)?.related.find(r => r.threatId === tid)?.limit || '' })),
      law: f.law, paths: f.paths, grade: { path: 'declared', outcome: 'simulated' },
    };
  });
  return {
    record: 'silex.decision-trace/v0', ontologyVersion: slice.version,
    blueprint: approvedChild
      ? { rev: approvedChild.rev, hash: approvedChild.hash, parent: revLabel(evaluated.rev) }
      : { rev: revLabel(evaluated.rev), hash: evaluated.hash, parent: evaluated.parent != null ? revLabel(evaluated.parent) : null },
    evaluatedRevision: { rev: revLabel(evaluated.rev), hash: evaluated.hash },
    approvedChild,
    scenarioSet: rev.validation?.scenarioSetId || null,
    gap: gaps,
    unmappedSteps: schema.steps.filter(s => !s.classId).map(s => ({ id: s.id, type: s.type, why: s.reason })),
    candidates: (candidates || []).map(c => ({ id: c.id, eligible: c.eligible, state: c.state, scorecard: c.scorecard, rejectedBecause: c.reasons })),
    objectives: { eligibility: OBJECTIVES_ELIGIBILITY, rank: ['friction', 'addedLatencyMedian', 'patchOps'], approximated: ['risk', 'friction', 'latency'], notModelled: ['coverage', 'compliance', 'cost', 'performance'] },
    decision: d ? { action: d.action, candidate: d.candidateId || null, by: 'human', revision: d.action === 'accept' ? revLabel(evaluated.rev) : (d.childRevLabel || null) } : null,
    semanticRationale: rationale,
    notSimulated: { associatedThreatsWithoutRelatedFamily: schema.counts.withoutRelatedFamily, layers: ['Calibration'] },
    promotion: { simulation: simulation ? 'done' : 'not run', shadow: 'not run', canary: 'not run', production: 'not run' },
    priorBlueprint: approvedChild ? { rev: revLabel(evaluated.rev), hash: evaluated.hash, note: 'reference only; no operational rollback in this demo' } : null,
    evidence: d ? {
      validationJobId: evaluated.validation?.jobId || null,
      scenarioSetId: evaluated.validation?.scenarioSetId || null,
      candidateRunId: approvedCand ? approvedCand.runId : null,
      paramsVersion: approvedCand ? approvedCand.paramsVersion : null,
      testedParamsVersion: approvedCand ? approvedCand.testedParamsVersion : null,
    } : null,
    statement,
  };
}

const OBJECTIVES_ELIGIBILITY = ['no structural errors', 'benign completion ≥ baseline − 2 pp', 'no finding increases', 'no critical finding left'];
const OBJECTIVES = {
  eligibility: OBJECTIVES_ELIGIBILITY,
  rank: ['friction', 'addedLatencyMedian', 'patchOps'],
  approximated: ['risk', 'friction', 'latency'],
  notModelled: ['coverage', 'compliance', 'cost', 'performance'],
};

/* The decision record of an evaluated revision, built from that revision's own evidence. */
function recordFor(doc, r, slice) {
  const g = r.graph, sc = buildSchema(g, slice), sim = buildSimulation(r, g);
  const { candidates, recommended } = buildCandidates(r, g, r.validation?.result?.findings || []);
  return buildRecord(doc, r, sc, buildWorldState(r, g), sim, candidates, recommended, buildDecision(r, doc), buildStatement(r, doc, slice, sc), buildRationale(g, sim), slice);
}

/* -------------------------------------------------------------------- main */
export function deriveTrace(input) {
  const { doc, revNo, slice, meta } = input;
  const rev = revisionOf(doc, revNo);
  if (!rev) return null;
  const graph = rev.graph;

  const stamp = {
    ontologyVersion: slice.version, revLabel: revLabel(rev.rev), hash: rev.hash,
    scenarioSetId: rev.validation?.scenarioSetId || null, grades: ['declared', 'simulated'],
  };
  const binding = buildBinding(rev, doc);
  const stage = { validated: !!(rev.validation || rev.origin === 'approve'), optimized: !!rev.optimization, decided: !!(rev.decision || rev.origin === 'approve') };

  const schema = buildSchema(graph, slice);
  const laws = buildLaws(rev.validation?.result);
  const worldState = buildWorldState(rev, graph);
  const simulation = buildSimulation(rev, graph);
  const { candidates, recommended } = buildCandidates(rev, graph, rev.validation?.result?.findings || []);
  const decision = buildDecision(rev, doc);
  const statement = buildStatement(rev, doc, slice, schema);
  const rationale = buildRationale(graph, simulation);
  const thread = buildThread(graph, simulation, candidates, decision, slice);
  const funnel = buildFunnel(schema, worldState, simulation, candidates);
  const record = rev.origin === 'approve' && revisionOf(doc, rev.parent)
    ? recordFor(doc, revisionOf(doc, rev.parent), slice)            // the child's record is the evaluated parent's (plan §3.1 Decision row)
    : buildRecord(doc, rev, schema, worldState, simulation, candidates, recommended, decision, statement, rationale, slice);

  return { stamp, binding, stage, schema, laws, worldState, simulation, objectives: OBJECTIVES, candidates, recommended, decision, funnel, statement, rationale, thread, record };
}
