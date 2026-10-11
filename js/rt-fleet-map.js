// Runtime Observation · fleet swimlanes and simulated review routing.
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function mountMap(el, model, opts = {}) {
  if (!el) return { destroy() {} };
  const doc = el.ownerDocument, win = doc.defaultView;
  const tip = opts.tip ?? (() => '');
  const teams = [...new Set(model.fleet.map(row => row.team))];
  const details = dot => `${dot.scenario} · ${dot.tool} · ${dot.decision} by ${dot.rule} → ${dot.team}`;
  el.innerHTML = `<section class="card rt-fmap" data-rt-fmap>
    <div class="rt-fmap-heading"><h3>The fleet</h3><span class="rt-chip" data-kind="sim">Authored configuration</span>
    ${tip('Reviewers follow <b>OWNED_BY_TEAM</b> in the candidate <a href="swm/data/packs/creator-platform.json" target="_blank" rel="noopener">Creator Platform Pack</a>, outside the site’s coverage figures.')}</div>
    <div class="rt-fmap-lanes">${teams.map(team => `<section class="rt-fmap-lane"><h4>${esc(team)}</h4><div class="rt-fmap-agents">${model.fleet.filter(row => row.team === team).map(row => `<article class="rt-fmap-agent" data-rt-fmap-agent="${esc(row.agent)}"><h4>${esc(row.agent)}</h4><div class="rt-fmap-tools">${row.tools.map(tool => `<span class="rt-fmap-tool" data-impact="${esc(tool.impact)}"><span>${esc(tool.name)}</span><b>${esc(tool.impact)}</b>${tip(`Impact: ${esc(tool.impact)}; held or blocked calls go to ${esc(tool.reviewer)}.`)}</span>`).join('')}</div></article>`).join('')}</div></section>`).join('')}</div>
  </section>
  <section class="card rt-froute" data-rt-froute data-state="idle">
    <div class="rt-fmap-heading"><h3>Who reviews what</h3><div class="rt-froute-controls"><button type="button" class="rt-froute-play">▶ Play</button><button type="button" class="rt-froute-replay">↺ Replay</button></div></div>
    <span class="rt-chip rt-froute-count-chip" data-kind="sim">Scenario counts, computed by the engine, not measurements</span>
    <div class="rt-froute-panels"><section class="rt-froute-panel"><h4>With the ontology slice <strong data-rt-froute-total-on>${esc(model.queues.on.total)}</strong></h4>
      ${Object.entries(model.queues.on.byTeam).map(([team, count]) => `<section class="rt-froute-bucket"><h5>${esc(team)} <strong>${esc(count)}</strong></h5><div class="rt-froute-dots">${model.dots.map((dot, index) => dot.team === team ? `<button type="button" tabindex="0" class="rt-froute-dot rt-tip" data-rt-fdot="${index}" aria-label="${esc(details(dot))}" aria-expanded="false"><span aria-hidden="true">●</span><span class="rt-tip-body" hidden>${esc(details(dot))}</span></button>` : '').join('')}</div></section>`).join('')}
    </section><section class="rt-froute-panel"><h4>Trace only <strong data-rt-froute-total-off>${esc(model.queues.off.total)}</strong></h4>
    ${model.queues.off.total === 0 ? '<div class="rt-froute-empty">Nothing stopped, so nothing to route</div>' : Object.entries(model.queues.off.byTeam).map(([team, count]) => `<div class="rt-froute-bucket">${esc(team)} · ${esc(count)}</div>`).join('')}
    </section></div>
    <p class="rt-froute-claim" data-rt-froute-claim>Routed to the team that owns that kind of action · simulated, no tickets are created</p>
    <p class="rt-froute-status" role="status" aria-live="polite">Review buckets shown</p>
  </section>`;
  const route = el.querySelector('[data-rt-froute]');
  const playButton = el.querySelector('.rt-froute-play');
  const replayButton = el.querySelector('.rt-froute-replay');
  const status = el.querySelector('.rt-froute-status');
  const dots = [...el.querySelectorAll('[data-rt-fdot]')];
  const agents = new Map([...el.querySelectorAll('[data-rt-fmap-agent]')].map(node => [node.dataset.rtFmapAgent, node]));
  let frame = 0, elapsed = 0, start = 0, offsets = [], destroyed = false;
  const duration = 4600, flight = 1100;
  function cancel() { if (frame) win.cancelAnimationFrame(frame); frame = 0; }
  function state(value, text) {
    route.dataset.state = value;
    playButton.textContent = value === 'playing' ? '❚❚ Pause' : '▶ Play';
    status.textContent = text;
  }
  function clear() { for (const dot of dots) dot.style.removeProperty('transform'); }
  function finish() { cancel(); clear(); elapsed = duration; state('done', 'All stopped calls shown in their review buckets'); }
  function paint(time) {
    elapsed = Math.min(duration, time - start);
    dots.forEach((dot, index) => {
      const delay = dots.length > 1 ? index * (duration - flight) / (dots.length - 1) : 0;
      const progress = Math.max(0, Math.min(1, (elapsed - delay) / flight));
      const remaining = 1 - progress * progress * (3 - 2 * progress);
      dot.style.transform = `translate(${offsets[index].x * remaining}px, ${offsets[index].y * remaining}px)`;
    });
    if (elapsed >= duration) finish(); else frame = win.requestAnimationFrame(paint);
  }
  function play() {
    if (destroyed || route.dataset.state === 'playing') return;
    if (opts.reducedMotion) { finish(); return; }
    if (route.dataset.state !== 'paused') {
      elapsed = 0; clear();
      offsets = dots.map(dot => {
        const source = agents.get(model.dots[Number(dot.dataset.rtFdot)].agent)?.getBoundingClientRect();
        const target = dot.getBoundingClientRect();
        return { x: source ? source.left + source.width / 2 - target.left - target.width / 2 : 0,
          y: source ? source.top + source.height / 2 - target.top - target.height / 2 : 0 };
      });
    }
    state('playing', 'Routing stopped calls to their reviewing teams');
    start = win.performance.now() - elapsed;
    paint(win.performance.now());
  }
  function pause() { if (route.dataset.state !== 'playing') return; cancel(); state('paused', 'Routing paused'); }
  function reset() { cancel(); clear(); elapsed = 0; state('idle', 'Review buckets shown'); }
  function toggle() { if (route.dataset.state === 'playing') pause(); else play(); }
  function replay() { reset(); play(); }
  function tabChanged(event) { if (event.detail?.tab !== 'fleet') reset(); }
  // Recompute source coordinates after a resize instead of retaining offscreen transforms.
  function resized() { if (route.dataset.state === 'playing' || route.dataset.state === 'paused') reset(); }
  playButton.addEventListener('click', toggle);
  replayButton.addEventListener('click', replay);
  doc.addEventListener('rt:tab', tabChanged);
  win.addEventListener('resize', resized);
  if (opts.reducedMotion) finish();
  return { play, pause, reset, destroy() {
    destroyed = true; cancel();
    playButton.removeEventListener('click', toggle); replayButton.removeEventListener('click', replay);
    doc.removeEventListener('rt:tab', tabChanged); win.removeEventListener('resize', resized);
    el.innerHTML = '';
  } };
}
