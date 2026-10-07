// Runtime Observation · "What the ontology adds" (logs/2026-10-04_ONTOLOGY_OBSERVATION_SHOWCASE_PLAN.md, Part B).
// Layout (logs/2026-10-07_RUNTIME_SUBTABS_PLAN.md): Test 1 / Test 2 / Example runs switcher; each test reads verdict + plain
// headline → three tiles with plain captions → the three pre-registered parts; p-values, counts and sources sit behind ⓘ,
// per-model tables and the full notes in a closed <details>.
// Everything shown comes from data/onto-s1.json (the Stage-1 test), data/onto-s2.json (the AgentDyn replication) and data/onto-observability.json (example runs), generated from
// committed experiment outputs. The unconfirmed E-AL and E-PR results moved to silex-security/ontology-typed-alerting.
import { tip } from './rt-tip.js';

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
  supported: ['ran', 'Confirmed (pre-registered)', 'On held-out AgentDojo runs, ontology types cut alerts and raised precision; recall stayed within the registered tolerance in that pool (observed, not a guarantee).'],
  'not supported': ['blocked', 'Not confirmed', 'On held-out runs the pre-registered test did not confirm the claim: not every part below held.'],
  inconclusive: ['review', 'Inconclusive', 'The pre-registered test could not be decided on the held-out runs.'],
};

let data = null, cell = 'both', mode = 'onto';

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
function tiles(attr, o, perBase) {
  const rel = o.s1.F / o.prov.F - 1;
  const bases = Object.values(perBase), n = bases.length;
  const up = bases.filter(x => x.s1.precision > x.prov.precision).length;
  const perModel = up === n ? ` It rose for all ${n} base models.` : up === 0 ? ' It fell for every base model.' : ` It rose for ${up} of ${n} base models.`;
  const cls = (better, after) => `<span class="${better ? 'rt-up' : 'rt-down'}">${after}</span>`;
  const tile = (k, before, after, better, plain) => `<div class="card metric"><div class="kicker">${k}</div><div class="metric-value">${before} <span class="rt-arrow">→</span> ${cls(better, after)}</div><div class="rt-ba">without → with ontology types</div><div class="rt-plain">${plain}</div></div>`;
  return `<div class="rt-learning-tiles" ${attr}>
      ${tile('Alerts raised (runs)', `<span ${attr.replace('-tiles', '-num')}="prov-F">${o.prov.F}</span>`, `<span ${attr.replace('-tiles', '-num')}="s1-F">${o.s1.F}</span>`, rel < 0, `${pct(Math.abs(rel))} ${rel < 0 ? 'fewer alerts to look at' : 'more alerts: more noise for the team'}.`)}
      ${tile('Precision', pct(o.prov.precision), pct(o.s1.precision), o.s1.precision > o.prov.precision, `Of every 100 alerts, ${of100(o.s1.precision)} were real attacks (was ${of100(o.prov.precision)}).${perModel}`)}
      ${tile('Recall', pct(o.prov.recall), pct(o.s1.recall), o.s1.recall >= o.prov.recall, `Of every 100 real attacks, ${of100(o.s1.recall)} got an alert (was ${of100(o.prov.recall)}). Observed, not a guarantee.`)}
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
function s1Block(r, s2) {
  if (!r) return '';
  const [kind, badge] = VERDICT[r.verdict] ?? VERDICT.inconclusive;
  const n = Object.keys(r.per_base).length;
  const replicated = s2 && s2.verdict === 'supported';
  const scope = replicated ? 'It holds for held-out AgentDojo runs, and Test 2 on AgentDyn repeated it.' : 'It holds for held-out AgentDojo tasks and these models only; Test 2 on AgentDyn did not repeat it.';
  return `<section class="rt-onto-s1" data-onto-s1 data-onto-s1-verdict="${esc(r.verdict)}">
    <div class="rt-onto-verdict card"><span class="rt-chip" data-kind="${kind}">${esc(badge)}</span>
      <span class="rt-scope"><b>${headline(r.observed)}</b> ${scope}${tip(`Pre-registered test (S1, AgentDojo): same alert rule, with and without ontology types, on ${r.counts.runs} never-opened AgentDojo runs (${r.counts.cohorts} agent pipelines and attack variants, ${r.counts.K} base models, ${r.counts.positives} successful attacks). No judge model.`)}</span></div>
    ${tiles('data-onto-s1-tiles', r.observed, r.per_base)}
    ${parts('data-onto-s1-part', r, 'AgentDojo')}
    <details class="rt-more"><summary>Per base model, and sources</summary><div>
    ${table(r)}
    <p class="rt-ref">Precision rose for all ${n} base models. These results hold for AgentDojo's tasks and these models only, and the replication on AgentDyn did not confirm them; gpt-4o counts once although it contributes 13 defence and attack variants. <a href="logs/2026-10-04_ONTOLOGY_S1_REPORT.md">Report</a> · <a href="logs/2026-10-04_ONTOLOGY_STAGE1_PLAN.md">plan</a>.</p>
    </div></details>
  </section>`;
}
function s2Block(r) {
  if (!r) return '';
  const [kind, badge] = VERDICT[r.verdict] ?? VERDICT.inconclusive;
  const o = r.observed;
  const bpb = r.b_prov_bound.prov;
  const everyLower = Object.values(r.per_base).every(x => x.s1.precision < x.prov.precision);
  const lowerClause = everyLower ? '; precision was lower in every base model' : '';
  return `<section class="rt-onto-s1 rt-onto-s2" data-onto-s2 data-onto-s2-verdict="${esc(r.verdict)}">
    <div class="rt-onto-verdict card"><span class="rt-chip" data-kind="${kind}">${esc(badge)}</span>
      <span class="rt-scope"><b>${headline(o)}</b> The AgentDojo precision gain did not carry over to these new suites. This does not show that typing is harmful in general.${tip(`Replication (S2, AgentDyn): the same frozen rules, pre-registered on ${r.counts.runs} never-opened AgentDyn runs (3 new suites built on the AgentDojo harness; ${r.counts.K} undefended base models; ${r.counts.positives} successful attacks). No judge model.`)}</span></div>
    ${tiles('data-onto-s2-tiles', o, r.per_base)}
    ${parts('data-onto-s2-part', r, 'AgentDyn')}
    <div class="rt-takeaway"><b>Why it may differ.</b> Most of the gap goes with how a “write” action is recognised: deciding writes from what the call does, instead of its tool name, gives precision ${pct(bpb.precision)} and recall ${pct(bpb.recall)}, close to the typed rule. Test 2 also changed the binding procedure and used only undefended models. Both tests use the AgentDojo harness, so neither is evidence from an independent framework.</div>
    <details class="rt-more"><summary>Per base model, and sources</summary><div>
    <p class="rt-ref">The AgentDojo precision gain did not replicate: pooled, the typed rule alerted on more runs and caught more attacks, at lower precision${lowerClause}. Descriptively, most of the gap goes with how “write” is decided: taking writes from the binding's effects instead of the tool-name pattern gives precision ${pct(bpb.precision)} and recall ${pct(bpb.recall)}, close to the typed rule. S2 also differs from S1 beyond its suites: the binding procedure changed, and its primary pool has only the undefended models, where S1 pooled defended and attack variants too. This does not show that typing is harmful in general. AgentDyn reuses AgentDojo's harness, so neither test is evidence from an independent framework. <a href="logs/2026-10-06_ONTOLOGY_S2_REPORT.md">Report</a> · <a href="logs/2026-10-06_ONTOLOGY_S2_AGENTDYN_PLAN.md">plan</a>.</p>
    ${table(r)}
    </div></details>
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

function showPane(id) {
  for (const b of document.querySelectorAll('[data-onto-seg]')) b.setAttribute('aria-pressed', String(b.dataset.ontoSeg === id));
  for (const p of document.querySelectorAll('[data-onto-pane]')) p.hidden = p.dataset.ontoPane !== id;
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
    let s2 = null;
    try { const rs = await fetch('data/onto-s2.json'); if (rs.ok) s2 = await rs.json(); } catch {}
    const a = data.al;
    const seg = (id, label, verdict, extra = '') => {
      const [kind, badge] = verdict ? (VERDICT[verdict] ?? VERDICT.inconclusive) : [];
      return `<button type="button" data-onto-seg="${id}" aria-pressed="${id === 's1'}" ${extra}>${label}${verdict ? ` <span class="rt-chip" data-kind="${kind}">${esc(badge)}</span>` : ''}</button>`;
    };
    root.innerHTML = `<div class="rt-seg" role="group" aria-label="Which result">
        ${s1 ? seg('s1', 'Test 1 · AgentDojo', s1.verdict) : ''}${seg('s2', 'Test 2 · AgentDyn', s2?.verdict, 'data-onto-s2-seg')}${seg('ex', 'Example runs')}
      </div>
      <div class="rt-onto-pane" data-onto-pane="s1">${s1Block(s1, s2)}</div>
      <div class="rt-onto-pane" data-onto-pane="s2" hidden>${s2 ? s2Block(s2) : '<p class="rt-ref" data-onto-s2-missing>The replication on AgentDyn (S2) did not confirm the S1 result; its data could not be loaded.</p>'}</div>
      <div class="rt-onto-pane" data-onto-pane="ex" hidden>
      <p class="rt-onto-ex-intro">One real run per case, without and with ontology types: <b>caught by both</b>, <b>alert saved</b> (types removed a false alarm), <b>alert lost</b> (types missed an attack) and <b>missed by both</b>. Switch the rule to see what each one flags, and why.${tip(`From an earlier held-out cohort: ${a.counts.runs} AgentDojo runs of ${a.models.length} agent models (${a.models.map(esc).join(', ')}). Examples are chosen by a fixed rule (first run by id in each case), including the cases where the ontology loses an alert or both rules miss. Outcomes are run level, from the benchmark's evaluator. Provenance here means: ${esc(data.provenance_note)}.`)}</p>
      <div class="rt-onto-controls">
        <div class="tabs" role="tablist" aria-label="Example">${CELLS.map(([id, label]) => `<button type="button" class="tab" data-onto-cell-btn="${id}">${label}</button>`).join('')}</div>
        <div class="tabs" role="tablist" aria-label="Rule"><button type="button" class="tab" data-onto-mode-btn="prov">Without ontology</button><button type="button" class="tab" data-onto-mode-btn="onto">With ontology</button></div>
      </div>
      <div id="rtOntoExample"></div>
      </div>`;
    if (!s1) showPane('s2');
    root.addEventListener('click', e => {
      const c = e.target.closest('[data-onto-cell-btn]'), m = e.target.closest('[data-onto-mode-btn]'), g = e.target.closest('[data-onto-seg]');
      if (c) { cell = c.dataset.ontoCellBtn; render(); }
      if (m) { mode = m.dataset.ontoModeBtn; render(); }
      if (g) showPane(g.dataset.ontoSeg);
    });
    render();
    const jb = data.judge_baseline, note = document.getElementById('rtJudgeRealNote');
    if (note) note.innerHTML = `<b>⚠ Reality check.</b> The tiles above come from a test split whose attack items are recognisable by their format; on it the fine-tuned judge's goal_deviation AUROC is <span data-onto-judge-split>${Number(jb.e1_split_auroc).toFixed(3)}</span> (call level). On ${data.v2_descriptive.runs} held-out real agent trajectories the same judge scores <b data-onto-judge-real>${Number(jb.real_runs_auroc).toFixed(3)}</b> (run level). The split overstates practice: expect real-world results nearer the lower figure.`;
  } catch {
    root.innerHTML = '<p class="rt-ref">The ontology results could not be loaded.</p>';
  }
}
init();
