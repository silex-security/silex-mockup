// Runtime Observation · Learning loop pictures (logs/2026-10-11_RT_SUBTABS_VISUAL_PLAN.md, T1).
// mountLoop: an illustration of the proposed loop (Held → Answer → Label → Train → Gate → Promote) as a ring a held-action
// card travels round; it stops at Gate, Promote stays dashed future work. mountLearningResults: before → after bars for
// the fine-tuned judge, one stamp card per promotion-gate candidate and the reality check, every number from
// learning-evidence.json and onto-observability.json's judge_baseline. Both mount idle (or finished under reduced motion)
// and only move when the sub-tab bar calls play(). No DOM access at module top level (tests import this under Node).

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const noTip = () => '';
const noop = () => {};
const idleHandle = () => ({ play: noop, pause: noop, reset: noop, destroy: noop });
const clamp01 = x => Math.max(0, Math.min(1, Number(x) || 0));
// The smallest "round" number ≥ x, for a bar scale that starts at 0 (1, 1.5, 2, 2.5, 3, 4, 5, 6, 8 × 10^k).
export function niceCeil(x) {
  if (!(x > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(x));
  return [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map(m => Number((m * p).toPrecision(12))).find(v => v >= x - 1e-9);
}

/* ---------------------------------------------------------------- loop ring */

export const LOOP_STEPS = [
  { key: 'held', name: 'Held', text: 'The judge is unsure and asks a person' },
  { key: 'answer', name: 'Answer', text: 'The reviewer says safe or unsafe' },
  { key: 'label', name: 'Label', text: 'The answer becomes a training label' },
  { key: 'train', name: 'Train', text: 'Kev is fine-tuned on the labels' },
  { key: 'gate', name: 'Gate', text: 'The new Kev is tested on cases it never saw' },
  { key: 'promote', name: 'Promote', text: '' },
];
const GATE = 4;                                   // the card stops here; Promote is never reached
const APPEAR = 400, TRAVEL = 800, DWELL = 1000;
// Time at which the card has finished its dwell on node i (the Step button's stops).
const STOP = i => APPEAR + DWELL + i * (TRAVEL + DWELL);
export const LOOP_MS = STOP(GATE);
const CARD = ['?', '✗ unsafe', 'label', 'Kev′', 'Kev′'];
const CARD_KIND = ['held', 'blocked', 'label', 'model', 'model'];

// Geometry (SVG user units). Nodes sit on a circle; the card runs on an inner track so it never covers a node's icon.
const W = 400, H = 330, CX = 200, CY = 165, R = 112, RN = 24, RC = 70;
const ang = i => (-90 + 60 * i) * Math.PI / 180;
const pt = (a, r) => [CX + r * Math.cos(a), CY + r * Math.sin(a)];
const f1 = n => Math.round(n * 10) / 10;
const ICON = {
  held: '<rect x="-6" y="-8" width="4" height="16" rx="1"/><rect x="2" y="-8" width="4" height="16" rx="1"/>',
  answer: '<circle cx="0" cy="-5" r="4.5"/><path d="M-8 9a8 7 0 0 1 16 0z"/>',
  label: '<path d="M-9-6h10l7 6-7 6h-10z"/><circle cx="-4" cy="0" r="1.8" class="rt-learn-hole"/>',
  train: '<rect x="-9" y="2" width="4" height="7"/><rect x="-2" y="-3" width="4" height="12"/><rect x="5" y="-8" width="4" height="17"/>',
  gate: '<rect x="-10" y="-9" width="3" height="18"/><rect x="7" y="-9" width="3" height="18"/><rect x="-7" y="-4" width="14" height="3"/>',
  promote: '<path d="M0-9l7 8h-4v9h-6v-9h-4z"/>',
};

/**
 * Pure frame of the loop at time t (ms). t ≤ 0 is the idle picture; t ≥ LOOP_MS is the end state (card at Gate).
 * @returns {{ at: number, angle: number, show: number, card: string, kind: string, dropped: number, kev: boolean, barrier: number }}
 */
export function loopFrame(t) {
  if (!(t > 0)) return { at: -1, angle: ang(0), show: 0, card: '', kind: '', dropped: 0, kev: false, barrier: 0 };
  t = Math.min(t, LOOP_MS);
  let at = 0, angle = ang(0), show = Math.min(1, t / APPEAR), sinceArrive = t - APPEAR;
  for (let i = 1; i <= GATE; i++) {
    const start = STOP(i - 1);
    if (t < start) break;
    const k = Math.min(1, (t - start) / TRAVEL), e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    angle = ang(i - 1) + (ang(i) - ang(i - 1)) * e;
    if (k >= 1) { at = i; sinceArrive = t - start - TRAVEL; }
  }
  const label = at > 2 || (at === 2 && sinceArrive >= 0) ? Math.min(1, at > 2 ? 1 : sinceArrive / 500) : 0;
  return {
    at, angle, show, card: CARD[at], kind: CARD_KIND[at], dropped: label,
    kev: at >= 3, barrier: at >= GATE ? Math.min(1, sinceArrive / 400) : 0,
  };
}

/** @returns {{ play(): void, pause(): void, reset(): void, destroy(): void }} */
export function mountLoop(el, opts = {}) {
  const tip = opts.tip ?? noTip;
  if (!el) return idleHandle();
  const names = LOOP_STEPS.map(s => s.name);
  const aria = `Illustration of the proposed learning loop: ${names.slice(0, GATE + 1).join(' → ')} → ${names[GATE + 1]} (future work, dashed). A held action's card goes round and stops at ${names[GATE]}.`;
  const arcs = LOOP_STEPS.map((_, i) => {
    const [x1, y1] = pt(ang(i), R), [x2, y2] = pt(ang(i + 1), R);
    return `<path class="rt-learn-arc${i >= GATE ? ' future' : ''}" data-arc="${i}" d="M${f1(x1)} ${f1(y1)}A${R} ${R} 0 0 1 ${f1(x2)} ${f1(y2)}"/>`;
  }).join('');
  const nodes = LOOP_STEPS.map((s, i) => {
    const [x, y] = pt(ang(i), R), a = ang(i), c = Math.cos(a), sn = Math.sin(a);
    // Labels sit outside the ring: above the top node, below the bottom one, outward on the sides.
    const side = Math.abs(c) > .3, lx = side ? x + Math.sign(c) * (RN + 9) : x, ly = side ? y + 4 : y + Math.sign(sn) * (RN + 14) + 4;
    const anchor = side ? (c > 0 ? 'start' : 'end') : 'middle';
    const future = s.key === 'promote' ? `<text class="rt-learn-futuretext" x="${f1(lx)}" y="${f1(ly + 14)}" text-anchor="${anchor}">Future work</text>` : '';
    return `<g class="rt-learn-node${s.key === 'promote' ? ' future' : ''}" data-node="${s.key}" transform="translate(${f1(x)} ${f1(y)})"><circle r="${RN}"/><g class="rt-learn-icon">${ICON[s.key]}</g></g>
<text class="rt-learn-nodelabel" x="${f1(lx)}" y="${f1(ly)}" text-anchor="${anchor}">${esc(s.name)}</text>${future}`;
  }).join('');
  const [bx1, by1] = pt(ang(GATE) + .38, R - 15), [bx2, by2] = pt(ang(GATE) + .38, R + 15);
  const slots = [0, 1, 2].map(i => `<rect class="rt-learn-slot${i === 2 ? ' new' : ''}" x="${CX - 22 + i * 16}" y="${CY - 30}" width="12" height="9" rx="2"/>`).join('');
  el.innerHTML = `<div class="rt-learn-loopfig" data-rt-learn-loop data-state="idle">
<div class="rt-learn-head"><span class="rt-chip" data-kind="sim" data-rt-learn-illus>Illustration</span>
<div class="rt-learn-ctrl" role="group" aria-label="Loop animation controls">
<button type="button" class="btn secondary rt-learn-play" data-rt-learn-play>Play</button>
<button type="button" class="btn secondary rt-learn-step" data-rt-learn-step>Step</button>
<button type="button" class="btn secondary rt-learn-replay" data-rt-learn-replay>Replay</button></div></div>
<p class="rt-ref" data-rt-learn-loop-claim>Illustration. Label → Train → Gate were run on a public benchmark with benchmark labels; reviewer answers (steps 1–2) and Promote are not yet tested.</p>
<div class="rt-learn-ringwrap">
<svg viewBox="0 0 ${W} ${H}" data-rt-learn-ring role="img" aria-label="${esc(aria)}">
<g class="rt-learn-arcs">${arcs}</g>
<line class="rt-learn-barrier" x1="${f1(bx1)}" y1="${f1(by1)}" x2="${f1(bx2)}" y2="${f1(by2)}"/>
<g class="rt-learn-bucket"><rect class="rt-learn-tray" x="${CX - 30}" y="${CY - 36}" width="60" height="20" rx="5"/>${slots}<text x="${CX}" y="${CY - 4}" text-anchor="middle">Training set</text></g>
<g class="rt-learn-model"><rect x="${CX - 26}" y="${CY + 8}" width="52" height="22" rx="11"/><text x="${CX}" y="${CY + 23}" text-anchor="middle" data-rt-learn-kev>Kev</text></g>
${nodes}
<rect class="rt-learn-drop" width="12" height="9" rx="2"/>
<g class="rt-learn-card" data-rt-learn-card data-at=""><rect x="-31" y="-12" width="62" height="24" rx="7"/><text y="4.5" text-anchor="middle"></text></g>
</svg></div>
<ol class="rt-learning-loop" aria-label="Proposed learning loop">
${LOOP_STEPS.map((s, i) => s.key === 'promote'
    ? `<li class="future" data-step="${s.key}"><b>${i + 1} · ${s.name}</b><span data-rt-learn-future>Future work</span> ${tip('Training on reviewer labels and production promotion are future work. The demo illustrates a proposed promotion gate; production promotion is not implemented.')}</li>`
    : `<li data-step="${s.key}"><b>${i + 1} · ${s.name}</b>${esc(s.text)}</li>`).join('')}
</ol></div>`;

  const root = el.firstElementChild, q = s => root.querySelector(s);
  const card = q('.rt-learn-card'), cardText = card.querySelector('text'), drop = q('.rt-learn-drop');
  const nodeEls = LOOP_STEPS.map(s => q(`[data-node="${s.key}"]`)), arcEls = [...root.querySelectorAll('.rt-learn-arc')];
  const lis = [...root.querySelectorAll('.rt-learning-loop li')], kev = q('[data-rt-learn-kev]'), barrier = q('.rt-learn-barrier');
  const newSlot = q('.rt-learn-slot.new'), playBtn = q('[data-rt-learn-play]');
  let t = 0, raf = 0, last = 0, state = 'idle';

  function draw() {
    const f = loopFrame(t);
    const [x, y] = pt(f.angle, RC);
    card.setAttribute('transform', `translate(${f1(x)} ${f1(y)})`);
    card.style.opacity = f.show;
    card.dataset.at = f.at >= 0 ? LOOP_STEPS[f.at].key : '';
    card.dataset.kind = f.kind;
    cardText.textContent = f.card;
    nodeEls.forEach((n, i) => { n.classList.toggle('on', i <= f.at); n.classList.toggle('cur', i === f.at); });
    arcEls.forEach((a, i) => a.classList.toggle('on', i < f.at));
    lis.forEach((li, i) => {
      li.classList.toggle('is-done', i < f.at); li.classList.toggle('is-cur', i === f.at);
      if (i === f.at) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    // The label block drops from the card into the training set.
    const [sx, sy] = [CX - 22 + 32, CY - 30], k = f.dropped;
    drop.setAttribute('x', f1(x - 6 + (sx - x + 6) * k)); drop.setAttribute('y', f1(y - 4.5 + (sy - y + 4.5) * k));
    drop.style.opacity = k > 0 && k < 1 ? 1 : 0;
    newSlot.classList.toggle('in', k >= 1);
    kev.textContent = f.kev ? 'Kev′' : 'Kev';
    q('.rt-learn-model').classList.toggle('new', f.kev);
    barrier.style.opacity = f.barrier;
  }
  function setState(s) {
    state = s; root.dataset.state = s;
    playBtn.textContent = s === 'playing' ? 'Pause' : 'Play';
  }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  function tick(now) {
    t += Math.min(100, now - last); last = now;
    draw();
    if (t >= LOOP_MS) { raf = 0; setState('done'); return; }
    raf = requestAnimationFrame(tick);
  }
  function finish() { stop(); t = LOOP_MS; draw(); setState('done'); }
  const handle = {
    play() {
      if (opts.reducedMotion) return finish();
      if (state === 'playing') return;
      if (state === 'done') t = 0;
      setState('playing');
      last = performance.now(); raf = requestAnimationFrame(tick);
    },
    pause() { if (state !== 'playing') return; stop(); setState('paused'); },
    reset() { stop(); t = 0; draw(); setState('idle'); },
    destroy() { stop(); for (const [b, fn] of listeners) b.removeEventListener('click', fn); el.innerHTML = ''; },
  };
  function step() {
    stop();
    if (state === 'done' || t >= LOOP_MS) t = STOP(0);
    else t = STOP(Math.min(GATE, loopFrame(t).at + 1));   // the next node, settled
    draw();
    setState(t >= LOOP_MS ? 'done' : 'paused');
  }
  const listeners = [
    [playBtn, () => (state === 'playing' ? handle.pause() : handle.play())],
    [q('[data-rt-learn-step]'), step],
    [q('[data-rt-learn-replay]'), () => { handle.reset(); handle.play(); }],
  ];
  for (const [b, fn] of listeners) b.addEventListener('click', fn);
  if (opts.reducedMotion) finish(); else draw();
  return handle;
}

/* ---------------------------------------------------------------- results */

/**
 * Horizontal bars on one linear scale from 0. rows: [{ name, v, text, ci?, cls? }]; the visible value text sits next to
 * each bar, the fill itself is decorative. coin draws the dashed 0.5 "coin flip" mark on every track.
 */
function bars(rows, { max = 1, ticks = [0, .5, 1], coin = false, stack = false, unit = '', label = '', delay = 0 }) {
  return `<div class="rt-lbars${stack ? ' stack' : ''}${coin ? ' coin' : ''}" role="group" aria-label="${esc(label)}">
${rows.map((r, i) => `<span class="rt-lbar-name">${r.name}</span><span class="rt-lbar-track${r.cls ? ' ' + r.cls : ''}" aria-hidden="true" style="--d:${delay + i * 120}ms"><i class="rt-lbar-fill" style="--v:${clamp01(r.v / max)}"></i>${r.ci ? `<i class="rt-lbar-ci" style="--lo:${clamp01(r.ci[0] / max)};--hi:${clamp01(r.ci[1] / max)}"></i>` : ''}</span><span class="rt-lbar-val">${r.text}</span>`).join('')}
<span class="rt-lbar-axis" aria-hidden="true">${ticks.map(x => `<b style="--at:${clamp01(x / max)}">${x}${x === max && unit ? ' ' + unit : ''}${coin && x === .5 ? ' coin flip' : ''}</b>`).join('')}</span></div>`;
}

/**
 * @param {HTMLElement} el
 * @param {{ evidence: object, judge?: {e1_split_auroc: number, real_runs_auroc: number}|null, runs?: number|null }} data
 * @returns {{ play(): void, pause(): void, reset(): void, destroy(): void }}
 */
export function mountLearningResults(el, { evidence: e, judge, runs } = {}, opts = {}) {
  const tip = opts.tip ?? noTip;
  if (!el || !e?.models) return idleHandle();
  const A = 'kev-0.8b', B = 'kev-0.8b-ft', a = e.models[A], b = e.models[B];
  const get = path => path.split('/').reduce((v, k) => v?.[k], e);
  const value = (path, digits = 2) => `<span data-evidence-value="${path}" data-digits="${digits}">${Number(get(path)).toFixed(digits)}</span>`;
  const pair = (family, metric, digits = 2) => [A, B].map(m => value(`models/${m}/${family}/${metric}`, digits)).join(' → ');
  const label = 'measured on an open benchmark (AgentDojo held-out); benchmark labels, not yet customer reviewers';
  const ci = m => e.models[m].goal_deviation.recall_ci.map((_, i) => value(`models/${m}/goal_deviation/recall_ci/${i}`, 3)).join('–');
  const two = (family, metric, digits, extra = {}) => [A, B].map(m => ({
    name: esc(e.models[m].label), v: get(`models/${m}/${family}/${metric}`), text: value(`models/${m}/${family}/${metric}`, digits) + (extra.unit ? ' ' + extra.unit : ''),
    ci: extra.ci ? e.models[m].goal_deviation.recall_ci : null, cls: m === B ? 'after' : 'before',
  }));
  // Plain title and a one-line caption on the tile; the exact metric, threshold and sample size behind its ⓘ.
  const tile = (title, metric, figure, plain, context) => `<div class="card metric"><div class="kicker">${title}<span class="rt-tech">${metric}</span>${tip(`${context}<span class="rt-tip-src">${label}</span>`)}</div>${figure}<div class="rt-plain">${plain}</div></div>`;
  const pa = Number(a.latency.p50_ms), pb = Number(b.latency.p50_ms), change = Math.abs(pb - pa) / Math.max(pa, pb);
  const latencyTitle = change < .1 ? 'Answer time stays about the same' : pb < pa ? 'Answers get faster' : 'Answers get slower';
  const msMax = niceCeil(Math.max(pa, pb));
  const caveats = `<b>Measured evidence: details and caveats</b>
      <span class="rt-tip-li">${esc(a.label)} recall 95 % CI: ${ci(A)}; ${esc(b.label)}: ${ci(B)}.</span>
      <span class="rt-tip-li">Hardware: ${esc(e.hardware)}. Label provenance: ${(e.label_provenance ?? []).map(esc).join(', ')}. Calibrations not activated.</span>
      ${(e.caveats ?? []).map(x => `<span class="rt-tip-li">${esc(x)}</span>`).join('')}
      <span class="rt-tip-src">Generated by ${esc(e.generated_by)}. Sources: ${Object.values(e.sources ?? {}).map(esc).join('; ')}.</span>`;

  // Promotion gate: one stamp card per candidate, counts on one scale shared by every card.
  const gates = Object.entries(e.gate ?? {});
  const countMax = niceCeil(Math.max(1, ...gates.flatMap(([, g]) => [g.fixed, g.broke, g.missed?.before, g.missed?.after].filter(Number.isFinite))));
  const gateCards = gates.map(([id, g], gi) => {
    const detail = g.safetyOk
      ? `Fixed ${g.fixed} · Broke ${g.broke} · ${g.evidenceOk ? 'evidence check passed' : 'needs more evidence'}`
      : g.missed.after > g.missed.before
        ? `Safety check failed: more missed cases (${g.missed.before} → ${g.missed.after})`
        : `Safety check failed: more false alarms (${g.falseHolds.before} → ${g.falseHolds.after})`;
    const kind = g.verdict === 'KEEP' ? 'ran' : g.verdict === 'NEAR-MISS' ? 'review' : 'blocked';
    const worse = g.missed.after > g.missed.before;
    const fig = bars([
      { name: 'Fixed', v: g.fixed, text: esc(g.fixed), cls: 'good' },
      { name: 'Broke', v: g.broke, text: esc(g.broke), cls: 'bad' },
      { name: 'Missed before', v: g.missed.before, text: esc(g.missed.before), cls: 'before' },
      { name: 'Missed after', v: g.missed.after, text: esc(g.missed.after) + (worse ? ' ▲' : g.missed.after < g.missed.before ? ' ▼' : ''), cls: worse ? 'bad' : 'good' },
    ], { max: countMax, ticks: [0, countMax], unit: 'items', delay: 300 + gi * 200, label: `${e.models[id].label} against ${e.models[g.vs]?.label ?? g.vs}: fixed ${g.fixed}, broke ${g.broke}, missed attacks ${g.missed.before} before and ${g.missed.after} after, of ${g.items} test items` });
    return `<div class="rt-learn-gatecard" data-kind="${kind}" style="--d:${900 + gi * 200}ms">
      <div class="rt-learn-gatehead"><b>${esc(e.models[id].label)}</b><span class="rt-learn-vs">vs ${esc(e.models[g.vs]?.label ?? g.vs)}</span>${tip(`Counts of the ${esc(g.items)} test items, on one scale for every card. False holds ${esc(g.falseHolds?.before)} → ${esc(g.falseHolds?.after)}. Gate outcome: ${esc(g.reason)}.`)}<span class="rt-learn-stamp" data-kind="${kind}" aria-hidden="true">${esc(g.verdict)}</span></div>
      ${fig}
      <p data-evidence-gate="${esc(id)}">${esc(e.models[id].label)}: <span class="rt-chip" data-evidence-verdict data-kind="${kind}">${esc(g.verdict)}</span> · ${esc(detail)}</p></div>`;
  }).join('');

  // Reality check: the fine-tuned judge's goal_deviation AUROC on the split (call level) and on real runs (run level).
  const realRows = judge ? [
    Number.isFinite(judge.e1_split_auroc) && { name: '<b>Benchmark split</b> · <span class="rt-learn-unit">call level</span>', v: judge.e1_split_auroc, text: `<span data-onto-judge-split>${Number(judge.e1_split_auroc).toFixed(3)}</span>`, cls: 'before' },
    Number.isFinite(judge.real_runs_auroc) && { name: `<b>Real agent runs${runs != null ? ` (n = ${esc(runs)})` : ''}</b> · <span class="rt-learn-unit">run level</span>`, v: judge.real_runs_auroc, text: `<b data-onto-judge-real>${Number(judge.real_runs_auroc).toFixed(3)}</b>`, cls: 'warn' },
  ].filter(Boolean) : [];
  const reality = realRows.length ? `<section class="rt-takeaway warn rt-judge-real" id="rtJudgeRealNote" aria-labelledby="rtJudgeRealTitle">
      <h4 id="rtJudgeRealTitle"><b>⚠ Reality check</b> <span class="rt-tech">goal_deviation AUROC · ${esc(b.label)}</span>${tip('The tiles above come from a test split whose attack items are recognisable by their format, so the split overstates practice. The two numbers use different units (single calls vs whole runs) and different data, so they are not a before → after of one experiment.')}</h4>
      ${bars(realRows, { coin: true, stack: true, delay: 1300, label: `goal_deviation AUROC of ${b.label}: ${realRows.map(r => r.text.replace(/<[^>]+>/g, '')).join(' and ')}, on a 0 to 1 scale` })}
      <p class="rt-learn-realtake">Different units and data: expect real-world results nearer the lower figure.</p></section>` : '';

  el.innerHTML = `<div class="rt-learn-results" data-rt-learn-results data-state="idle">
    <div class="rt-learn-head"><span class="rt-chip" data-kind="ran" data-rt-learn-measured>Measured</span>
      <div class="rt-learn-ctrl"><button type="button" class="btn secondary rt-learn-replay" data-rt-learn-results-replay>Replay</button></div></div>
    <p class="rt-ref rt-tipline" data-rt-learn-claim>Measured on an open benchmark (AgentDojo held-out) with benchmark labels, not yet customer reviewers. ${tip(caveats, 'Details and caveats', 'word')}</p>
    <h3 class="rt-section-h">What fine-tuning achieved (before → after)</h3>
    <div class="rt-learning-tiles">
      ${tile('Catches goal deviation', 'goal_deviation recall', bars(two('goal_deviation', 'recall', 2, { ci: true }), { label: `goal_deviation recall with 95 % confidence interval, 0 to 1: ${a.label} ${Number(a.goal_deviation.recall).toFixed(2)}, ${b.label} ${Number(b.goal_deviation.recall).toFixed(2)}` }), 'Share of real goal deviations caught; whiskers show the 95 % CI.', `At each model's own calibrated threshold (${value(`models/${A}/goal_deviation/threshold`)} released, ${value(`models/${B}/goal_deviation/threshold`)} fine-tuned); false-positive rate ${pair('goal_deviation', 'fpr', 3)} (question-level, held-out ${esc(e.test?.benchmark)}, n = ${value('test/items', 0)} test items). 95 % CI: ${ci(A)} released, ${ci(B)} fine-tuned.`)}
      ${tile('Spots instruction override', 'instruction_override AUROC', bars(two('instruction_override', 'auroc', 2), { coin: true, delay: 120, label: `instruction_override AUROC, 0 to 1, 0.5 is a coin flip: ${a.label} ${Number(a.instruction_override.auroc).toFixed(2)}, ${b.label} ${Number(b.instruction_override.auroc).toFixed(2)}` }), 'Tells injected instructions from normal ones (0.5 = coin flip, 1 = perfect).', 'no fitted threshold (too few calibration negatives), so only AUROC is reported.')}
      ${tile(latencyTitle, 'local judge HTTP p50', bars(two('latency', 'p50_ms', 0, { unit: 'ms' }), { max: msMax, ticks: [0, msMax], unit: 'ms', delay: 240, label: `local judge HTTP p50 in milliseconds, scale 0 to ${msMax}: ${a.label} ${pa.toFixed(0)}, ${b.label} ${pb.toFixed(0)}` }), 'Typical time for one answer, before and after.', `similar local judge HTTP p50 in this run (n = ${value(`models/${A}/latency/n`, 0)} released, n = ${value(`models/${B}/latency/n`, 0)} fine-tuned; ${esc(e.hardware)}).`)}
    </div>
    <section class="card" id="rtLearningGate" aria-labelledby="rtLearningGateTitle">
      <h3 id="rtLearningGateTitle">Would the gate let the new judge in?${tip('Question-level errors at each model’s own threshold, on one benchmark split; a retrospective check, not gateway outcomes.')}</h3>
      <p class="rt-plain">Promote only if it fixes more than it breaks and misses no more attacks.</p>
      <div class="rt-learn-gates">${gateCards}</div>
    </section>
    ${reality}</div>`;

  const root = el.firstElementChild, replay = root.querySelector('[data-rt-learn-results-replay]');
  const GROW_MS = 2600;
  let timer = 0, state = 'idle';
  const setState = s => { state = s; root.dataset.state = s; };
  const finish = () => { clearTimeout(timer); timer = 0; setState('done'); };
  const handle = {
    play() {
      if (opts.reducedMotion) return finish();
      clearTimeout(timer);
      if (state !== 'idle') { setState('idle'); void root.offsetWidth; }   // back to 0, so the bars grow again
      setState('playing');
      timer = setTimeout(finish, GROW_MS);
    },
    // A hidden panel cannot hold a half-grown bar (display:none drops transitions), so pausing settles the end state.
    pause() { if (state === 'playing') finish(); },
    reset() { clearTimeout(timer); timer = 0; setState('idle'); },
    destroy() { clearTimeout(timer); replay.removeEventListener('click', onReplay); el.innerHTML = ''; },
  };
  const onReplay = () => handle.play();
  replay.addEventListener('click', onReplay);
  if (opts.reducedMotion) finish();
  return handle;
}
