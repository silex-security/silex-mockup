// Scenario Expansion ① "Expand one attack" (logs/2026-10-11_SCENARIO_EXPANSION_PLAN.md, task T1, coder-opus).
// An animated picture of one expansion, in six stages: the seed, the five condition axes, the wall of every combination,
// the ontology constraints striking out the combinations that cannot exist (each tile is struck by its first violated
// constraint), the survivors regrouping into proposed outcome classes, and the provenance chain (lab executions →
// context overlays → observation-removal derivatives). Every count comes from the model. The root mounts idle and only
// moves when the sub-tab bar calls play(); under reduced motion it renders the end state at once, with no timers.
// No DOM access at module top level.
import { actorOf, TENANT } from './sx-model.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const noTip = () => '';

// Timeline (ms). Stages start at these times; the whole picture settles at TOTAL_MS.
const AXES_AT = 500, AXIS_STEP = 180;
const WALL_AT = 1600, WALL_FILL = 900;
const GATES_AT = 2800, GATE_MS = 700, GATE_LEAD = 150, GATE_STRIKE = 450;
const CLASSES_AT = (n) => GATES_AT + n * GATE_MS + 100;
const CLASS_FILL = 800, CHAIN_LAG = 1000, CHAIN_STEP = 300;
const CLASS_ORDER = ['attack', 'approved', 'insufficient', 'benign'];

/** The timeline for a model: stage start times and the total, all in ms. */
export function timeline(model) {
  const n = model.CONSTRAINTS.length;
  const classes = CLASSES_AT(n), chain = classes + CHAIN_LAG;
  return {
    seed: 0, axes: AXES_AT, wall: WALL_AT, gates: GATES_AT,
    gate: model.CONSTRAINTS.map((c, i) => GATES_AT + i * GATE_MS),
    classes, chain, total: chain + 3 * CHAIN_STEP + 300,
  };
}

/** @returns {{ play(): void, pause(): void, replay(): void, destroy(): void }} */
export function mountExpand(el, model, opts = {}) {
  const tip = opts.tip ?? noTip;
  const { SEED, AXES, TIERS, CONSTRAINTS, CLASSES, OPS, GRADE, ONTOLOGY_VERSION } = model;
  const T = timeline(model);
  const tierLabel = id => TIERS.find(x => x.id === id)?.label ?? id;
  const valid = model.all.length - CONSTRAINTS.reduce((s, c) => s + model.removedBy[c.id], 0);
  const count = (key, n) => `<b data-sx-count="${key}">${n}</b>`;

  // When each tile appears, when (and by which constraint) it is struck, and its class once regrouped.
  const strikeAt = new Map();
  CONSTRAINTS.forEach((c, i) => {
    const hit = model.all.filter(x => x.violates[0] === c.id);
    hit.forEach((x, k) => strikeAt.set(x.id, T.gate[i] + GATE_LEAD + (k / Math.max(1, hit.length)) * GATE_STRIKE));
  });
  const N = model.all.length;
  const tiles = model.all.map((x, i) => `<i class="sx-ex-tile" data-sx-tile="${esc(x.id)}"${x.violates.length ? ` data-by="${esc(x.violates[0])}"` : ` data-cls="${esc(x.expected.cls)}"`}></i>`).join('');

  const seedVal = key => SEED.values[key];
  const axes = AXES.map((a, i) => `<div class="sx-ex-axis" style="--i:${i}" data-sx-axis="${esc(a.key)}">
<div class="sx-ex-axis-head"><b>${esc(a.label)}</b>
<span class="sx-ex-badges"><span class="sx-ex-tier" data-sx-tier="${esc(a.tier)}">${esc(tierLabel(a.tier))}</span>
<span class="sx-ex-op" data-op="${esc(a.op)}" data-sx-op="${esc(a.op)}">${esc(OPS[a.op].label)}${tip(esc(OPS[a.op].hint))}</span></span></div>
<ul>${a.values.map(x => `<li${x.value === seedVal(a.key) ? ' class="seed"' : ''}><span>${esc(x.label)}</span>${x.value === seedVal(a.key) ? '<small>seed</small>' : ''}${tip(esc(x.hint))}</li>`).join('')}</ul></div>`).join('');

  const shape = AXES.map(a => a.values.length).join(' × ');
  const gates = CONSTRAINTS.map(c => `<li class="sx-ex-gate" data-sx-stage="gate-${esc(c.id)}"><span class="sx-ex-gid">${esc(c.id)}</span>
<span class="sx-ex-gtext">${esc(c.text)}</span><span class="sx-ex-gn">−${count(c.id, model.removedBy[c.id])}</span></li>`).join('');

  const classes = CLASS_ORDER.filter(k => CLASSES[k]).map(k => `<div class="sx-ex-class" data-cls="${k}">
<div class="sx-ex-class-head"><span class="sx-ex-swatch" aria-hidden="true"></span><b>${esc(CLASSES[k].label)}</b>${count(k, model.byClass[k])}${tip(esc(CLASSES[k].hint))}</div>
<div class="sx-ex-class-tiles" aria-hidden="true">${'<i class="sx-ex-tile"></i>'.repeat(model.byClass[k])}</div></div>`).join('');

  const chainItem = (key, n, label, op) => `<span class="sx-ex-link" data-op="${op}">${count(key, n)} <span>${esc(label)}</span>${tip(esc(OPS[op].hint))}</span>`;

  el.innerHTML = `<div class="sx-ex" data-sx="expand" data-state="idle">
<div class="sx-ex-top">
<div class="sx-ex-title"><h2>Expand one attack</h2><p>One seed, five business conditions, pruned by the ontology.</p></div>
<div class="sx-ex-ctrl" role="group" aria-label="Expansion animation controls">
<span class="rt-chip" data-kind="sim" data-sx-grade>Evidence: ${esc(GRADE)} · ontology ${esc(ONTOLOGY_VERSION)}</span>
<button type="button" class="btn secondary" data-sx-play aria-pressed="false">Play</button>
<button type="button" class="btn secondary" data-sx-replay>Replay</button></div></div>
<div class="sx-ex-grid">
<section class="sx-ex-stage sx-ex-seed" data-sx-stage="seed" aria-label="Seed attack">
<span class="sx-ex-n">1</span><div class="sx-ex-body">
<span class="sx-ex-kick">Seed attack · fictional tenant ${esc(TENANT)}</span>
<h3>${esc(SEED.title)}</h3>
<div class="sx-ex-facts">
<span><small>Technique</small><code>${esc(SEED.technique.id)}</code> ${esc(SEED.technique.name)}</span>
<span><small>Account</small><code>${esc(actorOf(SEED.values))}</code></span>
<span><small>Share</small><code>${esc(SEED.share)}</code></span>
<span><small>Volume</small>${esc(SEED.reads)} reads in ${esc(SEED.windowMin)} minutes</span></div></div></section>
<section class="sx-ex-stage sx-ex-axes" data-sx-stage="axes" aria-label="Five conditions">
<span class="sx-ex-n">2</span><div class="sx-ex-body">
<span class="sx-ex-kick">Vary five business conditions ${tip('Each condition is typed in the ontology (tier badge) and changes the scenario by one kind of operation (operation badge). The seed’s value is marked.')}</span>
<div class="sx-ex-axislist">${axes}</div></div></section>
<section class="sx-ex-stage sx-ex-wall" data-sx-stage="wall" aria-label="Every combination">
<span class="sx-ex-n">3</span><div class="sx-ex-body">
<span class="sx-ex-kick">Every combination</span>
<p class="sx-ex-big">${count('all', N)} combinations <small>${esc(shape)}</small></p>
<div class="sx-ex-tiles" aria-hidden="true">${tiles}</div>
<p class="sx-ex-legend" aria-hidden="true"><span><i class="sx-ex-tile x"></i>cannot exist</span><span>colour: proposed outcome (step 5)</span></p></div></section>
<section class="sx-ex-stage sx-ex-gates" data-sx-stage="gates" aria-label="Ontology constraints">
<span class="sx-ex-n">4</span><div class="sx-ex-body">
<span class="sx-ex-kick">Ontology constraints remove what cannot exist ${tip('Applied in order. Each constraint strikes out the combinations whose first violated constraint it is; some also violate later ones.')}</span>
<ol class="sx-ex-gatelist">${gates}</ol>
<p class="sx-ex-left"><b data-sx-count="valid">${valid}</b> combinations can exist</p></div></section>
<section class="sx-ex-stage sx-ex-classes" data-sx-stage="classes" aria-label="Proposed outcome classes">
<span class="sx-ex-n">5</span><div class="sx-ex-body">
<span class="sx-ex-kick">Group by proposed expected outcome</span>
<p class="sx-ex-cap">Proposed expected outcomes, pending expert review ${tip('The generator proposes an outcome for each variant; experts confirm or change it. Nothing here is a verdict.')}</p>
<div class="sx-ex-classlist">${classes}</div></div></section>
<section class="sx-ex-stage sx-ex-chain" data-sx-stage="chain" aria-label="How the variants would be produced">
<span class="sx-ex-n">6</span><div class="sx-ex-body">
<span class="sx-ex-kick">How the variants would be produced</span>
<p class="sx-ex-links">${chainItem('labRuns', model.labRuns.length, 'lab executions', 'lab')}<span class="sx-ex-arrow" aria-hidden="true">→</span>${chainItem('overlays', model.overlays, 'context overlays', 'context')}<span class="sx-ex-arrow" aria-hidden="true">→</span>${chainItem('derivatives', model.derivatives, 'observation-removal derivatives', 'observation')}</p>
<p class="sx-ex-note"><span class="rt-chip" data-kind="sim">${esc(GRADE)}</span> None of this has run in a lab yet; every result is simulated.</p></div></section>
</div></div>`;

  const root = el.firstElementChild, q = s => root.querySelector(s);
  const playBtn = q('[data-sx-play]'), replayBtn = q('[data-sx-replay]');
  const stages = ['seed', 'axes', 'wall', 'gates', 'classes', 'chain'].map(k => [q(`[data-sx-stage="${k}"]`), T[k]]);
  const gateEls = CONSTRAINTS.map((c, i) => [q(`[data-sx-stage="gate-${c.id}"]`), T.gate[i]]);
  const wallTiles = [...root.querySelectorAll('.sx-ex-tiles .sx-ex-tile')];
  const tileAt = wallTiles.map((_, i) => T.wall + (i / N) * WALL_FILL);
  const tileStrike = wallTiles.map(n => strikeAt.get(n.dataset.sxTile) ?? Infinity);
  const classTiles = [...root.querySelectorAll('.sx-ex-class-tiles')].map(g => [...g.children]);
  const axisEls = [...root.querySelectorAll('.sx-ex-axis')];
  const links = [...root.querySelectorAll('.sx-ex-link')];
  let t = 0, raf = 0, last = 0, state = 'idle', drawn = -1;

  const flag = (n, cls, on) => { if (n.classList.contains(cls) !== on) n.classList.toggle(cls, on); };
  function draw() {
    if (t === drawn) return;
    drawn = t;
    for (const [n, at] of stages) flag(n, 'on', t >= at);
    axisEls.forEach((n, i) => flag(n, 'on', t >= T.axes + i * AXIS_STEP));
    for (const [n, at] of gateEls) { flag(n, 'on', t >= at); flag(n, 'cur', t >= at && t < at + GATE_MS); }
    const regroup = t >= T.classes;
    wallTiles.forEach((n, i) => { flag(n, 'on', t >= tileAt[i]); flag(n, 'x', t >= tileStrike[i]); flag(n, 'c', regroup); });
    for (const group of classTiles) group.forEach((n, i) => flag(n, 'on', t >= T.classes + 200 + (i / group.length) * CLASS_FILL));
    links.forEach((n, i) => flag(n, 'on', t >= T.chain + i * CHAIN_STEP));
  }
  function setState(s) {
    state = s; root.dataset.state = s;
    playBtn.textContent = s === 'playing' ? 'Pause' : 'Play';
    playBtn.setAttribute('aria-pressed', String(s === 'playing'));
  }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  function tick(now) {
    t = Math.min(T.total, t + Math.min(100, now - last)); last = now;
    draw();
    if (t >= T.total) { raf = 0; setState('done'); return; }
    raf = requestAnimationFrame(tick);
  }
  function finish() { stop(); t = T.total; draw(); setState('done'); }
  const reduced = () => opts.reducedMotion || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const handle = {
    play() {
      if (reduced()) return finish();
      if (state === 'playing') return;
      if (state === 'done') t = 0;
      setState('playing');
      last = performance.now(); raf = requestAnimationFrame(tick);
    },
    pause() { if (state !== 'playing') return; stop(); setState('paused'); },
    replay() { stop(); t = 0; draw(); setState('idle'); handle.play(); },
    destroy() { stop(); playBtn.removeEventListener('click', onPlay); replayBtn.removeEventListener('click', handle.replay); el.innerHTML = ''; },
  };
  const onPlay = () => (state === 'playing' ? handle.pause() : handle.play());
  playBtn.addEventListener('click', onPlay);
  replayBtn.addEventListener('click', handle.replay);
  if (opts.reducedMotion) finish(); else draw();
  return handle;
}
