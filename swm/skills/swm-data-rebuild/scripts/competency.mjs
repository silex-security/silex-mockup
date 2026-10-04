#!/usr/bin/env node
/* Ten executable competency questions from the approved ontology and L4 plans.
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
    const threats = nodes.filter(n => n.layer === 3 && ['technique', 'risk'].includes(n.kind));
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
  const assertion = (s, t, pred) => valid.find(l => l.s === s && l.t === t && l.pred === pred);
  const described = id => ({ id, label: byId.get(id)?.label, review: byId.get(id)?.review, src: byId.get(id)?.src || [] });
  function alignedEntities(hazard, sys, typed) {
    return typed(hazard, 'HAZARD_FOR', ['entity', 'action'], 2).filter(id => byId.get(id).kind === 'entity')
      .flatMap(entity => typed(entity, 'CLOSE_MATCH', ['class']).filter(id => (byId.get(id).src || []).some(s => s.sys === sys))
        .map(id => ({ entity, ...described(id), attrs: byId.get(id).attrs || [], rel: 'related', alignmentReview: assertion(entity, id, 'CLOSE_MATCH')?.review })));
  }
  function sourcesFor(hazard, sys, fail) {
    return (byId.get(hazard)?.src || []).filter(s => s.sys === sys).map(s => {
      if (!['derived', 'related'].includes(s.rel)) fail(hazard + ': ' + sys + ' citation missing rel');
      return s;
    });
  }
  function reviewedCases(hazard, typed) {
    return typed(hazard, 'EXEMPLIFIED_BY', ['case'], 3).map(id => ({ ...described(id),
      caseType: byId.get(id).caseType, nodeReview: byId.get(id).review, review: assertion(hazard, id, 'EXEMPLIFIED_BY')?.review,
      rationale: byId.get(hazard)?.caseWhy?.[id] }));
  }
  ask('CQ7', 'Public sources supporting Payment From Unverified Instruction', ({ fail, typed }) => {
    const hazard = 'hz:haz-finance-unverified-instruction';
    if (byId.get(hazard)?.kind !== 'hazard') { fail('CQ7 hazard missing'); return null; }
    const fibo = alignedEntities(hazard, 'fibo', typed);
    if (!fibo.length) fail('CQ7: no FIBO class via HAZARD_FOR entity and CLOSE_MATCH');
    const scenarios = sourcesFor(hazard, 'agentdojo', fail).filter(s => /injection_task_/.test(s.id || ''));
    if (!scenarios.length) fail('CQ7: no AgentDojo scenario');
    const techniques = typed(hazard, 'CHARACTERIZES', ['technique', 'tactic', 'risk']).filter(id =>
      byId.get(id).kind === 'technique' && byId.get(id).review === 'published' && (byId.get(id).src || []).some(s => s.sys === 'atlas'));
    const mitigations = techniques.flatMap(technique => incoming(technique, 'COUNTERS').filter(id =>
      byId.get(id).review === 'published' && (byId.get(id).src || []).some(s => s.sys === 'atlas') &&
      assertion(id, technique, 'COUNTERS')?.review === 'published').map(id => ({ technique, ...described(id), edgeReview: 'published' })));
    if (!mitigations.length) fail('CQ7: no ATLAS technique with a published mitigation');
    const cases = reviewedCases(hazard, typed);
    if (!cases.some(c => c.src.some(s => s.sys === 'atlas-cs'))) fail('CQ7: reviewed ATLAS case link missing');
    return { hazard, fibo, scenarios, mitigations, cases };
  });
  ask('CQ8', 'Sources supporting the Silex-modelled repeated-refund mechanism exhibited by I-1042', ({ fail, typed }) => {
    const hazard = 'hz:haz-support-refund-loop';
    if (byId.get(hazard)?.kind !== 'hazard') { fail('CQ8 hazard missing'); return null; }
    const exhibit = assertion('rt-inc-1042', hazard, 'EXHIBITS');
    if (!exhibit || exhibit.review !== 'illustrative') fail('CQ8: illustrative I-1042 EXHIBITS refund-loop assertion missing');
    const cdm = alignedEntities(hazard, 'cdm', typed);
    if (!cdm.some(c => c.attrs.some(a => typeof a.name === 'string' && typeof a.def === 'string' && a.def.trim())))
      fail('CQ8: no aligned CDM entity with documented attributes');
    const rules = sourcesFor(hazard, 'tau2', fail).filter(s => /rule\//.test(s.id || ''));
    const scenarios = sourcesFor(hazard, 'asb', fail);
    if (!rules.length) fail('CQ8: no tau2 policy rule');
    if (!scenarios.length) fail('CQ8: no ASB scenario');
    if ([...rules, ...scenarios].some(s => s.rel !== 'related')) fail('CQ8: refund-loop mechanism must retain related grading');
    return { hazard, model: 'Silex-modelled partial-failure retry mechanism; related sources do not establish it',
      exhibit: { incident: 'rt-inc-1042', review: exhibit?.review }, cdm, rules, scenarios };
  });
  ask('CQ9', 'Public-source mappings and modelled evidence-record paths for the orphan-account hazard, not proof of offboarding', ({ fail, typed }) => {
    const hazard = 'hz:haz-it-orphan-account';
    if (byId.get(hazard)?.kind !== 'hazard') { fail('CQ9 hazard missing'); return null; }
    const controls = typed(hazard, 'MITIGATED_BY', ['control', 'countermeasure']).filter(id =>
      (byId.get(id).src || []).some(s => s.sys === 'nist-800-53')).map(id => ({ ...described(id), mappingReview: assertion(hazard, id, 'MITIGATED_BY')?.review }));
    if (!controls.length) fail('CQ9: no mapped NIST control');
    const mitigations = incoming('attack:T1078', 'COUNTERS').filter(id => byId.get(id).review === 'published' &&
      (byId.get(id).src || []).some(s => s.sys === 'attack') && assertion(id, 'attack:T1078', 'COUNTERS')?.review === 'published')
      .map(id => ({ ...described(id), technique: 'attack:T1078', edgeReview: 'published' }));
    if (!out(hazard, 'CHARACTERIZES').includes('attack:T1078') || !mitigations.length) fail('CQ9: no characterized T1078 with ATT&CK published mitigation');
    const records = typed(hazard, 'REQUIRES_EVIDENCE', ['evidence'], 1).flatMap(evidence =>
      typed(evidence, 'RECORDED_BY', ['record'], 3).flatMap(record => typed(record, 'CLOSE_MATCH', ['class']).filter(id =>
        (byId.get(id).src || []).some(s => s.sys === 'ocsf')).map(id => ({ evidence, record, ...described(id),
          evidenceReview: assertion(hazard, evidence, 'REQUIRES_EVIDENCE')?.review,
          recordReview: assertion(evidence, record, 'RECORDED_BY')?.review, alignmentReview: assertion(record, id, 'CLOSE_MATCH')?.review }))));
    if (!records.length) fail('CQ9: no OCSF class via REQUIRES_EVIDENCE / RECORDED_BY / CLOSE_MATCH');
    return { hazard, interpretation: 'Modelled schema and control mappings, not proof of verified identity or completed offboarding',
      controls, mitigations, records, cases: reviewedCases(hazard, typed) };
  });
  ask('CQ10', 'Public benchmark banking task-4 runs: evaluator-reported executions versus scheduled-redirect mappings, not enterprise observations', ({ fail }) => {
    const hazard = 'hz:haz-finance-scheduled-redirect';
    const models = ['meta-llama_Llama-3.3-70B-Instruct', 'Meta-SecAlign-70B'];
    const benchmark = n => !!n && Object.hasOwn(n, 'benchmark');
    if (byId.get(hazard)?.kind !== 'hazard' || byId.get(hazard)?.layer !== 2)
      fail('CQ10: scheduled-redirect hazard missing or mistyped');
    const runs = nodes.filter(n => benchmark(n) && n.kind === 'trace' &&
      n.benchmark?.source === 'agentdojo' && n.benchmark.suite === 'banking' &&
      String(n.benchmark.injectionTask).replace(/^injection_task_/, '') === '4');
    for (const n of runs) if (!models.includes(n.benchmark.model)) fail('CQ10: unexpected task-4 model ' + n.benchmark.model);
    const answer = models.map(model => {
      const selected = runs.filter(n => n.benchmark.model === model), reportedRuns = [], exhibitedRuns = [], unmappedRuns = [];
      if (!selected.length) fail('CQ10: no banking task-4 benchmark runs for ' + model);
      for (const run of selected) {
        if (run.layer !== 4 || run.review !== 'published' || run.domain !== 'finance' ||
            !(run.src || []).some(s => s.sys === 'agentdojo')) fail('CQ10: invalid public benchmark run ' + run.id);
        if (!['attack reported executed', 'attack not executed'].includes(run.benchmark.outcome)) fail('CQ10: invalid task-4 outcome ' + run.id);
        const reported = run.benchmark.outcome === 'attack reported executed';
        if (reported) reportedRuns.push(run.id);
        const incidents = incoming(run.id, 'OCCURRED_IN').map(id => byId.get(id));
        if (incidents.length !== (reported ? 1 : 0)) fail('CQ10: task-4 incident count disagrees with evaluator outcome ' + run.id);
        for (const inc of incidents) {
          if (!benchmark(inc) || inc.layer !== 4 || inc.kind !== 'incident' || inc.review !== 'published' ||
              inc.benchmark?.source !== 'agentdojo' || inc.benchmark.status !== 'reported-executed')
            fail('CQ10: invalid reported-executed benchmark incident ' + inc.id);
          if (out(inc.id, 'OCCURRED_IN').length !== 1) fail('CQ10: incident must belong to exactly one run ' + inc.id);
          const exhibits = out(inc.id, 'EXHIBITS');
          if (exhibits.includes(hazard)) {
            const l = assertion(inc.id, hazard, 'EXHIBITS');
            if (l.review !== 'curated') fail('CQ10: scheduled-redirect EXHIBITS must be curated ' + inc.id);
            if (!inc.benchmark?.predicate || !inc.benchmark?.evidenceCall)
              fail('CQ10: scheduled-redirect mapping needs recorded predicate and matching call ' + inc.id);
            exhibitedRuns.push(run.id);
          } else if (reported) {
            if (!exhibits.length && !(typeof inc.benchmark?.unmapped === 'string' && inc.benchmark.unmapped.trim()))
              fail('CQ10: unmapped task-4 incident needs a reason ' + inc.id);
            unmappedRuns.push(run.id);
          }
        }
      }
      return { model, runs: selected.length, evaluatorReportedExecutions: reportedRuns.length,
        runsExhibitingScheduledRedirect: unique(exhibitedRuns).length,
        reportedRuns, exhibitedRuns: unique(exhibitedRuns), unmappedRuns };
    });
    return { hazard, interpretation: 'Public benchmark runs in a research environment, not enterprise observations. Evaluator-reported execution and the curated trace-to-hazard mapping are separate counts.', models: answer };
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
    console.log('\n' + (r.ok ? '✓ all ten competency questions pass' : '✗ competency checks failed'));
    if (!r.ok) process.exitCode = 1;
  } catch (error) { console.error('competency: ' + error.message); process.exitCode = 1; }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
