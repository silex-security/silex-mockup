// Runtime Validation summary model (logs/2026-09-30_JEV_RUNTIME_VALIDATION_PLAN.md §1.2–1.4, §2).
// Pure: no DOM, no fetch. It imports the vendored demo engine and derives the metric cards, the per-scenario
// outcome chips and the one-line result sentences from the envelopes the engine returns — never from typed numbers.
//
// Two entry points:
//   summarize({ seed })  → the default-policy reference set: metrics over all 12 scripted scenarios (AP S1–S6,F1
//                          then SOC1–SOC5), plus each scenario's outcome chip and result line.
//   describeRun(envs, { id }) → the same one-line sentence, but for an arbitrary envelope list. The host calls it
//                          with the envelopes __jevDemo.inject(id) returned inside the iframe, which may carry
//                          Policy Studio edits and an injected span id (whose jitter the reference cannot predict).
import { runStream } from '../jev-runtime/demo/js/engine/router.js';
import { TENANT, scenariosFor } from '../jev-runtime/demo/js/engine/scenarios.js';
import { DEFAULT_POLICY } from '../jev-runtime/demo/js/engine/types.js';

// A pre_tool action that does not execute (the gateway held, blocked or stopped it).
const NON_EXECUTING = new Set(['hold_for_review', 'hold_for_approval', 'deny', 'stop_and_handover']);
const VERB = { hold_for_approval: 'held for approval', hold_for_review: 'held for review', deny: 'blocked', stop_and_handover: 'stopped' };
const WOULD_VERB = { BLOCK: 'blocked', HOLD: 'held for approval', REVIEW: 'held for review', STOP: 'stopped' };
const KIND = { deny: 'blocked', stop_and_handover: 'blocked', hold_for_approval: 'held', hold_for_review: 'review' };
const SEVERITY = { deny: 3, stop_and_handover: 3, hold_for_approval: 2, hold_for_review: 1 };
const LABEL_SUFFIX = { rule: ' · rule', jev: ' · judge', fallback: ' · fallback' };

const preTools = envs => (envs ?? []).filter(e => e.boundary === 'pre_tool');

/** who decided a held/blocked action, in plain words. */
function who(e) {
  if (e.decided_by === 'rule') return `rule ${(e.rule_hits ?? []).map(h => h.id).join(', ')}`;
  if (e.decided_by === 'jev') return 'the judge threshold';
  if (e.decided_by === 'fallback') return 'the fallback (judge unavailable)';
  return e.decided_by ?? 'unknown';
}

/** A "Finding after the call: …" suffix for a post_tool alert/finding, or ''. */
function findingPart(envs) {
  const post = (envs ?? []).find(e => e.boundary === 'post_tool' && (e.decision === 'ALERT' || e.alert));
  if (!post) return '';
  const ids = (post.rule_hits ?? []).map(h => h.id).join(', ');
  return ` Finding after the call: ${ids}.`;
}

/**
 * One plain sentence for a run, built only from the given envelopes. It never claims delivery and never uses
 * the words the claims check forbids.
 */
export function describeRun(envelopes, { id }) {
  const envs = preTools(envelopes);
  const n = envs.length;
  const plural = n === 1 ? '' : 's';
  const prefix = `${id} · ${n} action${plural}: `;
  const stopped = envs.filter(e => NON_EXECUTING.has(e.action));
  const monitor = envs.filter(e => e.mode === 'monitor' && e.would_have && e.would_have !== 'ALLOW');
  const finding = findingPart(envelopes);
  if (stopped.length === 0 && monitor.length === 0) return `${prefix}all ran.${finding}`;
  const parts = [
    ...stopped.map(e => `${e.tool.name} ${VERB[e.action]} by ${who(e)}`),
    ...monitor.map(e => `${e.tool.name} ran in monitor mode (would have been ${WOULD_VERB[e.would_have]})`),
  ];
  const k = n - stopped.length;
  // Identical clauses (SOC5's repeated suspensions) collapse into one with a count.
  const counted = [...parts.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map())].map(([x, c]) => (c > 1 ? `${x} (×${c})` : x));
  return `${prefix}${counted.join('; ')}; ${k} ran.${finding}`;
}

/** The scenario's outcome chip { kind, label }, from the most severe non-executing action. */
export function outcomeOf(envs) {
  const pre = preTools(envs);
  const stopped = pre.filter(e => NON_EXECUTING.has(e.action));
  if (stopped.length) {
    const worst = stopped.reduce((w, e) => (SEVERITY[e.action] > SEVERITY[w.action] ? e : w));
    return { kind: KIND[worst.action], label: `${KIND[worst.action]}${LABEL_SUFFIX[worst.decided_by] ?? ''}` };
  }
  if ((envs ?? []).some(e => e.alert || e.decision === 'ALERT')) return { kind: 'flagged', label: 'ran · flagged' };
  return { kind: 'ran', label: 'all ran' };
}

/** The default-policy reference set: metrics over all 12 scenarios and each scenario's chip and line. */
export function summarize({ seed = 7 } = {}) {
  const scenarios = [];
  const metrics = { scenarios: 0, checked: 0, stopped: 0, rule: 0 };
  for (const [domain, traces] of [['ap', scenariosFor('ap')], ['soc', scenariosFor('soc')]]) {
    for (const t of traces) {
      const envs = runStream(t.spans, { tenant: TENANT, policy: DEFAULT_POLICY, seed });
      const pre = preTools(envs);
      scenarios.push({ domain, id: t.scenario, title: t.title, outcome: outcomeOf(envs), line: describeRun(envs, { id: t.scenario }) });
      metrics.scenarios += 1;
      metrics.checked += pre.length;
      metrics.stopped += pre.filter(e => NON_EXECUTING.has(e.action)).length;
      metrics.rule += pre.filter(e => e.decided_by === 'rule').length;
    }
  }
  return { reference: `simulated · seed ${seed} · policy-v1 reference set`, metrics, scenarios };
}

/** The three idle-loop reference envelopes: each scenario's `payments.execute` pre_tool envelope. */
export function referenceExamples({ seed = 7 } = {}) {
  return ['S1', 'S2', 'S3'].map(id => {
    const t = scenariosFor('ap').find(x => x.scenario === id);
    const env = runStream(t.spans, { tenant: TENANT, policy: DEFAULT_POLICY, seed })
      .filter(e => e.boundary === 'pre_tool' && e.tool?.name === 'payments.execute')[0];
    return { id, env };
  });
}
