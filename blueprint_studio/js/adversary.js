/* Adversary templates, seeded scenario generation (plan §4.5, contract §6).
   Deterministic from (seed, n, params). No DOM. */

export const TEMPLATES = ['below_threshold', 'split', 'replay', 'duplicate_submit', 'injection_exfil', 'benign'];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round2 = x => Math.round(x * 100) / 100;

export function scenarioParams(graph) {
  const trigger = graph.nodes.filter(n => n.type === 'trigger').sort((a, b) => a.id < b.id ? -1 : 1)[0];
  const unauth = graph.nodes.filter(n => n.type === 'prohibited' && n.config.monitor === 'unauthorized_write').sort((a, b) => a.id < b.id ? -1 : 1)[0];
  if (unauth) {
    const pr = unauth.config.probeRange || [0, 1000];
    return { t: unauth.config.threshold ?? 0, lo: pr[0], hi: pr[1], trigger: trigger ? trigger.id : null };
  }
  return { t: 500, lo: 0, hi: 1000, trigger: trigger ? trigger.id : null };
}

/* uniform in (lo, hi] approximated by lo + r*(hi-lo); r in [0,1) so amount in [lo, hi). */
function uniform(rand, lo, hi) { return round2(lo + rand() * (hi - lo)); }
function logUniform(rand, lo, hi) { return round2(Math.exp(Math.log(lo) + rand() * (Math.log(hi) - Math.log(lo)))); }

export function generateScenarioSet(graph, { n = 40, seed, baseHash } = {}) {
  const params = scenarioParams(graph);
  const s = seed != null ? seed : (baseHash ? parseInt(baseHash.slice(0, 8), 16) : 1);
  const rand = mulberry32(s);
  const scenarios = [];
  for (const template of TEMPLATES) {
    for (let i = 0; i < n; i++) scenarios.push(build(template, i, params, rand));
  }
  return { id: `S-${String(baseHash || '').slice(0, 8)}-${n}`, seed: s, n, baseHash: baseHash || null, params, scenarios };
}

function build(template, idx, params, rand) {
  const { t, lo, hi, trigger } = params;
  const c = 'c' + (idx + 1);
  const o1 = 'o' + (2 * idx + 1), o2 = 'o' + (2 * idx + 2);
  const id = `${template}-${idx}`;
  const r1 = { id: 'r1', customer: c, order: o1, amount: 0, eligible: 0, channel: 'support_chat' };
  if (trigger) r1.trigger = trigger;
  switch (template) {
    case 'below_threshold':
      r1.amount = uniform(rand, lo, hi); r1.eligible = 0;
      return { id, template, requests: [r1] };
    case 'split': {
      const amount = uniform(rand, hi, 2 * hi);
      const tp = t > 0 ? t : hi;
      const k = Math.min(10, Math.max(2, Math.ceil(amount / (0.96 * tp))));
      r1.amount = amount; r1.eligible = amount; r1.intent = { split: k };
      return { id, template, requests: [r1] };
    }
    case 'replay': {
      const amount = uniform(rand, hi, 2 * hi);
      r1.amount = amount; r1.eligible = amount;
      const r2 = { id: 'r2', customer: c, order: o2, amount, eligible: 0, channel: 'support_chat', intent: { presentApprovalOf: 'r1' } };
      if (trigger) r2.trigger = trigger;
      return { id, template, requests: [r1, r2] };
    }
    case 'duplicate_submit': {
      const cap = t > 0 ? t : hi;
      const amount = round2(rand() * cap);
      r1.amount = amount; r1.eligible = amount;
      const r2 = { id: 'r2', customer: c, order: o1, amount, eligible: amount, channel: 'support_chat' };
      if (trigger) r2.trigger = trigger;
      return { id, template, requests: [r1, r2] };
    }
    case 'injection_exfil': {
      const cap = t > 0 ? t : hi;
      r1.amount = round2(rand() * cap); r1.eligible = r1.amount; r1.injected = true;
      return { id, template, requests: [r1] };
    }
    case 'benign':
      r1.amount = logUniform(rand, 20, 3000); r1.eligible = r1.amount;
      return { id, template, requests: [r1] };
  }
}

export function applicability(graph, template) {
  const p = scenarioParams(graph);
  const agents = graph.nodes.filter(n => n.type === 'agent');
  const controls = graph.nodes.filter(n => n.type === 'control');
  const tools = graph.nodes.filter(n => n.type === 'tool');
  const prohibited = graph.nodes.filter(n => n.type === 'prohibited');
  const secrets = graph.nodes.filter(n => n.type === 'data' && n.config.sensitivity === 'secret');
  const outcomes = graph.nodes.filter(n => n.type === 'outcome' && n.config.external);
  const hasUnauth = prohibited.some(n => n.config.monitor === 'unauthorized_write');
  const hasDup = prohibited.some(n => n.config.monitor === 'duplicate_effect');
  const hasExp = prohibited.some(n => n.config.monitor === 'secret_exposure');
  switch (template) {
    case 'below_threshold': return { applicable: hasUnauth && p.t > 0, reason: hasUnauth && p.t > 0 ? 'has a write threshold' : 'no positive write threshold declared' };
    case 'split': return { applicable: hasUnauth && agents.some(a => a.config.canSplit), reason: (hasUnauth && agents.some(a => a.config.canSplit)) ? 'a splitting agent can reach the write' : 'no splitting agent on the write path' };
    case 'replay': return { applicable: hasUnauth && controls.some(c => c.config.kind !== 'policy_gate'), reason: 'approval reuse' };
    case 'duplicate_submit': return { applicable: hasDup && tools.some(t => t.config.sideEffect === 'write'), reason: hasDup ? 'double compensation monitor declared' : 'no duplicate monitor' };
    case 'injection_exfil': return { applicable: hasExp && secrets.length > 0 && outcomes.length > 0, reason: hasExp ? 'external emit with a secret read' : 'no exposure monitor' };
    case 'benign': return { applicable: true, reason: 'normal operation' };
  }
  return { applicable: false, reason: 'unknown' };
}
