// Runtime Observation · Ontology pictures (logs/2026-10-11_RT_SUBTABS_VISUAL_PLAN.md, T2).
// mountOntoHow: one real held-out run, without and with ontology types. mountOntoS1: the pre-registered test (data/onto-s1.json).
// Every number comes from the data passed in. No DOM access at module top level (tests import this under Node).
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pct = x => (x == null ? '—' : `${(100 * x).toFixed(1)} %`);
const noTip = () => '';
// Badge per verdict of the pre-registered test; js/rt-ontology.js shows it on the sub-tab button too.
export const VERDICT = {
  supported: ['ran', 'Confirmed (pre-registered)', 'On held-out AgentDojo runs, ontology types cut alerts and raised precision; recall stayed within the registered tolerance in that pool (observed, not a guarantee).'],
  'not supported': ['blocked', 'Not confirmed', 'On held-out runs the pre-registered test did not confirm the claim: not every part below held.'],
  inconclusive: ['review', 'Inconclusive', 'The pre-registered test could not be decided on the held-out runs.'],
};

const pts = x => `${x >= 0 ? '+' : '−'}${Math.abs(100 * x).toFixed(1)}`;
const of100 = x => Math.round(100 * x);
const held = ok => `<span class="rt-chip" data-kind="${ok ? 'ran' : 'review'}">${ok ? 'held' : 'not established'}</span>`;
function part(id, label, plain, p, ci, attr, tip) {
  const ok = p != null && p <= 0.05;
  const pstr = p == null ? '—' : (p >= 0.995 ? Number(p).toFixed(3) : Number(p).toPrecision(2));
  return `<li ${attr}="${id}" ${attr}-ok="${ok}">${held(ok)}<span>${esc(label)}${tip(`${esc(plain(ok))} one-sided p = ${pstr}${ci ? `; 95 % CI ${esc(ci)}` : ''}`)}</span></li>`;
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
function tiles(attr, o, tip) {
  const maximum = Math.max(o.prov.F, o.s1.F);
  const labels = { prov: 'Without types', s1: 'With types' };
  const keys = ['prov', 's1'];
  const bars = keys.map(k => {
    const x = o[k], fp = x.F - x.TP;
    return `<div class="rt-ov-bar-row"><b>${labels[k]}: <span data-onto-s1-num="${k}-F">${x.F}</span> alerts</b>
    <svg role="img" aria-label="${labels[k]}: ${x.F} alerts, ${x.TP} real attacks, ${fp} false alarms" viewBox="0 0 600 38" data-rt-ov-alert="${k}" data-total="${x.F}" data-tp="${x.TP}">
    <path class="rt-ov-axis" d="M0 34H600"/><g class="rt-ov-grow"><rect class="rt-ov-real" width="${600*x.TP/maximum}" height="26"/><rect class="rt-ov-false" x="${600*x.TP/maximum}" width="${600*fp/maximum}" height="26"/></g></svg>
    <small>Real attack ${x.TP} · False alarm ${fp}</small></div>`;
  }).join('');
  const waffles = keys.map(k => `<div><b>${labels[k]} · ${pct(o[k].precision)}</b><svg role="img" aria-label="${labels[k]}: of 100 alerts, ${of100(o[k].precision)} real attacks; rounded to whole percent" viewBox="0 0 120 120" class="rt-ov-waffle" data-rt-ov-waffle="${k}">${Array.from({length:100},(_,i)=>`<rect x="${(i%10)*12}" y="${Math.floor(i/10)*12}" width="10" height="10" class="${i<of100(o[k].precision)?'rt-ov-real rt-ov-lit':'rt-ov-false'}" style="--rt-ov-delay:${i*10}ms"/>`).join('')}</svg><small>Of 100 alerts, ${of100(o[k].precision)} real</small></div>`).join('');
  const recall = keys.map(k => `<div class="rt-ov-bar-row"><b>${labels[k]} · ${pct(o[k].recall)}</b><svg role="img" aria-label="${labels[k]}: ${o[k].TP} of ${o[k].Pos} successful attacks alerted, ${pct(o[k].recall)} recall" viewBox="0 0 600 32"><rect class="rt-ov-track" width="600" height="26"/><rect class="rt-ov-real rt-ov-grow" width="${600*o[k].recall}" height="26"/></svg><small>${o[k].TP} of ${o[k].Pos} successful attacks</small></div>`).join('');
  return `<div class="rt-ov-tiles" ${attr}>
  <div class="card metric rt-ov-alerts"><div class="kicker">Alerts raised (runs)${tip(DEF['Alerts raised (runs)'])}</div>${bars}<p class="rt-ref">Linear scale: 0–${maximum} alerted runs · Real attack / False alarm</p><p class="rt-plain">Different alert sets: types also catch some attacks the untyped rule missed (TP ${o.prov.TP} → ${o.s1.TP}).</p></div>
  <div class="card metric"><div class="kicker">Precision${tip(DEF.Precision)}</div><div class="rt-ov-waffles">${waffles}</div><p class="rt-ref">Each square = 1 % of alerts (rounded).</p></div>
  <div class="card metric"><div class="kicker">Recall${tip(DEF.Recall)}</div>${recall}<p class="rt-ref">Linear scale: 0–100 % of successful attacks</p><p data-onto-s1-observed>Observed, not a guarantee.</p></div></div>`;
}
const PLAIN = {
  a: ok => ok ? 'The gain holds across tasks the rule never saw, not just a few.' : 'Precision was not shown to be higher on tasks the rule never saw.',
  b: ok => ok ? 'Cutting noise did not cost more than the allowed 3 points of recall (observed, not a guarantee).' : 'Recall dropped by more than the allowed 3 points.',
  c: ok => ok ? 'It is the meaning of the types that helps, not just having more labels.' : 'Not distinguishable from random labels of the same size.',
};
function parts(attr, r, suites, tip) {
  const c = r.constraint;
  return `<ul class="rt-onto-parts card">
      ${part('a', `Higher precision across held-out ${suites} tasks`, PLAIN.a, r.p?.a, r.ci?.precision_vs_prov && `${pts(r.ci.precision_vs_prov[0])} to ${pts(r.ci.precision_vs_prov[1])} points`, attr, tip)}
      <li ${attr}="b" ${attr}-ok="${!!c.holds}">${held(c.holds)}<span>Recall at most ${(100 * r.margin).toFixed(0)} points lower in this pool${tip(`Cutting noise did not cost more than the allowed ${100*r.margin} points of recall (observed, not a guarantee). Mean over base models ${pts(c.theta)}, all runs ${pts(c.pooled_d)} points`)}</span></li>
      ${part('c', 'Better than random typing of the same size', PLAIN.c, r.p?.c, null, attr, tip)}
    </ul>`;
}
const row = (name, x) => `<tr><th scope="row">${esc(name)}</th><td>${x.s1.Pos}</td><td>${x.prov.F} → ${x.s1.F}</td><td>${pct(x.prov.precision)} → ${pct(x.s1.precision)}</td><td>${pct(x.prov.recall)} → ${pct(x.s1.recall)}</td></tr>`;
const table = r => `<div class="rt-onto-table"><table><thead><tr><th scope="col">Base model</th><th scope="col">Successful attacks</th><th scope="col">Alerts</th><th scope="col">Precision</th><th scope="col">Recall</th></tr></thead><tbody>
      ${Object.entries(r.per_base).map(([k, v]) => row(k, v)).join('')}
    </tbody></table></div>`;
function s1Block(r, tip) {
  if (!r) return '';
  const [kind, badge] = VERDICT[r.verdict] ?? VERDICT.inconclusive;
  const n = Object.keys(r.per_base).length;
  const scope = 'It holds for held-out AgentDojo tasks and these models only.';
  return `<section class="rt-onto-s1" data-onto-s1 data-onto-s1-verdict="${esc(r.verdict)}">
    <div class="rt-onto-verdict card"><span class="rt-chip" data-kind="${kind}">${esc(badge)}</span>
      <span class="rt-scope"><b>${headline(r.observed)}</b> <span data-onto-s1-scope>${scope}</span>${tip(`Pre-registered test (S1, AgentDojo): same alert rule, with and without ontology types, on ${r.counts.runs} never-opened AgentDojo runs (${r.counts.cohorts} agent pipelines and attack variants, ${r.counts.K} base models, ${r.counts.positives} successful attacks). No judge model.`)}</span></div>
    ${tiles('data-onto-s1-tiles', r.observed, tip)}
    ${parts('data-onto-s1-part', r, 'AgentDojo', tip)}
    <details class="rt-more"><summary>Per base model, and sources</summary><div>
    ${table(r)}
    <p class="rt-ref">Precision rose for ${Object.values(r.per_base).filter(x => x.s1.precision > x.prov.precision).length} of ${n} base models. These results hold for AgentDojo's tasks and these models only; gpt-4o counts once although it contributes 13 defence and attack variants. <a href="logs/2026-10-04_ONTOLOGY_S1_REPORT.md">Report</a> · <a href="logs/2026-10-04_ONTOLOGY_STAGE1_PLAN.md">plan</a>.</p>
    </div></details>
  </section>`;
}

// Motion is driven only by the host or an explicit control. One timer per mount.
function motion(el, reducedMotion, steps) {
  let timer = null, beat = reducedMotion ? steps : 0, dead = false;
  const paint = state => { el.dataset.state = state; el.dataset.beat = String(beat); };
  const stop = () => { clearTimeout(timer); timer = null; };
  // Subnav never resumes an interrupted picture. Hiding must leave complete evidence.
  const pause = () => {
    stop();
    if (dead) return;
    beat = steps;
    el.dataset.settled = 'true';
    paint('done');
  };
  const freeze = () => { stop(); if (!dead && el.dataset.state === 'playing') paint('paused'); };
  const tick = () => {
    timer = null;
    if (dead) return;
    beat++;
    paint(beat >= steps ? 'done' : 'playing');
    if (beat < steps) timer = setTimeout(tick, 650);
  };
  const reset = () => {
    if (dead) return;
    stop();
    delete el.dataset.settled;
    beat = reducedMotion ? steps : 0;
    paint(reducedMotion ? 'done' : 'idle');
  };
  const play = () => {
    if (dead || timer) return;
    if (reducedMotion) { pause(); return; }
    if (beat >= steps) reset();
    paint('playing');
    timer = setTimeout(tick, 650);
  };
  const click = e => {
    const b = e.target.closest('[data-rt-ov-control]');
    if (!b || !el.contains(b)) return;
    const action = b.dataset.rtOvControl;
    if (action === 'pause') freeze();
    else { if (action === 'replay') reset(); play(); }
  };
  el.addEventListener('click', click); reset();
  return { play, pause, reset, destroy() { stop(); dead=true; el.removeEventListener('click',click); } };
}
const controls = () => `<div class="rt-ov-controls" role="group" aria-label="Animation controls"><button type="button" class="btn secondary" data-rt-ov-control="play">Play</button><button type="button" class="btn secondary" data-rt-ov-control="pause">Pause</button><button type="button" class="btn secondary" data-rt-ov-control="replay">Replay</button></div>`;
const emptyHandle = () => ({ play() {}, pause() {}, reset() {}, destroy() {} });
export function mountOntoHow(el, data, opts = {}) {
  if (!el) return emptyHandle();
  const explainTip = opts.tip ?? noTip;
  let selected = 'both';
  const labels = { both:'Caught by both', saved:'Alert saved', lost:'Alert lost' };
  const source = x => {
    if (!x.source) return '';
    const excerpt = esc(x.source.excerpt), value = esc(x.value);
    return explainTip(`${esc(x.source.ref)}<blockquote>${value ? excerpt.split(value).join(`<mark>${value}</mark>`) : excerpt}</blockquote>`);
  };
  const column = (ex, mode) => `<section class="rt-ov-column" data-rt-ov-rule="${mode}"><h3>${mode==='otp'?'With types':'Without types'}</h3>${ex.run.calls.map((call,i)=>{
    const flagged = ex[mode].call_index === call.index, x=flagged ? ex[mode].explanation : null;
    let reason = `<p class="rt-ov-why">${esc(ex.why_not?.[mode]?.[call.index] ?? '')}</p>`;
    if (x) reason = mode==='otp' ? `<div class="rt-ov-tags"><span data-rt-ov-effect>may cause → ${esc(x.effects.join(', '))}</span><span data-rt-ov-class>argument denotes → ${esc(x.class)}</span><span>value appeared earlier in a tool output, not in the user's task${explainTip(esc(data.provenance_note))}${source(x)}</span></div>` : `<div class="rt-ov-tags"><span>write call</span><span>${esc(x.arg)} = ${esc(x.value)}</span><span>the value appeared earlier in a tool output and not in the user's task${explainTip(esc(data.provenance_note))}${source(x)}</span></div>`;
    return `<article class="rt-ov-call" data-rt-ov-call="${call.index}" data-rt-ov-flagged="${flagged}" style="--rt-ov-delay:${i*110}ms"><b>${esc(call.tool)}</b><code>${esc(call.args)}</code><div class="rt-ov-explain">${reason}</div><strong class="rt-ov-decision">${flagged?'⚠ Alert':'✓ No alert'}</strong></article>`;
  }).join('')}</section>`;
  el.classList.add('rt-ov-how');
  el.innerHTML = `<p class="rt-ref" data-onto-how-claim>Real held-out AgentDojo runs from an earlier cohort, not the pool in ②. No judge model.${explainTip(`Earlier held-out cohort: ${esc(data.al.counts.runs)} AgentDojo runs; models: ${data.al.models.map(esc).join(', ')}. These examples are not from the S1 pool in ②.`)}</p><div class="rt-ov-switch" role="group" aria-label="Real run example">${Object.entries(labels).map(([key,label])=>`<button class="btn secondary" type="button" data-rt-ov-example="${key}">${label}</button>`).join('')}</div><div data-rt-ov-comparison></div><button type="button" class="btn secondary" data-onto-how-lost>Types can also lose an alert</button>${controls()}`;
  const handle=motion(el,opts.reducedMotion,3);
  function render() {
    const ex=data.examples.find(x=>x.cell===selected);
    el.querySelector('[data-rt-ov-comparison]').innerHTML = ex ? `<p class="rt-ov-task"><b>User task</b> ${esc(ex.run.task)}${explainTip(`${esc(ex.run.run_id)} · ${esc(ex.run.outcome)}`)}</p><div class="rt-ov-columns">${column(ex,'prov')}${column(ex,'otp')}</div>` : '';
    for(const b of el.querySelectorAll('[data-rt-ov-example]')) b.setAttribute('aria-pressed',String(b.dataset.rtOvExample===selected));
    el.dataset.example=selected;
  }
  const click=e=>{const b=e.target.closest('[data-rt-ov-example], [data-onto-how-lost]');if(!b || !el.contains(b))return;selected=b.dataset.rtOvExample ?? 'lost';handle.reset();render();handle.play();};
  el.addEventListener('click',click);render();
  return {...handle,destroy(){handle.destroy();el.removeEventListener('click',click);el.innerHTML='';}};
}
export function mountOntoS1(el, s1, opts = {}) {
  if (!el) return emptyHandle();
  const tip=opts.tip ?? noTip;
  el.classList.add('rt-ov-s1');
  el.innerHTML=s1Block(s1, tip)+controls();
  const handle=motion(el,opts.reducedMotion,1);
  return {...handle,destroy(){handle.destroy();el.innerHTML='';}};
}
