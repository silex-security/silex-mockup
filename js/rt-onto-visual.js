// Runtime Observation · Ontology pictures (logs/2026-10-11_RT_SUBTABS_VISUAL_PLAN.md, T2).
// mountOntoHow: one real held-out run, without and with ontology types. mountOntoS1: the pre-registered test (data/onto-s1.json).
// Every number comes from the data passed in. No DOM access at module top level (tests import this under Node).
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pct = x => (x == null ? '—' : `${(100 * x).toFixed(1)} %`);
const noTip = () => '';
let tip = noTip;
// Badge per verdict of the pre-registered test; js/rt-ontology.js shows it on the sub-tab button too.
export const VERDICT = {
  supported: ['ran', 'Confirmed (pre-registered)', 'On held-out AgentDojo runs, ontology types cut alerts and raised precision; recall stayed within the registered tolerance in that pool (observed, not a guarantee).'],
  'not supported': ['blocked', 'Not confirmed', 'On held-out runs the pre-registered test did not confirm the claim: not every part below held.'],
  inconclusive: ['review', 'Inconclusive', 'The pre-registered test could not be decided on the held-out runs.'],
};

const pts = x => `${x >= 0 ? '+' : '−'}${Math.abs(100 * x).toFixed(1)}`;
const of100 = x => Math.round(100 * x);
const held = ok => `<span class="rt-chip" data-kind="${ok ? 'ran' : 'review'}">${ok ? 'held' : 'not established'}</span>`;
function part(id, label, plain, p, ci, attr) {
  const ok = p != null && p <= 0.05;
  const pstr = p == null ? '—' : (p >= 0.995 ? Number(p).toFixed(3) : Number(p).toPrecision(2));
  return `<li ${attr}="${id}" ${attr}-ok="${ok}">${held(ok)}<span>${esc(label)}${tip(`one-sided p = ${pstr}${ci ? `; 95 % CI ${esc(ci)}` : ''}`)}<small>${plain(ok)}</small></span></li>`;
}
// One plain sentence from the pooled numbers: alert load, precision and recall, without → with ontology types.
function headline(o) {
  const rel = o.s1.F / o.prov.F - 1, dr = o.s1.recall - o.prov.recall;
  const recall = Math.abs(dr) < 0.01 ? 'about the same recall' : dr > 0 ? 'higher recall' : 'lower recall';
  return `With ontology types: ${pct(Math.abs(rel))} ${rel < 0 ? 'fewer' : 'more'} alerts, ${o.s1.precision > o.prov.precision ? 'higher' : 'lower'} precision and ${recall}.`;
}
const DEF = {
  'Alerts raised (runs)': 'How many runs raised an alert. Fewer means less noise for the security team.',
  Precision: 'Of the alerts, the share that were real attacks. Higher means fewer false alarms.',
  Recall: 'Of the real attacks, the share that got an alert. Higher means fewer misses.',
};
function tiles(attr, o, perBase) {
  const rel = o.s1.F / o.prov.F - 1;
  const bases = Object.values(perBase), n = bases.length;
  const up = bases.filter(x => x.s1.precision > x.prov.precision).length;
  const perModel = up === n ? ` It rose for all ${n} base models.` : up === 0 ? ' It fell for every base model.' : ` It rose for ${up} of ${n} base models.`;
  const cls = (better, after) => `<span class="${better ? 'rt-up' : 'rt-down'}">${after}</span>`;
  const tile = (k, before, after, better, plain) => `<div class="card metric"><div class="kicker">${k}${tip(DEF[k] ?? '')}</div><div class="metric-value">${before} <span class="rt-arrow">→</span> ${cls(better, after)}</div><div class="rt-ba">without → with ontology types</div><div class="rt-plain">${plain}</div></div>`;
  return `<div class="rt-learning-tiles" ${attr}>
      ${tile('Alerts raised (runs)', `<span ${attr.replace('-tiles', '-num')}="prov-F">${o.prov.F}</span>`, `<span ${attr.replace('-tiles', '-num')}="s1-F">${o.s1.F}</span>`, rel < 0, `${pct(Math.abs(rel))} ${rel < 0 ? 'fewer alerts to look at' : 'more alerts: more noise for the team'}.`)}
      ${tile('Precision', pct(o.prov.precision), pct(o.s1.precision), o.s1.precision > o.prov.precision, `Of every 100 alerts, ${of100(o.s1.precision)} were real attacks (was ${of100(o.prov.precision)}).${perModel}`)}
      ${tile('Recall', pct(o.prov.recall), pct(o.s1.recall), o.s1.recall >= o.prov.recall, `Of every 100 real attacks, ${of100(o.s1.recall)} got an alert (was ${of100(o.prov.recall)}). <span data-onto-s1-observed>Observed, not a guarantee.</span>`)}
    </div>`;
}
const PLAIN = {
  a: ok => ok ? 'The gain holds across tasks the rule never saw, not just a few.' : 'Precision was not shown to be higher on tasks the rule never saw.',
  b: ok => ok ? 'Cutting noise did not cost more than the allowed 3 points of recall (observed, not a guarantee).' : 'Recall dropped by more than the allowed 3 points.',
  c: ok => ok ? 'It is the meaning of the types that helps, not just having more labels.' : 'Not distinguishable from random labels of the same size.',
};
function parts(attr, r, suites) {
  const c = r.constraint;
  return `<ul class="rt-onto-parts card">
      ${part('a', `Higher precision across held-out ${suites} tasks`, PLAIN.a, r.p?.a, r.ci?.precision_vs_prov && `${pts(r.ci.precision_vs_prov[0])} to ${pts(r.ci.precision_vs_prov[1])} points`, attr)}
      <li ${attr}="b" ${attr}-ok="${!!c.holds}">${held(c.holds)}<span>Recall at most ${(100 * r.margin).toFixed(0)} points lower in this pool${tip(`observed, not a guarantee: mean over base models ${pts(c.theta)}, all runs ${pts(c.pooled_d)} points`)}<small>${PLAIN.b(!!c.holds)}</small></span></li>
      ${part('c', 'Better than random typing of the same size', PLAIN.c, r.p?.c, null, attr)}
    </ul>`;
}
const row = (name, x) => `<tr><th scope="row">${esc(name)}</th><td>${x.s1.Pos}</td><td>${x.prov.F} → ${x.s1.F}</td><td>${pct(x.prov.precision)} → ${pct(x.s1.precision)}</td><td>${pct(x.prov.recall)} → ${pct(x.s1.recall)}</td></tr>`;
const table = r => `<div class="rt-onto-table"><table><thead><tr><th scope="col">Base model</th><th scope="col">Successful attacks</th><th scope="col">Alerts</th><th scope="col">Precision</th><th scope="col">Recall</th></tr></thead><tbody>
      ${Object.entries(r.per_base).map(([k, v]) => row(k, v)).join('')}
    </tbody></table></div>`;
function s1Block(r) {
  if (!r) return '';
  const [kind, badge] = VERDICT[r.verdict] ?? VERDICT.inconclusive;
  const n = Object.keys(r.per_base).length;
  const scope = 'It holds for held-out AgentDojo tasks and these models only.';
  return `<section class="rt-onto-s1" data-onto-s1 data-onto-s1-verdict="${esc(r.verdict)}">
    <div class="rt-onto-verdict card"><span class="rt-chip" data-kind="${kind}">${esc(badge)}</span>
      <span class="rt-scope"><b>${headline(r.observed)}</b> <span data-onto-s1-scope>${scope}</span>${tip(`Pre-registered test (S1, AgentDojo): same alert rule, with and without ontology types, on ${r.counts.runs} never-opened AgentDojo runs (${r.counts.cohorts} agent pipelines and attack variants, ${r.counts.K} base models, ${r.counts.positives} successful attacks). No judge model.`)}</span></div>
    ${tiles('data-onto-s1-tiles', r.observed, r.per_base)}
    ${parts('data-onto-s1-part', r, 'AgentDojo')}
    <details class="rt-more"><summary>Per base model, and sources</summary><div>
    ${table(r)}
    <p class="rt-ref">Precision rose for all ${n} base models. These results hold for AgentDojo's tasks and these models only; gpt-4o counts once although it contributes 13 defence and attack variants. <a href="logs/2026-10-04_ONTOLOGY_S1_REPORT.md">Report</a> · <a href="logs/2026-10-04_ONTOLOGY_STAGE1_PLAN.md">plan</a>.</p>
    </div></details>
  </section>`;
}

/** @returns {{ play(): void, pause(): void, reset(): void, destroy(): void }} */
export function mountOntoHow(el, data, opts = {}) {
  if (!el) return { play() {}, pause() {}, reset() {}, destroy() {} };
  el.innerHTML = `<p class="rt-ref" data-onto-how-claim>Real held-out AgentDojo runs from an earlier cohort, not the pool in ②. No judge model.</p>
    <button type="button" class="btn secondary" data-onto-how-lost>Types can also lose an alert</button>`;
  return { play() {}, pause() {}, reset() {}, destroy() { el.innerHTML = ''; } };
}

/** @returns {{ play(): void, destroy(): void }} */
export function mountOntoS1(el, s1, opts = {}) {
  if (!el) return { play() {}, pause() {}, reset() {}, destroy() {} };
  tip = opts.tip ?? noTip;
  el.innerHTML = s1Block(s1);
  return { play() {}, pause() {}, reset() {}, destroy() { el.innerHTML = ''; } };
}
