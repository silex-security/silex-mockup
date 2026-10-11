// Runtime Observation · Ontology "Example runs" (logs/2026-10-11_RT_SUBTABS_VISUAL_PLAN.md, T3).
// One held-out run for one rule, drawn as a horizontal timeline (vertical below 600 px): the user task sits in a bubble
// at the start, then one card per tool call carrying its read/write icon, joined by arrows. The rule's first alert turns
// red, pulses once and is marked "Alert"; every other card is marked "No alert" and shows, in small text, the rule's own
// reason. The flagged card also shows the explanation chain: the ontology's typed labels when the data has an
// explanation (data-onto-chain), the generic rule's three sentences otherwise, always ending in the source excerpt with
// the value highlighted. Every number, label and verdict comes from data/onto-observability.json, passed in by
// js/rt-ontology.js; a missing field is never invented (an explanation that is null just shows why_not).
// Motion only runs while the root carries .rt-onto-motion (play() adds it; pause(), reset(), destroy() and the end of a
// run remove it), so the idle, paused and reduced-motion states are the complete static picture and nothing is ever
// hidden waiting for an animation. No DOM access at module top level and no imports.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const HOW = 'Each card is one tool call of this real run, in order. The rule’s first alert is red and marked <b>Alert</b>; every other card shows, in the rule’s own words, why it raised no alert.';
const TASK_TIP = 'The user’s own instruction for this run. Values the agent read from a tool output are not part of it — that difference is what the chain’s last label checks.';

// Icons are decorative or labelled; colour is never the only carrier of the verdict.
const ALERT_ICON = '<svg class="rt-onto-ic" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 2.6 14.6 13.6H1.4Z"/><path d="M8 6.6v3.1"/><path d="M8 11.9v.1"/></svg>';
const OK_ICON = '<svg class="rt-onto-ic" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 8.4 6.4 12 13 4.6"/></svg>';
const IO_ICON = {
  read: '<path d="M8 2.5v7"/><path d="M5.2 6.7 8 9.5l2.8-2.8"/><path d="M2.8 12.5h10.4"/>',
  write: '<path d="M8 9.5v-7"/><path d="M5.2 5.8 8 3l2.8 2.8"/><path d="M2.8 12.5h10.4"/>',
};

function hl(text, needle) {
  const t = String(text ?? ''), i = needle ? t.indexOf(needle) : -1;
  return i < 0 ? esc(t) : `${esc(t.slice(0, i))}<mark>${esc(needle)}</mark>${esc(t.slice(i + needle.length))}`;
}

/** The explanation chain, ending in the source excerpt with the value highlighted. */
function chain(x, typed) {
  if (!x) return '';
  const src = `<div class="rt-onto-src"><div class="rt-onto-src-ref">${esc(x.source.ref)}</div><div>${hl(x.source.excerpt, x.value)}</div></div>`;
  if (!typed) return `<ol class="rt-onto-chain"><li><b>${esc(x.tool)}</b> is a write call</li><li>argument <code>${esc(x.arg)}</code> = <code>${esc(x.value)}</code></li><li>the value appeared earlier in a tool output and not in the user's task</li></ol>${src}`;
  return `<ol class="rt-onto-chain" data-onto-chain>
    <li><b>${esc(x.tool)}</b> <span class="rt-onto-k">may cause</span> ${x.effects.map(e => `<span class="rt-onto-tag">${esc(e)}</span>`).join(' ')}</li>
    <li>argument <code>${esc(x.arg)}</code> <span class="rt-onto-k">denotes</span> <span class="rt-onto-tag">${esc(x.class)}</span> <span class="rt-onto-k">— a class the ontology's hazards target</span></li>
    <li>its value <code>${esc(x.value)}</code> <span class="rt-onto-k">appeared earlier in a tool output, not in the user's task</span></li></ol>${src}`;
}

/** One call card: tool, read/write icon, the rule's verdict, then the chain or the reason text. */
function callCard(c, rule, why, typed) {
  const flagged = rule.call_index === c.index;
  const impact = c.impact ?? '';
  const io = `<span class="rt-onto-io"><svg class="rt-onto-io-ic" role="img" aria-label="${esc(impact)} call: ${esc(c.tool)}" viewBox="0 0 16 16" focusable="false">${IO_ICON[c.impact] ?? IO_ICON.read}</svg><span>${esc(impact)}</span></span>`;
  const body = flagged ? chain(rule.explanation, typed) : `<div class="rt-onto-why">${esc(why[c.index] ?? '')}</div>`;
  return `<li class="rt-onto-call${flagged ? ' flagged' : ''}" data-onto-call="${c.index}"${flagged ? ' data-onto-flagged' : ''}>
    <div class="rt-onto-call-head"><code>${esc(c.tool)}</code><span class="rt-onto-head-io">${io}<span class="rt-chip" data-kind="${flagged ? 'blocked' : 'ran'}">${flagged ? `${ALERT_ICON}Alert` : `${OK_ICON}No alert`}</span></span></div>
    <div class="rt-onto-args">${esc(c.args)}</div>
    <div class="rt-onto-call-body">${body}</div></li>`;
}

/** Only shown when the data says so: the two rules do not always alert on the same call. */
function differText(ex, mode) {
  const otp = ex.otp?.call_index, prov = ex.prov?.call_index;
  return otp != null && prov != null && otp !== prov ? `The two rules alert on different calls of this run (the other rule's first alert is call ${mode === 'onto' ? prov : otp}).` : '';
}

function reasonOf(ex, mode) { return ex.why_not?.[mode === 'onto' ? 'otp' : 'prov'] ?? {}; }
function ruleOf(ex, mode) { return mode === 'onto' ? ex.otp : ex.prov; }

/** Re-decide every card for a new rule without touching the timeline block (a mode-only update). */
function applyDecisions(root, ex, mode) {
  const rule = ruleOf(ex, mode), why = reasonOf(ex, mode), typed = mode === 'onto';
  for (const li of root.querySelectorAll('[data-onto-call]')) {
    const index = Number(li.dataset.ontoCall);
    const flagged = rule.call_index === index;
    li.classList.toggle('flagged', flagged);
    if (flagged) li.setAttribute('data-onto-flagged', ''); else li.removeAttribute('data-onto-flagged');
    const chip = li.querySelector('.rt-chip');
    if (chip) { chip.dataset.kind = flagged ? 'blocked' : 'ran'; chip.innerHTML = flagged ? `${ALERT_ICON}Alert` : `${OK_ICON}No alert`; }
    const body = li.querySelector('.rt-onto-call-body');
    if (body) body.innerHTML = flagged ? chain(rule.explanation, typed) : `<div class="rt-onto-why">${esc(why[index] ?? '')}</div>`;
  }
  const note = root.querySelector('.rt-onto-differ');
  if (note) { note.textContent = differText(ex, mode); note.hidden = !note.textContent; }
}

function draw(el, input, tip) {
  const { ex, mode, desc } = input ?? {};
  if (!ex || ex.empty || !ex.run) {
    el.innerHTML = `<p class="rt-ref" data-onto-empty>${esc(desc)}: no qualifying example in the held-out runs.</p>`;
    return null;
  }
  const rule = ruleOf(ex, mode), why = reasonOf(ex, mode);
  const calls = ex.run.calls.map(c => callCard(c, rule, why, mode === 'onto')).join('');
  const kind = ex.run.outcome.startsWith('attack succeeded') ? 'blocked' : 'review';
  const differ = differText(ex, mode);
  el.innerHTML = `<div class="rt-onto-run" data-onto-run="${esc(ex.run.run_id)}" data-state="idle">
    <div class="rt-onto-run-head"><span class="rt-chip" data-kind="${kind}">${esc(ex.run.outcome)}</span>
      <span class="rt-ref">${esc(ex.run.model)} · ${esc(ex.run.suite)} · ${esc(desc)}${tip(HOW)}</span>
      <button type="button" class="btn sm rt-onto-run-replay" aria-label="Replay this run's timeline">Replay</button></div>
    <div class="rt-onto-timeline">
      <div class="rt-onto-task"><span class="rt-onto-task-k">User task${tip(TASK_TIP)}</span><p class="rt-onto-task-t">${esc(ex.run.task)}</p></div>
      <ol class="rt-onto-calls">${calls}</ol>
    </div>
    <p class="rt-ref rt-onto-differ"${differ ? '' : ' hidden'}>${esc(differ)}</p></div>`;
  return el.querySelector('[data-onto-run]');
}

const sameCase = (a, b) => !!a?.run && !!b?.run && a.cell === b.cell && a.run.run_id === b.run.run_id;

/**
 * @param {HTMLElement} el
 * @param {{ ex: object|undefined, mode: 'onto'|'prov', desc: string }} input
 * @param {{ tip?: (html: string, label?: string, cls?: string) => string, reducedMotion?: boolean }} opts
 * @returns {{ play(): void, pause(): void, reset(): void, update(input: object): void, destroy(): void }}
 */
export function mountOntoRun(el, input, opts = {}) {
  const none = () => {};
  if (!el) return { play: none, pause: none, reset: none, update: none, destroy: none };
  const tip = typeof opts.tip === 'function' ? opts.tip : () => '';
  const reduced = !!opts.reducedMotion;
  const FULL = 1900, CHAIN = 1300;
  let root = null, last = null, timer = null, state = 'idle', replayBtn = null;

  function setState(s) { state = s; if (root) root.dataset.state = s; }
  function stop() { if (timer) { clearTimeout(timer); timer = null; } root?.classList.remove('rt-onto-motion', 'rt-onto-motion-chain'); }
  function motion(cls, ms) {
    stop();
    if (!root) return;
    root.classList.remove('rt-onto-motion', 'rt-onto-motion-chain');
    void root.offsetWidth; // restart the CSS animations from their first frame
    root.classList.add(cls);
    setState('playing');
    timer = setTimeout(() => { timer = null; root?.classList.remove(cls); setState('done'); }, ms);
  }
  function drawAll(next) {
    stop();
    last = next ?? {};
    replayBtn?.removeEventListener('click', onReplay);
    root = draw(el, last, tip);
    replayBtn = root?.querySelector('.rt-onto-run-replay') ?? null;
    replayBtn?.addEventListener('click', onReplay);
    setState(root && reduced ? 'done' : 'idle');
  }
  function onReplay() { motion('rt-onto-motion', FULL); }

  const api = {
    play() { if (root) motion('rt-onto-motion', FULL); },
    pause() { stop(); if (state === 'playing') setState('paused'); },
    reset() { stop(); setState(root && reduced ? 'done' : 'idle'); },
    update(next) {
      const n = next ?? {};
      // Only the rule changed: re-decide the cards and replay the chain, never redraw the timeline block.
      if (root && last && n.desc === last.desc && sameCase(last.ex, n.ex)) {
        if (n.mode !== last.mode) { applyDecisions(root, n.ex, n.mode); last = n; motion('rt-onto-motion-chain', CHAIN); return; }
        last = n;
        return;
      }
      drawAll(n);
    },
    destroy() {
      stop();
      replayBtn?.removeEventListener('click', onReplay);
      replayBtn = null; root = null; last = null;
      el.innerHTML = '';
      if (typeof window !== 'undefined' && window.__rtOntoRun === api) delete window.__rtOntoRun;
    },
  };
  drawAll(input);
  // One mounted run at a time; the handle is exposed for the headless test (tests/site/rt-onto-run.test.mjs).
  if (typeof window !== 'undefined') window.__rtOntoRun = api;
  return api;
}
