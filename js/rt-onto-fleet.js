// Ontology tab · "In the agent fleet" (logs/2026-10-11_FLEET_ONTOLOGY_GRAPH_PLAN.md, Contract B, task T3).
// What the ontology does for the six simulated agents, as three jobs, each with a figure computed from the fleet model
// (js/rt-onto-fleet-model.js): it gives each call the declared facts its trace lacks, typed rules read those facts, and
// OWNED_BY_TEAM routes each stopped call to the owning team. The X1 description carries the three limits the Agent fleet
// tab states. Static: play() and pause() are no-ops. No DOM access at module top level.

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const noTip = () => '';
export const GRADE_LINE = 'Simulated engine · fictional tenant · candidate pack, outside the coverage figures. Not the measured result in the first sub-tabs.';
export const LIMITS = [
  'The chain comes from declared typed facts, not from linking traces at runtime.',
  'Each check is evaluated on its own.',
  'In a real run, the hold at the first step means the later calls never happen.',
];
const triple = t => `<code class="rt-of-t"><span>${esc(t.s)}</span> <b>${esc(t.p)}</b> <span>${esc(t.o)}</span></code>`;
const list = xs => (xs.length ? xs.map(x => `<code>${esc(x)}</code>`).join(', ') : '<span class="rt-of-none">none</span>');

/** @returns {{ play(): void, pause(): void }} */
export function mountOntoFleet(el, model, opts = {}) {
  const tip = opts.tip ?? noTip;
  const noop = { play() {}, pause() {} };
  if (!el || !model) return noop;
  const { counts, rules, queues, x1, schema, pack } = model;

  // Job 1: the X1 chain's decisive facts, once each, with the steps whose check read them.
  const facts = [];
  for (const step of x1) for (const t of step.on?.triples ?? []) {
    const k = `${t.s}|${t.p}|${t.o}`;
    let f = facts.find(x => x.k === k);
    if (!f) facts.push(f = { k, t, steps: [] });
    f.steps.push(step.what);
  }

  // Job 3: one row per team: the pack's teams, plus any queue key the pack does not name.
  const teamNodes = schema.nodes.filter(n => n.role === 'team');
  const owned = id => schema.links.filter(l => l.role === 'owned' && l.o === id).map(l => schema.nodes.find(n => n.id === l.s)?.label ?? l.s);
  const keys = [...new Set([...teamNodes.map(n => n.id.replace(/^team:/, '')), ...Object.keys(queues.on.byTeam), ...Object.keys(queues.off.byTeam)])];
  const teams = keys.map(k => {
    const node = teamNodes.find(n => n.id === `team:${k}`);
    return { key: k, label: node?.label ?? k, on: queues.on.byTeam[k] ?? 0, off: queues.off.byTeam[k] ?? 0, actions: node ? owned(node.id) : [] };
  });
  const max = Math.max(1, ...teams.map(t => Math.max(t.on, t.off)));

  el.innerHTML = `<section class="rt-of" data-onto-fleet>
<p class="rt-of-grade" data-onto-fleet-grade>${esc(GRADE_LINE)}</p>
<p class="rt-of-lead">Six agents of a fictional content platform, each on its own team. The ontology here is the
<a href="${esc(pack.path)}" target="_blank" rel="noopener">${esc(pack.title)}</a>; it does three jobs for them.</p>
<div class="rt-of-jobs">

<article class="card rt-of-job" data-onto-fleet-job="facts">
<header><span class="rt-of-n" aria-hidden="true">1</span><h3>Gives each call the declared facts its trace lacks
${tip('Each scripted tool call carries a <b>slice</b> of typed facts (subject, predicate, object, grade) declared by the systems that own them. A trace-only monitor sees the call; it does not have these facts.')}</h3></header>
<p class="rt-of-fig"><b data-onto-fleet-num="triples">${counts.triples}</b> triples across <b data-onto-fleet-num="calls">${counts.calls}</b> checked calls</p>
<p class="rt-of-sub">In the cross-team cascade, the facts that decided it:</p>
<ul class="rt-of-facts">${facts.map(f => `<li data-onto-fleet-fact>${triple(f.t)}<small>read at: ${f.steps.map(esc).join(' · ')}</small></li>`).join('')}</ul>
<div class="rt-of-limits" data-onto-fleet-limits>${LIMITS.map(s => `<p>${esc(s)}</p>`).join('')}</div>
</article>

<article class="card rt-of-job" data-onto-fleet-job="rules">
<header><span class="rt-of-n" aria-hidden="true">2</span><h3>Typed rules read those facts
${tip('The predicates each rule read are taken from the facts the engine marked as used for the calls it stopped. <b>Declared complete</b>: the slice says a list (for example an agency’s scopes) is complete, so a missing entry counts as absent rather than unknown.')}</h3></header>
<p class="rt-of-fig"><b data-onto-fleet-num="rules">${rules.length}</b> typed rules</p>
<ul class="rt-of-rules">${rules.map(r => `<li data-onto-fleet-rule="${esc(r.id)}">
<div class="rt-of-rule-head"><code>${esc(r.id)}</code><span class="rt-chip" data-kind="${r.effect === 'BLOCK' ? 'blocked' : 'review'}">${esc(r.effect)}</span>${tip(esc(r.text))}</div>
<div class="rt-of-preds" data-onto-fleet-preds>reads ${list(r.predicates)}${r.complete.length ? `; declared complete: ${list(r.complete)}` : ''}</div>
<div class="rt-of-stops">stopped with the slice: ${list(r.stoppedOn)} · trace only: ${list(r.stoppedOff)}</div></li>`).join('')}</ul>
</article>

<article class="card rt-of-job" data-onto-fleet-job="routes">
<header><span class="rt-of-n" aria-hidden="true">3</span><h3>Routes each stop to the owning team
${tip('<b>OWNED_BY_TEAM</b> in the pack names the team that reviews each kind of action. A stopped call goes to the owner of its action, not to the team that runs the agent.')}</h3></header>
<p class="rt-of-fig"><b data-onto-fleet-num="on">${queues.on.total}</b> stopped calls with the slice · <b data-onto-fleet-num="off">${queues.off.total}</b> trace only</p>
<ul class="rt-of-teams">${teams.map(t => `<li data-onto-fleet-team="${esc(t.key)}" data-on="${t.on}" data-off="${t.off}">
<div class="rt-of-team-head"><b>${esc(t.label)}</b>${t.actions.length ? tip(`Owns: ${t.actions.map(esc).join(', ')}.`) : ''}</div>
<div class="rt-of-bars" aria-hidden="true"><i class="on" style="--v:${t.on / max}"></i><i class="off" style="--v:${t.off / max}"></i></div>
<div class="rt-of-team-n">with the slice ${t.on} · trace only ${t.off}</div></li>`).join('')}</ul>
</article>
</div>
<div class="rt-of-go">
<button type="button" class="btn secondary" data-onto-fleet-go="fleet" data-wm-route="#view=runtime-observation&amp;tab=fleet">See it run in the Agent fleet tab →</button>
<button type="button" class="btn secondary" data-onto-fleet-go="graph" data-wm-route="#view=runtime-observation&amp;tab=ontology&amp;sub=graph">Explore the graph →</button>
</div>
</section>`;
  return noop;
}
