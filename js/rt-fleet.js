// Runtime Observation · Agent fleet (logs/2026-10-10_CREATOR_PLATFORM_RUNTIME_OBSERVATION_DESIGN.md; built in
// jev-runtime-observability logs/2026-10-10_CREATOR_DOMAIN_FLEET_PLAN.md, task S3).
// The creator-platform domain of the vendored simulated engine: six agents of the fictional Acme Shorts, owned by
// different teams. Every number below is computed here, at page load, by running the vendored engine over the
// scripted scenarios twice: with the ontology slice and without it (?ontology=0 semantics). Nothing is typed in.
//
// fleetModel({ seed }) is pure (no DOM) so tests can import it; renderFleet() fills #rtFleet.
import { runStream } from '../jev-runtime/demo/js/engine/router.js';
import { TENANT, scenariosFor, BACKGROUND_TRACES } from '../jev-runtime/demo/js/engine/scenarios.js';
import { makeCreatorBackground } from '../jev-runtime/demo/js/engine/scenarios-creator.js';
import { DEFAULT_POLICY } from '../jev-runtime/demo/js/engine/types.js';
import { DOMAINS } from '../jev-runtime/demo/js/engine/domains.js';

const NON_EXECUTING = new Set(['hold_for_review', 'hold_for_approval', 'deny', 'stop_and_handover']);
const KIND = { deny: 'blocked', stop_and_handover: 'blocked', hold_for_approval: 'held', hold_for_review: 'review' };
const X1 = [
  ['X1Pb', 'Trend Scout adds the video to the hot pool', 'content-ops'],
  ['X1Cb', 'Ad Curator selects it as a creative', 'ads'],
  ['X1Bb', 'Ad Buyer launches a paid campaign', 'ads'],
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

  const x1 = X1.map(([id, what, team]) => {
    const s = scenarios.find(x => x.id === id);
    return { id, what, team, on: s?.on.at(-1) ?? null, off: s?.off.at(-1) ?? null };
  });
  return { tenant: c.tenant, scenarios, queues: { on: queue('on'), off: queue('off') }, fleet, x1 };
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

  root.innerHTML = `
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
  </section>`;
  root.dataset.ready = '1';
  return m;
}

if (typeof document !== 'undefined') {
  let done = false;
  const show = () => { if (!done) { done = true; renderFleet(); } };
  document.addEventListener('rt:tab', e => { if (e.detail?.tab === 'fleet') show(); });
  if (window.__rtTabs?.current?.() === 'fleet') show();
  window.__rtFleet = { model: fleetModel, render: renderFleet };
}
