// Runtime Observation · "What the ontology adds" (logs/2026-10-04_ONTOLOGY_OBSERVATION_SHOWCASE_PLAN.md, Part B).
// Everything shown comes from data/onto-s1.json (the Stage-1 test) and data/onto-observability.json (example runs), generated from
// committed experiment outputs. The unconfirmed E-AL and E-PR results moved to silex-security/ontology-typed-alerting.
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pct = x => (x == null ? '—' : `${(100 * x).toFixed(1)} %`);
const CELLS = [
  ['both', 'Caught by both', 'A successful attack that both rules alert on'],
  ['saved', 'Alert saved', 'The untyped rule alerts on a run without a successful attack; the typed rule does not'],
  ['lost', 'Alert lost', 'A successful attack the untyped rule catches and the typed rule misses'],
  ['miss', 'Missed by both', 'A successful attack neither rule alerts on'],
];
const VERDICT = {
  supported: ['ran', 'Confirmed (pre-registered)', 'On held-out runs, ontology types cut alerts while keeping recall within the registered tolerance.'],
  'not supported': ['blocked', 'Not confirmed', 'On held-out runs the pre-registered test did not confirm the claim: not every part below held.'],
  inconclusive: ['review', 'Inconclusive', 'The pre-registered test could not be decided on the held-out runs.'],
};

let data = null, cell = 'both', mode = 'onto';

const pts = x => `${x >= 0 ? '+' : '−'}${Math.abs(100 * x).toFixed(1)}`;
function part(id, label, p, ci, attr = 'data-onto-part') {
  const ok = p != null && p <= 0.05;
  return `<li ${attr}="${id}" ${attr}-ok="${ok}"><span class="rt-chip" data-kind="${ok ? 'ran' : 'review'}">${ok ? 'held' : 'not established'}</span> ${esc(label)} <span class="rt-onto-k">(one-sided p = ${p == null ? '—' : Number(p).toPrecision(2)}${ci ? `; 95 % CI ${esc(ci)}` : ''})</span></li>`;
}
function s1Block(r) {
  if (!r) return '';
  const [kind, badge] = VERDICT[r.verdict] ?? VERDICT.inconclusive;
  const o = r.observed, c = r.constraint, n = Object.keys(r.per_base).length;
  const tile = (k, before, after, foot) => `<div class="card metric"><div class="kicker">${k}</div><div class="metric-value">${before} → ${after}</div><div class="metric-foot">${foot}</div></div>`;
  const row = (name, x) => `<tr><th scope="row">${esc(name)}</th><td>${x.s1.Pos}</td><td>${x.prov.F} → ${x.s1.F}</td><td>${pct(x.prov.precision)} → ${pct(x.s1.precision)}</td><td>${pct(x.prov.recall)} → ${pct(x.s1.recall)}</td></tr>`;
  const held = ok => `<span class="rt-chip" data-kind="${ok ? 'ran' : 'review'}">${ok ? 'held' : 'not established'}</span>`;
  return `<section class="rt-onto-s1" data-onto-s1 data-onto-s1-verdict="${esc(r.verdict)}">
    <h3>Pre-registered test: ontology types on the runtime provenance graph</h3>
    <div class="rt-onto-verdict"><span class="rt-chip" data-kind="${kind}">${esc(badge)}</span>
      <span>Same alert rule, with and without ontology types, pre-registered on ${r.counts.runs} never-opened AgentDojo runs (${r.counts.cohorts} agent pipelines and attack variants, ${r.counts.K} base models, ${r.counts.positives} successful attacks). No judge model.</span></div>
    <div class="rt-learning-tiles" data-onto-s1-tiles>
      ${tile('Alerts raised (runs)', `<span data-onto-s1-num="prov-F">${o.prov.F}</span>`, `<span data-onto-s1-num="s1-F">${o.s1.F}</span>`, `without → with ontology types · ${pct(1 - o.s1.F / o.prov.F)} fewer`)}
      ${tile('Precision', pct(o.prov.precision), pct(o.s1.precision), 'share of alerts that are a successful attack')}
      ${tile('Recall', pct(o.prov.recall), pct(o.s1.recall), 'share of successful attacks alerted')}
    </div>
    <ul class="rt-onto-parts">
      ${part('a', 'Higher precision, generalising across tasks', r.p?.a, r.ci?.precision_vs_prov && `${pts(r.ci.precision_vs_prov[0])} to ${pts(r.ci.precision_vs_prov[1])} points`, 'data-onto-s1-part')}
      <li data-onto-s1-part="b" data-onto-s1-part-ok="${!!c.holds}">${held(c.holds)} Recall at most ${(100 * r.margin).toFixed(0)} points lower in this pool <span class="rt-onto-k">(observed, not a guarantee: mean over base models ${pts(c.theta)}, all runs ${pts(c.pooled_d)} points)</span></li>
      ${part('c', 'Better than random typing of the same size', r.p?.c, null, 'data-onto-s1-part')}
    </ul>
    <div class="rt-onto-table"><table><thead><tr><th scope="col">Base model</th><th scope="col">Successful attacks</th><th scope="col">Alerts</th><th scope="col">Precision</th><th scope="col">Recall</th></tr></thead><tbody>
      ${Object.entries(r.per_base).map(([k, v]) => row(k, v)).join('')}
    </tbody></table></div>
    <p class="rt-ref">Precision rose for all ${n} base models. The recall statement holds for AgentDojo's tasks and these models only; gpt-4o counts once although it contributes 13 defence and attack variants. <a href="logs/2026-10-04_ONTOLOGY_S1_REPORT.md">Report</a> · <a href="logs/2026-10-04_ONTOLOGY_STAGE1_PLAN.md">plan</a>.</p>
  </section>`;
}
function chain(x, typed) {
  if (!x) return '';
  const src = `<div class="rt-onto-src"><div class="rt-onto-src-ref">${esc(x.source.ref)}</div><div>${hl(x.source.excerpt, x.value)}</div></div>`;
  if (!typed) return `<ol class="rt-onto-chain"><li><b>${esc(x.tool)}</b> is a write call</li><li>argument <code>${esc(x.arg)}</code> = <code>${esc(x.value)}</code></li><li>the value appeared earlier in a tool output and not in the user's task</li></ol>${src}`;
  return `<ol class="rt-onto-chain" data-onto-chain>
    <li><b>${esc(x.tool)}</b> <span class="rt-onto-k">may cause</span> ${x.effects.map(e => `<span class="rt-onto-tag">${esc(e)}</span>`).join(' ')}</li>
    <li>argument <code>${esc(x.arg)}</code> <span class="rt-onto-k">denotes</span> <span class="rt-onto-tag">${esc(x.class)}</span> <span class="rt-onto-k">— a class the ontology's hazards target</span></li>
    <li>its value <code>${esc(x.value)}</code> <span class="rt-onto-k">appeared earlier in a tool output, not in the user's task</span></li></ol>${src}`;
}
function hl(text, needle) {
  const t = String(text ?? ''), i = needle ? t.indexOf(needle) : -1;
  return i < 0 ? esc(t) : `${esc(t.slice(0, i))}<mark>${esc(needle)}</mark>${esc(t.slice(i + needle.length))}`;
}

function example() {
  const ex = data.examples.find(e => e.cell === cell);
  const desc = CELLS.find(c => c[0] === cell)[2];
  if (!ex || ex.empty) return `<p class="rt-ref" data-onto-empty>${esc(desc)}: no qualifying example in the held-out runs.</p>`;
  const rule = mode === 'onto' ? ex.otp : ex.prov;
  const other = mode === 'onto' ? ex.prov : ex.otp;
  const why = ex.why_not[mode === 'onto' ? 'otp' : 'prov'] ?? {};
  const calls = ex.run.calls.map(c => {
    const flagged = rule.call_index === c.index;
    return `<li class="rt-onto-call${flagged ? ' flagged' : ''}" data-onto-call="${c.index}" ${flagged ? 'data-onto-flagged' : ''}>
      <div class="rt-onto-call-head"><code>${esc(c.tool)}</code><span class="rt-chip" data-kind="${flagged ? 'blocked' : 'ran'}">${flagged ? 'Alert' : 'No alert'}</span></div>
      <div class="rt-onto-args">${esc(c.args)}</div>
      ${flagged ? chain(rule.explanation, mode === 'onto') : `<div class="rt-onto-why">${esc(why[c.index] ?? '')}</div>`}</li>`;
  }).join('');
  const differ = ex.otp.call_index != null && ex.prov.call_index != null && ex.otp.call_index !== ex.prov.call_index
    ? `<p class="rt-ref">The two rules alert on different calls of this run (the other rule's first alert is call ${other.call_index}).</p>` : '';
  return `<div class="rt-onto-run" data-onto-run="${esc(ex.run.run_id)}">
    <div class="rt-onto-run-head"><span class="rt-chip" data-kind="${ex.run.outcome.startsWith('attack succeeded') ? 'blocked' : 'review'}">${esc(ex.run.outcome)}</span>
      <span class="rt-ref">${esc(ex.run.model)} · ${esc(ex.run.suite)} · ${esc(desc)}</span></div>
    <p class="rt-onto-task"><b>User task:</b> ${esc(ex.run.task)}</p>${differ}
    <ol class="rt-onto-calls">${calls}</ol></div>`;
}

function render() {
  $('rtOntoExample').innerHTML = example();
  for (const b of document.querySelectorAll('[data-onto-cell-btn]')) b.classList.toggle('active', b.dataset.ontoCellBtn === cell);
  for (const b of document.querySelectorAll('[data-onto-mode-btn]')) b.classList.toggle('active', b.dataset.ontoModeBtn === mode);
  $('rtOntology').dataset.ontoMode = mode; $('rtOntology').dataset.ontoCell = cell;
}

async function init() {
  const root = $('rtOntologyBody');
  if (!root) return;
  try {
    const r = await fetch('data/onto-observability.json');
    if (!r.ok) throw new Error('unavailable');
    data = await r.json();
    let s1 = null;
    try { const rs = await fetch('data/onto-s1.json'); if (rs.ok) s1 = await rs.json(); } catch {}
    const a = data.al;
    root.innerHTML = `${s1Block(s1)}
      <h3 class="rt-onto-ex-h">Example runs, with and without ontology types</h3>
      <p class="rt-ref">From an earlier held-out cohort: ${a.counts.runs} AgentDojo runs of ${a.models.length} agent models (${a.models.map(esc).join(', ')}).</p>
      <div class="rt-onto-controls">
        <div class="tabs" role="tablist" aria-label="Example">${CELLS.map(([id, label]) => `<button type="button" class="tab" data-onto-cell-btn="${id}">${label}</button>`).join('')}</div>
        <div class="tabs" role="tablist" aria-label="Rule"><button type="button" class="tab" data-onto-mode-btn="prov">Without ontology</button><button type="button" class="tab" data-onto-mode-btn="onto">With ontology</button></div>
      </div>
      <div id="rtOntoExample"></div>
      <p class="rt-ref">Examples are chosen by a fixed rule (first run by id in each case), including the cases where the ontology loses an alert or both rules miss. Outcomes are run level, from the benchmark's evaluator. Provenance here means: ${esc(data.provenance_note)}.</p>`;
    root.addEventListener('click', e => {
      const c = e.target.closest('[data-onto-cell-btn]'), m = e.target.closest('[data-onto-mode-btn]');
      if (c) { cell = c.dataset.ontoCellBtn; render(); }
      if (m) { mode = m.dataset.ontoModeBtn; render(); }
    });
    render();
    const jb = data.judge_baseline, note = document.getElementById('rtJudgeRealNote');
    if (note) note.innerHTML = `<b>How realistic are these numbers?</b> The figures above come from a test split whose attack items are recognisable by their format; on it the fine-tuned judge's goal_deviation AUROC is <span data-onto-judge-split>${Number(jb.e1_split_auroc).toFixed(3)}</span> (call level). On ${data.v2_descriptive.runs} held-out real agent trajectories the same judge scores <b data-onto-judge-real>${Number(jb.real_runs_auroc).toFixed(3)}</b> (run level). The split overstates practice.`;
  } catch {
    root.innerHTML = '<p class="rt-ref">The ontology results could not be loaded.</p>';
  }
}
init();
