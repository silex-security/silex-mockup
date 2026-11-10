/* Runtime Observation gate trace: one run's gate checks as a waterfall on a shared time axis.
   - gateTrace(envs): pure. pre_tool envelopes → { agent, total, counts, actions[{ tool, exit, start, end, checks[] }] }.
     Times are the engine's own decision_latency_ms and latency_breakdown, laid end to end. The axis is time spent
     in the gate, not wall-clock time: the envelopes carry no tool or model durations, so none are drawn.
   - mountTrace(root, { reducedMotion }): renders into `root` and returns { show(envs, label, { loop }), clear() }.
     Playback starts when the trace scrolls into view, so it is not over before the viewer reaches it. */
import { traceOf } from './rt-pipeline.js';

const CHECKS = [
  { key: 'rules', field: 'rules', name: 'Hard rules' },
  { key: 'serialize', field: 'serialize', name: 'Build judge input' },
  { key: 'judge', field: 'jev', name: 'Judge (Jev)' },
  { key: 'policy', field: 'policy', name: 'Policy' },
];
const OUTCOME = { allow: 'Allowed', hold: 'Held', block: 'Blocked' };
// How each kind of bar and badge looks: the tones and fills of css/trace-waterfall.css.
const TONE = { rules: 'amber', serialize: 'grey', judge: 'violet', policy: 'blue', allow: 'green', hold: 'amber', block: 'red', slow: 'violet' };
const look = kind => `data-tone="${TONE[kind]}"${kind === 'hold' ? ' data-fill="hatch"' : ''}`;

export function gateTrace(envs) {
  const pre = envs.filter(e => e.boundary === 'pre_tool');
  let clock = 0;
  const actions = pre.map(env => {
    const start = clock;
    const checks = [];
    for (const c of CHECKS) {
      const ms = env.latency_breakdown?.[c.field] ?? 0;
      if (ms > 0) { checks.push({ key: c.key, name: c.name, start: clock, end: clock + ms }); clock += ms; }
    }
    const end = start + (env.decision_latency_ms ?? clock - start);
    clock = end;
    const t = traceOf(env);
    return { tool: t.tool, exit: t.exit, decidedAt: t.decidedAt, caption: t.caption, alert: t.alert, start, end, checks, slowest: false };
  });
  const slowest = actions.length > 1 ? actions.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a)) : null;
  if (slowest) slowest.slowest = true;
  const counts = { allow: 0, hold: 0, block: 0 };
  for (const a of actions) counts[a.exit]++;
  return { agent: pre[0]?.agent ?? '', total: clock, counts, actions };
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SPEEDS = [1, 2, 0.5];
const ACTION_MS = 1400;   // the pipeline picture above spends about this long on one action
const LOOP_PAUSE_MS = 2200;

function ticks(total) {
  const step = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000].find(s => total / s <= 6) ?? 10000;
  const out = [];
  for (let x = 0; x < total; x += step) out.push(x);
  return out;
}

export function mountTrace(root, { reducedMotion = false } = {}) {
  root.classList.add('tw');
  let play = null, visible = false;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) play?.seen(); }, { threshold: .2 }).observe(root);

  function clear() {
    play?.stop();
    root.innerHTML = '<p class="tw-empty">Run a scenario to see where its gate time went.</p>';
  }

  function show(envs, label, { loop = false } = {}) {
    play?.stop();
    const t = gateTrace(envs);
    if (!t.actions.length) return clear();
    const span = t.total * 1.3;   // room right of the last bar for its label
    const pct = v => `${(v / span * 100).toFixed(3)}%`;
    const open = a => t.actions.length <= 3 || a.exit !== 'allow';

    const rows = [{ depth: 0, name: t.agent || 'agent', sub: `${t.actions.length} action${t.actions.length === 1 ? '' : 's'} checked`, bars: t.actions.map(a => ({ s: a.start, e: a.end, kind: a.exit })), end: t.total, label: `${t.total} ms in the gate` }];
    t.actions.forEach((a, i) => {
      rows.push({ depth: 1, action: i, open: open(a), name: a.tool, sub: a.caption.split(' · ').slice(1).join(' · '), bars: a.checks.map(c => ({ s: c.start, e: c.end, kind: c.key })), end: a.end,
        label: `${a.end - a.start} ms`, badges: [[a.exit, OUTCOME[a.exit]], ...(a.slowest ? [['slow', 'Slowest']] : [])] });
      for (const c of a.checks) rows.push({ depth: 2, parent: i, open: open(a), name: c.name, sub: '', bars: [{ s: c.start, e: c.end, kind: c.key }], end: c.end, label: `${c.end - c.start} ms`, decides: c.key === a.decidedAt });
    });

    const kpis = [['Gate time', 'time'], ['Actions checked', 'checked'], ['Ran', 'allow'], ['Held', 'hold'], ['Blocked', 'block']];
    root.innerHTML = `
      <div class="tw-top"><b>Gate trace</b><span class="tw-run">${esc(label ?? '')}</span><span class="tw-note">Simulated engine · time spent in the gate, not wall-clock</span></div>
      <div class="tw-kpis">${kpis.map(([l, k]) => `<div><small>${l}</small><span data-kpi="${k}"${TONE[k] ? ` data-tone="${TONE[k]}"` : ''}></span></div>`).join('')}</div>
      <div class="tw-scroll"><div class="tw-grid">
        <div class="tw-head">Steps</div>
        <div class="tw-head tw-axis">${ticks(span).filter(x => x <= span * .93).map(x => `<i style="left:${pct(x)}">${x} ms</i>`).join('')}</div>
        <div class="tw-names">${rows.map((r, i) => `<div class="tw-row" data-depth="${r.depth}" data-row="${i}"${r.parent != null ? ` data-parent="${r.parent}"` : ''}${r.open === false && r.depth === 2 ? ' hidden' : ''}>
          ${r.depth === 1 ? `<button type="button" class="tw-toggle" data-toggle="${r.action}" aria-expanded="${r.open}" aria-label="Show or hide the checks of ${esc(r.name)}"></button>` : ''}
          <span class="tw-name">${esc(r.name)}</span><span class="tw-sub">${esc(r.sub)}</span></div>`).join('')}</div>
        <div class="tw-lanes">${ticks(span).slice(1).map(x => `<span class="tw-tick" style="left:${pct(x)}"></span>`).join('')}
          ${rows.map((r, i) => `<div class="tw-lane" data-row="${i}"${r.parent != null ? ` data-parent="${r.parent}"` : ''}${r.open === false && r.depth === 2 ? ' hidden' : ''}>
            ${r.bars.map(b => `<span class="tw-bar" ${look(b.kind)} data-s="${b.s}" data-e="${b.e}" style="left:${pct(b.s)}"></span>`).join('')}
            <span class="tw-label" data-e="${r.end}" style="left:${pct(r.end)}">${r.label}${r.decides ? '<em>decided here</em>' : ''}${(r.badges ?? []).map(([k, text]) => `<em data-tone="${TONE[k]}">${text}</em>`).join('')}</span></div>`).join('')}
          <span class="tw-playhead"></span></div>
      </div></div>
      <div class="tw-foot">
        <div class="tw-ctl"><button type="button" data-act="play" aria-label="Play or pause"></button><button type="button" data-act="replay" aria-label="Replay from the start">↻</button><button type="button" data-act="speed" aria-label="Playback speed">1x</button></div>
        <div class="tw-legend">${CHECKS.map(c => `<span><i ${look(c.key)}></i>${c.name}</span>`).join('')}</div>
      </div>`;

    const bars = [...root.querySelectorAll('.tw-bar')].map(el => ({ el, s: +el.dataset.s, e: +el.dataset.e }));
    const labels = [...root.querySelectorAll('.tw-label')].map(el => ({ el, e: +el.dataset.e }));
    const names = [...root.querySelectorAll('.tw-row')];
    const head = root.querySelector('.tw-playhead');
    const btn = root.querySelector('[data-act="play"]');
    const kpi = Object.fromEntries([...root.querySelectorAll('[data-kpi]')].map(el => [el.dataset.kpi, el]));
    const sweep = Math.max(2 * ACTION_MS, t.actions.length * ACTION_MS);
    const st = { at: reducedMotion ? t.total : 0, on: false, waiting: !reducedMotion, speed: 0, last: 0, raf: 0, again: 0 };

    function draw() {
      for (const b of bars) { const w = Math.min(b.e, st.at) - b.s; b.el.hidden = w <= 0; if (w > 0) b.el.style.width = `max(3px, ${pct(w)})`; }
      for (const l of labels) l.el.hidden = st.at < l.e;
      names.forEach((n, i) => { const s = rows[i].bars[0].s; n.classList.toggle('pending', s >= st.at && st.at < t.total); n.classList.toggle('running', st.on && s < st.at && st.at < rows[i].end); });
      for (const b of bars) b.el.classList.toggle('growing', st.on && b.s < st.at && st.at < b.e);
      kpi.time.textContent = `${Math.round(st.at)} ms`;
      kpi.checked.textContent = t.actions.filter(a => a.start < st.at || st.at >= t.total).length;
      for (const k of ['allow', 'hold', 'block']) { const n = t.actions.filter(a => a.exit === k && a.end <= st.at).length; kpi[k].textContent = n; kpi[k].toggleAttribute('data-on', n > 0); }
      head.style.left = pct(st.at); head.hidden = st.at >= t.total;
      btn.textContent = st.on ? '❚❚' : '▶';
    }
    function frame(now) {
      if (!st.on) return;
      st.at = Math.min(t.total, st.at + (now - st.last) / sweep * t.total * SPEEDS[st.speed]); st.last = now;
      if (st.at >= t.total) { st.on = false; if (loop && visible) st.again = setTimeout(() => { st.at = 0; start(); }, LOOP_PAUSE_MS); }
      draw();
      if (st.on) st.raf = requestAnimationFrame(frame);
    }
    function start() { clearTimeout(st.again); st.waiting = false; if (st.at >= t.total) st.at = 0; st.on = true; st.last = performance.now(); cancelAnimationFrame(st.raf); st.raf = requestAnimationFrame(frame); draw(); }
    play = { stop() { st.on = false; st.waiting = false; clearTimeout(st.again); cancelAnimationFrame(st.raf); }, seen() { if (st.waiting || (loop && !st.on && st.at >= t.total)) start(); } };

    root.onclick = e => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'play') { if (st.on) { st.on = false; clearTimeout(st.again); draw(); } else start(); }
      if (act === 'replay') { st.at = 0; start(); }
      if (act === 'speed') { st.speed = (st.speed + 1) % SPEEDS.length; e.target.textContent = `${SPEEDS[st.speed]}x`; }
      const tw = e.target.closest('[data-toggle]');
      if (tw) {
        const openNow = tw.getAttribute('aria-expanded') !== 'true';
        tw.setAttribute('aria-expanded', openNow);
        root.querySelectorAll(`[data-parent="${tw.dataset.toggle}"]`).forEach(el => { el.hidden = !openNow; });
      }
    };
    if (st.waiting && visible) start(); else draw();
  }

  clear();
  return { show, clear };
}
