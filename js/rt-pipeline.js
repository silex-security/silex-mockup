/* Runtime Observation live pipeline picture (logs/2026-10-02_RUNTIME_PIPELINE_VISUAL_PLAN.md §1.2–1.3, §2.1).
   - traceOf(env): pure envelope → one action's outcome + stage states + caption. Never guesses: throws on an
     unknown action or decided_by so a probe can catch a schema drift.
   - mountPipeline(root, { reducedMotion }): renders the §1.2 picture into `root` and returns
     { idle, replay, skip, stop, reset, error }. The host (task 3) drives it; probes read the §2.2 DOM hooks. */

const EXIT = {
  allow: 'allow', allow_and_alert: 'allow',
  hold_for_review: 'hold', hold_for_approval: 'hold',
  deny: 'block', stop_and_handover: 'block',
};
const VERDICT = {
  allow: 'allowed', allow_and_alert: 'allowed',
  hold_for_review: 'held for review', hold_for_approval: 'held for approval',
  deny: 'blocked', stop_and_handover: 'stopped',
};
const WOULD_VERB = { BLOCK: 'blocked', HOLD: 'held for approval', REVIEW: 'held for review', STOP: 'stopped' };
const DECIDED_AT = { rule: 'rules', jev: 'judge', policy: 'policy', fallback: 'fallback' };

/**
 * Pure. env = one pre_tool envelope. Returns the §2.1 trace shape.
 */
export function traceOf(env) {
  const action = env?.action;
  if (!(action in EXIT)) throw new Error(`unknown action: ${action}`);
  const decidedBy = env.decided_by;

  let stages;
  switch (decidedBy) {
    case 'rule': stages = { rules: 'hit', judge: 'ran-not-deciding', policy: 'bypassed' }; break;
    case 'jev': stages = { rules: 'pass', judge: 'hit', policy: 'pass' }; break;
    case 'policy': stages = { rules: 'pass', judge: 'pass', policy: 'pass' }; break;
    case 'fallback': stages = { rules: 'pass', judge: env.jev_status === 'down' ? 'down' : 'timeout', policy: 'fallback' }; break;
    default: throw new Error(`unknown decided_by: ${decidedBy}`);
  }

  const ruleIds = (env.rule_hits ?? []).map(h => h.id);
  const reason = env.reasons?.[0] ?? null;
  const fallback = env.fallback ? { fail: env.fallback.fail } : null;
  const monitor = env.mode === 'monitor' && env.would_have && env.would_have !== 'ALLOW'
    ? { wouldHave: WOULD_VERB[env.would_have] }
    : null;
  const alert = env.alert === true || action === 'allow_and_alert';

  let who;
  switch (decidedBy) {
    case 'rule': who = `rule ${ruleIds.join(', ')}`; break;
    case 'jev': who = 'the judge'; break;
    case 'policy': who = 'policy'; break;
    case 'fallback': who = `fallback (fail-${fallback.fail})`; break;
  }

  let verdict = VERDICT[action];
  if (monitor) verdict = `allowed (monitor mode · would have been ${monitor.wouldHave})`;

  const caption = `${env.tool?.name ?? ''} · ${verdict} by ${who}${reason ? ` — ${reason}` : ''}`;

  return {
    tool: env.tool?.name ?? '',
    exit: EXIT[action],
    decidedAt: DECIDED_AT[decidedBy],
    decidedBy,
    stages,
    fallback,
    monitor,
    alert,
    ruleIds,
    reason,
    caption,
  };
}

const ICONS = {
  action: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg>',
  rules: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4z"/></svg>',
  judge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>',
  policy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h13M20 17h0"/></svg>',
  evidence: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg>',
};

const STAGES = [
  { key: 'action', name: 'Agent action', cap: 'tool call it wants' },
  { key: 'rules', name: 'Hard rules', cap: 'fixed checks can veto alone' },
  { key: 'judge', name: 'Judge (Jev)', cap: 'model answers risk questions' },
  { key: 'policy', name: 'Policy', cap: 'turns answers into a decision' },
];
const EXITS = [
  { key: 'allow', glyph: '✓', label: 'Allow', sub: 'runs' },
  { key: 'hold', glyph: '⏸', label: 'Hold', sub: 'waits for a person' },
  { key: 'block', glyph: '✕', label: 'Block', sub: 'never runs' },
];

const STEP_MS = 230;      // 6 stops per action ≈ 1.4 s
const IDLE_STEP_MS = 420;
const IDLE_HOLD_MS = 1500;

/**
 * Render the §1.2 picture into `root` and return its controls.
 */
export function mountPipeline(root, { reducedMotion = false } = {}) {
  if (reducedMotion) root.dataset.reduced = 'true';

  const conn = '<span class="rt-conn" aria-hidden="true"></span>';
  const stageHtml = STAGES.map(s => `
    <div class="rt-stage" data-stage="${s.key}" data-state="idle">
      ${ICONS[s.key]}
      <span class="rt-stage-name">${s.name}</span>
      <span class="rt-stage-cap">${s.cap}</span>
      <span class="rt-stage-note"></span>
      <span class="rt-stage-monitor"></span>
    </div>`).join(conn);
  const exitsHtml = `<div class="rt-exits">${EXITS.map(e =>
    `<div class="rt-exit" data-exit="${e.key}"><b>${e.label} ${e.glyph}</b><span>${e.sub}</span></div>`).join('')}</div>`;

  root.innerHTML = `
    <span class="rt-pipe-sim">simulated</span>
    <div class="rt-pipe-lane">
      ${stageHtml}
      ${conn}
      ${exitsHtml}
      ${conn}
      <div class="rt-stage rt-evidence" data-stage="evidence" data-state="idle">
        ${ICONS.evidence}
        <span class="rt-stage-name">Evidence</span>
        <span class="rt-stage-cap">record of the decision · preview only; nothing leaves the browser</span>
        <span class="rt-evidence-count">0 records</span>
        <span class="rt-stage-note"></span>
        <span class="rt-stage-monitor"></span>
      </div>
      <div class="rt-token" id="rtToken" aria-hidden="true"></div>
    </div>
    <div class="rt-pipe-meta">
      <p class="rt-pipe-caption" id="rtPipeCaption" aria-live="polite"></p>
      <div class="rt-badges" id="rtPipeBadges"></div>
      <button class="rt-pipe-skip" id="rtPipeSkip" type="button">Skip</button>
    </div>
    <div class="rt-pipe-dots" id="rtPipeDots"></div>`;

  const $ = sel => root.querySelector(sel);
  const lane = $('.rt-pipe-lane');
  const token = $('#rtToken');
  const captionEl = $('#rtPipeCaption');
  const badgesEl = $('#rtPipeBadges');
  const dotsEl = $('#rtPipeDots');
  const countEl = $('.rt-evidence-count');
  const stageEls = { action: $('[data-stage="action"]'), rules: $('[data-stage="rules"]'), judge: $('[data-stage="judge"]'), policy: $('[data-stage="policy"]'), evidence: $('[data-stage="evidence"]') };
  const exitEls = { allow: $('[data-exit="allow"]'), hold: $('[data-exit="hold"]'), block: $('[data-exit="block"]') };
  const skipBtn = $('#rtPipeSkip');

  let gen = 0;
  let timers = new Set();
  let cur = null;      // active replay { traces, g, isCurrent, resolve }
  let idleG = null;
  let onScreen = true;
  let docVisible = typeof document === 'undefined' ? true : !document.hidden;

  // The idle loop runs only while the picture is on screen and the tab is visible: going off screen stops it at
  // once (keeping the current frame), and coming back restarts it from the first example.
  let idleList = null, pausedList = null;
  function visibilityChanged() {
    const visible = onScreen && docVisible;
    if (!visible && idleG !== null && idleList) { pausedList = idleList; ++gen; clearTimers(); stopIdle(); }
    else if (visible && pausedList) { const list = pausedList; pausedList = null; idle(list); }
  }
  if (typeof IntersectionObserver !== 'undefined') {
    new IntersectionObserver(entries => { for (const e of entries) onScreen = e.isIntersecting; visibilityChanged(); }, { threshold: 0 }).observe(root);
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { docVisible = !document.hidden; visibilityChanged(); });

  function clearTimers() { for (const id of timers) clearTimeout(id); timers.clear(); }
  function stopIdle() { idleG = null; }
  function forgetIdle() { stopIdle(); idleList = null; pausedList = null; }

  function tick(ms, g) {
    return new Promise((resolve, reject) => {
      const id = setTimeout(() => { timers.delete(id); (gen === g ? resolve() : reject(new Error('stale'))); }, ms);
      timers.add(id);
    });
  }

  // The token's offset is in pixels, so a resize (e.g. a phone rotating, or the vertical layout under 640 px)
  // re-places it on the box it is at.
  let tokenAt = null;
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => { if (tokenAt) moveToken(tokenAt); }).observe(lane);

  function moveToken(target) {
    tokenAt = target;
    const laneRect = lane.getBoundingClientRect();
    // At the fork the token sits above the exits column; the lit exit shows which way it went.
    const t = (target.dataset.exit ? target.parentElement : target).getBoundingClientRect();
    const tw = token.offsetWidth || 0, th = token.offsetHeight || 0;
    // Sits on the box's top edge like a tag, so it never covers the box's own text.
    token.style.transform = `translate(${t.left - laneRect.left + (t.width - tw) / 2}px, ${t.top - laneRect.top - th / 2}px)`;
    token.style.opacity = '1';
  }

  function setStage(key, state, trace) {
    const el = stageEls[key];
    el.dataset.state = state;
    const note = el.querySelector('.rt-stage-note');
    const mon = el.querySelector('.rt-stage-monitor');
    let text = '';
    if (state === 'hit') text = key === 'rules' ? trace.ruleIds.join(', ') : (trace.reason ?? '');
    else if (state === 'timeout') text = 'timed out';
    else if (state === 'down') text = 'judge down';
    else if (state === 'ran-not-deciding') text = 'ran · not deciding';
    else if (state === 'fallback') text = `fallback · fail-${trace.fallback?.fail ?? 'closed'}`;
    note.textContent = text;
    // In monitor mode the action runs (exit allow), but the deciding box keeps the colour of what the gate would
    // have done; a fallback decision is shown on the Policy box.
    const tone = trace.monitor ? (/^(blocked|stopped)$/.test(trace.monitor.wouldHave) ? 'block' : 'hold') : trace.exit;
    el.classList.toggle('is-block', state === 'hit' && tone === 'block');
    el.classList.toggle('is-hold', state === 'hit' && tone === 'hold');
    const deciding = { rules: 'rules', judge: 'judge', policy: 'policy', fallback: 'policy' }[trace.decidedAt];
    const monitorHere = key === deciding && !!trace.monitor;
    el.toggleAttribute('data-monitor', monitorHere);
    mon.textContent = monitorHere ? 'monitor' : '';
  }

  function applyBadges(trace) {
    badgesEl.innerHTML = '';
    if (trace.alert) badgesEl.insertAdjacentHTML('beforeend', '<span class="rt-badge rt-badge-alert">alert</span>');
    if (trace.monitor) badgesEl.insertAdjacentHTML('beforeend', `<span class="rt-badge rt-badge-monitor">monitor mode · would have been ${trace.monitor.wouldHave}</span>`);
  }

  function lightExit(exit) { for (const [k, el] of Object.entries(exitEls)) el.toggleAttribute('data-lit', k === exit); }
  function setCount(n) { countEl.textContent = `${n} record${n === 1 ? '' : 's'}`; }

  // Clears the previous action's lit stages, exit and badges, so each action starts from a clean lane.
  function clearStages() {
    for (const el of Object.values(stageEls)) {
      el.dataset.state = 'idle';
      el.querySelector('.rt-stage-note').textContent = '';
      el.querySelector('.rt-stage-monitor').textContent = '';
      el.removeAttribute('data-monitor');
      el.classList.remove('is-block', 'is-hold');
    }
    for (const el of Object.values(exitEls)) el.removeAttribute('data-lit');
    badgesEl.innerHTML = '';
  }

  function resetLane() {
    for (const el of Object.values(stageEls)) {
      el.dataset.state = 'idle';
      el.querySelector('.rt-stage-note').textContent = '';
      el.querySelector('.rt-stage-monitor').textContent = '';
      el.removeAttribute('data-monitor');
      el.classList.remove('is-block', 'is-hold');
    }
    for (const el of Object.values(exitEls)) el.removeAttribute('data-lit');
    token.style.opacity = '0';
    token.style.transform = '';
    tokenAt = null;
    token.dataset.tool = '';
    token.textContent = '';
    badgesEl.innerHTML = '';
    captionEl.textContent = '';
    setCount(0);
  }

  function applyFinalFrame(trace, prefix) {
    captionEl.textContent = prefix + trace.caption;
    token.dataset.tool = trace.tool;
    token.textContent = trace.tool;
    applyBadges(trace);
    setStage('action', 'pass', trace);
    setStage('rules', trace.stages.rules, trace);
    setStage('judge', trace.stages.judge, trace);
    setStage('policy', trace.stages.policy, trace);
    lightExit(trace.exit);
    setStage('evidence', 'pass', trace);
    moveToken(stageEls.evidence);
  }

  function addDot(trace, prefix) {
    const d = document.createElement('span');
    d.className = 'rt-dot';
    d.dataset.exit = trace.exit;
    d.title = prefix + trace.caption;
    d.tabIndex = 0;
    d.setAttribute('aria-label', prefix + trace.caption);
    dotsEl.appendChild(d);
  }

  async function playTrace(trace, prefix, g, stepMs) {
    clearStages();
    captionEl.textContent = prefix + trace.caption;
    token.dataset.tool = trace.tool;
    token.textContent = trace.tool;
    applyBadges(trace);

    setStage('action', 'active', trace);
    moveToken(stageEls.action);
    await tick(stepMs, g);

    setStage('action', 'pass', trace);
    setStage('rules', 'active', trace);
    moveToken(stageEls.rules);
    await tick(stepMs, g);

    setStage('rules', trace.stages.rules, trace);
    setStage('judge', 'active', trace);
    moveToken(stageEls.judge);
    await tick(stepMs, g);

    setStage('judge', trace.stages.judge, trace);
    setStage('policy', 'active', trace);
    moveToken(stageEls.policy);
    await tick(stepMs, g);

    setStage('policy', trace.stages.policy, trace);
    lightExit(trace.exit);
    moveToken(exitEls[trace.exit]);
    await tick(stepMs, g);

    setStage('evidence', 'active', trace);
    moveToken(stageEls.evidence);
    await tick(stepMs, g);

    setStage('evidence', 'pass', trace);
  }

  async function waitVisible(g) {
    while (gen === g && idleG === g) {
      if (onScreen && docVisible) return;
      await tick(250, g);
    }
    throw new Error('stale');
  }

  function resolveStale(c) { if (cur === c) { cur = null; c.resolve('stale'); } }

  async function runReplay(c) {
    const { traces, isCurrent } = c;
    try {
      for (let i = 0; i < traces.length; i++) {
        root.dataset.actionIndex = String(i + 1);
        const t = traces[i];
        const prefix = `Action ${i + 1} of ${traces.length} · `;
        if (reducedMotion) applyFinalFrame(t, prefix);
        else await playTrace(t, prefix, c.g, STEP_MS);
        if (gen !== c.g || (isCurrent && !isCurrent())) return resolveStale(c);
        addDot(t, prefix);
        setCount(i + 1);
      }
      root.dataset.mode = 'done';
      if (cur === c) cur = null;
      c.resolve('done');
    } catch { resolveStale(c); }
  }

  function replay(envs, { isCurrent } = {}) {
    ++gen; clearTimers(); forgetIdle();
    if (cur) { const c = cur; cur = null; c.resolve('stale'); }
    const traces = (envs ?? []).filter(e => e.boundary === 'pre_tool').map(traceOf);
    root.dataset.mode = 'replay';
    root.dataset.source = 'run';
    root.dataset.actionCount = String(traces.length);
    root.dataset.actionIndex = '';
    dotsEl.innerHTML = '';
    setCount(0);
    resetLane();
    return new Promise(resolve => { cur = { traces, g: gen, isCurrent, resolve }; runReplay(cur).catch(() => {}); });
  }

  function skip() {
    if (!cur) return;
    const c = cur; cur = null;
    ++gen; clearTimers();
    const n = c.traces.length;
    if (n) {
      for (let i = 0; i < n; i++) addDot(c.traces[i], `Action ${i + 1} of ${n} · `);
      setCount(n);
      applyFinalFrame(c.traces[n - 1], `Action ${n} of ${n} · `);
    }
    root.dataset.actionIndex = String(n);
    root.dataset.mode = 'done';
    c.resolve('done');
  }

  function stop() {
    ++gen; clearTimers(); forgetIdle();
    if (cur) { const c = cur; cur = null; c.resolve('stale'); }
  }

  function reset() {
    ++gen; clearTimers(); forgetIdle();
    if (cur) { const c = cur; cur = null; c.resolve('stale'); }
    root.dataset.mode = 'idle';
    root.dataset.source = '';
    root.dataset.actionCount = '';
    root.dataset.actionIndex = '';
    dotsEl.innerHTML = '';
    setCount(0);
    resetLane();
  }

  function error(message) {
    ++gen; clearTimers(); forgetIdle();
    if (cur) { const c = cur; cur = null; c.resolve('stale'); }
    root.dataset.mode = 'error';
    root.dataset.source = '';
    root.dataset.actionCount = '';
    root.dataset.actionIndex = '';
    dotsEl.innerHTML = '';
    resetLane();
    captionEl.textContent = message;
  }

  function idle(examples) {
    ++gen; clearTimers(); forgetIdle();
    if (cur) { const c = cur; cur = null; c.resolve('stale'); }
    idleList = examples ?? [];
    const list = idleList.map(e => ({ id: e.id, trace: traceOf(e.env) }));
    root.dataset.mode = 'idle';
    root.dataset.source = 'reference';
    root.dataset.actionCount = String(list.length);
    root.dataset.actionIndex = '';
    dotsEl.innerHTML = '';
    setCount(0);
    resetLane();
    if (!list.length) return;

    if (reducedMotion) {
      const last = list[list.length - 1];
      root.dataset.actionIndex = String(list.length);
      applyFinalFrame(last.trace, `Example · ${last.id} · default-policy reference · `);
      setCount(1);
      return;
    }

    const g = gen;
    idleG = g;
    (async () => {
      let i = 0;
      while (idleG === g && gen === g) {
        await waitVisible(g);
        if (idleG !== g || gen !== g) break;
        const ex = list[i % list.length];
        root.dataset.actionIndex = String((i % list.length) + 1);
        setCount(0);
        await playTrace(ex.trace, `Example · ${ex.id} · default-policy reference · `, g, IDLE_STEP_MS);
        if (idleG !== g || gen !== g) break;
        setCount(1);   // the example's one envelope is now the one record
        await tick(IDLE_HOLD_MS, g);
        i++;
      }
    })().catch(() => {});
  }

  skipBtn.addEventListener('click', skip);

  return { idle, replay, skip, stop, reset, error };
}
