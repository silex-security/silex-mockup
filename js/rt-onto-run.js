// Runtime Observation · Ontology example runs (logs/2026-10-11_RT_SUBTABS_VISUAL_PLAN.md, T3).
// mountOntoRun draws one held-out run for one rule (mode 'onto' = with ontology types, 'prov' = without): its calls, the call
// the rule alerts on with the rule's explanation, and why every other call raised no alert. Data from
// data/onto-observability.json, passed in by js/rt-ontology.js. No DOM access at module top level.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

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


/**
 * @param {HTMLElement} el
 * @param {{ ex: object|undefined, mode: 'onto'|'prov', desc: string }} input
 * @returns {{ play(): void, pause(): void, reset(): void, update(input: object): void, destroy(): void }}
 */
export function mountOntoRun(el, input, opts = {}) {
  const none = () => {};
  if (!el) return { play: none, pause: none, reset: none, update: none, destroy: none };
  draw(el, input);
  return { play: none, pause: none, reset: none, update: next => draw(el, next), destroy() { el.innerHTML = ''; } };
}

function draw(el, { ex, mode, desc }) {
  if (!ex || ex.empty) { el.innerHTML = `<p class="rt-ref" data-onto-empty>${esc(desc)}: no qualifying example in the held-out runs.</p>`; return; }
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
  el.innerHTML = `<div class="rt-onto-run" data-onto-run="${esc(ex.run.run_id)}">
    <div class="rt-onto-run-head"><span class="rt-chip" data-kind="${ex.run.outcome.startsWith('attack succeeded') ? 'blocked' : 'review'}">${esc(ex.run.outcome)}</span>
      <span class="rt-ref">${esc(ex.run.model)} · ${esc(ex.run.suite)} · ${esc(desc)}</span></div>
    <p class="rt-onto-task"><b>User task:</b> ${esc(ex.run.task)}</p>${differ}
    <ol class="rt-onto-calls">${calls}</ol></div>`;
}
