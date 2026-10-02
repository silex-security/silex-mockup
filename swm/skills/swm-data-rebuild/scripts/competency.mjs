#!/usr/bin/env node
/* Six executable competency questions from the approved ontology-rigor plan.
   node swm/skills/swm-data-rebuild/scripts/competency.mjs [data-directory]
   Answers describe the stored ontology and illustrative fixtures, not observations. */
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FINANCIAL = 'core:financial-value-transfer', APPROVAL = 'core:human-approval';
const unique = xs => [...new Set(xs)];

export function evaluateCompetencies(onto) {
  const common = [], results = [];
  if (!Array.isArray(onto?.nodes) || !Array.isArray(onto?.links))
    return { common: ['ontology needs nodes and links arrays'], results, ok: false };
  const { nodes, links } = onto, byId = new Map(nodes.map(n => [n.id, n]));
  if (onto.version !== 'swm-2.0') common.push('expected version swm-2.0, got ' + onto.version);
  if (byId.size !== nodes.length) common.push('duplicate node ids');
  for (const l of links) if (!byId.has(l.s) || !byId.has(l.t))
    common.push('unresolved ' + l.pred + ' link: ' + l.s + ' -> ' + l.t);
  const valid = links.filter(l => byId.has(l.s) && byId.has(l.t));
  const out = (id, pred) => unique(valid.filter(l => l.s === id && l.pred === pred).map(l => l.t));
  const incoming = (id, pred) => unique(valid.filter(l => l.t === id && l.pred === pred).map(l => l.s));
  const hazards = nodes.filter(n => n.layer === 2 && n.kind === 'hazard');
  function isA(id, root) {
    const pending = [id], seen = new Set();
    while (pending.length) {
      const next = pending.pop();
      if (next === root) return true;
      if (seen.has(next)) continue;
      seen.add(next); pending.push(...out(next, 'SUBCLASS_OF'));
    }
    return false;
  }
  function ask(id, question, run) {
    const problems = [], fail = m => problems.push(m);
    const typed = (source, pred, kinds, layer) => out(source, pred).filter(target => {
      const n = byId.get(target);
      if (!kinds.includes(n.kind) || (layer && n.layer !== layer)) {
        fail(source + ': ' + pred + ' has invalid target ' + target); return false;
      }
      return true;
    });
    const answer = run({ fail, typed });
    results.push({ id, question, answer, problems, ok: problems.length === 0 });
  }
  function evidenceFor(hazard, typed, fail) {
    const evidence = typed(hazard, 'REQUIRES_EVIDENCE', ['evidence'], 1);
    if (!evidence.length) fail(hazard + ': missing required evidence');
    return evidence.map(id => {
      const records = typed(id, 'RECORDED_BY', ['record'], 3);
      if (!records.length) fail(hazard + ': evidence ' + id + ' has no RECORDED_BY record schema');
      return { evidence: id, records };
    });
  }

  ask('CQ1', 'WF-055 applicable hazards, required evidence and record schemas', ({ fail, typed }) => {
    const workflow = byId.get('wf:WF-055');
    if (!workflow || workflow.kind !== 'workflow' || workflow.layer !== 2) {
      fail('WF-055 workflow missing'); return [];
    }
    const domains = unique(typed(workflow.id, 'PART_OF', ['capability'], 2)
      .flatMap(cap => typed(cap, 'PART_OF', ['domain'], 2)));
    if (domains.length !== 1) fail('WF-055 must resolve to one domain through capability PART_OF');
    const applicable = hazards.filter(h => typed(h.id, 'HAZARD_FOR', ['action', 'entity'], 2).some(id => {
      const n = byId.get(id);
      return n.kind === 'action' ? out(id, 'USED_IN').includes(workflow.id)
        : out(id, 'PART_OF_DOMAIN').some(d => domains.includes(d));
    }));
    if (!applicable.length) fail('WF-055 has no applicable hazards');
    return applicable.map(h => ({ hazard: h.id, evidence: evidenceFor(h.id, typed, fail) }));
  });

  ask('CQ2', 'Financial-value-transfer actions whose hazards have no mapped control (human approval)', ({ fail, typed }) => {
    for (const [id, kind] of [[FINANCIAL, 'effect'], [APPROVAL, 'control']]) {
      const n = byId.get(id);
      if (!n || n.kind !== kind || n.layer !== 1) fail('required L1 ' + kind + ' class missing: ' + id);
    }
    if (!byId.has(FINANCIAL) || !byId.has(APPROVAL)) return [];
    return nodes.filter(n => n.layer === 2 && n.kind === 'action').flatMap(action => {
      const effects = typed(action.id, 'MAY_CAUSE', ['effect']).filter(id => isA(id, FINANCIAL));
      if (!effects.length) return [];
      const applicable = incoming(action.id, 'HAZARD_FOR').filter(id => byId.get(id).layer === 2 && byId.get(id).kind === 'hazard');
      const lacking = applicable.filter(h => !typed(h, 'MITIGATED_BY', ['control', 'countermeasure']).some(id => isA(id, APPROVAL)));
      return lacking.length ? [{ action: action.id, effects, hazards: lacking, status: 'no mapped control' }] : [];
    });
  });

  ask('CQ3', 'Each L3 component: targeted threats and countered/uncountered partition', ({ fail, typed }) => {
    const threats = nodes.filter(n => n.layer === 3 && n.group === 'threat');
    const components = nodes.filter(n => n.layer === 3 && n.kind === 'component');
    const uncountered = Array.isArray(onto.uncountered) ? onto.uncountered : [];
    if (!Array.isArray(onto.uncountered)) fail('uncountered list missing');
    if (unique(uncountered).length !== uncountered.length) fail('uncountered list has duplicates');
    const threatIds = new Set(threats.map(n => n.id));
    for (const id of uncountered) if (!threatIds.has(id)) fail('uncountered contains a non-L3-threat: ' + id);
    if (!components.length || !threats.length) fail('L3 components or threats missing');
    const seen = new Map();
    const answer = components.map(c => ({
      component: c.id,
      threats: incoming(c.id, 'THREATENS').map(id => {
        const n = byId.get(id);
        if (!threatIds.has(id) || !['technique', 'risk'].includes(n.kind)) fail(c.id + ': THREATENS source is not an L3 threat: ' + id);
        seen.set(id, (seen.get(id) || 0) + 1);
        const controls = incoming(id, 'COUNTERS').filter(ct => {
          if (!['control', 'countermeasure'].includes(byId.get(ct).kind)) { fail(id + ': invalid COUNTERS source ' + ct); return false; }
          return true;
        });
        if (uncountered.includes(id) !== (controls.length === 0)) fail(id + ': countered/uncountered partition contradicts COUNTERS');
        return { threat: id, status: controls.length ? 'countered' : 'uncountered', controls };
      })
    }));
    for (const t of threats) {
      typed(t.id, 'THREATENS', ['component'], 3);
      if (seen.get(t.id) !== 1) fail(t.id + ': L3 threat must appear exactly once, got ' + (seen.get(t.id) || 0));
    }
    return answer;
  });

  ask('CQ4', 'L2 entities, candidates included, without SUBCLASS_OF to L1', () => {
    const missing = nodes.filter(n => n.layer === 2 && n.kind === 'entity')
      .filter(n => !out(n.id, 'SUBCLASS_OF').some(id => byId.get(id).layer === 1)).map(n => n.id);
    return { count: missing.length, entities: missing };
  });
  const cq4 = results.at(-1);
  if (cq4.answer.count) { cq4.problems.push('L2 entities missing SUBCLASS_OF to L1'); cq4.ok = false; }

  ask('CQ5', 'Illustrative I-0987 occurrence/workflow and exhibited hazard/threat/control paths', ({ fail, typed }) => {
    const incident = byId.get('rt-inc-0987');
    if (!incident || incident.kind !== 'incident' || incident.layer !== 4) { fail('I-0987 incident missing'); return null; }
    const traces = typed(incident.id, 'OCCURRED_IN', ['trace'], 4);
    if (!traces.length) fail('I-0987 OCCURRED_IN trace missing');
    const occurrences = traces.map(trace => {
      const workflows = typed(trace, 'REALISES', ['workflow'], 2);
      if (!workflows.length) fail(trace + ': REALISES workflow missing');
      return { trace, workflows };
    });
    const exhibited = typed(incident.id, 'EXHIBITS', ['hazard'], 2);
    if (!exhibited.length) fail('I-0987 EXHIBITS hazard missing');
    const exhibits = exhibited.map(hazard => {
      const assertions = valid.filter(l => l.s === incident.id && l.t === hazard && l.pred === 'EXHIBITS');
      if (assertions.some(l => l.review !== 'illustrative')) fail('EXHIBITS assertion must be illustrative');
      const threats = typed(hazard, 'CHARACTERIZES', ['technique', 'tactic', 'risk']);
      const controls = typed(hazard, 'MITIGATED_BY', ['control', 'countermeasure']);
      if (!threats.length) fail(hazard + ': CHARACTERIZES threat missing');
      if (!controls.length) fail(hazard + ': MITIGATED_BY control missing');
      return { hazard, review: assertions[0]?.review, threats, controls };
    });
    return { incident: incident.id, occurrences, exhibits };
  });

  ask('CQ6', 'L2 hazards with incomplete threat/control/evidence/record chain; unreached prohibited outcomes', ({ fail, typed }) => {
    const incomplete = [];
    for (const h of hazards) {
      const missing = [];
      if (!typed(h.id, 'CHARACTERIZES', ['technique', 'tactic', 'risk']).length) missing.push('CHARACTERIZES');
      if (!typed(h.id, 'MITIGATED_BY', ['control', 'countermeasure']).length) missing.push('MITIGATED_BY');
      const evidence = typed(h.id, 'REQUIRES_EVIDENCE', ['evidence'], 1);
      if (!evidence.length) missing.push('REQUIRES_EVIDENCE');
      for (const e of evidence) if (!typed(e, 'RECORDED_BY', ['record'], 3).length) missing.push('RECORDED_BY:' + e);
      if (missing.length) incomplete.push({ hazard: h.id, missing });
    }
    const unreached = nodes.filter(n => n.prohibited === true).filter(n => {
      if (n.layer !== 2 || !['effect', 'state'].includes(n.kind)) fail(n.id + ': prohibited outcome must be an L2 effect/state');
      return !incoming(n.id, 'MAY_LEAD_TO').some(id => byId.get(id).layer === 2 && byId.get(id).kind === 'hazard');
    }).map(n => n.id);
    if (incomplete.length) fail('hazards with incomplete principle-3 chain: ' + incomplete.length);
    if (unreached.length) fail('prohibited outcomes unreached by hazards: ' + unreached.length);
    return { incompleteHazardCount: incomplete.length, incompleteHazards: incomplete,
      unreachedProhibitedCount: unreached.length, unreachedProhibited: unreached };
  });
  return { common, results, ok: common.length === 0 && results.every(r => r.ok) };
}

async function main() {
  const data = resolve(process.argv[2] || join(HERE, '..', '..', '..', 'data'));
  try {
    const onto = JSON.parse(await readFile(join(data, 'ontology.json'), 'utf8'));
    const r = evaluateCompetencies(onto);
    console.log('Competency bundle: ' + data);
    for (const cq of r.results) {
      console.log('\n' + cq.id + ' ' + (cq.ok ? 'PASS' : 'FAIL') + ': ' + cq.question);
      console.log(JSON.stringify(cq.answer, null, 2));
      cq.problems.forEach(p => console.log('  ✗ ' + p));
    }
    r.common.forEach(p => console.log('  ✗ ' + p));
    console.log('\n' + (r.ok ? '✓ all six competency questions pass' : '✗ competency checks failed'));
    if (!r.ok) process.exitCode = 1;
  } catch (error) { console.error('competency: ' + error.message); process.exitCode = 1; }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
