// Scenario Expansion ③ "Replay one variant" (logs/2026-10-11_SCENARIO_EXPANSION_PLAN.md, task T3, coder-opus).
// A picker of the five conditions (default: the seed), the variant's provenance chain (lab execution → context overlay
// → observation removal), its runtime graph as a small SVG, the replay steps as a timeline that lights the graph, and,
// once the last step is reached, the verdict: rule result against the proposed outcome, grade, ontology version,
// review state and the two invariant checks. A pruned combination shows the constraints that rule it out and never
// replays. select(id) is the hook ② and the view host use (sx:replay). Reduced motion renders the final state at once,
// with no timers. No DOM access at module top level.
import { trace, checks, actorOf, variantId, valuesOf, violations, WANT } from './sx-model.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const noTip = () => '';
export const STEP_MS = 700;
const LEAD_MS = 300;

// Graph layout (SVG user units): three columns, nodes as rounded boxes.
const GW = 520, GH = 320, NW = 132, NH = 46;
const POS = {
  account: [80, 55], role: [80, 165], rule: [80, 270],
  grant: [260, 55], ticket: [260, 165], logs: [260, 270],
  sensitivity: [440, 55], share: [440, 165],
};
const HOLDS = { true: 'holds', false: 'does not hold', null: 'does not apply' };

/** Where an edge leaves one box and enters the other: the box borders along the centre line. */
function clipLine([x1, y1], [x2, y2]) {
  const cut = (dx, dy) => { const s = Math.min(dx ? (NW / 2 + 4) / Math.abs(dx) : Infinity, dy ? (NH / 2 + 4) / Math.abs(dy) : Infinity); return [dx * s, dy * s]; };
  const dx = x2 - x1, dy = y2 - y1, [ax, ay] = cut(dx, dy);
  return [x1 + ax, y1 + ay, x2 - ax, y2 - ay];
}

/** @returns {{ select(id: string): void, play(): void, pause(): void, destroy(): void }} */
export function mountReplay(el, model, opts = {}) {
  const tip = opts.tip ?? noTip;
  const { SEED, AXES, CONSTRAINTS, OPS, OUTCOMES, TIERS } = model;
  const byId = new Map(model.all.map(x => [x.id, x]));
  const tierLabel = id => TIERS.find(x => x.id === id)?.label ?? id;

  el.innerHTML = `<div class="sx-rp" data-sx="replay" data-state="idle">
<div class="card sx-rp-pick">
<div class="sx-rp-pickhead"><h2>Replay one variant</h2><code class="sx-rp-id" data-sx-id></code></div>
<div class="sx-rp-selects">${AXES.map(a => `<label class="sx-rp-field"><span>${esc(a.label)}</span>
<select data-sx-pick="${esc(a.key)}">${a.values.map(x => `<option value="${esc(x.value)}">${esc(x.label)}</option>`).join('')}</select></label>`).join('')}</div>
</div>
<div class="sx-rp-main" data-sx-main></div></div>`;
  const root = el.firstElementChild, main = root.querySelector('[data-sx-main]');
  const picks = [...root.querySelectorAll('[data-sx-pick]')];
  let values = { ...SEED.values }, steps = [], cur = -1, timer = 0, state = 'idle', pruned = false;
  let stepEls = [], nodeEls = new Map(), edgeEls = [], verdictEl = null, counterEl = null, buttons = {};

  const reduced = () => opts.reducedMotion || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const outcomeLabel = k => OUTCOMES.find(o => o.key === k)?.label ?? k;

  function prunedView(bad) {
    return `<div class="card sx-rp-pruned" data-sx-pruned>
<h3>This combination cannot exist in this enterprise</h3>
<p>The ontology rules it out, so there is nothing to replay. Ruled out by:</p>
<ul>${bad.map(id => `<li data-sx-violates="${esc(id)}"><code>${esc(id)}</code> ${esc(CONSTRAINTS.find(c => c.id === id).text)}</li>`).join('')}</ul></div>`;
  }

  function provenance(run) {
    const link = (op, value, extra = '') => `<span class="sx-rp-prov" data-op="${op}" data-sx-prov="${op}">
<small>${esc(OPS[op].label)} ${tip(esc(OPS[op].hint))}</small><code>${esc(value)}</code>${extra}</span>`;
    const arrow = '<span class="sx-rp-arrow" aria-hidden="true">→</span>';
    return `<div class="sx-rp-chain" aria-label="Provenance">
${link('lab', run.exec)}${arrow}${link('context', run.context)}
${run.ablation ? arrow + link('observation', run.ablation, `<button type="button" class="btn secondary sx-rp-parent" data-sx-parent="${esc(run.parent)}">Parent run: <code>${esc(run.parent)}</code></button>`) : ''}</div>`;
  }

  function graph(tr) {
    const nodes = new Map(tr.nodes.map(n => [n.id, n]));
    const edges = tr.edges.map((e, i) => {
      const [x1, y1, x2, y2] = clipLine(POS[e.from], POS[e.to]);
      return `<g class="sx-rp-edge" data-edge="${i}"><line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" marker-end="url(#sxRpArrow)"/>
<text x="${((x1 + x2) / 2).toFixed(1)}" y="${((y1 + y2) / 2 - 4).toFixed(1)}" text-anchor="middle">${esc(e.rel)}</text></g>`;
    }).join('');
    const boxes = [...nodes.values()].map(n => {
      const [x, y] = POS[n.id];
      return `<g class="sx-rp-node" data-node="${esc(n.id)}" data-tier="${esc(n.tier)}" transform="translate(${x} ${y})">
<rect x="${-NW / 2}" y="${-NH / 2}" width="${NW}" height="${NH}" rx="9"/>
<text class="sx-rp-ntype" y="-6" text-anchor="middle">${esc(n.type)} · ${esc(n.tier)}</text>
<text class="sx-rp-nlabel" y="12" text-anchor="middle">${esc(n.label)}</text></g>`;
    }).join('');
    const aria = `Runtime graph: ${tr.nodes.map(n => `${n.type} ${n.label}`).join(', ')}.`;
    return `<div class="sx-rp-svgwrap"><svg class="sx-rp-svg" viewBox="0 0 ${GW} ${GH}" role="img" aria-label="${esc(aria)}">
<defs><marker id="sxRpArrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z"/></marker></defs>
${edges}${boxes}</svg></div>
<p class="sx-rp-tiers">${[...new Set(tr.nodes.map(n => n.tier))].sort().map(t => `<span data-tier="${esc(t)}">${esc(tierLabel(t))}</span>`).join('')}</p>`;
  }

  function timeline(tr) {
    return tr.steps.map((s, i) => `<li class="sx-rp-step${s.dropped ? ' dropped' : ''}" data-sx-step="${i}">
<span class="sx-rp-src" data-op="${esc(s.source)}">${esc(OPS[s.source].label)}</span>
<span class="sx-rp-stext">${esc(s.text)}</span>${s.dropped ? '<span class="sx-rp-gone">not in the logs</span>' : ''}</li>`).join('');
  }

  function verdict(x) {
    const res = x.result, ch = checks(values);
    return `<div class="card sx-rp-verdict" data-sx-verdict hidden>
<h3>Rule result vs proposal <span class="rt-chip" data-kind="sim">${esc(res.grade)}</span></h3>
<dl class="sx-rp-facts">
<div><dt>Rule ${esc(model.RULE.id)}</dt><dd data-sx-got="${esc(res.got)}">${esc(res.got)}</dd></div>
<div><dt>Proposed, pending expert review</dt><dd data-sx-want="${esc(x.expected.want)}">${esc(WANT[x.expected.want])}</dd></div>
<div><dt>Outcome</dt><dd data-sx-outcome="${esc(x.outcome)}">${esc(outcomeLabel(x.outcome))} ${tip(esc(OUTCOMES.find(o => o.key === x.outcome)?.hint ?? ''))}</dd></div>
<div><dt>Evidence grade</dt><dd data-sx-grade>${esc(res.grade)}</dd></div>
<div><dt>Ontology</dt><dd data-sx-ontology>${esc(res.ontology)}</dd></div>
<div><dt>Review</dt><dd data-sx-review>review: ${esc(x.review)}</dd></div></dl>
<p class="sx-rp-why">${esc(x.expected.why)} ${esc(res.why)}</p>
<ul class="sx-rp-checks">${ch.map(c => `<li data-sx-check="${esc(c.id)}" data-holds="${String(c.holds)}"><b>${esc(HOLDS[String(c.holds)])}</b><span>${esc(c.label)}</span><code>${esc(c.detail)}</code></li>`).join('')}</ul>
<p class="sx-rp-note">In a simulation these are invariant checks of the generator. In a lab they test whether the same record replays to the same runtime graph.</p></div>`;
  }

  function render() {
    const id = variantId(values);
    root.dataset.sxVariant = id;
    root.querySelector('[data-sx-id]').textContent = id;
    picks.forEach(p => { p.value = values[p.dataset.sxPick]; });
    const bad = violations(values);
    pruned = bad.length > 0;
    root.toggleAttribute('data-sx-is-pruned', pruned);
    stepEls = []; edgeEls = []; nodeEls = new Map(); verdictEl = null; counterEl = null; buttons = {};
    if (pruned) { main.innerHTML = prunedView(bad); steps = []; return; }
    const x = byId.get(id), tr = trace(values);
    steps = tr.steps;
    main.innerHTML = `${provenance(x.run)}
<div class="sx-rp-grid">
<div class="card sx-rp-graph"><div class="sx-rp-head"><h3>Runtime graph</h3><span class="sx-rp-actor">account <code>${esc(actorOf(values))}</code></span></div>${graph(tr)}</div>
<div class="card sx-rp-steps"><div class="sx-rp-head"><h3>Replay</h3>
<div class="sx-rp-ctrl" role="group" aria-label="Replay controls">
<button type="button" class="btn secondary" data-sx-btn="step">Step</button>
<button type="button" class="btn secondary" data-sx-btn="play" aria-pressed="false">Play</button>
<button type="button" class="btn secondary" data-sx-btn="restart">Restart</button></div></div>
<p class="sx-rp-counter" data-sx-counter></p>
<ol class="sx-rp-timeline">${timeline(tr)}</ol></div></div>
${verdict(x)}`;
    stepEls = [...main.querySelectorAll('[data-sx-step]')];
    for (const n of main.querySelectorAll('[data-node]')) nodeEls.set(n.dataset.node, n);
    edgeEls = tr.edges.map((e, i) => [main.querySelector(`[data-edge="${i}"]`), e]);
    verdictEl = main.querySelector('[data-sx-verdict]');
    counterEl = main.querySelector('[data-sx-counter]');
    for (const b of main.querySelectorAll('[data-sx-btn]')) buttons[b.dataset.sxBtn] = b;
  }

  function draw() {
    if (pruned) return;
    const lit = new Set(), now = new Set(steps[cur]?.nodes ?? []);
    steps.forEach((s, i) => { if (i <= cur) s.nodes.forEach(n => lit.add(n)); });
    stepEls.forEach((n, i) => {
      n.classList.toggle('on', i <= cur); n.classList.toggle('cur', i === cur);
      if (i === cur) n.setAttribute('aria-current', 'step'); else n.removeAttribute('aria-current');
    });
    for (const [id, n] of nodeEls) { n.classList.toggle('on', lit.has(id)); n.classList.toggle('cur', now.has(id)); }
    for (const [n, e] of edgeEls) n.classList.toggle('on', lit.has(e.from) && lit.has(e.to));
    verdictEl.hidden = cur < steps.length - 1;
    counterEl.textContent = cur < 0 ? `${steps.length} steps · press Play or Step` : `Step ${cur + 1} of ${steps.length}`;
  }
  function setState(s) {
    state = s; root.dataset.state = s;
    if (buttons.play) { buttons.play.textContent = s === 'playing' ? 'Pause' : 'Play'; buttons.play.setAttribute('aria-pressed', String(s === 'playing')); }
  }
  function stop() { clearTimeout(timer); timer = 0; }
  function finish() { stop(); cur = steps.length - 1; draw(); setState('done'); }
  function tick() {
    cur++; draw();
    if (cur >= steps.length - 1) { timer = 0; setState('done'); return; }
    timer = setTimeout(tick, STEP_MS);
  }

  const handle = {
    select(id) {
      const v = valuesOf(id);
      if (!v) return;
      stop(); values = v; render(); cur = -1;
      if (pruned) { setState('idle'); return; }
      draw(); setState('idle');
      handle.play();
    },
    play() {
      if (pruned || state === 'playing') return;
      if (reduced()) return finish();
      if (state === 'done') { cur = -1; draw(); }
      setState('playing');
      timer = setTimeout(tick, cur < 0 ? LEAD_MS : STEP_MS);
    },
    pause() { if (state !== 'playing') return; stop(); setState('paused'); },
    destroy() { stop(); root.removeEventListener('click', onClick); root.removeEventListener('change', onChange); el.innerHTML = ''; },
  };
  function step() {
    if (pruned) return;
    stop();
    if (cur >= steps.length - 1) cur = -1;
    cur++; draw();
    setState(cur >= steps.length - 1 ? 'done' : 'paused');
  }
  function onClick(e) {
    const b = e.target.closest('button');
    if (!b || !root.contains(b)) return;
    if (b.dataset.sxParent) return handle.select(b.dataset.sxParent);
    const k = b.dataset.sxBtn;
    if (k === 'step') step();
    else if (k === 'play') state === 'playing' ? handle.pause() : handle.play();
    else if (k === 'restart') { stop(); cur = -1; draw(); setState('idle'); handle.play(); }
  }
  function onChange(e) {
    const p = e.target.closest('[data-sx-pick]');
    if (!p) return;
    handle.select(variantId({ ...values, [p.dataset.sxPick]: p.value }));
  }
  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);

  render(); draw();
  if (opts.reducedMotion) finish(); else setState('idle');
  return handle;
}
