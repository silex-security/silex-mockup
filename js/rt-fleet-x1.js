// Runtime Observation · Agent fleet, block B: the X1 cascade animation (logs/2026-10-10_AGENT_FLEET_VISUAL_PLAN.md).
// Owner: coder-opus (T1). Contract: no DOM access at module top level (Node imports this file); mount only inside mountX1.
//
// A video card ("token") travels Ops request → Trend Scout → Platform sync → Ad Curator → Ad Buyer. Every decision,
// rule, reason, fact, agent, tool, team and reviewer comes from the model (fleetModel in js/rt-fleet.js); the only
// typed words are the narrative ones (the Ops request, the platform sync, the scripted outcome). Nodes, labels and
// tips are HTML laid over an SVG that draws the edges, so the site's ⓘ tips work on them.

const W = 980, H = 290;
const STEP_MS = 1100;
const TOUR_GAP_MS = 1500;
// Stage geometry (px in a fixed 980 × 290 stage that scrolls on its own on narrow screens).
const NODE = { ops: [0, 150], X1Pb: [190, 170], sync: [420, 150], X1Cb: [610, 150], X1Bb: [800, 170] };
const ORDER = ['ops', 'X1Pb', 'sync', 'X1Cb', 'X1Bb'];
const NODE_TOP = 44, NODE_H = 96, BAND_TOP = 148, TOKEN_TOP = 178, TOKEN_W = 70;
const QUEUE = { left: 396, top: 216 }, OUTCOME = { left: 620, top: 216 };
const KIND = { deny: 'blocked', stop_and_handover: 'blocked', hold_for_approval: 'held', hold_for_review: 'review' };

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const words = s => String(s ?? '').split(/[-_\s]+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
const shortTool = t => String(t ?? '').split('.').pop();
const center = id => NODE[id][0] + NODE[id][1] / 2;

/** The three typed facts behind the slice's decisions, unique by s/p/o, in first-seen order. */
export function x1Facts(model) {
  const seen = new Map();
  for (const x of model?.x1 ?? []) for (const t of x.on?.triples ?? []) {
    const k = `${t.s}\u0000${t.p}\u0000${t.o}`;
    if (!seen.has(k)) seen.set(k, t);
  }
  return [...seen.values()];
}

/** How a decision is shown: text, chip kind and the one-line announcement. */
function face(x, d) {
  const text = d.stopped ? d.decision : 'ran ✓';
  const kind = d.stopped ? (KIND[d.action] ?? 'blocked') : 'ran';
  const rule = d.rules.length ? `rule ${d.rules.join(', ')}` : 'no rule fired';
  return { text, kind, say: `${words(x.agent)}: ${d.stopped ? d.decision : 'ran'}, ${rule}` };
}

/** @returns {{ play(): void, pause(): void, reset(): void, destroy(): void }} */
export function mountX1(el, model, opts = {}) {
  if (!el) return { play() {}, pause() {}, reset() {}, destroy() {} };
  const tip = opts.tip ?? ((html, label = 'i') => `<span class="rt-tip" tabindex="0">${label}<span class="rt-tip-body" hidden>${html}</span></span>`);
  const rm = !!opts.reducedMotion;
  // The host passes the setting at mount; a change made later (OS setting, emulation) is honoured at Play time.
  const reduced = () => rm || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const x1 = model?.x1 ?? [];
  const facts = x1Facts(model);
  const video = facts.find(t => /^video:/.test(t.s))?.s.replace(/^video:/, '') ?? 'video';
  const reviewerOf = (agent, tool) => model?.fleet?.find(r => r.agent === agent)?.tools.find(t => t.name === tool)?.reviewer ?? null;

  let mode = 'off', state = 'idle', steps = [], next = 0, timer = null;

  // ---- static frame -------------------------------------------------------------------------------------------
  el.innerHTML = `
  <section class="card rt-fx1${rm ? ' rt-fx1-rm' : ''}" data-rt-fx1 data-mode="off" data-state="idle" aria-labelledby="rtFx1H">
    <div class="rt-fx1-head">
      <h2 id="rtFx1H">Every step succeeded. The outcome broke the rule.${tip(
        'Operations asked to promote a popular video under one constraint: <b>no minors in ads</b>. Three agents on two teams each did their own step correctly. ' +
        'A trace-only monitor sees three allowed tool calls. The ontology slice adds what no single trace event carries: the declared facts that link the steps. ' +
        'Decisions are computed by the vendored simulated engine at page load.')}</h2>
      <span class="rt-chip" data-kind="sim">Simulated · scripted</span>
    </div>
    <div class="rt-fx1-controls">
      <div class="rt-fx1-toggle" role="group" aria-label="Monitor">
        <button type="button" data-rt-fx1-mode="off" aria-pressed="true">Trace only</button>
        <button type="button" data-rt-fx1-mode="on" aria-pressed="false">With ontology</button>
      </div>
      <div class="rt-fx1-play">
        <button type="button" class="btn secondary" data-rt-fx1-act="play" aria-label="Play">▶ Play</button>
        <button type="button" class="btn secondary" data-rt-fx1-act="replay" aria-label="Replay">↺ Replay</button>
        <button type="button" class="btn secondary" data-rt-fx1-act="step" aria-label="Next step">Step ›</button>
      </div>
    </div>
    <div class="rt-fx1-scroll"><div class="rt-fx1-stage" role="group" aria-label="X1 cascade, ${esc(video)} through three agents"></div></div>
    <p class="rt-fx1-live" aria-live="polite" data-rt-fx1-live></p>
    <div class="rt-fx1-claims">
      <p data-rt-fx1-claim>The chain comes from declared typed facts, not from linking traces at runtime.</p>
      <p data-rt-fx1-claim>Each checkpoint is evaluated on its own; in a real run the hold at the first step stops the other two.</p>
    </div>
  </section>`;
  const root = el.querySelector('[data-rt-fx1]');
  const stage = root.querySelector('.rt-fx1-stage');
  const live = root.querySelector('[data-rt-fx1-live]');
  const playBtn = root.querySelector('[data-rt-fx1-act="play"]');

  // ---- stage --------------------------------------------------------------------------------------------------
  function svg() {
    const y = NODE_TOP + NODE_H / 2;
    const edge = (a, b, i) => {
      const x1p = NODE[a][0] + NODE[a][1], x2 = NODE[b][0];
      const story = a === 'ops' ? ' story' : '';
      return `<g class="rt-fx1-edge${story}" data-edge="${i}"><line x1="${x1p}" y1="${y}" x2="${x2 - 6}" y2="${y}"/><path d="M${x2 - 8},${y - 5} L${x2},${y} L${x2 - 8},${y + 5} Z"/></g>`;
    };
    const lane = TOKEN_TOP + 14;
    return `<svg class="rt-fx1-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true" focusable="false">
      ${ORDER.slice(0, -1).map((a, i) => edge(a, ORDER[i + 1], i)).join('')}
      <line class="rt-fx1-lane" x1="40" y1="${lane}" x2="${W - 40}" y2="${lane}"/>
      <path class="rt-fx1-route" d="M${center('X1Pb') + TOKEN_W / 2},${lane} C${QUEUE.left - 20},${lane} ${QUEUE.left - 40},${QUEUE.top + 29} ${QUEUE.left},${QUEUE.top + 29}"/>
    </svg>`;
  }
  const node = (id, title, sub, story, extra = '') => `<div class="rt-fx1-node${story ? ' story' : ''}" data-rt-fx1-node="${id}"
      style="left:${NODE[id][0]}px;top:${NODE_TOP}px;width:${NODE[id][1]}px;height:${NODE_H}px">
      <b class="rt-fx1-nt">${esc(title)}${extra}</b><span class="rt-fx1-ns">${esc(sub)}</span><div class="rt-fx1-slot"></div></div>`;

  function bands() {
    // Consecutive steps of the same team share one band (Content Ops under Trend Scout; Ads under the two ad agents).
    const out = [];
    for (const x of x1) {
      const [l, w] = NODE[x.id] ?? [];
      if (l == null) continue;
      const last = out.at(-1);
      if (last && last.team === x.team) last.right = l + w; else out.push({ team: x.team, left: l, right: l + w });
    }
    return out.map(b => `<div class="rt-fx1-band" style="left:${b.left}px;top:${BAND_TOP}px;width:${b.right - b.left}px">${esc(words(b.team))}</div>`).join('');
  }

  function factSpots() {
    // SYNCS_TO-like facts (about pools) sit above the pool → sync edge; facts about the video sit by the token.
    let e = 0, v = 0;
    return facts.map(t => {
      const pool = /^pool:/.test(t.s) || /^pool:/.test(t.o);
      const pos = pool ? { left: 262, top: 6 + 26 * e++ } : { left: 20, top: 220 + 30 * v++ };
      return `<span class="rt-fx1-fact" data-rt-fx1-fact data-about="${pool ? 'pool' : 'video'}" style="left:${pos.left}px;top:${pos.top}px">
        <span class="mono">${esc(t.s)} <b>${esc(t.p)}</b> ${esc(t.o)}</span>${tip(`<span class="mono">${esc(t.s)} ${esc(t.p)} ${esc(t.o)}</span><br>Grade: <b>${esc(t.grade)}</b>. A typed fact in the ontology slice, read by the rule; no trace links the three steps.`)}</span>`;
    }).join('');
  }

  function build() {
    clearTimeout(timer); timer = null;
    stage.innerHTML = svg()
      + node('ops', 'Ops request', 'no minors in ads', true)
      + x1.map(x => NODE[x.id] ? node(x.id, words(x.agent), shortTool(x.tool), false) : '').join('')
      + node('sync', 'Platform sync', 'automatic', true, tip('No agent and no check: the platform copies the hot pool into the ad-candidate pool on its own.'))
      + bands()
      + (mode === 'on' ? factSpots() : '')
      + `<div class="rt-fx1-token" data-rt-fx1-token aria-hidden="true" style="left:${center('ops') - TOKEN_W / 2}px;top:${TOKEN_TOP}px">▶ ${esc(video)}</div>`;
    stage.style.width = `${W}px`; stage.style.height = `${H}px`;
    root.dataset.mode = mode;
    delete root.dataset.routed;
    steps = plan(mode); next = 0;
    live.textContent = '';
    setState('idle');
  }

  // ---- steps --------------------------------------------------------------------------------------------------
  const $node = id => stage.querySelector(`[data-rt-fx1-node="${id}"]`);
  const $token = () => stage.querySelector('[data-rt-fx1-token]');
  const moveToken = (left, top = TOKEN_TOP) => { const t = $token(); if (t) { t.style.left = `${left}px`; t.style.top = `${top}px`; } };
  const activate = id => { for (const n of stage.querySelectorAll('.rt-fx1-node.is-active')) n.classList.remove('is-active'); $node(id)?.classList.add('is-active'); };

  function reveal(x, d, independent) {
    const f = face(x, d);
    const why = d.rules.length
      ? `Rule <span class="mono">${esc(d.rules.join(', '))}</span>: ${esc(d.reasons.join('; '))}`
      : 'No rule fired; the call was allowed to run.';
    const own = independent ? '<br>Evaluated on its own. In a real run, the hold at the first step means this call never happens.' : '';
    const slot = $node(x.id)?.querySelector('.rt-fx1-slot');
    if (!slot) return;
    slot.innerHTML = `<span class="rt-chip" data-kind="${f.kind}" data-rt-fx1-decision="${esc(d.decision)}" aria-label="Decision ${esc(d.decision)}${independent ? ', independent check' : ''}">${esc(f.text)}</span>`
      + tip(`<b class="mono">${esc(x.tool)}</b> · ${esc(d.decision)}<br>${why}${own}`)
      + (independent ? '<small class="rt-fx1-indep">independent check</small>' : '');
    $node(x.id).classList.add('is-reached');
  }

  function plan(m) {
    const S = [];
    S.push({ say: `Ops request: promote ${video}; constraint: no minors in ads.`, run: () => activate('ops') });
    if (m === 'on' && facts.length) S.push({
      say: `${facts.length} declared facts: ${facts.map(t => `${t.s} ${t.p} ${t.o}`).join('; ')}.`,
      run: () => { for (const f of stage.querySelectorAll('[data-rt-fx1-fact]')) f.classList.add('is-on'); },
    });
    let stopped = null;
    x1.forEach((x, i) => {
      const d = x[m];
      if (!d) return;
      if (i === 1 && !stopped) S.push({
        say: 'Platform sync: the hot pool flows into the ad candidates automatically.',
        run: () => { activate('sync'); moveToken(center('sync') - TOKEN_W / 2); },
      });
      if (!stopped) {
        S.push({ say: face(x, d).say, run: () => { activate(x.id); moveToken(center(x.id) - TOKEN_W / 2); reveal(x, d, false); } });
        if (d.stopped) {
          stopped = x;
          const team = reviewerOf(x.agent, x.tool) ?? 'the owning team';
          S.push({
            say: `${video} routed to ${team}, simulated.`,
            run: () => {
              root.dataset.routed = '1';
              moveToken(QUEUE.left + 10, QUEUE.top + 14);
              const q = stage.querySelector('[data-rt-fx1-queue]');
              if (!q) stage.insertAdjacentHTML('beforeend', `<div class="rt-fx1-queue" data-rt-fx1-queue style="left:${QUEUE.left}px;top:${QUEUE.top}px">
                <b>${esc(team)}</b><span>routed to owner · simulated</span>${tip(`<span class="mono">OWNED_BY_TEAM</span>: ${esc(team)} owns <span class="mono">${esc(x.tool)}</span> in the candidate pack. The page shows where the hold goes; no ticket is created.`)}</div>`);
              const k = ORDER.indexOf(x.id);
              for (const id of ORDER.slice(k + 1)) $node(id)?.classList.add('is-dim');
              for (const e of stage.querySelectorAll('.rt-fx1-edge')) if (+e.dataset.edge >= k) e.classList.add('is-dim');
              for (const n of stage.querySelectorAll('.rt-fx1-node.is-active')) n.classList.remove('is-active');
            },
          });
        }
      } else {
        S.push({ say: `${face(x, d).say}, independent check`, run: () => reveal(x, d, true) });
      }
    });
    if (!stopped) S.push({
      say: 'Outcome: a minor-featuring video in paid ads. Scripted outcome.',
      run: () => {
        for (const n of stage.querySelectorAll('.rt-fx1-node.is-active')) n.classList.remove('is-active');
        stage.insertAdjacentHTML('beforeend', `<div class="rt-fx1-outcome" data-rt-fx1-outcome style="left:${OUTCOME.left}px;top:${OUTCOME.top}px">
          <b>Minor-featuring video in paid ads ✗</b><span class="rt-fx1-scripted">scripted outcome</span>${tip('The scenario\'s story of what three allowed calls add up to. The engine computes the three decisions; this outcome card is scripted narrative, not an engine output.')}</div>`);
      },
    });
    return S;
  }

  // ---- player -------------------------------------------------------------------------------------------------
  function setState(s) {
    state = s; root.dataset.state = s;
    const playing = s === 'playing';
    playBtn.textContent = playing ? '❚❚ Pause' : '▶ Play';
    playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  }
  function apply() {
    const s = steps[next++];
    if (!s) return;
    s.run();
    live.textContent = `Step ${next} of ${steps.length}. ${s.say}`;
  }
  function tick() {
    timer = null;
    apply();
    if (next >= steps.length) setState('done'); else timer = setTimeout(tick, STEP_MS);
  }
  function play() {
    if (state === 'playing') return;
    if (state === 'done') build();
    if (reduced()) { while (next < steps.length) apply(); setState('done'); return; }
    setState('playing');
    timer = setTimeout(tick, next === 0 ? 250 : STEP_MS / 2);
  }
  function pause() {
    if (state !== 'playing') return;
    clearTimeout(timer); timer = null;
    setState('paused');
  }
  function step() {
    clearTimeout(timer); timer = null;
    if (state === 'done') return;
    apply();
    setState(next >= steps.length ? 'done' : 'paused');
  }
  function reset() { build(); }
  // The guided demo (T4): Trace only first, then, after a short pause, With ontology. Any button press hands control back
  // to the viewer and ends the tour; reduced motion never starts it.
  let tourTimer = null;
  function cancelTour() { clearTimeout(tourTimer); tourTimer = null; }
  function tour() {
    cancelTour();
    if (reduced()) return;
    setMode('off'); build(); play();
    const wait = () => {
      if (state === 'done') tourTimer = setTimeout(() => { tourTimer = null; setMode('on'); play(); }, TOUR_GAP_MS);
      else tourTimer = setTimeout(wait, 200);
    };
    tourTimer = setTimeout(wait, 200);
  }
  function setMode(m) {
    if (m === mode) return;
    mode = m;
    for (const b of root.querySelectorAll('[data-rt-fx1-mode]')) b.setAttribute('aria-pressed', String(b.dataset.rtFx1Mode === m));
    build();
  }

  const onClick = e => {
    const b = e.target.closest?.('button');
    if (!b || !root.contains(b)) return;
    cancelTour();
    if (b.dataset.rtFx1Mode) setMode(b.dataset.rtFx1Mode);
    else if (b.dataset.rtFx1Act === 'play') (state === 'playing' ? pause : play)();
    else if (b.dataset.rtFx1Act === 'replay') { build(); play(); }
    else if (b.dataset.rtFx1Act === 'step') step();
  };
  // Leaving the Agent fleet tab cancels a running animation (it stays paused where it was).
  const onTab = e => { if (e.detail?.tab && e.detail.tab !== 'fleet') { cancelTour(); pause(); } };
  root.addEventListener('click', onClick);
  if (typeof document !== 'undefined') document.addEventListener('rt:tab', onTab);

  build();
  return {
    play, pause, reset, tour,
    destroy() {
      clearTimeout(timer); timer = null; cancelTour();
      root.removeEventListener('click', onClick);
      if (typeof document !== 'undefined') document.removeEventListener('rt:tab', onTab);
      el.innerHTML = '';
    },
  };
}
