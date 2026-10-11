// Runtime Observation · Agent fleet (logs/2026-10-10_CREATOR_PLATFORM_RUNTIME_OBSERVATION_DESIGN.md; built in
// jev-runtime-observability logs/2026-10-10_CREATOR_DOMAIN_FLEET_PLAN.md, task S3).
// The creator-platform domain of the vendored simulated engine: six agents of the fictional Acme Shorts, owned by
// different teams. Every number below is computed here, at page load, by running the vendored engine over the
// scripted scenarios twice: with the ontology slice and without it (?ontology=0 semantics). Nothing is typed in.
//
// fleetModel({ seed }) is pure (no DOM) so tests can import it; renderFleet() fills #rtFleet.
// Visual redesign (logs/2026-10-10_AGENT_FLEET_VISUAL_PLAN.md): renderFleet lays out blocks B (X1 animation,
// js/rt-fleet-x1.js), C+D (fleet map and routing dots, js/rt-fleet-map.js) and E (scenario matrix, js/rt-fleet-grid.js)
// over the same model; the original tables, with their hooks, stay in a closed "Show as tables" <details> (block F).
import { runStream, prepareSpan } from '../jev-runtime/demo/js/engine/router.js';
import { TENANT, scenariosFor, scenarioById, BACKGROUND_TRACES } from '../jev-runtime/demo/js/engine/scenarios.js';
import { buildState } from '../jev-runtime/demo/js/engine/state.js';
import { makeCreatorBackground } from '../jev-runtime/demo/js/engine/scenarios-creator.js';
import { DEFAULT_POLICY } from '../jev-runtime/demo/js/engine/types.js';
import { DOMAINS } from '../jev-runtime/demo/js/engine/domains.js';
import { tip } from './rt-tip.js';
import { mountX1 } from './rt-fleet-x1.js';
import { mountMap } from './rt-fleet-map.js';
import { mountGrid } from './rt-fleet-grid.js';

const NON_EXECUTING = new Set(['hold_for_review', 'hold_for_approval', 'deny', 'stop_and_handover']);
const KIND = { deny: 'blocked', stop_and_handover: 'blocked', hold_for_approval: 'held', hold_for_review: 'review' };
const X1 = [
  ['X1Pb', 'Trend Scout adds the video to the hot pool', 'content-ops'],
  ['X1Cb', 'Ad Curator selects it as a creative', 'ads'],
  ['X1Bb', 'Ad Buyer launches a paid campaign', 'ads'],
];
// The fact behind each creator rule (CREATOR_CONTRACT.md §3–§4): x1[].on.triples is that fact's evidence only.
const FACT_OF_RULE = {
  credential_change_verification: 'verification_short', mcn_payout_scope: 'payout_scope_excluded',
  cross_principal_read: 'subject_scope_missing', asset_license: 'license_invalid',
  sensitive_event_push: 'sensitive_event_unapproved', cumulative_limit: 'cumulative_over_limit',
  ad_use_eligibility: 'ad_ineligible', latent_ad_path: 'hot_pool_reaches_ads_ineligible',
};
// Block E: eleven rows, the eight a/b pairs and X1's three steps; ▶ plays the risky ("b") trace of each row.
const MATRIX = [
  ['TR1', 'Sensitive-event push'], ['TR2', 'Injected user post'], ['CS1', 'Login-email change'],
  ['CS2', 'Linked-card refunds'], ['CR1', 'Agency payout change'], ['CR2', 'Cross-creator analytics'],
  ['SD1', 'Expiring music license'], ['SD2', 'Creeping promotion spend'],
  ['X1P', 'X1 · add to hot pool'], ['X1C', 'X1 · select as ad creative'], ['X1B', 'X1 · launch paid campaign'],
];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** One pre_tool envelope as a compact record. */
function call(e) {
  return {
    tool: e.tool?.name ?? null, agent: e.agent ?? null, decision: e.decision, action: e.action, decided_by: e.decided_by,
    stopped: NON_EXECUTING.has(e.action), rules: (e.rule_hits ?? []).map(h => h.id), reasons: (e.rule_hits ?? []).map(h => h.reason),
  };
}

/** The creator-platform model: per-scenario calls with and without the slice, team queues and the fleet table. */
export function fleetModel({ seed = 7 } = {}) {
  const c = DOMAINS.creator;
  const traces = scenariosFor('creator');
  const run = (t, ontology) => runStream(t.spans, { tenant: TENANT, policy: DEFAULT_POLICY, seed, ontology })
    .filter(e => e.boundary === 'pre_tool').map(call);
  const scenarios = traces.map(t => ({ id: t.scenario, title: t.title, agent: t.spans[0]?.agent ?? null, on: run(t, true), off: run(t, false) }));

  const queue = side => {
    const byTeam = {};
    let total = 0;
    for (const s of scenarios) for (const x of s[side]) {
      if (!x.stopped) continue;
      const team = c.reviewers[x.tool] ?? 'unassigned';
      byTeam[team] = (byTeam[team] ?? 0) + 1;
      total += 1;
    }
    return { byTeam, total };
  };

  // Which tools each agent calls, as observed in the scripted traces and the background stream (not a separate list).
  const toolsByAgent = new Map(c.agents.map(a => [a, new Set()]));
  for (const t of [...traces, ...makeCreatorBackground(seed, BACKGROUND_TRACES)]) for (const sp of t.spans) if (sp.tool?.name) toolsByAgent.get(sp.agent)?.add(sp.tool.name);
  const fleet = c.agents.map(a => ({
    agent: a, team: c.teams[a],
    tools: [...toolsByAgent.get(a)].sort().map(name => ({ name, impact: c.tools[name] ?? null, reviewer: c.reviewers[name] ?? null })),
  }));

  // X1: the decisive (last) pre_tool call of each risky step, plus the typed triples behind the rule that fired.
  const x1 = X1.map(([id, what, team]) => {
    const s = scenarios.find(x => x.id === id);
    const on = s?.on.at(-1) ?? null, off = s?.off.at(-1) ?? null;
    const span = scenarioById(id)?.spans.filter(sp => sp.boundary === 'pre_tool').at(-1);
    const used = span ? (buildState(prepareSpan(span, { ontology: true }), [], TENANT, 0).facts.creator?.used ?? {}) : {};
    const fact = FACT_OF_RULE[on?.rules[0]];
    const triples = (fact && used[fact]) ? used[fact].map(t => ({ s: t.s, p: t.p, o: t.o, grade: t.grade })) : [];
    return { id, what, team, agent: s?.agent ?? null, tool: on?.tool ?? null, on: on && { ...on, triples }, off };
  });

  // Block D: one dot per stopped call with the slice, by the same rule as queues (so dots.length === queues.on.total).
  const dots = scenarios.flatMap(s => s.on.filter(x => x.stopped).map(x => ({
    scenario: s.id, agent: x.agent ?? s.agent, tool: x.tool, team: c.reviewers[x.tool] ?? 'unassigned',
    decision: x.decision, rule: x.rules[0] ?? null,
  })));

  const brief = x => ({ tool: x.tool, decision: x.decision, stopped: x.stopped, rules: x.rules, reasons: x.reasons });
  const side = id => { const s = scenarios.find(x => x.id === id); return { id, title: s?.title ?? '', on: (s?.on ?? []).map(brief), off: (s?.off ?? []).map(brief) }; };
  const matrix = MATRIX.map(([key, label]) => ({ key, label, play: `${key}b`, agent: scenarios.find(x => x.id === `${key}b`)?.agent ?? null, a: side(`${key}a`), b: side(`${key}b`) }));

  return { tenant: c.tenant, scenarios, queues: { on: queue('on'), off: queue('off') }, fleet, x1, dots, matrix };
}

// ---- rendering -----------------------------------------------------------------------------------------------
const chip = x => x
  ? `<span class="rt-chip" data-kind="${x.stopped ? KIND[x.action] : 'ran'}" data-rt-fleet-decision="${esc(x.decision)}">${x.stopped ? esc(x.decision) : 'ran ✓'}</span>`
  : '—';
const why = x => (x?.rules.length ? `<div class="rt-fleet-why"><span class="mono">${esc(x.rules.join(', '))}</span>: ${esc(x.reasons.join('; '))}</div>`
  : '<div class="rt-fleet-why">No rule fired; the call was allowed to run.</div>');

function x1Svg() {
  // The cascade as declared typed facts, left to right. Team bands sit under the agent steps.
  const box = (x, w, title, sub, cls = '') => `<g class="rt-x1-node ${cls}"><rect x="${x}" y="34" width="${w}" height="58" rx="10"/>
    <text x="${x + w / 2}" y="58" text-anchor="middle" class="t">${esc(title)}</text><text x="${x + w / 2}" y="78" text-anchor="middle" class="s">${esc(sub)}</text></g>`;
  const arrow = (x1, x2, label = '') => `<g class="rt-x1-edge"><line x1="${x1}" y1="63" x2="${x2 - 6}" y2="63"/><path d="M${x2 - 8},58 L${x2},63 L${x2 - 8},68 Z"/>${label ? `<text x="${(x1 + x2) / 2}" y="26" text-anchor="middle">${esc(label)}</text>` : ''}</g>`;
  const band = (x, w, label) => `<g class="rt-x1-band"><rect x="${x}" y="104" width="${w}" height="20" rx="6"/><text x="${x + w / 2}" y="118" text-anchor="middle">${esc(label)}</text></g>`;
  return `<svg class="rt-x1-svg" viewBox="0 0 980 170" role="img" aria-labelledby="rtX1SvgTitle">
    <title id="rtX1SvgTitle">Cascade: the hot pool syncs to the ad-candidate pool, so a video eligible only for publishing reaches ads</title>
    ${box(0, 150, 'Ops request', 'no minors in ads')}
    ${arrow(150, 190)}
    ${box(190, 170, 'Trend Scout', 'add_to_hot_pool')}
    ${arrow(360, 420, 'pool:hot SYNCS_TO pool:ad-candidates')}
    ${box(420, 150, 'Platform sync', 'automatic, no agent', 'sys')}
    ${arrow(570, 610)}
    ${box(610, 150, 'Ad Curator', 'select_creative')}
    ${arrow(760, 800)}
    ${box(800, 170, 'Ad Buyer', 'launch_campaign')}
    <g class="rt-x1-gap"><line x1="390" y1="96" x2="390" y2="146"/><text x="398" y="160">missing check: fine to publish ≠ fine for ads</text></g>
    ${band(190, 170, 'Content Ops')}${band(610, 360, 'Ads')}
  </svg>`;
}

export function renderFleet(root = document.getElementById('rtFleet')) {
  if (!root) return null;
  let m;
  try { m = fleetModel(); } catch (e) { root.innerHTML = `<p class="rt-ref">The simulated engine did not load: ${esc(e.message)}</p>`; return null; }
  const steps = side => m.x1.map(s => `<li data-rt-x1-step="${esc(s.id)}"><b>${esc(s.what)}</b> ${chip(s[side])}${why(s[side])}</li>`).join('');
  const teams = [...new Set([...Object.keys(m.queues.on.byTeam), ...Object.keys(m.queues.off.byTeam)])].sort();
  const seq = xs => xs.map(chip).join(' → ');

  for (const h of handles.splice(0)) { try { h.destroy?.(); } catch {} }
  root.innerHTML = `
  <div class="rt-fblock" id="rtFleetX1" data-rt-fblock="x1"></div>
  <div class="rt-fblock" id="rtFleetMap" data-rt-fblock="map"></div>
  <div class="rt-fblock" id="rtFleetGrid" data-rt-fblock="grid"></div>
  <details class="card rt-fleet-tables" data-rt-fleet-tables>
  <summary>Show as tables <small>· the same results as text, for screen readers and copying</small></summary>
  <section class="card rt-x1" data-rt-x1>
    <div class="rt-x1-head"><div><h2>Every step succeeded. The outcome broke the rule.</h2>
      <p>Operations asked to promote a popular video, with one constraint: videos featuring minors are never used in ads.
      Three agents on two teams each did their own step correctly. A trace-only monitor sees three allowed tool calls.
      The ontology slice carries what no single trace event does: the declared policy that <b>advertising excludes minors</b>,
      the fact that this video <b>features a minor</b> (so it is fine to publish but not for ads), and that the hot pool
      <b>syncs automatically</b> into the ad-candidate pool.</p></div>
      <span class="rt-chip" data-kind="sim">Simulated · scripted</span></div>
    <div class="rt-x1-svgwrap">${x1Svg()}</div>
    <div class="rt-x1-cols">
      <div data-rt-x1-side="off"><h3>Trace only <small>(ontology slice off)</small></h3><ol>${steps('off')}</ol></div>
      <div data-rt-x1-side="on"><h3>With the ontology slice</h3><ol>${steps('on')}</ol></div>
    </div>
    <p class="rt-ref">The chain comes from declared typed facts, not from linking traces at runtime (the three runs share no history): <span class="mono">pool:hot SYNCS_TO pool:ad-candidates</span>, <span class="mono">video FEATURES subject:minor</span> and the policy <span class="mono">purpose:advertising EXCLUDES subject:minor</span>, from which the video's ad-ineligibility is inferred.
      The three checkpoints are evaluated independently; in a real run, the hold at the first one would stop the other two.
      Decisions computed by the vendored simulated engine at page load, seed 7.</p>
  </section>

  <section class="card" data-rt-fleet-table>
    <h3>The fleet <span class="rt-chip" data-kind="sim">Authored configuration</span></h3>
    <p class="rt-plain">Six agents of ${esc(m.tenant)}. Tools are the ones each agent calls in the simulated stream; the reviewing team is the <span class="mono">OWNED_BY_TEAM</span> owner of that kind of action in the candidate <a href="swm/data/packs/creator-platform.json" target="_blank" rel="noopener">Creator Platform Pack</a> (outside the site's coverage figures).</p>
    <table class="matrix"><thead><tr><th>Team</th><th>Agent</th><th>Tools (impact)</th><th>Held or blocked calls go to</th></tr></thead><tbody>
    ${m.fleet.map(r => `<tr data-rt-fleet-agent="${esc(r.agent)}"><td>${esc(r.team)}</td><td class="mono">${esc(r.agent)}</td>
      <td>${r.tools.map(t => `<span class="mono">${esc(t.name)}</span> <small>(${esc(t.impact)})</small>`).join('<br>')}</td>
      <td>${[...new Set(r.tools.map(t => t.reviewer).filter(Boolean))].map(esc).join(', ') || '—'}</td></tr>`).join('')}
    </tbody></table>
  </section>

  <section class="card" data-rt-fleet-queues>
    <h3>Who reviews what <span class="rt-chip" data-kind="sim">Scenario counts, computed by the engine</span></h3>
    <p class="rt-plain">Held or blocked calls across the ${m.scenarios.length} scripted traces, routed to the team that owns that kind of action. With the slice: ${m.queues.on.total} stopped; trace only: ${m.queues.off.total}.</p>
    <table class="matrix"><thead><tr><th>Reviewing team</th><th>With the slice</th><th>Trace only</th></tr></thead><tbody>
    ${teams.map(t => `<tr data-rt-queue="${esc(t)}"><td>${esc(t)}</td><td data-rt-queue-on>${m.queues.on.byTeam[t] ?? 0}</td><td data-rt-queue-off>${m.queues.off.byTeam[t] ?? 0}</td></tr>`).join('')}
    <tr class="bold"><td>All stopped calls</td><td data-rt-queue-total-on>${m.queues.on.total}</td><td data-rt-queue-total-off>${m.queues.off.total}</td></tr>
    </tbody></table>
    <p class="rt-ref">Scenario counts from scripted traces, not measurements of any real platform.</p>
  </section>

  <section class="card" data-rt-fleet-decisions>
    <h3>Every scenario, with and without the slice <span class="rt-chip" data-kind="sim">Computed by the engine</span></h3>
    <p class="rt-plain">Each row is one scripted trace; "a" is the normal context and "b" the risky one. The same tool is called in both; the "b" context differs in the facts the slice describes.</p>
    <table class="matrix"><thead><tr><th>Scenario</th><th>Agent</th><th>With the slice</th><th>Trace only</th></tr></thead><tbody>
    ${m.scenarios.map(s => `<tr data-rt-fleet-scenario="${esc(s.id)}"><td><b>${esc(s.id)}</b> <small>${esc(s.title)}</small></td><td class="mono">${esc(s.agent)}</td>
      <td>${seq(s.on)}</td><td>${seq(s.off)}</td></tr>`).join('')}
    </tbody></table>
  </section>
  </details>`;
  const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // ▶ in the matrix: show the Scenarios tab, move focus to it, then let the host run the trace (its token guards it).
  const run = id => { window.__rtTabs?.open('scenarios'); document.getElementById('rtTab-scenarios')?.focus(); return window.__jevRuntime?.run(id); };
  const mount = (fn, id, opts) => { try { const h = fn(document.getElementById(id), m, opts); if (h) handles.push(h); return h; } catch (e) { console.error(e); return null; } };
  const x1 = mount(mountX1, 'rtFleetX1', { tip, reducedMotion });
  // The X1 block plays its guided demo once when the tab first renders (Trace only, then With ontology). Under reduced
  // motion it shows the end state instead (mountX1 does that itself).
  if (!reducedMotion) x1?.tour?.();
  mount(mountMap, 'rtFleetMap', { tip, reducedMotion });
  mount(mountGrid, 'rtFleetGrid', { tip, run });
  root.dataset.ready = '1';
  return m;
}
const handles = [];

if (typeof document !== 'undefined') {
  let done = false;
  const show = () => { if (!done) { done = true; renderFleet(); } };
  document.addEventListener('rt:tab', e => { if (e.detail?.tab === 'fleet') show(); });
  if (window.__rtTabs?.current?.() === 'fleet') show();
  window.__rtFleet = { model: fleetModel, render: renderFleet };
}
